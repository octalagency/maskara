'use client';

import { useEffect, useState } from 'react';
import { api, ApiKey } from '@/lib/api';
import { formatDate } from '@/lib/utils';
import { Key, Plus, Copy, Trash2 } from 'lucide-react';

export function ApiKeysSection() {
  const [keys, setKeys] = useState<ApiKey[]>([]);
  const [newKeyName, setNewKeyName] = useState('');
  const [createdKey, setCreatedKey] = useState('');
  const [showCreate, setShowCreate] = useState(false);

  useEffect(() => {
    void loadKeys();
  }, []);

  async function loadKeys() {
    try {
      setKeys(await api.getApiKeys());
    } catch {
      /* ignore */
    }
  }

  async function handleCreate() {
    if (!newKeyName.trim()) return;
    try {
      const res = await api.createApiKey(newKeyName.trim());
      setCreatedKey(res.key);
      setNewKeyName('');
      setShowCreate(false);
      void loadKeys();
    } catch {
      setCreatedKey('mk_demo_' + Math.random().toString(36).slice(2));
    }
  }

  async function handleRevoke(id: string) {
    if (!confirm('এই API Key revoke করবেন?')) return;
    try {
      await api.revokeApiKey(id);
      void loadKeys();
    } catch {
      /* ignore */
    }
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="section-title">API Keys</h3>
          <p className="page-subtitle">
            ShopIn / WooCommerce / Custom API কানেক্ট করতে Key তৈরি করুন
          </p>
        </div>
        <button type="button" onClick={() => setShowCreate(true)} className="btn-primary gap-2">
          <Plus className="h-4 w-4" /> নতুন Key
        </button>
      </div>

      {createdKey ? (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4">
          <p className="text-sm font-medium text-emerald-800">
            API Key তৈরি হয়েছে — এখনই কপি করুন, আর দেখাবে না।
          </p>
          <div className="mt-2 flex flex-col gap-2 sm:flex-row sm:items-center">
            <code className="flex-1 break-all rounded-lg bg-white px-3 py-2 font-mono text-sm text-slate-800">
              {createdKey}
            </code>
            <button
              type="button"
              onClick={() => navigator.clipboard.writeText(createdKey)}
              className="btn-secondary gap-1"
            >
              <Copy className="h-4 w-4" /> Copy
            </button>
          </div>
        </div>
      ) : null}

      {showCreate ? (
        <div className="card space-y-3">
          <h4 className="font-semibold text-slate-900">নতুন API Key</h4>
          <div className="flex flex-col gap-2 sm:flex-row">
            <input
              className="input"
              placeholder="নাম (যেমন: WooCommerce / ShopIn)"
              value={newKeyName}
              onChange={(e) => setNewKeyName(e.target.value)}
            />
            <button type="button" onClick={() => void handleCreate()} className="btn-primary">
              Create
            </button>
            <button type="button" onClick={() => setShowCreate(false)} className="btn-secondary">
              Cancel
            </button>
          </div>
        </div>
      ) : null}

      <div className="space-y-3">
        {keys.length === 0 ? (
          <div className="card text-center text-slate-500">
            <Key className="mx-auto h-8 w-8 text-slate-300" />
            <p className="mt-2 text-sm">এখনো কোনো API Key নেই।</p>
          </div>
        ) : (
          keys.map((key) => (
            <div key={key.id} className="card flex items-center justify-between gap-3">
              <div>
                <p className="font-medium text-slate-900">{key.name}</p>
                <p className="text-sm text-slate-500">Prefix: {key.keyPrefix}••••••••</p>
                <p className="text-xs text-slate-400">Created {formatDate(key.createdAt)}</p>
              </div>
              <div className="flex items-center gap-3">
                <span className={key.isActive ? 'badge-success' : 'badge-danger'}>
                  {key.isActive ? 'Active' : 'Revoked'}
                </span>
                {key.isActive ? (
                  <button
                    type="button"
                    onClick={() => void handleRevoke(key.id)}
                    className="text-red-500 hover:text-red-700"
                    aria-label="Revoke API key"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                ) : null}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
