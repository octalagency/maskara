<?php
defined('ABSPATH') || exit;

$default_from = gmdate('Y-m-d', strtotime('-30 days'));
$default_to   = gmdate('Y-m-d');

$status_choices = array(
    ''            => 'All statuses',
    'pending'     => 'Pending',
    'processing'  => 'Processing',
    'in_transit'  => 'In Transit',
    'delivered'   => 'Delivered',
    'returned'    => 'Returned',
    'paid_return' => 'Paid Return',
    'hold'        => 'On Hold',
    'cancelled'   => 'Cancelled',
);
?>
<div class="wrap msk-wrap" id="msk-dashboard">

	<header class="msk-header">
		<div class="msk-header-inner">
			<p class="msk-eyebrow">Analytics</p>
			<h1 class="msk-title">Maskara Courier Dashboard</h1>
			<p class="msk-subtitle">Call confirm → Pathao deploy → live delivery, in-transit, return &amp; success rate.</p>
		</div>
		<div class="msk-header-actions">
			<button type="button" class="msk-btn msk-btn--ghost" id="msk-sync-now">
				<span class="dashicons dashicons-update"></span> Sync now
			</button>
			<a class="msk-btn msk-btn--primary" href="<?php echo esc_url(admin_url('admin.php?page=maskara-settings')); ?>">
				<span class="dashicons dashicons-admin-generic"></span> Settings
			</a>
		</div>
	</header>

	<form class="msk-filters" id="msk-filters" onsubmit="return false;">
		<div class="msk-field">
			<label class="msk-label">From</label>
			<input class="msk-input" type="date" name="date_from" value="<?php echo esc_attr($default_from); ?>">
		</div>
		<div class="msk-field">
			<label class="msk-label">To</label>
			<input class="msk-input" type="date" name="date_to" value="<?php echo esc_attr($default_to); ?>">
		</div>
		<div class="msk-field">
			<label class="msk-label">Status</label>
			<select class="msk-input" name="status">
				<?php foreach ($status_choices as $val => $label) : ?>
					<option value="<?php echo esc_attr($val); ?>"><?php echo esc_html($label); ?></option>
				<?php endforeach; ?>
			</select>
		</div>
		<div class="msk-field msk-field--actions">
			<button type="button" class="msk-btn msk-btn--primary" id="msk-apply-filters">Apply filters</button>
		</div>
	</form>

	<section class="msk-kpi-grid" id="msk-kpi-grid">
		<?php
		$kpis = array(
			array('key' => 'total_orders', 'label' => 'Total Sent', 'icon' => '📦', 'tone' => 'indigo'),
			array('key' => 'delivered', 'label' => 'Delivered', 'icon' => '✅', 'tone' => 'emerald'),
			array('key' => 'in_transit', 'label' => 'In Transit', 'icon' => '🚚', 'tone' => 'sky'),
			array('key' => 'returned', 'label' => 'Returned', 'icon' => '↩️', 'tone' => 'rose'),
			array('key' => 'success_rate', 'label' => 'Success Rate', 'icon' => '📈', 'tone' => 'teal', 'percent' => true),
			array('key' => 'processing', 'label' => 'Processing', 'icon' => '⏳', 'tone' => 'amber'),
			array('key' => 'total_collected', 'label' => 'Collected', 'icon' => '💰', 'tone' => 'emerald', 'money' => true),
			array('key' => 'delivery_charges', 'label' => 'Delivery Charges', 'icon' => '🛒', 'tone' => 'violet', 'money' => true),
		);
		foreach ($kpis as $kpi) :
			?>
			<article class="msk-kpi msk-kpi--<?php echo esc_attr($kpi['tone']); ?>"
					 data-kpi="<?php echo esc_attr($kpi['key']); ?>"
					 data-money="<?php echo empty($kpi['money']) ? '0' : '1'; ?>"
					 data-percent="<?php echo empty($kpi['percent']) ? '0' : '1'; ?>">
				<div class="msk-kpi__label">
					<span class="msk-kpi__icon"><?php echo esc_html($kpi['icon']); ?></span>
					<?php echo esc_html($kpi['label']); ?>
				</div>
				<div class="msk-kpi__value">—</div>
			</article>
		<?php endforeach; ?>
	</section>

	<section class="msk-charts">
		<article class="msk-card">
			<header class="msk-card__header">
				<h2 class="msk-card__title">Daily activity</h2>
				<span class="msk-card__meta">Dispatched · Delivered · Returned</span>
			</header>
			<div class="msk-chart-wrap"><canvas id="msk-chart-daily"></canvas></div>
		</article>
		<article class="msk-card">
			<header class="msk-card__header">
				<h2 class="msk-card__title">Delivery breakdown</h2>
			</header>
			<div class="msk-chart-wrap"><canvas id="msk-chart-donut"></canvas></div>
		</article>
	</section>

	<section class="msk-card">
		<header class="msk-card__header">
			<h2 class="msk-card__title">Courier performance</h2>
			<span class="msk-card__meta">Success rate = Delivered ÷ Total</span>
		</header>
		<div class="msk-table-wrap">
			<table class="msk-table msk-table--perf" id="msk-courier-table">
				<thead>
					<tr>
						<th class="msk-col-name">Courier</th>
						<th class="msk-num">Total</th>
						<th class="msk-num">Delivered</th>
						<th class="msk-num">In Transit</th>
						<th class="msk-num">Returned</th>
						<th class="msk-num">Success rate</th>
						<th class="msk-num">Collected</th>
					</tr>
				</thead>
				<tbody>
					<tr><td colspan="7" class="msk-empty">Loading…</td></tr>
				</tbody>
			</table>
		</div>
	</section>
</div>
