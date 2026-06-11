'use client';

/* ══════════════════════════════════════════════════════════════════════════
 * BlogPage — índice do blog (V2 · redesign 11/06/2026)
 * --------------------------------------------------------------------------
 * V2: hero escuro com aurora (emerald+violet), busca glass moderna, artigo
 * em destaque (primeiro do array) em card largo, grid com capas temáticas
 * (BlogCover) no lugar do placeholder verde "ZappIQ", sidebar mantida.
 * V1: hero verde simples + cards com placeholder.
 * ══════════════════════════════════════════════════════════════════════════ */

import { useState, useMemo } from 'react';
import Link from 'next/link';
import { Search, Clock, ArrowRight, TrendingUp, Sparkles } from 'lucide-react';
import { PublicLayout } from '../../components/landing/PublicLayout';
import { articles, categories, getTopArticles } from './blogData';
import { BlogCover } from './BlogCover';

function formatDate(iso: string) {
  const [y, m, d] = iso.split('-').map(Number);
  const months = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];
  return `${d} ${months[(m || 1) - 1]} ${y}`;
}

export default function BlogPage() {
  const [search, setSearch] = useState('');
  const [activeCategory, setActiveCategory] = useState<string>('Todos');

  const filteredArticles = useMemo(() => {
    return articles.filter((article) => {
      const matchesSearch = (article.title + ' ' + article.excerpt)
        .toLowerCase()
        .includes(search.toLowerCase());
      const matchesCategory =
        activeCategory === 'Todos' || article.category === activeCategory;
      return matchesSearch && matchesCategory;
    });
  }, [search, activeCategory]);

  const topArticles = getTopArticles(3);
  const isDefaultView = search === '' && activeCategory === 'Todos';
  const featured = isDefaultView && filteredArticles.length > 0 ? filteredArticles[0] : null;
  const gridArticles = featured ? filteredArticles.slice(1) : filteredArticles;

  return (
    <PublicLayout>
      {/* ── HERO ─────────────────────────────────────────────────────────── */}
      <section className="relative overflow-hidden -mt-32 pt-44 pb-20 bg-[#0B1426]">
        <div
          className="pointer-events-none absolute inset-0"
          style={{
            background:
              'radial-gradient(55% 65% at 20% 15%, rgba(47,181,122,.22), transparent 70%), radial-gradient(50% 60% at 85% 30%, rgba(124,58,237,.25), transparent 70%)',
          }}
        />
        <div
          className="pointer-events-none absolute inset-0 opacity-[0.35]"
          style={{
            backgroundImage:
              'linear-gradient(rgba(255,255,255,.045) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,.045) 1px, transparent 1px)',
            backgroundSize: '44px 44px',
            maskImage: 'radial-gradient(70% 70% at 50% 30%, black, transparent)',
            WebkitMaskImage: 'radial-gradient(70% 70% at 50% 30%, black, transparent)',
          }}
        />
        <div className="zappiq-wrap relative text-center">
          <span className="inline-flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-[0.14em] border border-emerald-400/50 bg-emerald-400/10 text-emerald-300 px-3.5 py-1.5 rounded-full">
            <Sparkles size={12} /> Blog ZappIQ
          </span>
          <h1 className="mt-5 text-4xl sm:text-5xl lg:text-[56px] font-bold leading-[1.08] text-white max-w-3xl mx-auto">
            Quem vende por conversa,{' '}
            <span className="bg-clip-text text-transparent bg-gradient-to-r from-emerald-300 via-emerald-400 to-violet-400">
              lê antes da concorrência.
            </span>
          </h1>
          <p className="mt-4 text-lg text-white/60 max-w-2xl mx-auto">
            Automação no WhatsApp e Instagram, agentes de IA, vendas e gestão — direto da
            operação, para PMEs brasileiras.
          </p>

          {/* Busca glass */}
          <div className="mt-9 max-w-xl mx-auto relative group">
            <div className="absolute -inset-[1.5px] rounded-full bg-gradient-to-r from-emerald-400/60 via-white/20 to-violet-500/60 opacity-70 group-focus-within:opacity-100 transition-opacity" />
            <div className="relative flex items-center rounded-full bg-white/[0.08] backdrop-blur-xl border border-white/10">
              <Search className="ml-5 h-5 w-5 text-white/50 shrink-0" />
              <input
                type="text"
                placeholder="Buscar artigos — ex.: Meta, carrinho abandonado, ROI..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full bg-transparent border-0 py-4 px-4 text-white placeholder:text-white/40 focus:ring-0 focus:outline-none text-[15px]"
              />
            </div>
          </div>

          {/* Category pills no hero */}
          <div className="mt-7 flex flex-wrap justify-center gap-2">
            {categories.map((cat) => (
              <button
                key={cat}
                onClick={() => setActiveCategory(cat)}
                className={`rounded-full px-5 py-2 text-[13px] font-semibold transition-all ${
                  activeCategory === cat
                    ? 'bg-emerald-400 text-[#0B1426] shadow-[0_8px_20px_-6px_rgba(47,181,122,.6)]'
                    : 'bg-white/[0.07] text-white/65 border border-white/10 hover:bg-white/[0.14] hover:text-white'
                }`}
              >
                {cat}
              </button>
            ))}
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-14">
        {/* ── DESTAQUE ───────────────────────────────────────────────────── */}
        {featured && (
          <Link
            href={`/blog/${featured.slug}`}
            className="group block rounded-[24px] border border-line bg-white overflow-hidden shadow-sm hover:shadow-[0_24px_50px_-20px_rgba(17,17,17,0.25)] hover:-translate-y-1 transition-all mb-12"
          >
            <div className="grid lg:grid-cols-2">
              <BlogCover theme={featured.coverTheme} variant="featured" className="h-64 lg:h-auto lg:min-h-[340px]" />
              <div className="p-8 lg:p-10 flex flex-col justify-center">
                <div className="flex items-center gap-3 text-xs text-muted mb-3">
                  <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 border border-emerald-200 px-3 py-1 font-bold text-emerald-700 uppercase tracking-wide text-[10px]">
                    <Sparkles size={10} /> Destaque
                  </span>
                  <span className="rounded-full bg-bg-soft px-3 py-1 font-medium">{featured.category}</span>
                  <span>{formatDate(featured.date)}</span>
                </div>
                <h2 className="text-2xl lg:text-[28px] font-bold leading-snug text-ink group-hover:text-emerald-700 transition-colors">
                  {featured.title}
                </h2>
                <p className="mt-3 text-[15px] text-muted leading-relaxed line-clamp-3">
                  {featured.excerpt}
                </p>
                <div className="mt-5 flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <span className="flex h-9 w-9 items-center justify-center rounded-full bg-grad text-white font-bold text-xs">
                      {featured.author.initials}
                    </span>
                    <div className="text-[13px]">
                      <p className="font-semibold text-ink leading-tight">{featured.author.name}</p>
                      <p className="text-muted-2 flex items-center gap-1">
                        <Clock size={11} /> {featured.readingTime}
                      </p>
                    </div>
                  </div>
                  <span className="inline-flex items-center gap-1.5 text-[14px] font-bold text-emerald-600">
                    Ler artigo <ArrowRight size={15} className="transition-transform group-hover:translate-x-1" />
                  </span>
                </div>
              </div>
            </div>
          </Link>
        )}

        <div className="lg:grid lg:grid-cols-3 lg:gap-12">
          {/* ── GRID ─────────────────────────────────────────────────────── */}
          <div className="lg:col-span-2">
            {filteredArticles.length === 0 && (
              <div className="text-center py-16">
                <p className="text-muted">Nenhum artigo encontrado para sua busca.</p>
                <button
                  onClick={() => {
                    setSearch('');
                    setActiveCategory('Todos');
                  }}
                  className="mt-3 text-emerald-600 font-semibold text-sm hover:underline"
                >
                  Limpar filtros
                </button>
              </div>
            )}

            <div className="grid gap-7 sm:grid-cols-2">
              {gridArticles.map((article) => (
                <Link
                  key={article.slug}
                  href={`/blog/${article.slug}`}
                  className="group flex flex-col rounded-[20px] border border-line bg-white overflow-hidden shadow-sm hover:shadow-[0_20px_40px_-18px_rgba(17,17,17,0.22)] hover:-translate-y-1 transition-all"
                >
                  <BlogCover theme={article.coverTheme} variant="card" className="h-44" />
                  <div className="p-5 flex flex-col flex-1">
                    <div className="flex items-center gap-2.5 text-[11px] text-muted-2 mb-2.5">
                      <span className="rounded-full bg-bg-soft px-2.5 py-1 font-semibold text-muted">
                        {article.category}
                      </span>
                      <span>{formatDate(article.date)}</span>
                      <span className="flex items-center gap-1">
                        <Clock size={11} />
                        {article.readingTime}
                      </span>
                    </div>
                    <h2 className="text-[16.5px] font-bold leading-snug text-ink group-hover:text-emerald-700 transition-colors line-clamp-2">
                      {article.title}
                    </h2>
                    <p className="mt-2 text-[13.5px] text-muted leading-relaxed line-clamp-2 flex-1">
                      {article.excerpt}
                    </p>
                    <div className="mt-4 pt-3 border-t border-line flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="flex h-7 w-7 items-center justify-center rounded-full bg-grad text-white font-bold text-[10px]">
                          {article.author.initials}
                        </span>
                        <span className="text-[12px] font-medium text-muted">{article.author.name}</span>
                      </div>
                      <ArrowRight size={14} className="text-emerald-500 transition-transform group-hover:translate-x-1" />
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          </div>

          {/* ── SIDEBAR ──────────────────────────────────────────────────── */}
          <aside className="mt-12 lg:mt-0 space-y-7">
            <div className="rounded-[20px] border border-line bg-white p-6">
              <h3 className="text-[16px] font-bold text-ink flex items-center gap-2 mb-5">
                <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-emerald-50">
                  <TrendingUp size={15} className="text-emerald-600" />
                </span>
                Mais lidos
              </h3>
              <ul className="space-y-4">
                {topArticles.map((article, idx) => (
                  <li key={article.slug}>
                    <Link href={`/blog/${article.slug}`} className="group flex gap-3">
                      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-bg-soft text-sm font-bold text-emerald-600 group-hover:bg-emerald-500 group-hover:text-white transition-colors">
                        {idx + 1}
                      </span>
                      <div>
                        <p className="text-[13.5px] font-semibold text-ink group-hover:text-emerald-700 transition-colors line-clamp-2 leading-snug">
                          {article.title}
                        </p>
                        <p className="text-[11.5px] text-muted-2 mt-1 flex items-center gap-1">
                          <Clock size={10} /> {article.readingTime}
                        </p>
                      </div>
                    </Link>
                  </li>
                ))}
              </ul>
            </div>

            {/* CTA banner */}
            <div className="relative overflow-hidden rounded-[20px] bg-[#0B1426] p-7 text-white">
              <div
                className="pointer-events-none absolute inset-0"
                style={{ background: 'radial-gradient(70% 70% at 80% 0%, rgba(47,181,122,.35), transparent 70%)' }}
              />
              <div className="relative">
                <h3 className="text-[19px] font-bold leading-snug">
                  Coloque a leitura em produção.
                </h3>
                <p className="mt-2 text-[13.5px] text-white/65 leading-relaxed">
                  Teste a ZappIQ por 14 dias, grátis. IA atendendo seu WhatsApp e Instagram —
                  sem cartão, sem setup fee.
                </p>
                <Link
                  href="/cadastro"
                  className="mt-5 inline-flex items-center gap-2 rounded-full bg-emerald-400 px-5 py-2.5 text-sm font-bold text-[#0B1426] hover:bg-emerald-300 transition-colors"
                >
                  Começar agora <ArrowRight size={15} />
                </Link>
              </div>
            </div>
          </aside>
        </div>
      </section>
    </PublicLayout>
  );
}
