import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bull';
import { Queue } from 'bull';
import { Prisma, OrderStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { SubscriptionsService } from '../subscriptions/subscriptions.service';
import { CreateOrderDto } from './dto/create-order.dto';
import { UpdateOrderStatusDto } from './dto/update-order-status.dto';

@Injectable()
export class OrdersService {
  constructor(
    private prisma: PrismaService,
    private subscriptions: SubscriptionsService,
    @InjectQueue('calls') private callsQueue: Queue,
  ) {}

  async create(merchantId: string, dto: CreateOrderDto) {
    const limitCheck = await this.subscriptions.canMakeCall(merchantId);
    if (!limitCheck.allowed) {
      throw new ForbiddenException(limitCheck.reason || 'Order quota exceeded');
    }

    const order = await this.prisma.order.create({
      data: {
        merchantId,
        externalId: dto.externalId,
        orderNumber: dto.orderNumber,
        customerName: dto.customerName,
        customerPhone: this.normalizePhone(dto.customerPhone),
        customerEmail: dto.customerEmail,
        totalAmount: dto.totalAmount,
        currency: dto.currency || 'BDT',
        items: dto.items as Prisma.InputJsonValue,
        shippingAddress: dto.shippingAddress as Prisma.InputJsonValue,
        paymentMethod: dto.paymentMethod,
        notes: dto.notes,
        source: dto.source || 'CUSTOM_API',
        metadata: dto.metadata as Prisma.InputJsonValue,
        status: 'PENDING',
      },
    });

    // ShopIn orders: bind merchant callback if shopId present and not yet set
    const meta = (dto.metadata || {}) as Record<string, unknown>;
    if (meta.provider === 'shopin' || meta.shopId) {
      const shopId = String(meta.shopId || '');
      if (shopId) {
        const merchant = await this.prisma.merchant.findUnique({
          where: { id: merchantId },
        });
        const base = (process.env.SHOPIN_API_BASE || 'https://api.shopin.bd').replace(
          /\/$/,
          '',
        );
        const callbackUrl = `${base}/api/v1/webhooks/maskara/${shopId}`;
        if (
          merchant &&
          (!merchant.webhookUrl || !merchant.webhookUrl.includes('/webhooks/maskara/'))
        ) {
          await this.prisma.merchant.update({
            where: { id: merchantId },
            data: { webhookUrl: callbackUrl },
          });
        }
      }
    }

    await this.updateDailyUsage(merchantId, 'ordersReceived');

    // First verification call ASAP (≤20s; backup cron covers misses)
    await this.callsQueue.add(
      'initiate-call',
      { orderId: order.id, merchantId, isRetry: false },
      {
        attempts: 2,
        backoff: { type: 'fixed', delay: 3000 },
        removeOnComplete: true,
        removeOnFail: true,
        jobId: `call-first-${order.id}`,
      },
    );

    return order;
  }

  async findAll(
    merchantId: string,
    params: {
      status?: OrderStatus;
      page?: number;
      limit?: number;
      search?: string;
      from?: string;
      to?: string;
    },
  ) {
    const page = params.page || 1;
    const limit = params.limit || 20;
    const skip = (page - 1) * limit;

    const createdAt: Prisma.DateTimeFilter = {};
    if (params.from) {
      const from = new Date(params.from);
      if (!Number.isNaN(from.getTime())) createdAt.gte = from;
    }
    if (params.to) {
      const to = new Date(params.to);
      if (!Number.isNaN(to.getTime())) createdAt.lte = to;
    }

    const where: Prisma.OrderWhereInput = {
      merchantId,
      ...(params.status && { status: params.status }),
      ...(Object.keys(createdAt).length > 0 && { createdAt }),
      ...(params.search && {
        OR: [
          { orderNumber: { contains: params.search, mode: 'insensitive' } },
          { customerName: { contains: params.search, mode: 'insensitive' } },
          { customerPhone: { contains: params.search } },
        ],
      }),
    };

    const [orders, total] = await Promise.all([
      this.prisma.order.findMany({
        where,
        include: { calls: { orderBy: { createdAt: 'desc' }, take: 1 } },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.order.count({ where }),
    ]);

    return { orders, total, page, limit, totalPages: Math.ceil(total / limit) };
  }

  async findOne(merchantId: string, orderId: string) {
    const order = await this.prisma.order.findFirst({
      where: { id: orderId, merchantId },
      include: {
        calls: { orderBy: { createdAt: 'desc' } },
        notifications: { orderBy: { createdAt: 'desc' } },
      },
    });
    if (!order) throw new NotFoundException('Order not found');
    return order;
  }

  async updateStatus(
    merchantId: string,
    orderId: string,
    dto: UpdateOrderStatusDto,
  ) {
    const order = await this.findOne(merchantId, orderId);

    const updateData: Prisma.OrderUpdateInput = {
      status: dto.status,
      ...(dto.status === 'VERIFIED' && { verifiedAt: new Date(), nextCallAt: null }),
      ...(dto.status === 'CANCELLED' && { cancelledAt: new Date(), nextCallAt: null }),
    };

    const updated = await this.prisma.order.update({
      where: { id: order.id },
      data: updateData,
    });

    if (dto.status === 'VERIFIED') {
      await this.updateDailyUsage(merchantId, 'ordersVerified');
      await this.subscriptions.consumeOrderQuota(merchantId, order.id);
    } else if (dto.status === 'CANCELLED') {
      await this.updateDailyUsage(merchantId, 'ordersCancelled');
      await this.subscriptions.consumeOrderQuota(merchantId, order.id);
    }

    return updated;
  }

  async retryCall(merchantId: string, orderId: string) {
    const order = await this.findOne(merchantId, orderId);

    if (order.status === 'VERIFIED' || order.status === 'CANCELLED') {
      throw new NotFoundException('Order already finalized');
    }

    const limitCheck = await this.subscriptions.canMakeCall(merchantId);
    if (!limitCheck.allowed) {
      throw new ForbiddenException(limitCheck.reason || 'Call limit exceeded');
    }

    await this.callsQueue.add(
      'initiate-call',
      { orderId: order.id, merchantId, isRetry: true },
      { attempts: 3, backoff: { type: 'exponential', delay: 5000 } },
    );

    return { message: 'Call retry queued', orderId };
  }

  async getStats(merchantId: string) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Website/store admin cancels (cancelledFromWebsite) excluded from "বাতিল"
    const maskaraCancelled = {
      status: 'CANCELLED' as const,
      NOT: {
        metadata: {
          path: ['cancelledFromWebsite'],
          equals: true,
        },
      },
    };

    const [total, verified, cancelled, pending, todayOrders, calls] =
      await Promise.all([
        this.prisma.order.count({ where: { merchantId } }),
        this.prisma.order.count({
          where: { merchantId, status: 'VERIFIED' },
        }),
        this.prisma.order.count({
          where: { merchantId, ...maskaraCancelled },
        }),
        this.prisma.order.count({
          where: { merchantId, status: { in: ['PENDING', 'CALLING'] } },
        }),
        this.prisma.order.count({
          where: { merchantId, createdAt: { gte: today } },
        }),
        this.prisma.call.findMany({
          where: { merchantId },
          select: { status: true, outcome: true },
        }),
      ]);

    const answered = calls.filter(
      (c) =>
        c.status === 'COMPLETED' ||
        c.outcome === 'CONFIRMED' ||
        c.outcome === 'CANCELLED',
    );
    const successRate =
      calls.length > 0 ? Math.round((answered.length / calls.length) * 100) : 0;

    return {
      totalOrders: total,
      verifiedOrders: verified,
      cancelledOrders: cancelled,
      pendingOrders: pending,
      todayOrders,
      callSuccessRate: successRate,
      totalCalls: calls.length,
    };
  }

  private normalizePhone(phone: string): string {
    let normalized = phone.replace(/\s+/g, '').replace(/-/g, '');
    if (normalized.startsWith('01')) {
      normalized = '+880' + normalized.substring(1);
    } else if (normalized.startsWith('880')) {
      normalized = '+' + normalized;
    } else if (!normalized.startsWith('+')) {
      normalized = '+880' + normalized;
    }
    return normalized;
  }

  private async updateDailyUsage(
    merchantId: string,
    field: 'ordersReceived' | 'ordersVerified' | 'ordersCancelled',
  ) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    await this.prisma.usageRecord.upsert({
      where: {
        merchantId_date: { merchantId, date: today },
      },
      create: {
        merchantId,
        date: today,
        [field]: 1,
      },
      update: {
        [field]: { increment: 1 },
      },
    });
  }
}
