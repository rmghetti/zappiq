'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Check, X as XIcon, Radar, Shield, Sparkles } from 'lucide-react';

type Plan = {
  name: string;
  price: number | null; // null = custom quote
  priceLabel?: string;
  desc: string;
  features: string[];
  highlight: boolean;
  enterprise?: boolean;
  ctaLabel: string;
  ctaHref: string;
  radarIncluded: boolean;
  radarAddonPrice?: number;
};

const PLANS: Plan[] = [
  {
    name: 'Starter', price: 297, desc: 'Para começar a automatizar',
    features: ['3 agentes', '500 msgs IA/mês', '500 disparos/mês', '500 contatos CRM', '3 fluxos automação'],
    highlight: false,
    ctaLabel: 'Começar 14 dias grátis', ctaHref: '/onboarding',
    radarIncluded: false, radarAddonPrice: 197,
  },
  {
    name: 'Growth', price: 597, desc: 'Para equipes em crescimento',
    features: ['10 agentes', '3.000 msgs IA/mês', '5.000 disparos/mês', '5.000 contatos CRM', '15 fluxos automação', 'Echo Copilot', 'Integrações avançadas'],
    highlight: true,
    ctaLabel: 'Começar 14 dias grátis', ctaHref: '/onboarding',
    radarIncluded: false, radarAddonPrice: 197,
  },
  {
    name: 'Scale', price: 997, desc: 'Para operações de escala',
    features: ['Agentes ilimitados', 'IA ilimitada', '20.000 disparos/mês', 'Contatos ilimitados', 'Fluxos ilimitados', 'Echo Copilot', 'Onboarding dedicado', 'API aberta'],
    highlight: false,
    ctaLabel: 'Começar 14 dias grátis', ctaHref: '/onboarding',
    radarIncluded: false, radarAddonPrice: 397,
  },
  {
    name: 'Enterprise', price: 2997, priceLabel: 'a partir de',
    desc: 'Para operações estratégicas com SLA contratual',
    features: [
      'Tudo do Scale, sem limites',
      'SLA formal 99,9% com créditos',
      'Radar 360° Observabilidade incluída',
      'SOC/NOC dedicado 24/7',
      'Onboarding white-glove (30 dias)',
      'Gerente de Sucesso dedicado',
      'DPO contato direto + ROP customizado',
      'Retenção de logs até 5 anos',
      'Infraestrutura isolada (pool dedicado)',
      'Integrações customizadas (40h/mês)',
      'Suporte 24/7 multicanal',
      'SSO (SAML 2.0, OIDC)',
    ],
    highlight: false, enterprise: true,
    ctaLabel: 'Falar com especialista', ctaHref: '/enterprise',
    radarIncluded: true,
  },
];

const COMPARISON = [
  { without: '5 atendentes manuais', with: 'IA + 1 atendente' },
  { without: 'R$15.000/mês em folha', with: 'A partir de R$297/mês' },
  { without: 'Tempo de resposta: 2h', with: 'Tempo de resposta: 30s' },
  { without: 'Leads perdidos: ~40%', with: 'Leads recuperados: +60%' },
];

