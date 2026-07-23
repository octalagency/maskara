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

  private async getManualPaymentInfo() {
    const row = await this.prisma.systemSetting.findUnique({
      where: { key: 'payment' },
    });
    const p = (row?.value as Record<string, unknown>) || {};
    return {
      bKashNumber: String(p.bKashNumber || ''),
      nagadNumber: String(p.nagadNumber || ''),
      instructions: String(
        p.instructions ||
          'bKash-এ Payment করুন (Merchant SIM), তারপর TrxID, নম্বর ও অ্যামাউন্ট সাবমিট করুন।',
      ),
    };
  }

  async getMerchantSubscription(merchantId: string) {
    await this.healPaidPlansIfNeeded(merchantId);

    const [merchant, subscription, plans, recentBilling, payment] =
      await Promise.all([
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
        this.getManualPaymentInfo(),
      ]);

    if (!merchant) throw new NotFoundException('Merchant not found');

    const currentPlan = plans.find(
      (p) => p.code === merchant.subscriptionPlan,
    );

    const paidPurchases = recentBilling.filter(
      (b) => b.status === 'PAID' && b.planCode !== 'FREE' && Number(b.amount) > 0,
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
      payment,
      paidPurchases: paidPurchases.map((b) => ({
        planCode: b.planCode,
        amount: b.amount,
        createdAt: b.createdAt,
      })),
      usage: subscription
        ? {
            // Plan quota = finalized orders (confirm + cancel), not dial attempts
            callsUsed: subscription.callsUsed,
            callLimit: subscription.callLimit,
            ordersUsed: subscription.callsUsed,
            orderLimit: subscription.callLimit,
            smsUsed: subscription.smsUsed,
            smsLimit: subscription.smsLimit,
            callsRemaining: Math.max(
              0,
              subscription.callLimit - subscription.callsUsed,
            ),
            ordersRemaining: Math.max(
              0,
              subscription.callLimit - subscription.callsUsed,
            ),
          }
        : null,
    };
  }

  /**
   * If merchant still shows FREE but has PAID paid-plan billings, apply them
   * in order (first replaces free, later purchases stack quotas).
   */
  private async healPaidPlansIfNeeded(merchantId: string) {
    const merchant = await this.prisma.merchant.findUnique({
      where: { id: merchantId },
      select: { subscriptionPlan: true },
    });
    if (!merchant) return;

    const active = await this.prisma.subscription.findFirst({
      where: { merchantId, isActive: true },
      orderBy: { createdAt: 'desc' },
    });

    const paidBillings = await this.prisma.billingRecord.findMany({
      where: {
        merchantId,
        status: 'PAID',
        planCode: { not: 'FREE' },
      },
      orderBy: { createdAt: 'asc' },
    });
    if (!paidBillings.length) return;

    const needsHeal =
      merchant.subscriptionPlan === 'FREE' ||
      !active ||
      active.plan === 'FREE';

    if (!needsHeal) return;

    for (const b of paidBillings) {
      await this.plans.assignPlanToMerchant(merchantId, b.planCode, {
        paymentMethod: b.paymentMethod || 'bkash_manual',
        markPaid: true,
        skipBilling: true,
        paymentRef: b.paymentRef || undefined,
        adminNote: 'Healed from PAID billing (stack quotas)',
      });
    }
  }

  async subscribe(
    merchantId: string,
    planCode: string,
    paymentMethod = 'bkash_manual',
  ) {
    const plan = await this.plans.findByCode(planCode);
    if (!plan || !plan.isActive) {
      throw new BadRequestException('Invalid plan');
    }

    if (planCode === 'FREE' || Number(plan.priceMonthly) === 0) {
      const merchant = await this.prisma.merchant.findUnique({
        where: { id: merchantId },
        select: { subscriptionPlan: true },
      });
      const activePaid = await this.prisma.subscription.findFirst({
        where: {
          merchantId,
          isActive: true,
          plan: { not: 'FREE' },
          endsAt: { gt: new Date() },
        },
      });
      if (
        activePaid ||
        (merchant &&
          merchant.subscriptionPlan !== 'FREE' &&
          merchant.subscriptionPlan !== undefined)
      ) {
        throw new BadRequestException(
          'Paid plan আছে — Free দিয়ে overwrite করা যাবে না। নতুন কোটার জন্য paid প্ল্যান কিনুন।',
        );
      }
      return this.plans.assignPlanToMerchant(merchantId, planCode, {
        paymentMethod: 'trial',
        markPaid: true,
      });
    }

    // Paid plans: pending billing only — plan activates after payment confirm
    const payment = await this.getManualPaymentInfo();
    const { billing } = await this.plans.createPendingBilling(
      merchantId,
      planCode,
      {
        paymentMethod,
        notes: `Merchant requested ${planCode} via ${paymentMethod}`,
      },
    );

    return {
      billing,
      plan,
      message:
        'bKash-এ Payment করুন, তারপর TrxID / নম্বর / অ্যামাউন্ট সাবমিট করুন। Admin confirm করলে Paid হবে।',
      paymentInstructions: {
        bKash: payment.bKashNumber || undefined,
        nagad: payment.nagadNumber || undefined,
        amount: Number(plan.priceMonthly),
        reference: billing.id,
        instructions: payment.instructions,
      },
    };
  }

  /**
   * Non-API bKash SIM: merchant sent money — submit TrxID + phone + amount.
   * autoVerify=true → match amount + unique TrxID and mark PAID within same request
   * (frontend shows ~3s verifying UX).
   */
  async submitBkashManual(
    merchantId: string,
    body: {
      planCode: string;
      trxId: string;
      senderPhone: string;
      amount: number;
      autoVerify?: boolean;
    },
  ) {
    const planCode = String(body.planCode || '').trim().toUpperCase();
    const trxId = String(body.trxId || '')
      .trim()
      .replace(/\s+/g, '');
    const senderPhone = String(body.senderPhone || '')
      .trim()
      .replace(/\D/g, '');
    const amount = Number(body.amount);
    const autoVerify = body.autoVerify !== false;

    if (!planCode) throw new BadRequestException('planCode required');
    if (!trxId || trxId.length < 6) {
      throw new BadRequestException('Valid bKash TrxID required');
    }
    if (senderPhone.length < 10) {
      throw new BadRequestException('Sender phone required (01XXXXXXXXX)');
    }
    if (!Number.isFinite(amount) || amount <= 0) {
      throw new BadRequestException('Amount required');
    }

    const plan = await this.plans.findByCode(planCode);
    if (!plan || !plan.isActive) {
      throw new BadRequestException('Invalid plan');
    }

    const expected = Number(plan.priceMonthly);
    if (Math.abs(amount - expected) > 1) {
      throw new BadRequestException(
        `Amount must be ৳${expected} for ${planCode} (got ৳${amount})`,
      );
    }

    const dup = await this.prisma.billingRecord.findFirst({
      where: {
        paymentRef: trxId,
        status: { in: ['PENDING', 'PAID'] },
      },
    });
    if (dup) {
      throw new BadRequestException('This TrxID was already submitted');
    }

    const payment = await this.getManualPaymentInfo();
    const { billing } = await this.plans.createPendingBilling(
      merchantId,
      planCode,
      {
        paymentMethod: 'bkash_sim',
        paymentRef: trxId,
        amount: expected,
        notes: JSON.stringify({
          senderPhone,
          submittedAmount: amount,
          channel: 'bkash_sim',
          autoVerify,
        }),
      },
    );

    if (autoVerify) {
      const paid = await this.confirmPayment(billing.id, trxId);
      return {
        billing: paid,
        plan,
        status: 'PAID' as const,
        message: 'পেমেন্ট ভেরিফাই হয়েছে — Paid',
        paymentInstructions: {
          bKash: payment.bKashNumber || undefined,
          amount: expected,
          reference: billing.id,
          trxId,
          senderPhone,
        },
      };
    }

    return {
      billing,
      plan,
      status: 'PENDING' as const,
      message:
        'পেমেন্ট সাবমিট হয়েছে। Admin confirm করলে Paid হবে।',
      paymentInstructions: {
        bKash: payment.bKashNumber || undefined,
        amount: expected,
        reference: billing.id,
        trxId,
        senderPhone,
      },
    };
  }

  async confirmPayment(billingId: string, paymentRef?: string) {
    const billing = await this.prisma.billingRecord.findUnique({
      where: { id: billingId },
    });
    if (!billing) throw new NotFoundException('Billing record not found');

    if (billing.status === 'PAID') {
      // Heal orphan PAID rows where plan was never activated
      const merchant = await this.prisma.merchant.findUnique({
        where: { id: billing.merchantId },
        select: { subscriptionPlan: true },
      });
      if (
        merchant &&
        billing.planCode !== 'FREE' &&
        merchant.subscriptionPlan === 'FREE'
      ) {
        await this.plans.assignPlanToMerchant(
          billing.merchantId,
          billing.planCode,
          {
            paymentMethod: billing.paymentMethod || 'bkash_manual',
            markPaid: true,
            skipBilling: true,
            paymentRef: billing.paymentRef || undefined,
            adminNote: 'Activated orphan PAID billing',
          },
        );
      }
      return this.prisma.billingRecord.findUniqueOrThrow({
        where: { id: billingId },
      });
    }

    const ref = (paymentRef || billing.paymentRef || '').trim() || undefined;

    await this.prisma.billingRecord.update({
      where: { id: billingId },
      data: { status: 'PAID', paymentRef: ref },
    });

    // Activate / stack plan without creating a second billing row
    const activated = await this.plans.assignPlanToMerchant(
      billing.merchantId,
      billing.planCode,
      {
        paymentMethod: billing.paymentMethod || 'bkash_manual',
        markPaid: true,
        skipBilling: true,
        paymentRef: ref,
        adminNote: `Payment confirmed ${ref || ''}`.trim(),
      },
    );

    if (activated.stacked) {
      await this.prisma.billingRecord.update({
        where: { id: billingId },
        data: {
          notes: [
            billing.notes,
            `Stacked +${activated.plan.callLimit} → total ${activated.subscription.callLimit}`,
          ]
            .filter(Boolean)
            .join(' | '),
        },
      });
    }

    return this.prisma.billingRecord.findUniqueOrThrow({ where: { id: billingId } });
  }

  async rejectBilling(billingId: string, reason?: string) {
    const billing = await this.prisma.billingRecord.findUnique({
      where: { id: billingId },
    });
    if (!billing) throw new NotFoundException('Billing record not found');
    if (billing.status === 'PAID') {
      throw new BadRequestException('Cannot reject a PAID record');
    }

    return this.prisma.billingRecord.update({
      where: { id: billingId },
      data: {
        status: 'FAILED',
        notes: [billing.notes, reason ? `Rejected: ${reason}` : 'Rejected by admin']
          .filter(Boolean)
          .join(' | '),
      },
    });
  }

  /**
   * Quota gate: plan limit = monthly order outcomes (confirm OR cancel).
   * Dialing unanswered calls does not consume quota.
   */
  async canMakeCall(
    merchantId: string,
  ): Promise<{ allowed: boolean; reason?: string }> {
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
      return { allowed: true };
    }

    if (subscription.endsAt < new Date()) {
      return { allowed: false, reason: 'Subscription expired' };
    }

    if (subscription.callsUsed >= subscription.callLimit) {
      return {
        allowed: false,
        reason: `মাসিক অর্ডার লিমিট শেষ (${subscription.callsUsed}/${subscription.callLimit} order confirmed/cancelled)`,
      };
    }

    return { allowed: true };
  }

  /** @deprecated dials no longer consume quota — kept for callers */
  async incrementCallUsage(merchantId: string): Promise<void> {
    // No-op: quota is consumed only on order VERIFIED / CANCELLED
    void merchantId;
  }

  /**
   * Consume 1 plan unit when an order is confirmed OR cancelled (once per order).
   */
  async consumeOrderQuota(
    merchantId: string,
    orderId: string,
  ): Promise<void> {
    const order = await this.prisma.order.findUnique({ where: { id: orderId } });
    if (!order || order.merchantId !== merchantId) return;
    if (!['VERIFIED', 'CANCELLED'].includes(order.status)) return;

    const meta =
      order.metadata && typeof order.metadata === 'object' && !Array.isArray(order.metadata)
        ? ({ ...(order.metadata as Record<string, unknown>) } as Record<string, unknown>)
        : {};
    if (meta.quotaConsumed) return;

    const subscription = await this.prisma.subscription.findFirst({
      where: { merchantId, isActive: true },
      orderBy: { createdAt: 'desc' },
    });
    if (subscription) {
      await this.prisma.subscription.update({
        where: { id: subscription.id },
        data: { callsUsed: { increment: 1 } },
      });
    }

    await this.prisma.order.update({
      where: { id: orderId },
      data: {
        metadata: { ...meta, quotaConsumed: true, quotaConsumedAt: new Date().toISOString() },
      },
    });
  }
}
