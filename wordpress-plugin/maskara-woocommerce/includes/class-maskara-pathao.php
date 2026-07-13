<?php
if (!defined('ABSPATH')) {
    exit;
}

class Maskara_Pathao {
    /** Prevent re-entrancy when order save triggers redeploy. */
    private static $redeploy_lock = false;

    public function __construct() {
        // After merchant fixes address on a verified order, auto-push to Pathao
        add_action('woocommerce_update_order', array(__CLASS__, 'maybe_redeploy_on_address_fix'), 40, 1);
        add_action('woocommerce_process_shop_order_meta', array(__CLASS__, 'maybe_redeploy_on_address_fix'), 50, 1);
        add_action('admin_post_maskara_deploy_pathao', array(__CLASS__, 'handle_manual_deploy'));
    }

    public static function is_enabled() {
        return get_option('maskara_pathao_enabled', 'no') === 'yes'
            && get_option('maskara_pathao_client_id')
            && get_option('maskara_pathao_store_id');
    }

    /**
     * Resolve delivery fields — prefer shipping when present, fall back to billing.
     * (Many COD stores leave billing city empty while shipping has Dhaka.)
     *
     * @param WC_Order $order
     * @return array{line1:string,line2:string,city:string,state:string,name:string,phone:string}
     */
    public static function delivery_fields(WC_Order $order) {
        $ship_line1 = trim((string) $order->get_shipping_address_1());
        $ship_city  = trim((string) $order->get_shipping_city());
        $use_ship   = $ship_line1 !== '' || $ship_city !== '';

        $line1 = $use_ship ? $ship_line1 : trim((string) $order->get_billing_address_1());
        $line2 = $use_ship
            ? trim((string) $order->get_shipping_address_2())
            : trim((string) $order->get_billing_address_2());
        $city = $use_ship ? $ship_city : trim((string) $order->get_billing_city());
        $state = $use_ship
            ? trim((string) $order->get_shipping_state())
            : trim((string) $order->get_billing_state());

        // Fill gaps from the other address block
        if ($line1 === '') {
            $line1 = trim((string) $order->get_billing_address_1()) ?: trim((string) $order->get_shipping_address_1());
        }
        if ($line2 === '') {
            $line2 = trim((string) $order->get_billing_address_2()) ?: trim((string) $order->get_shipping_address_2());
        }
        if ($city === '') {
            $city = trim((string) $order->get_billing_city()) ?: trim((string) $order->get_shipping_city());
        }
        if ($state === '') {
            $state = trim((string) $order->get_billing_state()) ?: trim((string) $order->get_shipping_state());
        }

        $name = trim((string) $order->get_formatted_shipping_full_name());
        if ($name === '') {
            $name = trim((string) $order->get_formatted_billing_full_name());
        }

        $phone = preg_replace('/\D+/', '', (string) $order->get_billing_phone());
        if ($phone === '' && method_exists($order, 'get_shipping_phone')) {
            $phone = preg_replace('/\D+/', '', (string) $order->get_shipping_phone());
        }

        return array(
            'line1' => $line1,
            'line2' => $line2,
            'city'  => $city,
            'state' => $state,
            'name'  => $name,
            'phone' => $phone,
        );
    }

