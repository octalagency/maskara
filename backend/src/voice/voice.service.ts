import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import { VoiceProviderFactory } from './providers/voice-provider.factory';
import { buildOrderVerificationPrompt } from './providers/bangla-prompt';
import { S3StorageService } from '../common/services/s3-storage.service';
import { isWithinCallWindow } from '../common/utils/call-window.util';

@Injectable()
export class VoiceService {
  private readonly logger = new Logger(VoiceService.name);
  private apiUrl: string;

  constructor(
    private config: ConfigService,
    private prisma: PrismaService,
    private notifications: NotificationsService,
    private providers: VoiceProviderFactory,
    private s3: S3StorageService,
  ) {
    this.apiUrl =
      this.config.get('PUBLIC_API_URL') ||
      this.config.get('API_URL', 'http://localhost:4000');
  }

  getActiveProviderInfo() {
    const name = this.providers.getProviderName();
    return {
      provider: name,
      epbx: this.providers.getActiveProvider()?.name === 'epbx',
      configured: name !== 'simulate',
      estimatedRateBdt:
        name === 'epbx' || name === 'ippbx' ? '0.35-0.45/min' : name === 'twilio' ? '6-7/min' : '0',
    };
  }

  async initiateCall(orderId: string, merchantId: string, attemptNumber = 1) {
    const [order, merchant] = await Promise.all([
      this.prisma.order.findUnique({ where: { id: orderId } }),
      this.prisma.merchant.findUnique({ where: { id: merchantId } }),
    ]);

    if (!order || !merchant) {
      this.logger.error(`Order or merchant not found: ${orderId}`);
      return;
    }

    if (!isWithinCallWindow(merchant.timezone || 'Asia/Dhaka')) {
      this.logger.log(`Outside call window — skipping call for ${order.orderNumber}`);
      return;
    }

    if (order.callAttempts >= merchant.maxCallRetries) {
      this.logger.warn(`Max call attempts reached for ${order.orderNumber}`);
      return;
    }

    const provider = this.providers.getActiveProvider();
    if (!provider) {
      this.logger.warn('No voice provider — simulating call');
      return this.simulateCall(order, merchant, attemptNumber);
    }

    const call = await this.prisma.call.create({
      data: {
        merchantId,
        orderId,
        status: 'QUEUED',
        attemptNumber,
        provider: provider.name,
      },
    });

    await this.prisma.order.update({
      where: { id: orderId },
      data: { status: 'CALLING', callAttempts: { increment: 1 } },
    });

    const updatedOrder = await this.prisma.order.findUniqueOrThrow({
      where: { id: orderId },
    });
    await this.notifications.pushOrderUpdate(merchant, updatedOrder, {
      verifyStatus: 'calling',
    });

    const storeName = merchant.storeNameBangla || merchant.name;

    let merchantVoiceId: string | null =
      (merchant as { voiceId?: string | null }).voiceId ?? null;
    if (!merchantVoiceId) {
      try {
        const rows = await this.prisma.$queryRaw<Array<{ voiceId: string | null }>>`
          SELECT "voiceId" FROM "Merchant" WHERE id = ${merchantId} LIMIT 1
        `;
        merchantVoiceId = rows[0]?.voiceId ?? null;
      } catch {
        merchantVoiceId = null;
      }
    }

    try {
      const result = await provider.initiateCall({
        callId: call.id,
        to: order.customerPhone,
        storeName,
        customerName: order.customerName,
        orderNumber: order.orderNumber,
        totalAmount: Number(order.totalAmount),
        merchantId,
        customGreeting: merchant.customGreeting,
        voiceId: merchantVoiceId,
      });

      await this.prisma.call.update({
        where: { id: call.id },
        data: {
          providerCallId: result.providerCallId,
          twilioCallSid: provider.name === 'twilio' ? result.providerCallId : undefined,
          status: result.status,
          startedAt: new Date(),
        },
      });

      this.logger.log(
        `${provider.name} call initiated for order ${order.orderNumber} voice=${merchantVoiceId || 'default'}`,
      );
      return call;
    } catch (error) {
      this.logger.error(`Failed to initiate call: ${error}`);
      await this.prisma.call.update({
        where: { id: call.id },
        data: { status: 'FAILED', errorMessage: String(error) },
      });
      await this.prisma.order.update({
        where: { id: orderId },
        data: { status: 'FAILED' },
      });
      throw error;
    }
  }

  generateTwiml(callId: string, storeName: string): string {
    const greeting = buildOrderVerificationPrompt({ storeName });
    const gatherUrl = `${this.apiUrl}/voice/gather/${callId}`;

    return `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Gather numDigits="1" action="${gatherUrl}" method="POST" timeout="10" language="bn-BD">
    <Say voice="Polly.Aditi" language="bn-IN">${this.escapeXml(greeting)}</Say>
  </Gather>
  <Say voice="Polly.Aditi" language="bn-IN">কোনো উত্তর পাওয়া যায়নি। আবার চেষ্টা করুন।</Say>
  <Redirect>${this.apiUrl}/voice/twiml/${callId}</Redirect>
</Response>`;
  }

