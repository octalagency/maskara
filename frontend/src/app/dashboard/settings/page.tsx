'use client';

import { useEffect, useState } from 'react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { api, Merchant } from '@/lib/api';
import { VOICE_OPTIONS, speakBangla } from '@/lib/voice';
import { Pause, Play, Volume2 } from 'lucide-react';

const DEFAULT_SCRIPT =
  'আসসালামু আলাইকুম, {{customerName}}। {{storeName}}-এর পক্ষ থেকে জানাচ্ছি—আপনার {{amount}} টাকার অর্ডারটি আমরা পেয়েছি, অর্ডার নম্বর {{orderNumber}}। অর্ডারটি নিশ্চিত করতে এক চাপুন। বাতিল করতে দুই চাপুন। আমাদের সাথে কেনাকাটার জন্য ধন্যবাদ।';

function fillPreviewScript(script: string, merchant: Partial<Merchant>) {
  const store = merchant.storeNameBangla || merchant.name || 'আমাদের স্টোর';
  return script
    .replace(/\{\{\s*storeName\s*\}\}/gi, store)
    .replace(/\{\{\s*customerName\s*\}\}/gi, 'রহিম')
    .replace(/\{\{\s*amount\s*\}\}/gi, '১২০০')
    .replace(/\{\{\s*orderNumber\s*\}\}/gi, '#11380');
}

