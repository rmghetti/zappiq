import type { Metadata } from 'next';
import { GeistSans } from 'geist/font/sans';
import { GeistMono } from 'geist/font/mono';
import './globals.css';
import '@/lib/sentry';
import { OrganizationJsonLd } from '@/components/seo/OrganizationJsonLd';
import { CookieBanner } from '@/components/shared/CookieBanner';
import { HashAuthRedirect } from '@/components/landing/HashAuthRedirect';

/* ═══════════════════════════════════════════════════════════════════
 * Design V4 · fontes Geist (substitui Inter + Plus Jakarta)
 * Geist cobre sans · Geist Mono cobre blocos de código / specs
 * ═══════════════════════════════════════════════════════════════════ */

export const metadata: Metadata = {
  metadataBase: new URL('https://zappiq.com.br'),
  title: {
    default: 'ZappIQ · IA que atende e vende no WhatsApp e Instagram',
    template: '%s · ZappIQ',
  },
  description: 'A Iza atende, vende e faz campanha no WhatsApp e Instagram. Você aprova, ela executa. Operação autônoma de atendimento e vendas, 14 dias grátis, sem setup fee.',
  keywords: 'agente de ia para whatsapp, ia que atende e vende no whatsapp, operação autônoma de atendimento e vendas, ia para whatsapp e instagram, crm no whatsapp, atendimento e vendas com ia, iza, zappiq',
  openGraph: {
    type: 'website',
    locale: 'pt_BR',
    url: 'https://zappiq.com.br',
    siteName: 'ZappIQ',
    title: 'ZappIQ · IA que atende e vende no WhatsApp e Instagram',
    description: 'A Iza atende, vende e faz campanha no WhatsApp e Instagram. Você aprova, ela executa. 14 dias grátis, sem setup fee.',
    images: [
      {
        url: '/og-default.png',
        width: 1200,
        height: 630,
        alt: 'ZappIQ',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'ZappIQ · IA que atende e vende no WhatsApp e Instagram',
    description: 'A Iza atende, vende e faz campanha no WhatsApp e Instagram. Você aprova, ela executa. 14 dias grátis, sem setup fee.',
    images: ['/og-default.png'],
  },
  alternates: {
    canonical: '/',
  },
  robots: {
    index: true,
    follow: true,
  },
  // Prova de posse do dominio no Google Search Console: pre-requisito do
  // "Branding status" na verificacao do app OAuth (Agendamento/Google
  // Calendar). Gera <meta name="google-site-verification" ...> no <head>.
  verification: {
    google: 'WzMgUiCQ5Ckri6phWDqBWKyELrFhCzXn9YGGlJ8NVDE',
  },
};

/* PLACEHOLDER: substituir URLs por domínio real */
const schemaOrg = {
  '@context': 'https://schema.org',
  '@type': 'Organization',
  name: 'ZappIQ',
  url: 'https://zappiq.com.br',
  logo: 'https://zappiq.com.br/logo-positivo.svg',
  description: 'Plataforma de operação autônoma de atendimento e vendas no WhatsApp e Instagram. A IA atende, vende e faz campanha; você aprova, ela executa. Para PMEs brasileiras.',
  foundingDate: '2025',
  address: {
    '@type': 'PostalAddress',
    addressCountry: 'BR',
  },
  sameAs: [],
};

const schemaSoftware = {
  '@context': 'https://schema.org',
  '@type': 'SoftwareApplication',
  name: 'ZappIQ',
  applicationCategory: 'BusinessApplication',
  operatingSystem: 'Web',
  offers: {
    '@type': 'AggregateOffer',
    lowPrice: '247',
    highPrice: '1497',
    priceCurrency: 'BRL',
    offerCount: 3,
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR" className="scroll-smooth">
      <head>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(schemaOrg) }}
        />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(schemaSoftware) }}
        />
      </head>
      <body className={`${GeistSans.variable} ${GeistMono.variable} font-sans antialiased bg-bg text-ink`}>
        <OrganizationJsonLd />
        <HashAuthRedirect />
        {children}
        <CookieBanner />
      </body>
    </html>
  );
}
