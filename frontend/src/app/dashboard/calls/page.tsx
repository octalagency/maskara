'use client';

import { useEffect, useRef, useState } from 'react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { api, Call } from '@/lib/api';
import { formatDate, getStatusBadge } from '@/lib/utils';
import { speakBangla, voiceShort } from '@/lib/voice';
import {
  Phone,
  Play,
  Pause,
  Volume2,
  Mic2,
  Headphones,
  X,
} from 'lucide-react';

export default function CallsPage() {
  const [calls, setCalls] = useState<Call[]>([]);
  const [merchantVoice, setMerchantVoice] = useState<{
    voiceId?: string;
    voiceLabel?: string;
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [playingId, setPlayingId] = useState<string | null>(null);
  const [previewId, setPreviewId] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    api
      .getCalls({ limit: '50' })
      .then((res) => {
        setCalls(res.calls || []);
        if (res.merchantVoice) setMerchantVoice(res.merchantVoice);
      })
      .catch(() => {
        setCalls([]);
        setError('Call history load করতে ব্যর্থ।');
      })
      .finally(() => setLoading(false));

    return () => {
      audioRef.current?.pause();
      if (typeof window !== 'undefined') window.speechSynthesis?.cancel();
    };
  }, []);

  function stopAll() {
    audioRef.current?.pause();
    audioRef.current = null;
    if (typeof window !== 'undefined') window.speechSynthesis?.cancel();
    setPlayingId(null);
    setPreviewId(null);
  }

  function playRecording(call: Call) {
    if (!call.recordingUrl) return;
    stopAll();
    const audio = new Audio(call.recordingUrl);
    audioRef.current = audio;
    setPlayingId(call.id);
    audio.onended = () => setPlayingId(null);
    audio.onerror = () => {
      setPlayingId(null);
      setError('রেকর্ডিং প্লে করা যায়নি। স্ক্রিপ্ট প্রিভিউ চেষ্টা করুন।');
    };
    void audio.play();
  }

  function previewVoice(call: Call) {
    stopAll();
    const text =
      call.spokenScript ||
      'আসসালামু আলাইকুম। আপনার অর্ডারটি নিশ্চিত করতে এক চাপুন। বাতিল করতে দুই চাপুন।';
    setPreviewId(call.id);
    const ok = speakBangla(text, call.voiceId || merchantVoice?.voiceId, () =>
      setPreviewId(null),
    );
    if (!ok) {
      setPreviewId(null);
      setError('এই ব্রাউজারে ভয়েস প্রিভিউ সাপোর্ট করে না। Chrome ব্যবহার করুন।');
    }
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <h2 className="page-title">কল হিস্ট্রি</h2>
            <p className="page-subtitle">
              কাস্টমার কোন ভয়েস শুনেছে, কী বলেছে, রেকর্ডিং শুনুন
            </p>
          </div>
          <div className="inline-flex items-center gap-2 rounded-2xl bg-brand-50 px-4 py-2.5 text-sm font-medium text-brand-800 ring-1 ring-brand-100">
            <Mic2 className="h-4 w-4" />
            সক্রিয় ভয়েস:{' '}
            <span className="font-semibold">
              {merchantVoice?.voiceLabel || voiceShort(merchantVoice?.voiceId) || 'নবনীতা'}
            </span>
          </div>
        </div>

        {error && (
          <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
            <button type="button" className="ml-2 underline" onClick={() => setError('')}>
              বন্ধ
            </button>
          </div>
        )}

        <div className="space-y-3">
          {!loading && calls.length === 0 && (
            <div className="card py-16 text-center text-slate-500">এখনো কোনো কল হয়নি।</div>
          )}

          {calls.map((call) => {
            const open = expandedId === call.id;
            const isRecording = playingId === call.id;
            const isPreview = previewId === call.id;
            return (
              <div key={call.id} className="card overflow-hidden p-0">
                <div className="flex flex-col gap-4 p-5 lg:flex-row lg:items-center lg:justify-between">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-semibold text-slate-900">
                        {call.order?.orderNumber || '—'}
                      </span>
                      <span className={getStatusBadge(call.status)}>{call.status}</span>
                      {call.outcome && (
                        <span className="badge bg-slate-100 text-slate-700">{call.outcome}</span>
                      )}
                      {call.provider && (
                        <span className="badge bg-violet-50 text-violet-700">{call.provider}</span>
                      )}
                    </div>
                    <p className="mt-1 text-sm text-slate-600">
                      {call.order?.customerName} · {call.order?.customerPhone}
                    </p>
                    <div className="mt-2 flex flex-wrap items-center gap-3 text-xs text-slate-500">
                      <span className="inline-flex items-center gap-1">
                        <Volume2 className="h-3.5 w-3.5 text-brand-500" />
                        ভয়েস: <strong className="text-slate-700">{call.voiceLabel || voiceShort(call.voiceId)}</strong>
                      </span>
                      <span>{formatDate(call.createdAt)}</span>
                      <span>{call.duration ? `${call.duration}s` : '—'}</span>
                      {call.dtmfInput && (
                        <span>
                          DTMF:{' '}
                          <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-brand-100 text-[11px] font-bold text-brand-700">
                            {call.dtmfInput}
                          </span>
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    {call.recordingUrl ? (
                      <button
                        type="button"
                        onClick={() => (isRecording ? stopAll() : playRecording(call))}
                        className="btn-primary gap-2"
                      >
                        {isRecording ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
                        {isRecording ? 'থামান' : 'রেকর্ডিং শুনুন'}
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={() => (isPreview ? stopAll() : previewVoice(call))}
                        className="btn-primary gap-2"
                      >
                        {isPreview ? <Pause className="h-4 w-4" /> : <Headphones className="h-4 w-4" />}
                        {isPreview ? 'থামান' : 'স্ক্রিপ্ট শুনুন'}
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => setExpandedId(open ? null : call.id)}
                      className="btn-secondary gap-2"
                    >
                      <Phone className="h-4 w-4" />
                      {open ? 'বন্ধ' : 'কী শুনিয়েছে'}
                    </button>
                  </div>
                </div>

                {open && (
                  <div className="border-t border-slate-100 bg-slate-50/80 px-5 py-4">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                          কাস্টমার যে স্ক্রিপ্ট শুনেছে
                        </p>
                        <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-slate-700">
                          {call.spokenScript || 'স্ক্রিপ্ট উপলব্ধ নয়।'}
                        </p>
                        {!call.recordingUrl && (
                          <p className="mt-2 text-xs text-amber-700">
                            লাইভ রেকর্ডিং না থাকলে ব্রাউজার প্রিভিউ দিয়ে একই ভয়েস স্টাইল শুনতে পারবেন।
                          </p>
                        )}
                      </div>
                      <button type="button" onClick={() => setExpandedId(null)} className="text-slate-400 hover:text-slate-600">
                        <X className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {loading && (
          <div className="flex justify-center py-10">
            <div className="h-6 w-6 animate-spin rounded-full border-2 border-brand-600 border-t-transparent" />
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
