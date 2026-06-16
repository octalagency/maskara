import {
  Injectable,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { PlansService } from '../plans/plans.service';

@Injectable()
export class SubscriptionsService {
  constructor(
    private prisma: PrismaService,
    private plans: PlansService,
  ) {}

  async getPublicPlans() {
    return this.plans.findAll(true);
  }

  async getMerchantSubscription(merchantId: string) {
    const [merchant, subscription, plans, recentBilling] = await Promise.all([
      this.prisma.merchant.findUnique({ where: { id: merchantId } }),
      this.prisma.subscription.findFirst({
        where: { merchantId, isActive: true },
        orderBy: { createdAt: 'desc' },
      }),
      this.plans.findAll(true),
      this.prisma.billingRecord.findMany({
        where: { merchantId },
        orderBy: { createdAt: 'desc' },
        take: 12,
      }),
    ]);

    if (!merchant) throw new NotFoundException('Merchant not found');

    const currentPlan = plans.find(
      (p) => p.code === merchant.subscriptionPlan,
    );

    return {
      merchant: {
        id: merchant.id,
        name: merchant.name,
        status: merchant.status,
        subscriptionPlan: merchant.subscriptionPlan,
        subscriptionEnds: merchant.subscriptionEnds,
      },
      subscription,
      currentPlan,
      availablePlans: plans,
      billingHistory: recentBilling,
      usage: subscription
        ? {
            callsUsed: subscription.callsUsed,
            callLimit: subscription.callLimit,
            smsUsed: subscription.smsUsed,
            smsLimit: subscription.smsLimit,
            callsRemaining: Math.max(0, subscription.callLimit - subscription.callsUsed),
          }
        : null,
    };
  }

  async subscribe(
    merchantId: string,
    planCode: string,
    paymentMethod = 'bKash',
  ) {
    const plan = await this.plans.findByCode(planCode);
    if (!plan || !plan.isActive) {
      throw new BadRequestException('Invalid plan');
    }

    if (planCode === 'FREE') {
      return this.plans.assignPlanToMerchant(merchantId, planCode, {
        paymentMethod: 'trial',
        markPaid: true,
      });
    }

    // Create pending billing — admin confirms or payment gateway later
    const result = await this.plans.assignPlanToMerchant(merchantId, planCode, {
      paymentMethod,
      markPaid: false,
      adminNote: `Merchant requested via ${paymentMethod}`,
    });

    return {
      ...result,
      message:
        'Use POST /payments/initiate with provider bkash or nagad to pay online.',
      paymentInstructions: {
        bkash: 'POST /payments/initiate { planCode, provider: "bkash" }',
        nagad: 'POST /payments/initiate { planCode, provider: "nagad" }',
        amount: Number(plan.priceMonthly),
        reference: result.billing.id,
      },
    };
  }

  async confirmPayment(billingId: string, paymentRef?: string) {
    const billing = await this.prisma.billingRecord.findUnique({
      where: { id: billingId },
    });
    if (!billing) throw new NotFoundException('Billing record not found');

    await this.prisma.billingRecord.update({
      where: { id: billingId },
      data: { status: 'PAID', paymentRef },
    });

    await this.prisma.merchant.update({
      where: { id: billing.merchantId },
      data: { status: 'ACTIVE' },
    });

    return billing;
  }

  /** Returns true if merchant can initiate another verification call */
  async canMakeCall(merchantId: string): Promise<{ allowed: boolean; reason?: string }> {
    const merchant = await this.prisma.merchant.findUnique({
      where: { id: merchantId },
      select: { status: true, subscriptionPlan: true },
    });
    if (!merchant) return { allowed: false, reason: 'Merchant not found' };
    if (merchant.status === 'SUSPENDED') {
      return { allowed: false, reason: 'Merchant account suspended' };
    }

    const subscription = await this.prisma.subscription.findFirst({
      where: { merchantId, isActive: true },
      orderBy: { createdAt: 'desc' },
    });

    if (!subscription) {
      // FREE plan merchants without subscription row — allow with default limit
      return { allowed: true };
    }

    if (subscription.endsAt < new Date()) {
      return { allowed: false, reason: 'Subscription expired' };
    }

    if (subscription.callsUsed >= subscription.callLimit) {
      return {
        allowed: false,
        reason: `Monthly call limit reached (${subscription.callLimit})`,
      };
    }

    return { allowed: true };
  }

  async incrementCallUsage(merchantId: string): Promise<void> {
    const subscription = await this.prisma.subscription.findFirst({
      where: { merchantId, isActive: true },
      orderBy: { createdAt: 'desc' },
    });
    if (!subscription) return;

    await this.prisma.subscription.update({
      where: { id: subscription.id },
      data: { callsUsed: { increment: 1 } },
    });
  }
}
