import { Injectable, Logger } from '@nestjs/common';
import { VoiceSettingsService } from '../voice-settings.service';
import {
  InitiateCallParams,
  InitiateCallResult,
  VoiceProvider,
} from './voice-provider.interface';
import { buildOrderVerificationPrompt } from './bangla-prompt';

/**
 * ePBX.bd — Bangladesh Cloud PBX
 * Docs: https://epbx.bd/developer/api-docs
 * Order verification: https://epbx.bd/auto-order-call
 * Endpoint: POST /api/v1/calls/initiate
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

    const ttsText = buildOrderVerificationPrompt({
      storeName: params.storeName,
      customerName: params.customerName,
      orderNumber: params.orderNumber,
      totalAmount: params.totalAmount,
    });

    const payload: Record<string, unknown> = {
      destination_number: this.normalizeBdPhone(params.to),
      phone: this.normalizeBdPhone(params.to),
      tts_text: ttsText,
      message: ttsText,
      reference_id: params.callId,
      external_id: params.callId,
      webhook_url: this.webhookUrl('/voice/webhook/epbx'),
      status_callback: this.webhookUrl('/voice/webhook/epbx/status'),
      dtmf_webhook: this.webhookUrl('/voice/webhook/epbx/dtmf'),
    };

    const ivrId = this.settings.get('EPBX_IVR_ID');
    if (ivrId) payload.ivr_id = ivrId;

    const customerId = this.settings.get('EPBX_CUSTOMER_ID');
    const path = customerId
      ? `/customers/${customerId}/calls/originate`
      : '/calls/initiate';

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
    if (!res.ok) {
      this.logger.error(`ePBX API error: ${res.status} ${JSON.stringify(body)}`);
      throw new Error(
        (body as { message?: string }).message ||
          `ePBX call failed (${res.status})`,
      );
    }

    const providerCallId =
      (body as { call_id?: string }).call_id ||
      (body as { id?: string }).id ||
      (body as { data?: { id?: string } }).data?.id ||
      params.callId;

    this.logger.log(`ePBX call queued: ${providerCallId} → ${params.to}`);
    return { providerCallId: String(providerCallId), status: 'RINGING' };
  }

  private normalizeBdPhone(phone: string): string {
    const digits = phone.replace(/\D/g, '');
    if (digits.startsWith('880')) return `+${digits}`;
    if (digits.startsWith('0')) return `+88${digits}`;
    if (digits.length === 10) return `+880${digits}`;
    return phone.startsWith('+') ? phone : `+${digits}`;
  }
}
