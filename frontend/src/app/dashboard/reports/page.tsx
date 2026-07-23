'use client';

import { useEffect, useMemo, useState } from 'react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { StatCard } from '@/components/ui/StatCard';
import { api, DailyReport, ReportSummary } from '@/lib/api';
import { cn } from '@/lib/utils';
import {
  fillDailyReport,
  formatChartDate,
  formatChartDateLong,
  sumDailyReport,
  CHART_COLORS,
} from '@/lib/report-chart';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  LineChart,
  Line,
} from 'recharts';
import {
  ShoppingCart,
  CheckCircle,
  Phone,
  Percent,
  Timer,
  XCircle,
} from 'lucide-react';

type Range = 7 | 14 | 30;

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
              <span className="h-2.5 w-2.5 rounded-full" style={{ background: p.color }} />
              {p.name}
            </span>
            <span className="font-bold text-slate-900">
              {p.dataKey === 'verificationRate' ? `${p.value}%` : p.value}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

function LegendDots({ items }: { items: { color: string; label: string }[] }) {
  return (
    <div className="flex flex-wrap gap-4 text-[12px] font-medium text-slate-600">
      {items.map((it) => (
        <span key={it.label} className="inline-flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-full" style={{ background: it.color }} />
          {it.label}
        </span>
      ))}
    </div>
  );
}

