<?php
/**
 * Plugin Name: Maskara Order Verification
 * Plugin URI: https://maskara.bd
 * Description: WooCommerce COD order verification via Maskara AI voice. Confirm sets Completed + Pathao deploy; miss/cancel sets Cancelled.
 * Version: 1.5.4
 * Author: Maskara
 * Author URI: https://maskara.bd
 * Text Domain: maskara-woocommerce
 * Requires at least: 5.8
 * Requires PHP: 7.4
 * WC requires at least: 5.0
 * WC tested up to: 10.0
 * Update URI: https://app.maskara.bd/downloads/maskara-woocommerce-update.json
 */

if (!defined('ABSPATH')) {
    exit;
}

define('MASKARA_VERSION', '1.5.4');
define('MASKARA_PLUGIN_FILE', __FILE__);
define('MASKARA_PLUGIN_DIR', plugin_dir_path(__FILE__));

add_filter('maskara_sslverify', function ($verify) {
    $url = get_option('maskara_api_url', '');
    if (strpos($url, 'trycloudflare.com') !== false
        || strpos($url, 'ngrok') !== false
        || strpos($url, 'loca.lt') !== false) {
        return false;
    }
    return $verify;
});

require_once MASKARA_PLUGIN_DIR . 'includes/class-maskara-api.php';
require_once MASKARA_PLUGIN_DIR . 'includes/class-maskara-settings.php';
require_once MASKARA_PLUGIN_DIR . 'includes/class-maskara-order-sync.php';
require_once MASKARA_PLUGIN_DIR . 'includes/class-maskara-callback.php';
require_once MASKARA_PLUGIN_DIR . 'includes/class-maskara-pathao.php';
require_once MASKARA_PLUGIN_DIR . 'includes/class-maskara-shipments.php';
require_once MASKARA_PLUGIN_DIR . 'includes/class-maskara-sync.php';
require_once MASKARA_PLUGIN_DIR . 'includes/class-maskara-admin.php';
require_once MASKARA_PLUGIN_DIR . 'includes/class-maskara-order-columns.php';
require_once MASKARA_PLUGIN_DIR . 'includes/class-maskara-updater.php';

function maskara_wc_missing_notice() {
    echo '<div class="error"><p><strong>Maskara</strong> requires WooCommerce active.</p></div>';
}

function maskara_init() {
    if (!class_exists('WooCommerce')) {
        add_action('admin_notices', 'maskara_wc_missing_notice');
        return;
    }
    new Maskara_Settings();
    new Maskara_Order_Sync();
    new Maskara_Callback();
    new Maskara_Pathao();
    new Maskara_Sync();
    new Maskara_Updater();
    if (is_admin()) {
        new Maskara_Admin();
        new Maskara_Order_Columns();
    }

    if (get_option('maskara_db_version') !== '1.5.4') {
        Maskara_Shipments::create_table();
        Maskara_Sync::schedule();
        update_option('maskara_db_version', '1.5.4');
    }
}
add_action('plugins_loaded', 'maskara_init', 20);

function maskara_activate() {
    add_option('maskara_api_url', 'https://api.maskara.bd');
    add_option('maskara_api_key', '');
    add_option('maskara_webhook_secret', '');
    add_option('maskara_cod_only', 'no');
    add_option('maskara_connected', 'no');
    add_option('maskara_pathao_enabled', 'no');
    add_option('maskara_pathao_client_id', '');
    add_option('maskara_pathao_client_secret', '');
    add_option('maskara_pathao_username', '');
    add_option('maskara_pathao_password', '');
    add_option('maskara_pathao_store_id', '');
    add_option('maskara_pathao_base_url', 'https://api-hermes.pathao.com');
    add_option('maskara_max_daily_calls', 9);

    require_once MASKARA_PLUGIN_DIR . 'includes/class-maskara-shipments.php';
    require_once MASKARA_PLUGIN_DIR . 'includes/class-maskara-sync.php';
    Maskara_Shipments::create_table();
    Maskara_Sync::schedule();
}
register_activation_hook(__FILE__, 'maskara_activate');

function maskara_deactivate() {
    require_once MASKARA_PLUGIN_DIR . 'includes/class-maskara-sync.php';
    Maskara_Sync::unschedule();
}
register_deactivation_hook(__FILE__, 'maskara_deactivate');
