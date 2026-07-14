#!/usr/bin/env node
/**
 * Maskara standalone API — no Docker, no npm install needed.
 * Run: node standalone-api/server.js
 */
const http = require('http');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const { URL } = require('url');

function loadEnvFile() {
  const envPath = path.join(__dirname, '..', '.env');
  if (!fs.existsSync(envPath)) return;
  for (const line of fs.readFileSync(envPath, 'utf8').split('\n')) {
    const t = line.trim();
    if (!t || t.startsWith('#')) continue;
    const i = t.indexOf('=');
    if (i < 1) continue;
    const key = t.slice(0, i).trim();
    const val = t.slice(i + 1).trim();
    if (!process.env[key]) process.env[key] = val;
  }
}
loadEnvFile();

const DATA_DIR = path.join(__dirname, 'data');
const SETTINGS_FILE = path.join(DATA_DIR, 'local-settings.json');

function loadPersistedSettings() {
  try {
    if (!fs.existsSync(SETTINGS_FILE)) return null;
    return JSON.parse(fs.readFileSync(SETTINGS_FILE, 'utf8'));
  } catch {
    return null;
  }
}

function savePersistedSettings() {
  try {
    if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
    fs.writeFileSync(SETTINGS_FILE, JSON.stringify({
      voice_providers: settings.voice_providers,
      payment_gateways: settings.payment_gateways,
      payment: settings.payment,
      adminCredentials: settings.adminCredentials,
      publicApiUrl: settings.voice_providers?.publicApiUrl,
      updatedAt: new Date().toISOString(),
    }, null, 2));
  } catch (e) {
    console.warn('Could not save local settings:', e.message);
  }
}

function getPublicApiUrl() {
  return (
    settings.voice_providers?.publicApiUrl ||
    process.env.PUBLIC_API_URL ||
    process.env.API_URL ||
    `http://localhost:${PORT}`
  ).replace(/\/$/, '');
}

function getEpbxConfig() {
  const vp = settings.voice_providers || {};
  return {
    provider: vp.provider || process.env.VOICE_PROVIDER || 'auto',
    apiUrl: (vp.epbx?.apiUrl || process.env.EPBX_API_URL || 'https://epbx.bd/api/v1').replace(/\/$/, ''),
    apiKey: vp.epbx?.apiKey || process.env.EPBX_API_KEY || '',
    customerId: vp.epbx?.customerId || process.env.EPBX_CUSTOMER_ID || '',
    ivrId: vp.epbx?.ivrId || process.env.EPBX_IVR_ID || '',
    enabled: vp.epbx?.enabled !== false,
  };
}

function normalizeBdPhone(phone) {
  const digits = String(phone || '').replace(/\D/g, '');
  if (digits.startsWith('880')) return `+${digits}`;
  if (digits.startsWith('0')) return `+88${digits}`;
  if (digits.length === 10) return `+880${digits}`;
  return phone.startsWith('+') ? phone : `+${digits}`;
}

const PORT = process.env.PORT || 4000;
const JWT_SECRET = process.env.JWT_SECRET || 'maskara-standalone-dev-secret';

const USERS = {
  'demo@store.com': { password: 'Demo@123', role: 'MERCHANT_OWNER', name: 'Demo Merchant', merchantId: 'm-demo' },
};

let settings = {
  platform: { name: 'Maskara' },
  maintenance: { enabled: false },
  voice: { language: 'bn-BD', maxRetries: 3, retryIntervalMin: 30 },
  channels: { twilio: true, sms: true, whatsapp: false },
  adminCredentials: {
    email: 'admin@maskara.bd',
    password: 'Admin@123',
    firstName: 'System',
    lastName: 'Admin',
  },
  payment: { bKashNumber: '01700000000', nagadNumber: '01800000000', instructions: 'Send Money করুন এবং reference হিসেবে Billing ID দিন।' },
  payment_gateways: {
    bkash: { enabled: true, sandbox: true, username: '', appKey: '', appSecret: '', password: '', baseUrl: '' },
    nagad: { enabled: true, sandbox: true, merchantId: '', merchantNumber: '', publicKey: '', privateKey: '', baseUrl: '' },
  },
  voice_providers: {
    provider: process.env.VOICE_PROVIDER || 'auto',
    publicApiUrl: process.env.PUBLIC_API_URL || process.env.API_URL || 'http://localhost:4000',
    epbx: {
      enabled: true,
      apiUrl: process.env.EPBX_API_URL || 'https://epbx.bd/api/v1',
      apiKey: process.env.EPBX_API_KEY || '',
      customerId: process.env.EPBX_CUSTOMER_ID || '',
      ivrId: process.env.EPBX_IVR_ID || '',
    },
    ippbx: {
      enabled: true,
      apiUrl: process.env.IPPBX_API_URL || '',
      apiKey: process.env.IPPBX_API_KEY || '',
      apiSecret: process.env.IPPBX_API_SECRET || '',
    },
  },
};

const persisted = loadPersistedSettings();
if (persisted?.voice_providers) {
  settings.voice_providers = {
    ...settings.voice_providers,
    ...persisted.voice_providers,
    epbx: { ...settings.voice_providers.epbx, ...persisted.voice_providers.epbx },
    ippbx: { ...settings.voice_providers.ippbx, ...persisted.voice_providers.ippbx },
  };
}
if (persisted?.payment_gateways) settings.payment_gateways = persisted.payment_gateways;
if (persisted?.payment) settings.payment = { ...settings.payment, ...persisted.payment };
if (persisted?.adminCredentials) {
  settings.adminCredentials = { ...settings.adminCredentials, ...persisted.adminCredentials };
}

function syncAdminUser() {
  const admin = settings.adminCredentials;
  USERS[admin.email] = {
    password: admin.password,
    role: 'SUPER_ADMIN',
    name: `${admin.firstName || 'System'} ${admin.lastName || 'Admin'}`.trim(),
  };
}
syncAdminUser();

