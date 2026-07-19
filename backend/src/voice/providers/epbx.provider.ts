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
 * ePBX = dial + play URL only. Maskara = all TTS.
 *
 * Never send portal voice / WaveNet / Azure / tts_provider fields — those make
 * ePBX synthesize female eAI instead of playing Maskara Chirp3 MP3.
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
        'GOOGLE_TTS_API_KEY missing — Maskara TTS required (ePBX is dial-only)',
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
      throw new Error('Refusing dial: Maskara prompt has no Bangla script');
    }

    // Maskara owns voice — Chirp3 Algieba (male) by default
    const maskaraVoice = resolveLiveEpbxVoice(params.voiceId, true);
    const speechRate = params.speechRate ?? DEFAULT_SPEECH_RATE;

    const confirmBn = 'আপনার অর্ডার নিশ্চিত করা হয়েছে। ধন্যবাদ।';
    const cancelBn = 'আপনার অর্ডার বাতিল করা হয়েছে। ধন্যবাদ।';
    const invalidBn =
      'দয়া করে ১ চাপুন নিশ্চিত করতে, ২ চাপুন বাতিল করতে, পুনরায় শুনতে ০ চাপুন।';

    this.logger.log(
      `[voice] Maskara TTS only callId=${params.callId} voice=${maskaraVoice.voiceId} gender=${maskaraVoice.gender} chars=${ttsText.length} — ePBX dial-only`,
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
        this.synthAndHost(
          confirmBn,
          maskaraVoice.voiceId,
          speechRate,
          `ok-${params.callId}`,
        ),
        this.synthAndHost(
          cancelBn,
          maskaraVoice.voiceId,
          speechRate,
          `cx-${params.callId}`,
        ),
        this.synthAndHost(
          invalidBn,
          maskaraVoice.voiceId,
          speechRate,
          `bad-${params.callId}`,
        ),
      ]);
      confirmUrl = c.url;
      cancelUrl = x.url;
      invalidUrl = i.url;
    } catch (err) {
      this.logger.warn(
        `DTMF clips failed (prompt still used): ${err instanceof Error ? err.message : err}`,
      );
    }

    // Dial-only payload — NO portal TTS fields (those trigger female WaveNet)
    const payload = this.buildDialOnlyPayload({
      dialPhone,
      callerId,
      callId: params.callId,
      audioUrl: prompt.url,
      confirmUrl,
      cancelUrl,
      invalidUrl,
      maskaraVoiceId: maskaraVoice.voiceId,
    });

    this.logger.log(
      `[voice] ePBX DIAL-ONLY callId=${params.callId} mode=play_audio skip_tts=true audio=${prompt.url} maskara=${maskaraVoice.voiceId} redis=${prompt.redisCached}`,
    );
    this.logVoicePayload(params.callId, payload);

    return this.postOriginate(apiKey, payload, params.callId, dialPhone, {
      maskaraVoiceId: maskaraVoice.voiceId,
      redisCached: prompt.redisCached,
      audioUrl: prompt.url,
    });
  }

  /** ePBX: phone + play Maskara MP3 + DTMF webhooks. Nothing else for voice. */
  private buildDialOnlyPayload(args: {
    dialPhone: string;
    callerId: string;
    callId: string;
    audioUrl: string;
    confirmUrl: string | null;
    cancelUrl: string | null;
    invalidUrl: string | null;
    maskaraVoiceId: string;
  }): Record<string, unknown> {
    const { dialPhone, callerId, callId, audioUrl } = args;

    const payload: Record<string, unknown> = {
      phone_number: dialPhone,
      destination_number: dialPhone,
      caller_id: callerId,
      to: dialPhone,
      from: callerId,

      // Play Maskara-hosted Chirp3 — ePBX must not synthesize
      mode: 'play_audio',
      dial_only: true,
      skip_tts: true,
      disable_tts: true,
      tts_enabled: false,
      use_portal_default_voice: false,
      use_eai: false,
      eai: false,
      eai_enabled: false,
      use_wavenet: false,
      use_azure: false,
      use_elevenlabs: false,
      audio_only: true,
      play_pre_recorded: true,
      use_audio_url: true,
      prefer_audio_url: true,
      require_audio_url: true,

      audio_url: audioUrl,
      media_url: audioUrl,
      play_url: audioUrl,
      play_audio: audioUrl,
      mp3_url: audioUrl,
      file_url: audioUrl,
      greeting_audio_url: audioUrl,
      prompt_audio_url: audioUrl,
      replay_audio_url: audioUrl,
      repeat_audio_url: audioUrl,
      fixed_audio_url: audioUrl,

      // DTMF only — no portal voice menus / IVR
      confirm_digit: '1',
      cancel_digit: '2',
      replay_digit: '0',
      repeat_digit: '0',
      replay_on_zero: true,
      zero_digit_action: 'replay',
      option_0: 'replay',
      dtmf_0: 'replay',

      reference_id: callId,
      external_id: callId,
      maskara_voice: args.maskaraVoiceId,
      maskara_tts: true,
      voice_engine: 'maskara',

      webhook_url: this.webhookUrl('/voice/webhook/epbx'),
      status_callback: this.webhookUrl('/voice/webhook/epbx/status'),
      dtmf_webhook: this.webhookUrl('/voice/webhook/epbx/dtmf'),
      callback_url: this.webhookUrl('/voice/webhook/epbx'),
    };

    if (args.confirmUrl) {
      payload.confirm_audio_url = args.confirmUrl;
      payload.success_audio_url = args.confirmUrl;
    }
    if (args.cancelUrl) {
      payload.cancel_audio_url = args.cancelUrl;
      payload.failure_audio_url = args.cancelUrl;
    }
    if (args.invalidUrl) {
      payload.invalid_audio_url = args.invalidUrl;
    }

    if (this.settings.get('EPBX_IVR_ID')) {
      this.logger.warn(
        `[voice] EPBX_IVR_ID set but ignored — Maskara dial-only (no portal IVR)`,
      );
    }

    return payload;
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
        `Maskara TTS audio not fetchable via=${hosted.via} redis=${hosted.redisCached} url=${hosted.url}`,
      );
    }
    return { url: hosted.url, redisCached: hosted.redisCached };
  }

  private logVoicePayload(
    callId: string,
    payload: Record<string, unknown>,
  ): void {
    const keys = [
      'mode',
      'dial_only',
      'skip_tts',
      'tts_enabled',
      'disable_tts',
      'use_audio_url',
      'prefer_audio_url',
      'audio_url',
      'confirm_audio_url',
      'cancel_audio_url',
      'invalid_audio_url',
      'maskara_voice',
      'voice_engine',
      'use_eai',
      'use_wavenet',
      'use_azure',
      'tts_text',
      'tts_provider',
      'voice_name',
      'ivr_id',
    ];
    const snapshot: Record<string, unknown> = {};
    for (const k of keys) {
      if (payload[k] !== undefined) snapshot[k] = payload[k];
    }
    this.logger.log(
      `[voice] ePBX DIAL-ONLY payload callId=${callId} ${JSON.stringify(snapshot)}`,
    );
  }

  private async postOriginate(
    apiKey: string,
    payload: Record<string, unknown>,
    callId: string,
    dialPhone: string,
    meta: {
      maskaraVoiceId: string;
      redisCached: boolean;
      audioUrl: string;
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
      for (let attempt = 0; attempt < 2; attempt++) {
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
            `[voice] ePBX OK ${path} callId=${callId} dial-only maskara=${meta.maskaraVoiceId} audio=${meta.audioUrl} → ${dialPhone} providerId=${providerCallId}`,
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

        // Schema may require a text field — add Bangla once, still no portal voice / TTS
        if (
          attempt === 0 &&
          res.status === 400 &&
          /tts|text|message|required/i.test(lastError) &&
          payload.tts_text === undefined
        ) {
          this.logger.warn(
            `[voice] ePBX wants text — adding Bangla stub, keep skip_tts (Maskara audio only)`,
          );
          payload.tts_text =
            'অর্ডার নিশ্চিতকরণ কল। অনুগ্রহ করে অডিও শুনুন।';
          payload.message = payload.tts_text;
          payload.language = 'bn';
          continue;
        }

        if (res.status !== 404) break;
        break;
      }
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
