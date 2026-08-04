'use client';

import { useEffect, useState } from 'react';
import {
  Check,
  Copy,
  ExternalLink,
  Facebook,
  Loader2,
  Plus,
  Trash2,
} from 'lucide-react';
import {
  api,
  AdminMerchantDetail,
  MarketingPixel,
  MarketingSettings,
} from '@/lib/api';

function newPixel(): MarketingPixel {
  return {
    id: `px-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    label: '',
    pixelId: '',
    testEventCode: '',
    accessToken: '',
  };
}

function CopyField({
  label,
  value,
  hint,
}: {
  label: string;
  value: string;
  hint?: string;
}) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    if (!value) return;
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      /* ignore */
    }
  }

  return (
    <div>
      <label className="mb-1 block text-sm font-medium text-slate-700">{label}</label>
      {hint && <p className="mb-2 text-xs text-slate-500">{hint}</p>}
      <div className="flex gap-2">
        <input
          readOnly
          value={value || '— স্টোর URL সেভ করুন'}
          className="input font-latin flex-1 text-sm"
        />
        <button
          type="button"
          onClick={() => void copy()}
          disabled={!value}
          className="btn-secondary inline-flex items-center gap-1.5 px-3"
          title="কপি"
        >
          {copied ? (
            <Check className="h-4 w-4 text-emerald-600" />
          ) : (
            <Copy className="h-4 w-4" />
          )}
        </button>
      </div>
    </div>
  );
}

export default function AdminMarketingPage() {
  const [merchants, setMerchants] = useState<AdminMerchantDetail[]>([]);
  const [merchantId, setMerchantId] = useState('');
  const [data, setData] = useState<MarketingSettings | null>(null);
  const [storePublicUrl, setStorePublicUrl] = useState('');
  const [pixels, setPixels] = useState<MarketingPixel[]>([]);
  const [loadingList, setLoadingList] = useState(true);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    setLoadingList(true);
    api
      .getAdminMerchants({ limit: '200' })
      .then((res) => {
        const list = res.merchants || [];
        setMerchants(list);
        if (list[0]?.id) setMerchantId(list[0].id);
      })
      .catch((err) =>
        setError(err instanceof Error ? err.message : 'মার্চেন্ট লোড ব্যর্থ'),
      )
      .finally(() => setLoadingList(false));
  }, []);

  useEffect(() => {
    if (!merchantId) return;
    setLoading(true);
    setError('');
    setMessage('');
    api
      .getAdminMerchantMarketing(merchantId)
      .then((res) => {
        setData(res);
        setStorePublicUrl(res.storePublicUrl || '');
        setPixels(res.pixels?.length ? res.pixels : []);
      })
      .catch((err) =>
        setError(err instanceof Error ? err.message : 'Marketing লোড ব্যর্থ'),
      )
      .finally(() => setLoading(false));
  }, [merchantId]);

  function updatePixel(id: string, patch: Partial<MarketingPixel>) {
    setPixels((prev) =>
      prev.map((p) => (p.id === id ? { ...p, ...patch } : p)),
    );
  }

  async function save() {
    if (!merchantId) return;
    setSaving(true);
    setMessage('');
    setError('');
    try {
      const cleaned = pixels.filter((p) => p.pixelId.trim());
      const res = await api.updateAdminMerchantMarketing(merchantId, {
        storePublicUrl: storePublicUrl.trim(),
        pixels: cleaned,
      });
      setData(res);
      setStorePublicUrl(res.storePublicUrl || '');
      setPixels(res.pixels || []);
      setMessage('সেভ হয়েছে');
      setTimeout(() => setMessage(''), 2500);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'সেভ ব্যর্থ');
    } finally {
      setSaving(false);
    }
  }

  const selected = merchants.find((m) => m.id === merchantId);
  const storeBase = storePublicUrl.trim().replace(/\/+$/, '');
  const sitemapUrl = storeBase
    ? `${storeBase}/sitemap.xml`
    : data?.sitemapUrl || '';
  const feedUrl = storeBase
    ? `${storeBase}/facebook-product-feed.xml`
    : data?.productFeedUrl || '';

  return (
    <div className="mx-auto max-w-3xl space-y-6 p-6">
      <div className="flex items-start gap-3">
        <div className="rounded-xl bg-[#1877F2]/10 p-2.5">
          <Facebook className="h-6 w-6 text-[#1877F2]" />
        </div>
        <div>
          <h2 className="text-2xl font-bold text-slate-900">
            Facebook Boost & মার্কেটিং
          </h2>
          <p className="text-sm text-slate-500">
            Super Admin — মার্চেন্ট বেছে Sitemap, Feed ও Pixel/CAPI সেট করুন
          </p>
        </div>
      </div>

      <div className="card space-y-3">
        <label className="block text-sm font-medium text-slate-700">
          মার্চেন্ট
        </label>
        {loadingList ? (
          <p className="text-sm text-slate-500">মার্চেন্ট লোড হচ্ছে…</p>
        ) : (
          <select
            className="input"
            value={merchantId}
            onChange={(e) => setMerchantId(e.target.value)}
          >
            {merchants.map((m) => (
              <option key={m.id} value={m.id}>
                {m.name} — {m.email}
              </option>
            ))}
          </select>
        )}
        {selected && (
          <p className="text-xs text-slate-500">
            প্ল্যান: {selected.subscriptionPlan} · স্ট্যাটাস: {selected.status}
          </p>
        )}
      </div>

      {message && (
        <div className="rounded-lg bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
          {message}
        </div>
      )}
      {error && (
        <div className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center gap-2 py-16 text-slate-500">
          <Loader2 className="h-5 w-5 animate-spin" />
          Marketing লোড হচ্ছে…
        </div>
      ) : (
        <>
          <div className="card space-y-4">
            <div>
              <h3 className="font-semibold text-slate-900">স্টোর পাবলিক URL</h3>
              <p className="mt-1 text-xs text-slate-500">
                যে ডোমেইনে শপ চলে (যেমন https://filo.bd)
              </p>
            </div>
            <input
              className="input font-latin"
              placeholder="https://yourstore.com"
              value={storePublicUrl}
              onChange={(e) => setStorePublicUrl(e.target.value)}
            />
          </div>

          <div className="card space-y-5">
            <div>
              <h3 className="font-semibold text-slate-900">SEO & Sitemap</h3>
              <p className="mt-1 text-xs text-slate-500">
                Google Search Console-এ এই URL যোগ করুন
              </p>
            </div>
            <CopyField label="Sitemap URL" value={sitemapUrl} />
          </div>

          <div className="card space-y-5">
            <div>
              <h3 className="font-semibold text-slate-900">
                Facebook Product Feed
              </h3>
              <p className="mt-1 text-xs text-slate-500">
                Catalog Ads ও Dynamic Product Ads-এর জন্য
              </p>
            </div>
            <CopyField label="Product Feed URL" value={feedUrl} />
          </div>

          <div className="card space-y-5">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h3 className="font-semibold text-slate-900">
                  Pixel + Conversion API Setup
                </h3>
                <ol className="mt-2 list-decimal space-y-1 pl-5 text-xs text-slate-600">
                  <li>Meta Business Suite → Events Manager</li>
                  <li>Pixel ID এখানে পেস্ট করুন</li>
                  <li>CAPI Access Token দিন</li>
                  <li>টেস্টে Test Event Code ব্যবহার করুন</li>
                </ol>
              </div>
              <a
                href={
                  data?.eventsManagerUrl ||
                  'https://business.facebook.com/events_manager2'
                }
                target="_blank"
                rel="noreferrer"
                className="btn-secondary inline-flex items-center gap-1.5 text-sm"
              >
                Open Events Manager
                <ExternalLink className="h-3.5 w-3.5" />
              </a>
            </div>

            <div className="space-y-4">
              {pixels.length === 0 && (
                <p className="rounded-lg border border-dashed border-slate-200 px-4 py-6 text-center text-sm text-slate-500">
                  এখনো কোনো Pixel নেই — নিচে থেকে যোগ করুন
                </p>
              )}
              {pixels.map((p, idx) => (
                <div
                  key={p.id}
                  className="space-y-3 rounded-xl border border-slate-200 bg-slate-50/80 p-4"
                >
                  <div className="flex items-center justify-between gap-2">
                    <p className="font-medium text-slate-800">
                      Pixel {idx + 1}
                      {p.pixelId ? (
                        <span className="font-latin text-slate-500">
                          {' '}
                          — {p.pixelId}
                        </span>
                      ) : null}
                    </p>
                    <button
                      type="button"
                      className="inline-flex items-center gap-1 text-sm text-rose-600 hover:text-rose-700"
                      onClick={() =>
                        setPixels((prev) => prev.filter((x) => x.id !== p.id))
                      }
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                      সরান
                    </button>
                  </div>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div>
                      <label className="mb-1 block text-xs font-medium text-slate-600">
                        লেবেল (ঐচ্ছিক)
                      </label>
                      <input
                        className="input"
                        value={p.label}
                        onChange={(e) =>
                          updatePixel(p.id, { label: e.target.value })
                        }
                        placeholder={p.pixelId || 'Main Pixel'}
                      />
                    </div>
                    <div>
                      <label className="mb-1 block text-xs font-medium text-slate-600">
                        Facebook Pixel ID
                      </label>
                      <input
                        className="input font-latin"
                        value={p.pixelId}
                        onChange={(e) =>
                          updatePixel(p.id, { pixelId: e.target.value })
                        }
                        placeholder="1781964129370544"
                      />
                    </div>
                    <div>
                      <label className="mb-1 block text-xs font-medium text-slate-600">
                        Test Event ID (টেস্টের সময়)
                      </label>
                      <input
                        className="input font-latin"
                        value={p.testEventCode}
                        onChange={(e) =>
                          updatePixel(p.id, { testEventCode: e.target.value })
                        }
                        placeholder="TEST12345"
                      />
                    </div>
                    <div>
                      <label className="mb-1 block text-xs font-medium text-slate-600">
                        Pixel Access Token (CAPI)
                      </label>
                      <input
                        type="password"
                        className="input font-latin"
                        value={p.accessToken}
                        onChange={(e) =>
                          updatePixel(p.id, { accessToken: e.target.value })
                        }
                        placeholder="EAAxxxxx…"
                        autoComplete="off"
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <button
              type="button"
              className="btn-secondary inline-flex items-center gap-2"
              onClick={() => setPixels((prev) => [...prev, newPixel()])}
            >
              <Plus className="h-4 w-4" />
              Pixel যোগ করুন
            </button>
          </div>

          <div className="flex justify-end gap-3 pb-8">
            <button
              type="button"
              className="btn-primary min-w-[140px]"
              disabled={saving || !merchantId}
              onClick={() => void save()}
            >
              {saving ? (
                <span className="inline-flex items-center gap-2">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  সেভ…
                </span>
              ) : (
                'সেভ করুন'
              )}
            </button>
          </div>
        </>
      )}
    </div>
  );
}
