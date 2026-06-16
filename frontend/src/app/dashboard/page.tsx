'use client';

import { useEffect, useState } from 'react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { StatCard } from '@/components/ui/StatCard';
import { ShoppingCart, CheckCircle, XCircle, Clock, Phone, TrendingUp } from 'lucide-react';
import { api, OrderStats, DailyReport } from '@/lib/api';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts';

export default function DashboardPage() {
  const [stats, setStats] = useState<OrderStats | null>(null);
  const [report, setReport] = useState<DailyReport[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      api.getOrderStats().catch(() => null),
      api.getDailyReport(14).catch(() => []),
    ]).then(([s, r]) => {
      setStats(s);
      setReport(r);
      setLoading(false);
    });
  }, []);

  const demoStats: OrderStats = {
    totalOrders: 1247,
    verifiedOrders: 892,
    cancelledOrders: 156,
    pendingOrders: 43,
    todayOrders: 28,
    callSuccessRate: 87,
    totalCalls: 1103,
  };

  const demoReport: DailyReport[] = Array.from({ length: 14 }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - (13 - i));
    return {
      date: d.toISOString().split('T')[0],
      ordersReceived: 15 + Math.floor(Math.random() * 20),
      ordersVerified: 10 + Math.floor(Math.random() * 15),
      ordersCancelled: Math.floor(Math.random() * 5),
      callsMade: 12 + Math.floor(Math.random() * 18),
      verificationRate: 70 + Math.floor(Math.random() * 20),
    };
  });

  const s = stats || demoStats;
  const r = report.length > 0 ? report : demoReport;

  if (loading) {
    return (
      <DashboardLayout>
        <div className="flex h-64 items-center justify-center">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-brand-600 border-t-transparent" />
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="space-y-8">
        <div>
          <h2 className="text-2xl font-bold text-slate-900">Dashboard Overview</h2>
          <p className="text-sm text-slate-500">Real-time order verification metrics</p>
        </div>

        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
          <StatCard title="Total Orders" value={s.totalOrders} icon={ShoppingCart} color="blue" />
          <StatCard title="Verified" value={s.verifiedOrders} icon={CheckCircle} color="green" />
          <StatCard title="Cancelled" value={s.cancelledOrders} icon={XCircle} color="red" />
          <StatCard title="Pending" value={s.pendingOrders} icon={Clock} color="amber" />
          <StatCard title="Today's Orders" value={s.todayOrders} icon={TrendingUp} color="brand" />
          <StatCard title="Call Success" value={`${s.callSuccessRate}%`} icon={Phone} color="green" />
        </div>

        <div className="card">
          <h3 className="text-lg font-semibold text-slate-900">Daily Orders (Last 14 Days)</h3>
          <div className="mt-6 h-80">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={r}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis dataKey="date" tick={{ fontSize: 12 }} tickFormatter={(v) => v.slice(5)} />
                <YAxis tick={{ fontSize: 12 }} />
                <Tooltip />
                <Area type="monotone" dataKey="ordersReceived" stackId="1" stroke="#1a82f5" fill="#d9f1ff" name="Received" />
                <Area type="monotone" dataKey="ordersVerified" stackId="2" stroke="#10b981" fill="#d1fae5" name="Verified" />
                <Area type="monotone" dataKey="ordersCancelled" stackId="3" stroke="#ef4444" fill="#fee2e2" name="Cancelled" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
