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
  brandName: string;
  storePublicUrl: string;
  sitemapUrl: string;
  productFeedUrl: string;
  pixels: MarketingPixel[];
  eventsManagerUrl: string;
};

type StoredValue = {
  storePublicUrl?: string;
  pixels?: MarketingPixel[];
};

const SETTING_KEY = 'platform_marketing';
const DEFAULT_BRAND = 'Maskara';
const DEFAULT_PUBLIC_URL = 'https://maskara.bd';

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

  private normalizePixels(raw: unknown): MarketingPixel[] {
    if (!Array.isArray(raw)) return [];
    return raw.map((p) => {
      const row = (p || {}) as MarketingPixel;
      return {
        id: row.id || randomUUID(),
        label: String(row.label || row.pixelId || ''),
        pixelId: String(row.pixelId || ''),
        testEventCode: String(row.testEventCode || ''),
        accessToken: String(row.accessToken || ''),
      };
    });
  }

  async getPlatformSettings(): Promise<MarketingSettings> {
    const row = await this.prisma.systemSetting.findUnique({
      where: { key: SETTING_KEY },
    });
    const stored = (row?.value || {}) as StoredValue;
    const storePublicUrl =
      this.normalizeBase(stored.storePublicUrl || '') || DEFAULT_PUBLIC_URL;
    const urls = this.buildUrls(storePublicUrl);

    return {
      brandName: DEFAULT_BRAND,
      storePublicUrl,
      ...urls,
      pixels: this.normalizePixels(stored.pixels),
      eventsManagerUrl: 'https://business.facebook.com/events_manager2',
    };
  }

  async updatePlatformSettings(body: {
    storePublicUrl?: string;
    pixels?: Array<{
      id?: string;
      label?: string;
      pixelId?: string;
      testEventCode?: string;
      accessToken?: string;
    }>;
  }): Promise<MarketingSettings> {
    const current = await this.getPlatformSettings();
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
        throw new BadRequestException('সাইট URL সঠিক নয় (https://…)');
      }
    }

    const pixels: MarketingPixel[] = (
      body.pixels ?? current.pixels
    ).map((p) => ({
      id: p.id || randomUUID(),
      label: String(p.label || p.pixelId || '').trim(),
      pixelId: String(p.pixelId || '').trim(),
      testEventCode: String(p.testEventCode || '').trim(),
      accessToken: String(p.accessToken || '').trim(),
    }));

    for (const p of pixels) {
      if (p.pixelId && !/^\d{5,20}$/.test(p.pixelId)) {
        throw new BadRequestException(
          `Pixel ID অবৈধ: ${p.pixelId} — শুধু সংখ্যা দিন`,
        );
      }
    }

    const value: StoredValue = { storePublicUrl, pixels };
    await this.prisma.systemSetting.upsert({
      where: { key: SETTING_KEY },
      create: {
        key: SETTING_KEY,
        value: value as Prisma.InputJsonValue,
      },
      update: {
        value: value as Prisma.InputJsonValue,
      },
    });

    return this.getPlatformSettings();
  }
}
