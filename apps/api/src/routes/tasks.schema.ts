import { z } from 'zod';
import { TASK_STATUSES } from './tasks.util.js';

/**
 * FEATURE 5b.5 — contrato de PUT /api/tasks/:id.
 *
 * Whitelist .strict() do que o cliente pode editar via UI da tela "Tarefas":
 * status (concluir/cancelar), título, descrição e prazo. Deliberadamente FORA:
 * organizationId (tenant), contactId/dealId (vínculo definido na criação/automação),
 * completedAt (derivado do status no handler), id/createdAt/updatedAt.
 *
 * Sem o .strict() um campo desconhecido derrubaria o handler com 500 (Prisma
 * rejeita coluna inexistente) — mesmo padrão de deals.schema.ts.
 */
export const updateTaskSchema = z
  .object({
    title: z.string().min(1).max(300).optional(),
    description: z.string().max(2000).nullable().optional(),
    status: z.enum(TASK_STATUSES).optional(),
    dueDate: z.coerce.date().nullable().optional(),
  })
  .strict()
  .refine((data) => Object.keys(data).length > 0, {
    message: 'Nenhum campo para atualizar',
  });

export type UpdateTaskInput = z.infer<typeof updateTaskSchema>;
