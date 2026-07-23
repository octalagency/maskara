'use client';

import { useEffect, useState } from 'react';
import { CheckCircle, Clock, Filter, ExternalLink, XCircle } from 'lucide-react';
import { api, BillingRecord } from '@/lib/api';
import { formatCurrency } from '@/lib/utils';

function parseNotes(notes?: string | null): {
  senderPhone?: string;
  submittedAmount?: number;
  raw?: string;
} {
  if (!notes) return {};
  try {
    const j = JSON.parse(notes) as {
      senderPhone?: string;
      submittedAmount?: number;
    };
    if (j && (j.senderPhone || j.submittedAmount != null)) return j;
  } catch {
    /* plain text */
  }
  return { raw: notes };
}

export default function AdminBillingPage() {
  const [records, setRecords] = useState<BillingRecord[]>([]);
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [loading, setLoading] = useState<string | null>(null);
  const [loadError, setLoadError] = useState('');

  async function load() {
    setLoadError('');
    try {
      const params: Record<string, string> = { limit: '100' };
      if (statusFilter) params.status = statusFilter;
      const res = await api.getAdminBilling(params);
      setRecords(res.records ?? []);
    } catch (err) {
      setRecords([]);
      setLoadError(
        err instanceof Error ? err.message : 'Billing load হয়নি',
      );
    }
  }

  useEffect(() => {
    void load();
  }, [statusFilter]);

  async function confirmPayment(r: BillingRecord) {
    const meta = parseNotes(r.notes);
    const defaultRef = r.paymentRef || '';
    const ref =
      prompt(
        `Confirm Paid — TrxID মিলিয়ে দিন\nMerchant: ${r.merchant?.name}\nAmount: ${formatCurrency(Number(r.amount))}\nPhone: ${meta.senderPhone || '—'}\nSubmitted TrxID:`,
        defaultRef,
      ) || '';
    if (!ref.trim()) return;
    setLoading(r.id);
    try {
      await api.confirmBilling(r.id, ref.trim());
      setRecords((prev) =>
        prev.map((x) =>
          x.id === r.id ? { ...x, status: 'PAID', paymentRef: ref.trim() } : x,
        ),
      );
    } catch {
      alert('Confirm failed');
    } finally {
      setLoading(null);
    }
  }

  async function rejectPayment(id: string) {
    const reason = prompt('Reject reason (optional):') ?? '';
    setLoading(id);
    try {
      await api.rejectBilling(id, reason || undefined);
      setRecords((prev) =>
        prev.map((x) => (x.id === id ? { ...x, status: 'FAILED' } : x)),
      );
    } catch {
      alert('Reject failed');
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
          <p className="text-sm text-slate-500">
            bKash TrxID / নম্বর / অ্যামাউন্ট মিলিয়ে Paid করুন
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <a
            href="https://merchantportal.bkash.com/login"
            target="_blank"
            rel="noreferrer"
            className="btn-secondary inline-flex items-center gap-1 text-sm"
          >
            <ExternalLink className="h-3.5 w-3.5" /> bKash Portal
          </a>
          <Filter className="h-4 w-4 text-slate-400" />
          <select
            className="input w-auto"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
          >
            <option value="">All</option>
            <option value="PENDING">Pending</option>
            <option value="PAID">Paid</option>
            <option value="FAILED">Failed</option>
          </select>
        </div>
      </div>

      {loadError && (
        <div className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">
          {loadError}{' '}
          <button type="button" className="font-semibold underline" onClick={() => void load()}>
            Retry
          </button>
        </div>
      )}

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

      <div className="card overflow-x-auto p-0">
        <table className="w-full text-left text-sm">
          <thead className="border-b bg-slate-50">
            <tr>
              <th className="px-4 py-3 font-medium text-slate-500">Merchant</th>
              <th className="px-4 py-3 font-medium text-slate-500">Plan</th>
              <th className="px-4 py-3 font-medium text-slate-500">Amount</th>
              <th className="px-4 py-3 font-medium text-slate-500">TrxID</th>
              <th className="px-4 py-3 font-medium text-slate-500">Phone</th>
              <th className="px-4 py-3 font-medium text-slate-500">Method</th>
              <th className="px-4 py-3 font-medium text-slate-500">Status</th>
              <th className="px-4 py-3 font-medium text-slate-500">Date</th>
              <th className="px-4 py-3 font-medium text-slate-500">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {records.length === 0 ? (
              <tr>
                <td colSpan={9} className="px-4 py-10 text-center text-slate-500">
                  {loadError ? 'Load ব্যর্থ' : 'কোনো billing record নেই'}
                </td>
              </tr>
            ) : (
              records.map((r) => {
                const meta = parseNotes(r.notes);
                return (
                  <tr key={r.id} className="hover:bg-slate-50">
                    <td className="px-4 py-3">
                      <p className="font-medium">{r.merchant?.name || r.merchantId}</p>
                      <p className="text-xs text-slate-500">{r.merchant?.email}</p>
                    </td>
                    <td className="px-4 py-3">
                      <span className="badge-info">{r.planCode}</span>
                    </td>
                    <td className="px-4 py-3 font-medium">
                      {formatCurrency(Number(r.amount))}
                    </td>
                    <td className="px-4 py-3 font-mono text-xs">
                      {r.paymentRef || '—'}
                    </td>
                    <td className="px-4 py-3 text-xs">
                      {meta.senderPhone || '—'}
                    </td>
                    <td className="px-4 py-3">{r.paymentMethod || '—'}</td>
                    <td className="px-4 py-3">
                      <span
                        className={
                          r.status === 'PAID'
                            ? 'badge-success'
                            : r.status === 'FAILED'
                              ? 'badge-danger'
                              : 'badge-warning'
                        }
                      >
                        {r.status === 'PAID' ? (
                          <CheckCircle className="mr-1 inline h-3 w-3" />
                        ) : (
                          <Clock className="mr-1 inline h-3 w-3" />
                        )}
                        {r.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-slate-500">
                      {new Date(r.createdAt).toLocaleDateString('bn-BD')}
                    </td>
                    <td className="px-4 py-3">
                      {r.status === 'PENDING' && (
                        <div className="flex flex-col gap-1">
                          <button
                            onClick={() => confirmPayment(r)}
                            disabled={loading === r.id}
                            className="text-left text-sm font-medium text-emerald-600 hover:text-emerald-700 disabled:opacity-50"
                          >
                            {loading === r.id ? '...' : 'Confirm Paid'}
                          </button>
                          <button
                            onClick={() => rejectPayment(r.id)}
                            disabled={loading === r.id}
                            className="inline-flex items-center gap-0.5 text-left text-xs text-red-600"
                          >
                            <XCircle className="h-3 w-3" /> Reject
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
