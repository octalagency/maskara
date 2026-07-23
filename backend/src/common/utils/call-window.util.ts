/**
 * Call window helpers (minute-of-day in merchant timezone).
 * Defaults: 09:40–22:00 Asia/Dhaka.
 */

const DEFAULT_TZ = 'Asia/Dhaka';
export const DEFAULT_WINDOW_START_MIN = 580; // 09:40
export const DEFAULT_WINDOW_END_MIN = 1320; // 22:00

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

/** Wall-clock time in `timezone` → UTC Date. */
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

export function minuteOfDay(date: Date, timezone: string): number {
  const p = zonedParts(date, timezone);
  return p.hour * 60 + p.minute;
}

export function minsToHourMinute(totalMin: number): { hour: number; minute: number } {
  const clamped = Math.max(0, Math.min(1440, totalMin));
  return { hour: Math.floor(clamped / 60) % 24, minute: clamped % 60 };
}

export function isWithinCallWindow(
  timezone: string | null | undefined = DEFAULT_TZ,
  startMin = DEFAULT_WINDOW_START_MIN,
  endMin = DEFAULT_WINDOW_END_MIN,
  now = new Date(),
): boolean {
  const tz = timezone || DEFAULT_TZ;
  const mins = minuteOfDay(now, tz);
  const start = Math.max(0, Math.min(1439, startMin ?? DEFAULT_WINDOW_START_MIN));
  const end = Math.max(start + 1, Math.min(1440, endMin ?? DEFAULT_WINDOW_END_MIN));
  return mins >= start && mins < end;
}

/** Next time the call window opens (today if still before start, else tomorrow). */
export function nextWindowOpenAt(
  timezone: string | null | undefined = DEFAULT_TZ,
  startMin = DEFAULT_WINDOW_START_MIN,
  endMin = DEFAULT_WINDOW_END_MIN,
  now = new Date(),
): Date {
  const tz = timezone || DEFAULT_TZ;
  const start = startMin ?? DEFAULT_WINDOW_START_MIN;
  const endBound = endMin ?? DEFAULT_WINDOW_END_MIN;
  const p = zonedParts(now, tz);
  const { hour, minute } = minsToHourMinute(start);
  const todayOpen = zonedWallTimeToUtc(p.year, p.month, p.day, hour, minute, tz);
  const mins = minuteOfDay(now, tz);
  const end = Math.max(start + 1, Math.min(1440, endBound));

  if (mins < start) return todayOpen;
  if (mins >= end) {
    const tomorrow = new Date(todayOpen.getTime() + 24 * 60 * 60 * 1000);
    const tp = zonedParts(tomorrow, tz);
    return zonedWallTimeToUtc(tp.year, tp.month, tp.day, hour, minute, tz);
  }
  return now;
}

export function windowBoundsForDay(
  ref: Date,
  timezone: string,
  startMin: number,
  endMin: number,
): { start: Date; end: Date } {
  const p = zonedParts(ref, timezone);
  const s = minsToHourMinute(startMin);
  const e = minsToHourMinute(endMin);
  return {
    start: zonedWallTimeToUtc(p.year, p.month, p.day, s.hour, s.minute, timezone),
    end: zonedWallTimeToUtc(p.year, p.month, p.day, e.hour, e.minute, timezone),
  };
}

export function callWindowLabel(
  timezone = DEFAULT_TZ,
  startMin = DEFAULT_WINDOW_START_MIN,
  endMin = DEFAULT_WINDOW_END_MIN,
): string {
  const s = minsToHourMinute(startMin);
  const e = minsToHourMinute(endMin);
  const fmt = (h: number, m: number) =>
    `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
  return `${fmt(s.hour, s.minute)}–${fmt(e.hour, e.minute)} (${timezone})`;
}
