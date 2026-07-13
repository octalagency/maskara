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
 * Merchant voice options.
 * Chirp3 Algieba is synthesized by Maskara via Google Cloud TTS (not ePBX Google fields).
 * Azure voices are the ePBX-native fallback when Google TTS is unavailable.
 */
export const MERCHANT_VOICE_OPTIONS = [
  {
    id: 'google:bn-IN-Chirp3-HD-Algieba',
    label: 'Algieba — Google Chirp3 পুরুষ',
    provider: 'google',
    voiceId: 'bn-IN-Chirp3-HD-Algieba',
    languageCode: 'bn-IN',
  },
  {
    id: 'azure:bn-BD-PradeepNeural',
    label: 'প্রদীপ — Azure বাংলাদেশি পুরুষ',
    provider: 'azure',
    voiceId: 'bn-BD-PradeepNeural',
  },
  {
    id: 'azure:bn-BD-NabanitaNeural',
    label: 'নবনীতা — Azure বাংলাদেশি নারী',
    provider: 'azure',
    voiceId: 'bn-BD-NabanitaNeural',
  },
] as const;

/** Prefer Chirp3 when Google TTS is configured; Azure Pradeep otherwise. */
export const DEFAULT_MERCHANT_VOICE_ID = 'google:bn-IN-Chirp3-HD-Algieba';
export const AZURE_FALLBACK_VOICE_ID = 'azure:bn-BD-PradeepNeural';

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

/**
 * Resolve merchant voice selection.
 * Preserves Google Chirp3 Algieba and Azure voices.
 * Empty / unknown → Chirp3 Algieba (Maskara Google TTS); ElevenLabs → Azure Pradeep.
 */
export function resolveMerchantVoice(voiceId?: string | null): {
  provider: string;
  voiceId: string;
  id: string;
  languageCode?: string;
  useGoogleDirect?: boolean;
} {
  const parsed = parseMerchantVoice(voiceId);
  const raw = `${parsed.provider || ''}:${parsed.voiceId || ''}`.toLowerCase();
  const idLower = (voiceId || '').toLowerCase();

  if (
    !voiceId ||
    raw.includes('algieba') ||
    raw.includes('chirp3') ||
    idLower.includes('algieba') ||
    idLower.includes('chirp3') ||
    (parsed.provider === 'google' && parsed.voiceId?.includes('Chirp3'))
  ) {
    return {
      provider: 'google',
      voiceId: 'bn-IN-Chirp3-HD-Algieba',
      id: 'google:bn-IN-Chirp3-HD-Algieba',
      languageCode: 'bn-IN',
      useGoogleDirect: true,
    };
  }

  if (
    raw.includes('nabanita') ||
    raw.includes('wavenet-a') ||
    (parsed.provider === 'azure' && parsed.voiceId === 'bn-BD-NabanitaNeural')
  ) {
    return {
      provider: 'azure',
      voiceId: 'bn-BD-NabanitaNeural',
      id: 'azure:bn-BD-NabanitaNeural',
    };
  }

  if (
    raw.includes('pradeep') ||
    (parsed.provider === 'azure' && parsed.voiceId === 'bn-BD-PradeepNeural')
  ) {
    return {
      provider: 'azure',
      voiceId: 'bn-BD-PradeepNeural',
      id: 'azure:bn-BD-PradeepNeural',
    };
  }

  // ElevenLabs / other Google → Azure male fallback for ePBX-native TTS
  return {
    provider: 'azure',
    voiceId: 'bn-BD-PradeepNeural',
    id: AZURE_FALLBACK_VOICE_ID,
  };
}

/** Azure voice used when Google direct TTS is unavailable. */
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
    /nabanita|wavenet-a|achernar|female/i.test(voiceId || '') &&
    !/pradeep|algieba|wavenet-b/i.test(voiceId || '')
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
