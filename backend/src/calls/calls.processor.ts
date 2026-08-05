import { Process, Processor } from '@nestjs/bull';
import { Logger } from '@nestjs/common';
import { Job } from 'bull';
import { VoiceService } from '../voice/voice.service';
import { PrismaService } from '../prisma/prisma.service';
import { SubscriptionsService } from '../subscriptions/subscriptions.service';
import {
  isWithinCallWindow,
  nextWindowOpenAt,
} from '../common/utils/call-window.util';
import {
  countCallsTodayForOrder,
  lifetimeLimitOf,
  merchantDialConfig,
} from '../common/utils/dial-merchant.util';
import { isCallWindowExempt } from '../common/utils/call-schedule.util';
import {
  CallJobPayload,
  CallsEnqueueService,
} from './calls-enqueue.service';

@Processor('calls')
export class CallsProcessor {
  private readonly logger = new Logger(CallsProcessor.name);

  constructor(
    private voiceService: VoiceService,
    private prisma: PrismaService,
    private subscriptions: SubscriptionsService,
    private enqueue: CallsEnqueueService,
  ) {}

  @Process({ name: 'initiate-call', concurrency: 1 })
  async handleInitiateCall(job: Job<CallJobPayload>) {
    const { orderId, merchantId } = job.data;
    const lane = job.data.lane || (job.data.isRetry ? 'followup' : 'burst');

    // Day follow-ups must never block new-order burst (20s / 2min)
    if (lane === 'followup') {
      const burstWaiting = await this.enqueue.countWaitingBurstJobs();
      if (burstWaiting > 0) {
        this.logger.log(
          `Yield follow-up to ${burstWaiting} burst job(s) — order ${orderId}`,
        );
        // Bull: delay this follow-up so burst (20s/2min) jobs run first
        await job.moveToDelayed(Date.now() + 8_000);
        return;
      }
    }

    this.logger.log(
      `Processing ${lane} call job for order ${orderId}` +
        (job.data.burstAttempt ? ` burst#${job.data.burstAttempt}` : ''),
    );

    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      include: { merchant: true },
    });

    if (!order || ['VERIFIED', 'CANCELLED'].includes(order.status)) {
      this.logger.warn(`Skipping call for finalized order ${orderId}`);
      return;
    }

    const lifetime = lifetimeLimitOf(order.merchant);
    if (order.callAttempts >= lifetime) {
      this.logger.warn(
        `Lifetime dial cap reached for ${order.orderNumber} — awaiting manual cancel`,
      );
      await this.prisma.order.update({
        where: { id: orderId },
        data: { nextCallAt: null },
      });
      return;
    }

    const cfg = merchantDialConfig(order.merchant);
    // Attempts 1–2 (new-order burst) dial any time; later attempts wait for window
    if (
      !isCallWindowExempt(order.callAttempts) &&
      !isWithinCallWindow(
        cfg.timezone,
        cfg.callWindowStartMin,
        cfg.callWindowEndMin,
      )
    ) {
      const openAt = nextWindowOpenAt(
        cfg.timezone,
        cfg.callWindowStartMin,
        cfg.callWindowEndMin,
      );
      this.logger.log(
        `Outside call window — defer ${order.orderNumber} to ${openAt.toISOString()}`,
      );
      await this.prisma.order.update({
        where: { id: orderId },
        data: { nextCallAt: openAt },
      });
      return;
    }

    const callsToday = await countCallsTodayForOrder(
      this.prisma,
      orderId,
      order.merchant,
    );
    if (callsToday >= (cfg.dailyCallLimit ?? 10)) {
      const openAt = nextWindowOpenAt(
        cfg.timezone,
        cfg.callWindowStartMin,
        cfg.callWindowEndMin,
        new Date(Date.now() + 60_000),
      );
      this.logger.log(
        `Daily dial cap for ${order.orderNumber} — resume ${openAt.toISOString()}`,
      );
      await this.prisma.order.update({
        where: { id: orderId },
        data: { nextCallAt: openAt },
      });
      return;
    }

    const limitCheck = await this.subscriptions.canMakeCall(merchantId);
    if (!limitCheck.allowed) {
      this.logger.warn(
        `Call limit exceeded for merchant ${merchantId}: ${limitCheck.reason}`,
      );
      return;
    }

    const attemptNumber = order.callAttempts + 1;
    await this.voiceService.initiateCall(orderId, merchantId, attemptNumber);
  }
}
