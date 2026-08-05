'use client';

import { useEffect, useState } from 'react';
import { Plus, Save, TicketPercent, ToggleLeft, ToggleRight } from 'lucide-react';
import { api, AdminCoupon } from '@/lib/api';
import { formatCurrency } from '@/lib/utils';

const EMPTY = {
  code: '',
  description: '',
  type: 'PERCENT' as 'PERCENT' | 'FIXED',
  value: 10,
  planCodes: '',
  merchantIds: '',
  maxRedemptions: '' as string | number,
  perMerchantLimit: 1,
  validUntil: '',
  isActive: true,
};

export default function AdminCouponsPage() {
  const [coupons, setCoupons] = useState<AdminCoupon[]>([]);
  const [form, setForm] = useState({ ...EMPTY });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  async function load() {
    try {
      const rows = await api.getAdminCoupons();
      setCoupons(rows);
    } catch {
      setError('কুপন লোড হয়নি');
    }
  }

  useEffect(() => {
    void load();
  }, []);

  async function createCoupon(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError('');
    setMessage('');
    try {
      await api.createAdminCoupon({
        code: form.code,
        description: form.description || undefined,
        type: form.type,
        value: Number(form.value),
        planCodes: form.planCodes
          ? form.planCodes.split(/[,\s]+/).map((s) => s.trim()).filter(Boolean)
          : [],
        merchantIds: form.merchantIds
          ? form.merchantIds.split(/[,\s]+/).map((s) => s.trim()).filter(Boolean)
          : [],
        maxRedemptions: form.maxRedemptions === '' ? null : Number(form.maxRedemptions),
        perMerchantLimit: Number(form.perMerchantLimit) || 1,
        validUntil: form.validUntil || null,
        isActive: form.isActive,
      });
      setForm({ ...EMPTY });
      setMessage('কুপন তৈরি হয়েছে');
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Create failed');
    } finally {
      setSaving(false);
    }
  }

  async function toggleActive(c: AdminCoupon) {
    try {
      await api.updateAdminCoupon(c.id, { isActive: !c.isActive });
      await load();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Update failed');
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-slate-900">কুপন কোড</h2>
        <p className="text-sm text-slate-500">
          মার্চেন্টদের সাবস্ক্রিপশনে ডিসকাউন্ট দিন — % বা ফিক্সড টাকা
        </p>
      </div>

      <form onSubmit={createCoupon} className="card space-y-4">
        <div className="flex items-center gap-2">
          <TicketPercent className="h-5 w-5 text-brand-600" />
          <h3 className="font-semibold text-slate-900">নতুন কুপন</h3>
        </div>

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <label className="text-xs font-medium text-slate-500">Code</label>
            <input
              className="input mt-1 uppercase"
              required
              minLength={3}
              placeholder="SAVE20"
              value={form.code}
              onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase() })}
            />
          </div>
          <div>
            <label className="text-xs font-medium text-slate-500">Type</label>
            <select
              className="input mt-1"
              value={form.type}
              onChange={(e) =>
                setForm({ ...form, type: e.target.value as 'PERCENT' | 'FIXED' })
              }
            >
              <option value="PERCENT">Percent (%)</option>
              <option value="FIXED">Fixed (৳)</option>
            </select>
          </div>
          <div>
            <label className="text-xs font-medium text-slate-500">
              Value {form.type === 'PERCENT' ? '(%)' : '(৳)'}
            </label>
            <input
              type="number"
              className="input mt-1"
              required
              min={1}
              max={form.type === 'PERCENT' ? 100 : undefined}
              value={form.value}
              onChange={(e) => setForm({ ...form, value: +e.target.value })}
            />
          </div>
          <div>
            <label className="text-xs font-medium text-slate-500">Max uses (optional)</label>
            <input
              type="number"
              className="input mt-1"
              placeholder="Unlimited"
              min={1}
              value={form.maxRedemptions}
              onChange={(e) => setForm({ ...form, maxRedemptions: e.target.value })}
            />
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <div className="sm:col-span-2">
            <label className="text-xs font-medium text-slate-500">Description</label>
            <input
              className="input mt-1"
              placeholder="Starter launch discount"
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
            />
          </div>
          <div>
            <label className="text-xs font-medium text-slate-500">
              Plans (empty = all)
            </label>
            <input
              className="input mt-1"
              placeholder="STARTER, GROWTH"
              value={form.planCodes}
              onChange={(e) => setForm({ ...form, planCodes: e.target.value })}
            />
          </div>
          <div>
            <label className="text-xs font-medium text-slate-500">Expires</label>
            <input
              type="date"
              className="input mt-1"
              value={form.validUntil}
              onChange={(e) => setForm({ ...form, validUntil: e.target.value })}
            />
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <label className="text-xs font-medium text-slate-500">
              Merchant IDs only (empty = everyone)
            </label>
            <input
              className="input mt-1 font-mono text-xs"
              placeholder="cuid1, cuid2"
              value={form.merchantIds}
              onChange={(e) => setForm({ ...form, merchantIds: e.target.value })}
            />
          </div>
          <div>
            <label className="text-xs font-medium text-slate-500">
              Per merchant limit
            </label>
            <input
              type="number"
              className="input mt-1"
              min={1}
              value={form.perMerchantLimit}
              onChange={(e) =>
                setForm({ ...form, perMerchantLimit: +e.target.value || 1 })
              }
            />
          </div>
        </div>

        {error && (
          <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>
        )}
        {message && (
          <p className="rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
            {message}
          </p>
        )}

        <button
          type="submit"
          disabled={saving}
          className="inline-flex items-center gap-2 rounded-xl bg-brand-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-50"
        >
          {saving ? (
            <Save className="h-4 w-4 animate-pulse" />
          ) : (
            <Plus className="h-4 w-4" />
          )}
          Create coupon
        </button>
      </form>

      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-slate-100 bg-slate-50 text-xs uppercase text-slate-500">
            <tr>
              <th className="px-4 py-3 font-medium">Code</th>
              <th className="px-4 py-3 font-medium">Discount</th>
              <th className="px-4 py-3 font-medium">Scope</th>
              <th className="px-4 py-3 font-medium">Used</th>
              <th className="px-4 py-3 font-medium">Status</th>
              <th className="px-4 py-3 font-medium" />
            </tr>
          </thead>
          <tbody>
            {coupons.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-10 text-center text-slate-400">
                  এখনো কোনো কুপন নেই
                </td>
              </tr>
            ) : (
              coupons.map((c) => (
                <tr key={c.id} className="border-b border-slate-50 last:border-0">
                  <td className="px-4 py-3">
                    <p className="font-mono font-semibold text-slate-900">{c.code}</p>
                    {c.description && (
                      <p className="text-xs text-slate-500">{c.description}</p>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    {c.type === 'PERCENT'
                      ? `${Number(c.value)}%`
                      : formatCurrency(Number(c.value))}
                  </td>
                  <td className="px-4 py-3 text-xs text-slate-600">
                    <p>
                      Plans:{' '}
                      {c.planCodes?.length ? c.planCodes.join(', ') : 'All'}
                    </p>
                    <p>
                      Merchants:{' '}
                      {c.merchantIds?.length
                        ? `${c.merchantIds.length} locked`
                        : 'All'}
                    </p>
                    {c.validUntil && (
                      <p>Until {new Date(c.validUntil).toLocaleDateString()}</p>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    {c.usedCount}
                    {c.maxRedemptions != null ? ` / ${c.maxRedemptions}` : ''}
                    {c._count?.redemptions != null && (
                      <span className="block text-xs text-slate-400">
                        {_countLabel(c._count.redemptions)}
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={
                        c.isActive ? 'text-emerald-600' : 'text-slate-400'
                      }
                    >
                      {c.isActive ? 'Active' : 'Off'}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <button
                      type="button"
                      onClick={() => void toggleActive(c)}
                      className="inline-flex items-center gap-1 text-sm text-slate-600 hover:text-brand-700"
                      title={c.isActive ? 'Deactivate' : 'Activate'}
                    >
                      {c.isActive ? (
                        <ToggleRight className="h-5 w-5 text-emerald-600" />
                      ) : (
                        <ToggleLeft className="h-5 w-5" />
                      )}
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function _countLabel(n: number) {
  return `${n} redemption${n === 1 ? '' : 's'}`;
}
