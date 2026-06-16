import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';

@Injectable()
export class VoiceWebhookService {
  private readonly logger = new Logger(VoiceWebhookService.name);

  constructor(
    private prisma: PrismaService,
    private notifications: NotificationsService,
  ) {}

  /** Normalize ePBX / ippbx webhook payloads */
  extractCallId(body: Record<string, unknown>): string | null {
    const keys = [
      'reference_id',
      'external_id',
      'call_ref',
      'maskara_call_id',
      'metadata',
    ];
    for (const key of keys) {
      const val = body[key];
      if (typeof val === 'string' && val.length > 8) return val;
      if (val && typeof val === 'object' && 'call_id' in (val as object)) {
        return String((val as { call_id: string }).call_id);
      }
    }
    return null;
  }

  extractDigits(body: Record<string, unknown>): string | null {
    const keys = ['digits', 'dtmf', 'dtmf_input', 'key_press', 'Digit', 'Digits'];
    for (const key of keys) {
      const val = body[key];
      if (val != null && String(val).length > 0) return String(val).charAt(0);
    }
    return null;
  }

  extractStatus(body: Record<string, unknown>): string | null {
    const keys = ['status', 'call_status', 'CallStatus', 'disposition'];
    for (const key of keys) {
      const val = body[key];
      if (typeof val === 'string') return val.toLowerCase();
    }
    return null;
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

    let outcome: 'CONFIRMED' | 'CANCELLED' | 'ESCALATED' | 'INVALID_INPUT';
    let orderStatus: 'VERIFIED' | 'CANCELLED' | 'ESCALATED' | 'PENDING';

    switch (digits) {
      case '1':
        outcome = 'CONFIRMED';
        orderStatus = 'VERIFIED';
        break;
      case '2':
        outcome = 'CANCELLED';
        orderStatus = 'CANCELLED';
        break;
      case '0':
        outcome = 'ESCALATED';
        orderStatus = 'ESCALATED';
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
          ...(orderStatus === 'VERIFIED' && { verifiedAt: new Date() }),
          ...(orderStatus === 'CANCELLED' && { cancelledAt: new Date() }),
        },
      }),
    ]);

    await this.notifications.notifyMerchant(call.merchant, call.order, outcome);
    this.logger.log(`Webhook DTMF ${digits} → ${outcome} for call ${callId}`);
    return { ok: true, outcome };
  }

  async processStatus(
    callId: string,
    status: string,
    duration?: number,
  ) {
    const statusMap: Record<string, string> = {
      answered: 'IN_PROGRESS',
      'in-progress': 'IN_PROGRESS',
      completed: 'COMPLETED',
      busy: 'BUSY',
      'no-answer': 'NO_ANSWER',
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

    if (['no-answer', 'no_answer', 'busy', 'failed'].includes(status)) {
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

    return { ok: true };
  }
}
