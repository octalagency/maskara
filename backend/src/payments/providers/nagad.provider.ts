import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHmac } from 'crypto';
import { PaymentInitResult } from './bkash.provider';
import { PaymentSettingsService } from '../payment-settings.service';

@Injectable()
export class NagadProvider {
  private readonly logger = new Logger(NagadProvider.name);

  constructor(
    private config: ConfigService,
    private settings: PaymentSettingsService,
  ) {}

  isConfigured(): boolean {
    return this.settings.isNagadConfigured();
  }

  private get baseUrl(): string {
    return this.settings.getNagadBaseUrl();
  }

  private sign(data: string): string {
    const key = this.settings.get('NAGAD_PRIVATE_KEY')!;
    return createHmac('sha256', key).update(data).digest('base64');
  }

  async createPayment(
    amount: number,
    orderId: string,
  ): Promise<PaymentInitResult> {
    if (!this.isConfigured()) {
      const mockUrl = `${this.config.get('FRONTEND_URL')}/dashboard/subscription?mock=nagad&invoice=${orderId}`;
      this.logger.warn('Nagad PGW not configured — mock payment');
      return { paymentUrl: mockUrl, gatewayTrxId: `mock_nagad_${orderId}`, provider: 'nagad' };
    }

    const merchantId = this.settings.get('NAGAD_MERCHANT_ID')!;
    const callback = `${this.config.get('PUBLIC_API_URL') || this.config.get('API_URL')}/payments/nagad/callback`;

    const sensitive = {
      merchantId,
      datetime: new Date().toISOString(),
      orderId,
      challenge: `maskara_${orderId}`,
    };

    const initRes = await fetch(
      `${this.baseUrl}/api/dfs/check-out/initialize/${merchantId}/${orderId}`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-KM-Api-Version': 'v-0.2.0',
          'X-KM-Client-Type': 'PC_WEB',
        },
        body: JSON.stringify({
          dateTime: sensitive.datetime,
          sensitiveData: Buffer.from(JSON.stringify(sensitive)).toString('base64'),
          signature: this.sign(JSON.stringify(sensitive)),
        }),
      },
    );

    const initData = await initRes.json();
    const paymentRef = initData.paymentReferenceId || orderId;

    const completeBody = {
      merchantId,
      orderId,
      amount: amount.toFixed(2),
      currencyCode: '050',
      challenge: sensitive.challenge,
      callbackUrl: callback,
    };

    const completeRes = await fetch(
      `${this.baseUrl}/api/dfs/check-out/complete/${paymentRef}`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-KM-Api-Version': 'v-0.2.0',
          'X-KM-Client-Type': 'PC_WEB',
        },
        body: JSON.stringify({
          sensitiveData: Buffer.from(JSON.stringify(completeBody)).toString('base64'),
          signature: this.sign(JSON.stringify(completeBody)),
        }),
      },
    );

    const completeData = await completeRes.json();
    const paymentUrl =
      completeData.callBackUrl || completeData.redirectUrl || callback;

    return {
      paymentUrl,
      gatewayTrxId: paymentRef,
      provider: 'nagad',
    };
  }

  verifyCallback(payload: Record<string, unknown>): boolean {
    if (!this.isConfigured()) return true;
    const signature = payload.signature as string;
    const data = payload.sensitiveData as string;
    if (!signature || !data) return false;
    try {
      const decoded = Buffer.from(data, 'base64').toString('utf8');
      return this.sign(decoded) === signature;
    } catch {
      return false;
    }
  }
}