    /**
     * Validate Bangladesh delivery address before Pathao deploy.
     * Returns cleaned address string or WP_Error with Bangla reason.
     *
     * @param WC_Order $order
     * @return string|WP_Error
     */
    public static function validate_delivery_address(WC_Order $order) {
        $f = self::delivery_fields($order);
        $line1 = $f['line1'];
        $line2 = $f['line2'];
        $city  = $f['city'];
        $state = $f['state'];
        $name  = $f['name'];
        $phone = $f['phone'];

        $address = trim(implode(', ', array_filter(array($line1, $line2, $city, $state))));

        $invalid = function ($reason) {
            return new WP_Error(
                'maskara_bad_address',
                $reason,
                array('code' => 'address_invalid')
            );
        };

        $junk = array(
            'n/a', 'na', 'nil', 'none', 'test', 'testing', 'asdf', 'xxx', 'xyz',
            'address', 'ঠিকানা', '...', '..', '.', '-', '--', '0', '00',
            'bangladesh', 'bd', 'dhaka', 'demo', 'sample', 'customer', 'user',
            'abc', 'abcd', 'qwerty', 'unknown', 'নাম', 'নাই',
        );

        $name_c = strtolower(preg_replace('/\s+/u', '', $name));
        if ($name === '' || mb_strlen($name) < 3) {
            return $invalid('ঠিকানা ঠিক না থাকার কারণে কুরিয়ারে পাঠানো যায়নি — প্রাপকের নাম নেই বা খুব ছোট।');
        }
        foreach ($junk as $j) {
            if ($name_c === $j) {
                return $invalid('ঠিকানা ঠিক না থাকার কারণে কুরিয়ারে পাঠানো যায়নি — প্রাপকের নাম সঠিক নয় (যেমন Test)।');
            }
        }

        if ($line1 === '' || mb_strlen($line1) < 12) {
            return $invalid('ঠিকানা ঠিক না থাকার কারণে কুরিয়ারে পাঠানো যায়নি — বিস্তারিত রোড/বাড়ির ঠিকানা নেই (কমপক্ষে ১২ অক্ষর)।');
        }

        // City or area/zone required — Pathao often shows Area N/A otherwise
        if ($city === '' && $state === '') {
            return $invalid('ঠিকানা ঠিক না থাকার কারণে কুরিয়ারে পাঠানো যায়নি — শহর/এলাকা (City) নেই।');
        }

        if (mb_strlen($address) < 20) {
            return $invalid('ঠিকানা ঠিক না থাকার কারণে কুরিয়ারে পাঠানো যায়নি — ঠিকানা খুব ছোট বা অসম্পূর্ণ।');
        }

        $compact = strtolower(preg_replace('/\s+/u', '', $address));
        $line1c  = strtolower(preg_replace('/\s+/u', '', $line1));
        foreach ($junk as $j) {
            if ($line1c === $j || $compact === $j) {
                return $invalid('ঠিকানা ঠিক না থাকার কারণে কুরিয়ারে পাঠানো যায়নি — ঠিকানা সঠিক নয়।');
            }
        }

        // Mostly symbols / digits without real street text
        $letters = preg_replace('/[^\p{L}\p{N}\s]/u', '', $line1);
        if (mb_strlen(trim($letters)) < 8) {
            return $invalid('ঠিকানা ঠিক না থাকার কারণে কুরিয়ারে পাঠানো যায়নি — ঠিকানায় অর্থপূর্ণ লেখা নেই।');
        }

        // Need at least 2 address parts (house/road + area) — single village name is too vague
        $parts = preg_split('/[,،\-\|\/]+/u', $line1);
        $parts = array_values(array_filter(array_map('trim', $parts ?: array()), function ($p) {
            return $p !== '' && mb_strlen($p) >= 2;
        }));
        if (count($parts) < 2 && mb_strlen($line1) < 25) {
            return $invalid('ঠিকানা ঠিক না থাকার কারণে কুরিয়ারে পাঠানো যায়নি — বাড়ি/রোড ও এলাকা আলাদা করে লিখুন।');
        }

        // Garbled: repeated chars
        if (preg_match('/(.)\1{5,}/u', $line1)) {
            return $invalid('ঠিকানা ঠিক না থাকার কারণে কুরিয়ারে পাঠানো যায়নি — ঠিকানা উল্টাপাল্টা/ভুল মনে হচ্ছে।');
        }

        // Phone: BD mobile 01XXXXXXXXX
        if (strlen($phone) === 13 && strpos($phone, '880') === 0) {
            $phone = '0' . substr($phone, 3);
        }
        if (!preg_match('/^01[3-9]\d{8}$/', $phone)) {
            return $invalid('ঠিকানা ঠিক না থাকার কারণে কুরিয়ারে পাঠানো যায়নি — মোবাইল নম্বর সঠিক নয়।');
        }

        return $address;
    }

