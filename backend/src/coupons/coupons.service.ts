import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { CouponType, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

export type CouponQuote = {
  code: string;
  type: CouponType;
  value: number;
  planCode: string;
  originalAmount: number;
  discountAmount: number;
  finalAmount: number;
  description: string | null;
};

@Injectable()
export class CouponsService {
  constructor(private prisma: PrismaService) {}

  normalizeCode(code: string) {
    return String(code || '')
      .trim()
      .toUpperCase()
      .replace(/\s+/g, '');
  }

  list() {
    return this.prisma.coupon.findMany({
      orderBy: { createdAt: 'desc' },
      include: {
        _count: { select: { redemptions: true } },
      },
    });
  }

  async get(id: string) {
    const coupon = await this.prisma.coupon.findUnique({
      where: { id },
      include: {
        redemptions: {
          orderBy: { createdAt: 'desc' },
          take: 50,
          include: {
            merchant: { select: { id: true, name: true, email: true } },
          },
        },
        _count: { select: { redemptions: true } },
      },
    });
    if (!coupon) throw new NotFoundException('Coupon not found');
    return coupon;
  }

  async create(body: {
    code: string;
    description?: string;
    type: CouponType | string;
    value: number;
    planCodes?: string[];
    merchantIds?: string[];
    maxRedemptions?: number | null;
    perMerchantLimit?: number;
    validFrom?: string | Date | null;
    validUntil?: string | Date | null;
    isActive?: boolean;
  }) {
    const code = this.normalizeCode(body.code);
    if (!code || code.length < 3) {
      throw new BadRequestException('Coupon code must be at least 3 characters');
    }
    const type = String(body.type || '').toUpperCase() as CouponType;
    if (type !== 'PERCENT' && type !== 'FIXED') {
      throw new BadRequestException('type must be PERCENT or FIXED');
    }
    const value = Number(body.value);
    if (!Number.isFinite(value) || value <= 0) {
      throw new BadRequestException('value must be > 0');
    }
    if (type === 'PERCENT' && value > 100) {
      throw new BadRequestException('PERCENT value cannot exceed 100');
    }

    try {
      return await this.prisma.coupon.create({
        data: {
          code,
          description: body.description?.trim() || null,
          type,
          value,
          planCodes: (body.planCodes || [])
            .map((c) => String(c).trim().toUpperCase())
            .filter(Boolean),
          merchantIds: (body.merchantIds || []).map(String).filter(Boolean),
          maxRedemptions:
            body.maxRedemptions == null || body.maxRedemptions === undefined
              ? null
              : Number(body.maxRedemptions),
          perMerchantLimit:
            body.perMerchantLimit == null
              ? 1
              : Math.max(1, Number(body.perMerchantLimit)),
          validFrom: body.validFrom ? new Date(body.validFrom) : null,
          validUntil: body.validUntil ? new Date(body.validUntil) : null,
          isActive: body.isActive !== false,
        },
      });
    } catch (e) {
      if (
        e instanceof Prisma.PrismaClientKnownRequestError &&
        e.code === 'P2002'
      ) {
        throw new BadRequestException('Coupon code already exists');
      }
      throw e;
    }
  }

  async update(
    id: string,
    body: Partial<{
      description: string | null;
      type: CouponType | string;
      value: number;
      planCodes: string[];
      merchantIds: string[];
      maxRedemptions: number | null;
      perMerchantLimit: number;
      validFrom: string | Date | null;
      validUntil: string | Date | null;
      isActive: boolean;
    }>,
  ) {
    const existing = await this.prisma.coupon.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Coupon not found');

    const data: Prisma.CouponUpdateInput = {};
    if (body.description !== undefined) {
      data.description = body.description?.trim() || null;
    }
    if (body.type !== undefined) {
      const type = String(body.type).toUpperCase() as CouponType;
      if (type !== 'PERCENT' && type !== 'FIXED') {
        throw new BadRequestException('type must be PERCENT or FIXED');
      }
      data.type = type;
    }
    if (body.value !== undefined) {
      const value = Number(body.value);
      if (!Number.isFinite(value) || value <= 0) {
        throw new BadRequestException('value must be > 0');
      }
      data.value = value;
    }
    if (body.planCodes !== undefined) {
      data.planCodes = body.planCodes
        .map((c) => String(c).trim().toUpperCase())
        .filter(Boolean);
    }
    if (body.merchantIds !== undefined) {
      data.merchantIds = body.merchantIds.map(String).filter(Boolean);
    }
    if (body.maxRedemptions !== undefined) {
      data.maxRedemptions =
        body.maxRedemptions == null ? null : Number(body.maxRedemptions);
    }
    if (body.perMerchantLimit !== undefined) {
      data.perMerchantLimit = Math.max(1, Number(body.perMerchantLimit));
    }
    if (body.validFrom !== undefined) {
      data.validFrom = body.validFrom ? new Date(body.validFrom) : null;
    }
    if (body.validUntil !== undefined) {
      data.validUntil = body.validUntil ? new Date(body.validUntil) : null;
    }
    if (body.isActive !== undefined) data.isActive = !!body.isActive;

    return this.prisma.coupon.update({ where: { id }, data });
  }

  /**
   * Validate coupon for a merchant + plan and return discounted amounts.
   * Does not consume the coupon.
   */
  async quote(
    merchantId: string,
    planCode: string,
    couponCode: string | undefined | null,
    originalAmount: number,
  ): Promise<CouponQuote | null> {
    const code = this.normalizeCode(couponCode || '');
    if (!code) return null;

    const coupon = await this.prisma.coupon.findUnique({ where: { code } });
    if (!coupon || !coupon.isActive) {
      throw new BadRequestException('Invalid or inactive coupon');
    }

    const now = new Date();
    if (coupon.validFrom && coupon.validFrom > now) {
      throw new BadRequestException('Coupon is not active yet');
    }
    if (coupon.validUntil && coupon.validUntil < now) {
      throw new BadRequestException('Coupon has expired');
    }
    if (
      coupon.maxRedemptions != null &&
      coupon.usedCount >= coupon.maxRedemptions
    ) {
      throw new BadRequestException('Coupon usage limit reached');
    }

    const plan = String(planCode || '').trim().toUpperCase();
    if (coupon.planCodes.length > 0 && !coupon.planCodes.includes(plan)) {
      throw new BadRequestException(
        `Coupon not valid for plan ${plan}`,
      );
    }
    if (
      coupon.merchantIds.length > 0 &&
      !coupon.merchantIds.includes(merchantId)
    ) {
      throw new BadRequestException('Coupon not valid for this merchant');
    }

    const usedByMerchant = await this.prisma.couponRedemption.count({
      where: { couponId: coupon.id, merchantId },
    });
    if (usedByMerchant >= coupon.perMerchantLimit) {
      throw new BadRequestException('You already used this coupon');
    }

    const original = Math.max(0, Math.round(Number(originalAmount)));
    const value = Number(coupon.value);
    let discount =
      coupon.type === 'PERCENT'
        ? Math.round((original * value) / 100)
        : Math.round(value);
    discount = Math.min(discount, original);
    const finalAmount = Math.max(0, original - discount);

    return {
      code: coupon.code,
      type: coupon.type,
      value,
      planCode: plan,
      originalAmount: original,
      discountAmount: discount,
      finalAmount,
      description: coupon.description,
    };
  }

  /** Record redemption after successful payment / free activation. */
  async redeem(
    merchantId: string,
    quote: CouponQuote,
    billingId?: string | null,
  ) {
    const coupon = await this.prisma.coupon.findUnique({
      where: { code: quote.code },
    });
    if (!coupon) throw new BadRequestException('Coupon not found');

    return this.prisma.$transaction(async (tx) => {
      const fresh = await tx.coupon.findUnique({ where: { id: coupon.id } });
      if (!fresh || !fresh.isActive) {
        throw new BadRequestException('Coupon no longer active');
      }
      if (
        fresh.maxRedemptions != null &&
        fresh.usedCount >= fresh.maxRedemptions
      ) {
        throw new BadRequestException('Coupon usage limit reached');
      }
      const usedByMerchant = await tx.couponRedemption.count({
        where: { couponId: fresh.id, merchantId },
      });
      if (usedByMerchant >= fresh.perMerchantLimit) {
        throw new BadRequestException('You already used this coupon');
      }

      // Avoid double-redeem for same billing
      if (billingId) {
        const existing = await tx.couponRedemption.findFirst({
          where: { billingId },
        });
        if (existing) return existing;
      }

      const redemption = await tx.couponRedemption.create({
        data: {
          couponId: fresh.id,
          merchantId,
          billingId: billingId || null,
          planCode: quote.planCode,
          originalAmount: quote.originalAmount,
          discountAmount: quote.discountAmount,
          finalAmount: quote.finalAmount,
        },
      });
      await tx.coupon.update({
        where: { id: fresh.id },
        data: { usedCount: { increment: 1 } },
      });
      return redemption;
    });
  }

  /** If billing has couponCode and is PAID, ensure redemption exists. */
  async redeemFromBilling(billingId: string) {
    const billing = await this.prisma.billingRecord.findUnique({
      where: { id: billingId },
    });
    if (!billing?.couponCode) return null;
    if (billing.status !== 'PAID') return null;

    const quote: CouponQuote = {
      code: this.normalizeCode(billing.couponCode),
      type: 'FIXED',
      value: Number(billing.discountAmount || 0),
      planCode: billing.planCode,
      originalAmount: Number(
        billing.originalAmount ?? billing.amount,
      ),
      discountAmount: Number(billing.discountAmount || 0),
      finalAmount: Number(billing.amount),
      description: null,
    };
    return this.redeem(billing.merchantId, quote, billing.id);
  }
}
