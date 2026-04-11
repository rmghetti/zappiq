import type { Metadata } from 'next';
import { Inter, Plus_Jakarta_Sans } from 'next/font/google';
import './globals.css';

const inter = Inter({ subsets: ['latin'], variable: '--font-inter' });
const jakarta = Plus_Jakarta_Sans({ subsets: ['latin'], variable: '--font-jakarta' });

export const metadata: Metadata = {
  title: 'ZappIQ — Empresas que usam ZappIQ vendem 3x mais pelo WhatsApp',
  description: 'Plataforma de IA conversacional para PMEs brasileiras. Chatbot inteligente, CRM, campanhas e analytics em um só lugar. Automação WhatsApp Business com IA. 14 dias grátis.',
  keywords: 'automação whatsapp, chatbot ia, whatsapp business api, crm whatsapp, atendimento automatizado, pulse ai, zappiq',
  openGraph: {
    title: 'ZappIQ — Inteligência Conversacional para WhatsApp',
    description: 'Automatize atendimento, vendas e campanhas no WhatsApp com IA. +500 empresas já usam. 14 dias grátis.',
    type: 'website',
    locale: 'pt_BR',
    url: 'https://zappiq.com.br',
    siteName: 'ZappIQ',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'ZappIQ — Automação WhatsApp com IA',
    description: 'Automatize atendimento, vendas e campanhas no WhatsApp com IA. +500 empresas já usam.',
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
      <body className={`${inter.variable} ${jakarta.variable} font-sans`}>{children}</body>
    </html>
  );
}
