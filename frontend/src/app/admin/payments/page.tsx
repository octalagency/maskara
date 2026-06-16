'use client';

import { useEffect, useState } from 'react';
import { CreditCard, Save } from 'lucide-react';
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

export default function AdminPaymentsPage() {
  const [payment, setPayment] = useState<PaymentForm>({
    bKashNumber: '01700000000',
    nagadNumber: '01800000000',
    instructions: 'Send Money করুন এবং reference হিসেবে Billing ID দিন।',
  });
  const [paymentGateways, setPaymentGateways] = useState<PaymentGatewaysForm>({
    bkash: DEFAULT_BKASH_PGW,
    nagad: DEFAULT_NAGAD_PGW,
  });
  const [paymentStatus, setPaymentStatus] = useState({ bkash: false, nagad: false });
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    api.getPlatformConfig().then((c: PlatformConfig) => {
      const p = c.payment as PaymentForm | undefined;
      if (p) {
        setPayment({
          bKashNumber: p.bKashNumber || '',
          nagadNumber: p.nagadNumber || '',
          instructions: p.instructions || '',
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
    }).catch(() => {});
  }, []);

  async function savePayment(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      await api.updatePlatformConfig({
        payment,
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
      const updated = await api.getPlatformConfig();
      const pg = updated.paymentGateways;
      if (pg) {
        setPaymentStatus(pg.status || { bkash: false, nagad: false });
        setPaymentGateways((prev) => ({
          bkash: {
            ...prev.bkash,
            ...pg.bkash,
            appKey: pg.bkash?.appKey || '',
            appSecret: pg.bkash?.appSecret || '',
            password: pg.bkash?.password || '',
          },
          nagad: {
            ...prev.nagad,
            ...pg.nagad,
            publicKey: pg.nagad?.publicKey || '',
            privateKey: pg.nagad?.privateKey || '',
          },
        }));
      }
    } catch {
      alert('Payment config save failed');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="mx-auto max-w-3xl space-y-8">
      <div>
        <h2 className="text-2xl font-bold text-slate-900">Payment Gateway</h2>
        <p className="text-sm text-slate-500">মার্চেন্ট subscription পেমেন্টের জন্য bKash, Nagad ও manual gateway সেট করুন</p>
      </div>

      <div className="card">
        <p className="text-sm text-slate-500">Gateway Status</p>
        <div className="mt-2 flex flex-wrap gap-2 text-xs">
          <span className={paymentStatus.bkash ? 'badge-success' : 'badge-warning'}>
            bKash {paymentStatus.bkash ? '✓ configured' : '— not configured'}
          </span>
          <span className={paymentStatus.nagad ? 'badge-success' : 'badge-warning'}>
            Nagad {paymentStatus.nagad ? '✓ configured' : '— not configured'}
          </span>
        </div>
      </div>

      <form onSubmit={savePayment} className="card space-y-6">
        <div className="flex items-center gap-2">
          <CreditCard className="h-5 w-5 text-brand-600" />
          <h3 className="font-semibold">Payment Methods</h3>
        </div>

        {saved && (
          <div className="rounded-lg bg-emerald-50 p-3 text-sm text-emerald-700">Payment settings saved!</div>
        )}

        <div className="space-y-3">
          <PaymentMethodCard
            logo={
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-[#E2136E] text-sm font-bold text-white">
                bK
              </div>
            }
            title="bKash"
            subtitle="bKash Tokenized Checkout (App Key + Secret)"
            enabled={paymentGateways.bkash.enabled}
            onEnabledChange={(v) => setPaymentGateways({ ...paymentGateways, bkash: { ...paymentGateways.bkash, enabled: v } })}
            configured={paymentStatus.bkash}
          >
            <PaymentTextField
              label="App Key"
              value={paymentGateways.bkash.appKey}
              onChange={(v) => setPaymentGateways({ ...paymentGateways, bkash: { ...paymentGateways.bkash, appKey: v } })}
              placeholder="iSpc04XvwL0pxafU6TjSbACKtc"
            />
            <PasswordField
              label="App Secret"
              value={paymentGateways.bkash.appSecret}
              onChange={(v) => setPaymentGateways({ ...paymentGateways, bkash: { ...paymentGateways.bkash, appSecret: v } })}
              placeholder={paymentGateways.bkash.appSecretSet ? '•••••••• (unchanged if empty)' : 'Enter app secret'}
              saved={paymentGateways.bkash.appSecretSet}
            />
            <PaymentTextField
              label="Username (developer.bka.sh)"
              value={paymentGateways.bkash.username}
              onChange={(v) => setPaymentGateways({ ...paymentGateways, bkash: { ...paymentGateways.bkash, username: v } })}
              placeholder="017XXXXXXXX"
            />
            <PasswordField
              label="Password"
              value={paymentGateways.bkash.password}
              onChange={(v) => setPaymentGateways({ ...paymentGateways, bkash: { ...paymentGateways.bkash, password: v } })}
              placeholder={paymentGateways.bkash.passwordSet ? '•••••••• (unchanged if empty)' : 'Enter password'}
              saved={paymentGateways.bkash.passwordSet}
            />
            <PaymentTextField
              label="Merchant number (optional)"
              value={paymentGateways.bkash.merchantNumber}
              onChange={(v) => setPaymentGateways({ ...paymentGateways, bkash: { ...paymentGateways.bkash, merchantNumber: v } })}
              placeholder="01XXXXXXXXX"
            />
            <label className="flex items-center gap-2 text-sm text-slate-600">
              <input
                type="checkbox"
                checked={paymentGateways.bkash.sandbox}
                onChange={(e) => setPaymentGateways({ ...paymentGateways, bkash: { ...paymentGateways.bkash, sandbox: e.target.checked } })}
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
            title="Nagad"
            subtitle="Nagad Payment Gateway (Merchant ID + Keys)"
            enabled={paymentGateways.nagad.enabled}
            onEnabledChange={(v) => setPaymentGateways({ ...paymentGateways, nagad: { ...paymentGateways.nagad, enabled: v } })}
            configured={paymentStatus.nagad}
          >
            <PaymentTextField
              label="Merchant ID"
              value={paymentGateways.nagad.merchantId}
              onChange={(v) => setPaymentGateways({ ...paymentGateways, nagad: { ...paymentGateways.nagad, merchantId: v } })}
              placeholder="NAGAD_MERCHANT_ID"
            />
            <PasswordField
              label="Public Key"
              value={paymentGateways.nagad.publicKey}
              onChange={(v) => setPaymentGateways({ ...paymentGateways, nagad: { ...paymentGateways.nagad, publicKey: v } })}
              placeholder={paymentGateways.nagad.publicKeySet ? '•••••••• (unchanged if empty)' : 'Enter public key'}
              saved={paymentGateways.nagad.publicKeySet}
            />
            <PasswordField
              label="Private Key"
              value={paymentGateways.nagad.privateKey}
              onChange={(v) => setPaymentGateways({ ...paymentGateways, nagad: { ...paymentGateways.nagad, privateKey: v } })}
              placeholder={paymentGateways.nagad.privateKeySet ? '•••••••• (unchanged if empty)' : 'Enter private key'}
              saved={paymentGateways.nagad.privateKeySet}
            />
            <PaymentTextField
              label="Merchant number (optional)"
              value={paymentGateways.nagad.merchantNumber}
              onChange={(v) => setPaymentGateways({ ...paymentGateways, nagad: { ...paymentGateways.nagad, merchantNumber: v } })}
              placeholder="01XXXXXXXXX"
            />
            <label className="flex items-center gap-2 text-sm text-slate-600">
              <input
                type="checkbox"
                checked={paymentGateways.nagad.sandbox}
                onChange={(e) => setPaymentGateways({ ...paymentGateways, nagad: { ...paymentGateways.nagad, sandbox: e.target.checked } })}
              />
              Sandbox mode
            </label>
          </PaymentMethodCard>

          <PaymentMethodCard
            logo={
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-slate-600 text-sm font-bold text-white">
                SM
              </div>
            }
            title="Send Money"
            subtitle="Manual payment fallback (bKash/Nagad number)"
            enabled={false}
            onEnabledChange={() => {}}
            showToggle={false}
            defaultOpen={false}
          >
            <div className="grid gap-4 sm:grid-cols-2">
              <PaymentTextField
                label="bKash Number"
                value={payment.bKashNumber}
                onChange={(v) => setPayment({ ...payment, bKashNumber: v })}
                placeholder="01700000000"
              />
              <PaymentTextField
                label="Nagad Number"
                value={payment.nagadNumber}
                onChange={(v) => setPayment({ ...payment, nagadNumber: v })}
                placeholder="01800000000"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700">Payment Instructions</label>
              <textarea
                className="input mt-1 min-h-[80px]"
                value={payment.instructions}
                onChange={(e) => setPayment({ ...payment, instructions: e.target.value })}
              />
            </div>
          </PaymentMethodCard>
        </div>

        <button type="submit" className="btn-primary inline-flex items-center gap-2" disabled={saving}>
          <Save className="h-4 w-4" />
          {saving ? 'Saving...' : 'Save Payment Methods'}
        </button>
      </form>
    </div>
  );
}
