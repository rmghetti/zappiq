'use client';

import { Shield, Zap, BarChart3, Lock, Cpu, Globe } from 'lucide-react';

const TRUST_SIGNALS = [
  {
    icon: Globe,
    title: 'Parceiro Oficial Meta',
    description: 'API WhatsApp Business verificada e homologada. Sem risco de bloqueio.',
    color: 'text-blue-600 bg-blue-100',
  },
  {
    icon: Cpu,
    title: 'IA Conversacional Nativa',
    description: 'Pulse AI com Claude (Anthropic) embarcado. Respostas inteligentes, não roteiros fixos.',
    color: 'text-purple-600 bg-purple-100',
  },
  {
    icon: Lock,
    title: 'LGPD desde o design',
    description: 'Consentimento granular, criptografia em repouso, DPO nomeado e RLS multi-tenant.',
    color: 'text-green-600 bg-green-100',
  },
  {
    icon: BarChart3,
    title: 'Observabilidade total',
    description: 'OpenTelemetry nativo: traces, métricas e logs em tempo real. Sem caixa-preta.',
    color: 'text-orange-600 bg-orange-100',
  },
  {
    icon: Zap,
    title: 'Setup em 5 minutos',
    description: 'Conecte seu WhatsApp, configure o agente IA e comece a atender — sem dependência de TI.',
    color: 'text-yellow-600 bg-yellow-100',
  },
  {
    icon: Shield,
    title: 'Infraestrutura brasileira',
    description: 'Servidores em São Paulo (GRU). Latência mínima, dados em território nacional.',
    color: 'text-teal-600 bg-teal-100',
  },
];

export function SocialProof() {
  return (
    <section className="py-16 lg:py-20 border-y border-gray-100 bg-white">
      <div className="max-w-7xl mx-auto px-6">
        {/* Badge Meta */}
        <div className="flex justify-center mb-12">
          <div className="inline-flex items-center gap-3 bg-gradient-to-r from-primary-50 to-secondary-50 border border-primary-200 px-6 py-3 rounded-full">
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
          </div>
        </div>

        {/* Trust Signals */}
        <div className="text-center mb-10">
          <p className="text-sm font-semibold text-primary-600 uppercase tracking-wider mb-3">Por que ZappIQ</p>
          <h2 className="font-display text-3xl lg:text-4xl font-extrabold text-gray-900">Construído para empresas que levam WhatsApp a sério</h2>
        </div>

        <div className="grid md:grid-cols-3 gap-6">
          {TRUST_SIGNALS.map((s) => (
            <div key={s.title} className="bg-white rounded-2xl border border-gray-200 p-7 hover:shadow-lg transition-shadow flex flex-col">
              <div className={`w-12 h-12 rounded-xl ${s.color} flex items-center justify-center mb-4`}>
                <s.icon size={24} />
              </div>
              <h3 className="text-lg font-bold text-gray-900 mb-2">{s.title}</h3>
              <p className="text-gray-500 leading-relaxed text-sm flex-1">{s.description}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
