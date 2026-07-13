<?php
if (!defined('ABSPATH')) {
    exit;
}

class Maskara_Settings {
    public function __construct() {
        add_action('admin_init', array($this, 'register_settings'));
        add_action('admin_post_maskara_test_connection', array($this, 'handle_test'));
        add_action('admin_post_maskara_connect', array($this, 'handle_connect'));
        add_action('admin_notices', array($this, 'admin_notices'));
    }

    public function register_settings() {
        $fields = array(
            'maskara_api_url' => 'esc_url_raw',
            'maskara_api_key' => 'sanitize_text_field',
            'maskara_webhook_secret' => 'sanitize_text_field',
            'maskara_cod_only' => 'sanitize_text_field',
            'maskara_pathao_enabled' => 'sanitize_text_field',
            'maskara_pathao_client_id' => 'sanitize_text_field',
            'maskara_pathao_client_secret' => 'sanitize_text_field',
            'maskara_pathao_username' => 'sanitize_text_field',
            'maskara_pathao_password' => 'sanitize_text_field',
            'maskara_pathao_store_id' => 'sanitize_text_field',
            'maskara_pathao_base_url' => 'esc_url_raw',
        );
        foreach ($fields as $key => $cb) {
            register_setting('maskara_settings', $key, array('sanitize_callback' => $cb));
        }
    }

    public function admin_notices() {
        if (!isset($_GET['page']) || $_GET['page'] !== 'maskara-settings') {
            return;
        }
        if (empty($_GET['maskara'])) {
            return;
        }
        $map = array(
            'test_ok' => array('updated', 'Maskara API connection OK.'),
            'test_failed' => array('error', 'Test failed: ' . (isset($_GET['msg']) ? rawurldecode(wp_unslash($_GET['msg'])) : '')),
            'connect_ok' => array('updated', 'Connected to Maskara. Orders will sync automatically.'),
            'connect_failed' => array('error', 'Connect failed: ' . (isset($_GET['msg']) ? rawurldecode(wp_unslash($_GET['msg'])) : '')),
        );
        $k = sanitize_text_field(wp_unslash($_GET['maskara']));
        if (!isset($map[$k])) {
            return;
        }
        list($cls, $msg) = $map[$k];
        echo '<div class="' . esc_attr($cls) . '"><p>' . esc_html($msg) . '</p></div>';
    }

    public function handle_test() {
        if (!current_user_can('manage_woocommerce')) {
            wp_die('Unauthorized');
        }
        check_admin_referer('maskara_test');
        $api = new Maskara_API();
        $result = $api->parse_response($api->ping());
        if (is_wp_error($result)) {
            wp_redirect(add_query_arg(array('page' => 'maskara-settings', 'maskara' => 'test_failed', 'msg' => rawurlencode($result->get_error_message())), admin_url('admin.php')));
            exit;
        }
        wp_redirect(add_query_arg(array('page' => 'maskara-settings', 'maskara' => 'test_ok'), admin_url('admin.php')));
        exit;
    }

    public function handle_connect() {
        if (!current_user_can('manage_woocommerce')) {
            wp_die('Unauthorized');
        }
        check_admin_referer('maskara_connect');
        $api = new Maskara_API();
        $ping = $api->parse_response($api->ping());
        if (is_wp_error($ping)) {
            wp_redirect(add_query_arg(array('page' => 'maskara-settings', 'maskara' => 'connect_failed', 'msg' => rawurlencode($ping->get_error_message())), admin_url('admin.php')));
            exit;
        }
        $result = $api->parse_response($api->connect());
        if (is_wp_error($result)) {
            wp_redirect(add_query_arg(array('page' => 'maskara-settings', 'maskara' => 'connect_failed', 'msg' => rawurlencode($result->get_error_message())), admin_url('admin.php')));
            exit;
        }
        update_option('maskara_connected', 'yes');
        update_option('maskara_connected_at', current_time('mysql'));
        if (is_array($result) && !empty($result['webhookSecret'])) {
            update_option('maskara_webhook_secret', sanitize_text_field($result['webhookSecret']));
        }
        wp_redirect(add_query_arg(array('page' => 'maskara-settings', 'maskara' => 'connect_ok'), admin_url('admin.php')));
        exit;
    }

    /** Used as submenu callback from Maskara_Admin. */
    public static function render_page_static() {
        self::render_settings_page();
    }

    public function render_page() {
        self::render_settings_page();
    }