    /**
     * True when order is verified, Pathao on, and still needs a consignment.
     */
    public static function needs_pathao_deploy(WC_Order $order) {
        if (!self::is_enabled()) {
            return false;
        }
        if (self::clean_consignment_id($order->get_meta('_maskara_pathao_consignment')) !== '') {
            return false;
        }
        $verify = strtolower((string) $order->get_meta('_maskara_verify_status'));
        if ($verify === '' && (string) $order->get_meta('_maskara_verification') === 'confirmed') {
            $verify = 'verified';
        }
        return in_array($verify, array('verified', 'confirmed'), true);
    }

    /**
     * Create Pathao consignment and mark order Completed on success.
     *
     * @param WC_Order $order
     * @param string   $source auto|manual|confirm
     * @return array|WP_Error
     */
    public static function deploy_verified_order(WC_Order $order, $source = 'auto') {
        if (!self::needs_pathao_deploy($order)) {
            $existing = self::clean_consignment_id($order->get_meta('_maskara_pathao_consignment'));
            if ($existing !== '') {
                return array('skipped' => true, 'consignment' => $existing);
            }
            return new WP_Error('maskara_not_ready', 'অর্ডার ভেরিফাইড নয় বা Pathao বন্ধ।');
        }

        $result = self::create_order_from_wc($order);
        if (is_wp_error($result)) {
            return $result;
        }

        $consignment = self::clean_consignment_id($order->get_meta('_maskara_pathao_consignment'));
        if ($consignment === '' && is_array($result)) {
            $consignment = self::clean_consignment_id(
                $result['consignment']
                ?? ($result['data']['consignment_id'] ?? ($result['consignment_id'] ?? ''))
            );
        }

        $order->delete_meta_data('_maskara_courier_block_reason');
        $order->update_meta_data('_maskara_courier_status', 'processing');
        if ($consignment !== '') {
            $order->add_order_note(sprintf(
                'Pathao %s deploy: %s',
                $source,
                $consignment
            ));
        }

        $new_status = apply_filters('maskara_confirmed_order_status', 'completed', $order, array('source' => $source));
        if ($order->get_status() !== $new_status) {
            self::$redeploy_lock = true;
            $order->update_status($new_status, 'Maskara: Pathao deploy OK — Completed.');
            self::$redeploy_lock = false;
        } else {
            self::$redeploy_lock = true;
            $order->save();
            self::$redeploy_lock = false;
        }

        return is_array($result) ? array_merge($result, array('consignment' => $consignment)) : array(
            'consignment' => $consignment,
            'raw' => $result,
        );
    }

    /**
     * When a previously blocked address is fixed, auto-deploy to Pathao.
     *
     * @param int|WC_Order $order_id
     */
    public static function maybe_redeploy_on_address_fix($order_id) {
        if (self::$redeploy_lock) {
            return;
        }
        if (defined('DOING_AUTOSAVE') && DOING_AUTOSAVE) {
            return;
        }

        $order = $order_id instanceof WC_Order ? $order_id : wc_get_order($order_id);
        if (!$order) {
            return;
        }

        if (!self::needs_pathao_deploy($order)) {
            return;
        }

        $courier = strtolower((string) $order->get_meta('_maskara_courier_status'));
        $blocked = (string) $order->get_meta('_maskara_courier_block_reason') !== '';
        // Only auto-retry when we previously blocked for address / failed deploy
        if (!in_array($courier, array('address_invalid', 'failed'), true) && !$blocked) {
            return;
        }

        $address = self::validate_delivery_address($order);
        if (is_wp_error($address)) {
            // Still bad — refresh reason only
            if ($address->get_error_message() !== (string) $order->get_meta('_maskara_courier_block_reason')) {
                self::$redeploy_lock = true;
                $order->update_meta_data('_maskara_courier_status', 'address_invalid');
                $order->update_meta_data('_maskara_courier_block_reason', $address->get_error_message());
                $order->save();
                self::$redeploy_lock = false;
            }
            return;
        }

        // Address now valid → Pathao
        self::$redeploy_lock = true;
        $deploy = self::deploy_verified_order($order, 'auto');
        self::$redeploy_lock = false;

        if (is_wp_error($deploy) && $deploy->get_error_code() === 'maskara_bad_address') {
            // create_order_from_wc already saved meta
            return;
        }
    }

