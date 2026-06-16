<?php
/**
 * Plugin Name: Maskara Order Verification
 * Plugin URI: https://maskara.bd
 * Description: Connect WooCommerce to Maskara — automatic Bangla AI voice call verification for COD orders.
 * Version: 1.0.1
 * Author: Maskara
 * Author URI: https://maskara.bd
 * Text Domain: maskara-woocommerce
 * Requires at least: 5.8
 * Requires PHP: 7.4
 * WC requires at least: 5.0
 * WC tested up to: 9.0
 */

if (!defined('ABSPATH')) {
    exit;
}

define('MASKARA_VERSION', '1.0.1');

/** Dev tunnels (ngrok/cloudflare) — SSL verify off */
add_filter('maskara_sslverify', function ($verify) {
    $url = get_option('maskara_api_url', '');
    if (strpos($url, 'trycloudflare.com') !== false
        || strpos($url, 'ngrok') !== false
        || strpos($url, 'loca.lt') !== false) {
        return false;
    }
    return $verify;
});
define('MASKARA_PLUGIN_FILE', __FILE__);
define('MASKARA_PLUGIN_DIR', plugin_dir_path(__FILE__));

require_once MASKARA_PLUGIN_DIR . 'includes/class-maskara-api.php';
require_once MASKARA_PLUGIN_DIR . 'includes/class-maskara-settings.php';
require_once MASKARA_PLUGIN_DIR . 'includes/class-maskara-order-sync.php';

/**
 * Check WooCommerce is active
 */
function maskara_wc_missing_notice() {
    echo '<div class="error"><p><strong>Maskara Order Verification</strong> requires WooCommerce to be installed and active.</p></div>';
}

function maskara_init() {
    if (!class_exists('WooCommerce')) {
        add_action('admin_notices', 'maskara_wc_missing_notice');
        return;
    }

    new Maskara_Settings();
    new Maskara_Order_Sync();
}
add_action('plugins_loaded', 'maskara_init');

/**
 * Default options on activation
 */
function maskara_activate() {
    add_option('maskara_api_url', 'http://localhost:4000');
    add_option('maskara_api_key', '');
    add_option('maskara_cod_only', 'yes');
    add_option('maskara_connected', 'no');
}
register_activation_hook(__FILE__, 'maskara_activate');