    public static function render_settings_page() {
        if (!current_user_can('manage_woocommerce')) {
            return;
        }
        $api_url = get_option('maskara_api_url', 'https://api.maskara.bd');
        $api_key = get_option('maskara_api_key', '');
        $webhook_secret = get_option('maskara_webhook_secret', '');
        $cod_only = get_option('maskara_cod_only', 'no');
        $connected = get_option('maskara_connected', 'no') === 'yes';
        $pathao_on = get_option('maskara_pathao_enabled', 'no') === 'yes';
        ?>
        <div class="wrap maskara-wrap">
            <h1>Maskara Settings <span style="font-size:14px;font-weight:600;color:#2271b1;background:#f0f6fc;padding:4px 10px;border-radius:4px;vertical-align:middle;">v<?php echo esc_html(MASKARA_VERSION); ?></span></h1>
            <p>Order → Maskara AI call → Confirm হলে Completed + Pathao dispatch → Dashboard-এ delivery / in-transit / return / success rate.</p>
            <?php if (version_compare(MASKARA_VERSION, '1.5.0', '<')) : ?>
                <div class="notice notice-error"><p><strong>পুরনো plugin!</strong> v1.5.0+ install করুন — Plugins → Maskara Deactivate → Delete → নতুন zip upload।</p></div>
            <?php endif; ?>

            <?php if ($connected) : ?>
                <div class="notice notice-success"><p><strong>Connected</strong> to Maskara API.</p></div>
            <?php else : ?>
                <div class="notice notice-warning"><p>এখনো Connect করা হয়নি। নিচে Save করে Connect চাপুন।</p></div>
            <?php endif; ?>

            <form method="post" action="options.php">
                <?php settings_fields('maskara_settings'); ?>
                <h2>1) Maskara API</h2>
                <table class="form-table">
                    <tr>
                        <th>API URL</th>
                        <td><input type="url" name="maskara_api_url" value="<?php echo esc_attr($api_url); ?>" class="regular-text" />
                        <p class="description">Production: <code>https://api.maskara.bd</code></p></td>
                    </tr>
                    <tr>
                        <th>API Key</th>
                        <td><input type="password" name="maskara_api_key" value="<?php echo esc_attr($api_key); ?>" class="regular-text" autocomplete="off" />
                        <p class="description">Maskara Dashboard → API Keys</p></td>
                    </tr>
                    <tr>
                        <th>Webhook Secret</th>
                        <td><input type="password" name="maskara_webhook_secret" value="<?php echo esc_attr($webhook_secret); ?>" class="regular-text" autocomplete="off" /></td>
                    </tr>
                    <tr>
                        <th>COD Only</th>
                        <td><label><input type="checkbox" name="maskara_cod_only" value="yes" <?php checked($cod_only, 'yes'); ?> /> Only COD orders</label></td>
                    </tr>
                </table>

                <h2>2) Pathao Courier</h2>
                <p>Maskara call confirm হলে automatically Pathao-তে order submit হবে। Status hourly sync হবে Dashboard-এ।</p>
                <table class="form-table">
                    <tr>
                        <th>Enable Pathao</th>
                        <td><label><input type="checkbox" name="maskara_pathao_enabled" value="yes" <?php checked($pathao_on, true); ?> /> Auto submit on Maskara confirm</label></td>
                    </tr>
                    <tr>
                        <th>API Base URL</th>
                        <td><input type="url" name="maskara_pathao_base_url" value="<?php echo esc_attr(get_option('maskara_pathao_base_url', 'https://api-hermes.pathao.com')); ?>" class="regular-text" /></td>
                    </tr>
                    <tr>
                        <th>Client ID</th>
                        <td><input type="text" name="maskara_pathao_client_id" value="<?php echo esc_attr(get_option('maskara_pathao_client_id', '')); ?>" class="regular-text" /></td>
                    </tr>
                    <tr>
                        <th>Client Secret</th>
                        <td><input type="password" name="maskara_pathao_client_secret" value="<?php echo esc_attr(get_option('maskara_pathao_client_secret', '')); ?>" class="regular-text" autocomplete="off" /></td>
                    </tr>
                    <tr>
                        <th>Merchant Email</th>
                        <td><input type="text" name="maskara_pathao_username" value="<?php echo esc_attr(get_option('maskara_pathao_username', '')); ?>" class="regular-text" /></td>
                    </tr>
                    <tr>
                        <th>Merchant Password</th>
                        <td><input type="password" name="maskara_pathao_password" value="<?php echo esc_attr(get_option('maskara_pathao_password', '')); ?>" class="regular-text" autocomplete="off" /></td>
                    </tr>
                    <tr>
                        <th>Store ID</th>
                        <td><input type="text" name="maskara_pathao_store_id" value="<?php echo esc_attr(get_option('maskara_pathao_store_id', '')); ?>" class="regular-text" /></td>
                    </tr>
                </table>
                <?php submit_button('Save Settings'); ?>
            </form>

            <hr />
            <h2>3) Connect / Test</h2>
            <form method="post" action="<?php echo esc_url(admin_url('admin-post.php')); ?>" style="display:inline-block;margin-right:8px;">
                <?php wp_nonce_field('maskara_test'); ?>
                <input type="hidden" name="action" value="maskara_test_connection" />
                <?php submit_button('Test Connection', 'secondary', 'submit', false); ?>
            </form>
            <form method="post" action="<?php echo esc_url(admin_url('admin-post.php')); ?>" style="display:inline-block;">
                <?php wp_nonce_field('maskara_connect'); ?>
                <input type="hidden" name="action" value="maskara_connect" />
                <?php submit_button('Connect to Maskara', 'primary', 'submit', false); ?>
            </form>
        </div>
        <?php
    }
}
