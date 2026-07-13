<?php
if (!defined('ABSPATH')) {
    exit;
}

/**
 * WooCommerce Orders list: Verify status, call count, courier stage.
 */
class Maskara_Order_Columns {

    public function __construct() {
        add_filter('manage_woocommerce_page_wc-orders_columns', array($this, 'columns'), 20);
        add_action('manage_woocommerce_page_wc-orders_custom_column', array($this, 'render_hpos'), 20, 2);

        add_filter('manage_edit-shop_order_columns', array($this, 'columns'), 20);
        add_action('manage_shop_order_posts_custom_column', array($this, 'render_legacy'), 20, 2);

        add_action('admin_head', array($this, 'admin_styles'));
    }

    public function columns($columns) {
        $new = array();
        foreach ($columns as $key => $label) {
            $new[$key] = $label;
            if ($key === 'order_status' || $key === 'status') {
                $new['maskara_verify']  = 'Verify';
                $new['maskara_calls']   = 'Calls';
                $new['maskara_courier'] = 'Courier';
            }
        }
        if (!isset($new['maskara_verify'])) {
            $new['maskara_verify']  = 'Verify';
            $new['maskara_calls']   = 'Calls';
            $new['maskara_courier'] = 'Courier';
        }
        return $new;
    }

    public function render_hpos($column, $order) {
        if (!$order instanceof WC_Order) {
            $order = wc_get_order($order);
        }
        $this->render_cell($column, $order);
    }

    public function render_legacy($column, $post_id) {
        $this->render_cell($column, wc_get_order($post_id));
    }

    private function render_cell($column, $order) {
        if (!$order) {
            return;
        }

        switch ($column) {
            case 'maskara_verify':
                echo wp_kses_post(self::verify_badge($order));
                break;
            case 'maskara_calls':
                $count = (int) $order->get_meta('_maskara_call_count');
                $max   = (int) get_option('maskara_max_daily_calls', 9);
                if ($max < 1) {
                    $max = 10;
                }
                echo '<span class="msk-calls" title="আজ সর্বোচ্চ ' . esc_attr((string) $max) . ' বার কল">';
                echo esc_html((string) $count) . '<span class="msk-muted">/' . esc_html((string) $max) . '</span>';
                echo '</span>';
                break;
            case 'maskara_courier':
                echo wp_kses_post(self::courier_badge($order));
                break;
        }
    }

    public static function verify_badge($order) {
        $status = (string) $order->get_meta('_maskara_verify_status');
        if ($status === '') {
            $legacy = (string) $order->get_meta('_maskara_verification');
            if ($legacy === 'confirmed') {
                $status = 'verified';
            } elseif ($legacy === 'cancelled') {
                $status = 'cancelled';
            }
        }

        $map = array(
            'pending'  => array('label' => 'Pending', 'class' => 'msk-pending'),
            'calling'  => array('label' => 'Calling', 'class' => 'msk-calling'),
            'verified' => array('label' => 'Verified', 'class' => 'msk-verified'),
            'confirmed'=> array('label' => 'Verified', 'class' => 'msk-verified'),
            'cancelled'=> array('label' => 'Cancelled', 'class' => 'msk-cancelled'),
            'failed'   => array('label' => 'Failed', 'class' => 'msk-failed'),
        );

        $info = $map[strtolower($status)] ?? null;
        if (!$info) {
            return '<span class="msk-badge msk-muted">—</span>';
        }
        return '<span class="msk-badge ' . esc_attr($info['class']) . '">' . esc_html($info['label']) . '</span>';
    }

