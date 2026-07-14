import Link from 'next/link';
import { Navbar } from '@/components/layout/Navbar';
import { Footer } from '@/components/layout/Footer';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';
const PLUGIN_URL = `${API_URL}/downloads/maskara-woocommerce.zip`;
const PLUGIN_URL_LOCAL = '/downloads/maskara-woocommerce.zip';

export default function DocsPage() {
  return (
    <div className="min-h-screen">
      <Navbar />
      <div className="mx-auto max-w-4xl px-4 pt-24 pb-20">
        <h1 className="text-4xl font-bold text-slate-900">API Documentation</h1>
        <p className="mt-4 text-lg text-slate-600">
          Integrate Maskara with your eCommerce platform using our REST API and webhooks.
        </p>

        <div className="mt-8 rounded-2xl border-2 border-brand-200 bg-brand-50/50 p-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <h2 className="text-xl font-bold text-slate-900">WooCommerce Plugin</h2>
              <p className="mt-1 text-sm text-slate-600">
                WordPress/WooCommerce store-এ install করুন — API key দিলেই automatic connect হবে।
              </p>
              <ul className="mt-3 space-y-1 text-sm text-slate-600">
                <li>✓ COD order automatic verification</li>
                <li>✓ One-click Test &amp; Connect</li>
                <li>✓ No coding required</li>
              </ul>
            </div>
            <div className="flex shrink-0 flex-col gap-2 self-start">
              <a
                href={PLUGIN_URL}
                download="maskara-woocommerce.zip"
                className="btn-primary inline-flex items-center gap-2"
              >
                ⬇ Download Plugin
              </a>
              <a href={PLUGIN_URL_LOCAL} download className="text-xs text-slate-500 hover:text-brand-600">
                অথবা frontend থেকে download
              </a>
            </div>
          </div>
          <div className="mt-5 rounded-lg bg-white p-4 text-sm text-slate-600">
            <p className="font-semibold text-slate-900">Install steps:</p>
            <ol className="mt-2 list-decimal space-y-1 pl-5">
              <li>Plugin zip download করুন</li>
              <li>WordPress → Plugins → Add New → Upload → Activate</li>
              <li><Link href="/login" className="text-brand-600 hover:underline">Merchant login</Link> করে API Key তৈরি করুন</li>
              <li>WooCommerce → Maskara → API URL + Key → Connect</li>
            </ol>
          </div>
        </div>

        <div className="mt-12 space-y-12">
          <section>
            <h2 className="text-2xl font-bold text-slate-900">Authentication</h2>
            <p className="mt-3 text-slate-600">All API requests require an API key in the header:</p>
            <pre className="mt-4 overflow-x-auto rounded-lg bg-slate-900 p-4 text-sm text-slate-100">
{`X-API-Key: mk_your_api_key_here`}
            </pre>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-slate-900">Create Order</h2>
            <p className="mt-3 text-slate-600">Submit a new order for verification. A voice call will be initiated automatically.</p>
            <pre className="mt-4 overflow-x-auto rounded-lg bg-slate-900 p-4 text-sm text-slate-100">
{`POST /orders
Content-Type: application/json
X-API-Key: mk_your_api_key

{
  "orderNumber": "ORD-12345",
  "customerName": "রহিম আহমেদ",
  "customerPhone": "01712345678",
  "customerEmail": "rahim@email.com",
  "totalAmount": 2500,
  "currency": "BDT",
  "paymentMethod": "COD",
  "items": [
    { "name": "T-Shirt", "quantity": 2, "price": 500 }
  ],
  "shippingAddress": {
    "address": "১২৩ মিরপুর রোড",
    "city": "ঢাকা",
    "district": "ঢাকা"
  }
}`}
            </pre>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-slate-900">Shopify Webhook</h2>
            <pre className="mt-4 overflow-x-auto rounded-lg bg-slate-900 p-4 text-sm text-slate-100">
{`POST /webhooks/shopify
X-API-Key: mk_your_api_key
X-Shopify-Topic: orders/create

# Shopify sends the full order JSON automatically`}
            </pre>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-slate-900">WooCommerce Integration</h2>
            <p className="mt-3 text-slate-600">
              Plugin ব্যবহার করলে webhook manually সেট করতে হবে না — plugin automatic order পাঠায়।
            </p>
            <a
              href={PLUGIN_URL}
              download="maskara-woocommerce.zip"
              className="btn-secondary mt-4 inline-flex items-center gap-2"
            >
              ⬇ maskara-woocommerce.zip
            </a>
            <pre className="mt-4 overflow-x-auto rounded-lg bg-slate-900 p-4 text-sm text-slate-100">
{`POST /webhooks/woocommerce
X-API-Key: mk_your_api_key

# Plugin sends COD orders automatically on processing/on-hold/pending`}
            </pre>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-slate-900">Webhook Callback</h2>
            <p className="mt-3 text-slate-600">When verification completes, we POST to your configured webhook URL:</p>
            <pre className="mt-4 overflow-x-auto rounded-lg bg-slate-900 p-4 text-sm text-slate-100">
{`POST https://yourstore.com/webhook
X-Webhook-Secret: your_secret

{
  "event": "order.verification.completed",
  "orderId": "clx...",
  "orderNumber": "ORD-12345",
  "status": "VERIFIED",
  "outcome": "CONFIRMED",
  "customerName": "রহিম আহমেদ",
  "customerPhone": "+8801712345678",
  "totalAmount": 2500,
  "timestamp": "2026-06-07T10:30:00Z"
}`}
            </pre>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-slate-900">Voice Call Flow</h2>
            <div className="mt-4 space-y-3 text-slate-600">
              <p>1. Order received via API/Webhook</p>
              <p>2. System initiates Twilio voice call to customer</p>
              <p>3. AI agent speaks in Bangla with store name</p>
              <p>4. Customer presses DTMF key: <strong>1</strong> = Confirm, <strong>2</strong> = Cancel, <strong>0</strong> = Replay script</p>
              <p>5. Order status updated and merchant notified</p>
            </div>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-slate-900">Response Codes</h2>
            <div className="mt-4 overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="border-b bg-slate-50">
                  <tr>
                    <th className="px-4 py-2">Code</th>
                    <th className="px-4 py-2">Description</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  <tr><td className="px-4 py-2">200</td><td className="px-4 py-2">Success</td></tr>
                  <tr><td className="px-4 py-2">201</td><td className="px-4 py-2">Order created, call queued</td></tr>
                  <tr><td className="px-4 py-2">400</td><td className="px-4 py-2">Invalid request (missing phone, etc.)</td></tr>
                  <tr><td className="px-4 py-2">401</td><td className="px-4 py-2">Invalid or missing API key</td></tr>
                  <tr><td className="px-4 py-2">429</td><td className="px-4 py-2">Rate limit exceeded</td></tr>
                </tbody>
              </table>
            </div>
          </section>
        </div>
      </div>
      <Footer />
    </div>
  );
}
