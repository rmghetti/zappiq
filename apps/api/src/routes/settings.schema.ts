import { z } from 'zod';

/**
 * W1.3 (segurança) — mass assignment + vazamento de segredo em /api/settings.
 *
 * PUT /api/settings fazia `data: req.body` cru. Como plan / trial* /
 * subscriptionStatus / stripe* / quota vivem na MESMA tabela `organizations`,
 * qualquer ADMIN de qualquer org conseguia se auto-promover a ENTERPRISE de
 * graça, estender o trial, forjar assinatura, etc. Aqui trancamos a atualização
 * numa whitelist .strict() SÓ com os campos que o cliente pode legitimamente
 * editar. Campos de billing/plano/limite NUNCA entram — são mexidos só por
 * webhook Stripe / rotina interna, nunca por request do cliente.
 *
 * GET /api/settings devolvia o objeto Organization inteiro, incluindo
 * whatsappAccessToken / instagramAccessToken / metaAppSecret (segredos de
 * canal). Redigimos esses campos antes de responder.
 */

// Whitelist explícita: SÓ o que o cliente pode editar via UI de configurações.
// Deliberadamente fora: plan, trialStartedAt/trialEndsAt/trialCostCapUsd/
// trialConverted/isTrialActive, billingCycle, subscriptionStatus,
// paid/churned/cardAdded, stripeCustomerId/stripeSubscriptionId,
// aiReadiness*, e QUALQUER token/segredo de canal.
export const updateSettingsSchema = z
  .object({
    name: z.string().min(1).max(200).optional(),
    settings: z.record(z.any()).optional(),
    dpoEmail: z.string().email().max(320).nullable().optional(),
    auditRetentionDays: z.number().int().min(1).max(3650).optional(),
    softDeleteRetentionDays: z.number().int().min(1).max(3650).optional(),
  })
  .strict();

export type UpdateSettingsInput = z.infer<typeof updateSettingsSchema>;

// Campos sensíveis nunca expostos na resposta do GET.
export const SETTINGS_REDACTED_FIELDS = [
  'whatsappAccessToken',
  'instagramAccessToken',
  'metaAppSecret',
] as const;

/**
 * Remove segredos de canal do objeto Organization antes de serializar.
 * Não muta o input — devolve uma cópia rasa sem os campos sensíveis.
 */
export function redactOrgSecrets<T extends Record<string, any>>(org: T): Omit<T, (typeof SETTINGS_REDACTED_FIELDS)[number]> {
  const clone: Record<string, any> = { ...org };
  for (const field of SETTINGS_REDACTED_FIELDS) {
    delete clone[field];
  }
  return clone as Omit<T, (typeof SETTINGS_REDACTED_FIELDS)[number]>;
}
