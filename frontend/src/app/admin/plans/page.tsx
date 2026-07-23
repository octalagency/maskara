'use client';

import { useEffect, useState } from 'react';
import { Pencil, Save, X } from 'lucide-react';
import { api, Plan } from '@/lib/api';
import { formatCurrency } from '@/lib/utils';

export default function AdminPlansPage() {
  const [plans, setPlans] = useState<Plan[]>([]);
  const [editing, setEditing] = useState<string | null>(null);
  const [form, setForm] = useState<Partial<Plan>>({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    api.getAdminPlans().then(setPlans).catch(() => {});
  }, []);

  function startEdit(plan: Plan) {
    setEditing(plan.id);
    setForm({
      name: plan.name,
      nameBangla: plan.nameBangla,
      priceMonthly: Number(plan.priceMonthly),
      callLimit: plan.callLimit,
      smsLimit: plan.smsLimit,
      isActive: plan.isActive,
      isPopular: plan.isPopular,
    });
  }

  async function savePlan(id: string) {
    setSaving(true);
    try {
      await api.updateAdminPlan(id, form);
      setPlans((prev) =>
        prev.map((p) => (p.id === id ? { ...p, ...form, priceMonthly: form.priceMonthly ?? p.priceMonthly } : p)),
      );
      setEditing(null);
    } catch {
      alert('Plan save failed');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-slate-900">Plan Management</h2>
        <p className="text-sm text-slate-500">মাসিক প্ল্যান, দাম ও লিমিট কনফিগার করুন — merchant রা এগুলো কিনবে</p>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        {plans.map((plan) => {
          const isEdit = editing === plan.id;
          const features = Array.isArray(plan.features) ? plan.features : [];
          return (
            <div key={plan.id} className={`card relative ${plan.isPopular ? 'ring-2 ring-brand-500' : ''}`}>
              {plan.isPopular && (
                <span className="absolute -top-2 right-4 rounded-full bg-brand-600 px-2 py-0.5 text-xs text-white">Popular</span>
              )}
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="text-lg font-bold">{plan.code}</h3>
                  <p className="text-sm text-slate-500">{plan.nameBangla || plan.name}</p>
                </div>
                {!isEdit ? (
                  <button onClick={() => startEdit(plan)} className="text-brand-600 hover:text-brand-700">
                    <Pencil className="h-4 w-4" />
                  </button>
                ) : (
                  <div className="flex gap-2">
                    <button onClick={() => savePlan(plan.id)} disabled={saving} className="text-emerald-600">
                      <Save className="h-4 w-4" />
                    </button>
                    <button onClick={() => setEditing(null)} className="text-slate-400">
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                )}
              </div>

              {isEdit ? (
                <div className="mt-4 space-y-3">
                  <input className="input" placeholder="Name" value={form.name || ''} onChange={(e) => setForm({ ...form, name: e.target.value })} />
                  <input className="input" placeholder="Name (Bangla)" value={form.nameBangla || ''} onChange={(e) => setForm({ ...form, nameBangla: e.target.value })} />
                  <div className="grid grid-cols-3 gap-2">
                    <input type="number" className="input" placeholder="Price/mo" value={form.priceMonthly ?? ''} onChange={(e) => setForm({ ...form, priceMonthly: +e.target.value })} />
                    <input type="number" className="input" placeholder="Order confirmed" value={form.callLimit ?? ''} onChange={(e) => setForm({ ...form, callLimit: +e.target.value })} />
                    <input type="number" className="input" placeholder="SMS" value={form.smsLimit ?? ''} onChange={(e) => setForm({ ...form, smsLimit: +e.target.value })} />
                  </div>
                  <label className="flex items-center gap-2 text-sm">
                    <input type="checkbox" checked={form.isActive ?? true} onChange={(e) => setForm({ ...form, isActive: e.target.checked })} />
                    Active
                  </label>
                </div>
              ) : (
                <>
                  <p className="mt-3 text-2xl font-bold">{formatCurrency(Number(plan.priceMonthly))}<span className="text-sm font-normal text-slate-500">/মাস</span></p>
                  <div className="mt-2 flex gap-4 text-sm text-slate-600">
                    <span>{plan.callLimit.toLocaleString()} order confirmed</span>
                    <span>{plan.smsLimit.toLocaleString()} SMS</span>
                    <span className={plan.isActive ? 'text-emerald-600' : 'text-red-600'}>{plan.isActive ? 'Active' : 'Inactive'}</span>
                  </div>
                  <ul className="mt-3 space-y-1 text-sm text-slate-500">
                    {features.slice(0, 4).map((f) => (
                      <li key={String(f)}>• {String(f)}</li>
                    ))}
                  </ul>
                </>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
