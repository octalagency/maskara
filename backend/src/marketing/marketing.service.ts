import { BadRequestException, Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { randomUUID } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';

export type MarketingPixel = {
  id: string;
  label: string;
  pixelId: string;
  testEventCode: string;
  accessToken: string;
};

export type MarketingSettings = {
  storePublicUrl: string;
  sitemapUrl: string;
  productFeedUrl: string;
  pixels: MarketingPixel[];
  eventsManagerUrl: string;
};

type StoredCreds = {
  storePublicUrl?: string;
  pixels?: MarketingPixel[];
};

@Injectable()
export class MarketingService {
  constructor(private prisma: PrismaService) {}

  private normalizeBase(url: string): string {
    return url.trim().replace(/\/+$/, '');
  }

  private buildUrls(storePublicUrl: string) {
    const base = this.normalizeBase(storePublicUrl);
    if (!base) {
      return { sitemapUrl: '', productFeedUrl: '' };
    }
    return {
      sitemapUrl: `${base}/sitemap.xml`,
      productFeedUrl: `${base}/facebook-product-feed.xml`,
    };
  }

  private async resolveDefaultStoreUrl(merchantId: string): Promise<string> {
    const merchant = await this.prisma.merchant.findUnique({
      where: { id: merchantId },
      select: { website: true },
    });
    if (merchant?.website) return this.normalizeBase(merchant.website);

    const integrations = await this.prisma.integration.findMany({
      where: { merchantId, isActive: true },
      orderBy: { createdAt: 'desc' },
    });
    for (const i of integrations) {
      const creds = (i.credentials || {}) as Record<string, string>;
      const url = creds.storeUrl || creds.callbackUrl || '';
      if (creds.provider === 'shopin' && creds.storeUrl) {
        return this.normalizeBase(creds.storeUrl);
      }
      if (i.type === 'WOOCOMMERCE' && creds.storeUrl) {
        return this.normalizeBase(creds.storeUrl);
      }
      // ShopIn storefront often in credentials.storeUrl / shop domain
      if (url && !url.includes('/webhooks/')) {
        try {
          return this.normalizeBase(new URL(url).origin);
        } catch {
          /* ignore */
        }
      }
    }
    return '';
  }

  private async getFacebookRow(merchantId: string) {
    return this.prisma.integration.findFirst({
      where: { merchantId, type: 'FACEBOOK' },
      orderBy: { createdAt: 'desc' },
    });
  }

  async getSettings(merchantId: string): Promise<MarketingSettings> {
    const row = await this.getFacebookRow(merchantId);
    const creds = (row?.credentials || {}) as StoredCreds;
    const storePublicUrl =
      this.normalizeBase(creds.storePublicUrl || '') ||
      (await this.resolveDefaultStoreUrl(merchantId));
    const urls = this.buildUrls(storePublicUrl);
    const pixels = Array.isArray(creds.pixels)
      ? creds.pixels.map((p) => ({
          id: p.id || randomUUID(),
          label: String(p.label || p.pixelId || ''),
          pixelId: String(p.pixelId || ''),
          testEventCode: String(p.testEventCode || ''),
          accessToken: String(p.accessToken || ''),
        }))
      : [];

    return {
      storePublicUrl,
      ...urls,
      pixels,
      eventsManagerUrl: 'https://business.facebook.com/events_manager2',
    };
  }

  async updateSettings(
    merchantId: string,
    body: {
      storePublicUrl?: string;
      pixels?: Array<{
        id?: string;
        label?: string;
        pixelId?: string;
        testEventCode?: string;
        accessToken?: string;
      }>;
    },
  ): Promise<MarketingSettings> {
    const current = await this.getSettings(merchantId);
    const storePublicUrl = this.normalizeBase(
      body.storePublicUrl ?? current.storePublicUrl,
    );

    if (storePublicUrl) {
      try {
        const u = new URL(storePublicUrl);
        if (!/^https?:$/i.test(u.protocol)) {
          throw new Error('bad protocol');
        }
      } catch {
        throw new BadRequestException('স্টোর URL সঠিক নয় (https://…)');
      }
    }

    const pixels: MarketingPixel[] = (body.pixels ?? current.pixels).map(
      (p) => ({
        id: p.id || randomUUID(),
        label: String(p.label || p.pixelId || '').trim(),
        pixelId: String(p.pixelId || '').trim(),
        testEventCode: String(p.testEventCode || '').trim(),
        accessToken: String(p.accessToken || '').trim(),
      }),
    );

    for (const p of pixels) {
      if (p.pixelId && !/^\d{5,20}$/.test(p.pixelId)) {
        throw new BadRequestException(
          `Pixel ID অবৈধ: ${p.pixelId} — শুধু সংখ্যা দিন`,
        );
      }
    }

    const credentials: StoredCreds = { storePublicUrl, pixels };
    const existing = await this.getFacebookRow(merchantId);
    if (existing) {
      await this.prisma.integration.update({
        where: { id: existing.id },
        data: {
          name: 'Facebook & Marketing',
          isActive: true,
          credentials: credentials as Prisma.InputJsonValue,
        },
      });
    } else {
      await this.prisma.integration.create({
        data: {
          merchantId,
          type: 'FACEBOOK',
          name: 'Facebook & Marketing',
          isActive: true,
          credentials: credentials as Prisma.InputJsonValue,
        },
      });
    }

    return this.getSettings(merchantId);
  }
}
