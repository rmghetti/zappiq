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
  CalendarClock,
  Receipt,
  AlertTriangle,
  CheckCircle2,
  CircleSlash,
} from 'lucide-react';
import { api } from '../../../lib/api';
import { useAuthStore } from '../../../stores/authStore';
import { RecommendationHero } from './RecommendationHero';

const PLANS: PlanConfig[] = listActivePlans();

type BillingCycle = 'monthly' | 'annual';

type UsageMetric = { used: number; limit: number };
type BillingUsage = {
  planId: string;
  period: string;
  conversas: UsageMetric;
  atendentes: UsageMetric;
  docs: UsageMetric;
  aiMessages: UsageMetric;
};

// FEATURE 5b.1 — estado REAL da assinatura (GET /api/billing/subscription)
type SubscriptionStatus = 'active' | 'past_due' | 'canceled' | 'trialing' | 'no_subscription';
type InvoiceView = {
  amountBrlCents: number;
  status: string;
  periodStart: string | null;
  periodEnd: string | null;
  paidAt: string | null;
};
type SubscriptionState = {
  status: SubscriptionStatus;
  hasStripeSubscription: boolean;
  cycle: 'monthly' | 'annual' | null;
  plan: string;
  trialEndsAt: string | null;
  trialDaysLeft: number | null;
  nextInvoice?: { dueAt: string };
  lastInvoice?: InvoiceView;
};

