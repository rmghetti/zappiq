/* ══════════════════════════════════════════════════════════════════════
 * accountLifecycle — estado canônico de conta (Área Clientes / Fase 1).
 * --------------------------------------------------------------------
 * Função PURA deriveLifecycleStage(). O estágio nunca é lido de um único
 * booleano cru (isTrialActive / trialConverted / subscriptionStatus são
 * individualmente não-confiáveis — 7 falsos-positivos de seed em prod).
 *
 * Regra de ouro (§1 da spec): ATIVO/pagante exige stripeSubscriptionId REAL,
 * nunca trialConverted. "Ativo por engajamento" (mandou mensagem) é outra
 * coisa e NÃO entra aqui.
 *
 * Precedência (primeiro que casar vence):
 *   CHURNED        ← churnedAt != null (ou subscription deletada após pagar)
 *   PAST_DUE       ← subscriptionStatus in ('past_due','unpaid')
 *   ACTIVE         ← stripeSubscriptionId real AND status in ('active','trialing')
 *   TRIAL          ← isTrialActive AND trialEndsAt > now AND NOT trialConverted
 *   TRIAL_EXPIRED  ← trialEndsAt < now AND paidAt == null AND churnedAt == null
 *   NOVO           ← fallback (signup confirmado sem org OU org recém-criada)
 *
 * A comparação de trial (trialEndsAt vs now) é feita AQUI em JS — a spec proíbe
 * converter tipos de coluna no banco (organizations.trialEndsAt é timestamp
 * without time zone vs signups with time zone). Normalizamos no service layer.
 * ══════════════════════════════════════════════════════════════════════ */

export type LifecycleStage =
  | 'CHURNED'
  | 'PAST_DUE'
  | 'ACTIVE'
  | 'TRIAL'
  | 'TRIAL_EXPIRED'
  | 'NOVO';

export interface LifecycleInput {
  /** Cancelamento efetivo. Presença => CHURNED (maior precedência). */
  churnedAt?: Date | string | null;
  /** Status vindo do Stripe (subscription.status). */
  subscriptionStatus?: string | null;
  /** ÂNCORA de ACTIVE. Sem isso, nunca é pagante — trialConverted é ignorado. */
  stripeSubscriptionId?: string | null;
  /** Fim da janela de trial. */
  trialEndsAt?: Date | string | null;
  /** Flag de trial ativo (usada só em conjunto, nunca sozinha). */
  isTrialActive?: boolean | null;
  /** Seed marca isso como true sem pagamento real — jamais promove a ACTIVE. */
  trialConverted?: boolean | null;
  /** 1º pagamento confirmado. Usado para distinguir TRIAL_EXPIRED. */
  paidAt?: Date | string | null;
  /** Relógio injetável para testes determinísticos. Default = agora. */
  now?: Date;
}

function toDate(v: Date | string | null | undefined): Date | null {
  if (v == null) return null;
  const d = v instanceof Date ? v : new Date(v);
  return Number.isNaN(d.getTime()) ? null : d;
}

const PAST_DUE_STATUSES = new Set(['past_due', 'unpaid']);
const ACTIVE_STATUSES = new Set(['active', 'trialing']);

/**
 * Deriva o lifecycleStage canônico a partir dos sinais crus.
 * Pura, determinística e testável (injete `now` para congelar o relógio).
 */
export function deriveLifecycleStage(input: LifecycleInput): LifecycleStage {
  const now = input.now ?? new Date();
  const churnedAt = toDate(input.churnedAt);
  const trialEndsAt = toDate(input.trialEndsAt);
  const paidAt = toDate(input.paidAt);
  const status = (input.subscriptionStatus ?? '').trim().toLowerCase();
  const hasSubscription = Boolean(
    input.stripeSubscriptionId && String(input.stripeSubscriptionId).trim() !== '',
  );

  // 1) CHURNED — cancelamento efetivo, vence tudo.
  if (churnedAt) return 'CHURNED';

  // 2) PAST_DUE — inadimplente (antes de ACTIVE: assinatura existe mas está devendo).
  if (PAST_DUE_STATUSES.has(status)) return 'PAST_DUE';

  // 3) ACTIVE — pagante real. EXIGE stripeSubscriptionId + status saudável.
  //    trialConverted NUNCA promove a ACTIVE (seed em prod = falso-positivo).
  if (hasSubscription && ACTIVE_STATUSES.has(status)) return 'ACTIVE';

  // 4) TRIAL — janela aberta, ainda não expirou, não convertido.
  if (input.isTrialActive && trialEndsAt && trialEndsAt > now && !input.trialConverted) {
    return 'TRIAL';
  }

  // 5) TRIAL_EXPIRED — passou do fim, sem pagamento e sem churn.
  if (trialEndsAt && trialEndsAt < now && !paidAt && !churnedAt) {
    return 'TRIAL_EXPIRED';
  }

  // 6) NOVO — fallback (lead/signup confirmado sem org, ou org recém-criada).
  return 'NOVO';
}
