'use client';

/* ══════════════════════════════════════════════════════════════════════════
 * ArticlePage: página de artigo do blog (V2 · redesign 11/06/2026)
 * --------------------------------------------------------------------------
 * V2: hero escuro com capa temática (BlogCover) e título sobreposto no lugar
 * do placeholder "ZappIQ Blog"; corpo com tipografia própria `.article-body`
 * (o projeto NÃO usa @tailwindcss/typography, plugins: [], então as
 * classes `prose` da V1 nunca tiveram efeito: era essa a causa do texto
 * corrido). Estilos do corpo vivem em globals.css. Relacionados com capas.
 * ══════════════════════════════════════════════════════════════════════════ */

import Link from 'next/link';
import { ArrowLeft, Clock, ArrowRight, CalendarDays } from 'lucide-react';
import { PublicLayout } from '../../../components/landing/PublicLayout';
import { getArticleBySlug, getRelatedArticles } from '../blogData';
import { BlogCover } from '../BlogCover';

interface ArticlePageProps {
  slug: string;
}

function formatDate(iso: string) {
  const [y, m, d] = iso.split('-').map(Number);
  const months = [
    'janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho',
    'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro',
  ];
  return `${d} de ${months[(m || 1) - 1]} de ${y}`;
}

export default function ArticlePage({ slug }: ArticlePageProps) {
  const article = getArticleBySlug(slug);

  if (!article) {
    return null;
  }

  const relatedArticles = getRelatedArticles(article.relatedSlugs);

  return (
    <PublicLayout>
      {/* ── HERO com capa temática ───────────────────────────────────────── */}
      <div className="relative -mt-32">
        <BlogCover theme={article.coverTheme} variant="hero" className="h-[420px] lg:h-[460px]" />
        <div className="absolute inset-0 bg-gradient-to-t from-[#0B1426]/95 via-[#0B1426]/45 to-[#0B1426]/30" />
        <div className="absolute inset-x-0 bottom-0">
          <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8 pb-10 pt-24">
            <Link
              href="/blog"
              className="inline-flex items-center gap-2 text-[13px] font-medium text-white/70 hover:text-white transition-colors mb-5"
            >
              <ArrowLeft size={14} />
              Voltar para o Blog
            </Link>
            <div className="flex flex-wrap items-center gap-2.5 text-[12px] mb-4">
              <span className="rounded-full bg-emerald-400 px-3 py-1 font-bold text-[#0B1426] uppercase tracking-wide text-[10px]">
                {article.category}
              </span>
              <span className="flex items-center gap-1.5 text-white/70">
                <CalendarDays size={12} /> {formatDate(article.date)}
              </span>
              <span className="flex items-center gap-1.5 text-white/70">
                <Clock size={12} /> {article.readingTime} de leitura
              </span>
            </div>
            <h1 className="text-3xl sm:text-4xl lg:text-[44px] font-bold text-white leading-[1.15] max-w-3xl">
              {article.title}
            </h1>
            <div className="mt-6 flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-full bg-grad text-white font-bold text-sm ring-2 ring-white/20">
                {article.author.initials}
              </div>
              <div>
                <p className="text-[14px] font-semibold text-white leading-tight">{article.author.name}</p>
                <p className="text-[12px] text-white/60">Blog ZappIQ</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      <article className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8 py-12 lg:py-16">
        {/* Corpo do artigo: tipografia em globals.css (.article-body) */}
        <div
          className="article-body"
          dangerouslySetInnerHTML={{ __html: article.content }}
        />

        {/* CTA inline */}
        <div className="relative overflow-hidden mt-14 rounded-[22px] bg-[#0B1426] p-8 lg:p-10 text-center text-white">
          <div
            className="pointer-events-none absolute inset-0"
            style={{
              background:
                'radial-gradient(60% 80% at 20% 0%, rgba(47,181,122,.30), transparent 70%), radial-gradient(50% 70% at 90% 100%, rgba(124,58,237,.25), transparent 70%)',
            }}
          />
          <div className="relative">
            <h2 className="text-2xl lg:text-[26px] font-bold">
              Quer ver isso rodando no seu WhatsApp?
            </h2>
            <p className="mt-2.5 text-white/65 max-w-lg mx-auto text-[14.5px] leading-relaxed">
              Teste a ZappIQ gratuitamente por 14 dias. Sem cartão de crédito, sem setup fee,
              sem compromisso, sua IA no ar em minutos.
            </p>
            <Link
              href="/cadastro"
              className="mt-6 inline-flex items-center gap-2 rounded-full bg-emerald-400 px-7 py-3 text-sm font-bold text-[#0B1426] hover:bg-emerald-300 transition-colors"
            >
              Começar grátis
              <ArrowRight size={15} />
            </Link>
          </div>
        </div>
      </article>

      {/* ── Relacionados ─────────────────────────────────────────────────── */}
      {relatedArticles.length > 0 && (
        <section className="bg-bg-soft py-16">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <h2 className="text-2xl font-bold text-ink mb-8">Continue lendo</h2>

            <div className="grid gap-7 sm:grid-cols-2 lg:grid-cols-3">
              {relatedArticles.map((related) => (
                <Link
                  key={related.slug}
                  href={`/blog/${related.slug}`}
                  className="group flex flex-col rounded-[20px] border border-line bg-white overflow-hidden shadow-sm hover:shadow-[0_20px_40px_-18px_rgba(17,17,17,0.22)] hover:-translate-y-1 transition-all"
                >
                  <BlogCover theme={related.coverTheme} variant="card" className="h-40" />
                  <div className="p-5 flex flex-col flex-1">
                    <div className="flex items-center gap-2.5 text-[11px] text-muted-2 mb-2">
                      <span className="rounded-full bg-bg-soft px-2.5 py-1 font-semibold text-muted">
                        {related.category}
                      </span>
                      <span className="flex items-center gap-1">
                        <Clock size={11} />
                        {related.readingTime}
                      </span>
                    </div>
                    <h3 className="text-[15.5px] font-bold leading-snug text-ink group-hover:text-emerald-700 transition-colors line-clamp-2">
                      {related.title}
                    </h3>
                    <p className="mt-2 text-[13px] text-muted leading-relaxed line-clamp-2 flex-1">
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
