import { z } from 'zod';
import { TASK_STATUSES } from './tasks.util.js';

/**
 * Contratos da tela "Tarefas".
 *
 * Whitelist .strict() do que o cliente pode mandar. Deliberadamente FORA de
 * tudo: organizationId (tenant), completedAt (derivado do status no handler),
 * origem/miraAlvoId (quem define é quem CRIA a tarefa: a automação ou a Mira —
 * o cliente não pode forjar uma tarefa "de prospecção"), id/createdAt/updatedAt.
 *
 * Sem o .strict() um campo desconhecido derrubaria o handler com 500 (Prisma
 * rejeita coluna inexistente) — mesmo padrão de deals.schema.ts.
 */

/** cuid do Prisma. */
const cuid = z.string().regex(/^[a-z0-9]{20,30}$/i, 'id inválido');

/**
 * Etiquetas chegam como LISTA DE IDs do catálogo, nunca como texto.
 * Decisão do fundador: etiqueta é catálogo. Aceitar string livre aqui seria a
 * porta dos fundos para "Urgente"/"urgente"/"URGENTE" na mesma conta.
 * O handler ainda confere que cada id é do catálogo DA ORG (senão dava pra
 * carimbar a tarefa com etiqueta de outro cliente sabendo o id).
 */
const tagIds = z.array(cuid).max(10, 'no máximo 10 etiquetas por tarefa');

export const createTaskSchema = z
  .object({
    title: z.string().min(1).max(300),
    description: z.string().max(2000).nullable().optional(),
    notes: z.string().max(2000).nullable().optional(),
    status: z.enum(TASK_STATUSES).optional(),
    dueDate: z.coerce.date().nullable().optional(),
    assignedToId: cuid.nullable().optional(),
    contactId: cuid.nullable().optional(),
    dealId: cuid.nullable().optional(),
    tagIds: tagIds.optional(),
  })
  .strict();

export const updateTaskSchema = z
  .object({
    title: z.string().min(1).max(300).optional(),
    description: z.string().max(2000).nullable().optional(),
    notes: z.string().max(2000).nullable().optional(),
    status: z.enum(TASK_STATUSES).optional(),
    dueDate: z.coerce.date().nullable().optional(),
    assignedToId: cuid.nullable().optional(),
    /** Lista COMPLETA de etiquetas da tarefa (substitui, não soma). */
    tagIds: tagIds.optional(),
  })
  .strict()
  .refine((data) => Object.keys(data).length > 0, {
    message: 'Nenhum campo para atualizar',
  });

/**
 * Catálogo de etiquetas. `color` é hex de 6 dígitos: a etiqueta precisa ser
 * reconhecida antes de ser lida, senão o quadro vira parede de texto cinza.
 * Regex fechado porque este valor vai direto pro `style` do front.
 */
const hexColor = z.string().regex(/^#[0-9a-f]{6}$/i, 'cor deve ser hex #RRGGBB');

export const createTaskTagSchema = z
  .object({
    name: z.string().min(1).max(40),
    color: hexColor,
  })
  .strict();

export const updateTaskTagSchema = z
  .object({
    name: z.string().min(1).max(40).optional(),
    color: hexColor.optional(),
  })
  .strict()
  .refine((data) => Object.keys(data).length > 0, {
    message: 'Nenhum campo para atualizar',
  });

export type CreateTaskInput = z.infer<typeof createTaskSchema>;
export type UpdateTaskInput = z.infer<typeof updateTaskSchema>;
export type CreateTaskTagInput = z.infer<typeof createTaskTagSchema>;
export type UpdateTaskTagInput = z.infer<typeof updateTaskTagSchema>;
