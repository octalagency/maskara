import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { UpdateMerchantDto } from './dto/update-merchant.dto';
import { clampSpeechRate } from '../voice/providers/bangla-prompt';

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

    return {
      ...merchant,
      voiceId,
      speechRate: clampSpeechRate(speechRate),
    };
  }

  async update(merchantId: string, dto: UpdateMerchantDto) {
    const { voiceId, speechRate, ...rest } = dto;
    const merchant = await this.prisma.merchant.update({
      where: { id: merchantId },
      data: rest,
    });

    let savedVoiceId = (merchant as { voiceId?: string | null }).voiceId ?? null;
    let savedSpeechRate =
      (merchant as { speechRate?: number | null }).speechRate ?? null;

    if (voiceId !== undefined) {
      try {
        await this.prisma.$executeRaw`
          UPDATE "Merchant" SET "voiceId" = ${voiceId} WHERE id = ${merchantId}
        `;
        savedVoiceId = voiceId;
      } catch {
        try {
          const updated = await this.prisma.merchant.update({
            where: { id: merchantId },
            data: { voiceId } as never,
          });
          savedVoiceId =
            (updated as { voiceId?: string | null }).voiceId ?? voiceId;
        } catch {
          savedVoiceId = voiceId;
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
}
