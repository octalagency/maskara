import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { PlansService } from '../plans/plans.service';
import { SubscriptionsService } from '../subscriptions/subscriptions.service';
import { VoiceSettingsService } from '../voice/voice-settings.service';
import { PaymentSettingsService } from '../payments/payment-settings.service';

@Injectable()
export class AdminService {
  constructor(
    private prisma: PrismaService,
    private plans: PlansService,
    private subscriptions: SubscriptionsService,
    private voiceSettings: VoiceSettingsService,
    private paymentSettings: PaymentSettingsService,
  ) {}

  async getDashboard() {
    const [
      totalMerchants,
      activeMerchants,
      totalOrders,
      totalCalls,
      subscriptions,
      recentMerchants,
      pendingBilling,
      totalRevenue,
    ] = await Promise.all([
      this.prisma.merchant.count(),
      this.prisma.merchant.count({ where: { status: 'ACTIVE' } }),
      this.prisma.order.count(),
      this.prisma.call.count(),
      this.prisma.subscription.groupBy({
        by: ['plan'],
        where: { isActive: true },
        _count: true,
        _sum: { price: true },
      }),
      this.prisma.merchant.findMany({
        take: 10,
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          name: true,
          email: true,
          status: true,
          subscriptionPlan: true,
          subscriptionEnds: true,
          createdAt: true,
          _count: { select: { orders: true, calls: true } },
        },
      }),
      this.prisma.billingRecord.count({ where: { status: 'PENDING' } }),
      this.prisma.billingRecord.aggregate({
        where: { status: 'PAID' },
        _sum: { amount: true },
      }),
    ]);

    const revenue = subscriptions.reduce(
      (sum, s) => sum + Number(s._sum.price || 0),
      0,
    );

