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
    ];
  },
};

module.exports = nextConfig;
