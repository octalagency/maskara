import {
  Injectable,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { PaymentProvider, PaymentSessionStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { PlansService } from '../plans/plans.service';
import { SubscriptionsService } from '../subscriptions/subscriptions.service';
import { BkashProvider } from './providers/bkash.provider';
import { NagadProvider } from './providers/nagad.provider';

@Injectable()
export class PaymentsService {
  constructor(
    private prisma: PrismaService,
    private plans: PlansService,
    private subscriptions: SubscriptionsService,
    private bkash: BkashProvider,
    private nagad: NagadProvider,
  ) {}

  async initiatePayment(
    merchantId: string,
    planCode: string,
    provider: 'bkash' | 'nagad',
  ) {
    const plan = await this.plans.findByCode(planCode);
    if (!plan || !plan.isActive) {
      throw new BadRequestException('Invalid plan');
    }
    if (Number(plan.priceMonthly) <= 0) {
      return this.subscriptions.subscribe(merchantId, planCode, 'FREE');
    }

    const billing = await this.plans.assignPlanToMerchant(merchantId, planCode, {
      paymentMethod: provider,
      markPaid: false,
      adminNote: `${provider} payment initiated`,
    });

    const amount = Number(plan.priceMonthly);
    const init =
      provider === 'bkash'
        ? await this.bkash.createPayment(amount, billing.billing.id)
        : await this.nagad.createPayment(amount, billing.billing.id);

    const session = await this.prisma.paymentSession.create({
      data: {
        merchantId,
        billingId: billing.billing.id,
        provider: provider.toUpperCase() as PaymentProvider,
        amount,
        status: PaymentSessionStatus.PENDING,
        gatewayTrxId: init.gatewayTrxId,
        paymentUrl: init.paymentUrl,
      },
    });

    return {
      sessionId: session.id,
      paymentUrl: init.paymentUrl,
      amount,
      provider,
      billingId: billing.billing.id,
      message: `${provider} payment page-এ redirect করুন`,
    };
  }

  async handleBkashCallback(query: Record<string, string>) {
    const paymentId = query.paymentID || query.paymentId;
    const status = query.status;

    if (!paymentId) throw new BadRequestException('Missing paymentID');

    const session = await this.prisma.paymentSession.findFirst({
      where: { gatewayTrxId: paymentId, provider: 'BKASH' },
    });
    if (!session) throw new NotFoundException('Payment session not found');

    if (status === 'cancel' || status === 'failure') {
      await this.prisma.paymentSession.update({
        where: { id: session.id },
        data: { status: PaymentSessionStatus.FAILED, callbackData: query },
      });
      return { success: false, message: 'Payment cancelled or failed' };
    }

    const result = await this.bkash.executePayment(paymentId);
    if (!result.success) {
      await this.prisma.paymentSession.update({
        where: { id: session.id },
        data: { status: PaymentSessionStatus.FAILED, callbackData: query },
      });
      return { success: false, message: 'Payment execution failed' };
    }

    return this.completeSession(session.id, result.trxId || paymentId, query);
  }

  async handleNagadCallback(body: Record<string, unknown>) {
    if (!this.nagad.verifyCallback(body)) {
      throw new BadRequestException('Invalid Nagad signature');
    }

    const decoded = body.sensitiveData
      ? JSON.parse(Buffer.from(body.sensitiveData as string, 'base64').toString('utf8'))
      : body;

    const orderId = decoded.orderId || decoded.merchantOrderId;
    const session = await this.prisma.paymentSession.findFirst({
      where: {
        OR: [
          { gatewayTrxId: String(orderId) },
          { billingId: String(orderId) },
        ],
        provider: 'NAGAD',
      },
    });
    if (!session) throw new NotFoundException('Payment session not found');

    const status = decoded.status || decoded.statusCode;
    if (status !== 'Success' && status !== '000') {
      await this.prisma.paymentSession.update({
        where: { id: session.id },
        data: { status: PaymentSessionStatus.FAILED, callbackData: body as object },
      });
      return { success: false };
    }

    return this.completeSession(
      session.id,
      String(decoded.paymentRefId || orderId),
      body,
    );
  }

  private async completeSession(
    sessionId: string,
    trxId: string,
    callbackData: unknown,
  ) {
    const session = await this.prisma.paymentSession.update({
      where: { id: sessionId },
      data: {
        status: PaymentSessionStatus.COMPLETED,
        gatewayTrxId: trxId,
        callbackData: callbackData as object,
      },
    });

    if (session.billingId) {
      await this.subscriptions.confirmPayment(session.billingId, trxId);
    }

    return { success: true, sessionId, trxId };
  }
}
