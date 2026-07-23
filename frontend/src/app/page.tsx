import Link from 'next/link';
import { Navbar } from '@/components/layout/Navbar';
import { Footer } from '@/components/layout/Footer';
import { SignalGrid } from '@/components/landing/SignalGrid';
import { VoiceWave } from '@/components/landing/VoiceWave';
import {
  Phone,
  Zap,
  Shield,
  BarChart3,
  Globe,
  ArrowRight,
  Bot,
  RefreshCw,
} from 'lucide-react';

const features = [
  {
    icon: Bot,
    title: 'AI Bangla Voice Agent',
    description:
      'Natural Bangla voice that greets customers and verifies COD orders with a simple key press.',
    tint: 'from-sky-500/15 to-sky-500/5 text-sky-700',
    iconBg: 'bg-sky-100 text-sky-600 group-hover:bg-sky-600',
  },
  {
    icon: Zap,
    title: 'Instant Verification',
    description: 'New orders trigger a call within seconds — no queues, no manual dialing.',
    tint: 'from-amber-500/15 to-amber-500/5 text-amber-800',
    iconBg: 'bg-amber-100 text-amber-600 group-hover:bg-amber-500',
  },
  {
    icon: Globe,
    title: 'Multi-Platform Integration',
    description: 'Shopify, WooCommerce, ShopIn, or any store via webhook and REST API.',
    tint: 'from-teal-500/15 to-teal-500/5 text-teal-800',
    iconBg: 'bg-teal-100 text-teal-600 group-hover:bg-teal-600',
  },
  {
    icon: Shield,
    title: 'Cut Fake Orders',
    description: 'Confirm intent before dispatch and reduce COD returns that drain your margin.',
    tint: 'from-emerald-500/15 to-emerald-500/5 text-emerald-800',
    iconBg: 'bg-emerald-100 text-emerald-600 group-hover:bg-emerald-600',
  },
  {
    icon: BarChart3,
    title: 'Live Analytics',
    description: 'Verification rates, call outcomes, and daily reports in one merchant dashboard.',
    tint: 'from-blue-500/15 to-blue-500/5 text-blue-800',
    iconBg: 'bg-blue-100 text-blue-600 group-hover:bg-blue-600',
  },
  {
    icon: RefreshCw,
    title: 'Smart Retry',
    description: 'Missed calls retry on your schedule until the customer answers or you stop.',
    tint: 'from-cyan-500/15 to-cyan-500/5 text-cyan-800',
    iconBg: 'bg-cyan-100 text-cyan-600 group-hover:bg-cyan-600',
  },
];

const steps = [
  {
    step: '01',
    title: 'Order arrives',
    desc: 'Shopify, WooCommerce, or custom store sends the order to Maskara.',
    accent: 'bg-sky-500',
  },
  {
    step: '02',
    title: 'AI dials',
    desc: 'Maskara places a Bangla voice call with order details and amount.',
    accent: 'bg-teal-500',
  },
  {
    step: '03',
    title: 'Customer confirms',
    desc: 'Press 1 to confirm, 2 to cancel, 0 to hear again — DTMF, no app needed.',
    accent: 'bg-amber-500',
  },
  {
    step: '04',
    title: 'Status syncs',
    desc: 'Your store and dashboard update instantly with the call result.',
    accent: 'bg-emerald-500',
  },
];

