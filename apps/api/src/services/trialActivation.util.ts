/* ══════════════════════════════════════════════════════════════════════
 * trialActivation.util: trial por ATIVAÇÃO (PR-K, decisão D-plano 20/08/2026).
 * --------------------------------------------------------------------
 * O relógio dos 14 dias de trial NÃO começa mais no cadastro. Ele começa:
 *   1) na PRIMEIRA mensagem inbound real de WhatsApp da org
 *      (routes/webhook.ts → activateTrialOnFirstInbound), ou
 *   2) à força, D+30 do signup, para conta dormente que nunca recebeu
 *      mensagem (trialExpirationCron → forceActivateDormantTrials).
 *
 * A idempotência mora no WHERE do updateMany: só a primeira execução
 * encontra trialStartedAt NULL; a segunda não casa nenhuma linha (count 0)
 * e as datas nunca mudam. O mesmo WHERE garante que org pagante
 * (stripeSubscriptionId/paidAt) ou que já teve janela (trialEndsAt) jamais
 * ganha trial de novo, espelho do invariante "um trial por organização"
 * do effectiveTrialDays (routes/billingCheckout.util.ts).
 *
 * Antes da ativação a conta fica no estágio NOVO (fallback do
 * deriveLifecycleStage: trialEndsAt NULL nunca entra em TRIAL), com
 * paywall none (accountAccess). Lógica isolada num util sem side-effects
 * (webhook e cron têm imports pesados) para testar sem tocar Redis/DB.
 * ══════════════════════════════════════════════════════════════════════ */

/** Duração da janela de trial a partir da ativação. */
export const TRIAL_DURATION_DAYS = 14;

/** Conta dormente: ativação forçada D+30 do signup. */
export const DORMANT_ACTIVATION_AFTER_DAYS = 30;

/** Lembrete "você ainda não ligou seu WhatsApp": D+7 do signup. */
export const WHATSAPP_NUDGE_AFTER_DAYS = 7;

const DAY_MS = 24 * 60 * 60 * 1000;

/** Janela de trial contada a partir de `now` (ativação → +14 dias). */
export function trialWindowFrom(now: Date): { trialStartedAt: Date; trialEndsAt: Date } {
  return {
    trialStartedAt: now,
    trialEndsAt: new Date(now.getTime() + TRIAL_DURATION_DAYS * DAY_MS),
  };
}

/**
 * Subset do Prisma usado aqui (injetável: o real em produção, um fake em
 * teste). `args: any` de propósito: o tipo estreito do client não é
 * estruturalmente atribuível a um genérico e o shape real é validado
 * pelos testes de semântica.
 */
export interface TrialActivationDb {
  organization: {
    updateMany: (args: any) => Promise<{ count: number }>;
  };
}

/**
 * WHERE comum das duas ativações. Restritivo de propósito:
 *   - trialStartedAt/trialEndsAt NULL → nunca reabre janela já concedida
 *     (inclui org legada que já teve trial no desenho antigo);
 *   - stripeSubscriptionId/paidAt NULL → org pagante não vira trial;
 *   - churnedAt NULL → conta cancelada fica em paz.
 */
function neverTrialedNorPaidWhere() {
  return {
    trialStartedAt: null,
    trialEndsAt: null,
    stripeSubscriptionId: null,
    paidAt: null,
    churnedAt: null,
  };
}

/**
 * Gatilho 1: primeira conversa real de WhatsApp da org.
 * Best-effort e idempotente por construção (ver WHERE). Retorna quantas
 * linhas mudaram: 1 = ativou agora, 0 = já estava ativado (ou inelegível).
 */
export async function activateTrialOnFirstInbound(
  db: TrialActivationDb,
  orgId: string,
  now: Date = new Date(),
): Promise<number> {
  const res = await db.organization.updateMany({
    where: { id: orgId, ...neverTrialedNorPaidWhere() },
    data: {
      ...trialWindowFrom(now),
      // Reafirma a flag: deriveLifecycleStage exige isTrialActive pra TRIAL.
      isTrialActive: true,
    },
  });
  return res.count;
}

/**
 * Gatilho 2: ativação forçada D+30: org que nunca recebeu mensagem não
 * fica em limbo eterno. Um updateMany só, rodado pelo cron diário de trial.
 * Retorna quantas orgs foram ativadas à força.
 */
export async function forceActivateDormantTrials(
  db: TrialActivationDb,
  now: Date = new Date(),
): Promise<number> {
  const cutoff = new Date(now.getTime() - DORMANT_ACTIVATION_AFTER_DAYS * DAY_MS);
  const res = await db.organization.updateMany({
    where: {
      ...neverTrialedNorPaidWhere(),
      createdAt: { lt: cutoff },
    },
    data: {
      ...trialWindowFrom(now),
      isTrialActive: true,
    },
  });
  return res.count;
}

/** Org ainda sem trial ativado E sem canal WhatsApp conectado. */
export function isWhatsappStillDisconnected(org: {
  trialStartedAt: Date | null;
  whatsappPhoneNumberId: string | null;
}): boolean {
  return org.trialStartedAt == null && !org.whatsappPhoneNumberId;
}

/**
 * Régua D+7: decide se a org deve receber o lembrete "você ainda não ligou
 * seu WhatsApp". Pura: elegível quando NUNCA ativou o trial, NÃO conectou
 * canal e o signup tem 7+ dias. O dedupe (1 envio por org) fica com o
 * alreadySent/onboarding_journey_state do trialFollowupService.
 */
export function isWhatsappNudgeDue(
  org: {
    trialStartedAt: Date | null;
    whatsappPhoneNumberId: string | null;
    createdAt: Date;
  },
  now: Date = new Date(),
): boolean {
  if (!isWhatsappStillDisconnected(org)) return false;
  const days = Math.floor((now.getTime() - org.createdAt.getTime()) / DAY_MS);
  return days >= WHATSAPP_NUDGE_AFTER_DAYS;
}
