/**
 * Seleção pura das orgs que entram no digest diário ao superadmin.
 * Sem side-effects (o cron faz as queries/Slack/e-mail), para testar a regra.
 *
 * Entram no digest:
 *   - TRIAL a ≤ 3 dias do fim (não pago) → ação proativa antes de vencer.
 *   - Em carência ('soft' paywall, as 8 legadas) → a carência está acabando.
 */
import { computeAccessState, type AccessInput } from './accountAccess.js';

export type DigestReason = 'trial_ending' | 'grace_ending';

export interface DigestSignals extends AccessInput {
  /** injeta o relógio (default agora) — herda de AccessInput.now */
}

export interface DigestEntry {
  reason: DigestReason;
  /** dias restantes até vencer (trial) ou até a carência acabar. */
  daysLeft: number;
}

const MS_PER_DAY = 24 * 60 * 60 * 1000;

function daysUntil(target: Date | string | null | undefined, now: Date): number | null {
  if (target == null) return null;
  const t = target instanceof Date ? target : new Date(target);
  if (Number.isNaN(t.getTime())) return null;
  return Math.max(0, Math.ceil((t.getTime() - now.getTime()) / MS_PER_DAY));
}

/**
 * Decide se uma org entra no digest e por quê. Retorna null se não entra.
 * `now` vem de `signals.now` (default agora).
 */
export function digestEntryFor(signals: DigestSignals): DigestEntry | null {
  const now = signals.now ?? new Date();
  const { stage, paywall } = computeAccessState(signals);

  // Carência acabando (as 8 legadas): sempre relevante enquanto 'soft'.
  if (paywall === 'soft') {
    const graceLeft = daysUntil(signals.paywallGraceUntil, now) ?? 0;
    return { reason: 'grace_ending', daysLeft: graceLeft };
  }

  // Trial ativo a ≤ 3 dias do fim.
  if (stage === 'TRIAL') {
    const dtl = daysUntil(signals.trialEndsAt, now);
    if (dtl !== null && dtl <= 3) {
      return { reason: 'trial_ending', daysLeft: dtl };
    }
  }

  return null;
}
