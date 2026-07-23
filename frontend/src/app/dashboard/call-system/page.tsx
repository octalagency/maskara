'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { api, Merchant } from '@/lib/api';

function minsToTime(mins: number): string {
  const h = Math.floor(Math.max(0, mins) / 60) % 24;
  const m = Math.max(0, mins) % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

function timeToMins(value: string): number {
  const [h, m] = value.split(':').map((x) => parseInt(x, 10));
  if (Number.isNaN(h) || Number.isNaN(m)) return 580;
  return Math.min(1439, Math.max(0, h * 60 + m));
}

type DialForm = {
  callWindowStartMin: number;
  callWindowEndMin: number;
  dailyCallLimit: number;
  lifetimeCallLimit: number;
  firstHourCallLimit: number;
  retryIntervalMin: number;
};

const DEFAULTS: DialForm = {
  callWindowStartMin: 580,
  callWindowEndMin: 1320,
  dailyCallLimit: 10,
  lifetimeCallLimit: 20,
  firstHourCallLimit: 3,
  retryIntervalMin: 90,
};

export default function CallSystemPage() {
  const [form, setForm] = useState<DialForm>(DEFAULTS);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    api
      .getMerchant()
      .then((m: Merchant) => {
        setForm({
          callWindowStartMin: m.callWindowStartMin ?? DEFAULTS.callWindowStartMin,
          callWindowEndMin: m.callWindowEndMin ?? DEFAULTS.callWindowEndMin,
          dailyCallLimit: m.dailyCallLimit ?? DEFAULTS.dailyCallLimit,
          lifetimeCallLimit:
            m.lifetimeCallLimit ?? m.maxCallRetries ?? DEFAULTS.lifetimeCallLimit,
          firstHourCallLimit: m.firstHourCallLimit ?? DEFAULTS.firstHourCallLimit,
          retryIntervalMin: m.retryIntervalMin ?? DEFAULTS.retryIntervalMin,
        });
      })
      .catch(() => setError('সেটিংস লোড হয়নি।'))
      .finally(() => setLoading(false));
  }, []);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (form.callWindowEndMin <= form.callWindowStartMin) {
      setError('শেষ সময় শুরুর সময়ের পরে হতে হবে।');
      return;
    }
    setSaving(true);
    setError('');
    try {
      const updated = await api.updateMerchant({
        callWindowStartMin: form.callWindowStartMin,
        callWindowEndMin: form.callWindowEndMin,
        dailyCallLimit: form.dailyCallLimit,
        lifetimeCallLimit: form.lifetimeCallLimit,
        maxCallRetries: form.lifetimeCallLimit,
        firstHourCallLimit: form.firstHourCallLimit,
        retryIntervalMin: form.retryIntervalMin,
      });
      setForm({
        callWindowStartMin: updated.callWindowStartMin ?? form.callWindowStartMin,
        callWindowEndMin: updated.callWindowEndMin ?? form.callWindowEndMin,
        dailyCallLimit: updated.dailyCallLimit ?? form.dailyCallLimit,
        lifetimeCallLimit:
          updated.lifetimeCallLimit ??
          updated.maxCallRetries ??
          form.lifetimeCallLimit,
        firstHourCallLimit: updated.firstHourCallLimit ?? form.firstHourCallLimit,
        retryIntervalMin: updated.retryIntervalMin ?? form.retryIntervalMin,
      });
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch {
      setError('সেভ হয়নি। আবার চেষ্টা করুন।');
    } finally {
      setSaving(false);
    }
  }

  return (
    <DashboardLayout>
      <div className="mx-auto max-w-2xl space-y-6">
        <div>
          <h2 className="page-title">কল সিস্টেম</h2>
          <p className="page-subtitle">
            সব কানেক্টেড স্টোরে একই ডায়াল সিডিউল · ShopIn ও WordPress একসাথে
          </p>
        </div>

        <div className="card space-y-3 text-sm text-slate-600">
          <p className="font-semibold text-slate-900">ডিফল্ট টাইমলাইন</p>
          <ol className="list-decimal space-y-1.5 pl-5">
            <li>অর্ডারের ~২০ সেকেন্ডের মধ্যে প্রথম কল (উইন্ডোর ভিতরে)</li>
            <li>~২ মিনিট পর দ্বিতীয় কল</li>
            <li>প্রথম ১ ঘন্টার মধ্যে তৃতীয় কল</li>
            <li>বাকি কলগুলো দিনভর stagger — রাত {minsToTime(form.callWindowEndMin)} এর মধ্যে</li>
            <li>
              দিনে সর্বোচ্চ {form.dailyCallLimit} · বাকি থাকলে পরের দিন সকাল{' '}
              {minsToTime(form.callWindowStartMin)} থেকে
            </li>
            <li>
              মোট {form.lifetimeCallLimit} কলের পর অটো-ডায়াল বন্ধ · অর্ডার পেজে ম্যানুয়াল
              ক্যান্সেল
            </li>
          </ol>
        </div>

        {loading ? (
          <div className="flex justify-center py-12">
            <div className="h-6 w-6 animate-spin rounded-full border-2 border-brand-600 border-t-transparent" />
          </div>
        ) : (
          <form onSubmit={handleSave} className="card space-y-5">
            {saved && (
              <div className="rounded-lg bg-emerald-50 p-3 text-sm text-emerald-700">
                কল সিস্টেম সেভ হয়েছে।
              </div>
            )}
            {error && (
              <div className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</div>
            )}

            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="label-muted">কল শুরু (সকাল)</label>
                <input
                  type="time"
                  className="input mt-1"
                  value={minsToTime(form.callWindowStartMin)}
                  onChange={(e) =>
                    setForm({ ...form, callWindowStartMin: timeToMins(e.target.value) })
                  }
                />
              </div>
              <div>
                <label className="label-muted">কল শেষ (রাত)</label>
                <input
                  type="time"
                  className="input mt-1"
                  value={minsToTime(form.callWindowEndMin)}
                  onChange={(e) =>
                    setForm({ ...form, callWindowEndMin: timeToMins(e.target.value) })
                  }
                />
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="label-muted">দিনে সর্বোচ্চ কল</label>
                <input
                  type="number"
                  min={1}
                  max={20}
                  className="input mt-1"
                  value={form.dailyCallLimit}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      dailyCallLimit: Math.min(20, Math.max(1, +e.target.value || 1)),
                    })
                  }
                />
              </div>
              <div>
                <label className="label-muted">মোট কল (ম্যানুয়াল ক্যান্সেল)</label>
                <input
                  type="number"
                  min={1}
                  max={40}
                  className="input mt-1"
                  value={form.lifetimeCallLimit}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      lifetimeCallLimit: Math.min(40, Math.max(1, +e.target.value || 1)),
                    })
                  }
                />
                <p className="mt-1 text-xs text-slate-500">
                  এই সংখ্যায় পৌঁছালে অটো-কল বন্ধ · অর্ডারে ক্যান্সেল বাটন
                </p>
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="label-muted">প্রথম ঘন্টায় সর্বোচ্চ কল</label>
                <input
                  type="number"
                  min={1}
                  max={10}
                  className="input mt-1"
                  value={form.firstHourCallLimit}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      firstHourCallLimit: Math.min(10, Math.max(1, +e.target.value || 1)),
                    })
                  }
                />
              </div>
              <div>
                <label className="label-muted">রিট্রাই ইন্টারভাল (মিনিট)</label>
                <input
                  type="number"
                  min={5}
                  max={180}
                  className="input mt-1"
                  value={form.retryIntervalMin}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      retryIntervalMin: Math.min(180, Math.max(5, +e.target.value || 5)),
                    })
                  }
                />
                <p className="mt-1 text-xs text-slate-500">
                  প্রথম ঘন্টার পর ফলো-আপ কলের ন্যূনতম ফাঁক
                </p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <button type="submit" className="btn-primary" disabled={saving}>
                {saving ? 'সেভ হচ্ছে…' : 'সেটিংস সেভ করুন'}
              </button>
              <Link href="/dashboard/orders" className="text-sm font-medium text-brand-600 hover:underline">
                অর্ডার পেজ →
              </Link>
            </div>
          </form>
        )}
      </div>
    </DashboardLayout>
  );
}
