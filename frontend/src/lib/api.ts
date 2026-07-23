import {
  DEMO_ADMIN_DASHBOARD,
  DEMO_BILLING_RECORDS,
  DEMO_CALL_ANALYTICS,
  DEMO_MERCHANTS,
  DEMO_PLANS,
  DEMO_PLATFORM_CONFIG,
  DEMO_SUBSCRIPTION,
  DEMO_SYSTEM_SETTINGS,
  OFFLINE_ADMIN,
} from './demo-data';
import { enableOfflineMode, getDemoMerchants, isOfflineMode, saveDemoMerchants } from './offline';

function resolveApiUrl(): string {
  if (typeof window !== 'undefined') {
    const host = window.location.hostname;
    if (host === 'app.maskara.bd' || host === 'maskara.bd' || host === 'www.maskara.bd') {
      return 'https://api.maskara.bd';
    }
  }
  return process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';
}

const API_URL = resolveApiUrl();

class ApiClient {
  private token: string | null = null;
  private backendAvailable: boolean | null = null;

  setToken(token: string | null) {
    this.token = token;
    if (typeof window !== 'undefined') {
      if (token) localStorage.setItem('token', token);
      else localStorage.removeItem('token');
    }
  }

  getToken() {
    if (this.token) return this.token;
    if (typeof window !== 'undefined') {
      return localStorage.getItem('token');
    }
    return null;
  }

  isOffline() {
    return isOfflineMode();
  }

  async checkBackend(): Promise<boolean> {
    if (isOfflineMode()) return false;
    try {
      const res = await fetch(`${API_URL}/health/live`, { signal: AbortSignal.timeout(5000) });
      this.backendAvailable = res.ok;
    } catch {
      this.backendAvailable = false;
    }
    return this.backendAvailable ?? false;
  }

  private async request<T>(path: string, options: RequestInit = {}): Promise<T> {
    if (isOfflineMode()) {
      return this.offlineRequest<T>(path, options);
    }

    const token = this.getToken();
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...(options.headers as Record<string, string>),
    };
    if (token) headers['Authorization'] = `Bearer ${token}`;

    let res: Response;
    try {
      res = await fetch(`${API_URL}${path}`, { ...options, headers });
    } catch {
      throw new Error('BACKEND_OFFLINE');
    }

    if (!res.ok) {
      const error = await res.json().catch(() => ({ message: 'Request failed' }));
      throw new Error(error.message || `HTTP ${res.status}`);
    }

