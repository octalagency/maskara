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
    .replace(/কনফার্ম|কনফার্মড|কনফার্মড|কনফারম/gi, 'নিশ্চিত')
    .replace(/ক্যান্সেল|ক্যানসেল|ক্যানসেলড/gi, 'বাতিল')
    .replace(/অর্ডারটি\s*যদি\s*নিশ্চিত\s*হয়/g, 'অর্ডারটি নিশ্চিত করতে')
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
    .replace(/[A-Za-z][A-Za-z0-9+._-]{1,}/g, '')
    .replace(/\s+/g, ' ')
    .replace(/\s+([।,?])/g, '$1')
    .trim();

  return out;
}

/**
 * Default merchant call script (কল স্ক্রিপ্ট).
 * Placeholders: {{customerName}}, {{storeName}}, {{amount}}, {{orderNumber}}.
 * No {{items}}/{{productName}} support yet — wording uses store + amount.
 * Ends with “০ চাপুন” so DTMF 0 can replay the prompt.
 */
export const DEFAULT_CALL_SCRIPT =
  'হ্যালো {{customerName}}, আপনি {{storeName}}-এ অর্ডার করেছেন। আপনার মোট বিল {{amount}} টাকা। অর্ডারটি নিশ্চিত করার জন্য ১ চাপুন অথবা বাতিল করার জন্য ২ চাপুন। আমরা ঢাকার বাইরে ২ থেকে ৩ দিনের ডেলিভারি দিয়ে থাকি এবং ঢাকার মধ্যে ১ থেকে ২ দিনের মধ্যে ডেলিভারি দেওয়া হয়। আমাদের সাথে থাকার জন্য ধন্যবাদ। পুনরায় শুনতে ০ চাপুন।';

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

  const template = params.customGreeting?.trim() || DEFAULT_CALL_SCRIPT;
  const filled = template
    .replace(/\{\{\s*storeName\s*\}\}/gi, store)
    .replace(/\{\{\s*customerName\s*\}\}/gi, name || 'মাননীয় গ্রাহক')
    .replace(/\{\{\s*orderNumber\s*\}\}/gi, orderNumber)
    .replace(/\{\{\s*amount\s*\}\}/gi, amount);
  return sanitizeBanglaSpeech(filled);
}

/** Curated Google Chirp3 HD voices (bn-IN) + Azure fallbacks. */
export const MERCHANT_VOICE_OPTIONS = [
  {
    id: 'google:bn-IN-Chirp3-HD-Algieba',
    label: 'Algieba — Chirp3 পুরুষ',
    provider: 'google',
    voiceId: 'bn-IN-Chirp3-HD-Algieba',
    languageCode: 'bn-IN',
    gender: 'male',
  },
  {
    id: 'google:bn-IN-Chirp3-HD-Achird',
    label: 'Achird — Chirp3 পুরুষ',
    provider: 'google',
    voiceId: 'bn-IN-Chirp3-HD-Achird',
    languageCode: 'bn-IN',
    gender: 'male',
  },
  {
    id: 'google:bn-IN-Chirp3-HD-Fenrir',
    label: 'Fenrir — Chirp3 পুরুষ',
    provider: 'google',
    voiceId: 'bn-IN-Chirp3-HD-Fenrir',
    languageCode: 'bn-IN',
    gender: 'male',
  },
  {
    id: 'google:bn-IN-Chirp3-HD-Orus',
    label: 'Orus — Chirp3 পুরুষ',
    provider: 'google',
    voiceId: 'bn-IN-Chirp3-HD-Orus',
    languageCode: 'bn-IN',
    gender: 'male',
  },
  {
    id: 'google:bn-IN-Chirp3-HD-Puck',
    label: 'Puck — Chirp3 পুরুষ',
    provider: 'google',
    voiceId: 'bn-IN-Chirp3-HD-Puck',
    languageCode: 'bn-IN',
    gender: 'male',
  },
  {
    id: 'google:bn-IN-Chirp3-HD-Achernar',
    label: 'Achernar — Chirp3 নারী',
    provider: 'google',
    voiceId: 'bn-IN-Chirp3-HD-Achernar',
    languageCode: 'bn-IN',
    gender: 'female',
  },
  {
    id: 'google:bn-IN-Chirp3-HD-Aoede',
    label: 'Aoede — Chirp3 নারী',
    provider: 'google',
    voiceId: 'bn-IN-Chirp3-HD-Aoede',
    languageCode: 'bn-IN',
    gender: 'female',
  },
  {
    id: 'google:bn-IN-Chirp3-HD-Kore',
    label: 'Kore — Chirp3 নারী',
    provider: 'google',
    voiceId: 'bn-IN-Chirp3-HD-Kore',
    languageCode: 'bn-IN',
    gender: 'female',
  },
  {
    id: 'google:bn-IN-Chirp3-HD-Leda',
    label: 'Leda — Chirp3 নারী',
    provider: 'google',
    voiceId: 'bn-IN-Chirp3-HD-Leda',
    languageCode: 'bn-IN',
    gender: 'female',
  },
  {
    id: 'azure:bn-BD-PradeepNeural',
    label: 'প্রদীপ — Azure পুরুষ',
    provider: 'azure',
    voiceId: 'bn-BD-PradeepNeural',
    gender: 'male',
  },
  {
    id: 'azure:bn-BD-NabanitaNeural',
    label: 'নবনীতা — Azure নারী',
    provider: 'azure',
    voiceId: 'bn-BD-NabanitaNeural',
    gender: 'female',
  },
] as const;

