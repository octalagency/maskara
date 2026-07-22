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

  /** Push verification status to WooCommerce / ShopIn / merchant webhookUrl. */
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

    const integrations = await this.prisma.integration.findMany({
      where: {
        merchantId: merchant.id,
        isActive: true,
      },
    });

    for (const integration of integrations) {
      const creds = (integration.credentials || {}) as Record<string, string>;
      if (integration.type === 'WOOCOMMERCE') {
        const storeUrl = (creds.storeUrl || '').replace(/\/$/, '');
        if (storeUrl) {
          urls.add(`${storeUrl}/wp-json/maskara/v1/verification-result`);
        }
      }
      const isShopIn =
        creds.provider === 'shopin' ||
        (integration.webhookUrl || '').includes('/webhooks/maskara/') ||
        (creds.callbackUrl || '').includes('/webhooks/maskara/') ||
        (integration.name || '').startsWith('ShopIn');
      if (isShopIn) {
        const callback =
          (creds.callbackUrl || integration.webhookUrl || '').replace(/\/$/, '');
        if (callback) {
          urls.add(callback);
        } else if (creds.shopId) {
          const base = (
            this.config.get<string>('SHOPIN_API_BASE') || 'https://api.shopin.bd'
          ).replace(/\/$/, '');
          urls.add(`${base}/api/v1/webhooks/maskara/${creds.shopId}`);
        }
      }
    }

    if (merchant.webhookUrl) {
      urls.add(merchant.webhookUrl.replace(/\/$/, ''));
    }

    if (urls.size === 0) {
      this.logger.warn(`No verification callback URL for merchant ${merchant.id}`);
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
    const externalId = order.externalId || meta.wooOrderId || meta.shopinOrderId;
    const isShopIn =
      url.includes('/webhooks/maskara/') ||
      meta.provider === 'shopin' ||
      Boolean(meta.shopId);
    // ShopIn matches on orderNumber (ORD-…); strip leading # if any
    const orderNumber = isShopIn
      ? String(order.orderNumber || '').replace(/^#/, '')
      : order.orderNumber;

    const secret =
      merchant.webhookSecret ||
      this.config.get<string>('WOOCOMMERCE_WEBHOOK_SECRET') ||
      this.config.get<string>('SHOPIN_WEBHOOK_SECRET') ||
      '';
    const body = {
      event: 'order.verification.updated',
      orderId: order.id,
      externalId: externalId ? String(externalId) : undefined,
      wooOrderId: !isShopIn && externalId ? String(externalId) : undefined,
      orderNumber,
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

      const label = isShopIn ? 'ShopIn' : 'Woo';
      await this.prisma.notification.create({
        data: {
          merchantId: merchant.id,
          orderId: order.id,
          type: 'WEBHOOK',
          status: response.ok ? 'SENT' : 'FAILED',
          recipient: url,
          message: `${label} callback ${response.status} ${response.ok ? 'ok' : await response.text().catch(() => '')}`.slice(0, 500),
          sentAt: new Date(),
        },
      });

      if (!response.ok) {
        this.logger.error(`${label} callback failed ${response.status} → ${url}`);
      } else {
        this.logger.log(`${label} order updated via ${url}`);
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
