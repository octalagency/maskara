import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class ReportsService {
  constructor(private prisma: PrismaService) {}

  async getDailyReport(merchantId: string, days = 30) {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);
    startDate.setHours(0, 0, 0, 0);

    const records = await this.prisma.usageRecord.findMany({
      where: { merchantId, date: { gte: startDate } },
      orderBy: { date: 'asc' },
    });

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

  async getSummary(merchantId: string) {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const [usage, orders, calls] = await Promise.all([
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
    ]);

    return {
      last30Days: usage._sum,
      ordersByStatus: orders.map((o) => ({
        status: o.status,
        count: o._count,
      })),
      callsByOutcome: calls.map((c) => ({
        outcome: c.outcome,
        count: c._count,
      })),
    };
  }
}
