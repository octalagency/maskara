'use client';

import { useEffect, useState } from 'react';
import { CheckCircle, Clock, Filter } from 'lucide-react';
import { api, BillingRecord } from '@/lib/api';
import { DEMO_BILLING_RECORDS } from '@/lib/demo-data';
import { formatCurrency } from '@/lib/utils';

export default function AdminBillingPage() {
  const [records, setRecords] = useState<BillingRecord[]>(DEMO_BILLING_RECORDS);
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [loading, setLoading] = useState<string | null>(null);

  useEffect(() => {
    const params = statusFilter ? { status: statusFilter } : undefined;
    api.getAdminBilling(params).then((res) => {
      if (res.records?.length) setRecords(res.records);
    }).catch(() => {});
  }, [statusFilter]);

  async function confirmPayment(id: string) {
    const ref = prompt('Payment reference (bKash/Nagad trx ID):');
    if (!ref) return;
    setLoading(id);
    try {
      await api.confirmBilling(id, ref);
      setRecords((prev) => prev.map((r) => (r.id === id ? { ...r, status: 'PAID', paymentRef: ref } : r)));
    } catch {
      alert('Confirm failed');
    } finally {
      setLoading(null);
    }
  }

  const pending = records.filter((r) => r.status === 'PENDING').length;
  const paid = records.filter((r) => r.status === 'PAID').length;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-2xl font-bold text-slate-900">Billing & Payments</h2>
          <p className="text-sm text-slate-500">Merchant পেমেন্ট দেখুন ও confirm করুন (bKash/Nagad)</p>
        </div>
        <div className="flex items-center gap-2">
          <Filter className="h-4 w-4 text-slate-400" />
          <select className="input w-auto" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
            <option value="">All</option>
            <option value="PENDING">Pending</option>
            <option value="PAID">Paid</option>
          </select>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <div className="card text-center">
          <p className="text-2xl font-bold text-amber-600">{pending}</p>
          <p className="text-sm text-slate-500">Pending</p>
        </div>
        <div className="card text-center">
          <p className="text-2xl font-bold text-emerald-600">{paid}</p>
          <p className="text-sm text-slate-500">Paid</p>
        </div>
        <div className="card text-center">
          <p className="text-2xl font-bold text-slate-900">{records.length}</p>
          <p className="text-sm text-slate-500">Total Records</p>
        </div>
      </div>

      <div className="card overflow-hidden p-0">
        <table className="w-full text-left text-sm">
          <thead className="border-b bg-slate-50">
            <tr>
              <th className="px-6 py-3 font-medium text-slate-500">Merchant</th>
              <th className="px-6 py-3 font-medium text-slate-500">Plan</th>
              <th className="px-6 py-3 font-medium text-slate-500">Amount</th>
              <th className="px-6 py-3 font-medium text-slate-500">Method</th>
              <th className="px-6 py-3 font-medium text-slate-500">Status</th>
              <th className="px-6 py-3 font-medium text-slate-500">Date</th>
              <th className="px-6 py-3 font-medium text-slate-500">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {records.map((r) => (
              <tr key={r.id} className="hover:bg-slate-50">
                <td className="px-6 py-4">
                  <p className="font-medium">{r.merchant?.name || r.merchantId}</p>
                  <p className="text-xs text-slate-500">{r.merchant?.email}</p>
                </td>
                <td className="px-6 py-4"><span className="badge-info">{r.planCode}</span></td>
                <td className="px-6 py-4 font-medium">{formatCurrency(Number(r.amount))}</td>
                <td className="px-6 py-4">{r.paymentMethod || '—'}</td>
                <td className="px-6 py-4">
                  <span className={r.status === 'PAID' ? 'badge-success' : 'badge-warning'}>
                    {r.status === 'PAID' ? <CheckCircle className="mr-1 inline h-3 w-3" /> : <Clock className="mr-1 inline h-3 w-3" />}
                    {r.status}
                  </span>
                </td>
                <td className="px-6 py-4 text-slate-500">{new Date(r.createdAt).toLocaleDateString('bn-BD')}</td>
                <td className="px-6 py-4">
                  {r.status === 'PENDING' && (
                    <button
                      onClick={() => confirmPayment(r.id)}
                      disabled={loading === r.id}
                      className="text-sm font-medium text-emerald-600 hover:text-emerald-700 disabled:opacity-50"
                    >
                      {loading === r.id ? '...' : 'Confirm Payment'}
                    </button>
                  )}
                  {r.paymentRef && <span className="text-xs text-slate-400">{r.paymentRef}</span>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
