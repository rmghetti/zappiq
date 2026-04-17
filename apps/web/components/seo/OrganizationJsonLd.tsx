'use client';

export function OrganizationJsonLd() {
  const organizationSchema = {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    name: 'ZappIQ',
    url: 'https://zappiq.com.br',
    logo: 'https://zappiq.com.br/logo-positivo.svg',
    description:
      'Plataforma SaaS de IA conversacional para WhatsApp Business. Automação de atendimento, vendas e campanhas para PMEs brasileiras.',
    foundingDate: '2026',
    foundingLocation: {
      '@type': 'Place',
      name: 'São Paulo, Brasil',
    },
    address: {
      '@type': 'PostalAddress',
      addressCountry: 'BR',
      addressLocality: 'São Paulo',
    },
    sameAs: [
      'https://www.linkedin.com/company/zappiq',
      'https://twitter.com/zappiq',
    ],
    contactPoint: {
      '@type': 'ContactPoint',
      contactType: 'Customer Service',
      email: 'founders@zappiq.com.br',
      availableLanguage: 'pt-BR',
    },
  };

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(organizationSchema) }}
      suppressHydrationWarning
    />
  );
}