    return {
      totalMerchants,
      activeMerchants,
      totalOrders,
      totalCalls,
      monthlyRevenue: revenue,
      totalRevenuePaid: Number(totalRevenue._sum.amount || 0),
      pendingPayments: pendingBilling,
      planDistribution: subscriptions.map((s) => ({
        plan: s.plan,
        count: s._count,
        revenue: Number(s._sum.price || 0),
      })),
      recentMerchants,
    };
  }

  async getMerchants(page = 1, limit = 20, search?: string) {
    const pageNum = Math.max(1, Number(page) || 1);
    const limitNum = Math.min(100, Math.max(1, Number(limit) || 20));
    const skip = (pageNum - 1) * limitNum;
    const where = search
      ? {
          OR: [
            { name: { contains: search, mode: 'insensitive' as const } },
            { email: { contains: search, mode: 'insensitive' as const } },
          ],
        }
      : {};

    const [merchants, total] = await Promise.all([
      this.prisma.merchant.findMany({
        where,
        include: {
          _count: { select: { orders: true, calls: true, users: true, apiKeys: true } },
          integrations: { where: { isActive: true }, take: 3 },
          subscriptions: { where: { isActive: true }, take: 1 },
          billingRecords: { orderBy: { createdAt: 'desc' }, take: 1 },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limitNum,
      }),
      this.prisma.merchant.count({ where }),
    ]);

    return {
      merchants: merchants.map((m) => {
        const stores = m.integrations.filter((i) => i.isActive);
        const woo = stores.find((i) => i.type === 'WOOCOMMERCE');
        const shopin = stores.find(
          (i) =>
            i.type === 'CUSTOM_API' &&
            (i.name.startsWith('ShopIn') ||
              (i.credentials as { provider?: string } | null)?.provider ===
                'shopin'),
        );
        const shopify = stores.find((i) => i.type === 'SHOPIFY');
        const connected = stores.filter(
          (i) =>
            i.type === 'WOOCOMMERCE' ||
            i.type === 'SHOPIFY' ||
            (i.type === 'CUSTOM_API' &&
              (i.name.startsWith('ShopIn') ||
                (i.credentials as { provider?: string } | null)?.provider ===
                  'shopin')),
        );
        return {
          ...m,
          wooConnected: connected.length > 0,
          storeCount: connected.length,
          storeLabels: connected.map((i) => {
            if (i.type === 'WOOCOMMERCE') return 'WordPress';
            if (i.type === 'SHOPIFY') return 'Shopify';
            if (i.name.startsWith('ShopIn') || (i.credentials as { provider?: string })?.provider === 'shopin')
              return 'ShopIn';
            return i.name;
          }),
          apiKeyCount: m._count.apiKeys,
          integration: woo || shopin || shopify || null,
        };
      }),
      total,
      page: pageNum,
      limit: limitNum,
    };
  }

  async createMerchant(data: {
    name: string;
    email: string;
    phone: string;
    password: string;
    planCode?: string;
  }) {
    const existing = await this.prisma.user.findUnique({ where: { email: data.email } });
    if (existing) throw new ConflictException('Email already registered');

    const bcrypt = await import('bcrypt');
    const passwordHash = await bcrypt.hash(data.password, 12);
    const slug =
      data.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '') +
      '-' +
      Date.now().toString(36);
    const planCode = (data.planCode || 'FREE') as 'FREE' | 'STARTER' | 'GROWTH' | 'ENTERPRISE';

    const merchant = await this.prisma.merchant.create({
      data: {
        name: data.name,
        slug,
        email: data.email,
        phone: data.phone,
        status: 'TRIAL',
        subscriptionPlan: planCode,
        subscriptionEnds: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
        users: {
          create: {
            email: data.email,
            passwordHash,
            firstName: data.name,
            lastName: data.name,
            phone: data.phone,
            role: 'MERCHANT_OWNER',
          },
        },
        subscriptions: {
          create: {
            plan: planCode,
            price: 0,
            callLimit: 50,
            smsLimit: 20,
            startsAt: new Date(),
            endsAt: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
          },
        },
      },
      include: {
        _count: { select: { orders: true, calls: true, users: true, apiKeys: true } },
        integrations: true,
      },
    });

    return { ...merchant, wooConnected: false, apiKeyCount: 0 };
  }

  async getPlatformStatus() {
    const [merchantCount, activeCount, storeCount, voice, paymentGateways] =
      await Promise.all([
        this.prisma.merchant.count(),
        this.prisma.merchant.count({ where: { status: 'ACTIVE' } }),
        // Woo + ShopIn + Shopify — all store connections
        this.prisma.integration.count({
          where: {
            isActive: true,
            OR: [
              { type: 'WOOCOMMERCE' },
              { type: 'SHOPIFY' },
              { type: 'CUSTOM_API', name: { startsWith: 'ShopIn' } },
            ],
          },
        }),
        this.voiceSettings.getPublicConfig(),
        this.paymentSettings.getPublicConfig(),
      ]);

    return {
      voice: voice.status,
      voiceProvider: voice.provider,
      payments: paymentGateways.status,
      merchants: {
        total: merchantCount,
        active: activeCount,
        wooConnected: storeCount,
        storesConnected: storeCount,
      },
      publicApiUrl: voice.publicApiUrl,
    };
  }

  async getMerchantDetail(merchantId: string) {
    const merchant = await this.prisma.merchant.findUnique({
      where: { id: merchantId },
      include: {
        users: { select: { id: true, email: true, role: true, lastLoginAt: true } },
        subscriptions: { orderBy: { createdAt: 'desc' }, take: 5 },
        billingRecords: { orderBy: { createdAt: 'desc' }, take: 10 },
        integrations: { where: { isActive: true } },
        apiKeys: { select: { id: true, name: true, keyPrefix: true, isActive: true, lastUsedAt: true, createdAt: true } },
        _count: { select: { orders: true, calls: true, apiKeys: true } },
      },
    });
    if (!merchant) throw new NotFoundException('Merchant not found');
    return {
      ...merchant,
      wooConnected: merchant.integrations.some(
        (i) =>
          i.isActive &&
          (i.type === 'WOOCOMMERCE' ||
            i.type === 'SHOPIFY' ||
            (i.type === 'CUSTOM_API' &&
              (i.name.startsWith('ShopIn') ||
                (i.credentials as { provider?: string } | null)?.provider ===
                  'shopin'))),
      ),
      storeCount: merchant.integrations.filter(
        (i) =>
          i.isActive &&
          (i.type === 'WOOCOMMERCE' ||
            i.type === 'SHOPIFY' ||
            (i.type === 'CUSTOM_API' &&
              (i.name.startsWith('ShopIn') ||
                (i.credentials as { provider?: string } | null)?.provider ===
                  'shopin'))),
      ).length,
      storeLabels: merchant.integrations
        .filter((i) => i.isActive)
        .map((i) => {
          if (i.type === 'WOOCOMMERCE') return 'WordPress';
          if (i.type === 'SHOPIFY') return 'Shopify';
          if (
            i.name.startsWith('ShopIn') ||
            (i.credentials as { provider?: string })?.provider === 'shopin'
          )
            return 'ShopIn';
          return i.name;
        })
        .filter((label, idx, arr) =>
          ['WordPress', 'Shopify', 'ShopIn'].includes(label)
            ? arr.indexOf(label) === idx || true
            : true,
        ),
      apiKeyCount: merchant._count.apiKeys,
      integration:
        merchant.integrations.find((i) => i.type === 'WOOCOMMERCE') ||
        merchant.integrations.find(
          (i) =>
            i.type === 'CUSTOM_API' &&
            (i.name.startsWith('ShopIn') ||
              (i.credentials as { provider?: string } | null)?.provider ===
                'shopin'),
        ) ||
        null,
    };
  }

  async updateMerchantStatus(merchantId: string, status: string) {
    return this.prisma.merchant.update({
      where: { id: merchantId },
      data: { status: status as 'ACTIVE' | 'SUSPENDED' | 'TRIAL' | 'CANCELLED' },
    });
  }

  async assignMerchantPlan(
    merchantId: string,
    planCode: string,
    markPaid = true,
  ) {
    if (markPaid) {
      return this.plans.assignPlanToMerchant(merchantId, planCode, {
        paymentMethod: 'admin',
        markPaid: true,
        adminNote: 'Granted by Super Admin (Paid)',
      });
    }
    // Pending: billing only — merchant plan activates after payment confirm
    return this.plans.createPendingBilling(merchantId, planCode, {
      paymentMethod: 'admin_pending',
      notes: 'Granted by Super Admin (awaiting payment)',
    });
  }

  // --- Plans CRUD ---
  getPlans() {
    return this.plans.findAll();
  }

  createPlan(data: Prisma.PlanCreateInput) {
    return this.plans.create(data);
  }

  updatePlan(id: string, data: Prisma.PlanUpdateInput) {
    return this.plans.update(id, data);
  }

  // --- Billing ---
  async getBillingRecords(page = 1, limit = 20, status?: string) {
    const pageNum = Math.max(1, Number(page) || 1);
    const limitNum = Math.min(100, Math.max(1, Number(limit) || 20));
    const skip = (pageNum - 1) * limitNum;
    const where = status
      ? { status: status as 'PENDING' | 'PAID' | 'FAILED' | 'REFUNDED' }
      : {};

    const [records, total] = await Promise.all([
      this.prisma.billingRecord.findMany({
        where,
        include: {
          merchant: { select: { id: true, name: true, email: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limitNum,
      }),
      this.prisma.billingRecord.count({ where }),
    ]);

    return { records, total, page: pageNum, limit: limitNum };
  }

  confirmBilling(billingId: string, paymentRef?: string) {
    return this.subscriptions.confirmPayment(billingId, paymentRef);
  }

  rejectBilling(billingId: string, reason?: string) {
    return this.subscriptions.rejectBilling(billingId, reason);
  }

  async getBkashPortalCredentials() {
    const row = await this.prisma.systemSetting.findUnique({
      where: { key: 'payment' },
    });
    const p = (row?.value as Record<string, unknown>) || {};
    const portal = (p.bkashPortal as Record<string, unknown>) || {};
    return {
      loginUrl: 'https://merchantportal.bkash.com/login',
      username: String(portal.username || ''),
      password: String(portal.password || ''),
      connected: Boolean(portal.username && portal.password),
    };
  }

  async getCallAnalytics(days = 30) {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    const calls = await this.prisma.call.findMany({
      where: { createdAt: { gte: startDate } },
      select: { status: true, outcome: true, duration: true, createdAt: true },
    });

    const total = calls.length;
    const completed = calls.filter((c) => c.status === 'COMPLETED').length;
    const confirmed = calls.filter((c) => c.outcome === 'CONFIRMED').length;

    return {
      total,
      completed,
      confirmed,
      successRate: total > 0 ? Math.round((completed / total) * 100) : 0,
      confirmationRate: completed > 0 ? Math.round((confirmed / completed) * 100) : 0,
    };
  }

  async getPlatformConfig() {
    const [settings, plans, voice, paymentGateways] = await Promise.all([
      this.prisma.systemSetting.findMany(),
      this.plans.findAll(),
      this.voiceSettings.getPublicConfig(),
      this.paymentSettings.getPublicConfig(),
    ]);

    const config: Record<string, unknown> = { plans, voice, paymentGateways };
    for (const s of settings) {
      if (s.key === 'voice_providers' || s.key === 'payment_gateways') continue;
      // Do not overwrite voice provider/TTS public config with SystemSetting "voice"
      // (language / maxRetries) — that wiped googleTts status in Super Admin UI.
      if (s.key === 'voice') {
        config.voiceDefaults = s.value;
        continue;
      }
      if (s.key === 'payment') {
        const p = (s.value as Record<string, unknown>) || {};
        const portal = (p.bkashPortal as Record<string, unknown>) || {};
        config.payment = {
          bKashNumber: p.bKashNumber || '',
          nagadNumber: p.nagadNumber || '',
          instructions: p.instructions || '',
          bkashPortal: {
            username: portal.username || '',
            passwordSet: Boolean(portal.password),
            password: portal.password ? '••••••••' : '',
            loginUrl: 'https://merchantportal.bkash.com/login',
          },
        };
        continue;
      }
      config[s.key] = s.value;
    }
    return config;
  }

  async updatePlatformConfig(updates: Record<string, unknown>) {
    const results = [];

    if (updates.voice_providers) {
      const saved = await this.voiceSettings.saveConfig(
        updates.voice_providers as never,
      );
      results.push({ key: 'voice_providers', value: saved });
    }

    if (updates.payment_gateways) {
      const saved = await this.paymentSettings.saveConfig(
        updates.payment_gateways as never,
      );
      results.push({ key: 'payment_gateways', value: saved });
    }

    if (updates.payment) {
      const existing = await this.prisma.systemSetting.findUnique({
        where: { key: 'payment' },
      });
      const prev = (existing?.value as Record<string, unknown>) || {};
      const next = updates.payment as Record<string, unknown>;
      const prevPortal =
        (prev.bkashPortal as Record<string, unknown>) || {};
      const nextPortal =
        (next.bkashPortal as Record<string, unknown>) || {};
      const incomingPass = String(nextPortal.password || '');
      const keepPass =
        !incomingPass || incomingPass.startsWith('••••')
          ? prevPortal.password
          : incomingPass;

      const merged = {
        ...prev,
        ...next,
        bkashPortal: {
          ...prevPortal,
          ...nextPortal,
          password: keepPass,
          username: nextPortal.username ?? prevPortal.username ?? '',
        },
      };

      results.push(
        await this.prisma.systemSetting.upsert({
          where: { key: 'payment' },
          create: { key: 'payment', value: merged as Prisma.InputJsonValue },
          update: { value: merged as Prisma.InputJsonValue },
        }),
      );
    }

    for (const [key, value] of Object.entries(updates)) {
      if (
        [
          'plans',
          'voice',
          'voice_providers',
          'payment',
          'payment_gateways',
          'paymentGateways',
        ].includes(key)
      ) {
        continue;
      }
      results.push(
        await this.prisma.systemSetting.upsert({
          where: { key },
          create: { key, value: value as Prisma.InputJsonValue },
          update: { value: value as Prisma.InputJsonValue },
        }),
      );
    }
    return results;
  }

  getSystemSettings() {
    return this.prisma.systemSetting.findMany();
  }

  updateSystemSetting(key: string, value: unknown) {
    return this.prisma.systemSetting.upsert({
      where: { key },
      create: { key, value: value as Prisma.InputJsonValue },
      update: { value: value as Prisma.InputJsonValue },
    });
  }
}
