'use client';

export function SoftwareApplicationJsonLd() {
  const softwareSchema = {
    '@context': 'https://schema.org',
    '@type': 'SoftwareApplication',
    name: 'ZappIQ',
    applicationCategory: 'BusinessApplication',
    operatingSystem: 'Web',
    url: 'https://zappiq.com.br',
    description: 'Plataforma de IA conversacional para WhatsApp Business sem setup fee.',
    offers: [
      {
        '@type': 'Offer',
        name: 'Starter',
        price: '247',
        priceCurrency: 'BRL',
        description: 'Plano inicial para pequenos negócios',
      },
      {
        '@type': 'Offer',
        name: 'Growth',
        price: '597',
        priceCurrency: 'BRL',
        description: 'Plano para crescimento acelerado',
      },
      {
        '@type': 'Offer',
        name: 'Professional',
        price: '1247',
        priceCurrency: 'BRL',
        description: 'Plano para agências e integradores',
      },
      {
        '@type': 'Offer',
        name: 'Enterprise',
        price: 'Upon Request',
        priceCurrency: 'BRL',
        description: 'Solução customizada para grandes empresas',
      },
      {
        '@type': 'Offer',
        name: 'Trial',
        price: '0',
        priceCurrency: 'BRL',
        description: '14 dias de trial grátis com até US$ 15 em crédito de LLM',
      },
    ],
    // Comentado até ter reviews reais
    // aggregateRating: {
    //   '@type': 'AggregateRating',
    //   ratingValue: '4.8',
    //   ratingCount: '500',
    //   bestRating: '5',
    // },
  };

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(softwareSchema) }}
      suppressHydrationWarning
    />
  );
}
