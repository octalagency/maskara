import { Injectable } from '@nestjs/common';
import { Prisma, CallStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class CallsService {
  constructor(private prisma: PrismaService) {}

  async findAll(
    merchantId: string,
    params: {
      status?: CallStatus;
      page?: number;
      limit?: number;
      orderId?: string;
    },
  ) {
    const page = params.page || 1;
    const limit = params.limit || 20;
    const skip = (page - 1) * limit;

    const where: Prisma.CallWhereInput = {
      merchantId,
      ...(params.status && { status: params.status }),
      ...(params.orderId && { orderId: params.orderId }),
    };

    const [calls, total] = await Promise.all([
      this.prisma.call.findMany({
        where,
        include: {
          order: {
            select: {
              orderNumber: true,
              customerName: true,
              customerPhone: true,
              totalAmount: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.call.count({ where }),
    ]);

    return { calls, total, page, limit, totalPages: Math.ceil(total / limit) };
  }

  async findOne(merchantId: string, callId: string) {
    return this.prisma.call.findFirst({
      where: { id: callId, merchantId },
      include: {
        order: true,
      },
    });
  }

  async getAnalytics(merchantId: string, days = 30) {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    const calls = await this.prisma.call.findMany({
      where: { merchantId, createdAt: { gte: startDate } },
      select: {
        status: true,
        outcome: true,
        duration: true,
        createdAt: true,
      },
    });

    const total = calls.length;
    const completed = calls.filter((c) => c.status === 'COMPLETED').length;
    const confirmed = calls.filter((c) => c.outcome === 'CONFIRMED').length;
    const cancelled = calls.filter((c) => c.outcome === 'CANCELLED').length;
    const escalated = calls.filter((c) => c.outcome === 'ESCALATED').length;
    const failed = calls.filter((c) =>
      ['FAILED', 'NO_ANSWER', 'BUSY'].includes(c.status),
    ).length;

    const avgDuration =
      calls.filter((c) => c.duration).reduce((sum, c) => sum + (c.duration || 0), 0) /
        (calls.filter((c) => c.duration).length || 1);

    const dailyStats = this.groupByDay(calls);

    return {
      total,
      completed,
      confirmed,
      cancelled,
      escalated,
      failed,
      successRate: total > 0 ? Math.round((completed / total) * 100) : 0,
      confirmationRate: completed > 0 ? Math.round((confirmed / completed) * 100) : 0,
      avgDuration: Math.round(avgDuration),
      dailyStats,
    };
  }

  private groupByDay(
    calls: { createdAt: Date; status: string; outcome: string | null }[],
  ) {
    const grouped: Record<string, { total: number; completed: number; confirmed: number }> = {};

    for (const call of calls) {
      const day = call.createdAt.toISOString().split('T')[0];
      if (!grouped[day]) {
        grouped[day] = { total: 0, completed: 0, confirmed: 0 };
      }
      grouped[day].total++;
      if (call.status === 'COMPLETED') grouped[day].completed++;
      if (call.outcome === 'CONFIRMED') grouped[day].confirmed++;
    }

    return Object.entries(grouped)
      .map(([date, stats]) => ({ date, ...stats }))
      .sort((a, b) => a.date.localeCompare(b.date));
  }
}
