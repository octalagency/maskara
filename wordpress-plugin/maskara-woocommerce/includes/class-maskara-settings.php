<?php
if (!defined('ABSPATH')) {
    exit;
}

class Maskara_Settings {
    public function __construct() {
        add_action('admin_menu', array($this, 'add_menu'));
        add_action('admin_init', array($this, 'register_settings'));
        add_action('admin_post_maskara_test_connection', array($this, 'handle_test'));
        add_action('admin_post_maskara_connect', array($this, 'handle_connect'));
    }

    public function add_menu() {
        add_submenu_page(
            'woocommerce',
            'Maskara Verification',
            'Maskara',
            'manage_woocommerce',
            'maskara-settings',
            array($this, 'render_page')
        );
    }

    public function register_settings() {
        register_setting('maskara_settings', 'maskara_api_url', array(
            'type'              => 'string',
            'sanitize_callback' => 'esc_url_raw',
            'default'           => 'http://localhost:4000',
        ));
        register_setting('maskara_settings', 'maskara_api_key', array(
            'type'              => 'string',
            'sanitize_callback' => 'sanitize_text_field',
        ));
        register_setting('maskara_settings', 'maskara_webhook_secret', array(
            'type'              => 'string',
            'sanitize_callback' => 'sanitize_text_field',
        ));
        register_setting('maskara_settings', 'maskara_cod_only', array(
            'type'              => 'string',
            'sanitize_callback' => 'sanitize_text_field',
            'default'           => 'yes',
        ));
    }

    public function handle_test() {
        if (!current_user_can('manage_woocommerce')) {
            wp_die('Unauthorized');
        }
        check_admin_referer('maskara_test');

        $api = new Maskara_API();
        $result = $api->parse_response($api->ping());

        if (is_wp_error($result)) {
            wp_redirect(add_query_arg(array(
                'page'    => 'maskara-settings',
                'maskara' => 'test_failed',
                'msg'     => rawurlencode($result->get_error_message()),
            ), admin_url('admin.php')));
            exit;
        }

        wp_redirect(add_query_arg(array(
            'page'    => 'maskara-settings',
            'maskara' => 'test_ok',
        ), admin_url('admin.php')));
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
            wp_redirect(add_query_arg(array(
                'page'    => 'maskara-settings',
                'maskara' => 'connect_failed',
                'msg'     => rawurlencode($ping->get_error_message()),
            ), admin_url('admin.php')));
            exit;
        }

        $result = $api->parse_response($api->connect());
        if (is_wp_error($result)) {
            wp_redirect(add_query_arg(array(
                'page'    => 'maskara-settings',
                'maskara' => 'connect_failed',
                'msg'     => rawurlencode($result->get_error_message()),
            ), admin_url('admin.php')));
            exit;
        }

        update_option('maskara_connected', 'yes');
        update_option('maskara_connected_at', current_time('mysql'));

