import { Injectable, Logger } from '@nestjs/common';
import { VoiceSettingsService } from '../voice-settings.service';
import { GoogleTtsService } from '../google-tts.service';
import {
  InitiateCallParams,
  InitiateCallResult,
  VoiceProvider,
} from './voice-provider.interface';
import {
  DEFAULT_SPEECH_RATE,
  buildOrderVerificationPrompt,
  epbxPortalGoogleVoice,
  hasBanglaScript,
  resolveLiveEpbxVoice,
} from './bangla-prompt';

/**
 * ePBX outbound dial — Maskara owns the voice.
 *
 * Single path (no Azure / portal WaveNet female):
 * 1. Synthesize Bangla with Google Chirp3 (Algieba male by default).
 * 2. Host MP3 on Maskara API (Redis/S3) and prove it is fetchable.
 * 3. Dial ePBX with audio_url + Bangla tts_text + portal male Algenib fields.
 * 4. Refuse the call if Maskara TTS/audio is missing (never fall to portal eAI).
 */
@Injectable()
export class EpbxProvider implements VoiceProvider {
  readonly name = 'epbx' as const;
  private readonly logger = new Logger(EpbxProvider.name);

  constructor(
    private settings: VoiceSettingsService,
    private googleTts: GoogleTtsService,
  ) {}

  isConfigured(): boolean {
    return this.settings.isEpbxConfigured();
  }

  private get baseUrl(): string {
    return (
      this.settings.get('EPBX_API_URL') || 'https://maskara.epbx.bd/api/v1'
    ).replace(/\/$/, '');
  }

  private get webhookBase(): string {
    return (
      this.settings.get('PUBLIC_API_URL') ||
      this.settings.get('API_URL') ||
      'http://localhost:4000'
    ).replace(/\/$/, '');
  }

  private webhookUrl(path: string): string {
    const base = `${this.webhookBase}${path}`;
    const secret = this.settings.get('VOICE_WEBHOOK_SECRET');
    if (!secret) return base;
    return `${base}?secret=${encodeURIComponent(secret)}`;
  }

  async initiateCall(params: InitiateCallParams): Promise<InitiateCallResult> {
    const apiKey = this.settings.get('EPBX_API_KEY');
    if (!apiKey) throw new Error('EPBX_API_KEY not configured');
    if (!this.googleTts.isConfigured()) {
      throw new Error(
        'GOOGLE_TTS_API_KEY missing — refusing dial (portal female eAI fallback blocked)',
      );
    }

    const dialPhone = this.toLocalBdMobile(params.to);
    const callerId =
      this.settings.get('EPBX_CALLER_ID') ||
      this.settings.get('EPBX_DID') ||
      '09639444146';

    const ttsText = buildOrderVerificationPrompt({
      storeName: params.storeName,
      customerName: params.customerName,
      orderNumber: params.orderNumber,
      totalAmount: params.totalAmount,
      customGreeting: params.customGreeting,
    });
    if (!hasBanglaScript(ttsText)) {
      throw new Error(
        'Refusing dial: prompt has no Bangla script (English portal female risk)',
      );
    }

    const maskaraVoice = resolveLiveEpbxVoice(params.voiceId, true);
    const portalVoice = epbxPortalGoogleVoice(params.voiceId);
    const speechRate = params.speechRate ?? DEFAULT_SPEECH_RATE;

    const confirmBn = 'আপনার অর্ডার নিশ্চিত করা হয়েছে। ধন্যবাদ।';
    const cancelBn = 'আপনার অর্ডার বাতিল করা হয়েছে। ধন্যবাদ।';
    const invalidBn =
      'দয়া করে ১ চাপুন নিশ্চিত করতে, ২ চাপুন বাতিল করতে, পুনরায় শুনতে ০ চাপুন।';

    this.logger.log(
      `[voice] synth start callId=${params.callId} maskara=${maskaraVoice.voiceId} portal=${portalVoice.voiceId} gender=${portalVoice.gender} chars=${ttsText.length}`,
    );

    const prompt = await this.synthAndHost(
      ttsText,
      maskaraVoice.voiceId,
      speechRate,
      `call-${params.callId}`,
    );

    let confirmUrl: string | null = null;
    let cancelUrl: string | null = null;
    let invalidUrl: string | null = null;
    try {
      const [c, x, i] = await Promise.all([
        this.synthAndHost(confirmBn, maskaraVoice.voiceId, speechRate, `ok-${params.callId}`),
        this.synthAndHost(cancelBn, maskaraVoice.voiceId, speechRate, `cx-${params.callId}`),
        this.synthAndHost(invalidBn, maskaraVoice.voiceId, speechRate, `bad-${params.callId}`),
      ]);
      confirmUrl = c.url;
      cancelUrl = x.url;
      invalidUrl = i.url;
    } catch (err) {
      this.logger.warn(
        `DTMF clips failed (prompt still used): ${err instanceof Error ? err.message : err}`,
      );
    }

    const payload = this.buildPayload({
      dialPhone,
      callerId,
      callId: params.callId,
      ttsText,
      confirmBn,
      cancelBn,
      invalidBn,
      speechRate,
      maskaraVoiceId: maskaraVoice.voiceId,
      portalVoice,
      audioUrl: prompt.url,
      confirmUrl,
      cancelUrl,
      invalidUrl,
    });

    this.logger.log(
      `[voice] ePBX initiate callId=${params.callId} mode=${payload.mode} audio_url_sent=true voice_gender=${payload.voice_gender} portalVoice=${portalVoice.voiceId} maskara=${maskaraVoice.voiceId} redis_cached=${prompt.redisCached}`,
    );
    this.logVoicePayload(params.callId, payload);

    return this.postOriginate(apiKey, payload, params.callId, dialPhone, {
      portalVoiceId: portalVoice.voiceId,
      maskaraVoiceId: maskaraVoice.voiceId,
      redisCached: prompt.redisCached,
    });
  }

