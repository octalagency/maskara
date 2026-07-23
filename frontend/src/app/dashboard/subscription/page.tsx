'use client';

import { useEffect, useState } from 'react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { CheckCircle2, CreditCard, Zap, Loader2, Copy, Check } from 'lucide-react';
import { api, MerchantSubscription, Plan } from '@/lib/api';
import { formatCurrency } from '@/lib/utils';

type PayStep = 'form' | 'verifying' | 'paid' | 'error';

export default function SubscriptionPage() {
  const [data, setData] = useState<MerchantSubscription | null>(null);
  const [loadError, setLoadError] = useState('');
  const [loading, setLoading] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const [payPlan, setPayPlan] = useState<Plan | null>(null);
  const [trxId, setTrxId] = useState('');
  const [senderPhone, setSenderPhone] = useState('');
  const [payStep, setPayStep] = useState<PayStep>('form');
  const [payError, setPayError] = useState('');
  const [copied, setCopied] = useState(false);

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

  function openPayForm(plan: Plan) {
    setPayPlan(plan);
    setTrxId('');
    setSenderPhone('');
    setPayStep('form');
    setPayError('');
    setMessage(null);
  }

  function closePay() {
    setPayPlan(null);
    setPayStep('form');
    setPayError('');
    setLoading(null);
  }

  async function copyNumber(num: string) {
    try {
      await navigator.clipboard.writeText(num);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* ignore */
    }
  }

  async function verifyPaid(e: React.FormEvent) {
    e.preventDefault();
    if (!payPlan) return;

    const amount = Math.round(Number(payPlan.priceMonthly));
    setPayError('');
    setPayStep('verifying');
    setLoading(payPlan.code);

    const started = Date.now();
    try {
      const res = await api.submitBkashManual({
        planCode: payPlan.code,
        trxId,
        senderPhone,
        amount,
        autoVerify: true,
      });

      // Keep verifying UI at least ~3 seconds for bKash-like feel
      const wait = Math.max(0, 3000 - (Date.now() - started));
      await new Promise((r) => setTimeout(r, wait));

      if (res.status === 'PAID' || !res.status) {
        setPayStep('paid');
        setMessage(res.message || 'পেমেন্ট Paid হয়েছে');
        await load();
        setTimeout(() => closePay(), 1600);
      } else {
        setPayStep('form');
        setPayError(res.message || 'Pending — admin confirm করবে');
      }
    } catch (err) {
      const wait = Math.max(0, 3000 - (Date.now() - started));
      await new Promise((r) => setTimeout(r, wait));
      setPayStep('error');
      setPayError(err instanceof Error ? err.message : 'Verify failed');
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
  const hasPaidPlan =
    data.merchant.subscriptionPlan !== 'FREE' &&
    data.merchant.status === 'ACTIVE';

  return (
    <DashboardLayout>
      <div className="space-y-8">
        <div>
          <h2 className="text-2xl font-bold text-slate-900">Subscription & Billing</h2>
          <p className="text-sm text-slate-500">
            প্ল্যান, ব্যবহার ও bKash Merchant SIM পেমেন্ট
          </p>
        </div>

        {message && (
          <div className="rounded-lg bg-emerald-50 p-4 text-sm text-emerald-800">
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
            {usage && (
              <p className="mt-2 text-sm font-medium text-slate-700">
                মোট কোটা: {usage.callLimit.toLocaleString()} order confirmed
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
            <p className="mt-3 text-xs text-slate-500">
              প্ল্যান বদলাতে আবার পেমেন্ট করুন — কোটা যোগ হবে, আগেরটা কাটবে না।
            </p>
          </div>

          {usage && (
            <div className="card lg:col-span-2">
              <h3 className="font-semibold">Usage This Month</h3>
              <div className="mt-4 space-y-4">
                <div>
                  <div className="flex justify-between text-sm">
                    <span>
                      Order confirmed: {usage.callsUsed} / {usage.callLimit}
                    </span>
                    <span>{usagePct}%</span>
                  </div>
                  <div className="mt-1 h-2 rounded-full bg-slate-100">
                    <div
                      className="h-2 rounded-full bg-brand-600"
                      style={{ width: `${Math.min(usagePct, 100)}%` }}
                    />
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        <div>
          <h3 className="text-lg font-semibold">Upgrade Plan</h3>
          <p className="text-sm text-slate-500">
            bKash Merchant SIM-এ পেমেন্ট → TrxID দিয়ে Verify Paid। নতুন প্ল্যান কিনলে{' '}
            <strong>order confirm কোটা যোগ</strong> হয় (আগের কোটা থাকে)।
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
                    +{plan.callLimit} order confirmed · {plan.smsLimit} SMS
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
                    {price <= 0 ? (
                      isCurrent ? (
                        <button disabled className="btn-secondary w-full opacity-50">
                          Current Plan
                        </button>
                      ) : hasPaidPlan ? (
                        <button disabled className="btn-secondary w-full opacity-50">
                          Paid plan active
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
                      )
                    ) : (
                      <button
                        type="button"
                        onClick={() => openPayForm(plan)}
                        disabled={!!loading}
                        className="w-full rounded-lg bg-[#E2136E] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[#c41060]"
                      >
                        {isCurrent
                          ? 'আরও কোটা · bKash'
                          : 'bKash দিয়ে পেমেন্ট'}
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {payPlan && (
          <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 p-4 sm:items-center">
            <div className="w-full max-w-md overflow-hidden rounded-2xl bg-white shadow-2xl">
              <div className="bg-[#E2136E] px-5 py-4 text-white">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/20 text-sm font-bold">
                    bK
                  </div>
                  <div>
                    <p className="text-sm font-medium text-white/90">bKash Payment</p>
                    <p className="text-lg font-bold">{payPlan.name}</p>
                  </div>
                </div>
                <p className="mt-3 text-2xl font-bold">
                  {formatCurrency(Number(payPlan.priceMonthly))}
                </p>
              </div>

              {payStep === 'verifying' && (
                <div className="flex flex-col items-center gap-3 px-6 py-12 text-center">
                  <Loader2 className="h-10 w-10 animate-spin text-[#E2136E]" />
                  <p className="font-semibold text-slate-800">TrxID মিলিয়ে ভেরিফাই হচ্ছে…</p>
                  <p className="text-sm text-slate-500">সাধারণত ৩ সেকেন্ডের মধ্যে Paid দেখাবে</p>
                </div>
              )}

              {payStep === 'paid' && (
                <div className="flex flex-col items-center gap-3 px-6 py-12 text-center">
                  <div className="flex h-14 w-14 items-center justify-center rounded-full bg-emerald-100">
                    <Check className="h-8 w-8 text-emerald-600" />
                  </div>
                  <p className="text-lg font-bold text-emerald-700">Paid</p>
                  <p className="text-sm text-slate-500">প্ল্যান অ্যাক্টিভ · কোটা যোগ হয়েছে</p>
                </div>
              )}

              {(payStep === 'form' || payStep === 'error') && (
                <form onSubmit={verifyPaid} className="space-y-4 px-5 py-5">
                  <div className="rounded-xl bg-[#E2136E]/5 p-3 ring-1 ring-[#E2136E]/15">
                    <p className="text-xs font-medium text-slate-500">
                      এই নম্বরে পেমেন্ট করুন
                    </p>
                    {bKashNumber ? (
                      <div className="mt-1 flex items-center justify-between gap-2">
                        <p className="text-xl font-bold tracking-wide text-slate-900">
                          {bKashNumber}
                        </p>
                        <button
                          type="button"
                          onClick={() => void copyNumber(bKashNumber)}
                          className="inline-flex items-center gap-1 rounded-lg bg-white px-2 py-1 text-xs font-semibold text-[#E2136E] ring-1 ring-[#E2136E]/20"
                        >
                          {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                          {copied ? 'Copied' : 'Copy'}
                        </button>
                      </div>
                    ) : (
                      <p className="mt-1 text-sm text-amber-700">
                        Admin এখনো Payment নম্বর সেট করেনি
                      </p>
                    )}
                    <p className="mt-2 text-xs text-slate-500">
                      Amount: <strong>{formatCurrency(Number(payPlan.priceMonthly))}</strong>
                    </p>
                  </div>

                  <div>
                    <label className="text-sm font-medium text-slate-700">bKash TrxID</label>
                    <input
                      className="input mt-1"
                      value={trxId}
                      onChange={(e) => setTrxId(e.target.value)}
                      placeholder="Transaction ID"
                      required
                      minLength={6}
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

                  {(payError || payStep === 'error') && (
                    <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
                      {payError}
                    </p>
                  )}

                  <button
                    type="submit"
                    disabled={!!loading || !bKashNumber}
                    className="w-full rounded-xl bg-[#E2136E] py-3 text-sm font-bold text-white hover:bg-[#c41060] disabled:opacity-50"
                  >
                    Verify Paid
                  </button>
                  <button
                    type="button"
                    onClick={closePay}
                    className="w-full py-2 text-sm font-medium text-slate-500"
                  >
                    বাতিল
                  </button>
                </form>
              )}
            </div>
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
