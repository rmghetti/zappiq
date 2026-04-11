'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Check, X as XIcon } from 'lucide-react';

const PLANS = [
  {
    name: 'Starter', price: 297, desc: 'Para começar a automatizar',
    features: ['3 agentes', '500 msgs IA/mês', '500 disparos/mês', '500 contatos CRM', '3 fluxos automação'],
    highlight: false,
  },
  {
    name: 'Growth', price: 597, desc: 'Para equipes em crescimento',
    features: ['10 agentes', '3.000 msgs IA/mês', '5.000 disparos/mês', '5.000 contatos CRM', '15 fluxos automação', 'Echo Copilot', 'Integrações avançadas'],
    highlight: true,
  },
  {
    name: 'Scale', price: 997, desc: 'Para operações de escala',
    features: ['Agentes ilimitados', 'IA ilimitada', '20.000 disparos/mês', 'Contatos ilimitados', 'Fluxos ilimitados', 'Echo Copilot', 'Onboarding dedicado', 'API aberta'],
    highlight: false,
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

        {/* Toggle Mensal/Anual */}
        <div className="flex items-center justify-center gap-4 mb-12">
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

        <div className="grid md:grid-cols-3 gap-6 max-w-5xl mx-auto">
          {PLANS.map((plan) => (
            <div key={plan.name} className={`rounded-2xl p-7 relative transition-shadow ${
              plan.highlight ? 'bg-white border-2 border-primary-500 shadow-xl shadow-primary-100' : 'bg-white border border-gray-200 hover:shadow-lg'
            }`}>
              {plan.highlight && (
                <div className="absolute -top-3.5 left-1/2 -translate-x-1/2 bg-gradient-to-r from-primary-500 to-secondary-500 text-white text-xs font-bold px-4 py-1 rounded-full">
                  Mais Popular
                </div>
              )}

              <h3 className="font-display text-lg font-bold text-gray-900">{plan.name}</h3>
              <p className="text-xs text-gray-400 mb-4">{plan.desc}</p>

              <div className="mb-6">
                {annual && (
                  <span className="text-lg text-gray-300 line-through mr-2">R${plan.price}</span>
                )}
                <span className="text-4xl font-extrabold text-gray-900">R${getPrice(plan.price)}</span>
                <span className="text-sm text-gray-400">/mês</span>
              </div>

              <ul className="space-y-2.5 mb-8">
                {plan.features.map((f) => (
                  <li key={f} className="flex items-center gap-2 text-sm text-gray-600">
                    <Check size={16} className="text-secondary-500 flex-shrink-0" /> {f}
                  </li>
                ))}
              </ul>

              <Link href="/onboarding"
                className={`block w-full text-center py-3 rounded-xl text-sm font-semibold transition-colors ${
                  plan.highlight
                    ? 'bg-primary-500 text-white hover:bg-primary-600 shadow-lg shadow-primary-500/20'
                    : 'border border-gray-200 text-gray-700 hover:bg-gray-50'
                }`}>
                Começar 14 dias grátis
              </Link>
            </div>
          ))}
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