  private async synthAndHost(
    text: string,
    voiceId: string,
    speechRate: number,
    key: string,
  ): Promise<{ url: string; redisCached: boolean }> {
    const synth = await this.googleTts.synthesize(text, voiceId, speechRate);
    const hosted = await this.googleTts.hostAudio(
      synth.buffer,
      synth.mimeType,
      key,
    );
    const ok =
      (hosted.via === 's3' || hosted.redisCached) &&
      (await this.isPublicAudioReachable(hosted.url));
    if (!ok) {
      throw new Error(
        `TTS audio not API-fetchable via=${hosted.via} redis=${hosted.redisCached} url=${hosted.url}`,
      );
    }
    return { url: hosted.url, redisCached: hosted.redisCached };
  }

  private buildPayload(args: {
    dialPhone: string;
    callerId: string;
    callId: string;
    ttsText: string;
    confirmBn: string;
    cancelBn: string;
    invalidBn: string;
    speechRate: number;
    maskaraVoiceId: string;
    portalVoice: {
      voiceId: string;
      shortName: string;
      gender: 'male' | 'female';
      languageCode: string;
    };
    audioUrl: string;
    confirmUrl: string | null;
    cancelUrl: string | null;
    invalidUrl: string | null;
  }): Record<string, unknown> {
    const {
      dialPhone,
      callerId,
      callId,
      ttsText,
      confirmBn,
      cancelBn,
      invalidBn,
      speechRate,
      maskaraVoiceId,
      portalVoice,
      audioUrl,
      confirmUrl,
      cancelUrl,
      invalidUrl,
    } = args;

    // Honor merchant gender; default product path is male (Algieba→Algenib).
    // Force male for Algieba/Algenib/migrated — never leave portal WaveNet female room.
    const gender =
      portalVoice.gender === 'female' &&
      /Achernar|Aoede|Kore|Leda/i.test(portalVoice.voiceId)
        ? 'female'
        : 'male';

    const payload: Record<string, unknown> = {
      phone_number: dialPhone,
      caller_id: callerId,
      to: dialPhone,
      from: callerId,

      // Bangla text kept so ePBX originate accepts the request —
      // playback must use Maskara MP3 (skip_tts), not portal WaveNet female.
      custom_text: ttsText,
      tts_text: ttsText,
      message: ttsText,
      text: ttsText,
      prompt: ttsText,
      greeting: ttsText,
      repeat_text: ttsText,
      replay_text: ttsText,
      confirm_text: confirmBn,
      cancel_text: cancelBn,
      success_text: confirmBn,
      failure_text: cancelBn,
      invalid_text: invalidBn,

      language: 'bn',
      lang: 'bn',
      tts_language: portalVoice.languageCode,
      locale: portalVoice.languageCode,
      speech_language: portalVoice.languageCode,
      speak_english: false,
      english_enabled: false,
      skip_default_prompt: true,
      use_custom_text_only: true,
      disable_default_greeting: true,
      template: 'custom',

      // play_audio = Maskara MP3; custom_tts historically let portal eAI speak female
      mode: 'play_audio',
      dial_only: true,

      replay_digit: '0',
      repeat_digit: '0',
      replay_on_zero: true,
      repeat_on_digit: '0',
      zero_digit_action: 'replay',
      option_0: 'replay',
      dtmf_0: 'replay',
      confirm_digit: '1',
      cancel_digit: '2',

      reference_id: callId,
      external_id: callId,
      webhook_url: this.webhookUrl('/voice/webhook/epbx'),
      status_callback: this.webhookUrl('/voice/webhook/epbx/status'),
      dtmf_webhook: this.webhookUrl('/voice/webhook/epbx/dtmf'),
      callback_url: this.webhookUrl('/voice/webhook/epbx'),

      // Block portal female engines
      use_eai: false,
      eai: false,
      eai_enabled: false,
      use_elevenlabs: false,
      elevenlabs: false,
      use_wavenet: false,
      wavenet: false,
      use_azure: false,
      azure_tts: false,
      use_portal_default_voice: false,

      // If ePBX still synthesizes, force male Chirp3 Algenib (not WaveNet female)
      provider: 'google',
      ai_tts_provider: 'google',
      tts_provider: 'google',
      tts_engine: 'chirp3',
      speech_provider: 'google',
      voice_gateway: 'google',
      tts_gateway: 'google',
      use_chirp3: true,
      google_tts_model: 'chirp3-hd',
      tts_model: 'chirp3-hd',

      google_tts_voice_id: portalVoice.voiceId,
      google_voice: portalVoice.voiceId,
      google_voice_name: portalVoice.voiceId,
      google_voice_id: portalVoice.voiceId,
      chirp3_voice: portalVoice.voiceId,
      voice_id: portalVoice.voiceId,
      tts_voice: portalVoice.voiceId,
      tts_voice_id: portalVoice.voiceId,
      tts_voice_name: portalVoice.voiceId,
      voice: portalVoice.voiceId,
      voice_name: portalVoice.voiceId,
      neural_voice: portalVoice.voiceId,
      ai_voice: portalVoice.voiceId,
      voice_label: portalVoice.shortName,
      tts_voice_label: portalVoice.shortName,
      voice_gender: gender,
      tts_gender: gender,
      gender,
      google_voice_alias: 'bn-IN-Chirp3-HD-Algieba',
      maskara_voice: maskaraVoiceId,
      speech_rate: String(speechRate),
      rate: String(speechRate),

      // CRITICAL: do not let ePBX run portal TTS (female WaveNet default)
      skip_tts: true,
      disable_tts: true,
      tts_enabled: false,
      force_voice: true,
      use_audio_url: true,
      prefer_audio_url: true,
      require_audio_url: true,
      play_pre_recorded: true,
      audio_only: true,
      tts_mode: 'audio',

      audio_url: audioUrl,
      media_url: audioUrl,
      play_url: audioUrl,
      tts_audio_url: audioUrl,
      greeting_audio_url: audioUrl,
      prompt_audio_url: audioUrl,
      audio: audioUrl,
      media: audioUrl,
      file_url: audioUrl,
      mp3_url: audioUrl,
      play_audio: audioUrl,
      voice_url: audioUrl,
      sound_url: audioUrl,
      announcement_url: audioUrl,
      recording_url: audioUrl,
      fixed_audio_url: audioUrl,
      fixed_audio: audioUrl,
      replay_audio_url: audioUrl,
      repeat_audio_url: audioUrl,
    };

    if (confirmUrl) {
      payload.confirm_audio_url = confirmUrl;
      payload.success_audio_url = confirmUrl;
    }
    if (cancelUrl) {
      payload.cancel_audio_url = cancelUrl;
      payload.failure_audio_url = cancelUrl;
    }
    if (invalidUrl) {
      payload.invalid_audio_url = invalidUrl;
    }

    // Never send portal IVR (Filo Bangladesh etc.) — overrides Maskara Chirp3 with female menus.
    // Ignore EPBX_IVR_ID / EPBX_FORCE_IVR entirely on order verification dials.
    if (this.settings.get('EPBX_IVR_ID') || this.settings.get('EPBX_FORCE_IVR') === '1') {
      this.logger.warn(
        `[voice] Ignoring EPBX_IVR_ID=${this.settings.get('EPBX_IVR_ID') || ''} — Maskara audio only`,
      );
    }

    return payload;
  }

