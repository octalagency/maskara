(function ($) {
	'use strict';

	const MSK = {
		charts: { daily: null, donut: null },
		page: 1,

		init() {
			if ($('#msk-dashboard').length) {
				this.bindDashboard();
				this.loadDashboard();
			}
			if ($('#msk-shipments-page').length) {
				this.bindShipments();
				this.loadShipments(1);
			}
			this.bindGlobal();
		},

		bindGlobal() {
			$(document).on('click', '#msk-sync-now', (e) => {
				e.preventDefault();
				this.syncNow(e.currentTarget);
			});
		},

		toast(msg, tone) {
			$('.msk-toast').remove();
			const $t = $('<div class="msk-toast"></div>').addClass(tone || '').text(msg);
			$('body').append($t);
			requestAnimationFrame(() => $t.addClass('visible'));
			setTimeout(() => {
				$t.removeClass('visible');
				setTimeout(() => $t.remove(), 200);
			}, 2800);
		},

		filters() {
			const $f = $('#msk-filters');
			return {
				date_from: $f.find('[name=date_from]').val() || '',
				date_to: $f.find('[name=date_to]').val() || '',
				courier: $f.find('[name=courier]').val() || '',
				status: $f.find('[name=status]').val() || '',
				search: $f.find('[name=search]').val() || '',
			};
		},

		syncNow(btn) {
			const $btn = $(btn);
			$btn.prop('disabled', true).find('.dashicons').addClass('msk-spin');
			this.toast(MaskaraAdmin.i18n.syncing, '');
			$.post(MaskaraAdmin.ajaxUrl, {
				action: 'maskara_sync_all',
				nonce: MaskaraAdmin.nonce,
			}).done((resp) => {
				if (resp.success) {
					this.toast(
						`${MaskaraAdmin.i18n.sync_success} (${resp.data.checked} checked / ${resp.data.updated} updated)`,
						'success'
					);
					if ($('#msk-dashboard').length) this.loadDashboard();
					if ($('#msk-shipments-page').length) this.loadShipments(this.page);
				} else {
					this.toast(MaskaraAdmin.i18n.sync_failed, 'error');
				}
			}).fail(() => this.toast(MaskaraAdmin.i18n.sync_failed, 'error'))
			.always(() => {
				$btn.prop('disabled', false).find('.dashicons').removeClass('msk-spin');
			});
		},

		bindDashboard() {
			$('#msk-apply-filters').on('click', () => this.loadDashboard());
			$('#msk-filters').on('change', 'select, input', () => this.loadDashboard());
		},

		loadDashboard() {
			$.post(MaskaraAdmin.ajaxUrl, Object.assign({
				action: 'maskara_get_summary',
				nonce: MaskaraAdmin.nonce,
			}, this.filters())).done((resp) => {
				if (!resp.success) return;
				this.renderKpis(resp.data.summary);
				this.renderDailyChart(resp.data.series || []);
				this.renderDonutChart(resp.data.summary);
				this.renderCourierTable(resp.data.couriers || []);
			});
		},

		renderKpis(summary) {
			$('#msk-kpi-grid .msk-kpi').each(function () {
				const $card = $(this);
				const key = $card.data('kpi');
				const money = String($card.data('money')) === '1';
				const percent = String($card.data('percent')) === '1';
				const v = summary[key] ?? 0;
				let text = MSK.formatNumber(v);
				if (money) text = MSK.formatMoney(v);
				if (percent) text = (+v || 0).toFixed(1) + '%';
				$card.find('.msk-kpi__value').text(text);
			});
		},

		renderDailyChart(series) {
			const ctx = document.getElementById('msk-chart-daily');
			if (!ctx || typeof Chart === 'undefined') return;
			const labels = series.map((r) => r.day);
			const dispatch = series.map((r) => +r.dispatched);
			const delivered = series.map((r) => +r.delivered);
			const returned = series.map((r) => +r.returned);

			if (this.charts.daily) this.charts.daily.destroy();
			this.charts.daily = new Chart(ctx, {
				type: 'line',
				data: {
					labels,
					datasets: [
						{ label: 'Dispatched', data: dispatch, borderColor: '#0d9488', backgroundColor: 'rgba(13,148,136,.12)', tension: .35, fill: true, borderWidth: 2.5, pointRadius: 3 },
						{ label: 'Delivered', data: delivered, borderColor: '#10b981', backgroundColor: 'rgba(16,185,129,.12)', tension: .35, fill: true, borderWidth: 2.5, pointRadius: 3 },
						{ label: 'Returned', data: returned, borderColor: '#f43f5e', backgroundColor: 'rgba(244,63,94,.12)', tension: .35, fill: true, borderWidth: 2.5, pointRadius: 3 },
					],
				},
				options: {
					responsive: true,
					maintainAspectRatio: false,
					interaction: { mode: 'index', intersect: false },
					plugins: { legend: { position: 'bottom', labels: { boxWidth: 10, boxHeight: 10, font: { size: 12 } } } },
					scales: {
						x: { grid: { display: false }, ticks: { font: { size: 11 } } },
						y: { beginAtZero: true, ticks: { font: { size: 11 }, precision: 0 } },
					},
				},
			});
		},

		renderDonutChart(summary) {
			const ctx = document.getElementById('msk-chart-donut');
			if (!ctx || typeof Chart === 'undefined') return;
			const data = [
				summary.delivered || 0,
				(summary.in_transit || 0) + (summary.processing || 0),
				summary.returned || 0,
			];
			if (this.charts.donut) this.charts.donut.destroy();
			this.charts.donut = new Chart(ctx, {
				type: 'doughnut',
				data: {
					labels: ['Delivered', 'In Transit / Processing', 'Returned'],
					datasets: [{
						data,
						backgroundColor: ['#10b981', '#0ea5e9', '#f43f5e'],
						borderColor: '#ffffff',
						borderWidth: 3,
						hoverOffset: 8,
					}],
				},
				options: {
					responsive: true,
					maintainAspectRatio: false,
					cutout: '68%',
					plugins: { legend: { position: 'bottom', labels: { boxWidth: 10, boxHeight: 10, font: { size: 12 } } } },
				},
			});
		},

		renderCourierTable(rows) {
			const $tbody = $('#msk-courier-table tbody').empty();
			if (!rows.length) {
				$tbody.append('<tr><td colspan="8" class="msk-empty">' + this.escape(MaskaraAdmin.i18n.no_data) + '</td></tr>');
				return;
			}
			rows.forEach((r) => {
				const total = Number(r.total) || 0;
				const delivered = Number(r.delivered) || 0;
				const inTransit = Number(r.in_transit) || 0;
				const returned = Number(r.returned) || 0;
				const rate = Number(r.success_rate);
				const rateText = Number.isFinite(rate) ? rate.toFixed(1) + '%' : '0.0%';
				$tbody.append(
					'<tr>' +
						'<td class="msk-col-name"><strong>' + this.escape(r.courier_slug || '—') + '</strong></td>' +
						'<td class="msk-num">' + this.formatNumber(total) + '</td>' +
						'<td class="msk-num">' + this.formatNumber(delivered) + '</td>' +
						'<td class="msk-num">' + this.formatNumber(inTransit) + '</td>' +
						'<td class="msk-num">' + this.formatNumber(returned) + '</td>' +
						'<td class="msk-num">' + rateText + '</td>' +
						'<td class="msk-num">' + this.formatMoney(r.collected) + '</td>' +
						'<td class="msk-num">' + this.formatMoney(r.delivery_charges) + '</td>' +
					'</tr>'
				);
			});
		},

		bindShipments() {
			const $page = $('#msk-shipments-page');
			$page.on('click', '#msk-apply-filters', () => this.loadShipments(1));
			$page.on('change', '#msk-filters select, #msk-filters input[type=date]', () => this.loadShipments(1));
			$page.on('input', '[name=search]', () => {
				clearTimeout(this.searchT);
				this.searchT = setTimeout(() => this.loadShipments(1), 350);
			});
			$page.on('click', '.msk-js-sync-one', (e) => {
				e.preventDefault();
				const id = $(e.currentTarget).data('shipment-id');
				this.syncOne(id, e.currentTarget);
			});
			$page.on('click', '.msk-pager button', (e) => {
				const p = parseInt($(e.currentTarget).data('page'), 10);
				if (p) this.loadShipments(p);
			});
		},

		loadShipments(page) {
			this.page = page || 1;
			$.post(MaskaraAdmin.ajaxUrl, Object.assign({
				action: 'maskara_get_shipments',
				nonce: MaskaraAdmin.nonce,
				page: this.page,
			}, this.filters())).done((resp) => {
				if (!resp.success) return;
				this.renderShipments(resp.data);
			});
		},

		renderShipments(data) {
			const $tbody = $('#msk-shipments-table tbody').empty();
			const rows = data.rows || [];
			if (!rows.length) {
				$tbody.append('<tr><td colspan="8" class="msk-empty">' + this.escape(MaskaraAdmin.i18n.no_data) + '</td></tr>');
			} else {
				rows.forEach((r) => {
					const status = r.status_normalized || r.status || '';
					$tbody.append(`
						<tr>
							<td><a href="${this.orderUrl(r.order_id)}">#${this.escape(r.order_id)}</a></td>
							<td><code>${this.escape(r.consignment_id || '—')}</code></td>
							<td>${this.escape(r.recipient_name || '—')}</td>
							<td>${this.escape(r.recipient_phone || '—')}</td>
							<td><span class="msk-badge msk-badge--${this.escape(status)}">${this.escape(status)}</span></td>
							<td class="msk-num">${this.formatMoney(r.cod_amount)}</td>
							<td>${this.escape(r.dispatched_at || '—')}</td>
							<td><button type="button" class="msk-link-btn msk-js-sync-one" data-shipment-id="${r.id}">Sync</button></td>
						</tr>
					`);
				});
			}

			const $pager = $('#msk-pager').empty();
			const pages = data.pages || 1;
			if (pages > 1) {
				$pager.append(`<button type="button" data-page="${this.page - 1}" ${this.page <= 1 ? 'disabled' : ''}>Prev</button>`);
				$pager.append(`<span style="align-self:center;font-size:12px;color:#64748b">Page ${this.page} / ${pages}</span>`);
				$pager.append(`<button type="button" data-page="${this.page + 1}" ${this.page >= pages ? 'disabled' : ''}>Next</button>`);
			}
		},

		syncOne(id, btn) {
			const $btn = $(btn).prop('disabled', true).text(MaskaraAdmin.i18n.syncing);
			$.post(MaskaraAdmin.ajaxUrl, {
				action: 'maskara_sync_one',
				nonce: MaskaraAdmin.nonce,
				shipment_id: id,
			}).done((resp) => {
				if (resp.success) {
					this.toast(MaskaraAdmin.i18n.sync_success + ': ' + (resp.data.status || ''), 'success');
					this.loadShipments(this.page);
				} else {
					this.toast((resp.data && resp.data.message) || MaskaraAdmin.i18n.sync_failed, 'error');
					$btn.prop('disabled', false).text('Sync');
				}
			}).fail(() => {
				this.toast(MaskaraAdmin.i18n.sync_failed, 'error');
				$btn.prop('disabled', false).text('Sync');
			});
		},

		orderUrl(id) {
			return (typeof ajaxurl !== 'undefined'
				? ajaxurl.replace('admin-ajax.php', 'admin.php?page=wc-orders&action=edit&id=')
				: '/wp-admin/admin.php?page=wc-orders&action=edit&id=') + id;
		},

		formatNumber(n) {
			return Number(n || 0).toLocaleString();
		},

		formatMoney(n) {
			const amount = Number(n || 0);
			const formatted = amount.toLocaleString(undefined, {
				minimumFractionDigits: amount % 1 === 0 ? 0 : 2,
				maximumFractionDigits: 2,
			});
			return (MaskaraAdmin.currency || '৳') + ' ' + formatted;
		},

		escape(str) {
			return String(str == null ? '' : str)
				.replace(/&/g, '&amp;')
				.replace(/</g, '&lt;')
				.replace(/>/g, '&gt;')
				.replace(/"/g, '&quot;');
		},
	};

	$(function () {
		MSK.init();
	});
})(jQuery);
