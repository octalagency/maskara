import { Module } from '@nestjs/common';
import { VoiceWebhookGuard } from '../common/guards/voice-webhook.guard';
import { TwilioWebhookGuard } from '../common/guards/twilio-webhook.guard';
import { VoiceService } from './voice.service';
import { VoiceController } from './voice.controller';
import { VoiceWebhookService } from './voice-webhook.service';
import { NotificationsModule } from '../notifications/notifications.module';
import { TwilioProvider } from './providers/twilio.provider';
import { EpbxProvider } from './providers/epbx.provider';
import { IppbxProvider } from './providers/ippbx.provider';
import { VoiceProviderFactory } from './providers/voice-provider.factory';
import { VoiceSettingsService } from './voice-settings.service';

@Module({
  imports: [NotificationsModule],
  controllers: [VoiceController],
  providers: [
    VoiceSettingsService,
    VoiceService,
    VoiceWebhookService,
    VoiceWebhookGuard,
    TwilioWebhookGuard,
    TwilioProvider,
    EpbxProvider,
    IppbxProvider,
    VoiceProviderFactory,
  ],
  exports: [VoiceService, VoiceProviderFactory, VoiceSettingsService],
})
export class VoiceModule {}