  private logVoicePayload(
    callId: string,
    payload: Record<string, unknown>,
  ): void {
    const keys = [
      'mode',
      'provider',
      'tts_provider',
      'tts_engine',
      'voice_gateway',
      'google_tts_voice_id',
      'google_voice',
      'chirp3_voice',
      'voice_id',
      'voice_name',
      'voice_gender',
      'gender',
      'tts_language',
      'skip_tts',
      'use_audio_url',
      'prefer_audio_url',
      'audio_url',
      'confirm_audio_url',
      'cancel_audio_url',
      'invalid_audio_url',
      'maskara_voice',
      'google_voice_alias',
      'use_azure',
      'use_eai',
      'use_wavenet',
      'ivr_id',
    ];
    const snapshot: Record<string, unknown> = {};
    for (const k of keys) {
      if (payload[k] !== undefined) snapshot[k] = payload[k];
    }
    const tts = typeof payload.tts_text === 'string' ? payload.tts_text : '';
    snapshot.tts_text_len = tts.length;
    snapshot.tts_text_bangla = hasBanglaScript(tts);
    snapshot.tts_text_preview = tts.slice(0, 48);
    this.logger.log(
      `[voice] ePBX FULL voice payload callId=${callId} ${JSON.stringify(snapshot)}`,
    );
  }

