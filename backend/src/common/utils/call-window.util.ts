/** Bangladesh call window: 10:00–22:00 local time. */
export function isWithinCallWindow(
  timezone = 'Asia/Dhaka',
  startHour = 10,
  endHour = 22,
  now = new Date(),
): boolean {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: timezone,
    hour: 'numeric',
    hour12: false,
  }).formatToParts(now);

  const hour = Number(parts.find((p) => p.type === 'hour')?.value ?? '0');
  return hour >= startHour && hour < endHour;
}

export function callWindowLabel(timezone = 'Asia/Dhaka'): string {
  return `সকাল ${10}টা – রাত ${10}টা (${timezone})`;
}
