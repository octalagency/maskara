<?php
if (!defined('ABSPATH')) {
    exit;
}

/**
 * Shipment storage + dashboard analytics (Pathao statuses after Maskara confirm).
 */
class Maskara_Shipments {

    const STATUS_PENDING     = 'pending';
    const STATUS_PROCESSING  = 'processing';
    const STATUS_IN_TRANSIT  = 'in_transit';
    const STATUS_DELIVERED   = 'delivered';
    const STATUS_RETURNED    = 'returned';
    const STATUS_PAID_RETURN = 'paid_return';
    const STATUS_CANCELLED   = 'cancelled';
    const STATUS_HOLD        = 'hold';

    /** @var string */
    private $table;

    public function __construct() {
        global $wpdb;
        $this->table = $wpdb->prefix . 'maskara_shipments';
    }

    public static function table_name() {
        global $wpdb;
        return $wpdb->prefix . 'maskara_shipments';
    }

    public static function create_table() {
        global $wpdb;
        require_once ABSPATH . 'wp-admin/includes/upgrade.php';

        $table   = self::table_name();
        $charset = $wpdb->get_charset_collate();

        $sql = "CREATE TABLE {$table} (
			id BIGINT(20) UNSIGNED NOT NULL AUTO_INCREMENT,
			order_id BIGINT(20) UNSIGNED NOT NULL,
			courier_slug VARCHAR(50) NOT NULL DEFAULT 'pathao',
			consignment_id VARCHAR(100) DEFAULT NULL,
			tracking_code VARCHAR(100) DEFAULT NULL,
			status VARCHAR(50) NOT NULL DEFAULT 'pending',
			status_normalized VARCHAR(50) NOT NULL DEFAULT 'pending',
			recipient_name VARCHAR(150) DEFAULT NULL,
			recipient_phone VARCHAR(30) DEFAULT NULL,
			recipient_address TEXT DEFAULT NULL,
			recipient_city VARCHAR(100) DEFAULT NULL,
			cod_amount DECIMAL(12,2) NOT NULL DEFAULT 0.00,
			collected_amount DECIMAL(12,2) NOT NULL DEFAULT 0.00,
			delivery_charge DECIMAL(12,2) NOT NULL DEFAULT 0.00,
			return_charge DECIMAL(12,2) NOT NULL DEFAULT 0.00,
			is_paid_return TINYINT(1) NOT NULL DEFAULT 0,
			raw_response LONGTEXT DEFAULT NULL,
			dispatched_at DATETIME DEFAULT NULL,
			delivered_at DATETIME DEFAULT NULL,
			returned_at DATETIME DEFAULT NULL,
			last_synced_at DATETIME DEFAULT NULL,
			created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
			updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
			PRIMARY KEY  (id),
			UNIQUE KEY uniq_courier_consignment (courier_slug, consignment_id),
			KEY idx_order_id (order_id),
			KEY idx_status (status_normalized),
			KEY idx_dispatched_at (dispatched_at)
		) {$charset};";

