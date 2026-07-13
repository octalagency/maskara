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
  const orderNumber = params.orderNumber || '';
  const amount =
    params.totalAmount != null ? String(params.totalAmount) : '';

  if (params.customGreeting?.trim()) {
    return params.customGreeting
      .trim()
      .replace(/\{\{\s*storeName\s*\}\}/gi, store)
      .replace(/\{\{\s*customerName\s*\}\}/gi, name)
      .replace(/\{\{\s*orderNumber\s*\}\}/gi, orderNumber)
      .replace(/\{\{\s*amount\s*\}\}/gi, amount);
  }

  const namePart = name ? `${name}` : 'মাননীয় গ্রাহক';
  const amountPart = amount ? `${amount} টাকার` : 'একটি';
  const orderPart = orderNumber ? `, অর্ডার নম্বর ${orderNumber}` : '';

  return (
    `আসসালামু আলাইকুম, ${namePart}। ${store}-এর পক্ষ থেকে জানাচ্ছি—আপনার ${amountPart} অর্ডারটি আমরা পেয়েছি${orderPart}। ` +
    `অর্ডারটি নিশ্চিত করতে এক চাপুন। বাতিল করতে দুই চাপুন। আমাদের সাথে কেনাকাটার জন্য ধন্যবাদ।`
  );
}

/** Preset Bangla TTS voices — Azure bn-BD first (most natural for Bangladesh). */
export const MERCHANT_VOICE_OPTIONS = [
  {
    id: 'azure:bn-BD-NabanitaNeural',
    label: 'নবনীতা — সবচেয়ে প্রাকৃতিক বাংলাদেশি নারী',
    provider: 'azure',
    voiceId: 'bn-BD-NabanitaNeural',
  },
  {
    id: 'azure:bn-BD-PradeepNeural',
    label: 'প্রদীপ — সবচেয়ে প্রাকৃতিক বাংলাদেশি পুরুষ',
    provider: 'azure',
    voiceId: 'bn-BD-PradeepNeural',
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
  {
    id: 'google_wavenet:bn-IN-Chirp3-HD-Zubenelgenubi',
    label: 'Google Chirp3 HD — পুরুষ',
    provider: 'google_wavenet',
    voiceId: 'bn-IN-Chirp3-HD-Zubenelgenubi',
  },
] as const;

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
