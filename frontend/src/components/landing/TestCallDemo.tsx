'use client';

import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import {
  ArrowRight,
  Check,
  Mic,
  Phone,
  PhoneOff,
  Pause,
  Volume2,
} from 'lucide-react';

type Clip = 'welcome' | 'confirm' | 'cancel';
type Phase = 'idle' | 'ringing' | 'welcome' | 'branch' | 'done';

const API_BASE =
  process.env.NEXT_PUBLIC_API_URL?.replace(/\/$/, '') || 'https://api.maskara.bd';

const COPY = {
  welcome:
    'হ্যালো সাকিব, আপনি Shopi থেকে এক কেজি মধু অর্ডার করেছিলেন। যার মূল্য এক হাজার দুইশ টাকা। আপনার অর্ডারটি যদি কনফার্ম হয়, তাহলে এক চাপুন। বাতিল করতে দুই চাপুন।',
  confirm:
    'ধন্যবাদ সাকিব। Shopi-তে আপনার অর্ডারটি কনফার্ম হয়েছে। একদিনের মধ্যেই আপনি কুরিয়ারের মাধ্যমে পণ্যটি পেয়ে যাবেন।',
  cancel:
    'ধন্যবাদ সাকিব। Shopi থেকে আপনার অর্ডারটি বাতিল করা হয়েছে। প্রয়োজনে আবার অর্ডার করতে পারেন।',
} as const;

const KEYPAD: { key: string; sub?: string; action?: '1' | '2' }[] = [
  { key: '1', sub: 'Confirm', action: '1' },
  { key: '2', sub: 'Cancel', action: '2' },
  { key: '3' },
  { key: '4' },
  { key: '5' },
  { key: '6' },
  { key: '7' },
  { key: '8' },
  { key: '9' },
  { key: '*' },
  { key: '0' },
  { key: '#' },
];

