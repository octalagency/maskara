<?php
if (!defined('ABSPATH')) {
    exit;
}

/**
 * Admin dashboard, shipments list, AJAX, assets.
 */
class Maskara_Admin {

    const CAP = 'manage_woocommerce';
    const MENU = 'maskara-dashboard';

    public function __construct() {
        add_action('admin_menu', array($this, 'register_menu'), 9);
        add_action('admin_enqueue_scripts', array($this, 'enqueue_assets'));
        add_action('wp_ajax_maskara_get_summary', array($this, 'ajax_summary'));
        add_action('wp_ajax_maskara_get_shipments', array($this, 'ajax_shipments'));
        add_action('wp_ajax_maskara_sync_all', array($this, 'ajax_sync_all'));
        add_action('wp_ajax_maskara_sync_one', array($this, 'ajax_sync_one'));
    }

    public function register_menu() {
        add_menu_page(
            'Maskara',
            'Maskara',
            self::CAP,
            self::MENU,
            array($this, 'render_dashboard'),
            'dashicons-phone',
            56
        );

        add_submenu_page(self::MENU, 'Dashboard', 'Dashboard', self::CAP, self::MENU, array($this, 'render_dashboard'));
        add_submenu_page(self::MENU, 'Shipments', 'Shipments', self::CAP, 'maskara-shipments', array($this, 'render_shipments'));
        add_submenu_page(self::MENU, 'Settings', 'Settings', self::CAP, 'maskara-settings', array('Maskara_Settings', 'render_page_static'));

        // WooCommerce submenu → dashboard.
        add_submenu_page(
            'woocommerce',
            'Maskara',
            'Maskara',
            self::CAP,
            self::MENU,
            array($this, 'render_dashboard')
        );
    }

    public function enqueue_assets($hook) {
        $hook = (string) $hook;
        if (strpos($hook, 'maskara') === false) {
            return;
        }

        wp_enqueue_style(
            'maskara-dashboard',
            plugins_url('admin/css/dashboard.css', MASKARA_PLUGIN_FILE),
            array(),
            MASKARA_VERSION
        );

        wp_enqueue_script(
            'maskara-chartjs',
            'https://cdn.jsdelivr.net/npm/chart.js@4.4.1/dist/chart.umd.min.js',
            array(),
            '4.4.1',
            true
        );

        wp_enqueue_script(
            'maskara-dashboard',
            plugins_url('admin/js/dashboard.js', MASKARA_PLUGIN_FILE),
            array('jquery', 'maskara-chartjs'),
            MASKARA_VERSION,
            true
        );

        wp_localize_script('maskara-dashboard', 'MaskaraAdmin', array(
            'ajaxUrl'  => admin_url('admin-ajax.php'),
            'nonce'    => wp_create_nonce('maskara_admin'),
            'currency' => function_exists('get_woocommerce_currency_symbol') ? get_woocommerce_currency_symbol() : '৳',
            'i18n'     => array(
                'syncing'      => 'Syncing…',
                'sync_success' => 'Synced',
                'sync_failed'  => 'Sync failed',
                'loading'      => 'Loading…',
                'no_data'      => 'No data for the selected filters.',
            ),
        ));
    }

    private function verify_ajax() {
        if (!current_user_can(self::CAP)) {
            wp_send_json_error(array('message' => 'Unauthorized'), 403);
        }
        check_ajax_referer('maskara_admin', 'nonce');
    }

    private function filters_from_request() {
        return array(
            'date_from' => isset($_POST['date_from']) ? sanitize_text_field(wp_unslash($_POST['date_from'])) : '',
            'date_to'   => isset($_POST['date_to']) ? sanitize_text_field(wp_unslash($_POST['date_to'])) : '',
            'courier'   => isset($_POST['courier']) ? sanitize_text_field(wp_unslash($_POST['courier'])) : '',
            'status'    => isset($_POST['status']) ? sanitize_text_field(wp_unslash($_POST['status'])) : '',
            'search'    => isset($_POST['search']) ? sanitize_text_field(wp_unslash($_POST['search'])) : '',
        );
    }

    public function ajax_summary() {
        $this->verify_ajax();
        $filters   = $this->filters_from_request();
        $shipments = new Maskara_Shipments();
        wp_send_json_success(array(
            'summary'  => $shipments->get_summary($filters),
            'series'   => $shipments->get_daily_series($filters),
            'couriers' => $shipments->get_courier_performance($filters),
        ));
    }

    public function ajax_shipments() {
        $this->verify_ajax();
        $filters   = $this->filters_from_request();
        $page      = isset($_POST['page']) ? absint($_POST['page']) : 1;
        $shipments = new Maskara_Shipments();
        wp_send_json_success($shipments->get_shipments($filters, $page, 20));
    }

    public function ajax_sync_all() {
        $this->verify_ajax();
        $sync = new Maskara_Sync();
        wp_send_json_success($sync->sync_all(100));
    }

    public function ajax_sync_one() {
        $this->verify_ajax();
        $id   = isset($_POST['shipment_id']) ? absint($_POST['shipment_id']) : 0;
        $sync = new Maskara_Sync();
        $res  = $sync->sync_one($id);
        if (is_wp_error($res)) {
            wp_send_json_error(array('message' => $res->get_error_message()));
        }
        wp_send_json_success($res);
    }

    public function render_dashboard() {
        if (!current_user_can(self::CAP)) {
            return;
        }
        include MASKARA_PLUGIN_DIR . 'admin/views/dashboard.php';
    }

    public function render_shipments() {
        if (!current_user_can(self::CAP)) {
            return;
        }
        include MASKARA_PLUGIN_DIR . 'admin/views/shipments.php';
    }
}
