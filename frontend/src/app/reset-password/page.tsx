'use client';

import { Suspense, useState } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import Link from 'next/link';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

function ResetPasswordForm() {
  const params = useSearchParams();
  const router = useRouter();
  const token = params.get('token') || '';
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [done, setDone] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    const res = await fetch(`${API_URL}/auth/reset-password`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token, password }),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.message || 'Reset failed');
      return;
    }
    setDone(true);
    setTimeout(() => router.push('/login'), 2000);
  }

  return (
    <form onSubmit={handleSubmit} className="card w-full max-w-md space-y-4">
      <h1 className="text-xl font-bold">Reset Password</h1>
      {error && <p className="text-sm text-red-600">{error}</p>}
      {done ? (
        <p className="text-emerald-600">Password updated! Redirecting...</p>
      ) : (
        <>
          <input
            type="password"
            className="w-full rounded-lg border px-4 py-2"
            placeholder="New password (min 8 chars)"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            minLength={8}
            required
          />
          <button type="submit" className="btn-primary w-full">Update Password</button>
        </>
      )}
      <Link href="/login" className="block text-center text-sm text-brand-600">Back to login</Link>
    </form>
  );
}

export default function ResetPasswordPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 px-4">
      <Suspense fallback={<div className="card w-full max-w-md p-6 text-center">Loading...</div>}>
        <ResetPasswordForm />
      </Suspense>
    </div>
  );
}
