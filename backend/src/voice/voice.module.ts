import { Module } from '@nestjs/common';
import { VoiceWebhookGuard } from '../common/guards/voice-webhook.guard';
import { TwilioWebhookGuard } from '../common/guards/twilio-webhook.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { VoiceService } from './voice.service';
import { VoiceController } from './voice.controller';
import { VoiceWebhookService } from './voice-webhook.service';
import { NotificationsModule } from '../notifications/notifications.module';
import { SubscriptionsModule } from '../subscriptions/subscriptions.module';
import { CallsQueueModule } from '../calls/calls-queue.module';
import { TwilioProvider } from './providers/twilio.provider';
import { EpbxProvider } from './providers/epbx.provider';
import { IppbxProvider } from './providers/ippbx.provider';
import { MaskaraDialerProvider } from './providers/maskara-dialer.provider';
import { VoiceProviderFactory } from './providers/voice-provider.factory';
import { VoiceSettingsService } from './voice-settings.service';
import { TtsPreviewService } from './tts-preview.service';
import { GoogleTtsService } from './google-tts.service';

@Module({
  imports: [NotificationsModule, SubscriptionsModule, CallsQueueModule],
  controllers: [VoiceController],
  providers: [
    VoiceSettingsService,
    GoogleTtsService,
    VoiceService,
    VoiceWebhookService,
    VoiceWebhookGuard,
    TwilioWebhookGuard,
    RolesGuard,
    TwilioProvider,
    EpbxProvider,
    IppbxProvider,
    MaskaraDialerProvider,
    VoiceProviderFactory,
    TtsPreviewService,
  ],
  exports: [
    VoiceService,
    VoiceProviderFactory,
    VoiceSettingsService,
    GoogleTtsService,
  ],
})
export class VoiceModule {}
