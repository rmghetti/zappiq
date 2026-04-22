'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Check, X as XIcon, Radar, Shield, Sparkles, Crown, Mic } from 'lucide-react';
import { listPlans, ADDONS, getAnnualPrice, type PlanConfig } from '@zappiq/shared';

const PLANS: PlanConfig[] = listPlans();
const RADAR_ADDON = ADDONS.RADAR_360;

// Voz outbound V3.2 — add-on (split padrão/premium)
const VOICE_OUTBOUND = {
  padrao: { price: 197, label: 'Padrão', minutes: 30, engine: 'OpenAI TTS' },
  premium: { price: 597, label: 'Premium', minutes: 120, engine: 'ElevenLabs' },
} as const;

type VoiceTier = 'none' | 'padrao' | 'premium';

const STARTER_PRICE = PLANS[0]?.priceMonthly ?? 197;
const COMPARISON = [
  { without: '5 atendentes manuais', with: 'IA + 1 atendente' },
  { without: 'R$15.000/mês em folha', with: `A partir de R$${STARTER_PRICE}/mês` },
  { without: 'Tempo de resposta: 2h', with: 'Tempo de resposta: 30s' },
  { without: 'Leads perdidos: ~40%', with: 'Leads recuperados: +60%' },
];

export function Pricing() {
  const [annual, setAnnual] = useState(false);
  const [addRadar, setAddRadar] = useState(false);
  const [voiceTier, setVoiceTier] = useState<VoiceTier>('none');

  const computePrice = (plan: PlanConfig): number | null => {
    if (plan.priceMonthly === null) return null;
    return annual ? getAnnualPrice(plan) : plan.priceMonthly;
  };

  const computeRadarExtra = (plan: PlanConfig): number => {
    if (!addRadar) return 0;
    if (plan.features.radar360) return 0; // já incluso
    if (RADAR_ADDON.priceMonthly === null) return 0;
    return annual
      ? Math.round(RADAR_ADDON.priceMonthly * (1 - plan.annualDiscountPercent / 100))
      : RADAR_ADDON.priceMonthly;
  };

  const computeVoiceExtra = (plan: PlanConfig): number => {
    if (voiceTier === 'none') return 0;
    if (plan.id === 'ENTERPRISE') return 0; // Enterprise sob consulta — voz incluída na negociação
    const base = VOICE_OUTBOUND[voiceTier].price;
    return annual
      ? Math.round(base * (1 - plan.annualDiscountPercent / 100))
      : base;
  };

  return (
    <section id="precos" className="py-20 lg:py-28 bg-white">
      <div className="max-w-7xl mx-auto px-6">
        <div className="text-center mb-8">
          <p className="text-sm font-semibold text-primary-600 uppercase tracking-wider mb-3">Preços</p>
          <h2 className="font-display text-3xl lg:text-4xl font-extrabold text-gray-900 mb-3">
            Planos para cada fase do seu negócio
          </h2>
          <p className="text-gray-500">30 dias grátis. 60 dias de garantia. Sem fidelidade.</p>
        </div>

        {/* Toggles */}
        <div className="flex flex-col items-center justify-center gap-4 mb-12">
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
              Anual <span className="text-xs font-semibold text-secondary-600 bg-secondary-50 px-2 py-0.5 rounded-full ml-1">até -20%</span>
            </span>
          </div>

          <div className="flex flex-col sm:flex-row items-center gap-3">
            <div className="flex items-center gap-3 bg-purple-50 border border-purple-100 rounded-full px-4 py-2">
              <button
                onClick={() => setAddRadar(!addRadar)}
                className={`relative w-12 h-6 rounded-full transition-colors ${addRadar ? 'bg-purple-600' : 'bg-gray-300'}`}
                aria-label="Adicionar Radar 360"
              >
                <div className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow-md transition-transform ${addRadar ? 'translate-x-6' : 'translate-x-0.5'}`} />
              </button>
              <span className="text-sm font-medium text-purple-900 flex items-center gap-1.5">
                <Radar size={14} /> Radar 360°
              </span>
            </div>

            {/* Toggle Voz Outbound (segmented) */}
            <div className="inline-flex items-center bg-primary-50 border border-primary-100 rounded-full p-1">
              <span className="px-3 text-xs font-semibold text-primary-800 flex items-center gap-1.5">
                <Mic size={14} /> Voz outbound
              </span>
              {(['none', 'padrao', 'premium'] as VoiceTier[]).map((tier) => (
                <button
                  key={tier}
                  onClick={() => setVoiceTier(tier)}
                  className={`text-xs font-semibold px-3 py-1 rounded-full transition-colors ${
                    voiceTier === tier
                      ? 'bg-primary-500 text-white shadow'
                      : 'text-primary-700 hover:bg-primary-100'
                  }`}
                  aria-label={`Voz outbound ${tier}`}
                >
                  {tier === 'none' ? 'Nenhuma' : tier === 'padrao' ? `Padrão R$${VOICE_OUTBOUND.padrao.price}` : `Premium R$${VOICE_OUTBOUND.premium.price}`}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="grid md:grid-cols-2 lg:grid-cols-5 gap-5 max-w-7xl mx-auto">
          {PLANS.map((plan) => {
            const basePrice = computePrice(plan);
            const radarExtra = computeRadarExtra(plan);
            const voiceExtra = computeVoiceExtra(plan);
            const totalPrice = basePrice !== null ? basePrice + radarExtra + voiceExtra : null;
            const isEnterprise = plan.id === 'ENTERPRISE';
            const isBusiness = plan.id === 'BUSINESS';

            return (
              <div
                key={plan.id}
                className={`rounded-2xl p-6 relative transition-shadow flex flex-col ${
                  isEnterprise
                    ? 'bg-gradient-to-br from-gray-900 to-gray-800 border-2 border-amber-400/40 shadow-xl shadow-amber-500/10 text-white'
                    : isBusiness
                      ? 'bg-gradient-to-br from-primary-50 to-white border-2 border-primary-300 shadow-lg shadow-primary-100'
                      : plan.highlight
                        ? 'bg-white border-2 border-primary-500 shadow-xl shadow-primary-100'
                        : 'bg-white border border-gray-200 hover:shadow-lg'
                }`}
              >
                {plan.highlight && (
                  <div className="absolute -top-3.5 left-1/2 -translate-x-1/2 bg-gradient-to-r from-primary-500 to-secondary-500 text-white text-xs font-bold px-4 py-1 rounded-full">
                    Mais Popular
                  </div>
                )}
                {isBusiness && (
                  <div className="absolute -top-3.5 left-1/2 -translate-x-1/2 bg-gradient-to-r from-primary-600 to-purple-600 text-white text-xs font-bold px-4 py-1 rounded-full flex items-center gap-1">
                    <Crown size={12} /> SLA 99,9%
                  </div>
                )}
                {isEnterprise && (
                  <div className="absolute -top-3.5 left-1/2 -translate-x-1/2 bg-gradient-to-r from-amber-400 to-orange-500 text-gray-900 text-xs font-bold px-4 py-1 rounded-full flex items-center gap-1">
                    <Sparkles size={12} /> Premium
                  </div>
                )}

                <h3 className={`font-display text-lg font-bold ${isEnterprise ? 'text-white' : 'text-gray-900'}`}>
                  {plan.name}
                </h3>
                <p className={`text-xs mb-4 ${isEnterprise ? 'text-gray-400' : 'text-gray-500'}`}>
                  {plan.tagline}
                </p>

                <div className="mb-5">
                  {annual && basePrice !== null && plan.priceMonthly !== null && (
                    <span className={`text-sm mr-2 line-through ${isEnterprise ? 'text-gray-500' : 'text-gray-300'}`}>
                      R${plan.priceMonthly.toLocaleString('pt-BR')}
                    </span>
                  )}
                  {totalPrice !== null ? (
                    <>
                      <span className={`text-3xl lg:text-4xl font-extrabold ${isEnterprise ? 'text-white' : 'text-gray-900'}`}>
                        R${totalPrice.toLocaleString('pt-BR')}
                      </span>
                      <span className={`text-sm ${isEnterprise ? 'text-gray-400' : 'text-gray-400'}`}>/mês</span>
                      {radarExtra > 0 && (
                        <div className="text-xs text-purple-600 mt-1 flex items-center gap-1">
                          <Radar size={10} /> +R${radarExtra} Radar 360°
                        </div>
                      )}
                      {voiceExtra > 0 && (
                        <div className={`text-xs mt-1 flex items-center gap-1 ${isEnterprise ? 'text-amber-300' : 'text-primary-600'}`}>
                          <Mic size={10} /> +R${voiceExtra} Voz {voiceTier === 'premium' ? 'Premium' : 'Padrão'}
                        </div>
                      )}
                      {voiceTier !== 'none' && plan.id === 'ENTERPRISE' && (
                        <div className="text-xs text-amber-300 mt-1 flex items-center gap-1">
                          <Mic size={10} /> Voz incluída na negociação
                        </div>
                      )}
                    </>
                  ) : (
                    <>
                      <span className={`text-xs block mb-1 ${isEnterprise ? 'text-amber-300' : 'text-gray-500'}`}>
                        a partir de
                      </span>
                      <span className={`text-2xl font-extrabold ${isEnterprise ? 'text-white' : 'text-gray-900'}`}>
                        Sob consulta
                      </span>
                    </>
                  )}
                </div>

                <ul className="space-y-2 mb-6 flex-grow">
                  {plan.bullets.slice(0, 9).map((f) => (
                    <li key={f} className={`flex items-start gap-2 text-xs ${isEnterprise ? 'text-gray-300' : 'text-gray-600'}`}>
                      <Check size={14} className={`flex-shrink-0 mt-0.5 ${isEnterprise ? 'text-amber-400' : 'text-secondary-500'}`} />
                      <span>{f}</span>
                    </li>
                  ))}
                  {plan.bullets.length > 9 && (
                    <li className={`text-xs italic ${isEnterprise ? 'text-gray-400' : 'text-gray-400'} pl-6`}>
                      +{plan.bullets.length - 9} recursos adicionais
                    </li>
                  )}
                  {!plan.features.radar360 && addRadar && (
                    <li className="flex items-start gap-2 text-xs text-purple-700 bg-purple-50 rounded-lg px-2 py-1.5 border border-purple-100">
                      <Radar size={14} className="flex-shrink-0 mt-0.5 text-purple-600" />
                      <span className="font-medium">Radar 360° incluído</span>
                    </li>
                  )}
                </ul>

                <Link
                  href={plan.cta.href}
                  className={`block w-full text-center py-2.5 rounded-xl text-sm font-semibold transition-colors ${
                    isEnterprise
                      ? 'bg-amber-400 text-gray-900 hover:bg-amber-300 shadow-lg shadow-amber-500/20'
                      : isBusiness
                        ? 'bg-primary-600 text-white hover:bg-primary-700 shadow-lg shadow-primary-500/20'
                        : plan.highlight
                          ? 'bg-primary-500 text-white hover:bg-primary-600 shadow-lg shadow-primary-500/20'
                          : 'border border-gray-200 text-gray-700 hover:bg-gray-50'
                  }`}
                >
                  {plan.cta.label}
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
              BI conversacional com cohort analysis, previsão de pipeline (ML), benchmarking de mercado e alertas proativos. Exporta para Power BI e Looker.{' '}
              <strong className="text-purple-700">Incluído nos planos Business e Enterprise.</strong>
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
            <h4 className="font-display font-bold mb-1">SLA contratual 99,9% a partir do plano Business</h4>
            <p className="text-sm text-gray-300 mb-3">
              Uptime garantido por contrato, com créditos automáticos em caso de descumprimento. Relatório mensal de disponibilidade + RPO 1h / RTO 4h documentados. Enterprise inclui SOC/NOC dedicado 24/7.
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
