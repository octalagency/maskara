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
  hasBanglaScript,
  resolveLiveEpbxVoice,
} from './bangla-prompt';

/**
 * ePBX.bd — Bangla outbound dial / telephony only.
 *
 * Maskara Google Chirp3 synthesizes all call audio. ePBX only originates the
 * call and plays hosted MP3 URLs. Portal eAI / WaveNet / Chirp3 TTS is never
 * used as a fallback.
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
      this.settings.get('EPBX_API_URL') || 'https://epbx.bd/api/v1'
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

  /** Loud voice-key dump — never include Authorization / API secrets. */
  private logVoicePayload(
    callId: string,
    payload: Record<string, unknown>,
  ): void {
    const keys = [
      'mode',
      'skip_tts',
      'disable_tts',
      'tts_enabled',
      'use_audio_url',
      'prefer_audio_url',
      'audio_url',
      'confirm_audio_url',
      'cancel_audio_url',
      'invalid_audio_url',
      'language',
      'lang',
      'speak_english',
      'english_enabled',
      'ivr_id',
      'maskara_voice',
      'dial_only',
    ];
    const snapshot: Record<string, unknown> = {};
    for (const k of keys) {
      if (payload[k] !== undefined) snapshot[k] = payload[k];
    }
    this.logger.log(
      `[voice] ePBX FULL voice payload callId=${callId} ${JSON.stringify(snapshot)}`,
    );
  }

  async initiateCall(params: InitiateCallParams): Promise<InitiateCallResult> {
    const apiKey = this.settings.get('EPBX_API_KEY');
    if (!apiKey) throw new Error('EPBX_API_KEY not configured');

    if (!this.googleTts.isConfigured()) {
      throw new Error(
        'Maskara TTS required: GOOGLE_TTS_API_KEY not configured — refusing ePBX dial (no portal voice fallback)',
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

    const banglaOk = hasBanglaScript(ttsText);
    if (!banglaOk) {
      throw new Error(
        'Refusing ePBX dial: TTS text has no Bangla script (would trigger English portal female)',
      );
    }

    const voice = resolveLiveEpbxVoice(params.voiceId, true);
    const speechRate = params.speechRate ?? DEFAULT_SPEECH_RATE;

    const confirmBn = 'আপনার অর্ডার নিশ্চিত করা হয়েছে। ধন্যবাদ।';
    const cancelBn = 'আপনার অর্ডার বাতিল করা হয়েছে। ধন্যবাদ।';
    const invalidBn =
      'দয়া করে ১ চাপুন নিশ্চিত করতে, ২ চাপুন বাতিল করতে, পুনরায় শুনতে ০ চাপুন।';

    let audioUrl: string;
    let confirmAudioUrl: string | null = null;
    let cancelAudioUrl: string | null = null;
    let invalidAudioUrl: string | null = null;
    let redisCached = false;

    try {
      this.logger.log(
        `[voice] Google synth start callId=${params.callId} language=bn-IN voiceId=${voice.id} googleVoice=${voice.voiceId} bangla_script=${banglaOk} chars=${ttsText.length}`,
      );
      const synth = await this.googleTts.synthesize(
        ttsText,
        voice.voiceId,
        speechRate,
      );
      const hosted = await this.googleTts.hostAudio(
        synth.buffer,
        synth.mimeType,
        `call-${params.callId}`,
      );
      audioUrl = hosted.url;
      redisCached = hosted.redisCached;

      const audioReachable =
        (hosted.via === 's3' || hosted.redisCached) &&
        (await this.isPublicAudioReachable(audioUrl));
      if (!audioReachable) {
        throw new Error(
          `Maskara TTS audio URL not API-fetchable via=${hosted.via} redis_cached=${hosted.redisCached} url=${audioUrl}`,
        );
      }

      try {
        const [c, x, i] = await Promise.all([
          this.googleTts.synthesize(confirmBn, voice.voiceId, speechRate),
          this.googleTts.synthesize(cancelBn, voice.voiceId, speechRate),
          this.googleTts.synthesize(invalidBn, voice.voiceId, speechRate),
        ]);
        const [okH, cxH, badH] = await Promise.all([
          this.googleTts.hostAudio(c.buffer, c.mimeType, `ok-${params.callId}`),
          this.googleTts.hostAudio(x.buffer, x.mimeType, `cx-${params.callId}`),
          this.googleTts.hostAudio(i.buffer, i.mimeType, `bad-${params.callId}`),
        ]);
        if (okH.via === 's3' || okH.redisCached) confirmAudioUrl = okH.url;
        if (cxH.via === 's3' || cxH.redisCached) cancelAudioUrl = cxH.url;
        if (badH.via === 's3' || badH.redisCached) invalidAudioUrl = badH.url;
        redisCached =
          redisCached && okH.redisCached && cxH.redisCached && badH.redisCached;
      } catch (dtmfErr) {
        this.logger.warn(
          `DTMF phrase TTS failed (prompt audio still used): ${dtmfErr instanceof Error ? dtmfErr.message : dtmfErr}`,
        );
      }

      this.logger.log(
        `[voice] Google TTS ready callId=${params.callId} language=bn-IN voiceId=${voice.id} googleVoice=${voice.voiceId} audio_url=${audioUrl} redis_cached=${redisCached}`,
      );
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      this.logger.error(
        `Maskara TTS required for dial — refusing ePBX call (no portal voice fallback): ${msg}`,
      );
      throw new Error(`Maskara TTS required: ${msg}`);
    }

    // Dial-only payload: play Maskara MP3; do not instruct ePBX to synthesize.
    const payload: Record<string, unknown> = {
      phone_number: dialPhone,
      caller_id: callerId,
      to: dialPhone,
      from: callerId,

      dial_only: true,
      mode: 'play_audio',
      skip_tts: true,
      disable_tts: true,
      tts_enabled: false,
      use_portal_default_voice: false,
      force_voice: false,
      use_azure: false,
      azure_tts: false,
      use_wavenet: false,
      wavenet: false,
      use_chirp3: false,
      speak_english: false,
      english_enabled: false,
      skip_default_prompt: true,
      use_custom_text_only: true,
      disable_default_greeting: true,
      template: 'custom',

      language: 'bn',
      lang: 'bn',

      maskara_voice: voice.voiceId,
      voice_gender: voice.gender,
      gender: voice.gender,

      replay_digit: '0',
      repeat_digit: '0',
      replay_on_zero: true,
      repeat_on_digit: '0',
      zero_digit_action: 'replay',
      option_0: 'replay',
      dtmf_0: 'replay',
      confirm_digit: '1',
      cancel_digit: '2',

      reference_id: params.callId,
      external_id: params.callId,
      webhook_url: this.webhookUrl('/voice/webhook/epbx'),
      status_callback: this.webhookUrl('/voice/webhook/epbx/status'),
      dtmf_webhook: this.webhookUrl('/voice/webhook/epbx/dtmf'),
      callback_url: this.webhookUrl('/voice/webhook/epbx'),

      audio_url: audioUrl,
      media_url: audioUrl,
      play_url: audioUrl,
      tts_audio_url: audioUrl,
      greeting_audio_url: audioUrl,
      prompt_audio_url: audioUrl,
      audio: audioUrl,
      media: audioUrl,
      file_url: audioUrl,
      voice_url: audioUrl,
      play_audio: audioUrl,
      audio_file: audioUrl,
      mp3_url: audioUrl,
      sound_url: audioUrl,
      announcement_url: audioUrl,
      recording_url: audioUrl,
      ivr_audio: audioUrl,
      ivr_audio_url: audioUrl,
      fixed_audio_url: audioUrl,
      fixed_audio: audioUrl,
      replay_audio_url: audioUrl,
      repeat_audio_url: audioUrl,
      use_audio_url: true,
      prefer_audio_url: true,
    };

    if (confirmAudioUrl) {
      payload.confirm_audio_url = confirmAudioUrl;
      payload.success_audio_url = confirmAudioUrl;
    }
    if (cancelAudioUrl) {
      payload.cancel_audio_url = cancelAudioUrl;
      payload.failure_audio_url = cancelAudioUrl;
    }
    if (invalidAudioUrl) {
      payload.invalid_audio_url = invalidAudioUrl;
    }

    // Never attach portal IVR (female/English menus) unless explicitly forced.
    const forceIvr = this.settings.get('EPBX_FORCE_IVR') === '1';
    const ivrId = this.settings.get('EPBX_IVR_ID');
    if (forceIvr && ivrId) {
      this.logger.warn(
        `[voice] EPBX_FORCE_IVR=1 — attaching ivr_id=${ivrId} (may override Maskara audio)`,
      );
      payload.ivr_id = ivrId;
    }

    this.logger.log(
      `[voice] ePBX initiate callId=${params.callId} dial_only=true audio_url_sent=true merchantVoiceId=${params.voiceId || 'null'} resolved=${voice.id} googleVoice=${voice.voiceId} voice_gender=${voice.gender} redis_cached=${redisCached} skip_tts=true mode=play_audio ivr_forced=${forceIvr && Boolean(ivrId)} chars=${ttsText.length}`,
    );
    this.logVoicePayload(params.callId, payload);

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
          params.callId;

        this.logger.log(
          `[voice] ePBX OK ${path} callId=${params.callId} dial_only=true audio_url_sent=true voiceId=${voice.id} voice_gender=${voice.gender} redis_cached=${redisCached} → ${dialPhone} providerId=${providerCallId}`,
        );
        return { providerCallId: String(providerCallId), status: 'RINGING' };
      }

      const message =
        (body as { message?: string }).message ||
        (body as { error?: string }).error ||
        `ePBX call failed (${res.status})`;
      lastError = message;
      this.logger.error(
        `ePBX API error ${path}: ${res.status} ${JSON.stringify(body)}`,
      );

      if (res.status !== 404) break;
    }

    if (/could not be found/i.test(lastError) || /route .* not found/i.test(lastError)) {
      throw new Error(
        'ePBX call route missing — expected POST /api/v1/calls/initiate. Check Developer API Access on maskara.epbx.bd/portal/developer',
      );
    }

    throw new Error(lastError);
  }

  /**
   * Prove the API process (not worker L1) can serve hosted TTS for ePBX.
   * Prefer in-compose `http://backend:4000` to avoid public hairpin flakiness.
   */
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
    if (digits.startsWith('880') && digits.length >= 13) return `0${digits.slice(3)}`;
    if (digits.startsWith('0') && digits.length === 11) return digits;
    if (digits.length === 10) return `0${digits}`;
    return digits;
  }
}
