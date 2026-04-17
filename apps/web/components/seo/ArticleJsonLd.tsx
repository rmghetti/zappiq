'use client';

interface ArticleJsonLdProps {
  title: string;
  description: string;
  datePublished: string;
  author: string;
  imageUrl?: string;
  articleUrl?: string;
}

export function ArticleJsonLd({
  title,
  description,
  datePublished,
  author,
  imageUrl = 'https://zappiq.com.br/og-default.png',
  articleUrl = 'https://zappiq.com.br/blog',
}: ArticleJsonLdProps) {
  const articleSchema = {
    '@context': 'https://schema.org',
    '@type': 'BlogPosting',
    headline: title,
    description: description,
    image: imageUrl,
    datePublished: datePublished,
    dateModified: datePublished,
    author: {
      '@type': 'Person',
      name: author,
    },
    publisher: {
      '@type': 'Organization',
      name: 'ZappIQ',
      logo: {
        '@type': 'ImageObject',
        url: 'https://zappiq.com.br/logo-positivo.svg',
      },
    },
    url: articleUrl,
  };

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(articleSchema) }}
      suppressHydrationWarning
    />
  );
}
