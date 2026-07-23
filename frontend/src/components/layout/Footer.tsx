'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Phone } from 'lucide-react';
import { api, type PublicContact } from '@/lib/api';

const DEFAULT_CONTACT: PublicContact = {
  email: 'support@maskara.bd',
  phone: '+880 1XXX-XXXXXX',
  location: 'Dhaka, Bangladesh',
};

export function Footer() {
  const [contact, setContact] = useState<PublicContact>(DEFAULT_CONTACT);

  useEffect(() => {
    api
      .getPublicContact()
      .then(setContact)
      .catch(() => {});
  }, []);

  const phoneHref = `tel:${contact.phone.replace(/[^\d+]/g, '')}`;

  return (
    <footer className="border-t border-slate-200 bg-white">
      <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
        <div className="grid gap-8 md:grid-cols-4">
          <div>
            <div className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-600">
                <Phone className="h-4 w-4 text-white" />
              </div>
              <span className="text-lg font-bold">Maskara</span>
            </div>
            <p className="mt-3 text-sm text-slate-500">
              AI-powered order verification for Bangladesh eCommerce businesses.
            </p>
          </div>
          <div>
            <h4 className="font-semibold text-slate-900">Product</h4>
            <ul className="mt-3 space-y-2 text-sm text-slate-500">
              <li><Link href="/#features" className="hover:text-brand-600">Features</Link></li>
              <li><Link href="/pricing" className="hover:text-brand-600">Pricing</Link></li>
              <li><Link href="/docs" className="hover:text-brand-600">API Documentation</Link></li>
            </ul>
          </div>
          <div>
            <h4 className="font-semibold text-slate-900">Integrations</h4>
            <ul className="mt-3 space-y-2 text-sm text-slate-500">
              <li>Shopify</li>
              <li>
                <a href="/downloads/maskara-woocommerce.zip" download className="hover:text-brand-600">
                  WooCommerce Plugin (Download)
                </a>
              </li>
              <li>Custom API</li>
            </ul>
          </div>
          <div>
            <h4 className="font-semibold text-slate-900">Contact</h4>
            <ul className="mt-3 space-y-2 text-sm text-slate-500">
              <li>
                <a href={`mailto:${contact.email}`} className="hover:text-brand-600">
                  {contact.email}
                </a>
              </li>
              <li>
                <a href={phoneHref} className="hover:text-brand-600">
                  {contact.phone}
                </a>
              </li>
              <li>{contact.location}</li>
            </ul>
          </div>
        </div>
        <div className="mt-8 border-t border-slate-200 pt-8 text-center text-sm text-slate-400">
          &copy; {new Date().getFullYear()} Maskara. All rights reserved.
        </div>
      </div>
    </footer>
  );
}