    /** Manual "Pathao তে পাঠান" from orders list / order edit. */
    public static function handle_manual_deploy() {
        if (!current_user_can('manage_woocommerce')) {
            wp_die('Forbidden');
        }
        check_admin_referer('maskara_deploy_pathao');
        $order_id = isset($_GET['order_id']) ? absint($_GET['order_id']) : 0;
        $order    = $order_id ? wc_get_order($order_id) : false;
        $redirect = wp_get_referer() ?: admin_url('admin.php?page=wc-orders');

        if (!$order) {
            wp_safe_redirect(add_query_arg('maskara_sync_err', rawurlencode('Order not found'), $redirect));
            exit;
        }

        if (!self::is_enabled()) {
            wp_safe_redirect(add_query_arg('maskara_sync_err', rawurlencode('Pathao বন্ধ আছে — Maskara Settings চালু করুন।'), $redirect));
            exit;
        }

        $existing = self::clean_consignment_id($order->get_meta('_maskara_pathao_consignment'));
        if ($existing !== '') {
            wp_safe_redirect(add_query_arg(
                'maskara_sync_ok',
                rawurlencode('ইতিমধ্যে Pathao তে আছে: ' . $existing),
                $redirect
            ));
            exit;
        }

        $verify = strtolower((string) $order->get_meta('_maskara_verify_status'));
        if (!in_array($verify, array('verified', 'confirmed'), true)
            && (string) $order->get_meta('_maskara_verification') !== 'confirmed') {
            // Allow manual deploy for processing verified-looking orders; still require verify
            wp_safe_redirect(add_query_arg(
                'maskara_sync_err',
                rawurlencode('আগে AI ভেরিফাই (Verified) হতে হবে।'),
                $redirect
            ));
            exit;
        }

        // Ensure verify meta is set so needs_pathao_deploy passes
        if (!in_array($verify, array('verified', 'confirmed'), true)) {
            $order->update_meta_data('_maskara_verify_status', 'verified');
            $order->save();
        }

        $deploy = self::deploy_verified_order($order, 'manual');
        if (is_wp_error($deploy)) {
            wp_safe_redirect(add_query_arg(
                'maskara_sync_err',
                rawurlencode($deploy->get_error_message()),
                $redirect
            ));
            exit;
        }

        $consignment = self::clean_consignment_id(
            is_array($deploy) ? ($deploy['consignment'] ?? '') : ''
        );
        if ($consignment === '') {
            $consignment = self::clean_consignment_id($order->get_meta('_maskara_pathao_consignment'));
        }

        wp_safe_redirect(add_query_arg(
            'maskara_sync_ok',
            rawurlencode($consignment !== ''
                ? ('Pathao তে পাঠানো হয়েছে: ' . $consignment)
                : 'Pathao deploy সম্পন্ন'),
            $redirect
        ));
        exit;
    }

