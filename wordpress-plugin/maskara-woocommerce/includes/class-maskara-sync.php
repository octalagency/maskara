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
        add_action(self::CRON_HOOK, array($this, 'sync_all'));
        add_action('wp', array($this, 'maybe_schedule'));
    }

    public static function schedule() {
        if (!wp_next_scheduled(self::CRON_HOOK)) {
            wp_schedule_event(time() + 60, 'hourly', self::CRON_HOOK);
        }
    }

    public static function unschedule() {
        $ts = wp_next_scheduled(self::CRON_HOOK);
        if ($ts) {
            wp_unschedule_event($ts, self::CRON_HOOK);
        }
    }

    public function maybe_schedule() {
        self::schedule();
    }

    /**
     * Sync active Pathao consignments.
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

        foreach ($rows as $row) {
            $checked++;
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
                    $order->update_meta_data('_maskara_courier_status', $result['status']);
                    $order->update_meta_data('_maskara_pathao_status', $result['status']);
                    $order->save();
                    if ($result['status'] !== $row->status_normalized) {
                        $order->add_order_note(sprintf(
                            'Pathao status: %s → %s',
                            $row->status_normalized,
                            $result['status']
                        ));
                    }
                }
            } else {
                $failed++;
            }
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

        return array('success' => true, 'status' => $result['status']);
    }
}