const BULLETS = [
  'Natural Bangla voices you can choose',
  '১ Confirm · ২ Cancel · ০ Repeat',
  'Shopify, WooCommerce, ShopIn & custom API',
];

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
  const [elapsed, setElapsed] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const cacheRef = useRef<
    Partial<Record<Clip, { mimeType: string; audioBase64: string }>>
  >({});
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    return () => {
      abortRef.current?.abort();
      if (timerRef.current) clearInterval(timerRef.current);
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current.src = '';
      }
    };
  }, []);

  function clearTimer() {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }

  function startTimer() {
    clearTimer();
    setElapsed(0);
    timerRef.current = setInterval(() => setElapsed((s) => s + 1), 1000);
  }

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

  function hangUp() {
    stop();
    clearTimer();
    setPhase('idle');
    setActiveKey(null);
    setElapsed(0);
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
    startTimer();
    await new Promise((r) => setTimeout(r, 900));
    setPhase('welcome');
    await playClip('welcome');
    setPhase('branch');
  }

  async function pressKey(key: '1' | '2') {
    if (phase !== 'branch' && phase !== 'welcome') return;
    if (playing && phase === 'welcome') stop();
    setActiveKey(key);
    setPhase('branch');
    await playClip(key === '1' ? 'confirm' : 'cancel');
    setPhase('done');
  }

  const canChoose =
    phase === 'welcome' || (phase === 'branch' && !activeKey);
  const mm = String(Math.floor(elapsed / 60));
  const ss = String(elapsed % 60).padStart(2, '0');

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
              : '১ Confirm · ২ Cancel'
            : activeKey === '1'
              ? 'Order confirmed'
              : 'Order cancelled';

  const welcomeLive = phase === 'welcome' || phase === 'ringing';

  return (
    <div className="grid w-full items-center gap-10 lg:grid-cols-[minmax(0,1.05fr)_minmax(16rem,18rem)_minmax(0,1.2fr)] lg:gap-8 xl:gap-12">
      {/* Left — brand + pitch */}
      <div className="land-hero-item land-hero-1 order-1 text-center lg:text-left">
        <p className="font-display text-[clamp(2.6rem,8vw,4.25rem)] font-semibold leading-[0.92] tracking-[-0.045em] text-[#15204a]">
          Maskara
        </p>
        <p className="mt-5 text-xs font-semibold uppercase tracking-[0.16em] text-[#1a82f5]">
          Hear the intelligence
        </p>
        <h1 className="mt-2 font-display text-[clamp(1.55rem,3.8vw,2.35rem)] font-semibold leading-[1.2] tracking-[-0.03em] text-[#15204a]">
          টেস্ট কল শুনুন
        </h1>
        <p className="mx-auto mt-4 max-w-md text-[15px] leading-relaxed text-[#5b647a] lg:mx-0 sm:text-base">
          মাস্কারা দোকানের নাম, বিল বলে, তারপর অপেক্ষা করে। এক চাপলে কনফার্ম, দুই চাপলে
          বাতিল — আপনার স্টোর তাৎক্ষণিক জানে।
        </p>
        <ul className="mx-auto mt-7 max-w-md space-y-3 text-left text-[15px] text-[#15204a] lg:mx-0">
          {BULLETS.map((t) => (
            <li key={t} className="flex gap-3">
              <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[#1a82f5]/12 text-[#1a82f5]">
                <Check className="h-3 w-3" strokeWidth={3} />
              </span>
              <span>{t}</span>
            </li>
          ))}
        </ul>
        <div className="mt-8 flex flex-col items-stretch gap-3 sm:flex-row sm:justify-center lg:justify-start">
          <Link
            href="/register"
            className="land-cta-glow inline-flex min-h-[48px] items-center justify-center gap-2 rounded-2xl bg-[#1a82f5] px-6 py-3 text-[15px] font-semibold text-white transition hover:bg-[#1570d4]"
          >
            Start for Free <ArrowRight className="h-4 w-4 land-arrow" />
          </Link>
          <button
            type="button"
            onClick={() => (playing ? stop() : void startTestCall())}
            className="inline-flex min-h-[48px] items-center justify-center gap-2 rounded-2xl border border-[#d5d9e8] bg-white/90 px-6 py-3 text-[15px] font-semibold text-[#15204a] backdrop-blur-sm transition hover:bg-white"
          >
            {playing ? (
              <>
                <Pause className="h-4 w-4" /> থামান
              </>
            ) : (
              <>
                <Volume2 className="h-4 w-4 text-[#1a82f5]" /> টেস্ট কল শুনুন
              </>
            )}
          </button>
        </div>
        <p className="mt-4 text-sm text-[#8a92a8]">
          No credit card · 50 free AI calls · 14-day trial
        </p>
      </div>

      {/* Center — phone */}
      <div className="land-hero-item land-hero-2 order-2 mx-auto w-full max-w-[17.5rem]">
        <div
          className={`relative overflow-hidden rounded-[2.15rem] bg-[#0b1224] px-4 pb-5 pt-3 shadow-[0_28px_70px_-24px_rgba(11,18,36,0.72)] ring-1 ring-white/10 transition duration-500 ${
            phase !== 'idle' ? 'shadow-[0_28px_80px_-20px_rgba(26,130,245,0.45)]' : ''
          }`}
        >
          <div className="pointer-events-none absolute inset-x-8 top-0 h-24 bg-gradient-to-b from-[#1a82f5]/25 to-transparent" />
          <div className="relative flex items-center justify-between text-[10px] font-medium text-white/70">
            <span>8:41</span>
            <span className="h-1.5 w-7 rounded-full bg-white/85" />
          </div>

          <div className="relative mt-5 flex flex-col items-center text-center">
            <div
              className={`flex h-14 w-14 items-center justify-center rounded-full bg-[#22c55e] shadow-[0_0_0_8px_rgba(34,197,94,0.18)] ${
                phase === 'ringing' || playing ? 'animate-pulse' : ''
              }`}
            >
              <Phone className="h-6 w-6 text-white" />
            </div>
            <p className="mt-4 font-display text-[15px] font-semibold tracking-tight text-white">
              Confirm Order Call
            </p>
            <p className="mt-1 text-[13px] text-white/55">{phoneStatus}</p>
            {phase !== 'idle' && (
              <p className="mt-1 font-mono text-xs tabular-nums text-white/40">
                {mm}:{ss}
              </p>
            )}
          </div>

          <div className="relative mt-5 grid grid-cols-3 gap-2.5 px-0.5">
            {KEYPAD.map((k) => {
              const isAction = k.action === '1' || k.action === '2';
              const enabled = isAction && canChoose;
              const lit = activeKey === k.action;
              return (
                <button
                  key={k.key}
                  type="button"
                  disabled={!enabled}
                  onClick={() => k.action && void pressKey(k.action)}
                  className={`flex h-[3.15rem] flex-col items-center justify-center rounded-full text-white transition duration-200 ${
                    lit
                      ? 'scale-95 bg-[#1a82f5] shadow-[0_0_0_3px_rgba(147,197,253,0.45)]'
                      : isAction && canChoose
                        ? 'bg-white/18 hover:bg-white/28 hover:scale-[1.03]'
                        : 'bg-white/[0.08] text-white/40'
                  } disabled:cursor-default`}
                  aria-label={
                    k.action === '1'
                      ? 'Press 1 Confirm'
                      : k.action === '2'
                        ? 'Press 2 Cancel'
                        : k.key
                  }
                >
                  <span className="text-lg font-semibold leading-none">{k.key}</span>
                  {k.sub && (
                    <span className="mt-0.5 text-[7.5px] font-semibold uppercase tracking-[0.06em] text-white/75">
                      {k.sub}
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          <div className="relative mt-5 flex items-center justify-center">
            {phase === 'idle' ? (
              <button
                type="button"
                onClick={() => void startTestCall()}
                className="flex h-14 w-14 items-center justify-center rounded-full bg-[#22c55e] text-white shadow-[0_8px_24px_-6px_rgba(34,197,94,0.7)] transition hover:brightness-110 active:scale-95"
                aria-label="টেস্ট কল শুনুন"
              >
                <Phone className="h-6 w-6 rotate-[-20deg]" />
              </button>
            ) : (
              <button
                type="button"
                onClick={hangUp}
                className="flex h-14 w-14 items-center justify-center rounded-full bg-[#ef4444] text-white shadow-[0_8px_24px_-6px_rgba(239,68,68,0.65)] transition hover:brightness-110 active:scale-95"
                aria-label="End call"
              >
                <PhoneOff className="h-6 w-6" />
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Right — script flow */}
      <div className="land-hero-item land-hero-3 order-3 relative">
        <div
          className={`rounded-2xl border bg-white/95 p-4 shadow-[0_12px_40px_-28px_rgba(21,32,74,0.35)] backdrop-blur-sm transition duration-300 sm:p-5 ${
            welcomeLive
              ? 'border-[#1a82f5] shadow-[0_0_0_3px_rgba(26,130,245,0.12)]'
              : 'border-[#e6e9f2]'
          }`}
        >
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-gradient-to-br from-[#1a82f5] to-[#0d9488] text-white">
              <Mic className="h-4 w-4" />
            </div>
            <div>
              <p className="text-sm font-semibold text-[#15204a]">Welcome Message</p>
              <p className="text-[11px] text-[#8a92a8]">
                কাস্টমার: সাকিব · দোকান: Shopi
              </p>
            </div>
          </div>
          <p className="mt-3 rounded-xl bg-[#f4f6fb] px-3.5 py-3 text-[13px] leading-relaxed text-[#15204a] sm:text-sm">
            {COPY.welcome}
          </p>
        </div>

        <div
          className="mx-auto my-0.5 hidden h-5 w-px border-l border-dashed border-[#c7ccef] sm:block"
          aria-hidden
        />

        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <button
            type="button"
            onClick={() => void pressKey('1')}
            disabled={!canChoose}
            className={`rounded-2xl border bg-white/95 p-4 text-left shadow-[0_10px_30px_-28px_rgba(21,32,74,0.3)] backdrop-blur-sm transition duration-300 disabled:opacity-55 ${
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
                Confirm — কী বলবে
              </p>
            </div>
            <p className="mt-2 text-[12px] leading-relaxed text-[#5b647a] sm:text-[13px]">
              {COPY.confirm}
            </p>
          </button>

          <button
            type="button"
            onClick={() => void pressKey('2')}
            disabled={!canChoose}
            className={`rounded-2xl border bg-white/95 p-4 text-left shadow-[0_10px_30px_-28px_rgba(21,32,74,0.3)] backdrop-blur-sm transition duration-300 disabled:opacity-55 ${
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
                Cancel — কী বলবে
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
          onClick={() => (playing ? stop() : void startTestCall())}
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
          গ্রিন বাটন বা এখান থেকে শুরু · ফোনে ১ / ২ চাপুন
        </p>
      </div>
    </div>
  );
}
