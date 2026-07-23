import {
  DEFAULT_MERCHANT_VOICE_ID,
  EPBX_PORTAL_MALE_CHIRP3,
  azureTwinForMerchantVoice,
  epbxPortalGoogleVoice,
  extractProductNamesFromItems,
  formatProductNamesBangla,
  hasBanglaScript,
  merchantVoiceGender,
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

describe('azureTwinForMerchantVoice', () => {
  it('maps Algieba / Orus / Pradeep to Azure Pradeep male', () => {
    expect(azureTwinForMerchantVoice('google:bn-IN-Chirp3-HD-Algieba').voiceId).toBe(
      'bn-BD-PradeepNeural',
    );
    expect(azureTwinForMerchantVoice('google:bn-IN-Chirp3-HD-Orus').shortName).toBe(
      'Pradeep',
    );
    expect(azureTwinForMerchantVoice('azure:bn-BD-PradeepNeural').gender).toBe('male');
  });

  it('maps female Chirp3 to Azure Nabanita only', () => {
    const twin = azureTwinForMerchantVoice('google:bn-IN-Chirp3-HD-Aoede');
    expect(twin.voiceId).toBe('bn-BD-NabanitaNeural');
    expect(twin.gender).toBe('female');
  });

  it('soft-migrates legacy Nabanita selection to male Pradeep twin', () => {
    expect(azureTwinForMerchantVoice('azure:bn-BD-NabanitaNeural').voiceId).toBe(
      'bn-BD-PradeepNeural',
    );
    expect(merchantVoiceGender('azure:bn-BD-NabanitaNeural')).toBe('male');
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

  it('keeps female Chirp3 when Google ready (Azure twin is Nabanita)', () => {
    const v = resolveLiveEpbxVoice('google:bn-IN-Chirp3-HD-Aoede', true);
    expect(v.voiceId).toBe('bn-IN-Chirp3-HD-Aoede');
    expect(v.gender).toBe('female');
  });

  it('uses Pradeep when Google missing and merchant on Nabanita', () => {
    const v = resolveLiveEpbxVoice('azure:bn-BD-NabanitaNeural', false);
    expect(v.voiceId).toBe('bn-BD-PradeepNeural');
  });
});

describe('epbxPortalGoogleVoice', () => {
  it('maps Algieba / Pradeep / Nabanita to portal male Algenib', () => {
    expect(epbxPortalGoogleVoice('google:bn-IN-Chirp3-HD-Algieba').voiceId).toBe(
      EPBX_PORTAL_MALE_CHIRP3,
    );
    expect(epbxPortalGoogleVoice('azure:bn-BD-PradeepNeural').voiceId).toBe(
      EPBX_PORTAL_MALE_CHIRP3,
    );
    expect(epbxPortalGoogleVoice('azure:bn-BD-NabanitaNeural').voiceId).toBe(
      EPBX_PORTAL_MALE_CHIRP3,
    );
    expect(epbxPortalGoogleVoice('google:bn-IN-Chirp3-HD-Algieba').gender).toBe(
      'male',
    );
    expect(epbxPortalGoogleVoice(null).shortName).toBe('Algenib');
  });

  it('keeps Orus / Aoede as their Chirp3 ids for portal Google gateway', () => {
    expect(epbxPortalGoogleVoice('google:bn-IN-Chirp3-HD-Orus').voiceId).toBe(
      'bn-IN-Chirp3-HD-Orus',
    );
    expect(epbxPortalGoogleVoice('google:bn-IN-Chirp3-HD-Aoede').voiceId).toBe(
      'bn-IN-Chirp3-HD-Aoede',
    );
    expect(epbxPortalGoogleVoice('google:bn-IN-Chirp3-HD-Aoede').gender).toBe(
      'female',
    );
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

  it('fills products + amount for single and multiple items', () => {
    const one = buildOrderVerificationPrompt({
      storeName: 'ফিলো বাংলাদেশ',
      totalAmount: 1200,
      productNames: ['হেয়ার অয়েল'],
    });
    expect(one).toContain('হেয়ার অয়েল');
    expect(one).toContain('১২০০');
    expect(one).toContain('আসসালামু আলাইকুম');

    const two = buildOrderVerificationPrompt({
      storeName: 'ফিলো বাংলাদেশ',
      totalAmount: 2500,
      productNames: ['হেয়ার অয়েল', 'ফেসওয়াশ'],
    });
    expect(two).toContain('হেয়ার অয়েল এবং ফেসওয়াশ');
    expect(two).toContain('২৫০০');
  });
});

describe('formatProductNamesBangla', () => {
  it('joins with এবং', () => {
    expect(formatProductNamesBangla(['A'])).toBe('A');
    expect(formatProductNamesBangla(['A', 'B'])).toBe('A এবং B');
    expect(formatProductNamesBangla(['A', 'B', 'C'])).toBe('A, B এবং C');
    expect(
      extractProductNamesFromItems([
        { name: 'হেয়ার অয়েল' },
        { title: 'ফেসওয়াশ' },
      ]),
    ).toEqual(['হেয়ার অয়েল', 'ফেসওয়াশ']);
  });
});

describe('resolveMerchantVoice', () => {
  it('defaults to Algieba', () => {
    expect(resolveMerchantVoice(null).id).toBe(DEFAULT_MERCHANT_VOICE_ID);
  });
});
