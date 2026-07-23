import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

/** Dhaka calendar day YYYY-MM-DD */
export function dayKey(d: Date): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Dhaka',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(d);
}

export function isWebsiteCancel(metadata: unknown): boolean {
  return Boolean(
    metadata &&
      typeof metadata === 'object' &&
      !Array.isArray(metadata) &&
      (metadata as Record<string, unknown>).cancelledFromWebsite === true,
  );
}

/** Start of Dhaka calendar day as UTC Date suitable for DB compare */
export function startOfDhakaDay(isoOrDate: string | Date): Date {
  const key =
    typeof isoOrDate === 'string'
      ? isoOrDate.slice(0, 10)
      : dayKey(isoOrDate);
  // Asia/Dhaka = UTC+6 → local midnight = previous day 18:00 UTC
  return new Date(`${key}T00:00:00+06:00`);
}

export function endOfDhakaDay(isoOrDate: string | Date): Date {
  const key =
    typeof isoOrDate === 'string'
      ? isoOrDate.slice(0, 10)
      : dayKey(isoOrDate);
  return new Date(`${key}T23:59:59.999+06:00`);
}

@Injectable()
export class ReportsService {
  constructor(private prisma: PrismaService) {}

  /**
   * Always compute from live Order + Call rows.
   * Website manual cancels (cancelledFromWebsite) excluded from cancelled counts.
   */
  async getDailyReport(
    merchantId: string,
    days = 30,
    from?: string,
    to?: string,
  ) {
    let startDate: Date;
    let endDate: Date;
    let dayCount: number;

    if (from && to) {
      startDate = startOfDhakaDay(from);
      endDate = endOfDhakaDay(to);
      const ms = endDate.getTime() - startDate.getTime();
      dayCount = Math.max(1, Math.ceil(ms / (24 * 60 * 60 * 1000)));
      if (dayCount > 366) dayCount = 366;
    } else {
      dayCount = Math.min(Math.max(Number(days) || 30, 1), 366);
      endDate = endOfDhakaDay(new Date());
      startDate = startOfDhakaDay(new Date());
      startDate.setDate(startDate.getDate() - (dayCount - 1));
    }

    const [orders, calls] = await Promise.all([
      this.prisma.order.findMany({
        where: {
          merchantId,
          OR: [
            { createdAt: { gte: startDate, lte: endDate } },
            { verifiedAt: { gte: startDate, lte: endDate } },
            { cancelledAt: { gte: startDate, lte: endDate } },
          ],
        },
        select: {
          status: true,
          createdAt: true,
          verifiedAt: true,
          cancelledAt: true,
          metadata: true,
        },
      }),
      this.prisma.call.findMany({
        where: {
          merchantId,
          createdAt: { gte: startDate, lte: endDate },
        },
        select: { status: true, outcome: true, createdAt: true },
      }),
    ]);

    const byDay: Record<
      string,
      {
        ordersReceived: number;
        ordersVerified: number;
        ordersCancelled: number;
        callsMade: number;
        callsSuccess: number;
      }
    > = {};

    for (let i = 0; i < dayCount; i++) {
      const d = new Date(startDate.getTime() + i * 24 * 60 * 60 * 1000);
      byDay[dayKey(d)] = {
        ordersReceived: 0,
        ordersVerified: 0,
        ordersCancelled: 0,
        callsMade: 0,
        callsSuccess: 0,
      };
    }

    for (const o of orders) {
      const recvDay = dayKey(o.createdAt);
      if (byDay[recvDay]) byDay[recvDay].ordersReceived++;

      if (o.status === 'VERIFIED') {
        const vDay = dayKey(o.verifiedAt || o.createdAt);
        if (byDay[vDay]) byDay[vDay].ordersVerified++;
      }

      if (o.status === 'CANCELLED' && !isWebsiteCancel(o.metadata)) {
        const cDay = dayKey(o.cancelledAt || o.createdAt);
        if (byDay[cDay]) byDay[cDay].ordersCancelled++;
      }
    }

    for (const c of calls) {
      const day = dayKey(c.createdAt);
      if (!byDay[day]) continue;
      byDay[day].callsMade++;
      if (
        c.status === 'COMPLETED' ||
        c.outcome === 'CONFIRMED' ||
        c.outcome === 'CANCELLED'
      ) {
        byDay[day].callsSuccess++;
      }
    }

    return Object.entries(byDay)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, r]) => ({
        date,
        ...r,
        smsSent: 0,
        verificationRate:
          r.ordersReceived > 0
            ? Math.round((r.ordersVerified / r.ordersReceived) * 100)
            : 0,
        callSuccessRate:
          r.callsMade > 0 ? Math.round((r.callsSuccess / r.callsMade) * 100) : 0,
      }));
  }

  async getSummary(merchantId: string) {
    const thirtyDaysAgo = startOfDhakaDay(new Date());
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 29);
    const end = endOfDhakaDay(new Date());

    const [orders, recentCalls, ordersByStatus, callsByOutcome] =
      await Promise.all([
        this.prisma.order.findMany({
          where: {
            merchantId,
            OR: [
              { createdAt: { gte: thirtyDaysAgo, lte: end } },
              { verifiedAt: { gte: thirtyDaysAgo, lte: end } },
              { cancelledAt: { gte: thirtyDaysAgo, lte: end } },
            ],
          },
          select: {
            status: true,
            createdAt: true,
            verifiedAt: true,
            cancelledAt: true,
            metadata: true,
          },
        }),
        this.prisma.call.findMany({
          where: {
            merchantId,
            createdAt: { gte: thirtyDaysAgo, lte: end },
          },
          select: { status: true, outcome: true, duration: true },
        }),
        this.prisma.order.groupBy({
          by: ['status'],
          where: { merchantId },
          _count: true,
        }),
        this.prisma.call.groupBy({
          by: ['outcome'],
          where: { merchantId, outcome: { not: null } },
          _count: true,
        }),
      ]);

    let ordersReceived = 0;
    let ordersVerified = 0;
    let ordersCancelled = 0;
    for (const o of orders) {
      if (o.createdAt >= thirtyDaysAgo && o.createdAt <= end) ordersReceived++;
      if (
        o.status === 'VERIFIED' &&
        (o.verifiedAt || o.createdAt) >= thirtyDaysAgo &&
        (o.verifiedAt || o.createdAt) <= end
      ) {
        ordersVerified++;
      }
      if (
        o.status === 'CANCELLED' &&
        !isWebsiteCancel(o.metadata) &&
        (o.cancelledAt || o.createdAt) >= thirtyDaysAgo &&
        (o.cancelledAt || o.createdAt) <= end
      ) {
        ordersCancelled++;
      }
    }

    const callsSuccess = recentCalls.filter(
      (c) =>
        c.status === 'COMPLETED' ||
        c.outcome === 'CONFIRMED' ||
        c.outcome === 'CANCELLED',
    ).length;
    const withDuration = recentCalls.filter((c) => c.duration && c.duration > 0);

    return {
      last30Days: {
        ordersReceived,
        ordersVerified,
        ordersCancelled,
        callsMade: recentCalls.length,
        callsSuccess,
        smsSent: 0,
      },
      ordersByStatus: ordersByStatus.map((o) => ({
        status: o.status,
        count: o._count,
      })),
      callsByOutcome: callsByOutcome.map((c) => ({
        outcome: c.outcome,
        count: c._count,
      })),
      avgCallDuration: Math.round(
        withDuration.reduce((s, c) => s + (c.duration || 0), 0) /
          (withDuration.length || 1),
      ),
    };
  }
}
