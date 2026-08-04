'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  Check,
  Copy,
  ExternalLink,
  Facebook,
  Loader2,
  Plus,
  Trash2,
  Zap,
} from 'lucide-react';
import { api, MarketingPixel, MarketingSettings } from '@/lib/api';

function emptyPixel(): MarketingPixel {
  return {
    id: `px-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    label: '',
    pixelId: '',
    testEventCode: '',
    accessToken: '',
  };
}

function isValidPixelId(id: string) {
  return /^\d{5,20}$/.test(id.trim());
}

function CopyField({ label, value }: { label: string; value: string }) {
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
      <div className="flex gap-2">
        <input
          readOnly
          value={value || ''}
          placeholder="—"
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
  const [data, setData] = useState<MarketingSettings | null>(null);
  const [storePublicUrl, setStorePublicUrl] = useState('https://maskara.bd');
  const [pixels, setPixels] = useState<MarketingPixel[]>([emptyPixel()]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [savedReady, setSavedReady] = useState(false);

  useEffect(() => {
    setLoading(true);
    setError('');
    api
      .getAdminMarketing()
      .then((res) => {
        setData(res);
        setStorePublicUrl(res.storePublicUrl || 'https://maskara.bd');
        const cleaned = (res.pixels || [])
          .map((p) => ({
            ...p,
            label: p.label || '',
            pixelId: p.pixelId || '',
            // Never show junk autofill leftovers from older saves
            testEventCode: /^\d+$|^TEST/i.test(p.testEventCode || '')
              ? p.testEventCode
              : '',
            accessToken: p.accessToken || '',
          }))
          .filter((p) => p.pixelId.trim());
        setPixels(cleaned.length ? cleaned : [emptyPixel()]);
        setSavedReady(cleaned.some((p) => isValidPixelId(p.pixelId)));
      })
      .catch((err) =>
        setError(err instanceof Error ? err.message : 'Marketing লোড ব্যর্থ'),
      )
      .finally(() => setLoading(false));
  }, []);

  const boostReady = useMemo(
    () => pixels.some((p) => isValidPixelId(p.pixelId)),
    [pixels],
  );

  function updatePixel(id: string, patch: Partial<MarketingPixel>) {
    setPixels((prev) =>
      prev.map((p) => (p.id === id ? { ...p, ...patch } : p)),
    );
    setSavedReady(false);
  }

  async function save() {
    setSaving(true);
    setMessage('');
    setError('');
    try {
      const cleaned = pixels
        .map((p) => ({
          ...p,
          label: p.label.trim(),
          pixelId: p.pixelId.trim(),
          testEventCode: p.testEventCode.trim(),
          accessToken: p.accessToken.trim(),
        }))
        .filter((p) => p.pixelId);
      const res = await api.updateAdminMarketing({
        storePublicUrl: storePublicUrl.trim() || 'https://maskara.bd',
        pixels: cleaned,
      });
      setData(res);
      setStorePublicUrl(res.storePublicUrl || 'https://maskara.bd');
      const next = (res.pixels || []).filter((p) => p.pixelId.trim());
      setPixels(next.length ? next : [emptyPixel()]);
      const ready = next.some((p) => isValidPixelId(p.pixelId));
      setSavedReady(ready);
      setMessage(
        ready
          ? 'সেভ হয়েছে — Boost করার জন্য প্রস্তুত'
          : 'সেভ হয়েছে',
      );
      setTimeout(() => setMessage(''), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'সেভ ব্যর্থ');
    } finally {
      setSaving(false);
    }
  }

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
            Maskara প্ল্যাটফর্ম — Sitemap, Product Feed ও Pixel / CAPI
          </p>
        </div>
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
              <h3 className="font-semibold text-slate-900">Maskara পাবলিক URL</h3>
              <p className="mt-1 text-xs text-slate-500">
                প্ল্যাটফর্ম ডোমেইন (ডিফল্ট https://maskara.bd)
              </p>
            </div>
            <input
              className="input font-latin"
              value={storePublicUrl}
              onChange={(e) => setStorePublicUrl(e.target.value)}
              autoComplete="off"
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
                <p className="mt-1 text-xs text-slate-500">
                  ঘরগুলো খালি থাকবে — Pixel ID সেট করে সেভ করুন
                </p>
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

            {(savedReady || boostReady) && (
              <div
                className={`flex items-center gap-2 rounded-xl px-4 py-3 text-sm font-medium ${
                  savedReady
                    ? 'bg-emerald-50 text-emerald-800 ring-1 ring-emerald-200'
                    : 'bg-amber-50 text-amber-800 ring-1 ring-amber-200'
                }`}
              >
                <Zap className="h-4 w-4 shrink-0" />
                {savedReady
                  ? 'Boost করার জন্য প্রস্তুত'
                  : 'Pixel ID আছে — সেভ করুন, তাহলে Boost এর জন্য প্রস্তুত হবে'}
              </div>
            )}

            <form
              className="space-y-4"
              autoComplete="off"
              onSubmit={(e) => e.preventDefault()}
            >
              {/* honeypot — reduces browser login autofill into pixel fields */}
              <input
                type="text"
                name="username"
                autoComplete="username"
                className="sr-only"
                tabIndex={-1}
                readOnly
                value=""
              />
              <input
                type="password"
                name="password"
                autoComplete="current-password"
                className="sr-only"
                tabIndex={-1}
                readOnly
                value=""
              />

              {pixels.map((p, idx) => (
                <div
                  key={p.id}
                  className="space-y-3 rounded-xl border border-slate-200 bg-white p-4"
                >
                  <div className="flex items-center justify-between gap-2">
                    <p className="font-medium text-slate-800">Pixel {idx + 1}</p>
                    {pixels.length > 1 && (
                      <button
                        type="button"
                        className="inline-flex items-center gap-1 text-sm text-rose-600 hover:text-rose-700"
                        onClick={() => {
                          setPixels((prev) => prev.filter((x) => x.id !== p.id));
                          setSavedReady(false);
                        }}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                        সরান
                      </button>
                    )}
                  </div>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div>
                      <label className="mb-1 block text-xs font-medium text-slate-600">
                        লেবেল (ঐচ্ছিক)
                      </label>
                      <input
                        className="input bg-white"
                        name={`fb-label-${p.id}`}
                        value={p.label}
                        onChange={(e) =>
                          updatePixel(p.id, { label: e.target.value })
                        }
                        placeholder=""
                        autoComplete="off"
                      />
                    </div>
                    <div>
                      <label className="mb-1 block text-xs font-medium text-slate-600">
                        Facebook Pixel ID
                      </label>
                      <input
                        className="input font-latin bg-white"
                        name={`fb-pixel-${p.id}`}
                        value={p.pixelId}
                        onChange={(e) =>
                          updatePixel(p.id, {
                            pixelId: e.target.value.replace(/\D/g, ''),
                          })
                        }
                        placeholder=""
                        inputMode="numeric"
                        autoComplete="off"
                      />
                    </div>
                    <div>
                      <label className="mb-1 block text-xs font-medium text-slate-600">
                        Test Event ID (টেস্টের সময়)
                      </label>
                      <input
                        className="input font-latin bg-white"
                        name={`fb-test-${p.id}`}
                        value={p.testEventCode}
                        onChange={(e) =>
                          updatePixel(p.id, { testEventCode: e.target.value })
                        }
                        placeholder=""
                        autoComplete="off"
                      />
                    </div>
                    <div>
                      <label className="mb-1 block text-xs font-medium text-slate-600">
                        Pixel Access Token (CAPI)
                      </label>
                      <input
                        type="text"
                        className="input font-latin bg-white"
                        name={`fb-token-${p.id}`}
                        value={p.accessToken}
                        onChange={(e) =>
                          updatePixel(p.id, { accessToken: e.target.value })
                        }
                        placeholder=""
                        autoComplete="new-password"
                        spellCheck={false}
                      />
                    </div>
                  </div>
                </div>
              ))}
            </form>

            <button
              type="button"
              className="btn-secondary inline-flex items-center gap-2"
              onClick={() => {
                setPixels((prev) => [...prev, emptyPixel()]);
                setSavedReady(false);
              }}
            >
              <Plus className="h-4 w-4" />
              Pixel যোগ করুন
            </button>
          </div>

          <div className="flex justify-end gap-3 pb-8">
            <button
              type="button"
              className="btn-primary min-w-[140px]"
              disabled={saving}
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
