import { z } from 'zod';

/**
 * Segurança — mass assignment + vazamento entre clientes em /api/campaigns.
 *
 * PUT /api/campaigns/:id fazia `data: req.body` cru num updateMany. O `where`
 * filtra por organizationId (ok), mas o `data` cru deixava o atacante gravar
 * `organizationId` e MOVER a campanha pra outra org. O cron de disparo seleciona
 * as campanhas só por status/scheduledAt (não re-checa o dono), então a copy do
 * atacante era enviada pra base de leads da vítima. Além do sequestro de tenant,
 * o body cru também permitia forjar contadores de métrica (sentCount etc.) e
 * derrubava o handler com 500 quando vinha uma coluna inexistente.
 *
 * Aqui trancamos a atualização numa whitelist .strict() SÓ com os campos que o
 * cliente pode legitimamente editar na definição de uma campanha (o mesmo
 * conjunto do createSchema da rota, que é o que o front realmente envia).
 */

// Whitelist explícita: SÓ o que o cliente edita na definição da campanha.
// Espelha o createSchema de campaigns.ts (o que o CampaignFormModal envia).
//
// Deliberadamente FORA:
//  - organizationId  -> troca de tenant (o vazamento entre clientes desta correção)
//  - id / createdAt / completedAt -> nunca vêm do cliente (chave / timestamps do sistema)
//  - sentCount / deliveredCount / readCount / repliedCount / failedCount
//                    -> contadores de métrica, escritos só pelo worker de disparo
//  - status          -> transições são via rota dedicada (POST /:id/send marca SENDING);
//                       não há edição de status por PUT no front das campanhas comuns
//  - isImpulso + campos exclusivos do Impulso (objective, channels, autonomyLevel,
//    journey, audienceSegment, budgetPlan, optimization, message)
//                    -> pertencem à rota /api/impulso (ver impulso.schema.ts); uma
//                       campanha comum nunca vira Impulso por request
export const updateCampaignSchema = z
  .object({
    name: z.string().min(2).optional(),
    type: z.enum(['BROADCAST', 'TRIGGER', 'SEQUENCE']).optional(),
    // templateId e scheduledAt são nullable no Prisma: null limpa (des-agenda /
    // remove o template) de forma legítima.
    templateId: z.string().nullable().optional(),
    audienceFilter: z.record(z.any()).optional(),
    scheduledAt: z.string().datetime().nullable().optional(),
  })
  .strict();

export type UpdateCampaignInput = z.infer<typeof updateCampaignSchema>;
