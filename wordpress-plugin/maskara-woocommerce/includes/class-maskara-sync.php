<?php
if (!defined('ABSPATH')) {
    exit;
}

/**
 * Pathao status polling via WP-Cron.
 */
class Maskara_Sync {

    const CRON_HOOK = 'maskara_sync_shipments';

    public function __construct() {
        add_filter('cron_schedules', array(__CLASS__, 'register_cron_schedules'));
        add_action(self::CRON_HOOK, array($this, 'sync_all'));
        add_action('wp', array($this, 'maybe_schedule'));
        add_action('admin_init', array($this, 'maybe_schedule'));
        // Manual sync from admin
        add_action('admin_post_maskara_sync_couriers', array($this, 'handle_manual_sync'));
        add_action('admin_post_maskara_sync_order', array($this, 'handle_sync_order'));
        // When opening Orders list, pull Pathao status for stuck Processing rows
        add_action('current_screen', array($this, 'maybe_autosync_orders_screen'));
    }

    public static function schedule() {
        $ts = wp_next_scheduled(self::CRON_HOOK);
        if ($ts) {
            wp_unschedule_event($ts, self::CRON_HOOK);
        }
        if (!wp_next_scheduled(self::CRON_HOOK)) {
            wp_schedule_event(time() + 60, 'maskara_5min', self::CRON_HOOK);
        }
    }

    public static function register_cron_schedules($schedules) {
        if (!isset($schedules['maskara_5min'])) {
            $schedules['maskara_5min'] = array(
                'interval' => 5 * 60,
                'display'  => 'Every 5 minutes (Maskara courier sync)',
            );
        }
        // Keep old key so existing schedules don't break
        if (!isset($schedules['maskara_15min'])) {
            $schedules['maskara_15min'] = array(
                'interval' => 5 * 60,
                'display'  => 'Every 5 minutes (Maskara courier sync)',
            );
        }
        return $schedules;
    }

    public static function unschedule() {
        $ts = wp_next_scheduled(self::CRON_HOOK);
        if ($ts) {
            wp_unschedule_event($ts, self::CRON_HOOK);
        }
    }

    public function maybe_schedule() {
        $next = wp_next_scheduled(self::CRON_HOOK);
        if (!$next) {
            self::schedule();
            return;
        }
        // Migrate old 15-min schedule to 5-min
        if (wp_get_schedule(self::CRON_HOOK) !== 'maskara_5min') {
            self::schedule();
        }
    }

    public function handle_manual_sync() {
        if (!current_user_can('manage_woocommerce')) {
            wp_die('Forbidden');
        }
        check_admin_referer('maskara_sync_couriers');
        $result = $this->sync_all(200);
        $msg = sprintf(
            'Synced %d consignments (%d updated, %d failed).',
            (int) $result['checked'],
            (int) $result['updated'],
            (int) $result['failed']
        );
        wp_safe_redirect(add_query_arg(
            array(
                'page'         => 'maskara-settings',
                'maskara_sync' => rawurlencode($msg),
            ),
            admin_url('admin.php')
        ));
        exit;
    }

    public function handle_sync_order() {
        if (!current_user_can('manage_woocommerce')) {
            wp_die('Forbidden');
        }
        check_admin_referer('maskara_sync_order');
        $order_id = isset($_GET['order_id']) ? absint($_GET['order_id']) : 0;
        $order    = $order_id ? wc_get_order($order_id) : false;
        $redirect = wp_get_referer() ?: admin_url('admin.php?page=wc-orders');

        if (!$order) {
            wp_safe_redirect(add_query_arg('maskara_sync_err', 'Order not found', $redirect));
            exit;
        }

        $res = self::sync_wc_order($order);
        if (is_wp_error($res)) {
            wp_safe_redirect(add_query_arg('maskara_sync_err', rawurlencode($res->get_error_message()), $redirect));
            exit;
        }

        wp_safe_redirect(add_query_arg(
            'maskara_sync_ok',
            rawurlencode('Order #' . $order_id . ' → ' . ($res['status'] ?? 'updated')),
            $redirect
        ));
        exit;
    }

    /**
     * On WooCommerce orders screen, sync a few stuck Processing consignments.
     */
    public function maybe_autosync_orders_screen($screen) {
        if (!$screen || !current_user_can('manage_woocommerce')) {
            return;
        }
        $id = (string) ($screen->id ?? '');
        if (
            strpos($id, 'wc-orders') === false
            && strpos($id, 'shop_order') === false
            && $id !== 'edit-shop_order'
        ) {
            return;
        }
        if (get_transient('maskara_autosync_orders_lock')) {
            return;
        }
        set_transient('maskara_autosync_orders_lock', 1, 90);

        $orders = wc_get_orders(array(
            'limit'        => 8,
            'status'       => array('processing', 'completed', 'on-hold'),
            'meta_key'     => '_maskara_pathao_consignment',
            'meta_compare' => 'EXISTS',
            'orderby'      => 'date',
            'order'        => 'DESC',
        ));

        foreach ($orders as $order) {
            if (!$order instanceof WC_Order) {
                continue;
            }
            $courier = strtolower((string) (
                $order->get_meta('_maskara_courier_status')
                ?: $order->get_meta('_maskara_pathao_status')
                ?: 'processing'
            ));
            if (!in_array($courier, array('processing', 'pending', 'in_transit', 'hold', ''), true)) {
                continue;
            }
            self::sync_wc_order($order);
        }
    }

