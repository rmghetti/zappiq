'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Navbar } from '../../components/landing/Navbar';
import { Footer } from '../../components/landing/LandingFooter';
import { ArrowRight, CheckCircle2 } from 'lucide-react';
import { listPlans, getAnnualPrice } from '@zappiq/shared';
import type { PlanConfig } from '@zappiq/shared';

/* ────────────────────────────────────────────────────────────
 * Preços derivados de packages/shared/src/planConfig.ts
 * (single source of truth). Qualquer alteração de pricing
 * deve ser feita lá — esta página consome automaticamente.
 * ──────────────────────────────────────────────────────────── */

const PLANS = listPlans().map((plan: PlanConfig) => ({
  id: plan.id.toLowerCase(),
  name: plan.id,
  monthlyPrice: plan.priceMonthly ?? 0,
  yearlyPrice: plan.priceMonthly
    ? plan.priceMonthly * 12 * (1 - plan.annualDiscountPercent / 100)
    : 0,
  description: plan.tagline,
  featured: plan.highlight,
  features: plan.bullets.slice(0, 5),
}));

export default function PricingPage() {
  const [isYearly, setIsYearly] = useState(false);

  return (
    <>
      <Navbar />
      <div className="min-h-screen bg-white">
        <div className="max-w-7xl mx-auto px-6 py-20">
          {/* Zero Setup Fee Badge */}
          <div className="text-center mb-12">
            <div className="inline-block bg-green-100 border border-green-300 text-green-700 px-4 py-2 rounded-full text-sm font-semibold mb-6">
              ✨ ZERO SETUP FEE · 21 DIAS GRÁTIS
            </div>
            <h1 className="text-5xl font-bold text-gray-900 mb-4">
              Planos simples e transparentes
            </h1>
            <p className="text-xl text-gray-600 max-w-2xl mx-auto">
              Sem custos de setup, sem surpresas. Escolha o plano ideal para seu negócio e cancele quando quiser.
            </p>
          </div>

          {/* Toggle Mensal/Anual */}
          <div className="flex justify-center items-center gap-6 mb-12">
            <span className={`text-sm font-medium ${!isYearly ? 'text-gray-900' : 'text-gray-500'}`}>
              Mensal
            </span>
            <button
              onClick={() => setIsYearly(!isYearly)}
              className={`relative w-14 h-8 rounded-full transition-colors ${
                isYearly ? 'bg-primary-500' : 'bg-gray-300'
              }`}
            >
              <div
                className={`absolute top-1 w-6 h-6 bg-white rounded-full transition-transform ${
                  isYearly ? 'translate-x-7' : 'translate-x-1'
                }`}
              />
            </button>
            <span className={`text-sm font-medium ${isYearly ? 'text-gray-900' : 'text-gray-500'}`}>
              Anual <span className="text-green-500">(2 meses grátis)</span>
            </span>
          </div>

          {/* Pricing Cards */}
          <div className="grid lg:grid-cols-5 gap-6 mb-12">
            {PLANS.map((plan) => (
              <div
                key={plan.id}
                className={`rounded-xl border transition-all ${
                  plan.featured
                    ? 'border-primary-500 bg-primary-50 shadow-xl transform lg:scale-105'
                    : 'border-gray-200 bg-white hover:shadow-lg'
                }`}
              >
                {plan.featured && (
                  <div className="bg-primary-500 text-white px-4 py-2 rounded-t-[10px] text-center text-sm font-semibold">
                    Mais escolhido
                  </div>
                )}

                <div className="p-6 space-y-6">
                  <div>
                    <p className="text-gray-600 text-sm font-medium mb-2">{plan.description}</p>
                    <h3 className="text-xl font-bold text-gray-900">{plan.name}</h3>
                  </div>

                  {plan.id === 'enterprise' ? (
                    <div className="space-y-2">
                      <p className="text-gray-600 text-sm">Plano customizado com suporte dedicado</p>
                      <p className="text-lg font-semibold text-gray-900">Contato para cotação</p>
                    </div>
                  ) : (
                    <div>
                      <div className="flex items-baseline gap-2">
                        <span className="text-3xl font-bold text-gray-900">
                          R$ {isYearly ? Math.round(plan.yearlyPrice / 12) : Math.floor(plan.monthlyPrice)}
                        </span>
                        <span className="text-gray-600 text-sm">/mês</span>
                      </div>
                      {isYearly && (
                        <p className="text-xs text-green-600 mt-1">
                          R$ {Math.round(plan.yearlyPrice)} / ano
                        </p>
                      )}
                    </div>
                  )}

                  <Link
                    href={`/register?plan=${plan.id}`}
                    className={`block w-full py-2.5 rounded-lg font-semibold text-center transition-all ${
                      plan.featured
                        ? 'bg-primary-500 hover:bg-primary-600 text-white'
                        : 'bg-gray-100 hover:bg-gray-200 text-gray-900'
                    }`}
                  >
                    Começar
                  </Link>

                  <div className="space-y-3">
                    {plan.features.map((feature) => (
                      <div key={feature} className="flex items-start gap-3">
                        <CheckCircle2 size={16} className="text-green-500 flex-shrink-0 mt-0.5" />
                        <span className="text-sm text-gray-700">{feature}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Comparativo vs Concorrente */}
          <div className="bg-gray-50 rounded-xl p-8 mt-16">
            <h2 className="text-2xl font-bold text-gray-900 mb-6">
              Por que ZappIQ é diferente?
            </h2>
            <div className="grid md:grid-cols-2 gap-8">
              <div className="space-y-4">
                <h3 className="font-semibold text-gray-900">Concorrentes tradicionais</h3>
                <ul className="space-y-3">
                  {[
                    'Setup fee: R$ 3k-15k',
                    'Consultoria obrigatória',
                    'Meses de implementação',
                    'Contrato mínimo de 12 meses',
                    'Suporte limitado',
                  ].map((item) => (
                    <li key={item} className="flex items-start gap-3 text-gray-700">
                      <span className="text-red-500 text-xl">✕</span>
                      {item}
                    </li>
                  ))}
                </ul>
              </div>
              <div className="space-y-4">
                <h3 className="font-semibold text-gray-900">ZappIQ</h3>
                <ul className="space-y-3">
                  {[
                    'Zero setup fee',
                    'Self-service 100%',
                    'Deploy em 30 minutos',
                    'Sem contrato, cancele quando quiser',
                    'Suporte prioritário sempre',
                  ].map((item) => (
                    <li key={item} className="flex items-start gap-3 text-gray-700">
                      <span className="text-green-500 text-xl">✓</span>
                      {item}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
            <div className="text-center mt-8">
              <Link
                href="/comparativo"
                className="inline-flex items-center gap-2 text-primary-600 hover:text-primary-700 font-semibold"
              >
                Ver comparativo completo <ArrowRight size={18} />
              </Link>
            </div>
          </div>

          {/* FAQ */}
          <div className="mt-20 max-w-3xl mx-auto">
            <h2 className="text-2xl font-bold text-gray-900 mb-8 text-center">
              Perguntas frequentes
            </h2>
            <div className="space-y-4">
              {[
                {
                  q: 'Posso cancelar minha assinatura a qualquer momento?',
                  a: 'Sim. Sem contrato mínimo, sem multa. Você tem total liberdade.',
                },
                {
                  q: 'Qual é o limite de mensagens incluído?',
                  a: 'Cada plano tem um limite mensal. Mensagens extras são cobradas com desconto progressivo. Consulte a documentação para detalhes.',
                },
                {
                  q: 'Qual plano devo escolher?',
                  a: 'GROWTH é o mais popular para empresas pequenas e médias. Se você espera crescimento rápido, comece em SCALE. Estamos aqui para ajudar — entre em contato.',
                },
                {
                  q: 'Oferecem desconto para pagamento anual?',
                  a: 'Sim! Pague por 10 meses e use por 12 (2 meses grátis).',
                },
              ].map((item, i) => (
                <div key={i} className="bg-white border border-gray-200 rounded-lg p-5">
                  <p className="font-semibold text-gray-900 mb-2">{item.q}</p>
                  <p className="text-gray-600 text-sm">{item.a}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
      <Footer />
    </>
  );
}
