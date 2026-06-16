'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Users, ShoppingCart, DollarSign, Phone, TrendingUp, Globe, Banknote, SlidersHorizontal, Wallet } from 'lucide-react';
import { StatCard } from '@/components/ui/StatCard';
import { api, AdminDashboard, PlatformStatus } from '@/lib/api';
import { formatCurrency } from '@/lib/utils';

const DEMO: AdminDashboard = {
  totalMerchants: 156,
  activeMerchants: 134,
  totalOrders: 45230,
  totalCalls: 38920,
  monthlyRevenue: 485000,
  recentMerchants: [
    { id: '1', name: 'Fashion Hub BD', email: 'info@fashionhub.bd', status: 'ACTIVE', subscriptionPlan: 'GROWTH', _count: { orders: 1234, calls: 1100 } },
    { id: '2', name: 'Gadget Zone', email: 'sales@gadgetzone.bd', status: 'ACTIVE', subscriptionPlan: 'STARTER', _count: { orders: 567, calls: 490 } },
    { id: '3', name: 'Demo Store', email: 'demo@store.com', status: 'ACTIVE', subscriptionPlan: 'GROWTH', _count: { orders: 890, calls: 780 } },
  ],
};

const DEMO_STATUS: PlatformStatus = {
  voice: { epbx: true, ippbx: false, twilio: false },
  voiceProvider: 'epbx',
  payments: { bkash: false, nagad: false },
  merchants: { total: 4, active: 3, wooConnected: 1 },
};

export default function AdminDashboardPage() {
  const [data, setData] = useState<AdminDashboard>(DEMO);
  const [status, setStatus] = useState<PlatformStatus>(DEMO_STATUS);

  useEffect(() => {
    api.getAdminDashboard().then(setData).catch(() => setData(DEMO));
    api.getPlatformStatus().then(setStatus).catch(() => {});
  }, []);

  const controls = [
    { href: '/admin/merchants', label: 'মার্চেন্ট', desc: 'তৈরি, plan, suspend, store status', icon: Users, color: 'bg-blue-50 text-blue-700' },
    { href: '/admin/config', label: 'Voice / ePBX', desc: 'কল provider, webhook URL', icon: SlidersHorizontal, color: 'bg-amber-50 text-amber-700' },
    { href: '/admin/payments', label: 'পেমেন্ট গেটওয়ে', desc: 'bKash, Nagad PGW', icon: Banknote, color: 'bg-pink-50 text-pink-700' },
    { href: '/admin/plans', label: 'প্ল্যান', desc: 'দাম, limit, features', icon: ShoppingCart, color: 'bg-purple-50 text-purple-700' },
    { href: '/admin/billing', label: 'বিলিং', desc: 'Payment confirm', icon: Wallet, color: 'bg-emerald-50 text-emerald-700' },
    { href: '/admin/analytics', label: 'কল অ্যানালিটিক্স', desc: 'Success rate, reports', icon: Phone, color: 'bg-slate-100 text-slate-700' },
    { href: '/admin/settings', label: 'সেটিংস', desc: 'Maintenance, retries', icon: TrendingUp, color: 'bg-slate-100 text-slate-700' },
  ];

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-2xl font-bold text-slate-900">Control Center</h2>
        <p className="text-sm text-slate-500">সম্পূর্ণ প্ল্যাটফর্ম এক জায়গা থেকে নিয়ন্ত্রণ করুন</p>
      </div>

      <div className="card">
        <h3 className="font-semibold">Platform Status</h3>
        <div className="mt-4 flex flex-wrap gap-3 text-sm">
          <span className={status.voice?.epbx ? 'badge-success' : 'badge-warning'}>ePBX {status.voice?.epbx ? '✓' : '—'}</span>
          <span className={status.payments?.bkash ? 'badge-success' : 'badge-warning'}>bKash {status.payments?.bkash ? '✓' : '—'}</span>
          <span className={status.payments?.nagad ? 'badge-success' : 'badge-warning'}>Nagad {status.payments?.nagad ? '✓' : '—'}</span>
          <span className="badge-info">Voice: {status.voiceProvider || 'auto'}</span>
          <span className="badge-info inline-flex items-center gap-1"><Globe className="h-3 w-3" /> {status.merchants?.wooConnected ?? 0} store connected</span>
        </div>
        {status.publicApiUrl && <p className="mt-2 text-xs text-slate-400">Webhook base: {status.publicApiUrl}</p>}
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {controls.map((c) => (
          <Link key={c.href} href={c.href} className="card transition hover:border-brand-300 hover:shadow-md">
            <div className={`inline-flex rounded-lg p-2 ${c.color}`}>
              <c.icon className="h-5 w-5" />
            </div>
            <h4 className="mt-3 font-semibold text-slate-900">{c.label}</h4>
            <p className="mt-1 text-xs text-slate-500">{c.desc}</p>
          </Link>
        ))}
      </div>

      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        <StatCard title="Total Merchants" value={data.totalMerchants} icon={Users} color="blue" />
        <StatCard title="Active" value={data.activeMerchants} icon={Users} color="green" />
        <StatCard title="Total Orders" value={data.totalOrders.toLocaleString()} icon={ShoppingCart} color="brand" />
        <StatCard title="Total Calls" value={data.totalCalls.toLocaleString()} icon={Phone} color="blue" />
        <StatCard title="Monthly Revenue" value={formatCurrency(data.monthlyRevenue)} icon={DollarSign} color="green" />
        {data.pendingPayments !== undefined && (
          <StatCard title="Pending Payments" value={data.pendingPayments} icon={DollarSign} color="amber" />
        )}
      </div>

      <div className="card">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold">Recent Merchants</h3>
          <Link href="/admin/merchants" className="text-sm text-brand-600 hover:underline">সব দেখুন →</Link>
        </div>
        <div className="mt-4 overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="border-b bg-slate-50">
              <tr>
                <th className="px-4 py-2 font-medium text-slate-500">Store</th>
                <th className="px-4 py-2 font-medium text-slate-500">Email</th>
                <th className="px-4 py-2 font-medium text-slate-500">Plan</th>
                <th className="px-4 py-2 font-medium text-slate-500">Status</th>
                <th className="px-4 py-2 font-medium text-slate-500">Orders</th>
                <th className="px-4 py-2 font-medium text-slate-500">Calls</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {data.recentMerchants.map((m) => (
                <tr key={m.id} className="hover:bg-slate-50">
                  <td className="px-4 py-3 font-medium">{m.name}</td>
                  <td className="px-4 py-3 text-slate-500">{m.email}</td>
                  <td className="px-4 py-3"><span className="badge-info">{m.subscriptionPlan}</span></td>
                  <td className="px-4 py-3"><span className="badge-success">{m.status}</span></td>
                  <td className="px-4 py-3">{m._count.orders}</td>
                  <td className="px-4 py-3">{m._count.calls}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
