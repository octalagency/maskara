'use client';

import { useEffect, useState } from 'react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { api, Order } from '@/lib/api';
import { formatCurrency, formatDate, getStatusBadge } from '@/lib/utils';
import { RefreshCw, Search } from 'lucide-react';

const demoOrders: Order[] = [
  { id: '1', orderNumber: 'ORD-1234', customerName: 'রহিম আহমেদ', customerPhone: '+8801712345678', totalAmount: 2500, status: 'VERIFIED', paymentMethod: 'COD', createdAt: new Date().toISOString() },
  { id: '2', orderNumber: 'ORD-1235', customerName: 'করিম হাসান', customerPhone: '+8801812345678', totalAmount: 1800, status: 'PENDING', paymentMethod: 'COD', createdAt: new Date().toISOString() },
  { id: '3', orderNumber: 'ORD-1236', customerName: 'ফাতেমা বেগম', customerPhone: '+8801912345678', totalAmount: 3200, status: 'CANCELLED', paymentMethod: 'COD', createdAt: new Date().toISOString() },
  { id: '4', orderNumber: 'ORD-1237', customerName: 'সাকিব আলী', customerPhone: '+8801612345678', totalAmount: 950, status: 'CALLING', paymentMethod: 'COD', createdAt: new Date().toISOString() },
];

export default function OrdersPage() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => { loadOrders(); }, [statusFilter]);

  async function loadOrders() {
    setLoading(true);
    try {
      const params: Record<string, string> = {};
      if (statusFilter) params.status = statusFilter;
      if (search) params.search = search;
      const res = await api.getOrders(params);
      setOrders(res.orders);
    } catch {
      setOrders(demoOrders);
    } finally {
      setLoading(false);
    }
  }

  async function handleRetry(orderId: string) {
    try {
      await api.retryCall(orderId);
      loadOrders();
    } catch { /* demo mode */ }
  }

  const displayOrders = orders.length > 0 ? orders : demoOrders;

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-2xl font-bold text-slate-900">Orders</h2>
            <p className="text-sm text-slate-500">Manage and verify customer orders</p>
          </div>
          <div className="flex gap-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                className="input pl-9"
                placeholder="Search orders..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && loadOrders()}
              />
            </div>
            <select className="input w-auto" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
              <option value="">All Status</option>
              <option value="PENDING">Pending</option>
              <option value="CALLING">Calling</option>
              <option value="VERIFIED">Verified</option>
              <option value="CANCELLED">Cancelled</option>
              <option value="FAILED">Failed</option>
            </select>
          </div>
        </div>

        <div className="card overflow-hidden p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-slate-200 bg-slate-50">
                <tr>
                  <th className="px-6 py-3 font-medium text-slate-500">Order</th>
                  <th className="px-6 py-3 font-medium text-slate-500">Customer</th>
                  <th className="px-6 py-3 font-medium text-slate-500">Phone</th>
                  <th className="px-6 py-3 font-medium text-slate-500">Amount</th>
                  <th className="px-6 py-3 font-medium text-slate-500">Status</th>
                  <th className="px-6 py-3 font-medium text-slate-500">Date</th>
                  <th className="px-6 py-3 font-medium text-slate-500">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {displayOrders.map((order) => (
                  <tr key={order.id} className="hover:bg-slate-50">
                    <td className="px-6 py-4 font-medium text-slate-900">{order.orderNumber}</td>
                    <td className="px-6 py-4 text-slate-600">{order.customerName}</td>
                    <td className="px-6 py-4 text-slate-600">{order.customerPhone}</td>
                    <td className="px-6 py-4 text-slate-600">{formatCurrency(Number(order.totalAmount))}</td>
                    <td className="px-6 py-4">
                      <span className={getStatusBadge(order.status)}>{order.status}</span>
                    </td>
                    <td className="px-6 py-4 text-slate-500">{formatDate(order.createdAt)}</td>
                    <td className="px-6 py-4">
                      {['PENDING', 'FAILED'].includes(order.status) && (
                        <button
                          onClick={() => handleRetry(order.id)}
                          className="inline-flex items-center gap-1 text-sm font-medium text-brand-600 hover:text-brand-700"
                        >
                          <RefreshCw className="h-4 w-4" /> Retry Call
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {loading && (
            <div className="flex justify-center py-8">
              <div className="h-6 w-6 animate-spin rounded-full border-2 border-brand-600 border-t-transparent" />
            </div>
          )}
        </div>
      </div>
    </DashboardLayout>
  );
}
