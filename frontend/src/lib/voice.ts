/** Voices for merchant settings — default matches ManyDial (ElevenLabs Algieba). */
export const VOICE_OPTIONS = [
  {
    id: 'elevenlabs:Algieba',
    label: 'Algieba',
    short: 'Algieba',
    gender: 'male' as const,
    provider: 'ElevenLabs',
    description: 'ManyDial-এর মতো একই প্রাকৃতিক ভয়েস — সবচেয়ে রিয়েল',
    recommended: true,
  },
  {
    id: 'azure:bn-BD-NabanitaNeural',
    label: 'নবনীতা',
    short: 'নবনীতা',
    gender: 'female' as const,
    provider: 'Azure Neural',
    description: 'প্রাকৃতিক বাংলাদেশি নারী ভয়েস',
    recommended: true,
  },
  {
    id: 'azure:bn-BD-PradeepNeural',
    label: 'প্রদীপ',
    short: 'প্রদীপ',
    gender: 'male' as const,
    provider: 'Azure Neural',
    description: 'প্রাকৃতিক বাংলাদেশি পুরুষ ভয়েস',
    recommended: false,
  },
  {
    id: 'google:bn-IN-Chirp3-HD-Algieba',
    label: 'Chirp3 Algieba',
    short: 'Chirp3',
    gender: 'male' as const,
    provider: 'Google Chirp3',
    description: 'Google HD Algieba',
    recommended: false,
  },
  {
    id: 'google:bn-IN-Wavenet-A',
    label: 'WaveNet নারী',
    short: 'WaveNet A',
    gender: 'female' as const,
    provider: 'Google WaveNet',
    description: 'নরম বাংলা নারী ভয়েস',
    recommended: false,
  },
  {
    id: 'google:bn-IN-Wavenet-B',
    label: 'WaveNet পুরুষ',
    short: 'WaveNet B',
    gender: 'male' as const,
    provider: 'Google WaveNet',
    description: 'স্পষ্ট বাংলা পুরুষ ভয়েস',
    recommended: false,
  },
] as const;

export type VoiceOption = (typeof VOICE_OPTIONS)[number];

/** Normalize legacy google_wavenet:* ids saved in DB */
export function normalizeVoiceId(voiceId?: string | null): string {
  if (!voiceId) return VOICE_OPTIONS[0].id;
  const fixed = voiceId.replace(/^google_wavenet:/, 'google:');
  return VOICE_OPTIONS.some((v) => v.id === fixed) ? fixed : voiceId.replace(/^google_wavenet:/, 'google:');
}

export function voiceLabel(voiceId?: string | null) {
  const id = normalizeVoiceId(voiceId);
  return VOICE_OPTIONS.find((v) => v.id === id)?.label || VOICE_OPTIONS[0].label;
}

export function voiceShort(voiceId?: string | null) {
  const id = normalizeVoiceId(voiceId);
  return VOICE_OPTIONS.find((v) => v.id === id)?.short || VOICE_OPTIONS[0].short;
}

export function getVoiceOption(voiceId?: string | null) {
  const id = normalizeVoiceId(voiceId);
  return VOICE_OPTIONS.find((v) => v.id === id) || VOICE_OPTIONS[0];
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
    if (gender === 'male' && /male|man|pradeep|david|ravi|rishi|algieba/i.test(name)) s += 30;
    return s;
  };

  const ranked = [...voices].sort((a, b) => score(b) - score(a));
  return ranked[0]?.lang?.toLowerCase().startsWith('bn') || ranked[0]?.name?.match(/bengali|bangla|বাংলা/i)
    ? ranked[0]
    : ranked.find((v) => score(v) > 0) || ranked[0] || null;
}

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
  const bn = (v?: string) =>
    String(v || '')
      .replace(/#/g, '')
      .replace(/\d/g, (d) => '০১২৩৪৫৬৭৮৯'[Number(d)] ?? d);

  return script
    .replace(/\{\{\s*storeName\s*\}\}/gi, vars.storeName || 'আমাদের স্টোর')
    .replace(/\{\{\s*customerName\s*\}\}/gi, vars.customerName || 'সাকিব')
    .replace(/\{\{\s*amount\s*\}\}/gi, bn(vars.amount) || '১২০০')
    .replace(/\{\{\s*orderNumber\s*\}\}/gi, bn(vars.orderNumber) || '১১৩৮০')
    .replace(/কনফার্ম/gi, 'নিশ্চিত');
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