export default function LandingPage() {
  return (
    <div className="landing-root min-h-screen overflow-x-hidden">
      <Navbar />

      {/* Hero */}
      <section className="relative flex min-h-[100svh] flex-col overflow-hidden pt-14 sm:pt-16">
        <div className="absolute inset-0 bg-[linear-gradient(160deg,#eaf3ff_0%,#e8f7f4_38%,#fff8eb_78%,#eef6ff_100%)]" />
        <SignalGrid />
        <VoiceWave />

        <div className="relative z-10 mx-auto flex w-full max-w-7xl flex-1 flex-col justify-center px-4 pb-32 pt-8 sm:px-6 sm:pb-44 sm:pt-12 lg:px-8">
          <div className="land-fade-up max-w-3xl">
            <p className="font-display text-[clamp(2.6rem,11vw,5.75rem)] font-semibold leading-[0.92] tracking-[-0.045em] text-[#0b1a2b]">
              Maskara
            </p>
            <h1 className="mt-4 max-w-2xl font-display text-[clamp(1.35rem,4.8vw,2.65rem)] font-medium leading-[1.2] tracking-[-0.03em] text-[#0b1a2b] sm:mt-5">
              Artificial intelligence that{' '}
              <span className="bg-gradient-to-r from-brand-600 via-teal-600 to-amber-600 bg-clip-text text-transparent">
                calls in Bangla
              </span>{' '}
              to verify every COD order.
            </h1>
            <p className="mt-4 max-w-xl text-[1rem] leading-relaxed text-slate-600 sm:mt-5 sm:text-lg">
              Listen, confirm, and cut fake deliveries — your AI voice agent works the moment an
              order hits your store.
            </p>
            <div className="mt-8 flex w-full flex-col gap-3 sm:mt-9 sm:max-w-md sm:flex-row sm:items-stretch">
              <Link
                href="/register"
                className="inline-flex min-h-[48px] flex-1 items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-brand-600 to-teal-600 px-6 py-3.5 text-base font-semibold text-white transition hover:from-brand-700 hover:to-teal-700"
              >
                Start 14-Day Free Trial <ArrowRight className="h-5 w-5 shrink-0" />
              </Link>
              <Link
                href="/docs"
                className="inline-flex min-h-[48px] items-center justify-center gap-2 rounded-xl border border-slate-200/90 bg-white/70 px-6 py-3.5 text-base font-semibold text-slate-700 backdrop-blur-sm transition hover:bg-white"
              >
                View API Docs
              </Link>
            </div>
            <p className="mt-4 text-sm text-slate-500">No card required · 50 free calls included</p>
          </div>
        </div>
      </section>

      {/* Product moment */}
      <section className="relative border-t border-sky-100 bg-white py-16 sm:py-24">
        <div className="absolute inset-x-0 top-0 h-32 bg-gradient-to-b from-sky-50/80 to-transparent" />
        <div className="relative mx-auto grid max-w-7xl items-center gap-10 px-4 sm:gap-12 sm:px-6 lg:grid-cols-2 lg:gap-16 lg:px-8">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-teal-600 sm:text-sm">
              Live voice intelligence
            </p>
            <h2 className="mt-3 font-display text-[1.65rem] font-semibold tracking-[-0.03em] text-[#0b1a2b] sm:text-4xl">
              Your customer hears a real Bangla agent — not a robot script dump.
            </h2>
            <p className="mt-4 text-[15px] leading-relaxed text-slate-600 sm:text-base">
              Maskara speaks order details clearly, waits for a key press, and writes the result
              back to your store. Built for Bangladesh COD, end to end.
            </p>
            <ul className="mt-7 space-y-3 text-[15px] text-slate-700 sm:mt-8">
              {[
                { t: 'Natural Bangla TTS with merchant voice choice', c: 'bg-sky-500' },
                { t: '1 confirm · 2 cancel · 0 repeat', c: 'bg-teal-500' },
                { t: 'Works with Shopify, WooCommerce & custom APIs', c: 'bg-amber-500' },
              ].map((item) => (
                <li key={item.t} className="flex gap-3">
                  <span className={`mt-2 h-2 w-2 shrink-0 rounded-full ${item.c}`} />
                  <span>{item.t}</span>
                </li>
              ))}
            </ul>
          </div>

          <div className="relative mx-auto w-full max-w-md lg:max-w-none">
            <div className="absolute -inset-3 rounded-[1.75rem] bg-gradient-to-br from-sky-400/25 via-teal-400/20 to-amber-300/25 sm:-inset-4 sm:rounded-[2rem]" />
            <div className="relative overflow-hidden rounded-[1.35rem] bg-[#0b1a2b] p-5 text-white sm:rounded-[1.5rem] sm:p-8">
              <div className="flex items-center gap-3">
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-brand-500/30 to-teal-400/20 ring-1 ring-sky-400/30">
                  <Phone className="h-5 w-5 text-sky-300" />
                </div>
                <div className="min-w-0">
                  <p className="font-display text-sm font-semibold tracking-wide text-white">
                    Incoming · Maskara AI
                  </p>
                  <p className="text-xs text-slate-400">Bangla voice agent</p>
                </div>
                <span className="ml-auto flex shrink-0 items-center gap-1.5 text-xs font-medium text-teal-300">
                  <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-teal-400" />
                  Live
                </span>
              </div>

              <div className="mt-6 flex h-10 items-end justify-center gap-[3px] sm:gap-1">
                {Array.from({ length: 22 }).map((_, i) => (
                  <span
                    key={i}
                    className="land-mini-bar w-1 rounded-full bg-gradient-to-t from-brand-500 via-teal-400 to-amber-300 sm:w-1.5"
                    style={{
                      height: `${10 + ((i * 7) % 28)}px`,
                      animationDelay: `${i * 0.05}s`,
                    }}
                  />
                ))}
              </div>

              <p className="mt-6 rounded-xl bg-white/5 p-4 text-[14px] leading-relaxed text-slate-200 ring-1 ring-white/10 sm:text-[15px]">
                হ্যালো। আপনি <span className="text-white">ডেমো স্টোর</span>-এ অর্ডার করেছেন। আপনার
                মোট বিল <span className="text-amber-200">৫৬০ টাকা</span>। অর্ডারটি নিশ্চিত করতে{' '}
                <span className="text-sky-300">১</span> চাপুন, বাতিল করতে{' '}
                <span className="text-teal-300">২</span>, আবার শুনতে{' '}
                <span className="text-amber-300">০</span>।
              </p>

              <div className="mt-6 grid grid-cols-3 gap-3 sm:flex sm:justify-center sm:gap-5">
                {[
                  { k: '1', label: 'Confirm', ring: 'border-sky-400/40' },
                  { k: '2', label: 'Cancel', ring: 'border-teal-400/40' },
                  { k: '0', label: 'Repeat', ring: 'border-amber-400/40' },
                ].map((key) => (
                  <div key={key.k} className="text-center">
                    <div
                      className={`mx-auto flex h-12 w-12 items-center justify-center rounded-xl border bg-white/5 font-display text-lg font-semibold text-white ${key.ring}`}
                    >
                      {key.k}
                    </div>
                    <p className="mt-1.5 text-[11px] text-slate-500">{key.label}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* How it works */}
      <section
        className="border-t border-teal-100/80 bg-gradient-to-b from-[#f0faf8] to-[#eef6ff] py-16 sm:py-24"
        id="how-it-works"
      >
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="max-w-2xl">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-sky-600 sm:text-sm">
              How it works
            </p>
            <h2 className="mt-3 font-display text-[1.65rem] font-semibold tracking-[-0.03em] text-[#0b1a2b] sm:text-4xl">
              Order to verification in under a minute
            </h2>
            <p className="mt-3 text-slate-600">Four steps. Zero manual calling.</p>
          </div>

          <ol className="mt-10 grid gap-5 sm:mt-14 sm:grid-cols-2 sm:gap-6 lg:grid-cols-4">
            {steps.map((s) => (
              <li
                key={s.step}
                className="rounded-2xl border border-white/80 bg-white/70 p-5 backdrop-blur-sm sm:p-6"
              >
                <span
                  className={`inline-flex h-8 w-8 items-center justify-center rounded-lg text-xs font-bold text-white ${s.accent}`}
                >
                  {s.step}
                </span>
                <h3 className="mt-4 font-display text-lg font-semibold text-[#0b1a2b]">{s.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-slate-600">{s.desc}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* Features */}
      <section className="border-t border-sky-100 bg-white py-16 sm:py-24" id="features">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="max-w-2xl">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-amber-600 sm:text-sm">
              Platform
            </p>
            <h2 className="mt-3 font-display text-[1.65rem] font-semibold tracking-[-0.03em] text-[#0b1a2b] sm:text-4xl">
              Intelligence built for Bangladesh eCommerce
            </h2>
            <p className="mt-3 text-slate-600">
              Everything you need to verify COD orders with AI voice — no extra tools.
            </p>
          </div>

          <div className="mt-10 grid gap-4 sm:mt-14 sm:grid-cols-2 sm:gap-5 lg:grid-cols-3">
            {features.map((f) => (
              <div
                key={f.title}
                className={`group rounded-2xl border border-slate-100 bg-gradient-to-br ${f.tint} p-5 sm:p-6`}
              >
                <div
                  className={`flex h-11 w-11 items-center justify-center rounded-xl transition group-hover:text-white ${f.iconBg}`}
                >
                  <f.icon className="h-5 w-5" />
                </div>
                <h3 className="mt-4 font-display text-lg font-semibold text-[#0b1a2b]">{f.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-slate-600">{f.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="relative overflow-hidden py-16 sm:py-24">
        <div className="absolute inset-0 bg-[linear-gradient(125deg,#0b1a2b_0%,#0e4d7a_40%,#0f766e_72%,#b45309_100%)]" />
        <div className="absolute inset-0 land-grid-dark opacity-25" />
        <div className="relative mx-auto max-w-3xl px-4 text-center sm:px-6 lg:px-8">
          <h2 className="font-display text-[1.65rem] font-semibold tracking-[-0.03em] text-white sm:text-4xl">
            Ready to let intelligence handle your confirmations?
          </h2>
          <p className="mx-auto mt-4 max-w-xl text-[15px] text-slate-200 sm:text-base">
            Join Bangladesh merchants who verify COD with Maskara — fewer fake orders, cleaner
            deliveries.
          </p>
          <Link
            href="/register"
            className="mt-8 inline-flex min-h-[48px] items-center gap-2 rounded-xl bg-white px-8 py-3.5 text-base font-semibold text-[#0b1a2b] transition hover:bg-amber-50 sm:mt-9"
          >
            Get Started Free <ArrowRight className="h-5 w-5" />
          </Link>
        </div>
      </section>

      <Footer />
    </div>
  );
}
