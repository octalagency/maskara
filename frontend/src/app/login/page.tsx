'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Phone } from 'lucide-react';
import { api } from '@/lib/api';

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const res = await api.login({ email, password });
      api.setToken(res.accessToken);
      const role = (res.user as { role: string }).role;
      router.push(role === 'SUPER_ADMIN' || role === 'ADMIN' ? '/admin' : '/dashboard');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Login failed');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-brand-50 via-white to-blue-50 px-4">
      <div className="w-full max-w-md">
        <div className="text-center">
          <Link href="/" className="inline-flex items-center gap-2">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-brand-600">
              <Phone className="h-5 w-5 text-white" />
            </div>
            <span className="text-2xl font-bold">Maskara</span>
          </Link>
          <h1 className="mt-6 text-2xl font-bold text-slate-900">Welcome back</h1>
          <p className="mt-2 text-sm text-slate-500">Sign in to your merchant dashboard</p>
        </div>

        <form onSubmit={handleSubmit} className="card mt-8 space-y-5">
          {error && (
            <div className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</div>
          )}
          <div>
            <label className="block text-sm font-medium text-slate-700">Email</label>
            <input
              type="email"
              className="input mt-1"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              placeholder="you@store.com"
            />
          </div>
          <div>
            <div className="flex items-center justify-between">
              <label className="block text-sm font-medium text-slate-700">Password</label>
              <Link href="/forgot-password" className="text-xs text-brand-600 hover:underline">
                Forgot password?
              </Link>
            </div>
            <input
              type="password"
              className="input mt-1"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              placeholder="••••••••"
            />
          </div>
          <button type="submit" className="btn-primary w-full" disabled={loading}>
            {loading ? 'Signing in...' : 'Sign In'}
          </button>
        </form>

        <p className="mt-6 text-center text-sm text-slate-500">
          Don&apos;t have an account?{' '}
          <Link href="/register" className="font-medium text-brand-600 hover:text-brand-700">
            Start free trial
          </Link>
        </p>
        <p className="mt-3 text-center text-xs text-slate-400">
          <Link href="/admin/login" className="hover:text-slate-600">
            Super Admin Login →
          </Link>
        </p>
      </div>
    </div>
  );
}
