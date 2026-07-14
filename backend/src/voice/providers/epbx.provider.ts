import { Injectable, Logger } from '@nestjs/common';
import { VoiceSettingsService } from '../voice-settings.service';
import { GoogleTtsService } from '../google-tts.service';
import {
  InitiateCallParams,
  InitiateCallResult,
  VoiceProvider,
} from './voice-provider.interface';
import {
  AZURE_FALLBACK_VOICE_ID,
  buildOrderVerificationPrompt,
  resolveMerchantVoice,
} from './bangla-prompt';

/**
 * ePBX.bd — Bangla outbound calls.
 *
 * For Google Chirp3: Maskara synthesizes MP3 via Cloud TTS, hosts a public URL,
 * and asks ePBX to play that audio (audio_url / media_url / play_url).
 * ePBX's own Google/ElevenLabs TTS fields are unreliable on this account.
 *
 * Azure Neural remains the text-TTS fallback when Google TTS is unavailable.
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

    let voice = resolveMerchantVoice(params.voiceId);
    let audioUrl: string | null = null;

    // Direct Google Cloud TTS → host MP3 → ePBX plays URL (bypasses ePBX Google TTS)
    if (voice.provider === 'google' && this.googleTts.isConfigured()) {
      try {
        const synth = await this.googleTts.synthesize(
          ttsText,
          voice.voiceId,
          params.speechRate ?? 1.05,
        );
        audioUrl = await this.googleTts.hostAudio(
          synth.buffer,
          synth.mimeType,
          `call-${params.callId}`,
        );
        this.logger.log(
          `Google TTS hosted for call ${params.callId}: ${audioUrl.slice(0, 80)}…`,
        );
      } catch (err) {
        this.logger.warn(
          `Google TTS failed for call — falling back to Azure: ${err instanceof Error ? err.message : err}`,
        );
        voice = resolveMerchantVoice(AZURE_FALLBACK_VOICE_ID);
        audioUrl = null;
      }
    } else if (voice.provider === 'google') {
      this.logger.warn(
        'Google voice selected but GOOGLE_TTS_API_KEY missing — using Azure Pradeep',
      );
      voice = resolveMerchantVoice(AZURE_FALLBACK_VOICE_ID);
    }

    const confirmBn = 'আপনার অর্ডার নিশ্চিত করা হয়েছে। ধন্যবাদ।';
    const cancelBn = 'আপনার অর্ডার বাতিল করা হয়েছে। ধন্যবাদ।';

    // Minimal Bangla-only payload — do NOT send customer_name/amount/order_id
    // (those trigger ePBX English COD template after Bangla).
    const payload: Record<string, unknown> = {
      phone_number: dialPhone,
      caller_id: callerId,
      to: dialPhone,
      from: callerId,

      // Single script source (kept even with audio_url — some ePBX builds need both)
      custom_text: ttsText,
      tts_text: ttsText,
      message: ttsText,
      text: ttsText,
      prompt: ttsText,
      greeting: ttsText,

      // Language hard-lock
      language: 'bn',
      lang: 'bn',
      tts_language: voice.provider === 'google' ? 'bn-IN' : 'bn-BD',
      locale: 'bn-BD',
      speech_language: 'bn-BD',
      speak_english: false,
      english_enabled: false,
      skip_default_prompt: true,
      use_custom_text_only: true,
      disable_default_greeting: true,
      template: 'custom',
      mode: audioUrl ? 'audio_url' : 'custom_tts',

      // DTMF replies — Bangla only
      confirm_text: confirmBn,
      cancel_text: cancelBn,
      success_text: confirmBn,
      failure_text: cancelBn,
      invalid_text: 'দয়া করে এক চাপুন নিশ্চিত করতে, দুই চাপুন বাতিল করতে।',

      // Explicitly clear English template slots
      customer_name: '',
      amount: '',
      order_id: '',
      store_name: '',
      default_greeting: '',
      english_text: '',
      english_prompt: '',

      reference_id: params.callId,
      external_id: params.callId,
      webhook_url: this.webhookUrl('/voice/webhook/epbx'),
      status_callback: this.webhookUrl('/voice/webhook/epbx/status'),
      dtmf_webhook: this.webhookUrl('/voice/webhook/epbx/dtmf'),
      callback_url: this.webhookUrl('/voice/webhook/epbx'),

      provider: voice.provider,
      ai_tts_provider: voice.provider,
      tts_provider: voice.provider,
      voice_id: voice.voiceId,
      tts_voice: voice.voiceId,
      voice: voice.voiceId,
    };

    if (audioUrl) {
      // Best-effort: ePBX field names vary; send common aliases.
      // Limitation: if ePBX ignores all of these, it will fall back to its own TTS
      // (often Azure Nabanita). Maskara still uses real Chirp3 for /voice/preview.
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
      payload.use_audio_url = true;
      payload.skip_tts = true;
      // Prefer our audio over ePBX Google/Azure engine for the greeting
      payload.ai_tts_provider = 'audio';
      payload.tts_provider = 'audio';
      payload.provider = 'audio';
    } else if (voice.provider === 'azure') {
      // Hard-lock Azure — ePBX portal default is Nabanita unless these are set
      payload.provider = 'azure';
      payload.ai_tts_provider = 'azure';
      payload.tts_provider = 'azure';
      payload.tts_engine = 'azure';
      payload.speech_provider = 'azure';
      payload.azure_tts_voice_id = voice.voiceId;
      payload.azure_voice = voice.voiceId;
      payload.azure_voice_name = voice.voiceId;
      payload.voice_id = voice.voiceId;
      payload.tts_voice = voice.voiceId;
      payload.tts_voice_id = voice.voiceId;
      payload.tts_voice_name = voice.voiceId;
      payload.voice = voice.voiceId;
      payload.voice_name = voice.voiceId;
      payload.speech_rate = '0.92';
      payload.rate = '0.92';
    } else if (voice.provider === 'google') {
      // Legacy path: ask ePBX Google (usually ignored → portal Nabanita)
      payload.google_tts_voice_id = voice.voiceId;
      payload.google_voice = voice.voiceId;
      payload.ai_tts_provider = 'google';
      payload.provider = 'google';
      payload.tts_provider = 'google';
      if (voice.voiceId.includes('Algieba')) {
        payload.voice_name = 'Algieba';
        payload.chirp_voice = 'Algieba';
        payload.google_voice_name = 'Algieba';
      }
    }

    // Never attach portal IVR (English menus) unless forced
    const forceIvr = this.settings.get('EPBX_FORCE_IVR') === '1';
    const ivrId = this.settings.get('EPBX_IVR_ID');
    if (forceIvr && ivrId) {
      payload.ivr_id = ivrId;
    }

    this.logger.log(
      `ePBX call voice=${voice.id} audio=${audioUrl ? 'yes' : 'no'} merchantVoice=${params.voiceId || 'default'} chars=${ttsText.length} preview="${ttsText.slice(0, 80)}…"`,
    );

    const customerId = this.settings.get('EPBX_CUSTOMER_ID');
    // Prefer initiate (pure TTS) over verify (COD template often adds English)
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
          `ePBX OK ${path} voice=${voice.id} audio=${Boolean(audioUrl)} → ${dialPhone} id=${providerCallId}`,
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

  private toLocalBdMobile(phone: string): string {
    const digits = phone.replace(/\D/g, '');
    if (digits.startsWith('880') && digits.length >= 13) return `0${digits.slice(3)}`;
    if (digits.startsWith('0') && digits.length === 11) return digits;
    if (digits.length === 10) return `0${digits}`;
    return digits;
  }
}