let merchants = [
  { id: 'm-demo', name: 'Demo Fashion Store', email: 'demo@store.com', phone: '+8801712345678', status: 'ACTIVE', subscriptionPlan: 'GROWTH', createdAt: '2025-01-15', _count: { orders: 890, calls: 780, users: 3 } },
  { id: 'm-1', name: 'Fashion Hub BD', email: 'info@fashionhub.bd', phone: '+8801711111111', status: 'ACTIVE', subscriptionPlan: 'GROWTH', createdAt: '2025-02-01', _count: { orders: 1234, calls: 1100, users: 2 } },
  { id: 'm-2', name: 'Gadget Zone', email: 'sales@gadgetzone.bd', phone: '+8801722222222', status: 'ACTIVE', subscriptionPlan: 'STARTER', createdAt: '2025-02-10', _count: { orders: 567, calls: 490, users: 1 } },
  { id: 'm-3', name: 'COD Express', email: 'admin@codexpress.bd', phone: '+8801744444444', status: 'SUSPENDED', subscriptionPlan: 'STARTER', createdAt: '2025-03-01', _count: { orders: 120, calls: 95, users: 1 } },
];

let callLogs = [];

function maskSecret(v) {
  if (!v) return '';
  return v.length <= 4 ? '••••' : '••••••••' + v.slice(-4);
}

function getPaymentPublicConfig() {
  const pg = settings.payment_gateways || {};
  const bkashKey = pg.bkash?.appKey || process.env.BKASH_APP_KEY || '';
  const bkashSecret = pg.bkash?.appSecret || process.env.BKASH_APP_SECRET || '';
  const bkashPass = pg.bkash?.password || process.env.BKASH_PASSWORD || '';
  const nagadPrivate = pg.nagad?.privateKey || process.env.NAGAD_PRIVATE_KEY || '';
  const nagadPublic = pg.nagad?.publicKey || process.env.NAGAD_PUBLIC_KEY || '';
  const bkashConfigured = Boolean(bkashKey && bkashSecret && (pg.bkash?.username || process.env.BKASH_USERNAME));
  const nagadConfigured = Boolean((pg.nagad?.merchantId || process.env.NAGAD_MERCHANT_ID) && nagadPrivate);
  return {
    status: { bkash: bkashConfigured, nagad: nagadConfigured },
    bkash: {
      enabled: pg.bkash?.enabled ?? true,
      sandbox: pg.bkash?.sandbox ?? true,
      configured: bkashConfigured,
      username: pg.bkash?.username || process.env.BKASH_USERNAME || '',
      merchantNumber: pg.bkash?.merchantNumber || '',
      appKey: bkashKey ? maskSecret(bkashKey) : '',
      appKeySet: Boolean(bkashKey),
      appSecret: bkashSecret ? maskSecret(bkashSecret) : '',
      appSecretSet: Boolean(bkashSecret),
      password: bkashPass ? maskSecret(bkashPass) : '',
      passwordSet: Boolean(bkashPass),
      baseUrl: pg.bkash?.baseUrl || '',
    },
    nagad: {
      enabled: pg.nagad?.enabled ?? true,
      sandbox: pg.nagad?.sandbox ?? true,
      configured: nagadConfigured,
      merchantId: pg.nagad?.merchantId || process.env.NAGAD_MERCHANT_ID || '',
      merchantNumber: pg.nagad?.merchantNumber || process.env.NAGAD_MERCHANT_NUMBER || '',
      publicKey: nagadPublic ? maskSecret(nagadPublic) : '',
      publicKeySet: Boolean(nagadPublic),
      privateKey: nagadPrivate ? maskSecret(nagadPrivate) : '',
      privateKeySet: Boolean(nagadPrivate),
      baseUrl: pg.nagad?.baseUrl || '',
    },
  };
}

function getVoicePublicConfig() {
  const vp = settings.voice_providers || {};
  const epbxKey = vp.epbx?.apiKey || process.env.EPBX_API_KEY || '';
  const ippbxKey = vp.ippbx?.apiKey || process.env.IPPBX_API_KEY || '';
  const ippbxSecret = vp.ippbx?.apiSecret || process.env.IPPBX_API_SECRET || '';
  const twilioSid = process.env.TWILIO_ACCOUNT_SID || '';
  return {
    provider: vp.provider || process.env.VOICE_PROVIDER || 'auto',
    publicApiUrl: vp.publicApiUrl || getPublicApiUrl(),
    epbx: {
      enabled: vp.epbx?.enabled ?? true,
      configured: Boolean(epbxKey),
      apiUrl: vp.epbx?.apiUrl || 'https://epbx.bd/api/v1',
      apiKey: epbxKey ? maskSecret(epbxKey) : '',
      apiKeySet: Boolean(epbxKey),
      customerId: vp.epbx?.customerId || '',
      ivrId: vp.epbx?.ivrId || '',
    },
    ippbx: {
      enabled: vp.ippbx?.enabled ?? true,
      configured: Boolean(vp.ippbx?.apiUrl && ippbxKey),
      apiUrl: vp.ippbx?.apiUrl || '',
      apiKey: ippbxKey ? maskSecret(ippbxKey) : '',
      apiKeySet: Boolean(ippbxKey),
      apiSecret: ippbxSecret ? maskSecret(ippbxSecret) : '',
      apiSecretSet: Boolean(ippbxSecret),
    },
    twilio: {
      configured: Boolean(twilioSid),
      accountSid: twilioSid,
      authTokenSet: Boolean(process.env.TWILIO_AUTH_TOKEN),
    },
    status: {
      epbx: Boolean(epbxKey),
      ippbx: Boolean(vp.ippbx?.apiUrl && ippbxKey),
      twilio: Boolean(twilioSid),
    },
  };
}

