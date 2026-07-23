import { Process, Processor } from '@nestjs/bull';
import { Logger } from '@nestjs/common';
import { Job } from 'bull';
import { VoiceService } from '../voice/voice.service';
import { PrismaService } from '../prisma/prisma.service';
import { SubscriptionsService } from '../subscriptions/subscriptions.service';
import {
  isWithinCallWindow,
  nextWindowOpenAt,
} from '../common/utils/call-window.util';
import {
  countCallsTodayForOrder,
  lifetimeLimitOf,
  merchantDialConfig,
} from '../common/utils/dial-merchant.util';
import { computeFirstCallAt } from '../common/utils/call-schedule.util';

interface CallJobData {
  orderId: string;
  merchantId: string;
  isRetry?: boolean;
}

@Processor('calls')
export class CallsProcessor {
  private readonly logger = new Logger(CallsProcessor.name);

  constructor(
    private voiceService: VoiceService,
    private prisma: PrismaService,
    private subscriptions: SubscriptionsService,
  ) {}

  @Process('initiate-call')
  async handleInitiateCall(job: Job<CallJobData>) {
    const { orderId, merchantId } = job.data;
    this.logger.log(`Processing call job for order ${orderId}`);

    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      include: { merchant: true },
    });

    if (!order || ['VERIFIED', 'CANCELLED'].includes(order.status)) {
      this.logger.warn(`Skipping call for finalized order ${orderId}`);
      return;
    }

    const lifetime = lifetimeLimitOf(order.merchant);
    if (order.callAttempts >= lifetime) {
      this.logger.warn(
        `Lifetime dial cap reached for ${order.orderNumber} — awaiting manual cancel`,
      );
      await this.prisma.order.update({
        where: { id: orderId },
        data: { nextCallAt: null },
      });
      return;
    }

    const cfg = merchantDialConfig(order.merchant);
    if (
      !isWithinCallWindow(
        cfg.timezone,
        cfg.callWindowStartMin,
        cfg.callWindowEndMin,
      )
    ) {
      const openAt = computeFirstCallAt(cfg);
      this.logger.log(
        `Outside call window — defer ${order.orderNumber} to ${openAt.toISOString()}`,
      );
      await this.prisma.order.update({
        where: { id: orderId },
        data: { nextCallAt: openAt },
      });
      return;
    }

    const callsToday = await countCallsTodayForOrder(
      this.prisma,
      orderId,
      order.merchant,
    );
    if (callsToday >= (cfg.dailyCallLimit ?? 10)) {
      const openAt = nextWindowOpenAt(
        cfg.timezone,
        cfg.callWindowStartMin,
        cfg.callWindowEndMin,
        new Date(Date.now() + 60_000),
      );
      this.logger.log(
        `Daily dial cap for ${order.orderNumber} — resume ${openAt.toISOString()}`,
      );
      await this.prisma.order.update({
        where: { id: orderId },
        data: { nextCallAt: openAt },
      });
      return;
    }

    const limitCheck = await this.subscriptions.canMakeCall(merchantId);
    if (!limitCheck.allowed) {
      this.logger.warn(`Call limit exceeded for merchant ${merchantId}: ${limitCheck.reason}`);
      return;
    }

    const attemptNumber = order.callAttempts + 1;
    await this.voiceService.initiateCall(orderId, merchantId, attemptNumber);
  }
}
