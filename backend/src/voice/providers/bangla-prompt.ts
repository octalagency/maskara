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
 * Placeholders: {{storeName}}, {{products}}, {{amount}}, {{customerName}}, {{orderNumber}}.
 * Works for ShopIn / WooCommerce / Shopify — same merchant setting.
 */
export const DEFAULT_CALL_SCRIPT =
  'আসসালামু আলাইকুম। {{storeName}} থেকে আপনি {{products}} অর্ডার করেছেন। আপনার মোট বিল {{amount}} টাকা। অর্ডারটি কনফার্ম করতে ১ চাপুন এবং বাতিল করতে ২ চাপুন। আমরা সারা বাংলাদেশ ক্যাশ অন ডেলিভারি দিয়ে থাকি। ডেলিভারির সময় ঢাকার মধ্যে ১ থেকে ২ দিন, ঢাকার বাইরে ২ থেকে ৩ দিন।';

/** Pull product titles from Woo / Shopify / ShopIn line-item JSON. */
export function extractProductNamesFromItems(items: unknown): string[] {
  if (!Array.isArray(items)) return [];
  const names: string[] = [];
  for (const raw of items) {
    if (!raw || typeof raw !== 'object') continue;
    const o = raw as Record<string, unknown>;
    const nested =
      o.product && typeof o.product === 'object'
        ? (o.product as Record<string, unknown>)
        : null;
    const name = String(
      o.name ||
        o.title ||
        o.product_name ||
        o.productName ||
        o.item_name ||
        o.itemName ||
        (typeof o.product === 'string' ? o.product : '') ||
        nested?.name ||
        nested?.title ||
        '',
    ).trim();
    if (name) names.push(name);
  }
  return names;
}

/** Bangla list: A | A এবং B | A, B এবং C */
export function formatProductNamesBangla(names: string[]): string {
  const clean = names.map((n) => n.trim()).filter(Boolean);
  if (clean.length === 0) return 'একটি পণ্য';
  if (clean.length === 1) return clean[0];
  if (clean.length === 2) return `${clean[0]} এবং ${clean[1]}`;
  const last = clean[clean.length - 1];
  return `${clean.slice(0, -1).join(', ')} এবং ${last}`;
}

/** True when Latin letters dominate over Bangla — would make Chirp3/ePBX speak English. */
export function isMostlyLatinScript(text: string): boolean {
  const letters = text.replace(/[^A-Za-z\u0980-\u09FF]/g, '');
  if (letters.length < 8) return false;
  const latin = (letters.match(/[A-Za-z]/g) || []).length;
  return latin / letters.length > 0.45;
}

