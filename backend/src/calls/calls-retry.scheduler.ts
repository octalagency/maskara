import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
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
import { CallsEnqueueService } from './calls-enqueue.service';

// RINGING is only retryable when stale (see below) — live RINGING must not be re-queued
const RETRYABLE_CALL_STATUSES = ['NO_ANSWER', 'BUSY', 'FAILED', 'QUEUED'];
/** ePBX often never sends hangup — clear stuck RINGING so pending can redial. */
const STALE_RINGING_MS = 3 * 60 * 1000;
/** Day follow-ups for attempt 3+ — keep PENDING low same day (under daily 10). */
const CATCH_UP_RETRY_MS = 8 * 60 * 1000;
/** First dial must fire within this window of order create. */
const FIRST_CALL_SLA_MS = 20_000;

@Injectable()
export class CallsRetryScheduler {
  private readonly logger = new Logger(CallsRetryScheduler.name);

  constructor(
    private prisma: PrismaService,
    private enqueue: CallsEnqueueService,
  ) {}

  /**
   * Burst #1 safety net — every 5s.
   * Order create already enqueues; this catches missed/failed first jobs
   * so 500+/day merchants never leave new orders silent.
   */
  @Cron('*/5 * * * * *')
  async enqueueFirstCalls() {
    const cutoff = new Date(Date.now() - FIRST_CALL_SLA_MS / 2);
    const pending = await this.prisma.order.findMany({
      where: {
        status: 'PENDING',
        createdAt: {
          gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
          lte: cutoff, // give create-queue ~10s before backup
        },
        OR: [
          { callAttempts: 0 },
          { callAttempts: { gt: 0 }, calls: { none: {} } },
        ],
      },
      include: { calls: { take: 1 } },
      take: 150,
      // Newest first — just-arrived orders beat old backlog for the 20s SLA
      orderBy: { createdAt: 'desc' },
    });

    for (const order of pending) {
      if (order.calls.length > 0) continue;
      if (await this.enqueue.isOrderBurstQueued(order.id)) continue;
      const ageSec = Math.round((Date.now() - order.createdAt.getTime()) / 1000);
      this.logger.warn(
        `First-call SLA backup (${ageSec}s) for ${order.orderNumber}`,
      );
      await this.enqueue.enqueueFirstCall(order.id, order.merchantId);
    }
  }

  /**
   * Burst #2 safety net — every 10s.
   * Primary path: webhook schedules delayed call-second job; this catches misses.
   */
  @Cron('*/10 * * * * *')
  async enqueueSecondCalls() {
    const pending = await this.prisma.order.findMany({
      where: {
        status: { in: ['PENDING', 'FAILED', 'CALLING'] },
        callAttempts: 1,
      },
      include: {
        merchant: true,
        calls: { orderBy: { createdAt: 'desc' }, take: 1 },
      },
      take: 100,
      orderBy: { updatedAt: 'asc' },
    });

    for (const order of pending) {
      const last = order.calls[0];
      if (!last) {
        // Attempt counted but no call row — re-fire first
        await this.enqueue.enqueueFirstCall(order.id, order.merchantId);
        continue;
      }

      const lastEnded = last.endedAt != null;
      const age = Date.now() - last.createdAt.getTime();
      const live =
        ['RINGING', 'QUEUED', 'IN_PROGRESS'].includes(last.status) &&
        !lastEnded &&
        age < STALE_RINGING_MS;
      if (live) continue;

      const retryable =
        RETRYABLE_CALL_STATUSES.includes(last.status) ||
        (last.status === 'RINGING' &&
          (lastEnded || age >= STALE_RINGING_MS || Boolean(last.errorMessage)));
      if (!retryable) continue;

      const sinceEnd = Date.now() - (last.endedAt ?? last.createdAt).getTime();
      if (sinceEnd < SECOND_CALL_DELAY_MS) continue;

      if (await this.enqueue.hasActiveOrPendingJob(this.enqueue.secondJobId(order.id))) {
        continue;
      }
      if (await this.enqueue.hasActiveOrPendingJob(this.enqueue.firstJobId(order.id))) {
        continue;
      }

      this.logger.log(`Second-call backup for ${order.orderNumber}`);
      await this.enqueue.enqueueSecondCall(order.id, order.merchantId, 0);
    }
  }

