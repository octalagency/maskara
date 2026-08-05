import { Injectable, Logger } from '@nestjs/common';
import { randomUUID } from 'crypto';
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
import { EslClient } from './esl-client';

/**
 * Maskara Own Dialer — FreeSWITCH plays Maskara Chirp3 MP3 over SIP trunk.
 * Voice is 100% merchant Settings (Leda/Algieba/…); ePBX portal TTS is unused.
 */
@Injectable()
export class MaskaraDialerProvider implements VoiceProvider {
  readonly name = 'maskara_dialer' as const;
  private readonly logger = new Logger(MaskaraDialerProvider.name);

  constructor(
    private settings: VoiceSettingsService,
    private googleTts: GoogleTtsService,
  ) {}

  isConfigured(): boolean {
    return this.settings.isMaskaraDialerConfigured();
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
    if (!this.googleTts.isConfigured()) {
      throw new Error('GOOGLE_TTS_API_KEY missing — Maskara dialer needs Chirp3 TTS');
    }
    if (!this.isConfigured()) {
      throw new Error(
        'Maskara dialer not configured — set SIP_TRUNK_HOST + SIP_TRUNK_USER (+ ESL)',
      );
    }

    const dialPhone = this.toLocalBdMobile(params.to);
    const callerId =
      this.settings.get('SIP_TRUNK_CALLER_ID') ||
      this.settings.get('EPBX_CALLER_ID') ||
      this.settings.get('EPBX_DID') ||
      '09639444146';
    const gateway =
      this.settings.get('SIP_GATEWAY_NAME') || 'maskara_trunk';

    const ttsText = buildOrderVerificationPrompt({
      storeName: params.storeName,
      customerName: params.customerName,
      orderNumber: params.orderNumber,
      totalAmount: params.totalAmount,
      customGreeting: params.customGreeting,
      productNames: params.productNames,
    });
    if (!hasBanglaScript(ttsText)) {
      throw new Error('Refusing dial: prompt has no Bangla script');
    }

    // Exact merchant Chirp3 (Leda/Algieba) — no ePBX portal remapping
    const voice = resolveLiveEpbxVoice(params.voiceId, true);
    const speechRate = params.speechRate ?? DEFAULT_SPEECH_RATE;

    const confirmBn = 'আপনার অর্ডার নিশ্চিত করা হয়েছে। ধন্যবাদ।';
    const cancelBn = 'আপনার অর্ডার বাতিল করা হয়েছে। ধন্যবাদ।';
    const invalidBn =
      'দয়া করে ১ চাপুন নিশ্চিত করতে, ২ চাপুন বাতিল করতে, পুনরায় শুনতে ০ চাপুন।';

    this.logger.log(
      `[dialer] synth callId=${params.callId} voice=${voice.voiceId} gender=${voice.gender} to=${dialPhone}`,
    );

    const prompt = await this.synthAndHost(
      ttsText,
      voice.voiceId,
      speechRate,
      `dial-${params.callId}`,
    );
    const [confirm, cancel, invalid] = await Promise.all([
      this.synthAndHost(confirmBn, voice.voiceId, speechRate, `ok-${params.callId}`),
      this.synthAndHost(cancelBn, voice.voiceId, speechRate, `cx-${params.callId}`),
      this.synthAndHost(invalidBn, voice.voiceId, speechRate, `bad-${params.callId}`),
    ]);

    const webhook = this.webhookUrl('/voice/webhook/maskara-dialer/dtmf');
    // FreeSWITCH requires RFC UUID here — Nest call ids (cuid) break SIP.
    const channelUuid = crypto.randomUUID();
    // Use ^^| delimiter so URL ":" and hangup-hook spaces cannot break parsing.
    const channelVars = [
      `origination_uuid=${channelUuid}`,
      `origination_caller_id_number=${callerId}`,
      `origination_caller_id_name=Maskara`,
      // Wait for customer 200 OK before IVR (true ring → answer)
      `ignore_early_media=true`,
      `originate_timeout=45`,
      `session_in_hangup_hook=true`,
      // \s = space inside originate vars (comma/| safe)
      `api_hangup_hook=lua\\smaskara/hangup.lua`,
      `maskara_call_id=${params.callId}`,
      `maskara_prompt_url=${prompt.url}`,
      `maskara_confirm_url=${confirm.url}`,
      `maskara_cancel_url=${cancel.url}`,
      `maskara_invalid_url=${invalid.url}`,
      `maskara_webhook=${webhook}`,
      `maskara_status_webhook=${webhook}`,
    ].join('|');

    const originate = `originate {^^|${channelVars}|}sofia/gateway/${gateway}/${dialPhone} &lua(maskara/verify.lua)`;

    const eslHost =
      this.settings.get('FREESWITCH_ESL_HOST') || 'freeswitch';
    const eslPort = Number(this.settings.get('FREESWITCH_ESL_PORT') || 8021);
    const eslPass =
      this.settings.get('FREESWITCH_ESL_PASSWORD') || 'ClueCon';

    this.logger.log(
      `[dialer] ESL originate callId=${params.callId} voice=${voice.voiceId} gateway=${gateway} caller=${callerId} → ${dialPhone}`,
    );

    // Synchronous api originate: worker concurrency=1 waits until answer/fail.
    // bgapi returned Job-UUID immediately and stacked SIP legs → ePBX
    // RECOVERY_ON_TIMER_EXPIRE (no customer ring) while UI still counted attempts.
    const reply = await EslClient.api(
      eslHost,
      eslPort,
      eslPass,
      originate,
      55_000,
    );
    const trimmed = reply.trim();
    if (/^-ERR/i.test(trimmed) || !/^\+OK/i.test(trimmed)) {
      this.logger.error(`[dialer] ESL fail callId=${params.callId}: ${reply}`);
      throw new Error(
        `Maskara dialer originate failed: ${trimmed.slice(0, 200) || 'empty ESL reply'}`,
      );
    }

    this.logger.log(
      `[dialer] OK callId=${params.callId} uuid=${channelUuid} voice=${voice.voiceId} prompt=${prompt.url} esl=${trimmed.slice(0, 80)}`,
    );
    return { providerCallId: channelUuid, status: 'RINGING' };
  }

  private async synthAndHost(
    text: string,
    voiceId: string,
    speechRate: number,
    key: string,
  ): Promise<{ url: string }> {
    const synth = await this.googleTts.synthesize(text, voiceId, speechRate);
    const hosted = await this.googleTts.hostAudio(
      synth.buffer,
      synth.mimeType,
      key,
    );
    return { url: hosted.url };
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
