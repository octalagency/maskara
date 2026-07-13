<?php
if (!defined('ABSPATH')) {
    exit;
}

/**
 * Self-hosted updates — Plugins page shows "Update now".
 */
class Maskara_Updater {

    const SLUG = 'maskara-woocommerce';
    const UPDATE_URL = 'https://app.maskara.bd/downloads/maskara-woocommerce-update.json';

    public function __construct() {
        add_filter('pre_set_site_transient_update_plugins', array($this, 'check_update'));
        add_filter('plugins_api', array($this, 'plugins_api'), 20, 3);
        add_action('admin_init', array($this, 'force_check_maybe'));
        add_filter('plugin_row_meta', array($this, 'row_meta'), 10, 2);
    }

    public function row_meta($links, $file) {
        if ($file !== plugin_basename(MASKARA_PLUGIN_FILE)) {
            return $links;
        }
        $url = wp_nonce_url(admin_url('plugins.php?maskara_check_update=1'), 'maskara_check_update');
        $links[] = '<a href="' . esc_url($url) . '">Check for updates</a>';
        return $links;
    }

    public function force_check_maybe() {
        if (!current_user_can('update_plugins')) {
            return;
        }
        if (isset($_GET['maskara_check_update']) && check_admin_referer('maskara_check_update')) {
            delete_site_transient('update_plugins');
            delete_transient('maskara_update_info');
            wp_update_plugins();
            wp_safe_redirect(admin_url('plugins.php?maskara_update_checked=1'));
            exit;
        }
    }

    private function remote_info() {
        $cached = get_transient('maskara_update_info');
        if (is_array($cached)) {
            return $cached;
        }

        $res = wp_remote_get(self::UPDATE_URL . '?t=' . time(), array(
            'timeout'   => 15,
            'sslverify' => apply_filters('maskara_sslverify', true),
            'headers'   => array('Cache-Control' => 'no-cache'),
        ));
        if (is_wp_error($res)) {
            return null;
        }
        $code = wp_remote_retrieve_response_code($res);
        $body = json_decode(wp_remote_retrieve_body($res), true);
        if ($code < 200 || $code >= 300 || !is_array($body) || empty($body['version'])) {
            return null;
        }

        set_transient('maskara_update_info', $body, HOUR_IN_SECONDS);
        return $body;
    }

    public function check_update($transient) {
        if (empty($transient) || !is_object($transient)) {
            return $transient;
        }
        if (!isset($transient->response)) {
            $transient->response = array();
        }

        $info = $this->remote_info();
        if (!$info) {
            return $transient;
        }

        $plugin_file = plugin_basename(MASKARA_PLUGIN_FILE);
        $current     = defined('MASKARA_VERSION') ? MASKARA_VERSION : '0';

        if (version_compare((string) $info['version'], (string) $current, '>')) {
            $transient->response[$plugin_file] = (object) array(
                'slug'         => self::SLUG,
                'plugin'       => $plugin_file,
                'new_version'  => $info['version'],
                'url'          => $info['homepage'] ?? 'https://maskara.bd',
                'package'      => $info['download_url'] ?? 'https://app.maskara.bd/downloads/maskara-woocommerce.zip',
                'icons'        => array(),
                'banners'      => array(),
                'tested'       => $info['tested'] ?? '',
                'requires'     => $info['requires'] ?? '5.8',
                'requires_php' => $info['requires_php'] ?? '7.4',
            );
        }

        return $transient;
    }

    public function plugins_api($result, $action, $args) {
        if ($action !== 'plugin_information' || empty($args->slug) || $args->slug !== self::SLUG) {
            return $result;
        }

        $info = $this->remote_info();
        if (!$info) {
            return $result;
        }

        return (object) array(
            'name'          => $info['name'] ?? 'Maskara Order Verification',
            'slug'          => self::SLUG,
            'version'       => $info['version'],
            'author'        => '<a href="https://maskara.bd">Maskara</a>',
            'homepage'      => $info['homepage'] ?? 'https://maskara.bd',
            'requires'      => $info['requires'] ?? '5.8',
            'tested'        => $info['tested'] ?? '',
            'requires_php'  => $info['requires_php'] ?? '7.4',
            'download_link' => $info['download_url'] ?? 'https://app.maskara.bd/downloads/maskara-woocommerce.zip',
            'sections'      => array(
                'description' => $info['description'] ?? 'AI voice order verification + Pathao auto deploy.',
                'changelog'   => $info['changelog'] ?? '',
            ),
        );
    }
}
