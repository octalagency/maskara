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
      if (!s) setError('স্ট্যাটস লোড হয়নি। API চালু আছে কিনা চেক করুন।');
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

  const storeName = merchant?.storeNameBangla || merchant?.name || 'আপনার স্টোর';
  const voice = voiceShort(merchant?.voiceId);

  return (
    <DashboardLayout>
      <div className="mx-auto max-w-6xl space-y-6">
        <section className="overflow-hidden rounded-2xl bg-slate-900 p-5 text-white sm:p-7">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
            <div className="max-w-2xl">
              <p className="text-[13px] font-medium text-brand-200">আজকের সারাংশ</p>
              <h2 className="mt-1 text-[26px] font-bold leading-snug sm:text-[30px]">{storeName}</h2>
              <p className="mt-2 text-[14px] leading-relaxed text-slate-300">
                কাস্টমার যে ভয়েস শুনছে: <span className="font-semibold text-white">{voice}</span>।
                নতুন অর্ডার এলে AI বাংলায় কল করে ভেরিফাই করে।
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Link
                href="/dashboard/orders"
                className="inline-flex items-center gap-2 rounded-xl bg-white px-4 py-2.5 text-[14px] font-semibold text-slate-900"
              >
                অর্ডার দেখুন <ArrowRight className="h-4 w-4" />
              </Link>
              <Link
                href="/dashboard/settings"
                className="inline-flex items-center gap-2 rounded-xl border border-white/20 bg-white/5 px-4 py-2.5 text-[14px] font-semibold text-white hover:bg-white/10"
              >
                <Mic2 className="h-4 w-4" /> ভয়েস সেটআপ
              </Link>
            </div>
          </div>
        </section>

        {error && (
          <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-[14px] text-amber-800">
            {error}
          </div>
        )}

        <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
          <StatCard title="মোট অর্ডার" value={s.totalOrders} icon={ShoppingCart} color="blue" />
          <StatCard title="ভেরিফাইড" value={s.verifiedOrders} icon={CheckCircle} color="green" />
          <StatCard title="বাতিল" value={s.cancelledOrders} icon={XCircle} color="red" />
          <StatCard title="পেন্ডিং" value={s.pendingOrders} icon={Clock} color="amber" />
          <StatCard title="আজকের অর্ডার" value={s.todayOrders} icon={TrendingUp} color="brand" />
          <StatCard
            title="কল সাকসেস"
            value={`${s.callSuccessRate}%`}
            icon={Phone}
            color="green"
            hint={`${s.totalCalls} টি কল`}
          />
        </section>

        <section className="card">
          <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
            <div>
              <h3 className="section-title">শেষ ১৪ দিনের অর্ডার</h3>
              <p className="page-subtitle mt-0.5">রিসিভড · ভেরিফাইড · বাতিল</p>
            </div>
            <Link href="/dashboard/reports" className="text-[13px] font-semibold text-brand-600 hover:text-brand-700">
              পূর্ণ রিপোর্ট →
            </Link>
          </div>
          <div className="h-72 sm:h-80">
            {report.length === 0 ? (
              <div className="flex h-full items-center justify-center rounded-xl border border-dashed border-slate-200 bg-slate-50 text-[14px] text-slate-500">
                এখনো ডেটা নেই — অর্ডার এলে চার্ট দেখাবে।
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={report}>
                  <defs>
                    <linearGradient id="recv" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#1a82f5" stopOpacity={0.28} />
                      <stop offset="100%" stopColor="#1a82f5" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="ver" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#10b981" stopOpacity={0.25} />
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
        </section>
      </div>
    </DashboardLayout>
  );
}
