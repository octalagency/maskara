'use client';

import Link from 'next/link';
import { Phone, Menu, X, Download } from 'lucide-react';
import { useState } from 'react';

export function Navbar() {
  const [open, setOpen] = useState(false);

  return (
    <nav className="fixed top-0 z-50 w-full border-b border-slate-200/60 bg-[#f7fafc]/75 backdrop-blur-xl">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
        <Link href="/" className="flex items-center gap-2.5">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-brand-600 shadow-sm shadow-brand-600/25">
            <Phone className="h-5 w-5 text-white" strokeWidth={2.25} />
          </div>
          <span className="font-display text-lg font-semibold tracking-[-0.03em] text-[#0b1a2b]">
            Maskara
          </span>
        </Link>

        <div className="hidden items-center gap-7 md:flex">
          <Link
            href="/#features"
            className="text-sm font-medium text-slate-600 transition hover:text-[#0b1a2b]"
          >
            Features
          </Link>
          <Link
            href="/pricing"
            className="text-sm font-medium text-slate-600 transition hover:text-[#0b1a2b]"
          >
            Pricing
          </Link>
          <Link
            href="/docs"
            className="text-sm font-medium text-slate-600 transition hover:text-[#0b1a2b]"
          >
            API Docs
          </Link>
          <a
            href="/downloads/maskara-woocommerce.zip"
            download
            className="inline-flex items-center gap-1.5 text-sm font-medium text-brand-600 transition hover:text-brand-700"
          >
            <Download className="h-4 w-4" /> WooCommerce Plugin
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

        <button
          type="button"
          className="rounded-lg p-1.5 text-slate-700 md:hidden"
          onClick={() => setOpen(!open)}
          aria-label={open ? 'Close menu' : 'Open menu'}
        >
          {open ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
        </button>
      </div>

      {open && (
        <div className="border-t border-slate-200/80 bg-[#f7fafc] px-4 py-4 md:hidden">
          <div className="flex flex-col gap-3">
            <Link href="/#features" className="text-sm font-medium text-slate-600">
              Features
            </Link>
            <Link href="/pricing" className="text-sm font-medium text-slate-600">
              Pricing
            </Link>
            <Link href="/docs" className="text-sm font-medium text-slate-600">
              API Docs
            </Link>
            <a
              href="/downloads/maskara-woocommerce.zip"
              download
              className="inline-flex items-center gap-1 text-sm font-medium text-brand-600"
            >
              <Download className="h-4 w-4" /> WooCommerce Plugin
            </a>
            <Link href="/login" className="text-sm font-medium text-slate-600">
              Login
            </Link>
            <Link href="/register" className="btn-primary text-center">
              Start Free Trial
            </Link>
          </div>
        </div>
      )}
    </nav>
  );
}
