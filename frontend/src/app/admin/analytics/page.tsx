'use client';

import { useEffect, useState } from 'react';
import { Phone, CheckCircle, XCircle } from 'lucide-react';
import { StatCard } from '@/components/ui/StatCard';
import { PieChart, Pie, Cell, ResponsiveContainer } from 'recharts';
import { api, AdminCallAnalytics } from '@/lib/api';

const EMPTY_ANALYTICS: AdminCallAnalytics = {
  total: 0,
  completed: 0,
  confirmed: 0,
  successRate: 0,
  confirmationRate: 0,
};

export default function AdminAnalyticsPage() {
  const [stats, setStats] = useState<AdminCallAnalytics>(EMPTY_ANALYTICS);

  useEffect(() => {
    api.getAdminCallAnalytics(30).then(setStats).catch(() => setStats(EMPTY_ANALYTICS));
  }, []);

  const outcomeData = [
    { name: 'Confirmed', value: stats.confirmationRate, color: '#10b981' },
    { name: 'Other', value: Math.max(0, 100 - stats.confirmationRate), color: '#94a3b8' },
  ];

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-2xl font-bold text-slate-900">Call Analytics</h2>
        <p className="text-sm text-slate-500">সম্পূর্ণ প্ল্যাটফর্মের call performance (last 30 days)</p>
      </div>

      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard title="Total Calls" value={stats.total.toLocaleString()} icon={Phone} color="brand" />
        <StatCard title="Success Rate" value={`${stats.successRate}%`} icon={CheckCircle} color="green" />
        <StatCard title="Confirmed" value={`${stats.confirmationRate}%`} icon={CheckCircle} color="green" />
        <StatCard title="Completed" value={stats.completed.toLocaleString()} icon={XCircle} color="blue" />
      </div>

      <div className="card">
        <h3 className="text-lg font-semibold">Confirmation Rate</h3>
        <div className="mt-6 h-72">
          {stats.total === 0 ? (
            <div className="flex h-full items-center justify-center text-slate-500">এখনো call data নেই।</div>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={outcomeData} cx="50%" cy="50%" innerRadius={60} outerRadius={100} dataKey="value" label={({ name, value }) => `${name} ${value}%`}>
                  {outcomeData.map((entry, i) => (
                    <Cell key={i} fill={entry.color} />
                  ))}
                </Pie>
              </PieChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>
    </div>
  );
}
