'use client';

import { useEffect, useState } from 'react';
import { Phone, CheckCircle, XCircle } from 'lucide-react';
import { StatCard } from '@/components/ui/StatCard';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { api, AdminCallAnalytics } from '@/lib/api';

const dailyData = [
  { day: 'Mon', calls: 420, success: 365 },
  { day: 'Tue', calls: 380, success: 330 },
  { day: 'Wed', calls: 510, success: 445 },
  { day: 'Thu', calls: 490, success: 420 },
  { day: 'Fri', calls: 620, success: 540 },
  { day: 'Sat', calls: 710, success: 610 },
  { day: 'Sun', calls: 340, success: 290 },
];

const DEMO: AdminCallAnalytics = {
  total: 3470,
  completed: 2985,
  confirmed: 2150,
  successRate: 86,
  confirmationRate: 62,
};

export default function AdminAnalyticsPage() {
  const [stats, setStats] = useState<AdminCallAnalytics>(DEMO);

  useEffect(() => {
    api.getAdminCallAnalytics(30).then(setStats).catch(() => {});
  }, []);

  const outcomeData = [
    { name: 'Confirmed', value: stats.confirmationRate, color: '#10b981' },
    { name: 'Other', value: 100 - stats.confirmationRate, color: '#94a3b8' },
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

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="card">
          <h3 className="text-lg font-semibold">Daily Calls (Demo Chart)</h3>
          <div className="mt-6 h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={dailyData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis dataKey="day" />
                <YAxis />
                <Tooltip />
                <Bar dataKey="calls" fill="#d9f1ff" stroke="#1a82f5" name="Total Calls" radius={[4, 4, 0, 0]} />
                <Bar dataKey="success" fill="#1a82f5" name="Successful" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="card">
          <h3 className="text-lg font-semibold">Confirmation Rate</h3>
          <div className="mt-6 h-72">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={outcomeData} cx="50%" cy="50%" innerRadius={60} outerRadius={100} dataKey="value" label={({ name, value }) => `${name} ${value}%`}>
                  {outcomeData.map((entry, i) => (
                    <Cell key={i} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </div>
  );
}
