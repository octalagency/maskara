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
  },
  {
    icon: Zap,
    title: 'Instant Verification',
    description: 'New orders trigger a call within seconds — no queues, no manual dialing.',
  },
  {
    icon: Globe,
    title: 'Multi-Platform Integration',
    description: 'Shopify, WooCommerce, ShopIn, or any store via webhook and REST API.',
  },
  {
    icon: Shield,
    title: 'Cut Fake Orders',
    description: 'Confirm intent before dispatch and reduce COD returns that drain your margin.',
  },
  {
    icon: BarChart3,
    title: 'Live Analytics',
    description: 'Verification rates, call outcomes, and daily reports in one merchant dashboard.',
  },
  {
    icon: RefreshCw,
    title: 'Smart Retry',
    description: 'Missed calls retry on your schedule until the customer answers or you stop.',
  },
];

const steps = [
  {
    step: '01',
    title: 'Order arrives',
    desc: 'Shopify, WooCommerce, or custom store sends the order to Maskara.',
  },
  {
    step: '02',
    title: 'AI dials',
    desc: 'Maskara places a Bangla voice call with order details and amount.',
  },
  {
    step: '03',
    title: 'Customer confirms',
    desc: 'Press 1 to confirm, 2 to cancel, 0 to hear again — DTMF, no app needed.',
  },
  {
    step: '04',
    title: 'Status syncs',
    desc: 'Your store and dashboard update instantly with the call result.',
  },
];

