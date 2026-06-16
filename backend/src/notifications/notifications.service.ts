import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as twilio from 'twilio';
import { PrismaService } from '../prisma/prisma.service';
import { Merchant, Order } from '@prisma/client';

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);
  private twilioClient: twilio.Twilio | null = null;

  constructor(
    private prisma: PrismaService,
    private config: ConfigService,
  ) {
    const accountSid = this.config.get('TWILIO_ACCOUNT_SID');
    const authToken = this.config.get('TWILIO_AUTH_TOKEN');
    if (accountSid && authToken) {
      this.twilioClient = twilio(accountSid, authToken);
    }
  }

  async notifyMerchant(
    merchant: Merchant,
    order: Order,
    outcome: string,
  ) {
    const statusText = this.getOutcomeText(outcome);
    const message = `অর্ডার ${order.orderNumber}: ${statusText} - ${order.customerName} (${order.customerPhone}) - ৳${order.totalAmount}`;

    await this.prisma.notification.create({
      data: {
        merchantId: merchant.id,
        orderId: order.id,
        type: 'IN_APP',
        status: 'SENT',
        recipient: merchant.email,
        subject: `Order ${order.orderNumber} - ${statusText}`,
        message,
        sentAt: new Date(),
      },
    });

    if (merchant.smsEnabled && merchant.phone) {
      await this.sendSms(merchant.id, merchant.phone, message, order.id);
    }

    if (merchant.whatsappEnabled && merchant.phone) {
      await this.sendWhatsApp(merchant.id, merchant.phone, message, order.id);
    }

    if (merchant.webhookUrl) {
      await this.sendMerchantWebhook(merchant, order, outcome);
    }
  }

  async sendSms(merchantId: string, to: string, message: string, orderId?: string) {
    const notification = await this.prisma.notification.create({
      data: {
        merchantId,
        orderId,
        type: 'SMS',
        status: 'PENDING',
        recipient: to,
        message,
      },
    });

    if (!this.twilioClient) {
      this.logger.warn('Twilio not configured - SMS not sent');
      return notification;
    }

    try {
      await this.twilioClient.messages.create({
        to,
        from: this.config.get('TWILIO_PHONE_NUMBER'),
        body: message,
      });

      await this.prisma.notification.update({
        where: { id: notification.id },
        data: { status: 'SENT', sentAt: new Date() },
      });
    } catch (error) {
      this.logger.error(`SMS failed: ${error}`);
      await this.prisma.notification.update({
        where: { id: notification.id },
        data: { status: 'FAILED' },
      });
    }

    return notification;
  }

  async sendWhatsApp(merchantId: string, to: string, message: string, orderId?: string) {
    if (!this.config.get('WHATSAPP_ENABLED')) return;

    const notification = await this.prisma.notification.create({
      data: {
        merchantId,
        orderId,
        type: 'WHATSAPP',
        status: 'PENDING',
        recipient: to,
        message,
      },
    });

    if (!this.twilioClient) return notification;

    try {
      const whatsappNumber = this.config.get('TWILIO_WHATSAPP_NUMBER');
      await this.twilioClient.messages.create({
        to: `whatsapp:${to}`,
        from: whatsappNumber,
        body: message,
      });

      await this.prisma.notification.update({
        where: { id: notification.id },
        data: { status: 'SENT', sentAt: new Date() },
      });
    } catch (error) {
      this.logger.error(`WhatsApp failed: ${error}`);
      await this.prisma.notification.update({
        where: { id: notification.id },
        data: { status: 'FAILED' },
      });
    }

    return notification;
  }

  private async sendMerchantWebhook(
    merchant: Merchant,
    order: Order,
    outcome: string,
  ) {
    if (!merchant.webhookUrl) return;

    try {
      const response = await fetch(merchant.webhookUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Webhook-Secret': merchant.webhookSecret || '',
        },
        body: JSON.stringify({
          event: 'order.verification.completed',
          orderId: order.id,
          orderNumber: order.orderNumber,
          status: order.status,
          outcome,
          customerName: order.customerName,
          customerPhone: order.customerPhone,
          totalAmount: order.totalAmount,
          timestamp: new Date().toISOString(),
        }),
      });

      await this.prisma.notification.create({
        data: {
          merchantId: merchant.id,
          orderId: order.id,
          type: 'WEBHOOK',
          status: response.ok ? 'SENT' : 'FAILED',
          recipient: merchant.webhookUrl,
          message: `Webhook ${response.ok ? 'delivered' : 'failed'}`,
          sentAt: new Date(),
        },
      });
    } catch (error) {
      this.logger.error(`Merchant webhook failed: ${error}`);
    }
  }

  private getOutcomeText(outcome: string): string {
    const map: Record<string, string> = {
      CONFIRMED: 'নিশ্চিত',
      CANCELLED: 'বাতিল',
      ESCALATED: 'প্রতিনিধির কাছে পাঠানো',
      NO_RESPONSE: 'উত্তর নেই',
      INVALID_INPUT: 'অবৈধ ইনপুট',
    };
    return map[outcome] || outcome;
  }
}
