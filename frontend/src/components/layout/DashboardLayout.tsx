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
} from 'lucide-react';
import { useState } from 'react';
import { cn } from '@/lib/utils';

const navItems = [
  { href: '/dashboard', label: 'ড্যাশবোর্ড', icon: LayoutDashboard },
  { href: '/dashboard/orders', label: 'অর্ডার', icon: ShoppingCart },
  { href: '/dashboard/calls', label: 'কল হিস্ট্রি', icon: Phone },
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
    <div className="flex min-h-screen bg-[#f4f7fb]">
      <aside
        className={cn(
          'fixed inset-y-0 left-0 z-50 w-64 transform border-r border-slate-200/80 bg-white transition-transform lg:static lg:translate-x-0',
          sidebarOpen ? 'translate-x-0' : '-translate-x-full',
        )}
      >
        <div className="flex h-16 items-center gap-2.5 border-b border-slate-100 px-5">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-brand-500 to-brand-700 shadow-sm">
            <Phone className="h-4 w-4 text-white" />
          </div>
          <div>
            <span className="font-display text-lg font-bold tracking-tight text-slate-900">Maskara</span>
            <p className="text-[10px] font-medium uppercase tracking-wider text-slate-400">Merchant</p>
          </div>
          <button className="ml-auto lg:hidden" onClick={() => setSidebarOpen(false)}>
            <X className="h-5 w-5" />
          </button>
        </div>
        <nav className="space-y-0.5 p-3">
          {navItems.map((item) => {
            const active = pathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setSidebarOpen(false)}
                className={cn(
                  'flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition',
                  active
                    ? 'bg-brand-50 text-brand-700 shadow-sm ring-1 ring-brand-100'
                    : 'text-slate-600 hover:bg-slate-50',
                )}
              >
                <item.icon className={cn('h-4.5 w-4.5', active ? 'text-brand-600' : 'text-slate-400')} />
                {item.label}
              </Link>
            );
          })}
          <button
            onClick={() => {
              localStorage.removeItem('token');
              window.location.href = '/login';
            }}
            className="mt-2 flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-rose-600 hover:bg-rose-50"
          >
            <LogOut className="h-4 w-4" />
            লগআউট
          </button>
        </nav>
      </aside>

      <div className="flex flex-1 flex-col">
        <header className="flex h-16 items-center border-b border-slate-200/80 bg-white/80 px-4 backdrop-blur lg:px-8">
          <button className="mr-4 lg:hidden" onClick={() => setSidebarOpen(true)}>
            <Menu className="h-6 w-6" />
          </button>
          <div>
            <h1 className="font-display text-lg font-bold text-slate-900">Merchant Dashboard</h1>
            <p className="hidden text-xs text-slate-400 sm:block">AI voice দিয়ে COD অর্ডার ভেরিফিকেশন</p>
          </div>
        </header>
        <main className="flex-1 p-4 lg:p-8">{children}</main>
      </div>

      {sidebarOpen && (
        <div className="fixed inset-0 z-40 bg-black/30 lg:hidden" onClick={() => setSidebarOpen(false)} />
      )}
    </div>
  );
}
