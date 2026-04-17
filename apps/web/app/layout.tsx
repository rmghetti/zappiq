import type { Metadata } from 'next';
import { Inter, Plus_Jakarta_Sans } from 'next/font/google';
import './globals.css';
import '@/lib/sentry';
import { OrganizationJsonLd } from '@/components/seo/OrganizationJsonLd';
import { CookieBanner } from '@/components/shared/CookieBanner';

const inter = Inter({ subsets: ['latin'], variable: '--font-inter' });
const jakarta = Plus_Jakarta_Sans({ subsets: ['latin'], variable: '--font-jakarta' });

export const metadata: Metadata = {
  metadataBase: new URL('https://zappiq.com.br'),
  title: {
    default: 'ZappIQ · IA para WhatsApp sem setup fee',
    template: '%s · ZappIQ',
  },
  description: 'Você treina sua IA sozinho, sem consultor, sem setup fee. 14 dias grátis para testar ZappIQ, plataforma de IA conversacional para WhatsApp Business.',
  keywords: 'automação whatsapp, chatbot ia, whatsapp business api, crm whatsapp, atendimento automatizado, pulse ai, zappiq',
  openGraph: {
    type: 'website',
    locale: 'pt_BR',
    url: 'https://zappiq.com.br',
    siteName: 'ZappIQ',
    title: 'ZappIQ · IA para WhatsApp sem setup fee',
    description: 'Você treina sua IA sozinho, sem consultor, sem setup fee. 14 dias grátis para testar ZappIQ.',
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
    title: 'ZappIQ · IA para WhatsApp sem setup fee',
    description: 'Você treina sua IA sozinho, sem consultor, sem setup fee. 14 dias grátis para testar ZappIQ.',
    images: ['/og-default.png'],
  },
  alternates: {
    canonical: '/',
  },
  robots: {
    index: true,
    follow: true,
  },
};

/* PLACEHOLDER: substituir URLs por domínio real */
const schemaOrg = {
  '@context': 'https://schema.org',
  '@type': 'Organization',
  name: 'ZappIQ',
  url: 'https://zappiq.com.br',
  logo: 'https://zappiq.com.br/logo-positivo.svg',
  description: 'Plataforma SaaS de IA conversacional para WhatsApp Business. Automação de atendimento, vendas e campanhas para PMEs brasileiras.',
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
    lowPrice: '297',
    highPrice: '997',
    priceCurrency: 'BRL',
    offerCount: 3,
  },
  aggregateRating: {
    '@type': 'AggregateRating',
    ratingValue: '4.8',
    ratingCount: '500',
    bestRating: '5',
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
      <body className={`${inter.variable} ${jakarta.variable} font-sans`}>
        <OrganizationJsonLd />
        {children}
        <CookieBanner />
      </body>
    </html>
  );
}
