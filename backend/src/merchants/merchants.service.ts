import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { UpdateMerchantDto } from './dto/update-merchant.dto';

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

    // Ensure voiceId is present even if Prisma client types are stale
    let voiceId = (merchant as { voiceId?: string | null }).voiceId ?? null;
    if (voiceId == null) {
      try {
        const rows = await this.prisma.$queryRaw<Array<{ voiceId: string | null }>>`
          SELECT "voiceId" FROM "Merchant" WHERE id = ${merchantId} LIMIT 1
        `;
        voiceId = rows[0]?.voiceId ?? null;
      } catch {
        voiceId = null;
      }
    }
    return { ...merchant, voiceId };
  }

  async update(merchantId: string, dto: UpdateMerchantDto) {
    const { voiceId, ...rest } = dto;
    const merchant = await this.prisma.merchant.update({
      where: { id: merchantId },
      data: rest,
    });

    let savedVoiceId = (merchant as { voiceId?: string | null }).voiceId ?? null;
    if (voiceId !== undefined) {
      try {
        await this.prisma.$executeRaw`
          UPDATE "Merchant" SET "voiceId" = ${voiceId} WHERE id = ${merchantId}
        `;
        savedVoiceId = voiceId;
      } catch {
        // Column may be missing until migrate; still try Prisma field if available
        try {
          const updated = await this.prisma.merchant.update({
            where: { id: merchantId },
            data: { voiceId } as never,
          });
          savedVoiceId = (updated as { voiceId?: string | null }).voiceId ?? voiceId;
        } catch {
          savedVoiceId = voiceId;
        }
      }
    }

    return { ...merchant, voiceId: savedVoiceId };
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
