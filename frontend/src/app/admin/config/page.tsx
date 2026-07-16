'use client';

import { useEffect, useState } from 'react';
import { Phone, Radio, Save, Settings2, ExternalLink, Copy, Check, PhoneCall } from 'lucide-react';
import { api, PlatformConfig, VoiceProviderInfo, EpbxProbe } from '@/lib/api';

interface EpbxForm {
  enabled: boolean;
  apiUrl: string;
  apiKey: string;
  apiKeySet: boolean;
  customerId: string;
  ivrId: string;
}

interface IppbxForm {
  enabled: boolean;
  apiUrl: string;
  apiKey: string;
  apiKeySet: boolean;
  apiSecret: string;
  apiSecretSet: boolean;
}

interface VoiceForm {
  provider: string;
  publicApiUrl: string;
  googleTtsApiKey: string;
  googleTtsApiKeySet: boolean;
  epbx: EpbxForm;
  ippbx: IppbxForm;
}

const DEFAULT_VOICE: VoiceForm = {
  provider: 'epbx',
  publicApiUrl: 'http://localhost:4000',
  googleTtsApiKey: '',
  googleTtsApiKeySet: false,
  epbx: {
    enabled: true,
    apiUrl: 'https://maskara.epbx.bd/api/v1',
    apiKey: '',
    apiKeySet: false,
    customerId: '',
    ivrId: '',
  },
  ippbx: {
    enabled: true,
    apiUrl: '',
    apiKey: '',
    apiKeySet: false,
    apiSecret: '',
    apiSecretSet: false,
  },
};

