'use client';

import { useEffect, useState } from 'react';
import { CreditCard, Users } from 'lucide-react';
import { StatCard } from '@/components/ui/StatCard';
import { api, AdminDashboard } from '@/lib/api';
import { formatCurrency } from '@/lib/utils';

interface PlanRow {
  plan: string;
  merchants: number;
  revenue: number;
}

const CALL_LIMITS: Record<string, string> = {
  FREE: '50',
  STARTER: '300',
  GROWTH: '1,000',
  ENTERPRISE: 'Unlimited',
};

export default function AdminSubscriptionsPage() {
  const [plans, setPlans] = useState<PlanRow[]>([]);
  const [totalMerchants, setTotalMerchants] = useState(156);

  useEffect(() => {
    api.getAdminDashboard().then((data) => {
      if (data.planDistribution?.length) {
        setPlans(data.planDistribution.map((p) => ({
          plan: p.plan,
          merchants: p.count,
          revenue: p.revenue,
        })));
      }
      setTotalMerchants(data.totalMerchants);
    }).catch(() => {});
  }, []);

  const totalRevenue = plans.reduce((s, p) => s + p.revenue, 0);
  const paidMerchants = plans.filter((p) => p.plan !== 'FREE').reduce((s, p) => s + p.merchants, 0);
  const trialMerchants = plans.find((p) => p.plan === 'FREE')?.merchants ?? 0;

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-2xl font-bold text-slate-900">Subscription Management</h2>
        <p className="text-sm text-slate-500">Plan distribution ও revenue tracking</p>
      </div>

      <div className="grid gap-6 sm:grid-cols-3">
        <StatCard title="Total Revenue" value={formatCurrency(totalRevenue)} icon={CreditCard} color="green" />
        <StatCard title="Paid Merchants" value={paidMerchants} icon={Users} color="blue" />
        <StatCard title="Total Merchants" value={totalMerchants} icon={Users} color="amber" />
      </div>

      <div className="card overflow-hidden p-0">
        <table className="w-full text-left text-sm">
          <thead className="border-b bg-slate-50">
            <tr>
              <th className="px-6 py-3 font-medium text-slate-500">Plan</th>
              <th className="px-6 py-3 font-medium text-slate-500">Merchants</th>
              <th className="px-6 py-3 font-medium text-slate-500">Monthly Revenue</th>
              <th className="px-6 py-3 font-medium text-slate-500">Calls/mo Limit</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {plans.map((p) => (
              <tr key={p.plan} className="hover:bg-slate-50">
                <td className="px-6 py-4"><span className="badge-info">{p.plan}</span></td>
                <td className="px-6 py-4 font-medium">{p.merchants}</td>
                <td className="px-6 py-4">{formatCurrency(p.revenue)}</td>
                <td className="px-6 py-4">{CALL_LIMITS[p.plan] ?? '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
