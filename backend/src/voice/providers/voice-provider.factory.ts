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

    if (preferred === 'maskara_dialer' && this.maskaraDialer.isConfigured()) {
      return this.maskaraDialer;
    }
    if (preferred === 'epbx' && this.epbx.isConfigured()) return this.epbx;
    if (preferred === 'ippbx' && this.ippbx.isConfigured()) return this.ippbx;
    if (preferred === 'twilio' && this.twilio.isConfigured()) return this.twilio;

    if (preferred === 'auto' || preferred === 'simulate') {
      // Prefer own dialer (Chirp3 Leda) when SIP trunk is ready
      if (this.maskaraDialer.isConfigured()) return this.maskaraDialer;
      if (this.epbx.isConfigured()) return this.epbx;
      if (this.ippbx.isConfigured()) return this.ippbx;
      if (this.twilio.isConfigured()) return this.twilio;
    }

    return null;
  }

  getProviderName(): VoiceProviderName | 'simulate' {
    return this.getActiveProvider()?.name ?? 'simulate';
  }

  getTwilio(): TwilioProvider {
    return this.twilio;
  }
}
