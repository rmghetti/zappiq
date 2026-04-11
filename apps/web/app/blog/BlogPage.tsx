'use client';

import { useState, useMemo } from 'react';
import Link from 'next/link';
import { Search, Clock, ArrowRight, TrendingUp } from 'lucide-react';
import { PublicLayout } from '../../components/landing/PublicLayout';
import { articles, categories, getTopArticles } from './blogData';

export default function BlogPage() {
  const [search, setSearch] = useState('');
  const [activeCategory, setActiveCategory] = useState<string>('Todos');

  const filteredArticles = useMemo(() => {
    return articles.filter((article) => {
      const matchesSearch = article.title
        .toLowerCase()
        .includes(search.toLowerCase());
      const matchesCategory =
        activeCategory === 'Todos' || article.category === activeCategory;
      return matchesSearch && matchesCategory;
    });
  }, [search, activeCategory]);

  const topArticles = getTopArticles(3);

  return (
    <PublicLayout>
      <section className="bg-gradient-to-br from-primary-500 to-primary-700 py-16 -mt-32 pt-44">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 text-center">
          <h1 className="font-display text-4xl font-bold text-white sm:text-5xl">
            Blog ZappIQ
          </h1>
          <p className="mt-4 text-lg text-white/80 max-w-2xl mx-auto">
            Insights sobre Automação WhatsApp, Vendas e Gestão para PMEs
          </p>

          {/* Search */}
          <div className="mt-8 max-w-xl mx-auto relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
            <input
              type="text"
              placeholder="Buscar artigos..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full rounded-full border-0 bg-white py-3 pl-12 pr-4 text-gray-900 shadow-lg placeholder:text-gray-400 focus:ring-2 focus:ring-secondary-500 font-sans"
            />
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-12">
        {/* Category pills */}
        <div className="flex flex-wrap gap-2 mb-10">
          {categories.map((cat) => (
            <button
              key={cat}
              onClick={() => setActiveCategory(cat)}
              className={`rounded-full px-5 py-2 text-sm font-medium transition-colors ${
                activeCategory === cat
                  ? 'bg-primary-500 text-white shadow-md'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>

        <div className="lg:grid lg:grid-cols-3 lg:gap-12">
          {/* Article grid */}
          <div className="lg:col-span-2">
            {filteredArticles.length === 0 && (
              <p className="text-gray-500 text-center py-12 font-sans">
                Nenhum artigo encontrado para sua busca.
              </p>
            )}

            <div className="grid gap-8 sm:grid-cols-2">
              {filteredArticles.map((article) => (
                <Link
                  key={article.slug}
                  href={`/blog/${article.slug}`}
                  className="group block rounded-2xl border border-gray-200 bg-white overflow-hidden shadow-sm hover:shadow-lg transition-shadow"
                >
                  {/* PLACEHOLDER: substituir por imagem real */}
                  <div className="h-48 bg-gradient-to-br from-primary-500/20 to-secondary-500/20 flex items-center justify-center">
                    <span className="text-4xl font-display font-bold text-primary-500/30">
                      ZappIQ
                    </span>
                  </div>

                  <div className="p-5">
                    <div className="flex items-center gap-3 text-xs text-gray-500 mb-2">
                      <span className="rounded-full bg-primary-50 px-3 py-1 font-medium text-primary-700">
                        {article.category}
                      </span>
                      <span>{article.date}</span>
                      <span className="flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        {article.readingTime}
                      </span>
                    </div>

                    <h2 className="font-display text-lg font-semibold text-gray-900 group-hover:text-primary-600 transition-colors line-clamp-2">
                      {article.title}
                    </h2>

                    <p className="mt-2 text-sm text-gray-500 line-clamp-2 font-sans">
                      {article.excerpt}
                    </p>
                  </div>
                </Link>
              ))}
            </div>
          </div>

          {/* Sidebar */}
          <aside className="mt-12 lg:mt-0 space-y-8">
            {/* Top articles */}
            <div className="rounded-2xl border border-gray-200 bg-white p-6">
              <h3 className="font-display text-lg font-semibold text-gray-900 flex items-center gap-2 mb-4">
                <TrendingUp className="h-5 w-5 text-primary-500" />
                Artigos mais lidos
              </h3>
              <ul className="space-y-4">
                {topArticles.map((article, idx) => (
                  <li key={article.slug}>
                    <Link
                      href={`/blog/${article.slug}`}
                      className="group flex gap-3"
                    >
                      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary-50 text-sm font-bold text-primary-600">
                        {idx + 1}
                      </span>
                      <div>
                        <p className="text-sm font-medium text-gray-900 group-hover:text-primary-600 transition-colors line-clamp-2">
                          {article.title}
                        </p>
                        <p className="text-xs text-gray-400 mt-1">
                          {article.readingTime}
                        </p>
                      </div>
                    </Link>
                  </li>
                ))}
              </ul>
            </div>

            {/* CTA banner */}
            <div className="rounded-2xl bg-gradient-to-br from-primary-500 to-secondary-500 p-6 text-white">
              <h3 className="font-display text-xl font-bold">
                Teste grátis 14 dias
              </h3>
              <p className="mt-2 text-sm text-white/80 font-sans">
                Automatize seu WhatsApp com IA e comece a vender mais hoje mesmo.
                Sem cartão de crédito.
              </p>
              <Link
                href="/register"
                className="mt-4 inline-flex items-center gap-2 rounded-full bg-white px-5 py-2.5 text-sm font-semibold text-primary-600 hover:bg-gray-50 transition-colors"
              >
                Começar agora
                <ArrowRight className="h-4 w-4" />
              </Link>
            </div>
          </aside>
        </div>
      </section>
    </PublicLayout>
  );
}
