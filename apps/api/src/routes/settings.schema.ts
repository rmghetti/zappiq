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

// Zap Impulso — credenciais de integração (Meta CAPI + Asaas). Todos opcionais
// para permitir salvar uma de cada vez; null/"" limpa. Os segredos são cifrados
// no servidor (nunca chegam cifrados do cliente).
export const impulsoIntegrationSchema = z
  .object({
    capiDatasetId: z.string().max(200).nullable().optional(),
    capiAccessToken: z.string().max(1000).nullable().optional(),
    asaasApiKey: z.string().max(1000).nullable().optional(),
    asaasWebhookToken: z.string().max(200).nullable().optional(),
  })
  .strict();

export type ImpulsoIntegrationRequest = z.infer<typeof impulsoIntegrationSchema>;

// Credenciais de canal (WhatsApp/Instagram) — rota DEDICADA PUT /api/settings/channels.
//
// Por que uma rota/schema próprios e não o updateSettingsSchema: o /api/settings é
// .strict() e barra QUALQUER token de canal (W1.3, anti mass-assignment). Só que o
// cliente PRECISA salvar essas credenciais no modelo "traga seu token" — sem isso o
// botão "Salvar e ativar canais" respondia 400 e a conexão manual era impossível.
// Aqui uma whitelist .strict() SÓ com os campos de canal + a intenção de ativação.
// plan/trial/subscription/stripe/quota continuam impossíveis por request (não estão
// na whitelist), então a proteção de W1.3 segue intacta.
// Validação de formato (13/08): IDs da Meta são numéricos (5-32 dígitos) e
// tokens têm tamanho mínimo. Antes, "abc" passava como Phone Number ID e o
// cliente lia "Credenciais salvas!" com credencial impossível de funcionar.
// "" e null continuam passando (limpar campo é legítimo — troca de número).
const metaNumericId = (label: string) =>
  z
    .string()
    .max(64)
    .refine((v) => v === '' || /^\d{5,32}$/.test(v), {
      message: `${label} deve conter só números (copie do painel da Meta, sem espaços nem letras).`,
    })
    .nullable()
    .optional();

const metaAccessToken = z
  .string()
  .max(2000)
  .refine((v) => v === '' || v.length >= 20, {
    message: 'Token muito curto — cole o token completo gerado na Meta.',
  })
  .nullable()
  .optional();

export const channelCredentialsSchema = z
  .object({
    channelActivation: z.enum(['whatsapp', 'instagram', 'both']).optional(),
    // null limpa deliberadamente o campo (usado, por ex., ao trocar de número).
    whatsappPhoneNumberId: metaNumericId('Phone Number ID'),
    whatsappBusinessAccountId: metaNumericId('Business Account ID (WABA)'),
    whatsappAccessToken: metaAccessToken,
    instagramAccountId: metaNumericId('Instagram Account ID'),
    instagramPageId: metaNumericId('Page ID'),
    instagramAccessToken: metaAccessToken,
    metaAppSecret: z
      .string()
      .max(256)
      .refine((v) => v === '' || v.length >= 16, {
        message: 'App Secret muito curto — copie de Configurações → Básico no app da Meta.',
      })
      .nullable()
      .optional(),
  })
  .strict();

export type ChannelCredentialsInput = z.infer<typeof channelCredentialsSchema>;

// Campos sensíveis (colunas de topo) nunca expostos na resposta do GET.
export const SETTINGS_REDACTED_FIELDS = [
  'whatsappAccessToken',
  'instagramAccessToken',
  'metaAppSecret',
] as const;

// Segredos que vivem DENTRO do JSON `settings` — removidos do settings antes de
// responder o GET genérico (defesa em profundidade; o painel dedicado lê o
// status por rota própria, sem devolver o valor cifrado).
export const SETTINGS_JSON_REDACTED_KEYS = [
  'asaasApiKeyEnc',
  'capiAccessTokenEnc',
  'asaasWebhookToken',
] as const;

/**
 * Remove segredos do objeto Organization antes de serializar: os de canal (topo)
 * e os do Zap Impulso (dentro de `settings`). Não muta o input — devolve cópia
 * rasa; quando há `settings`, clona-o raso e remove as chaves sensíveis.
 */
export function redactOrgSecrets<T extends Record<string, any>>(org: T): Omit<T, (typeof SETTINGS_REDACTED_FIELDS)[number]> {
  const clone: Record<string, any> = { ...org };
  for (const field of SETTINGS_REDACTED_FIELDS) {
    delete clone[field];
  }
  if (clone.settings && typeof clone.settings === 'object' && !Array.isArray(clone.settings)) {
    const s = { ...clone.settings };
    for (const key of SETTINGS_JSON_REDACTED_KEYS) {
      delete s[key];
    }
    clone.settings = s;
  }
  return clone as Omit<T, (typeof SETTINGS_REDACTED_FIELDS)[number]>;
}
