'use client';

import { useEffect, useState } from 'react';
import { PluginDownloadLink } from '@/components/PluginDownloadLink';
import { api, ShopInStatus, WooCommerceStatus } from '@/lib/api';
import { fetchPluginRelease } from '@/lib/plugin-release';
import {
  Globe,
  ShoppingBag,
  Code,
  CheckCircle2,
  Copy,
  Unplug,
  Store,
  RefreshCw,
} from 'lucide-react';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

export function IntegrationsSection() {
  const [woo, setWoo] = useState<WooCommerceStatus | null>(null);
  const [shopin, setShopin] = useState<ShopInStatus | null>(null);
  const [webhookSecret, setWebhookSecret] = useState('');
  const [shopinCallbackUrl, setShopinCallbackUrl] = useState(
    'https://api.shopin.bd/api/v1/webhooks/maskara/',
  );
  const [binding, setBinding] = useState(false);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState('');
  const [latestPluginVersion, setLatestPluginVersion] = useState<string | null>(null);

  useEffect(() => {
    fetchPluginRelease().then((info) => {
      if (info?.version) setLatestPluginVersion(info.version);
    });
  }, []);

  useEffect(() => {
    Promise.all([
      api.getWooCommerceStatus().catch(() => ({
        connected: false,
        integration: null,
        apiUrl: API_URL,
        webhookUrl: `${API_URL}/webhooks/woocommerce`,
        connectUrl: `${API_URL}/integrations/woocommerce/connect`,
        pluginVersion: '1.0.0',
      })),
      api.getShopInStatus().catch(() => ({
        connected: false,
        integration: null,
        apiUrl: API_URL,
        inboundWebhookUrl: `${API_URL}/webhooks/shopin`,
        connectUrl: `${API_URL}/integrations/shopin/connect`,
        pingUrl: `${API_URL}/integrations/shopin/ping`,
        merchantWebhookUrl: null,
      })),
      api.getWebhookSecret().catch(() => ({ webhookSecret: '', created: false })),
    ])
      .then(([wooStatus, shopinStatus, secretRes]) => {
        setWoo(wooStatus);
        setShopin(shopinStatus);
        setWebhookSecret(secretRes.webhookSecret || '');
        const bound =
          shopinStatus.integration?.callbackUrl ||
          shopinStatus.merchantWebhookUrl ||
          '';
        if (bound.includes('/webhooks/maskara/')) {
          setShopinCallbackUrl(bound);
        }
      })
      .finally(() => setLoading(false));
  }, []);

  function copyText(text: string, label: string) {
    if (!text) return;
    navigator.clipboard.writeText(text);
    setCopied(label);
    setTimeout(() => setCopied(''), 2000);
  }

  async function regenerateSecret() {
    if (!confirm('নতুন Webhook Secret বানাবেন? ShopIn settings-এও আপডেট করতে হবে।')) return;
    try {
      const res = await api.regenerateWebhookSecret();
      setWebhookSecret(res.webhookSecret);
      copyText(res.webhookSecret, 'secret');
    } catch {
      alert('Secret regenerate failed');
    }
  }

  async function bindShopInWebhook() {
    const url = shopinCallbackUrl.trim();
    if (!url.includes('/webhooks/maskara/')) {
      alert('ShopIn Webhook URL পেস্ট করুন (…/webhooks/maskara/…)');
      return;
    }
    setBinding(true);
    try {
      await api.bindShopIn({
        callbackUrl: url,
        shopId: url,
        webhookSecret: webhookSecret || undefined,
      });
      const updated = await api.getShopInStatus();
      setShopin(updated);
      alert('ShopIn webhook Maskara-তে সেট হয়েছে');
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Bind failed');
    } finally {
      setBinding(false);
    }
  }

  async function disconnectWoo() {
    if (!confirm('WooCommerce disconnect করতে চান?')) return;
    try {
      await api.disconnectWooCommerce();
      setWoo(await api.getWooCommerceStatus());
    } catch {
      alert('Disconnect failed');
    }
  }

  async function disconnectShopIn() {
    if (!confirm('ShopIn disconnect করতে চান?')) return;
    try {
      await api.disconnectShopIn();
      setShopin(await api.getShopInStatus());
    } catch {
      alert('Disconnect failed');
    }
  }

  const webhookUrl = woo?.webhookUrl || `${API_URL}/webhooks/woocommerce`;
  const shopinInbound = shopin?.inboundWebhookUrl || `${API_URL}/webhooks/shopin`;
  const shopinPing = shopin?.pingUrl || `${API_URL}/integrations/shopin/ping`;

  return (
    <div className="space-y-6">
      <div>
        <h3 className="section-title">ইন্টিগ্রেশন</h3>
        <p className="page-subtitle">ShopIn, WooCommerce, Shopify ও Custom API connect করুন</p>
      </div>

      <div className="card border-2 border-emerald-200">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex gap-4">
            <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-emerald-50">
              <Store className="h-7 w-7 text-emerald-700" />
            </div>
            <div>
              <h4 className="text-xl font-bold text-slate-900">ShopIn</h4>
              <p className="mt-1 text-sm text-slate-500">
                ShopIn Maskara AI Call Center → API Key → কল → confirm হলে ShopIn Pathao deploy
              </p>
              {!loading && (
                <span
                  className={`mt-2 inline-flex items-center gap-1 text-sm font-medium ${
                    shopin?.connected ? 'text-emerald-600' : 'text-amber-600'
                  }`}
                >
                  <CheckCircle2 className="h-4 w-4" />
                  {shopin?.connected
                    ? `Connected — ${shopin.integration?.shopName || shopin.integration?.shopId}`
                    : 'Not connected (ShopIn থেকে sync/connect হলে active হবে)'}
                </span>
              )}
            </div>
          </div>
          {shopin?.connected ? (
            <button type="button" onClick={() => void disconnectShopIn()} className="btn-secondary gap-2 text-red-600">
              <Unplug className="h-4 w-4" /> Disconnect
            </button>
          ) : null}
        </div>

        <div className="mt-6 grid gap-4 lg:grid-cols-2">
          <div className="rounded-lg bg-slate-50 p-4">
            <h5 className="font-semibold text-slate-900">Step 1: Maskara API Key</h5>
            <p className="mt-2 text-sm text-slate-600">
              এই পেজের নিচে API Keys সেকশন থেকে Key তৈরি করে ShopIn-এ পেস্ট করুন
            </p>
            <a href="#api-keys" className="btn-primary mt-3 inline-flex gap-2 text-sm">
              API Keys দেখুন
            </a>
          </div>
          <div className="rounded-lg bg-slate-50 p-4">
            <h5 className="font-semibold text-slate-900">Step 2: Webhook Secret</h5>
            <p className="mt-2 text-sm text-slate-600">
              Secret কপি করে ShopIn → Maskara AI → Webhook Secret-এ পেস্ট করুন
            </p>
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <code className="min-w-0 flex-1 break-all rounded bg-white px-3 py-2 text-xs">
                {loading ? '…' : webhookSecret || 'লোড হচ্ছে / তৈরি হয়নি'}
              </code>
              <button
                type="button"
                onClick={() => copyText(webhookSecret, 'secret')}
                className="btn-secondary text-xs"
                disabled={!webhookSecret}
              >
                <Copy className="h-3 w-3" /> {copied === 'secret' ? 'Copied!' : 'Copy'}
              </button>
              <button type="button" onClick={() => void regenerateSecret()} className="btn-secondary gap-1 text-xs">
                <RefreshCw className="h-3 w-3" /> নতুন
              </button>
            </div>
          </div>
          <div className="rounded-lg border border-emerald-200 bg-emerald-50/50 p-4 lg:col-span-2">
            <h5 className="font-semibold text-slate-900">Step 3: ShopIn Webhook URL</h5>
            <p className="mt-2 text-sm text-slate-600">
              ShopIn → সংযোগ সেটিংস → Webhook URL কপি করে নিচে পেস্ট করুন → সংযুক্ত করুন
            </p>
            <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-center">
              <input
                className="input flex-1 font-mono text-xs"
                value={shopinCallbackUrl}
                onChange={(e) => setShopinCallbackUrl(e.target.value)}
                placeholder="https://api.shopin.bd/api/v1/webhooks/maskara/…"
              />
              <button
                type="button"
                onClick={() => void bindShopInWebhook()}
                disabled={binding}
                className="btn-primary whitespace-nowrap text-sm"
              >
                {binding ? 'সেট হচ্ছে…' : 'সংযুক্ত করুন'}
              </button>
            </div>
            {shopin?.merchantWebhookUrl?.includes('/webhooks/maskara/') ? (
              <p className="mt-2 text-xs font-medium text-emerald-700">
                Bound: {shopin.merchantWebhookUrl}
              </p>
            ) : (
              <p className="mt-2 text-xs text-amber-700">
                এখনো ShopIn callback বাঁধা নেই — উপরের URL পেস্ট করে সংযুক্ত করুন
              </p>
            )}
          </div>
          <div className="space-y-2 rounded-lg bg-slate-50 p-4 lg:col-span-2">
            <h5 className="font-semibold text-slate-900">Endpoints</h5>
            <div className="flex items-center gap-2">
              <code className="flex-1 rounded bg-white px-3 py-2 text-xs">{shopinPing}</code>
              <button type="button" onClick={() => copyText(shopinPing, 'ping')} className="btn-secondary text-xs">
                <Copy className="h-3 w-3" /> {copied === 'ping' ? 'Copied!' : 'Ping'}
              </button>
            </div>
            <div className="flex items-center gap-2">
              <code className="flex-1 rounded bg-white px-3 py-2 text-xs">{shopinInbound}</code>
              <button type="button" onClick={() => copyText(shopinInbound, 'inbound')} className="btn-secondary text-xs">
                <Copy className="h-3 w-3" /> {copied === 'inbound' ? 'Copied!' : 'Inbound'}
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="card border-2 border-brand-200">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex gap-4">
            <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-brand-50">
              <Globe className="h-7 w-7 text-brand-600" />
            </div>
            <div>
              <h4 className="text-xl font-bold text-slate-900">WooCommerce</h4>
              <p className="mt-1 text-sm text-slate-500">
                Plugin install → API Key → automatic COD verification
              </p>
              {!loading && (
                <span
                  className={`mt-2 inline-flex items-center gap-1 text-sm font-medium ${
                    woo?.connected ? 'text-emerald-600' : 'text-amber-600'
                  }`}
                >
                  <CheckCircle2 className="h-4 w-4" />
                  {woo?.connected
                    ? `Connected — ${woo.integration?.storeUrl || woo.integration?.storeName}`
                    : 'Not connected'}
                </span>
              )}
              {!loading &&
              woo?.connected &&
              woo.integration?.pluginVersion &&
              latestPluginVersion ? (
                <p className="mt-1 text-xs text-slate-500">
                  Store plugin: v{woo.integration.pluginVersion}
                  {woo.integration.pluginVersion !== latestPluginVersion ? (
                    <span className="ml-1 font-medium text-amber-700">
                      — update available (v{latestPluginVersion})
                    </span>
                  ) : null}
                </p>
              ) : null}
            </div>
          </div>
          {woo?.connected ? (
            <button type="button" onClick={() => void disconnectWoo()} className="btn-secondary gap-2 text-red-600">
              <Unplug className="h-4 w-4" /> Disconnect
            </button>
          ) : null}
        </div>

        <div className="mt-6 grid gap-4 lg:grid-cols-2">
          <div className="rounded-lg bg-slate-50 p-4">
            <h5 className="font-semibold text-slate-900">Step 1: API Key</h5>
            <p className="mt-2 text-sm text-slate-600">নিচের API Keys থেকে Key তৈরি করুন (নাম: WooCommerce)</p>
            <a href="#api-keys" className="btn-primary mt-3 inline-flex gap-2 text-sm">
              API Keys দেখুন
            </a>
          </div>
          <div className="rounded-lg bg-slate-50 p-4">
            <h5 className="font-semibold text-slate-900">Step 2: Plugin Download</h5>
            <p className="mt-2 text-sm text-slate-600">
              WordPress → Plugins → পুরনো Maskara ডিলিট → Upload → Activate
            </p>
            <PluginDownloadLink />
          </div>
          <div className="rounded-lg bg-slate-50 p-4 lg:col-span-2">
            <h5 className="font-semibold text-slate-900">Step 3: Plugin Settings</h5>
            <p className="mt-2 text-sm text-slate-600">WooCommerce → Maskara → values দিন → Connect</p>
            <div className="mt-3 space-y-2">
              <div className="flex items-center gap-2">
                <code className="flex-1 rounded bg-white px-3 py-2 text-xs">{woo?.apiUrl || API_URL}</code>
                <button
                  type="button"
                  onClick={() => copyText(woo?.apiUrl || API_URL, 'api')}
                  className="btn-secondary text-xs"
                >
                  <Copy className="h-3 w-3" /> {copied === 'api' ? 'Copied!' : 'API URL'}
                </button>
              </div>
              <div className="flex items-center gap-2">
                <code className="flex-1 rounded bg-white px-3 py-2 text-xs">{webhookUrl}</code>
                <button type="button" onClick={() => copyText(webhookUrl, 'webhook')} className="btn-secondary text-xs">
                  <Copy className="h-3 w-3" /> {copied === 'webhook' ? 'Copied!' : 'Webhook'}
                </button>
              </div>
              {webhookSecret ? (
                <div className="flex items-center gap-2">
                  <code className="flex-1 break-all rounded bg-white px-3 py-2 text-xs">{webhookSecret}</code>
                  <button
                    type="button"
                    onClick={() => copyText(webhookSecret, 'woo-secret')}
                    className="btn-secondary text-xs"
                  >
                    <Copy className="h-3 w-3" /> {copied === 'woo-secret' ? 'Copied!' : 'Webhook Secret'}
                  </button>
                </div>
              ) : null}
            </div>
          </div>
        </div>

        {woo?.connected && woo.integration?.lastSyncAt ? (
          <p className="mt-4 text-xs text-slate-500">
            Last order sync: {new Date(woo.integration.lastSyncAt).toLocaleString('bn-BD')}
          </p>
        ) : null}
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div className="card">
          <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-brand-50">
            <ShoppingBag className="h-6 w-6 text-brand-600" />
          </div>
          <h4 className="mt-4 text-lg font-semibold">Shopify</h4>
          <p className="mt-2 text-sm text-slate-500">Shopify webhook দিয়ে connect করুন</p>
          <code className="mt-4 block rounded bg-slate-50 px-3 py-2 text-xs">POST /webhooks/shopify</code>
          <a href="/docs" className="btn-secondary mt-4 w-full text-center">
            Setup Guide
          </a>
        </div>
        <div className="card">
          <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-brand-50">
            <Code className="h-6 w-6 text-brand-600" />
          </div>
          <h4 className="mt-4 text-lg font-semibold">Custom API</h4>
          <p className="mt-2 text-sm text-slate-500">যেকোনো website থেকে REST API</p>
          <code className="mt-4 block rounded bg-slate-50 px-3 py-2 text-xs">POST /webhooks/custom</code>
          <a href="/docs" className="btn-secondary mt-4 w-full text-center">
            API Docs
          </a>
        </div>
      </div>
    </div>
  );
}
