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
export function fillDailyReport(rows: DailyReport[], days?: number): DailyReport[] {
  // Backend already returns a continuous range — use as-is to avoid UTC/local day skew
  if (Array.isArray(rows) && rows.length > 0 && (days == null || rows.length === days)) {
    return rows;
  }

  const span = days ?? Math.max(rows.length, 1);
  const byDate = new Map(rows.map((r) => [r.date.slice(0, 10), r]));
  const start = new Date();
  start.setHours(12, 0, 0, 0);
  start.setDate(start.getDate() - (span - 1));

  const out: DailyReport[] = [];
  for (let i = 0; i < span; i++) {
    const d = new Date(start);
    d.setDate(start.getDate() + i);
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    const key = `${y}-${m}-${day}`;
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

/** Local YYYY-MM-DD (browser TZ — merchants in BD). */
export function localYmd(d = new Date()): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export type DashRange = 'today' | 'yesterday' | 'week' | 'month' | 'custom';

export function rangeToFromTo(
  range: DashRange,
  customFrom?: string,
  customTo?: string,
): { from: string; to: string; days: number; label: string } {
  const today = new Date();
  today.setHours(12, 0, 0, 0);

  if (range === 'custom' && customFrom && customTo) {
    const a = new Date(`${customFrom}T12:00:00`);
    const b = new Date(`${customTo}T12:00:00`);
    const days = Math.max(
      1,
      Math.round((b.getTime() - a.getTime()) / (24 * 60 * 60 * 1000)) + 1,
    );
    return { from: customFrom, to: customTo, days, label: 'কাস্টম' };
  }

  if (range === 'today') {
    const k = localYmd(today);
    return { from: k, to: k, days: 1, label: 'আজ' };
  }
  if (range === 'yesterday') {
    const y = new Date(today);
    y.setDate(y.getDate() - 1);
    const k = localYmd(y);
    return { from: k, to: k, days: 1, label: 'গততকাল' };
  }
  if (range === 'week') {
    const start = new Date(today);
    start.setDate(start.getDate() - 6);
    return {
      from: localYmd(start),
      to: localYmd(today),
      days: 7,
      label: '৭ দিন',
    };
  }
  // month
  const start = new Date(today);
  start.setDate(start.getDate() - 29);
  return {
    from: localYmd(start),
    to: localYmd(today),
    days: 30,
    label: '৩০ দিন',
  };
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
