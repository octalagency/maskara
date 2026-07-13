import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { InjectQueue } from '@nestjs/bull';
import { Queue } from 'bull';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import { isWithinCallWindow } from '../common/utils/call-window.util';

@Injectable()
export class CallsRetryScheduler {
  private readonly logger = new Logger(CallsRetryScheduler.name);

  constructor(
    private prisma: PrismaService,
    @InjectQueue('calls') private callsQueue: Queue,
    private notifications: NotificationsService,
  ) {}

  /** First call within ~20s of order if queue job was missed. */
  @Cron('*/20 * * * * *')
  async enqueueFirstCalls() {
    if (!isWithinCallWindow()) return;

    const pending = await this.prisma.order.findMany({
      where: {
        status: 'PENDING',
        callAttempts: 0,
        createdAt: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) },
      },
      include: {
        merchant: true,
        calls: { take: 1 },
      },
      take: 40,
      orderBy: { createdAt: 'asc' },
    });

    for (const order of pending) {
      if (order.calls.length > 0) continue;
      if (!isWithinCallWindow(order.merchant.timezone || 'Asia/Dhaka')) continue;

      this.logger.log(`First-call enqueue (≤20s) for ${order.orderNumber}`);
      await this.queueCall(order.id, order.merchantId, false);
    }
  }

  @Cron(CronExpression.EVERY_MINUTE)
  async retryFailedCalls() {
    const pendingOrders = await this.prisma.order.findMany({
      where: {
        status: { in: ['PENDING', 'FAILED', 'CALLING'] },
      },
      include: { merchant: true, calls: { orderBy: { createdAt: 'desc' }, take: 1 } },
      take: 80,
    });

    for (const order of pendingOrders) {
      if (order.callAttempts >= order.merchant.maxCallRetries) {
        if (order.status !== 'FAILED') {
          const failed = await this.prisma.order.update({
            where: { id: order.id },
            data: { status: 'FAILED' },
          });
          await this.notifications.pushOrderUpdate(order.merchant, failed, {
            verifyStatus: 'failed',
          });
        }
        continue;
      }

      if (!isWithinCallWindow(order.merchant.timezone || 'Asia/Dhaka')) {
        continue;
      }

      const lastCall = order.calls[0];
      const retryAfter = order.merchant.retryIntervalMin * 60 * 1000;

      // First call handled by enqueueFirstCalls + order create queue
      if (!lastCall && order.status === 'PENDING' && order.callAttempts === 0) {
        await this.queueCall(order.id, order.merchantId, false);
        continue;
      }

      if (!lastCall) continue;

      const timeSinceLastCall = Date.now() - lastCall.createdAt.getTime();
      const shouldRetry =
        timeSinceLastCall >= retryAfter &&
        ['NO_ANSWER', 'BUSY', 'FAILED', 'RINGING'].includes(lastCall.status);

      // RINGING only if stuck > retry interval (provider never callbacked)
      if (lastCall.status === 'RINGING' && timeSinceLastCall < retryAfter) {
        continue;
      }

      if (shouldRetry) {
        this.logger.log(
          `Retry ${order.callAttempts + 1}/${order.merchant.maxCallRetries} for ${order.orderNumber}`,
        );
        await this.queueCall(order.id, order.merchantId, true);
      }
    }
  }

  private async queueCall(orderId: string, merchantId: string, isRetry: boolean) {
    await this.callsQueue.add(
      'initiate-call',
      { orderId, merchantId, isRetry },
      {
        attempts: 1,
        removeOnComplete: true,
        jobId: `call-${orderId}-${isRetry ? 'r' : 'f'}-${Math.floor(Date.now() / 15000)}`,
      },
    );
  }
}
