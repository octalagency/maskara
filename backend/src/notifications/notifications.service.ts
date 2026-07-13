import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as crypto from 'crypto';
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

    await this.pushOrderUpdate(merchant, order, {
      outcome,
      verifyStatus:
        outcome === 'CONFIRMED'
          ? 'verified'
          : outcome === 'CANCELLED'
            ? 'cancelled'
            : order.status.toLowerCase(),
      courierStatus: outcome === 'CONFIRMED' ? 'processing' : undefined,
    });
  }

  /** Push status to WooCommerce (verify, call count, courier stage). */
  async pushOrderUpdate(
    merchant: Merchant,
    order: Order,
    extra: {
      outcome?: string;
      verifyStatus?: string;
      courierStatus?: string;
    } = {},
  ) {

    const urls = new Set<string>();

    const integration = await this.prisma.integration.findFirst({
      where: { merchantId: merchant.id, type: 'WOOCOMMERCE', isActive: true },
    });
    const creds = (integration?.credentials || {}) as Record<string, string>;
    const storeUrl = (creds.storeUrl || '').replace(/\/$/, '');
    if (storeUrl) {
      urls.add(`${storeUrl}/wp-json/maskara/v1/verification-result`);
    }
    if (merchant.webhookUrl) {
      urls.add(merchant.webhookUrl.replace(/\/$/, ''));
    }

    if (urls.size === 0) {
      this.logger.warn(`No WooCommerce callback URL for merchant ${merchant.id}`);
      return;
    }

    for (const url of urls) {
      await this.postVerification(url, merchant, order, extra);
    }
  }

  private async postVerification(
    url: string,
    merchant: Merchant,
    order: Order,
    extra: {
      outcome?: string;
      verifyStatus?: string;
      courierStatus?: string;
    } = {},
  ) {
    const meta = (order.metadata || {}) as Record<string, unknown>;
    const wooOrderId = order.externalId || meta.wooOrderId;
    const secret =
      merchant.webhookSecret ||
      this.config.get<string>('WOOCOMMERCE_WEBHOOK_SECRET') ||
      '';
    const body = {
      event: 'order.verification.updated',
      orderId: order.id,
      externalId: wooOrderId ? String(wooOrderId) : undefined,
      wooOrderId: wooOrderId ? String(wooOrderId) : undefined,
      orderNumber: order.orderNumber,
      status: order.status,
      verifyStatus: extra.verifyStatus || order.status.toLowerCase(),
      outcome: extra.outcome,
      callAttempts: order.callAttempts,
      maxCallAttempts: merchant.maxCallRetries,
      courierStatus: extra.courierStatus || 'processing',
      customerName: order.customerName,
      customerPhone: order.customerPhone,
      totalAmount: order.totalAmount,
      timestamp: new Date().toISOString(),
    };
    const bodyJson = JSON.stringify(body);

    try {
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        'X-Webhook-Secret': secret,
      };
      if (secret) {
        headers['X-Maskara-Signature'] = crypto
          .createHmac('sha256', secret)
          .update(bodyJson)
          .digest('hex');
      }

      const response = await fetch(url, {
        method: 'POST',
        headers,
        body: bodyJson,
      });

      await this.prisma.notification.create({
        data: {
          merchantId: merchant.id,
          orderId: order.id,
          type: 'WEBHOOK',
          status: response.ok ? 'SENT' : 'FAILED',
          recipient: url,
          message: `Woo callback ${response.status} ${response.ok ? 'ok' : await response.text().catch(() => '')}`.slice(0, 500),
          sentAt: new Date(),
        },
      });

      if (!response.ok) {
        this.logger.error(`WooCommerce callback failed ${response.status} → ${url}`);
      } else {
        this.logger.log(`WooCommerce order updated via ${url}`);
      }
    } catch (error) {
      this.logger.error(`Merchant webhook failed: ${error}`);
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
