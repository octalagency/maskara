import { Module, forwardRef } from '@nestjs/common';
import { BullModule } from '@nestjs/bull';
import { CallsService } from './calls.service';
import { CallsController } from './calls.controller';
import { CallsProcessor } from './calls.processor';
import { CallsRetryScheduler } from './calls-retry.scheduler';
import { VoiceModule } from '../voice/voice.module';
import { SubscriptionsModule } from '../subscriptions/subscriptions.module';

@Module({
  imports: [
    BullModule.registerQueue({ name: 'calls' }),
    VoiceModule,
    SubscriptionsModule,
    forwardRef(() => VoiceModule),
  ],
  controllers: [CallsController],
  providers: [CallsService, CallsProcessor, CallsRetryScheduler],
  exports: [CallsService],
})
export class CallsModule {}
