import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateIntegrationDto } from './dto/create-integration.dto';

@Injectable()
export class IntegrationsService {
  constructor(private prisma: PrismaService) {}

  async create(merchantId: string, dto: CreateIntegrationDto) {
    return this.prisma.integration.create({
      data: {
        merchantId,
        type: dto.type,
        name: dto.name,
        credentials: dto.credentials as Prisma.InputJsonValue | undefined,
        webhookUrl: dto.webhookUrl,
      },
    });
  }

  async findAll(merchantId: string) {
    return this.prisma.integration.findMany({
      where: { merchantId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async toggle(merchantId: string, id: string) {
    const integration = await this.prisma.integration.findFirst({
      where: { id, merchantId },
    });
    if (!integration) throw new NotFoundException('Integration not found');

    return this.prisma.integration.update({
      where: { id },
      data: { isActive: !integration.isActive },
    });
  }

  async remove(merchantId: string, id: string) {
    const integration = await this.prisma.integration.findFirst({
      where: { id, merchantId },
    });
    if (!integration) throw new NotFoundException('Integration not found');

    return this.prisma.integration.delete({ where: { id } });
  }

  async connectWooCommerce(
    merchantId: string,
    data: {
      storeUrl: string;
      storeName?: string;
      wcVersion?: string;
      pluginVersion?: string;
    },
  ) {
    const credentials = {
      storeUrl: data.storeUrl.replace(/\/$/, ''),
      storeName: data.storeName || data.storeUrl,
      wcVersion: data.wcVersion,
      pluginVersion: data.pluginVersion || '1.0.0',
      connectedAt: new Date().toISOString(),
    };


    const callbackUrl = `${credentials.storeUrl}/wp-json/maskara/v1/verification-result`;
    const envSecret = process.env.WOOCOMMERCE_WEBHOOK_SECRET || '';
    const merchant = await this.prisma.merchant.findUnique({ where: { id: merchantId } });
    const secret = envSecret || merchant?.webhookSecret || '';
    await this.prisma.merchant.update({
      where: { id: merchantId },
      data: {
        webhookUrl: callbackUrl,
        ...(secret ? { webhookSecret: secret } : {}),
      },
    });

    const existing = await this.prisma.integration.findFirst({
      where: { merchantId, type: 'WOOCOMMERCE' },
    });

    if (existing) {
      const updated = await this.prisma.integration.update({
        where: { id: existing.id },
        data: {
          isActive: true,
          name: data.storeName || existing.name,
          credentials: credentials as Prisma.InputJsonValue,
          lastSyncAt: new Date(),
        },
      });
      return { ...updated, webhookSecret: secret };
    }

    const created = await this.prisma.integration.create({
      data: {
        merchantId,
        type: 'WOOCOMMERCE',
        name: data.storeName || data.storeUrl,
        credentials: credentials as Prisma.InputJsonValue,
        isActive: true,
        lastSyncAt: new Date(),
      },
    });
    return { ...created, webhookSecret: secret };
  }

  async getWooCommerceStatus(merchantId: string) {
    const integration = await this.prisma.integration.findFirst({
      where: { merchantId, type: 'WOOCOMMERCE' },
    });
    const apiUrl = (
      process.env.PUBLIC_API_URL ||
      process.env.API_URL ||
      'http://localhost:4000'
    ).replace(/\/$/, '');

    const creds = (integration?.credentials || {}) as Record<string, string>;

    return {
      connected: Boolean(integration?.isActive),
      integration: integration
        ? {
            id: integration.id,
            name: integration.name,
            isActive: integration.isActive,
            storeUrl: creds.storeUrl,
            storeName: creds.storeName,
            pluginVersion: creds.pluginVersion,
            connectedAt: creds.connectedAt,
            lastSyncAt: integration.lastSyncAt,
          }
        : null,
      apiUrl,
      webhookUrl: `${apiUrl}/webhooks/woocommerce`,
      connectUrl: `${apiUrl}/integrations/woocommerce/connect`,
      pluginVersion: '1.0.0',
    };
  }

  async disconnectWooCommerce(merchantId: string) {
    const integration = await this.prisma.integration.findFirst({
      where: { merchantId, type: 'WOOCOMMERCE' },
    });
    if (!integration) throw new NotFoundException('WooCommerce not connected');

    return this.prisma.integration.update({
      where: { id: integration.id },
      data: { isActive: false },
    });
  }

  async touchWooCommerceSync(merchantId: string) {
    const integration = await this.prisma.integration.findFirst({
      where: { merchantId, type: 'WOOCOMMERCE' },
    });
    if (integration) {
      await this.prisma.integration.update({
        where: { id: integration.id },
        data: { lastSyncAt: new Date() },
      });
    }
  }

  /** Default ShopIn → Maskara verification callback URL. */
  shopInCallbackUrl(shopId: string, override?: string) {
    if (override) return override.replace(/\/$/, '');
    const base = (
      process.env.SHOPIN_API_BASE ||
      'https://api.shopin.bd'
    ).replace(/\/$/, '');
    return `${base}/api/v1/webhooks/maskara/${shopId}`;
  }

  async connectShopIn(
    merchantId: string,
    data: {
      shopId: string;
      shopName?: string;
      callbackUrl?: string;
      webhookSecret?: string;
      storeUrl?: string;
    },
  ) {
    const shopId = data.shopId.trim();
    const callbackUrl = this.shopInCallbackUrl(shopId, data.callbackUrl);
    const merchant = await this.prisma.merchant.findUnique({
      where: { id: merchantId },
    });
    const secret =
      data.webhookSecret ||
      merchant?.webhookSecret ||
      process.env.SHOPIN_WEBHOOK_SECRET ||
      '';

    await this.prisma.merchant.update({
      where: { id: merchantId },
      data: {
        webhookUrl: callbackUrl,
        ...(secret ? { webhookSecret: secret } : {}),
      },
    });

    const credentials = {
      provider: 'shopin',
      shopId,
      shopName: data.shopName || shopId,
      storeUrl: data.storeUrl || '',
      callbackUrl,
      connectedAt: new Date().toISOString(),
    };

    const existing = await this.prisma.integration.findFirst({
      where: { merchantId, type: 'CUSTOM_API', name: { startsWith: 'ShopIn' } },
    });

    if (existing) {
      const updated = await this.prisma.integration.update({
        where: { id: existing.id },
        data: {
          isActive: true,
          name: data.shopName ? `ShopIn ${data.shopName}` : existing.name,
          credentials: credentials as Prisma.InputJsonValue,
          webhookUrl: callbackUrl,
          lastSyncAt: new Date(),
        },
      });
      return { ...updated, webhookSecret: secret, callbackUrl };
    }

    const created = await this.prisma.integration.create({
      data: {
        merchantId,
        type: 'CUSTOM_API',
        name: data.shopName ? `ShopIn ${data.shopName}` : `ShopIn ${shopId}`,
        credentials: credentials as Prisma.InputJsonValue,
        webhookUrl: callbackUrl,
        isActive: true,
        lastSyncAt: new Date(),
      },
    });
    return { ...created, webhookSecret: secret, callbackUrl };
  }

  async getShopInStatus(merchantId: string) {
    const integration = await this.prisma.integration.findFirst({
      where: {
        merchantId,
        OR: [
          { type: 'CUSTOM_API', name: { startsWith: 'ShopIn' } },
          { webhookUrl: { contains: '/webhooks/maskara/' } },
        ],
      },
      orderBy: { updatedAt: 'desc' },
    });
    const merchant = await this.prisma.merchant.findUnique({
      where: { id: merchantId },
    });
    const apiUrl = (
      process.env.PUBLIC_API_URL ||
      process.env.API_URL ||
      'http://localhost:4000'
    ).replace(/\/$/, '');
    const creds = (integration?.credentials || {}) as Record<string, string>;

    return {
      connected: Boolean(integration?.isActive),
      integration: integration
        ? {
            id: integration.id,
            name: integration.name,
            isActive: integration.isActive,
            shopId: creds.shopId,
            shopName: creds.shopName,
            storeUrl: creds.storeUrl,
            callbackUrl: creds.callbackUrl || integration.webhookUrl,
            connectedAt: creds.connectedAt,
            lastSyncAt: integration.lastSyncAt,
          }
        : null,
      apiUrl,
      inboundWebhookUrl: `${apiUrl}/webhooks/shopin`,
      connectUrl: `${apiUrl}/integrations/shopin/connect`,
      pingUrl: `${apiUrl}/integrations/shopin/ping`,
      merchantWebhookUrl: merchant?.webhookUrl || null,
    };
  }

  async disconnectShopIn(merchantId: string) {
    const integration = await this.prisma.integration.findFirst({
      where: {
        merchantId,
        OR: [
          { type: 'CUSTOM_API', name: { startsWith: 'ShopIn' } },
          { webhookUrl: { contains: '/webhooks/maskara/' } },
        ],
      },
      orderBy: { updatedAt: 'desc' },
    });
    if (!integration) throw new NotFoundException('ShopIn not connected');

    return this.prisma.integration.update({
      where: { id: integration.id },
      data: { isActive: false },
    });
  }

  async touchShopInSync(merchantId: string) {
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
  }

  /**
   * Ensure merchant callback points at ShopIn webhook (used when orders arrive
   * before an explicit connect, if shopId is present in the payload).
   */
  async ensureShopInCallback(
    merchantId: string,
    shopId: string,
    webhookSecret?: string,
  ) {
    if (!shopId) return;
    const existing = await this.prisma.integration.findFirst({
      where: {
        merchantId,
        isActive: true,
        OR: [
          { type: 'CUSTOM_API', name: { startsWith: 'ShopIn' } },
          { webhookUrl: { contains: '/webhooks/maskara/' } },
        ],
      },
    });
    if (existing) {
      await this.touchShopInSync(merchantId);
      return;
    }
    await this.connectShopIn(merchantId, {
      shopId,
      webhookSecret,
    });
  }

  getSetupGuide(type: string) {
    const guides: Record<string, object> = {
      SHOPIFY: {
        steps: [
          'Go to Shopify Admin > Settings > Notifications > Webhooks',
          'Create webhook for "Order creation" event',
          'Set URL to: POST /webhooks/shopify',
          'Add your API key in X-API-Key header',
        ],
        webhookUrl: '/webhooks/shopify',
        requiredFields: ['customer phone in order'],
      },
      WOOCOMMERCE: {
        steps: [
          'Maskara dashboard → API Keys → নতুন key তৈরি করুন',
          'WooCommerce → Plugins → Maskara Order Verification install করুন',
          'WooCommerce → Maskara → API URL + API Key দিন → Connect',
          'COD order আসলে automatic verification call যাবে',
        ],
        webhookUrl: '/webhooks/woocommerce',
        connectUrl: '/integrations/woocommerce/connect',
        requiredFields: ['billing.phone', 'COD payment method'],
        pluginPath: 'wordpress-plugin/maskara-woocommerce',
      },
      SHOPIN: {
        steps: [
          'Maskara Dashboard → API Keys → Create Key',
          'ShopIn → Maskara AI Call Center → API Key + Webhook Secret সেভ করুন',
          'API টেস্ট চাপুন (GET /integrations/shopin/ping)',
          'Connect (বা প্রথম sync) → Maskara callback = ShopIn /webhooks/maskara/{shopId}',
          'পেন্ডিং সিঙ্ক / নতুন COD → Maskara কল → confirm হলে ShopIn Pathao deploy',
        ],
        webhookUrl: '/webhooks/shopin',
        connectUrl: '/integrations/shopin/connect',
        pingUrl: '/integrations/shopin/ping',
        callbackPattern:
          'https://api.shopin.bd/api/v1/webhooks/maskara/{shopId}',
        requiredFields: [
          'orderNumber (ORD-...)',
          'customerPhone',
          'totalAmount',
        ],
      },
      CUSTOM_API: {
        steps: [
          'Send POST request to /webhooks/custom or /orders',
          'Include X-API-Key header with your API key',
          'Required fields: orderNumber, customerName, customerPhone, totalAmount',
        ],
        webhookUrl: '/webhooks/custom',
        example: {
          orderNumber: 'ORD-001',
          customerName: 'রহিম আহমেদ',
          customerPhone: '01712345678',
          totalAmount: 2500,
          paymentMethod: 'COD',
        },
      },
    };
    return guides[type] || guides.CUSTOM_API;
  }
}
