'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Phone } from 'lucide-react';
import { api } from '@/lib/api';

export default function RegisterPage() {
  const router = useRouter();
  const [form, setForm] = useState({
    email: '',
    password: '',
    firstName: '',
    lastName: '',
    storeName: '',
    storeNameBangla: '',
    phone: '',
  });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  function update(field: string, value: string) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const res = await api.register(form);
      api.setToken(res.accessToken);
      router.push('/dashboard');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Registration failed');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-brand-50 via-white to-blue-50 px-4 py-12">
      <div className="w-full max-w-lg">
        <div className="text-center">
          <Link href="/" className="inline-flex items-center gap-2">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-brand-600">
              <Phone className="h-5 w-5 text-white" />
            </div>
            <span className="text-2xl font-bold">Maskara</span>
          </Link>
          <h1 className="mt-6 text-2xl font-bold text-slate-900">Start your free trial</h1>
          <p className="mt-2 text-sm text-slate-500">14 days free with 50 verification calls</p>
        </div>

        <form onSubmit={handleSubmit} className="card mt-8 space-y-4">
          {error && (
            <div className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</div>
          )}
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="block text-sm font-medium text-slate-700">First Name</label>
              <input className="input mt-1" value={form.firstName} onChange={(e) => update('firstName', e.target.value)} required />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700">Last Name</label>
              <input className="input mt-1" value={form.lastName} onChange={(e) => update('lastName', e.target.value)} required />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700">Store Name</label>
            <input className="input mt-1" value={form.storeName} onChange={(e) => update('storeName', e.target.value)} required placeholder="My Fashion Store" />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700">Store Name (Bangla)</label>
            <input className="input mt-1" value={form.storeNameBangla} onChange={(e) => update('storeNameBangla', e.target.value)} placeholder="আমার ফ্যাশন স্টোর" />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700">Email</label>
            <input type="email" className="input mt-1" value={form.email} onChange={(e) => update('email', e.target.value)} required />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700">Phone</label>
            <input className="input mt-1" value={form.phone} onChange={(e) => update('phone', e.target.value)} required placeholder="01712345678" />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700">Password</label>
            <input type="password" className="input mt-1" value={form.password} onChange={(e) => update('password', e.target.value)} required minLength={8} />
          </div>
          <button type="submit" className="btn-primary w-full" disabled={loading}>
            {loading ? 'Creating account...' : 'Create Account'}
          </button>
        </form>

        <p className="mt-6 text-center text-sm text-slate-500">
          Already have an account?{' '}
          <Link href="/login" className="font-medium text-brand-600 hover:text-brand-700">Sign in</Link>
        </p>
      </div>
    </div>
  );
}