        dbDelta($sql);
        update_option('maskara_db_version', '1.3.0');
        self::backfill_from_order_meta();
    }

    /**
     * Import existing Pathao consignments already stored on WC orders.
     */
    public static function backfill_from_order_meta() {
        if (get_option('maskara_shipments_backfilled') === 'yes' || !function_exists('wc_get_orders')) {
            return;
        }

        $orders = wc_get_orders(array(
            'limit'      => 500,
            'meta_key'   => '_maskara_pathao_consignment',
            'meta_compare' => 'EXISTS',
            'return'     => 'objects',
        ));

        $repo = new self();
        foreach ($orders as $order) {
            $consignment = (string) $order->get_meta('_maskara_pathao_consignment');
            if ($consignment === '' || $repo->get_by_consignment($consignment)) {
                continue;
            }
            $status = (string) $order->get_meta('_maskara_pathao_status');
            if ($status === '') {
                $status = 'processing';
            }
            $repo->record_dispatch($order, array(
                'consignment_id' => $consignment,
                'order_status'   => $status,
                'delivery_fee'   => 0,
                'raw'            => array('backfill' => true),
            ));
        }

        update_option('maskara_shipments_backfilled', 'yes');
    }

    public static function normalize_pathao_status($raw) {
        $raw = strtolower(trim((string) $raw));
        // Pathao UI / API variants: "Pickup Cancel", "pickup-cancelled", "Pickup_Cancel"
        $raw = str_replace(array('-', ' '), '_', $raw);
        $raw = preg_replace('/_+/', '_', $raw);

        $normalized = array(
            self::STATUS_PENDING,
            self::STATUS_PROCESSING,
            self::STATUS_IN_TRANSIT,
            self::STATUS_DELIVERED,
            self::STATUS_RETURNED,
            self::STATUS_PAID_RETURN,
            self::STATUS_CANCELLED,
            self::STATUS_HOLD,
        );
        if (in_array($raw, $normalized, true)) {
            return $raw;
        }

        // Any cancel-like Pathao status (Pickup Cancel is the common merchant-panel label)
        if (
            strpos($raw, 'cancel') !== false
            || strpos($raw, 'canceled') !== false
        ) {
            return self::STATUS_CANCELLED;
        }

        $map = array(
            'pickup_requested'          => self::STATUS_PROCESSING,
            'assigned_for_pickup'       => self::STATUS_PROCESSING,
            'accepted'                  => self::STATUS_PROCESSING,
            'pending'                   => self::STATUS_PENDING,
            'picked'                    => self::STATUS_IN_TRANSIT,
            'pickup_failed'             => self::STATUS_HOLD,
            'at_the_sorting_hub'        => self::STATUS_IN_TRANSIT,
            'in_transit'                => self::STATUS_IN_TRANSIT,
            'received_at_last_mile_hub' => self::STATUS_IN_TRANSIT,
            'assigned_for_delivery'     => self::STATUS_IN_TRANSIT,
            'delivered'                 => self::STATUS_DELIVERED,
            'partial_delivery'          => self::STATUS_DELIVERED,
            'partial_delivered'         => self::STATUS_DELIVERED,
            'returned'                  => self::STATUS_RETURNED,
            'return_requested'          => self::STATUS_RETURNED,
            'paid_return'               => self::STATUS_PAID_RETURN,
            'exchanged'                 => self::STATUS_DELIVERED,
            'on_hold'                   => self::STATUS_HOLD,
            'hold'                      => self::STATUS_HOLD,
            'delivery_failed'           => self::STATUS_HOLD,
        );
        return $map[$raw] ?? self::STATUS_PROCESSING;
    }

    /**
     * Record a new Pathao dispatch (or return existing row).
     *
     * @param WC_Order $order
     * @param array    $pathao_data Raw Pathao create response / fields.
     * @return int Shipment ID.
     */
    public function record_dispatch(WC_Order $order, array $pathao_data = array()) {
        global $wpdb;

        $consignment = (string) ($pathao_data['consignment_id'] ?? '');
        if ($consignment === '') {
            return 0;
        }

        $existing = $this->get_by_consignment($consignment);
        if ($existing) {
            return (int) $existing->id;
        }

        $raw_status = $pathao_data['order_status'] ?? 'pickup_requested';
        $normalized = self::normalize_pathao_status($raw_status);

        $wpdb->insert(
            $this->table,
            array(
                'order_id'          => $order->get_id(),
                'courier_slug'      => 'pathao',
                'consignment_id'    => $consignment,
                'tracking_code'     => $consignment,
                'status'            => $raw_status,
                'status_normalized' => $normalized,
                'recipient_name'    => $order->get_formatted_billing_full_name(),
                'recipient_phone'   => $order->get_billing_phone(),
                'recipient_address' => $order->get_billing_address_1(),
                'recipient_city'    => $order->get_billing_city(),
                'cod_amount'        => (float) $order->get_total(),
                'delivery_charge'   => (float) ($pathao_data['delivery_fee'] ?? 0),
                'raw_response'      => wp_json_encode($pathao_data['raw'] ?? $pathao_data),
                'dispatched_at'     => current_time('mysql'),
            )
        );

        $id = (int) $wpdb->insert_id;
        if ($id) {
            $order->update_meta_data('_maskara_pathao_status', $normalized);
            $order->update_meta_data('_maskara_shipment_id', $id);
            $order->save();
        }
        return $id;
    }

    public function get($id) {
        global $wpdb;
        return $wpdb->get_row($wpdb->prepare("SELECT * FROM {$this->table} WHERE id = %d", $id));
    }

    public function get_by_consignment($consignment_id) {
        global $wpdb;
        return $wpdb->get_row($wpdb->prepare(
            "SELECT * FROM {$this->table} WHERE consignment_id = %s LIMIT 1",
            $consignment_id
        ));
    }

    public function get_by_order($order_id) {
        global $wpdb;
        return $wpdb->get_row($wpdb->prepare(
            "SELECT * FROM {$this->table} WHERE order_id = %d ORDER BY id DESC LIMIT 1",
            $order_id
        ));
    }

    public function update($shipment_id, array $data) {
        global $wpdb;
        $existing = $this->get($shipment_id);
        if (!$existing) {
            return false;
        }

        if (isset($data['status_normalized'])) {
            if ($data['status_normalized'] === self::STATUS_DELIVERED && empty($existing->delivered_at)) {
                $data['delivered_at'] = current_time('mysql');
            }
            if (in_array($data['status_normalized'], array(self::STATUS_RETURNED, self::STATUS_PAID_RETURN), true) && empty($existing->returned_at)) {
                $data['returned_at'] = current_time('mysql');
            }
        }

        $data['last_synced_at'] = current_time('mysql');
        $wpdb->update($this->table, $data, array('id' => $shipment_id));

        $order = wc_get_order((int) $existing->order_id);
        if ($order && isset($data['status_normalized'])) {
            $order->update_meta_data('_maskara_pathao_status', $data['status_normalized']);
            $order->update_meta_data('_maskara_courier_status', $data['status_normalized']);
            $order->save();
        }

        return true;
    }

    /**
     * Active (non-terminal) shipments for cron sync.
     *
     * @return object[]
     */
    public function get_active($limit = 100) {
        global $wpdb;
        $limit = max(1, (int) $limit);
        return $wpdb->get_results(
            "SELECT * FROM {$this->table}
			 WHERE status_normalized NOT IN ('delivered','returned','paid_return','cancelled')
			   AND consignment_id IS NOT NULL AND consignment_id != ''
			 ORDER BY last_synced_at ASC, id ASC
			 LIMIT {$limit}"
        ) ?: array();
    }

    public function get_summary(array $filters = array()) {
        global $wpdb;
        list($where, $params) = $this->build_where($filters);

        $sql = "SELECT
			COUNT(*) AS total_orders,
			SUM(status_normalized = 'delivered') AS delivered,
			SUM(status_normalized IN ('returned','paid_return')) AS returned,
			SUM(status_normalized = 'paid_return') AS paid_returns,
			SUM(status_normalized IN ('processing','pending')) AS processing,
			SUM(status_normalized = 'in_transit') AS in_transit,
			COALESCE(SUM(collected_amount), 0) AS total_collected,
			COALESCE(SUM(CASE WHEN status_normalized = 'delivered' THEN cod_amount ELSE 0 END), 0) AS total_cod,
			COALESCE(SUM(delivery_charge), 0) AS delivery_charges,
			COALESCE(SUM(return_charge), 0) AS return_charges
			FROM {$this->table}
			{$where}";

        $row = $params
            ? $wpdb->get_row($wpdb->prepare($sql, $params))
            : $wpdb->get_row($sql);

        $total     = (int) ($row->total_orders ?? 0);
        $delivered = (int) ($row->delivered ?? 0);

        return array(
            'total_orders'     => $total,
            'delivered'        => $delivered,
            'returned'         => (int) ($row->returned ?? 0),
            'paid_returns'     => (int) ($row->paid_returns ?? 0),
            'processing'       => (int) ($row->processing ?? 0),
            'in_transit'       => (int) ($row->in_transit ?? 0),
            'pending_delivery' => (int) ($row->in_transit ?? 0),
            'total_collected'  => (float) ($row->total_collected ?? 0),
            'total_cod'        => (float) ($row->total_cod ?? 0),
            'delivery_charges' => (float) ($row->delivery_charges ?? 0),
            'return_charges'   => (float) ($row->return_charges ?? 0),
            'success_rate'     => $total > 0 ? round(($delivered / $total) * 100, 1) : 0,
        );
    }

    public function get_daily_series(array $filters = array()) {
        global $wpdb;
        list($where, $params) = $this->build_where($filters);

        $sql = "SELECT
			DATE(dispatched_at) AS day,
			COUNT(*) AS dispatched,
			SUM(status_normalized = 'delivered') AS delivered,
			SUM(status_normalized IN ('returned','paid_return')) AS returned
			FROM {$this->table}
			{$where}
			GROUP BY DATE(dispatched_at)
			ORDER BY day ASC";

        $rows = $params
            ? $wpdb->get_results($wpdb->prepare($sql, $params))
            : $wpdb->get_results($sql);

        return $rows ?: array();
    }

    public function get_courier_performance(array $filters = array()) {
        global $wpdb;
        list($where, $params) = $this->build_where($filters);

        $sql = "SELECT
			courier_slug,
			COUNT(*) AS total,
			SUM(status_normalized = 'delivered') AS delivered,
			SUM(status_normalized IN ('returned','paid_return')) AS returned,
			SUM(status_normalized = 'in_transit') AS in_transit,
			ROUND(SUM(status_normalized = 'delivered') / COUNT(*) * 100, 2) AS success_rate,
			COALESCE(SUM(collected_amount), 0) AS collected,
			COALESCE(SUM(delivery_charge), 0) AS delivery_charges
			FROM {$this->table}
			{$where}
			GROUP BY courier_slug
			ORDER BY total DESC";

        $rows = $params
            ? $wpdb->get_results($wpdb->prepare($sql, $params))
            : $wpdb->get_results($sql);

        return $rows ?: array();
    }

    public function get_shipments(array $filters = array(), $page = 1, $per_page = 20) {
        global $wpdb;
        list($where, $params) = $this->build_where($filters);

        $page     = max(1, (int) $page);
        $per_page = max(1, (int) $per_page);
        $offset   = ($page - 1) * $per_page;

        $total_sql = "SELECT COUNT(*) FROM {$this->table} {$where}";
        $total     = $params
            ? (int) $wpdb->get_var($wpdb->prepare($total_sql, $params))
            : (int) $wpdb->get_var($total_sql);

        $rows_sql = "SELECT * FROM {$this->table} {$where} ORDER BY id DESC LIMIT %d OFFSET %d";
        $rows     = $wpdb->get_results($wpdb->prepare($rows_sql, array_merge($params, array($per_page, $offset))));

        return array(
            'rows'  => $rows ?: array(),
            'total' => $total,
            'pages' => (int) ceil($total / max(1, $per_page)),
        );
    }

    private function build_where(array $filters) {
        $clauses = array();
        $params  = array();

        if (!empty($filters['date_from'])) {
            $clauses[] = 'DATE(dispatched_at) >= %s';
            $params[]  = $filters['date_from'];
        }
        if (!empty($filters['date_to'])) {
            $clauses[] = 'DATE(dispatched_at) <= %s';
            $params[]  = $filters['date_to'];
        }
        if (!empty($filters['courier'])) {
            $clauses[] = 'courier_slug = %s';
            $params[]  = $filters['courier'];
        }
        if (!empty($filters['status'])) {
            $clauses[] = 'status_normalized = %s';
            $params[]  = $filters['status'];
        }
        if (!empty($filters['search'])) {
            $clauses[] = '(consignment_id LIKE %s OR tracking_code LIKE %s OR recipient_name LIKE %s OR recipient_phone LIKE %s OR CAST(order_id AS CHAR) LIKE %s)';
            $like      = '%' . $GLOBALS['wpdb']->esc_like($filters['search']) . '%';
            array_push($params, $like, $like, $like, $like, $like);
        }

        $where = $clauses ? 'WHERE ' . implode(' AND ', $clauses) : '';
        return array($where, $params);
    }
}
