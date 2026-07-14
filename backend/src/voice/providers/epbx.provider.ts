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
  azureTwinForMerchantVoice,
  buildOrderVerificationPrompt,
  hasBanglaScript,
  resolveLiveEpbxVoice,
} from './bangla-prompt';

/**
 * ePBX.bd — Bangla outbound dial/telephony only.
 *
 * Dual strategy:
 * 1) Best-effort Chirp3 MP3 on every known media alias (ePBX often ignores these).
 * 2) ALWAYS keep Bangla tts_text + Azure Neural twin of merchant selection so
 *    portal TTS cannot default to English / female নবনীতা for male picks.
 *
 * mode stays `custom_tts` (never flip to `audio_url`) — that mode historically
 * discarded our Azure voice and fell through to portal female default.
 * NEVER skip_tts / empty text. Soft-migrated নবনীতা → Algieba → Azure Pradeep.
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

  async initiateCall(params: InitiateCallParams): Promise<InitiateCallResult> {
    const apiKey = this.settings.get('EPBX_API_KEY');
    if (!apiKey) throw new Error('EPBX_API_KEY not configured');

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

    const googleReady = this.googleTts.isConfigured();
    let voice = resolveLiveEpbxVoice(params.voiceId, googleReady);
    const speechRate = params.speechRate ?? DEFAULT_SPEECH_RATE;
    let audioUrl: string | null = null;
    let confirmAudioUrl: string | null = null;
    let cancelAudioUrl: string | null = null;
    let invalidAudioUrl: string | null = null;
    let redisCached = false;

    const confirmBn = 'আপনার অর্ডার নিশ্চিত করা হয়েছে। ধন্যবাদ।';
    const cancelBn = 'আপনার অর্ডার বাতিল করা হয়েছে। ধন্যবাদ।';
    const invalidBn =
      'দয়া করে ১ চাপুন নিশ্চিত করতে, ২ চাপুন বাতিল করতে, পুনরায় শুনতে ০ চাপুন।';

    const banglaOk = hasBanglaScript(ttsText);
    if (!banglaOk) {
      this.logger.error(
        `[voice] TTS text missing Bangla script callId=${params.callId} chars=${ttsText.length} preview=${ttsText.slice(0, 80)}`,
      );
    }

    if (googleReady) {
      // Force Google Chirp3 synth even if merchant DB still has Azure নবনীতা
      if (voice.provider !== 'google') {
        voice = resolveLiveEpbxVoice(params.voiceId, true);
      }
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

        // Durable shared host required (Redis/S3). Process-local L1 alone 404s on API.
        // Then prove API container can serve it (ePBX hits api.maskara.bd → backend).
        const audioReachable =
          (hosted.via === 's3' || hosted.redisCached) &&
          (await this.isPublicAudioReachable(audioUrl));
        if (!audioReachable) {
          this.logger.error(
            `[voice] TTS audio URL not API-fetchable callId=${params.callId} via=${hosted.via} redis_cached=${hosted.redisCached} url=${audioUrl} — refuse audio_url, use Azure twin Bangla text`,
          );
          audioUrl = null;
          redisCached = false;
        } else {
          // Same Chirp3 male for DTMF confirm/cancel/invalid (never ePBX Azure female)
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
            // Prompt audio already proven fetchable; trust same Redis/S3 path for DTMF clips.
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
        }
      } catch (err) {
        this.logger.error(
          `Google TTS failed for call — falling back to Azure twin only: ${err instanceof Error ? err.message : err}`,
        );
        audioUrl = null;
      }
    } else {
      this.logger.error(
        '[voice] GOOGLE_TTS_API_KEY missing on worker — live call will use Azure twin Bangla (never English portal TTS)',
      );
    }

    if (!banglaOk) {
      throw new Error(
        'Refusing ePBX dial: TTS text has no Bangla script (would trigger English portal female)',
      );
    }

    const azureTwin = azureTwinForMerchantVoice(params.voiceId);
    const azureVoice = azureTwin.voiceId;
    const azureShort = azureTwin.shortName;
    const azureGender = azureTwin.gender;

    // Do NOT send customer_name/amount/order_id/empty english_* —
    // empty '' and COD slots both trigger ePBX English portal template.
    // Prefer /calls/initiate custom_tts — never language=en / voice_gender portal default.
    const payload: Record<string, unknown> = {
      phone_number: dialPhone,
      caller_id: callerId,
      to: dialPhone,
      from: callerId,

      // ALWAYS Bangla script — never omit/empty (English female when missing)
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
      tts_language: 'bn-BD',
      locale: 'bn-BD',
      speech_language: 'bn-BD',
      speak_english: false,
      english_enabled: false,
      skip_default_prompt: true,
      use_custom_text_only: true,
      disable_default_greeting: true,
      template: 'custom',
      // Keep custom_tts even when audio_url attached — audio_url mode made
      // ePBX drop Azure voice and use portal female default on miss.
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

    // Azure Neural twin of merchant selection — cannot be overridden by portal female.
    payload.provider = 'azure';
    payload.ai_tts_provider = 'azure';
    payload.tts_provider = 'azure';
    payload.tts_engine = 'azure';
    payload.speech_provider = 'azure';
    payload.azure_tts_voice_id = azureVoice;
    payload.azure_voice = azureVoice;
    payload.azure_voice_name = azureVoice;
    payload.azure_voice_short = azureShort;
    payload.voice_id = azureVoice;
    payload.tts_voice = azureVoice;
    payload.tts_voice_id = azureVoice;
    payload.tts_voice_name = azureVoice;
    payload.voice = azureVoice;
    payload.voice_name = azureVoice;
    payload.neural_voice = azureVoice;
    payload.ai_voice = azureVoice;
    // Short portal labels some tenants store (Pradeep / Nabanita)
    payload.voice_label = azureShort;
    payload.tts_voice_label = azureShort;
    payload.voice_gender = azureGender;
    payload.tts_gender = azureGender;
    payload.gender = azureGender;
    payload.speech_rate = '0.92';
    payload.rate = '0.92';
    // Explicit anti-override — do not leave portal female/English defaults room
    payload.skip_tts = false;
    payload.disable_tts = false;
    payload.tts_enabled = true;
    payload.use_portal_default_voice = false;
    payload.force_voice = true;

    if (audioUrl) {
      // Best-effort Chirp3 play — aliases only; mode stays custom_tts + Azure twin.
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
    }

    // Never attach portal IVR (female/English menus) unless explicitly forced.
    const forceIvr = this.settings.get('EPBX_FORCE_IVR') === '1';
    const ivrId = this.settings.get('EPBX_IVR_ID');
    if (forceIvr && ivrId) {
      this.logger.warn(
        `[voice] EPBX_FORCE_IVR=1 — attaching ivr_id=${ivrId} (may override Azure twin)`,
      );
      payload.ivr_id = ivrId;
    }

    const ttsPresent = Boolean(
      typeof payload.tts_text === 'string' &&
        (payload.tts_text as string).trim().length > 0,
    );
    if (!ttsPresent || !hasBanglaScript(String(payload.tts_text))) {
      throw new Error(
        'Refusing ePBX dial: payload missing Bangla tts_text (English portal female risk)',
      );
    }

    this.logger.log(
      `[voice] ePBX initiate callId=${params.callId} merchantVoiceId=${params.voiceId || 'null'} resolved=${voice.id} googleVoice=${voice.voiceId} azure=${azureVoice} azureShort=${azureShort} voice_gender=${azureGender} language=${payload.tts_language} audio_url_sent=${Boolean(audioUrl)} redis_cached=${redisCached} tts_text_present=${ttsPresent} bangla_script=${banglaOk} skip_tts=${payload.skip_tts === true} mode=${payload.mode} ivr_forced=${forceIvr && Boolean(ivrId)} chars=${ttsText.length}`,
    );

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
          `[voice] ePBX OK ${path} callId=${params.callId} voiceId=${voice.id} googleVoice=${voice.voiceId} azure=${azureVoice} voice_gender=${azureGender} language=${payload.tts_language} audio_url_sent=${Boolean(audioUrl)} redis_cached=${redisCached} tts_text_present=${ttsPresent} → ${dialPhone} providerId=${providerCallId}`,
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
