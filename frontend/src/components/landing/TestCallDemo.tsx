'use client';

import { useEffect, useRef, useState } from 'react';
import { Mic, Phone, Pause, Volume2 } from 'lucide-react';

type Clip = 'welcome' | 'confirm' | 'cancel';
type Phase = 'idle' | 'connecting' | 'welcome' | 'branch';

const API_BASE =
  process.env.NEXT_PUBLIC_API_URL?.replace(/\/$/, '') || 'https://api.maskara.bd';

const COPY = {
  welcome:
    'হ্যালো সাকিব, আপনি ঘরেবাজারে এক কেজি মধু অর্ডার করেছিলেন। যার মূল্য ৪২০০ টাকা। আপনার অর্ডারটি যদি কনফার্ম হয়, তাহলে এক চাপুন। বাতিল করতে দুই চাপুন।',
  confirm:
    'ধন্যবাদ। আপনার অর্ডারটি কনফার্ম হয়েছে। শীঘ্রই আপনি কুরিয়ারের মাধ্যমে পণ্যটি পেয়ে যাবেন।',
  cancel:
    'ধন্যবাদ। আপনার অর্ডারটি বাতিল করা হয়েছে। প্রয়োজনে আবার অর্ডার করতে পারেন।',
} as const;

async function fetchClip(clip: Clip): Promise<{ mimeType: string; audioBase64: string }> {
  const res = await fetch(`${API_BASE}/voice/demo-preview`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({ clip }),
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(err || `Demo failed (${res.status})`);
  }
  return res.json();
}

function playBase64(
  mimeType: string,
  audioBase64: string,
  signal: AbortController,
  onAudio: (audio: HTMLAudioElement) => void,
) {
  return new Promise<void>((resolve, reject) => {
    const audio = new Audio(`data:${mimeType};base64,${audioBase64}`);
    onAudio(audio);
    const onAbort = () => {
      audio.pause();
      audio.src = '';
      reject(new DOMException('Aborted', 'AbortError'));
    };
    signal.signal.addEventListener('abort', onAbort);
    audio.onended = () => {
      signal.signal.removeEventListener('abort', onAbort);
      resolve();
    };
    audio.onerror = () => {
      signal.signal.removeEventListener('abort', onAbort);
      reject(new Error('Audio play failed'));
    };
    void audio.play().catch(reject);
  });
}

