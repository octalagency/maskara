'use client';

import { useEffect, useState } from 'react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { api, Call } from '@/lib/api';
import { formatDate, getStatusBadge } from '@/lib/utils';
import { Phone, Play } from 'lucide-react';

const demoCalls: Call[] = [
  { id: '1', status: 'COMPLETED', outcome: 'CONFIRMED', dtmfInput: '1', duration: 18, createdAt: new Date().toISOString(), order: { orderNumber: 'ORD-1234', customerName: 'রহিম আহমেদ' } },
  { id: '2', status: 'COMPLETED', outcome: 'CANCELLED', dtmfInput: '2', duration: 22, createdAt: new Date().toISOString(), order: { orderNumber: 'ORD-1235', customerName: 'করিম হাসান' } },
  { id: '3', status: 'NO_ANSWER', outcome: undefined, duration: 0, createdAt: new Date().toISOString(), order: { orderNumber: 'ORD-1236', customerName: 'ফাতেমা বেগম' } },
  { id: '4', status: 'COMPLETED', outcome: 'ESCALATED', dtmfInput: '0', duration: 15, createdAt: new Date().toISOString(), order: { orderNumber: 'ORD-1237', customerName: 'সাকিব আলী' } },
];

export default function CallsPage() {
  const [calls, setCalls] = useState<Call[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.getCalls().then((res) => setCalls(res.calls)).catch(() => setCalls(demoCalls)).finally(() => setLoading(false));
  }, []);

  const displayCalls = calls.length > 0 ? calls : demoCalls;

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h2 className="text-2xl font-bold text-slate-900">Call History</h2>
          <p className="text-sm text-slate-500">All verification calls and recordings</p>
        </div>

        <div className="card overflow-hidden p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-slate-200 bg-slate-50">
                <tr>
                  <th className="px-6 py-3 font-medium text-slate-500">Order</th>
                  <th className="px-6 py-3 font-medium text-slate-500">Customer</th>
                  <th className="px-6 py-3 font-medium text-slate-500">Status</th>
                  <th className="px-6 py-3 font-medium text-slate-500">Outcome</th>
                  <th className="px-6 py-3 font-medium text-slate-500">DTMF</th>
                  <th className="px-6 py-3 font-medium text-slate-500">Duration</th>
                  <th className="px-6 py-3 font-medium text-slate-500">Date</th>
                  <th className="px-6 py-3 font-medium text-slate-500">Recording</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {displayCalls.map((call) => (
                  <tr key={call.id} className="hover:bg-slate-50">
                    <td className="px-6 py-4 font-medium">{call.order?.orderNumber}</td>
                    <td className="px-6 py-4">{call.order?.customerName}</td>
                    <td className="px-6 py-4"><span className={getStatusBadge(call.status)}>{call.status}</span></td>
                    <td className="px-6 py-4">{call.outcome || '-'}</td>
                    <td className="px-6 py-4">
                      {call.dtmfInput ? (
                        <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-brand-100 text-sm font-bold text-brand-700">
                          {call.dtmfInput}
                        </span>
                      ) : '-'}
                    </td>
                    <td className="px-6 py-4">{call.duration ? `${call.duration}s` : '-'}</td>
                    <td className="px-6 py-4 text-slate-500">{formatDate(call.createdAt)}</td>
                    <td className="px-6 py-4">
                      {call.recordingUrl ? (
                        <a href={call.recordingUrl} target="_blank" className="text-brand-600 hover:text-brand-700">
                          <Play className="h-4 w-4" />
                        </a>
                      ) : (
                        <Phone className="h-4 w-4 text-slate-300" />
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
