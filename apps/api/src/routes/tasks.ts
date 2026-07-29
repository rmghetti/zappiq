import { Router, Request, Response, NextFunction } from 'express';
import { prisma } from '@zappiq/database';
import { validate } from '../middleware/validate.js';
import { buildTaskListWhere, TASK_LIST_ORDER_BY, resolveCompletedAt } from './tasks.util.js';
import {
  createTaskSchema,
  updateTaskSchema,
  createTaskTagSchema,
  updateTaskTagSchema,
} from './tasks.schema.js';
import { registrarConclusaoNoCrm } from '../services/mira/planoAcao.js';

/**
 * Tela de Tarefas.
 *
 *   GET    /api/tasks              — lista (status, dueBefore, tagId, assignedToId, origem, contactId, dealId)
 *   POST   /api/tasks              — criar tarefa à mão
 *   GET    /api/tasks/tags         — catálogo de etiquetas da org
 *   POST   /api/tasks/tags         — criar etiqueta no catálogo
 *   PUT    /api/tasks/tags/:id     — renomear / recolorir etiqueta
 *   DELETE /api/tasks/tags/:id     — tirar etiqueta do catálogo
 *   GET    /api/tasks/:id          — uma tarefa (painel "Ver tarefa")
 *   PUT    /api/tasks/:id          — editar / concluir
 *
 * Montado com authMiddleware + rlsTenantMiddleware no server.ts, então
 * req.organizationId é sempre a org do usuário autenticado.
 *
 * ATENÇÃO: o filtro por organizationId em TODA query aqui é OBRIGATÓRIO, não
 * "defesa em profundidade". Em produção a RLS não filtra para a API, que
 * conecta como `postgres` e bypassa (ver middleware/rlsTenant.ts).
 */
const router = Router();

const CONTACT_SELECT = { id: true, name: true, phone: true, avatarUrl: true } as const;
const DEAL_SELECT = { id: true, title: true, stage: true } as const;
const ASSIGNEE_SELECT = { id: true, name: true, email: true, avatar: true } as const;
const CONVERSATION_SELECT = { id: true, status: true, channel: true } as const;
const CAMPAIGN_SELECT = { id: true, name: true, status: true } as const;
const TAGS_SELECT = {
  select: { tag: { select: { id: true, name: true, color: true } } },
} as const;

const TASK_INCLUDE = {
  contact: { select: CONTACT_SELECT },
  deal: { select: DEAL_SELECT },
  assignedTo: { select: ASSIGNEE_SELECT },
  conversation: { select: CONVERSATION_SELECT },
  campaign: { select: CAMPAIGN_SELECT },
  tags: TAGS_SELECT,
} as const;

/** A tarefa sai com `tags: [{id,name,color}]`, e não com a tabela de junção crua. */
function serializeTask<T extends { tags?: { tag: unknown }[] }>(task: T) {
  return { ...task, tags: (task.tags ?? []).map((t) => t.tag) };
}

/**
 * Confere que TODO id vindo do cliente pertence à org antes de gravar.
 *
 * Sem isto o cliente A manda o contactId do cliente B e a tarefa dele passa a
 * apontar pra base do outro — a mesma família de falha já corrigida no Impulso
 * (mass-assignment movendo campanha entre orgs). Nenhum destes ids é validável
 * só pelo formato: cuid válido de OUTRA org passaria no zod.
 *
 * Devolve a mensagem do primeiro problema, ou null se está tudo na org.
 */
async function validarVinculos(
  orgId: string,
  v: { assignedToId?: string | null; contactId?: string | null; dealId?: string | null; tagIds?: string[] },
): Promise<string | null> {
  if (v.assignedToId) {
    const user = await prisma.user.findFirst({
      where: { id: v.assignedToId, organizationId: orgId },
      select: { id: true },
    });
    if (!user) return 'Responsável não encontrado nesta organização';
  }

  if (v.contactId) {
    const contact = await prisma.contact.findFirst({
      where: { id: v.contactId, organizationId: orgId },
      select: { id: true },
    });
    if (!contact) return 'Contato não encontrado nesta organização';
  }

  if (v.dealId) {
    const deal = await prisma.deal.findFirst({
      where: { id: v.dealId, organizationId: orgId },
      select: { id: true },
    });
    if (!deal) return 'Negócio não encontrado nesta organização';
  }

  if (v.tagIds && v.tagIds.length > 0) {
    const ids = [...new Set(v.tagIds)];
    const achadas = await prisma.taskTag.count({
      where: { id: { in: ids }, organizationId: orgId },
    });
    if (achadas !== ids.length) return 'Etiqueta não encontrada no catálogo desta organização';
  }

  return null;
}

