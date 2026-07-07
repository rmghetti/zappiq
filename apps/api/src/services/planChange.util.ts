/* ══════════════════════════════════════════════════════════════════════
 * planChange.util — regra PURA de classificação de troca de plano.
 * --------------------------------------------------------------------
 * A lógica vive em @zappiq/shared (packages/shared/src/planChange.ts) para
 * ser compartilhada com o web (rótulo dos CTAs no /billing). Aqui só
 * re-exportamos, mantendo o import estável no backend.
 * ══════════════════════════════════════════════════════════════════════ */

export {
  classifyPlanChange,
  isImmediateCharge,
  isScheduled,
  type PlanTier,
  type BillingCycle,
  type PlanSelection,
  type PlanChangeKind,
  type EffectiveTiming,
  type PlanChangeClassification,
} from '@zappiq/shared';
