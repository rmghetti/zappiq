'use client';

import Link from 'next/link';
import { ArrowRight, Star, ChevronRight, Clock, Users, FileX, Phone, Calendar, Brain, BarChart3, MessageCircle, ShoppingCart, TrendingDown, Eye, Megaphone, Briefcase, UserX, FileSearch, Workflow, GraduationCap, CreditCard, Sparkles, Upload, FileText, MessageSquare, CheckCircle2 } from 'lucide-react';
import { PublicLayout } from './PublicLayout';
import type { LucideIcon } from 'lucide-react';

const ICON_MAP: Record<string, LucideIcon> = {
  Clock, Users, FileX, Phone, Calendar, Brain, BarChart3, MessageCircle,
  ShoppingCart, TrendingDown, Eye, Megaphone, Briefcase, UserX, FileSearch,
  Workflow, GraduationCap, CreditCard,
};

export interface SegmentPain {
  icon: string;
  title: string;
  desc: string;
}

export interface SegmentSolution {
  icon: string;
  title: string;
  desc: string;
}

export interface SegmentTestimonial {
  name: string;
  role: string;
  company: string;
  initials: string;
  text: string;
}

/** Exemplos concretos de material que o cliente do segmento pode subir
 *  no self-service de treinamento da IA. Mantém a narrativa
 *  "você treina sua IA sozinho" contextual por vertical. */
export interface SegmentTrainingExample {
  /** Tipo do material — ex: "Tabela de preços", "Protocolo clínico". */
  label: string;
  /** Formato aceito — ex: "PDF · XLSX · URL". */
  format: string;
  /** O que a IA vai passar a responder com esse material. */
  outcome: string;
}

export interface SegmentPageData {
  slug: string;
  name: string;
  businessType: string;
  heroTitle: string;
  heroSubtitle: string;
  pains: SegmentPain[];
  solutions: SegmentSolution[];
  testimonial: SegmentTestimonial;
  /** Exemplos de material self-service — se omitido, a seção não aparece. */
  trainingExamples?: SegmentTrainingExample[];
  /** Headline da seção self-service — fallback padrão se omitido. */
  selfServiceHeadline?: string;
}