/* ══════════════════ Catálogo de etiquetas ══════════════════
 * Declarado ANTES de /:id de propósito: o Express casa na ordem, e
 * `/tasks/tags` bateria em `/tasks/:id` com id="tags" se viesse depois.
 */

// GET /api/tasks/tags — catálogo da org, com quantas tarefas usam cada etiqueta.
router.get('/tags', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const tags = await prisma.taskTag.findMany({
      where: { organizationId: req.organizationId! },
      orderBy: { name: 'asc' },
      include: { _count: { select: { tasks: true } } },
    });
    res.json({
      success: true,
      data: tags.map((t) => ({ id: t.id, name: t.name, color: t.color, emUso: t._count.tasks })),
    });
  } catch (err) {
    next(err);
  }
});

// POST /api/tasks/tags — cria etiqueta no catálogo da org.
router.post('/tags', validate(createTaskTagSchema), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { name, color } = req.body as { name: string; color: string };
    const tag = await prisma.taskTag.create({
      data: { name: name.trim(), color, organizationId: req.organizationId! },
    });
    res.status(201).json({ success: true, data: { id: tag.id, name: tag.name, color: tag.color, emUso: 0 } });
  } catch (err: any) {
    // @@unique([organizationId, name]) — o catálogo não aceita duas "Urgente".
    if (err.code === 'P2002') {
      res.status(409).json({ error: 'Já existe uma etiqueta com esse nome' });
      return;
    }
    next(err);
  }
});

// PUT /api/tasks/tags/:id — renomeia / recolore.
router.put('/tags/:id', validate(updateTaskTagSchema), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const orgId = req.organizationId!;
    const { name, color } = req.body as { name?: string; color?: string };

    // updateMany + filtro de org: um update direto por id editaria etiqueta de
    // outra org (IDOR).
    const r = await prisma.taskTag.updateMany({
      where: { id: req.params.id, organizationId: orgId },
      data: { ...(name !== undefined && { name: name.trim() }), ...(color !== undefined && { color }) },
    });
    if (r.count === 0) {
      res.status(404).json({ error: 'Etiqueta não encontrada' });
      return;
    }

    const tag = await prisma.taskTag.findFirst({
      where: { id: req.params.id, organizationId: orgId },
      include: { _count: { select: { tasks: true } } },
    });
    res.json({
      success: true,
      data: { id: tag!.id, name: tag!.name, color: tag!.color, emUso: tag!._count.tasks },
    });
  } catch (err: any) {
    if (err.code === 'P2002') {
      res.status(409).json({ error: 'Já existe uma etiqueta com esse nome' });
      return;
    }
    next(err);
  }
});

// DELETE /api/tasks/tags/:id — tira do catálogo.
// Some das tarefas junto (cascade no join). A etiqueta é um rótulo, não um
// dado da tarefa: apagar o rótulo não pode apagar o trabalho.
router.delete('/tags/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const r = await prisma.taskTag.deleteMany({
      where: { id: req.params.id, organizationId: req.organizationId! },
    });
    if (r.count === 0) {
      res.status(404).json({ error: 'Etiqueta não encontrada' });
      return;
    }
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
});

/* ══════════════════ Tarefas ══════════════════ */

// GET /api/tasks?status=PENDING&tagId=...&assignedToId=me|none|<id>&origem=MIRA
router.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    // 'me' é resolvido aqui, não no cliente: quem sabe quem está logado é o
    // servidor, e o front não deveria precisar montar o próprio id num filtro.
    const assignedToId =
      req.query.assignedToId === 'me' ? req.user!.userId : req.query.assignedToId;

    const where = buildTaskListWhere(req.organizationId!, {
      status: req.query.status,
      dueBefore: req.query.dueBefore,
      tagId: req.query.tagId,
      assignedToId,
      origem: req.query.origem,
      contactId: req.query.contactId,
      dealId: req.query.dealId,
    });

    const tasks = await prisma.task.findMany({
      where: where as any,
      orderBy: TASK_LIST_ORDER_BY as any,
      include: TASK_INCLUDE,
    });

    res.json({ success: true, data: tasks.map(serializeTask) });
  } catch (err) {
    next(err);
  }
});

