import Link from 'next/link';
import { Navbar } from '@/components/layout/Navbar';
import { Footer } from '@/components/layout/Footer';
import { SignalGrid } from '@/components/landing/SignalGrid';
import { VoiceWave } from '@/components/landing/VoiceWave';
import { Reveal } from '@/components/landing/Reveal';
import { TestCallDemo } from '@/components/landing/TestCallDemo';
import {
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
  },
  {
    icon: Zap,
    title: 'Verified in seconds',
    description:
      'The moment an order lands, Maskara is already dialing. No waiting, no staff time.',
  },
  {
    icon: Globe,
    title: 'Plugs into your store',
    description:
      'Shopify, WooCommerce, ShopIn, or your own API — connect once, verify forever.',
  },
  {
    icon: Shield,
    title: 'Stop fake COD before it ships',
    description:
      'Only confirmed orders leave the warehouse. Fewer returns, cleaner cash flow.',
  },
  {
    icon: BarChart3,
    title: 'See the truth in realtime',
    description: 'Answer rates, confirms, cancels — live on your dashboard, every day.',
  },
  {
    icon: RefreshCw,
    title: 'Never miss a customer',
    description:
      'Busy? No answer? Smart retries keep calling until you get a clear yes or no.',
  },
];

const steps = [
  {
    step: '01',
    title: 'Order lands',
    desc: 'Your store sends the order. Maskara wakes instantly.',
  },
  {
    step: '02',
    title: 'AI speaks Bangla',
    desc: 'A natural voice call shares the amount and asks to confirm.',
  },
  {
    step: '03',
    title: 'One-key answer',
    desc: 'Customer presses 1 to confirm, 2 to cancel, 0 to hear again.',
  },
  {
    step: '04',
    title: 'Store updates',
    desc: 'Status syncs back — you ship only what is real.',
  },
];

export default function LandingPage() {
  return (
    <div className="landing-root min-h-screen overflow-x-hidden bg-[#f7f8fc]">
      <Navbar />

      {/* Hero = interactive test call (first viewport) */}
      <section
        id="test-call"
        className="relative flex min-h-[100svh] flex-col overflow-hidden pt-14 sm:pt-16"
      >
        <div className="absolute inset-0 bg-[#f7f8fc]" />
        <div className="pointer-events-none absolute -left-24 top-24 h-72 w-72 rounded-full bg-[#1a82f5]/10 blur-3xl" />
        <div className="pointer-events-none absolute -right-16 bottom-20 h-80 w-80 rounded-full bg-[#0d9488]/10 blur-3xl" />
        <SignalGrid />
        <VoiceWave />

        <div className="relative z-10 mx-auto flex w-full max-w-7xl flex-1 flex-col justify-center px-4 py-10 sm:px-6 sm:py-14 lg:px-8">
          <TestCallDemo />
        </div>
      </section>

      <section
        className="border-t border-[#e6e9f2] bg-white py-16 sm:py-24"
        id="how-it-works"
      >
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <Reveal>
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#1a82f5] sm:text-sm">
              How it works
            </p>
            <h2 className="mt-3 font-display text-[1.65rem] font-semibold tracking-[-0.03em] text-[#15204a] sm:text-4xl">
              From checkout to confirmation — under a minute.
            </h2>
            <p className="mt-3 text-[#5b647a]">Four silent steps. Zero manual dialing.</p>
          </Reveal>

          <ol className="mt-10 grid gap-5 sm:mt-14 sm:grid-cols-2 sm:gap-6 lg:grid-cols-4">
            {steps.map((s, i) => (
              <li key={s.step} className="list-none">
                <Reveal delay={i * 80} className="h-full">
                  <div className="h-full rounded-2xl border border-[#e6e9f2] bg-[#f7f8fc] p-5 sm:p-6">
                    <span className="inline-flex h-8 min-w-8 items-center justify-center rounded-lg bg-[#1a82f5]/10 px-2 text-xs font-bold text-[#1a82f5]">
                      {s.step}
                    </span>
                    <h3 className="mt-4 font-display text-lg font-semibold text-[#15204a]">
                      {s.title}
                    </h3>
                    <p className="mt-2 text-sm leading-relaxed text-[#5b647a]">{s.desc}</p>
                  </div>
                </Reveal>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <section className="border-t border-[#e6e9f2] bg-[#f7f8fc] py-16 sm:py-24" id="features">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <Reveal>
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#0d9488] sm:text-sm">
              Why Maskara
            </p>
            <h2 className="mt-3 font-display text-[1.65rem] font-semibold tracking-[-0.03em] text-[#15204a] sm:text-4xl">
              Intelligence made for Bangladesh COD.
            </h2>
            <p className="mt-3 text-[#5b647a]">One platform. Real voice. Fewer fake deliveries.</p>
          </Reveal>

          <div className="mt-10 grid gap-4 sm:mt-14 sm:grid-cols-2 sm:gap-5 lg:grid-cols-3">
            {features.map((f, i) => (
              <Reveal key={f.title} delay={(i % 3) * 70}>
                <div className="group h-full rounded-2xl border border-[#e6e9f2] bg-white p-5 transition hover:border-[#c7ccef] sm:p-6">
                  <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#1a82f5]/10 text-[#1a82f5] transition group-hover:bg-[#1a82f5] group-hover:text-white">
                    <f.icon className="h-5 w-5" />
                  </div>
                  <h3 className="mt-4 font-display text-lg font-semibold text-[#15204a]">
                    {f.title}
                  </h3>
                  <p className="mt-2 text-sm leading-relaxed text-[#5b647a]">{f.description}</p>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      <section className="relative overflow-hidden py-16 sm:py-24">
        <div className="absolute inset-0 bg-[#15204a]" />
        <div className="land-mesh absolute left-1/2 top-1/2 h-[120%] w-[90%] -translate-x-1/2 -translate-y-1/2 opacity-40 blur-3xl" />
        <Reveal className="relative mx-auto max-w-3xl px-4 text-center sm:px-6 lg:px-8">
          <h2 className="font-display text-[1.65rem] font-semibold tracking-[-0.03em] text-white sm:text-4xl">
            Let intelligence guard every delivery.
          </h2>
          <p className="mx-auto mt-4 max-w-xl text-[15px] text-white/70 sm:text-base">
            Bangladesh merchants trust Maskara to turn COD chaos into confirmed orders — start free
            today.
          </p>
          <Link
            href="/register"
            className="mt-8 inline-flex min-h-[48px] items-center gap-2 rounded-2xl bg-white px-8 py-3.5 text-base font-semibold text-[#15204a] transition hover:bg-[#eef0ff] sm:mt-9"
          >
            Start for Free <ArrowRight className="h-5 w-5 land-arrow" />
          </Link>
        </Reveal>
      </section>

      <Footer />
    </div>
  );
}
