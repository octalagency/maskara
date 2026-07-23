'use client';

import { useEffect, useMemo, useState } from 'react';
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
  Sparkles,
} from 'lucide-react';
import { api, OrderStats, DailyReport, Merchant } from '@/lib/api';
import { voiceShort } from '@/lib/voice';
import {
  fillDailyReport,
  formatChartDate,
  formatChartDateLong,
  sumDailyReport,
  CHART_COLORS,
} from '@/lib/report-chart';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';

function ChartTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 shadow-lg">
      <p className="mb-2 text-[12px] font-semibold text-slate-500">
        {formatChartDateLong(String(label))}
      </p>
      <div className="space-y-1.5">
        {payload.map((p: any) => (
          <div key={p.dataKey} className="flex items-center justify-between gap-6 text-[13px]">
            <span className="flex items-center gap-2 text-slate-600">
              <span
                className="h-2.5 w-2.5 rounded-full"
                style={{ background: p.color }}
              />
              {p.name}
            </span>
            <span className="font-bold text-slate-900">{p.value}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

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

  const chartData = useMemo(() => fillDailyReport(report, 14), [report]);
  const period = useMemo(() => sumDailyReport(chartData), [chartData]);
  const hasAny =
    period.received > 0 || period.verified > 0 || period.cancelled > 0;

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
  const lifetimeBase = s.verifiedOrders + s.cancelledOrders;
  const lifetimeVerifyPct =
    lifetimeBase > 0 ? Math.round((s.verifiedOrders / lifetimeBase) * 100) : 0;
  const periodVerifyPct =
    period.received > 0 ? Math.round((period.verified / period.received) * 100) : 0;

  return (
    <DashboardLayout>
      <div className="mx-auto max-w-6xl space-y-6">
        <section className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-slate-900 via-slate-900 to-brand-950 p-5 text-white sm:p-7">
          <div
            className="pointer-events-none absolute -right-16 -top-20 h-56 w-56 rounded-full bg-brand-500/25 blur-3xl"
            aria-hidden
          />
          <div
            className="pointer-events-none absolute -bottom-24 left-1/3 h-48 w-48 rounded-full bg-sky-400/15 blur-3xl"
            aria-hidden
          />
          <div className="relative flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
            <div className="max-w-2xl">
              <p className="inline-flex items-center gap-1.5 text-[13px] font-medium text-brand-200">
                <Sparkles className="h-3.5 w-3.5" />
                আজকের সারাংশ
              </p>
              <h2 className="mt-1.5 text-[26px] font-bold leading-snug sm:text-[30px]">
                {storeName}
              </h2>
              <p className="mt-2 text-[14px] leading-relaxed text-slate-300">
                কাস্টমার যে ভয়েস শুনছে:{' '}
                <span className="font-semibold text-white">{voice}</span>। নতুন
                অর্ডার এলে AI বাংলায় কল করে ভেরিফাই করে।
              </p>
              <div className="mt-4 flex flex-wrap gap-2 text-[12px]">
                <span className="rounded-full bg-white/10 px-3 py-1 font-medium text-white/90 ring-1 ring-white/10">
                  নিশ্চিতকরণ রেট {lifetimeVerifyPct}%
                </span>
                <span className="rounded-full bg-white/10 px-3 py-1 font-medium text-white/90 ring-1 ring-white/10">
                  আজ {s.todayOrders} অর্ডার
                </span>
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              <Link
                href="/dashboard/orders"
                className="inline-flex items-center gap-2 rounded-xl bg-white px-4 py-2.5 text-[14px] font-semibold text-slate-900 shadow-sm transition hover:bg-slate-50"
              >
                অর্ডার দেখুন <ArrowRight className="h-4 w-4" />
              </Link>
              <Link
                href="/dashboard/settings"
                className="inline-flex items-center gap-2 rounded-xl border border-white/20 bg-white/5 px-4 py-2.5 text-[14px] font-semibold text-white transition hover:bg-white/10"
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
          <StatCard
            title="ভেরিফাইড"
            value={s.verifiedOrders}
            icon={CheckCircle}
            color="green"
            hint="AI কল দিয়ে নিশ্চিত"
          />
          <StatCard
            title="বাতিল"
            value={s.cancelledOrders}
            icon={XCircle}
            color="red"
            hint="শুধু কল দিয়ে বাতিল"
          />
          <StatCard title="পেন্ডিং" value={s.pendingOrders} icon={Clock} color="amber" />
          <StatCard title="আজকের অর্ডার" value={s.todayOrders} icon={TrendingUp} color="brand" />
          <StatCard
            title="কল সাকসেস"
            value={`${s.callSuccessRate}%`}
            icon={Phone}
            color="green"
            hint={`${s.totalCalls.toLocaleString('bn-BD')} টি কল`}
          />
        </section>

        <section className="card overflow-hidden">
          <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
            <div>
              <h3 className="section-title">শেষ ১৪ দিনের অর্ডার ট্রেন্ড</h3>
              <p className="page-subtitle mt-0.5">
                ওয়েবসাইট থেকে ম্যানুয়াল বাতিল এখানে দেখানো হয় না — শুধু Maskara কলের ফলাফল
              </p>
            </div>
            <Link
              href="/dashboard/reports"
              className="inline-flex items-center gap-1 text-[13px] font-semibold text-brand-600 hover:text-brand-700"
            >
              পূর্ণ রিপোর্ট <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>

          <div className="mb-5 grid gap-3 sm:grid-cols-3">
            <div className="rounded-2xl bg-gradient-to-br from-blue-50 to-white px-4 py-3.5 ring-1 ring-blue-100">
              <div className="flex items-center gap-2">
                <span className="h-2.5 w-2.5 rounded-full bg-blue-600" />
                <p className="text-[12px] font-semibold text-blue-700">রিসিভড</p>
              </div>
              <p className="mt-1 font-latin text-[24px] font-bold tracking-tight text-slate-900">
                {period.received}
              </p>
              <p className="text-[12px] text-slate-500">১৪ দিনে অর্ডার এসেছে</p>
            </div>
            <div className="rounded-2xl bg-gradient-to-br from-emerald-50 to-white px-4 py-3.5 ring-1 ring-emerald-100">
              <div className="flex items-center gap-2">
                <span className="h-2.5 w-2.5 rounded-full bg-emerald-600" />
                <p className="text-[12px] font-semibold text-emerald-700">ভেরিফাইড</p>
              </div>
              <p className="mt-1 font-latin text-[24px] font-bold tracking-tight text-slate-900">
                {period.verified}
              </p>
              <p className="text-[12px] text-slate-500">নিশ্চিত · {periodVerifyPct}% রেট</p>
            </div>
            <div className="rounded-2xl bg-gradient-to-br from-rose-50 to-white px-4 py-3.5 ring-1 ring-rose-100">
              <div className="flex items-center gap-2">
                <span className="h-2.5 w-2.5 rounded-full bg-rose-600" />
                <p className="text-[12px] font-semibold text-rose-700">বাতিল</p>
              </div>
              <p className="mt-1 font-latin text-[24px] font-bold tracking-tight text-slate-900">
                {period.cancelled}
              </p>
              <p className="text-[12px] text-slate-500">কল দিয়ে কাস্টমার বাতিল</p>
            </div>
          </div>

          <div className="mb-3 flex flex-wrap gap-4 text-[12px] font-medium text-slate-600">
            <span className="inline-flex items-center gap-1.5">
              <span className="h-2 w-4 rounded-sm" style={{ background: CHART_COLORS.received }} />
              রিসিভড
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="h-2 w-4 rounded-sm" style={{ background: CHART_COLORS.verified }} />
              ভেরিফাইড
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="h-2 w-4 rounded-sm" style={{ background: CHART_COLORS.cancelled }} />
              বাতিল
            </span>
          </div>

          <div className="h-72 sm:h-80">
            {!hasAny ? (
              <div className="flex h-full flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-slate-200 bg-slate-50 text-center">
                <p className="text-[14px] font-medium text-slate-600">এখনো অর্ডার ডেটা নেই</p>
                <p className="max-w-sm text-[13px] text-slate-400">
                  অর্ডার আসলে এখানে ১৪ দিনের ট্রেন্ড দেখাবে — কোন দিন কত এসেছে ও কত ভেরিফাই
                  হয়েছে।
                </p>
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={chartData} margin={{ top: 8, right: 8, left: -8, bottom: 0 }}>
                  <defs>
                    <linearGradient id="recvGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor={CHART_COLORS.received} stopOpacity={0.22} />
                      <stop offset="100%" stopColor={CHART_COLORS.received} stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="verGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor={CHART_COLORS.verified} stopOpacity={0.2} />
                      <stop offset="100%" stopColor={CHART_COLORS.verified} stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="canGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor={CHART_COLORS.cancelled} stopOpacity={0.18} />
                      <stop offset="100%" stopColor={CHART_COLORS.cancelled} stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
                  <XAxis
                    dataKey="date"
                    tick={{ fontSize: 11, fill: '#64748b' }}
                    tickLine={false}
                    axisLine={{ stroke: '#e2e8f0' }}
                    tickFormatter={formatChartDate}
                    interval="preserveStartEnd"
                    minTickGap={28}
                  />
                  <YAxis
                    tick={{ fontSize: 11, fill: '#64748b' }}
                    tickLine={false}
                    axisLine={false}
                    allowDecimals={false}
                    width={32}
                  />
                  <Tooltip content={<ChartTooltip />} />
                  <Area
                    type="monotone"
                    dataKey="ordersReceived"
                    stroke={CHART_COLORS.received}
                    strokeWidth={2.5}
                    fill="url(#recvGrad)"
                    name="রিসিভড"
                    activeDot={{ r: 5 }}
                  />
                  <Area
                    type="monotone"
                    dataKey="ordersVerified"
                    stroke={CHART_COLORS.verified}
                    strokeWidth={2.5}
                    fill="url(#verGrad)"
                    name="ভেরিফাইড"
                    activeDot={{ r: 5 }}
                  />
                  <Area
                    type="monotone"
                    dataKey="ordersCancelled"
                    stroke={CHART_COLORS.cancelled}
                    strokeWidth={2}
                    fill="url(#canGrad)"
                    name="বাতিল"
                    activeDot={{ r: 4 }}
                  />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </div>
        </section>
      </div>
    </DashboardLayout>
  );
}