// POST /api/tasks — criar tarefa à mão.
// Até 15/07/2026 NÃO existia esta rota: só a IA criava tarefa (automação das
// Conversas e Mira), e o cliente não conseguia anotar o próprio trabalho.
// `origem` não vem do cliente: nasce CONVERSA (default do schema) porque tarefa
// criada à mão não é prospecção da Mira.
router.post('/', validate(createTaskSchema), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const orgId = req.organizationId!;
    const { title, description, notes, status, dueDate, assignedToId, contactId, dealId, tagIds } =
      req.body as {
        title: string;
        description?: string | null;
        notes?: string | null;
        status?: 'PENDING' | 'IN_PROGRESS' | 'DONE' | 'CANCELLED';
        dueDate?: Date | null;
        assignedToId?: string | null;
        contactId?: string | null;
        dealId?: string | null;
        tagIds?: string[];
      };

    const problema = await validarVinculos(orgId, { assignedToId, contactId, dealId, tagIds });
    if (problema) {
      res.status(400).json({ error: problema });
      return;
    }

    const task = await prisma.task.create({
      data: {
        title,
        description: description ?? null,
        notes: notes ?? null,
        status: status ?? 'PENDING',
        dueDate: dueDate ?? null,
        assignedToId: assignedToId ?? null,
        contactId: contactId ?? null,
        dealId: dealId ?? null,
        organizationId: orgId,
        // completedAt é DERIVADO do status, nunca do cliente — mesma regra do PUT.
        completedAt: resolveCompletedAt(status ?? 'PENDING', null) ?? null,
        ...(tagIds?.length && {
          tags: { create: [...new Set(tagIds)].map((tagId) => ({ tagId })) },
        }),
      },
      include: TASK_INCLUDE,
    });

    res.status(201).json({ success: true, data: serializeTask(task) });
  } catch (err) {
    next(err);
  }
});

// GET /api/tasks/:id — o painel "Ver tarefa".
router.get('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const task = await prisma.task.findFirst({
      where: { id: req.params.id, organizationId: req.organizationId! },
      include: TASK_INCLUDE,
    });
    if (!task) {
      res.status(404).json({ error: 'Task not found' });
      return;
    }
    res.json({ success: true, data: serializeTask(task) });
  } catch (err) {
    next(err);
  }
});

// PUT /api/tasks/:id — concluir / editar.
// completedAt é DERIVADO do status no servidor (nunca vem do cliente):
//   - vira DONE  → completedAt = agora (se ainda não tinha)
//   - sai de DONE → completedAt = null
router.put('/:id', validate(updateTaskSchema), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const orgId = req.organizationId!;
    // IDOR: garante que a task pertence à MESMA org antes de editar.
    const existing = await prisma.task.findFirst({
      where: { id: req.params.id, organizationId: orgId },
      select: {
        id: true,
        status: true,
        completedAt: true,
        // Para fechar o ciclo da Mira quando a tarefa vira DONE.
        title: true,
        description: true,
        origem: true,
        miraAlvoId: true,
        contactId: true,
        dealId: true,
      },
    });
    if (!existing) {
      res.status(404).json({ error: 'Task not found' });
      return;
    }

    const { title, description, notes, status, dueDate, assignedToId, tagIds } = req.body as {
      title?: string;
      description?: string | null;
      notes?: string | null;
      status?: 'PENDING' | 'IN_PROGRESS' | 'DONE' | 'CANCELLED';
      dueDate?: Date | null;
      assignedToId?: string | null;
      tagIds?: string[];
    };

    const problema = await validarVinculos(orgId, { assignedToId, tagIds });
    if (problema) {
      res.status(400).json({ error: problema });
      return;
    }

    const data: Record<string, unknown> = {};
    if (title !== undefined) data.title = title;
    if (description !== undefined) data.description = description;
    if (notes !== undefined) data.notes = notes;
    if (dueDate !== undefined) data.dueDate = dueDate;
    if (assignedToId !== undefined) data.assignedToId = assignedToId;

    if (status !== undefined) {
      data.status = status;
      // completedAt é DERIVADO do status no servidor (nunca vem do cliente).
      data.completedAt = resolveCompletedAt(status, existing.completedAt);
    }

    // tagIds é a lista COMPLETA: substitui, não soma. deleteMany+create na mesma
    // operação pra tarefa nunca ficar sem etiqueta nenhuma no meio do caminho.
    if (tagIds !== undefined) {
      data.tags = {
        deleteMany: {},
        create: [...new Set(tagIds)].map((tagId) => ({ tagId })),
      };
    }

    const updated = await prisma.task.update({
      where: { id: existing.id },
      data,
      include: TASK_INCLUDE,
    });

    // Tarefa da Mira concluída → a oportunidade no CRM fica sabendo.
    // A outra ponta do pedido do fundador: sem isto, o vendedor executa o
    // plano de ação e o pipeline continua achando que ninguém fez nada.
    // Só na TRANSIÇÃO para DONE (reeditar uma tarefa já concluída não gera
    // outra entrada na timeline).
    if (status === 'DONE' && existing.status !== 'DONE') {
      await registrarConclusaoNoCrm(orgId, existing);
    }

    res.json({ success: true, data: serializeTask(updated) });
  } catch (err) {
    next(err);
  }
});

export default router;
