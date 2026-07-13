import { Injectable, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';

export interface VoiceProviderConfig {
  provider?: string;
  publicApiUrl?: string;
  epbx?: {
    enabled?: boolean;
    apiUrl?: string;
    apiKey?: string;
    customerId?: string;
    ivrId?: string;
  };
  ippbx?: {
    enabled?: boolean;
    apiUrl?: string;
    apiKey?: string;
    apiSecret?: string;
  };
  twilio?: {
    accountSid?: string;
    authToken?: string;
    phoneNumber?: string;
  };
}

@Injectable()
export class VoiceSettingsService implements OnModuleInit {
  private dbConfig: VoiceProviderConfig = {};

  constructor(
    private prisma: PrismaService,
    private config: ConfigService,
  ) {}

  async onModuleInit() {
    await this.refresh();
  }

  async refresh() {
    const row = await this.prisma.systemSetting.findUnique({
      where: { key: 'voice_providers' },
    });
    this.dbConfig = (row?.value as VoiceProviderConfig) || {};
  }

  getProviderMode(): string {
    return (
      this.dbConfig.provider ||
      this.config.get('VOICE_PROVIDER') ||
      'auto'
    );
  }

  get(key: string): string | undefined {
    // Admin-saved DB config wins over stale container env for voice credentials.
    const map: Record<string, string | undefined> = {
      VOICE_PROVIDER: this.dbConfig.provider,
      PUBLIC_API_URL: this.dbConfig.publicApiUrl,
      EPBX_API_URL: this.dbConfig.epbx?.apiUrl,
      EPBX_API_KEY: this.dbConfig.epbx?.apiKey,
      EPBX_CUSTOMER_ID: this.dbConfig.epbx?.customerId,
      EPBX_IVR_ID: this.dbConfig.epbx?.ivrId,
      EPBX_CALLER_ID: (this.dbConfig.epbx as { callerId?: string } | undefined)?.callerId,
      EPBX_DID: (this.dbConfig.epbx as { did?: string } | undefined)?.did,
      IPPBX_API_URL: this.dbConfig.ippbx?.apiUrl,
      IPPBX_API_KEY: this.dbConfig.ippbx?.apiKey,
      IPPBX_API_SECRET: this.dbConfig.ippbx?.apiSecret,
      TWILIO_ACCOUNT_SID: this.dbConfig.twilio?.accountSid,
      TWILIO_AUTH_TOKEN: this.dbConfig.twilio?.authToken,
      TWILIO_PHONE_NUMBER: this.dbConfig.twilio?.phoneNumber,
    };
    const fromDb = map[key];
    if (fromDb) return fromDb;
    return this.config.get<string>(key);
  }

  isEpbxConfigured(): boolean {
    return Boolean(this.get('EPBX_API_KEY'));
  }

  isIppbxConfigured(): boolean {
    return Boolean(this.get('IPPBX_API_URL') && this.get('IPPBX_API_KEY'));
  }

  isTwilioConfigured(): boolean {
    return Boolean(this.get('TWILIO_ACCOUNT_SID'));
  }

  maskSecret(value?: string): string {
    if (!value) return '';
    if (value.length <= 4) return '••••';
    return '••••••••' + value.slice(-4);
  }

  async getPublicConfig() {
    await this.refresh();
    const epbxKey = this.get('EPBX_API_KEY');
    const ippbxKey = this.get('IPPBX_API_KEY');
    const ippbxSecret = this.get('IPPBX_API_SECRET');
    const twilioToken = this.get('TWILIO_AUTH_TOKEN');

    return {
      provider: this.getProviderMode(),
      publicApiUrl:
        this.get('PUBLIC_API_URL') ||
        this.config.get('API_URL', 'http://localhost:4000'),
      epbx: {
        enabled: this.dbConfig.epbx?.enabled ?? true,
        configured: this.isEpbxConfigured(),
        apiUrl: this.get('EPBX_API_URL') || 'https://epbx.bd/api/v1',
        apiKey: epbxKey ? this.maskSecret(epbxKey) : '',
        apiKeySet: Boolean(epbxKey),
        customerId: this.get('EPBX_CUSTOMER_ID') || '',
        ivrId: this.get('EPBX_IVR_ID') || '',
      },
      ippbx: {
        enabled: this.dbConfig.ippbx?.enabled ?? true,
        configured: this.isIppbxConfigured(),
        apiUrl: this.get('IPPBX_API_URL') || '',
        apiKey: ippbxKey ? this.maskSecret(ippbxKey) : '',
        apiKeySet: Boolean(ippbxKey),
        apiSecret: ippbxSecret ? this.maskSecret(ippbxSecret) : '',
        apiSecretSet: Boolean(ippbxSecret),
      },
      twilio: {
        configured: this.isTwilioConfigured(),
        accountSid: this.get('TWILIO_ACCOUNT_SID') || '',
        authToken: twilioToken ? this.maskSecret(twilioToken) : '',
        authTokenSet: Boolean(twilioToken),
        phoneNumber: this.get('TWILIO_PHONE_NUMBER') || '',
      },
      status: {
        epbx: this.isEpbxConfigured(),
        ippbx: this.isIppbxConfigured(),
        twilio: this.isTwilioConfigured(),
      },
    };
  }

  async saveConfig(updates: VoiceProviderConfig) {
    await this.refresh();
    const current = this.dbConfig;

    const merged: VoiceProviderConfig = {
      provider: updates.provider ?? current.provider,
      publicApiUrl: updates.publicApiUrl ?? current.publicApiUrl,
      epbx: { ...current.epbx, ...updates.epbx },
      ippbx: { ...current.ippbx, ...updates.ippbx },
      twilio: { ...current.twilio, ...updates.twilio },
    };

    // Keep existing secrets if masked/empty submitted
    if (updates.epbx?.apiKey?.startsWith('••••')) {
      merged.epbx!.apiKey = current.epbx?.apiKey;
    }
    if (updates.ippbx?.apiKey?.startsWith('••••')) {
      merged.ippbx!.apiKey = current.ippbx?.apiKey;
    }
    if (updates.ippbx?.apiSecret?.startsWith('••••')) {
      merged.ippbx!.apiSecret = current.ippbx?.apiSecret;
    }
    if (updates.twilio?.authToken?.startsWith('••••')) {
      merged.twilio!.authToken = current.twilio?.authToken;
    }

    await this.prisma.systemSetting.upsert({
      where: { key: 'voice_providers' },
      create: { key: 'voice_providers', value: merged as never },
      update: { value: merged as never },
    });

    this.dbConfig = merged;
    return this.getPublicConfig();
  }
}
