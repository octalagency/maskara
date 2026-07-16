'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import {
  Check,
  Mic2,
  Pause,
  Play,
  Volume2,
  Zap,
  AlertCircle,
  ExternalLink,
} from 'lucide-react';
import { api } from '@/lib/api';
import { cn } from '@/lib/utils';
import {
  VOICE_OPTIONS,
  GOOGLE_VOICE,
  DEFAULT_SPEECH_RATE,
  clampSpeechRate,
  speechRateLabel,
  getVoiceOption,
  playPreviewAudio,
  stopBanglaPreview,
  type VoiceOption,
} from '@/lib/voice';

const DEFAULT_SCRIPT =
  'আসসালামু আলাইকুম, মাসকারা ভয়েস স্টুডিওতে আপনাকে স্বাগতম। আপনি যেকোনো লেখা এখানে লিখে আমাদের Chirp3 কণ্ঠে রূপান্তর করতে পারেন।';

const CHIRP3_ARTISTS = VOICE_OPTIONS.filter(
  (v) => 'requiresGoogleTts' in v && v.requiresGoogleTts,
) as VoiceOption[];

export default function AdminVoiceStudioPage() {
  const [script, setScript] = useState(DEFAULT_SCRIPT);
  const [voiceId, setVoiceId] = useState(GOOGLE_VOICE);
  const [rate, setRate] = useState(DEFAULT_SPEECH_RATE);
  const [googleReady, setGoogleReady] = useState<boolean | null>(null);
  const [status, setStatus] = useState<'idle' | 'ready' | 'working' | 'error'>('idle');
  const [statusMsg, setStatusMsg] = useState('Ready');
  const [playing, setPlaying] = useState(false);
  const [engine, setEngine] = useState<string | null>(null);

  const selected = useMemo(() => getVoiceOption(voiceId), [voiceId]);

  useEffect(() => {
    api
      .getVoiceProvider()
      .then((info) => {
        setGoogleReady(Boolean(info.googleTts));
        setStatus('ready');
        setStatusMsg(info.googleTts ? 'Ready' : 'Google TTS key missing');
      })
      .catch(() => {
        setGoogleReady(false);
        setStatus('error');
        setStatusMsg('Could not load voice status');
      });
    return () => stopBanglaPreview();
  }, []);

  async function synthesize() {
    const text = script.replace(/\s+/g, ' ').trim();
    if (!text) {
      setStatus('error');
      setStatusMsg('Script is empty');
      return;
    }
    if (googleReady === false) {
      setStatus('error');
      setStatusMsg('Google TTS key required — set it in Voice / ePBX config');
      return;
    }

    setStatus('working');
    setStatusMsg('Synthesizing…');
    setPlaying(false);
    stopBanglaPreview();

    try {
      const result = await api.previewVoice(text, voiceId, rate);
      setEngine(result.engine);
      const ok = playPreviewAudio(result.audioBase64, result.mimeType, () => {
        setPlaying(false);
        setStatus('ready');
        setStatusMsg('Ready');
      });
      if (!ok) throw new Error('Browser could not play audio');
      setPlaying(true);
      setStatus('ready');
      setStatusMsg(`Playing · ${selected.label}`);
    } catch (err) {
      setPlaying(false);
      setStatus('error');
      setStatusMsg(err instanceof Error ? err.message : 'Synthesis failed');
    }
  }

  function stop() {
    stopBanglaPreview();
    setPlaying(false);
    setStatus('ready');
    setStatusMsg('Ready');
  }

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="mb-2 inline-flex items-center gap-2 rounded-full bg-brand-50 px-3 py-1 text-[12px] font-semibold text-brand-700">
            <Mic2 className="h-3.5 w-3.5" />
            Maskara Voice Engine · Google Chirp3
          </div>
          <h2 className="text-2xl font-bold text-slate-900">Voice Studio</h2>
          <p className="mt-1 max-w-2xl text-sm text-slate-500">
            Live Engine Console — Maskara synthesize করে; ePBX শুধু নম্বর দিয়ে কল করে।
            Portal-এর eAI / WaveNet voice ব্যবহার হয় না।
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span
            className={cn(
              'inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-[12px] font-semibold',
              googleReady
                ? 'bg-emerald-50 text-emerald-700'
                : googleReady === false
                  ? 'bg-amber-50 text-amber-800'
                  : 'bg-slate-100 text-slate-500',
            )}
          >
            {googleReady ? 'TTS configured' : googleReady === false ? 'TTS key missing' : 'Checking…'}
          </span>
          <Link
            href="/admin/config"
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-[13px] font-medium text-slate-700 hover:bg-slate-50"
          >
            Voice / ePBX config
            <ExternalLink className="h-3.5 w-3.5" />
          </Link>
        </div>
      </div>

      {googleReady === false && (
        <div className="flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
          <p>
            Google Cloud TTS API key সেট করুন —{' '}
            <Link href="/admin/config" className="font-semibold underline">
              Voice / ePBX
            </Link>
            । Key ছাড়া live call dial হবে না (ePBX portal voice fallback বন্ধ)।
          </p>
        </div>
      )}

      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="flex items-center justify-between border-b border-slate-100 bg-slate-50 px-4 py-2.5">
          <div className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-full bg-rose-400" />
            <span className="h-2.5 w-2.5 rounded-full bg-amber-400" />
            <span className="h-2.5 w-2.5 rounded-full bg-emerald-400" />
          </div>
          <p className="text-[12px] font-medium text-slate-500">
            Maskara Live Engine Console
          </p>
        </div>

        <div className="grid gap-0 lg:grid-cols-[1.2fr_1fr]">
          <div className="space-y-4 border-b border-slate-100 p-5 lg:border-b-0 lg:border-r">
            <div>
              <label className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">
                Input script (English or Bengali)
              </label>
              <textarea
                className="input mt-2 min-h-[180px] leading-relaxed"
                value={script}
                onChange={(e) => setScript(e.target.value)}
                placeholder={DEFAULT_SCRIPT}
              />
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between gap-3">
                <p className="text-[13px] font-semibold text-slate-800">Speech rate</p>
                <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-[11px] font-semibold text-slate-600">
                  {speechRateLabel(rate)} · {rate.toFixed(2)}×
                </span>
              </div>
              <input
                type="range"
                min={0.75}
                max={1.35}
                step={0.05}
                value={rate}
                onChange={(e) => setRate(clampSpeechRate(Number(e.target.value)))}
                className="w-full accent-brand-600"
              />
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 pt-4">
              <p
                className={cn(
                  'text-[13px]',
                  status === 'error' ? 'font-medium text-rose-600' : 'text-slate-500',
                )}
              >
                Status: {statusMsg}
                {engine ? ` · ${engine}` : ''}
              </p>
              <div className="flex gap-2">
                {playing && (
                  <button
                    type="button"
                    onClick={stop}
                    className="inline-flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                  >
                    <Pause className="h-4 w-4" />
                    Stop
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => void synthesize()}
                  disabled={status === 'working'}
                  className="btn-primary inline-flex items-center gap-2"
                >
                  {playing ? <Volume2 className="h-4 w-4" /> : <Zap className="h-4 w-4" />}
                  {status === 'working'
                    ? 'Synthesizing…'
                    : playing
                      ? 'Synthesize again'
                      : 'Synthesize Voice'}
                </button>
              </div>
            </div>
          </div>

          <div className="space-y-4 p-5">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">
                Voice artist
              </p>
              <div className="mt-2 rounded-xl border border-brand-100 bg-brand-50/40 p-3">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-brand-600 text-white">
                    <Play className="h-4 w-4" />
                  </div>
                  <div>
                    <p className="text-[15px] font-bold text-slate-900">{selected.label}</p>
                    <p className="text-[12px] text-slate-500">
                      Bengali · {selected.gender === 'male' ? 'Male' : 'Female'} · Chirp3 HD
                    </p>
                  </div>
                </div>
              </div>
            </div>

            <div className="grid max-h-[320px] gap-2 overflow-y-auto sm:grid-cols-2">
              {CHIRP3_ARTISTS.map((v) => {
                const active = voiceId === v.id;
                return (
                  <button
                    key={v.id}
                    type="button"
                    onClick={() => setVoiceId(v.id)}
                    className={cn(
                      'rounded-xl border p-3 text-left transition',
                      active
                        ? 'border-brand-500 bg-brand-50 ring-2 ring-brand-200'
                        : 'border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50',
                    )}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className="text-[14px] font-bold text-slate-900">{v.label}</p>
                        <p className="text-[11px] text-slate-500">
                          Bengali · {v.gender === 'male' ? 'Male' : 'Female'}
                        </p>
                      </div>
                      {active && (
                        <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-brand-600 text-white">
                          <Check className="h-3 w-3" />
                        </span>
                      )}
                    </div>
                    <p className="mt-1.5 line-clamp-2 text-[12px] text-slate-600">
                      {v.description}
                    </p>
                  </button>
                );
              })}
            </div>

            <div className="rounded-xl border border-slate-100 bg-slate-50 p-3">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">
                Neural metrics
              </p>
              <dl className="mt-2 grid grid-cols-3 gap-2 text-center">
                <div>
                  <dt className="text-[10px] text-slate-400">Sample</dt>
                  <dd className="text-[13px] font-semibold text-slate-800">24kHz</dd>
                </div>
                <div>
                  <dt className="text-[10px] text-slate-400">Format</dt>
                  <dd className="text-[13px] font-semibold text-slate-800">MP3</dd>
                </div>
                <div>
                  <dt className="text-[10px] text-slate-400">Engine</dt>
                  <dd className="text-[13px] font-semibold text-slate-800">Chirp3</dd>
                </div>
              </dl>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
