'use client';

import { useRouter, usePathname } from 'next/navigation';
import { useAuthStore } from '../../stores/authStore';

/**
 * Faixa de aviso no topo do dashboard para estados que NÃO travam.
 * - TRIAL ativo → contagem do teste (dia N de X, dias restantes) + CTA de
 *                 assinar o plano já escolhido, em toda rota do dash (menos
 *                 /billing, onde o CTA seria redundante).
 * - 'soft'     → trial vencido dentro da carência (só as 8 orgs legadas): mostra
 *                quantos dias faltam antes do bloqueio total.
 * - 'past_due' → pagamento pendente (dunning do Stripe): pede atualizar cartão.
 * 'hard' é redirecionado pelo AuthGuard, então não chega aqui. 'none' pagante
 * não renderiza nada.
 */
function daysLeft(iso?: string | null): number | null {
  if (!iso) return null;
  const ms = new Date(iso).getTime() - Date.now();
  if (Number.isNaN(ms)) return null;
  return Math.max(0, Math.ceil(ms / 86_400_000));
}

function daysSince(iso?: string | null): number | null {
  if (!iso) return null;
  const ms = Date.now() - new Date(iso).getTime();
  if (Number.isNaN(ms) || ms < 0) return null;
  return Math.max(1, Math.ceil(ms / 86_400_000));
}

const PLAN_LABELS: Record<string, string> = {
  IZA_LITE: 'Iza Lite',
  GROWTH: 'Growth',
  SCALE: 'Scale',
  ENTERPRISE: 'Enterprise',
};

export function PaywallGate() {
  const router = useRouter();
  const pathname = usePathname();
  const org = useAuthStore((s) => s.organization);
  const paywall = org?.paywall;

  if (!org) return null;

  if (paywall === 'past_due') {
    return (
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-red-200 bg-red-50 px-6 py-3">
        <p className="text-sm font-medium text-red-800">
          Pagamento pendente. Atualize seu método de pagamento para não perder o acesso.
        </p>
        <button
          onClick={() => router.push('/billing')}
          className="rounded-lg bg-red-600 px-4 py-1.5 text-sm font-semibold text-white hover:bg-red-700"
        >
          Regularizar pagamento
        </button>
      </div>
    );
  }

  if (paywall === 'soft') {
    const left = daysLeft(org.paywallGraceUntil);
    const prazo =
      left === null ? 'por tempo limitado' : left <= 0 ? 'até hoje' : `por mais ${left} ${left === 1 ? 'dia' : 'dias'}`;
    return (
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-amber-200 bg-amber-50 px-6 py-3">
        <p className="text-sm font-medium text-amber-900">
          Seu teste terminou. Você mantém acesso {prazo}. Escolha um plano agora para continuar sem interrupção.
        </p>
        <button
          onClick={() => router.push('/billing?reason=trial_expired')}
          className="rounded-lg bg-amber-500 px-4 py-1.5 text-sm font-semibold text-white hover:bg-amber-600"
        >
          Escolher plano
        </button>
      </div>
    );
  }

  // TRIAL ativo — lembrete permanente com contagem + CTA de conversão
  // antecipada. lifecycleStage vem do computeAccessState (fonte única).
  const inTrial =
    org.lifecycleStage === 'TRIAL' && !org.trialConverted && (daysLeft(org.trialEndsAt) ?? 0) > 0;
  if (!inTrial || pathname?.startsWith('/billing')) return null;

  const left = daysLeft(org.trialEndsAt) ?? 0;
  const dayN = daysSince(org.trialStartedAt);
  const planLabel = PLAN_LABELS[org.plan] ?? org.plan;

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 border-b border-teal-200 bg-teal-50 px-6 py-3">
      <p className="text-sm font-medium text-teal-900">
        Você está no teste grátis do <span className="font-bold">{planLabel}</span>
        {dayN !== null && <> · dia {dayN} do teste</>}
        {' '}· {left === 1 ? 'falta 1 dia' : `faltam ${left} dias`}. Assine agora e continue sem interrupção
        (no anual você trava 20% de desconto).
      </p>
      <button
        onClick={() => router.push('/billing?reason=trial_active')}
        className="rounded-lg bg-teal-600 px-4 py-1.5 text-sm font-semibold text-white hover:bg-teal-700"
      >
        Assinar {planLabel} agora
      </button>
    </div>
  );
}
