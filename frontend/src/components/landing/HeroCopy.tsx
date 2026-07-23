'use client';

import Link from 'next/link';
import { ArrowRight } from 'lucide-react';

export function HeroCopy() {
  return (
    <div className="mx-auto max-w-3xl text-center">
      <p className="land-hero-item land-hero-1 font-display text-[clamp(2.75rem,10vw,5.5rem)] font-semibold leading-[0.92] tracking-[-0.045em] text-[#15204a]">
        Maskara
      </p>

      <h1 className="land-hero-item land-hero-2 mx-auto mt-5 max-w-2xl font-display text-[clamp(1.4rem,4.2vw,2.35rem)] font-semibold leading-[1.25] tracking-[-0.03em] text-[#15204a]">
        Enterprise-ready{' '}
        <span className="land-shimmer-text bg-gradient-to-r from-[#3b5bdb] via-[#7c6cf0] to-[#e879a9] bg-clip-text text-transparent">
          Voice AI
        </span>{' '}
        that verifies every COD order in Bangla
      </h1>

      <p className="land-hero-item land-hero-3 mx-auto mt-5 max-w-xl text-[1rem] leading-relaxed text-[#5b647a] sm:text-lg">
        Automatically call customers the moment an order arrives. Confirm with one key press —
        cut fake deliveries before they cost you.
      </p>

      <div className="land-hero-item land-hero-4 mx-auto mt-9 flex w-full max-w-md flex-col gap-3 sm:flex-row sm:justify-center">
        <Link
          href="/register"
          className="land-cta-glow inline-flex min-h-[50px] flex-1 items-center justify-center gap-2 rounded-2xl bg-[#3b5bdb] px-7 py-3.5 text-base font-semibold text-white transition hover:bg-[#2f4bc7] sm:flex-none"
        >
          Start for Free <ArrowRight className="h-5 w-5 shrink-0 land-arrow" />
        </Link>
        <Link
          href="/docs"
          className="inline-flex min-h-[50px] items-center justify-center gap-2 rounded-2xl border border-[#d5d9e8] bg-white/80 px-7 py-3.5 text-base font-semibold text-[#15204a] backdrop-blur-sm transition hover:bg-white"
        >
          Contact Sales
        </Link>
      </div>

      <p className="land-hero-item land-hero-5 mt-5 text-sm text-[#8a92a8]">
        No credit card · 50 free AI calls · 14-day trial
      </p>
    </div>
  );
}
