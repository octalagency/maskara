/** Convert ASCII digits to Bangla digits for natural TTS. */
export function toBanglaDigits(value: string | number | null | undefined): string {
  if (value == null || value === '') return '';
  return String(value).replace(/\d/g, (d) => '০১২৩৪৫৬৭৮৯'[Number(d)] ?? d);
}

/** Strip Latin words / # that TTS often reads in English. */
export function sanitizeBanglaSpeech(text: string): string {
  return text
    .replace(/#/g, '')
    .replace(/\border\b/gi, 'অর্ডার')
    .replace(/\bpress\s*one\b/gi, 'এক চাপুন')
    .replace(/\bpress\s*1\b/gi, 'এক চাপুন')
    .replace(/\bpress\s*two\b/gi, 'দুই চাপুন')
    .replace(/\bpress\s*2\b/gi, 'দুই চাপুন')
    .replace(/\bconfirm\b/gi, 'নিশ্চিত')
    .replace(/\bcancel(?:led)?\b/gi, 'বাতিল')
    .replace(/\bthank you\b/gi, 'ধন্যবাদ')
    .replace(/\bwelcome\b/gi, '')
    .replace(/\s+/g, ' ')
    .trim();
}

export function buildOrderVerificationPrompt(params: {
  storeName: string;
  customerName?: string;
  orderNumber?: string;
  totalAmount?: number;
  /** Merchant-written script. Supports {{storeName}} {{customerName}} {{orderNumber}} {{amount}} */
  customGreeting?: string | null;
}): string {
  const store = params.storeName || 'স্টোর';
  const name = params.customerName || '';
  const orderNumber = toBanglaDigits(
    String(params.orderNumber || '').replace(/^#/, ''),
  );
  const amount = toBanglaDigits(
    params.totalAmount != null ? String(Math.round(Number(params.totalAmount))) : '',
  );

  if (params.customGreeting?.trim()) {
    const filled = params.customGreeting
      .trim()
      .replace(/\{\{\s*storeName\s*\}\}/gi, store)
      .replace(/\{\{\s*customerName\s*\}\}/gi, name || 'মাননীয় গ্রাহক')
      .replace(/\{\{\s*orderNumber\s*\}\}/gi, orderNumber)
      .replace(/\{\{\s*amount\s*\}\}/gi, amount);
    return sanitizeBanglaSpeech(filled);
  }

  // ManyDial-style natural Bangla COD script (হ্যালো + এক/দুই চাপুন)
  const namePart = name ? name : 'মাননীয় গ্রাহক';
  const amountPart = amount ? `${amount} টাকা` : 'অর্ডার';
  const orderPart = orderNumber ? ` অর্ডার নম্বর ${orderNumber}।` : '';

  return sanitizeBanglaSpeech(
    `হ্যালো ${namePart}, আপনি ${store}-এ অর্ডার করেছিলেন। যার মূল্য ${amountPart}।${orderPart} ` +
      `আপনার অর্ডারটি যদি কনফার্ম হয়, তাহলে এক চাপুন। বাতিল করতে দুই চাপুন।`,
  );
}

/**
 * Voices available via ePBX TTS.
 * Default = ElevenLabs Algieba — same voice ManyDial demo uses (manydial.com).
 */
export const MERCHANT_VOICE_OPTIONS = [
  {
    id: 'elevenlabs:Algieba',
    label: 'Algieba — ManyDial স্টাইল (সবচেয়ে প্রাকৃতিক)',
    provider: 'elevenlabs',
    voiceId: 'Algieba',
  },
  {
    id: 'azure:bn-BD-NabanitaNeural',
    label: 'নবনীতা — Azure বাংলাদেশি নারী',
    provider: 'azure',
    voiceId: 'bn-BD-NabanitaNeural',
  },
  {
    id: 'azure:bn-BD-PradeepNeural',
    label: 'প্রদীপ — Azure বাংলাদেশি পুরুষ',
    provider: 'azure',
    voiceId: 'bn-BD-PradeepNeural',
  },
  {
    id: 'google_wavenet:bn-IN-Chirp3-HD-Algieba',
    label: 'Chirp3 Algieba — Google HD',
    provider: 'google_wavenet',
    voiceId: 'bn-IN-Chirp3-HD-Algieba',
  },
  {
    id: 'google_wavenet:bn-IN-Wavenet-A',
    label: 'Google WaveNet — নারী',
    provider: 'google_wavenet',
    voiceId: 'bn-IN-Wavenet-A',
  },
  {
    id: 'google_wavenet:bn-IN-Wavenet-B',
    label: 'Google WaveNet — পুরুষ',
    provider: 'google_wavenet',
    voiceId: 'bn-IN-Wavenet-B',
  },
] as const;

/** Same voice as https://www.manydial.com/ demo (ElevenLabs Algieba). */
export const DEFAULT_MERCHANT_VOICE_ID = 'elevenlabs:Algieba';

export function parseMerchantVoice(voiceId?: string | null): {
  provider?: string;
  voiceId?: string;
} {
  if (!voiceId?.includes(':')) return {};
  const [provider, ...rest] = voiceId.split(':');
  const id = rest.join(':');
  if (!provider || !id) return {};
  return { provider, voiceId: id };
}

/** Always returns a usable voice (never empty object). */
export function resolveMerchantVoice(voiceId?: string | null): {
  provider: string;
  voiceId: string;
  id: string;
} {
  const parsed = parseMerchantVoice(voiceId);
  if (parsed.provider && parsed.voiceId) {
    return {
      provider: parsed.provider,
      voiceId: parsed.voiceId,
      id: `${parsed.provider}:${parsed.voiceId}`,
    };
  }
  const fallback = parseMerchantVoice(DEFAULT_MERCHANT_VOICE_ID);
  return {
    provider: fallback.provider!,
    voiceId: fallback.voiceId!,
    id: DEFAULT_MERCHANT_VOICE_ID,
  };
}
