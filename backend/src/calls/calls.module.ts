import { Module, forwardRef } from '@nestjs/common';
import { CallsService } from './calls.service';
import { CallsController } from './calls.controller';
import { CallsProcessor } from './calls.processor';
import { CallsRetryScheduler } from './calls-retry.scheduler';
import { CallsQueueModule } from './calls-queue.module';
import { VoiceModule } from '../voice/voice.module';
import { SubscriptionsModule } from '../subscriptions/subscriptions.module';
import { NotificationsModule } from '../notifications/notifications.module';

/**
 * Only the worker process should consume the dial queue / run retry cron.
 * If the API container also registers these, two Nest apps race ePBX and
 * many dials fail in <1s (channel contention).
 */
const runAsWorker =
  process.env.RUN_AS_WORKER === '1' ||
  process.env.RUN_AS_WORKER === 'true' ||
  process.argv.some((a) => /worker/i.test(a));

@Module({
  imports: [
    CallsQueueModule,
    VoiceModule,
    SubscriptionsModule,
    NotificationsModule,
    forwardRef(() => VoiceModule),
  ],
  controllers: [CallsController],
  providers: [
    CallsService,
    ...(runAsWorker ? [CallsProcessor, CallsRetryScheduler] : []),
  ],
  exports: [CallsService, CallsQueueModule],
})
export class CallsModule {}
