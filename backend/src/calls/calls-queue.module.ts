import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bull';
import { CallsEnqueueService } from './calls-enqueue.service';

/** Shared dial-queue helpers (no Voice/Orders imports — avoids cycles). */
@Module({
  imports: [BullModule.registerQueue({ name: 'calls' })],
  providers: [CallsEnqueueService],
  exports: [CallsEnqueueService, BullModule],
})
export class CallsQueueModule {}
