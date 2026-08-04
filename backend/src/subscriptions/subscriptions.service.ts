import {
  Injectable,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
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

    // Quota = billable order outcomes (confirm / return) in the plan window
    let usageCalls = subscription?.callsUsed ?? 0;
    if (subscription) {
      usageCalls = await this.syncAnsweredCallQuota(subscription.id, merchantId, {
        startsAt: subscription.startsAt,
        endsAt: subscription.endsAt,
        callsUsed: subscription.callsUsed,
      });
    }

    const [totalOrders, verifiedOrders, cancelledOrders, pendingOrders] =
      await Promise.all([
        this.prisma.order.count({ where: { merchantId } }),
        this.prisma.order.count({
          where: { merchantId, status: 'VERIFIED' },
        }),
        this.prisma.order.count({
          where: { merchantId, status: 'CANCELLED' },
        }),
        this.prisma.order.count({
          where: { merchantId, status: { in: ['PENDING', 'CALLING'] } },
        }),
      ]);

    return {
      merchant: {
        id: merchant.id,
        name: merchant.name,
        status: merchant.status,
        subscriptionPlan: merchant.subscriptionPlan,
        subscriptionEnds: merchant.subscriptionEnds,
      },
      subscription: subscription
        ? { ...subscription, callsUsed: usageCalls }
        : null,
      currentPlan,
      availablePlans: plans,
      billingHistory: recentBilling,
      payment,
      paidPurchases: paidPurchases.map((b) => ({
        planCode: b.planCode,
        amount: b.amount,
        createdAt: b.createdAt,
      })),
      /** Same lifetime totals as admin merchant row (_count.orders). */
      orderCounts: {
        totalOrders,
        verifiedOrders,
        cancelledOrders,
        pendingOrders,
      },
      usage: subscription
        ? {
            callsUsed: usageCalls,
            callLimit: subscription.callLimit,
            ordersUsed: usageCalls,
            orderLimit: subscription.callLimit,
            smsUsed: subscription.smsUsed,
            smsLimit: subscription.smsLimit,
            callsRemaining: Math.max(0, subscription.callLimit - usageCalls),
            ordersRemaining: Math.max(0, subscription.callLimit - usageCalls),
          }
        : null,
    };
  }

  /**
   * Recompute quota from billable orders in the plan window (matches consumeOrderQuota).
   * VERIFIED / CANCELLED, not website-cancelled; includes merchant manual confirm.
   */
  private async syncAnsweredCallQuota(
    subscriptionId: string,
    merchantId: string,
    sub: { startsAt: Date; endsAt: Date; callsUsed: number },
  ): Promise<number> {
    const rows = await this.prisma.$queryRaw<Array<{ n: bigint | number }>>`
      SELECT COUNT(*)::int AS n
      FROM "Order" o
      WHERE o."merchantId" = ${merchantId}
        AND o.status IN ('VERIFIED', 'CANCELLED')
        AND o."excludedFromStats" = false
        AND NOT (COALESCE(o.metadata->>'manualCompleteFromWebsite', '') = 'true')
        AND (
          (o."updatedAt" >= ${sub.startsAt} AND o."updatedAt" <= ${sub.endsAt})
          OR EXISTS (
            SELECT 1 FROM "Call" c
            WHERE c."orderId" = o.id
              AND c.outcome IN ('CONFIRMED', 'CANCELLED')
              AND c."createdAt" >= ${sub.startsAt}
              AND c."createdAt" <= ${sub.endsAt}
          )
        )
    `;
    const answered = Number(rows[0]?.n ?? 0);
    if (answered !== sub.callsUsed) {
      await this.prisma.subscription.update({
        where: { id: subscriptionId },
        data: { callsUsed: answered },
      });
    }
    return answered;
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

    const used = await this.syncAnsweredCallQuota(subscription.id, merchantId, {
      startsAt: subscription.startsAt,
      endsAt: subscription.endsAt,
      callsUsed: subscription.callsUsed,
    });

    if (used >= subscription.callLimit) {
      return {
        allowed: false,
        reason: `মাসিক কল রিসিভ কোটা শেষ (${used}/${subscription.callLimit} কনফার্ম+রিটার্ন)`,
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
   * Consume 1 plan unit when the customer answers and presses 1 (confirm) or 2 (return/cancel).
   * Website manual complete / website cancel do not consume quota.
   */
  async consumeOrderQuota(
    merchantId: string,
    orderId: string,
  ): Promise<void> {
    const order = await this.prisma.order.findUnique({ where: { id: orderId } });
    if (!order || order.merchantId !== merchantId) return;
    if (!['VERIFIED', 'CANCELLED'].includes(order.status)) return;
    // Website-managed cancels are not AI call outcomes — do not bill quota
    if (order.excludedFromStats) return;
    if (order.manualComplete) {
      const meta0 =
        order.metadata && typeof order.metadata === 'object' && !Array.isArray(order.metadata)
          ? (order.metadata as Record<string, unknown>)
          : {};
      if (meta0.manualCompleteFromWebsite === true) return;
    }

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
        metadata: {
          ...meta,
          quotaConsumed: true,
          quotaConsumedAt: new Date().toISOString(),
          quotaReason: order.status === 'VERIFIED' ? 'call_confirm' : 'call_return',
        } as Prisma.InputJsonValue,
      },
    });
  }
}
