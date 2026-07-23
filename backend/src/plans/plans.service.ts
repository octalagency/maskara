import { Injectable, OnModuleInit } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

const DEFAULT_PLANS = [
  {
    code: 'FREE',
    name: 'Free Trial',
    nameBangla: 'ফ্রি ট্রায়াল',
    description: '১৪ দিন ট্রায়াল',
    priceMonthly: 0,
    callLimit: 50,
    smsLimit: 20,
    trialDays: 14,
    features: ['Bangla AI Voice', 'Shopify', 'WooCommerce', 'Basic Dashboard'],
    sortOrder: 1,
  },
  {
    code: 'STARTER',
    name: 'Starter',
    nameBangla: 'স্টার্টার',
    description: 'ছোট দোকানের জন্য',
    priceMonthly: 1999,
    callLimit: 300,
    smsLimit: 100,
    trialDays: 0,
    features: ['Call Recording', 'SMS Alerts', 'API Access', 'Webhooks'],
    sortOrder: 2,
  },
  {
    code: 'GROWTH',
    name: 'Growth',
    nameBangla: 'গ্রোথ',
    description: 'বড় দোকানের জন্য',
    priceMonthly: 4999,
    callLimit: 1000,
    smsLimit: 500,
    trialDays: 0,
    features: ['WhatsApp', 'Advanced Reports', 'Call Retry', 'Priority Support'],
    isPopular: true,
    sortOrder: 3,
  },
  {
    code: 'ENTERPRISE',
    name: 'Enterprise',
    nameBangla: 'এন্টারপ্রাইজ',
    description: 'আনলিমিটেড স্কেল',
    priceMonthly: 14999,
    callLimit: 10000,
    smsLimit: 5000,
    trialDays: 0,
    features: ['Unlimited Calls', 'White-label', 'SLA', 'Dedicated Manager'],
    sortOrder: 4,
  },
];

@Injectable()
export class PlansService implements OnModuleInit {
  constructor(private prisma: PrismaService) {}

  async onModuleInit() {
    for (const plan of DEFAULT_PLANS) {
      await this.prisma.plan.upsert({
        where: { code: plan.code },
        update: {},
        create: {
          ...plan,
          priceMonthly: plan.priceMonthly,
          features: plan.features as Prisma.InputJsonValue,
        },
      });
    }
  }

  findAll(activeOnly = false) {
    return this.prisma.plan.findMany({
      where: activeOnly ? { isActive: true } : undefined,
      orderBy: { sortOrder: 'asc' },
    });
  }

  findByCode(code: string) {
    return this.prisma.plan.findUnique({ where: { code } });
  }

  create(data: Prisma.PlanCreateInput) {
    return this.prisma.plan.create({ data });
  }

  update(id: string, data: Prisma.PlanUpdateInput) {
    return this.prisma.plan.update({ where: { id }, data });
  }

  async assignPlanToMerchant(
    merchantId: string,
    planCode: string,
    options?: {
      paymentMethod?: string;
      markPaid?: boolean;
      adminNote?: string;
      /** When confirming an existing pending billing — do not create a second row */
      skipBilling?: boolean;
      paymentRef?: string;
      /** Force replace quota instead of stacking (e.g. admin reset) */
      replaceQuota?: boolean;
    },
  ) {
    const plan = await this.findByCode(planCode);
    if (!plan) throw new Error(`Plan ${planCode} not found`);

    const now = new Date();
    let endsAt = new Date(now);
    endsAt.setMonth(endsAt.getMonth() + 1);

    const prev = await this.prisma.subscription.findFirst({
      where: { merchantId, isActive: true },
      orderBy: { createdAt: 'desc' },
    });

    const isPaid = planCode !== 'FREE' && Number(plan.priceMonthly) > 0;

    // Never let FREE wipe an active paid subscription
    if (
      !isPaid &&
      prev &&
      prev.plan !== 'FREE' &&
      prev.endsAt > now &&
      !options?.replaceQuota
    ) {
      throw new Error(
        'Cannot assign FREE while a paid subscription is active',
      );
    }
    let callLimit = plan.callLimit;
    let smsLimit = plan.smsLimit;
    let callsUsed = 0;
    let smsUsed = 0;
    let stacked = false;

    // Paid + paid (still valid): stack order-confirm quotas. Free → paid replaces free.
    if (
      isPaid &&
      !options?.replaceQuota &&
      prev &&
      prev.endsAt > now &&
      prev.plan !== 'FREE'
    ) {
      callLimit = prev.callLimit + plan.callLimit;
      smsLimit = prev.smsLimit + plan.smsLimit;
      callsUsed = prev.callsUsed;
      smsUsed = prev.smsUsed;
      endsAt = new Date(Math.max(prev.endsAt.getTime(), endsAt.getTime()));
      stacked = true;
    }

    await this.prisma.subscription.updateMany({
      where: { merchantId, isActive: true },
      data: { isActive: false },
    });

    const subscription = await this.prisma.subscription.create({
      data: {
        merchantId,
        plan: planCode as 'FREE' | 'STARTER' | 'GROWTH' | 'ENTERPRISE',
        price: plan.priceMonthly,
        callLimit,
        callsUsed,
        smsLimit,
        smsUsed,
        startsAt: now,
        endsAt,
        isActive: true,
        paymentProvider: options?.paymentMethod || 'admin',
      },
    });

    await this.prisma.merchant.update({
      where: { id: merchantId },
      data: {
        subscriptionPlan: planCode as 'FREE' | 'STARTER' | 'GROWTH' | 'ENTERPRISE',
        subscriptionEnds: endsAt,
        status: planCode === 'FREE' ? 'TRIAL' : 'ACTIVE',
      },
    });

    if (options?.skipBilling) {
      return { subscription, billing: null, plan, stacked };
    }

    const billing = await this.prisma.billingRecord.create({
      data: {
        merchantId,
        planCode,
        amount: plan.priceMonthly,
        periodStart: now,
        periodEnd: endsAt,
        status: options?.markPaid || Number(plan.priceMonthly) === 0 ? 'PAID' : 'PENDING',
        paymentMethod: options?.paymentMethod || 'admin_assign',
        paymentRef: options?.paymentRef,
        notes: [
          options?.adminNote,
          stacked
            ? `Stacked +${plan.callLimit} order confirms (total ${callLimit})`
            : null,
        ]
          .filter(Boolean)
          .join(' | '),
      },
    });

    return { subscription, billing, plan, stacked };
  }

  /** Pending billing only — plan activates after admin confirms payment. */
  async createPendingBilling(
    merchantId: string,
    planCode: string,
    options: {
      paymentMethod: string;
      paymentRef?: string;
      notes?: string;
      amount?: number;
    },
  ) {
    const plan = await this.findByCode(planCode);
    if (!plan || !plan.isActive) throw new Error(`Plan ${planCode} not found`);

    const now = new Date();
    const endsAt = new Date(now);
    endsAt.setMonth(endsAt.getMonth() + 1);
    const amount =
      options.amount != null ? options.amount : Number(plan.priceMonthly);

    const billing = await this.prisma.billingRecord.create({
      data: {
        merchantId,
        planCode,
        amount,
        periodStart: now,
        periodEnd: endsAt,
        status: 'PENDING',
        paymentMethod: options.paymentMethod,
        paymentRef: options.paymentRef,
        notes: options.notes,
      },
    });

    return { billing, plan };
  }
}