export default function BillingPage() {
  const { organization } = useAuthStore();
  const [loadingPlan, setLoadingPlan] = useState<string | null>(null);
  // Trial Enforcement: anual é o padrão em destaque (empurra o desconto de 20%).
  const [cycle, setCycle] = useState<BillingCycle>('annual');
  const [usage, setUsage] = useState<BillingUsage | null>(null);
  const [usageLoading, setUsageLoading] = useState(true);
  const [subscription, setSubscription] = useState<SubscriptionState | null>(null);
  const [subLoading, setSubLoading] = useState(true);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const res = await api.get('/api/billing/usage');
        if (active && res?.data) setUsage(res.data as BillingUsage);
      } catch {
        // fail-soft: sem uso, a UI mostra estado vazio ao inves de mock
      } finally {
        if (active) setUsageLoading(false);
      }
    })();
    (async () => {
      try {
        const res = await api.get('/api/billing/subscription');
        if (active && res?.data) setSubscription(res.data as SubscriptionState);
      } catch {
        // fail-soft: sem assinatura carregada, a UI mostra estado neutro
      } finally {
        if (active) setSubLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  async function handleCheckout(planId: string, billingCycle: BillingCycle, addons?: string[]) {
    setLoadingPlan(planId);
    try {
      const res = await api.post('/api/billing/checkout', {
        plan: planId,
        cycle: billingCycle,
        ...(addons && addons.length ? { addons } : {}),
      });
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

  // Estado canônico vem do lifecycleStage (computeAccessState no /me) — nunca
  // do subscriptionStatus cru. Regras dos CTAs:
  //  - "Plano atual" (desabilitado) só pra quem TEM assinatura paga real.
  //  - Em trial, o plano testado vira o CTA principal ("Assinar agora").
  //  - Oferta de trial só pra org que nunca testou nem pagou (trial é um por org).
  const stage = organization?.lifecycleStage;
  const hasPaidSub = stage === 'ACTIVE' || stage === 'PAST_DUE';
  const inTrial = stage === 'TRIAL';
  const usedTrial =
    inTrial || !!organization?.trialEndsAt || !!organization?.trialStartedAt;

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

      {/* Estado REAL da assinatura (FEATURE 5b.1) */}
      <SubscriptionCard loading={subLoading} sub={subscription} />

      {/* Trial Enforcement — hero de conversão (plano recomendado + anual) quando
          o trial venceu (paywall) ou a pessoa chega por link de trial acabando. */}
      <RecommendationHero
        paywall={organization?.paywall}
        trialActive={inTrial}
        trialDaysLeft={subscription?.trialDaysLeft}
        onChoose={handleCheckout}
        loadingPlan={loadingPlan}
      />

      {/* Promo do trial Lite — SO pra org que nunca testou nem pagou. Quem já
          está em trial (ou venceu) não pode ganhar outro, e mostrar isso pra
          quem testa o Growth empurraria downgrade. */}
      {!hasPaidSub && !usedTrial &&
       organization?.paywall !== 'hard' && organization?.paywall !== 'soft' && (
      <div className="mb-6 bg-gradient-to-r from-emerald-50 via-teal-50 to-cyan-50 border border-emerald-200 rounded-2xl p-5 flex items-start gap-4">
        <div className="w-10 h-10 rounded-full bg-emerald-500 flex items-center justify-center flex-shrink-0">
          <Gift size={20} className="text-white" />
        </div>
        <div className="flex-1">
          <h3 className="text-sm font-bold text-emerald-900">
            Lite — 14 dias gratis pra validar
          </h3>
          <p className="text-xs text-emerald-800 mt-1 leading-relaxed">
            Sem cartao no início. Conecta WhatsApp, treina a IA, deixa a Iza atender. Após 14 dias,
            R$ 249,90/mes (ou R$ 199,92/mes se você trava o plano anual com 20% off antes do trial expirar).
          </p>
        </div>
      </div>
      )}

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
          // "Plano atual" imutável só com assinatura paga de verdade; em trial o
          // plano testado é justamente o que a pessoa PRECISA conseguir assinar.
          const isCurrentPaid = isCurrent && hasPaidSub;
          const isTrialPlan = isCurrent && inTrial;
          // Trial é um por org: sem nova oferta pra quem já testou ou já paga.
          const offerTrial = (plan.trialDays ?? 0) > 0 && !usedTrial && !hasPaidSub;
          return (
            <div
              key={plan.id}
              className={`bg-white rounded-2xl border-2 p-6 relative transition-shadow ${
                plan.highlight || isTrialPlan
                  ? 'border-primary-500 shadow-lg shadow-primary-100'
                  : 'border-gray-200'
              }`}
            >
              {plan.highlight && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-primary-500 text-white text-xs font-bold px-3 py-1 rounded-full flex items-center gap-1">
                  <Sparkles size={12} /> Mais escolhido
                </div>
              )}
              {isTrialPlan ? (
                <div className="absolute -top-3 right-4 bg-teal-500 text-white text-[10px] font-bold px-2 py-1 rounded-full flex items-center gap-1">
                  <Gift size={10} /> Seu plano do teste
                </div>
              ) : offerTrial ? (
                <div className="absolute -top-3 right-4 bg-emerald-500 text-white text-[10px] font-bold px-2 py-1 rounded-full flex items-center gap-1">
                  <Gift size={10} /> {plan.trialDays}d gratis
                </div>
              ) : null}

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

              {isCurrentPaid ? (
                <div className="w-full py-2.5 text-center rounded-lg bg-gray-100 text-sm font-medium text-gray-500">
                  Plano atual
                </div>
              ) : plan.priceMonthly === null ? (
                // Sob consulta (Enterprise) não tem checkout — antes o "Assinar"
                // chamava POST /checkout com plano inválido e estourava 400.
                <a
                  href="mailto:founders@zappiq.com.br?subject=Plano%20Enterprise%20ZappIQ"
                  className="w-full py-2.5 rounded-lg text-sm font-medium transition-colors flex items-center justify-center gap-2 border border-gray-200 text-gray-700 hover:bg-gray-50"
                >
                  Falar com vendas <ArrowRight size={14} />
                </a>
              ) : (
                <button
                  onClick={() => handleCheckout(plan.id, cycle)}
                  disabled={loadingPlan === plan.id}
                  className={`w-full py-2.5 rounded-lg text-sm font-medium transition-colors flex items-center justify-center gap-2 ${
                    plan.highlight || isTrialPlan
                      ? 'bg-primary-500 text-white hover:bg-primary-600'
                      : 'border border-gray-200 text-gray-700 hover:bg-gray-50'
                  } disabled:opacity-50`}
                >
                  {loadingPlan === plan.id ? (
                    'Redirecionando...'
                  ) : (
                    <>
                      {isTrialPlan
                        ? `Assinar ${plan.name} agora`
                        : offerTrial
                          ? `Comecar ${plan.trialDays}d gratis`
                          : 'Assinar'}{' '}
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
          <h3 className="text-base font-bold text-gray-900">Add-ons (cobrados além do plano)</h3>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
          {[
            { name: 'Voice add-on', desc: '6 pacotes (200 a 4.000 min/mes)', price: 'R$ 79,90 a R$ 929,90/mes' },
            { name: 'Mensagens IA extras', desc: 'Pacote 10.000 mensagens', price: 'R$ 197 / pacote' },
            { name: 'Disparos extras', desc: 'Pacote 10.000 disparos', price: 'R$ 247 / pacote' },
            { name: 'Atendente extra', desc: 'Seat adicional', price: 'R$ 89/mes' },
            { name: 'Número WA adicional', desc: '+ 1 número com fila própria', price: 'R$ 147/mes' },
            { name: 'Integração Meta gerenciada', desc: 'Embedded Signup + configuração', price: 'R$ 297 setup' },
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
            Você esta no beta privado de pricing por resultado. R$ 19,90 por lead qualificado
            (score &gt;60) ou R$ 89 por oportunidade criada pela Iza. Cap mensal R$ 1.997 durante
            os primeiros 60 dias pra calibrar.
          </p>
        </div>
      )}

      {/* Usage info — dados REAIS via GET /api/billing/usage (FIX W3.1) */}
      <div className="mt-8 bg-white rounded-xl border border-gray-100 p-6">
        <h3 className="text-sm font-semibold text-gray-900 mb-4">Uso do plano atual</h3>
        {usageLoading ? (
          <p className="text-sm text-gray-400">Carregando uso...</p>
        ) : !usage ? (
          <p className="text-sm text-gray-400">Nao foi possivel carregar o uso agora.</p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-6">
            <UsageBar label="Conversas este mes" metric={usage.conversas} colorClass="bg-primary-500" />
            <UsageBar label="Atendentes" metric={usage.atendentes} colorClass="bg-secondary-500" />
            <UsageBar label="Documentos na base" metric={usage.docs} colorClass="bg-accent-500" />
            <UsageBar label="Mensagens de IA" metric={usage.aiMessages} colorClass="bg-primary-500" />
          </div>
        )}
      </div>
    </div>
  );
}

const CYCLE_LABEL: Record<string, string> = { monthly: 'Mensal', annual: 'Anual' };

function formatBRL(cents: number): string {
  return (cents / 100).toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  });
}

function formatDate(iso: string | null): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' });
}

const STATUS_META: Record<
  SubscriptionStatus,
  { label: string; badge: string; Icon: typeof CheckCircle2; note: string }
> = {
  active: {
    label: 'Assinatura ativa',
    badge: 'bg-emerald-100 text-emerald-700',
    Icon: CheckCircle2,
    note: 'Sua assinatura esta em dia.',
  },
  trialing: {
    label: 'Em período de teste',
    badge: 'bg-teal-100 text-teal-700',
    Icon: Gift,
    note: 'Você esta no trial. Sem cobrança até o fim do período.',
  },
  past_due: {
    label: 'Pagamento pendente',
    badge: 'bg-amber-100 text-amber-800',
    Icon: AlertTriangle,
    note: 'Houve um problema na última cobrança. Atualize o pagamento no portal.',
  },
  canceled: {
    label: 'Assinatura cancelada',
    badge: 'bg-gray-200 text-gray-700',
    Icon: CircleSlash,
    note: 'Sua assinatura foi cancelada. Escolha um plano abaixo para reativar.',
  },
  no_subscription: {
    label: 'Sem assinatura',
    badge: 'bg-gray-100 text-gray-600',
    Icon: CircleSlash,
    note: 'Você ainda não tem uma assinatura ativa. Escolha um plano abaixo.',
  },
};

function SubscriptionCard({
  loading,
  sub,
}: {
  loading: boolean;
  sub: SubscriptionState | null;
}) {
  if (loading) {
    return (
      <div className="mb-6 bg-white rounded-2xl border border-gray-100 p-5">
        <p className="text-sm text-gray-400">Carregando assinatura...</p>
      </div>
    );
  }
  if (!sub) {
    // fail-soft: nao inventa estado; deixa a tela seguir com os planos abaixo.
    return null;
  }

  const meta = STATUS_META[sub.status];
  const { Icon } = meta;
  const cycleLabel = sub.cycle ? CYCLE_LABEL[sub.cycle] : null;

  return (
    <div className="mb-6 bg-white rounded-2xl border border-gray-100 p-5">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-full bg-gray-50 flex items-center justify-center flex-shrink-0">
            <Icon size={20} className="text-gray-700" />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <span
                className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold ${meta.badge}`}
              >
                {meta.label}
              </span>
              <span className="text-sm font-semibold text-gray-900">{sub.plan}</span>
              {cycleLabel && (
                <span className="text-xs text-gray-500">· ciclo {cycleLabel}</span>
              )}
            </div>
            <p className="text-xs text-gray-500 mt-1 leading-relaxed max-w-xl">{meta.note}</p>
          </div>
        </div>

        {sub.status === 'trialing' && sub.trialDaysLeft !== null && (
          <div className="text-right">
            <p className="text-2xl font-extrabold text-teal-600 leading-none">
              {sub.trialDaysLeft}
            </p>
            <p className="text-[11px] text-gray-500 mt-1">
              {sub.trialDaysLeft === 1 ? 'dia restante' : 'dias restantes'}
            </p>
          </div>
        )}
      </div>

      {/* Proxima / ultima fatura — dados reais das stripe_invoices */}
      {(sub.nextInvoice || sub.lastInvoice) && (
        <div className="mt-4 pt-4 border-t border-gray-100 grid grid-cols-1 sm:grid-cols-2 gap-4">
          {sub.nextInvoice && (
            <div className="flex items-start gap-2">
              <CalendarClock size={16} className="text-gray-400 mt-0.5 flex-shrink-0" />
              <div>
                <p className="text-xs text-gray-500">Próxima cobrança</p>
                <p className="text-sm font-semibold text-gray-900">
                  {formatDate(sub.nextInvoice.dueAt)}
                </p>
              </div>
            </div>
          )}
          {sub.lastInvoice && (
            <div className="flex items-start gap-2">
              <Receipt size={16} className="text-gray-400 mt-0.5 flex-shrink-0" />
              <div>
                <p className="text-xs text-gray-500">Última fatura</p>
                <p className="text-sm font-semibold text-gray-900">
                  {formatBRL(sub.lastInvoice.amountBrlCents)}
                  {sub.lastInvoice.paidAt && (
                    <span className="ml-1 text-xs font-normal text-gray-500">
                      · paga em {formatDate(sub.lastInvoice.paidAt)}
                    </span>
                  )}
                </p>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function UsageBar({
  label,
  metric,
  colorClass,
}: {
  label: string;
  metric: { used: number; limit: number };
  colorClass: string;
}) {
  const unlimited = metric.limit < 0;
  const pct = unlimited
    ? 0
    : metric.limit === 0
      ? metric.used > 0
        ? 100
        : 0
      : Math.min(100, Math.round((metric.used / metric.limit) * 100));
  const fmt = (n: number) => n.toLocaleString('pt-BR');
  return (
    <div>
      <p className="text-xs text-gray-500 mb-1">{label}</p>
      <div className="flex items-center gap-3">
        <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden">
          <div className={`h-full ${colorClass} rounded-full`} style={{ width: `${unlimited ? 100 : pct}%` }} />
        </div>
        <span className="text-sm font-semibold text-gray-700 whitespace-nowrap">
          {unlimited ? `${fmt(metric.used)} / ilimitado` : `${fmt(metric.used)} / ${fmt(metric.limit)}`}
        </span>
      </div>
    </div>
  );
}
