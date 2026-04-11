'use client';

import Link from 'next/link';
import { ArrowRight, Clock } from 'lucide-react';

/* PLACEHOLDER: substituir por dados reais de artigos do blog */
const RECENT_ARTICLES = [
  {
    slug: 'como-recuperar-leads-perdidos-whatsapp',
    title: 'Como recuperar 60% dos leads perdidos no WhatsApp',
    excerpt: 'Estratégias comprovadas para reengajar leads que pararam de responder e transformá-los em clientes.',
    category: 'Vendas',
    readingTime: '7 min',
  },
  {
    slug: 'guia-automacao-whatsapp-clinicas-2026',
    title: 'Guia completo de automação WhatsApp para clínicas em 2026',
    excerpt: 'Tudo que você precisa saber para automatizar agendamentos, confirmações e atendimento na sua clínica.',
    category: 'Saúde',
    readingTime: '9 min',
  },
  {
    slug: 'roi-chatbots-ia-como-calcular',
    title: 'ROI de chatbots com IA: como calcular o retorno real',
    excerpt: 'Fórmulas e métricas para mensurar o retorno sobre investimento da automação com IA no WhatsApp.',
    category: 'Gestão',
    readingTime: '6 min',
  },
];

export function BlogPreview() {
  return (
    <section className="py-20 lg:py-28 bg-white">
      <div className="max-w-7xl mx-auto px-6">
        <div className="flex items-end justify-between mb-10">
          <div>
            <p className="text-sm font-semibold text-primary-600 uppercase tracking-wider mb-3">Blog & Recursos</p>
            <h2 className="font-display text-3xl lg:text-4xl font-extrabold text-gray-900">Conteúdo para escalar seu negócio</h2>
          </div>
          <Link href="/blog" className="hidden sm:flex items-center gap-1 text-sm font-medium text-primary-600 hover:text-primary-700 transition-colors">
            Ver todos os artigos <ArrowRight size={14} />
          </Link>
        </div>

        <div className="grid md:grid-cols-3 gap-6">
          {RECENT_ARTICLES.map((article) => (
            <Link
              key={article.slug}
              href={`/blog/${article.slug}`}
              className="group bg-white rounded-2xl border border-gray-200 overflow-hidden hover:shadow-lg transition-shadow"
            >
              {/* Image placeholder */}
              <div className="h-40 bg-gradient-to-br from-primary-100 to-secondary-100 flex items-center justify-center">
                {/* PLACEHOLDER: substituir por imagem real */}
                <span className="text-4xl opacity-30">📝</span>
              </div>
              <div className="p-6">
                <div className="flex items-center gap-3 mb-3">
                  <span className="text-xs font-semibold text-primary-600 bg-primary-50 px-2.5 py-1 rounded-full">{article.category}</span>
                  <span className="text-xs text-gray-400 flex items-center gap-1"><Clock size={10} />{article.readingTime}</span>
                </div>
                <h3 className="font-display text-base font-bold text-gray-900 mb-2 group-hover:text-primary-600 transition-colors leading-tight">{article.title}</h3>
                <p className="text-sm text-gray-500 leading-relaxed line-clamp-2">{article.excerpt}</p>
              </div>
            </Link>
          ))}
        </div>

        <Link href="/blog" className="flex sm:hidden items-center justify-center gap-1 text-sm font-medium text-primary-600 mt-6">
          Ver todos os artigos <ArrowRight size={14} />
        </Link>
      </div>
    </section>
  );
}
