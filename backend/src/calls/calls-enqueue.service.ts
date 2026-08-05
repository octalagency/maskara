import { Injectable, Logger } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bull';
import { Job, JobOptions, Queue } from 'bull';
import { SECOND_CALL_DELAY_MS } from '../common/utils/call-schedule.util';

/** Lower number = higher priority in Bull. */
export const CALL_JOB_PRIORITY = {
  FIRST: 1,
  SECOND: 2,
  TECH_FAIL: 3,
  FOLLOW_UP: 15,
} as const;

export type CallLane = 'burst' | 'followup' | 'tech';

export interface CallJobPayload {
  orderId: string;
  merchantId: string;
  isRetry?: boolean;
  lane: CallLane;
  /** 1 = first dial, 2 = second dial (2 min later) */
  burstAttempt?: 1 | 2;
}

/**
 * Single place for dial queueing so new orders (500+/day) never lose the
 * 20s / 2min burst behind day follow-ups.
 */
@Injectable()
export class CallsEnqueueService {
  private readonly logger = new Logger(CallsEnqueueService.name);

  constructor(@InjectQueue('calls') private callsQueue: Queue) {}

  firstJobId(orderId: string) {
    return `call-first-${orderId}`;
  }

  secondJobId(orderId: string) {
    return `call-second-${orderId}`;
  }

  followUpJobId(orderId: string, attempt: number) {
    return `call-fu-${orderId}-a${attempt}`;
  }

  /** Order create → dial ASAP (must land within ~20s). */
  async enqueueFirstCall(orderId: string, merchantId: string): Promise<boolean> {
    return this.addJob(
      {
        orderId,
        merchantId,
        isRetry: false,
        lane: 'burst',
        burstAttempt: 1,
      },
      this.firstJobId(orderId),
      {
        priority: CALL_JOB_PRIORITY.FIRST,
        attempts: 3,
        backoff: { type: 'fixed', delay: 4000 },
        removeOnComplete: true,
        removeOnFail: true,
      },
    );
  }

  /**
   * After first dial is not answered — exactly 2 minutes later.
   * delayMs defaults to SECOND_CALL_DELAY_MS from last hangup.
   */
  async enqueueSecondCall(
    orderId: string,
    merchantId: string,
    delayMs: number = SECOND_CALL_DELAY_MS,
  ): Promise<boolean> {
    return this.addJob(
      {
        orderId,
        merchantId,
        isRetry: true,
        lane: 'burst',
        burstAttempt: 2,
      },
      this.secondJobId(orderId),
      {
        priority: CALL_JOB_PRIORITY.SECOND,
        delay: Math.max(0, delayMs),
        attempts: 2,
        backoff: { type: 'fixed', delay: 5000 },
        removeOnComplete: true,
        removeOnFail: true,
      },
    );
  }

  async enqueueTechFailRetry(
    orderId: string,
    merchantId: string,
    techFails: number,
    delayMs: number,
  ): Promise<boolean> {
    return this.addJob(
      {
        orderId,
        merchantId,
        isRetry: true,
        lane: 'tech',
      },
      `call-tech-${orderId}-t${techFails}`,
      {
        priority: CALL_JOB_PRIORITY.TECH_FAIL,
        delay: Math.max(0, delayMs),
        attempts: 1,
        removeOnComplete: true,
        removeOnFail: true,
      },
    );
  }

  /** Attempt 3+ through the day — yields to burst traffic. */
  async enqueueFollowUp(
    orderId: string,
    merchantId: string,
    nextAttempt: number,
  ): Promise<boolean> {
    const burstWaiting = await this.countWaitingBurstJobs();
    if (burstWaiting > 0) {
      this.logger.debug(
        `Defer follow-up a${nextAttempt} order=${orderId} — ${burstWaiting} burst job(s) waiting`,
      );
      return false;
    }

    const waiting = await this.callsQueue.getWaitingCount();
    // Cap day-follow-up backlog so a spike of retries cannot bury new orders
    if (waiting >= 250) {
      this.logger.warn(
        `Follow-up queue full (waiting=${waiting}) — skip a${nextAttempt} for ${orderId}`,
      );
      return false;
    }

    return this.addJob(
      {
        orderId,
        merchantId,
        isRetry: true,
        lane: 'followup',
      },
      this.followUpJobId(orderId, nextAttempt),
      {
        priority: CALL_JOB_PRIORITY.FOLLOW_UP,
        attempts: 1,
        removeOnComplete: true,
        removeOnFail: true,
      },
    );
  }

  async hasActiveOrPendingJob(jobId: string): Promise<boolean> {
    try {
      const existing = await this.callsQueue.getJob(jobId);
      if (!existing) return false;
      const state = await existing.getState();
      return ['waiting', 'active', 'delayed', 'paused'].includes(state);
    } catch {
      return false;
    }
  }

  async isOrderBurstQueued(orderId: string): Promise<boolean> {
    return (
      (await this.hasActiveOrPendingJob(this.firstJobId(orderId))) ||
      (await this.hasActiveOrPendingJob(this.secondJobId(orderId)))
    );
  }

  async countWaitingBurstJobs(): Promise<number> {
    try {
      const jobs = await this.callsQueue.getJobs([
        'waiting',
        'delayed',
        'active',
        'paused',
      ]);
      let n = 0;
      for (const job of jobs) {
        if (this.isBurstJob(job)) n++;
      }
      return n;
    } catch {
      return 0;
    }
  }

  isBurstJob(job: Job | null | undefined): boolean {
    if (!job) return false;
    const data = job.data as CallJobPayload;
    if (data?.lane === 'burst') return true;
    const id = String(job.id || job.opts?.jobId || '');
    return id.startsWith('call-first-') || id.startsWith('call-second-');
  }

  private async addJob(
    data: CallJobPayload,
    jobId: string,
    opts: JobOptions,
  ): Promise<boolean> {
    try {
      if (await this.hasActiveOrPendingJob(jobId)) {
        return false;
      }
      const existing = await this.callsQueue.getJob(jobId);
      if (existing) {
        try {
          await existing.remove();
        } catch {
          // ignore
        }
      }
      await this.callsQueue.add('initiate-call', data, { ...opts, jobId });
      return true;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      if (/job.*exist|duplicate/i.test(msg)) return false;
      this.logger.warn(`enqueue failed (${jobId}): ${msg}`);
      return false;
    }
  }
}
