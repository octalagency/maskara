'use client';

import Link from 'next/link';
import { Phone, Menu, X, Download } from 'lucide-react';
import { useState } from 'react';

const links = [
  { href: '/#features', label: 'Features' },
  { href: '/pricing', label: 'Pricing' },
  { href: '/docs', label: 'API Docs' },
];

export function Navbar() {
  const [open, setOpen] = useState(false);

  const close = () => setOpen(false);

  return (
    <nav className="fixed top-0 z-50 w-full border-b border-sky-200/50 bg-[#eaf3ff]/80 backdrop-blur-xl">
      <div className="mx-auto flex h-14 max-w-7xl items-center justify-between gap-3 px-4 sm:h-16 sm:px-6 lg:px-8">
        <Link href="/" className="flex min-w-0 items-center gap-2.5" onClick={close}>
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-brand-500 to-teal-500">
            <Phone className="h-5 w-5 text-white" strokeWidth={2.25} />
          </div>
          <span className="font-display truncate text-lg font-semibold tracking-[-0.03em] text-[#0b1a2b]">
            Maskara
          </span>
        </Link>

        <div className="hidden items-center gap-6 lg:flex">
          {links.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              className="text-sm font-medium text-slate-600 transition hover:text-[#0b1a2b]"
            >
              {l.label}
            </Link>
          ))}
          <a
            href="/downloads/maskara-woocommerce.zip"
            download
            className="inline-flex items-center gap-1.5 text-sm font-medium text-brand-600 transition hover:text-brand-700"
          >
            <Download className="h-4 w-4" /> Plugin
          </a>
          <Link
            href="/login"
            className="text-sm font-medium text-slate-600 transition hover:text-[#0b1a2b]"
          >
            Login
          </Link>
          <Link href="/register" className="btn-primary">
            Start Free Trial
          </Link>
        </div>

        <div className="flex items-center gap-2 lg:hidden">
          <Link
            href="/register"
            className="inline-flex h-10 items-center rounded-xl bg-brand-600 px-3.5 text-[13px] font-semibold text-white"
          >
            Trial
          </Link>
          <button
            type="button"
            className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200/80 bg-white/70 text-slate-700"
            onClick={() => setOpen(!open)}
            aria-expanded={open}
            aria-label={open ? 'Close menu' : 'Open menu'}
          >
            {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>
      </div>

      {open && (
        <div className="border-t border-sky-200/60 bg-[#eaf3ff] px-4 py-4 lg:hidden">
          <div className="flex flex-col gap-1">
            {links.map((l) => (
              <Link
                key={l.href}
                href={l.href}
                onClick={close}
                className="rounded-xl px-3 py-3 text-[15px] font-medium text-slate-700 active:bg-white/70"
              >
                {l.label}
              </Link>
            ))}
            <a
              href="/downloads/maskara-woocommerce.zip"
              download
              onClick={close}
              className="inline-flex items-center gap-2 rounded-xl px-3 py-3 text-[15px] font-medium text-brand-600"
            >
              <Download className="h-4 w-4" /> WooCommerce Plugin
            </a>
            <Link
              href="/login"
              onClick={close}
              className="rounded-xl px-3 py-3 text-[15px] font-medium text-slate-700"
            >
              Login
            </Link>
            <Link
              href="/register"
              onClick={close}
              className="btn-primary mt-2 w-full py-3.5 text-center text-base"
            >
              Start Free Trial
            </Link>
          </div>
        </div>
      )}
    </nav>
  );
}
