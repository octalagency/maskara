import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bull';
import { Queue } from 'bull';
import { Prisma, OrderStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { SubscriptionsService } from '../subscriptions/subscriptions.service';
import { NotificationsService } from '../notifications/notifications.service';
import { CreateOrderDto } from './dto/create-order.dto';
import { UpdateOrderStatusDto } from './dto/update-order-status.dto';
import {
  connectedStoreBuckets,
  resolveOrderStore,
  storeKeyToPrismaFilter,
} from './order-store.util';

@Injectable()
export class OrdersService {
  constructor(
    private prisma: PrismaService,
    private subscriptions: SubscriptionsService,
    private notifications: NotificationsService,
    @InjectQueue('calls') private callsQueue: Queue,
  ) {}

  async create(
    merchantId: string,
    dto: CreateOrderDto,
    opts?: {
      skipCall?: boolean;
      initialStatus?: OrderStatus;
      manualComplete?: boolean;
      excludedFromStats?: boolean;
    },
  ) {
    const skipCall = opts?.skipCall || opts?.manualComplete || opts?.excludedFromStats;
    const initialStatus = opts?.initialStatus || 'PENDING';

    // Manual complete / excluded orders don't need call quota gate
    if (!skipCall) {
      const limitCheck = await this.subscriptions.canMakeCall(merchantId);
      if (!limitCheck.allowed) {
        throw new ForbiddenException(limitCheck.reason || 'Order quota exceeded');
      }
    }

    const baseMeta =
      dto.metadata && typeof dto.metadata === 'object' && !Array.isArray(dto.metadata)
        ? ({ ...(dto.metadata as Record<string, unknown>) } as Record<string, unknown>)
        : {};
    if (opts?.manualComplete) {
      baseMeta.manualCompleteFromWebsite = true;
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
        metadata: baseMeta as Prisma.InputJsonValue,
        status: initialStatus,
        manualComplete: opts?.manualComplete === true,
        excludedFromStats: opts?.excludedFromStats === true,
        ...(initialStatus === 'VERIFIED' && { verifiedAt: new Date(), nextCallAt: null }),
        ...(initialStatus === 'CANCELLED' && { cancelledAt: new Date(), nextCallAt: null }),
      },
    });

    // ShopIn orders: bind merchant callback if shopId present and not yet set
    const meta = baseMeta;
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

    if (!opts?.excludedFromStats) {
      await this.updateDailyUsage(merchantId, 'ordersReceived');
      if (opts?.manualComplete) {
        await this.updateDailyUsage(merchantId, 'ordersVerified');
      }
    }

    if (!skipCall) {
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
    }

    return order;
  }

  /** Store admin completed/confirmed the order — stop calling, show Manual Complete */
  async markManualCompleteFromWebsite(
    merchantId: string,
    orderId: string,
    extraMeta: Record<string, unknown> = {},
  ) {
    const order = await this.prisma.order.findFirst({
      where: { id: orderId, merchantId },
    });
    if (!order) throw new NotFoundException('Order not found');
    if (order.status === 'VERIFIED' && order.manualComplete) return order;
    if (order.status === 'CANCELLED' && order.excludedFromStats) return order;

    const prevMeta =
      order.metadata && typeof order.metadata === 'object' && !Array.isArray(order.metadata)
        ? ({ ...(order.metadata as Record<string, unknown>) } as Record<string, unknown>)
        : {};

    const updated = await this.prisma.order.update({
      where: { id: orderId },
      data: {
        status: 'VERIFIED',
        verifiedAt: new Date(),
        nextCallAt: null,
        manualComplete: true,
        excludedFromStats: false,
        metadata: {
          ...prevMeta,
          ...extraMeta,
          manualCompleteFromWebsite: true,
        } as Prisma.InputJsonValue,
      },
    });

    // Remove queued call jobs if any
    try {
      const job = await this.callsQueue.getJob(`call-first-${orderId}`);
      if (job) await job.remove();
    } catch {
      // ignore
    }

    return updated;
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
      store?: string;
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

    const storeFilter = storeKeyToPrismaFilter(params.store);

    const where: Prisma.OrderWhereInput = {
      merchantId,
      excludedFromStats: false,
      ...(params.status && { status: params.status }),
      ...(Object.keys(createdAt).length > 0 && { createdAt }),
      ...(storeFilter || {}),
      ...(params.search && {
        OR: [
          { orderNumber: { contains: params.search, mode: 'insensitive' } },
          { customerName: { contains: params.search, mode: 'insensitive' } },
          { customerPhone: { contains: params.search } },
        ],
      }),
    };

    const integrations = await this.prisma.integration.findMany({
      where: { merchantId, isActive: true },
      select: {
        id: true,
        type: true,
        name: true,
        credentials: true,
        webhookUrl: true,
      },
    });

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

    const withStore = orders.map((o) => {
      const store = resolveOrderStore(o, integrations);
      return { ...o, storeKey: store.key, storeLabel: store.label };
    });

    return {
      orders: withStore,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
      stores: connectedStoreBuckets(integrations),
    };
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

    const merchant = await this.prisma.merchant.findUnique({ where: { id: merchantId } });
    if (merchant && (dto.status === 'VERIFIED' || dto.status === 'CANCELLED')) {
      await this.notifications.pushOrderUpdate(merchant, updated, {
        outcome: dto.status === 'VERIFIED' ? 'CONFIRMED' : 'CANCELLED',
        verifyStatus: dto.status === 'VERIFIED' ? 'verified' : 'cancelled',
      });
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

  async getStats(
    merchantId: string,
    opts?: { from?: string; to?: string; store?: string },
  ) {
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    let createdFilter: { gte?: Date; lte?: Date } | undefined;
    if (opts?.from && opts?.to) {
      createdFilter = {
        gte: new Date(`${opts.from.slice(0, 10)}T00:00:00+06:00`),
        lte: new Date(`${opts.to.slice(0, 10)}T23:59:59.999+06:00`),
      };
    }

    const integrations = await this.prisma.integration.findMany({
      where: { merchantId, isActive: true },
      select: {
        id: true,
        type: true,
        name: true,
        credentials: true,
        webhookUrl: true,
      },
    });

    const orders = await this.prisma.order.findMany({
      where: {
        merchantId,
        excludedFromStats: false,
        ...(createdFilter ? { createdAt: createdFilter } : {}),
      },
      select: {
        status: true,
        source: true,
        metadata: true,
        orderNumber: true,
        createdAt: true,
        manualComplete: true,
      },
    });

    const buckets = connectedStoreBuckets(integrations);
    const byStoreMap = new Map<
      string,
      {
        key: string;
        label: string;
        source: string;
        totalOrders: number;
        verifiedOrders: number;
        cancelledOrders: number;
        pendingOrders: number;
        manualCompleteOrders: number;
      }
    >();
    for (const b of buckets) {
      byStoreMap.set(b.key, {
        key: b.key,
        label: b.label,
        source: b.source,
        totalOrders: 0,
        verifiedOrders: 0,
        cancelledOrders: 0,
        pendingOrders: 0,
        manualCompleteOrders: 0,
      });
    }

    const matchesStore = (key: string, selected?: string) => {
      if (!selected || selected === 'all') return true;
      if (selected === 'shopin') return key === 'shopin' || key.startsWith('shopin:');
      return key === selected;
    };

    for (const o of orders) {
      const store = resolveOrderStore(o, integrations);
      let row = byStoreMap.get(store.key);
      if (!row) {
        row = {
          key: store.key,
          label: store.label,
          source: store.source,
          totalOrders: 0,
          verifiedOrders: 0,
          cancelledOrders: 0,
          pendingOrders: 0,
          manualCompleteOrders: 0,
        };
        byStoreMap.set(store.key, row);
      }
      row.totalOrders++;
      if (o.status === 'VERIFIED') row.verifiedOrders++;
      if (o.status === 'CANCELLED') row.cancelledOrders++;
      if (o.status === 'PENDING' || o.status === 'CALLING') row.pendingOrders++;
      if (o.manualComplete) row.manualCompleteOrders++;
    }

    const byStore = [...byStoreMap.values()]
      .map((s) => ({
        ...s,
        orderConfirmRate:
          s.totalOrders > 0
            ? Math.round((s.verifiedOrders / s.totalOrders) * 100)
            : 0,
      }))
      .sort((a, b) => b.totalOrders - a.totalOrders);

    const scoped = orders.filter((o) =>
      matchesStore(resolveOrderStore(o, integrations).key, opts?.store),
    );

    const total = scoped.length;
    const verified = scoped.filter((o) => o.status === 'VERIFIED').length;
    const cancelled = scoped.filter((o) => o.status === 'CANCELLED').length;
    const pending = scoped.filter((o) =>
      ['PENDING', 'CALLING'].includes(o.status),
    ).length;
    const manualComplete = scoped.filter((o) => o.manualComplete).length;
    const todayOrders = scoped.filter((o) => o.createdAt >= todayStart).length;

    const calls = await this.prisma.call.count({
      where: {
        merchantId,
        ...(createdFilter ? { createdAt: createdFilter } : {}),
      },
    });

    const orderConfirmRate =
      total > 0 ? Math.round((verified / total) * 100) : 0;

    return {
      totalOrders: total,
      verifiedOrders: verified,
      cancelledOrders: cancelled,
      pendingOrders: pending,
      todayOrders,
      manualCompleteOrders: manualComplete,
      orderConfirmRate,
      callSuccessRate: orderConfirmRate,
      totalCalls: calls,
      byStore,
      stores: buckets,
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
