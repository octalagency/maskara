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
      usage: subscription
        ? {
            callsUsed: subscription.callsUsed,
            callLimit: subscription.callLimit,
            smsUsed: subscription.smsUsed,
            smsLimit: subscription.smsLimit,
            callsRemaining: Math.max(
              0,
              subscription.callLimit - subscription.callsUsed,
            ),
          }
        : null,
    };
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
      return billing;
    }

    const ref = (paymentRef || billing.paymentRef || '').trim() || undefined;

    const updated = await this.prisma.billingRecord.update({
      where: { id: billingId },
      data: { status: 'PAID', paymentRef: ref },
    });

    // Activate plan without creating a second billing row
    await this.plans.assignPlanToMerchant(billing.merchantId, billing.planCode, {
      paymentMethod: billing.paymentMethod || 'bkash_manual',
      markPaid: true,
      skipBilling: true,
      paymentRef: ref,
      adminNote: `Payment confirmed ${ref || ''}`.trim(),
    });

    return updated;
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

  /** Returns true if merchant can initiate another verification call */
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
