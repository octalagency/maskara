import { Injectable, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';

export interface PaymentGatewayConfig {
  bkash?: {
    enabled?: boolean;
    sandbox?: boolean;
    appKey?: string;
    appSecret?: string;
    username?: string;
    password?: string;
    merchantNumber?: string;
    baseUrl?: string;
  };
  nagad?: {
    enabled?: boolean;
    sandbox?: boolean;
    merchantId?: string;
    merchantNumber?: string;
    publicKey?: string;
    privateKey?: string;
    baseUrl?: string;
  };
}

@Injectable()
export class PaymentSettingsService implements OnModuleInit {
  private dbConfig: PaymentGatewayConfig = {};

  constructor(
    private prisma: PrismaService,
    private config: ConfigService,
  ) {}

  async onModuleInit() {
    await this.refresh();
  }

  async refresh() {
    const row = await this.prisma.systemSetting.findUnique({
      where: { key: 'payment_gateways' },
    });
    this.dbConfig = (row?.value as PaymentGatewayConfig) || {};
  }

  get(key: string): string | undefined {
    const env = this.config.get<string>(key);
    if (env) return env;

    const b = this.dbConfig.bkash;
    const n = this.dbConfig.nagad;
    const map: Record<string, string | undefined> = {
      BKASH_APP_KEY: b?.appKey,
      BKASH_APP_SECRET: b?.appSecret,
      BKASH_USERNAME: b?.username,
      BKASH_PASSWORD: b?.password,
      BKASH_BASE_URL: b?.baseUrl,
      NAGAD_MERCHANT_ID: n?.merchantId,
      NAGAD_MERCHANT_NUMBER: n?.merchantNumber,
      NAGAD_PUBLIC_KEY: n?.publicKey,
      NAGAD_PRIVATE_KEY: n?.privateKey,
      NAGAD_BASE_URL: n?.baseUrl,
    };
    return map[key];
  }

  isBkashEnabled(): boolean {
    return this.dbConfig.bkash?.enabled !== false;
  }

  isNagadEnabled(): boolean {
    return this.dbConfig.nagad?.enabled !== false;
  }

  isBkashConfigured(): boolean {
    if (!this.isBkashEnabled()) return false;
    return Boolean(
      this.get('BKASH_APP_KEY') &&
        this.get('BKASH_APP_SECRET') &&
        this.get('BKASH_USERNAME'),
    );
  }

  isNagadConfigured(): boolean {
    if (!this.isNagadEnabled()) return false;
    return Boolean(
      this.get('NAGAD_MERCHANT_ID') && this.get('NAGAD_PRIVATE_KEY'),
    );
  }

  getBkashBaseUrl(): string {
    if (this.get('BKASH_BASE_URL')) return this.get('BKASH_BASE_URL')!;
    const sandbox = this.dbConfig.bkash?.sandbox !== false;
    return sandbox
      ? 'https://tokenized.sandbox.bka.sh/v1.2.0-beta'
      : 'https://tokenized.pay.bka.sh/v1.2.0-beta';
  }

  getNagadBaseUrl(): string {
    if (this.get('NAGAD_BASE_URL')) return this.get('NAGAD_BASE_URL')!;
    const sandbox = this.dbConfig.nagad?.sandbox !== false;
    return sandbox
      ? 'http://sandbox.mynagad.com:10080/remote-payment-gateway-1.0'
      : 'https://api.mynagad.com:10900/remote-payment-gateway-1.0';
  }

  maskSecret(value?: string): string {
    if (!value) return '';
    if (value.length <= 4) return '••••';
    return '••••••••' + value.slice(-4);
  }

  async getPublicConfig() {
    await this.refresh();
    const bkashKey = this.get('BKASH_APP_KEY');
    const bkashSecret = this.get('BKASH_APP_SECRET');
    const bkashPass = this.get('BKASH_PASSWORD');
    const nagadPrivate = this.get('NAGAD_PRIVATE_KEY');
    const nagadPublic = this.get('NAGAD_PUBLIC_KEY');

    return {
      bkash: {
        enabled: this.dbConfig.bkash?.enabled ?? true,
        sandbox: this.dbConfig.bkash?.sandbox ?? true,
        configured: this.isBkashConfigured(),
        baseUrl: this.getBkashBaseUrl(),
        username: this.get('BKASH_USERNAME') || '',
        merchantNumber: this.dbConfig.bkash?.merchantNumber || '',
        appKey: bkashKey ? this.maskSecret(bkashKey) : '',
        appKeySet: Boolean(bkashKey),
        appSecret: bkashSecret ? this.maskSecret(bkashSecret) : '',
        appSecretSet: Boolean(bkashSecret),
        password: bkashPass ? this.maskSecret(bkashPass) : '',
        passwordSet: Boolean(bkashPass),
      },
      nagad: {
        enabled: this.dbConfig.nagad?.enabled ?? true,
        sandbox: this.dbConfig.nagad?.sandbox ?? true,
        configured: this.isNagadConfigured(),
        baseUrl: this.getNagadBaseUrl(),
        merchantId: this.get('NAGAD_MERCHANT_ID') || '',
        merchantNumber: this.get('NAGAD_MERCHANT_NUMBER') || '',
        publicKey: nagadPublic ? this.maskSecret(nagadPublic) : '',
        publicKeySet: Boolean(nagadPublic),
        privateKey: nagadPrivate ? this.maskSecret(nagadPrivate) : '',
        privateKeySet: Boolean(nagadPrivate),
      },
      status: {
        bkash: this.isBkashConfigured(),
        nagad: this.isNagadConfigured(),
      },
    };
  }

  async saveConfig(updates: PaymentGatewayConfig) {
    await this.refresh();
    const current = this.dbConfig;

    const merged: PaymentGatewayConfig = {
      bkash: { ...current.bkash, ...updates.bkash },
      nagad: { ...current.nagad, ...updates.nagad },
    };

    const keepSecret = (incoming?: string, existing?: string) => {
      if (!incoming || incoming.startsWith('••••')) return existing;
      return incoming;
    };

    merged.bkash!.appKey = keepSecret(updates.bkash?.appKey, current.bkash?.appKey);
    merged.bkash!.appSecret = keepSecret(updates.bkash?.appSecret, current.bkash?.appSecret);
    merged.bkash!.password = keepSecret(updates.bkash?.password, current.bkash?.password);
    merged.nagad!.publicKey = keepSecret(updates.nagad?.publicKey, current.nagad?.publicKey);
    merged.nagad!.privateKey = keepSecret(updates.nagad?.privateKey, current.nagad?.privateKey);

    await this.prisma.systemSetting.upsert({
      where: { key: 'payment_gateways' },
      create: { key: 'payment_gateways', value: merged as never },
      update: { value: merged as never },
    });

    this.dbConfig = merged;
    return this.getPublicConfig();
  }
}