    public static function courier_badge($order) {
        $status = (string) $order->get_meta('_maskara_courier_status');
        if ($status === '') {
            $status = (string) $order->get_meta('_maskara_pathao_status');
        }

        $verify = strtolower((string) $order->get_meta('_maskara_verify_status'));
        if ($status === '' && !in_array($verify, array('verified', 'confirmed'), true)) {
            return '<span class="msk-badge msk-muted">—</span>';
        }
        if ($status === '') {
            $status = 'processing';
        }

        $map = array(
            'pending'    => array('label' => 'Processing', 'class' => 'msk-courier-processing'),
            'processing' => array('label' => 'Processing', 'class' => 'msk-courier-processing'),
            'in_transit' => array('label' => 'In Transit', 'class' => 'msk-courier-transit'),
            'delivered'  => array('label' => 'Delivered', 'class' => 'msk-courier-delivered'),
            'returned'   => array('label' => 'Return', 'class' => 'msk-courier-return'),
            'paid_return'=> array('label' => 'Return', 'class' => 'msk-courier-return'),
            'cancelled'  => array('label' => 'Cancelled', 'class' => 'msk-cancelled'),
            'hold'       => array('label' => 'Hold', 'class' => 'msk-pending'),
        );

        $info = $map[strtolower($status)] ?? array(
            'label' => ucwords(str_replace('_', ' ', $status)),
            'class' => 'msk-courier-processing',
        );

        return '<span class="msk-badge ' . esc_attr($info['class']) . '">' . esc_html($info['label']) . '</span>';
    }

    /** Persist Maskara fields from webhook payload. */
    public static function apply_payload(WC_Order $order, array $body) {
        $status = strtolower((string) ($body['verifyStatus'] ?? $body['status'] ?? ''));
        $outcome = strtolower((string) ($body['outcome'] ?? ''));

        if (in_array($outcome, array('confirmed', 'verified'), true)) {
            $status = 'verified';
        } elseif ($outcome === 'cancelled') {
            $status = 'cancelled';
        } elseif ($status === 'verified' || $status === 'confirmed') {
            $status = 'verified';
        } elseif ($status === 'calling') {
            $status = 'calling';
        } elseif ($status === 'failed') {
            $status = 'failed';
        } elseif ($status === 'pending') {
            $status = 'pending';
        }

        if ($status !== '') {
            $order->update_meta_data('_maskara_verify_status', $status);
            if ($status === 'verified') {
                $order->update_meta_data('_maskara_verification', 'confirmed');
            } elseif ($status === 'cancelled') {
                $order->update_meta_data('_maskara_verification', 'cancelled');
            }
        }

        if (isset($body['callAttempts'])) {
            $order->update_meta_data('_maskara_call_count', absint($body['callAttempts']));
        }

        $courier = (string) ($body['courierStatus'] ?? $body['courierStage'] ?? '');
        if ($courier !== '') {
            $order->update_meta_data('_maskara_courier_status', sanitize_key($courier));
        }
    }

    public function admin_styles() {
        $screen = function_exists('get_current_screen') ? get_current_screen() : null;
        if (!$screen || strpos($screen->id, 'wc-orders') === false && $screen->id !== 'edit-shop_order') {
            return;
        }
        echo '<style>
            .msk-badge{display:inline-block;padding:2px 8px;border-radius:999px;font-size:11px;font-weight:600;line-height:1.6;white-space:nowrap}
            .msk-muted{color:#64748b;background:#f1f5f9}
            .msk-pending{color:#92400e;background:#fef3c7}
            .msk-calling{color:#1d4ed8;background:#dbeafe}
            .msk-verified{color:#166534;background:#dcfce7}
            .msk-cancelled{color:#991b1b;background:#fee2e2}
            .msk-failed{color:#9f1239;background:#ffe4e6}
            .msk-courier-processing{color:#4338ca;background:#e0e7ff}
            .msk-courier-transit{color:#0e7490;background:#cffafe}
            .msk-courier-delivered{color:#15803d;background:#bbf7d0}
            .msk-courier-return{color:#c2410c;background:#ffedd5}
            .msk-calls{font-weight:600;color:#0f172a}
            .msk-calls .msk-muted{font-weight:400;color:#94a3b8}
        </style>';
    }
}
