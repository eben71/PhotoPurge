/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
  reactStrictMode: true,
  transpilePackages: ['@photoprune/shared'],
  experimental: {
    typedRoutes: true
  }
};

module.exports = nextConfig;
