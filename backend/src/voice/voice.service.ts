import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import { VoiceProviderFactory } from './providers/voice-provider.factory';
import {
  DEFAULT_MERCHANT_VOICE_ID,
  buildOrderVerificationPrompt,
  extractProductNamesFromItems,
  shouldMigrateMerchantVoiceId,
} from './providers/bangla-prompt';
import { S3StorageService } from '../common/services/s3-storage.service';
import { isWithinCallWindow } from '../common/utils/call-window.util';
import {
  computeNextCallAt,
  isCallWindowExempt,
} from '../common/utils/call-schedule.util';
import {
  countCallsTodayForOrder,
  lifetimeLimitOf,
  merchantDialConfig,
} from '../common/utils/dial-merchant.util';
import { VoiceSettingsService } from './voice-settings.service';
import { SubscriptionsService } from '../subscriptions/subscriptions.service';

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
    private voiceSettings: VoiceSettingsService,
    private subscriptions: SubscriptionsService,
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

    if (['VERIFIED', 'CANCELLED'].includes(order.status)) {
      this.logger.warn(`Skipping call for finalized order ${order.orderNumber}`);
      return;
    }

    const cfg = merchantDialConfig(merchant);
    // Attempts 1–2 may dial outside the daily window (new-order burst)
    if (
      !isCallWindowExempt(order.callAttempts) &&
      !isWithinCallWindow(
        cfg.timezone,
        cfg.callWindowStartMin,
        cfg.callWindowEndMin,
      )
    ) {
      this.logger.log(`Outside call window — skipping call for ${order.orderNumber}`);
      return;
    }

    const lifetime = lifetimeLimitOf(merchant);
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

    const callsToday = await countCallsTodayForOrder(this.prisma, orderId, merchant);
    if (callsToday >= (cfg.dailyCallLimit ?? 10)) {
      this.logger.log(`Daily dial cap — skipping call for ${order.orderNumber}`);
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

    const updatedOrder = await this.prisma.order.update({
      where: { id: orderId },
      data: { status: 'CALLING', callAttempts: { increment: 1 } },
    });
    await this.setNextCallAt(
      updatedOrder.id,
      updatedOrder.callAttempts,
      merchant,
      order.createdAt,
    );
    await this.notifications.pushOrderUpdate(merchant, updatedOrder, {
      verifyStatus: 'calling',
    });

    const storeName = merchant.storeNameBangla || merchant.name;

    let merchantVoiceId: string | null =
      (merchant as { voiceId?: string | null }).voiceId ?? null;
    let speechRate: number | null =
      (merchant as { speechRate?: number | null }).speechRate ?? null;
    try {
      const rows = await this.prisma.$queryRaw<
        Array<{ voiceId: string | null; speechRate: number | null }>
      >`
        SELECT "voiceId", "speechRate" FROM "Merchant" WHERE id = ${merchantId} LIMIT 1
      `;
      if (!merchantVoiceId) merchantVoiceId = rows[0]?.voiceId ?? null;
      if (speechRate == null && rows[0]?.speechRate != null) {
        speechRate = Number(rows[0].speechRate);
      }
    } catch {
      // ignore
    }

    // Soft-migrate Azure নবনীতা / null → Chirp3 Algieba (no merchant re-select needed)
    if (shouldMigrateMerchantVoiceId(merchantVoiceId)) {
      const from = merchantVoiceId || 'null';
      merchantVoiceId = DEFAULT_MERCHANT_VOICE_ID;
      try {
        await this.prisma.$executeRaw`
          UPDATE "Merchant" SET "voiceId" = ${DEFAULT_MERCHANT_VOICE_ID}
          WHERE id = ${merchantId}
            AND ("voiceId" IS NULL OR "voiceId" ILIKE '%nabanita%')
        `;
        this.logger.log(
          `[voice] migrated merchant ${merchantId} voiceId ${from} → ${DEFAULT_MERCHANT_VOICE_ID}`,
        );
      } catch (err) {
        this.logger.warn(
          `voiceId migration skipped: ${err instanceof Error ? err.message : err}`,
        );
      }
    }

    try {
      this.logger.log(
        `[voice] initiate start order=${order.orderNumber} callId=${call.id} merchantVoiceId=${merchantVoiceId || 'null'} speechRate=${speechRate ?? 'default'} provider=${provider.name}`,
      );
      const result = await provider.initiateCall({
        callId: call.id,
        to: order.customerPhone,
        storeName,
        customerName: order.customerName,
        orderNumber: order.orderNumber,
        totalAmount: Number(order.totalAmount),
        merchantId,
        productNames: extractProductNamesFromItems(order.items),
        customGreeting: merchant.customGreeting,
        voiceId: merchantVoiceId,
        speechRate,
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
        `[voice] initiate ok order=${order.orderNumber} callId=${call.id} merchantVoiceId=${merchantVoiceId || 'default'} provider=${provider.name} providerCallId=${result.providerCallId}`,
      );
      return call;
    } catch (error) {
      this.logger.error(`Failed to initiate call: ${error}`);
      await this.prisma.call.update({
        where: { id: call.id },
        data: { status: 'FAILED', errorMessage: String(error) },
      });
      const failedOrder = await this.prisma.order.update({
        where: { id: orderId },
        data: { status: 'FAILED' },
      });
      await this.setNextCallAt(
        failedOrder.id,
        failedOrder.callAttempts,
        merchant,
        order.createdAt,
      );
      throw error;
    }
  }

  /** Schedule the next follow-up (or clear when lifetime exhausted). */
  private async setNextCallAt(
    orderId: string,
    completedAttempts: number,
    merchant: Parameters<typeof merchantDialConfig>[0] & {
      timezone?: string | null;
    },
    orderCreatedAt?: Date | null,
  ) {
    const cfg = merchantDialConfig(merchant);
    const callsToday = await countCallsTodayForOrder(
      this.prisma,
      orderId,
      merchant,
    );
    const nextCallAt = computeNextCallAt({
      orderId,
      completedAttempts,
      merchant: cfg,
      callsToday,
      orderCreatedAt: orderCreatedAt ?? undefined,
    });
    await this.prisma.order.update({
      where: { id: orderId },
      data: { nextCallAt },
    });
  }

  generateTwiml(
    callId: string,
    params: {
      storeName: string;
      customerName?: string;
      orderNumber?: string;
      totalAmount?: number;
      customGreeting?: string | null;
      productNames?: string[];
    },
  ): string {
    const greeting = buildOrderVerificationPrompt({
      storeName: params.storeName,
      customerName: params.customerName,
      orderNumber: params.orderNumber,
      totalAmount: params.totalAmount,
      customGreeting: params.customGreeting,
      productNames: params.productNames,
    });
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

    // DTMF 0 = replay the same verification prompt
    if (digits === '0') {
      await this.prisma.call.update({
        where: { id: callId },
        data: { dtmfInput: '0' },
      });
      this.logger.log(`Twilio DTMF 0 → replay for call ${callId}`);
      return this.generateReplayTwiml(callId);
    }

    let outcome: 'CONFIRMED' | 'CANCELLED' | 'INVALID_INPUT';
    let orderStatus: 'VERIFIED' | 'CANCELLED';
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
      default:
        message =
          'অবৈধ ইনপুট। ১ চাপুন নিশ্চিত করতে, ২ বাতিল করতে, পুনরায় শুনতে ০ চাপুন।';
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
          nextCallAt: null,
          ...(orderStatus === 'VERIFIED' && { verifiedAt: new Date() }),
          ...(orderStatus === 'CANCELLED' && { cancelledAt: new Date() }),
        },
      }),
    ]);

    const updatedOrder = await this.prisma.order.findUniqueOrThrow({ where: { id: call.orderId } });
    await this.subscriptions.consumeOrderQuota(call.merchantId, call.orderId);
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
      if (!call) return;
      if (call.attemptNumber < lifetimeLimitOf(call.merchant)) {
        await this.prisma.order.update({
          where: { id: call.orderId },
          data: { status: 'PENDING' },
        });
      } else {
        // Lifetime exhausted — leave pending for manual cancel; clear schedule
        await this.prisma.order.update({
          where: { id: call.orderId },
          data: { status: 'PENDING', nextCallAt: null },
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

  /** Re-enter Gather with the same verification prompt (DTMF 0). */
  private generateReplayTwiml(callId: string): string {
    return `<?xml version="1.0" encoding="UTF-8"?>
<Response>
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
      data: {
        status: 'VERIFIED',
        verifiedAt: new Date(),
        callAttempts: { increment: 1 },
        nextCallAt: null,
      },
    });

    await this.subscriptions.consumeOrderQuota(merchant.id, order.id);

    this.logger.log(`Simulated call completed for order ${order.orderNumber}`);
    return call;
  }

  /**
   * Admin test dial — uses real ePBX + portal Chirp3 (same path as live orders).
   * Pass voiceId (e.g. google:bn-IN-Chirp3-HD-Aoede) to hear that voice on the phone.
   */
  async initiateTestCall(
    phone: string,
    message?: string,
    voiceId?: string | null,
  ) {
    const to = phone.replace(/\D/g, '');
    if (to.length < 10) {
      throw new Error('Valid BD phone required (01XXXXXXXXX)');
    }

    const provider = this.providers.getActiveProvider();
    if (!provider || provider.name !== 'epbx') {
      throw new Error('ePBX not configured as active voice provider');
    }

    const callId = `test_${Date.now()}`;
    const resolvedVoice =
      voiceId?.trim() || 'google:bn-IN-Chirp3-HD-Aoede';
    const result = await provider.initiateCall({
      callId,
      to: phone.trim(),
      storeName: 'Maskara Test',
      customerName: 'টেস্ট গ্রাহক',
      orderNumber: 'TEST',
      totalAmount: 0,
      merchantId: 'test',
      customGreeting:
        message?.trim() ||
        'আসসালামু আলাইকুম। এটি Maskara টেস্ট কল। আপনার অর্ডার নিশ্চিত করতে ১ চাপুন, বাতিল করতে ২ চাপুন। পুনরায় শুনতে ০ চাপুন।',
      voiceId: resolvedVoice,
      speechRate: 1.05,
    });

    this.logger.log(
      `Admin test call queued callId=${callId} to=${phone} voiceId=${resolvedVoice} providerId=${result.providerCallId}`,
    );

    return {
      success: true,
      callId,
      providerCallId: result.providerCallId,
      voiceId: resolvedVoice,
      message: `Test call queued to ${phone} (${resolvedVoice})`,
      details: result,
    };
  }

  getEpbxProbe() {
    const publicApi = (
      this.voiceSettings.get('PUBLIC_API_URL') ||
      this.config.get('PUBLIC_API_URL') ||
      this.config.get('API_URL') ||
      this.apiUrl
    ).replace(/\/$/, '');

    return {
      apiUrl: (
        this.voiceSettings.get('EPBX_API_URL') ||
        this.config.get('EPBX_API_URL') ||
        'https://maskara.epbx.bd/api/v1'
      ).replace(/\/$/, ''),
      apiKeySet: Boolean(
        this.voiceSettings.get('EPBX_API_KEY') ||
          this.config.get('EPBX_API_KEY'),
      ),
      customerId:
        this.voiceSettings.get('EPBX_CUSTOMER_ID') ||
        this.config.get('EPBX_CUSTOMER_ID') ||
        null,
      ivrId: null,
      googleTts: this.voiceSettings.isGoogleTtsConfigured(),
      webhooks: {
        general: `${publicApi}/voice/webhook/epbx`,
        dtmf: `${publicApi}/voice/webhook/epbx/dtmf`,
        status: `${publicApi}/voice/webhook/epbx/status`,
      },
      note: 'IVR not used on Maskara dials — Chirp3 audio only',
    };
  }
}