export default function SettingsPage() {
  const [merchant, setMerchant] = useState<Partial<Merchant>>({});
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [previewing, setPreviewing] = useState(false);

  useEffect(() => {
    api
      .getMerchant()
      .then((m) => {
        setMerchant({
          ...m,
          customGreeting: m.customGreeting?.trim() ? m.customGreeting : DEFAULT_SCRIPT,
          voiceId: m.voiceId || VOICE_OPTIONS[0].id,
        });
      })
      .catch(() => {
        setMerchant({
          name: '',
          storeNameBangla: '',
          email: '',
          phone: '',
          customGreeting: DEFAULT_SCRIPT,
          voiceId: VOICE_OPTIONS[0].id,
        });
      });

    return () => {
      if (typeof window !== 'undefined') window.speechSynthesis?.cancel();
    };
  }, []);

  function stopPreview() {
    if (typeof window !== 'undefined') window.speechSynthesis.cancel();
    setPreviewing(false);
  }

  function playPreview(override?: Partial<Merchant>) {
    const m = { ...merchant, ...override };
    const script = (m.customGreeting || DEFAULT_SCRIPT).trim() || DEFAULT_SCRIPT;
    const text = fillPreviewScript(script, m);
    stopPreview();
    setPreviewing(true);
    setError('');
    const ok = speakBangla(text, m.voiceId, () => setPreviewing(false));
    if (!ok) {
      setPreviewing(false);
      setError('এই ব্রাউজারে ভয়েস প্রিভিউ সাপোর্ট করে না। Chrome ব্যবহার করুন।');
    }
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError('');
    try {
      const updated = await api.updateMerchant({
        name: merchant.name,
        storeNameBangla: merchant.storeNameBangla,
        phone: merchant.phone,
        customGreeting: merchant.customGreeting?.trim() || DEFAULT_SCRIPT,
        voiceId: merchant.voiceId || VOICE_OPTIONS[0].id,
        maxCallRetries: merchant.maxCallRetries ?? 9,
        retryIntervalMin: merchant.retryIntervalMin ?? 90,
      });
      setMerchant({
        ...updated,
        customGreeting: updated.customGreeting || DEFAULT_SCRIPT,
        voiceId: updated.voiceId || VOICE_OPTIONS[0].id,
      });
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch {
      setError('সেভ করতে ব্যর্থ হয়েছে। আবার চেষ্টা করুন।');
    } finally {
      setSaving(false);
    }
  }

  return (
    <DashboardLayout>
      <div className="mx-auto max-w-2xl space-y-6">
        <div>
          <h2 className="font-display text-2xl font-bold text-slate-900">সেটিংস</h2>
          <p className="text-sm text-slate-500">স্টোর ও AI কল ভয়েস — কাস্টমার যা শুনবে</p>
        </div>

        <form onSubmit={handleSave} className="card space-y-5">
          {saved && (
            <div className="rounded-xl bg-emerald-50 p-3 text-sm text-emerald-700">সেভ হয়েছে!</div>
          )}
          {error && <div className="rounded-xl bg-red-50 p-3 text-sm text-red-700">{error}</div>}

          <div>
            <label className="block text-sm font-medium text-slate-700">Store Name</label>
            <input
              className="input mt-1"
              value={merchant.name || ''}
              onChange={(e) => setMerchant({ ...merchant, name: e.target.value })}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700">Store Name (Bangla)</label>
            <input
              className="input mt-1"
              value={merchant.storeNameBangla || ''}
              onChange={(e) => setMerchant({ ...merchant, storeNameBangla: e.target.value })}
            />
            <p className="mt-1 text-xs text-slate-400">AI কলের নাম হিসেবে ব্যবহার হয়</p>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700">Phone</label>
            <input
              className="input mt-1"
              value={merchant.phone || ''}
              onChange={(e) => setMerchant({ ...merchant, phone: e.target.value })}
            />
          </div>

          <hr className="border-slate-100" />
          <h3 className="font-display font-bold text-slate-900">AI Call Script</h3>
          <p className="text-sm text-slate-500">
            Placeholder:{' '}
            <code className="rounded bg-slate-100 px-1">{'{{storeName}}'}</code>{' '}
            <code className="rounded bg-slate-100 px-1">{'{{customerName}}'}</code>{' '}
            <code className="rounded bg-slate-100 px-1">{'{{amount}}'}</code>{' '}
            <code className="rounded bg-slate-100 px-1">{'{{orderNumber}}'}</code>
          </p>
          <div>
            <textarea
              className="input mt-1 min-h-[160px]"
              value={merchant.customGreeting ?? ''}
              onChange={(e) => setMerchant({ ...merchant, customGreeting: e.target.value })}
            />
            <button
              type="button"
              className="mt-2 text-sm font-medium text-brand-600 hover:text-brand-700"
              onClick={() => setMerchant({ ...merchant, customGreeting: DEFAULT_SCRIPT })}
            >
              সুন্দর ডিফল্ট স্ক্রিপ্ট বসান
            </button>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700">AI Voice (রিয়েল কলে যা যাবে)</label>
            <div className="mt-1 flex flex-col gap-3 sm:flex-row sm:items-center">
              <select
                className="input flex-1"
                value={merchant.voiceId || VOICE_OPTIONS[0].id}
                onChange={(e) => {
                  const voiceId = e.target.value;
                  setMerchant({ ...merchant, voiceId });
                  window.setTimeout(() => playPreview({ voiceId }), 40);
                }}
              >
                {VOICE_OPTIONS.map((v) => (
                  <option key={v.id} value={v.id}>
                    {v.label}
                  </option>
                ))}
              </select>
              <button
                type="button"
                onClick={() => (previewing ? stopPreview() : playPreview())}
                className="btn-secondary gap-2"
              >
                {previewing ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
                {previewing ? 'থামান' : 'প্রিভিউ শুনুন'}
              </button>
            </div>
            <p className="mt-2 flex items-start gap-1.5 text-xs text-slate-400">
              <Volume2 className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              প্রিভিউ ব্রাউজার ভয়েস (আনুমানিক)। আসল কল ePBX-এ Azure/Google TTS ব্যবহার করে।
            </p>
          </div>

          <hr className="border-slate-100" />
          <h3 className="font-display font-bold text-slate-900">Call Retry</h3>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="block text-sm font-medium text-slate-700">Max calls / day</label>
              <input
                type="number"
                min={1}
                max={9}
                className="input mt-1"
                value={merchant.maxCallRetries ?? 9}
                onChange={(e) =>
                  setMerchant({
                    ...merchant,
                    maxCallRetries: Math.min(9, Math.max(1, +e.target.value)),
                  })
                }
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700">Retry interval (min)</label>
              <input
                type="number"
                min={5}
                className="input mt-1"
                value={merchant.retryIntervalMin ?? 90}
                onChange={(e) =>
                  setMerchant({
                    ...merchant,
                    retryIntervalMin: Math.max(5, +e.target.value),
                  })
                }
              />
            </div>
          </div>

          <button type="submit" className="btn-primary" disabled={saving}>
            {saving ? 'Saving…' : 'Save Settings'}
          </button>
        </form>
      </div>
    </DashboardLayout>
  );
}
