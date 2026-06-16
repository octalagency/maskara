import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Maskara - AI Order Verification for eCommerce',
  description: 'Automatically verify COD orders with AI-powered Bangla voice calls. Built for Bangladesh eCommerce merchants.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="bn">
      <body>{children}</body>
    </html>
  );
}
