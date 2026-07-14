<?php
if (!defined('ABSPATH')) {
    exit;
}

class Maskara_Order_Sync {
    private $sent_meta_key = '_maskara_sent';

    public function __construct() {
        add_action('woocommerce_checkout_order_processed', array($this, 'queue_send'), 20, 1);
        add_action('woocommerce_store_api_checkout_order_processed', array($this, 'queue_send_order_obj'), 20, 1);
        add_action('woocommerce_new_order', array($this, 'queue_send'), 20, 1);
        add_action('woocommerce_thankyou', array($this, 'queue_send'), 5, 1);
        add_action('woocommerce_order_status_processing', array($this, 'queue_send'), 10, 1);
        add_action('woocommerce_order_status_on-hold', array($this, 'queue_send'), 10, 1);
        add_action('woocommerce_order_status_pending', array($this, 'queue_send'), 10, 1);
        add_action('woocommerce_payment_complete', array($this, 'queue_send'), 20, 1);

        // Cancel / refund / fail on website → notify Maskara to stop calls
        add_action('woocommerce_order_status_cancelled', array($this, 'queue_status_sync'), 10, 1);
        add_action('woocommerce_order_status_refunded', array($this, 'queue_status_sync'), 10, 1);
        add_action('woocommerce_order_status_failed', array($this, 'queue_status_sync'), 10, 1);

        add_action('maskara_send_order_event', array($this, 'maybe_send_order'), 10, 1);
        add_action('maskara_sync_order_status_event', array($this, 'sync_order_status'), 10, 1);
        add_action('woocommerce_order_actions', array($this, 'add_order_action'));
        add_action('woocommerce_order_action_maskara_send', array($this, 'manual_send_order'));
    }

    public function queue_send_order_obj($order) {
        if ($order instanceof WC_Order) {
            $this->queue_send($order->get_id());
        }
    }

    public function queue_send($order_id) {
        $order_id = absint($order_id);
        if (!$order_id) return;

        // Prefer WooCommerce Action Scheduler (async, reliable)
        if (function_exists('as_enqueue_async_action')) {
            as_enqueue_async_action('maskara_send_order_event', array($order_id), 'maskara');
            return;
        }
        // Fallback: run soon via WP cron
        if (!wp_next_scheduled('maskara_send_order_event', array($order_id))) {
            wp_schedule_single_event(time() + 5, 'maskara_send_order_event', array($order_id));
        }
        // Also try immediately (checkout may allow)
        $this->maybe_send_order($order_id);
    }

    /** Queue a status sync (cancel/refund/fail) to Maskara. */
    public function queue_status_sync($order_id) {
        $order_id = absint($order_id);
        if (!$order_id) return;

        if (function_exists('as_enqueue_async_action')) {
            as_enqueue_async_action('maskara_sync_order_status_event', array($order_id), 'maskara');
            return;
        }
        if (!wp_next_scheduled('maskara_sync_order_status_event', array($order_id))) {
            wp_schedule_single_event(time() + 2, 'maskara_sync_order_status_event', array($order_id));
        }
        $this->sync_order_status($order_id);
    }

    /**
     * Notify Maskara of Woo cancel/refund/fail so dashboard shows CANCELLED and calls stop.
     */
    public function sync_order_status($order_id) {
        $api = new Maskara_API();
        if (!$api->is_configured()) {
            return;
        }

        $order = wc_get_order(absint($order_id));
        if (!$order) return;

        // Only sync if Maskara already knows about this order (or force via webhook)
        $response = $api->parse_response($api->sync_order_status($order));
        if (is_wp_error($response)) {
            $order->add_order_note('Maskara status sync failed: ' . $response->get_error_message());
            return;
        }

        $status = $order->get_status();
        if (in_array($status, array('cancelled', 'refunded', 'failed'), true)) {
            $order->update_meta_data('_maskara_verify_status', 'cancelled');
            $order->save();
            $order->add_order_note('Maskara: order marked CANCELLED (website ' . $status . ').');
        }
    }

    public function add_order_action($actions) {
        $actions['maskara_send'] = 'Send / Resend to Maskara';
        return $actions;
    }

    public function manual_send_order($order) {
        if (!$order instanceof WC_Order) return;
        $order->delete_meta_data($this->sent_meta_key);
        $order->save();
        $this->maybe_send_order($order->get_id(), true);
    }

    public function maybe_send_order($order_id, $force = false) {
        $api = new Maskara_API();
        // Auto-send if API key configured (Connect recommended but not required)
        if (!$api->is_configured()) {
            return;
        }

        $order = wc_get_order($order_id);
        if (!$order) return;

        if (!$force && $order->get_meta($this->sent_meta_key)) {
            return;
        }

        // Lock to avoid double send
        $lock_key = 'maskara_lock_' . $order_id;
        if (get_transient($lock_key) && !$force) return;
        set_transient($lock_key, 1, 60);

        if (get_option('maskara_cod_only', 'no') === 'yes' && !$this->is_cod_order($order)) {
            $order->add_order_note('Maskara: skipped — not COD.');
            return;
        }

        if (empty($order->get_billing_phone())) {
            $order->add_order_note('Maskara: skipped — no billing phone.');
            return;
        }

        $response = $api->parse_response($api->send_order($order));
        if (is_wp_error($response)) {
            $order->add_order_note('Maskara auto-send failed: ' . $response->get_error_message());
            delete_transient($lock_key);
            // retry once in 2 minutes
            if (function_exists('as_schedule_single_action')) {
                as_schedule_single_action(time() + 120, 'maskara_send_order_event', array($order_id), 'maskara');
            }
            return;
        }

        $order->update_meta_data($this->sent_meta_key, 'yes');
        $order->update_meta_data('_maskara_sent_at', current_time('mysql'));
        $order->update_meta_data('_maskara_verify_status', 'pending');
        $order->update_meta_data('_maskara_call_count', 0);
        $order->save();
        $dup = is_array($response) && !empty($response['duplicate']);
        $order->add_order_note($dup
            ? 'Maskara: already synced (duplicate).'
            : 'Maskara: auto-sent for AI voice verification.');
    }

    private function is_cod_order($order) {
        $method = strtolower((string) $order->get_payment_method());
        $title  = strtolower((string) $order->get_payment_method_title());
        foreach (array('cod', 'cash on delivery', 'cash-on-delivery', 'ক্যাশ') as $n) {
            if (strpos($method, $n) !== false || strpos($title, $n) !== false) return true;
        }
        return false;
    }
}