    /**
     * Sync one WooCommerce order from Pathao by consignment meta.
     *
     * @return array|WP_Error
     */
    public static function sync_wc_order(WC_Order $order) {
        $consignment = Maskara_Pathao::clean_consignment_id(
            $order->get_meta('_maskara_pathao_consignment')
        );
        if ($consignment === '') {
            return new WP_Error('maskara_no_consignment', 'No Pathao consignment on this order');
        }

        // Persist cleaned id
        if ((string) $order->get_meta('_maskara_pathao_consignment') !== $consignment) {
            $order->update_meta_data('_maskara_pathao_consignment', $consignment);
            $order->save();
        }

        $result = Maskara_Pathao::fetch_status($consignment);
        if (is_wp_error($result)) {
            return $result;
        }
        if (empty($result['success'])) {
            return new WP_Error('maskara_sync', $result['error'] ?? 'Pathao sync failed');
        }

        $shipments = new Maskara_Shipments();
        $shipments->record_dispatch($order, array(
            'consignment_id' => $consignment,
            'order_status'   => $result['status_raw'],
            'delivery_fee'   => $result['delivery_charge'] ?? 0,
            'raw'            => $result['raw'] ?? array(),
        ));
        $row = $shipments->get_by_consignment($consignment);
        if ($row) {
            $shipments->update((int) $row->id, array(
                'status'            => $result['status_raw'],
                'status_normalized' => $result['status'],
                'collected_amount'  => $result['collected_amount'],
                'delivery_charge'   => $result['delivery_charge'],
                'return_charge'     => $result['return_charge'],
                'is_paid_return'    => !empty($result['is_paid_return']) ? 1 : 0,
                'raw_response'      => wp_json_encode($result['raw'] ?? array()),
            ));
        }

        $prev = (string) ($order->get_meta('_maskara_courier_status') ?: 'unknown');
        if ($result['status'] !== $prev) {
            $order->add_order_note(sprintf(
                'Pathao status: %s → %s (%s)',
                $prev,
                $result['status'],
                $result['status_raw']
            ));
        }

        self::apply_courier_status_to_order(
            $order,
            $result['status'],
            (string) $result['status_raw']
        );

        return array(
            'success' => true,
            'status'  => $result['status'],
            'raw'     => $result['status_raw'],
        );
    }

    /**
     * When Pathao cancels (incl. Pickup Cancel), cancel WooCommerce order + meta.
     */
    public static function apply_courier_status_to_order(WC_Order $order, $normalized_status, $raw_status = '') {
        $normalized_status = Maskara_Shipments::normalize_pathao_status($normalized_status);
        $order->update_meta_data('_maskara_courier_status', $normalized_status);
        $order->update_meta_data('_maskara_pathao_status', $normalized_status);
        if ($raw_status !== '') {
            $order->update_meta_data('_maskara_pathao_status_raw', sanitize_text_field((string) $raw_status));
        }
        $order->save();

        if ($normalized_status === Maskara_Shipments::STATUS_CANCELLED) {
            if (!in_array($order->get_status(), array('cancelled', 'refunded', 'failed'), true)) {
                $order->update_status(
                    'cancelled',
                    'কুরিয়ার থেকে অর্ডার ক্যান্সেল হয়েছে (Pickup Cancel) — WooCommerce-এও Cancelled করা হয়েছে।'
                );
            }
        }
    }