    return res.json();
  }

  private offlineRequest<T>(path: string, options: RequestInit): T {
    const method = options.method || 'GET';
    const merchants = getDemoMerchants() || DEMO_MERCHANTS;

    if (path === '/admin/dashboard') return DEMO_ADMIN_DASHBOARD as T;
    if (path === '/admin/platform-status') {
      const cfg = DEMO_PLATFORM_CONFIG;
      return {
        voice: cfg.voice?.status || { epbx: false, ippbx: false, twilio: true },
        voiceProvider: cfg.voice?.provider || 'auto',
        payments: cfg.paymentGateways?.status || { bkash: false, nagad: false },
        merchants: {
          total: merchants.length,
          active: merchants.filter((m: AdminMerchantDetail) => m.status === 'ACTIVE').length,
          wooConnected: merchants.filter((m: AdminMerchantDetail) => m.wooConnected).length,
        },
        publicApiUrl: cfg.voice?.publicApiUrl,
      } as T;
    }
    if (path === '/admin/merchants' && method === 'POST') {
      const body = JSON.parse(options.body as string);
      const created: AdminMerchantDetail = {
        id: 'm-off-' + Date.now(),
        name: body.name,
        email: body.email,
        phone: body.phone,
        status: 'TRIAL',
        subscriptionPlan: body.planCode || 'FREE',
        createdAt: new Date().toISOString().slice(0, 10),
        wooConnected: false,
        apiKeyCount: 0,
        _count: { orders: 0, calls: 0, users: 1 },
      };
      saveDemoMerchants([created, ...merchants]);
      return created as T;
    }
    if (path.startsWith('/admin/merchants') && method === 'GET') {
      const detailMatch = path.match(/^\/admin\/merchants\/([^/]+)$/);
      if (detailMatch) {
        const m = merchants.find((x: AdminMerchantDetail) => x.id === detailMatch[1]);
        if (!m) throw new Error('Merchant not found');
        return m as T;
      }
      return { merchants, total: merchants.length } as T;
    }
    if (path.match(/\/admin\/merchants\/[^/]+\/status/) && method === 'PATCH') {
      const id = path.split('/')[3];
      const body = JSON.parse(options.body as string);
      const updated = merchants.map((m: { id: string }) =>
        m.id === id ? { ...m, status: body.status } : m,
      );
      saveDemoMerchants(updated);
      return updated.find((m: { id: string }) => m.id === id) as T;
    }
    if (path.startsWith('/admin/analytics/calls')) return DEMO_CALL_ANALYTICS as T;
    if (path === '/admin/settings') return DEMO_SYSTEM_SETTINGS as T;
    if (path === '/public/contact') {
      return {
        email: 'support@maskara.bd',
        phone: '+880 1XXX-XXXXXX',
        location: 'Dhaka, Bangladesh',
      } as T;
    }
    if (path.startsWith('/admin/settings/') && method === 'PATCH') {
      return { ok: true } as T;
    }
    if (path === '/admin/plans' && method === 'GET') return DEMO_PLANS as T;
    if (path.match(/\/admin\/plans\/[^/]+$/) && method === 'PATCH') {
      return { ok: true } as T;
    }
    if (path === '/admin/billing' && method === 'GET') {
      return { records: DEMO_BILLING_RECORDS, total: DEMO_BILLING_RECORDS.length } as T;
    }
    if (path.match(/\/admin\/billing\/[^/]+\/confirm/) && method === 'PATCH') {
      return { status: 'PAID' } as T;
    }
    if (path === '/admin/config' && method === 'GET') return DEMO_PLATFORM_CONFIG as T;
    if (path === '/admin/config' && method === 'PATCH') return { ok: true } as T;
    if (path.match(/\/admin\/merchants\/[^/]+\/plan/) && method === 'PATCH') {
      return { ok: true } as T;
    }
    if (path === '/subscriptions/plans') return DEMO_PLANS.filter((p) => p.isActive) as T;
    if (path === '/subscriptions/me') return DEMO_SUBSCRIPTION as T;
    if (path === '/integrations/woocommerce/status') {
      return {
        connected: false,
        integration: null,
        apiUrl: API_URL,
        webhookUrl: `${API_URL}/webhooks/woocommerce`,
        connectUrl: `${API_URL}/integrations/woocommerce/connect`,
        pluginVersion: '1.0.0',
      } as T;
    }
    if (path === '/integrations/woocommerce/disconnect' && method === 'DELETE') {
      return { ok: true } as T;
    }
    if (path === '/subscriptions/subscribe' && method === 'POST') {
      return {
        message: 'Subscription created. bKash/Nagad দিয়ে পেমেন্ট করুন।',
        paymentInstructions: { bKash: '01XXXXXXXXX', amount: 4999, reference: 'demo-ref' },
      } as T;
    }
    if (path === '/auth/me' && method === 'GET') {
      const email =
        (typeof window !== 'undefined' && localStorage.getItem('offlineAdminEmail')) ||
        OFFLINE_ADMIN.email;
      return {
        id: 'offline-admin',
        email,
        firstName: 'System',
        lastName: 'Admin',
        role: 'SUPER_ADMIN',
        emailVerified: true,
      } as T;
    }
    if (path === '/auth/me' && method === 'PATCH') {
      const body = JSON.parse(options.body as string);
      if (body.email && typeof window !== 'undefined') {
        localStorage.setItem('offlineAdminEmail', body.email);
      }
      return {
        id: 'offline-admin',
        email: body.email || OFFLINE_ADMIN.email,
        firstName: body.firstName || 'System',
        lastName: body.lastName || 'Admin',
        role: 'SUPER_ADMIN',
        emailVerified: true,
      } as T;
    }
    if (path === '/auth/change-password' && method === 'POST') {
      const body = JSON.parse(options.body as string);
      const email =
        (typeof window !== 'undefined' && localStorage.getItem('offlineAdminEmail')) ||
        OFFLINE_ADMIN.email;
      const current =
        (typeof window !== 'undefined' && localStorage.getItem('offlineAdminPassword')) ||
        OFFLINE_ADMIN.password;
      if (body.currentPassword !== current) throw new Error('Current password is incorrect');
      if (typeof window !== 'undefined') {
        localStorage.setItem('offlineAdminPassword', body.newPassword);
      }
      return { message: 'Password updated successfully' } as T;
    }

    throw new Error('Offline mode: endpoint not available');
  }

  async loginOffline(email: string, password: string) {
    const savedEmail =
      (typeof window !== 'undefined' && localStorage.getItem('offlineAdminEmail')) ||
      OFFLINE_ADMIN.email;
    const savedPassword =
      (typeof window !== 'undefined' && localStorage.getItem('offlineAdminPassword')) ||
      OFFLINE_ADMIN.password;
    if (email === savedEmail && password === savedPassword) {
      enableOfflineMode();
      saveDemoMerchants(DEMO_MERCHANTS);
      this.setToken('offline-demo-token');
      return {
        accessToken: 'offline-demo-token',
        refreshToken: 'offline',
        user: { id: 'offline-admin', email, role: 'SUPER_ADMIN', merchantId: null },
      };
    }
    throw new Error('ভুল email বা password');
  }

  // Auth
  register(data: Record<string, string>) {
    return this.request<{ accessToken: string; refreshToken: string }>('/auth/register', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  login(data: { email: string; password: string }) {
    return this.request<{ accessToken: string; refreshToken: string; user: Record<string, unknown> }>('/auth/login', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  getMe() {
    return this.request<AuthProfile>('/auth/me');
  }

  updateProfile(data: {
    email?: string;
    firstName?: string;
    lastName?: string;
    currentPassword?: string;
  }) {
    return this.request<AuthProfile>('/auth/me', {
      method: 'PATCH',
      body: JSON.stringify(data),
    });
  }

  changePassword(data: { currentPassword: string; newPassword: string }) {
    return this.request<{ message: string }>('/auth/change-password', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  // Orders
  getOrders(params?: Record<string, string>) {
    const query = params ? '?' + new URLSearchParams(params).toString() : '';
    return this.request<{
      orders: Order[];
      total: number;
      stores?: { key: string; label: string; source: string }[];
    }>(`/orders${query}`);
  }

  getOrderStats(from?: string, to?: string, store?: string) {
    const params = new URLSearchParams();
    if (from && to) {
      params.set('from', from);
      params.set('to', to);
    }
    if (store && store !== 'all') params.set('store', store);
    const q = params.toString() ? `?${params}` : '';
    return this.request<OrderStats>(`/orders/stats${q}`);
  }

  getOrder(id: string) {
    return this.request<Order>(`/orders/${id}`);
  }

  retryCall(orderId: string) {
    return this.request(`/orders/${orderId}/retry-call`, { method: 'POST' });
  }

  updateOrderStatus(orderId: string, status: string) {
    return this.request(`/orders/${orderId}/status`, {
      method: 'PATCH',
      body: JSON.stringify({ status }),
    });
  }

  // Calls
  getCalls(params?: Record<string, string>) {
    const query = params ? '?' + new URLSearchParams(params).toString() : '';
    return this.request<{
      calls: Call[];
      total: number;
      merchantVoice?: { voiceId?: string; voiceLabel?: string; voiceProvider?: string };
    }>(`/calls${query}`);
  }

  getCallAnalytics(days = 30) {
    return this.request(`/calls/analytics?days=${days}`);
  }

  // Reports
  getDailyReport(days = 30, from?: string, to?: string, store?: string) {
    const params = new URLSearchParams();
    if (from && to) {
      params.set('from', from);
      params.set('to', to);
    } else {
      params.set('days', String(days));
    }
    if (store && store !== 'all') params.set('store', store);
    return this.request<DailyReport[]>(`/reports/daily?${params}`);
  }

  getReportSummary() {
    return this.request<ReportSummary>('/reports/summary');
  }

  // Merchant
  getMerchant() {
    return this.request<Merchant>('/merchants/me');
  }

  updateMerchant(data: Record<string, unknown>) {
    return this.request<Merchant>('/merchants/me', { method: 'PATCH', body: JSON.stringify(data) });
  }

  // API Keys
  getApiKeys() {
    return this.request<ApiKey[]>('/api-keys');
  }

  createApiKey(name: string) {
    return this.request<{ key: string }>('/api-keys', {
      method: 'POST',
      body: JSON.stringify({ name }),
    });
  }

  revokeApiKey(id: string) {
    return this.request(`/api-keys/${id}`, { method: 'DELETE' });
  }

  // Integrations
  getIntegrations() {
    return this.request<Integration[]>('/integrations');
  }

  getWooCommerceStatus() {
    return this.request<WooCommerceStatus>('/integrations/woocommerce/status');
  }

  disconnectWooCommerce() {
    return this.request('/integrations/woocommerce/disconnect', { method: 'DELETE' });
  }

  getShopInStatus() {
    return this.request<ShopInStatus>('/integrations/shopin/status');
  }

  disconnectShopIn() {
    return this.request('/integrations/shopin/disconnect', { method: 'DELETE' });
  }

  bindShopIn(data: { shopId?: string; callbackUrl?: string; webhookSecret?: string; shopName?: string }) {
    return this.request('/integrations/shopin/bind', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  getWebhookSecret() {
    return this.request<{ webhookSecret: string; webhookUrl?: string | null; created: boolean }>(
      '/merchants/me/webhook-secret',
    );
  }

  regenerateWebhookSecret() {
    return this.request<{ webhookSecret: string; webhookUrl?: string | null; created: boolean }>(
      '/merchants/me/webhook-secret/regenerate',
      { method: 'POST' },
    );
  }

  // Admin
  getAdminDashboard() {
    return this.request<AdminDashboard>('/admin/dashboard');
  }

  getAdminMerchants(params?: Record<string, string>) {
    const query = params ? '?' + new URLSearchParams(params).toString() : '';
    return this.request<{ merchants: AdminMerchantDetail[]; total: number }>(`/admin/merchants${query}`);
  }

  getAdminMerchantDetail(merchantId: string) {
    return this.request<AdminMerchantDetail>(`/admin/merchants/${merchantId}`);
  }

  createAdminMerchant(data: { name: string; email: string; phone: string; password: string; planCode?: string }) {
    return this.request<AdminMerchantDetail>('/admin/merchants', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  getPlatformStatus() {
    return this.request<PlatformStatus>('/admin/platform-status');
  }

  updateMerchantStatus(merchantId: string, status: string) {
    return this.request(`/admin/merchants/${merchantId}/status`, {
      method: 'PATCH',
      body: JSON.stringify({ status }),
    });
  }

  getAdminCallAnalytics(days = 30) {
    return this.request<AdminCallAnalytics>(`/admin/analytics/calls?days=${days}`);
  }

  getSystemSettings() {
    return this.request<SystemSetting[]>('/admin/settings');
  }

  getPublicContact() {
    return this.request<PublicContact>('/public/contact');
  }

  updateSystemSetting(key: string, value: unknown) {
    return this.request(`/admin/settings/${key}`, {
      method: 'PATCH',
      body: JSON.stringify({ value }),
    });
  }

  getAdminPlans() {
    return this.request<Plan[]>('/admin/plans');
  }

  updateAdminPlan(id: string, data: Partial<Plan>) {
    return this.request<Plan>(`/admin/plans/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    });
  }

  assignMerchantPlan(merchantId: string, planCode: string, markPaid = true) {
    return this.request(`/admin/merchants/${merchantId}/plan`, {
      method: 'PATCH',
      body: JSON.stringify({ planCode, markPaid }),
    });
  }

  getAdminBilling(params?: Record<string, string>) {
    const query = params ? '?' + new URLSearchParams(params).toString() : '';
    return this.request<{ records: BillingRecord[]; total: number }>(`/admin/billing${query}`);
  }

  confirmBilling(billingId: string, paymentRef?: string) {
    return this.request(`/admin/billing/${billingId}/confirm`, {
      method: 'PATCH',
      body: JSON.stringify({ paymentRef }),
    });
  }

  rejectBilling(billingId: string, reason?: string) {
    return this.request(`/admin/billing/${billingId}/reject`, {
      method: 'PATCH',
      body: JSON.stringify({ reason }),
    });
  }

  getBkashPortalCredentials() {
    return this.request<{
      loginUrl: string;
      username: string;
      password: string;
      connected: boolean;
    }>('/admin/payment/bkash-portal');
  }

  getPlatformConfig() {
    return this.request<PlatformConfig>('/admin/config');
  }

  updatePlatformConfig(data: Record<string, unknown>) {
    return this.request('/admin/config', {
      method: 'PATCH',
      body: JSON.stringify(data),
    });
  }

  getVoiceProvider() {
    return this.request<VoiceProviderInfo>('/voice/provider');
  }

  previewVoice(text: string, voiceId?: string | null, speechRate?: number | null) {
    return this.request<{
      mimeType: string;
      audioBase64: string;
      engine: string;
      voice: string;
    }>('/voice/preview', {
      method: 'POST',
      body: JSON.stringify({ text, voiceId, speechRate }),
    });
  }

  getEpbxProbe() {
    return this.request<EpbxProbe>('/voice/epbx-probe');
  }

  testEpbxCall(phone: string, message?: string) {
    return this.request<{ success: boolean; message: string; callId?: string; details?: unknown }>('/voice/test-call', {
      method: 'POST',
      body: JSON.stringify({ phone, message }),
    });
  }

  getSubscriptionPlans() {
    return this.request<Plan[]>('/subscriptions/plans');
  }

  getMySubscription() {
    return this.request<MerchantSubscription>('/subscriptions/me');
  }

  subscribeToPlan(planCode: string, paymentMethod = 'bkash_manual') {
    return this.request<SubscribeResult>('/subscriptions/subscribe', {
      method: 'POST',
      body: JSON.stringify({ planCode, paymentMethod }),
    });
  }

  submitBkashManual(data: {
    planCode: string;
    trxId: string;
    senderPhone: string;
    amount: number;
    autoVerify?: boolean;
  }) {
    return this.request<SubscribeResult & { status?: string }>(
      '/subscriptions/bkash-manual',
      {
        method: 'POST',
        body: JSON.stringify({ autoVerify: true, ...data }),
      },
    );
  }

  initiatePayment(planCode: string, provider: 'bkash' | 'nagad') {
    return this.request<PaymentInitResult>('/payments/initiate', {
      method: 'POST',
      body: JSON.stringify({ planCode, provider }),
    });
  }

  forgotPassword(email: string) {
    return this.request<{ message: string }>('/auth/forgot-password', {
      method: 'POST',
      body: JSON.stringify({ email }),
    });
  }
}

export const api = new ApiClient();

export interface AuthProfile {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  phone?: string | null;
  role: string;
  emailVerified?: boolean;
  lastLoginAt?: string | null;
  createdAt?: string;
}

export interface Order {
  id: string;
  orderNumber: string;
  customerName: string;
  customerPhone: string;
  totalAmount: number;
  status: string;
  source?: string;
  callAttempts?: number;
  paymentMethod?: string;
  createdAt: string;
  manualComplete?: boolean;
  excludedFromStats?: boolean;
  storeKey?: string;
  storeLabel?: string;
  metadata?: Record<string, unknown>;
  calls?: Call[];
}

export interface Call {
  id: string;
  status: string;
  outcome?: string;
  dtmfInput?: string;
  duration?: number;
  recordingUrl?: string;
  provider?: string | null;
  attemptNumber?: number;
  errorMessage?: string | null;
  voiceId?: string;
  voiceLabel?: string;
  voiceProvider?: string;
  spokenScript?: string;
  createdAt: string;
  order?: Partial<Order>;
}

export interface StoreStat {
  key: string;
  label: string;
  source: string;
  totalOrders: number;
  verifiedOrders: number;
  cancelledOrders: number;
  pendingOrders: number;
  manualCompleteOrders?: number;
  orderConfirmRate: number;
}

export interface OrderStats {
  totalOrders: number;
  verifiedOrders: number;
  cancelledOrders: number;
  pendingOrders: number;
  todayOrders: number;
  manualCompleteOrders?: number;
  orderConfirmRate?: number;
  callSuccessRate: number;
  totalCalls: number;
  byStore?: StoreStat[];
  stores?: { key: string; label: string; source: string }[];
}

export interface DailyReport {
  date: string;
  ordersReceived: number;
  ordersVerified: number;
  ordersCancelled: number;
  callsMade: number;
  callsSuccess?: number;
  verificationRate: number;
  callSuccessRate?: number;
}

export interface ReportSummary {
  last30Days: {
    ordersReceived?: number | null;
    ordersVerified?: number | null;
    ordersCancelled?: number | null;
    callsMade?: number | null;
    callsSuccess?: number | null;
    smsSent?: number | null;
  };
  ordersByStatus: { status: string; count: number }[];
  callsByOutcome: { outcome: string | null; count: number }[];
  avgCallDuration?: number;
}

export interface Merchant {
  id: string;
  name: string;
  storeNameBangla?: string;
  email: string;
  phone: string;
  subscriptionPlan: string;
  status: string;
  customGreeting?: string | null;
  voiceId?: string | null;
  speechRate?: number | null;
  voiceLanguage?: string;
  maxCallRetries?: number;
  retryIntervalMin?: number;
  callWindowStartMin?: number;
  callWindowEndMin?: number;
  dailyCallLimit?: number;
  lifetimeCallLimit?: number;
  firstHourCallLimit?: number;
}

export interface ApiKey {
  id: string;
  name: string;
  keyPrefix: string;
  isActive: boolean;
  lastUsedAt?: string;
  createdAt: string;
}

export interface AdminMerchant {
  id: string;
  name: string;
  email: string;
  status: string;
  subscriptionPlan: string;
  _count: { orders: number; calls: number };
}

export interface AdminDashboard {
  totalMerchants: number;
  activeMerchants: number;
  totalOrders: number;
  totalCalls: number;
  monthlyRevenue: number;
  totalRevenuePaid?: number;
  pendingPayments?: number;
  recentMerchants: AdminMerchant[];
  planDistribution?: { plan: string; count: number; revenue: number }[];
}

export interface Plan {
  id: string;
  code: string;
  name: string;
  nameBangla?: string;
  description?: string;
  priceMonthly: number | string;
  callLimit: number;
  smsLimit: number;
  trialDays?: number;
  features: string[] | unknown;
  isActive: boolean;
  isPopular?: boolean;
  sortOrder?: number;
}

export interface BillingRecord {
  id: string;
  merchantId: string;
  planCode: string;
  amount: number | string;
  status: 'PENDING' | 'PAID' | 'FAILED' | 'REFUNDED';
  paymentMethod?: string;
  paymentRef?: string;
  notes?: string | null;
  createdAt: string;
  merchant?: { id: string; name: string; email: string };
}

export interface PlatformConfig {
  plans?: Plan[];
  voice?: {
    provider: string;
    publicApiUrl?: string;
    status?: { epbx: boolean; ippbx: boolean; twilio: boolean; googleTts?: boolean };
    epbx?: {
      enabled?: boolean;
      configured?: boolean;
      apiUrl?: string;
      apiKey?: string;
      apiKeySet?: boolean;
      customerId?: string;
      ivrId?: string;
    };
    googleTts?: {
      enabled?: boolean;
      configured?: boolean;
      apiKey?: string;
      apiKeySet?: boolean;
    };
    ippbx?: {
      enabled?: boolean;
      configured?: boolean;
      apiUrl?: string;
      apiKey?: string;
      apiKeySet?: boolean;
      apiSecret?: string;
      apiSecretSet?: boolean;
    };
  };
  payment?: {
    bKashNumber?: string;
    nagadNumber?: string;
    instructions?: string;
    bkashPortal?: {
      username?: string;
      password?: string;
      passwordSet?: boolean;
      loginUrl?: string;
    };
  };
  paymentGateways?: {
    status?: { bkash: boolean; nagad: boolean };
    bkash?: {
      enabled?: boolean;
      sandbox?: boolean;
      configured?: boolean;
      baseUrl?: string;
      username?: string;
      merchantNumber?: string;
      appKey?: string;
      appKeySet?: boolean;
      appSecret?: string;
      appSecretSet?: boolean;
      password?: string;
      passwordSet?: boolean;
    };
    nagad?: {
      enabled?: boolean;
      sandbox?: boolean;
      configured?: boolean;
      baseUrl?: string;
      merchantId?: string;
      merchantNumber?: string;
      publicKey?: string;
      publicKeySet?: boolean;
      privateKey?: string;
      privateKeySet?: boolean;
    };
  };
  platform?: { name?: string };
  maintenance?: { enabled?: boolean };
  [key: string]: unknown;
}

export interface MerchantSubscription {
  merchant: {
    id: string;
    name: string;
    status: string;
    subscriptionPlan: string;
    subscriptionEnds?: string;
  };
  currentPlan?: Plan;
  availablePlans: Plan[];
  billingHistory: BillingRecord[];
  payment?: {
    bKashNumber?: string;
    nagadNumber?: string;
    instructions?: string;
  };
  usage?: {
    callsUsed: number;
    callLimit: number;
    ordersUsed?: number;
    orderLimit?: number;
    smsUsed: number;
    smsLimit: number;
    callsRemaining: number;
    ordersRemaining?: number;
  } | null;
}

export interface SubscribeResult {
  message: string;
  paymentInstructions?: { bKash?: string; nagad?: string; amount: number; reference: string };
}

export interface PaymentInitResult {
  sessionId: string;
  paymentUrl: string;
  amount: number;
  provider: string;
  billingId: string;
  message: string;
}

export interface Integration {
  id: string;
  type: string;
  name: string;
  isActive: boolean;
  lastSyncAt?: string;
  credentials?: Record<string, unknown>;
}

export interface WooCommerceStatus {
  connected: boolean;
  integration: {
    id?: string;
    name?: string;
    storeUrl?: string;
    storeName?: string;
    pluginVersion?: string;
    connectedAt?: string;
    lastSyncAt?: string;
    isActive?: boolean;
  } | null;
  apiUrl: string;
  webhookUrl: string;
  connectUrl: string;
  pluginVersion: string;
}

export interface ShopInStatus {
  connected: boolean;
  integration: {
    id?: string;
    name?: string;
    shopId?: string;
    shopName?: string;
    storeUrl?: string;
    callbackUrl?: string;
    connectedAt?: string;
    lastSyncAt?: string;
    isActive?: boolean;
  } | null;
  apiUrl: string;
  inboundWebhookUrl: string;
  connectUrl: string;
  pingUrl: string;
  merchantWebhookUrl: string | null;
}

export interface AdminMerchantDetail {
  id: string;
  name: string;
  email: string;
  phone: string;
  status: string;
  subscriptionPlan: string;
  createdAt: string;
  storeNameBangla?: string;
  wooConnected?: boolean;
  storeCount?: number;
  storeLabels?: string[];
  apiKeyCount?: number;
  integration?: {
    type?: string;
    name?: string;
    storeUrl?: string;
    storeName?: string;
    lastSyncAt?: string;
    pluginVersion?: string;
    credentials?: Record<string, unknown>;
  } | null;
  apiKeys?: Array<{ id: string; name: string; keyPrefix: string; isActive: boolean; lastUsedAt?: string; createdAt: string }>;
  _count: { orders: number; calls: number; users: number };
}

export interface PlatformStatus {
  voice: { epbx: boolean; ippbx: boolean; twilio: boolean };
  voiceProvider?: string;
  payments: { bkash: boolean; nagad: boolean };
  merchants: { total: number; active: number; wooConnected: number; storesConnected?: number };
  publicApiUrl?: string;
}

export interface VoiceProviderInfo {
  provider: string;
  active?: boolean;
  epbx?: boolean | {
    configured: boolean;
    enabled: boolean;
    apiUrl: string;
    webhooks: { general: string; dtmf: string; status: string };
  };
  configured?: boolean;
  estimatedRateBdt?: string;
  googleTts?: boolean;
  googleTtsConfigured?: boolean;
  recommendedVoice?: string;
  publicApiUrl?: string;
}

export interface EpbxProbe {
  apiUrl: string;
  apiKeySet: boolean;
  customerId: string | null;
  ivrId: string | null;
  webhooks: { general: string; dtmf: string; status: string };
  probe: Array<{ path: string; status: number; ok: boolean; preview: string }>;
  dashboard: { login: string; home: string; developer: string; ivr: string };
}

export interface AdminCallAnalytics {
  total: number;
  completed: number;
  confirmed: number;
  successRate: number;
  confirmationRate: number;
}

export interface SystemSetting {
  id: string;
  key: string;
  value: Record<string, unknown>;
}

export interface PublicContact {
  email: string;
  phone: string;
  location: string;
}
