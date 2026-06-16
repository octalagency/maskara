'use client';

import { useEffect, useState } from 'react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { api, ApiKey } from '@/lib/api';
import { formatDate } from '@/lib/utils';
import { Key, Plus, Copy, Trash2 } from 'lucide-react';

export default function ApiKeysPage() {
  const [keys, setKeys] = useState<ApiKey[]>([]);
  const [newKeyName, setNewKeyName] = useState('');
  const [createdKey, setCreatedKey] = useState('');
  const [showCreate, setShowCreate] = useState(false);

  useEffect(() => { loadKeys(); }, []);

  async function loadKeys() {
    try {
      const res = await api.getApiKeys();
      setKeys(res);
    } catch { /* demo */ }
  }

  async function handleCreate() {
    if (!newKeyName) return;
    try {
      const res = await api.createApiKey(newKeyName);
      setCreatedKey(res.key);
      setNewKeyName('');
      loadKeys();
    } catch {
      setCreatedKey('mk_demo_' + Math.random().toString(36).slice(2));
    }
  }

  async function handleRevoke(id: string) {
    try { await api.revokeApiKey(id); loadKeys(); } catch { /* demo */ }
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold text-slate-900">API Keys</h2>
            <p className="text-sm text-slate-500">Manage API keys for webhook and REST API integration</p>
          </div>
          <button onClick={() => setShowCreate(true)} className="btn-primary gap-2">
            <Plus className="h-4 w-4" /> Create Key
          </button>
        </div>

        {createdKey && (
          <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-4">
            <p className="text-sm font-medium text-emerald-800">API Key created! Copy it now — it won&apos;t be shown again.</p>
            <div className="mt-2 flex items-center gap-2">
              <code className="flex-1 rounded bg-white px-3 py-2 text-sm font-mono text-slate-800">{createdKey}</code>
              <button onClick={() => navigator.clipboard.writeText(createdKey)} className="btn-secondary gap-1">
                <Copy className="h-4 w-4" /> Copy
              </button>
            </div>
          </div>
        )}

        {showCreate && (
          <div className="card">
            <h3 className="font-semibold">Create New API Key</h3>
            <div className="mt-4 flex gap-3">
              <input className="input" placeholder="Key name (e.g. Production)" value={newKeyName} onChange={(e) => setNewKeyName(e.target.value)} />
              <button onClick={handleCreate} className="btn-primary">Create</button>
              <button onClick={() => setShowCreate(false)} className="btn-secondary">Cancel</button>
            </div>
          </div>
        )}

        <div className="space-y-3">
          {keys.length === 0 ? (
            <div className="card text-center text-slate-500">
              <Key className="mx-auto h-8 w-8 text-slate-300" />
              <p className="mt-2">No API keys yet. Create one to start integrating.</p>
            </div>
          ) : (
            keys.map((key) => (
              <div key={key.id} className="card flex items-center justify-between">
                <div>
                  <p className="font-medium text-slate-900">{key.name}</p>
                  <p className="text-sm text-slate-500">Prefix: {key.keyPrefix}••••••••</p>
                  <p className="text-xs text-slate-400">Created {formatDate(key.createdAt)}</p>
                </div>
                <div className="flex items-center gap-3">
                  <span className={key.isActive ? 'badge-success' : 'badge-danger'}>
                    {key.isActive ? 'Active' : 'Revoked'}
                  </span>
                  {key.isActive && (
                    <button onClick={() => handleRevoke(key.id)} className="text-red-500 hover:text-red-700">
                      <Trash2 className="h-4 w-4" />
                    </button>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </DashboardLayout>
  );
}
