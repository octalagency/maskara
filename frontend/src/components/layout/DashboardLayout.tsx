'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard,
  ShoppingCart,
  Phone,
  Key,
  Settings,
  FileText,
  BarChart3,
  Plug,
  LogOut,
  Menu,
  X,
  CreditCard,
  Clock,
} from 'lucide-react';
import { useState } from 'react';
import { cn } from '@/lib/utils';

const navItems = [
  { href: '/dashboard', label: 'ড্যাশবোর্ড', icon: LayoutDashboard },
  { href: '/dashboard/orders', label: 'অর্ডার', icon: ShoppingCart },
  { href: '/dashboard/calls', label: 'কল হিস্ট্রি', icon: Phone },
  { href: '/dashboard/call-system', label: 'কল সিস্টেম', icon: Clock },
  { href: '/dashboard/reports', label: 'রিপোর্ট', icon: BarChart3 },
  { href: '/dashboard/integrations', label: 'ইন্টিগ্রেশন', icon: Plug },
  { href: '/dashboard/subscription', label: 'সাবস্ক্রিপশন', icon: CreditCard },
  { href: '/dashboard/api-keys', label: 'API Keys', icon: Key },
  { href: '/dashboard/settings', label: 'সেটিংস', icon: Settings },
  { href: '/docs', label: 'API Docs', icon: FileText },
];

export function DashboardLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <div className="flex min-h-screen bg-[#f3f6fa]">
      <aside
        className={cn(
          'fixed inset-y-0 left-0 z-50 flex w-[240px] flex-col border-r border-slate-200/80 bg-white transition-transform lg:static lg:translate-x-0',
          sidebarOpen ? 'translate-x-0' : '-translate-x-full',
        )}
      >
        <div className="flex h-[64px] items-center gap-3 border-b border-slate-100 px-5">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-brand-600">
            <Phone className="h-4 w-4 text-white" />
          </div>
          <div className="min-w-0">
            <p className="font-latin text-[16px] font-bold text-slate-900">Maskara</p>
            <p className="text-[12px] text-slate-500">মার্চেন্ট প্যানেল</p>
          </div>
          <button type="button" className="ml-auto rounded-lg p-1 text-slate-400 lg:hidden" onClick={() => setSidebarOpen(false)}>
            <X className="h-5 w-5" />
          </button>
        </div>

        <nav className="flex-1 space-y-1 overflow-y-auto p-3">
          {navItems.map((item) => {
            const active = pathname === item.href || (item.href !== '/dashboard' && pathname.startsWith(item.href));
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setSidebarOpen(false)}
                className={cn(
                  'flex items-center gap-3 rounded-xl px-3 py-2.5 text-[14px] font-medium transition',
                  active
                    ? 'bg-brand-50 text-brand-700'
                    : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900',
                )}
              >
                <item.icon className={cn('h-[18px] w-[18px] shrink-0', active ? 'text-brand-600' : 'text-slate-400')} />
                <span className="leading-none">{item.label}</span>
              </Link>
            );
          })}
        </nav>

        <div className="border-t border-slate-100 p-3">
          <button
            type="button"
            onClick={() => {
              localStorage.removeItem('token');
              window.location.href = '/login';
            }}
            className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-[14px] font-medium text-rose-600 hover:bg-rose-50"
          >
            <LogOut className="h-[18px] w-[18px]" />
            লগআউট
          </button>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 flex h-[64px] items-center border-b border-slate-200/80 bg-white/90 px-4 backdrop-blur lg:px-8">
          <button type="button" className="mr-3 rounded-lg p-1 text-slate-600 lg:hidden" onClick={() => setSidebarOpen(true)}>
            <Menu className="h-6 w-6" />
          </button>
          <div>
            <h1 className="text-[16px] font-bold text-slate-900 sm:text-[17px]">মার্চেন্ট ড্যাশবোর্ড</h1>
            <p className="hidden text-[12px] text-slate-500 sm:block">AI ভয়েস দিয়ে COD অর্ডার ভেরিফিকেশন</p>
          </div>
        </header>
        <main className="flex-1 p-4 sm:p-6 lg:p-8">{children}</main>
      </div>

      {sidebarOpen && (
        <div className="fixed inset-0 z-40 bg-slate-900/40 lg:hidden" onClick={() => setSidebarOpen(false)} />
      )}
    </div>
  );
}