const PLANS = [
  { id: 'p1', code: 'FREE', name: 'Free Trial', nameBangla: 'ফ্রি ট্রায়াল', priceMonthly: 0, callLimit: 50, smsLimit: 20, trialDays: 14, features: ['Bangla AI Voice', 'Shopify', 'WooCommerce'], isActive: true, sortOrder: 1 },
  { id: 'p2', code: 'STARTER', name: 'Starter', nameBangla: 'স্টার্টার', priceMonthly: 1999, callLimit: 300, smsLimit: 100, features: ['Call Recording', 'SMS', 'API'], isActive: true, sortOrder: 2 },
  { id: 'p3', code: 'GROWTH', name: 'Growth', nameBangla: 'গ্রোথ', priceMonthly: 4999, callLimit: 1000, smsLimit: 500, features: ['WhatsApp', 'Reports'], isActive: true, isPopular: true, sortOrder: 3 },
  { id: 'p4', code: 'ENTERPRISE', name: 'Enterprise', nameBangla: 'এন্টারপ্রাইজ', priceMonthly: 14999, callLimit: 10000, smsLimit: 5000, features: ['Unlimited', 'White-label'], isActive: true, sortOrder: 4 },
];

let billingRecords = [
  { id: 'b1', merchantId: 'm-2', planCode: 'STARTER', amount: 1999, status: 'PENDING', paymentMethod: 'bKash', createdAt: '2025-06-01T00:00:00Z', merchant: { id: 'm-2', name: 'Gadget Zone', email: 'sales@gadgetzone.bd' } },
  { id: 'b2', merchantId: 'm-1', planCode: 'GROWTH', amount: 4999, status: 'PAID', paymentMethod: 'bKash', paymentRef: 'BKH123', createdAt: '2025-06-01T00:00:00Z', merchant: { id: 'm-1', name: 'Fashion Hub BD', email: 'info@fashionhub.bd' } },
  { id: 'b3', merchantId: 'm-demo', planCode: 'GROWTH', amount: 4999, status: 'PAID', paymentMethod: 'Nagad', paymentRef: 'NGD789', createdAt: '2025-05-15T00:00:00Z', merchant: { id: 'm-demo', name: 'Demo Fashion Store', email: 'demo@store.com' } },
];

function b64url(data) {
  return Buffer.from(JSON.stringify(data)).toString('base64url');
}

function signToken(payload) {
  const header = b64url({ alg: 'HS256', typ: 'JWT' });
  const body = b64url({ ...payload, exp: Date.now() + 7 * 86400000 });
  const sig = crypto.createHmac('sha256', JWT_SECRET).update(`${header}.${body}`).digest('base64url');
  return `${header}.${body}.${sig}`;
}

function verifyToken(token) {
  if (!token) return null;
  const parts = token.replace('Bearer ', '').split('.');
  if (parts.length !== 3) return null;
  const [header, body, sig] = parts;
  const expected = crypto.createHmac('sha256', JWT_SECRET).update(`${header}.${body}`).digest('base64url');
  if (sig !== expected) return null;
  try {
    const payload = JSON.parse(Buffer.from(body, 'base64url').toString());
    if (payload.exp < Date.now()) return null;
    return payload;
  } catch {
    return null;
  }
}

let apiKeys = [
  { id: 'k-demo', merchantId: 'm-demo', name: 'WooCommerce Demo', key: 'mk_demo_woocommerce_key_change_me', keyPrefix: 'mk_demo', isActive: true, createdAt: new Date().toISOString() },
];
let wooIntegrations = {
  'm-demo': {
    id: 'int-demo',
    type: 'WOOCOMMERCE',
    name: 'WooCommerce',
    isActive: true,
    lastSyncAt: new Date().toISOString(),
    credentials: { storeUrl: 'https://filobeauty.xyz', storeName: 'Demo Fashion Store', pluginVersion: '1.0.1' },
  },
};
let wooOrders = [];

function getMerchantIntegration(merchantId) {
  const integ = wooIntegrations[merchantId];
  if (!integ || !integ.isActive) return { wooConnected: false, integration: null };
  const creds = integ.credentials || {};
  return {
    wooConnected: true,
    integration: {
      type: 'WOOCOMMERCE',
      name: integ.name,
      storeUrl: creds.storeUrl,
      storeName: creds.storeName,
      lastSyncAt: integ.lastSyncAt,
      pluginVersion: creds.pluginVersion,
    },
  };
}

function enrichMerchant(m) {
  const integ = getMerchantIntegration(m.id);
  const keys = apiKeys.filter((k) => k.merchantId === m.id);
  return {
    ...m,
    ...integ,
    apiKeyCount: keys.length,
    apiKeys: keys.map(({ key, ...rest }) => rest),
  };
}

function validateApiKey(req) {
  const key = req.headers['x-api-key'];
  if (!key) return null;
  const found = apiKeys.find((k) => k.key === key && k.isActive);
  return found ? { id: found.merchantId, merchantId: found.merchantId } : null;
}

function getMerchantId(auth) {
  if (!auth) return null;
  return USERS[auth.email]?.merchantId || null;
}

function json(res, status, data) {
  res.writeHead(status, {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET,POST,PATCH,DELETE,OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-API-Key',
  });
  res.end(JSON.stringify(data));
}

