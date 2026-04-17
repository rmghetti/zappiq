'use client';

import { ArrowRight, Star } from 'lucide-react';
import Link from 'next/link';

/* PLACEHOLDER: substituir por dados reais de clientes */
const CASE_STUDIES = [
  {
    name: 'Dra. Camila Ferreira',
    role: 'Diretora Clínica',
    company: 'Clínica Vida Plena',
    initials: 'CF',
    text: 'A ZappIQ transformou nosso atendimento. Saímos de 4 horas de espera para resposta instantânea. Os pacientes elogiam a agilidade e nosso NPS subiu 35 pontos.',
    metrics: ['+40% agendamentos', '-60% tempo de resposta', '4.9 CSAT'],
  },
  {
    name: 'Ricardo Mendes',
    role: 'CEO',
    company: 'TrendMix Moda',
    initials: 'RM',
    text: 'Nossas vendas pelo WhatsApp cresceram 35% no primeiro mês. O Pulse AI vende sozinho, qualifica leads e envia links de pagamento — tudo automatizado.',
    metrics: ['+35% vendas', '3x mais leads', 'R$48k receita/mês'],
  },
  {
    name: 'Marcos Almeida',
    role: 'Proprietário',
    company: 'AutoTech Oficina',
    initials: 'MA',
    text: 'Recuperei 3 horas do meu dia. O agente agenda revisões, envia orçamentos e acompanha pós-serviço. Agora posso focar na oficina, não no celular.',
    metrics: ['-70% tempo manual', '+28% retenção', '12h/sem economizadas'],
  },
];

export function SocialProof() {
  return (
    <section className="py-16 lg:py-20 border-y border-gray-100 bg-white">
      <div className="max-w-7xl mx-auto px-6">
        {/* Badge Meta — link para diretório de parceiros WhatsApp Business */}
        <div className="flex justify-center mb-12">
          <a
            href="https://www.facebook.com/business/partner-directory/search?platforms=whatsapp"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-3 bg-gradient-to-r from-primary-50 to-secondary-50 border border-primary-200 px-6 py-3 rounded-full hover:shadow-md transition-shadow"
          >
            <svg width="24" height="24" viewBox="0 0 256 256" className="flex-shrink-0" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M128 20C68.4 20 20 68.4 20 128s48.4 108 108 108 108-48.4 108-108S187.6 20 128 20z" fill="#0081FB"/>
              <path d="M90.3 130.3c0-16.5 4.4-30 11.2-38.8 8.2-10.6 19.8-15.4 30.6-15.4 8.6 0 15.4 2.6 20.8 7.4 5.6 4.8 10 12.2 13 22.2 2.6 8.8 4 19.6 4 32.8 0 14.6-2.6 27-7.2 36.4-5.6 11.4-14 17.4-24.6 17.4-10.4 0-19.4-6.2-26-17.4-7.2-12.2-11.8-27.4-11.8-44.6zm-24.6-4.6c0 24.6 7 44.2 17.6 58 12.2 15.8 28.6 24.4 44.8 24.4 18.2 0 33.2-10.4 43-27.6 8.8-15.4 13.8-36 13.8-59.2 0-20.2-4.2-37.4-12.4-50.4-10-15.8-25-25-42.4-25-18.8 0-34 10.6-44 27.2-9 15-20.4 33.4-20.4 52.6z" fill="white"/>
            </svg>
            <div>
              <p className="text-sm font-bold text-gray-900">Parceiro Oficial Meta WhatsApp Business</p>
              <p className="text-xs text-gray-500">API verificada e homologada</p>
            </div>
            <div className="w-6 h-6 bg-primary-500 rounded-full flex items-center justify-center flex-shrink-0">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="20 6 9 17 4 12" />
              </svg>
            </div>
          </a>
        </div>

        {/* Cases ilustrativos — cenários reais de segmentos-alvo */}
        <div className="text-center mb-10">
          <p className="text-sm font-semibold text-primary-600 uppercase tracking-wider mb-3">O que a ZappIQ resolve</p>
          <h2 className="font-display text-3xl lg:text-4xl font-extrabold text-gray-900">Cenários reais de quem automatiza com IA</h2>
          <p className="text-sm text-gray-400 mt-2">Baseados em benchmarks de mercado e simulações do modelo ZappIQ</p>
        </div>

        {/* PLACEHOLDER: substituir depoimentos por dados reais */}
        <div className="grid md:grid-cols-3 gap-6">
          {CASE_STUDIES.map((c) => (
            <div key={c.name} className="bg-white rounded-2xl border border-gray-200 p-7 relative hover:shadow-lg transition-shadow flex flex-col">
              <div className="text-6xl font-serif text-primary-100 absolute top-4 right-6">&ldquo;</div>

              {/* Stars */}
              <div className="flex gap-0.5 mb-4">
                {[...Array(5)].map((_, i) => <Star key={i} size={14} className="text-yellow-400 fill-yellow-400" />)}
              </div>

              {/* Depoimento */}
              <p className="text-gray-600 leading-relaxed mb-6 relative z-10 flex-1">&ldquo;{c.text}&rdquo;</p>

              {/* Micro-métricas */}
              <div className="flex flex-wrap gap-2 mb-6">
                {c.metrics.map((m) => (
                  <span key={m} className="inline-flex items-center bg-primary-50 text-primary-700 text-xs font-semibold px-2.5 py-1 rounded-full">
                    {m}
                  </span>
                ))}
              </div>

              {/* Autor */}
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-primary-500 to-secondary-500 flex items-center justify-center text-white text-xs font-bold">{c.initials}</div>
                <div>
                  <p className="text-sm font-semibold text-gray-900">{c.name}</p>
                  <p className="text-xs text-gray-400">{c.role} — {c.company}</p>
                </div>
                {/* PLACEHOLDER: substituir por logo real da empresa */}
              </div>

              <Link href="/cases" className="text-sm font-medium text-primary-600 hover:text-primary-700 flex items-center gap-1 transition-colors">
                Ler case completo <ArrowRight size={14} />
              </Link>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
