/** Shared Bangla voice presets — mirrors backend MERCHANT_VOICE_OPTIONS */
export const VOICE_OPTIONS = [
  {
    id: 'azure:bn-BD-NabanitaNeural',
    label: 'নবনীতা — Azure Neural (বাংলাদেশি নারী)',
    short: 'নবনীতা',
    gender: 'female' as const,
    provider: 'Azure',
  },
  {
    id: 'azure:bn-BD-PradeepNeural',
    label: 'প্রদীপ — Azure Neural (বাংলাদেশি পুরুষ)',
    short: 'প্রদীপ',
    gender: 'male' as const,
    provider: 'Azure',
  },
  {
    id: 'google_wavenet:bn-IN-Chirp3-HD-Zubenelgenubi',
    label: 'Chirp3 HD — Google (পুরুষ)',
    short: 'Chirp3 HD',
    gender: 'male' as const,
    provider: 'Google',
  },
  {
    id: 'google_wavenet:bn-IN-Wavenet-A',
    label: 'WaveNet A — Google (নারী)',
    short: 'WaveNet A',
    gender: 'female' as const,
    provider: 'Google',
  },
  {
    id: 'google_wavenet:bn-IN-Wavenet-B',
    label: 'WaveNet B — Google (পুরুষ)',
    short: 'WaveNet B',
    gender: 'male' as const,
    provider: 'Google',
  },
] as const;

export function voiceLabel(voiceId?: string | null) {
  return VOICE_OPTIONS.find((v) => v.id === voiceId)?.label || VOICE_OPTIONS[0].label;
}

export function voiceShort(voiceId?: string | null) {
  return VOICE_OPTIONS.find((v) => v.id === voiceId)?.short || VOICE_OPTIONS[0].short;
}

export function pickBrowserVoice(gender: 'male' | 'female') {
  if (typeof window === 'undefined' || !window.speechSynthesis) return null;
  const voices = window.speechSynthesis.getVoices();
  const bangla = voices.filter(
    (v) =>
      v.lang.toLowerCase().startsWith('bn') ||
      v.name.toLowerCase().includes('bengali') ||
      v.name.toLowerCase().includes('bangla'),
  );
  const pool = bangla.length ? bangla : voices;
  if (!pool.length) return null;
  const gendered = pool.find((v) =>
    gender === 'female'
      ? /female|woman|zira|samantha|nabanita|veena|বাংলা/i.test(v.name)
      : /male|man|david|ravi|pradeep|हिन्दी|bn-in/i.test(v.name),
  );
  return gendered || pool[0];
}

export function speakBangla(
  text: string,
  voiceId?: string | null,
  onEnd?: () => void,
) {
  if (typeof window === 'undefined' || !window.speechSynthesis) return false;
  window.speechSynthesis.cancel();
  const selected = VOICE_OPTIONS.find((v) => v.id === voiceId) || VOICE_OPTIONS[0];
  const utter = new SpeechSynthesisUtterance(text);
  utter.lang = 'bn-BD';
  utter.rate = 0.92;
  utter.pitch = selected.gender === 'female' ? 1.08 : 0.92;
  const voice = pickBrowserVoice(selected.gender);
  if (voice) utter.voice = voice;
  utter.onend = () => onEnd?.();
  utter.onerror = () => onEnd?.();
  window.setTimeout(() => window.speechSynthesis.speak(utter), 80);
  return true;
}

export function dateRangeForPeriod(
  period: 'today' | 'yesterday' | 'week' | 'month' | 'all',
): { from?: string; to?: string } {
  const now = new Date();
  const startOfDay = (d: Date) => {
    const x = new Date(d);
    x.setHours(0, 0, 0, 0);
    return x;
  };
  const endOfDay = (d: Date) => {
    const x = new Date(d);
    x.setHours(23, 59, 59, 999);
    return x;
  };

  if (period === 'all') return {};
  if (period === 'today') {
    return { from: startOfDay(now).toISOString(), to: endOfDay(now).toISOString() };
  }
  if (period === 'yesterday') {
    const y = new Date(now);
    y.setDate(y.getDate() - 1);
    return { from: startOfDay(y).toISOString(), to: endOfDay(y).toISOString() };
  }
  if (period === 'week') {
    const from = startOfDay(now);
    from.setDate(from.getDate() - 6);
    return { from: from.toISOString(), to: endOfDay(now).toISOString() };
  }
  const from = startOfDay(now);
  from.setDate(1);
  return { from: from.toISOString(), to: endOfDay(now).toISOString() };
}
