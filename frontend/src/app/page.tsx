import Link from 'next/link';
import { Navbar } from '@/components/layout/Navbar';
import { Footer } from '@/components/layout/Footer';
import { SignalGrid } from '@/components/landing/SignalGrid';
import { VoiceWave } from '@/components/landing/VoiceWave';
import { HeroCopy } from '@/components/landing/HeroCopy';
import { Reveal } from '@/components/landing/Reveal';
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
    title: 'Bangla AI that sounds human',
    description:
      'Warm, clear Bangla speech — customers hear a real agent, not a stiff robocall.',
    tint: 'from-sky-500/15 to-sky-500/5',
    iconBg: 'bg-sky-100 text-sky-600 group-hover:bg-sky-600',
  },
  {
    icon: Zap,
    title: 'Verified in seconds',
    description:
      'The moment an order lands, Maskara is already dialing. No waiting, no staff time.',
    tint: 'from-amber-500/15 to-amber-500/5',
    iconBg: 'bg-amber-100 text-amber-600 group-hover:bg-amber-500',
  },
  {
    icon: Globe,
    title: 'Plugs into your store',
    description:
      'Shopify, WooCommerce, ShopIn, or your own API — connect once, verify forever.',
    tint: 'from-teal-500/15 to-teal-500/5',
    iconBg: 'bg-teal-100 text-teal-600 group-hover:bg-teal-600',
  },
  {
    icon: Shield,
    title: 'Stop fake COD before it ships',
    description:
      'Only confirmed orders leave the warehouse. Fewer returns, cleaner cash flow.',
    tint: 'from-emerald-500/15 to-emerald-500/5',
    iconBg: 'bg-emerald-100 text-emerald-600 group-hover:bg-emerald-600',
  },
  {
    icon: BarChart3,
    title: 'See the truth in realtime',
    description:
      'Answer rates, confirms, cancels — live on your dashboard, every day.',
    tint: 'from-blue-500/15 to-blue-500/5',
    iconBg: 'bg-blue-100 text-blue-600 group-hover:bg-blue-600',
  },
  {
    icon: RefreshCw,
    title: 'Never miss a customer',
    description:
      'Busy? No answer? Smart retries keep calling until you get a clear yes or no.',
    tint: 'from-cyan-500/15 to-cyan-500/5',
    iconBg: 'bg-cyan-100 text-cyan-600 group-hover:bg-cyan-600',
  },
];

const steps = [
  {
    step: '01',
    title: 'Order lands',
    desc: 'Your store sends the order. Maskara wakes instantly.',
    accent: 'bg-sky-500',
  },
  {
    step: '02',
    title: 'AI speaks Bangla',
    desc: 'A natural voice call shares the amount and asks to confirm.',
    accent: 'bg-teal-500',
  },
  {
    step: '03',
    title: 'One-key answer',
    desc: 'Customer presses 1 to confirm, 2 to cancel, 0 to hear again.',
    accent: 'bg-amber-500',
  },
  {
    step: '04',
    title: 'Store updates',
    desc: 'Status syncs back — you ship only what is real.',
    accent: 'bg-emerald-500',
  },
];

