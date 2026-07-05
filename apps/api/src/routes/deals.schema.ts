import { z } from 'zod';
import { LOSS_REASONS } from './deals.lossreason.util.js';

/**
 * W1.6 (segurança) — mass assignment + IDOR em /api/deals.
 *
 * PUT /api/deals/:id fazia `data: req.body` cru num updateMany. Como a tabela
 * `deals` guarda campos que o cliente NUNCA pode setar direto — wonAt / lostAt /
 * closedAt (desfecho), sourceConversationId / sourceCampaignId / sourceAgentId /
 * aiLinkReviewed (atribuição IA), organizationId (tenant) — qualquer request
 * conseguia sobrescrever esses valores (forjar venda ganha, roubar atribuição,
 * mudar de org). Pior: um campo desconhecido no body derrubava o handler com
 * 500 (Prisma rejeita coluna inexistente). Aqui trancamos a atualização numa
 * whitelist .strict() SÓ com os campos que o cliente pode legitimamente editar.
 *
 * POST /api/deals aceitava qualquer contactId sem checar dono. Isso permitia
 * criar um deal apontando pra um contato de OUTRA org (deal cross-tenant) e,
 * dependendo do include na resposta, vazava dados do contato alheio. A posse do
 * contactId passa a ser validada no handler (findFirst por organizationId).
 */

// Whitelist explícita: SÓ o que o cliente pode editar via UI do CRM/kanban.
// Deliberadamente FORA: wonAt, lostAt, closedAt (desfecho — derivado de stage),
// sourceConversationId, sourceCampaignId, sourceAgentId, aiLinkReviewed
// (atribuição IA — mexida só por rotas dedicadas/rotina interna),
// organizationId / id / createdAt / updatedAt (nunca vêm do cliente).
export const updateDealSchema = z
  .object({
    title: z.string().min(2).max(300).optional(),
    value: z.number().nullable().optional(),
    stage: z.string().min(1).max(60).optional(),
    stageId: z.string().nullable().optional(),
    ownerId: z.string().nullable().optional(),
    expectedCloseDate: z.coerce.date().nullable().optional(),
    lossReason: z.enum(LOSS_REASONS).nullable().optional(),
    contactId: z.string().optional(),
  })
  .strict();

export type UpdateDealInput = z.infer<typeof updateDealSchema>;

// Schema de criação (movido pra cá pra ficar junto do contrato de segurança).
// contactId é validado quanto à POSSE no handler (não dá pra checar org no zod).
export const createDealSchema = z.object({
  title: z.string().min(2).max(300),
  value: z.number().nullable().optional(),
  stage: z.string().min(1).max(60).default('new'),
  contactId: z.string().min(1),
});

export type CreateDealInput = z.infer<typeof createDealSchema>;
