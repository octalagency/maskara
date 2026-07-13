/** Voices that actually work on Maskara's ePBX account (Azure Neural only). */
export const VOICE_OPTIONS = [
  {
    id: 'azure:bn-BD-PradeepNeural',
    label: 'প্রদীপ',
    short: 'প্রদীপ',
    gender: 'male' as const,
    provider: 'Azure Neural',
    description: 'বাংলাদেশি পুরুষ ভয়েস — রিয়েল কলে এটাই যায়',
    recommended: true,
  },
  {
    id: 'azure:bn-BD-NabanitaNeural',
    label: 'নবনীতা',
    short: 'নবনীতা',
    gender: 'female' as const,
    provider: 'Azure Neural',
    description: 'বাংলাদেশি নারী ভয়েস',
    recommended: false,
  },
] as const;

export type VoiceOption = (typeof VOICE_OPTIONS)[number];

const DEFAULT_VOICE = 'azure:bn-BD-PradeepNeural';

/** Map legacy Google/ElevenLabs picks → Azure (ePBX ignores non-Azure). */
export function normalizeVoiceId(voiceId?: string | null): string {
  if (!voiceId) return DEFAULT_VOICE;
  if (voiceId === 'azure:bn-BD-NabanitaNeural') return voiceId;
  if (voiceId === 'azure:bn-BD-PradeepNeural') return voiceId;
  // Old Algieba / Chirp3 / WaveNet / ElevenLabs → male Pradeep
  if (
    /nabanita|wavenet-a/i.test(voiceId) &&
    !/pradeep|algieba|wavenet-b/i.test(voiceId)
  ) {
    // only map clear female ids
    if (/nabanita|wavenet-a/i.test(voiceId)) return 'azure:bn-BD-NabanitaNeural';
  }
  if (/nabanita/i.test(voiceId)) return 'azure:bn-BD-NabanitaNeural';
  return DEFAULT_VOICE;
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

/** Play base64 audio from /voice/preview */
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
