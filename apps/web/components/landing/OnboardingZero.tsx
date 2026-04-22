'use client';

/**
 * Bloco V3.2 — Onboarding Zero
 * ----------------------------
 * Tese: setup fee é fraude intelectual.
 * Comparativo mercado (R$3–8k) vs ZappIQ (R$0).
 * Link pra /como-funciona-survey explica a mecânica.
 */
import Link from 'next/link';
import { X, CheckCircle2, Clock, ArrowRight } from 'lucide-react';

const MERCADO = [
  'Reunião de kickoff com consultor (R$ 1.500)',
  'Levantamento de base de conhecimento (R$ 2.000)',
  'Configuração e integração inicial (R$ 2.500)',
  'Treinamento da equipe (R$ 1.000)',
  '4 a 8 semanas até entrar em produção',
];

const ZAPPIQ = [
  'Survey digital guiado (30–90 min, self-service)',
  'Você mesmo sobe os PDFs e documentos',
  'IA é calibrada automaticamente no seu dashboard',
  'Score de prontidão de 0 a 100 em tempo real',
  'Em minutos você está operando no WhatsApp',
];

export function OnboardingZero() {
  return (
    <section id="onboarding-zero" className="py-20 lg:py-28 bg-gradient-to-b from-white to-gray-50">
      <div className="max-w-7xl mx-auto px-6">
        <div className="text-center max-w-3xl mx-auto mb-14">
          <div className="inline-flex items-center gap-2 bg-secondary-50 border border-secondary-200 text-secondary-700 text-xs font-semibold px-3 py-1.5 rounded-full mb-4">
            <Clock size={14} /> Novidade V3.2
          </div>
          <h2 className="font-display text-3xl lg:text-5xl font-extrabold text-gray-900 leading-tight mb-4">
            Onboarding Zero.<br />
            <span className="bg-gradient-to-r from-primary-500 to-secondary-500 bg-clip-text text-transparent">Sem setup fee. Sem consultor. Sem espera.</span>
          </h2>
          <p className="text-lg text-gray-500 leading-relaxed">
            O mercado cobra de R$ 3 mil a R$ 8 mil para "treinar a IA com os dados da sua operação".
            Em 2026, isso é atrito. Subir um PDF em um vector store custa US$ 0,02. Você faz sozinho, em minutos.
          </p>
        </div>

        <div className="grid md:grid-cols-2 gap-6 lg:gap-8 max-w-5xl mx-auto">
          {/* Mercado */}
          <div className="bg-white rounded-2xl p-8 border-2 border-red-100 relative">
            <div className="absolute -top-4 left-6 bg-red-50 text-red-600 text-xs font-bold px-3 py-1 rounded-full border border-red-200">
              Padrão do mercado
            </div>
            <div className="flex items-baseline gap-2 mb-6">
              <span className="text-4xl font-extrabold text-red-600 font-display">R$ 3.000</span>
              <span className="text-gray-400 text-sm">a</span>
              <span className="text-4xl font-extrabold text-red-600 font-display">R$ 8.000</span>
            </div>
            <p className="text-sm text-gray-500 mb-5 -mt-4">setup fee para começar</p>
            <ul className="space-y-3">
              {MERCADO.map((item) => (
                <li key={item} className="flex items-start gap-3 text-sm text-gray-500">
                  <X size={16} className="text-red-500 flex-shrink-0 mt-0.5" />
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </div>

          {/* ZappIQ */}
          <div className="bg-gradient-to-br from-primary-500 to-secondary-500 rounded-2xl p-8 text-white relative shadow-xl shadow-primary-500/20">
            <div className="absolute -top-4 left-6 bg-white text-primary-600 text-xs font-bold px-3 py-1 rounded-full shadow">
              Jeito ZappIQ
            </div>
            <div className="flex items-baseline gap-2 mb-6">
              <span className="text-5xl font-extrabold font-display">R$ 0</span>
              <span className="text-white/80 text-sm">de setup</span>
            </div>
            <p className="text-sm text-white/80 mb-5 -mt-4">você só paga a assinatura mensal</p>
            <ul className="space-y-3">
              {ZAPPIQ.map((item) => (
                <li key={item} className="flex items-start gap-3 text-sm text-white/95">
                  <CheckCircle2 size={16} className="text-white flex-shrink-0 mt-0.5" />
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>

        <div className="mt-10 text-center">
          <Link
            href="/como-funciona-survey"
            className="inline-flex items-center gap-2 text-primary-600 hover:text-primary-700 font-semibold transition-colors"
          >
            Ver como o survey funciona em detalhes <ArrowRight size={16} />
          </Link>
        </div>

        <div className="mt-14 bg-amber-50 border border-amber-200 rounded-2xl p-6 lg:p-8 max-w-4xl mx-auto">
          <p className="text-sm text-amber-900 leading-relaxed">
            <strong className="font-bold">E se eu preferir ajuda humana?</strong> Se você não finalizar o survey em 7 dias,
            um consultor ZappIQ entra em contato por WhatsApp para destravar o que estiver pendente — sem custo adicional.
            Self-service é o padrão, mas nunca deixamos você empacar.
          </p>
        </div>
      </div>
    </section>
  );
}
