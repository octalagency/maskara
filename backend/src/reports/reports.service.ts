import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class ReportsService {
  constructor(private prisma: PrismaService) {}

  async getDailyReport(merchantId: string, days = 30) {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - (days - 1));
    startDate.setHours(0, 0, 0, 0);

    const records = await this.prisma.usageRecord.findMany({
      where: { merchantId, date: { gte: startDate } },
      orderBy: { date: 'asc' },
    });

    if (records.length > 0) {
      return records.map((r) => ({
        date: r.date.toISOString().split('T')[0],
        ordersReceived: r.ordersReceived,
        ordersVerified: r.ordersVerified,
        ordersCancelled: r.ordersCancelled,
        callsMade: r.callsMade,
        callsSuccess: r.callsSuccess,
        smsSent: r.smsSent,
        verificationRate:
          r.ordersReceived > 0
            ? Math.round((r.ordersVerified / r.ordersReceived) * 100)
            : 0,
        callSuccessRate:
          r.callsMade > 0 ? Math.round((r.callsSuccess / r.callsMade) * 100) : 0,
      }));
    }

    // Fallback: compute live from orders + calls (usageRecord may be empty)
    const [orders, calls] = await Promise.all([
      this.prisma.order.findMany({
        where: { merchantId, createdAt: { gte: startDate } },
        select: { status: true, createdAt: true },
      }),
      this.prisma.call.findMany({
        where: { merchantId, createdAt: { gte: startDate } },
        select: { status: true, createdAt: true },
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
      byDay[d.toISOString().split('T')[0]] = {
        ordersReceived: 0,
        ordersVerified: 0,
        ordersCancelled: 0,
        callsMade: 0,
        callsSuccess: 0,
      };
    }

    for (const o of orders) {
      const day = o.createdAt.toISOString().split('T')[0];
      if (!byDay[day]) continue;
      byDay[day].ordersReceived++;
      if (o.status === 'VERIFIED') byDay[day].ordersVerified++;
      if (o.status === 'CANCELLED') byDay[day].ordersCancelled++;
    }
    for (const c of calls) {
      const day = c.createdAt.toISOString().split('T')[0];
      if (!byDay[day]) continue;
      byDay[day].callsMade++;
      if (c.status === 'COMPLETED') byDay[day].callsSuccess++;
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

    const [usage, orders, calls, recentCalls] = await Promise.all([
      this.prisma.usageRecord.aggregate({
        where: { merchantId, date: { gte: thirtyDaysAgo } },
        _sum: {
          ordersReceived: true,
          ordersVerified: true,
          ordersCancelled: true,
          callsMade: true,
          callsSuccess: true,
          smsSent: true,
        },
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
      this.prisma.call.findMany({
        where: { merchantId, createdAt: { gte: thirtyDaysAgo } },
        select: { status: true, outcome: true, duration: true },
      }),
    ]);

    const liveOrders = await this.prisma.order.count({
      where: { merchantId, createdAt: { gte: thirtyDaysAgo } },
    });
    const liveVerified = await this.prisma.order.count({
      where: {
        merchantId,
        status: 'VERIFIED',
        createdAt: { gte: thirtyDaysAgo },
      },
    });

    const last30 =
      (usage._sum.ordersReceived || 0) > 0
        ? usage._sum
        : {
            ordersReceived: liveOrders,
            ordersVerified: liveVerified,
            ordersCancelled: await this.prisma.order.count({
              where: {
                merchantId,
                status: 'CANCELLED',
                createdAt: { gte: thirtyDaysAgo },
              },
            }),
            callsMade: recentCalls.length,
            callsSuccess: recentCalls.filter((c) => c.status === 'COMPLETED').length,
            smsSent: 0,
          };

    return {
      last30Days: last30,
      ordersByStatus: orders.map((o) => ({
        status: o.status,
        count: o._count,
      })),
      callsByOutcome: calls.map((c) => ({
        outcome: c.outcome,
        count: c._count,
      })),
      avgCallDuration: Math.round(
        recentCalls.filter((c) => c.duration).reduce((s, c) => s + (c.duration || 0), 0) /
          (recentCalls.filter((c) => c.duration).length || 1),
      ),
    };
  }
}
