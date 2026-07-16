'use client';

import { useEffect, useState } from 'react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { api, Merchant } from '@/lib/api';
import {
  clampSpeechRate,
  DEFAULT_SPEECH_RATE,
  fillVoiceScript,
  getVoiceOption,
  normalizeVoiceId,
  playPreviewAudio,
  speechRateLabel,
  stopBanglaPreview,
  speakBangla,
  voiceOptionsForConfig,
} from '@/lib/voice';
import { cn } from '@/lib/utils';
import { Pause, Play, Volume2, Check, User } from 'lucide-react';

const DEFAULT_VOICE = 'google:bn-IN-Chirp3-HD-Algieba';
const DEFAULT_SCRIPT =
  'হ্যালো {{customerName}}... আপনি {{storeName}}-এ অর্ডার করেছেন। আপনার মোট বিল {{amount}} টাকা। অর্ডারটি নিশ্চিত করার জন্য ১ চাপুন, অথবা বাতিল করার জন্য ২ চাপুন। আমরা ঢাকার বাইরে ২ থেকে ৩ দিনের ডেলিভারি দিয়ে থাকি, এবং ঢাকার মধ্যে ১ থেকে ২ দিনের মধ্যে ডেলিভারি দেওয়া হয়। আমাদের সাথে থাকার জন্য ধন্যবাদ। পুনরায় শুনতে ০ চাপুন।';