export default function LandingPage() {
  return (
    <div className="landing-root min-h-screen overflow-x-hidden">
      <Navbar />

      <section className="relative flex min-h-[100svh] flex-col overflow-hidden pt-14 sm:pt-16">
        <div className="absolute inset-0 bg-[linear-gradient(160deg,#eaf3ff_0%,#e8f7f4_38%,#fff8eb_78%,#eef6ff_100%)]" />
        <SignalGrid />
        <VoiceWave />

        <div className="relative z-10 mx-auto flex w-full max-w-7xl flex-1 flex-col justify-center px-4 pb-32 pt-8 sm:px-6 sm:pb-44 sm:pt-12 lg:px-8">
          <HeroCopy />
        </div>
      </section>

      <section className="relative border-t border-sky-100 bg-white py-16 sm:py-24">
        <div className="absolute inset-x-0 top-0 h-32 bg-gradient-to-b from-sky-50/80 to-transparent" />
        <div className="relative mx-auto grid max-w-7xl items-center gap-10 px-4 sm:gap-12 sm:px-6 lg:grid-cols-2 lg:gap-16 lg:px-8">
          <Reveal>
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-teal-600 sm:text-sm">
              Hear the intelligence
            </p>
            <h2 className="mt-3 font-display text-[1.65rem] font-semibold tracking-[-0.03em] text-[#0b1a2b] sm:text-4xl">
              Not a script dump — a Bangla conversation that closes the loop.
            </h2>
            <p className="mt-4 text-[15px] leading-relaxed text-slate-600 sm:text-base">
              Maskara says the shop name, the bill, and waits. One key press tells you if the
              customer is real — then your store knows instantly.
            </p>
            <ul className="mt-7 space-y-3 text-[15px] text-slate-700 sm:mt-8">
              {[
                { t: 'Natural Bangla voices you can choose', c: 'bg-sky-500' },
                { t: '১ Confirm · ২ Cancel · ০ Repeat', c: 'bg-teal-500' },
                { t: 'Shopify, WooCommerce, ShopIn & custom API', c: 'bg-amber-500' },
              ].map((item) => (
                <li key={item.t} className="flex gap-3">
                  <span className={`mt-2 h-2 w-2 shrink-0 rounded-full ${item.c}`} />
                  <span>{item.t}</span>
                </li>
              ))}
            </ul>
          </Reveal>

          <Reveal delay={120} className="relative mx-auto w-full max-w-md lg:max-w-none">
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
                  <p className="text-xs text-slate-400">Live Bangla agent</p>
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
          </Reveal>
        </div>
      </section>

      <section
        className="border-t border-teal-100/80 bg-gradient-to-b from-[#f0faf8] to-[#eef6ff] py-16 sm:py-24"
        id="how-it-works"
      >
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <Reveal>
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-sky-600 sm:text-sm">
              How it works
            </p>
            <h2 className="mt-3 font-display text-[1.65rem] font-semibold tracking-[-0.03em] text-[#0b1a2b] sm:text-4xl">
              From checkout to confirmation — under a minute.
            </h2>
            <p className="mt-3 text-slate-600">Four silent steps. Zero manual dialing.</p>
          </Reveal>

          <ol className="mt-10 grid gap-5 sm:mt-14 sm:grid-cols-2 sm:gap-6 lg:grid-cols-4">
            {steps.map((s, i) => (
              <li key={s.step} className="list-none">
                <Reveal delay={i * 80} className="h-full">
                  <div className="h-full rounded-2xl border border-white/80 bg-white/70 p-5 backdrop-blur-sm sm:p-6">
                    <span
                      className={`inline-flex h-8 w-8 items-center justify-center rounded-lg text-xs font-bold text-white ${s.accent}`}
                    >
                      {s.step}
                    </span>
                    <h3 className="mt-4 font-display text-lg font-semibold text-[#0b1a2b]">
                      {s.title}
                    </h3>
                    <p className="mt-2 text-sm leading-relaxed text-slate-600">{s.desc}</p>
                  </div>
                </Reveal>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <section className="border-t border-sky-100 bg-white py-16 sm:py-24" id="features">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <Reveal>
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-amber-600 sm:text-sm">
              Why Maskara
            </p>
            <h2 className="mt-3 font-display text-[1.65rem] font-semibold tracking-[-0.03em] text-[#0b1a2b] sm:text-4xl">
              Intelligence made for Bangladesh COD.
            </h2>
            <p className="mt-3 text-slate-600">
              One platform. Real voice. Fewer fake deliveries.
            </p>
          </Reveal>

          <div className="mt-10 grid gap-4 sm:mt-14 sm:grid-cols-2 sm:gap-5 lg:grid-cols-3">
            {features.map((f, i) => (
              <Reveal key={f.title} delay={(i % 3) * 70}>
                <div
                  className={`group h-full rounded-2xl border border-slate-100 bg-gradient-to-br ${f.tint} p-5 sm:p-6`}
                >
                  <div
                    className={`flex h-11 w-11 items-center justify-center rounded-xl transition group-hover:text-white ${f.iconBg}`}
                  >
                    <f.icon className="h-5 w-5" />
                  </div>
                  <h3 className="mt-4 font-display text-lg font-semibold text-[#0b1a2b]">
                    {f.title}
                  </h3>
                  <p className="mt-2 text-sm leading-relaxed text-slate-600">{f.description}</p>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      <section className="relative overflow-hidden py-16 sm:py-24">
        <div className="absolute inset-0 bg-[linear-gradient(125deg,#0b1a2b_0%,#0e4d7a_40%,#0f766e_72%,#b45309_100%)]" />
        <div className="absolute inset-0 land-grid-dark opacity-25" />
        <Reveal className="relative mx-auto max-w-3xl px-4 text-center sm:px-6 lg:px-8">
          <h2 className="font-display text-[1.65rem] font-semibold tracking-[-0.03em] text-white sm:text-4xl">
            Let intelligence guard every delivery.
          </h2>
          <p className="mx-auto mt-4 max-w-xl text-[15px] text-slate-200 sm:text-base">
            Bangladesh merchants trust Maskara to turn COD chaos into confirmed orders — start free
            today.
          </p>
          <Link
            href="/register"
            className="land-cta-glow mt-8 inline-flex min-h-[48px] items-center gap-2 rounded-xl bg-white px-8 py-3.5 text-base font-semibold text-[#0b1a2b] transition hover:bg-amber-50 sm:mt-9"
          >
            Get Started Free <ArrowRight className="h-5 w-5 land-arrow" />
          </Link>
        </Reveal>
      </section>

      <Footer />
    </div>
  );
}