export function buildOrderVerificationPrompt(params: {
  storeName: string;
  customerName?: string;
  orderNumber?: string;
  totalAmount?: number;
  customGreeting?: string | null;
  /** Product names from order line items (ShopIn / Woo / Shopify). */
  productNames?: string[] | null;
  products?: string | null;
}): string {
  const store = params.storeName || 'স্টোর';
  const name = params.customerName || '';
  const orderNumber = toBanglaDigits(
    String(params.orderNumber || '').replace(/^#/, ''),
  );
  const amount = toBanglaDigits(
    params.totalAmount != null ? String(Math.round(Number(params.totalAmount))) : '',
  );
  const products =
    (params.products || '').trim() ||
    formatProductNamesBangla(params.productNames || []);

  // Bangla-only sentinel — MUST NOT contain Latin letters, or sanitizeBanglaSpeech
  // strips the token and product names never get injected (live calls said "একটি পণ্য"/blank).
  const PRODUCTS_TOKEN = '⟦পণ্যতালিকা⟧';

  const fillBase = (template: string) =>
    template
      .replace(/\{\{\s*storeName\s*\}\}/gi, store)
      .replace(/\{\{\s*customerName\s*\}\}/gi, name || 'মাননীয় গ্রাহক')
      .replace(/\{\{\s*orderNumber\s*\}\}/gi, orderNumber)
      .replace(/\{\{\s*amount\s*\}\}/gi, amount)
      .replace(/\{\{\s*products?\s*\}\}/gi, PRODUCTS_TOKEN)
      .replace(/\{\{\s*items?\s*\}\}/gi, PRODUCTS_TOKEN)
      .replace(/\{\{\s*productNames?\s*\}\}/gi, PRODUCTS_TOKEN);

  const injectProducts = (text: string) =>
    text.split(PRODUCTS_TOKEN).join(products);

  let template = params.customGreeting?.trim() || DEFAULT_CALL_SCRIPT;
  // Custom English/Banglish scripts → force default Bangla (never synth English)
  if (isMostlyLatinScript(template)) {
    template = DEFAULT_CALL_SCRIPT;
  }
  let filled = injectProducts(sanitizeBanglaSpeech(fillBase(template)));
  if (!filled || isMostlyLatinScript(filled.replace(products, ''))) {
    filled = injectProducts(sanitizeBanglaSpeech(fillBase(DEFAULT_CALL_SCRIPT)));
  }
  return filled;
}

/** Curated Google Chirp3 HD voices (bn-IN) + Azure fallbacks. */
export const MERCHANT_VOICE_OPTIONS = [
  {
    id: 'google:bn-IN-Chirp3-HD-Algieba',
    label: 'Algieba — Chirp3 পুরুষ (প্রস্তাবিত কল-সেন্টার)',
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
    label: 'Orus — Chirp3 পুরুষ (কল-সেন্টার)',
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
/**
 * ePBX portal primary male Chirp3 (maskara.epbx.bd Voice Profile).
 * Maskara UI recommends Algieba; portal radio uses Algenib — map Algieba→Algenib
 * so live dials match the saved Google gateway voice (never WaveNet female default).
 */
export const EPBX_PORTAL_MALE_CHIRP3 = 'bn-IN-Chirp3-HD-Algenib';
/** Slightly under 1.0 for clearer, warmer call-center pacing. */
export const DEFAULT_SPEECH_RATE = 0.95;
/** Phone-friendly clarity without sounding loud. */
export const DEFAULT_TTS_VOLUME_GAIN_DB = 1.0;
/**
 * Soft positive pitch for non-Chirp voices only.
 * Chirp3 HD ignores AudioConfig.pitch — expressiveness uses markup pauses.
 */
export const DEFAULT_TTS_PITCH = 0.5;

export function clampSpeechRate(rate?: number | null): number {
  const n = Number(rate);
  if (!Number.isFinite(n)) return DEFAULT_SPEECH_RATE;
  return Math.min(1.35, Math.max(0.75, Math.round(n * 100) / 100));
}

/**
 * Chirp3 HD markup: natural pauses for friendly call-center delivery.
 * Pause tags only work in the API `markup` field (not plain `text`).
 * See: https://cloud.google.com/text-to-speech/docs/chirp3-markup
 */
export function toChirpExpressiveMarkup(text: string): string {
  let out = text.replace(/\s+/g, ' ').trim();
  if (!out) return out;

  // Soft open — agent greeting feel
  if (!/^\[pause/.test(out)) {
    out = `[pause short] ${out}`;
  }

  // Ellipsis / sentence end → short natural pause
  out = out.replace(/\.{2,}\s*/g, '... [pause short] ');
  out = out.replace(/([।!?])\s*/g, '$1 [pause short] ');
  // Commas as light breath (Bangla/English)
  out = out.replace(/([,،])\s*/g, '$1 [pause short] ');

  // Brief breath before key action lines
  out = out.replace(
    /(অর্ডারটি\s*নিশ্চিত\s*করার\s*জন্য)/g,
    '[pause] $1',
  );
  out = out.replace(/(বাতিল\s*করার\s*জন্য)/g, '[pause short] $1');
  out = out.replace(/(পুনরায়\s*শুনতে)/g, '[pause] $1');
  out = out.replace(/(ধন্যবাদ)/g, '[pause short] $1');

  // Collapse stacked pauses / whitespace
  out = out.replace(/(\[pause(?: short| long)?\]\s*){2,}/g, '[pause short] ');
  return out.replace(/\s+/g, ' ').trim();
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

/** True when text contains Bangla (Bengali) script characters. */
export function hasBanglaScript(text: string): boolean {
  return /[\u0980-\u09FF]/.test(text || '');
}

const CHIRP3_FEMALE = /Achernar|Aoede|Kore|Leda/i;

export function resolveMerchantVoice(voiceId?: string | null): {
  provider: string;
  voiceId: string;
  id: string;
  languageCode?: string;
  useGoogleDirect?: boolean;
  gender: 'male' | 'female';
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
      gender: known.gender,
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
      gender: CHIRP3_FEMALE.test(parsed.voiceId) ? 'female' : 'male',
    };
  }

  if (!voiceId || /algieba|elevenlabs/i.test(voiceId)) {
    return {
      provider: 'google',
      voiceId: 'bn-IN-Chirp3-HD-Algieba',
      id: DEFAULT_MERCHANT_VOICE_ID,
      languageCode: 'bn-IN',
      useGoogleDirect: true,
      gender: 'male',
    };
  }

  if (/nabanita/i.test(voiceId || '')) {
    return {
      provider: 'azure',
      voiceId: 'bn-BD-NabanitaNeural',
      id: 'azure:bn-BD-NabanitaNeural',
      gender: 'female',
    };
  }

  if (/pradeep/i.test(voiceId || '')) {
    return {
      provider: 'azure',
      voiceId: 'bn-BD-PradeepNeural',
      id: 'azure:bn-BD-PradeepNeural',
      gender: 'male',
    };
  }

  return {
    provider: 'azure',
    voiceId: 'bn-BD-PradeepNeural',
    id: AZURE_FALLBACK_VOICE_ID,
    gender: 'male',
  };
}

/**
 * Gender of the merchant's effective selection (after soft-migrate of legacy নবনীতা).
 * Male Chirp3 / Pradeep / migrated Nabanita → male. Explicit female Chirp3 → female.
 */
export function merchantVoiceGender(
  voiceId?: string | null,
): 'male' | 'female' {
  if (shouldMigrateMerchantVoiceId(voiceId)) return 'male';
  return resolveMerchantVoice(voiceId).gender;
}

/**
 * Azure Neural twin for ePBX text-TTS fallback.
 * Male (Algieba/Orus/Pradeep/…) → bn-BD-PradeepNeural.
 * Female Chirp3 only → bn-BD-NabanitaNeural.
 * NEVER Nabanita when merchant picks male. Soft-migrated Nabanita → Pradeep.
 */
export function azureTwinForMerchantVoice(voiceId?: string | null): {
  provider: 'azure';
  voiceId: string;
  id: string;
  gender: 'male' | 'female';
  shortName: string;
} {
  const gender = merchantVoiceGender(voiceId);
  if (gender === 'female') {
    return {
      provider: 'azure',
      voiceId: 'bn-BD-NabanitaNeural',
      id: 'azure:bn-BD-NabanitaNeural',
      gender: 'female',
      shortName: 'Nabanita',
    };
  }
  return {
    provider: 'azure',
    voiceId: 'bn-BD-PradeepNeural',
    id: AZURE_FALLBACK_VOICE_ID,
    gender: 'male',
    shortName: 'Pradeep',
  };
}

/**
 * Live ePBX path — telephony ePBX; prefer Maskara Google Chirp3 MP3.
 * Soft-migrate Azure নবনীতা → Algieba. Keep merchant Chirp3 (male or female).
 * Azure Pradeep selection still synths Algieba when Google is ready (better audio).
 */
export function resolveLiveEpbxVoice(
  voiceId?: string | null,
  googleTtsConfigured = false,
): {
  provider: string;
  voiceId: string;
  id: string;
  languageCode?: string;
  useGoogleDirect?: boolean;
  gender: 'male' | 'female';
} {
  if (googleTtsConfigured) {
    if (shouldMigrateMerchantVoiceId(voiceId)) {
      return {
        ...resolveMerchantVoice(DEFAULT_MERCHANT_VOICE_ID),
        languageCode: 'bn-IN',
        useGoogleDirect: true,
      };
    }
    const resolved = resolveMerchantVoice(voiceId);
    if (
      resolved.provider === 'google' &&
      /Chirp3-HD-/i.test(resolved.voiceId)
    ) {
      return { ...resolved, languageCode: 'bn-IN', useGoogleDirect: true };
    }
    // Azure male (Pradeep) → still synth Algieba for hosted audio quality
    return {
      ...resolveMerchantVoice(DEFAULT_MERCHANT_VOICE_ID),
      languageCode: 'bn-IN',
      useGoogleDirect: true,
    };
  }

  // No Google key: Azure twin only (male→Pradeep; female Chirp3→Nabanita; migrated→Pradeep)
  const twin = azureTwinForMerchantVoice(voiceId);
  return {
    provider: twin.provider,
    voiceId: twin.voiceId,
    id: twin.id,
    gender: twin.gender,
  };
}

/**
 * Voice name + provider fields for ePBX initiate when portal Active Gateway = Google.
 * Algieba / Pradeep / soft-migrated নবনীতা → bn-IN-Chirp3-HD-Algenib (portal male primary).
 * Female Chirp3 kept as-is. Never Nabanita / azure voice names on this path.
 */
export function epbxPortalGoogleVoice(voiceId?: string | null): {
  provider: 'google';
  voiceId: string;
  id: string;
  shortName: string;
  gender: 'male' | 'female';
  languageCode: 'bn-IN';
} {
  const gender = merchantVoiceGender(voiceId);
  if (gender === 'female') {
    const female = resolveMerchantVoice(voiceId);
    const voiceName = /Chirp3-HD-/i.test(female.voiceId)
      ? female.voiceId
      : 'bn-IN-Chirp3-HD-Aoede';
    return {
      provider: 'google',
      voiceId: voiceName,
      id: `google:${voiceName}`,
      shortName: voiceName.replace(/^bn-IN-Chirp3-HD-/i, ''),
      gender: 'female',
      languageCode: 'bn-IN',
    };
  }

  // Male path: ALWAYS portal Algenib for default/Algieba/Azure — never WaveNet female.
  // Explicit other male Chirp3 (Orus, …) kept; female Chirp3 only when merchant picks female.
  const resolved = resolveLiveEpbxVoice(voiceId, true);
  let voiceName = resolved.voiceId;
  if (
    !/Chirp3-HD-/i.test(voiceName) ||
    /Algieba|Algenib|Pradeep|Nabanita/i.test(voiceName) ||
    shouldMigrateMerchantVoiceId(voiceId) ||
    resolved.provider === 'azure'
  ) {
    voiceName = EPBX_PORTAL_MALE_CHIRP3;
  }
  // Soft-safety: if somehow female Chirp3 name landed on male path, still Algenib
  if (/Achernar|Aoede|Kore|Leda/i.test(voiceName) && gender === 'male') {
    voiceName = EPBX_PORTAL_MALE_CHIRP3;
  }
  return {
    provider: 'google',
    voiceId: voiceName,
    id: `google:${voiceName}`,
    shortName: voiceName.replace(/^bn-IN-Chirp3-HD-/i, ''),
    gender: 'male',
    languageCode: 'bn-IN',
  };
}

/** @deprecated use azureTwinForMerchantVoice — kept for call sites */
export function azureFallbackFor(voiceId?: string | null): {
  provider: string;
  voiceId: string;
  id: string;
} {
  const twin = azureTwinForMerchantVoice(voiceId);
  return {
    provider: twin.provider,
    voiceId: twin.voiceId,
    id: twin.id,
  };
}

/** Merchants on Azure female / null should be migrated to Chirp3 Algieba. */
export function shouldMigrateMerchantVoiceId(voiceId?: string | null): boolean {
  if (!voiceId) return true;
  return /nabanita/i.test(voiceId);
}
