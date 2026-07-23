import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

/** Dhaka calendar day YYYY-MM-DD */
function dayKey(d: Date): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Dhaka',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(d);
}

function isWebsiteCancel(metadata: unknown): boolean {
  return Boolean(
    metadata &&
      typeof metadata === 'object' &&
      !Array.isArray(metadata) &&
      (metadata as Record<string, unknown>).cancelledFromWebsite === true,
  );
}

/** Prisma filter: CANCELLED via Maskara (call/DTMF), not store-admin cancel */
export const maskaraCancelledWhere: Prisma.OrderWhereInput = {
  status: 'CANCELLED',
  NOT: {
    metadata: {
      path: ['cancelledFromWebsite'],
      equals: true,
    },
  },
};

@Injectable()
export class ReportsService {
  constructor(private prisma: PrismaService) {}

  /**
   * Always compute from live Order + Call rows.
   * UsageRecord is incomplete (only ordersReceived is written on create).
   * Website manual cancels (cancelledFromWebsite) are excluded from cancelled counts.
   */
  async getDailyReport(merchantId: string, days = 30) {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - (days - 1));
    startDate.setHours(0, 0, 0, 0);

    const [orders, calls] = await Promise.all([
      this.prisma.order.findMany({
        where: {
          merchantId,
          OR: [
            { createdAt: { gte: startDate } },
            { verifiedAt: { gte: startDate } },
            { cancelledAt: { gte: startDate } },
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
        where: { merchantId, createdAt: { gte: startDate } },
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

    for (let i = 0; i < days; i++) {
      const d = new Date(startDate);
      d.setDate(startDate.getDate() + i);
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
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    thirtyDaysAgo.setHours(0, 0, 0, 0);

    const [
      ordersReceived,
      ordersVerified,
      ordersCancelled,
      recentCalls,
      ordersByStatus,
      callsByOutcome,
    ] = await Promise.all([
      this.prisma.order.count({
        where: { merchantId, createdAt: { gte: thirtyDaysAgo } },
      }),
      this.prisma.order.count({
        where: {
          merchantId,
          status: 'VERIFIED',
          OR: [
            { verifiedAt: { gte: thirtyDaysAgo } },
            { verifiedAt: null, createdAt: { gte: thirtyDaysAgo } },
          ],
        },
      }),
      this.prisma.order.count({
        where: {
          merchantId,
          ...maskaraCancelledWhere,
          OR: [
            { cancelledAt: { gte: thirtyDaysAgo } },
            { cancelledAt: null, createdAt: { gte: thirtyDaysAgo } },
          ],
        },
      }),
      this.prisma.call.findMany({
        where: { merchantId, createdAt: { gte: thirtyDaysAgo } },
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
