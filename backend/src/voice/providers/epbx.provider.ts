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
  DEFAULT_SPEECH_RATE,
  buildOrderVerificationPrompt,
  resolveMerchantVoice,
} from './bangla-prompt';

/**
 * ePBX.bd — Bangla outbound dial/telephony only.
 *
 * When GOOGLE_TTS_API_KEY is set: Maskara synthesizes Chirp3 MP3, hosts via
 * Redis/S3, and sends audio_url only. Bangla text + Azure voice fields are
 * omitted so ePBX cannot fall back to portal নবনীতা.
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
    const speechRate = params.speechRate ?? DEFAULT_SPEECH_RATE;
    let audioUrl: string | null = null;
    let confirmAudioUrl: string | null = null;
    let cancelAudioUrl: string | null = null;
    let invalidAudioUrl: string | null = null;

    const confirmBn = 'আপনার অর্ডার নিশ্চিত করা হয়েছে। ধন্যবাদ।';
    const cancelBn = 'আপনার অর্ডার বাতিল করা হয়েছে। ধন্যবাদ।';
    const invalidBn =
      'দয়া করে ১ চাপুন নিশ্চিত করতে, ২ চাপুন বাতিল করতে, পুনরায় শুনতে ০ চাপুন।';

    if (voice.provider === 'google' && this.googleTts.isConfigured()) {
      try {
        const synth = await this.googleTts.synthesize(
          ttsText,
          voice.voiceId,
          speechRate,
        );
        audioUrl = await this.googleTts.hostAudio(
          synth.buffer,
          synth.mimeType,
          `call-${params.callId}`,
        );

        // Same Chirp3 voice for DTMF confirm/cancel/invalid (never ePBX Azure)
        try {
          const [c, x, i] = await Promise.all([
            this.googleTts.synthesize(confirmBn, voice.voiceId, speechRate),
            this.googleTts.synthesize(cancelBn, voice.voiceId, speechRate),
            this.googleTts.synthesize(invalidBn, voice.voiceId, speechRate),
          ]);
          [confirmAudioUrl, cancelAudioUrl, invalidAudioUrl] = await Promise.all([
            this.googleTts.hostAudio(c.buffer, c.mimeType, `ok-${params.callId}`),
            this.googleTts.hostAudio(x.buffer, x.mimeType, `cx-${params.callId}`),
            this.googleTts.hostAudio(i.buffer, i.mimeType, `bad-${params.callId}`),
          ]);
        } catch (dtmfErr) {
          this.logger.warn(
            `DTMF phrase TTS failed (prompt audio still used): ${dtmfErr instanceof Error ? dtmfErr.message : dtmfErr}`,
          );
        }

        this.logger.log(
          `[voice] Google TTS ready callId=${params.callId} voiceId=${voice.id} googleVoice=${voice.voiceId} audio_url=${audioUrl}`,
        );
      } catch (err) {
        this.logger.warn(
          `Google TTS failed for call — falling back to Azure Pradeep: ${err instanceof Error ? err.message : err}`,
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

    const payload: Record<string, unknown> = {
      phone_number: dialPhone,
      caller_id: callerId,
      to: dialPhone,
      from: callerId,

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

      replay_digit: '0',
      repeat_digit: '0',
      replay_on_zero: true,
      repeat_on_digit: '0',
      zero_digit_action: 'replay',
      option_0: 'replay',
      dtmf_0: 'replay',
      confirm_digit: '1',
      cancel_digit: '2',

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
    };

    if (audioUrl) {
      // Hosted Google audio ONLY — no Bangla text, no Azure voice fields
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
      payload.replay_audio_url = audioUrl;
      payload.repeat_audio_url = audioUrl;
      payload.use_audio_url = true;
      payload.skip_tts = true;
      payload.disable_tts = true;
      payload.tts_enabled = false;
      payload.ai_tts_provider = 'audio';
      payload.tts_provider = 'audio';
      payload.provider = 'audio';
      payload.speech_provider = 'audio';
      payload.tts_engine = 'audio';
      payload.mode = 'audio_url';

      // Critical: empty greeting text so ePBX cannot synthesize portal Nabanita
      payload.custom_text = '';
      payload.tts_text = '';
      payload.message = '';
      payload.text = '';
      payload.prompt = '';
      payload.greeting = '';
      payload.repeat_text = '';
      payload.replay_text = '';

      if (confirmAudioUrl) {
        payload.confirm_audio_url = confirmAudioUrl;
        payload.success_audio_url = confirmAudioUrl;
        payload.confirm_text = '';
        payload.success_text = '';
      } else {
        payload.confirm_text = confirmBn;
        payload.success_text = confirmBn;
      }
      if (cancelAudioUrl) {
        payload.cancel_audio_url = cancelAudioUrl;
        payload.failure_audio_url = cancelAudioUrl;
        payload.cancel_text = '';
        payload.failure_text = '';
      } else {
        payload.cancel_text = cancelBn;
        payload.failure_text = cancelBn;
      }
      if (invalidAudioUrl) {
        payload.invalid_audio_url = invalidAudioUrl;
        payload.invalid_text = '';
      } else {
        payload.invalid_text = invalidBn;
      }

      // If any short DTMF text remains, force male Azure — never portal নবনীতা
      payload.azure_tts_voice_id = 'bn-BD-PradeepNeural';
      payload.azure_voice = 'bn-BD-PradeepNeural';
    } else {
      // Text-TTS fallback — hard-lock Azure Pradeep (never leave voice unset)
      const azureVoice =
        voice.provider === 'azure' ? voice.voiceId : 'bn-BD-PradeepNeural';
      payload.custom_text = ttsText;
      payload.tts_text = ttsText;
      payload.message = ttsText;
      payload.text = ttsText;
      payload.prompt = ttsText;
      payload.greeting = ttsText;
      payload.repeat_text = ttsText;
      payload.replay_text = ttsText;
      payload.confirm_text = confirmBn;
      payload.cancel_text = cancelBn;
      payload.success_text = confirmBn;
      payload.failure_text = cancelBn;
      payload.invalid_text = invalidBn;
      payload.provider = 'azure';
      payload.ai_tts_provider = 'azure';
      payload.tts_provider = 'azure';
      payload.tts_engine = 'azure';
      payload.speech_provider = 'azure';
      payload.azure_tts_voice_id = azureVoice;
      payload.azure_voice = azureVoice;
      payload.azure_voice_name = azureVoice;
      payload.voice_id = azureVoice;
      payload.tts_voice = azureVoice;
      payload.tts_voice_id = azureVoice;
      payload.tts_voice_name = azureVoice;
      payload.voice = azureVoice;
      payload.voice_name = azureVoice;
      payload.speech_rate = '0.92';
      payload.rate = '0.92';
    }

    const forceIvr = this.settings.get('EPBX_FORCE_IVR') === '1';
    const ivrId = this.settings.get('EPBX_IVR_ID');
    if (forceIvr && ivrId) {
      payload.ivr_id = ivrId;
    }

    this.logger.log(
      `[voice] ePBX initiate callId=${params.callId} merchantVoiceId=${params.voiceId || 'null'} resolved=${voice.id} audio_url_sent=${Boolean(audioUrl)} audio_url=${audioUrl || 'none'} mode=${payload.mode} chars=${ttsText.length}`,
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
          `[voice] ePBX OK ${path} callId=${params.callId} voiceId=${voice.id} audio_url_sent=${Boolean(audioUrl)} → ${dialPhone} providerId=${providerCallId}`,
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
