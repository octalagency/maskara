'use client';

import { usePathname } from 'next/navigation';
import { AdminLayout } from '@/components/layout/AdminLayout';
import { AdminGuard } from '@/components/admin/AdminGuard';

export default function Layout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  if (pathname === '/admin/login') {
    return <>{children}</>;
  }

  return (
    <AdminGuard>
      <AdminLayout>{children}</AdminLayout>
    </AdminGuard>
  );
}
