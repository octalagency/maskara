'use client';

import { useEffect, useState } from 'react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { PluginDownloadLink } from '@/components/PluginDownloadLink';
import { api, ShopInStatus, WooCommerceStatus } from '@/lib/api';
import { fetchPluginRelease } from '@/lib/plugin-release';
import { Globe, ShoppingBag, Code, CheckCircle2, Copy, Link2, Unplug, Store } from 'lucide-react';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

export default function IntegrationsPage() {
  const [woo, setWoo] = useState<WooCommerceStatus | null>(null);
  const [shopin, setShopin] = useState<ShopInStatus | null>(null);
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
    ])
      .then(([wooStatus, shopinStatus]) => {
        setWoo(wooStatus);
        setShopin(shopinStatus);
      })
      .finally(() => setLoading(false));
  }, []);

  function copyText(text: string, label: string) {
    navigator.clipboard.writeText(text);
    setCopied(label);
    setTimeout(() => setCopied(''), 2000);
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
    <DashboardLayout>
      <div className="space-y-8">
        <div>
          <h2 className="text-2xl font-bold text-slate-900">Integrations</h2>
          <p className="text-sm text-slate-500">
            ShopIn, WooCommerce, Shopify ও Custom API connect করুন
          </p>
        </div>

        {/* ShopIn */}
        <div className="card border-2 border-emerald-200">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div className="flex gap-4">
              <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-emerald-50">
                <Store className="h-7 w-7 text-emerald-700" />
              </div>
              <div>
                <h3 className="text-xl font-bold text-slate-900">ShopIn</h3>
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
            {shopin?.connected && (
              <button onClick={disconnectShopIn} className="btn-secondary gap-2 text-red-600">
                <Unplug className="h-4 w-4" /> Disconnect
              </button>
            )}
          </div>

          <div className="mt-6 grid gap-4 lg:grid-cols-2">
            <div className="rounded-lg bg-slate-50 p-4">
              <h4 className="font-semibold text-slate-900">Step 1: Maskara API Key</h4>
              <p className="mt-2 text-sm text-slate-600">
                Dashboard → API Keys → Create Key → ShopIn Maskara settings-এ পেস্ট করুন
              </p>
              <a href="/dashboard/api-keys" className="btn-primary mt-3 inline-flex gap-2 text-sm">
                <Link2 className="h-4 w-4" /> API Keys
              </a>
            </div>
            <div className="rounded-lg bg-slate-50 p-4">
              <h4 className="font-semibold text-slate-900">Step 2: ShopIn settings</h4>
              <p className="mt-2 text-sm text-slate-600">
                ShopIn → Maskara AI → Webhook Secret একই রাখুন → API টেস্ট → পেন্ডিং সিঙ্ক
              </p>
              <p className="mt-2 text-xs text-slate-500">
                Callback (Maskara → ShopIn):{' '}
                <code className="rounded bg-white px-1">
                  https://api.shopin.bd/api/v1/webhooks/maskara/&#123;shopId&#125;
                </code>
              </p>
            </div>
            <div className="rounded-lg bg-slate-50 p-4 lg:col-span-2 space-y-2">
              <h4 className="font-semibold text-slate-900">Endpoints (ShopIn টিমের জন্য)</h4>
              <div className="flex items-center gap-2">
                <code className="flex-1 rounded bg-white px-3 py-2 text-xs">{shopinPing}</code>
                <button onClick={() => copyText(shopinPing, 'ping')} className="btn-secondary text-xs">
                  <Copy className="h-3 w-3" /> {copied === 'ping' ? 'Copied!' : 'Ping'}
                </button>
              </div>
              <div className="flex items-center gap-2">
                <code className="flex-1 rounded bg-white px-3 py-2 text-xs">{shopinInbound}</code>
                <button
                  onClick={() => copyText(shopinInbound, 'inbound')}
                  className="btn-secondary text-xs"
                >
                  <Copy className="h-3 w-3" /> {copied === 'inbound' ? 'Copied!' : 'Inbound'}
                </button>
              </div>
              {shopin?.merchantWebhookUrl && (
                <p className="text-xs text-slate-500">
                  Bound callback: <code>{shopin.merchantWebhookUrl}</code>
                </p>
              )}
            </div>
          </div>
        </div>

        {/* WooCommerce — main */}
        <div className="card border-2 border-brand-200">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div className="flex gap-4">
              <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-brand-50">
                <Globe className="h-7 w-7 text-brand-600" />
              </div>
              <div>
                <h3 className="text-xl font-bold text-slate-900">WooCommerce</h3>
                <p className="mt-1 text-sm text-slate-500">
                  Plugin install করুন → API Key দিন → automatic COD verification
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
                  latestPluginVersion && (
                    <p className="mt-1 text-xs text-slate-500">
                      Store plugin: v{woo.integration.pluginVersion}
                      {woo.integration.pluginVersion !== latestPluginVersion && (
                        <span className="ml-1 font-medium text-amber-700">
                          — update available (v{latestPluginVersion})
                        </span>
                      )}
                    </p>
                  )}
              </div>
            </div>
            {woo?.connected && (
              <button onClick={disconnectWoo} className="btn-secondary gap-2 text-red-600">
                <Unplug className="h-4 w-4" /> Disconnect
              </button>
            )}
          </div>

          <div className="mt-6 grid gap-4 lg:grid-cols-2">
            <div className="rounded-lg bg-slate-50 p-4">
              <h4 className="font-semibold text-slate-900">Step 1: API Key তৈরি করুন</h4>
              <p className="mt-2 text-sm text-slate-600">
                Dashboard → API Keys → Create Key (নাম: WooCommerce)
              </p>
              <a href="/dashboard/api-keys" className="btn-primary mt-3 inline-flex gap-2 text-sm">
                <Link2 className="h-4 w-4" /> API Keys পেজ
              </a>
            </div>

            <div className="rounded-lg bg-slate-50 p-4">
              <h4 className="font-semibold text-slate-900">Step 2: Plugin Download</h4>
              <p className="mt-2 text-sm text-slate-600">
                WordPress → Plugins → Deactivate + Delete পুরনো Maskara → Upload → Activate
              </p>
              <PluginDownloadLink />
            </div>

            <div className="rounded-lg bg-slate-50 p-4 lg:col-span-2">
              <h4 className="font-semibold text-slate-900">Step 3: WooCommerce Plugin Settings</h4>
              <p className="mt-2 text-sm text-slate-600">
                WooCommerce → Maskara → নিচের values দিন → Connect
              </p>
              <div className="mt-3 space-y-2">
                <div className="flex items-center gap-2">
                  <code className="flex-1 rounded bg-white px-3 py-2 text-xs">
                    {woo?.apiUrl || API_URL}
                  </code>
                  <button
                    onClick={() => copyText(woo?.apiUrl || API_URL, 'api')}
                    className="btn-secondary text-xs"
                  >
                    <Copy className="h-3 w-3" /> {copied === 'api' ? 'Copied!' : 'API URL'}
                  </button>
                </div>
                <div className="flex items-center gap-2">
                  <code className="flex-1 rounded bg-white px-3 py-2 text-xs">{webhookUrl}</code>
                  <button
                    onClick={() => copyText(webhookUrl, 'webhook')}
                    className="btn-secondary text-xs"
                  >
                    <Copy className="h-3 w-3" /> {copied === 'webhook' ? 'Copied!' : 'Webhook'}
                  </button>
                </div>
              </div>
            </div>
          </div>

          {woo?.connected && woo.integration?.lastSyncAt && (
            <p className="mt-4 text-xs text-slate-500">
              Last order sync: {new Date(woo.integration.lastSyncAt).toLocaleString('bn-BD')}
            </p>
          )}
        </div>

        {/* Other integrations */}
        <div className="grid gap-6 md:grid-cols-2">
          <div className="card">
            <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-brand-50">
              <ShoppingBag className="h-6 w-6 text-brand-600" />
            </div>
            <h3 className="mt-4 text-lg font-semibold">Shopify</h3>
            <p className="mt-2 text-sm text-slate-500">Shopify webhook দিয়ে connect করুন</p>
            <code className="mt-4 block rounded bg-slate-50 px-3 py-2 text-xs">
              POST /webhooks/shopify
            </code>
            <a href="/docs" className="btn-secondary mt-4 w-full text-center">
              Setup Guide
            </a>
          </div>
          <div className="card">
            <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-brand-50">
              <Code className="h-6 w-6 text-brand-600" />
            </div>
            <h3 className="mt-4 text-lg font-semibold">Custom API</h3>
            <p className="mt-2 text-sm text-slate-500">যেকোনো website থেকে REST API</p>
            <code className="mt-4 block rounded bg-slate-50 px-3 py-2 text-xs">
              POST /webhooks/custom
            </code>
            <a href="/docs" className="btn-secondary mt-4 w-full text-center">
              API Docs
            </a>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
