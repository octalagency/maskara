/** Convert ASCII digits to Bangla digits for natural TTS. */
export function toBanglaDigits(value: string | number | null | undefined): string {
  if (value == null || value === '') return '';
  return String(value).replace(/\d/g, (d) => '০১২৩৪৫৬৭৮৯'[Number(d)] ?? d);
}

/**
 * Remove English / Banglish so TTS never switches language mid-call.
 */
export function sanitizeBanglaSpeech(text: string): string {
  let out = text
    .replace(/#/g, '')
    // Banglish → Bangla
    .replace(/কনফার্ম|কনফার্মড|কনফার্মড|কনফারম/gi, 'নিশ্চিত')
    .replace(/ক্যান্সেল|ক্যানসেল|ক্যানসেলড/gi, 'বাতিল')
    .replace(/অর্ডারটি\s*যদি\s*নিশ্চিত\s*হয়/g, 'অর্ডারটি নিশ্চিত করতে')
    // English phrases
    .replace(/\border\b/gi, 'অর্ডার')
    .replace(/\bpress\s*(?:one|1)\b/gi, 'এক চাপুন')
    .replace(/\bpress\s*(?:two|2)\b/gi, 'দুই চাপুন')
    .replace(/\bconfirm(?:ed)?\b/gi, 'নিশ্চিত')
    .replace(/\bcancel(?:led)?\b/gi, 'বাতিল')
    .replace(/\bthank you\b/gi, 'ধন্যবাদ')
    .replace(/\bhello\b/gi, 'হ্যালো')
    .replace(/\bhi\b/gi, 'হ্যালো')
    .replace(/\bwelcome\b/gi, '')
    .replace(/\bplease\b/gi, '')
    .replace(/\bcustomer\b/gi, 'গ্রাহক')
    .replace(/\bredex\b/gi, 'রেডেক্স')
    .replace(/\bpathao\b/gi, 'পাঠাও')
    .replace(/\bcourier\b/gi, 'কুরিয়ার')
    // Drop leftover Latin word runs (TTS often reads these in English)
    .replace(/[A-Za-z][A-Za-z0-9+._-]{1,}/g, '')
    .replace(/\s+/g, ' ')
    .replace(/\s+([।,?])/g, '$1')
    .trim();

  return out;
}

export function buildOrderVerificationPrompt(params: {
  storeName: string;
  customerName?: string;
  orderNumber?: string;
  totalAmount?: number;
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

  const namePart = name ? name : 'মাননীয় গ্রাহক';
  const amountPart = amount ? `${amount} টাকা` : 'অর্ডার';
  const orderPart = orderNumber ? ` অর্ডার নম্বর ${orderNumber}।` : '';

  return sanitizeBanglaSpeech(
    `হ্যালো ${namePart}, আপনি ${store}-এ অর্ডার করেছিলেন। যার মূল্য ${amountPart}।${orderPart} ` +
      `অর্ডারটি নিশ্চিত করতে এক চাপুন। বাতিল করতে দুই চাপুন।`,
  );
}

/**
 * Voices via ePBX TTS.
 * Default = Google Chirp3 Algieba (ManyDial-style). ElevenLabs Algieba only
 * works if the ePBX portal has ElevenLabs enabled; otherwise ePBX falls back
 * to Azure নবনীতা (female) — which is why merchants heard the old voice.
 */
export const MERCHANT_VOICE_OPTIONS = [
  {
    id: 'google:bn-IN-Chirp3-HD-Algieba',
    label: 'Algieba — ManyDial স্টাইল (সবচেয়ে প্রাকৃতিক)',
    provider: 'google',
    voiceId: 'bn-IN-Chirp3-HD-Algieba',
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
    id: 'google:bn-IN-Wavenet-A',
    label: 'Google WaveNet — নারী',
    provider: 'google',
    voiceId: 'bn-IN-Wavenet-A',
  },
  {
    id: 'google:bn-IN-Wavenet-B',
    label: 'Google WaveNet — পুরুষ',
    provider: 'google',
    voiceId: 'bn-IN-Wavenet-B',
  },
] as const;

export const DEFAULT_MERCHANT_VOICE_ID = 'google:bn-IN-Chirp3-HD-Algieba';

export function parseMerchantVoice(voiceId?: string | null): {
  provider?: string;
  voiceId?: string;
} {
  if (!voiceId?.includes(':')) return {};
  let [provider, ...rest] = voiceId.split(':');
  const id = rest.join(':');
  if (!provider || !id) return {};

  // Normalize legacy / UI provider aliases for ePBX
  if (provider === 'google_wavenet' || provider === 'google_cloud') {
    provider = 'google';
  }
  if (provider === 'eleven_labs') {
    provider = 'elevenlabs';
  }

  return { provider, voiceId: id };
}

export function resolveMerchantVoice(voiceId?: string | null): {
  provider: string;
  voiceId: string;
  id: string;
} {
  // Legacy saved id: ElevenLabs Algieba isn't enabled on most ePBX accounts,
  // so calls fell back to Azure নবনীতা (female). Map to Chirp3 Algieba.
  if (!voiceId || voiceId === 'elevenlabs:Algieba') {
    const fallback = parseMerchantVoice(DEFAULT_MERCHANT_VOICE_ID);
    return {
      provider: fallback.provider!,
      voiceId: fallback.voiceId!,
      id: DEFAULT_MERCHANT_VOICE_ID,
    };
  }

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