  /** Clear dialer/ePBX RINGING that never got a proper hangup status. */
  @Cron(CronExpression.EVERY_MINUTE)
  async finalizeStaleRinging() {
    const cutoff = new Date(Date.now() - STALE_RINGING_MS);
    const result = await this.prisma.call.updateMany({
      where: {
        status: 'RINGING',
        OR: [
          { endedAt: null, createdAt: { lt: cutoff } },
          { endedAt: { not: null } },
          { errorMessage: 'epbx_instant_fail' },
          { errorMessage: 'force_clear_for_redial' },
          { errorMessage: 'snjra_priority_redial' },
        ],
      },
      data: {
        status: 'NO_ANSWER',
        endedAt: new Date(),
        errorMessage: 'stale_ringing_timeout',
      },
    });
    if (result.count > 0) {
      this.logger.warn(`Marked ${result.count} stale RINGING call(s) as NO_ANSWER`);
    }
  }

  /** Attempt 3+ through the day — drain PENDING fast, without starving burst. */
  @Cron('*/30 * * * * *')
  async retryFailedCalls() {
    const now = new Date();
    const burstWaiting = await this.enqueue.countWaitingBurstJobs();
    // Allow follow-ups unless a real new-order spike is waiting
    if (burstWaiting > 20) {
      this.logger.log(
        `Skip follow-up sweep — ${burstWaiting} burst jobs waiting (new-order SLA)`,
      );
      return;
    }

    const pendingOrders = await this.prisma.order.findMany({
      where: {
        status: { in: ['PENDING', 'FAILED', 'CALLING'] },
        callAttempts: { gte: 2 },
      },
      include: {
        merchant: true,
        calls: { orderBy: { createdAt: 'desc' }, take: 1 },
      },
      take: 300,
      // Oldest pending first — clear backlog so count stays low
      orderBy: [{ createdAt: 'asc' }, { updatedAt: 'asc' }],
    });

    for (const order of pendingOrders) {
      const cfg = merchantDialConfig(order.merchant);
      const lifetime = lifetimeLimitOf(order.merchant);

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
      if (!lastCall) continue;

      const timeSinceLastCall = Date.now() - lastCall.createdAt.getTime();
      const lastEnded = lastCall.endedAt != null;
      const lastIsLiveRing =
        ['RINGING', 'QUEUED', 'IN_PROGRESS'].includes(lastCall.status) &&
        !lastEnded &&
        timeSinceLastCall < STALE_RINGING_MS;
      if (lastIsLiveRing) continue;

      const retryable =
        RETRYABLE_CALL_STATUSES.includes(lastCall.status) ||
        (lastCall.status === 'RINGING' &&
          (lastEnded ||
            timeSinceLastCall >= STALE_RINGING_MS ||
            Boolean(lastCall.errorMessage)));
      if (!retryable) continue;

      // Pending drain: 8–25 min gaps (ignore merchant 90m staff-style interval)
      const drainGapMs = CATCH_UP_RETRY_MS;
      const dueBySchedule =
        order.nextCallAt != null && order.nextCallAt.getTime() <= now.getTime();
      const dueCatchUp =
        timeSinceLastCall >= drainGapMs &&
        (order.nextCallAt == null ||
          order.nextCallAt.getTime() <= now.getTime() ||
          order.nextCallAt.getTime() > now.getTime() + drainGapMs);

      if (!dueBySchedule && !dueCatchUp) continue;

      const nextAttempt = order.callAttempts + 1;
      this.logger.log(
        `Follow-up ${nextAttempt}/${lifetime} for ${order.orderNumber}`,
      );
      await this.prisma.order.update({
        where: { id: order.id },
        data: { nextCallAt: new Date(now.getTime() + drainGapMs) },
      });
      await this.enqueue.enqueueFollowUp(
        order.id,
        order.merchantId,
        nextAttempt,
      );
    }
  }
}
