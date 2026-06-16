import Link from 'next/link';
import { Navbar } from '@/components/layout/Navbar';
import { Footer } from '@/components/layout/Footer';
import {
  Phone,
  Zap,
  Shield,
  BarChart3,
  Globe,
  CheckCircle2,
  ArrowRight,
  Bot,
  RefreshCw,
} from 'lucide-react';

const features = [
  {
    icon: Bot,
    title: 'AI Bangla Voice Agent',
    description: 'Natural Bangla voice calls that greet customers and verify orders with DTMF key press.',
  },
  {
    icon: Zap,
    title: 'Instant Verification',
    description: 'Orders trigger automatic calls within seconds of placement. No manual work needed.',
  },
  {
    icon: Globe,
    title: 'Multi-Platform Integration',
    description: 'Connect Shopify, WooCommerce, or any custom website via API or webhooks.',
  },
  {
    icon: Shield,
    title: 'Reduce Fake Orders',
    description: 'Cut COD return rates by up to 70% with automated order confirmation calls.',
  },
  {
    icon: BarChart3,
    title: 'Real-time Analytics',
    description: 'Track verification rates, call success, and daily reports from your dashboard.',
  },
  {
    icon: RefreshCw,
    title: 'Smart Retry System',
    description: 'Automatic retry for missed calls with configurable intervals and max attempts.',
  },
];

const steps = [
  { step: '1', title: 'Customer Places Order', desc: 'Order comes from your Shopify, WooCommerce, or custom store.' },
  { step: '2', title: 'Webhook Triggers Call', desc: 'Maskara receives order data and initiates AI voice call.' },
  { step: '3', title: 'Customer Confirms', desc: 'Customer hears Bangla greeting and presses 1 to confirm, 2 to cancel.' },
  { step: '4', title: 'Status Updated', desc: 'Order status updates instantly. You get SMS and dashboard notification.' },
];

export default function LandingPage() {
  return (
    <div className="min-h-screen">
      <Navbar />

      {/* Hero */}
      <section className="relative overflow-hidden pt-24 pb-20">
        <div className="absolute inset-0 bg-gradient-to-br from-brand-50 via-white to-blue-50" />
        <div className="relative mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-3xl text-center">
            <div className="mb-6 inline-flex items-center gap-2 rounded-full bg-brand-100 px-4 py-1.5 text-sm font-medium text-brand-700">
              <Phone className="h-4 w-4" />
              Built for Bangladesh eCommerce
            </div>
            <h1 className="text-4xl font-extrabold tracking-tight text-slate-900 sm:text-6xl">
              Verify Every Order with{' '}
              <span className="bg-gradient-to-r from-brand-600 to-blue-600 bg-clip-text text-transparent">
                AI Voice Calls
              </span>
            </h1>
            <p className="mt-6 text-lg text-slate-600">
              Automatically call your customers in Bangla to confirm COD orders.
              Reduce fake orders, save delivery costs, and grow your business with confidence.
            </p>
            <div className="mt-10 flex flex-col items-center gap-4 sm:flex-row sm:justify-center">
              <Link href="/register" className="btn-primary gap-2 px-8 py-3 text-base">
                Start 14-Day Free Trial <ArrowRight className="h-5 w-5" />
              </Link>
              <Link href="/docs" className="btn-secondary gap-2 px-8 py-3 text-base">
                View API Docs
              </Link>
            </div>
            <p className="mt-4 text-sm text-slate-400">No credit card required. 50 free calls included.</p>
          </div>

          {/* Demo call preview */}
          <div className="mx-auto mt-16 max-w-lg">
            <div className="card border-brand-200 bg-gradient-to-b from-white to-brand-50/50">
              <div className="flex items-center gap-3 border-b border-slate-100 pb-4">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-emerald-100">
                  <Phone className="h-5 w-5 text-emerald-600" />
                </div>
                <div>
                  <p className="font-semibold text-slate-900">Incoming Call</p>
                  <p className="text-sm text-slate-500">AI Voice Agent - Bangla</p>
                </div>
                <span className="ml-auto badge-success">Live</span>
              </div>
              <div className="mt-4 space-y-3 text-sm">
                <div className="rounded-lg bg-slate-50 p-3 text-slate-700">
                  <p className="font-medium text-brand-700">AI Agent:</p>
                  <p className="mt-1 leading-relaxed">
                    আসসালামু আলাইকুম। আপনি <strong>ডেমো স্টোর</strong> থেকে একটি অর্ডার করেছেন।
                    অর্ডারটি নিশ্চিত করতে <strong>১</strong> চাপুন। অর্ডার বাতিল করতে <strong>২</strong> চাপুন।
                    একজন প্রতিনিধির সাথে কথা বলতে <strong>০</strong> চাপুন।
                  </p>
                </div>
                <div className="flex justify-center gap-4 py-2">
                  {['1', '2', '0'].map((key) => (
                    <div key={key} className="flex h-12 w-12 items-center justify-center rounded-full border-2 border-brand-300 bg-white text-lg font-bold text-brand-600 shadow-sm">
                      {key}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* How it works */}
      <section className="py-20" id="how-it-works">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="text-center">
            <h2 className="text-3xl font-bold text-slate-900">How It Works</h2>
            <p className="mt-3 text-slate-600">From order to verification in under 60 seconds</p>
          </div>
          <div className="mt-12 grid gap-8 md:grid-cols-4">
            {steps.map((s) => (
              <div key={s.step} className="text-center">
                <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-brand-600 text-lg font-bold text-white">
                  {s.step}
                </div>
                <h3 className="mt-4 font-semibold text-slate-900">{s.title}</h3>
                <p className="mt-2 text-sm text-slate-500">{s.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="bg-white py-20" id="features">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="text-center">
            <h2 className="text-3xl font-bold text-slate-900">Everything You Need</h2>
            <p className="mt-3 text-slate-600">A complete order verification platform for modern eCommerce</p>
          </div>
          <div className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {features.map((f) => (
              <div key={f.title} className="card transition hover:shadow-md">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-brand-50">
                  <f.icon className="h-5 w-5 text-brand-600" />
                </div>
                <h3 className="mt-4 font-semibold text-slate-900">{f.title}</h3>
                <p className="mt-2 text-sm text-slate-500">{f.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-20">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="rounded-2xl bg-gradient-to-r from-brand-600 to-blue-600 px-8 py-16 text-center text-white">
            <h2 className="text-3xl font-bold">Ready to Stop Fake Orders?</h2>
            <p className="mx-auto mt-4 max-w-xl text-brand-100">
              Join hundreds of Bangladesh merchants using Maskara to confirm orders and reduce returns.
            </p>
            <Link href="/register" className="mt-8 inline-flex items-center gap-2 rounded-lg bg-white px-8 py-3 text-base font-semibold text-brand-700 shadow-lg transition hover:bg-brand-50">
              Get Started Free <ArrowRight className="h-5 w-5" />
            </Link>
          </div>
        </div>
      </section>

      <Footer />
    </div>
  );
}
