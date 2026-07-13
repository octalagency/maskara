import { Injectable, Logger } from '@nestjs/common';
import { VoiceSettingsService } from '../voice-settings.service';
import {
  InitiateCallParams,
  InitiateCallResult,
  VoiceProvider,
} from './voice-provider.interface';
import {
  buildOrderVerificationPrompt,
  resolveMerchantVoice,
} from './bangla-prompt';

/**
 * ePBX.bd — Bangla-only TTS outbound calls.
 *
 * Avoid /calls/verify default English template: prefer /calls/initiate with
 * a single custom Bangla script + explicit voice provider.
 */
@Injectable()
export class EpbxProvider implements VoiceProvider {
  readonly name = 'epbx' as const;
  private readonly logger = new Logger(EpbxProvider.name);

  constructor(private settings: VoiceSettingsService) {}

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

    const voice = resolveMerchantVoice(params.voiceId);
    const confirmBn = 'আপনার অর্ডার নিশ্চিত করা হয়েছে। ধন্যবাদ।';
    const cancelBn = 'আপনার অর্ডার বাতিল করা হয়েছে। ধন্যবাদ।';

    // Minimal Bangla-only payload — do NOT send customer_name/amount/order_id
    // (those trigger ePBX English COD template after Bangla).
    const payload: Record<string, unknown> = {
      phone_number: dialPhone,
      caller_id: callerId,
      to: dialPhone,
      from: callerId,

      // Single script source
      custom_text: ttsText,
      tts_text: ttsText,
      message: ttsText,
      text: ttsText,
      prompt: ttsText,
      greeting: ttsText,

      // Language hard-lock
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
      mode: 'custom_tts',

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

    if (voice.provider === 'azure') {
      payload.azure_tts_voice_id = voice.voiceId;
      payload.azure_voice = voice.voiceId;
      payload.speech_rate = '0.92';
    } else if (voice.provider === 'google') {
      payload.google_tts_voice_id = voice.voiceId;
      payload.google_voice = voice.voiceId;
      payload.ai_tts_provider = 'google';
      payload.provider = 'google';
      payload.tts_provider = 'google';
      // Chirp3 short name — some ePBX builds expect this
      if (voice.voiceId.includes('Algieba')) {
        payload.voice_name = 'Algieba';
        payload.chirp_voice = 'Algieba';
        payload.google_voice_name = 'Algieba';
      }
    } else if (voice.provider === 'elevenlabs') {
      payload.elevenlabs_voice_id = voice.voiceId;
      payload.eleven_labs_voice_id = voice.voiceId;
      payload.el_voice_id = voice.voiceId;
      payload.model_id = 'eleven_multilingual_v2';
      payload.stability = 0.45;
      payload.similarity_boost = 0.8;
      payload.ai_tts_provider = 'elevenlabs';
      payload.provider = 'elevenlabs';
    }

    // Never attach portal IVR (English menus) unless forced
    const forceIvr = this.settings.get('EPBX_FORCE_IVR') === '1';
    const ivrId = this.settings.get('EPBX_IVR_ID');
    if (forceIvr && ivrId) {
      payload.ivr_id = ivrId;
    }

    this.logger.log(
      `ePBX call voice=${voice.id} merchantVoice=${params.voiceId || 'default'} chars=${ttsText.length} preview="${ttsText.slice(0, 80)}…"`,
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
          `ePBX OK ${path} voice=${voice.id} → ${dialPhone} id=${providerCallId}`,
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
