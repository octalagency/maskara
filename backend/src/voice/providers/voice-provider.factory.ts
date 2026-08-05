import { Injectable } from '@nestjs/common';
import { VoiceSettingsService } from '../voice-settings.service';
import { EpbxProvider } from './epbx.provider';
import { IppbxProvider } from './ippbx.provider';
import { TwilioProvider } from './twilio.provider';
import { MaskaraDialerProvider } from './maskara-dialer.provider';
import { VoiceProvider, VoiceProviderName } from './voice-provider.interface';

@Injectable()
export class VoiceProviderFactory {
  constructor(
    private settings: VoiceSettingsService,
    private twilio: TwilioProvider,
    private epbx: EpbxProvider,
    private ippbx: IppbxProvider,
    private maskaraDialer: MaskaraDialerProvider,
  ) {}

  getActiveProvider(): VoiceProvider | null {
    const preferred = this.settings
      .getProviderMode()
      .toLowerCase() as VoiceProviderName | 'auto';

    // Own FreeSWITCH trunk — real PSTN ring (ePBX HTTP /calls/verify often
    // returns OK then webhook status=failed with zero customer ring).
    if (
      (preferred === 'maskara_dialer' || preferred === 'auto') &&
      this.maskaraDialer.isConfigured()
    ) {
      return this.maskaraDialer;
    }
    if (preferred === 'epbx' && this.epbx.isConfigured()) return this.epbx;
    if (preferred === 'ippbx' && this.ippbx.isConfigured()) return this.ippbx;
    if (preferred === 'twilio' && this.twilio.isConfigured()) return this.twilio;

    if (preferred === 'simulate') {
      if (this.maskaraDialer.isConfigured()) return this.maskaraDialer;
      if (this.epbx.isConfigured()) return this.epbx;
      if (this.ippbx.isConfigured()) return this.ippbx;
      if (this.twilio.isConfigured()) return this.twilio;
    }

    // Last resort: if someone forced epbx but dialer is healthy, prefer dialer
    if (this.maskaraDialer.isConfigured()) return this.maskaraDialer;
    if (this.epbx.isConfigured()) return this.epbx;
    if (this.ippbx.isConfigured()) return this.ippbx;
    if (this.twilio.isConfigured()) return this.twilio;

    return null;
  }

  getProviderName(): VoiceProviderName | 'simulate' {
    return this.getActiveProvider()?.name ?? 'simulate';
  }

  getTwilio(): TwilioProvider {
    return this.twilio;
  }
}
