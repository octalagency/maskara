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

      <section className="relative flex min-h-[100svh] flex-col overflow-hidden pt-14 sm:pt-16">
        <div className="absolute inset-0 bg-[#f7f8fc]" />
        <SignalGrid />
        <VoiceWave />

        <div className="relative z-10 mx-auto flex w-full max-w-7xl flex-1 flex-col justify-center px-4 pb-36 pt-10 sm:px-6 sm:pb-40 sm:pt-14 lg:px-8">
          <HeroCopy />
        </div>
      </section>

      {/* Mesh glass product moment */}
      <section className="relative border-t border-[#e6e9f2] bg-white py-16 sm:py-24">
        <div className="mx-auto grid max-w-7xl items-center gap-10 px-4 sm:gap-12 sm:px-6 lg:grid-cols-2 lg:gap-16 lg:px-8">
          <Reveal>
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#3b5bdb] sm:text-sm">
              Hear the intelligence
            </p>
            <h2 className="mt-3 font-display text-[1.65rem] font-semibold tracking-[-0.03em] text-[#15204a] sm:text-4xl">
              Not a script dump — a Bangla conversation that closes the loop.
            </h2>
            <p className="mt-4 text-[15px] leading-relaxed text-[#5b647a] sm:text-base">
              Maskara says the shop name, the bill, and waits. One key press tells you if the
              customer is real — then your store knows instantly.
            </p>
            <ul className="mt-7 space-y-3 text-[15px] text-[#15204a] sm:mt-8">
              {[
                'Natural Bangla voices you can choose',
                '১ Confirm · ২ Cancel · ০ Repeat',
                'Shopify, WooCommerce, ShopIn & custom API',
              ].map((t) => (
                <li key={t} className="flex gap-3">
                  <span className="mt-2 h-2 w-2 shrink-0 rounded-full bg-[#3b5bdb]" />
                  <span>{t}</span>
                </li>
              ))}
            </ul>
          </Reveal>

          <Reveal delay={120} className="relative mx-auto w-full max-w-md lg:max-w-none">
            <div className="land-glass-card relative overflow-hidden rounded-[1.75rem] p-1">
              <div className="relative rounded-[1.55rem] bg-white/55 p-5 backdrop-blur-xl sm:p-8">
                <div className="flex items-center gap-3">
                  <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[#3b5bdb]/15">
                    <Phone className="h-5 w-5 text-[#3b5bdb]" />
                  </div>
                  <div className="min-w-0">
                    <p className="font-display text-sm font-semibold text-[#15204a]">
                      Incoming · Maskara AI
                    </p>
                    <p className="text-xs text-[#8a92a8]">Live Bangla agent</p>
                  </div>
                  <span className="ml-auto flex shrink-0 items-center gap-1.5 text-xs font-medium text-[#3b5bdb]">
                    <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-[#3b5bdb]" />
                    Live
                  </span>
                </div>

                <div className="mt-6 flex h-10 items-end justify-center gap-[3px] sm:gap-1">
                  {Array.from({ length: 22 }).map((_, i) => (
                    <span
                      key={i}
                      className="land-mini-bar w-1 rounded-full bg-gradient-to-t from-[#3b5bdb] via-[#8b7cf6] to-[#f9a8d4] sm:w-1.5"
                      style={{
                        height: `${10 + ((i * 7) % 28)}px`,
                        animationDelay: `${i * 0.05}s`,
                      }}
                    />
                  ))}
                </div>

                <p className="mt-6 rounded-2xl bg-white/70 p-4 text-[14px] leading-relaxed text-[#15204a] ring-1 ring-[#d5d9e8]/80 sm:text-[15px]">
                  হ্যালো। আপনি <span className="font-semibold">ডেমো স্টোর</span>-এ অর্ডার করেছেন।
                  আপনার মোট বিল <span className="font-semibold text-[#3b5bdb]">৫৬০ টাকা</span>।
                  নিশ্চিত করতে <span className="font-semibold text-[#3b5bdb]">১</span>, বাতিল{' '}
                  <span className="font-semibold text-[#7c6cf0]">২</span>, আবার শুনতে{' '}
                  <span className="font-semibold text-[#e879a9]">০</span>।
                </p>

                <div className="mt-6 grid grid-cols-3 gap-3 sm:flex sm:justify-center sm:gap-5">
                  {[
                    { k: '1', label: 'Confirm' },
                    { k: '2', label: 'Cancel' },
                    { k: '0', label: 'Repeat' },
                  ].map((key) => (
                    <div key={key.k} className="text-center">
                      <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl border border-[#d5d9e8] bg-white font-display text-lg font-semibold text-[#15204a]">
                        {key.k}
                      </div>
                      <p className="mt-1.5 text-[11px] text-[#8a92a8]">{key.label}</p>
                    </div>
                  ))}
                </div>

                <Link
                  href="/register"
                  className="mt-7 flex min-h-[48px] w-full items-center justify-center gap-2 rounded-2xl bg-[#3b5bdb] text-base font-semibold text-white transition hover:bg-[#2f4bc7]"
                >
                  <Phone className="h-4 w-4" /> Start Call Experience
                </Link>
              </div>
            </div>
          </Reveal>
        </div>
      </section>

      <section
        className="border-t border-[#e6e9f2] bg-[#f7f8fc] py-16 sm:py-24"
        id="how-it-works"
      >
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <Reveal>
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#7c6cf0] sm:text-sm">
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
                  <div className="h-full rounded-2xl border border-[#e6e9f2] bg-white p-5 sm:p-6">
                    <span className="inline-flex h-8 min-w-8 items-center justify-center rounded-lg bg-[#3b5bdb]/10 px-2 text-xs font-bold text-[#3b5bdb]">
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

      <section className="border-t border-[#e6e9f2] bg-white py-16 sm:py-24" id="features">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <Reveal>
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#e879a9] sm:text-sm">
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
                <div className="group h-full rounded-2xl border border-[#e6e9f2] bg-[#f7f8fc] p-5 transition hover:border-[#c7ccef] hover:bg-white sm:p-6">
                  <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#3b5bdb]/10 text-[#3b5bdb] transition group-hover:bg-[#3b5bdb] group-hover:text-white">
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