export function SegmentTemplate({ data }: { data: SegmentPageData }) {
  return (
    <PublicLayout>
      {/* Breadcrumb */}
      <div className="max-w-7xl mx-auto px-6 mb-8">
        <nav className="flex items-center gap-2 text-sm text-gray-400">
          <Link href="/" className="hover:text-primary-600 transition-colors">Home</Link>
          <ChevronRight size={12} />
          <span>Segmentos</span>
          <ChevronRight size={12} />
          <span className="text-gray-700 font-medium">{data.name}</span>
        </nav>
      </div>

      {/* Hero */}
      <section className="pb-16 lg:pb-20">
        <div className="max-w-7xl mx-auto px-6">
          <div className="max-w-3xl">
            <div className="inline-flex items-center gap-2 bg-primary-50 text-primary-700 text-xs font-semibold px-3 py-1.5 rounded-full mb-6">
              {data.name}
            </div>
            <h1 className="font-display text-4xl lg:text-5xl font-extrabold text-gray-900 leading-[1.1] tracking-tight mb-6">
              {data.heroTitle}
            </h1>
            <p className="text-lg text-gray-500 leading-relaxed mb-8">{data.heroSubtitle}</p>
            <div className="flex flex-wrap gap-4">
              <Link href="/register" className="inline-flex items-center gap-2 bg-primary-500 hover:bg-primary-600 text-white font-semibold px-7 py-3.5 rounded-xl transition-all shadow-lg shadow-primary-500/25">
                Treinar minha IA agora <ArrowRight size={18} />
              </Link>
              <Link href="/demo" className="inline-flex items-center gap-2 border border-primary-300 hover:border-primary-500 text-primary-600 font-semibold px-7 py-3.5 rounded-xl transition-all bg-white hover:bg-primary-50">
                Ver Demo para {data.name}
              </Link>
            </div>

            {/* Badges de confiança — reforço do storytelling self-service */}
            <div className="mt-8 flex flex-wrap items-center gap-3 text-xs font-medium text-gray-600">
              <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-green-50 text-green-700 border border-green-100">
                <CheckCircle2 size={14} /> 14 dias grátis · sem cartão
              </span>
              <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-primary-50 text-primary-700 border border-primary-100">
                <CheckCircle2 size={14} /> Zero setup fee
              </span>
              <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-gray-50 text-gray-700 border border-gray-200">
                <CheckCircle2 size={14} /> Você treina — sem consultor
              </span>
              <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-gray-50 text-gray-700 border border-gray-200">
                <CheckCircle2 size={14} /> LGPD · SLA · Observabilidade
              </span>
            </div>
          </div>
        </div>
      </section>

      {/* Dores do segmento */}
      <section className="py-16 bg-[#F8FAF9]">
        <div className="max-w-7xl mx-auto px-6">
          <h2 className="font-display text-2xl lg:text-3xl font-extrabold text-gray-900 text-center mb-10">
            Desafios de {data.businessType}
          </h2>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {data.pains.map((pain) => (
              <div key={pain.title} className="bg-white rounded-2xl border border-gray-200 p-6 hover:shadow-lg transition-shadow">
                <div className="w-12 h-12 bg-red-50 rounded-xl flex items-center justify-center mb-4">
                  {(() => { const Icon = ICON_MAP[pain.icon]; return Icon ? <Icon size={24} className="text-red-500" /> : null; })()}
                </div>
                <h3 className="font-display text-base font-bold text-gray-900 mb-2">{pain.title}</h3>
                <p className="text-sm text-gray-500 leading-relaxed">{pain.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Como a ZappIQ resolve */}
      <section className="py-16 bg-white">
        <div className="max-w-7xl mx-auto px-6">
          <h2 className="font-display text-2xl lg:text-3xl font-extrabold text-gray-900 text-center mb-10">
            Como a ZappIQ resolve
          </h2>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {data.solutions.map((sol) => (
              <div key={sol.title} className="bg-gradient-to-br from-primary-50 to-secondary-50 rounded-2xl border border-primary-100 p-6 hover:shadow-lg transition-shadow">
                <div className="w-12 h-12 bg-primary-100 rounded-xl flex items-center justify-center mb-4">
                  {(() => { const Icon = ICON_MAP[sol.icon]; return Icon ? <Icon size={24} className="text-primary-600" /> : null; })()}
                </div>
                <h3 className="font-display text-base font-bold text-gray-900 mb-2">{sol.title}</h3>
                <p className="text-sm text-gray-600 leading-relaxed">{sol.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ───── Self-service training ─── reforço do pilar "você treina" ───── */}
      {data.trainingExamples && data.trainingExamples.length > 0 && (
        <section className="py-16 bg-gradient-to-br from-[#0F0F1E] to-[#1A1A2E] text-white">
          <div className="max-w-6xl mx-auto px-6">
            <div className="text-center max-w-3xl mx-auto mb-12">
              <span className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/10 text-primary-300 text-xs font-bold uppercase tracking-wider mb-5">
                <Sparkles size={14} /> Treinamento 100% self-service
              </span>
              <h2 className="font-display text-3xl lg:text-4xl font-extrabold mb-4">
                {data.selfServiceHeadline ?? `Você treina a IA com os documentos de ${data.businessType.toLowerCase()}.`}
              </h2>
              <p className="text-gray-400">
                Sem consultor. Sem setup fee de R$ 3k–15k que os concorrentes cobram. Em minutos, sua IA aprende o que o seu negócio faz e começa a responder com o tom e o conteúdo certos.
              </p>
            </div>

            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
              {data.trainingExamples.map((ex, i) => {
                const iconOptions = [FileText, Upload, MessageSquare, BarChart3];
                const Icon = iconOptions[i % iconOptions.length];
                return (
                  <div key={ex.label} className="bg-white/5 backdrop-blur border border-white/10 rounded-2xl p-6 hover:bg-white/10 transition-colors">
                    <div className="w-10 h-10 rounded-lg bg-primary-500/20 flex items-center justify-center mb-4">
                      <Icon className="text-primary-300" size={20} />
                    </div>
                    <div className="text-[10px] font-bold uppercase tracking-wider text-primary-300 mb-1">{ex.format}</div>
                    <h3 className="font-bold text-white mb-2">{ex.label}</h3>
                    <p className="text-sm text-gray-400 leading-relaxed">{ex.outcome}</p>
                  </div>
                );
              })}
            </div>

            <div className="mt-10 flex items-center justify-center gap-3 flex-wrap">
              <Link href="/register" className="inline-flex items-center gap-2 bg-primary-500 hover:bg-primary-400 text-white font-semibold px-7 py-3.5 rounded-xl transition-colors shadow-lg shadow-primary-500/30">
                Começar agora — 14 dias grátis <ArrowRight size={18} />
              </Link>
              <Link href="/comparativo" className="inline-flex items-center gap-2 text-white/70 hover:text-white font-semibold px-5 py-3.5 transition-colors">
                Ver comparativo vs. concorrentes →
              </Link>
            </div>
          </div>
        </section>
      )}

      {/* Mockup placeholder */}
      <section className="py-16 bg-[#F8FAF9]">
        <div className="max-w-4xl mx-auto px-6">
          {/* PLACEHOLDER: substituir por imagem real de fluxo de automação do segmento */}
          <div className="bg-white rounded-2xl border border-gray-200 shadow-lg p-12 text-center">
            <div className="w-full h-64 bg-gray-50 rounded-xl flex items-center justify-center border border-dashed border-gray-300">
              <p className="text-gray-400 text-sm">Mockup de fluxo de automação — {data.name}</p>
            </div>
          </div>
        </div>
      </section>

      {/* Depoimento — PLACEHOLDER: substituir por depoimento real */}
      <section className="py-16 bg-white">
        <div className="max-w-3xl mx-auto px-6">
          <div className="bg-white rounded-2xl border border-gray-200 p-8 text-center">
            <div className="flex justify-center gap-0.5 mb-4">
              {[...Array(5)].map((_, i) => <Star key={i} size={16} className="text-yellow-400 fill-yellow-400" />)}
            </div>
            <p className="text-lg text-gray-700 leading-relaxed mb-6 italic">&ldquo;{data.testimonial.text}&rdquo;</p>
            <div className="flex items-center justify-center gap-3">
              <div className="w-10 h-10 rounded-full bg-gradient-to-br from-primary-500 to-secondary-500 flex items-center justify-center text-white text-xs font-bold">{data.testimonial.initials}</div>
              <div className="text-left">
                <p className="text-sm font-semibold text-gray-900">{data.testimonial.name}</p>
                <p className="text-xs text-gray-400">{data.testimonial.role} — {data.testimonial.company}</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Final */}
      <section className="py-20 bg-[#1A1A2E]">
        <div className="max-w-3xl mx-auto px-6 text-center">
          <h2 className="font-display text-3xl lg:text-4xl font-extrabold text-white mb-5">
            Pronto para automatizar seu {data.businessType.toLowerCase()}?
          </h2>
          <p className="text-gray-400 mb-8">
            14 dias grátis. Zero setup fee. Você treina a IA com seus próprios documentos — sem esperar consultor.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link href="/register" className="inline-flex items-center justify-center gap-2 bg-primary-500 hover:bg-primary-400 text-white font-semibold px-8 py-4 rounded-xl transition-colors shadow-lg shadow-primary-500/30">
              Treinar minha IA agora <ArrowRight size={18} />
            </Link>
            <Link href="/comparativo" className="inline-flex items-center justify-center gap-2 border border-white/20 text-white font-semibold px-8 py-4 rounded-xl transition-colors hover:bg-white/5">
              Comparar com concorrentes
            </Link>
          </div>
          <p className="text-xs text-gray-500 mt-6">Sem cartão · cap de custo no trial · cancelamento em 1 clique</p>
        </div>
      </section>
    </PublicLayout>
  );
}
