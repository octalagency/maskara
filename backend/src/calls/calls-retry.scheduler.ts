import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { InjectQueue } from '@nestjs/bull';
import { Queue } from 'bull';
import { PrismaService } from '../prisma/prisma.service';
import {
  isWithinCallWindow,
  nextWindowOpenAt,
} from '../common/utils/call-window.util';
import {
  isCallWindowExempt,
  SECOND_CALL_DELAY_MS,
} from '../common/utils/call-schedule.util';
import {
  countCallsTodayForOrder,
  lifetimeLimitOf,
  merchantDialConfig,
} from '../common/utils/dial-merchant.util';

const RETRYABLE_CALL_STATUSES = ['NO_ANSWER', 'BUSY', 'FAILED', 'RINGING', 'QUEUED'];

@Injectable()
export class CallsRetryScheduler {
  private readonly logger = new Logger(CallsRetryScheduler.name);

  constructor(
    private prisma: PrismaService,
    @InjectQueue('calls') private callsQueue: Queue,
  ) {}

  /** First call within ~20s of order if the create-queue job was missed. */
  @Cron('*/20 * * * * *')
  async enqueueFirstCalls() {
    const pending = await this.prisma.order.findMany({
      where: {
        status: 'PENDING',
        callAttempts: 0,
        createdAt: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) },
      },
      include: {
        calls: { take: 1 },
      },
      take: 40,
      orderBy: { createdAt: 'asc' },
    });

    for (const order of pending) {
      if (order.calls.length > 0) continue;
      // First call is window-exempt — dial even after 22:00
      this.logger.log(`First-call enqueue (≤20s backup) for ${order.orderNumber}`);
      await this.queueCall(order.id, order.merchantId, false, `call-first-${order.id}`);
    }
  }

  @Cron(CronExpression.EVERY_MINUTE)
  async retryFailedCalls() {
    const now = new Date();

    const pendingOrders = await this.prisma.order.findMany({
      where: {
        status: { in: ['PENDING', 'FAILED', 'CALLING'] },
        OR: [{ nextCallAt: { lte: now } }, { nextCallAt: null }],
      },
      include: {
        merchant: true,
        calls: { orderBy: { createdAt: 'desc' }, take: 1 },
      },
      take: 80,
    });

    for (const order of pendingOrders) {
      const cfg = merchantDialConfig(order.merchant);
      const lifetime = lifetimeLimitOf(order.merchant);

      // Lifetime exhausted — stop dialing (manual cancel in UI); no auto-cancel
      if (order.callAttempts >= lifetime) {
        if (order.nextCallAt != null) {
          await this.prisma.order.update({
            where: { id: order.id },
            data: { nextCallAt: null },
          });
        }
        continue;
      }

      if (
        !isCallWindowExempt(order.callAttempts) &&
        !isWithinCallWindow(
          cfg.timezone,
          cfg.callWindowStartMin,
          cfg.callWindowEndMin,
        )
      ) {
        // Park until next window open if nextCallAt is missing or already due
        const openAt = nextWindowOpenAt(
          cfg.timezone,
          cfg.callWindowStartMin,
          cfg.callWindowEndMin,
          now,
        );
        if (!order.nextCallAt || order.nextCallAt.getTime() < openAt.getTime()) {
          await this.prisma.order.update({
            where: { id: order.id },
            data: { nextCallAt: openAt },
          });
        }
        continue;
      }

      const callsToday = await countCallsTodayForOrder(
        this.prisma,
        order.id,
        order.merchant,
        now,
      );
      if (callsToday >= (cfg.dailyCallLimit ?? 10)) {
        const openAt = nextWindowOpenAt(
          cfg.timezone,
          cfg.callWindowStartMin,
          cfg.callWindowEndMin,
          new Date(now.getTime() + 60_000),
        );
        await this.prisma.order.update({
          where: { id: order.id },
          data: { nextCallAt: openAt },
        });
        continue;
      }

      const lastCall = order.calls[0];
      const minSpacingMs = Math.max(order.merchant.retryIntervalMin, 30) * 60 * 1000;

      if (order.callAttempts === 0) {
        if (!lastCall && order.status === 'PENDING') {
          await this.queueCall(order.id, order.merchantId, false, `call-first-${order.id}`);
        }
        continue;
      }

      if (!lastCall) continue;

      const timeSinceLastCall = Date.now() - lastCall.createdAt.getTime();

      if (
        ['RINGING', 'QUEUED', 'IN_PROGRESS'].includes(lastCall.status) &&
        timeSinceLastCall < (order.callAttempts === 1 ? SECOND_CALL_DELAY_MS : minSpacingMs)
      ) {
        continue;
      }

      const retryable = RETRYABLE_CALL_STATUSES.includes(lastCall.status);
      if (!retryable) continue;

      const dueBySchedule =
        order.nextCallAt != null && order.nextCallAt.getTime() <= now.getTime();

      // Second burst call: +2 min any time (also heals stale nextCallAt parked for next morning)
      const dueSecondCall =
        order.callAttempts === 1 &&
        timeSinceLastCall >= SECOND_CALL_DELAY_MS &&
        (order.nextCallAt == null ||
          order.nextCallAt.getTime() <= now.getTime() ||
          isCallWindowExempt(order.callAttempts));

      const dueBySpacing =
        order.callAttempts >= 2 &&
        order.nextCallAt == null &&
        timeSinceLastCall >= minSpacingMs;

      if (!dueBySchedule && !dueSecondCall && !dueBySpacing) continue;

      const nextAttempt = order.callAttempts + 1;
      this.logger.log(
        `Retry ${nextAttempt}/${lifetime} for ${order.orderNumber}`,
      );
      await this.queueCall(
        order.id,
        order.merchantId,
        true,
        `call-fu-${order.id}-a${nextAttempt}`,
      );
    }
  }

  private async queueCall(
    orderId: string,
    merchantId: string,
    isRetry: boolean,
    jobId: string,
  ) {
    try {
      await this.callsQueue.add(
        'initiate-call',
        { orderId, merchantId, isRetry },
        {
          attempts: 1,
          removeOnComplete: true,
          removeOnFail: true,
          jobId,
        },
      );
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      if (!/job.*exist|duplicate/i.test(msg)) {
        this.logger.warn(`queueCall failed (${jobId}): ${msg}`);
      }
    }
  }
}
