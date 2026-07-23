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
			<p class="msk-subtitle">Call confirm → Pathao deploy → live delivery, collected COD &amp; delivery charges.</p>
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
			array('key' => 'total_orders', 'label' => 'Total Sent', 'icon' => 'dashicons-migrate', 'tone' => 'indigo'),
			array('key' => 'delivered', 'label' => 'Delivered', 'icon' => 'dashicons-yes-alt', 'tone' => 'emerald'),
			array('key' => 'in_transit', 'label' => 'In Transit', 'icon' => 'dashicons-location', 'tone' => 'sky'),
			array('key' => 'returned', 'label' => 'Returned', 'icon' => 'dashicons-undo', 'tone' => 'rose'),
			array('key' => 'success_rate', 'label' => 'Success Rate', 'icon' => 'dashicons-chart-line', 'tone' => 'teal', 'percent' => true),
			array('key' => 'processing', 'label' => 'Processing', 'icon' => 'dashicons-clock', 'tone' => 'amber'),
			array('key' => 'total_collected', 'label' => 'Collected Amount', 'icon' => 'dashicons-money-alt', 'tone' => 'emerald', 'money' => true, 'hint' => 'Delivered COD'),
			array('key' => 'delivery_charges', 'label' => 'Delivery Charges', 'icon' => 'dashicons-cart', 'tone' => 'violet', 'money' => true, 'hint' => 'Courier fees'),
		);
		foreach ($kpis as $kpi) :
			?>
			<article class="msk-kpi msk-kpi--<?php echo esc_attr($kpi['tone']); ?><?php echo empty($kpi['money']) ? '' : ' msk-kpi--money'; ?>"
					 data-kpi="<?php echo esc_attr($kpi['key']); ?>"
					 data-money="<?php echo empty($kpi['money']) ? '0' : '1'; ?>"
					 data-percent="<?php echo empty($kpi['percent']) ? '0' : '1'; ?>">
				<div class="msk-kpi__top">
					<span class="msk-kpi__icon-wrap" aria-hidden="true">
						<span class="dashicons <?php echo esc_attr($kpi['icon']); ?>"></span>
					</span>
					<div class="msk-kpi__meta">
						<span class="msk-kpi__label"><?php echo esc_html($kpi['label']); ?></span>
						<?php if (!empty($kpi['hint'])) : ?>
							<span class="msk-kpi__hint"><?php echo esc_html($kpi['hint']); ?></span>
						<?php endif; ?>
					</div>
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
						<th class="msk-num">Collected Amount</th>
						<th class="msk-num">Delivery Charges</th>
					</tr>
				</thead>
				<tbody>
					<tr><td colspan="8" class="msk-empty">Loading…</td></tr>
				</tbody>
			</table>
		</div>
	</section>
</div>
