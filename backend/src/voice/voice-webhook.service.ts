import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import { SubscriptionsService } from '../subscriptions/subscriptions.service';
import { lifetimeLimitOf } from '../common/utils/dial-merchant.util';

@Injectable()
export class VoiceWebhookService {
  private readonly logger = new Logger(VoiceWebhookService.name);

  constructor(
    private prisma: PrismaService,
    private notifications: NotificationsService,
    private subscriptions: SubscriptionsService,
  ) {}

  /** Normalize ePBX / ippbx webhook payloads (POST body or GET query). */
  extractCallId(body: Record<string, unknown>): string | null {
    const keys = [
      'reference_id',
      'external_id',
      'call_ref',
      'maskara_call_id',
      'call_id',
      'id',
      'metadata',
    ];
    for (const key of keys) {
      const val = body[key];
      if (typeof val === 'string' && val.length > 8) return val;
      if (typeof val === 'number') return String(val);
      if (val && typeof val === 'object' && 'call_id' in (val as object)) {
        return String((val as { call_id: string }).call_id);
      }
    }
    return null;
  }

  extractDigits(body: Record<string, unknown>): string | null {
    const keys = [
      'digits',
      'digit',
      'dtmf',
      'dtmf_input',
      'key_press',
      'Digit',
      'Digits',
    ];
    for (const key of keys) {
      const val = body[key];
      if (val != null && String(val).length > 0) return String(val).charAt(0);
    }
    return null;
  }

  extractStatus(body: Record<string, unknown>): string | null {
    const keys = [
      'status',
      'call_status',
      'CallStatus',
      'disposition',
      'event',
      'result',
      'outcome',
    ];
    for (const key of keys) {
      const val = body[key];
      if (typeof val === 'string') return val.toLowerCase().replace(/_/g, ' ').trim();
    }
    return null;
  }

  extractPhone(body: Record<string, unknown>): string | null {
    const keys = ['phone', 'phone_number', 'to', 'dst', 'customer_phone', 'msisdn'];
    for (const key of keys) {
      const val = body[key];
      if (typeof val === 'string' && val.replace(/\D/g, '').length >= 10) return val;
    }
    return null;
  }

  /** Last 10 national digits for BD mobile matching. */
  normalizeBdPhone(phone: string): string {
    const digits = phone.replace(/\D/g, '');
    if (digits.startsWith('880') && digits.length >= 13) return digits.slice(-10);
    if (digits.startsWith('0') && digits.length === 11) return digits.slice(-10);
    return digits.slice(-10);
  }

  async resolveCallId(body: Record<string, unknown>): Promise<string | null> {
    const direct = this.extractCallId(body);
    if (direct) {
      const byId = await this.prisma.call.findUnique({ where: { id: direct } });
      if (byId) return byId.id;
      const byProvider = await this.prisma.call.findFirst({
        where: { providerCallId: direct },
        orderBy: { createdAt: 'desc' },
      });
      if (byProvider) return byProvider.id;
    }

    const phone = this.extractPhone(body);
    if (!phone) return null;
    return this.findCallIdByPhone(phone);
  }

