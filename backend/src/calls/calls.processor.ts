import { Process, Processor } from '@nestjs/bull';
import { Logger } from '@nestjs/common';
import { Job } from 'bull';
import { VoiceService } from '../voice/voice.service';
import { PrismaService } from '../prisma/prisma.service';
import { SubscriptionsService } from '../subscriptions/subscriptions.service';

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
    const { orderId, merchantId, isRetry } = job.data;
    this.logger.log(`Processing call job for order ${orderId}`);

    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
    });

    if (!order || ['VERIFIED', 'CANCELLED'].includes(order.status)) {
      this.logger.warn(`Skipping call for finalized order ${orderId}`);
      return;
    }

    const limitCheck = await this.subscriptions.canMakeCall(merchantId);
    if (!limitCheck.allowed) {
      this.logger.warn(`Call limit exceeded for merchant ${merchantId}: ${limitCheck.reason}`);
      return;
    }

    const attemptNumber = isRetry ? order.callAttempts + 1 : 1;
    await this.voiceService.initiateCall(orderId, merchantId, attemptNumber);
    await this.subscriptions.incrementCallUsage(merchantId);
  }
}
