'use client';

import { useEffect, useMemo, useState } from 'react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { StatCard } from '@/components/ui/StatCard';
import { api, DailyReport, ReportSummary } from '@/lib/api';
import { cn } from '@/lib/utils';
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
  Legend,
} from 'recharts';
import {
  ShoppingCart,
  CheckCircle,
  Phone,
  Percent,
  Timer,
} from 'lucide-react';

type Range = 7 | 14 | 30;

export default function ReportsPage() {
  const [days, setDays] = useState<Range>(30);
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

  const totals = useMemo(() => {
    const fromChart = report.reduce(
      (acc, d) => {
        acc.orders += d.ordersReceived;
        acc.verified += d.ordersVerified;
        acc.cancelled += d.ordersCancelled;
        acc.calls += d.callsMade;
        return acc;
      },
      { orders: 0, verified: 0, cancelled: 0, calls: 0 },
    );
    const s = summary?.last30Days;
    return {
      orders: s?.ordersReceived ?? fromChart.orders,
      verified: s?.ordersVerified ?? fromChart.verified,
      cancelled: s?.ordersCancelled ?? fromChart.cancelled,
      calls: s?.callsMade ?? fromChart.calls,
      callSuccess: s?.callsSuccess ?? 0,
      verifyRate:
        (s?.ordersReceived || fromChart.orders) > 0
          ? Math.round(
              ((s?.ordersVerified ?? fromChart.verified) /
                (s?.ordersReceived || fromChart.orders)) *
                100,
            )
          : 0,
    };
  }, [report, summary]);

  return (
    <DashboardLayout>
      <div className="space-y-8">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h2 className="page-title">রিপোর্ট</h2>
            <p className="page-subtitle">
              কত অর্ডার এসেছে, কত ভেরিফাই হয়েছে, কত কল হয়েছে — সহজে বোঝার মতো সারাংশ।
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

        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
          <StatCard title="অর্ডার এসেছে" value={totals.orders} icon={ShoppingCart} color="blue" />
          <StatCard title="ভেরিফাইড" value={totals.verified} icon={CheckCircle} color="green" />
          <StatCard title="মোট কল" value={totals.calls} icon={Phone} color="brand" />
          <StatCard title="ভেরিফিকেশন রেট" value={`${totals.verifyRate}%`} icon={Percent} color="amber" />
          <StatCard
            title="গড় কল সময়"
            value={`${summary?.avgCallDuration ?? 0}s`}
            icon={Timer}
            color="blue"
          />
        </div>

        <div className="grid gap-6 lg:grid-cols-2">
          <div className="card">
            <h3 className="font-display text-lg font-bold">ভেরিফিকেশন রেট (%)</h3>
            <p className="text-sm text-slate-500">প্রতিদিন কত % অর্ডার নিশ্চিত হয়েছে</p>
            <div className="mt-6 h-72">
              {loading ? (
                <div className="flex h-full items-center justify-center">
                  <div className="h-6 w-6 animate-spin rounded-full border-2 border-brand-600 border-t-transparent" />
                </div>
              ) : report.length === 0 ? (
                <EmptyChart />
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={report}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                    <XAxis dataKey="date" tick={{ fontSize: 11 }} tickFormatter={(v) => String(v).slice(5)} />
                    <YAxis tick={{ fontSize: 11 }} domain={[0, 100]} />
                    <Tooltip />
                    <Line
                      type="monotone"
                      dataKey="verificationRate"
                      stroke="#1a82f5"
                      strokeWidth={2.5}
                      name="Verification %"
                      dot={false}
                    />
                  </LineChart>
                </ResponsiveContainer>
              )}
            </div>
          </div>

          <div className="card">
            <h3 className="font-display text-lg font-bold">দৈনিক কল</h3>
            <p className="text-sm text-slate-500">প্রতিদিন কতগুলো ভেরিফিকেশন কল হয়েছে</p>
            <div className="mt-6 h-72">
              {loading ? (
                <div className="flex h-full items-center justify-center">
                  <div className="h-6 w-6 animate-spin rounded-full border-2 border-brand-600 border-t-transparent" />
                </div>
              ) : report.length === 0 ? (
                <EmptyChart />
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={report}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                    <XAxis dataKey="date" tick={{ fontSize: 11 }} tickFormatter={(v) => String(v).slice(5)} />
                    <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
                    <Tooltip />
                    <Bar dataKey="callsMade" fill="#1a82f5" name="কল" radius={[6, 6, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>
          </div>
        </div>

        <div className="card">
          <h3 className="font-display text-lg font-bold">অর্ডার ফ্লো</h3>
          <p className="text-sm text-slate-500">রিসিভড বনাম ভেরিফাইড বনাম বাতিল</p>
          <div className="mt-6 h-80">
            {report.length === 0 ? (
              <EmptyChart />
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={report}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                  <XAxis dataKey="date" tick={{ fontSize: 11 }} tickFormatter={(v) => String(v).slice(5)} />
                  <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
                  <Tooltip />
                  <Legend />
                  <Bar dataKey="ordersReceived" fill="#94a3b8" name="রিসিভড" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="ordersVerified" fill="#10b981" name="ভেরিফাইড" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="ordersCancelled" fill="#f43f5e" name="বাতিল" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        {(summary?.callsByOutcome?.length || 0) > 0 && (
          <div className="card">
            <h3 className="font-display text-lg font-bold">কলের ফলাফল</h3>
            <p className="mb-4 text-sm text-slate-500">কাস্টমার কী চাপ দিয়েছে / কী হয়েছে</p>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {summary!.callsByOutcome.map((row) => (
                <div key={String(row.outcome)} className="rounded-2xl bg-slate-50 p-4 ring-1 ring-slate-100">
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                    {row.outcome || 'UNKNOWN'}
                  </p>
                  <p className="mt-1 font-display text-2xl font-bold text-slate-900">{row.count}</p>
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

function EmptyChart() {
  return (
    <div className="flex h-full items-center justify-center rounded-2xl border border-dashed border-slate-200 bg-slate-50 text-sm text-slate-500">
      ডেটা নেই — অর্ডার/কল হলে এখানে দেখাবে।
    </div>
  );
}