export function TestCallDemo() {
  const [phase, setPhase] = useState<Phase>('idle');
  const [activeKey, setActiveKey] = useState<'1' | '2' | null>(null);
  const [playing, setPlaying] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const cacheRef = useRef<Partial<Record<Clip, { mimeType: string; audioBase64: string }>>>({});

  useEffect(() => {
    return () => {
      abortRef.current?.abort();
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current.src = '';
      }
    };
  }, []);

  function stop() {
    abortRef.current?.abort();
    abortRef.current = null;
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.src = '';
      audioRef.current = null;
    }
    setPlaying(false);
  }

  async function playClip(clip: Clip) {
    stop();
    const ac = new AbortController();
    abortRef.current = ac;
    setPlaying(true);
    setError(null);
    try {
      let data = cacheRef.current[clip];
      if (!data) {
        data = await fetchClip(clip);
        cacheRef.current[clip] = data;
      }
      if (ac.signal.aborted) return;
      await playBase64(data.mimeType, data.audioBase64, ac, (a) => {
        audioRef.current = a;
      });
    } catch (e) {
      if ((e as Error)?.name === 'AbortError') return;
      setError('অডিও লোড হয়নি — একটু পর আবার চেষ্টা করুন।');
    } finally {
      if (abortRef.current === ac) {
        setPlaying(false);
        abortRef.current = null;
      }
    }
  }

  async function startTestCall() {
    setPhase('connecting');
    setActiveKey(null);
    setError(null);
    await new Promise((r) => setTimeout(r, 700));
    setPhase('welcome');
    await playClip('welcome');
    setPhase('branch');
  }

  async function pressKey(key: '1' | '2') {
    if (phase !== 'branch' && phase !== 'welcome') return;
    setActiveKey(key);
    setPhase('branch');
    await playClip(key === '1' ? 'confirm' : 'cancel');
  }

  return (
    <div className="relative mx-auto w-full max-w-lg lg:max-w-none">
      <div className="land-glass-card relative overflow-hidden rounded-[1.75rem] p-1">
        <div className="relative rounded-[1.55rem] bg-white/70 p-5 backdrop-blur-xl sm:p-7">
          {/* Phone strip — ManyDial-style status */}
          <div className="flex items-center gap-3 rounded-2xl bg-[#15204a] px-4 py-3 text-white">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[#22c55e]">
              <Phone className="h-4 w-4 text-white" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="font-display text-sm font-semibold tracking-tight">
                Confirm Order Call
              </p>
              <p className="text-xs text-white/65">
                {phase === 'idle' && 'Ready to listen'}
                {phase === 'connecting' && 'Connecting...'}
                {phase === 'welcome' && 'Maskara AI speaking…'}
                {phase === 'branch' && (activeKey ? `Pressed ${activeKey}` : 'Press 1 or 2')}
              </p>
            </div>
            {playing && (
              <span className="flex items-center gap-1 text-[11px] font-medium text-[#93c5fd]">
                <Volume2 className="h-3.5 w-3.5 animate-pulse" />
                Live
              </span>
            )}
          </div>

          {/* Welcome */}
          <div
            className={`mt-5 rounded-2xl border bg-white p-4 transition ${
              phase === 'welcome' || phase === 'connecting'
                ? 'border-[#3b5bdb] shadow-[0_0_0_3px_rgba(59,91,219,0.12)]'
                : 'border-[#e6e9f2]'
            }`}
          >
            <div className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#3b5bdb]/10 text-[#3b5bdb]">
                <Mic className="h-4 w-4" />
              </div>
              <p className="text-xs font-semibold uppercase tracking-[0.12em] text-[#3b5bdb]">
                Welcome Message
              </p>
            </div>
            <p className="mt-3 text-[13px] leading-relaxed text-[#15204a] sm:text-sm">
              {COPY.welcome}
            </p>
          </div>

          {/* Branches */}
          <div className="relative mt-4 grid gap-3 sm:grid-cols-2">
            <div className="pointer-events-none absolute left-1/2 top-0 hidden h-3 w-px -translate-x-1/2 -translate-y-3 border-l border-dashed border-[#c7ccef] sm:block" />
            <button
              type="button"
              onClick={() => pressKey('1')}
              disabled={phase === 'idle' || phase === 'connecting' || playing}
              className={`rounded-2xl border bg-white p-4 text-left transition disabled:opacity-60 ${
                activeKey === '1'
                  ? 'border-[#3b5bdb] shadow-[0_0_0_3px_rgba(59,91,219,0.12)]'
                  : 'border-[#e6e9f2] hover:border-[#c7ccef]'
              }`}
            >
              <div className="flex items-center gap-2">
                <span className="flex h-7 w-7 items-center justify-center rounded-full bg-[#15204a] text-xs font-bold text-white">
                  1
                </span>
                <p className="text-xs font-semibold uppercase tracking-[0.1em] text-[#5b647a]">
                  Confirm Order
                </p>
              </div>
              <p className="mt-2 text-[12px] leading-relaxed text-[#5b647a] sm:text-[13px]">
                {COPY.confirm}
              </p>
            </button>

            <button
              type="button"
              onClick={() => pressKey('2')}
              disabled={phase === 'idle' || phase === 'connecting' || playing}
              className={`rounded-2xl border bg-white p-4 text-left transition disabled:opacity-60 ${
                activeKey === '2'
                  ? 'border-[#7c6cf0] shadow-[0_0_0_3px_rgba(124,108,240,0.12)]'
                  : 'border-[#e6e9f2] hover:border-[#c7ccef]'
              }`}
            >
              <div className="flex items-center gap-2">
                <span className="flex h-7 w-7 items-center justify-center rounded-full bg-[#15204a] text-xs font-bold text-white">
                  2
                </span>
                <p className="text-xs font-semibold uppercase tracking-[0.1em] text-[#5b647a]">
                  Cancel Order
                </p>
              </div>
              <p className="mt-2 text-[12px] leading-relaxed text-[#5b647a] sm:text-[13px]">
                {COPY.cancel}
              </p>
            </button>
          </div>

          {error && <p className="mt-3 text-center text-sm text-red-600">{error}</p>}

          <button
            type="button"
            onClick={() => (playing ? stop() : startTestCall())}
            className="land-cta-glow mt-6 flex min-h-[52px] w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-[#3b5bdb] via-[#5b6cf0] to-[#7c6cf0] text-base font-semibold text-white transition hover:brightness-105"
          >
            {playing ? (
              <>
                <Pause className="h-4 w-4" /> থামান
              </>
            ) : (
              <>
                <Volume2 className="h-4 w-4" /> Test call শুনুন
              </>
            )}
          </button>
          <p className="mt-2 text-center text-[11px] text-[#8a92a8]">
            ব্রাউজারেই শুনুন — ফোন লাগবে না
          </p>
        </div>
      </div>
    </div>
  );
}