export default function SettingsPage() {
  const [merchant, setMerchant] = useState<Partial<Merchant>>({});
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [previewing, setPreviewing] = useState(false);
  const [previewingId, setPreviewingId] = useState<string | null>(null);
  const [googleTtsConfigured, setGoogleTtsConfigured] = useState(true);
  const voiceChoices = voiceOptionsForConfig(googleTtsConfigured);
  const rate = clampSpeechRate(merchant.speechRate);

  useEffect(() => {
    api
      .getVoiceProvider()
      .then((info) => {
        const configured = Boolean(
          (info as { googleTts?: boolean }).googleTts ??
            (info as { googleTtsConfigured?: boolean }).googleTtsConfigured,
        );
        setGoogleTtsConfigured(configured);
      })
      .catch(() => undefined);

    api
      .getMerchant()
      .then((m) => {
        const voiceId = normalizeVoiceId(m.voiceId) || DEFAULT_VOICE;
        const speechRate = clampSpeechRate(m.speechRate);
        setMerchant({
          ...m,
          customGreeting: m.customGreeting?.trim()
            ? m.customGreeting.replace(/কনফার্ম/gi, 'নিশ্চিত')
            : DEFAULT_SCRIPT,
          voiceId,
          speechRate,
        });
        if (voiceId !== m.voiceId || m.speechRate == null) {
          void api
            .updateMerchant({
              name: m.name,
              storeNameBangla: m.storeNameBangla,
              phone: m.phone,
              customGreeting: m.customGreeting?.trim() || DEFAULT_SCRIPT,
              voiceId,
              speechRate,
              maxCallRetries: m.maxCallRetries ?? 10,
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
          speechRate: DEFAULT_SPEECH_RATE,
        });
      });

    return () => stopBanglaPreview();
  }, []);

  function stopPreview() {
    stopBanglaPreview();
    setPreviewing(false);
    setPreviewingId(null);
  }

  async function playScript(voiceId?: string | null) {
    const m = {
      ...merchant,
      voiceId: voiceId || merchant.voiceId || DEFAULT_VOICE,
    };
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
      const result = await api.previewVoice(
        text,
        m.voiceId,
        clampSpeechRate(m.speechRate),
      );
      const ok = playPreviewAudio(result.audioBase64, result.mimeType, () => {
        setPreviewing(false);
        setPreviewingId(null);
      });
      if (!ok) throw new Error('audio play failed');
    } catch {
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

  async function persistMerchant(patch: Partial<Merchant>, play = false) {
    const next = { ...merchant, ...patch };
    setMerchant(next);
    if (play) void playScript(patch.voiceId || next.voiceId);

    setSaving(true);
    setError('');
    try {
      const updated = await api.updateMerchant({
        name: next.name,
        storeNameBangla: next.storeNameBangla,
        phone: next.phone,
        customGreeting: next.customGreeting?.trim() || DEFAULT_SCRIPT,
        voiceId: normalizeVoiceId(next.voiceId) || DEFAULT_VOICE,
        speechRate: clampSpeechRate(next.speechRate),
        maxCallRetries: next.maxCallRetries ?? 10,
        retryIntervalMin: next.retryIntervalMin ?? 90,
      });
      setMerchant({
        ...updated,
        customGreeting: updated.customGreeting || DEFAULT_SCRIPT,
        voiceId: normalizeVoiceId(updated.voiceId) || next.voiceId,
        speechRate: clampSpeechRate(updated.speechRate ?? next.speechRate),
      });
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch {
      setError('সেভ হয়নি। আবার চেষ্টা করুন।');
    } finally {
      setSaving(false);
    }
  }

  async function selectVoice(voiceId: string) {
    await persistMerchant({ voiceId }, true);
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    await persistMerchant({});
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
            <div className="rounded-xl bg-emerald-50 px-4 py-3 text-[14px] text-emerald-700">
              সেভ হয়েছে!
            </div>
          )}
          {error && (
            <div className="rounded-xl bg-rose-50 px-4 py-3 text-[14px] text-rose-700">
              {error}
            </div>
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
                onChange={(e) =>
                  setMerchant({ ...merchant, storeNameBangla: e.target.value })
                }
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
              onChange={(e) =>
                setMerchant({ ...merchant, customGreeting: e.target.value })
              }
            />
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                className="text-[13px] font-semibold text-brand-600 hover:text-brand-700"
                onClick={() =>
                  setMerchant({ ...merchant, customGreeting: DEFAULT_SCRIPT })
                }
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
                Maskara-তে <strong>Algieba</strong> বাছুন। ePBX-এ{' '}
                <strong>bn-IN-Chirp3-HD-Algenib (MALE)</strong> সিলেক্ট করে{' '}
                <strong>Save Voice Profile</strong> চাপুন। উপরে Active Voice Model যদি{' '}
                <strong>WaveNet/Neural2</strong> থাকে, সেটাই নারী ভয়েস দিতে পারে — সম্ভব হলে Chirp3
                গেটওয়ে বেছে নিন। Sandbox-এ ইংরেজি টেক্সট দিয়ে টেস্ট করবেন না (বাংলা দিয়ে
                Synthesize &amp; Play)।
              </p>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              {voiceChoices.map((v) => {
                const active = (merchant.voiceId || voiceChoices[0].id) === v.id;
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
                            v.gender === 'female'
                              ? 'bg-rose-50 text-rose-600'
                              : 'bg-sky-50 text-sky-700',
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
                    <p className="mt-3 text-[13px] leading-snug text-slate-600">
                      {v.description}
                    </p>
                    <div className="mt-3 flex items-center justify-between gap-2">
                      {v.recommended ? (
                        <span className="badge bg-emerald-50 text-emerald-700">প্রস্তাবিত</span>
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
              নির্বাচিত: <strong>{selected.label}</strong> ({selected.provider})
              {selected.requiresGoogleTts ? (
                <>
                  {' '}
                  — লাইভ ePBX Google Chirp3:{' '}
                  <strong>
                    {selected.gender === 'male'
                      ? 'bn-IN-Chirp3-HD-Algenib'
                      : selected.id.replace(/^google:/, '')}
                  </strong>{' '}
                  ({selected.gender === 'male' ? 'পুরুষ' : 'নারী'})
                </>
              ) : (
                <> — রিয়েল কলেও ePBX Google পোর্টাল ভয়েস প্রোফাইল ব্যবহার হবে।</>
              )}
            </div>
            {saved && (
              <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-[13px] text-amber-900">
                সেভ হয়েছে। এখন ePBX (<strong>maskara.epbx.bd</strong>) → Developer API Settings-এ{' '}
                <strong>Algenib (MALE)</strong> সিলেক্ট করে <strong>Save Voice Profile</strong>{' '}
                চাপুন। ডিপ্লয়ের পর Maskara Algieba + ePBX Algenib দুটোই পুরুষ থাকলে লাইভ কল পুরুষ
                শোনাবে।
              </div>
            )}

            <div className="space-y-3 rounded-xl border border-slate-200 p-4">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-[14px] font-semibold text-slate-900">কথার গতি</p>
                  <p className="text-[12px] text-slate-500">
                    কল সেন্টারের মতো স্বাভাবিক শোনাতে ০.৯০–১.০০ রাখুন; দ্রুত করতে ১.১০+ বাড়ান
                  </p>
                </div>
                <span className="rounded-full bg-slate-100 px-3 py-1 text-[12px] font-semibold text-slate-700">
                  {speechRateLabel(rate)} · {rate.toFixed(2)}×
                </span>
              </div>
              <input
                type="range"
                min={0.75}
                max={1.35}
                step={0.05}
                value={rate}
                onChange={(e) =>
                  setMerchant({
                    ...merchant,
                    speechRate: clampSpeechRate(Number(e.target.value)),
                  })
                }
                onMouseUp={() => void persistMerchant({}, true)}
                onTouchEnd={() => void persistMerchant({}, true)}
                className="w-full accent-brand-600"
              />
              <div className="flex justify-between text-[11px] text-slate-400">
                <span>ধীরে (০.৭৫)</span>
                <span>স্বাভাবিক (০.৯৫)</span>
                <span>দ্রুত (১.৩৫)</span>
              </div>
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
                  max={10}
                  className="input mt-1"
                  value={merchant.maxCallRetries ?? 10}
                  onChange={(e) =>
                    setMerchant({
                      ...merchant,
                      maxCallRetries: Math.min(10, Math.max(1, +e.target.value)),
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
