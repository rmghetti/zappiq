import { z } from 'zod';

/**
 * Segurança — mass assignment + vazamento entre clientes em /api/impulso.
 *
 * PUT /api/impulso/:id fazia `const data = { ...req.body }` cru e caía num
 * updateMany. O `where` filtra por organizationId + isImpulso (ok), mas o `data`
 * cru deixava o atacante gravar `organizationId` e MOVER a campanha pra outra
 * org; como o cron de disparo seleciona só por status/scheduledAt, a copy do
 * atacante ia pra base de leads da vítima. Ainda pior aqui: o Impulso carrega
 * `message` (copy por canal, o texto que de fato é disparado), então o body cru
 * também deixava sobrescrever a mensagem de qualquer campanha alcançada.
 *
 * Mesma correção do padrão do repo (settings/deals): whitelist .strict() SÓ com
 * os campos editáveis do Impulso. `isImpulso` NUNCA entra (é a flag do módulo, e
 * rebaixá-la pra false esconderia a campanha das rotas /api/impulso).
 */

// Whitelist explícita: SÓ o que o cliente edita numa campanha Impulso.
// Espelha o createSchema de impulso.ts (o que o IzaStrategistModal envia).
//
// Deliberadamente FORA:
//  - organizationId  -> troca de tenant (o vazamento entre clientes desta correção)
//  - isImpulso       -> flag do módulo; nunca setada por request (nem pra true nem false)
//  - id / createdAt / completedAt -> chave / timestamps do sistema
//  - sentCount / deliveredCount / readCount / repliedCount / failedCount
//                    -> contadores de métrica, escritos só pelo worker de disparo
//  - status          -> transições via rotas dedicadas (POST /:id/publish -> SENDING,
//                       POST /:id/pause -> CANCELLED); não é editado por PUT no front
export const updateImpulsoCampaignSchema = z
  .object({
    name: z.string().min(2).optional(),
    objective: z.string().nullable().optional(),
    type: z.enum(['BROADCAST', 'TRIGGER', 'SEQUENCE']).optional(),
    templateId: z.string().nullable().optional(),
    // O handler ainda passa channels por sanitizeChannels() (gate de Instagram);
    // aqui só garantimos o formato (array de strings).
    channels: z.array(z.string()).optional(),
    audienceFilter: z.record(z.any()).optional(),
    audienceSegment: z.record(z.any()).optional(),
    journey: z.any().optional(),
    budgetPlan: z.record(z.any()).optional(),
    optimization: z.record(z.any()).optional(),
    message: z.record(z.any()).optional(), // copy por canal: { whatsapp?, instagram?, ... }
    autonomyLevel: z.number().int().min(0).max(4).optional(),
    scheduledAt: z.string().datetime().nullable().optional(),
  })
  .strict();

export type UpdateImpulsoCampaignInput = z.infer<typeof updateImpulsoCampaignSchema>;