export default function AdminConfigPage() {
  const [config, setConfig] = useState<PlatformConfig | null>(null);
  const [voice, setVoice] = useState<VoiceForm>(DEFAULT_VOICE);
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);
  const [providerInfo, setProviderInfo] = useState<VoiceProviderInfo | null>(null);
  const [probe, setProbe] = useState<EpbxProbe | null>(null);
  const [copied, setCopied] = useState<string | null>(null);
  const [testPhone, setTestPhone] = useState('');
  const [testResult, setTestResult] = useState<string | null>(null);
  const [testing, setTesting] = useState(false);

  useEffect(() => {
    api.getPlatformConfig().then((c) => {
      setConfig(c);
      const v = c.voice as VoiceForm & {
        status?: { epbx: boolean; ippbx: boolean; twilio: boolean; googleTts?: boolean };
        googleTts?: { apiKey?: string; apiKeySet?: boolean; configured?: boolean };
      };
      if (v) {
        setVoice({
          provider: v.provider || 'epbx',
          publicApiUrl: v.publicApiUrl || 'http://localhost:4000',
          googleTtsApiKey: v.googleTts?.apiKey || '',
          googleTtsApiKeySet: v.googleTts?.apiKeySet ?? false,
          epbx: {
            enabled: v.epbx?.enabled ?? true,
            apiUrl: v.epbx?.apiUrl || 'https://maskara.epbx.bd/api/v1',
            apiKey: v.epbx?.apiKey || '',
            apiKeySet: v.epbx?.apiKeySet ?? false,
            customerId: v.epbx?.customerId || '',
            ivrId: v.epbx?.ivrId || '',
          },
          ippbx: {
            enabled: v.ippbx?.enabled ?? true,
            apiUrl: v.ippbx?.apiUrl || '',
            apiKey: v.ippbx?.apiKey || '',
            apiKeySet: v.ippbx?.apiKeySet ?? false,
            apiSecret: v.ippbx?.apiSecret || '',
            apiSecretSet: v.ippbx?.apiSecretSet ?? false,
          },
        });
      }
    }).catch(() => {});
    api.getVoiceProvider().then(setProviderInfo).catch(() => {});
    api.getEpbxProbe().then(setProbe).catch(() => {});
  }, []);

  function copyText(key: string, text: string) {
    navigator.clipboard.writeText(text);
    setCopied(key);
    setTimeout(() => setCopied(null), 2000);
  }

  async function runTestCall() {
    if (!testPhone.trim()) return;
    setTesting(true);
    setTestResult(null);
    try {
      const res = await api.testEpbxCall(testPhone.trim());
      setTestResult(res.message || 'Call queued');
    } catch (e) {
      setTestResult(e instanceof Error ? e.message : 'Test call failed');
    } finally {
      setTesting(false);
    }
  }

  async function saveVoice(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      await api.updatePlatformConfig({
        voice_providers: {
          provider: voice.provider,
          publicApiUrl: voice.publicApiUrl,
          googleTts: {
            enabled: true,
            apiKey: voice.googleTtsApiKey || undefined,
          },
          epbx: {
            enabled: voice.epbx.enabled,
            apiUrl: voice.epbx.apiUrl,
            apiKey: voice.epbx.apiKey || undefined,
            customerId: voice.epbx.customerId,
            ivrId: voice.epbx.ivrId,
          },
          ippbx: {
            enabled: voice.ippbx.enabled,
            apiUrl: voice.ippbx.apiUrl,
            apiKey: voice.ippbx.apiKey || undefined,
            apiSecret: voice.ippbx.apiSecret || undefined,
          },
        },
      });
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
      const updated = await api.getPlatformConfig();
      const v = updated.voice as VoiceForm & {
        googleTts?: { apiKey?: string; apiKeySet?: boolean };
      };
      if (v) setVoice((prev) => ({
        ...prev,
        provider: v.provider || prev.provider,
        publicApiUrl: v.publicApiUrl || prev.publicApiUrl,
        googleTtsApiKey: v.googleTts?.apiKey || '',
        googleTtsApiKeySet: v.googleTts?.apiKeySet ?? prev.googleTtsApiKeySet,
        epbx: { ...prev.epbx, ...v.epbx, apiKey: v.epbx?.apiKey || '' },
        ippbx: { ...prev.ippbx, ...v.ippbx, apiKey: v.ippbx?.apiKey || '', apiSecret: v.ippbx?.apiSecret || '' },
      }));
      api.getVoiceProvider().then(setProviderInfo).catch(() => {});
      api.getEpbxProbe().then(setProbe).catch(() => {});
    } catch {
      alert('Voice config save failed');
    } finally {
      setSaving(false);
    }
  }

  if (!config) {
    return (
      <div className="py-16 text-center text-slate-500">Config load হচ্ছে...</div>
    );
  }

  const status = (config.voice as { status?: { epbx: boolean; ippbx: boolean; twilio: boolean; googleTts?: boolean } })?.status
    || { epbx: false, ippbx: false, twilio: false, googleTts: false };

  const epbxInfo =
    providerInfo?.epbx && typeof providerInfo.epbx === 'object'
      ? providerInfo.epbx
      : null;
  const webhooks = epbxInfo?.webhooks || probe?.webhooks;
  const dashboard = probe?.dashboard || {
    login: 'https://maskara.epbx.bd/login',
    home: 'https://maskara.epbx.bd/dashboard',
    developer: 'https://maskara.epbx.bd/portal/developer',
    ivr: 'https://maskara.epbx.bd/portal/ivr-menus',
  };

  return (
    <div className="mx-auto max-w-3xl space-y-8">
      <div>
        <h2 className="text-2xl font-bold text-slate-900">Voice / ePBX</h2>
        <p className="text-sm text-slate-500">
          Maskara Chirp3 = voice engine · ePBX = dial only ·{' '}
          <a href="/admin/voice" className="text-brand-600 hover:underline">
            Voice Studio
          </a>
        </p>
      </div>

      <div className="card border-brand-200 bg-brand-50/30">
        <h3 className="font-semibold">ePBX Dashboard Setup</h3>
        <p className="mt-1 text-sm text-slate-600">Login: <a href="https://maskara.epbx.bd/login" target="_blank" rel="noreferrer" className="text-brand-600 hover:underline">maskara.epbx.bd/login</a> → Developer API থেকে token নিন</p>
        <div className="mt-4 flex flex-wrap gap-3">
          <a href={dashboard.login} target="_blank" rel="noreferrer" className="btn-primary inline-flex items-center gap-2 text-sm">
            <ExternalLink className="h-4 w-4" /> Login
          </a>
          <a href={dashboard.developer} target="_blank" rel="noreferrer" className="btn-secondary inline-flex items-center gap-2 text-sm">
            <ExternalLink className="h-4 w-4" /> Developer API
          </a>
          <a href={dashboard.ivr} target="_blank" rel="noreferrer" className="btn-secondary inline-flex items-center gap-2 text-sm">
            <ExternalLink className="h-4 w-4" /> IVR Menus
          </a>
        </div>

        {webhooks && (
          <div className="mt-4 space-y-2">
            <p className="text-sm font-medium text-slate-700">Webhook URLs (ePBX Developer settings-এ paste করুন)</p>
            <p className="text-xs text-amber-700">Local test-এর জন্য tunnel লাগবে: <code className="rounded bg-amber-100 px-1">bash scripts/start-api-tunnel.sh</code> — তারপর Public API URL আপডেট করুন</p>
            {([
              ['general', 'General', webhooks.general],
              ['dtmf', 'DTMF / Order', webhooks.dtmf],
              ['status', 'Call Status', webhooks.status],
            ] as const).map(([key, label, url]) => (
              <div key={key} className="flex items-center gap-2 rounded-lg border bg-white p-2 text-xs">
                <span className="w-24 shrink-0 font-medium text-slate-500">{label}</span>
                <code className="flex-1 truncate text-slate-700">{url}</code>
                <button type="button" onClick={() => copyText(key, url)} className="shrink-0 text-brand-600 hover:text-brand-700">
                  {copied === key ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                </button>
              </div>
            ))}
          </div>
        )}

        <div className="mt-4 rounded-lg border border-dashed p-3">
          <p className="text-sm font-medium">Test Call</p>
          <div className="mt-2 flex gap-2">
            <input className="input flex-1" placeholder="01XXXXXXXXX" value={testPhone} onChange={(e) => setTestPhone(e.target.value)} />
            <button type="button" onClick={runTestCall} disabled={testing} className="btn-primary inline-flex items-center gap-2">
              <PhoneCall className="h-4 w-4" /> {testing ? 'Calling...' : 'Test'}
            </button>
          </div>
          {testResult && <p className="mt-2 text-sm text-slate-600">{testResult}</p>}
        </div>
      </div>

      <div className="card">
        <div className="flex items-center gap-2">
          <Phone className="h-5 w-5 text-brand-600" />
          <h3 className="font-semibold">Voice Provider Status</h3>
        </div>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <div className="rounded-lg border p-3">
            <p className="text-sm text-slate-500">Active Mode</p>
            <p className="font-medium uppercase">{voice.provider}</p>
          </div>
          <div className="rounded-lg border p-3">
            <p className="text-sm text-slate-500">Providers</p>
            <div className="mt-1 flex flex-wrap gap-2 text-xs">
              <span className={status.epbx ? 'badge-success' : 'badge-warning'}>ePBX {status.epbx ? '✓' : '—'}</span>
              <span className={status.ippbx ? 'badge-success' : 'badge-warning'}>ippbx {status.ippbx ? '✓' : '—'}</span>
              <span className={status.twilio ? 'badge-success' : 'badge-warning'}>Twilio {status.twilio ? '✓' : '—'}</span>
              <span className={status.googleTts ? 'badge-success' : 'badge-warning'}>Maskara TTS {status.googleTts ? '✓' : '—'}</span>
            </div>
          </div>
        </div>
      </div>

      <form onSubmit={saveVoice} className="card space-y-6">
        <div className="flex items-center gap-2">
          <Radio className="h-5 w-5 text-brand-600" />
          <h3 className="font-semibold">Voice Provider Configuration</h3>
        </div>

        {saved && (
          <div className="rounded-lg bg-emerald-50 p-3 text-sm text-emerald-700">Voice settings saved!</div>
        )}

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="block text-sm font-medium text-slate-700">Provider Mode</label>
            <select
              className="input mt-1"
              value={voice.provider}
              onChange={(e) => setVoice({ ...voice, provider: e.target.value })}
            >
              <option value="auto">Auto (ePBX → ippbx → Twilio)</option>
              <option value="epbx">ePBX only</option>
              <option value="ippbx">ippbx only</option>
              <option value="twilio">Twilio only</option>
              <option value="simulate">Simulate (test)</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700">Public API URL (webhooks)</label>
            <input
              className="input mt-1"
              value={voice.publicApiUrl}
              onChange={(e) => setVoice({ ...voice, publicApiUrl: e.target.value })}
              placeholder="https://your-domain.com"
            />
            <p className="mt-1 text-xs text-slate-400">Production-এ ngrok বা real domain দিন</p>
          </div>
        </div>

        <div className="rounded-lg border border-sky-200 bg-sky-50/40 p-4 space-y-3">
          <div>
            <h4 className="font-semibold text-slate-900">Maskara Voice Engine (Chirp3)</h4>
            <p className="text-xs text-slate-500">
              Live call audio-র একমাত্র source — Maskara Google Chirp3 synthesize করে।
              ePBX portal Active Voice Model / eAI key ব্যবহার হয় না। Cloud Text-to-Speech API enable থাকতে হবে।
              Preview:{' '}
              <a href="/admin/voice" className="font-medium text-brand-600 hover:underline">
                Voice Studio
              </a>
            </p>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700">
              API Key {voice.googleTtsApiKeySet ? '(set)' : ''}
            </label>
            <input
              className="input mt-1 font-mono text-sm"
              type="password"
              value={voice.googleTtsApiKey}
              onChange={(e) => setVoice({ ...voice, googleTtsApiKey: e.target.value })}
              placeholder={voice.googleTtsApiKeySet ? '•••••••• (leave to keep)' : 'AIza…'}
            />
          </div>
        </div>

        <div className="rounded-lg border border-amber-200 bg-amber-50/50 p-4 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h4 className="font-semibold text-slate-900">Telephony (dial only) — ePBX</h4>
              <p className="text-xs text-slate-500">
                শুধু নম্বর দিয়ে originate + webhooks — Maskara MP3 play করে। Portal TTS / eAI voice নয়।
              </p>
            </div>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={voice.epbx.enabled}
                onChange={(e) => setVoice({ ...voice, epbx: { ...voice.epbx, enabled: e.target.checked } })}
              />
              Enabled
            </label>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700">API URL</label>
            <input
              className="input mt-1"
              value={voice.epbx.apiUrl}
              onChange={(e) => setVoice({ ...voice, epbx: { ...voice.epbx, apiUrl: e.target.value } })}
              placeholder="https://maskara.epbx.bd/api/v1"
            />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="block text-sm font-medium text-slate-700">
                API Key {voice.epbx.apiKeySet && <span className="text-emerald-600">(saved)</span>}
              </label>
              <input
                type="password"
                className="input mt-1"
                value={voice.epbx.apiKey}
                onChange={(e) => setVoice({ ...voice, epbx: { ...voice.epbx, apiKey: e.target.value } })}
                placeholder={voice.epbx.apiKeySet ? '•••••••• (unchanged if empty)' : 'EPBX API Key'}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700">Customer ID</label>
              <input
                className="input mt-1"
                value={voice.epbx.customerId}
                onChange={(e) => setVoice({ ...voice, epbx: { ...voice.epbx, customerId: e.target.value } })}
                placeholder="Optional"
              />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700">IVR ID</label>
            <input
              className="input mt-1"
              value={voice.epbx.ivrId}
              onChange={(e) => setVoice({ ...voice, epbx: { ...voice.epbx, ivrId: e.target.value } })}
              placeholder="ePBX dashboard থেকে IVR ID"
            />
          </div>
        </div>

        <div className="rounded-lg border border-blue-200 bg-blue-50/50 p-4 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h4 className="font-semibold text-slate-900">ippbx.com.bd Configuration</h4>
              <p className="text-xs text-slate-500">Bangladesh — ~৳0.40/min | Sales: +880 9678 22 11 11</p>
            </div>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={voice.ippbx.enabled}
                onChange={(e) => setVoice({ ...voice, ippbx: { ...voice.ippbx, enabled: e.target.checked } })}
              />
              Enabled
            </label>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700">API URL</label>
            <input
              className="input mt-1"
              value={voice.ippbx.apiUrl}
              onChange={(e) => setVoice({ ...voice, ippbx: { ...voice.ippbx, apiUrl: e.target.value } })}
              placeholder="https://api.ippbx.com.bd/v1/call"
            />
            <p className="mt-1 text-xs text-slate-400">ippbx sales থেকে API endpoint নিন</p>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="block text-sm font-medium text-slate-700">
                API Key {voice.ippbx.apiKeySet && <span className="text-emerald-600">(saved)</span>}
              </label>
              <input
                type="password"
                className="input mt-1"
                value={voice.ippbx.apiKey}
                onChange={(e) => setVoice({ ...voice, ippbx: { ...voice.ippbx, apiKey: e.target.value } })}
                placeholder={voice.ippbx.apiKeySet ? '•••••••• (unchanged if empty)' : 'IPPBX API Key'}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700">
                API Secret {voice.ippbx.apiSecretSet && <span className="text-emerald-600">(saved)</span>}
              </label>
              <input
                type="password"
                className="input mt-1"
                value={voice.ippbx.apiSecret}
                onChange={(e) => setVoice({ ...voice, ippbx: { ...voice.ippbx, apiSecret: e.target.value } })}
                placeholder={voice.ippbx.apiSecretSet ? '•••••••• (unchanged if empty)' : 'IPPBX API Secret'}
              />
            </div>
          </div>
        </div>

        <button type="submit" className="btn-primary inline-flex items-center gap-2" disabled={saving}>
          <Save className="h-4 w-4" />
          {saving ? 'Saving...' : 'Save Voice Config'}
        </button>
      </form>

      <div className="card">
        <div className="flex items-center gap-2">
          <Settings2 className="h-5 w-5 text-brand-600" />
          <h3 className="font-semibold">More Settings</h3>
        </div>
        <p className="mt-2 text-sm text-slate-500">
          Voice retries, maintenance — <a href="/admin/settings" className="text-brand-600 hover:underline">System Settings</a>
        </p>
      </div>
    </div>
  );
}