export const DEFAULT_MERCHANT_VOICE_ID = 'google:bn-IN-Chirp3-HD-Algieba';
export const AZURE_FALLBACK_VOICE_ID = 'azure:bn-BD-PradeepNeural';
export const DEFAULT_SPEECH_RATE = 1.05;

export function clampSpeechRate(rate?: number | null): number {
  const n = Number(rate);
  if (!Number.isFinite(n)) return DEFAULT_SPEECH_RATE;
  return Math.min(1.35, Math.max(0.75, Math.round(n * 100) / 100));
}

export function parseMerchantVoice(voiceId?: string | null): {
  provider?: string;
  voiceId?: string;
} {
  if (!voiceId?.includes(':')) return {};
  let [provider, ...rest] = voiceId.split(':');
  const id = rest.join(':');
  if (!provider || !id) return {};

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
  languageCode?: string;
  useGoogleDirect?: boolean;
} {
  const parsed = parseMerchantVoice(voiceId);
  const known = MERCHANT_VOICE_OPTIONS.find((v) => v.id === voiceId);

  if (known) {
    return {
      provider: known.provider,
      voiceId: known.voiceId,
      id: known.id,
      languageCode: 'languageCode' in known ? known.languageCode : undefined,
      useGoogleDirect: known.provider === 'google',
    };
  }

  // Any other Chirp3 HD voice name
  if (
    parsed.provider === 'google' &&
    parsed.voiceId &&
    /Chirp3-HD-/i.test(parsed.voiceId)
  ) {
    return {
      provider: 'google',
      voiceId: parsed.voiceId,
      id: `google:${parsed.voiceId}`,
      languageCode: 'bn-IN',
      useGoogleDirect: true,
    };
  }

  if (!voiceId || /algieba|elevenlabs/i.test(voiceId)) {
    return {
      provider: 'google',
      voiceId: 'bn-IN-Chirp3-HD-Algieba',
      id: DEFAULT_MERCHANT_VOICE_ID,
      languageCode: 'bn-IN',
      useGoogleDirect: true,
    };
  }

  if (/nabanita/i.test(voiceId || '')) {
    return {
      provider: 'azure',
      voiceId: 'bn-BD-NabanitaNeural',
      id: 'azure:bn-BD-NabanitaNeural',
    };
  }

  if (/pradeep/i.test(voiceId || '')) {
    return {
      provider: 'azure',
      voiceId: 'bn-BD-PradeepNeural',
      id: 'azure:bn-BD-PradeepNeural',
    };
  }

  return {
    provider: 'azure',
    voiceId: 'bn-BD-PradeepNeural',
    id: AZURE_FALLBACK_VOICE_ID,
  };
}

export function azureFallbackFor(voiceId?: string | null): {
  provider: string;
  voiceId: string;
  id: string;
} {
  const resolved = resolveMerchantVoice(voiceId);
  if (resolved.provider === 'azure') {
    return {
      provider: resolved.provider,
      voiceId: resolved.voiceId,
      id: resolved.id,
    };
  }
  if (
    /nabanita|wavenet-a|achernar|aoede|kore|leda|female/i.test(voiceId || '') &&
    !/pradeep|algieba|achird|fenrir|orus|puck/i.test(voiceId || '')
  ) {
    return {
      provider: 'azure',
      voiceId: 'bn-BD-NabanitaNeural',
      id: 'azure:bn-BD-NabanitaNeural',
    };
  }
  return {
    provider: 'azure',
    voiceId: 'bn-BD-PradeepNeural',
    id: AZURE_FALLBACK_VOICE_ID,
  };
}
