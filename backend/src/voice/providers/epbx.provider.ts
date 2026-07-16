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
 * ePBX.bd — outbound dial via Maskara Chirp3 audio.
 *
 * Always synthesize + host Maskara Google Chirp3 MP3 (required — no silent
 * portal eAI fallback). Send Bangla tts_text + Google Chirp3 fields so ePBX
 * accepts the originate API, while prefer_audio_url steers playback to Maskara.
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
      'provider',
      'tts_provider',
      'voice_gateway',
      'google_tts_voice_id',
      'voice_id',
      'voice_gender',
      'language',
      'tts_language',
      'skip_tts',
      'use_audio_url',
      'prefer_audio_url',
      'audio_url',
      'confirm_audio_url',
      'cancel_audio_url',
      'invalid_audio_url',
      'maskara_voice',
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

  async initiateCall(params: InitiateCallParams): Promise<InitiateCallResult> {
    const apiKey = this.settings.get('EPBX_API_KEY');
    if (!apiKey) throw new Error('EPBX_API_KEY not configured');

    if (!this.googleTts.isConfigured()) {
      throw new Error(
        'Maskara TTS required: GOOGLE_TTS_API_KEY not configured — refusing ePBX dial (no portal eAI fallback)',
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
    const portalVoice = epbxPortalGoogleVoice(params.voiceId);
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
        `[voice] Google synth start callId=${params.callId} language=bn-IN voiceId=${voice.id} googleVoice=${voice.voiceId} portalVoice=${portalVoice.voiceId} bangla_script=${banglaOk} chars=${ttsText.length}`,
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
        `[voice] Google TTS ready callId=${params.callId} language=bn-IN voiceId=${voice.id} googleVoice=${voice.voiceId} portalVoice=${portalVoice.voiceId} audio_url=${audioUrl} redis_cached=${redisCached}`,
      );
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      this.logger.error(
        `Maskara TTS required for dial — refusing ePBX call (no portal eAI fallback): ${msg}`,
      );
      throw new Error(`Maskara TTS required: ${msg}`);
    }

    // Bangla script required by ePBX originate API; prefer Maskara audio_url for playback.
    const payload: Record<string, unknown> = {
      phone_number: dialPhone,
      caller_id: callerId,
      to: dialPhone,
      from: callerId,

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
      mode: 'custom_tts',

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
    };

    // Google Chirp3 only — never eAI / WaveNet (portal WaveNet → female English).
    payload.provider = 'google';
    payload.ai_tts_provider = 'google';
    payload.tts_provider = 'google';
    payload.tts_engine = 'chirp3';
    payload.speech_provider = 'google';
    payload.voice_gateway = 'google_chirp3';
    payload.ai_tts_gateway = 'google_chirp3';
    payload.tts_gateway = 'google_chirp3';
    payload.google_tts_model = 'chirp3-hd';
    payload.tts_model = 'chirp3-hd';
    payload.model = 'chirp3-hd';
    payload.active_voice_gateway = 'google_chirp3';
    payload.use_chirp3 = true;
    payload.use_wavenet = false;
    payload.wavenet = false;

    payload.google_tts_voice_id = portalVoice.voiceId;
    payload.google_voice = portalVoice.voiceId;
    payload.google_voice_name = portalVoice.voiceId;
    payload.google_voice_id = portalVoice.voiceId;
    payload.chirp3_voice = portalVoice.voiceId;
    payload.chirp3_voice_id = portalVoice.voiceId;
    payload.chirp3_voice_name = portalVoice.voiceId;
    payload.voice_id = portalVoice.voiceId;
    payload.tts_voice = portalVoice.voiceId;
    payload.tts_voice_id = portalVoice.voiceId;
    payload.tts_voice_name = portalVoice.voiceId;
    payload.voice = portalVoice.voiceId;
    payload.voice_name = portalVoice.voiceId;
    payload.neural_voice = portalVoice.voiceId;
    payload.ai_voice = portalVoice.voiceId;
    payload.voice_label = portalVoice.shortName;
    payload.tts_voice_label = portalVoice.shortName;
    payload.voice_gender = portalVoice.gender;
    payload.tts_gender = portalVoice.gender;
    payload.gender = portalVoice.gender;
    if (/Algenib/i.test(portalVoice.voiceId)) {
      payload.google_voice_alias = 'bn-IN-Chirp3-HD-Algieba';
      payload.maskara_voice = 'bn-IN-Chirp3-HD-Algieba';
    } else {
      payload.maskara_voice = voice.voiceId;
    }
    payload.speech_rate = String(speechRate);
    payload.rate = String(speechRate);
    payload.skip_tts = false;
    payload.disable_tts = false;
    payload.tts_enabled = true;
    payload.use_portal_default_voice = false;
    payload.force_voice = true;
    payload.use_azure = false;
    payload.azure_tts = false;

    payload.audio_url = audioUrl;
    payload.media_url = audioUrl;
    payload.play_url = audioUrl;
    payload.tts_audio_url = audioUrl;
    payload.greeting_audio_url = audioUrl;
    payload.prompt_audio_url = audioUrl;
    payload.audio = audioUrl;
    payload.media = audioUrl;
    payload.file_url = audioUrl;
    payload.voice_url = audioUrl;
    payload.play_audio = audioUrl;
    payload.audio_file = audioUrl;
    payload.mp3_url = audioUrl;
    payload.sound_url = audioUrl;
    payload.announcement_url = audioUrl;
    payload.recording_url = audioUrl;
    payload.ivr_audio = audioUrl;
    payload.ivr_audio_url = audioUrl;
    payload.fixed_audio_url = audioUrl;
    payload.fixed_audio = audioUrl;
    payload.replay_audio_url = audioUrl;
    payload.repeat_audio_url = audioUrl;
    payload.use_audio_url = true;
    payload.prefer_audio_url = true;

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

    const forceIvr = this.settings.get('EPBX_FORCE_IVR') === '1';
    const ivrId = this.settings.get('EPBX_IVR_ID');
    if (forceIvr && ivrId) {
      this.logger.warn(
        `[voice] EPBX_FORCE_IVR=1 — attaching ivr_id=${ivrId} (may override Maskara audio)`,
      );
      payload.ivr_id = ivrId;
    }

    this.logger.log(
      `[voice] ePBX initiate callId=${params.callId} audio_url_sent=true merchantVoiceId=${params.voiceId || 'null'} resolved=${voice.id} googleVoice=${voice.voiceId} portalVoice=${portalVoice.voiceId} voice_gender=${portalVoice.gender} redis_cached=${redisCached} mode=custom_tts prefer_audio=true ivr_forced=${forceIvr && Boolean(ivrId)} chars=${ttsText.length}`,
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
          `[voice] ePBX OK ${path} callId=${params.callId} audio_url_sent=true voiceId=${voice.id} portalVoice=${portalVoice.voiceId} redis_cached=${redisCached} → ${dialPhone} providerId=${providerCallId}`,
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
