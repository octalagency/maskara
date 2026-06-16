'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Phone } from 'lucide-react';
import { api } from '@/lib/api';

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await api.forgotPassword(email);
      setSent(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Request failed');
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
          <h1 className="mt-6 text-2xl font-bold text-slate-900">Forgot Password</h1>
        </div>

        <form onSubmit={handleSubmit} className="card mt-8 space-y-5">
          {error && <div className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</div>}
          {sent ? (
            <p className="text-sm text-emerald-700">
              If the email exists, a reset link has been sent. Check your inbox.
            </p>
          ) : (
            <>
              <div>
                <label className="block text-sm font-medium text-slate-700">Email</label>
                <input
                  type="email"
                  className="input mt-1"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
              </div>
              <button type="submit" className="btn-primary w-full" disabled={loading}>
                {loading ? 'Sending...' : 'Send Reset Link'}
              </button>
            </>
          )}
        </form>

        <p className="mt-6 text-center text-sm">
          <Link href="/login" className="text-brand-600 hover:underline">Back to login</Link>
        </p>
      </div>
    </div>
  );
}
