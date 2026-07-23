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
    <nav className="fixed top-0 z-50 w-full border-b border-[#e6e9f2]/80 bg-[#f7f8fc]/85 backdrop-blur-xl">
      <div className="mx-auto flex h-14 max-w-7xl items-center justify-between gap-3 px-4 sm:h-16 sm:px-6 lg:px-8">
        <Link href="/" className="flex min-w-0 items-center gap-2.5" onClick={close}>
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#3b5bdb]">
            <Phone className="h-5 w-5 text-white" strokeWidth={2.25} />
          </div>
          <span className="font-display truncate text-lg font-semibold tracking-[-0.03em] text-[#15204a]">
            Maskara
          </span>
        </Link>

        <div className="hidden items-center gap-6 lg:flex">
          {links.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              className="text-sm font-medium text-[#5b647a] transition hover:text-[#15204a]"
            >
              {l.label}
            </Link>
          ))}
          <a
            href="/downloads/maskara-woocommerce.zip"
            download
            className="inline-flex items-center gap-1.5 text-sm font-medium text-[#3b5bdb] transition hover:text-[#2f4bc7]"
          >
            <Download className="h-4 w-4" /> Plugin
          </a>
          <Link
            href="/login"
            className="text-sm font-medium text-[#5b647a] transition hover:text-[#15204a]"
          >
            Login
          </Link>
          <Link
            href="/register"
            className="inline-flex items-center rounded-xl bg-[#3b5bdb] px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-[#2f4bc7]"
          >
            Start for Free
          </Link>
        </div>

        <div className="flex items-center gap-2 lg:hidden">
          <Link
            href="/register"
            className="inline-flex h-10 items-center rounded-xl bg-[#3b5bdb] px-3.5 text-[13px] font-semibold text-white"
          >
            Free
          </Link>
          <button
            type="button"
            className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-[#d5d9e8] bg-white/80 text-[#15204a]"
            onClick={() => setOpen(!open)}
            aria-expanded={open}
            aria-label={open ? 'Close menu' : 'Open menu'}
          >
            {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>
      </div>

      {open && (
        <div className="border-t border-[#e6e9f2] bg-[#f7f8fc] px-4 py-4 lg:hidden">
          <div className="flex flex-col gap-1">
            {links.map((l) => (
              <Link
                key={l.href}
                href={l.href}
                onClick={close}
                className="rounded-xl px-3 py-3 text-[15px] font-medium text-[#15204a] active:bg-white"
              >
                {l.label}
              </Link>
            ))}
            <a
              href="/downloads/maskara-woocommerce.zip"
              download
              onClick={close}
              className="inline-flex items-center gap-2 rounded-xl px-3 py-3 text-[15px] font-medium text-[#3b5bdb]"
            >
              <Download className="h-4 w-4" /> WooCommerce Plugin
            </a>
            <Link
              href="/login"
              onClick={close}
              className="rounded-xl px-3 py-3 text-[15px] font-medium text-[#15204a]"
            >
              Login
            </Link>
            <Link
              href="/register"
              onClick={close}
              className="mt-2 inline-flex min-h-[48px] w-full items-center justify-center rounded-xl bg-[#3b5bdb] text-base font-semibold text-white"
            >
              Start for Free
            </Link>
          </div>
        </div>
      )}
    </nav>
  );
}
