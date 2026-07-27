'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

/** Legacy route — Integrations now live under Settings → ইন্টিগ্রেশন ও API Keys */
export default function IntegrationsRedirectPage() {
  const router = useRouter();
  useEffect(() => {
    router.replace('/dashboard/settings?tab=integrations');
  }, [router]);
  return null;
}
