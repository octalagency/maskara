<?php
if (!defined('ABSPATH')) {
    exit;
}

class Maskara_API {
    private $api_url;
    private $api_key;

    public function __construct() {
        $this->api_url = rtrim(get_option('maskara_api_url', 'https://api.maskara.bd'), '/');
        $this->api_key = get_option('maskara_api_key', '');
    }

    public function is_configured() {
        return !empty($this->api_url) && !empty($this->api_key);
    }

    private function request($method, $path, $body = null) {
        $url = $this->api_url . $path;
        $bodyJson = $body !== null ? wp_json_encode($body) : null;
        $headers = array(
            'Content-Type' => 'application/json',
            'X-API-Key'    => $this->api_key,
            'Accept'       => 'application/json',
            'User-Agent'   => 'Maskara-WooCommerce/' . MASKARA_VERSION,
        );

        $webhook_secret = get_option('maskara_webhook_secret', '');
        if ($webhook_secret) {
            $headers['X-Webhook-Secret'] = $webhook_secret;
            if ($bodyJson) {
                $headers['X-Maskara-Signature'] = hash_hmac('sha256', $bodyJson, $webhook_secret);
            }
        }

        $args = array(
            'method'    => $method,
            'timeout'   => 45,
            'sslverify' => apply_filters('maskara_sslverify', true),
            'headers'   => $headers,
        );

        if ($bodyJson !== null) {
            $args['body'] = $bodyJson;
        }

        $response = wp_remote_request($url, $args);

        if (is_wp_error($response)) {
            return new WP_Error(
                'maskara_connection_error',
                $response->get_error_message() . ' (URL: ' . $url . ')'
            );
        }

        return $response;
    }

    public function ping() {
        return $this->request('GET', '/integrations/woocommerce/ping');
    }

    public function connect() {
        $body = array(
            'storeUrl'      => home_url(),
            'storeName'     => get_bloginfo('name'),
            'wcVersion'     => defined('WC_VERSION') ? WC_VERSION : '',
            'pluginVersion' => MASKARA_VERSION,
        );
        return $this->request('POST', '/integrations/woocommerce/connect', $body);
    }

    public function send_order($order) {
        if (!$order instanceof WC_Order) {
            return new WP_Error('invalid_order', 'Invalid order');
        }
        return $this->request('POST', '/webhooks/woocommerce', $this->order_to_payload($order));
    }

    /**
     * Push current Woo status to Maskara (cancel/refund/fail or metadata sync).
     * Backend detects existing order + cancelled statuses and marks CANCELLED.
     */
    public function sync_order_status($order) {
        if (!$order instanceof WC_Order) {
            return new WP_Error('invalid_order', 'Invalid order');
        }
        return $this->request('POST', '/webhooks/woocommerce', $this->order_to_payload($order));
    }

    public function order_to_payload($order) {
        $billing  = $order->get_address('billing');
        $shipping = $order->get_address('shipping');
        $items    = array();
        foreach ($order->get_items() as $item) {
            $items[] = array(
                'name'     => $item->get_name(),
                'quantity' => $item->get_quantity(),
                'total'    => $item->get_total(),
            );
        }
        return array(
            'id'                   => $order->get_id(),
            'number'               => $order->get_order_number(),
            'status'               => $order->get_status(),
            'currency'             => $order->get_currency(),
            'total'                => $order->get_total(),
            'payment_method'       => $order->get_payment_method(),
            'payment_method_title' => $order->get_payment_method_title(),
            'billing'              => array(
                'first_name' => $billing['first_name'] ?? '',
                'last_name'  => $billing['last_name'] ?? '',
                'phone'      => $billing['phone'] ?? '',
                'email'      => $billing['email'] ?? '',
            ),
            'shipping'             => $shipping,
            'line_items'           => $items,
        );
    }

    public function parse_response($response) {
        if (is_wp_error($response)) {
            return $response;
        }
        $code = wp_remote_retrieve_response_code($response);
        $body = json_decode(wp_remote_retrieve_body($response), true);
        if ($code >= 200 && $code < 300) {
            return $body;
        }
        $message = isset($body['message']) ? (is_array($body['message']) ? wp_json_encode($body['message']) : $body['message']) : ('HTTP ' . $code);
        return new WP_Error('maskara_api_error', $message, array('status' => $code));
    }
}
