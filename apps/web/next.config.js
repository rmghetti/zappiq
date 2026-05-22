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
    // X-Frame-Options é DENY em tudo, EXCETO /tutoriais/* — esses HTMLs estáticos
    // (ex: tutorial-interativo.html) são embutidos via <iframe> no próprio
    // dashboard (mesma origem). SAMEORIGIN libera o nosso domínio a enquadrá-los e
    // segue bloqueando clickjacking de terceiros. As demais proteções são iguais.
    const baseSecurity = [
      { key: 'X-Content-Type-Options', value: 'nosniff' },
      { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
      { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
      {
        key: 'Strict-Transport-Security',
        value: 'max-age=63072000; includeSubDomains; preload',
      },
    ];
    return [
      {
        // Todas as rotas, menos /tutoriais/* → framing totalmente proibido.
        source: '/((?!tutoriais).*)',
        headers: [{ key: 'X-Frame-Options', value: 'DENY' }, ...baseSecurity],
      },
      {
        // Tutoriais estáticos embutidos no dashboard (mesma origem).
        source: '/tutoriais/:path*',
        headers: [{ key: 'X-Frame-Options', value: 'SAMEORIGIN' }, ...baseSecurity],
      },
    ];
  },

  // ── Redirects ──────────────────────────────────────────
  // /home foi rota interna usada durante o periodo prelaunch (LAUNCH_MODE=prelaunch)
  // pra preview da landing principal enquanto / mostrava PrelaunchPage. Pos-flip
  // pra LAUNCH_MODE=live (2026-05-05), /home ficou redundante com / e gerava
  // duplicate-content pra SEO. Redirect 308 (permanent + preserva metodo) consolida.
  async redirects() {
    return [
      {
        source: '/home',
        destination: '/',
        permanent: true,
      },
      // Post-PR #157 (2026-05-18): /register (signup V2 legado) foi deletado.
      // Leads vindos de e-mail/LinkedIn/blog antigos apontavam pra /register —
      // redirect 301 preserva SEO + reroteia pro /cadastro novo (V3.2+).
      {
        source: '/register',
        destination: '/cadastro',
        permanent: true,
      },
      {
        source: '/register/:path*',
        destination: '/cadastro',
        permanent: true,
      },
    ];
  },
};

module.exports = nextConfig;