export default function ReportsPage() {
  const [days, setDays] = useState<Range>(14);
  const [report, setReport] = useState<DailyReport[]>([]);
  const [summary, setSummary] = useState<ReportSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    setLoading(true);
    Promise.all([
      api.getDailyReport(days).catch(() => [] as DailyReport[]),
      api.getReportSummary().catch(() => null),
    ]).then(([r, s]) => {
      setReport(Array.isArray(r) ? r : []);
      setSummary(s);
      if (!r?.length && !s) setError('রিপোর্ট লোড হয়নি।');
      else setError('');
      setLoading(false);
    });
  }, [days]);

  const chartData = useMemo(() => fillDailyReport(report, days), [report, days]);
  const period = useMemo(() => sumDailyReport(chartData), [chartData]);

  const totals = useMemo(() => {
    // Always use selected-range daily report (live Order/Call), not stale usageRecord summary
    return {
      orders: period.received,
      verified: period.verified,
      cancelled: period.cancelled,
      calls: period.calls,
      callSuccess: chartData.reduce((n, d) => n + (d.callsSuccess || 0), 0),
      verifyRate:
        period.received > 0
          ? Math.round((period.verified / period.received) * 100)
          : 0,
    };
  }, [period, chartData]);

  const hasFlow = period.received + period.verified + period.cancelled > 0;

  return (
    <DashboardLayout>
      <div className="mx-auto max-w-6xl space-y-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h2 className="page-title">রিপোর্ট</h2>
            <p className="page-subtitle">
              নির্বাচিত সময়ের হিসাব — ওয়েবসাইট ম্যানুয়াল বাতিল বাদ, শুধু Maskara কলের ফলাফল
            </p>
          </div>
          <div className="flex gap-2">
            {([7, 14, 30] as Range[]).map((d) => (
              <button
                key={d}
                type="button"
                onClick={() => setDays(d)}
                className={cn(days === d ? 'period-chip-active' : 'period-chip-idle')}
              >
                {d} দিন
              </button>
            ))}
          </div>
        </div>

        {error && (
          <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
            {error}
          </div>
        )}

        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-6">
          <StatCard title="অর্ডার এসেছে" value={totals.orders} icon={ShoppingCart} color="blue" />
          <StatCard title="ভেরিফাইড" value={totals.verified} icon={CheckCircle} color="green" />
          <StatCard
            title="বাতিল"
            value={totals.cancelled}
            icon={XCircle}
            color="red"
            hint="কল দিয়ে বাতিল"
          />
          <StatCard title="মোট কল" value={totals.calls} icon={Phone} color="brand" />
          <StatCard title="ভেরিফিকেশন রেট" value={`${totals.verifyRate}%`} icon={Percent} color="amber" />
          <StatCard
            title="গড় কল সময়"
            value={`${summary?.avgCallDuration ?? 0}s`}
            icon={Timer}
            color="blue"
          />
        </div>

        <section className="card">
          <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
            <div>
              <h3 className="section-title">অর্ডার ফ্লো</h3>
              <p className="page-subtitle">
                নীল = এসেছে · সবুজ = নিশ্চিত · লাল = বাতিল — প্রতিদিন তুলনা করুন
              </p>
            </div>
            <LegendDots
              items={[
                { color: CHART_COLORS.received, label: 'রিসিভড' },
                { color: CHART_COLORS.verified, label: 'ভেরিফাইড' },
                { color: CHART_COLORS.cancelled, label: 'বাতিল' },
              ]}
            />
          </div>
          <div className="h-80">
            {loading ? (
              <Spinner />
            ) : !hasFlow ? (
              <EmptyChart />
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData} margin={{ top: 8, right: 8, left: -8, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
                  <XAxis
                    dataKey="date"
                    tick={{ fontSize: 11, fill: '#64748b' }}
                    tickLine={false}
                    axisLine={{ stroke: '#e2e8f0' }}
                    tickFormatter={formatChartDate}
                    interval="preserveStartEnd"
                    minTickGap={24}
                  />
                  <YAxis
                    tick={{ fontSize: 11, fill: '#64748b' }}
                    tickLine={false}
                    axisLine={false}
                    allowDecimals={false}
                    width={32}
                  />
                  <Tooltip content={<ChartTooltip />} cursor={{ fill: 'rgba(148,163,184,0.12)' }} />
                  <Bar dataKey="ordersReceived" fill={CHART_COLORS.received} name="রিসিভড" radius={[4, 4, 0, 0]} maxBarSize={18} />
                  <Bar dataKey="ordersVerified" fill={CHART_COLORS.verified} name="ভেরিফাইড" radius={[4, 4, 0, 0]} maxBarSize={18} />
                  <Bar dataKey="ordersCancelled" fill={CHART_COLORS.cancelled} name="বাতিল" radius={[4, 4, 0, 0]} maxBarSize={18} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </section>

        <div className="grid gap-6 lg:grid-cols-2">
          <div className="card">
            <div className="mb-4">
              <h3 className="section-title">ভেরিফিকেশন রেট</h3>
              <p className="page-subtitle">প্রতিদিন কত শতাংশ অর্ডার নিশ্চিত হয়েছে</p>
            </div>
            <LegendDots items={[{ color: CHART_COLORS.calls, label: 'ভেরিফিকেশন %' }]} />
            <div className="mt-4 h-72">
              {loading ? (
                <Spinner />
              ) : !hasFlow ? (
                <EmptyChart />
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={chartData} margin={{ top: 8, right: 8, left: -8, bottom: 0 }}>
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
                      domain={[0, 100]}
                      width={36}
                      tickFormatter={(v) => `${v}%`}
                    />
                    <Tooltip content={<ChartTooltip />} />
                    <Line
                      type="monotone"
                      dataKey="verificationRate"
                      stroke={CHART_COLORS.calls}
                      strokeWidth={2.5}
                      name="ভেরিফিকেশন %"
                      dot={{ r: 3, fill: CHART_COLORS.calls }}
                      activeDot={{ r: 5 }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              )}
            </div>
          </div>

          <div className="card">
            <div className="mb-4">
              <h3 className="section-title">দৈনিক কল</h3>
              <p className="page-subtitle">প্রতিদিন কতগুলো ভেরিফিকেশন কল হয়েছে</p>
            </div>
            <LegendDots items={[{ color: CHART_COLORS.calls, label: 'কল সংখ্যা' }]} />
            <div className="mt-4 h-72">
              {loading ? (
                <Spinner />
              ) : period.calls === 0 ? (
                <EmptyChart />
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={chartData} margin={{ top: 8, right: 8, left: -8, bottom: 0 }}>
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
                    <Tooltip content={<ChartTooltip />} cursor={{ fill: 'rgba(148,163,184,0.12)' }} />
                    <Bar
                      dataKey="callsMade"
                      fill={CHART_COLORS.calls}
                      name="কল"
                      radius={[6, 6, 0, 0]}
                      maxBarSize={28}
                    />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>
          </div>
        </div>

        {(summary?.callsByOutcome?.length || 0) > 0 && (
          <div className="card">
            <h3 className="section-title">কলের ফলাফল</h3>
            <p className="page-subtitle mb-4">কাস্টমার কী চাপ দিয়েছে / কী হয়েছে</p>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {summary!.callsByOutcome.map((row) => (
                <div key={String(row.outcome)} className="rounded-2xl bg-slate-50 p-4 ring-1 ring-slate-100">
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                    {row.outcome || 'UNKNOWN'}
                  </p>
                  <p className="mt-1 text-2xl font-bold text-slate-900">{row.count}</p>
                  <p className="mt-1 text-xs text-slate-500">
                    {row.outcome === 'CONFIRMED' && '১ চাপ — অর্ডার নিশ্চিত'}
                    {row.outcome === 'CANCELLED' && '২ চাপ — অর্ডার বাতিল'}
                    {row.outcome === 'NO_RESPONSE' && 'কোনো ইনপুট নেই'}
                    {row.outcome === 'ESCALATED' && 'ম্যানুয়াল ফলোআপ'}
                  </p>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}

function Spinner() {
  return (
    <div className="flex h-full items-center justify-center">
      <div className="h-6 w-6 animate-spin rounded-full border-2 border-brand-600 border-t-transparent" />
    </div>
  );
}

function EmptyChart() {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-1 rounded-xl border border-dashed border-slate-200 bg-slate-50 text-center">
      <p className="text-sm font-medium text-slate-600">এখনো ডেটা নেই</p>
      <p className="text-xs text-slate-400">অর্ডার বা কল হলে এখানে দেখাবে</p>
    </div>
  );
}