    /**
     * Sync active Pathao consignments (+ fallback via order meta).
     *
     * @param int $limit
     * @return array{checked:int,updated:int,failed:int}
     */
    public function sync_all($limit = 100) {
        $shipments = new Maskara_Shipments();
        $rows      = $shipments->get_active($limit);
        $checked   = 0;
        $updated   = 0;
        $failed    = 0;
        $seen      = array();

        foreach ($rows as $row) {
            $checked++;
            $seen[$row->consignment_id] = true;
            $result = Maskara_Pathao::fetch_status($row->consignment_id);
            if (is_wp_error($result) || empty($result['success'])) {
                $failed++;
                continue;
            }

            $ok = $shipments->update((int) $row->id, array(
                'status'            => $result['status_raw'],
                'status_normalized' => $result['status'],
                'collected_amount'  => $result['collected_amount'],
                'delivery_charge'   => $result['delivery_charge'],
                'return_charge'     => $result['return_charge'],
                'is_paid_return'    => !empty($result['is_paid_return']) ? 1 : 0,
                'raw_response'      => wp_json_encode($result['raw'] ?? array()),
            ));

            if ($ok) {
                $updated++;
                $order = wc_get_order((int) $row->order_id);
                if ($order) {
                    $prev = (string) $row->status_normalized;
                    if ($result['status'] !== $prev) {
                        $order->add_order_note(sprintf(
                            'Pathao status: %s → %s (%s)',
                            $prev,
                            $result['status'],
                            $result['status_raw']
                        ));
                    }
                    self::apply_courier_status_to_order(
                        $order,
                        $result['status'],
                        (string) $result['status_raw']
                    );
                }
            } else {
                $failed++;
            }
        }

        // Fallback: orders with consignment meta not yet in shipments table / stuck Processing
        $meta_synced = $this->sync_from_order_meta($limit, $seen);
        $checked += $meta_synced['checked'];
        $updated += $meta_synced['updated'];
        $failed  += $meta_synced['failed'];

        return compact('checked', 'updated', 'failed');
    }

    /**
     * Sync by WooCommerce order meta `_maskara_pathao_consignment`.
     */
    private function sync_from_order_meta($limit, array $seen) {
        $checked = 0;
        $updated = 0;
        $failed  = 0;

        $orders = wc_get_orders(array(
            'limit'      => max(20, (int) $limit),
            'status'     => array('processing', 'completed', 'on-hold'),
            'meta_key'   => '_maskara_pathao_consignment',
            'meta_compare' => 'EXISTS',
            'orderby'    => 'date',
            'order'      => 'DESC',
        ));

        $shipments = new Maskara_Shipments();

        foreach ($orders as $order) {
            if (!$order instanceof WC_Order) {
                continue;
            }
            $consignment = (string) $order->get_meta('_maskara_pathao_consignment');
            if ($consignment === '' || isset($seen[$consignment])) {
                continue;
            }

            $courier = strtolower((string) (
                $order->get_meta('_maskara_courier_status')
                ?: $order->get_meta('_maskara_pathao_status')
            ));
            if (in_array($courier, array('delivered', 'returned', 'paid_return', 'cancelled'), true)) {
                continue;
            }

            $checked++;
            $result = Maskara_Pathao::fetch_status($consignment);
            if (is_wp_error($result) || empty($result['success'])) {
                $failed++;
                continue;
            }

            // Ensure shipment row exists for future cron
            $shipments->record_dispatch($order, array(
                'consignment_id' => $consignment,
                'order_status'   => $result['status_raw'],
                'delivery_fee'   => $result['delivery_charge'] ?? 0,
                'raw'            => $result['raw'] ?? array(),
            ));

            $row = $shipments->get_by_consignment($consignment);
            if ($row) {
                $shipments->update((int) $row->id, array(
                    'status'            => $result['status_raw'],
                    'status_normalized' => $result['status'],
                    'collected_amount'  => $result['collected_amount'],
                    'delivery_charge'   => $result['delivery_charge'],
                    'return_charge'     => $result['return_charge'],
                    'is_paid_return'    => !empty($result['is_paid_return']) ? 1 : 0,
                    'raw_response'      => wp_json_encode($result['raw'] ?? array()),
                ));
            }

            $prev = $courier ?: 'unknown';
            if ($result['status'] !== $prev) {
                $order->add_order_note(sprintf(
                    'Pathao status: %s → %s (%s)',
                    $prev,
                    $result['status'],
                    $result['status_raw']
                ));
            }
            self::apply_courier_status_to_order(
                $order,
                $result['status'],
                (string) $result['status_raw']
            );
            $updated++;
        }

        return compact('checked', 'updated', 'failed');
    }

    public function sync_one($shipment_id) {
        $shipments = new Maskara_Shipments();
        $row       = $shipments->get($shipment_id);
        if (!$row || empty($row->consignment_id)) {
            return new WP_Error('maskara_not_found', 'Shipment not found');
        }

        $result = Maskara_Pathao::fetch_status($row->consignment_id);
        if (is_wp_error($result)) {
            return $result;
        }
        if (empty($result['success'])) {
            return new WP_Error('maskara_sync', $result['error'] ?? 'Sync failed');
        }

        $shipments->update((int) $row->id, array(
            'status'            => $result['status_raw'],
            'status_normalized' => $result['status'],
            'collected_amount'  => $result['collected_amount'],
            'delivery_charge'   => $result['delivery_charge'],
            'return_charge'     => $result['return_charge'],
            'is_paid_return'    => !empty($result['is_paid_return']) ? 1 : 0,
            'raw_response'      => wp_json_encode($result['raw'] ?? array()),
        ));

        $order = wc_get_order((int) $row->order_id);
        if ($order) {
            self::apply_courier_status_to_order(
                $order,
                $result['status'],
                (string) $result['status_raw']
            );
        }

        return array('success' => true, 'status' => $result['status']);
    }
}
