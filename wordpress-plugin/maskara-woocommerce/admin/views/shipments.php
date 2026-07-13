<?php
defined('ABSPATH') || exit;

$default_from = gmdate('Y-m-d', strtotime('-30 days'));
$default_to   = gmdate('Y-m-d');
?>
<div class="wrap msk-wrap" id="msk-shipments-page">
	<header class="msk-header">
		<div class="msk-header-inner">
			<p class="msk-eyebrow">Shipments</p>
			<h1 class="msk-title">Pathao Shipments</h1>
			<p class="msk-subtitle">Orders confirmed via Maskara call and dispatched to Pathao.</p>
		</div>
		<div class="msk-header-actions">
			<button type="button" class="msk-btn msk-btn--ghost" id="msk-sync-now">
				<span class="dashicons dashicons-update"></span> Sync now
			</button>
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
				<option value="">All statuses</option>
				<option value="processing">Processing</option>
				<option value="in_transit">In Transit</option>
				<option value="delivered">Delivered</option>
				<option value="returned">Returned</option>
				<option value="paid_return">Paid Return</option>
				<option value="cancelled">Cancelled</option>
			</select>
		</div>
		<div class="msk-field">
			<label class="msk-label">Search</label>
			<input class="msk-input" type="search" name="search" placeholder="Order / consignment / phone">
		</div>
		<div class="msk-field msk-field--actions">
			<button type="button" class="msk-btn msk-btn--primary" id="msk-apply-filters">Apply</button>
		</div>
	</form>

	<section class="msk-card">
		<div class="msk-table-wrap">
			<table class="msk-table" id="msk-shipments-table">
				<thead>
					<tr>
						<th>Order</th>
						<th>Consignment</th>
						<th>Customer</th>
						<th>Phone</th>
						<th>Status</th>
						<th>COD</th>
						<th>Dispatched</th>
						<th></th>
					</tr>
				</thead>
				<tbody>
					<tr><td colspan="8" class="msk-empty">Loading…</td></tr>
				</tbody>
			</table>
		</div>
		<div class="msk-pager" id="msk-pager"></div>
	</section>
</div>
