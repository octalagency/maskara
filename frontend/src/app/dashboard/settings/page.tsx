'use client';

import { useEffect, useState } from 'react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { api, Merchant } from '@/lib/api';
import {
  VOICE_OPTIONS,
  fillVoiceScript,
  getVoiceOption,
  normalizeVoiceId,
  playPreviewAudio,
  stopBanglaPreview,
  speakBangla,
} from '@/lib/voice';
import { cn } from '@/lib/utils';
import { Pause, Play, Volume2, Check, User } from 'lucide-react';

const DEFAULT_VOICE = 'google:bn-IN-Chirp3-HD-Algieba';
const DEFAULT_SCRIPT =
  'হ্যালো {{customerName}}, আপনি {{storeName}}-এ অর্ডার করেছিলেন। যার মূল্য {{amount}} টাকা। অর্ডার নম্বর {{orderNumber}}। অর্ডারটি নিশ্চিত করতে এক চাপুন। বাতিল করতে দুই চাপুন।';

export default function SettingsPage() {
  const [merchant, setMerchant] = useState<Partial<Merchant>>({});
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [previewing, setPreviewing] = useState(false);
  const [previewingId, setPreviewingId] = useState<string | null>(null);

  useEffect(() => {
    api
      .getMerchant()
      .then((m) => {
        const voiceId = normalizeVoiceId(m.voiceId) || DEFAULT_VOICE;
        setMerchant({
          ...m,
          customGreeting: m.customGreeting?.trim()
            ? m.customGreeting.replace(/কনফার্ম/gi, 'নিশ্চিত')
            : DEFAULT_SCRIPT,
          voiceId,
        });
        // Migrate legacy ElevenLabs id so real calls stop using Azure female fallback
        if (m.voiceId === 'elevenlabs:Algieba' || m.voiceId === 'eleven_labs:Algieba') {
          void api
            .updateMerchant({
              name: m.name,
              storeNameBangla: m.storeNameBangla,
              phone: m.phone,
              customGreeting: m.customGreeting?.trim() || DEFAULT_SCRIPT,
              voiceId: DEFAULT_VOICE,
              maxCallRetries: m.maxCallRetries ?? 9,
              retryIntervalMin: m.retryIntervalMin ?? 90,
            })
            .catch(() => undefined);
        }
      })
      .catch(() => {
        setMerchant({
          name: '',
          storeNameBangla: '',
          email: '',
          phone: '',
          customGreeting: DEFAULT_SCRIPT,
          voiceId: DEFAULT_VOICE,
        });
      });

    return () => stopBanglaPreview();
  }, []);

  function stopPreview() {
    stopBanglaPreview();
    setPreviewing(false);
    setPreviewingId(null);
  }

  /** Reads whatever is currently written in the script box — server TTS audio */
  async function playScript(voiceId?: string | null) {
    const m = { ...merchant, voiceId: voiceId || merchant.voiceId || DEFAULT_VOICE };
    const script = (m.customGreeting || DEFAULT_SCRIPT).trim() || DEFAULT_SCRIPT;
    const text = fillVoiceScript(script, {
      storeName: m.storeNameBangla || m.name || 'আমাদের স্টোর',
      customerName: 'রহিম',
      amount: '১২০০',
      orderNumber: '#11380',
    });

    stopPreview();
    setPreviewing(true);
    setPreviewingId(m.voiceId || null);
    setError('');

    try {
      const result = await api.previewVoice(text, m.voiceId);
      const ok = playPreviewAudio(result.audioBase64, result.mimeType, () => {
        setPreviewing(false);
        setPreviewingId(null);
      });
      if (!ok) throw new Error('audio play failed');
    } catch {
      // Last resort: browser speech (often silent on Bangla)
      const ok = speakBangla(text, m.voiceId, () => {
        setPreviewing(false);
        setPreviewingId(null);
      });
      if (!ok) {
        setPreviewing(false);
        setPreviewingId(null);
        setError('প্রিভিউ চালু হয়নি। পেজ রিফ্রেশ করে আবার চেষ্টা করুন।');
      }
    }
  }

  async function selectVoice(voiceId: string) {
    const next = { ...merchant, voiceId };
    setMerchant(next);
    void playScript(voiceId);

    // Immediately persist — otherwise real calls keep the old voice
    setSaving(true);
    setError('');
    try {
      const updated = await api.updateMerchant({
        name: next.name,
        storeNameBangla: next.storeNameBangla,
        phone: next.phone,
        customGreeting: next.customGreeting?.trim() || DEFAULT_SCRIPT,
        voiceId,
        maxCallRetries: next.maxCallRetries ?? 9,
        retryIntervalMin: next.retryIntervalMin ?? 90,
      });
      setMerchant({
        ...updated,
        customGreeting: updated.customGreeting || DEFAULT_SCRIPT,
        voiceId: normalizeVoiceId(updated.voiceId) || voiceId,
      });
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch {
      setError('ভয়েস সেভ হয়নি। আবার ক্লিক করুন বা নিচে সেভ চাপুন।');
    } finally {
      setSaving(false);
    }
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError('');
    try {
      const voiceId = normalizeVoiceId(merchant.voiceId) || DEFAULT_VOICE;
      const updated = await api.updateMerchant({
        name: merchant.name,
        storeNameBangla: merchant.storeNameBangla,
        phone: merchant.phone,
        customGreeting: merchant.customGreeting?.trim() || DEFAULT_SCRIPT,
        voiceId,
        maxCallRetries: merchant.maxCallRetries ?? 9,
        retryIntervalMin: merchant.retryIntervalMin ?? 90,
      });
      setMerchant({
        ...updated,
        customGreeting: updated.customGreeting || DEFAULT_SCRIPT,
        voiceId: normalizeVoiceId(updated.voiceId) || DEFAULT_VOICE,
      });
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch {
      setError('সেভ করতে ব্যর্থ হয়েছে। আবার চেষ্টা করুন।');
    } finally {
      setSaving(false);
    }
  }

  const selected = getVoiceOption(merchant.voiceId);
  const previewText = fillVoiceScript(
    (merchant.customGreeting || DEFAULT_SCRIPT).trim() || DEFAULT_SCRIPT,
    {
      storeName: merchant.storeNameBangla || merchant.name || 'আমাদের স্টোর',
      customerName: 'রহিম',
      amount: '১২০০',
      orderNumber: '#11380',
    },
  );

  return (
    <DashboardLayout>
      <div className="mx-auto max-w-3xl space-y-6">
        <div>
          <h2 className="page-title">সেটিংস</h2>
          <p className="page-subtitle">স্টোর, কল স্ক্রিপ্ট ও রিয়েল হিউম্যান ভয়েস</p>
        </div>

        <form onSubmit={handleSave} className="space-y-5">
          {saved && (
            <div className="rounded-xl bg-emerald-50 px-4 py-3 text-[14px] text-emerald-700">সেভ হয়েছে!</div>
          )}
          {error && (
            <div className="rounded-xl bg-rose-50 px-4 py-3 text-[14px] text-rose-700">{error}</div>
          )}

          <section className="card space-y-4">
            <h3 className="section-title">স্টোর তথ্য</h3>
            <div>
              <label className="label-muted">Store Name (English)</label>
              <input
                className="input mt-1"
                value={merchant.name || ''}
                onChange={(e) => setMerchant({ ...merchant, name: e.target.value })}
              />
            </div>
            <div>
              <label className="label-muted">স্টোর নাম (বাংলা)</label>
              <input
                className="input mt-1"
                value={merchant.storeNameBangla || ''}
                onChange={(e) => setMerchant({ ...merchant, storeNameBangla: e.target.value })}
              />
              <p className="mt-1 text-[12px] text-slate-400">AI কলে এই নাম বলবে</p>
            </div>
            <div>
              <label className="label-muted">ফোন</label>
              <input
                className="input mt-1"
                value={merchant.phone || ''}
                onChange={(e) => setMerchant({ ...merchant, phone: e.target.value })}
              />
            </div>
          </section>

          <section className="card space-y-4">
            <div>
              <h3 className="section-title">কল স্ক্রিপ্ট</h3>
              <p className="page-subtitle">
                যা লিখবেন, প্রিভিউতে সেটাই পড়ে শোনাবে। Placeholder:{' '}
                <code className="rounded bg-slate-100 px-1 text-[12px]">{'{{storeName}}'}</code>{' '}
                <code className="rounded bg-slate-100 px-1 text-[12px]">{'{{customerName}}'}</code>{' '}
                <code className="rounded bg-slate-100 px-1 text-[12px]">{'{{amount}}'}</code>{' '}
                <code className="rounded bg-slate-100 px-1 text-[12px]">{'{{orderNumber}}'}</code>
              </p>
            </div>
            <textarea
              className="input min-h-[150px] leading-relaxed"
              value={merchant.customGreeting ?? ''}
              onChange={(e) => setMerchant({ ...merchant, customGreeting: e.target.value })}
            />
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                className="text-[13px] font-semibold text-brand-600 hover:text-brand-700"
                onClick={() => setMerchant({ ...merchant, customGreeting: DEFAULT_SCRIPT })}
              >
                ডিফল্ট স্ক্রিপ্ট বসান
              </button>
              <button
                type="button"
                onClick={() => (previewing ? stopPreview() : playScript())}
                className="btn-primary gap-2"
              >
                {previewing ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
                {previewing ? 'থামান' : 'স্ক্রিপ্ট পড়ে শুনুন'}
              </button>
            </div>
            <div className="rounded-xl bg-slate-50 p-3 text-[13px] leading-relaxed text-slate-600 ring-1 ring-slate-100">
              <p className="mb-1 text-[12px] font-semibold text-slate-400">প্রিভিউতে যা শোনাবে</p>
              {previewText}
            </div>
          </section>

          <section className="card space-y-4">
            <div>
              <h3 className="section-title">AI ভয়েস বাছুন</h3>
              <p className="page-subtitle">
                কার্ডে ক্লিক করলেই ভয়েস সেভ হয় ও প্রিভিউ শোনায়। রিয়েল কলে Algieba (Google Chirp3) যাবে।
              </p>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              {VOICE_OPTIONS.map((v) => {
                const active = (merchant.voiceId || VOICE_OPTIONS[0].id) === v.id;
                const playing = previewingId === v.id;
                return (
                  <button
                    key={v.id}
                    type="button"
                    onClick={() => selectVoice(v.id)}
                    className={cn(
                      'rounded-2xl border p-4 text-left transition',
                      active
                        ? 'border-brand-500 bg-brand-50/60 ring-2 ring-brand-200'
                        : 'border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50',
                    )}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2.5">
                        <div
                          className={cn(
                            'flex h-10 w-10 items-center justify-center rounded-full',
                            v.gender === 'female' ? 'bg-rose-50 text-rose-600' : 'bg-sky-50 text-sky-700',
                          )}
                        >
                          <User className="h-5 w-5" />
                        </div>
                        <div>
                          <p className="text-[15px] font-bold text-slate-900">{v.label}</p>
                          <p className="text-[12px] text-slate-500">{v.provider}</p>
                        </div>
                      </div>
                      {active && (
                        <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-brand-600 text-white">
                          <Check className="h-3.5 w-3.5" />
                        </span>
                      )}
                    </div>
                    <p className="mt-3 text-[13px] leading-snug text-slate-600">{v.description}</p>
                    <div className="mt-3 flex items-center justify-between gap-2">
                      {v.recommended ? (
                        <span className="badge bg-emerald-50 text-emerald-700">সবচেয়ে প্রাকৃতিক</span>
                      ) : (
                        <span className="badge bg-slate-100 text-slate-500">
                          {v.gender === 'female' ? 'নারী' : 'পুরুষ'}
                        </span>
                      )}
                      <span className="inline-flex items-center gap-1 text-[12px] font-semibold text-brand-600">
                        {playing ? (
                          <>
                            <Pause className="h-3.5 w-3.5" /> চলছে…
                          </>
                        ) : (
                          <>
                            <Volume2 className="h-3.5 w-3.5" /> শুনুন
                          </>
                        )}
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>

            <div className="rounded-xl border border-brand-100 bg-brand-50/50 px-4 py-3 text-[13px] text-slate-700">
              নির্বাচিত: <strong>{selected.label}</strong> ({selected.provider}) — রিয়েল কলে এই ভয়েস যাবে।
            </div>
          </section>

          <section className="card space-y-4">
            <h3 className="section-title">কল রিট্রাই</h3>
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="label-muted">দিনে সর্বোচ্চ কল</label>
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
                <label className="label-muted">রিট্রাই ইন্টারভাল (মিনিট)</label>
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
          </section>

          <button type="submit" className="btn-primary w-full sm:w-auto" disabled={saving}>
            {saving ? 'সেভ হচ্ছে…' : 'সেটিংস সেভ করুন'}
          </button>
        </form>
      </div>
    </DashboardLayout>
  );
}
