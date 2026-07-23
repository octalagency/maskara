'use client';

import Link from 'next/link';
import { ArrowRight } from 'lucide-react';

export function HeroCopy() {
  return (
    <div className="max-w-3xl">
      <p className="land-hero-item land-hero-1 font-display text-[clamp(2.6rem,11vw,5.75rem)] font-semibold leading-[0.92] tracking-[-0.045em] text-[#0b1a2b]">
        Maskara
      </p>

      <h1 className="land-hero-item land-hero-2 mt-4 max-w-2xl font-display text-[clamp(1.35rem,4.8vw,2.65rem)] font-medium leading-[1.22] tracking-[-0.03em] text-[#0b1a2b] sm:mt-5">
        The voice of{' '}
        <span className="land-shimmer-text bg-gradient-to-r from-brand-600 via-teal-500 to-amber-500 bg-clip-text text-transparent">
          artificial intelligence
        </span>
        {' — '}
        calling in Bangla to prove every COD order is real.
      </h1>

      <p className="land-hero-item land-hero-3 mt-4 max-w-xl text-[1rem] leading-relaxed text-slate-600 sm:mt-5 sm:text-lg">
        Fake orders drain your delivery budget. Maskara dials the customer in natural Bangla the
        second an order arrives — confirm with one tap, ship with confidence.
      </p>

      <div className="land-hero-item land-hero-4 mt-8 flex w-full flex-col gap-3 sm:mt-9 sm:max-w-lg sm:flex-row sm:items-stretch">
        <Link
          href="/register"
          className="land-cta-glow inline-flex min-h-[48px] flex-1 items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-brand-600 to-teal-600 px-6 py-3.5 text-base font-semibold text-white transition hover:from-brand-700 hover:to-teal-700"
        >
          Start Free — 14 Days <ArrowRight className="h-5 w-5 shrink-0 land-arrow" />
        </Link>
        <Link
          href="/docs"
          className="inline-flex min-h-[48px] items-center justify-center gap-2 rounded-xl border border-slate-200/90 bg-white/70 px-6 py-3.5 text-base font-semibold text-slate-700 backdrop-blur-sm transition hover:bg-white"
        >
          Explore the API
        </Link>
      </div>

      <p className="land-hero-item land-hero-5 mt-4 text-sm text-slate-500">
        No card · 50 free AI calls · Built for Bangladesh stores
      </p>
    </div>
  );
}
