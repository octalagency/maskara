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
 * ePBX.bd — Bangladesh Cloud PBX
 * Portal docs (Developer API): POST /api/v1/calls/verify
 *
 * Important: send Bangla-only TTS text and force Azure bn-BD voice.
 * Do NOT rely on ePBX default English verify template.
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

    // Bangla-only payload — avoid fields that trigger ePBX English default IVR template
    const payload: Record<string, unknown> = {
      phone_number: dialPhone,
      caller_id: callerId,
      // Full script only (no English template merge)
      custom_text: ttsText,
      tts_text: ttsText,
      message: ttsText,
      prompt: ttsText,
      language: 'bn-BD',
      tts_language: 'bn-BD',
      locale: 'bn-BD',
      skip_default_prompt: true,
      use_custom_text_only: true,
      disable_default_greeting: true,
      reference_id: params.callId,
      external_id: params.callId,
      webhook_url: this.webhookUrl('/voice/webhook/epbx'),
      status_callback: this.webhookUrl('/voice/webhook/epbx/status'),
      dtmf_webhook: this.webhookUrl('/voice/webhook/epbx/dtmf'),
      callback_url: this.webhookUrl('/voice/webhook/epbx'),
      confirm_text: 'আপনার অর্ডার নিশ্চিত করা হয়েছে। ধন্যবাদ।',
      cancel_text: 'আপনার অর্ডার বাতিল করা হয়েছে। ধন্যবাদ।',
      // Force realistic BD Azure Neural voice
      provider: voice.provider,
      ai_tts_provider: voice.provider,
      voice_id: voice.voiceId,
      tts_voice: voice.voiceId,
      voice: voice.voiceId,
    };

    if (voice.provider === 'azure') {
      payload.azure_tts_voice_id = voice.voiceId;
      payload.azure_voice = voice.voiceId;
      payload.speech_rate = '0.92';
      payload.prosody_rate = '0.92';
    }
    if (voice.provider?.startsWith('google')) {
      payload.google_tts_voice_id = voice.voiceId;
      payload.google_voice = voice.voiceId;
    }
    if (voice.provider === 'elevenlabs') {
      // Same stack ManyDial uses on manydial.com (voiceId: Algieba)
      payload.elevenlabs_voice_id = voice.voiceId;
      payload.eleven_labs_voice_id = voice.voiceId;
      payload.el_voice_id = voice.voiceId;
      payload.model_id = 'eleven_multilingual_v2';
      payload.stability = 0.45;
      payload.similarity_boost = 0.8;
    }

    // Do NOT attach portal IVR by default — IVR menus often speak English first.
    // Only if explicitly forced via EPBX_FORCE_IVR=1
    const forceIvr = this.settings.get('EPBX_FORCE_IVR') === '1';
    const ivrId = this.settings.get('EPBX_IVR_ID');
    if (forceIvr && ivrId) {
      payload.ivr_id = ivrId;
    }

    this.logger.log(
      `ePBX TTS voice=${voice.id} lang=bn-BD chars=${ttsText.length} ivr=${forceIvr && ivrId ? ivrId : 'off'}`,
    );

    const customerId = this.settings.get('EPBX_CUSTOMER_ID');
    const paths = customerId
      ? [
          `/customers/${customerId}/calls/originate`,
          '/calls/verify',
          '/calls/initiate',
        ]
      : ['/calls/verify', '/calls/initiate'];

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
          `ePBX call queued via ${path}: ${providerCallId} → ${dialPhone}`,
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
        'ePBX call route missing — expected POST /api/v1/calls/verify. Check Developer API Access on maskara.epbx.bd/portal/developer',
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
