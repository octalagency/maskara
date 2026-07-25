<?php
if (!defined('ABSPATH')) { exit; }

class Maskara_Callback {
    public function __construct() {
        add_action('rest_api_init', array($this, 'register_routes'));
    }

    public function register_routes() {
        register_rest_route('maskara/v1', '/verification-result', array(
            'methods' => 'POST',
            'callback' => array($this, 'handle_result'),
            'permission_callback' => array($this, 'authorize'),
        ));
    }

    public function authorize($request) {
        $secret = (string) get_option('maskara_webhook_secret', '');
        $api_key = (string) get_option('maskara_api_key', '');
        $header_secret = (string) $request->get_header('x-webhook-secret');
        $header_key = (string) $request->get_header('x-api-key');
        $header_sig = (string) $request->get_header('x-maskara-signature');

        if ($secret && $header_secret && hash_equals($secret, $header_secret)) return true;
        if ($api_key && $header_key && hash_equals($api_key, $header_key)) return true;
        if ($secret && $header_sig) {
            $expected = hash_hmac('sha256', $request->get_body(), $secret);
            if (hash_equals($expected, $header_sig)) return true;
        }
        // Allow empty secret only if API key matches (legacy)
        return new WP_Error('maskara_forbidden', 'Unauthorized', array('status' => 401));
    }

    public function handle_result($request) {
        $body = $request->get_json_params();
        if (!is_array($body)) {
            return new WP_Error('maskara_bad_request', 'Invalid JSON', array('status' => 400));
        }

        $outcome = strtoupper((string) ($body['outcome'] ?? ''));
        $status  = strtoupper((string) ($body['status'] ?? ($body['verifyStatus'] ?? '')));
        $external_id = $body['externalId'] ?? ($body['wooOrderId'] ?? null);
        $order_number = isset($body['orderNumber']) ? ltrim((string) $body['orderNumber'], '#') : '';

        $order = null;
        if ($external_id) {
            $order = wc_get_order(absint($external_id));
        }
        if (!$order && $order_number !== '') {
            $order = wc_get_order(absint($order_number));
        }
        if (!$order) {
            return new WP_Error('maskara_not_found', 'Order not found', array('status' => 404));
        }

        if (class_exists('Maskara_Order_Columns')) {
            Maskara_Order_Columns::apply_payload($order, $body);
        }

        if (isset($body['callAttempts'])) {
            $order->update_meta_data('_maskara_call_count', absint($body['callAttempts']));
        }

        $confirmed = in_array($outcome, array('CONFIRMED', 'VERIFIED'), true)
            || in_array($status, array('VERIFIED', 'CONFIRMED'), true);
        // Only customer DTMF 2 (outcome=CANCELLED) may cancel the Woo order.
        // Do NOT cancel on NO_RESPONSE / FAILED / pending retries — that was auto-cancelling
        // after the first missed call.
        $cancelled = in_array($outcome, array('CANCELLED'), true);
        $reopen = in_array($outcome, array('REOPEN', 'RESTORE', 'REOPEN_PROCESSING'), true)
            || (!empty($body['reopen']) && filter_var($body['reopen'], FILTER_VALIDATE_BOOLEAN));
        $calling   = in_array($status, array('CALLING'), true)
            || in_array(strtolower((string) ($body['verifyStatus'] ?? '')), array('calling', 'pending'), true);
        $missed = in_array($outcome, array('NO_RESPONSE', 'FAILED', 'RETRY_SCHEDULED', 'CALL_ATTEMPT_FAILED', 'STAFF_CALL_ELIGIBLE'), true)
            || in_array($status, array('FAILED', 'NO_ANSWER', 'NO ANSWER', 'PENDING'), true);

        if ($reopen && !$confirmed && !$cancelled) {
            $order->update_meta_data('_maskara_verify_status', 'pending');
            $order->update_meta_data('_maskara_verification', 'pending');
            $order->delete_meta_data('_maskara_courier_block_reason');
            if ($order->get_status() !== 'processing') {
                $order->update_status('processing', 'Maskara: restored to Processing after false auto-cancel.');
            } else {
                $order->add_order_note('Maskara: order already Processing — reopen acknowledged.');
                $order->save();
            }
            return array(
                'ok' => true,
                'orderId' => $order->get_id(),
                'status' => 'processing',
                'verifyStatus' => 'pending',
                'reopened' => true,
            );
        }

        if ($calling && !$confirmed && !$cancelled) {
            $order->update_meta_data('_maskara_verify_status', 'calling');
            $order->add_order_note(sprintf(
                'Maskara: verification call in progress / retry scheduled (attempt %d).',
                absint($body['callAttempts'] ?? $order->get_meta('_maskara_call_count'))
            ));
            $order->save();
            return array('ok' => true, 'orderId' => $order->get_id(), 'verifyStatus' => 'calling');
        }

        if ($confirmed) {
            return $this->handle_confirmed($order, $body);
        }

        if ($cancelled) {
            $reason = 'Maskara: customer cancelled via AI voice call (pressed 2).';
            $new_status = apply_filters('maskara_cancelled_order_status', 'cancelled', $order, $body);
            $order->update_meta_data('_maskara_verify_status', 'cancelled');
            $order->update_meta_data('_maskara_verification', 'cancelled');
            $order->update_status($new_status, $reason);
            $order->save();
            return array(
                'ok' => true,
                'orderId' => $order->get_id(),
                'status' => $new_status,
                'verifyStatus' => 'cancelled',
            );
        }

        if ($missed) {
            $attempts = absint($body['callAttempts'] ?? $order->get_meta('_maskara_call_count'));
            $max = absint($body['maxCallAttempts'] ?? 0);
            $order->update_meta_data('_maskara_verify_status', 'no_answer');
            $order->add_order_note(sprintf(
                'Maskara: call not answered (attempt %d%s). WooCommerce status left unchanged — retry/staff may continue.',
                $attempts,
                $max > 0 ? " of {$max}" : ''
            ));
            $order->save();
            return array(
                'ok' => true,
                'orderId' => $order->get_id(),
                'verifyStatus' => 'no_answer',
                'cancelled' => false,
            );
        }

        $order->add_order_note('Maskara update: outcome=' . $outcome . ' status=' . $status);
        $order->save();
        return array('ok' => true, 'orderId' => $order->get_id(), 'ignored' => true);
    }

