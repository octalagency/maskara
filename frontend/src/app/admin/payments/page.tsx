'use client';

import { useEffect, useState } from 'react';
import { CreditCard, Save, ExternalLink, Copy, Eye } from 'lucide-react';
import { api, PlatformConfig } from '@/lib/api';
import {
  PaymentMethodCard,
  PaymentTextField,
  PasswordField,
} from '@/components/admin/PaymentMethodCard';

interface PaymentForm {
  bKashNumber: string;
  nagadNumber: string;
  instructions: string;
  portalUsername: string;
  portalPassword: string;
  portalPasswordSet: boolean;
}

interface BkashPgwForm {
  enabled: boolean;
  sandbox: boolean;
  username: string;
  merchantNumber: string;
  appKey: string;
  appKeySet: boolean;
  appSecret: string;
  appSecretSet: boolean;
  password: string;
  passwordSet: boolean;
  baseUrl: string;
}

interface NagadPgwForm {
  enabled: boolean;
  sandbox: boolean;
  merchantId: string;
  merchantNumber: string;
  publicKey: string;
  publicKeySet: boolean;
  privateKey: string;
  privateKeySet: boolean;
  baseUrl: string;
}

interface PaymentGatewaysForm {
  bkash: BkashPgwForm;
  nagad: NagadPgwForm;
}

const DEFAULT_BKASH_PGW: BkashPgwForm = {
  enabled: false,
  sandbox: true,
  username: '',
  merchantNumber: '',
  appKey: '',
  appKeySet: false,
  appSecret: '',
  appSecretSet: false,
  password: '',
  passwordSet: false,
  baseUrl: '',
};

const DEFAULT_NAGAD_PGW: NagadPgwForm = {
  enabled: false,
  sandbox: true,
  merchantId: '',
  merchantNumber: '',
  publicKey: '',
  publicKeySet: false,
  privateKey: '',
  privateKeySet: false,
  baseUrl: '',
};

const PORTAL_LOGIN = 'https://merchantportal.bkash.com/login';

