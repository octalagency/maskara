/**
 * Call schedule:
 * 1) Attempt 1 — ASAP any time (~20s backup cron) — window exempt
 * 2) Attempt 2 — 2 minutes later, any time — window exempt
 * 3) Attempt 3 — within first hour (~15–20 min after attempt 2), inside window
 * 4) Attempts 4..dailyCap — staggered until window end
 * 5) Next day resumes at window open until lifetime cap (manual cancel, no auto-cancel)
 */

import {
  DEFAULT_WINDOW_END_MIN,
  DEFAULT_WINDOW_START_MIN,
  nextWindowOpenAt,
  windowBoundsForDay,
  zonedWallTimeToUtc,
} from './call-window.util';

const DEFAULT_TZ = 'Asia/Dhaka';

/** First N dials ignore the daily call window (new-order burst). */
export const WINDOW_EXEMPT_ATTEMPTS = 2;

/** True when the next dial (callAttempts → attempt+1) may run outside the window. */
export function isCallWindowExempt(callAttemptsSoFar: number): boolean {
  return callAttemptsSoFar < WINDOW_EXEMPT_ATTEMPTS;
}

/** Delay between first and second call. */
export const SECOND_CALL_DELAY_MS = 2 * 60 * 1000;

/** Delay between second and third call (still inside first hour). */
export const THIRD_CALL_DELAY_MS = 18 * 60 * 1000;

/** Floor spacing between day follow-ups. */
export const MIN_FOLLOW_UP_GAP_MIN = 45;

function hashOrderId(orderId: string): number {
  let h = 0;
  for (let i = 0; i < orderId.length; i++) {
    h = (h * 31 + orderId.charCodeAt(i)) >>> 0;
  }
  return h;
}

function zonedParts(date: Date, timezone: string) {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  }).formatToParts(date);

  const get = (type: Intl.DateTimeFormatPartTypes) =>
    Number(parts.find((p) => p.type === type)?.value ?? '0');

  return {
    year: get('year'),
    month: get('month'),
    day: get('day'),
    hour: get('hour'),
    minute: get('minute'),
    second: get('second'),
  };
}

function addCalendarDays(ref: Date, days: number, timezone: string): Date {
  const p = zonedParts(ref, timezone);
  const noon = zonedWallTimeToUtc(p.year, p.month, p.day, 12, 0, timezone);
  return new Date(noon.getTime() + days * 24 * 60 * 60 * 1000);
}

export interface DialMerchantConfig {
  timezone?: string | null;
  retryIntervalMin?: number;
  callWindowStartMin?: number;
  callWindowEndMin?: number;
  dailyCallLimit?: number;
  lifetimeCallLimit?: number;
  maxCallRetries?: number;
  firstHourCallLimit?: number;
}

export function resolveLifetimeLimit(m: DialMerchantConfig): number {
  return Math.max(1, m.lifetimeCallLimit ?? m.maxCallRetries ?? 20);
}

export function resolveDailyLimit(m: DialMerchantConfig): number {
  return Math.max(1, Math.min(20, m.dailyCallLimit ?? 10));
}

export interface FollowUpScheduleOptions {
  orderId: string;
  from?: Date;
  timezone?: string;
  startMin?: number;
  endMin?: number;
  followUpCount?: number;
  minGapMinutes?: number;
}

/**
 * Up to `followUpCount` Date slots spread across the call window
 * with per-order phase so different customers get different times.
 */
export function computeFollowUpSchedule(opts: FollowUpScheduleOptions): Date[] {
  const {
    orderId,
    from = new Date(),
    timezone = DEFAULT_TZ,
    startMin = DEFAULT_WINDOW_START_MIN,
    endMin = DEFAULT_WINDOW_END_MIN,
    followUpCount = 7,
    minGapMinutes = MIN_FOLLOW_UP_GAP_MIN,
  } = opts;

  if (followUpCount <= 0) return [];

  const gapMs = Math.max(minGapMinutes, MIN_FOLLOW_UP_GAP_MIN) * 60 * 1000;
  const hash = hashOrderId(orderId);
  const phaseMs = (hash % 40) * 60 * 1000; // 0–39 min phase

  const slots: Date[] = [];
  let dayOffset = 0;

  while (slots.length < followUpCount && dayOffset <= 14) {
    const dayRef = dayOffset === 0 ? from : addCalendarDays(from, dayOffset, timezone);
    const { start: winStart, end: winEnd } = windowBoundsForDay(
      dayRef,
      timezone,
      startMin,
      endMin,
    );

    let earliest =
      dayOffset === 0
        ? Math.max(from.getTime() + gapMs, winStart.getTime() + phaseMs)
        : winStart.getTime() + phaseMs;

    if (earliest >= winEnd.getTime()) {
      dayOffset += 1;
      continue;
    }

    const remaining = followUpCount - slots.length;
    const windowLeft = winEnd.getTime() - earliest;
    const step = Math.max(gapMs, Math.floor(windowLeft / Math.max(remaining, 1)));

    for (let i = 0; i < remaining; i++) {
      const micro = (((hash + slots.length * 17) % 11) - 5) * 60 * 1000;
      let t = earliest + i * step + micro;
      if (t < winStart.getTime()) t = winStart.getTime() + ((hash + i) % 15) * 60 * 1000;
      if (t >= winEnd.getTime()) break;
      if (slots.length && t < slots[slots.length - 1].getTime() + gapMs) {
        t = slots[slots.length - 1].getTime() + gapMs;
      }
      if (t >= winEnd.getTime()) break;
      slots.push(new Date(t));
      if (slots.length >= followUpCount) break;
    }

    dayOffset += 1;
  }

  return slots;
}