export default function LandingPage() {
  return (
    <div className="landing-root min-h-screen">
      <Navbar />

      {/* Hero — one composition: brand, headline, line, CTAs, voice plane */}
      <section className="relative flex min-h-[100svh] flex-col overflow-hidden pt-16">
        <div className="absolute inset-0 bg-[linear-gradient(165deg,#f7fafc_0%,#eef4fa_42%,#e8f4f3_100%)]" />
        <SignalGrid />
        <VoiceWave />

        <div className="relative z-10 mx-auto flex w-full max-w-7xl flex-1 flex-col justify-center px-4 pb-36 pt-10 sm:px-6 sm:pb-44 lg:px-8">
          <div className="land-fade-up max-w-3xl">
            <p className="font-display text-[clamp(2.75rem,8vw,5.5rem)] font-semibold leading-[0.95] tracking-[-0.04em] text-[#0b1a2b]">
              Maskara
            </p>
            <h1 className="mt-5 max-w-2xl font-display text-[clamp(1.65rem,4.2vw,2.75rem)] font-medium leading-[1.15] tracking-[-0.03em] text-[#0b1a2b]">
              Artificial intelligence that{' '}
              <span className="text-brand-600">calls in Bangla</span> to verify every COD order.
            </h1>
            <p className="mt-5 max-w-xl text-[1.05rem] leading-relaxed text-slate-600 sm:text-lg">
              Listen, confirm, and cut fake deliveries — your AI voice agent works the moment an
              order hits your store.
            </p>
            <div className="mt-9 flex flex-col gap-3 sm:flex-row sm:items-center">
              <Link href="/register" className="btn-primary gap-2 px-8 py-3.5 text-base">
                Start 14-Day Free Trial <ArrowRight className="h-5 w-5" />
              </Link>
              <Link
                href="/docs"
                className="inline-flex items-center justify-center gap-2 rounded-xl px-6 py-3.5 text-base font-semibold text-slate-700 transition hover:bg-white/70"
              >
                View API Docs
              </Link>
            </div>
            <p className="mt-4 text-sm text-slate-500">No card required · 50 free calls included</p>
          </div>
        </div>
      </section>

      {/* Product moment — call experience (below fold) */}
      <section className="relative border-t border-slate-200/80 bg-white py-20 sm:py-24">
        <div className="mx-auto grid max-w-7xl items-center gap-12 px-4 sm:px-6 lg:grid-cols-2 lg:gap-16 lg:px-8">
          <div className="land-fade-up">
            <p className="text-sm font-semibold uppercase tracking-[0.14em] text-brand-600">
              Live voice intelligence
            </p>
            <h2 className="mt-3 font-display text-3xl font-semibold tracking-[-0.03em] text-[#0b1a2b] sm:text-4xl">
              Your customer hears a real Bangla agent — not a robot script dump.
            </h2>
            <p className="mt-4 text-slate-600">
              Maskara speaks order details clearly, waits for a key press, and writes the result
              back to your store. Built for Bangladesh COD, end to end.
            </p>
            <ul className="mt-8 space-y-3 text-[15px] text-slate-700">
              {[
                'Natural Bangla TTS with merchant voice choice',
                '1 confirm · 2 cancel · 0 repeat',
                'Works with Shopify, WooCommerce & custom APIs',
              ].map((item) => (
                <li key={item} className="flex gap-3">
                  <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-brand-500" />
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </div>

          <div className="relative land-fade-up land-fade-delay">
            <div className="absolute -inset-4 rounded-[2rem] bg-[radial-gradient(ellipse_at_top,rgba(26,130,245,0.12),transparent_60%)]" />
            <div className="relative overflow-hidden rounded-[1.5rem] border border-slate-200/90 bg-[#0b1a2b] p-6 text-white shadow-[0_24px_60px_-28px_rgba(11,26,43,0.45)] sm:p-8">
              <div className="flex items-center gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-brand-500/20 ring-1 ring-brand-400/30">
                  <Phone className="h-5 w-5 text-brand-300" />
                </div>
                <div>
                  <p className="font-display text-sm font-semibold tracking-wide text-white">
                    Incoming · Maskara AI
                  </p>
                  <p className="text-xs text-slate-400">Bangla voice agent</p>
                </div>
                <span className="ml-auto flex items-center gap-1.5 text-xs font-medium text-teal-300">
                  <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-teal-400" />
                  Live
                </span>
              </div>

              <div className="mt-6 flex h-10 items-end justify-center gap-1">
                {Array.from({ length: 24 }).map((_, i) => (
                  <span
                    key={i}
                    className="land-mini-bar w-1 rounded-full bg-gradient-to-t from-brand-600 to-teal-300"
                    style={{
                      height: `${10 + ((i * 7) % 28)}px`,
                      animationDelay: `${i * 0.05}s`,
                    }}
                  />
                ))}
              </div>

              <p className="mt-6 rounded-xl bg-white/5 p-4 text-[15px] leading-relaxed text-slate-200 ring-1 ring-white/10">
                হ্যালো। আপনি <span className="text-white">ডেমো স্টোর</span>-এ অর্ডার করেছেন। আপনার
                মোট বিল <span className="text-white">৫৬০ টাকা</span>। অর্ডারটি নিশ্চিত করতে{' '}
                <span className="text-brand-300">১</span> চাপুন, বাতিল করতে{' '}
                <span className="text-brand-300">২</span>, আবার শুনতে{' '}
                <span className="text-brand-300">০</span>।
              </p>

              <div className="mt-6 flex justify-center gap-5">
                {[
                  { k: '1', label: 'Confirm' },
                  { k: '2', label: 'Cancel' },
                  { k: '0', label: 'Repeat' },
                ].map((key) => (
                  <div key={key.k} className="text-center">
                    <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl border border-white/15 bg-white/5 font-display text-lg font-semibold text-white">
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
      <section className="border-t border-slate-200/80 bg-[#f3f7fb] py-20 sm:py-24" id="how-it-works">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="max-w-2xl">
            <p className="text-sm font-semibold uppercase tracking-[0.14em] text-brand-600">
              How it works
            </p>
            <h2 className="mt-3 font-display text-3xl font-semibold tracking-[-0.03em] text-[#0b1a2b] sm:text-4xl">
              Order to verification in under a minute
            </h2>
            <p className="mt-3 text-slate-600">Four steps. Zero manual calling.</p>
          </div>

          <ol className="mt-14 grid gap-10 sm:grid-cols-2 lg:grid-cols-4 lg:gap-6">
            {steps.map((s, i) => (
              <li key={s.step} className="relative">
                {i < steps.length - 1 && (
                  <span className="absolute left-[3.25rem] top-5 hidden h-px w-[calc(100%-1rem)] bg-gradient-to-r from-brand-300/80 to-transparent lg:block" />
                )}
                <span className="font-display text-sm font-semibold tracking-wider text-brand-600">
                  {s.step}
                </span>
                <h3 className="mt-3 font-display text-lg font-semibold text-[#0b1a2b]">{s.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-slate-600">{s.desc}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* Features */}
      <section className="border-t border-slate-200/80 bg-white py-20 sm:py-24" id="features">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="max-w-2xl">
            <p className="text-sm font-semibold uppercase tracking-[0.14em] text-brand-600">
              Platform
            </p>
            <h2 className="mt-3 font-display text-3xl font-semibold tracking-[-0.03em] text-[#0b1a2b] sm:text-4xl">
              Intelligence built for Bangladesh eCommerce
            </h2>
            <p className="mt-3 text-slate-600">
              Everything you need to verify COD orders with AI voice — no extra tools.
            </p>
          </div>

          <div className="mt-14 grid gap-x-10 gap-y-12 sm:grid-cols-2 lg:grid-cols-3">
            {features.map((f) => (
              <div key={f.title} className="group">
                <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#eef5fc] text-brand-600 transition group-hover:bg-brand-600 group-hover:text-white">
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
      <section className="relative overflow-hidden border-t border-slate-200/80 py-20 sm:py-24">
        <div className="absolute inset-0 bg-[linear-gradient(135deg,#0b1a2b_0%,#13406e_55%,#0f766e_100%)]" />
        <div className="absolute inset-0 land-grid-dark opacity-30" />
        <div className="relative mx-auto max-w-3xl px-4 text-center sm:px-6 lg:px-8">
          <h2 className="font-display text-3xl font-semibold tracking-[-0.03em] text-white sm:text-4xl">
            Ready to let intelligence handle your confirmations?
          </h2>
          <p className="mx-auto mt-4 max-w-xl text-slate-300">
            Join Bangladesh merchants who verify COD with Maskara — fewer fake orders, cleaner
            deliveries.
          </p>
          <Link
            href="/register"
            className="mt-9 inline-flex items-center gap-2 rounded-xl bg-white px-8 py-3.5 text-base font-semibold text-[#0b1a2b] transition hover:bg-brand-50"
          >
            Get Started Free <ArrowRight className="h-5 w-5" />
          </Link>
        </div>
      </section>

      <Footer />
    </div>
  );
}
