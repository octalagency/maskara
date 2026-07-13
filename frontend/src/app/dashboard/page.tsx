'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { StatCard } from '@/components/ui/StatCard';
import {
  ShoppingCart,
  CheckCircle,
  XCircle,
  Clock,
  Phone,
  TrendingUp,
  ArrowRight,
  Mic2,
} from 'lucide-react';
import { api, OrderStats, DailyReport, Merchant } from '@/lib/api';
import { voiceShort } from '@/lib/voice';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';

export default function DashboardPage() {
  const [stats, setStats] = useState<OrderStats | null>(null);
  const [report, setReport] = useState<DailyReport[]>([]);
  const [merchant, setMerchant] = useState<Merchant | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    Promise.all([
      api.getOrderStats().catch(() => null),
      api.getDailyReport(14).catch(() => [] as DailyReport[]),
      api.getMerchant().catch(() => null),
    ]).then(([s, r, m]) => {
      setStats(s);
      setReport(Array.isArray(r) ? r : []);
      setMerchant(m);
      if (!s) setError('স্ট্যাটস লোড হয়নি — API চালু আছে কিনা চেক করুন।');
      setLoading(false);
    });
  }, []);

  if (loading) {
    return (
      <DashboardLayout>
        <div className="flex h-64 items-center justify-center">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-brand-600 border-t-transparent" />
        </div>
      </DashboardLayout>
    );
  }

  const s = stats || {
    totalOrders: 0,
    verifiedOrders: 0,
    cancelledOrders: 0,
    pendingOrders: 0,
    todayOrders: 0,
    callSuccessRate: 0,
    totalCalls: 0,
  };

  return (
    <DashboardLayout>
      <div className="space-y-8">
        <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-slate-900 via-brand-950 to-brand-800 p-6 text-white sm:p-8">
          <div className="absolute -right-10 -top-10 h-40 w-40 rounded-full bg-brand-400/20 blur-2xl" />
          <div className="absolute bottom-0 left-1/3 h-32 w-32 rounded-full bg-sky-400/10 blur-2xl" />
          <div className="relative flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="text-sm font-medium text-brand-200">আজকের ওভারভিউ</p>
              <h2 className="mt-1 font-display text-3xl font-bold tracking-tight">
                {merchant?.storeNameBangla || merchant?.name || 'আপনার স্টোর'}
              </h2>
              <p className="mt-2 max-w-xl text-sm text-slate-300">
                কাস্টমারকে যে ভয়েসে কল যাচ্ছে:{' '}
                <span className="font-semibold text-white">{voiceShort(merchant?.voiceId)}</span>
                . অর্ডার আসলে AI বাংলায় ভেরিফাই করে।
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Link href="/dashboard/orders" className="inline-flex items-center gap-2 rounded-xl bg-white px-4 py-2.5 text-sm font-semibold text-slate-900">
                অর্ডার দেখুন <ArrowRight className="h-4 w-4" />
              </Link>
              <Link href="/dashboard/settings" className="inline-flex items-center gap-2 rounded-xl bg-white/10 px-4 py-2.5 text-sm font-semibold text-white ring-1 ring-white/20 hover:bg-white/15">
                <Mic2 className="h-4 w-4" /> ভয়েস সেটআপ
              </Link>
            </div>
          </div>
        </div>

        {error && (
          <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">{error}</div>
        )}

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
          <StatCard title="মোট অর্ডার" value={s.totalOrders} icon={ShoppingCart} color="blue" />
          <StatCard title="ভেরিফাইড" value={s.verifiedOrders} icon={CheckCircle} color="green" />
          <StatCard title="বাতিল" value={s.cancelledOrders} icon={XCircle} color="red" />
          <StatCard title="পেন্ডিং" value={s.pendingOrders} icon={Clock} color="amber" />
          <StatCard title="আজকের অর্ডার" value={s.todayOrders} icon={TrendingUp} color="brand" />
          <StatCard title="কল সাকসেস" value={`${s.callSuccessRate}%`} icon={Phone} color="green" hint={`${s.totalCalls} কল`} />
        </div>

        <div className="card">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <h3 className="font-display text-lg font-bold text-slate-900">শেষ ১৪ দিনের অর্ডার</h3>
              <p className="text-sm text-slate-500">রিসিভড · ভেরিফাইড · বাতিল</p>
            </div>
            <Link href="/dashboard/reports" className="text-sm font-semibold text-brand-600 hover:text-brand-700">
              পূর্ণ রিপোর্ট →
            </Link>
          </div>
          <div className="mt-6 h-80">
            {report.length === 0 ? (
              <div className="flex h-full items-center justify-center rounded-2xl border border-dashed border-slate-200 bg-slate-50 text-sm text-slate-500">
                এখনো ডেটা নেই — অর্ডার এলে চার্ট দেখাবে।
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={report}>
                  <defs>
                    <linearGradient id="recv" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#1a82f5" stopOpacity={0.35} />
                      <stop offset="100%" stopColor="#1a82f5" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="ver" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#10b981" stopOpacity={0.3} />
                      <stop offset="100%" stopColor="#10b981" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                  <XAxis dataKey="date" tick={{ fontSize: 12 }} tickFormatter={(v) => String(v).slice(5)} />
                  <YAxis tick={{ fontSize: 12 }} allowDecimals={false} />
                  <Tooltip />
                  <Area type="monotone" dataKey="ordersReceived" stroke="#1a82f5" fill="url(#recv)" name="রিসিভড" />
                  <Area type="monotone" dataKey="ordersVerified" stroke="#10b981" fill="url(#ver)" name="ভেরিফাইড" />
                  <Area type="monotone" dataKey="ordersCancelled" stroke="#ef4444" fill="#fee2e2" name="বাতিল" />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
