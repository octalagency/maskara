import { PrismaService } from '../../prisma/prisma.service';
import {
  DialMerchantConfig,
  resolveLifetimeLimit,
} from './call-schedule.util';
import {
  DEFAULT_WINDOW_END_MIN,
  DEFAULT_WINDOW_START_MIN,
  windowBoundsForDay,
} from './call-window.util';

export type MerchantDialFields = DialMerchantConfig & {
  timezone?: string | null;
  callWindowStartMin?: number | null;
  callWindowEndMin?: number | null;
  dailyCallLimit?: number | null;
  lifetimeCallLimit?: number | null;
  maxCallRetries?: number | null;
  firstHourCallLimit?: number | null;
  retryIntervalMin?: number | null;
};

export function merchantDialConfig(m: MerchantDialFields): DialMerchantConfig {
  const rawRetry = m.retryIntervalMin ?? 25;
  return {
    timezone: m.timezone || 'Asia/Dhaka',
    // Cap long merchant intervals so PENDING drains same day
    retryIntervalMin: Math.min(Math.max(rawRetry, 15), 25),
    callWindowStartMin: m.callWindowStartMin ?? DEFAULT_WINDOW_START_MIN,
    callWindowEndMin: m.callWindowEndMin ?? DEFAULT_WINDOW_END_MIN,
    dailyCallLimit: m.dailyCallLimit ?? 10,
    lifetimeCallLimit: m.lifetimeCallLimit ?? m.maxCallRetries ?? 20,
    maxCallRetries: m.maxCallRetries ?? m.lifetimeCallLimit ?? 20,
    firstHourCallLimit: m.firstHourCallLimit ?? 3,
  };
}

export function lifetimeLimitOf(m: MerchantDialFields): number {
  return resolveLifetimeLimit(merchantDialConfig(m));
}

/** Count calls for this order since today's window open (merchant TZ). */
export async function countCallsTodayForOrder(
  prisma: PrismaService,
  orderId: string,
  merchant: MerchantDialFields,
  now = new Date(),
): Promise<number> {
  const cfg = merchantDialConfig(merchant);
  const { start } = windowBoundsForDay(
    now,
    cfg.timezone || 'Asia/Dhaka',
    cfg.callWindowStartMin ?? DEFAULT_WINDOW_START_MIN,
    cfg.callWindowEndMin ?? DEFAULT_WINDOW_END_MIN,
  );
  // Instant ePBX tech fails / PSTN-never-rang must not burn the daily dial budget
  // or block real FreeSWITCH rings after fake HTTP "OK" attempts.
  return prisma.call.count({
    where: {
      orderId,
      createdAt: { gte: start },
      NOT: {
        OR: [
          { errorMessage: 'epbx_instant_fail' },
          { errorMessage: 'epbx_pstn_fail' },
          { errorMessage: 'stale_ringing_timeout' },
        ],
      },
    },
  });
}
