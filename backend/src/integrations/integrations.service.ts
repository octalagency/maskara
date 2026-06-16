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

    const existing = await this.prisma.integration.findFirst({
      where: { merchantId, type: 'WOOCOMMERCE' },
    });

    if (existing) {
      return this.prisma.integration.update({
        where: { id: existing.id },
        data: {
          isActive: true,
          name: data.storeName || existing.name,
          credentials: credentials as Prisma.InputJsonValue,
          lastSyncAt: new Date(),
        },
      });
    }

    return this.prisma.integration.create({
      data: {
        merchantId,
        type: 'WOOCOMMERCE',
        name: data.storeName || data.storeUrl,
        credentials: credentials as Prisma.InputJsonValue,
        isActive: true,
        lastSyncAt: new Date(),
      },
    });
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
