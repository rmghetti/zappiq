const path = require('path');

/** @type {import('next').NextConfig} */
const nextConfig = {
  // ── Output mode ────────────────────────────────────────
  // 'standalone' produces a self-contained .next/standalone folder with a
  // minimal node_modules subset, used by the Docker runner stage and by Fly.io.
  // Vercel ignores this setting (its build system handles output internally).
  output: 'standalone',

  // ── Monorepo packages compiled on the fly ──────────────
  transpilePackages: ['@zappiq/ui', '@zappiq/shared'],

  // ── React strictness in dev ────────────────────────────
  reactStrictMode: true,

  // ── Build/runtime options ──────────────────────────────
  poweredByHeader: false,
  compress: true,

  experimental: {
    optimizePackageImports: ['lucide-react'],
    // Tells Next where the monorepo root is so the standalone bundle
    // includes packages/* and the lockfile correctly.
    outputFileTracingRoot: path.join(__dirname, '../../'),
  },

  // ── Image optimization ─────────────────────────────────
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: '**.zappiq.com.br' },
      { protocol: 'https', hostname: '**.supabase.co' },
      { protocol: 'https', hostname: '**.r2.cloudflarestorage.com' },
    ],
  },

  // ── Security headers (apply to all routes) ─────────────
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
          {
            key: 'Strict-Transport-Security',
            value: 'max-age=63072000; includeSubDomains; preload',
          },
        ],
      },
    ];
  },
};

module.exports = nextConfig;