  private async postOriginate(
    apiKey: string,
    payload: Record<string, unknown>,
    callId: string,
    dialPhone: string,
    meta: {
      portalVoiceId: string;
      maskaraVoiceId: string;
      redisCached: boolean;
    },
  ): Promise<InitiateCallResult> {
    const customerId = this.settings.get('EPBX_CUSTOMER_ID');
    const paths = customerId
      ? [
          `/customers/${customerId}/calls/originate`,
          '/calls/initiate',
          '/calls/verify',
        ]
      : ['/calls/initiate', '/calls/verify'];

    let lastError = 'ePBX call failed';
    for (const path of paths) {
      const res = await fetch(`${this.baseUrl}${path}`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: JSON.stringify(payload),
      });

      const body = await res.json().catch(() => ({}));
      if (res.ok) {
        const providerCallId =
          (body as { call_id?: string }).call_id ||
          (body as { id?: string }).id ||
          (body as { data?: { id?: string } }).data?.id ||
          callId;

        this.logger.log(
          `[voice] ePBX OK ${path} callId=${callId} portalVoice=${meta.portalVoiceId} maskara=${meta.maskaraVoiceId} redis_cached=${meta.redisCached} → ${dialPhone} providerId=${providerCallId}`,
        );
        return { providerCallId: String(providerCallId), status: 'RINGING' };
      }

      lastError =
        (body as { message?: string }).message ||
        (body as { error?: string }).error ||
        `ePBX call failed (${res.status})`;
      this.logger.error(
        `ePBX API error ${path}: ${res.status} ${JSON.stringify(body)}`,
      );
      if (res.status !== 404) break;
    }

    if (
      /could not be found/i.test(lastError) ||
      /route .* not found/i.test(lastError)
    ) {
      throw new Error(
        'ePBX call route missing — POST /api/v1/calls/initiate. Check maskara.epbx.bd/portal/developer',
      );
    }
    throw new Error(lastError);
  }

  private async isPublicAudioReachable(url: string): Promise<boolean> {
    const idMatch = url.match(/\/voice\/tts-audio\/([^/?#]+)/i);
    const bases = [
      (this.settings.get('INTERNAL_API_URL') || 'http://backend:4000').replace(
        /\/$/,
        '',
      ),
      this.webhookBase,
    ];

    if (idMatch) {
      const id = idMatch[1].replace(/\.mp3$/i, '');
      for (const base of bases) {
        try {
          const res = await fetch(`${base}/voice/tts-audio/${id}`, {
            method: 'GET',
            signal: AbortSignal.timeout(8000),
          });
          if (!res.ok) continue;
          const buf = Buffer.from(await res.arrayBuffer());
          if (buf.length > 64) return true;
        } catch (err) {
          this.logger.warn(
            `TTS audio probe failed base=${base} id=${id}: ${err instanceof Error ? err.message : err}`,
          );
        }
      }
      return false;
    }

    try {
      const res = await fetch(url, {
        method: 'GET',
        signal: AbortSignal.timeout(8000),
      });
      return res.ok;
    } catch (err) {
      this.logger.warn(
        `TTS audio probe failed url=${url.slice(0, 96)}: ${err instanceof Error ? err.message : err}`,
      );
      return false;
    }
  }

  private toLocalBdMobile(phone: string): string {
    const digits = phone.replace(/\D/g, '');
    if (digits.startsWith('880') && digits.length >= 13) {
      return `0${digits.slice(3)}`;
    }
    if (digits.startsWith('0') && digits.length === 11) return digits;
    if (digits.length === 10) return `0${digits}`;
    return digits;
  }
}