  async handleDtmfInput(callId: string, digits: string) {
    const call = await this.prisma.call.findUnique({
      where: { id: callId },
      include: { order: true, merchant: true },
    });

    if (!call) return this.generateResponseTwiml('কলটি খুঁজে পাওয়া যায়নি।');

    let outcome: 'CONFIRMED' | 'CANCELLED' | 'ESCALATED' | 'INVALID_INPUT';
    let orderStatus: 'VERIFIED' | 'CANCELLED' | 'ESCALATED';
    let message: string;

    switch (digits) {
      case '1':
        outcome = 'CONFIRMED';
        orderStatus = 'VERIFIED';
        message = 'ধন্যবাদ। আপনার অর্ডার নিশ্চিত হয়েছে। শীঘ্রই ডেলিভারি করা হবে।';
        break;
      case '2':
        outcome = 'CANCELLED';
        orderStatus = 'CANCELLED';
        message = 'আপনার অর্ডার বাতিল করা হয়েছে। ধন্যবাদ।';
        break;
      case '0':
        outcome = 'ESCALATED';
        orderStatus = 'ESCALATED';
        message = 'একজন প্রতিনিধি শীঘ্রই আপনার সাথে যোগাযোগ করবেন। ধন্যবাদ।';
        break;
      default:
        message = 'অবৈধ ইনপুট। ১ চাপুন নিশ্চিত করতে, ২ বাতিল করতে, ০ প্রতিনিধির সাথে কথা বলতে।';
        return this.generateGatherRetryTwiml(callId, message);
    }

    await this.prisma.$transaction([
      this.prisma.call.update({
        where: { id: callId },
        data: {
          dtmfInput: digits,
          outcome,
          status: 'COMPLETED',
          endedAt: new Date(),
        },
      }),
      this.prisma.order.update({
        where: { id: call.orderId },
        data: {
          status: orderStatus,
          ...(orderStatus === 'VERIFIED' && { verifiedAt: new Date() }),
          ...(orderStatus === 'CANCELLED' && { cancelledAt: new Date() }),
        },
      }),
    ]);

    const updatedOrder = await this.prisma.order.findUniqueOrThrow({ where: { id: call.orderId } });
    await this.notifications.notifyMerchant(call.merchant, updatedOrder, outcome);
    return this.generateResponseTwiml(message);
  }

  async handleCallStatus(callId: string, status: string, duration?: string) {
    const statusMap: Record<string, string> = {
      initiated: 'RINGING',
      ringing: 'RINGING',
      'in-progress': 'IN_PROGRESS',
      completed: 'COMPLETED',
      busy: 'BUSY',
      'no-answer': 'NO_ANSWER',
      failed: 'FAILED',
      canceled: 'CANCELLED',
    };

    const callStatus = statusMap[status] || 'FAILED';

    await this.prisma.call.update({
      where: { id: callId },
      data: {
        status: callStatus as 'COMPLETED',
        duration: duration ? parseInt(duration, 10) : undefined,
        endedAt: ['completed', 'busy', 'no-answer', 'failed', 'canceled'].includes(status)
          ? new Date()
          : undefined,
      },
    });

    if (['no-answer', 'busy', 'failed'].includes(status)) {
      const call = await this.prisma.call.findUnique({
        where: { id: callId },
        include: { merchant: true },
      });
      if (call && call.attemptNumber < call.merchant.maxCallRetries) {
        await this.prisma.order.update({
          where: { id: call.orderId },
          data: { status: 'PENDING' },
        });
      }
    }
  }

  async handleRecording(callId: string, recordingUrl: string) {
    const call = await this.prisma.call.findUnique({
      where: { id: callId },
      include: { merchant: true },
    });
    if (!call) return;

    let s3Key: string | null = null;
    let finalUrl = recordingUrl;

    if (this.s3.isConfigured() && recordingUrl.startsWith('http')) {
      s3Key = `recordings/${call.merchantId}/${callId}.mp3`;
      const uploaded = await this.s3.uploadFromUrl(recordingUrl, s3Key);
      if (uploaded) finalUrl = uploaded;
    }

    await this.prisma.call.update({
      where: { id: callId },
      data: {
        recordingUrl: finalUrl,
        recordingS3Key: s3Key,
      },
    });
  }

  private generateResponseTwiml(message: string): string {
    return `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say voice="Polly.Aditi" language="bn-IN">${this.escapeXml(message)}</Say>
  <Hangup/>
</Response>`;
  }

  private generateGatherRetryTwiml(callId: string, message: string): string {
    return `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say voice="Polly.Aditi" language="bn-IN">${this.escapeXml(message)}</Say>
  <Redirect>${this.apiUrl}/voice/twiml/${callId}</Redirect>
</Response>`;
  }

  private escapeXml(text: string): string {
    return text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&apos;');
  }

  private async simulateCall(
    order: { id: string; orderNumber: string },
    merchant: { id: string; name: string },
    attemptNumber: number,
  ) {
    const call = await this.prisma.call.create({
      data: {
        merchantId: merchant.id,
        orderId: order.id,
        status: 'COMPLETED',
        outcome: 'CONFIRMED',
        dtmfInput: '1',
        duration: 15,
        attemptNumber,
        provider: 'simulate',
        startedAt: new Date(),
        endedAt: new Date(),
      },
    });

    await this.prisma.order.update({
      where: { id: order.id },
      data: { status: 'VERIFIED', verifiedAt: new Date() },
    });

    this.logger.log(`Simulated call completed for order ${order.orderNumber}`);
    return call;
  }
}
