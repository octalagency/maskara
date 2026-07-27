import { Injectable, BadRequestException, Logger } from '@nestjs/common';
import { Prisma, OrderStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { OrdersService } from '../orders/orders.service';
import { CreateOrderDto } from '../orders/dto/create-order.dto';

/** Hide from Maskara totals — store admin cancelled / trashed / deleted */
const WOO_EXCLUDE_STATUSES = new Set([
  'cancelled',
  'canceled',
  'refunded',
  'failed',
  'trash',
  'deleted',
]);

/** Merchant confirmed on website — Manual Complete, no AI call */
const WOO_MANUAL_COMPLETE_STATUSES = new Set([
  'completed',
  'complete',
]);

/**
 * For an order Maskara already dials — these WC statuses mean staff managed it on the site.
 * Do NOT use on create (COD often arrives as processing).
 */
const WOO_EXISTING_MANAGED_STATUSES = new Set([
  'completed',
  'complete',
  'processing',
]);

const SHOPIN_EXCLUDE_STATUSES = new Set([
  'cancelled',
  'canceled',
  'cancel',
  'deleted',
  'trash',
  'trashed',
  'rejected',
]);

/**
 * ShopIn Staff confirmed — Manual Complete on an *existing* Maskara order.
 * Includes mid-fulfillment tabs (processing, packed, …).
 */
const SHOPIN_EXISTING_MANUAL_COMPLETE_STATUSES = new Set([
  'completed',
  'complete',
  'confirmed',
  'confirm',
  'delivered',
  'success',
  'manual_complete',
  'manual-complete',
  'pickup_pending',
  'pickuppending',
  'ready_for_delivery',
  'readyfordelivery',
  'in_transit',
  'intransit',
  'processing',
  'courier_assigned',
  'courierassigned',
  'shipped',
  'packed',
]);

/**
 * On *create* only — never treat COD "processing" as already confirmed
 * (same pitfall as WooCommerce; would skip the AI call).
 */
const SHOPIN_CREATE_SKIP_CALL_STATUSES = new Set([
  'completed',
  'complete',
  'confirmed',
  'confirm',
  'delivered',
  'success',
  'manual_complete',
  'manual-complete',
]);

function normalizeShopInStatus(raw: unknown): string {
  return String(raw ?? '')
    .trim()
    .toLowerCase()
    .replace(/[\s-]+/g, '_')
    .replace(/_+/g, '_');
}

function extractShopInStatus(payload: Record<string, unknown>): string {
  const candidates = [
    payload.status,
    payload.orderStatus,
    payload.order_status,
    payload.currentStatus,
    payload.current_status,
    payload.fulfillmentStatus,
    payload.fulfillment_status,
    (payload.order as Record<string, unknown> | undefined)?.status,
    (payload.data as Record<string, unknown> | undefined)?.status,
  ];
  for (const c of candidates) {
    const n = normalizeShopInStatus(c);
    if (n) return n;
  }
  return '';
}

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

function mergeMeta(
  existing: unknown,
  extra: Record<string, unknown>,
): Prisma.InputJsonValue {
  const prev =
    existing && typeof existing === 'object' && !Array.isArray(existing)
      ? (existing as Record<string, unknown>)
      : {};
  return { ...prev, ...extra } as Prisma.InputJsonValue;
}

@Injectable()
export class WebhooksService {
  private readonly logger = new Logger(WebhooksService.name);

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
      if (WOO_EXCLUDE_STATUSES.has(wooStatus) && !existing.excludedFromStats) {
        const cancelled = await this.prisma.order.update({
          where: { id: existing.id },
          data: {
            status: 'CANCELLED' as OrderStatus,
            cancelledAt: new Date(),
            nextCallAt: null,
            excludedFromStats: true,
            metadata: mergeMeta(existing.metadata, {
              wooOrderId: String(payload.id),
              status: String(payload.status ?? ''),
              wooStatus,
              cancelledFromWebsite: true,
              ...(wooStatus === 'trash' || wooStatus === 'deleted'
                ? { deletedFromWebsite: true, trashedFromWebsite: wooStatus === 'trash' }
                : {}),
            }),
          },
        });
        return { received: true, excluded: true, order: cancelled };
      }

      if (
        (WOO_MANUAL_COMPLETE_STATUSES.has(wooStatus) ||
          WOO_EXISTING_MANAGED_STATUSES.has(wooStatus)) &&
        !['VERIFIED', 'CANCELLED'].includes(existing.status)
      ) {
        const completed = await this.ordersService.markManualCompleteFromWebsite(
          merchantId,
          existing.id,
          {
            wooOrderId: String(payload.id),
            status: String(payload.status ?? ''),
            wooStatus,
            updateSource: 'woocommerce_webhook',
          },
        );
        return { received: true, manualComplete: true, order: completed };
      }

      if (payload.status != null) {
        const updated = await this.prisma.order.update({
          where: { id: existing.id },
          data: {
            metadata: mergeMeta(existing.metadata, {
              wooOrderId: String(payload.id),
              status: String(payload.status ?? ''),
              wooStatus,
            }),
          },
        });
        return { received: true, duplicate: true, order: updated };
      }

      return { received: true, duplicate: true, order: existing };
    }

    if (WOO_EXCLUDE_STATUSES.has(wooStatus)) {
      return { received: true, ignored: true, reason: 'exclude_without_existing_order' };
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
      metadata: {
        wooOrderId: String(payload.id),
        status: String(payload.status ?? ''),
        wooStatus,
      },
    };

    if (!orderData.customerPhone) {
      throw new BadRequestException('Customer phone number required for verification');
    }

    if (WOO_MANUAL_COMPLETE_STATUSES.has(wooStatus)) {
      return this.ordersService.create(merchantId, orderData, {
        skipCall: true,
        initialStatus: 'VERIFIED',
        manualComplete: true,
      });
    }

    return this.ordersService.create(merchantId, orderData);
  }

  /**
   * ShopIn → Maskara inbound order / status sync.
   * Status-only updates (Staff confirm on ShopIn) may omit phone — allow when order exists.
   */
  async handleShopInWebhook(merchantId: string, payload: Record<string, unknown>) {
    const orderData = this.normalizeShopInPayload(payload);
    const status = extractShopInStatus(payload);
    const externalId = orderData.externalId || orderData.orderNumber;

    this.logger.log(
      `ShopIn webhook merchant=${merchantId} order=${orderData.orderNumber || externalId || '?'} status=${status || '(none)'} keys=${Object.keys(payload || {}).join(',')}`,
    );

    const shopId = String(
      (orderData.metadata as Record<string, unknown>)?.shopId || payload.shopId || '',
    );
    if (shopId) {
      await this.ensureShopInMerchantCallback(merchantId, shopId);
    }

    if (!orderData.orderNumber && !externalId) {
      throw new BadRequestException('orderNumber required');
    }

    const existing = await this.prisma.order.findFirst({
      where: {
        merchantId,
        OR: [
          ...(externalId ? [{ externalId: String(externalId) }] : []),
          ...(orderData.orderNumber ? [{ orderNumber: orderData.orderNumber }] : []),
        ],
      },
    });

    // Existing order: status sync from ShopIn Staff / website manage (phone optional)
    if (existing) {
      if (SHOPIN_EXCLUDE_STATUSES.has(status)) {
        const cancelled = await this.ordersService.markCancelledFromWebsite(
          merchantId,
          existing.id,
          {
            shopInStatus: status,
            updateSource: 'shopin_webhook',
            provider: 'shopin',
          },
        );
        return { received: true, excluded: true, order: cancelled };
      }

      if (
        SHOPIN_EXISTING_MANUAL_COMPLETE_STATUSES.has(status) &&
        !['VERIFIED', 'CANCELLED'].includes(existing.status)
      ) {
        const completed = await this.ordersService.markManualCompleteFromWebsite(
          merchantId,
          existing.id,
          {
            shopInStatus: status,
            updateSource: 'shopin_webhook',
            provider: 'shopin',
            staffConfirm: true,
          },
        );
        return { received: true, manualComplete: true, order: completed };
      }

      // Status present but not finalize — store latest ShopIn status only
      if (status) {
        const updated = await this.prisma.order.update({
          where: { id: existing.id },
          data: {
            metadata: mergeMeta(existing.metadata, {
              shopInStatus: status,
              lastShopInWebhookAt: new Date().toISOString(),
            }),
          },
        });
        return { received: true, duplicate: true, statusRecorded: status, order: updated };
      }

      return { received: true, duplicate: true, order: existing };
    }

    // New order — phone required for AI verification dial
    if (!orderData.customerPhone) {
      throw new BadRequestException('Customer phone number required for verification');
    }
    if (!orderData.orderNumber) {
      throw new BadRequestException('orderNumber required');
    }

    if (SHOPIN_EXCLUDE_STATUSES.has(status)) {
      return { received: true, ignored: true, reason: 'exclude_without_existing_order' };
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

    if (SHOPIN_CREATE_SKIP_CALL_STATUSES.has(status)) {
      const order = await this.ordersService.create(
        merchantId,
        { ...orderData, externalId, source: 'CUSTOM_API' },
        { skipCall: true, initialStatus: 'VERIFIED', manualComplete: true },
      );
      return { received: true, manualComplete: true, order };
    }

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

    // Prefer the integration row for THIS shopId — never overwrite another ShopIn shop
    const integrations = await this.prisma.integration.findMany({
      where: {
        merchantId,
        OR: [
          { type: 'CUSTOM_API', name: { startsWith: 'ShopIn' } },
          { webhookUrl: { contains: '/webhooks/maskara/' } },
        ],
      },
    });
    const existing =
      integrations.find((i) => {
        const c = (i.credentials || {}) as Record<string, unknown>;
        return String(c.shopId || '') === shopId;
      }) ||
      integrations.find((i) => (i.webhookUrl || '').includes(`/webhooks/maskara/${shopId}`)) ||
      null;

    const credentials = {
      provider: 'shopin',
      shopId,
      shopName:
        ((existing?.credentials || {}) as Record<string, unknown>).shopName ||
        existing?.name ||
        `ShopIn ${shopId}`,
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
        rawStatus: payload.status ?? payload.orderStatus ?? payload.order_status,
        shopInStatus: extractShopInStatus(payload) || undefined,
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
