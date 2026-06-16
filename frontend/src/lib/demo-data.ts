import type {
  AdminCallAnalytics,
  AdminDashboard,
  AdminMerchantDetail,
  BillingRecord,
  MerchantSubscription,
  Plan,
  PlatformConfig,
  SystemSetting,
} from './api';

export const DEMO_ADMIN_DASHBOARD: AdminDashboard = {
  totalMerchants: 156,
  activeMerchants: 134,
  totalOrders: 45230,
  totalCalls: 38920,
  monthlyRevenue: 485000,
  totalRevenuePaid: 1250000,
  pendingPayments: 3,
  planDistribution: [
    { plan: 'FREE', count: 45, revenue: 0 },
    { plan: 'STARTER', count: 62, revenue: 123938 },
    { plan: 'GROWTH', count: 38, revenue: 189962 },
    { plan: 'ENTERPRISE', count: 11, revenue: 550000 },
  ],
  recentMerchants: [
    { id: '1', name: 'Fashion Hub BD', email: 'info@fashionhub.bd', status: 'ACTIVE', subscriptionPlan: 'GROWTH', _count: { orders: 1234, calls: 1100 } },
    { id: '2', name: 'Gadget Zone', email: 'sales@gadgetzone.bd', status: 'ACTIVE', subscriptionPlan: 'STARTER', _count: { orders: 567, calls: 490 } },
    { id: '3', name: 'Demo Store', email: 'demo@store.com', status: 'ACTIVE', subscriptionPlan: 'GROWTH', _count: { orders: 890, calls: 780 } },
    { id: '4', name: 'Organic Foods', email: 'hello@organic.bd', status: 'TRIAL', subscriptionPlan: 'FREE', _count: { orders: 45, calls: 38 } },
    { id: '5', name: 'COD Express', email: 'admin@codexpress.bd', status: 'SUSPENDED', subscriptionPlan: 'STARTER', _count: { orders: 120, calls: 95 } },
  ],
};

export const DEMO_MERCHANTS: AdminMerchantDetail[] = [
  { id: 'm-demo', name: 'Demo Fashion Store', email: 'demo@store.com', phone: '+8801712345678', status: 'ACTIVE', subscriptionPlan: 'GROWTH', createdAt: '2025-01-15', wooConnected: true, apiKeyCount: 1, integration: { storeUrl: 'https://filobeauty.xyz', storeName: 'Demo Fashion Store' }, apiKeys: [{ id: 'k-demo', name: 'WooCommerce', keyPrefix: 'mk_demo', isActive: true, createdAt: '2025-01-15' }], _count: { orders: 890, calls: 780, users: 3 } },
  { id: 'm-1', name: 'Fashion Hub BD', email: 'info@fashionhub.bd', phone: '+8801711111111', status: 'ACTIVE', subscriptionPlan: 'GROWTH', createdAt: '2025-02-01', wooConnected: false, apiKeyCount: 0, _count: { orders: 1234, calls: 1100, users: 2 } },
  { id: 'm-2', name: 'Gadget Zone', email: 'sales@gadgetzone.bd', phone: '+8801722222222', status: 'ACTIVE', subscriptionPlan: 'STARTER', createdAt: '2025-02-10', wooConnected: false, apiKeyCount: 0, _count: { orders: 567, calls: 490, users: 1 } },
  { id: 'm-3', name: 'COD Express', email: 'admin@codexpress.bd', phone: '+8801744444444', status: 'SUSPENDED', subscriptionPlan: 'STARTER', createdAt: '2025-03-01', wooConnected: false, apiKeyCount: 0, _count: { orders: 120, calls: 95, users: 1 } },
];

export const DEMO_CALL_ANALYTICS: AdminCallAnalytics = {
  total: 38920,
  completed: 33471,
  confirmed: 24134,
  successRate: 86,
  confirmationRate: 62,
};

export const DEMO_SYSTEM_SETTINGS: SystemSetting[] = [
  { id: '1', key: 'platform', value: { name: 'Maskara' } },
  { id: '2', key: 'maintenance', value: { enabled: false } },
  { id: '3', key: 'voice', value: { language: 'bn-BD', maxRetries: 3, retryIntervalMin: 30 } },
  { id: '4', key: 'channels', value: { twilio: true, sms: true, whatsapp: false } },
];

export const OFFLINE_ADMIN = {
  email: 'admin@maskara.bd',
  password: 'Admin@123',
};

