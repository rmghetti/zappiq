'use client';

import Link from 'next/link';
import { ArrowLeft, Clock, ArrowRight } from 'lucide-react';
import { PublicLayout } from '../../../components/landing/PublicLayout';
import { getArticleBySlug, getRelatedArticles } from '../blogData';

interface ArticlePageProps {
  slug: string;
}

export default function ArticlePage({ slug }: ArticlePageProps) {
  const article = getArticleBySlug(slug);

  if (!article) {
    return null;
  }

  const relatedArticles = getRelatedArticles(article.relatedSlugs);

  return (
    <PublicLayout>
      {/* Hero image placeholder */}
      {/* PLACEHOLDER: substituir por imagem real do artigo */}
      <div className="-mt-32 h-[400px] bg-gradient-to-br from-primary-500/30 to-secondary-500/30 flex items-center justify-center">
        <span className="text-6xl font-display font-bold text-primary-500/20">
          ZappIQ Blog
        </span>
      </div>

      <article className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8 py-12">
        {/* Breadcrumb */}
        <Link
          href="/blog"
          className="inline-flex items-center gap-2 text-sm text-gray-500 hover:text-primary-600 transition-colors mb-6"
        >
          <ArrowLeft className="h-4 w-4" />
          Voltar para o Blog
        </Link>

        {/* Category & meta */}
        <div className="flex flex-wrap items-center gap-3 text-sm text-gray-500 mb-4">
          <span className="rounded-full bg-primary-50 px-3 py-1 font-medium text-primary-700">
            {article.category}
          </span>
          <span>{article.date}</span>
          <span className="flex items-center gap-1">
            <Clock className="h-4 w-4" />
            {article.readingTime}
          </span>
        </div>

        {/* Title */}
        <h1 className="font-display text-3xl font-bold text-gray-900 sm:text-4xl lg:text-5xl leading-tight">
          {article.title}
        </h1>

        {/* Author */}
        <div className="mt-6 flex items-center gap-3 border-b border-gray-200 pb-8">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary-500 text-white font-bold text-sm">
            {article.author.initials}
          </div>
          <div>
            <p className="text-sm font-medium text-gray-900">
              {article.author.name}
            </p>
            <p className="text-xs text-gray-500">Publicado em {article.date}</p>
          </div>
        </div>

        {/* Article body */}
        <div
          className="prose prose-lg prose-gray max-w-none mt-8 font-sans
            prose-headings:font-display prose-headings:text-gray-900
            prose-h2:text-2xl prose-h2:mt-10 prose-h2:mb-4
            prose-h3:text-xl prose-h3:mt-8 prose-h3:mb-3
            prose-p:text-gray-600 prose-p:leading-relaxed
            prose-li:text-gray-600
            prose-strong:text-gray-900
            prose-a:text-primary-600 prose-a:no-underline hover:prose-a:underline"
          dangerouslySetInnerHTML={{ __html: article.content }}
        />

        {/* Inline CTA */}
        <div className="mt-12 rounded-2xl bg-gradient-to-r from-primary-500 to-secondary-500 p-8 text-center text-white">
          <h2 className="font-display text-2xl font-bold">
            Quer automatizar seu WhatsApp?
          </h2>
          <p className="mt-2 text-white/80 font-sans max-w-lg mx-auto">
            Teste o ZappIQ gratuitamente por 14 dias. Sem cartão de crédito, sem
            compromisso.
          </p>
          <Link
            href="/register"
            className="mt-6 inline-flex items-center gap-2 rounded-full bg-white px-6 py-3 text-sm font-semibold text-primary-600 hover:bg-gray-50 transition-colors"
          >
            Comece grátis
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </article>

      {/* Related articles */}
      {relatedArticles.length > 0 && (
        <section className="bg-gray-50 py-16">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <h2 className="font-display text-2xl font-bold text-gray-900 mb-8">
              Artigos Relacionados
            </h2>

            <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-3">
              {relatedArticles.map((related) => (
                <Link
                  key={related.slug}
                  href={`/blog/${related.slug}`}
                  className="group block rounded-2xl border border-gray-200 bg-white overflow-hidden shadow-sm hover:shadow-lg transition-shadow"
                >
                  {/* PLACEHOLDER: substituir por imagem real */}
                  <div className="h-40 bg-gradient-to-br from-primary-500/20 to-secondary-500/20 flex items-center justify-center">
                    <span className="text-3xl font-display font-bold text-primary-500/30">
                      ZappIQ
                    </span>
                  </div>

                  <div className="p-5">
                    <div className="flex items-center gap-3 text-xs text-gray-500 mb-2">
                      <span className="rounded-full bg-primary-50 px-3 py-1 font-medium text-primary-700">
                        {related.category}
                      </span>
                      <span className="flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        {related.readingTime}
                      </span>
                    </div>

                    <h3 className="font-display text-base font-semibold text-gray-900 group-hover:text-primary-600 transition-colors line-clamp-2">
                      {related.title}
                    </h3>

                    <p className="mt-2 text-sm text-gray-500 line-clamp-2 font-sans">
                      {related.excerpt}
                    </p>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        </section>
      )}
    </PublicLayout>
  );
}
