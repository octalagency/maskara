'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard,
  Users,
  BarChart3,
  Settings,
  CreditCard,
  Phone,
  LogOut,
  Store,
  Package,
  Wallet,
  SlidersHorizontal,
  Banknote,
  Mic2,
} from 'lucide-react';
import { cn } from '@/lib/utils';

const navItems = [
  { href: '/admin', label: 'ড্যাশবোর্ড', icon: LayoutDashboard, exact: true },
  { href: '/admin/merchants', label: 'মার্চেন্ট', icon: Users },
  { href: '/admin/plans', label: 'প্ল্যান', icon: Package },
  { href: '/admin/billing', label: 'বিলিং', icon: Wallet },
  { href: '/admin/payments', label: 'পেমেন্ট গেটওয়ে', icon: Banknote },
  { href: '/admin/voice', label: 'Voice Studio', icon: Mic2 },
  { href: '/admin/config', label: 'Voice / ePBX', icon: SlidersHorizontal },
  { href: '/admin/analytics', label: 'কল অ্যানালিটিক্স', icon: BarChart3 },
  { href: '/admin/subscriptions', label: 'রেভিনিউ', icon: CreditCard },
  { href: '/admin/settings', label: 'সেটিংস', icon: Settings },
];

export function AdminLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [offline, setOffline] = useState(false);

  useEffect(() => {
    setOffline(localStorage.getItem('maskara_offline_mode') === 'true');
  }, []);

  return (
    <div className="flex min-h-screen bg-slate-50">
      <aside className="fixed inset-y-0 left-0 z-40 w-64 border-r border-slate-200 bg-white">
        <div className="flex h-16 items-center gap-2 border-b border-slate-200 px-6">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-600">
            <Phone className="h-4 w-4 text-white" />
          </div>
          <div>
            <span className="text-lg font-bold text-slate-900">Maskara</span>
            <p className="text-xs text-slate-500">Super Admin</p>
          </div>
        </div>

        <nav className="space-y-1 p-4">
          {navItems.map((item) => {
            const active = 'exact' in item && item.exact
              ? pathname === item.href
              : pathname === item.href || pathname.startsWith(item.href + '/');
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  'flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition',
                  active ? 'bg-brand-50 text-brand-700' : 'text-slate-600 hover:bg-slate-100',
                )}
              >
                <item.icon className="h-5 w-5" />
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="absolute bottom-0 left-0 right-0 border-t border-slate-200 p-4">
          <Link
            href="/dashboard"
            className="mb-2 flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-slate-600 hover:bg-slate-100"
          >
            <Store className="h-5 w-5" />
            Merchant View
          </Link>
          <button
            onClick={() => {
              localStorage.removeItem('token');
              localStorage.removeItem('userRole');
              localStorage.removeItem('maskara_offline_mode');
              localStorage.removeItem('maskara_demo_merchants');
              window.location.href = '/admin/login';
            }}
            className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-red-600 hover:bg-red-50"
          >
            <LogOut className="h-5 w-5" />
            Logout
          </button>
        </div>
      </aside>

      <div className="flex flex-1 flex-col pl-64">
        <header className="flex h-16 items-center justify-between border-b border-slate-200 bg-white px-8">
          <h1 className="text-lg font-semibold text-slate-900">Super Admin Control Panel</h1>
          {offline && (
            <span className="rounded-full bg-amber-100 px-3 py-1 text-xs font-medium text-amber-800">
              Offline Demo Mode
            </span>
          )}
        </header>
        <main className="flex-1 p-8">{children}</main>
      </div>
    </div>
  );
}
