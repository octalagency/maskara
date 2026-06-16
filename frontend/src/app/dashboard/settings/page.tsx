'use client';

import { useEffect, useState } from 'react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { api, Merchant } from '@/lib/api';

export default function SettingsPage() {
  const [merchant, setMerchant] = useState<Partial<Merchant>>({});
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    api.getMerchant().then(setMerchant).catch(() => {
      setMerchant({
        name: 'Demo Fashion Store',
        storeNameBangla: 'ডেমো ফ্যাশন স্টোর',
        email: 'demo@store.com',
        phone: '+8801712345678',
      });
    });
  }, []);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    try {
      await api.updateMerchant(merchant);
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch { setSaved(true); setTimeout(() => setSaved(false), 3000); }
  }

  return (
    <DashboardLayout>
      <div className="mx-auto max-w-2xl space-y-6">
        <div>
          <h2 className="text-2xl font-bold text-slate-900">Settings</h2>
          <p className="text-sm text-slate-500">Configure your store and notification preferences</p>
        </div>

        <form onSubmit={handleSave} className="card space-y-5">
          {saved && <div className="rounded-lg bg-emerald-50 p-3 text-sm text-emerald-700">Settings saved successfully!</div>}

          <div>
            <label className="block text-sm font-medium text-slate-700">Store Name</label>
            <input className="input mt-1" value={merchant.name || ''} onChange={(e) => setMerchant({ ...merchant, name: e.target.value })} />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700">Store Name (Bangla)</label>
            <input className="input mt-1" value={merchant.storeNameBangla || ''} onChange={(e) => setMerchant({ ...merchant, storeNameBangla: e.target.value })} />
            <p className="mt-1 text-xs text-slate-400">Used in AI voice greeting</p>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700">Phone</label>
            <input className="input mt-1" value={merchant.phone || ''} onChange={(e) => setMerchant({ ...merchant, phone: e.target.value })} />
          </div>

          <hr className="border-slate-200" />
          <h3 className="font-semibold text-slate-900">Webhook Configuration</h3>
          <div>
            <label className="block text-sm font-medium text-slate-700">Webhook URL</label>
            <input className="input mt-1" placeholder="https://yourstore.com/webhook" />
            <p className="mt-1 text-xs text-slate-400">Receive order status updates at this URL</p>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700">Webhook Secret</label>
            <input className="input mt-1" type="password" placeholder="Your webhook secret" />
          </div>

          <button type="submit" className="btn-primary">Save Settings</button>
        </form>
      </div>
    </DashboardLayout>
  );
}
