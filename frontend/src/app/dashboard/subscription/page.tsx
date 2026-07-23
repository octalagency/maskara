'use client';

import { useEffect, useState } from 'react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { CheckCircle2, CreditCard, Zap } from 'lucide-react';
import { api, MerchantSubscription } from '@/lib/api';
import { formatCurrency } from '@/lib/utils';

export default function SubscriptionPage() {
  const [data, setData] = useState<MerchantSubscription | null>(null);
  const [loadError, setLoadError] = useState('');
  const [loading, setLoading] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [payPlan, setPayPlan] = useState<string | null>(null);
  const [trxId, setTrxId] = useState('');
  const [senderPhone, setSenderPhone] = useState('');
  const [amount, setAmount] = useState('');

  async function load() {
    setLoadError('');
    try {
      const res = await api.getMySubscription();
      setData(res);
    } catch (err) {
      setData(null);
      setLoadError(
        err instanceof Error
          ? err.message
          : 'Subscription load হয়নি — আবার login করুন',
      );
    }
  }

  useEffect(() => {
    void load();
  }, []);

  function openPayForm(planCode: string, planAmount: number) {
    setPayPlan(planCode);
    setAmount(String(Math.round(planAmount)));
    setTrxId('');
    setSenderPhone('');
    setMessage(null);
  }

  async function submitBkashManual(e: React.FormEvent) {
    e.preventDefault();
    if (!payPlan) return;
    setLoading(payPlan);
    setMessage(null);
    try {
      const res = await api.submitBkashManual({
        planCode: payPlan,
        trxId,
        senderPhone,
        amount: Number(amount),
      });
      setMessage(res.message);
      setPayPlan(null);
      await load();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Payment submit failed');
    } finally {
      setLoading(null);
    }
  }

  async function subscribeFree(planCode: string) {
    setLoading(planCode);
    try {
      await api.subscribeToPlan(planCode, 'trial');
      setMessage('Free trial activated');
      await load();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Subscribe failed');
    } finally {
      setLoading(null);
    }
  }

  if (loadError && !data) {
    return (
      <DashboardLayout>
        <div className="rounded-xl bg-red-50 px-4 py-8 text-center text-red-700">
          {loadError}
          <div className="mt-3">
            <button type="button" className="btn-primary" onClick={() => void load()}>
              Retry
            </button>
          </div>
        </div>
      </DashboardLayout>
    );
  }

  if (!data) {
    return (
      <DashboardLayout>
        <div className="py-16 text-center text-slate-500">Subscription load হচ্ছে...</div>
      </DashboardLayout>
    );
  }

  const usage = data.usage;
  const usagePct = usage
    ? Math.round((usage.callsUsed / usage.callLimit) * 100)
    : 0;
  const bKashNumber = data.payment?.bKashNumber || '';

  return (
    <DashboardLayout>
      <div className="space-y-8">
        <div>
          <h2 className="text-2xl font-bold text-slate-900">Subscription & Billing</h2>
          <p className="text-sm text-slate-500">
            প্ল্যান, ব্যবহার ও bKash Send Money পেমেন্ট
          </p>
        </div>

        {message && (
          <div className="rounded-lg bg-brand-50 p-4 text-sm text-brand-800">
            {message}
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
              <p className="text-lg text-slate-600">
                {formatCurrency(Number(data.currentPlan.priceMonthly))}/মাস
              </p>
            )}
            {data.merchant.subscriptionEnds && (
              <p className="mt-2 text-sm text-slate-500">
                Valid until:{' '}
                {new Date(data.merchant.subscriptionEnds).toLocaleDateString('bn-BD')}
              </p>
            )}
            <span
              className={`mt-3 inline-block ${
                data.merchant.status === 'ACTIVE' ? 'badge-success' : 'badge-warning'
              }`}
            >
              {data.merchant.status}
            </span>
          </div>

          {usage && (
            <div className="card lg:col-span-2">
              <h3 className="font-semibold">Usage This Month</h3>
              <div className="mt-4 space-y-4">
                <div>
                  <div className="flex justify-between text-sm">
                    <span>
                      Calls: {usage.callsUsed} / {usage.callLimit}
                    </span>
                    <span>{usagePct}%</span>
                  </div>
                  <div className="mt-1 h-2 rounded-full bg-slate-100">
                    <div
                      className="h-2 rounded-full bg-brand-600"
                      style={{ width: `${Math.min(usagePct, 100)}%` }}
                    />
                  </div>
                  <p className="mt-1 text-xs text-slate-500">
                    {usage.callsRemaining} calls remaining
                  </p>
                </div>
                <div>
                  <div className="flex justify-between text-sm">
                    <span>
                      SMS: {usage.smsUsed} / {usage.smsLimit}
                    </span>
                  </div>
                  <div className="mt-1 h-2 rounded-full bg-slate-100">
                    <div
                      className="h-2 rounded-full bg-emerald-500"
                      style={{
                        width: `${Math.min(
                          Math.round((usage.smsUsed / Math.max(usage.smsLimit, 1)) * 100),
                          100,
                        )}%`,
                      }}
                    />
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="card border-[#E2136E]/30 bg-[#E2136E]/5">
          <h3 className="font-semibold text-[#E2136E]">bKash Send Money (non-API)</h3>
          <p className="mt-1 text-sm text-slate-600">
            নিচের নম্বরে Send Money করুন, তারপর TrxID + আপনার নম্বর + অ্যামাউন্ট সাবমিট
            করুন। Admin মিলিয়ে Paid করবে।
          </p>
          {bKashNumber ? (
            <p className="mt-3 text-2xl font-bold tracking-wide text-slate-900">
              {bKashNumber}
            </p>
          ) : (
            <p className="mt-3 text-sm text-amber-700">
              bKash নম্বর এখনো সেট হয়নি — admin Payment Gateway থেকে সেট করুন।
            </p>
          )}
          {data.payment?.instructions && (
            <p className="mt-2 text-xs text-slate-500">{data.payment.instructions}</p>
          )}
        </div>

        <div>
          <h3 className="text-lg font-semibold">Upgrade Plan</h3>
          <p className="text-sm text-slate-500">
            bKash Send Money → TrxID সাবমিট → Paid
          </p>
          <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {data.availablePlans.map((plan) => {
              const isCurrent = plan.code === data.merchant.subscriptionPlan;
              const features = Array.isArray(plan.features) ? plan.features : [];
              const price = Number(plan.priceMonthly);
              return (
                <div
                  key={plan.id}
                  className={`card flex flex-col ${plan.isPopular ? 'ring-2 ring-brand-500' : ''} ${
                    isCurrent ? 'bg-brand-50' : ''
                  }`}
                >
                  <h4 className="font-bold">{plan.name}</h4>
                  <p className="mt-2 text-2xl font-bold">
                    {formatCurrency(price)}
                    <span className="text-sm font-normal">/mo</span>
                  </p>
                  <p className="mt-1 text-sm text-slate-500">
                    {plan.callLimit} calls · {plan.smsLimit} SMS
                  </p>
                  <ul className="mt-3 flex-1 space-y-1 text-xs text-slate-600">
                    {features.slice(0, 3).map((f) => (
                      <li key={String(f)} className="flex gap-1">
                        <CheckCircle2 className="mt-0.5 h-3 w-3 shrink-0 text-brand-600" />
                        {String(f)}
                      </li>
                    ))}
                  </ul>
                  <div className="mt-4">
                    {isCurrent ? (
                      <button disabled className="btn-secondary w-full opacity-50">
                        Current Plan
                      </button>
                    ) : price > 0 ? (
                      <button
                        type="button"
                        onClick={() => openPayForm(plan.code, price)}
                        disabled={!!loading}
                        className="btn-primary w-full text-sm"
                      >
                        bKash দিয়ে পেমেন্ট
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={() => subscribeFree(plan.code)}
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

        {payPlan && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
            <form
              onSubmit={submitBkashManual}
              className="w-full max-w-md rounded-xl bg-white p-6 shadow-xl"
            >
              <h3 className="text-lg font-bold">bKash পেমেন্ট প্রুফ</h3>
              <p className="mt-1 text-sm text-slate-500">
                Plan: <strong>{payPlan}</strong>
                {bKashNumber ? (
                  <>
                    {' '}
                    · Send Money: <strong>{bKashNumber}</strong>
                  </>
                ) : null}
              </p>
              <div className="mt-4 space-y-3">
                <div>
                  <label className="text-sm font-medium text-slate-700">TrxID</label>
                  <input
                    className="input mt-1"
                    value={trxId}
                    onChange={(e) => setTrxId(e.target.value)}
                    placeholder="bKash transaction ID"
                    required
                  />
                </div>
                <div>
                  <label className="text-sm font-medium text-slate-700">
                    আপনার bKash নম্বর
                  </label>
                  <input
                    className="input mt-1"
                    value={senderPhone}
                    onChange={(e) => setSenderPhone(e.target.value)}
                    placeholder="01XXXXXXXXX"
                    required
                  />
                </div>
                <div>
                  <label className="text-sm font-medium text-slate-700">Amount (৳)</label>
                  <input
                    className="input mt-1"
                    type="number"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    required
                  />
                </div>
              </div>
              <div className="mt-6 flex gap-2">
                <button
                  type="submit"
                  className="btn-primary flex-1"
                  disabled={!!loading}
                >
                  {loading ? 'Submitting...' : 'Submit for verification'}
                </button>
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={() => setPayPlan(null)}
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        )}

        <div className="card">
          <div className="flex items-center gap-2">
            <CreditCard className="h-5 w-5 text-slate-400" />
            <h3 className="font-semibold">Billing History</h3>
          </div>
          {data.billingHistory.length === 0 ? (
            <p className="mt-4 text-sm text-slate-500">এখনো কোনো billing নেই</p>
          ) : (
            <table className="mt-4 w-full text-left text-sm">
              <thead className="border-b">
                <tr>
                  <th className="py-2 font-medium text-slate-500">Plan</th>
                  <th className="py-2 font-medium text-slate-500">Amount</th>
                  <th className="py-2 font-medium text-slate-500">TrxID</th>
                  <th className="py-2 font-medium text-slate-500">Status</th>
                  <th className="py-2 font-medium text-slate-500">Date</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {data.billingHistory.map((b) => (
                  <tr key={b.id}>
                    <td className="py-2">{b.planCode}</td>
                    <td className="py-2">{formatCurrency(Number(b.amount))}</td>
                    <td className="py-2 font-mono text-xs">{b.paymentRef || '—'}</td>
                    <td className="py-2">
                      <span
                        className={
                          b.status === 'PAID'
                            ? 'badge-success'
                            : b.status === 'FAILED'
                              ? 'badge-danger'
                              : 'badge-warning'
                        }
                      >
                        {b.status}
                      </span>
                    </td>
                    <td className="py-2 text-slate-500">
                      {new Date(b.createdAt).toLocaleDateString('bn-BD')}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </DashboardLayout>
  );
}