export default function AdminPaymentsPage() {
  const [payment, setPayment] = useState<PaymentForm>({
    bKashNumber: '',
    nagadNumber: '',
    instructions:
      'bKash Send Money করুন। তারপর Maskara Subscription পেজে TrxID, নম্বর ও অ্যামাউন্ট সাবমিট করুন।',
    portalUsername: '',
    portalPassword: '',
    portalPasswordSet: false,
  });
  const [paymentGateways, setPaymentGateways] = useState<PaymentGatewaysForm>({
    bkash: DEFAULT_BKASH_PGW,
    nagad: DEFAULT_NAGAD_PGW,
  });
  const [paymentStatus, setPaymentStatus] = useState({ bkash: false, nagad: false });
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    api
      .getPlatformConfig()
      .then((c: PlatformConfig) => {
        const p = c.payment as
          | {
              bKashNumber?: string;
              nagadNumber?: string;
              instructions?: string;
              bkashPortal?: {
                username?: string;
                password?: string;
                passwordSet?: boolean;
              };
            }
          | undefined;
        if (p) {
          setPayment({
            bKashNumber: p.bKashNumber || '',
            nagadNumber: p.nagadNumber || '',
            instructions: p.instructions || '',
            portalUsername: p.bkashPortal?.username || '',
            portalPassword: '',
            portalPasswordSet: Boolean(p.bkashPortal?.passwordSet),
          });
        }
        const pg = c.paymentGateways;
        if (pg) {
          setPaymentStatus(pg.status || { bkash: false, nagad: false });
          setPaymentGateways({
            bkash: {
              enabled: pg.bkash?.enabled ?? false,
              sandbox: pg.bkash?.sandbox ?? true,
              username: pg.bkash?.username || '',
              merchantNumber: pg.bkash?.merchantNumber || '',
              appKey: pg.bkash?.appKey || '',
              appKeySet: pg.bkash?.appKeySet ?? false,
              appSecret: pg.bkash?.appSecret || '',
              appSecretSet: pg.bkash?.appSecretSet ?? false,
              password: pg.bkash?.password || '',
              passwordSet: pg.bkash?.passwordSet ?? false,
              baseUrl: pg.bkash?.baseUrl || '',
            },
            nagad: {
              enabled: pg.nagad?.enabled ?? false,
              sandbox: pg.nagad?.sandbox ?? true,
              merchantId: pg.nagad?.merchantId || '',
              merchantNumber: pg.nagad?.merchantNumber || '',
              publicKey: pg.nagad?.publicKey || '',
              publicKeySet: pg.nagad?.publicKeySet ?? false,
              privateKey: pg.nagad?.privateKey || '',
              privateKeySet: pg.nagad?.privateKeySet ?? false,
              baseUrl: pg.nagad?.baseUrl || '',
            },
          });
        }
      })
      .catch(() => {});
  }, []);

  async function savePayment(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      await api.updatePlatformConfig({
        payment: {
          bKashNumber: payment.bKashNumber,
          nagadNumber: payment.nagadNumber,
          instructions: payment.instructions,
          bkashPortal: {
            username: payment.portalUsername,
            password: payment.portalPassword || undefined,
          },
        },
        payment_gateways: {
          bkash: {
            enabled: paymentGateways.bkash.enabled,
            sandbox: paymentGateways.bkash.sandbox,
            username: paymentGateways.bkash.username,
            merchantNumber: paymentGateways.bkash.merchantNumber || undefined,
            appKey: paymentGateways.bkash.appKey || undefined,
            appSecret: paymentGateways.bkash.appSecret || undefined,
            password: paymentGateways.bkash.password || undefined,
            baseUrl: paymentGateways.bkash.baseUrl || undefined,
          },
          nagad: {
            enabled: paymentGateways.nagad.enabled,
            sandbox: paymentGateways.nagad.sandbox,
            merchantId: paymentGateways.nagad.merchantId,
            merchantNumber: paymentGateways.nagad.merchantNumber,
            publicKey: paymentGateways.nagad.publicKey || undefined,
            privateKey: paymentGateways.nagad.privateKey || undefined,
            baseUrl: paymentGateways.nagad.baseUrl || undefined,
          },
        },
      });
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
      setPayment((prev) => ({
        ...prev,
        portalPassword: '',
        portalPasswordSet: prev.portalPasswordSet || Boolean(prev.portalPassword),
      }));
    } catch {
      alert('Payment config save failed');
    } finally {
      setSaving(false);
    }
  }

  async function copyPortalCred(field: 'username' | 'password') {
    try {
      const creds = await api.getBkashPortalCredentials();
      const value = field === 'username' ? creds.username : creds.password;
      if (!value) {
        alert(field === 'username' ? 'Username সেট নেই' : 'Password সেট নেই');
        return;
      }
      await navigator.clipboard.writeText(value);
      alert(`${field} copied`);
    } catch {
      alert('Credentials load failed');
    }
  }

  async function revealAndOpenPortal() {
    try {
      const creds = await api.getBkashPortalCredentials();
      if (creds.username) await navigator.clipboard.writeText(creds.username);
      window.open(PORTAL_LOGIN, '_blank', 'noopener,noreferrer');
      if (creds.password) {
        setTimeout(() => {
          void navigator.clipboard.writeText(creds.password);
          alert('Portal খোলা হয়েছে। Password clipboard-এ কপি হয়েছে — paste করুন।');
        }, 400);
      } else {
        alert('Portal খোলা হয়েছে। Password সেভ করুন আগে।');
      }
    } catch {
      window.open(PORTAL_LOGIN, '_blank', 'noopener,noreferrer');
    }
  }

  return (
    <div className="mx-auto max-w-3xl space-y-8">
      <div>
        <h2 className="text-2xl font-bold text-slate-900">Payment Gateway</h2>
        <p className="text-sm text-slate-500">
          Primary: bKash Merchant Portal + Send Money (non-API). API gateway optional।
        </p>
      </div>

      <form onSubmit={savePayment} className="space-y-6">
        {saved && (
          <div className="rounded-lg bg-emerald-50 p-3 text-sm text-emerald-700">
            Payment settings saved!
          </div>
        )}

        <div className="card space-y-4">
          <div className="flex items-center gap-2">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-[#E2136E] text-sm font-bold text-white">
              bK
            </div>
            <div>
              <h3 className="font-semibold">bKash Merchant Portal (non-API)</h3>
              <p className="text-xs text-slate-500">
                merchantportal.bkash.com — user/pass সেভ → Open + copy → ট্রানজেকশন মিলিয়ে Paid
              </p>
            </div>
          </div>

          <PaymentTextField
            label="Portal username / email"
            value={payment.portalUsername}
            onChange={(v) => setPayment({ ...payment, portalUsername: v })}
            placeholder="portal login email or number"
          />
          <PasswordField
            label="Portal password"
            value={payment.portalPassword}
            onChange={(v) => setPayment({ ...payment, portalPassword: v })}
            placeholder={
              payment.portalPasswordSet
                ? '•••••••• (unchanged if empty)'
                : 'Enter portal password'
            }
            saved={payment.portalPasswordSet}
          />
          <PaymentTextField
            label="Send Money number (মার্চেন্ট যা দেখবে)"
            value={payment.bKashNumber}
            onChange={(v) => setPayment({ ...payment, bKashNumber: v })}
            placeholder="01XXXXXXXXX"
          />
          <div>
            <label className="block text-sm font-medium text-slate-700">
              Payment instructions
            </label>
            <textarea
              className="input mt-1 min-h-[80px]"
              value={payment.instructions}
              onChange={(e) =>
                setPayment({ ...payment, instructions: e.target.value })
              }
            />
          </div>

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => void revealAndOpenPortal()}
              className="btn-primary inline-flex items-center gap-2 text-sm"
            >
              <ExternalLink className="h-4 w-4" /> Open Portal + copy login
            </button>
            <button
              type="button"
              onClick={() => void copyPortalCred('username')}
              className="btn-secondary inline-flex items-center gap-1 text-sm"
            >
              <Copy className="h-3.5 w-3.5" /> Copy user
            </button>
            <button
              type="button"
              onClick={() => void copyPortalCred('password')}
              className="btn-secondary inline-flex items-center gap-1 text-sm"
            >
              <Eye className="h-3.5 w-3.5" /> Copy password
            </button>
          </div>
          <p className="text-xs text-slate-400">
            ব্রাউজার সিকিউরিটির জন্য third-party সাইটে auto-session রাখা যায় না — credentials
            সেভ + one-click open/copy দিয়ে দ্রুত login করুন।
          </p>
        </div>

        <div className="card space-y-4">
          <div className="flex items-center gap-2">
            <CreditCard className="h-5 w-5 text-brand-600" />
            <h3 className="font-semibold">Manual numbers</h3>
          </div>
          <PaymentTextField
            label="Nagad number (optional)"
            value={payment.nagadNumber}
            onChange={(v) => setPayment({ ...payment, nagadNumber: v })}
            placeholder="01XXXXXXXXX"
          />
        </div>

        <div className="card space-y-4">
          <h3 className="font-semibold text-slate-700">API gateway (optional)</h3>
          <p className="text-xs text-slate-500">
            Tokenized Checkout — শুধু যদি অফিসিয়াল API key থাকে। ডিফল্ট অফ রাখুন।
          </p>
          <div className="flex flex-wrap gap-2 text-xs">
            <span className={paymentStatus.bkash ? 'badge-success' : 'badge-warning'}>
              bKash API {paymentStatus.bkash ? '✓' : '— off'}
            </span>
            <span className={paymentStatus.nagad ? 'badge-success' : 'badge-warning'}>
              Nagad API {paymentStatus.nagad ? '✓' : '— off'}
            </span>
          </div>

          <PaymentMethodCard
            logo={
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-[#E2136E] text-sm font-bold text-white">
                API
              </div>
            }
            title="bKash Tokenized API"
            subtitle="App Key + Secret (optional)"
            enabled={paymentGateways.bkash.enabled}
            onEnabledChange={(v) =>
              setPaymentGateways({
                ...paymentGateways,
                bkash: { ...paymentGateways.bkash, enabled: v },
              })
            }
            configured={paymentStatus.bkash}
            defaultOpen={false}
          >
            <PaymentTextField
              label="App Key"
              value={paymentGateways.bkash.appKey}
              onChange={(v) =>
                setPaymentGateways({
                  ...paymentGateways,
                  bkash: { ...paymentGateways.bkash, appKey: v },
                })
              }
            />
            <PasswordField
              label="App Secret"
              value={paymentGateways.bkash.appSecret}
              onChange={(v) =>
                setPaymentGateways({
                  ...paymentGateways,
                  bkash: { ...paymentGateways.bkash, appSecret: v },
                })
              }
              saved={paymentGateways.bkash.appSecretSet}
            />
            <PaymentTextField
              label="Username"
              value={paymentGateways.bkash.username}
              onChange={(v) =>
                setPaymentGateways({
                  ...paymentGateways,
                  bkash: { ...paymentGateways.bkash, username: v },
                })
              }
            />
            <PasswordField
              label="Password"
              value={paymentGateways.bkash.password}
              onChange={(v) =>
                setPaymentGateways({
                  ...paymentGateways,
                  bkash: { ...paymentGateways.bkash, password: v },
                })
              }
              saved={paymentGateways.bkash.passwordSet}
            />
            <label className="flex items-center gap-2 text-sm text-slate-600">
              <input
                type="checkbox"
                checked={paymentGateways.bkash.sandbox}
                onChange={(e) =>
                  setPaymentGateways({
                    ...paymentGateways,
                    bkash: { ...paymentGateways.bkash, sandbox: e.target.checked },
                  })
                }
              />
              Sandbox mode
            </label>
          </PaymentMethodCard>

          <PaymentMethodCard
            logo={
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-[#F69220] text-sm font-bold text-white">
                NG
              </div>
            }
            title="Nagad API"
            subtitle="Optional"
            enabled={paymentGateways.nagad.enabled}
            onEnabledChange={(v) =>
              setPaymentGateways({
                ...paymentGateways,
                nagad: { ...paymentGateways.nagad, enabled: v },
              })
            }
            configured={paymentStatus.nagad}
            defaultOpen={false}
          >
            <PaymentTextField
              label="Merchant ID"
              value={paymentGateways.nagad.merchantId}
              onChange={(v) =>
                setPaymentGateways({
                  ...paymentGateways,
                  nagad: { ...paymentGateways.nagad, merchantId: v },
                })
              }
            />
            <PasswordField
              label="Private Key"
              value={paymentGateways.nagad.privateKey}
              onChange={(v) =>
                setPaymentGateways({
                  ...paymentGateways,
                  nagad: { ...paymentGateways.nagad, privateKey: v },
                })
              }
              saved={paymentGateways.nagad.privateKeySet}
            />
          </PaymentMethodCard>
        </div>

        <button
          type="submit"
          className="btn-primary inline-flex items-center gap-2"
          disabled={saving}
        >
          <Save className="h-4 w-4" />
          {saving ? 'Saving...' : 'Save Payment Settings'}
        </button>
      </form>
    </div>
  );
}
