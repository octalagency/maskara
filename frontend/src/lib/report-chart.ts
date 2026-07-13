import type { DailyReport } from '@/lib/api';

const BN_MONTHS = [
  'জানু',
  'ফেব',
  'মার্চ',
  'এপ্রি',
  'মে',
  'জুন',
  'জুল',
  'আগ',
  'সেপ্ট',
  'অক্টো',
  'নভে',
  'ডিসে',
];

const BN_WEEKDAYS = ['রবি', 'সোম', 'মঙ্গল', 'বুধ', 'বৃহঃ', 'শুক্র', 'শনি'];

/** Fill missing calendar days so charts always show a full range. */
export function fillDailyReport(rows: DailyReport[], days: number): DailyReport[] {
  const byDate = new Map(rows.map((r) => [r.date.slice(0, 10), r]));
  const start = new Date();
  start.setHours(12, 0, 0, 0);
  start.setDate(start.getDate() - (days - 1));

  const out: DailyReport[] = [];
  for (let i = 0; i < days; i++) {
    const d = new Date(start);
    d.setDate(start.getDate() + i);
    const key = d.toISOString().slice(0, 10);
    const existing = byDate.get(key);
    out.push(
      existing || {
        date: key,
        ordersReceived: 0,
        ordersVerified: 0,
        ordersCancelled: 0,
        callsMade: 0,
        callsSuccess: 0,
        verificationRate: 0,
        callSuccessRate: 0,
      },
    );
  }
  return out;
}

export function formatChartDate(iso: string) {
  const d = new Date(`${iso.slice(0, 10)}T12:00:00`);
  if (Number.isNaN(d.getTime())) return iso;
  return `${d.getDate()} ${BN_MONTHS[d.getMonth()]}`;
}

export function formatChartDateLong(iso: string) {
  const d = new Date(`${iso.slice(0, 10)}T12:00:00`);
  if (Number.isNaN(d.getTime())) return iso;
  return `${BN_WEEKDAYS[d.getDay()]}, ${d.getDate()} ${BN_MONTHS[d.getMonth()]}`;
}

export function sumDailyReport(rows: DailyReport[]) {
  return rows.reduce(
    (acc, d) => {
      acc.received += d.ordersReceived || 0;
      acc.verified += d.ordersVerified || 0;
      acc.cancelled += d.ordersCancelled || 0;
      acc.calls += d.callsMade || 0;
      return acc;
    },
    { received: 0, verified: 0, cancelled: 0, calls: 0 },
  );
}

export const CHART_COLORS = {
  received: '#2563eb',
  verified: '#059669',
  cancelled: '#e11d48',
  calls: '#1a82f5',
} as const;