        wp_redirect(add_query_arg(array(
            'page'    => 'maskara-settings',
            'maskara' => 'connected',
        ), admin_url('admin.php')));
        exit;
    }

    public function render_page() {
        $api_url    = get_option('maskara_api_url', 'http://localhost:4000');
        $api_key    = get_option('maskara_api_key', '');
        $webhook_secret = get_option('maskara_webhook_secret', '');
        $cod_only   = get_option('maskara_cod_only', 'yes');
        $connected  = get_option('maskara_connected', 'no') === 'yes';
        $notice     = isset($_GET['maskara']) ? sanitize_text_field($_GET['maskara']) : '';
        $msg        = isset($_GET['msg']) ? sanitize_text_field(wp_unslash($_GET['msg'])) : '';
        $site_host  = wp_parse_url(home_url(), PHP_URL_HOST);
        $api_host   = wp_parse_url($api_url, PHP_URL_HOST);
        $local_hosts = array('localhost', '127.0.0.1');
        $remote_site = !in_array($site_host, $local_hosts, true);
        $local_api   = in_array($api_host, $local_hosts, true);
        ?>
        <div class="wrap">
            <h1>Maskara Order Verification</h1>
            <p>Connect your WooCommerce store to Maskara for automatic Bangla AI voice COD verification.</p>

            <?php if ($remote_site && $local_api) : ?>
                <div class="notice notice-warning">
                    <p><strong>⚠ API URL সমস্যা:</strong> আপনার WordPress online server-এ চলছে (<code><?php echo esc_html($site_host); ?></code>)।
                    এখানে <code>localhost:4000</code> কাজ করবে না — এটি server-এর নিজের PC, আপনার Maskara API নয়।</p>
                    <p>সমাধান: public API URL ব্যবহার করুন (যেমন <code>https://api.maskara.bd</code>) অথবা Mac-এ <code>ngrok http 4000</code> চালিয়ে সেই HTTPS URL দিন।</p>
                </div>
            <?php endif; ?>

            <?php if ($notice === 'connected') : ?>
                <div class="notice notice-success"><p>✓ Connected to Maskara successfully!</p></div>
            <?php elseif ($notice === 'test_ok') : ?>
                <div class="notice notice-success"><p>✓ API connection test passed.</p></div>
            <?php elseif (in_array($notice, array('test_failed', 'connect_failed'), true)) : ?>
                <div class="notice notice-error"><p>✗ <?php echo esc_html($msg ?: 'Connection failed'); ?></p></div>
            <?php endif; ?>

            <?php if ($connected) : ?>
                <div class="notice notice-info"><p><strong>Status:</strong> Connected to Maskara</p></div>
            <?php endif; ?>

            <form method="post" action="options.php">
                <?php settings_fields('maskara_settings'); ?>
                <table class="form-table">
                    <tr>
                        <th><label for="maskara_api_url">Maskara API URL</label></th>
                        <td>
                            <input type="url" id="maskara_api_url" name="maskara_api_url" value="<?php echo esc_attr($api_url); ?>" class="regular-text" required />
                            <p class="description">
                                Online WordPress → <code>https://api.maskara.bd</code> বা ngrok URL<br>
                                Local WordPress (একই PC) → <code>http://localhost:4000</code>
                            </p>
                        </td>
                    </tr>
                    <tr>
                        <th><label for="maskara_api_key">API Key</label></th>
                        <td>
                            <input type="password" id="maskara_api_key" name="maskara_api_key" value="<?php echo esc_attr($api_key); ?>" class="regular-text" required />
                            <p class="description">Get from Maskara Dashboard → API Keys</p>
                        </td>
                    </tr>
                    <tr>
                        <th><label for="maskara_webhook_secret">Webhook Secret</label></th>
                        <td>
                            <input type="password" id="maskara_webhook_secret" name="maskara_webhook_secret" value="<?php echo esc_attr($webhook_secret); ?>" class="regular-text" />
                            <p class="description">Maskara server-এর <code>WOOCOMMERCE_WEBHOOK_SECRET</code> — production-এ required</p>
                        </td>
                    </tr>
                    <tr>
                        <th>COD Orders Only</th>
                        <td>
                            <label>
                                <input type="checkbox" name="maskara_cod_only" value="yes" <?php checked($cod_only, 'yes'); ?> />
                                Only verify Cash on Delivery (COD) orders
                            </label>
                        </td>
                    </tr>
                </table>
                <?php submit_button('Save Settings'); ?>
            </form>

            <hr />
            <h2>Setup Guide (filobeauty.xyz)</h2>
            <ol style="max-width:700px;line-height:1.8">
                <li>Mac-এ <code>FILOBEAUTY-CONNECT.command</code> চালান</li>
                <li>Terminal-এ <code>https://....trycloudflare.com</code> URL copy করুন</li>
                <li>উপরে <strong>Maskara API URL</strong> হিসেবে paste করুন</li>
                <li><strong>API Key:</strong> <code>mk_demo_woocommerce_key_change_me</code></li>
                <li><strong>Save Settings</strong> → <strong>Test Connection</strong> → <strong>Connect</strong></li>
            </ol>
            <p><strong>⚠</strong> <code>localhost</code> বা <code>abc123.ngrok</code> example URL ব্যবহার করবেন না।</p>

            <hr />
            <h2>Connection</h2>
            <p>
                <form method="post" action="<?php echo esc_url(admin_url('admin-post.php')); ?>" style="display:inline;">
                    <?php wp_nonce_field('maskara_test'); ?>
                    <input type="hidden" name="action" value="maskara_test_connection" />
                    <?php submit_button('Test Connection', 'secondary', 'submit', false); ?>
                </form>
                <form method="post" action="<?php echo esc_url(admin_url('admin-post.php')); ?>" style="display:inline;margin-left:8px;">
                    <?php wp_nonce_field('maskara_connect'); ?>
                    <input type="hidden" name="action" value="maskara_connect" />
                    <?php submit_button('Connect to Maskara', 'primary', 'submit', false); ?>
                </form>
            </p>
        </div>
        <?php
    }
}
