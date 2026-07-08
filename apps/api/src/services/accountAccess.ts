/* ══════════════════════════════════════════════════════════════════════
 * accountAccess — decisão de PAYWALL a partir do lifecycle canônico.
 * --------------------------------------------------------------------
 * Fonte ÚNICA da regra de acesso. Consumida por:
 *   - middleware requireActivePlan (API → 402, fronteira de segurança)
 *   - GET /api/auth/me (web → AuthGuard redireciona, só UX)
 *
 * Nunca lê subscriptionStatus cru: delega ao deriveLifecycleStage, que
 * exige stripeSubscriptionId real p/ ACTIVE (o incidente Antonella tinha
 * subscriptionStatus="trialing" numa conta que nunca pagou).
 *
 * Carência (paywallGraceUntil): cortesia de migração APENAS para as orgs
 * já vencidas no go-live. Só afeta TRIAL_EXPIRED; CHURNED trava na hora.
 * Política go-forward = dura no T-0 (paywallGraceUntil fica null).
 * ══════════════════════════════════════════════════════════════════════ */
import {
  deriveLifecycleStage,
  type LifecycleStage,
  type LifecycleInput,
} from './accountLifecycle.js';

export type PaywallMode = 'none' | 'soft' | 'hard' | 'past_due';

export interface AccessState {
  stage: LifecycleStage;
  paywall: PaywallMode;
}

export interface AccessInput extends LifecycleInput {
  /** Fim da janela de carência (só setado nas orgs já vencidas na migração). */
  paywallGraceUntil?: Date | string | null;
}

function toDate(v: Date | string | null | undefined): Date | null {
  if (v == null) return null;
  const d = v instanceof Date ? v : new Date(v);
  return Number.isNaN(d.getTime()) ? null : d;
}

/**
 * Decide o modo de paywall a partir dos sinais crus da org.
 * Pura e determinística (injete `now` via input.now para congelar o relógio).
 *
 * - none      → ACTIVE, TRIAL (em janela) ou NOVO (onboarding): acesso total.
 * - past_due  → assinatura inadimplente: acessa, mas com aviso + portal.
 * - soft      → TRIAL_EXPIRED dentro da carência: acessa, com banner agressivo.
 * - hard      → TRIAL_EXPIRED (sem/pós carência) ou CHURNED: bloqueio total.
 */
export function computeAccessState(input: AccessInput): AccessState {
  const now = input.now ?? new Date();
  const stage = deriveLifecycleStage(input);

  if (stage === 'ACTIVE' || stage === 'TRIAL' || stage === 'NOVO') {
    return { stage, paywall: 'none' };
  }
  if (stage === 'PAST_DUE') {
    return { stage, paywall: 'past_due' };
  }
  // TRIAL_EXPIRED | CHURNED → bloqueio. Carência só vale p/ TRIAL_EXPIRED.
  if (stage === 'TRIAL_EXPIRED') {
    const grace = toDate(input.paywallGraceUntil);
    if (grace && grace > now) {
      return { stage, paywall: 'soft' };
    }
  }
  return { stage, paywall: 'hard' };
}
