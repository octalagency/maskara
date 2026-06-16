import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PaymentSettingsService } from '../payment-settings.service';

export interface PaymentInitResult {
  paymentUrl: string;
  gatewayTrxId: string;
  provider: 'bkash' | 'nagad';
}

@Injectable()
export class BkashProvider {
  private readonly logger = new Logger(BkashProvider.name);

  constructor(
    private config: ConfigService,
    private settings: PaymentSettingsService,
  ) {}

  isConfigured(): boolean {
    return this.settings.isBkashConfigured();
  }

  private get baseUrl(): string {
    return this.settings.getBkashBaseUrl();
  }

  private async getToken(): Promise<string> {
    const res = await fetch(`${this.baseUrl}/tokenized/checkout/token/grant`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        username: this.settings.get('BKASH_USERNAME')!,
        password: this.settings.get('BKASH_PASSWORD')!,
      },
      body: JSON.stringify({
        app_key: this.settings.get('BKASH_APP_KEY'),
        app_secret: this.settings.get('BKASH_APP_SECRET'),
      }),
    });
    const data = await res.json();
    if (!data.id_token) throw new Error(data.statusMessage || 'bKash token failed');
    return data.id_token;
  }

  async createPayment(
    amount: number,
    merchantInvoice: string,
  ): Promise<PaymentInitResult> {
    if (!this.isConfigured()) {
      const mockUrl = `${this.config.get('FRONTEND_URL')}/dashboard/subscription?mock=bkash&invoice=${merchantInvoice}`;
      this.logger.warn('bKash PGW not configured — mock payment');
      return { paymentUrl: mockUrl, gatewayTrxId: `mock_bkash_${merchantInvoice}`, provider: 'bkash' };
    }

    const token = await this.getToken();
    const callback = `${this.config.get('PUBLIC_API_URL') || this.config.get('API_URL')}/payments/bkash/callback`;

    const createRes = await fetch(`${this.baseUrl}/tokenized/checkout/create`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: token,
        'X-APP-Key': this.settings.get('BKASH_APP_KEY')!,
      },
      body: JSON.stringify({
        mode: '0011',
        payerReference: merchantInvoice,
        callbackURL: callback,
        amount: amount.toFixed(2),
        currency: 'BDT',
        intent: 'sale',
        merchantInvoiceNumber: merchantInvoice,
      }),
    });

    const data = await createRes.json();
    if (!data.bkashURL) throw new Error(data.statusMessage || 'bKash create failed');

    return {
      paymentUrl: data.bkashURL,
      gatewayTrxId: data.paymentID,
      provider: 'bkash',
    };
  }

  async executePayment(paymentId: string): Promise<{ success: boolean; trxId?: string }> {
    if (!this.isConfigured()) {
      return { success: true, trxId: `mock_exec_${paymentId}` };
    }

    const token = await this.getToken();
    const res = await fetch(`${this.baseUrl}/tokenized/checkout/execute`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: token,
        'X-APP-Key': this.settings.get('BKASH_APP_KEY')!,
      },
      body: JSON.stringify({ paymentID: paymentId }),
    });
    const data = await res.json();
    return {
      success: data.transactionStatus === 'Completed',
      trxId: data.trxID,
    };
  }
}
