'use client';

/**
 * Bloco V3.2 — Por que ZappIQ (8 cards)
 * -------------------------------------
 * Substitui ou complementa Products/ProblemSolution como sumário dos
 * diferenciais estruturais. Uma olhada, oito razões pra considerar.
 */
import {
  ShieldCheck,
  Bot,
  Lock,
  Activity,
  Zap,
  Server,
  DollarSign,
  Mic,
} from 'lucide-react';

const DIFERENCIAIS = [
  {
    icon: <ShieldCheck size={22} />,
    title: 'Cloud API direto da Meta',
    description: 'Zero intermediário (BSP). Você fala direto com a Meta via WhatsApp Cloud API.',
    color: 'from-primary-500 to-secondary-500',
  },
  {
    icon: <Bot size={22} />,
    title: 'IA Claude (Anthropic)',
    description: 'Modelos Claude Sonnet + Opus em produção. Zero treinamento nos seus dados.',
    color: 'from-secondary-500 to-primary-500',
  },
  {
    icon: <Lock size={22} />,
    title: 'LGPD desde o onboarding',
    description: 'DPO acessível, sub-processadores listados, DSR self-service em 48h úteis.',
    color: 'from-primary-500 to-purple-500',
  },
  {
    icon: <Activity size={22} />,
    title: 'Observabilidade completa',
    description: 'Dashboards de métricas em tempo real, PostHog integrado, Sentry para falhas.',
    color: 'from-purple-500 to-primary-500',
  },
  {
    icon: <Zap size={22} />,
    title: 'Onboarding zero',
    description: 'Survey self-service em 30–90 min. Sem setup fee de R$ 3–8k. Novidade V3.2.',
    color: 'from-amber-500 to-primary-500',
  },
  {
    icon: <Server size={22} />,
    title: 'Infraestrutura no Brasil',
    description: 'Dados processados em São Paulo (AWS sa-east-1). Latência baixa, conformidade LGPD.',
    color: 'from-secondary-500 to-teal-500',
  },
  {
    icon: <DollarSign size={22} />,
    title: 'Preço previsível',
    description: 'Assinatura mensal fixa. Sem cobrança por conversa surpresa. Sem overage escondido.',
    color: 'from-teal-500 to-secondary-500',
  },
  {
    icon: <Mic size={22} />,
    title: 'Voz nativa',
    description: 'Transcrição de áudio inclusa. TTS outbound opcional (R$ 197 ou R$ 597). Novidade V3.2.',
    color: 'from-primary-500 to-amber-500',
  },
];

export function PorQueZappIQ() {
  return (
    <section id="por-que-zappiq" className="py-20 lg:py-28 bg-white">
      <div className="max-w-7xl mx-auto px-6">
        <div className="text-center max-w-3xl mx-auto mb-14">
          <h2 className="font-display text-3xl lg:text-5xl font-extrabold text-gray-900 leading-tight mb-4">
            Por que ZappIQ.
          </h2>
          <p className="text-lg text-gray-500 leading-relaxed">
            Oito razões estruturais pra migrar hoje. Não são features cosméticas — são decisões de arquitetura e modelo de negócio.
          </p>
        </div>

        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-5 lg:gap-6">
          {DIFERENCIAIS.map((d) => (
            <div
              key={d.title}
              className="bg-white rounded-2xl p-6 border border-gray-100 shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all"
            >
              <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${d.color} flex items-center justify-center text-white mb-4`}>
                {d.icon}
              </div>
              <h3 className="font-display text-base font-bold text-gray-900 mb-2 leading-tight">{d.title}</h3>
              <p className="text-sm text-gray-500 leading-relaxed">{d.description}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
