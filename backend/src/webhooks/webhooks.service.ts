import { Injectable, BadRequestException } from '@nestjs/common';
import { Prisma, OrderStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { OrdersService } from '../orders/orders.service';
import { CreateOrderDto } from '../orders/dto/create-order.dto';

const WOO_CANCEL_STATUSES = new Set(['cancelled', 'refunded', 'failed']);

function normalizeWooStatus(raw: unknown): string {
  const s = String(raw ?? '')
    .trim()
    .toLowerCase()
    .replace(/^wc-/, '');
  return s;
}

function stripOrderNumberHash(raw: string): string {
  return String(raw || '').trim().replace(/^#/, '');
}

function defaultShopInCallbackUrl(shopId: string): string {
  const base = (process.env.SHOPIN_API_BASE || 'https://api.shopin.bd').replace(/\/$/, '');
  return `${base}/api/v1/webhooks/maskara/${shopId}`;
}

@Injectable()
export class WebhooksService {
  constructor(
    private prisma: PrismaService,
    private ordersService: OrdersService,
  ) {}

  async handleShopifyWebhook(merchantId: string, payload: Record<string, unknown>) {
    const orderData: CreateOrderDto = {
      externalId: String(payload.id),
      orderNumber: (payload.name as string) || `#${payload.order_number}`,
      customerName: this.extractShopifyCustomerName(payload),
      customerPhone: this.extractShopifyPhone(payload),
      customerEmail: (payload.email as string) || undefined,
      totalAmount: parseFloat(payload.total_price as string) || 0,
      currency: (payload.currency as string) || 'BDT',
      items: (payload.line_items as Record<string, unknown>[]) || [],
      shippingAddress: payload.shipping_address as Record<string, unknown>,
      paymentMethod: this.extractShopifyPaymentMethod(payload),
      source: 'SHOPIFY',
      metadata: {
        shopifyOrderId: String(payload.id),
        financialStatus: String(payload.financial_status ?? ''),
      },
    };

    if (!orderData.customerPhone) {
      throw new BadRequestException('Customer phone number required for verification');
    }

    return this.ordersService.create(merchantId, orderData);
  }

  async handleWooCommerceWebhook(merchantId: string, payload: Record<string, unknown>) {
    const externalId = String(payload.id);
    const wooStatus = normalizeWooStatus(payload.status);

    const existing = await this.prisma.order.findFirst({
      where: { merchantId, externalId, source: 'WOOCOMMERCE' },
    });

    if (existing) {
      if (WOO_CANCEL_STATUSES.has(wooStatus) && existing.status !== 'CANCELLED') {
        const prevMeta =
          existing.metadata && typeof existing.metadata === 'object' && !Array.isArray(existing.metadata)
            ? (existing.metadata as Record<string, unknown>)
            : {};
        const cancelled = await this.prisma.order.update({
          where: { id: existing.id },
          data: {
            status: 'CANCELLED' as OrderStatus,
            cancelledAt: new Date(),
            nextCallAt: null,
            metadata: {
              ...prevMeta,
              wooOrderId: String(payload.id),
              status: String(payload.status ?? ''),
              wooStatus,
              cancelledFromWebsite: true,
            } as Prisma.InputJsonValue,
          },
        });
        return { received: true, cancelled: true, order: cancelled };
      }

      if (payload.status != null) {
        const prevMeta =
          existing.metadata && typeof existing.metadata === 'object' && !Array.isArray(existing.metadata)
            ? (existing.metadata as Record<string, unknown>)
            : {};
        const updated = await this.prisma.order.update({
          where: { id: existing.id },
          data: {
            metadata: {
              ...prevMeta,
              wooOrderId: String(payload.id),
              status: String(payload.status ?? ''),
              wooStatus,
            } as Prisma.InputJsonValue,
          },
        });
        return { received: true, duplicate: true, order: updated };
      }

      return { received: true, duplicate: true, order: existing };
    }

    if (WOO_CANCEL_STATUSES.has(wooStatus)) {
      return { received: true, ignored: true, reason: 'cancel_without_existing_order' };
    }

    await this.prisma.integration.updateMany({
      where: { merchantId, type: 'WOOCOMMERCE', isActive: true },
      data: { lastSyncAt: new Date() },
    });

    const billing = payload.billing as Record<string, string>;
    const orderData: CreateOrderDto = {
      externalId: String(payload.id),
      orderNumber: `#${payload.number || payload.id}`,
      customerName: `${billing?.first_name || ''} ${billing?.last_name || ''}`.trim() || 'Customer',
      customerPhone: billing?.phone || '',
      customerEmail: billing?.email,
      totalAmount: parseFloat(payload.total as string) || 0,
      currency: (payload.currency as string) || 'BDT',
      items: (payload.line_items as Record<string, unknown>[]) || [],
      shippingAddress: payload.shipping as Record<string, unknown>,
      paymentMethod: (payload.payment_method_title as string) || 'COD',
      source: 'WOOCOMMERCE',
      metadata: { wooOrderId: String(payload.id), status: String(payload.status ?? '') },
    };

    if (!orderData.customerPhone) {
      throw new BadRequestException('Customer phone number required for verification');
    }

    return this.ordersService.create(merchantId, orderData);
  }

  /**
   * ShopIn → Maskara inbound order.
   * Keeps orderNumber as ShopIn ORD-… (no # prefix) so confirm callback matches.
   */
  async handleShopInWebhook(merchantId: string, payload: Record<string, unknown>) {
    const orderData = this.normalizeShopInPayload(payload);

    if (!orderData.customerPhone) {
      throw new BadRequestException('Customer phone number required for verification');
    }
    if (!orderData.orderNumber) {
      throw new BadRequestException('orderNumber required');
    }

    const shopId = String(
      (orderData.metadata as Record<string, unknown>)?.shopId || payload.shopId || '',
    );
    if (shopId) {
      await this.ensureShopInMerchantCallback(merchantId, shopId);
    }

    const externalId = orderData.externalId || orderData.orderNumber;
    const existing = await this.prisma.order.findFirst({
      where: {
        merchantId,
        OR: [
          ...(externalId ? [{ externalId }] : []),
          { orderNumber: orderData.orderNumber },
        ],
      },
    });

    if (existing) {
      const status = String(payload.status || payload.orderStatus || '').toLowerCase();
      if (
        (status === 'cancelled' || status === 'canceled' || status === 'cancel') &&
        existing.status !== 'CANCELLED'
      ) {
        const cancelled = await this.prisma.order.update({
          where: { id: existing.id },
          data: {
            status: 'CANCELLED',
            cancelledAt: new Date(),
            nextCallAt: null,
          },
        });
        return { received: true, cancelled: true, order: cancelled };
      }
      return { received: true, duplicate: true, order: existing };
    }

    await this.prisma.integration.updateMany({
      where: {
        merchantId,
        isActive: true,
        OR: [
          { type: 'CUSTOM_API', name: { startsWith: 'ShopIn' } },
          { webhookUrl: { contains: '/webhooks/maskara/' } },
        ],
      },
      data: { lastSyncAt: new Date() },
    });

    const order = await this.ordersService.create(merchantId, {
      ...orderData,
      externalId,
      source: 'CUSTOM_API',
    });
    return { received: true, order };
  }

  private async ensureShopInMerchantCallback(merchantId: string, shopId: string) {
    const callbackUrl = defaultShopInCallbackUrl(shopId);
    const merchant = await this.prisma.merchant.findUnique({ where: { id: merchantId } });
    if (!merchant) return;

    const needsUrl =
      !merchant.webhookUrl ||
      !merchant.webhookUrl.includes('/webhooks/maskara/');
    if (needsUrl) {
      await this.prisma.merchant.update({
        where: { id: merchantId },
        data: { webhookUrl: callbackUrl },
      });
    }

    const existing = await this.prisma.integration.findFirst({
      where: {
        merchantId,
        OR: [
          { type: 'CUSTOM_API', name: { startsWith: 'ShopIn' } },
          { webhookUrl: { contains: '/webhooks/maskara/' } },
        ],
      },
    });
    const credentials = {
      provider: 'shopin',
      shopId,
      shopName: existing?.name || `ShopIn ${shopId}`,
      callbackUrl,
      connectedAt: new Date().toISOString(),
    };

    if (existing) {
      await this.prisma.integration.update({
        where: { id: existing.id },
        data: {
          isActive: true,
          credentials: credentials as Prisma.InputJsonValue,
          webhookUrl: callbackUrl,
          lastSyncAt: new Date(),
        },
      });
    } else {
      await this.prisma.integration.create({
        data: {
          merchantId,
          type: 'CUSTOM_API',
          name: `ShopIn ${shopId}`,
          credentials: credentials as Prisma.InputJsonValue,
          webhookUrl: callbackUrl,
          isActive: true,
          lastSyncAt: new Date(),
        },
      });
    }
  }

  private normalizeShopInPayload(payload: Record<string, unknown>): CreateOrderDto {
    const customer =
      (payload.customer as Record<string, unknown>) ||
      (payload.billing as Record<string, unknown>) ||
      {};

    const orderNumber = stripOrderNumberHash(
      String(
        payload.orderNumber ||
          payload.order_number ||
          payload.number ||
          payload.code ||
          '',
      ),
    );

    const phone = String(
      payload.customerPhone ||
        payload.customer_phone ||
        customer.phone ||
        customer.mobile ||
        '',
    );

    const name = String(
      payload.customerName ||
        payload.customer_name ||
        [customer.first_name || customer.firstName, customer.last_name || customer.lastName]
          .filter(Boolean)
          .join(' ') ||
        customer.name ||
        'Customer',
    ).trim();

    const totalRaw =
      payload.totalAmount ?? payload.total_amount ?? payload.total ?? payload.grandTotal ?? 0;
    const totalAmount =
      typeof totalRaw === 'number' ? totalRaw : parseFloat(String(totalRaw)) || 0;

    const shipping =
      (payload.shippingAddress as Record<string, unknown>) ||
      (payload.shipping_address as Record<string, unknown>) ||
      (payload.shipping as Record<string, unknown>) ||
      (payload.address as Record<string, unknown>);

    const items =
      (payload.items as Record<string, unknown>[]) ||
      (payload.line_items as Record<string, unknown>[]) ||
      (payload.lineItems as Record<string, unknown>[]) ||
      [];

    const shopId = String(payload.shopId || payload.shop_id || '');
    const externalId = String(
      payload.externalId || payload.external_id || payload.id || orderNumber,
    );

    return {
      orderNumber,
      externalId,
      customerName: name || 'Customer',
      customerPhone: phone,
      customerEmail:
        String(payload.customerEmail || payload.customer_email || customer.email || '') ||
        undefined,
      totalAmount,
      currency: String(payload.currency || 'BDT'),
      items,
      shippingAddress: shipping,
      paymentMethod: String(
        payload.paymentMethod ||
          payload.payment_method ||
          payload.payment_method_title ||
          'COD',
      ),
      notes: payload.notes ? String(payload.notes) : undefined,
      source: 'CUSTOM_API',
      metadata: {
        provider: 'shopin',
        shopId: shopId || undefined,
        shopinOrderId: externalId,
        rawStatus: payload.status ?? payload.orderStatus,
      },
    };
  }

  async handleCustomWebhook(merchantId: string, payload: CreateOrderDto) {
    return this.ordersService.create(merchantId, payload);
  }

  async handleBySlug(merchantSlug: string, secret: string, payload: CreateOrderDto) {
    const merchant = await this.prisma.merchant.findUnique({
      where: { slug: merchantSlug },
    });

    if (!merchant || merchant.webhookSecret !== secret) {
      throw new BadRequestException('Invalid webhook');
    }

    return this.handleCustomWebhook(merchant.id, payload);
  }

  private extractShopifyCustomerName(payload: Record<string, unknown>): string {
    const customer = payload.customer as Record<string, string>;
    if (customer) {
      return `${customer.first_name || ''} ${customer.last_name || ''}`.trim();
    }
    const shipping = payload.shipping_address as Record<string, string>;
    if (shipping) {
      return `${shipping.first_name || ''} ${shipping.last_name || ''}`.trim();
    }
    return 'Customer';
  }

  private extractShopifyPhone(payload: Record<string, unknown>): string {
    const customer = payload.customer as Record<string, string>;
    if (customer?.phone) return customer.phone;

    const shipping = payload.shipping_address as Record<string, string>;
    if (shipping?.phone) return shipping.phone;

    const billing = payload.billing_address as Record<string, string>;
    if (billing?.phone) return billing.phone;

    return '';
  }

  private extractShopifyPaymentMethod(payload: Record<string, unknown>): string {
    const gateways = payload.payment_gateway_names as string[];
    if (gateways?.length) return gateways[0];
    return (payload.financial_status as string) === 'pending' ? 'COD' : 'Paid';
  }
}
