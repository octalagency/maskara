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
      include: {
        calls: { orderBy: { createdAt: 'desc' }, take: 1 },
        _count: { select: { calls: true } },
      },
      take: 150,
      // Newest first — just-arrived orders beat old backlog for the 20s SLA
      orderBy: { createdAt: 'desc' },
    });

    for (const order of pending) {
      // Dead zone fix: tech-fail refund can leave callAttempts=0 WITH Call rows.
      // Previously we skipped those forever — merchants saw 0/20 and no more dials.
      if (await this.enqueue.isOrderBurstQueued(order.id)) continue;
      const ageSec = Math.round((Date.now() - order.createdAt.getTime()) / 1000);
      if (order._count.calls > 0) {
        const last = order.calls[0];
        if (
          last &&
          !RETRYABLE_CALL_STATUSES.includes(last.status) &&
          last.status !== 'RINGING'
        ) {
          continue;
        }
        // Do NOT count ePBX fake dials (API OK + webhook failed / never rang)
        const realN = await this.prisma.call.count({
          where: {
            orderId: order.id,
            NOT: {
              OR: [
                { errorMessage: 'epbx_instant_fail' },
                { errorMessage: 'epbx_pstn_fail' },
                { errorMessage: 'stale_ringing_timeout' },
                { errorMessage: 'stale_in_progress_timeout' },
                { errorMessage: 'dialer_originate_fail' },
                { errorMessage: 'dialer_sip_fail' },
              ],
            },
            status: {
              in: ['RINGING', 'IN_PROGRESS', 'COMPLETED', 'NO_ANSWER', 'BUSY'],
            },
          },
        });
        // Never inflate — fake ePBX/dialer rows must drop the UI counter
        const healed = realN;
        if (healed !== order.callAttempts) {
          await this.prisma.order.update({
            where: { id: order.id },
            data: { callAttempts: healed, status: 'PENDING' },
          });
        }
        this.logger.warn(
          `Heal+redial realAttempts=${healed} for ${order.orderNumber} (rows=${order._count.calls}, was ${order.callAttempts})`,
        );
        // Always burst-redial when still pending with no real answer
        await this.enqueue.enqueueFirstCall(order.id, order.merchantId);
        continue;
      }
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
    // Include attempt 0 with prior Call rows (refund dead-zone) via heal cron above;
    // also pick attempt 1 normally.
    const pending = await this.prisma.order.findMany({
      where: {
        status: { in: ['PENDING', 'FAILED', 'CALLING'] },
        callAttempts: { in: [0, 1] },
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
        if (order.callAttempts === 0) {
          await this.enqueue.enqueueFirstCall(order.id, order.merchantId);
        }
        continue;
      }

      // Heal refunded counters
      if (order.callAttempts === 0) {
        await this.prisma.order.update({
          where: { id: order.id },
          data: { callAttempts: Math.max(1, last.attemptNumber || 1) },
        });
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
        (['RINGING', 'IN_PROGRESS'].includes(last.status) &&
          (lastEnded || age >= STALE_RINGING_MS || Boolean(last.errorMessage)));
      if (!retryable) continue;

      const sinceEnd = Date.now() - (last.endedAt ?? last.createdAt).getTime();
      // attempt 0 healed → dial ASAP; attempt 1 → wait 2 min after first hangup
      const needWait =
        order.callAttempts >= 1 ? SECOND_CALL_DELAY_MS : 0;
      if (sinceEnd < needWait) continue;

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

  /**
   * Clear dialer RINGING / IN_PROGRESS that never got a hangup webhook.
   * FreeSWITCH fork exhaustion or lost ESL often leaves IN_PROGRESS forever and blocks redials.
   */
  @Cron(CronExpression.EVERY_MINUTE)
  async finalizeStaleRinging() {
    const cutoff = new Date(Date.now() - STALE_RINGING_MS);
    const stale = await this.prisma.call.findMany({
      where: {
        OR: [
          {
            status: 'RINGING',
            OR: [
              { endedAt: null, createdAt: { lt: cutoff } },
              { endedAt: { not: null } },
              { errorMessage: 'epbx_instant_fail' },
              { errorMessage: 'force_clear_for_redial' },
              { errorMessage: 'snjra_priority_redial' },
            ],
          },
          {
            status: 'IN_PROGRESS',
            endedAt: null,
            createdAt: { lt: cutoff },
          },
        ],
      },
      select: { id: true, orderId: true, status: true },
      take: 300,
    });
    if (stale.length === 0) return;

    const ringingIds = stale.filter((c) => c.status === 'RINGING').map((c) => c.id);
    const inProgIds = stale.filter((c) => c.status === 'IN_PROGRESS').map((c) => c.id);

    if (ringingIds.length) {
      await this.prisma.call.updateMany({
        where: { id: { in: ringingIds } },
        data: {
          status: 'NO_ANSWER',
          endedAt: new Date(),
          errorMessage: 'stale_ringing_timeout',
        },
      });
    }
    if (inProgIds.length) {
      await this.prisma.call.updateMany({
        where: { id: { in: inProgIds } },
        data: {
          status: 'FAILED',
          endedAt: new Date(),
          errorMessage: 'stale_in_progress_timeout',
        },
      });
    }

    const orderIds = [...new Set(stale.map((c) => c.orderId))];
    for (const orderId of orderIds) {
      const order = await this.prisma.order.findUnique({ where: { id: orderId } });
      if (!order) continue;
      if (['VERIFIED', 'CANCELLED', 'ESCALATED'].includes(order.status)) continue;
      const realN = await this.prisma.call.count({
        where: {
          orderId,
          NOT: {
            OR: [
              { errorMessage: 'epbx_instant_fail' },
              { errorMessage: 'epbx_pstn_fail' },
              { errorMessage: 'stale_ringing_timeout' },
              { errorMessage: 'stale_in_progress_timeout' },
              { errorMessage: 'dialer_originate_fail' },
              { errorMessage: 'dialer_sip_fail' },
            ],
          },
          status: {
            in: ['RINGING', 'IN_PROGRESS', 'COMPLETED', 'NO_ANSWER', 'BUSY'],
          },
        },
      });
      if (realN !== order.callAttempts || order.status === 'CALLING') {
        await this.prisma.order.update({
          where: { id: orderId },
          data: {
            callAttempts: realN,
            status: order.status === 'CALLING' ? 'PENDING' : order.status,
            nextCallAt: new Date(),
          },
        });
      }
    }

    this.logger.warn(
      `Marked stale calls: ${ringingIds.length} RINGING→NO_ANSWER, ${inProgIds.length} IN_PROGRESS→FAILED`,
    );
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