    public static function get_token() {
        $cached = get_transient('maskara_pathao_token');
        if ($cached) {
            return $cached;
        }

        $base = rtrim(get_option('maskara_pathao_base_url', 'https://api-hermes.pathao.com'), '/');
        $body = array(
            'client_id' => get_option('maskara_pathao_client_id'),
            'client_secret' => get_option('maskara_pathao_client_secret'),
            'username' => get_option('maskara_pathao_username'),
            'password' => get_option('maskara_pathao_password'),
            'grant_type' => 'password',
        );
        $res = wp_remote_post($base . '/aladdin/api/v1/issue-token', array(
            'timeout' => 45,
            'headers' => array('Content-Type' => 'application/json', 'Accept' => 'application/json'),
            'body' => wp_json_encode($body),
        ));
        if (is_wp_error($res)) {
            return $res;
        }
        $code = wp_remote_retrieve_response_code($res);
        $data = json_decode(wp_remote_retrieve_body($res), true);
        if ($code < 200 || $code >= 300 || empty($data['access_token'])) {
            return new WP_Error('pathao_token', isset($data['message']) ? $data['message'] : 'Pathao token failed HTTP ' . $code);
        }
        $ttl = !empty($data['expires_in']) ? max(60, intval($data['expires_in']) - 120) : 3000;
        set_transient('maskara_pathao_token', $data['access_token'], $ttl);
        return $data['access_token'];
    }

    public static function create_order_from_wc(WC_Order $order) {
        if (!self::is_enabled()) {
            return new WP_Error('pathao_off', 'Pathao not enabled');
        }
        if ($order->get_meta('_maskara_pathao_consignment')) {
            return array('skipped' => true, 'consignment' => $order->get_meta('_maskara_pathao_consignment'));
        }

        $token = self::get_token();
        if (is_wp_error($token)) {
            return $token;
        }

        $address = self::validate_delivery_address($order);
        if (is_wp_error($address)) {
            $order->update_meta_data('_maskara_courier_status', 'address_invalid');
            $order->update_meta_data('_maskara_courier_block_reason', $address->get_error_message());
            $order->add_order_note($address->get_error_message());
            $order->save();
            return $address;
        }

        $fields = self::delivery_fields($order);
        $phone  = $fields['phone'];
        if (strlen($phone) === 13 && strpos($phone, '880') === 0) {
            $phone = '0' . substr($phone, 3);
        }

        $payload = array(
            'store_id' => intval(get_option('maskara_pathao_store_id')),
            'merchant_order_id' => (string) $order->get_id(),
            'recipient_name' => $fields['name'] !== '' ? $fields['name'] : 'Customer',
            'recipient_phone' => $phone,
            'recipient_address' => $address,
            'delivery_type' => 48,
            'item_type' => 2,
            'item_quantity' => max(1, $order->get_item_count()),
            'item_weight' => 0.5,
            'amount_to_collect' => floatval($order->get_total()),
            'item_description' => 'Order #' . $order->get_order_number(),
            'special_instruction' => 'Maskara verified COD order',
        );

        $base = rtrim(get_option('maskara_pathao_base_url', 'https://api-hermes.pathao.com'), '/');
        $res = wp_remote_post($base . '/aladdin/api/v1/orders', array(
            'timeout' => 45,
            'headers' => array(
                'Content-Type' => 'application/json',
                'Authorization' => 'Bearer ' . $token,
                'Accept' => 'application/json',
            ),
            'body' => wp_json_encode($payload),
        ));
        if (is_wp_error($res)) {
            return $res;
        }
        $code = wp_remote_retrieve_response_code($res);
        $data = json_decode(wp_remote_retrieve_body($res), true);
        if ($code < 200 || $code >= 300) {
            $msg = isset($data['message']) ? $data['message'] : ('HTTP ' . $code);
            if (!empty($data['errors'])) {
                $msg .= ' ' . wp_json_encode($data['errors']);
            }
            return new WP_Error('pathao_order', $msg);
        }

        $payload_data = $data['data'] ?? array();
        $consignment  = $payload_data['consignment_id'] ?? ($data['consignment_id'] ?? '');
        if ($consignment) {
            $order->update_meta_data('_maskara_pathao_consignment', $consignment);
            $order->update_meta_data('_maskara_pathao_status', 'processing');
            $order->save();
            $order->add_order_note('Pathao courier created: ' . $consignment);

            if (class_exists('Maskara_Shipments')) {
                $shipments = new Maskara_Shipments();
                $shipments->record_dispatch($order, array(
                    'consignment_id' => $consignment,
                    'order_status'   => $payload_data['order_status'] ?? 'pickup_requested',
                    'delivery_fee'   => $payload_data['delivery_fee'] ?? 0,
                    'raw'            => $data,
                ));
            }
        } else {
            $order->add_order_note('Pathao response OK but no consignment id: ' . wp_json_encode($data));
        }
        return $data;
    }

