'use client';

import { useEffect, useState } from 'react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { api, Order } from '@/lib/api';
import { formatCurrency, formatDate, getStatusBadge } from '@/lib/utils';
import { dateRangeForPeriod } from '@/lib/voice';
import { RefreshCw, Search, PhoneCall } from 'lucide-react';
import { cn } from '@/lib/utils';

type Period = 'today' | 'yesterday' | 'week' | 'month' | 'all';

const PERIODS: { id: Period; label: string }[] = [
  { id: 'today', label: 'আজকে' },
  { id: 'yesterday', label: 'গতকাল' },
  { id: 'week', label: 'এই সপ্তাহে' },
  { id: 'month', label: 'এই মাসে' },
  { id: 'all', label: 'সব' },
];

export default function OrdersPage() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [total, setTotal] = useState(0);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [period, setPeriod] = useState<Period>('today');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [maxCallRetries, setMaxCallRetries] = useState(10);

  useEffect(() => {
    api
      .getMerchant()
      .then((m) => setMaxCallRetries(m.maxCallRetries ?? 10))
      .catch(() => undefined);
  }, []);

  useEffect(() => {
    loadOrders();
  }, [statusFilter, period]);

  async function loadOrders() {
    setLoading(true);
    setError('');
    try {
      const range = dateRangeForPeriod(period);
      const params: Record<string, string> = { limit: '50' };
      if (statusFilter) params.status = statusFilter;
      if (search) params.search = search;
      if (range.from) params.from = range.from;
      if (range.to) params.to = range.to;
      const res = await api.getOrders(params);
      setOrders(res.orders || []);
      setTotal(res.total || 0);
    } catch {
      setOrders([]);
      setTotal(0);
      setError('Orders load করতে ব্যর্থ। আবার চেষ্টা করুন।');
    } finally {
      setLoading(false);
    }
  }

  async function handleRetry(orderId: string) {
    try {
      await api.retryCall(orderId);
      loadOrders();
    } catch {
      setError('Retry call ব্যর্থ হয়েছে।');
    }
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <h2 className="page-title">অর্ডার</h2>
            <p className="page-subtitle">
              সময় অনুযায়ী ফিল্টার করুন · {total} টি অর্ডার
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            {PERIODS.map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => setPeriod(p.id)}
                className={cn(period === p.id ? 'period-chip-active' : 'period-chip-idle')}
              >
                {p.label}
              </button>
            ))}
          </div>
        </div>

        <div className="flex flex-col gap-3 sm:flex-row">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              className="input pl-9"
              placeholder="অর্ডার নম্বর, নাম বা ফোন…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && loadOrders()}
            />
          </div>
          <select
            className="input w-full sm:w-44"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
          >
            <option value="">সব স্ট্যাটাস</option>
            <option value="PENDING">Pending</option>
            <option value="CALLING">Calling</option>
            <option value="VERIFIED">Verified</option>
            <option value="CANCELLED">Cancelled</option>
            <option value="FAILED">Failed</option>
          </select>
          <button onClick={loadOrders} className="btn-secondary gap-2">
            <RefreshCw className="h-4 w-4" /> রিফ্রেশ
          </button>
        </div>

        {error && (
          <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
        )}

        <div className="card overflow-hidden p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-slate-100 bg-slate-50/80">
                <tr>
                  <th className="px-5 py-3.5 font-semibold text-slate-500">অর্ডার</th>
                  <th className="px-5 py-3.5 font-semibold text-slate-500">কাস্টমার</th>
                  <th className="px-5 py-3.5 font-semibold text-slate-500">ফোন</th>
                  <th className="px-5 py-3.5 font-semibold text-slate-500">এমাউন্ট</th>
                  <th className="px-5 py-3.5 font-semibold text-slate-500">স্ট্যাটাস</th>
                  <th className="px-5 py-3.5 font-semibold text-slate-500">কল</th>
                  <th className="px-5 py-3.5 font-semibold text-slate-500">তারিখ</th>
                  <th className="px-5 py-3.5 font-semibold text-slate-500">অ্যাকশন</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {!loading && orders.length === 0 && (
                  <tr>
                    <td colSpan={8} className="px-5 py-16 text-center text-slate-500">
                      এই সময়সীমায় কোনো অর্ডার নেই।
                    </td>
                  </tr>
                )}
                {orders.map((order) => {
                  const lastCall = order.calls?.[0];
                  return (
                    <tr key={order.id} className="hover:bg-slate-50/80">
                      <td className="px-5 py-4 font-semibold text-slate-900">{order.orderNumber}</td>
                      <td className="px-5 py-4 text-slate-700">{order.customerName}</td>
                      <td className="px-5 py-4 text-slate-600">{order.customerPhone}</td>
                      <td className="px-5 py-4 font-medium text-slate-800">
                        {formatCurrency(Number(order.totalAmount))}
                      </td>
                      <td className="px-5 py-4">
                        <span className={getStatusBadge(order.status)}>{order.status}</span>
                      </td>
                      <td className="px-5 py-4 text-slate-600">
                        <div className="flex items-center gap-1.5">
                          <PhoneCall className="h-3.5 w-3.5 text-slate-400" />
                          {order.callAttempts ?? 0}
                          <span className="text-slate-400">/{maxCallRetries}</span>
                          {lastCall?.outcome && (
                            <span className="ml-1 text-xs text-slate-400">({lastCall.outcome})</span>
                          )}
                        </div>
                      </td>
                      <td className="px-5 py-4 text-slate-500">{formatDate(order.createdAt)}</td>
                      <td className="px-5 py-4">
                        {['PENDING', 'FAILED', 'CALLING'].includes(order.status) && (
                          <button
                            onClick={() => handleRetry(order.id)}
                            className="inline-flex items-center gap-1 text-sm font-semibold text-brand-600 hover:text-brand-700"
                          >
                            <RefreshCw className="h-4 w-4" /> আবার কল
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          {loading && (
            <div className="flex justify-center py-10">
              <div className="h-6 w-6 animate-spin rounded-full border-2 border-brand-600 border-t-transparent" />
            </div>
          )}
        </div>
      </div>
    </DashboardLayout>
  );
}
