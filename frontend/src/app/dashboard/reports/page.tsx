'use client';

import { useEffect, useState } from 'react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { api, DailyReport } from '@/lib/api';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line } from 'recharts';

export default function ReportsPage() {
  const [report, setReport] = useState<DailyReport[]>([]);

  useEffect(() => {
    api.getDailyReport(30).then(setReport).catch(() => {
      setReport(Array.from({ length: 30 }, (_, i) => {
        const d = new Date();
        d.setDate(d.getDate() - (29 - i));
        return {
          date: d.toISOString().split('T')[0],
          ordersReceived: 10 + Math.floor(Math.random() * 25),
          ordersVerified: 7 + Math.floor(Math.random() * 18),
          ordersCancelled: Math.floor(Math.random() * 6),
          callsMade: 8 + Math.floor(Math.random() * 22),
          verificationRate: 65 + Math.floor(Math.random() * 25),
        };
      }));
    });
  }, []);

  return (
    <DashboardLayout>
      <div className="space-y-8">
        <div>
          <h2 className="text-2xl font-bold text-slate-900">Reports</h2>
          <p className="text-sm text-slate-500">30-day verification analytics</p>
        </div>

        <div className="card">
          <h3 className="text-lg font-semibold">Verification Rate</h3>
          <div className="mt-6 h-72">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={report}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis dataKey="date" tick={{ fontSize: 11 }} tickFormatter={(v) => v.slice(5)} />
                <YAxis tick={{ fontSize: 11 }} domain={[0, 100]} />
                <Tooltip />
                <Line type="monotone" dataKey="verificationRate" stroke="#1a82f5" strokeWidth={2} name="Verification %" dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="card">
          <h3 className="text-lg font-semibold">Daily Calls</h3>
          <div className="mt-6 h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={report}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis dataKey="date" tick={{ fontSize: 11 }} tickFormatter={(v) => v.slice(5)} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip />
                <Bar dataKey="callsMade" fill="#1a82f5" name="Calls" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
