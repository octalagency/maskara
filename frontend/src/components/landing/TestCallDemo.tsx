'use client';

import { useEffect, useRef, useState } from 'react';
import { Mic, Phone, PhoneOff, Pause, Volume2 } from 'lucide-react';

type Clip = 'welcome' | 'confirm' | 'cancel';
type Phase = 'idle' | 'ringing' | 'welcome' | 'branch' | 'done';

const API_BASE =
  process.env.NEXT_PUBLIC_API_URL?.replace(/\/$/, '') || 'https://api.maskara.bd';

const COPY = {
  welcome:
    'হ্যালো সাকিব, আপনি ঘরেবাজারে এক কেজি মধু অর্ডার করেছিলেন। যার মূল্য ১২০০ টাকা। আপনার অর্ডারটি যদি কনফার্ম হয়, তাহলে এক চাপুন। বাতিল করতে দুই চাপুন।',
  confirm:
    'ধন্যবাদ। আপনার অর্ডারটি কনফার্ম হয়েছে। একদিনের মধ্যেই আপনি কুরিয়ারের মাধ্যমে পণ্যটি পেয়ে যাবেন।',
  cancel:
    'ধন্যবাদ। আপনার অর্ডারটি বাতিল করা হয়েছে। প্রয়োজনে আবার অর্ডার করতে পারেন।',
} as const;

