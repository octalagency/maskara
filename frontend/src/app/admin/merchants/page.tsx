'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Search, Ban, CheckCircle, Eye, Plus, Globe, Key, Phone } from 'lucide-react';
import { api, AdminMerchantDetail, Plan } from '@/lib/api';
import { DEMO_PLANS } from '@/lib/demo-data';

const DEMO: AdminMerchantDetail[] = [
  { id: 'm-demo', name: 'Demo Fashion Store', email: 'demo@store.com', phone: '+8801712345678', status: 'ACTIVE', subscriptionPlan: 'GROWTH', createdAt: '2025-03-01', wooConnected: true, apiKeyCount: 1, integration: { storeUrl: 'https://filobeauty.xyz', storeName: 'Demo Fashion Store' }, _count: { orders: 890, calls: 780, users: 3 } },
  { id: 'm-1', name: 'Fashion Hub BD', email: 'info@fashionhub.bd', phone: '+8801711111111', status: 'ACTIVE', subscriptionPlan: 'GROWTH', createdAt: '2025-02-01', wooConnected: false, apiKeyCount: 0, _count: { orders: 1234, calls: 1100, users: 2 } },
];

export default function AdminMerchantsPage() {
  const [merchants, setMerchants] = useState<AdminMerchantDetail[]>(DEMO);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState<string | null>(null);
  const [selected, setSelected] = useState<AdminMerchantDetail | null>(null);
  const [plans, setPlans] = useState<Plan[]>(DEMO_PLANS);
  const [planLoading, setPlanLoading] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState({ name: '', email: '', phone: '', password: 'Demo@123', planCode: 'FREE' });

  useEffect(() => {
    api.getAdminMerchants().then((res) => {
      if (res.merchants?.length) setMerchants(res.merchants);
    }).catch(() => {});
    api.getAdminPlans().then(setPlans).catch(() => {});
  }, []);

  async function openDetail(m: AdminMerchantDetail) {
    try {
      const detail = await api.getAdminMerchantDetail(m.id);
      setSelected(detail);
    } catch {
      setSelected(m);
    }
  }

  async function createMerchant(e: React.FormEvent) {
    e.preventDefault();
    setCreating(true);
    try {
      const created = await api.createAdminMerchant(form);
      setMerchants((prev) => [created, ...prev]);
      setShowCreate(false);
      setForm({ name: '', email: '', phone: '', password: 'Demo@123', planCode: 'FREE' });
      alert(`Merchant তৈরি হয়েছে: ${created.email}`);
    } catch {
      alert('Merchant create failed — email duplicate হতে পারে');
    } finally {
      setCreating(false);
    }
  }

  async function assignPlan(merchantId: string, planCode: string) {
    setPlanLoading(true);
    try {
      await api.assignMerchantPlan(merchantId, planCode, true);
      setMerchants((prev) => prev.map((m) => (m.id === merchantId ? { ...m, subscriptionPlan: planCode } : m)));
      if (selected?.id === merchantId) setSelected({ ...selected, subscriptionPlan: planCode });
      alert(`Plan ${planCode} assigned`);
    } catch {
      alert('Plan assign failed');
    } finally {
      setPlanLoading(false);
    }
  }

  const filtered = merchants.filter((m) =>
    m.name.toLowerCase().includes(search.toLowerCase()) ||
    m.email.toLowerCase().includes(search.toLowerCase()),
  );

  async function toggleStatus(id: string, current: string) {
    const next = current === 'SUSPENDED' ? 'ACTIVE' : 'SUSPENDED';
    setLoading(id);
    try {
      await api.updateMerchantStatus(id, next);
      setMerchants((prev) => prev.map((m) => (m.id === id ? { ...m, status: next } : m)));
      if (selected?.id === id) setSelected({ ...selected, status: next });
    } catch {
      alert('Status update failed');
    } finally {
      setLoading(null);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-2xl font-bold text-slate-900">Merchant Control</h2>
          <p className="text-sm text-slate-500">তৈরি, plan দিন, store connection দেখুন, suspend করুন</p>
        </div>
        <div className="flex gap-2">
          <button type="button" onClick={() => setShowCreate(true)} className="btn-primary inline-flex items-center gap-2">
            <Plus className="h-4 w-4" /> নতুন Merchant
          </button>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input className="input pl-9" placeholder="Search..." value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-4">
        <div className="card text-center"><p className="text-2xl font-bold">{merchants.length}</p><p className="text-sm text-slate-500">Total</p></div>
        <div className="card text-center"><p className="text-2xl font-bold text-emerald-600">{merchants.filter((m) => m.status === 'ACTIVE').length}</p><p className="text-sm text-slate-500">Active</p></div>
        <div className="card text-center"><p className="text-2xl font-bold text-brand-600">{merchants.filter((m) => m.wooConnected).length}</p><p className="text-sm text-slate-500">WooCommerce ✓</p></div>
        <div className="card text-center"><p className="text-2xl font-bold text-red-600">{merchants.filter((m) => m.status === 'SUSPENDED').length}</p><p className="text-sm text-slate-500">Suspended</p></div>
      </div>

      <div className="card overflow-hidden p-0">
        <table className="w-full text-left text-sm">
          <thead className="border-b bg-slate-50">
            <tr>
              <th className="px-6 py-3 font-medium text-slate-500">Store</th>
              <th className="px-6 py-3 font-medium text-slate-500">Email</th>
              <th className="px-6 py-3 font-medium text-slate-500">Plan</th>
              <th className="px-6 py-3 font-medium text-slate-500">Store Connect</th>
              <th className="px-6 py-3 font-medium text-slate-500">Status</th>
              <th className="px-6 py-3 font-medium text-slate-500">Orders</th>
              <th className="px-6 py-3 font-medium text-slate-500">Calls</th>
              <th className="px-6 py-3 font-medium text-slate-500">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {filtered.map((m) => (
              <tr key={m.id} className="hover:bg-slate-50">
                <td className="px-6 py-4 font-medium">{m.name}</td>
                <td className="px-6 py-4 text-slate-500">{m.email}</td>
                <td className="px-6 py-4"><span className="badge-info">{m.subscriptionPlan}</span></td>
                <td className="px-6 py-4">
                  {m.wooConnected ? (
                    <span className="badge-success inline-flex items-center gap-1"><Globe className="h-3 w-3" /> Connected</span>
                  ) : (
                    <span className="badge-warning">— Not connected</span>
                  )}
                </td>
                <td className="px-6 py-4">
                  <span className={m.status === 'ACTIVE' ? 'badge-success' : m.status === 'SUSPENDED' ? 'badge-danger' : 'badge-warning'}>{m.status}</span>
                </td>
                <td className="px-6 py-4">{m._count.orders}</td>
                <td className="px-6 py-4">{m._count.calls}</td>
                <td className="px-6 py-4">
                  <div className="flex items-center gap-3">
                    <button onClick={() => openDetail(m)} className="text-brand-600 hover:text-brand-700"><Eye className="h-4 w-4" /></button>
                    <button onClick={() => toggleStatus(m.id, m.status)} disabled={loading === m.id} className={`text-sm font-medium ${m.status === 'SUSPENDED' ? 'text-emerald-600' : 'text-red-600'}`}>
                      {loading === m.id ? '...' : m.status === 'SUSPENDED' ? 'Activate' : 'Suspend'}
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {showCreate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={() => setShowCreate(false)}>
          <form onSubmit={createMerchant} className="w-full max-w-md rounded-xl bg-white p-6 shadow-xl" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-xl font-bold">নতুন Merchant তৈরি</h3>
            <p className="mt-1 text-sm text-slate-500">Admin panel থেকে সরাসরি account খুলুন</p>
            <div className="mt-4 space-y-3">
              <input className="input" placeholder="Store name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
              <input className="input" type="email" placeholder="Email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} required />
              <input className="input" placeholder="Phone 01XXXXXXXXX" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} required />
              <input className="input" type="password" placeholder="Password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} required />
              <select className="input" value={form.planCode} onChange={(e) => setForm({ ...form, planCode: e.target.value })}>
                {plans.map((p) => <option key={p.code} value={p.code}>{p.code}</option>)}
              </select>
            </div>
            <div className="mt-6 flex gap-3">
              <button type="submit" className="btn-primary flex-1" disabled={creating}>{creating ? 'Creating...' : 'Create Merchant'}</button>
              <button type="button" onClick={() => setShowCreate(false)} className="btn-secondary">Cancel</button>
            </div>
          </form>
        </div>
      )}

      {selected && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={() => setSelected(null)}>
          <div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-xl bg-white p-6 shadow-xl" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-xl font-bold">{selected.name}</h3>
            <p className="text-sm text-slate-500">{selected.email} · {selected.phone}</p>

            <div className="mt-4 grid grid-cols-2 gap-4 text-sm sm:grid-cols-4">
              <div><span className="text-slate-500">Plan</span><p className="font-medium">{selected.subscriptionPlan}</p></div>
              <div><span className="text-slate-500">Status</span><p className="font-medium">{selected.status}</p></div>
              <div><span className="text-slate-500">Orders</span><p className="font-medium">{selected._count.orders}</p></div>
              <div><span className="text-slate-500">Calls</span><p className="font-medium">{selected._count.calls}</p></div>
            </div>

            <div className="mt-6 rounded-lg border p-4">
              <h4 className="flex items-center gap-2 font-semibold"><Globe className="h-4 w-4" /> Store Integration</h4>
              {selected.wooConnected ? (
                <div className="mt-2 text-sm text-slate-600">
                  <p><strong>WooCommerce:</strong> {selected.integration?.storeName || selected.integration?.storeUrl}</p>
                  <p className="text-xs text-slate-400">{selected.integration?.storeUrl}</p>
                  {selected.integration?.lastSyncAt && <p className="text-xs">Last sync: {new Date(selected.integration.lastSyncAt).toLocaleString()}</p>}
                </div>
              ) : (
                <p className="mt-2 text-sm text-amber-600">এখনো connect হয়নি — merchant কে Integrations page থেকে WooCommerce plugin setup করতে বলুন</p>
              )}
            </div>

            <div className="mt-4 rounded-lg border p-4">
              <h4 className="flex items-center gap-2 font-semibold"><Key className="h-4 w-4" /> API Keys ({selected.apiKeyCount ?? selected.apiKeys?.length ?? 0})</h4>
              {selected.apiKeys?.length ? (
                <ul className="mt-2 space-y-1 text-sm">
                  {selected.apiKeys.map((k) => (
                    <li key={k.id} className="flex justify-between"><span>{k.name}</span><span className="text-slate-400">{k.keyPrefix}••••</span></li>
                  ))}
                </ul>
              ) : (
                <p className="mt-2 text-sm text-slate-500">কোনো API key নেই</p>
              )}
            </div>

            <div className="mt-6">
              <label className="block text-sm font-medium text-slate-700">Assign Plan</label>
              <div className="mt-2 flex gap-2">
                <select className="input flex-1" defaultValue={selected.subscriptionPlan} id="plan-select" disabled={planLoading}>
                  {plans.map((p) => <option key={p.code} value={p.code}>{p.code} — ৳{Number(p.priceMonthly)}/mo</option>)}
                </select>
                <button type="button" className="btn-primary" disabled={planLoading} onClick={() => {
                  const sel = document.getElementById('plan-select') as HTMLSelectElement;
                  assignPlan(selected.id, sel.value);
                }}>{planLoading ? '...' : 'Assign'}</button>
              </div>
            </div>

            <div className="mt-4 flex flex-wrap gap-3">
              <button onClick={() => toggleStatus(selected.id, selected.status)} className={`btn-primary flex-1 ${selected.status === 'SUSPENDED' ? 'bg-emerald-600' : 'bg-red-600'}`}>
                {selected.status === 'SUSPENDED' ? 'Activate' : 'Suspend'}
              </button>
              <Link href="/admin/config" className="btn-secondary inline-flex items-center gap-2"><Phone className="h-4 w-4" /> ePBX Config</Link>
              <button onClick={() => setSelected(null)} className="btn-secondary">Close</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
