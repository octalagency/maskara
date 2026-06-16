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
    return merchant;
  }

  async update(merchantId: string, dto: UpdateMerchantDto) {
    return this.prisma.merchant.update({
      where: { id: merchantId },
      data: dto,
    });
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
