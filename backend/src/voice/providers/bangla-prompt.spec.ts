import {
  DEFAULT_MERCHANT_VOICE_ID,
  hasBanglaScript,
  resolveLiveEpbxVoice,
  resolveMerchantVoice,
  buildOrderVerificationPrompt,
} from './bangla-prompt';

describe('hasBanglaScript', () => {
  it('detects Bangla', () => {
    expect(hasBanglaScript('হ্যালো')).toBe(true);
    expect(hasBanglaScript('Hello press 1')).toBe(false);
  });
});

describe('resolveLiveEpbxVoice', () => {
  it('forces Algieba when Google ready and merchant on Nabanita', () => {
    const v = resolveLiveEpbxVoice('azure:bn-BD-NabanitaNeural', true);
    expect(v.id).toBe(DEFAULT_MERCHANT_VOICE_ID);
    expect(v.voiceId).toBe('bn-IN-Chirp3-HD-Algieba');
    expect(v.languageCode).toBe('bn-IN');
  });

  it('keeps male Chirp3 when Google ready', () => {
    const v = resolveLiveEpbxVoice('google:bn-IN-Chirp3-HD-Orus', true);
    expect(v.voiceId).toBe('bn-IN-Chirp3-HD-Orus');
  });

  it('remaps female Chirp3 to Algieba on live path', () => {
    const v = resolveLiveEpbxVoice('google:bn-IN-Chirp3-HD-Aoede', true);
    expect(v.voiceId).toBe('bn-IN-Chirp3-HD-Algieba');
  });

  it('uses Pradeep when Google missing and merchant on Nabanita', () => {
    const v = resolveLiveEpbxVoice('azure:bn-BD-NabanitaNeural', false);
    expect(v.voiceId).toBe('bn-BD-PradeepNeural');
  });
});

describe('buildOrderVerificationPrompt', () => {
  it('produces Bangla script', () => {
    const text = buildOrderVerificationPrompt({
      storeName: 'টেস্ট স্টোর',
      customerName: 'রহিম',
      orderNumber: '11380',
      totalAmount: 1200,
    });
    expect(hasBanglaScript(text)).toBe(true);
    expect(text.toLowerCase()).not.toMatch(/\bpress\b/);
    expect(text.toLowerCase()).not.toMatch(/\bconfirm\b/);
  });
});

describe('resolveMerchantVoice', () => {
  it('defaults to Algieba', () => {
    expect(resolveMerchantVoice(null).id).toBe(DEFAULT_MERCHANT_VOICE_ID);
  });
});
