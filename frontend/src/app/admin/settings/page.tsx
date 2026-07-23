'use client';

import { useEffect, useState } from 'react';
import { api, AuthProfile } from '@/lib/api';

interface SettingsForm {
  platformName: string;
  maintenanceMode: boolean;
  defaultLanguage: string;
  maxCallRetries: number;
  retryIntervalMin: number;
  twilioEnabled: boolean;
  smsEnabled: boolean;
  whatsappEnabled: boolean;
  contactEmail: string;
  contactPhone: string;
  contactLocation: string;
}

interface AccountForm {
  email: string;
  firstName: string;
  lastName: string;
  currentPassword: string;
  newPassword: string;
  confirmPassword: string;
}

const DEFAULT: SettingsForm = {
  platformName: 'Maskara',
  maintenanceMode: false,
  defaultLanguage: 'bn-BD',
  maxCallRetries: 3,
  retryIntervalMin: 30,
  twilioEnabled: true,
  smsEnabled: true,
  whatsappEnabled: false,
  contactEmail: 'support@maskara.bd',
  contactPhone: '+880 1XXX-XXXXXX',
  contactLocation: 'Dhaka, Bangladesh',
};

export default function AdminSettingsPage() {
  const [settings, setSettings] = useState<SettingsForm>(DEFAULT);
  const [account, setAccount] = useState<AccountForm>({
    email: '',
    firstName: '',
    lastName: '',
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
  });
  const [saved, setSaved] = useState(false);
  const [accountSaved, setAccountSaved] = useState(false);
  const [saving, setSaving] = useState(false);
  const [savingAccount, setSavingAccount] = useState(false);
  const [accountError, setAccountError] = useState('');

  const [googleTtsKey, setGoogleTtsKey] = useState('');
  const [googleTtsKeySet, setGoogleTtsKeySet] = useState(false);
  const [googleTtsConfigured, setGoogleTtsConfigured] = useState(false);
  const [savingGoogle, setSavingGoogle] = useState(false);
  const [googleSaved, setGoogleSaved] = useState(false);
  const [googleError, setGoogleError] = useState('');

  useEffect(() => {
    api.getSystemSettings().then((rows) => {
      const merged = { ...DEFAULT };
      for (const row of rows) {
        const val = row.value as Record<string, unknown>;
        if (row.key === 'platform' && val.name) merged.platformName = String(val.name);
        if (row.key === 'maintenance') merged.maintenanceMode = Boolean(val.enabled);
        if (row.key === 'voice') {
          if (val.language) merged.defaultLanguage = String(val.language);
          if (val.maxRetries) merged.maxCallRetries = Number(val.maxRetries);
          if (val.retryIntervalMin) merged.retryIntervalMin = Number(val.retryIntervalMin);
        }
        if (row.key === 'channels') {
          if ('twilio' in val) merged.twilioEnabled = Boolean(val.twilio);
          if ('sms' in val) merged.smsEnabled = Boolean(val.sms);
          if ('whatsapp' in val) merged.whatsappEnabled = Boolean(val.whatsapp);
        }
        if (row.key === 'contact') {
          if (val.email) merged.contactEmail = String(val.email);
          if (val.phone) merged.contactPhone = String(val.phone);
          if (val.location) merged.contactLocation = String(val.location);
        }
      }
      setSettings(merged);
    }).catch(() => {});

    api.getMe().then((profile: AuthProfile) => {
      setAccount((prev) => ({
        ...prev,
        email: profile.email,
        firstName: profile.firstName || '',
        lastName: profile.lastName || '',
      }));
    }).catch(() => {});

    api
      .getPlatformConfig()
      .then((c) => {
        const v = c.voice as {
          googleTts?: { apiKeySet?: boolean; configured?: boolean };
          status?: { googleTts?: boolean };
        };
        setGoogleTtsKeySet(Boolean(v?.googleTts?.apiKeySet));
        setGoogleTtsConfigured(
          Boolean(v?.googleTts?.configured ?? v?.status?.googleTts),
        );
      })
      .catch(() => {});

    api
      .getVoiceProvider()
      .then((p) => {
        const info = p as { googleTts?: boolean };
        if (typeof info.googleTts === 'boolean') setGoogleTtsConfigured(info.googleTts);
      })
      .catch(() => {});
  }, []);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      await Promise.all([
        api.updateSystemSetting('platform', { name: settings.platformName }),
        api.updateSystemSetting('maintenance', { enabled: settings.maintenanceMode }),
        api.updateSystemSetting('voice', {
          language: settings.defaultLanguage,
          maxRetries: settings.maxCallRetries,
          retryIntervalMin: settings.retryIntervalMin,
        }),
        api.updateSystemSetting('channels', {
          twilio: settings.twilioEnabled,
          sms: settings.smsEnabled,
          whatsapp: settings.whatsappEnabled,
        }),
        api.updateSystemSetting('contact', {
          email: settings.contactEmail.trim(),
          phone: settings.contactPhone.trim(),
          location: settings.contactLocation.trim(),
        }),
      ]);
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch {
      alert('Settings save failed');
    } finally {
      setSaving(false);
    }
  }

  async function handleAccountSave(e: React.FormEvent) {
    e.preventDefault();
    setAccountError('');

    if (!account.currentPassword) {
      setAccountError('বর্তমান password দিন');
      return;
    }
    if (account.newPassword && account.newPassword.length < 8) {
      setAccountError('নতুন password কমপক্ষে ৮ অক্ষর হতে হবে');
      return;
    }
    if (account.newPassword && account.newPassword !== account.confirmPassword) {
      setAccountError('নতুন password মিলছে না');
      return;
    }

    setSavingAccount(true);
    try {
      await api.updateProfile({
        email: account.email,
        firstName: account.firstName,
        lastName: account.lastName,
        currentPassword: account.currentPassword,
      });

      if (account.newPassword) {
        await api.changePassword({
          currentPassword: account.currentPassword,
          newPassword: account.newPassword,
        });
      }

      setAccount((prev) => ({
        ...prev,
        currentPassword: '',
        newPassword: '',
        confirmPassword: '',
      }));
      setAccountSaved(true);
      setTimeout(() => setAccountSaved(false), 4000);
    } catch (err) {
      setAccountError(err instanceof Error ? err.message : 'অ্যাকাউন্ট আপডেট ব্যর্থ');
    } finally {
      setSavingAccount(false);
    }
  }

  async function handleGoogleTtsSave(e: React.FormEvent) {
    e.preventDefault();
    setGoogleError('');
    setSavingGoogle(true);
    try {
      const key = googleTtsKey.trim();
      if (!key && !googleTtsKeySet) {
        setGoogleError('Google Cloud TTS API key দিন (AIza…)');
        return;
      }
      await api.updatePlatformConfig({
        voice_providers: {
          googleTts: {
            enabled: true,
            apiKey: key || undefined,
          },
        },
      });
      setGoogleTtsKey('');
      setGoogleTtsKeySet(true);
      setGoogleTtsConfigured(true);
      setGoogleSaved(true);
      setTimeout(() => setGoogleSaved(false), 4000);

      const provider = (await api.getVoiceProvider()) as { googleTts?: boolean };
      if (typeof provider.googleTts === 'boolean') {
        setGoogleTtsConfigured(provider.googleTts);
      }
    } catch (err) {
      setGoogleError(err instanceof Error ? err.message : 'Google TTS সেভ ব্যর্থ');
    } finally {
      setSavingGoogle(false);
    }
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-slate-900">System Settings</h2>
        <p className="text-sm text-slate-500">পুরো প্ল্যাটফর্ম ও Super Admin একাউন্ট ম্যানেজ করুন</p>
      </div>

      <form onSubmit={handleGoogleTtsSave} className="card space-y-5">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h3 className="text-lg font-semibold text-slate-900">Maskara Voice Engine (Chirp3)</h3>
            <p className="text-sm text-slate-500">
              Chirp3 Algieba ভয়েস — Cloud Text-to-Speech API Key কানেক্ট করুন
            </p>
          </div>
          <span
            className={
              googleTtsConfigured
                ? 'badge-success shrink-0'
                : 'badge-warning shrink-0'
            }
          >
            {googleTtsConfigured ? 'Connected ✓' : 'Not connected'}
          </span>
        </div>

        {googleSaved && (
          <div className="rounded-lg bg-emerald-50 p-3 text-sm text-emerald-700">
            Google TTS কানেক্ট সেভ হয়েছে। Merchant Settings → Algieba সিলেক্ট করুন।
          </div>
        )}
        {googleError && (
          <div className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{googleError}</div>
        )}

        <div>
          <label className="block text-sm font-medium text-slate-700">
            API Key {googleTtsKeySet ? '(saved — নতুন key দিলে আপডেট হবে)' : ''}
          </label>
          <input
            type="password"
            className="input mt-1 font-mono text-sm"
            value={googleTtsKey}
            onChange={(e) => setGoogleTtsKey(e.target.value)}
            placeholder={googleTtsKeySet ? '•••••••• (খালি রাখলে আগের key থাকবে)' : 'AIza…'}
            autoComplete="off"
          />
          <p className="mt-2 text-xs text-slate-500">
            Google Cloud → APIs & Services → Credentials → API key। অবশ্যই{' '}
            <strong>Cloud Text-to-Speech API</strong> enable ও key restriction-এ allow থাকতে হবে।
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <button type="submit" className="btn-primary" disabled={savingGoogle}>
            {savingGoogle ? 'Connecting...' : 'Connect Google TTS'}
          </button>
          <a href="/admin/config" className="text-sm font-medium text-brand-600 hover:underline">
            Voice / ePBX পেজেও আছে →
          </a>
        </div>
      </form>

      <form onSubmit={handleAccountSave} className="card space-y-5">
        <div>
          <h3 className="text-lg font-semibold text-slate-900">Super Admin Account</h3>
          <p className="text-sm text-slate-500">Login email ও password পরিবর্তন করুন</p>
        </div>

        {accountSaved && (
          <div className="rounded-lg bg-emerald-50 p-3 text-sm text-emerald-700">
            অ্যাকাউন্ট আপডেট হয়েছে। নতুন password দিলে পরের login থেকে সেটা ব্যবহার করুন।
          </div>
        )}
        {accountError && (
          <div className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{accountError}</div>
        )}

        <div>
          <label className="block text-sm font-medium text-slate-700">Login Email</label>
          <input
            type="email"
            className="input mt-1"
            value={account.email}
            onChange={(e) => setAccount({ ...account, email: e.target.value })}
            required
          />
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="block text-sm font-medium text-slate-700">First Name</label>
            <input
              className="input mt-1"
              value={account.firstName}
              onChange={(e) => setAccount({ ...account, firstName: e.target.value })}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700">Last Name</label>
            <input
              className="input mt-1"
              value={account.lastName}
              onChange={(e) => setAccount({ ...account, lastName: e.target.value })}
            />
          </div>
        </div>

        <hr className="border-slate-200" />

        <div>
          <label className="block text-sm font-medium text-slate-700">বর্তমান Password *</label>
          <input
            type="password"
            className="input mt-1"
            value={account.currentPassword}
            onChange={(e) => setAccount({ ...account, currentPassword: e.target.value })}
            autoComplete="current-password"
            required
          />
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="block text-sm font-medium text-slate-700">নতুন Password</label>
            <input
              type="password"
              className="input mt-1"
              value={account.newPassword}
              onChange={(e) => setAccount({ ...account, newPassword: e.target.value })}
              autoComplete="new-password"
              placeholder="খালি রাখলে পরিবর্তন হবে না"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700">নতুন Password নিশ্চিত করুন</label>
            <input
              type="password"
              className="input mt-1"
              value={account.confirmPassword}
              onChange={(e) => setAccount({ ...account, confirmPassword: e.target.value })}
              autoComplete="new-password"
            />
          </div>
        </div>

        <button type="submit" className="btn-primary" disabled={savingAccount}>
          {savingAccount ? 'Saving...' : 'Save Admin Account'}
        </button>
      </form>

      <form onSubmit={handleSave} className="card space-y-6">
        <div>
          <h3 className="text-lg font-semibold text-slate-900">Platform Settings</h3>
          <p className="text-sm text-slate-500">Maintenance, voice ও notification</p>
        </div>

        {saved && <div className="rounded-lg bg-emerald-50 p-3 text-sm text-emerald-700">Settings saved!</div>}

        <div>
          <label className="block text-sm font-medium text-slate-700">Platform Name</label>
          <input className="input mt-1" value={settings.platformName} onChange={(e) => setSettings({ ...settings, platformName: e.target.value })} />
        </div>

        <div className="rounded-lg border border-slate-200 p-4 space-y-4">
          <div>
            <p className="font-medium text-slate-900">Website Contact</p>
            <p className="text-sm text-slate-500">
              Homepage footer-এর Contact section (email, phone, location)
            </p>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700">Email Address</label>
            <input
              type="email"
              className="input mt-1"
              value={settings.contactEmail}
              onChange={(e) => setSettings({ ...settings, contactEmail: e.target.value })}
              placeholder="support@maskara.bd"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700">Phone Number</label>
            <input
              className="input mt-1"
              value={settings.contactPhone}
              onChange={(e) => setSettings({ ...settings, contactPhone: e.target.value })}
              placeholder="+880 1XXX-XXXXXX"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700">Location</label>
            <input
              className="input mt-1"
              value={settings.contactLocation}
              onChange={(e) => setSettings({ ...settings, contactLocation: e.target.value })}
              placeholder="Dhaka, Bangladesh"
              required
            />
          </div>
        </div>

        <div className="flex items-center justify-between rounded-lg border border-slate-200 p-4">
          <div>
            <p className="font-medium text-slate-900">Maintenance Mode</p>
            <p className="text-sm text-slate-500">সব merchant access বন্ধ করুন</p>
          </div>
          <input type="checkbox" checked={settings.maintenanceMode} onChange={(e) => setSettings({ ...settings, maintenanceMode: e.target.checked })} className="h-5 w-5 rounded" />
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700">Default Voice Language</label>
          <select className="input mt-1" value={settings.defaultLanguage} onChange={(e) => setSettings({ ...settings, defaultLanguage: e.target.value })}>
            <option value="bn-BD">Bangla (bn-BD)</option>
            <option value="en-US">English (en-US)</option>
          </select>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="block text-sm font-medium text-slate-700">Max Call Retries</label>
            <input type="number" className="input mt-1" value={settings.maxCallRetries} onChange={(e) => setSettings({ ...settings, maxCallRetries: +e.target.value })} />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700">Retry Interval (min)</label>
            <input type="number" className="input mt-1" value={settings.retryIntervalMin} onChange={(e) => setSettings({ ...settings, retryIntervalMin: +e.target.value })} />
          </div>
        </div>

        <hr className="border-slate-200" />
        <h3 className="font-semibold">Notification Channels</h3>

        {(['twilioEnabled', 'smsEnabled', 'whatsappEnabled'] as const).map((key) => (
          <div key={key} className="flex items-center justify-between rounded-lg border border-slate-200 p-4">
            <p className="font-medium capitalize">{key.replace('Enabled', '').replace(/([A-Z])/g, ' $1')}</p>
            <input type="checkbox" checked={settings[key]} onChange={(e) => setSettings({ ...settings, [key]: e.target.checked })} className="h-5 w-5 rounded" />
          </div>
        ))}

        <button type="submit" className="btn-primary" disabled={saving}>
          {saving ? 'Saving...' : 'Save System Settings'}
        </button>
      </form>
    </div>
  );
}
