import { Injectable, Logger } from '@nestjs/common';
import { VoiceSettingsService } from '../voice-settings.service';
import {
  InitiateCallParams,
  InitiateCallResult,
  VoiceProvider,
} from './voice-provider.interface';
import { buildOrderVerificationPrompt } from './bangla-prompt';

/**
 * ippbx.com.bd (NEO Technologies) — Voice Broadcast / IVR
 * Contact: +880 9678 22 11 11 | API credentials from sales/support
 * Configure IPPBX_API_URL after receiving integration docs from ippbx.
 */
@Injectable()
export class IppbxProvider implements VoiceProvider {
  readonly name = 'ippbx' as const;
  private readonly logger = new Logger(IppbxProvider.name);

  constructor(private settings: VoiceSettingsService) {}

  isConfigured(): boolean {
    return this.settings.isIppbxConfigured();
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
    const apiUrl = this.settings.get('IPPBX_API_URL')?.replace(/\/$/, '');
    const apiKey = this.settings.get('IPPBX_API_KEY');
    const apiSecret = this.settings.get('IPPBX_API_SECRET') || '';

    if (!apiUrl || !apiKey) {
      throw new Error('IPPBX_API_URL and IPPBX_API_KEY required');
    }

    const message = buildOrderVerificationPrompt({
      storeName: params.storeName,
      customerName: params.customerName,
      orderNumber: params.orderNumber,
      totalAmount: params.totalAmount,
    });

    const payload = {
      api_key: apiKey,
      api_secret: apiSecret || undefined,
      mobile: this.normalizeBdPhone(params.to),
      phone: this.normalizeBdPhone(params.to),
      message,
      tts_text: message,
      campaign_type: 'ivr',
      reference_id: params.callId,
      callback_url: this.webhookUrl('/voice/webhook/ippbx'),
      status_url: this.webhookUrl('/voice/webhook/ippbx/status'),
      dtmf_url: this.webhookUrl('/voice/webhook/ippbx/dtmf'),
    };

    const res = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
        ...(apiKey && !apiUrl.includes('api_key')
          ? { Authorization: `Bearer ${apiKey}`, 'X-API-Key': apiKey }
          : {}),
      },
      body: JSON.stringify(payload),
    });

    const body = await res.json().catch(() => ({}));
    if (!res.ok) {
      this.logger.error(`ippbx API error: ${res.status} ${JSON.stringify(body)}`);
      throw new Error(
        (body as { message?: string }).message ||
          `ippbx call failed (${res.status})`,
      );
    }

    const providerCallId =
      (body as { call_id?: string }).call_id ||
      (body as { id?: string }).id ||
      (body as { broadcast_id?: string }).broadcast_id ||
      params.callId;

    this.logger.log(`ippbx call queued: ${providerCallId} → ${params.to}`);
    return { providerCallId: String(providerCallId), status: 'RINGING' };
  }

  private normalizeBdPhone(phone: string): string {
    const digits = phone.replace(/\D/g, '');
    if (digits.startsWith('880')) return digits;
    if (digits.startsWith('0')) return `88${digits}`;
    if (digits.length === 10) return `880${digits}`;
    return digits;
  }
}
