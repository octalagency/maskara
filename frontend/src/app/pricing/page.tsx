import Link from 'next/link';
import { Navbar } from '@/components/layout/Navbar';
import { Footer } from '@/components/layout/Footer';
import { CheckCircle2 } from 'lucide-react';

const plans = [
  {
    name: 'Free',
    price: '০',
    period: '১৪ দিন ট্রায়াল',
    calls: '৫০',
    sms: '২০',
    features: ['Bangla AI Voice Calls', 'Shopify Integration', 'WooCommerce Integration', 'Basic Dashboard', 'Email Support'],
    cta: 'Start Free Trial',
    popular: false,
  },
  {
    name: 'Starter',
    price: '১,৯৯৯',
    period: '/মাস',
    calls: '৩০০',
    sms: '১০০',
    features: ['Everything in Free', 'Call Recording', 'SMS Notifications', 'API Access', 'Webhook Config', 'Priority Support'],
    cta: 'Get Started',
    popular: false,
  },
  {
    name: 'Growth',
    price: '৪,৯৯৯',
    period: '/মাস',
    calls: '১,০০০',
    sms: '৫০০',
    features: ['Everything in Starter', 'WhatsApp Notifications', 'Advanced Reports', 'Failed Call Retry', 'Multiple API Keys', 'Dedicated Support'],
    cta: 'Get Started',
    popular: true,
  },
  {
    name: 'Enterprise',
    price: 'কাস্টম',
    period: '',
    calls: 'আনলিমিটেড',
    sms: 'আনলিমিটেড',
    features: ['Everything in Growth', 'Custom Voice Script', 'SLA Guarantee', 'White-label Option', 'Dedicated Account Manager', 'On-premise Option'],
    cta: 'Contact Sales',
    popular: false,
  },
];

export default function PricingPage() {
  return (
    <div className="min-h-screen">
      <Navbar />
      <section className="pt-24 pb-20">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="text-center">
            <h1 className="text-4xl font-bold text-slate-900">Simple, Transparent Pricing</h1>
            <p className="mt-4 text-lg text-slate-600">
              Choose the plan that fits your business. All plans include Bangla AI voice verification.
            </p>
          </div>

          <div className="mt-16 grid gap-8 lg:grid-cols-4">
            {plans.map((plan) => (
              <div
                key={plan.name}
                className={`card relative flex flex-col ${plan.popular ? 'border-brand-500 ring-2 ring-brand-500' : ''}`}
              >
                {plan.popular && (
                  <span className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-brand-600 px-3 py-1 text-xs font-semibold text-white">
                    Most Popular
                  </span>
                )}
                <h3 className="text-lg font-semibold text-slate-900">{plan.name}</h3>
                <div className="mt-4">
                  <span className="text-4xl font-bold text-slate-900">৳{plan.price}</span>
                  <span className="text-sm text-slate-500">{plan.period}</span>
                </div>
                <div className="mt-4 space-y-1 text-sm text-slate-600">
                  <p><strong>{plan.calls}</strong> calls/month</p>
                  <p><strong>{plan.sms}</strong> SMS/month</p>
                </div>
                <ul className="mt-6 flex-1 space-y-3">
                  {plan.features.map((f) => (
                    <li key={f} className="flex items-start gap-2 text-sm text-slate-600">
                      <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-brand-600" />
                      {f}
                    </li>
                  ))}
                </ul>
                <Link
                  href="/register"
                  className={`mt-8 block text-center ${plan.popular ? 'btn-primary' : 'btn-secondary'}`}
                >
                  {plan.cta}
                </Link>
              </div>
            ))}
          </div>
        </div>
      </section>
      <Footer />
    </div>
  );
}
