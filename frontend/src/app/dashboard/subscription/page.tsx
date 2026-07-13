'use client';

import { useEffect, useState } from 'react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { CheckCircle2, CreditCard, Zap } from 'lucide-react';
import { api, MerchantSubscription } from '@/lib/api';
import { formatCurrency } from '@/lib/utils';

export default function SubscriptionPage() {
  const [data, setData] = useState<MerchantSubscription | null>(null);
  const [loading, setLoading] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [paymentInfo, setPaymentInfo] = useState<{ bKash?: string; nagad?: string; amount: number; reference: string } | null>(null);

  useEffect(() => {
    api.getMySubscription().then(setData).catch(() => {});
  }, []);

  async function payOnline(planCode: string, provider: 'bkash' | 'nagad') {
    setLoading(`${planCode}-${provider}`);
    setMessage(null);
    try {
      const res = await api.initiatePayment(planCode, provider);
      setMessage(res.message);
      if (res.paymentUrl) {
        window.location.href = res.paymentUrl;
      }
    } catch {
      alert(`${provider} payment start হয়নি। Login check করুন।`);
    } finally {
      setLoading(null);
    }
  }

  async function subscribe(planCode: string) {
    if (!confirm(`${planCode} প্ল্যানে সাবস্ক্রাইব করতে চান?`)) return;
    setLoading(planCode);
    setMessage(null);
    try {
      const res = await api.subscribeToPlan(planCode);
      setMessage(res.message);
      if (res.paymentInstructions) setPaymentInfo(res.paymentInstructions);
      const updated = await api.getMySubscription();
      setData(updated);
    } catch {
      alert('Subscribe failed. Login check করুন।');
    } finally {
      setLoading(null);
    }
  }

  if (!data) {
    return (
      <DashboardLayout>
        <div className="py-16 text-center text-slate-500">Subscription load হচ্ছে...</div>
      </DashboardLayout>
    );
  }

  const usage = data.usage;
  const usagePct = usage ? Math.round((usage.callsUsed / usage.callLimit) * 100) : 0;

  return (
    <DashboardLayout>
      <div className="space-y-8">
        <div>
          <h2 className="text-2xl font-bold text-slate-900">Subscription & Billing</h2>
          <p className="text-sm text-slate-500">আপনার প্ল্যান, ব্যবহার ও মাসিক পেমেন্ট</p>
        </div>

        {message && (
          <div className="rounded-lg bg-brand-50 p-4 text-sm text-brand-800">
            {message}
            {paymentInfo && (
              <div className="mt-3 rounded border border-brand-200 bg-white p-3">
                {paymentInfo.bKash && <p><strong>bKash:</strong> {paymentInfo.bKash}</p>}
                {paymentInfo.nagad && <p><strong>Nagad:</strong> {paymentInfo.nagad}</p>}
                <p><strong>Amount:</strong> {formatCurrency(paymentInfo.amount)}</p>
                <p><strong>Reference:</strong> {paymentInfo.reference}</p>
              </div>
            )}
          </div>
        )}

        <div className="grid gap-6 lg:grid-cols-3">
          <div className="card lg:col-span-1">
            <div className="flex items-center gap-2">
              <Zap className="h-5 w-5 text-brand-600" />
              <h3 className="font-semibold">Current Plan</h3>
            </div>
            <p className="mt-3 text-3xl font-bold">{data.merchant.subscriptionPlan}</p>
            {data.currentPlan && (
              <p className="text-lg text-slate-600">{formatCurrency(Number(data.currentPlan.priceMonthly))}/মাস</p>
            )}
            {data.merchant.subscriptionEnds && (
              <p className="mt-2 text-sm text-slate-500">
                Valid until: {new Date(data.merchant.subscriptionEnds).toLocaleDateString('bn-BD')}
              </p>
            )}
            <span className={`mt-3 inline-block ${data.merchant.status === 'ACTIVE' ? 'badge-success' : 'badge-warning'}`}>
              {data.merchant.status}
            </span>
          </div>

          {usage && (
            <div className="card lg:col-span-2">
              <h3 className="font-semibold">Usage This Month</h3>
              <div className="mt-4 space-y-4">
                <div>
                  <div className="flex justify-between text-sm">
                    <span>Calls: {usage.callsUsed} / {usage.callLimit}</span>
                    <span>{usagePct}%</span>
                  </div>
                  <div className="mt-1 h-2 rounded-full bg-slate-100">
                    <div className="h-2 rounded-full bg-brand-600" style={{ width: `${Math.min(usagePct, 100)}%` }} />
                  </div>
                  <p className="mt-1 text-xs text-slate-500">{usage.callsRemaining} calls remaining</p>
                </div>
                <div>
                  <div className="flex justify-between text-sm">
                    <span>SMS: {usage.smsUsed} / {usage.smsLimit}</span>
                  </div>
                  <div className="mt-1 h-2 rounded-full bg-slate-100">
                    <div
                      className="h-2 rounded-full bg-emerald-500"
                      style={{ width: `${Math.min(Math.round((usage.smsUsed / usage.smsLimit) * 100), 100)}%` }}
                    />
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        <div>
          <h3 className="text-lg font-semibold">Upgrade Plan</h3>
          <p className="text-sm text-slate-500">মাসিক চার্জ — bKash/Nagad দিয়ে পেমেন্ট করুন</p>
          <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {data.availablePlans.map((plan) => {
              const isCurrent = plan.code === data.merchant.subscriptionPlan;
              const features = Array.isArray(plan.features) ? plan.features : [];
              return (
                <div
                  key={plan.id}
                  className={`card flex flex-col ${plan.isPopular ? 'ring-2 ring-brand-500' : ''} ${isCurrent ? 'bg-brand-50' : ''}`}
                >
                  <h4 className="font-bold">{plan.name}</h4>
                  <p className="text-2xl font-bold mt-2">{formatCurrency(Number(plan.priceMonthly))}<span className="text-sm font-normal">/mo</span></p>
                  <p className="text-sm text-slate-500 mt-1">{plan.callLimit} calls · {plan.smsLimit} SMS</p>
                  <ul className="mt-3 flex-1 space-y-1 text-xs text-slate-600">
                    {features.slice(0, 3).map((f) => (
                      <li key={String(f)} className="flex gap-1"><CheckCircle2 className="h-3 w-3 text-brand-600 shrink-0 mt-0.5" />{String(f)}</li>
                    ))}
                  </ul>
                  <div className="mt-4 flex flex-col gap-2">
                    {isCurrent ? (
                      <button disabled className="btn-secondary w-full opacity-50">Current Plan</button>
                    ) : Number(plan.priceMonthly) > 0 ? (
                      <>
                        <button
                          onClick={() => payOnline(plan.code, 'bkash')}
                          disabled={!!loading}
                          className="btn-primary w-full text-sm"
                        >
                          {loading === `${plan.code}-bkash` ? '...' : 'bKash Pay'}
                        </button>
                        <button
                          onClick={() => payOnline(plan.code, 'nagad')}
                          disabled={!!loading}
                          className="btn-secondary w-full text-sm"
                        >
                          {loading === `${plan.code}-nagad` ? '...' : 'Nagad Pay'}
                        </button>
                        <button
                          onClick={() => subscribe(plan.code)}
                          disabled={!!loading}
                          className="text-xs text-slate-500 hover:text-brand-600"
                        >
                          Manual payment request
                        </button>
                      </>
                    ) : (
                      <button
                        onClick={() => subscribe(plan.code)}
                        disabled={loading === plan.code}
                        className="btn-primary w-full"
                      >
                        {loading === plan.code ? 'Processing...' : 'Subscribe Free'}
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {data.billingHistory.length > 0 && (
          <div className="card">
            <div className="flex items-center gap-2">
              <CreditCard className="h-5 w-5 text-slate-400" />
              <h3 className="font-semibold">Billing History</h3>
            </div>
            <table className="mt-4 w-full text-left text-sm">
              <thead className="border-b">
                <tr>
                  <th className="py-2 font-medium text-slate-500">Plan</th>
                  <th className="py-2 font-medium text-slate-500">Amount</th>
                  <th className="py-2 font-medium text-slate-500">Status</th>
                  <th className="py-2 font-medium text-slate-500">Date</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {data.billingHistory.map((b) => (
                  <tr key={b.id}>
                    <td className="py-2">{b.planCode}</td>
                    <td className="py-2">{formatCurrency(Number(b.amount))}</td>
                    <td className="py-2"><span className={b.status === 'PAID' ? 'badge-success' : 'badge-warning'}>{b.status}</span></td>
                    <td className="py-2 text-slate-500">{new Date(b.createdAt).toLocaleDateString('bn-BD')}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
