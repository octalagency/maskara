/** Most natural Bangla voices for Bangladesh — Azure Neural first */
export const VOICE_OPTIONS = [
  {
    id: 'azure:bn-BD-NabanitaNeural',
    label: 'নবনীতা',
    short: 'নবনীতা',
    gender: 'female' as const,
    provider: 'Azure Neural',
    description: 'সবচেয়ে প্রাকৃতিক বাংলাদেশি নারী ভয়েস — রিয়েল মানুষের মতো',
    recommended: true,
  },
  {
    id: 'azure:bn-BD-PradeepNeural',
    label: 'প্রদীপ',
    short: 'প্রদীপ',
    gender: 'male' as const,
    provider: 'Azure Neural',
    description: 'সবচেয়ে প্রাকৃতিক বাংলাদেশি পুরুষ ভয়েস — পরিষ্কার ও গম্ভীর',
    recommended: true,
  },
  {
    id: 'google_wavenet:bn-IN-Wavenet-A',
    label: 'WaveNet নারী',
    short: 'WaveNet A',
    gender: 'female' as const,
    provider: 'Google WaveNet',
    description: 'নরম বাংলা নারী ভয়েস (ভারতীয় উচ্চারণ)',
    recommended: false,
  },
  {
    id: 'google_wavenet:bn-IN-Wavenet-B',
    label: 'WaveNet পুরুষ',
    short: 'WaveNet B',
    gender: 'male' as const,
    provider: 'Google WaveNet',
    description: 'স্পষ্ট বাংলা পুরুষ ভয়েস (ভারতীয় উচ্চারণ)',
    recommended: false,
  },
  {
    id: 'google_wavenet:bn-IN-Chirp3-HD-Zubenelgenubi',
    label: 'Chirp3 HD',
    short: 'Chirp3 HD',
    gender: 'male' as const,
    provider: 'Google Chirp3',
    description: 'উচ্চমানের HD পুরুষ ভয়েস',
    recommended: false,
  },
] as const;

export type VoiceOption = (typeof VOICE_OPTIONS)[number];

export function voiceLabel(voiceId?: string | null) {
  return VOICE_OPTIONS.find((v) => v.id === voiceId)?.label || VOICE_OPTIONS[0].label;
}

export function voiceShort(voiceId?: string | null) {
  return VOICE_OPTIONS.find((v) => v.id === voiceId)?.short || VOICE_OPTIONS[0].short;
}

export function getVoiceOption(voiceId?: string | null) {
  return VOICE_OPTIONS.find((v) => v.id === voiceId) || VOICE_OPTIONS[0];
}

export function pickBrowserVoice(gender: 'male' | 'female') {
  if (typeof window === 'undefined' || !window.speechSynthesis) return null;
  const voices = window.speechSynthesis.getVoices();
  if (!voices.length) return null;

  const score = (v: SpeechSynthesisVoice) => {
    const name = v.name.toLowerCase();
    const lang = v.lang.toLowerCase();
    let s = 0;
    if (lang.startsWith('bn-bd')) s += 100;
    else if (lang.startsWith('bn')) s += 80;
    else if (name.includes('bengali') || name.includes('bangla') || name.includes('বাংলা')) s += 70;
    if (gender === 'female' && /female|woman|nabanita|zira|samantha|veena|heera/i.test(name)) s += 30;
    if (gender === 'male' && /male|man|pradeep|david|ravi|rishi/i.test(name)) s += 30;
    if (lang.startsWith('bn-in') && gender === 'female') s += 10;
    if (lang.startsWith('bn-in') && gender === 'male') s += 10;
    return s;
  };

  const ranked = [...voices].sort((a, b) => score(b) - score(a));
  return ranked[0]?.lang?.toLowerCase().startsWith('bn') || ranked[0]?.name?.match(/bengali|bangla|বাংলা/i)
    ? ranked[0]
    : ranked.find((v) => score(v) > 0) || ranked[0] || null;
}

/** Speak exact Bangla text (script as written after placeholder fill). */
export function speakBangla(
  text: string,
  voiceId?: string | null,
  onEnd?: () => void,
) {
  if (typeof window === 'undefined' || !window.speechSynthesis) return false;
  const clean = text.replace(/\s+/g, ' ').trim();
  if (!clean) return false;

  window.speechSynthesis.cancel();
  const selected = getVoiceOption(voiceId);
  const utter = new SpeechSynthesisUtterance(clean);
  utter.lang = 'bn-BD';
  // Slightly slower = more human / clear for Bangla
  utter.rate = selected.gender === 'female' ? 0.9 : 0.88;
  utter.pitch = selected.gender === 'female' ? 1.05 : 0.95;
  utter.volume = 1;

  const applyVoiceAndSpeak = () => {
    const voice = pickBrowserVoice(selected.gender);
    if (voice) {
      utter.voice = voice;
      if (voice.lang) utter.lang = voice.lang;
    }
    utter.onend = () => onEnd?.();
    utter.onerror = () => onEnd?.();
    window.speechSynthesis.speak(utter);
  };

  // Chrome often needs getVoices() warm-up
  const voices = window.speechSynthesis.getVoices();
  if (!voices.length) {
    window.speechSynthesis.onvoiceschanged = () => {
      window.speechSynthesis.onvoiceschanged = null;
      applyVoiceAndSpeak();
    };
    window.setTimeout(applyVoiceAndSpeak, 200);
  } else {
    window.setTimeout(applyVoiceAndSpeak, 40);
  }
  return true;
}

export function fillVoiceScript(
  script: string,
  vars: { storeName?: string; customerName?: string; amount?: string; orderNumber?: string },
) {
  return script
    .replace(/\{\{\s*storeName\s*\}\}/gi, vars.storeName || 'আমাদের স্টোর')
    .replace(/\{\{\s*customerName\s*\}\}/gi, vars.customerName || 'রহিম')
    .replace(/\{\{\s*amount\s*\}\}/gi, vars.amount || '১২০০')
    .replace(/\{\{\s*orderNumber\s*\}\}/gi, vars.orderNumber || '#11380');
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
