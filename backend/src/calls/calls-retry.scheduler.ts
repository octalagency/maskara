import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { InjectQueue } from '@nestjs/bull';
import { Queue } from 'bull';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class CallsRetryScheduler {
  private readonly logger = new Logger(CallsRetryScheduler.name);

  constructor(
    private prisma: PrismaService,
    @InjectQueue('calls') private callsQueue: Queue,
  ) {}

  @Cron(CronExpression.EVERY_5_MINUTES)
  async retryFailedCalls() {
    const pendingOrders = await this.prisma.order.findMany({
      where: {
        status: { in: ['PENDING', 'FAILED'] },
        callAttempts: { gt: 0 },
      },
      include: { merchant: true, calls: { orderBy: { createdAt: 'desc' }, take: 1 } },
      take: 50,
    });

    for (const order of pendingOrders) {
      if (order.callAttempts >= order.merchant.maxCallRetries) continue;

      const lastCall = order.calls[0];
      if (!lastCall) continue;

      const retryAfter = order.merchant.retryIntervalMin * 60 * 1000;
      const timeSinceLastCall = Date.now() - lastCall.createdAt.getTime();

      if (
        timeSinceLastCall >= retryAfter &&
        ['NO_ANSWER', 'BUSY', 'FAILED'].includes(lastCall.status)
      ) {
        this.logger.log(`Scheduling retry for order ${order.orderNumber}`);
        await this.callsQueue.add(
          'initiate-call',
          { orderId: order.id, merchantId: order.merchantId, isRetry: true },
          { attempts: 1 },
        );
      }
    }
  }
}
