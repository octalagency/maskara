<?php
if (!defined('ABSPATH')) {
    exit;
}

class Maskara_Order_Sync {
    private $sent_meta_key = '_maskara_sent';

    public function __construct() {
        add_action('woocommerce_order_status_processing', array($this, 'maybe_send_order'), 10, 1);
        add_action('woocommerce_order_status_on-hold', array($this, 'maybe_send_order'), 10, 1);
        add_action('woocommerce_order_status_pending', array($this, 'maybe_send_order'), 10, 1);
    }

    public function maybe_send_order($order_id) {
        if (get_option('maskara_connected', 'no') !== 'yes') {
            return;
        }

        $order = wc_get_order($order_id);
        if (!$order) {
            return;
        }

        if ($order->get_meta($this->sent_meta_key)) {
            return;
        }

        if (get_option('maskara_cod_only', 'yes') === 'yes' && !$this->is_cod_order($order)) {
            return;
        }

        if (empty($order->get_billing_phone())) {
            $order->add_order_note('Maskara: skipped — no billing phone number.');
            return;
        }

        $api = new Maskara_API();
        if (!$api->is_configured()) {
            return;
        }

        $response = $api->parse_response($api->send_order($order));

        if (is_wp_error($response)) {
            $order->add_order_note('Maskara verification failed: ' . $response->get_error_message());
            return;
        }

        $order->update_meta_data($this->sent_meta_key, 'yes');
        $order->save();
        $order->add_order_note('Maskara: order sent for AI voice verification.');
    }

    private function is_cod_order($order) {
        $method = strtolower($order->get_payment_method());
        $title  = strtolower($order->get_payment_method_title());

        if (strpos($method, 'cod') !== false) {
            return true;
        }
        if (strpos($title, 'cash on delivery') !== false || strpos($title, 'cod') !== false) {
            return true;
        }
        if (strpos($title, 'ক্যাশ') !== false) {
            return true;
        }

        return false;
    }
}