function readBody(req) {
  return new Promise((resolve) => {
    let data = '';
    req.on('data', (c) => (data += c));
    req.on('end', () => {
      try { resolve(JSON.parse(data || '{}')); } catch { resolve({}); }
    });
  });
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://localhost:${PORT}`);
  const path = url.pathname;
  const method = req.method;

  if (method === 'OPTIONS') return json(res, 200, {});

  if (path === '/health') return json(res, 200, { status: 'ok', service: 'maskara-standalone-api' });

  if ((path === '/downloads/maskara-woocommerce.zip' || path === '/api/download/woocommerce-plugin') && method === 'GET') {
    const zipPath = require('path').join(__dirname, '..', 'frontend', 'public', 'downloads', 'maskara-woocommerce.zip');
    if (!fs.existsSync(zipPath)) {
      return json(res, 404, { message: 'Plugin zip not found. Run: ./scripts/build-woo-plugin.sh' });
    }
    const data = fs.readFileSync(zipPath);
    res.writeHead(200, {
      'Content-Type': 'application/zip',
      'Content-Disposition': 'attachment; filename="maskara-woocommerce.zip"',
      'Access-Control-Allow-Origin': '*',
    });
    res.end(data);
    return;
  }

  if (path === '/docs' && method === 'GET') {
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    res.end(`<!DOCTYPE html><html><head><meta charset="utf-8"><title>Maskara API</title>
<style>body{font-family:system-ui;max-width:600px;margin:40px auto;padding:0 20px}
a.btn{display:inline-block;background:#2563eb;color:#fff;padding:12px 24px;border-radius:8px;text-decoration:none;margin:8px 0}
code{background:#f1f5f9;padding:2px 6px;border-radius:4px}</style></head>
<body><h1>Maskara API</h1>
<p><a class="btn" href="/downloads/maskara-woocommerce.zip">⬇ WooCommerce Plugin Download</a></p>
<p>Merchant panel: <a href="http://localhost:3002/dashboard/integrations">localhost:3002</a></p>
<p>API Key demo: <code>mk_demo_woocommerce_key_change_me</code></p>
<hr><p>POST /auth/login · GET /integrations/woocommerce/ping</p></body></html>`);
    return;
  }

  if (path === '/auth/login' && method === 'POST') {
    const body = await readBody(req);
    const user = USERS[body.email];
    if (!user || user.password !== body.password) {
      return json(res, 401, { message: 'Invalid credentials' });
    }
    const token = signToken({ sub: body.email, email: body.email, role: user.role });
    return json(res, 200, {
      accessToken: token,
      refreshToken: crypto.randomUUID(),
      user: { email: body.email, role: user.role, merchantId: user.merchantId || null },
    });
  }

  const auth = verifyToken(req.headers.authorization);
  const isAdmin = auth && (auth.role === 'SUPER_ADMIN' || auth.role === 'ADMIN');

  if (path === '/auth/me' && method === 'GET') {
    if (!auth) return json(res, 401, { message: 'Unauthorized' });
    const admin = settings.adminCredentials;
    if (auth.role === 'SUPER_ADMIN' || auth.role === 'ADMIN') {
      return json(res, 200, {
        id: 'admin-local',
        email: admin.email,
        firstName: admin.firstName || 'System',
        lastName: admin.lastName || 'Admin',
        role: auth.role,
        emailVerified: true,
      });
    }
    const merchantUser = USERS[auth.email];
    return json(res, 200, {
      id: auth.sub || auth.email,
      email: auth.email,
      firstName: merchantUser?.name?.split(' ')[0] || 'Merchant',
      lastName: merchantUser?.name?.split(' ').slice(1).join(' ') || '',
      role: auth.role,
      emailVerified: true,
      merchantId: merchantUser?.merchantId || null,
    });
  }

  if (path === '/auth/me' && method === 'PATCH') {
    if (!auth) return json(res, 401, { message: 'Unauthorized' });
    if (auth.role !== 'SUPER_ADMIN' && auth.role !== 'ADMIN') {
      return json(res, 403, { message: 'Forbidden' });
    }
    const body = await readBody(req);
    const admin = settings.adminCredentials;
    if (body.email && body.email !== admin.email) {
      if (!body.currentPassword || body.currentPassword !== admin.password) {
        return json(res, 401, { message: 'Current password is incorrect' });
      }
      if (USERS[body.email]) return json(res, 409, { message: 'Email already in use' });
      delete USERS[admin.email];
      admin.email = body.email;
    }
    if (body.firstName !== undefined) admin.firstName = body.firstName;
    if (body.lastName !== undefined) admin.lastName = body.lastName;
    syncAdminUser();
    savePersistedSettings();
    return json(res, 200, {
      id: 'admin-local',
      email: admin.email,
      firstName: admin.firstName,
      lastName: admin.lastName,
      role: 'SUPER_ADMIN',
      emailVerified: true,
    });
  }

  if (path === '/auth/change-password' && method === 'POST') {
    if (!auth) return json(res, 401, { message: 'Unauthorized' });
    if (auth.role !== 'SUPER_ADMIN' && auth.role !== 'ADMIN') {
      return json(res, 403, { message: 'Forbidden' });
    }
    const body = await readBody(req);
    const admin = settings.adminCredentials;
    if (!body.currentPassword || body.currentPassword !== admin.password) {
      return json(res, 401, { message: 'Current password is incorrect' });
    }
    if (!body.newPassword || String(body.newPassword).length < 8) {
      return json(res, 400, { message: 'New password must be at least 8 characters' });
    }
    admin.password = body.newPassword;
    syncAdminUser();
    savePersistedSettings();
    return json(res, 200, { message: 'Password updated successfully' });
  }

  if (path === '/admin/dashboard' && method === 'GET') {
    if (!isAdmin) return json(res, 401, { message: 'Unauthorized' });
    const active = merchants.filter((m) => m.status === 'ACTIVE').length;
    return json(res, 200, {
      totalMerchants: merchants.length,
      activeMerchants: active,
      totalOrders: merchants.reduce((s, m) => s + m._count.orders, 0),
      totalCalls: merchants.reduce((s, m) => s + m._count.calls, 0),
      monthlyRevenue: 485000,
      totalRevenuePaid: billingRecords.filter((b) => b.status === 'PAID').reduce((s, b) => s + b.amount, 0),
      pendingPayments: billingRecords.filter((b) => b.status === 'PENDING').length,
      recentMerchants: merchants.slice(0, 5),
      planDistribution: [
        { plan: 'FREE', count: 1, revenue: 0 },
        { plan: 'STARTER', count: 2, revenue: 123938 },
        { plan: 'GROWTH', count: 2, revenue: 189962 },
      ],
    });
  }

  if (path === '/admin/platform-status' && method === 'GET') {
    if (!isAdmin) return json(res, 401, { message: 'Unauthorized' });
    const voice = getVoicePublicConfig();
    const pg = getPaymentPublicConfig();
    const connectedStores = merchants.filter((m) => getMerchantIntegration(m.id).wooConnected).length;
    return json(res, 200, {
      voice: voice.status,
      voiceProvider: voice.provider,
      payments: pg.status,
      merchants: {
        total: merchants.length,
        active: merchants.filter((m) => m.status === 'ACTIVE').length,
        wooConnected: connectedStores,
      },
      publicApiUrl: voice.publicApiUrl,
    });
  }

  if (path === '/admin/merchants' && method === 'POST') {
    if (!isAdmin) return json(res, 401, { message: 'Unauthorized' });
    const body = await readBody(req);
    if (!body.name || !body.email || !body.phone || !body.password) {
      return json(res, 400, { message: 'name, email, phone, password required' });
    }
    if (USERS[body.email]) return json(res, 409, { message: 'Email already exists' });
    const id = 'm-' + Date.now().toString(36);
    const merchant = {
      id,
      name: body.name,
      email: body.email,
      phone: body.phone,
      status: body.status || 'TRIAL',
      subscriptionPlan: body.planCode || 'FREE',
      createdAt: new Date().toISOString().slice(0, 10),
      _count: { orders: 0, calls: 0, users: 1 },
    };
    merchants.unshift(merchant);
    USERS[body.email] = {
      password: body.password,
      role: 'MERCHANT_OWNER',
      name: body.name,
      merchantId: id,
    };
    return json(res, 201, enrichMerchant(merchant));
  }

  if (path === '/admin/merchants' && method === 'GET') {
    if (!isAdmin) return json(res, 401, { message: 'Unauthorized' });
    return json(res, 200, { merchants: merchants.map(enrichMerchant), total: merchants.length });
  }

  const merchantDetail = path.match(/^\/admin\/merchants\/([^/]+)$/);
  if (merchantDetail && method === 'GET') {
    if (!isAdmin) return json(res, 401, { message: 'Unauthorized' });
    const m = merchants.find((x) => x.id === merchantDetail[1]);
    if (!m) return json(res, 404, { message: 'Not found' });
    return json(res, 200, enrichMerchant(m));
  }

  const statusMatch = path.match(/^\/admin\/merchants\/([^/]+)\/status$/);
  if (statusMatch && method === 'PATCH') {
    if (!isAdmin) return json(res, 401, { message: 'Unauthorized' });
    const body = await readBody(req);
    const m = merchants.find((x) => x.id === statusMatch[1]);
    if (!m) return json(res, 404, { message: 'Not found' });
    m.status = body.status;
    return json(res, 200, m);
  }

  if (path === '/admin/analytics/calls' && method === 'GET') {
    if (!isAdmin) return json(res, 401, { message: 'Unauthorized' });
    return json(res, 200, { total: 3470, completed: 2985, confirmed: 2150, successRate: 86, confirmationRate: 62 });
  }

  if (path === '/admin/settings' && method === 'GET') {
    if (!isAdmin) return json(res, 401, { message: 'Unauthorized' });
    return json(res, 200, Object.entries(settings).map(([key, value]) => ({ id: key, key, value })));
  }

  const settingMatch = path.match(/^\/admin\/settings\/([^/]+)$/);
  if (settingMatch && method === 'PATCH') {
    if (!isAdmin) return json(res, 401, { message: 'Unauthorized' });
    const body = await readBody(req);
    settings[settingMatch[1]] = body.value;
    return json(res, 200, { key: settingMatch[1], value: body.value });
  }

  if (path === '/admin/plans' && method === 'GET') {
    if (!isAdmin) return json(res, 401, { message: 'Unauthorized' });
    return json(res, 200, PLANS);
  }

  const planMatch = path.match(/^\/admin\/plans\/([^/]+)$/);
  if (planMatch && method === 'PATCH') {
    if (!isAdmin) return json(res, 401, { message: 'Unauthorized' });
    const body = await readBody(req);
    const plan = PLANS.find((p) => p.id === planMatch[1]);
    if (!plan) return json(res, 404, { message: 'Not found' });
    Object.assign(plan, body);
    return json(res, 200, plan);
  }

  if (path === '/admin/billing' && method === 'GET') {
    if (!isAdmin) return json(res, 401, { message: 'Unauthorized' });
    const status = url.searchParams.get('status');
    const filtered = status ? billingRecords.filter((b) => b.status === status) : billingRecords;
    return json(res, 200, { records: filtered, total: filtered.length });
  }

  const billingConfirm = path.match(/^\/admin\/billing\/([^/]+)\/confirm$/);
  if (billingConfirm && method === 'PATCH') {
    if (!isAdmin) return json(res, 401, { message: 'Unauthorized' });
    const body = await readBody(req);
    const rec = billingRecords.find((b) => b.id === billingConfirm[1]);
    if (!rec) return json(res, 404, { message: 'Not found' });
    rec.status = 'PAID';
    rec.paymentRef = body.paymentRef || 'manual';
    const m = merchants.find((x) => x.id === rec.merchantId);
    if (m) { m.status = 'ACTIVE'; m.subscriptionPlan = rec.planCode; }
    return json(res, 200, rec);
  }

  if (path === '/admin/config' && method === 'GET') {
    if (!isAdmin) return json(res, 401, { message: 'Unauthorized' });
    return json(res, 200, {
      plans: PLANS,
      voice: getVoicePublicConfig(),
      paymentGateways: getPaymentPublicConfig(),
      payment: settings.payment,
      platform: settings.platform,
      maintenance: settings.maintenance,
    });
  }

  if (path === '/admin/config' && method === 'PATCH') {
    if (!isAdmin) return json(res, 401, { message: 'Unauthorized' });
    const body = await readBody(req);
    if (body.payment) settings.payment = { ...settings.payment, ...body.payment };
    if (body.payment_gateways) {
      const cur = settings.payment_gateways || {};
      const up = body.payment_gateways;
      const merged = {
        bkash: { ...cur.bkash, ...up.bkash },
        nagad: { ...cur.nagad, ...up.nagad },
      };
      const keep = (incoming, existing) => (!incoming || String(incoming).startsWith('••••') ? existing : incoming);
      merged.bkash.appKey = keep(up.bkash?.appKey, cur.bkash?.appKey);
      merged.bkash.appSecret = keep(up.bkash?.appSecret, cur.bkash?.appSecret);
      merged.bkash.password = keep(up.bkash?.password, cur.bkash?.password);
      merged.nagad.publicKey = keep(up.nagad?.publicKey, cur.nagad?.publicKey);
      merged.nagad.privateKey = keep(up.nagad?.privateKey, cur.nagad?.privateKey);
      settings.payment_gateways = merged;
    }
    if (body.voice_providers) {
      const cur = settings.voice_providers || {};
      const up = body.voice_providers;
      const merged = {
        provider: up.provider ?? cur.provider,
        publicApiUrl: up.publicApiUrl ?? cur.publicApiUrl,
        epbx: { ...cur.epbx, ...up.epbx },
        ippbx: { ...cur.ippbx, ...up.ippbx },
      };
      if (up.epbx?.apiKey?.startsWith('••••')) merged.epbx.apiKey = cur.epbx?.apiKey;
      if (!up.epbx?.apiKey) merged.epbx.apiKey = cur.epbx?.apiKey || '';
      if (up.ippbx?.apiKey?.startsWith('••••')) merged.ippbx.apiKey = cur.ippbx?.apiKey;
      if (!up.ippbx?.apiKey) merged.ippbx.apiKey = cur.ippbx?.apiKey || '';
      if (up.ippbx?.apiSecret?.startsWith('••••')) merged.ippbx.apiSecret = cur.ippbx?.apiSecret;
      if (!up.ippbx?.apiSecret) merged.ippbx.apiSecret = cur.ippbx?.apiSecret || '';
      settings.voice_providers = merged;
    }
    savePersistedSettings();
    return json(res, 200, { ok: true, voice: getVoicePublicConfig(), paymentGateways: getPaymentPublicConfig() });
  }

  const planAssign = path.match(/^\/admin\/merchants\/([^/]+)\/plan$/);
  if (planAssign && method === 'PATCH') {
    if (!isAdmin) return json(res, 401, { message: 'Unauthorized' });
    const body = await readBody(req);
    const m = merchants.find((x) => x.id === planAssign[1]);
    if (!m) return json(res, 404, { message: 'Not found' });
    m.subscriptionPlan = body.planCode;
    m.status = body.planCode === 'FREE' ? 'TRIAL' : 'ACTIVE';
    const plan = PLANS.find((p) => p.code === body.planCode);
    if (plan && Number(plan.priceMonthly) > 0 && !body.markPaid) {
      billingRecords.unshift({
        id: 'b' + Date.now(),
        merchantId: m.id,
        planCode: body.planCode,
        amount: plan.priceMonthly,
        status: 'PENDING',
        paymentMethod: 'admin_assign',
        createdAt: new Date().toISOString(),
        merchant: { id: m.id, name: m.name, email: m.email },
      });
    }
    return json(res, 200, { merchant: m, planCode: body.planCode });
  }

  if (path === '/subscriptions/plans' && method === 'GET') {
    return json(res, 200, PLANS.filter((p) => p.isActive));
  }

  if (path === '/subscriptions/me' && method === 'GET') {
    if (!auth) return json(res, 401, { message: 'Unauthorized' });
    const merchantId = USERS[auth.email]?.merchantId || 'm-demo';
    const m = merchants.find((x) => x.id === merchantId) || merchants[0];
    const plan = PLANS.find((p) => p.code === m.subscriptionPlan);
    return json(res, 200, {
      merchant: { id: m.id, name: m.name, status: m.status, subscriptionPlan: m.subscriptionPlan, subscriptionEnds: '2025-07-15' },
      currentPlan: plan,
      availablePlans: PLANS.filter((p) => p.isActive),
      billingHistory: billingRecords.filter((b) => b.merchantId === m.id),
      usage: { callsUsed: 420, callLimit: plan?.callLimit || 1000, smsUsed: 85, smsLimit: plan?.smsLimit || 500, callsRemaining: (plan?.callLimit || 1000) - 420 },
    });
  }

  // --- API Keys ---
  if (path === '/api-keys' && method === 'GET') {
    const merchantId = getMerchantId(auth);
    if (!merchantId) return json(res, 401, { message: 'Unauthorized' });
    return json(res, 200, apiKeys.filter((k) => k.merchantId === merchantId).map(({ key, ...rest }) => rest));
  }

  if (path === '/api-keys' && method === 'POST') {
    const merchantId = getMerchantId(auth);
    if (!merchantId) return json(res, 401, { message: 'Unauthorized' });
    const body = await readBody(req);
    const rawKey = 'mk_' + crypto.randomBytes(16).toString('hex');
    const entry = { id: 'k' + Date.now(), merchantId, name: body.name || 'API Key', key: rawKey, keyPrefix: rawKey.slice(0, 8), isActive: true, createdAt: new Date().toISOString() };
    apiKeys.push(entry);
    return json(res, 200, { key: rawKey, keyPrefix: entry.keyPrefix, name: entry.name, message: 'Store this key securely.' });
  }

  const apiKeyMatch = path.match(/^\/api-keys\/([^/]+)$/);
  if (apiKeyMatch && method === 'DELETE') {
    const merchantId = getMerchantId(auth);
    if (!merchantId) return json(res, 401, { message: 'Unauthorized' });
    apiKeys = apiKeys.filter((k) => !(k.id === apiKeyMatch[1] && k.merchantId === merchantId));
    return json(res, 200, { ok: true });
  }

  // --- WooCommerce Integration ---
  const apiKeyUser = validateApiKey(req);

  if (path === '/integrations/woocommerce/ping' && method === 'GET') {
    if (!apiKeyUser) return json(res, 401, { message: 'Invalid API key' });
    return json(res, 200, { ok: true, merchantId: apiKeyUser.merchantId, message: 'Maskara API connection successful' });
  }

  if (path === '/integrations/woocommerce/connect' && method === 'POST') {
    if (!apiKeyUser) return json(res, 401, { message: 'Invalid API key' });
    const body = await readBody(req);
    wooIntegrations[apiKeyUser.merchantId] = {
      id: 'woo-' + apiKeyUser.merchantId,
      type: 'WOOCOMMERCE',
      name: body.storeName || body.storeUrl,
      isActive: true,
      credentials: { storeUrl: body.storeUrl, storeName: body.storeName, wcVersion: body.wcVersion, pluginVersion: body.pluginVersion, connectedAt: new Date().toISOString() },
      lastSyncAt: new Date().toISOString(),
    };
    return json(res, 200, wooIntegrations[apiKeyUser.merchantId]);
  }

  if (path === '/integrations/woocommerce/status' && method === 'GET') {
    const merchantId = getMerchantId(auth);
    if (!merchantId) return json(res, 401, { message: 'Unauthorized' });
    const integration = wooIntegrations[merchantId];
    const apiUrl = process.env.API_URL || 'http://localhost:4000';
    const creds = integration?.credentials || {};
    return json(res, 200, {
      connected: Boolean(integration?.isActive),
      integration: integration ? { id: integration.id, name: integration.name, isActive: integration.isActive, storeUrl: creds.storeUrl, storeName: creds.storeName, pluginVersion: creds.pluginVersion, connectedAt: creds.connectedAt, lastSyncAt: integration.lastSyncAt } : null,
      apiUrl,
      webhookUrl: apiUrl + '/webhooks/woocommerce',
      connectUrl: apiUrl + '/integrations/woocommerce/connect',
      pluginVersion: '1.0.0',
    });
  }

  if (path === '/integrations/woocommerce/disconnect' && method === 'DELETE') {
    const merchantId = getMerchantId(auth);
    if (!merchantId) return json(res, 401, { message: 'Unauthorized' });
    if (wooIntegrations[merchantId]) wooIntegrations[merchantId].isActive = false;
    return json(res, 200, { ok: true });
  }

  if (path === '/webhooks/woocommerce' && method === 'POST') {
    if (!apiKeyUser) return json(res, 401, { message: 'Invalid API key' });
    const body = await readBody(req);
    const billing = body.billing || {};
    if (!billing.phone) return json(res, 400, { message: 'Customer phone number required for verification' });
    const order = { id: 'o' + Date.now(), merchantId: apiKeyUser.merchantId, externalId: String(body.id), orderNumber: '#' + (body.number || body.id), customerName: ((billing.first_name || '') + ' ' + (billing.last_name || '')).trim(), customerPhone: billing.phone, totalAmount: parseFloat(body.total) || 0, status: 'PENDING', source: 'WOOCOMMERCE', createdAt: new Date().toISOString() };
    wooOrders.unshift(order);
    if (wooIntegrations[apiKeyUser.merchantId]) wooIntegrations[apiKeyUser.merchantId].lastSyncAt = new Date().toISOString();
    const m = merchants.find((x) => x.id === apiKeyUser.merchantId);
    if (m) m._count.orders += 1;
    return json(res, 200, { received: true, order });
  }

  if (path === '/subscriptions/subscribe' && method === 'POST') {
    if (!auth) return json(res, 401, { message: 'Unauthorized' });
    const body = await readBody(req);
    const merchantId = USERS[auth.email]?.merchantId || 'm-demo';
    const m = merchants.find((x) => x.id === merchantId);
    const plan = PLANS.find((p) => p.code === body.planCode);
    if (!m || !plan) return json(res, 400, { message: 'Invalid plan' });
    const billingId = 'b' + Date.now();
    billingRecords.unshift({
      id: billingId,
      merchantId: m.id,
      planCode: body.planCode,
      amount: plan.priceMonthly,
      status: Number(plan.priceMonthly) === 0 ? 'PAID' : 'PENDING',
      paymentMethod: body.paymentMethod || 'bKash',
      createdAt: new Date().toISOString(),
      merchant: { id: m.id, name: m.name, email: m.email },
    });
    if (Number(plan.priceMonthly) === 0) {
      m.subscriptionPlan = body.planCode;
      m.status = 'TRIAL';
    }
    return json(res, 200, {
      message: 'Subscription created. bKash/Nagad দিয়ে পেমেন্ট করুন। Admin confirm করলে activate হবে।',
      paymentInstructions: {
        bKash: settings.payment.bKashNumber,
        amount: plan.priceMonthly,
        reference: billingId,
      },
    });
  }

  // --- Voice / ePBX ---
  if (path === '/voice/epbx-probe' && method === 'GET') {
    if (!isAdmin) return json(res, 401, { message: 'Unauthorized' });
    const epbx = getEpbxConfig();
    if (!epbx.apiKey) return json(res, 400, { message: 'EPBX_API_KEY not configured' });
    const paths = [
      { method: 'GET', path: '/ping' },
      { method: 'GET', path: '/account' },
      { method: 'GET', path: '/ivr-menus' },
      { method: 'GET', path: '/ivrs' },
    ];
    const results = [];
    for (const p of paths) {
      try {
        const r = await fetch(`${epbx.apiUrl}${p.path}`, {
          method: p.method,
          headers: { Authorization: `Bearer ${epbx.apiKey}`, Accept: 'application/json' },
        });
        const body = await r.text();
        results.push({ path: p.path, status: r.status, ok: r.ok, preview: body.slice(0, 200) });
      } catch (e) {
        results.push({ path: p.path, status: 0, ok: false, preview: e.message });
      }
    }
    return json(res, 200, {
      apiUrl: epbx.apiUrl,
      apiKeySet: Boolean(epbx.apiKey),
      customerId: epbx.customerId || null,
      ivrId: epbx.ivrId || null,
      webhooks: {
        general: `${getPublicApiUrl()}/voice/webhook/epbx`,
        dtmf: `${getPublicApiUrl()}/voice/webhook/epbx/dtmf`,
        status: `${getPublicApiUrl()}/voice/webhook/epbx/status`,
      },
      probe: results,
      dashboard: {
        login: epbx.apiUrl.replace('/api/v1', '/login'),
        home: epbx.apiUrl.replace('/api/v1', '/dashboard'),
        developer: epbx.apiUrl.replace('/api/v1', '/portal/developer'),
        ivr: epbx.apiUrl.replace('/api/v1', '/portal/ivr-menus'),
      },
    });
  }

  if (path === '/voice/provider' && method === 'GET') {
    const epbx = getEpbxConfig();
    const base = getPublicApiUrl();
    return json(res, 200, {
      provider: epbx.provider,
      active: epbx.provider === 'epbx' || epbx.provider === 'auto',
      epbx: {
        configured: Boolean(epbx.apiKey),
        enabled: epbx.enabled,
        apiUrl: epbx.apiUrl,
        webhooks: {
          general: `${base}/voice/webhook/epbx`,
          dtmf: `${base}/voice/webhook/epbx/dtmf`,
          status: `${base}/voice/webhook/epbx/status`,
        },
      },
      publicApiUrl: base,
    });
  }

  if (path === '/voice/test-call' && method === 'POST') {
    if (!isAdmin) return json(res, 401, { message: 'Unauthorized' });
    const body = await readBody(req);
    const epbx = getEpbxConfig();
    if (!epbx.apiKey) return json(res, 400, { message: 'EPBX_API_KEY not configured' });
    const phone = normalizeBdPhone(body.phone || body.to);
    if (!phone) return json(res, 400, { message: 'phone required' });
    const callId = 'call_' + Date.now();
    const ttsText = body.message || `আসসালামু আলাইকুম। আপনার অর্ডার নিশ্চিত করতে 1 চাপুন, বাতিল করতে 2 চাপুন।`;
    const webhookBase = getPublicApiUrl();
    const payload = {
      destination_number: phone,
      phone,
      tts_text: ttsText,
      message: ttsText,
      reference_id: callId,
      external_id: callId,
      webhook_url: `${webhookBase}/voice/webhook/epbx`,
      status_callback: `${webhookBase}/voice/webhook/epbx/status`,
      dtmf_webhook: `${webhookBase}/voice/webhook/epbx/dtmf`,
    };
    if (epbx.ivrId) payload.ivr_id = epbx.ivrId;
    const apiPath = epbx.customerId
      ? `/customers/${epbx.customerId}/calls/originate`
      : '/calls/verify';
    try {
      const epbxRes = await fetch(`${epbx.apiUrl}${apiPath}`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${epbx.apiKey}`,
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: JSON.stringify(payload),
      });
      const epbxBody = await epbxRes.json().catch(() => ({}));
      const log = {
        id: callId,
        phone,
        status: epbxRes.ok ? 'QUEUED' : 'FAILED',
        provider: 'epbx',
        response: epbxBody,
        at: new Date().toISOString(),
      };
      callLogs.unshift(log);
      if (!epbxRes.ok) {
        return json(res, 502, { message: epbxBody.message || 'ePBX call failed', details: epbxBody });
      }
      return json(res, 200, {
        success: true,
        callId,
        providerCallId: epbxBody.call_id || epbxBody.id || callId,
        message: `Test call queued to ${phone}`,
        webhooks: payload,
      });
    } catch (e) {
      return json(res, 502, { message: e.message || 'ePBX request failed' });
    }
  }

  if (path === '/voice/webhook/epbx' && method === 'POST') {
    const body = await readBody(req);
    callLogs.unshift({ type: 'webhook', event: 'epbx', body, at: new Date().toISOString() });
    return json(res, 200, { received: true });
  }

  if (path === '/voice/webhook/epbx/dtmf' && method === 'POST') {
    const body = await readBody(req);
    const digit = body.digit || body.dtmf || body.key;
    callLogs.unshift({ type: 'dtmf', digit, body, at: new Date().toISOString() });
    const d = String(digit ?? '').charAt(0);
    let outcome = 'UNKNOWN';
    const extra = {};
    if (d === '1') outcome = 'CONFIRMED';
    else if (d === '2') outcome = 'CANCELLED';
    else if (d === '0') {
      outcome = null;
      Object.assign(extra, { action: 'replay', replay: true });
    }
    return json(res, 200, { received: true, outcome, ...extra });
  }

  if (path === '/voice/webhook/epbx/status' && method === 'POST') {
    const body = await readBody(req);
    callLogs.unshift({ type: 'status', body, at: new Date().toISOString() });
    return json(res, 200, { received: true });
  }

  if (path === '/voice/call-logs' && method === 'GET') {
    if (!isAdmin) return json(res, 401, { message: 'Unauthorized' });
    return json(res, 200, { logs: callLogs.slice(0, 50) });
  }

  json(res, 404, { message: 'Not found' });
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`Maskara Standalone API running on http://localhost:${PORT}`);
  console.log(`Admin login: admin@maskara.bd / Admin@123`);
});