  async findCallIdByPhone(phone: string): Promise<string | null> {
    const needle = this.normalizeBdPhone(phone);
    if (needle.length < 10) return null;

    // Prefer open calls for this number (ePBX often sends only phone+status+digit)
    const recent = await this.prisma.call.findMany({
      where: {
        createdAt: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) },
        status: { in: ['QUEUED', 'RINGING', 'IN_PROGRESS', 'COMPLETED'] },
      },
      include: { order: true },
      orderBy: { createdAt: 'desc' },
      take: 40,
    });

    for (const call of recent) {
      const orderPhone = call.order?.customerPhone;
      if (!orderPhone) continue;
      if (this.normalizeBdPhone(orderPhone) === needle) {
        // Prefer unfinished / still CALLING orders
        if (
          call.order.status === 'CALLING' ||
          ['QUEUED', 'RINGING', 'IN_PROGRESS'].includes(call.status)
        ) {
          return call.id;
        }
      }
    }

    // Fallback: any match in last 24h
    for (const call of recent) {
      const orderPhone = call.order?.customerPhone;
      if (orderPhone && this.normalizeBdPhone(orderPhone) === needle) {
        return call.id;
      }
    }

    this.logger.warn(`Webhook: no call found for phone ${phone}`);
    return null;
  }

  /** Handle ePBX GET/POST callback payload (query or JSON body). */
  async handleEpbxPayload(payload: Record<string, unknown>) {
    this.logger.log(`ePBX webhook payload: ${JSON.stringify(payload)}`);

    const callId = await this.resolveCallId(payload);
    const digits = this.extractDigits(payload);
    const status = this.extractStatus(payload);

    if (callId && digits) {
      return this.processDtmf(callId, digits);
    }

    if (callId && status) {
      if (status === 'confirmed' || status === 'confirm') {
        return this.processDtmf(callId, '1');
      }
      if (
        status === 'rejected' ||
        status === 'reject' ||
        status === 'cancelled' ||
        status === 'canceled'
      ) {
        return this.processDtmf(callId, '2');
      }
      const duration =
        Number(payload.duration || payload.call_duration || 0) || undefined;
      return this.processStatus(callId, status, duration);
    }

    this.logger.warn(
      `ePBX webhook ignored (callId=${callId}, digits=${digits}, status=${status})`,
    );
    return { received: true, handled: false };
  }

  async processDtmf(callId: string, digits: string) {
    const call = await this.prisma.call.findUnique({
      where: { id: callId },
      include: { order: true, merchant: true },
    });
    if (!call) {
      this.logger.warn(`Webhook: call not found ${callId}`);
      return { ok: false };
    }

    // Already finalized — idempotent
    if (
      call.outcome === 'CONFIRMED' ||
      call.outcome === 'CANCELLED' ||
      call.order.status === 'VERIFIED' ||
      call.order.status === 'CANCELLED'
    ) {
      return { ok: true, outcome: call.outcome, idempotent: true };
    }

    // DTMF 0 = replay verification script (do not finalize call)
    if (digits === '0') {
      await this.prisma.call.update({
        where: { id: callId },
        data: { dtmfInput: '0' },
      });
      this.logger.log(`Webhook DTMF 0 → replay for call ${callId}`);
      return {
        ok: true,
        action: 'replay',
        replay: true,
        digit: '0',
        // Common aliases for ePBX / IVR engines that honor webhook response
        play: 'repeat',
        repeat: true,
        next_action: 'replay_prompt',
      };
    }

    let outcome: 'CONFIRMED' | 'CANCELLED' | 'INVALID_INPUT';
    let orderStatus: 'VERIFIED' | 'CANCELLED' | 'PENDING';

    switch (digits) {
      case '1':
        outcome = 'CONFIRMED';
        orderStatus = 'VERIFIED';
        break;
      case '2':
        outcome = 'CANCELLED';
        orderStatus = 'CANCELLED';
        break;
      default:
        outcome = 'INVALID_INPUT';
        orderStatus = 'PENDING';
        return { ok: false, reason: 'invalid_digit' };
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

    const updatedOrder = await this.prisma.order.findUniqueOrThrow({
      where: { id: call.orderId },
    });
    await this.subscriptions.consumeOrderQuota(call.merchantId, call.orderId);
    await this.notifications.notifyMerchant(call.merchant, updatedOrder, outcome);
    this.logger.log(`Webhook DTMF ${digits} → ${outcome} for call ${callId}`);
    return { ok: true, outcome };
  }

  async processStatus(callId: string, status: string, duration?: number) {
    const statusMap: Record<string, string> = {
      answered: 'IN_PROGRESS',
      'in-progress': 'IN_PROGRESS',
      completed: 'COMPLETED',
      busy: 'BUSY',
      'no-answer': 'NO_ANSWER',
      'no answer': 'NO_ANSWER',
      no_answer: 'NO_ANSWER',
      failed: 'FAILED',
      canceled: 'CANCELLED',
      cancelled: 'CANCELLED',
      ringing: 'RINGING',
    };

    const mapped = statusMap[status] || 'FAILED';
    await this.prisma.call.update({
      where: { id: callId },
      data: {
        status: mapped as 'COMPLETED',
        duration,
        endedAt: ['COMPLETED', 'BUSY', 'NO_ANSWER', 'FAILED', 'CANCELLED'].includes(
          mapped,
        )
          ? new Date()
          : undefined,
      },
    });

    const failStatuses = ['no-answer', 'no answer', 'busy', 'failed'];
    if (failStatuses.includes(status)) {
      const call = await this.prisma.call.findUnique({
        where: { id: callId },
        include: { merchant: true },
      });
      if (!call) return { ok: true };

      // Don't overwrite a verified/cancelled order
      const order = await this.prisma.order.findUnique({ where: { id: call.orderId } });
      if (
        order &&
        (order.status === 'VERIFIED' ||
          order.status === 'CANCELLED' ||
          order.status === 'ESCALATED')
      ) {
        return { ok: true };
      }

      if (call.attemptNumber < lifetimeLimitOf(call.merchant)) {
        const pending = await this.prisma.order.update({
          where: { id: call.orderId },
          data: { status: 'PENDING' },
        });
        await this.notifications.pushOrderUpdate(call.merchant, pending, {
          verifyStatus: 'pending',
        });
      } else {
        // Lifetime exhausted — stop auto-dial; merchant cancels manually
        const pending = await this.prisma.order.update({
          where: { id: call.orderId },
          data: { status: 'PENDING', nextCallAt: null },
        });
        await this.notifications.pushOrderUpdate(call.merchant, pending, {
          verifyStatus: 'pending',
        });
      }
    }

    return { ok: true };
  }
}
