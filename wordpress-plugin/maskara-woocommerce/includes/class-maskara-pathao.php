<?php
if (!defined('ABSPATH')) {
    exit;
}

class Maskara_Pathao {
    public function __construct() {
        // hooked from callback on confirm
    }

    public static function is_enabled() {
        return get_option('maskara_pathao_enabled', 'no') === 'yes'
            && get_option('maskara_pathao_client_id')
            && get_option('maskara_pathao_store_id');
    }

    /**
     * Validate Bangladesh delivery address before Pathao deploy.
     * Returns cleaned address string or WP_Error with Bangla reason.
     *
     * @param WC_Order $order
     * @return string|WP_Error
     */
    public static function validate_delivery_address(WC_Order $order) {
        $line1 = trim((string) $order->get_billing_address_1());
        $line2 = trim((string) $order->get_billing_address_2());
        $city  = trim((string) $order->get_billing_city());
        $state = trim((string) $order->get_billing_state());
        $name  = trim((string) $order->get_formatted_billing_full_name());
        $phone = preg_replace('/\D+/', '', (string) $order->get_billing_phone());

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

        $phone = preg_replace('/\D+/', '', $order->get_billing_phone());
        if (strlen($phone) === 13 && strpos($phone, '880') === 0) {
            $phone = '0' . substr($phone, 3);
        }

        $payload = array(
            'store_id' => intval(get_option('maskara_pathao_store_id')),
            'merchant_order_id' => (string) $order->get_id(),
            'recipient_name' => trim($order->get_formatted_billing_full_name()) ?: 'Customer',
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

        $data = $body['data'] ?? array();
        // Prefer slug when present (e.g. pickup_cancelled); else human label (Pickup Cancel)
        $raw_status = (string) (
            $data['order_status_slug']
            ?? $data['order_status']
            ?? $data['status']
            ?? 'pending'
        );
        $normalized = Maskara_Shipments::normalize_pathao_status($raw_status);

        return array(
            'success'          => true,
            'status'           => $normalized,
            'status_raw'       => $raw_status,
            'collected_amount' => (float) ($data['collected_amount'] ?? 0),
            'delivery_charge'  => (float) ($data['delivery_fee'] ?? 0),
            'return_charge'    => (float) ($data['return_fee'] ?? 0),
            'is_paid_return'   => $normalized === Maskara_Shipments::STATUS_PAID_RETURN,
            'raw'              => $body,
        );
    }
}
