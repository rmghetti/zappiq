'use client';

import { useEffect, useState } from 'react';
import { CreditCard, Check, Zap, ArrowRight, ExternalLink } from 'lucide-react';
import { api } from '../../../lib/api';
import { useAuthStore } from '../../../stores/authStore';

const PLANS = [
  {
    id: 'STARTER',
    name: 'Starter',
    price: 197,
    desc: 'Para profissionais liberais e solopreneurs',
    features: [
      '1 número WhatsApp',
      '1.000 conversas/mês',
      'Agente IA 24/7',
      'Agendamento automático',
      'Base de conhecimento (5 docs)',
    ],
    highlight: false,
  },
  {
    id: 'GROWTH',
    name: 'Growth',
    price: 497,
    desc: 'Para PMEs com equipe de atendimento',
    features: [
      'Tudo do Starter +',
      '5 atendentes simultâneos',
      '5.000 conversas/mês',
      'CRM e pipeline de leads',
      'Campanhas em massa',
      'Analytics avançado',
      'Integrações (HubSpot, RD)',
    ],
    highlight: true,
  },
  {
    id: 'SCALE',
    name: 'Scale',
    price: 1197,
    desc: 'Para franquias, redes e múltiplas unidades',
    features: [
      'Tudo do Growth +',
      'Atendentes ilimitados',
      'Conversas ilimitadas',
      'White-label com sua marca',
      'API aberta',
      'Múltiplos números',
      'Gerente de sucesso dedicado',
    ],
    highlight: false,
  },
];

export default function BillingPage() {
  const { organization } = useAuthStore();
  const [loadingPlan, setLoadingPlan] = useState<string | null>(null);

  async function handleCheckout(planId: string) {
    setLoadingPlan(planId);
    try {
      const res = await api.post('/api/billing/checkout', { plan: planId });
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

  const currentPlan = organization?.plan || 'STARTER';

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Plano & Fatura</h1>
          <p className="text-sm text-gray-500 mt-1">
            Plano atual: <span className="font-semibold text-primary-600">{currentPlan}</span>
          </p>
        </div>
        <button onClick={handlePortal}
          className="flex items-center gap-2 px-4 py-2 border border-gray-200 rounded-lg text-sm font-medium text-gray-600 hover:bg-gray-50">
          <ExternalLink size={16} /> Portal de faturas
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {PLANS.map((plan) => {
          const isCurrent = currentPlan === plan.id;
          return (
            <div key={plan.id} className={`bg-white rounded-2xl border-2 p-6 relative transition-shadow ${
              plan.highlight ? 'border-primary-500 shadow-lg shadow-primary-100' : 'border-gray-200'
            }`}>
              {plan.highlight && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-primary-500 text-white text-xs font-bold px-3 py-1 rounded-full">
                  Mais popular
                </div>
              )}

              <div className="mb-4">
                <h3 className="text-lg font-bold text-gray-900">{plan.name}</h3>
                <p className="text-xs text-gray-500 mt-1">{plan.desc}</p>
              </div>

              <div className="mb-6">
                <span className="text-3xl font-extrabold text-gray-900">R$ {plan.price}</span>
                <span className="text-sm text-gray-500">/mês</span>
              </div>

              <ul className="space-y-2.5 mb-6">
                {plan.features.map((f) => (
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
                <button onClick={() => handleCheckout(plan.id)} disabled={loadingPlan === plan.id}
                  className={`w-full py-2.5 rounded-lg text-sm font-medium transition-colors flex items-center justify-center gap-2 ${
                    plan.highlight
                      ? 'bg-primary-500 text-white hover:bg-primary-600'
                      : 'border border-gray-200 text-gray-700 hover:bg-gray-50'
                  } disabled:opacity-50`}>
                  {loadingPlan === plan.id ? 'Redirecionando...' : (
                    <>{currentPlan === 'SCALE' ? 'Downgrade' : 'Assinar'} <ArrowRight size={14} /></>
                  )}
                </button>
              )}
            </div>
          );
        })}
      </div>

      {/* Usage info */}
      <div className="mt-8 bg-white rounded-xl border border-gray-100 p-6">
        <h3 className="text-sm font-semibold text-gray-900 mb-4">Uso do plano atual</h3>
        <div className="grid grid-cols-3 gap-6">
          <div>
            <p className="text-xs text-gray-500 mb-1">Conversas este mês</p>
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
