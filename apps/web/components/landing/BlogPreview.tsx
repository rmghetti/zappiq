'use client';

/* ══════════════════════════════════════════════════════════════════════════
 * BlogPreview — Design V4 (Chatbase-style · Geist + gradient g→b→p)
 * --------------------------------------------------------------------------
 * 3 cards de blog em grid. Card minimalista: eyebrow de categoria, título,
 * resumo, reading time. Hover sutil (borda accent + leve lift).
 * ══════════════════════════════════════════════════════════════════════════ */

import Link from 'next/link';
import { ArrowRight, Clock } from 'lucide-react';

/* PLACEHOLDER: substituir por dados reais de artigos do blog */
const RECENT_ARTICLES = [
  {
    slug: 'como-recuperar-leads-perdidos-whatsapp',
    title: 'Como recuperar 60% dos leads perdidos no WhatsApp',
    excerpt:
      'Estratégias comprovadas para reengajar leads que pararam de responder e transformá-los em clientes.',
    category: 'Vendas',
    readingTime: '7 min',
  },
  {
    slug: 'guia-automacao-whatsapp-clinicas-2026',
    title: 'Guia completo de automação WhatsApp para clínicas em 2026',
    excerpt:
      'Tudo que você precisa saber para automatizar agendamentos, confirmações e atendimento na sua clínica.',
    category: 'Saúde',
    readingTime: '9 min',
  },
  {
    slug: 'roi-chatbots-ia-como-calcular',
    title: 'ROI de chatbots com IA: como calcular o retorno real',
    excerpt:
      'Fórmulas e métricas para mensurar o retorno sobre investimento da automação com IA no WhatsApp.',
    category: 'Gestão',
    readingTime: '6 min',
  },
];

export function BlogPreview() {
  return (
    <section className="py-20 lg:py-28 bg-bg">
      <div className="zappiq-wrap">
        <div className="flex items-end justify-between mb-10 gap-6 flex-wrap">
          <div>
            <span className="eyebrow">Blog · Recursos</span>
            <h2 className="text-[36px] lg:text-[44px] font-medium text-ink leading-[1.05] tracking-[-0.03em] mt-2">
              Conteúdo pra{' '}
              <span className="text-grad">escalar seu negócio.</span>
            </h2>
          </div>
          <Link
            href="/blog"
            className="hidden sm:inline-flex items-center gap-1 text-[13px] font-medium text-accent hover:underline"
          >
            Ver todos os artigos <ArrowRight size={13} />
          </Link>
        </div>

        <div className="grid md:grid-cols-3 gap-5 lg:gap-6">
          {RECENT_ARTICLES.map((article) => (
            <Link
              key={article.slug}
              href={`/blog/${article.slug}`}
              className="group card-soft bg-white overflow-hidden hover:border-accent/30 hover:shadow-[0_20px_40px_-20px_rgba(74,82,208,0.15)] transition-all flex flex-col"
            >
              {/* Capa com gradiente sutil */}
              <div
                className="h-36 flex items-center justify-center relative"
                style={{
                  background:
                    'linear-gradient(135deg, rgba(47,181,122,0.12) 0%, rgba(47,127,181,0.12) 45%, rgba(74,82,208,0.12) 100%)',
                }}
              >
                <div
                  className="w-14 h-14 rounded-[14px] flex items-center justify-center"
                  style={{
                    background:
                      'linear-gradient(135deg, #2FB57A 0%, #2F7FB5 45%, #4A52D0 100%)',
                    boxShadow: '0 8px 20px -8px rgba(74,82,208,0.45)',
                  }}
                >
                  <span className="text-white font-semibold text-[14px] tracking-tight">
                    {article.category.charAt(0)}
                  </span>
                </div>
              </div>

              <div className="p-6 flex flex-col flex-1">
                <div className="flex items-center gap-3 mb-3">
                  <span className="text-[10.5px] font-semibold text-accent uppercase tracking-[0.12em]">
                    {article.category}
                  </span>
                  <span className="text-[11.5px] text-muted flex items-center gap-1">
                    <Clock size={10} />
                    {article.readingTime}
                  </span>
                </div>
                <h3 className="text-[15.5px] font-medium text-ink mb-2 group-hover:text-accent transition-colors leading-snug tracking-tight">
                  {article.title}
                </h3>
                <p className="text-[13px] text-muted leading-relaxed line-clamp-2 flex-1">
                  {article.excerpt}
                </p>
                <span className="inline-flex items-center gap-1 text-[12.5px] font-medium text-accent mt-4 opacity-0 group-hover:opacity-100 transition-opacity">
                  Ler artigo <ArrowRight size={12} />
                </span>
              </div>
            </Link>
          ))}
        </div>

        <Link
          href="/blog"
          className="flex sm:hidden items-center justify-center gap-1 text-[13px] font-medium text-accent mt-6"
        >
          Ver todos os artigos <ArrowRight size={13} />
        </Link>
      </div>
    </section>
  );
}
