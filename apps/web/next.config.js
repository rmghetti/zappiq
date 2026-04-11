/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: ['@zappiq/ui', '@zappiq/shared'],
  experimental: {
    optimizePackageImports: ['lucide-react'],
  },
};

module.exports = nextConfig;