function clampIntoWindowOrNextOpen(
  candidate: Date,
  timezone: string,
  startMin: number,
  endMin: number,
): Date {
  const { start, end } = windowBoundsForDay(candidate, timezone, startMin, endMin);
  if (candidate.getTime() < start.getTime()) return start;
  if (candidate.getTime() >= end.getTime()) {
    return nextWindowOpenAt(timezone, startMin, endMin, new Date(end.getTime() + 60_000));
  }
  return candidate;
}

/**
 * After an attempt is counted (`completedAttempts` / callAttempts), when should the next run?
 */
export function computeNextCallAt(opts: {
  orderId: string;
  completedAttempts: number;
  from?: Date;
  merchant: DialMerchantConfig;
  /** Calls already placed for this order today (in merchant TZ). */
  callsToday?: number;
  orderCreatedAt?: Date;
}): Date | null {
  const {
    orderId,
    completedAttempts,
    from = new Date(),
    merchant,
    callsToday = completedAttempts,
    orderCreatedAt,
  } = opts;

  const timezone = merchant.timezone || DEFAULT_TZ;
  const startMin = merchant.callWindowStartMin ?? DEFAULT_WINDOW_START_MIN;
  const endMin = merchant.callWindowEndMin ?? DEFAULT_WINDOW_END_MIN;
  const lifetime = resolveLifetimeLimit(merchant);
  const daily = resolveDailyLimit(merchant);
  const firstHourCap = Math.max(1, Math.min(10, merchant.firstHourCallLimit ?? 3));
  const minGapMinutes = Math.max(
    MIN_FOLLOW_UP_GAP_MIN,
    merchant.retryIntervalMin ?? MIN_FOLLOW_UP_GAP_MIN,
  );

  if (completedAttempts >= lifetime) return null;

  // Hit daily cap → resume next window open
  if (callsToday >= daily) {
    return nextWindowOpenAt(
      timezone,
      startMin,
      endMin,
      new Date(from.getTime() + 60_000),
    );
  }

  // Attempt 2: +2 minutes — any time of day (window exempt)
  if (completedAttempts === 1) {
    return new Date(from.getTime() + SECOND_CALL_DELAY_MS);
  }

  // Attempt 3 (and any remaining first-hour slots): within first hour of order
  if (completedAttempts >= 2 && completedAttempts < firstHourCap) {
    const base = orderCreatedAt ?? from;
    const hourEnd = new Date(base.getTime() + 60 * 60 * 1000);
    let candidate = new Date(from.getTime() + THIRD_CALL_DELAY_MS);
    if (candidate.getTime() > hourEnd.getTime()) {
      candidate = new Date(Math.min(hourEnd.getTime() - 60_000, from.getTime() + 5 * 60 * 1000));
    }
    if (candidate.getTime() <= from.getTime()) {
      candidate = new Date(from.getTime() + 5 * 60 * 1000);
    }
    return clampIntoWindowOrNextOpen(candidate, timezone, startMin, endMin);
  }

  // Remaining attempts for today (up to daily), then spill to next days until lifetime
  const remainingLifetime = lifetime - completedAttempts;
  const remainingTodayBudget = Math.max(0, daily - callsToday);
  // Schedule enough slots across days for remaining lifetime (capped)
  const followUpsNeeded = Math.min(remainingLifetime, Math.max(remainingTodayBudget, daily) + daily * 2);
  const schedule = computeFollowUpSchedule({
    orderId,
    from,
    timezone,
    startMin,
    endMin,
    followUpCount: Math.max(1, followUpsNeeded),
    minGapMinutes,
  });

  return schedule[0] ?? nextWindowOpenAt(timezone, startMin, endMin, from);
}

/**
 * First dial time for a brand-new order (attempt 0 → 1).
 * Always ASAP — night orders still get the first two burst calls.
 */
export function computeFirstCallAt(
  _merchant: DialMerchantConfig,
  now = new Date(),
): Date {
  return now;
}
