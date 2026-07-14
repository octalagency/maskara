/** Voices — Google Chirp3 when API key connected; Azure always works via ePBX. */
export const VOICE_OPTIONS = [
  {
    id: 'google:bn-IN-Chirp3-HD-Algieba',
    label: 'Algieba',
    short: 'Algieba',
    gender: 'male' as const,
    provider: 'Google Chirp3',
    description: 'ManyDial স্টাইল — সেরা পুরুষ কল-সেন্টার (ডিফল্ট)',
    recommended: true,
    requiresGoogleTts: true,
  },
  {
    id: 'google:bn-IN-Chirp3-HD-Achird',
    label: 'Achird',
    short: 'Achird',
    gender: 'male' as const,
    provider: 'Google Chirp3',
    description: 'স্পষ্ট পুরুষ ভয়েস',
    recommended: false,
    requiresGoogleTts: true,
  },
  {
    id: 'google:bn-IN-Chirp3-HD-Fenrir',
    label: 'Fenrir',
    short: 'Fenrir',
    gender: 'male' as const,
    provider: 'Google Chirp3',
    description: 'গভীর পুরুষ ভয়েস',
    recommended: false,
    requiresGoogleTts: true,
  },
  {
    id: 'google:bn-IN-Chirp3-HD-Orus',
    label: 'Orus',
    short: 'Orus',
    gender: 'male' as const,
    provider: 'Google Chirp3',
    description: 'নরম কল-সেন্টার পুরুষ — শক্তিশালী বিকল্প',
    recommended: false,
    requiresGoogleTts: true,
  },
  {
    id: 'google:bn-IN-Chirp3-HD-Puck',
    label: 'Puck',
    short: 'Puck',
    gender: 'male' as const,
    provider: 'Google Chirp3',
    description: 'হালকা/চাপাচাপি পুরুষ টোন',
    recommended: false,
    requiresGoogleTts: true,
  },
  {
    id: 'google:bn-IN-Chirp3-HD-Achernar',
    label: 'Achernar',
    short: 'Achernar',
    gender: 'female' as const,
    provider: 'Google Chirp3',
    description: 'প্রাকৃতিক নারী ভয়েস',
    recommended: false,
    requiresGoogleTts: true,
  },
  {
    id: 'google:bn-IN-Chirp3-HD-Aoede',
    label: 'Aoede',
    short: 'Aoede',
    gender: 'female' as const,
    provider: 'Google Chirp3',
    description: 'মিষ্টি নারী ভয়েস',
    recommended: false,
    requiresGoogleTts: true,
  },
  {
    id: 'google:bn-IN-Chirp3-HD-Kore',
    label: 'Kore',
    short: 'Kore',
    gender: 'female' as const,
    provider: 'Google Chirp3',
    description: 'স্পষ্ট নারী ভয়েস',
    recommended: false,
    requiresGoogleTts: true,
  },
  {
    id: 'google:bn-IN-Chirp3-HD-Leda',
    label: 'Leda',
    short: 'Leda',
    gender: 'female' as const,
    provider: 'Google Chirp3',
    description: 'নরম নারী ভয়েস',
    recommended: false,
    requiresGoogleTts: true,
  },
  {
    id: 'azure:bn-BD-PradeepNeural',
    label: 'প্রদীপ',
    short: 'প্রদীপ',
    gender: 'male' as const,
    provider: 'Azure Neural',
    description: 'বাংলাদেশি পুরুষ — ePBX ফলব্যাক',
    recommended: false,
    requiresGoogleTts: false,
  },
  {
    id: 'azure:bn-BD-NabanitaNeural',
    label: 'নবনীতা',
    short: 'নবনীতা',
    gender: 'female' as const,
    provider: 'Azure Neural',
    description: 'লিগ্যাসি — লাইভ কলে আর ব্যবহার হয় না (Algieba-তে মাইগ্রেট)',
    recommended: false,
    requiresGoogleTts: false,
  },
] as const;

export type VoiceOption = (typeof VOICE_OPTIONS)[number];

export const GOOGLE_VOICE = 'google:bn-IN-Chirp3-HD-Algieba';
export const AZURE_MALE_VOICE = 'azure:bn-BD-PradeepNeural';
/** Slightly under 1.0 for clearer, warmer call-center pacing. */
export const DEFAULT_SPEECH_RATE = 0.95;

const DEFAULT_VOICE = GOOGLE_VOICE;

const KNOWN_IDS = new Set(VOICE_OPTIONS.map((v) => v.id));

