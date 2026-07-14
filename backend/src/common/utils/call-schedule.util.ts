/**
 * Call schedule:
 * 1) Attempt 1 — ASAP (queue on create + 20s backup cron)
 * 2) Attempt 2 — 2 minutes later if still unanswered
 * 3) Attempts 3–10 — 8 slots staggered across 08:00–22:00 with per-order jitter
 */

const DEFAULT_TZ = 'Asia/Dhaka';
const DEFAULT_START_HOUR = 8;
const DEFAULT_END_HOUR = 22;

/** Delay between first and second call. */
export const SECOND_CALL_DELAY_MS = 2 * 60 * 1000;

/** Floor spacing between day follow-ups (merchant retryIntervalMin may be higher). */
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

/** Wall-clock time in `timezone` → UTC Date (accurate for Asia/Dhaka). */
export function zonedWallTimeToUtc(
  year: number,
  month: number,
  day: number,
  hour: number,
  minute: number,
  timezone: string,
): Date {
  let utc = Date.UTC(year, month - 1, day, hour, minute, 0);
  for (let i = 0; i < 3; i++) {
    const p = zonedParts(new Date(utc), timezone);
    const asUtc = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second);
    const targetAsUtc = Date.UTC(year, month - 1, day, hour, minute, 0);
    utc += targetAsUtc - asUtc;
  }
  return new Date(utc);
}

function windowBoundsForDay(
  ref: Date,
  timezone: string,
  startHour: number,
  endHour: number,
): { start: Date; end: Date } {
  const p = zonedParts(ref, timezone);
  return {
    start: zonedWallTimeToUtc(p.year, p.month, p.day, startHour, 0, timezone),
    end: zonedWallTimeToUtc(p.year, p.month, p.day, endHour, 0, timezone),
  };
}

function addCalendarDays(ref: Date, days: number, timezone: string): Date {
  const p = zonedParts(ref, timezone);
  const noon = zonedWallTimeToUtc(p.year, p.month, p.day, 12, 0, timezone);
  return new Date(noon.getTime() + days * 24 * 60 * 60 * 1000);
}

export interface FollowUpScheduleOptions {
  orderId: string;
  from?: Date;
  timezone?: string;
  startHour?: number;
  endHour?: number;
  followUpCount?: number;
  minGapMinutes?: number;
}

/**
 * Up to `followUpCount` Date slots (attempts 3..N), spread across the call window
 * with per-order phase so different customers get different times.
 */
export function computeFollowUpSchedule(opts: FollowUpScheduleOptions): Date[] {
  const {
    orderId,
    from = new Date(),
    timezone = DEFAULT_TZ,
    startHour = DEFAULT_START_HOUR,
    endHour = DEFAULT_END_HOUR,
    followUpCount = 8,
    minGapMinutes = MIN_FOLLOW_UP_GAP_MIN,
  } = opts;

  if (followUpCount <= 0) return [];

  const gapMs = Math.max(minGapMinutes, MIN_FOLLOW_UP_GAP_MIN) * 60 * 1000;
  const hash = hashOrderId(orderId);
  const phaseMs = (hash % 90) * 60 * 1000; // 0–89 min phase

  const slots: Date[] = [];
  let dayOffset = 0;

  while (slots.length < followUpCount && dayOffset <= 3) {
    const dayRef = dayOffset === 0 ? from : addCalendarDays(from, dayOffset, timezone);
    const { start: winStart, end: winEnd } = windowBoundsForDay(
      dayRef,
      timezone,
      startHour,
      endHour,
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
    const step = Math.max(gapMs, Math.floor(windowLeft / remaining));

    for (let i = 0; i < remaining; i++) {
      const micro = (((hash + slots.length * 17) % 15) - 7) * 60 * 1000;
      let t = earliest + i * step + micro;
      if (t < winStart.getTime()) t = winStart.getTime() + ((hash + i) % 20) * 60 * 1000;
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

/**
 * After an attempt is counted (`completedAttempts` / callAttempts), when should the next run?
 * - After 1st: +2 minutes (second call)
 * - After 2nd+: staggered day slots for attempts 3–max
 */
export function computeNextCallAt(opts: {
  orderId: string;
  /** callAttempts after the attempt just started / finished. */
  completedAttempts: number;
  maxAttempts: number;
  from?: Date;
  timezone?: string;
  /** Merchant retryIntervalMin — used as follow-up min gap. */
  minSpacingMin?: number;
  minGapMinutes?: number;
}): Date | null {
  const {
    orderId,
    completedAttempts,
    maxAttempts,
    from = new Date(),
    timezone = DEFAULT_TZ,
  } = opts;

  const minGapMinutes =
    opts.minGapMinutes ?? opts.minSpacingMin ?? MIN_FOLLOW_UP_GAP_MIN;

  if (completedAttempts >= maxAttempts) return null;

  // Attempt 2: exactly 2 minutes after the first call was initiated
  if (completedAttempts === 1) {
    return new Date(from.getTime() + SECOND_CALL_DELAY_MS);
  }

  // Attempts 3..max: staggered across remaining call window
  const followUpsNeeded = Math.max(0, maxAttempts - 2);
  const schedule = computeFollowUpSchedule({
    orderId,
    from,
    timezone,
    followUpCount: followUpsNeeded,
    minGapMinutes,
  });

  // completedAttempts=2 → schedule[0] (attempt 3); =3 → schedule[1], …
  const idx = completedAttempts - 2;
  return schedule[idx] ?? null;
}
