'use client';

import { useEffect, useRef, useState } from 'react';
import { Mic, Phone, PhoneOff, Pause, Volume2 } from 'lucide-react';

type Clip = 'welcome' | 'confirm' | 'cancel';
type Phase = 'idle' | 'ringing' | 'welcome' | 'branch' | 'done';

const API_BASE =
  process.env.NEXT_PUBLIC_API_URL?.replace(/\/$/, '') || 'https://api.maskara.bd';

/** Demo script — customer: সাকিব, shop: Shopi */
const COPY = {
  welcome:
    'হ্যালো সাকিব, আপনি Shopi থেকে পাঁচ আগস্ট দুই হাজার ছাব্বিশ তারিখে এক কেজি মধু অর্ডার করেছিলেন। যার মূল্য এক হাজার দুইশ টাকা। আপনার অর্ডারটি যদি কনফার্ম হয়, তাহলে এক চাপুন। বাতিল করতে দুই চাপুন।',
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
    if (playing && phase === 'welcome') {
      // allow barge-in during welcome
      stop();
    }
    setActiveKey(key);
    setPhase('branch');
    await playClip(key === '1' ? 'confirm' : 'cancel');
    setPhase('done');
  }

  const canPress = phase === 'welcome' || phase === 'branch';
  const mm = String(Math.floor(elapsed / 60)).padStart(1, '0');
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

  return (
    <div className="mx-auto w-full max-w-xl lg:max-w-none">
      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,18rem)_1fr] lg:gap-8">
        {/* Phone + keypad (ManyDial style) */}
        <div className="mx-auto w-full max-w-[18rem]">
          <div className="relative overflow-hidden rounded-[2rem] bg-[#0b1224] px-4 pb-5 pt-3 shadow-[0_24px_60px_-28px_rgba(11,18,36,0.65)]">
            <div className="flex items-center justify-between text-[10px] font-medium text-white/70">
              <span>8:41</span>
              <span className="h-1.5 w-6 rounded-full bg-white/80" />
            </div>

            <div className="mt-6 flex flex-col items-center text-center">
              <div
                className={`flex h-14 w-14 items-center justify-center rounded-full bg-[#22c55e] ${
                  phase === 'ringing' || playing ? 'animate-pulse' : ''
                }`}
              >
                <Phone className="h-6 w-6 text-white" />
              </div>
              <p className="mt-4 font-display text-base font-semibold tracking-tight text-white">
                Confirm Order Call
              </p>
              <p className="mt-1 text-sm text-white/55">{phoneStatus}</p>
              {phase !== 'idle' && (
                <p className="mt-1 font-mono text-xs text-white/40">
                  {mm}:{ss}
                </p>
              )}
            </div>

            {/* Keypad — 1 & 2 pressable */}
            <div className="mt-5 grid grid-cols-3 gap-2.5 px-1">
              {KEYPAD.map((k) => {
                const isAction = k.action === '1' || k.action === '2';
                // 1/2 during welcome (barge-in) or after welcome until a choice is made
                const enabled =
                  isAction &&
                  (phase === 'welcome' ||
                    (phase === 'branch' && !activeKey));
                const lit = activeKey === k.action;
                return (
                  <button
                    key={k.key}
                    type="button"
                    disabled={!enabled}
                    onClick={() => k.action && pressKey(k.action)}
                    className={`flex h-12 flex-col items-center justify-center rounded-full text-white transition ${
                      lit
                        ? 'bg-[#1a82f5] ring-2 ring-[#93c5fd]'
                        : isAction && canPress
                          ? 'bg-white/15 hover:bg-white/25'
                          : 'bg-white/8 text-white/45'
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
                      <span className="mt-0.5 text-[8px] font-medium uppercase tracking-wide text-white/70">
                        {k.sub}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>

            <div className="mt-5 flex items-center justify-center">
              {phase === 'idle' ? (
                <button
                  type="button"
                  onClick={() => void startTestCall()}
                  className="flex h-14 w-14 items-center justify-center rounded-full bg-[#22c55e] text-white transition hover:brightness-110"
                  aria-label="টেস্ট কল শুনুন"
                >
                  <Phone className="h-6 w-6 rotate-[-20deg]" />
                </button>
              ) : (
                <button
                  type="button"
                  onClick={hangUp}
                  className="flex h-14 w-14 items-center justify-center rounded-full bg-[#ef4444] text-white transition hover:brightness-110"
                  aria-label="End call"
                >
                  <PhoneOff className="h-6 w-6" />
                </button>
              )}
            </div>
          </div>
        </div>

        {/* IVR copy — what 1 / 2 say */}
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
              <div>
                <p className="text-sm font-semibold text-[#15204a]">Welcome Message</p>
                <p className="text-[11px] text-[#8a92a8]">
                  কাস্টমার: সাকিব · দোকান: Shopi · তারিখ: ৫ আগস্ট ২০২৬
                </p>
              </div>
            </div>
            <p className="mt-3 rounded-xl bg-[#f4f6fb] px-3.5 py-3 text-[13px] leading-relaxed text-[#15204a] sm:text-sm">
              {COPY.welcome}
            </p>
          </div>

          <div
            className="mx-auto my-1 hidden h-6 w-px border-l border-dashed border-[#c7ccef] sm:block"
            aria-hidden
          />

          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <button
              type="button"
              onClick={() => void pressKey('1')}
              disabled={
                !(
                  phase === 'welcome' ||
                  (phase === 'branch' && !activeKey)
                )
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
              disabled={
                !(
                  phase === 'welcome' ||
                  (phase === 'branch' && !activeKey)
                )
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
    </div>
  );
}
