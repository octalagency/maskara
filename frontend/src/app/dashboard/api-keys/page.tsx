'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

/** Legacy route — API Keys now live under Settings → ইন্টিগ্রেশন ও API Keys */
export default function ApiKeysRedirectPage() {
  const router = useRouter();
  useEffect(() => {
    router.replace('/dashboard/settings?tab=integrations');
  }, [router]);
  return null;
}
