/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
  images: { unoptimized: true },
  async rewrites() {
    return [
      {
        source: '/downloads/maskara-woocommerce.zip',
        destination: '/api/download/woocommerce-plugin',
      },
      {
        source: '/downloads/maskara-woocommerce-update.json',
        destination: '/api/download/woocommerce-update',
      },
    ];
  },
  async headers() {
    return [
      {
        source: '/downloads/maskara-woocommerce-update.json',
        headers: [
          { key: 'Cache-Control', value: 'no-store, no-cache, must-revalidate, max-age=0' },
        ],
      },
      {
        source: '/downloads/maskara-woocommerce.zip',
        headers: [
          { key: 'Cache-Control', value: 'public, max-age=300' },
        ],
      },
    ];
  },
};

module.exports = nextConfig;