export function Pricing() {
  const [annual, setAnnual] = useState(false);
  const [addRadar, setAddRadar] = useState(false);

  const getPrice = (price: number) => {
    if (annual) return Math.round(price * 0.8);
    return price;
  };

  return (
    <section id="precos" className="py-20 lg:py-28 bg-white">
      <div className="max-w-7xl mx-auto px-6">
        <div className="text-center mb-8">
          <p className="text-sm font-semibold text-primary-600 uppercase tracking-wider mb-3">Preços</p>
          <h2 className="font-display text-3xl lg:text-4xl font-extrabold text-gray-900 mb-3">Planos para cada fase do seu negócio</h2>
          <p className="text-gray-500">14 dias grátis. Sem fidelidade. Cancele quando quiser.</p>
        </div>

        {/* Toggles */}
        <div className="flex flex-col sm:flex-row items-center justify-center gap-4 sm:gap-8 mb-12">
          {/* Mensal/Anual */}
          <div className="flex items-center gap-3">
            <span className={`text-sm font-medium ${!annual ? 'text-gray-900' : 'text-gray-400'}`}>Mensal</span>
            <button
              onClick={() => setAnnual(!annual)}
              className={`relative w-14 h-7 rounded-full transition-colors ${annual ? 'bg-primary-500' : 'bg-gray-300'}`}
              aria-label="Alternar entre mensal e anual"
            >
              <div className={`absolute top-0.5 w-6 h-6 bg-white rounded-full shadow-md transition-transform ${annual ? 'translate-x-7' : 'translate-x-0.5'}`} />
            </button>
            <span className={`text-sm font-medium ${annual ? 'text-gray-900' : 'text-gray-400'}`}>
              Anual <span className="text-xs font-semibold text-secondary-600 bg-secondary-50 px-2 py-0.5 rounded-full ml-1">-20%</span>
            </span>
          </div>

          {/* Radar 360° add-on */}
          <div className="flex items-center gap-3 bg-purple-50 border border-purple-100 rounded-full px-4 py-2">
            <button
              onClick={() => setAddRadar(!addRadar)}
              className={`relative w-12 h-6 rounded-full transition-colors ${addRadar ? 'bg-purple-600' : 'bg-gray-300'}`}
              aria-label="Adicionar Radar 360"
            >
              <div className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow-md transition-transform ${addRadar ? 'translate-x-6' : 'translate-x-0.5'}`} />
            </button>
            <span className="text-sm font-medium text-purple-900 flex items-center gap-1.5">
              <Radar size={14} /> Adicionar Radar 360° (Observabilidade)
            </span>
          </div>
        </div>

        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6 max-w-7xl mx-auto">
          {PLANS.map((plan) => {
            const basePrice = plan.price ? getPrice(plan.price) : null;
            const radarExtra = !plan.radarIncluded && addRadar && plan.radarAddonPrice
              ? (annual ? Math.round(plan.radarAddonPrice * 0.8) : plan.radarAddonPrice)
              : 0;
            const totalPrice = basePrice !== null ? basePrice + radarExtra : null;

            return (
              <div key={plan.name} className={`rounded-2xl p-7 relative transition-shadow ${
                plan.enterprise
                  ? 'bg-gradient-to-br from-gray-900 to-gray-800 border-2 border-amber-400/40 shadow-xl shadow-amber-500/10 text-white'
                  : plan.highlight
                    ? 'bg-white border-2 border-primary-500 shadow-xl shadow-primary-100'
                    : 'bg-white border border-gray-200 hover:shadow-lg'
              }`}>
                {plan.highlight && (
                  <div className="absolute -top-3.5 left-1/2 -translate-x-1/2 bg-gradient-to-r from-primary-500 to-secondary-500 text-white text-xs font-bold px-4 py-1 rounded-full">
                    Mais Popular
                  </div>
                )}
                {plan.enterprise && (
                  <div className="absolute -top-3.5 left-1/2 -translate-x-1/2 bg-gradient-to-r from-amber-400 to-orange-500 text-gray-900 text-xs font-bold px-4 py-1 rounded-full flex items-center gap-1">
                    <Sparkles size={12} /> Premium
                  </div>
                )}

                <h3 className={`font-display text-lg font-bold ${plan.enterprise ? 'text-white' : 'text-gray-900'}`}>
                  {plan.name}
                </h3>
                <p className={`text-xs mb-4 ${plan.enterprise ? 'text-gray-400' : 'text-gray-400'}`}>{plan.desc}</p>

                <div className="mb-6">
                  {plan.priceLabel && (
                    <div className={`text-xs mb-1 ${plan.enterprise ? 'text-amber-300' : 'text-gray-500'}`}>
                      {plan.priceLabel}
                    </div>
                  )}
                  {annual && basePrice !== null && (
                    <span className={`text-lg mr-2 line-through ${plan.enterprise ? 'text-gray-500' : 'text-gray-300'}`}>
                      R${plan.price}
                    </span>
                  )}
                  {totalPrice !== null ? (
                    <>
                      <span className={`text-4xl font-extrabold ${plan.enterprise ? 'text-white' : 'text-gray-900'}`}>
                        R${totalPrice.toLocaleString('pt-BR')}
                      </span>
                      <span className={`text-sm ${plan.enterprise ? 'text-gray-400' : 'text-gray-400'}`}>/mês</span>
                      {radarExtra > 0 && (
                        <div className="text-xs text-purple-600 mt-1 flex items-center gap-1">
                          <Radar size={10} /> +R${radarExtra} Radar 360°
                        </div>
                      )}
                    </>
                  ) : (
                    <span className={`text-2xl font-extrabold ${plan.enterprise ? 'text-white' : 'text-gray-900'}`}>
                      Sob consulta
                    </span>
                  )}
                </div>

                <ul className="space-y-2.5 mb-8">
                  {plan.features.map((f) => (
                    <li key={f} className={`flex items-start gap-2 text-sm ${plan.enterprise ? 'text-gray-300' : 'text-gray-600'}`}>
                      <Check size={16} className={`flex-shrink-0 mt-0.5 ${plan.enterprise ? 'text-amber-400' : 'text-secondary-500'}`} />
                      <span>{f}</span>
                    </li>
                  ))}
                  {!plan.radarIncluded && addRadar && (
                    <li className="flex items-start gap-2 text-sm text-purple-700 bg-purple-50 rounded-lg px-3 py-2 border border-purple-100">
                      <Radar size={16} className="flex-shrink-0 mt-0.5 text-purple-600" />
                      <span className="font-medium">Radar 360° Observabilidade incluído</span>
                    </li>
                  )}
                </ul>

                <Link href={plan.ctaHref}
                  className={`block w-full text-center py-3 rounded-xl text-sm font-semibold transition-colors ${
                    plan.enterprise
                      ? 'bg-amber-400 text-gray-900 hover:bg-amber-300 shadow-lg shadow-amber-500/20'
                      : plan.highlight
                        ? 'bg-primary-500 text-white hover:bg-primary-600 shadow-lg shadow-primary-500/20'
                        : 'border border-gray-200 text-gray-700 hover:bg-gray-50'
                  }`}>
                  {plan.ctaLabel}
                </Link>
              </div>
            );
          })}
        </div>

        {/* CTA Radar 360° explicativo */}
        <div className="mt-10 max-w-4xl mx-auto bg-gradient-to-r from-purple-50 to-indigo-50 border border-purple-100 rounded-2xl p-6 flex flex-col sm:flex-row items-start gap-4">
          <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-purple-600 to-indigo-600 flex items-center justify-center flex-shrink-0">
            <Radar size={24} className="text-white" />
          </div>
          <div className="flex-1">
            <h4 className="font-display font-bold text-gray-900 mb-1">Radar 360° — Observabilidade de Negócio</h4>
            <p className="text-sm text-gray-600 mb-3">
              BI conversacional com cohort analysis, previsão de pipeline (ML), benchmarking de mercado e alertas proativos. Exporta para Power BI e Looker. <strong className="text-purple-700">Incluído no plano Enterprise.</strong>
            </p>
            <Link href="/observabilidade" className="text-sm font-semibold text-purple-700 hover:text-purple-900 inline-flex items-center gap-1">
              Conhecer o Radar 360° →
            </Link>
          </div>
        </div>

        {/* SLA destaque */}
        <div className="mt-6 max-w-4xl mx-auto bg-gradient-to-r from-gray-900 to-gray-800 rounded-2xl p-6 flex flex-col sm:flex-row items-start gap-4 text-white">
          <div className="w-12 h-12 rounded-xl bg-amber-400 flex items-center justify-center flex-shrink-0">
            <Shield size={24} className="text-gray-900" />
          </div>
          <div className="flex-1">
            <h4 className="font-display font-bold mb-1">SLA contratual 99,9% no plano Enterprise</h4>
            <p className="text-sm text-gray-300 mb-3">
              Uptime garantido por contrato, com créditos automáticos em caso de descumprimento. Relatório mensal de disponibilidade + RPO 1h / RTO 4h documentados.
            </p>
            <Link href="/sla" className="text-sm font-semibold text-amber-400 hover:text-amber-300 inline-flex items-center gap-1">
              Ver termos do SLA →
            </Link>
          </div>
        </div>

        {/* Tabela Com vs. Sem ZappIQ */}
        <div className="mt-20 max-w-4xl mx-auto">
          <h3 className="font-display text-2xl lg:text-3xl font-extrabold text-gray-900 text-center mb-10">
            Com vs. Sem ZappIQ
          </h3>
          <div className="grid md:grid-cols-2 gap-6">
            {/* Sem ZappIQ */}
            <div className="bg-red-50/50 border border-red-100 rounded-2xl p-6">
              <h4 className="text-lg font-bold text-red-600 mb-5 flex items-center gap-2">
                <XIcon size={20} /> Sem ZappIQ
              </h4>
              <ul className="space-y-4">
                {COMPARISON.map((c) => (
                  <li key={c.without} className="flex items-center gap-3 text-sm text-gray-600">
                    <div className="w-6 h-6 bg-red-100 rounded-full flex items-center justify-center flex-shrink-0">
                      <XIcon size={12} className="text-red-500" />
                    </div>
                    {c.without}
                  </li>
                ))}
              </ul>
            </div>

            {/* Com ZappIQ */}
            <div className="bg-primary-50/50 border border-primary-100 rounded-2xl p-6">
              <h4 className="text-lg font-bold text-primary-600 mb-5 flex items-center gap-2">
                <Check size={20} /> Com ZappIQ
              </h4>
              <ul className="space-y-4">
                {COMPARISON.map((c) => (
                  <li key={c.with} className="flex items-center gap-3 text-sm text-gray-600">
                    <div className="w-6 h-6 bg-primary-100 rounded-full flex items-center justify-center flex-shrink-0">
                      <Check size={12} className="text-primary-600" />
                    </div>
                    {c.with}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
