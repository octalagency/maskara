import { Injectable, NotFoundException } from '@nestjs/common';
import { randomBytes } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { UpdateMerchantDto } from './dto/update-merchant.dto';
import {
  clampSpeechRate,
  DEFAULT_MERCHANT_VOICE_ID,
} from '../voice/providers/bangla-prompt';

/** Auto-migrate legacy Azure নবনীতা → Chirp3 Algieba. */
function normalizeStoredVoiceId(voiceId?: string | null): string | null {
  if (voiceId == null) return null;
  if (/nabanita/i.test(voiceId)) return DEFAULT_MERCHANT_VOICE_ID;
  return voiceId;
}

@Injectable()
export class MerchantsService {
  constructor(private prisma: PrismaService) {}

  async findOne(merchantId: string) {
    const merchant = await this.prisma.merchant.findUnique({
      where: { id: merchantId },
      include: {
        subscriptions: { where: { isActive: true }, take: 1 },
        _count: { select: { orders: true, calls: true, apiKeys: true } },
      },
    });
    if (!merchant) throw new NotFoundException('Merchant not found');

    let voiceId = (merchant as { voiceId?: string | null }).voiceId ?? null;
    let speechRate =
      (merchant as { speechRate?: number | null }).speechRate ?? null;

    try {
      const rows = await this.prisma.$queryRaw<
        Array<{ voiceId: string | null; speechRate: number | null }>
      >`
        SELECT "voiceId", "speechRate" FROM "Merchant" WHERE id = ${merchantId} LIMIT 1
      `;
      if (voiceId == null) voiceId = rows[0]?.voiceId ?? null;
      if (speechRate == null && rows[0]?.speechRate != null) {
        speechRate = Number(rows[0].speechRate);
      }
    } catch {
      // columns may be missing until migrate
    }

    const normalized = normalizeStoredVoiceId(voiceId) ?? voiceId;
    if (normalized && normalized !== voiceId) {
      try {
        await this.prisma.$executeRaw`
          UPDATE "Merchant" SET "voiceId" = ${normalized} WHERE id = ${merchantId}
        `;
        voiceId = normalized;
      } catch {
        voiceId = normalized;
      }
    }

    return {
      ...merchant,
      voiceId,
      speechRate: clampSpeechRate(speechRate),
    };
  }

  async update(merchantId: string, dto: UpdateMerchantDto) {
    const { voiceId, speechRate, ...rest } = dto;

    // Keep legacy maxCallRetries in sync with lifetimeCallLimit
    if (rest.lifetimeCallLimit != null && rest.maxCallRetries == null) {
      rest.maxCallRetries = rest.lifetimeCallLimit;
    }
    if (rest.maxCallRetries != null && rest.lifetimeCallLimit == null) {
      rest.lifetimeCallLimit = rest.maxCallRetries;
    }

    const merchant = await this.prisma.merchant.update({
      where: { id: merchantId },
      data: rest,
    });

    let savedVoiceId = (merchant as { voiceId?: string | null }).voiceId ?? null;
    let savedSpeechRate =
      (merchant as { speechRate?: number | null }).speechRate ?? null;

    if (voiceId !== undefined) {
      const locked = normalizeStoredVoiceId(voiceId) || voiceId;
      try {
        await this.prisma.$executeRaw`
          UPDATE "Merchant" SET "voiceId" = ${locked} WHERE id = ${merchantId}
        `;
        savedVoiceId = locked;
      } catch {
        try {
          const updated = await this.prisma.merchant.update({
            where: { id: merchantId },
            data: { voiceId: locked } as never,
          });
          savedVoiceId =
            (updated as { voiceId?: string | null }).voiceId ?? locked;
        } catch {
          savedVoiceId = locked;
        }
      }
    }

    if (speechRate !== undefined) {
      const rate = clampSpeechRate(speechRate);
      try {
        await this.prisma.$executeRaw`
          UPDATE "Merchant" SET "speechRate" = ${rate} WHERE id = ${merchantId}
        `;
        savedSpeechRate = rate;
      } catch {
        try {
          const updated = await this.prisma.merchant.update({
            where: { id: merchantId },
            data: { speechRate: rate } as never,
          });
          savedSpeechRate =
            (updated as { speechRate?: number | null }).speechRate ?? rate;
        } catch {
          savedSpeechRate = rate;
        }
      }
    }

    return {
      ...merchant,
      voiceId: savedVoiceId,
      speechRate: clampSpeechRate(savedSpeechRate),
    };
  }

  async updateWebhookConfig(
    merchantId: string,
    webhookUrl: string,
    webhookSecret: string,
  ) {
    return this.prisma.merchant.update({
      where: { id: merchantId },
      data: { webhookUrl, webhookSecret },
    });
  }

  private makeWebhookSecret() {
    return `whsec_${randomBytes(24).toString('hex')}`;
  }

  /** Return existing webhook secret, or create one if missing. */
  async getOrCreateWebhookSecret(merchantId: string) {
    const merchant = await this.prisma.merchant.findUnique({
      where: { id: merchantId },
    });
    if (!merchant) throw new NotFoundException('Merchant not found');

    if (merchant.webhookSecret) {
      return {
        webhookSecret: merchant.webhookSecret,
        webhookUrl: merchant.webhookUrl,
        created: false,
      };
    }

    const webhookSecret = this.makeWebhookSecret();
    const updated = await this.prisma.merchant.update({
      where: { id: merchantId },
      data: { webhookSecret },
    });
    return {
      webhookSecret: updated.webhookSecret,
      webhookUrl: updated.webhookUrl,
      created: true,
    };
  }

  async regenerateWebhookSecret(merchantId: string) {
    const merchant = await this.prisma.merchant.findUnique({
      where: { id: merchantId },
    });
    if (!merchant) throw new NotFoundException('Merchant not found');

    const webhookSecret = this.makeWebhookSecret();
    const updated = await this.prisma.merchant.update({
      where: { id: merchantId },
      data: { webhookSecret },
    });
    return {
      webhookSecret: updated.webhookSecret,
      webhookUrl: updated.webhookUrl,
      created: true,
    };
  }
}