    private function handle_confirmed(WC_Order $order, array $body) {
        $order->update_meta_data('_maskara_verify_status', 'verified');
        $order->update_meta_data('_maskara_verification', 'confirmed');
        if (isset($body['callAttempts'])) {
            $order->update_meta_data('_maskara_call_count', absint($body['callAttempts']));
        }

        // Keep editable status while deploying, then move to Completed
        if (!in_array($order->get_status(), array('processing', 'completed'), true)) {
            $order->update_status('processing', 'Maskara: customer confirmed — deploying courier…');
        } else {
            $order->add_order_note('Maskara: customer confirmed via AI voice call.');
            $order->save();
        }

        $pathao = null;
        $consignment = '';
        $courier_blocked = false;
        if (class_exists('Maskara_Pathao') && Maskara_Pathao::is_enabled()) {
            $pathao = Maskara_Pathao::deploy_verified_order($order, 'confirm');
            if (is_wp_error($pathao)) {
                $err_code = $pathao->get_error_code();
                $msg = $pathao->get_error_message();
                if ($err_code === 'maskara_bad_address') {
                    $courier_blocked = true;
                    // Meta already set inside create_order_from_wc
                    return array(
                        'ok' => true,
                        'orderId' => $order->get_id(),
                        'status' => $order->get_status(),
                        'verifyStatus' => 'verified',
                        'courierBlocked' => true,
                        'courierReason' => $msg,
                        'pathao' => array('error' => $msg),
                        'consignment' => '',
                    );
                }
                $order->add_order_note('Pathao auto-deploy failed: ' . $msg);
                $order->update_meta_data('_maskara_courier_status', 'failed');
                $order->update_meta_data('_maskara_courier_block_reason', $msg);
                $order->save();
            } else {
                if (is_array($pathao)) {
                    $consignment = (string) (
                        $pathao['consignment']
                        ?? ($pathao['data']['consignment_id'] ?? ($pathao['consignment_id'] ?? ''))
                    );
                }
                if ($consignment === '') {
                    $consignment = Maskara_Pathao::clean_consignment_id(
                        $order->get_meta('_maskara_pathao_consignment')
                    );
                }
            }
        } else {
            $order->update_meta_data('_maskara_courier_status', 'processing');
            $order->add_order_note('Maskara: Pathao not enabled — enable in Maskara → Settings for auto-deploy.');
            $new_status = apply_filters('maskara_confirmed_order_status', 'completed', $order, $body);
            if ($order->get_status() !== $new_status) {
                $order->update_status($new_status, 'Maskara: verified — order marked Completed.');
            } else {
                $order->save();
            }
            return array(
                'ok' => true,
                'orderId' => $order->get_id(),
                'status' => $order->get_status(),
                'verifyStatus' => 'verified',
                'pathao' => null,
                'consignment' => '',
            );
        }

        if ($courier_blocked) {
            $order->save();
            return array(
                'ok' => true,
                'orderId' => $order->get_id(),
                'verifyStatus' => 'verified',
                'courierBlocked' => true,
            );
        }

        // deploy_verified_order already marks Completed on success
        return array(
            'ok' => true,
            'orderId' => $order->get_id(),
            'status' => $order->get_status(),
            'verifyStatus' => 'verified',
            'pathao' => is_wp_error($pathao) ? array('error' => $pathao->get_error_message()) : $pathao,
            'consignment' => $consignment,
        );
    }
}