export function clampSpeechRate(rate?: number | null): number {
  const n = Number(rate);
  if (!Number.isFinite(n)) return DEFAULT_SPEECH_RATE;
  return Math.min(1.35, Math.max(0.75, Math.round(n * 100) / 100));
}

export function speechRateLabel(rate?: number | null): string {
  const r = clampSpeechRate(rate);
  if (r <= 0.85) return 'ধীরে';
  if (r >= 1.1) return 'দ্রুত';
  return 'স্বাভাবিক';
}

export function normalizeVoiceId(voiceId?: string | null): string {
  if (!voiceId) return DEFAULT_VOICE;
  // Live product default is Chirp3 Algieba — auto-migrate Azure নবনীতা away
  if (/nabanita/i.test(voiceId)) return GOOGLE_VOICE;
  if (KNOWN_IDS.has(voiceId as VoiceOption['id'])) return voiceId;
  if (/pradeep/i.test(voiceId)) return 'azure:bn-BD-PradeepNeural';
  if (/algieba|elevenlabs/i.test(voiceId)) return 'google:bn-IN-Chirp3-HD-Algieba';
  if (/achird/i.test(voiceId)) return 'google:bn-IN-Chirp3-HD-Achird';
  if (/fenrir/i.test(voiceId)) return 'google:bn-IN-Chirp3-HD-Fenrir';
  if (/orus/i.test(voiceId)) return 'google:bn-IN-Chirp3-HD-Orus';
  if (/puck/i.test(voiceId)) return 'google:bn-IN-Chirp3-HD-Puck';
  if (/achernar/i.test(voiceId)) return 'google:bn-IN-Chirp3-HD-Achernar';
  if (/aoede/i.test(voiceId)) return 'google:bn-IN-Chirp3-HD-Aoede';
  if (/kore/i.test(voiceId)) return 'google:bn-IN-Chirp3-HD-Kore';
  if (/leda/i.test(voiceId)) return 'google:bn-IN-Chirp3-HD-Leda';
  if (/chirp3/i.test(voiceId) && voiceId.includes(':')) return voiceId;
  return DEFAULT_VOICE;
}

/** Hide Chirp3 when Google TTS key is not configured. */
export function voiceOptionsForConfig(googleTtsConfigured?: boolean): VoiceOption[] {
  if (googleTtsConfigured === false) {
    return VOICE_OPTIONS.filter((v) => !('requiresGoogleTts' in v && v.requiresGoogleTts)).map(
      (v, i) => (i === 0 ? { ...v, recommended: true } : { ...v, recommended: false }),
    ) as unknown as VoiceOption[];
  }
  return [...VOICE_OPTIONS] as unknown as VoiceOption[];
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

/** Azure Neural twin used on live ePBX when Chirp3 MP3 is ignored. */
export function azureTwinLabel(voiceId?: string | null): {
  id: string;
  label: string;
  gender: 'male' | 'female';
} {
  const selected = getVoiceOption(voiceId);
  // Soft-migrated নবনীতা → Algieba (male) — same as backend azureTwinForMerchantVoice
  if (/nabanita/i.test(voiceId || '') || selected.gender === 'male') {
    return {
      id: AZURE_MALE_VOICE,
      label: 'প্রদীপ (Azure)',
      gender: 'male',
    };
  }
  return {
    id: 'azure:bn-BD-NabanitaNeural',
    label: 'নবনীতা (Azure)',
    gender: 'female',
  };
}

let previewAudio: HTMLAudioElement | null = null;

export function stopBanglaPreview() {
  if (typeof window === 'undefined') return;
  window.speechSynthesis?.cancel();
  if (previewAudio) {
    previewAudio.pause();
    previewAudio.src = '';
    previewAudio = null;
  }
}

export function playPreviewAudio(
  audioBase64: string,
  mimeType = 'audio/mpeg',
  onEnd?: () => void,
): boolean {
  if (typeof window === 'undefined') return false;
  stopBanglaPreview();
  try {
    const src = `data:${mimeType};base64,${audioBase64}`;
    const audio = new Audio(src);
    previewAudio = audio;
    audio.onended = () => {
      previewAudio = null;
      onEnd?.();
    };
    audio.onerror = () => {
      previewAudio = null;
      onEnd?.();
    };
    void audio.play().catch(() => onEnd?.());
    return true;
  } catch {
    onEnd?.();
    return false;
  }
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

  stopBanglaPreview();
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
    window.setTimeout(applyVoiceAndSpeak, 250);
  } else {
    window.setTimeout(applyVoiceAndSpeak, 120);
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
