'use client';

import { Suspense, useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

function VerifyEmailContent() {
  const params = useSearchParams();
  const token = params.get('token');
  const [status, setStatus] = useState<'loading' | 'ok' | 'error'>('loading');

  useEffect(() => {
    if (!token) {
      setStatus('error');
      return;
    }
    fetch(`${API_URL}/auth/verify-email`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token }),
    })
      .then((r) => (r.ok ? setStatus('ok') : setStatus('error')))
      .catch(() => setStatus('error'));
  }, [token]);

  return (
    <div className="card max-w-md text-center">
      {status === 'loading' && <p>Verifying email...</p>}
      {status === 'ok' && (
        <>
          <h1 className="text-xl font-bold text-emerald-600">✓ Email Verified</h1>
          <Link href="/login" className="btn-primary mt-4 inline-block">Login</Link>
        </>
      )}
      {status === 'error' && (
        <>
          <h1 className="text-xl font-bold text-red-600">Verification Failed</h1>
          <p className="mt-2 text-sm text-slate-500">Link expired or invalid.</p>
        </>
      )}
    </div>
  );
}

export default function VerifyEmailPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 px-4">
      <Suspense fallback={<div className="card max-w-md p-6 text-center">Loading...</div>}>
        <VerifyEmailContent />
      </Suspense>
    </div>
  );
}
