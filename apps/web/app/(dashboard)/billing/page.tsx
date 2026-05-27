'use client';

import { useEffect, useState } from 'react';
import {
  listActivePlans,
  planAnnualMonthlyEquivalent,
  type PlanConfig,
} from '@zappiq/shared';
import {
  Check,
  ArrowRight,
  ExternalLink,
  Gift,
  Sparkles,
  Zap,
} from 'lucide-react';
import { api } from '../../../lib/api';
import { useAuthStore } from '../../../stores/authStore';

const PLANS: PlanConfig[] = listActivePlans();

type BillingCycle = 'monthly' | 'annual';

export default function BillingPage() {
  const { organization } = useAuthStore();
  const [loadingPlan, setLoadingPlan] = useState<string | null>(null);
  const [cycle, setCycle] = useState<BillingCycle>('monthly');

  async function handleCheckout(planId: string, billingCycle: BillingCycle) {
    setLoadingPlan(planId);
    try {
      const res = await api.post('/api/billing/checkout', { plan: planId, cycle: billingCycle });
      if (res.url) window.location.href = res.url;
    } catch (err: any) {
      alert(err.message || 'Erro ao iniciar checkout');
    }
    setLoadingPlan(null);
  }

  async function handlePortal() {
    try {
      const res = await api.get('/api/billing/portal');
      if (res.url) window.location.href = res.url;
    } catch {}
  }

  const currentPlan = organization?.plan || 'IZA_LITE';

  function renderPrice(plan: PlanConfig) {
    if (plan.priceMonthly === null) {
      return <span className="text-3xl font-extrabold text-gray-900">Sob consulta</span>;
    }
    const price = cycle === 'annual'
      ? planAnnualMonthlyEquivalent(plan)
      : plan.priceMonthly;
    return (
      <>
        <span className="text-3xl font-extrabold text-gray-900">
          R$ {(price ?? 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
        </span>
        <span className="text-sm text-gray-500">/mes</span>
        {cycle === 'annual' && (
          <span className="ml-2 inline-flex items-center gap-1 text-xs font-semibold text-emerald-700">
            20% off
          </span>
        )}
      </>
    );
  }

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Plano e Fatura</h1>
          <p className="text-sm text-gray-500 mt-1">
            Plano atual: <span className="font-semibold text-primary-600">{currentPlan}</span>
          </p>
        </div>
        <button
          onClick={handlePortal}
          className="flex items-center gap-2 px-4 py-2 border border-gray-200 rounded-lg text-sm font-medium text-gray-600 hover:bg-gray-50"
        >
          <ExternalLink size={16} /> Portal de faturas
        </button>
      </div>

      {/* Trial 14 dias HERO */}
      <div className="mb-6 bg-gradient-to-r from-emerald-50 via-teal-50 to-cyan-50 border border-emerald-200 rounded-2xl p-5 flex items-start gap-4">
        <div className="w-10 h-10 rounded-full bg-emerald-500 flex items-center justify-center flex-shrink-0">
          <Gift size={20} className="text-white" />
        </div>
        <div className="flex-1">
          <h3 className="text-sm font-bold text-emerald-900">
            Lite — 14 dias gratis pra validar
          </h3>
          <p className="text-xs text-emerald-800 mt-1 leading-relaxed">
            Sem cartao no inicio. Conecta WhatsApp, treina a IA, deixa a Iza atender. Apos 14 dias,
            R$ 249,90/mes (ou R$ 199,92/mes se voce trava o plano anual com 20% off antes do trial expirar).
          </p>
        </div>
      </div>

      {/* Billing cycle toggle */}
      <div className="mb-6 flex items-center justify-center gap-2">
        <div className="inline-flex bg-gray-100 rounded-full p-1">
          <button
            onClick={() => setCycle('monthly')}
            className={`px-4 py-1.5 rounded-full text-sm font-medium transition-colors ${
              cycle === 'monthly' ? 'bg-white shadow text-gray-900' : 'text-gray-500'
            }`}
          >
            Mensal
          </button>
          <button
            onClick={() => setCycle('annual')}
            className={`px-4 py-1.5 rounded-full text-sm font-medium transition-colors flex items-center gap-1.5 ${
              cycle === 'annual' ? 'bg-white shadow text-gray-900' : 'text-gray-500'
            }`}
          >
            Anual
            <span className="text-[10px] font-bold bg-emerald-100 text-emerald-700 px-1.5 py-0.5 rounded-full">
              -20%
            </span>
          </button>
        </div>
      </div>

      {/* Plans */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6">
        {PLANS.map((plan) => {
          const isCurrent = currentPlan === plan.id;
          const hasTrial = (plan.trialDays ?? 0) > 0;
          return (
            <div
              key={plan.id}
              className={`bg-white rounded-2xl border-2 p-6 relative transition-shadow ${
                plan.highlight ? 'border-primary-500 shadow-lg shadow-primary-100' : 'border-gray-200'
              }`}
            >
              {plan.highlight && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-primary-500 text-white text-xs font-bold px-3 py-1 rounded-full flex items-center gap-1">
                  <Sparkles size={12} /> Mais escolhido
                </div>
              )}
              {hasTrial && (
                <div className="absolute -top-3 right-4 bg-emerald-500 text-white text-[10px] font-bold px-2 py-1 rounded-full flex items-center gap-1">
                  <Gift size={10} /> {plan.trialDays}d gratis
                </div>
              )}

              <div className="mb-4">
                <h3 className="text-lg font-bold text-gray-900">{plan.name}</h3>
                <p className="text-xs text-gray-500 mt-1">{plan.description}</p>
              </div>

              <div className="mb-6">{renderPrice(plan)}</div>

              <ul className="space-y-2.5 mb-6">
                {plan.bullets.slice(0, 10).map((f) => (
                  <li key={f} className="flex items-start gap-2 text-sm text-gray-600">
                    <Check size={16} className="text-primary-500 flex-shrink-0 mt-0.5" />
                    {f}
                  </li>
                ))}
              </ul>

              {isCurrent ? (
                <div className="w-full py-2.5 text-center rounded-lg bg-gray-100 text-sm font-medium text-gray-500">
                  Plano atual
                </div>
              ) : (
                <button
                  onClick={() => handleCheckout(plan.id, cycle)}
                  disabled={loadingPlan === plan.id}
                  className={`w-full py-2.5 rounded-lg text-sm font-medium transition-colors flex items-center justify-center gap-2 ${
                    plan.highlight
                      ? 'bg-primary-500 text-white hover:bg-primary-600'
                      : 'border border-gray-200 text-gray-700 hover:bg-gray-50'
                  } disabled:opacity-50`}
                >
                  {loadingPlan === plan.id ? (
                    'Redirecionando...'
                  ) : (
                    <>
                      {hasTrial ? `Comecar ${plan.trialDays}d gratis` : 'Assinar'}{' '}
                      <ArrowRight size={14} />
                    </>
                  )}
                </button>
              )}
            </div>
          );
        })}
      </div>

      {/* Add-ons */}
      <div className="mt-10">
        <div className="flex items-center gap-2 mb-3">
          <Zap size={18} className="text-amber-500" />
          <h3 className="text-base font-bold text-gray-900">Add-ons (cobrados alem do plano)</h3>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
          {[
            { name: 'Voice add-on', desc: '6 pacotes (200 a 4.000 min/mes)', price: 'R$ 79,90 a R$ 929,90/mes' },
            { name: 'Mensagens IA extras', desc: 'Pacote 10.000 mensagens', price: 'R$ 197 / pacote' },
            { name: 'Disparos extras', desc: 'Pacote 10.000 disparos', price: 'R$ 247 / pacote' },
            { name: 'Atendente extra', desc: 'Seat adicional', price: 'R$ 89/mes' },
            { name: 'Numero WA adicional', desc: '+ 1 numero com fila propria', price: 'R$ 147/mes' },
            { name: 'Integracao Meta gerenciada', desc: 'Embedded Signup + configuracao', price: 'R$ 297 setup' },
          ].map((a) => (
            <div key={a.name} className="border border-gray-200 rounded-xl p-4">
              <p className="text-sm font-semibold text-gray-900">{a.name}</p>
              <p className="text-xs text-gray-500 mt-1">{a.desc}</p>
              <p className="text-xs font-medium text-primary-600 mt-2">{a.price}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Outcome beta hint (so renderiza se org tem flag) */}
      {organization && (organization as any).outcomeBetaEnabled && (
        <div className="mt-8 bg-gradient-to-r from-purple-50 to-indigo-50 border border-purple-200 rounded-2xl p-5">
          <h3 className="text-sm font-bold text-purple-900 flex items-center gap-2">
            <Sparkles size={16} /> Beta — Conversa Convertida (outcome-based)
          </h3>
          <p className="text-xs text-purple-800 mt-2 leading-relaxed">
            Voce esta no beta privado de pricing por resultado. R$ 19,90 por lead qualificado
            (score &gt;60) ou R$ 89 por oportunidade criada pela Iza. Cap mensal R$ 1.997 durante
            os primeiros 60 dias pra calibrar.
          </p>
        </div>
      )}

      {/* Usage info */}
      <div className="mt-8 bg-white rounded-xl border border-gray-100 p-6">
        <h3 className="text-sm font-semibold text-gray-900 mb-4">Uso do plano atual</h3>
        <div className="grid grid-cols-3 gap-6">
          <div>
            <p className="text-xs text-gray-500 mb-1">Conversas este mes</p>
            <div className="flex items-center gap-3">
              <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden">
                <div className="h-full bg-primary-500 rounded-full" style={{ width: '34%' }} />
              </div>
              <span className="text-sm font-semibold text-gray-700">340 / 1.000</span>
            </div>
          </div>
          <div>
            <p className="text-xs text-gray-500 mb-1">Atendentes</p>
            <div className="flex items-center gap-3">
              <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden">
                <div className="h-full bg-secondary-500 rounded-full" style={{ width: '20%' }} />
              </div>
              <span className="text-sm font-semibold text-gray-700">1 / 5</span>
            </div>
          </div>
          <div>
            <p className="text-xs text-gray-500 mb-1">Documentos na base</p>
            <div className="flex items-center gap-3">
              <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden">
                <div className="h-full bg-accent-500 rounded-full" style={{ width: '60%' }} />
              </div>
              <span className="text-sm font-semibold text-gray-700">3 / 5</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