    /**
     * Fetch Pathao consignment status.
     *
     * @param string $consignment_id
     * @return array|WP_Error
     */
    public static function fetch_status($consignment_id) {
        $consignment_id = self::clean_consignment_id($consignment_id);
        if ($consignment_id === '') {
            return new WP_Error('pathao_consignment', 'Empty consignment id');
        }

        $token = self::get_token();
        if (is_wp_error($token)) {
            return $token;
        }

        $base = rtrim(get_option('maskara_pathao_base_url', 'https://api-hermes.pathao.com'), '/');
        $res  = wp_remote_get($base . '/aladdin/api/v1/orders/' . rawurlencode($consignment_id) . '/info', array(
            'timeout' => 30,
            'headers' => array(
                'Authorization' => 'Bearer ' . $token,
                'Accept' => 'application/json',
            ),
        ));

        if (is_wp_error($res)) {
            return $res;
        }

        $code = wp_remote_retrieve_response_code($res);
        $body = json_decode(wp_remote_retrieve_body($res), true);
        if ($code !== 200) {
            return array(
                'success' => false,
                'error'   => isset($body['message']) ? $body['message'] : ('HTTP ' . $code),
                'raw'     => $body,
            );
        }

        $data = is_array($body['data'] ?? null) ? $body['data'] : (is_array($body) ? $body : array());

        $candidates = array(
            $data['order_status_slug'] ?? '',
            $data['order_status'] ?? '',
            $data['status'] ?? '',
            $data['delivery_status'] ?? '',
            $body['order_status_slug'] ?? '',
            $body['order_status'] ?? '',
        );
        $raw_status = '';
        foreach ($candidates as $c) {
            $c = trim((string) $c);
            if ($c !== '') {
                $raw_status = $c;
                break;
            }
        }
        if ($raw_status === '') {
            $raw_status = 'pending';
        }

        // Pathao merchant UI "Pickup Cancel" sometimes only appears in nested payload text
        $blob = strtolower(wp_json_encode($data));
        if (
            $raw_status
            && stripos($raw_status, 'cancel') === false
            && (
                strpos($blob, 'pickup cancel') !== false
                || strpos($blob, 'pickup_cancel') !== false
                || strpos($blob, 'pickup-cancelled') !== false
                || strpos($blob, '"cancelled"') !== false
            )
        ) {
            $raw_status = 'Pickup Cancel';
        }

        $normalized = Maskara_Shipments::normalize_pathao_status($raw_status);

        return array(
            'success'          => true,
            'status'           => $normalized,
            'status_raw'       => $raw_status,
            'collected_amount' => (float) ($data['collected_amount'] ?? 0),
            'delivery_charge'  => (float) ($data['delivery_fee'] ?? $data['delivery_charge'] ?? 0),
            'return_charge'    => (float) ($data['return_fee'] ?? $data['return_charge'] ?? 0),
            'is_paid_return'   => $normalized === Maskara_Shipments::STATUS_PAID_RETURN,
            'raw'              => $body,
        );
    }

    /** Normalize consignment id (strip # / spaces). */
    public static function clean_consignment_id($id) {
        $id = trim((string) $id);
        $id = ltrim($id, "# \t");
        return $id;
    }
}
