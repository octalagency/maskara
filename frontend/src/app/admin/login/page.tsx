'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Shield } from 'lucide-react';
import { api } from '@/lib/api';

const IS_PRODUCTION =
  process.env.NEXT_PUBLIC_PRODUCTION === 'true' ||
  process.env.NODE_ENV === 'production';

export default function AdminLoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [backendUp, setBackendUp] = useState<boolean | null>(null);

  useEffect(() => {
    api.checkBackend().then(setBackendUp);
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const res = await api.login({ email, password });
      const role = (res.user as { role: string }).role;
      if (role !== 'SUPER_ADMIN' && role !== 'ADMIN') {
        setError('এই account Super Admin নয়।');
        api.setToken(null);
        return;
      }
      api.setToken(res.accessToken);
      localStorage.setItem('userRole', role);
      router.push('/admin');
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Login failed';
      if (msg === 'BACKEND_OFFLINE') {
        setBackendUp(false);
        setError(
          IS_PRODUCTION
            ? 'API server unavailable. Contact administrator.'
            : 'Backend চালু নেই। docker compose up অথবা START-API.command চালান।',
        );
      } else {
        setError(msg);
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-900 px-4">
      <div className="w-full max-w-md">
        <div className="text-center">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-brand-600">
            <Shield className="h-7 w-7 text-white" />
          </div>
          <h1 className="mt-6 text-2xl font-bold text-white">Maskara Super Admin</h1>
          <p className="mt-2 text-sm text-slate-400">সকল merchant control করার জন্য login করুন</p>
        </div>

        {backendUp === false && !IS_PRODUCTION && (
          <div className="mt-6 rounded-xl border border-amber-600/40 bg-amber-900/20 p-4 text-center">
            <p className="text-sm text-amber-200">Backend offline — API server চালু করুন</p>
          </div>
        )}

        <form onSubmit={handleSubmit} className="mt-6 space-y-5 rounded-xl border border-slate-700 bg-slate-800 p-6">
          {error && (
            <div className="rounded-lg bg-red-900/50 p-3 text-sm text-red-300">{error}</div>
          )}
          <div>
            <label className="block text-sm font-medium text-slate-300">Admin Email</label>
            <input
              type="email"
              className="mt-1 block w-full rounded-lg border border-slate-600 bg-slate-700 px-4 py-2.5 text-white"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-300">Password</label>
            <input
              type="password"
              className="mt-1 block w-full rounded-lg border border-slate-600 bg-slate-700 px-4 py-2.5 text-white"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>
          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-lg bg-brand-600 py-2.5 font-semibold text-white hover:bg-brand-700 disabled:opacity-50"
          >
            {loading ? 'Logging in...' : 'Super Admin Login'}
          </button>
        </form>
      </div>
    </div>
  );
}
