'use client';

import { useRouter } from 'next/navigation';
import { useAuthStore } from '../../stores/authStore';

/**
 * Faixa de aviso no topo do dashboard para estados de paywall que NÃO travam.
 * - 'soft'     → trial vencido dentro da carência (só as 8 orgs legadas): mostra
 *                quantos dias faltam antes do bloqueio total.
 * - 'past_due' → pagamento pendente (dunning do Stripe): pede atualizar cartão.
 * 'hard' é redirecionado pelo AuthGuard, então não chega aqui. 'none' não renderiza.
 */
function daysLeft(iso?: string | null): number | null {
  if (!iso) return null;
  const ms = new Date(iso).getTime() - Date.now();
  if (Number.isNaN(ms)) return null;
  return Math.max(0, Math.ceil(ms / 86_400_000));
}

export function PaywallGate() {
  const router = useRouter();
  const org = useAuthStore((s) => s.organization);
  const paywall = org?.paywall;

  if (!org || (paywall !== 'soft' && paywall !== 'past_due')) return null;

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

  // soft
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