async function fetchClip(
  clip: Clip,
): Promise<{ mimeType: string; audioBase64: string }> {
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
  const cacheRef = useRef<
    Partial<Record<Clip, { mimeType: string; audioBase64: string }>>
  >({});

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
    setPhase('ringing');
    setActiveKey(null);
    setError(null);
    await new Promise((r) => setTimeout(r, 900));
    setPhase('welcome');
    await playClip('welcome');
    setPhase('branch');
  }

  async function pressKey(key: '1' | '2') {
    if (phase !== 'branch' && phase !== 'welcome') return;
    setActiveKey(key);
    setPhase('branch');
    await playClip(key === '1' ? 'confirm' : 'cancel');
    setPhase('done');
  }

  const phoneStatus =
    phase === 'idle'
      ? 'টেস্ট কল শুনুন'
      : phase === 'ringing'
        ? 'Connecting…'
        : phase === 'welcome'
          ? 'Maskara AI speaking…'
          : phase === 'branch'
            ? activeKey
              ? `${activeKey} চাপা হয়েছে`
              : '১ বা ২ চাপুন'
            : activeKey === '1'
              ? 'Order confirmed'
              : 'Order cancelled';

  return (
    <div className="mx-auto w-full max-w-xl lg:max-w-none">
      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,17rem)_1fr] lg:gap-8">
        {/* ManyDial-style phone */}
        <div className="land-hero-item land-hero-3 mx-auto w-full max-w-[17rem]">
          <div className="relative overflow-hidden rounded-[2rem] bg-[#0b1224] px-5 pb-6 pt-4 shadow-[0_24px_60px_-28px_rgba(11,18,36,0.65)]">
            <div className="flex items-center justify-between text-[10px] font-medium text-white/70">
              <span>8:41</span>
              <span className="h-1.5 w-6 rounded-full bg-white/80" />
            </div>

            <div className="mt-10 flex flex-col items-center text-center">
              <div
                className={`flex h-16 w-16 items-center justify-center rounded-full bg-[#22c55e] ${
                  phase === 'ringing' || playing ? 'animate-pulse' : ''
                }`}
              >
                <Phone className="h-7 w-7 text-white" />
              </div>
              <p className="mt-5 font-display text-lg font-semibold tracking-tight text-white">
                Confirm Order Call
              </p>
              <p className="mt-1.5 min-h-[1.25rem] text-sm text-white/55">{phoneStatus}</p>
            </div>

            <div className="mt-12 flex items-center justify-center gap-10">
              <button
                type="button"
                onClick={() => {
                  stop();
                  setPhase('idle');
                  setActiveKey(null);
                }}
                className="flex h-14 w-14 items-center justify-center rounded-full bg-[#ef4444] text-white transition hover:brightness-110"
                aria-label="End demo"
              >
                <PhoneOff className="h-6 w-6" />
              </button>
              <button
                type="button"
                onClick={() => (playing ? stop() : startTestCall())}
                className="flex h-14 w-14 items-center justify-center rounded-full bg-[#22c55e] text-white transition hover:brightness-110"
                aria-label="টেস্ট কল শুনুন"
              >
                {playing ? (
                  <Pause className="h-6 w-6" />
                ) : (
                  <Phone className="h-6 w-6 rotate-[-20deg]" />
                )}
              </button>
            </div>
          </div>
        </div>

        {/* IVR flow */}
        <div className="relative">
          <div
            className={`rounded-2xl border bg-white p-4 transition sm:p-5 ${
              phase === 'welcome' || phase === 'ringing'
                ? 'border-[#1a82f5] shadow-[0_0_0_3px_rgba(26,130,245,0.12)]'
                : 'border-[#e6e9f2]'
            }`}
          >
            <div className="flex items-center gap-2.5">
              <div className="flex h-9 w-9 items-center justify-center rounded-full bg-gradient-to-br from-[#1a82f5] to-[#0d9488] text-white">
                <Mic className="h-4 w-4" />
              </div>
              <div className="flex h-7 items-center gap-1 rounded-full bg-[#15204a] px-2.5">
                {[4, 8, 5, 10, 6, 9, 4].map((h, i) => (
                  <span
                    key={i}
                    className="w-0.5 rounded-full bg-white/85"
                    style={{ height: h }}
                  />
                ))}
              </div>
              <p className="text-sm font-semibold text-[#15204a]">Welcome Message</p>
            </div>
            <p className="mt-3 rounded-xl bg-[#f4f6fb] px-3.5 py-3 text-[13px] leading-relaxed text-[#15204a] sm:text-sm">
              {COPY.welcome}
            </p>
          </div>

          <div
            className="mx-auto my-1 hidden h-6 w-px border-l border-dashed border-[#c7ccef] sm:block"
            aria-hidden
          />

          <div className="mt-3 grid gap-3 sm:mt-0 sm:grid-cols-2">
            <button
              type="button"
              onClick={() => pressKey('1')}
              disabled={
                phase === 'idle' || phase === 'ringing' || playing || phase === 'done'
              }
              className={`rounded-2xl border bg-white p-4 text-left transition disabled:opacity-55 ${
                activeKey === '1'
                  ? 'border-[#1a82f5] shadow-[0_0_0_3px_rgba(26,130,245,0.12)]'
                  : 'border-[#e6e9f2] hover:border-[#b8c4e0]'
              }`}
            >
              <div className="flex items-center gap-2">
                <span className="flex h-7 w-7 items-center justify-center rounded-full bg-[#15204a] text-xs font-bold text-white">
                  1
                </span>
                <p className="text-xs font-semibold tracking-wide text-[#5b647a]">
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
              disabled={
                phase === 'idle' || phase === 'ringing' || playing || phase === 'done'
              }
              className={`rounded-2xl border bg-white p-4 text-left transition disabled:opacity-55 ${
                activeKey === '2'
                  ? 'border-[#0d9488] shadow-[0_0_0_3px_rgba(13,148,136,0.12)]'
                  : 'border-[#e6e9f2] hover:border-[#b8c4e0]'
              }`}
            >
              <div className="flex items-center gap-2">
                <span className="flex h-7 w-7 items-center justify-center rounded-full bg-[#15204a] text-xs font-bold text-white">
                  2
                </span>
                <p className="text-xs font-semibold tracking-wide text-[#5b647a]">
                  Cancel Order
                </p>
              </div>
              <p className="mt-2 text-[12px] leading-relaxed text-[#5b647a] sm:text-[13px]">
                {COPY.cancel}
              </p>
            </button>
          </div>

          {error && (
            <p className="mt-3 text-center text-sm text-red-600">{error}</p>
          )}

          <button
            type="button"
            onClick={() => (playing ? stop() : startTestCall())}
            className="land-cta-glow mt-5 flex min-h-[52px] w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-[#1a82f5] to-[#3b9eff] text-base font-semibold text-white transition hover:brightness-105"
          >
            {playing ? (
              <>
                <Pause className="h-4 w-4" /> থামান
              </>
            ) : (
              <>
                <Volume2 className="h-4 w-4" /> টেস্ট কল শুনুন
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
