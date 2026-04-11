import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { articles, getArticleBySlug } from '../blogData';
import ArticlePage from './ArticlePage';

interface PageProps {
  params: Promise<{ slug: string }>;
}

export async function generateStaticParams() {
  return articles.map((article) => ({
    slug: article.slug,
  }));
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const article = getArticleBySlug(slug);

  if (!article) {
    return { title: 'Artigo não encontrado — Blog ZappIQ' };
  }

  return {
    title: `${article.title} — Blog ZappIQ`,
    description: article.excerpt,
    openGraph: {
      title: article.title,
      description: article.excerpt,
      type: 'article',
      locale: 'pt_BR',
      publishedTime: article.date,
      authors: [article.author.name],
      /* PLACEHOLDER: substituir por URL e imagem reais */
      url: `https://zappiq.com.br/blog/${article.slug}`,
    },
    other: {
      'article:published_time': article.date,
      'article:author': article.author.name,
      'article:section': article.category,
    },
  };
}

export default async function BlogArticlePage({ params }: PageProps) {
  const { slug } = await params;
  const article = getArticleBySlug(slug);

  if (!article) {
    notFound();
  }

  /* JSON-LD structured data (Article schema) */
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: article.title,
    description: article.excerpt,
    datePublished: article.date,
    author: {
      '@type': 'Person',
      name: article.author.name,
    },
    publisher: {
      '@type': 'Organization',
      name: 'ZappIQ',
      /* PLACEHOLDER: substituir por logo real */
      logo: {
        '@type': 'ImageObject',
        url: 'https://zappiq.com.br/logo.png',
      },
    },
    /* PLACEHOLDER: substituir por URL e imagem reais */
    mainEntityOfPage: `https://zappiq.com.br/blog/${article.slug}`,
    image: `https://zappiq.com.br/blog/${article.slug}/og.png`,
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <ArticlePage slug={slug} />
    </>
  );
}