export const DEMO_PLANS: Plan[] = [
  { id: 'p1', code: 'FREE', name: 'Free Trial', nameBangla: 'ফ্রি ট্রায়াল', description: '১৪ দিন ট্রায়াল', priceMonthly: 0, callLimit: 50, smsLimit: 20, trialDays: 14, features: ['Bangla AI Voice', 'Shopify', 'WooCommerce'], isActive: true, sortOrder: 1 },
  { id: 'p2', code: 'STARTER', name: 'Starter', nameBangla: 'স্টার্টার', description: 'ছোট দোকান', priceMonthly: 1999, callLimit: 300, smsLimit: 100, features: ['Call Recording', 'SMS', 'API'], isActive: true, sortOrder: 2 },
  { id: 'p3', code: 'GROWTH', name: 'Growth', nameBangla: 'গ্রোথ', description: 'বড় দোকান', priceMonthly: 4999, callLimit: 1000, smsLimit: 500, features: ['WhatsApp', 'Reports', 'Priority Support'], isActive: true, isPopular: true, sortOrder: 3 },
  { id: 'p4', code: 'ENTERPRISE', name: 'Enterprise', nameBangla: 'এন্টারপ্রাইজ', description: 'আনলিমিটেড', priceMonthly: 14999, callLimit: 10000, smsLimit: 5000, features: ['Unlimited', 'White-label', 'SLA'], isActive: true, sortOrder: 4 },
];

export const DEMO_BILLING_RECORDS: BillingRecord[] = [
  { id: 'b1', merchantId: 'm-2', planCode: 'STARTER', amount: 1999, status: 'PENDING', paymentMethod: 'bKash', createdAt: '2025-06-01', merchant: { id: 'm-2', name: 'Gadget Zone', email: 'sales@gadgetzone.bd' } },
  { id: 'b2', merchantId: 'm-1', planCode: 'GROWTH', amount: 4999, status: 'PAID', paymentMethod: 'bKash', paymentRef: 'BKH123456', createdAt: '2025-06-01', merchant: { id: 'm-1', name: 'Fashion Hub BD', email: 'info@fashionhub.bd' } },
  { id: 'b3', merchantId: 'm-demo', planCode: 'GROWTH', amount: 4999, status: 'PAID', paymentMethod: 'Nagad', paymentRef: 'NGD789', createdAt: '2025-05-15', merchant: { id: 'm-demo', name: 'Demo Store', email: 'demo@store.com' } },
];

export const DEMO_PLATFORM_CONFIG: PlatformConfig = {
  plans: DEMO_PLANS,
  voice: {
    provider: 'auto',
    publicApiUrl: 'http://localhost:4000',
    status: { epbx: false, ippbx: false, twilio: true },
    epbx: {
      enabled: true,
      configured: false,
      apiUrl: 'https://maskara.epbx.bd/api/v1',
      apiKey: '',
      apiKeySet: false,
      customerId: '',
      ivrId: '',
    },
    ippbx: {
      enabled: true,
      configured: false,
      apiUrl: '',
      apiKey: '',
      apiKeySet: false,
      apiSecret: '',
      apiSecretSet: false,
    },
  },
  payment: { bKashNumber: '01700000000', nagadNumber: '01800000000', instructions: 'Send Money করুন এবং reference হিসেবে Billing ID দিন।' },
  paymentGateways: {
    status: { bkash: false, nagad: false },
    bkash: { enabled: true, sandbox: true, configured: false, username: '', appKey: '', appKeySet: false, appSecret: '', appSecretSet: false, password: '', passwordSet: false, baseUrl: '' },
    nagad: { enabled: true, sandbox: true, configured: false, merchantId: '', merchantNumber: '', publicKey: '', publicKeySet: false, privateKey: '', privateKeySet: false, baseUrl: '' },
  },
  platform: { name: 'Maskara' },
  maintenance: { enabled: false },
};

export const DEMO_SUBSCRIPTION: MerchantSubscription = {
  merchant: { id: 'm-demo', name: 'Demo Store', status: 'ACTIVE', subscriptionPlan: 'GROWTH', subscriptionEnds: '2025-07-15' },
  currentPlan: DEMO_PLANS[2],
  availablePlans: DEMO_PLANS,
  billingHistory: DEMO_BILLING_RECORDS.filter((b) => b.merchantId === 'm-demo'),
  usage: { callsUsed: 420, callLimit: 1000, smsUsed: 85, smsLimit: 500, callsRemaining: 580 },
};
