import { Router, Request, Response, NextFunction } from 'express';
import { prisma } from '@zappiq/database';
import { validate } from '../middleware/validate.js';
import { buildTaskListWhere, TASK_LIST_ORDER_BY, resolveCompletedAt } from './tasks.util.js';
import { updateTaskSchema } from './tasks.schema.js';

/**
 * FEATURE 5b.5 — Tela de Tarefas / follow-ups da IA.
 *
 * A automação (crmAutomationService) já CRIA Tasks (model Task) quando a IA
 * detecta intenção de compra etc., mas não havia rota pra listá-las — o gancho
 * de ação diária da PME ficava invisível. Aqui expomos:
 *
 *   GET  /api/tasks           — lista as tasks da org, filtrável por status/dueDate
 *   PUT  /api/tasks/:id       — concluir / editar uma task
 *
 * Montado com authMiddleware + rlsTenantMiddleware no server.ts, então
 * req.organizationId é sempre a org do usuário autenticado (isolamento).
 */
const router = Router();

const CONTACT_SELECT = { id: true, name: true, phone: true, avatarUrl: true } as const;
const DEAL_SELECT = { id: true, title: true, stage: true } as const;

// GET /api/tasks?status=PENDING&dueBefore=<iso>
// Lista as tarefas da org com o contato/deal vinculado, ordenadas por prazo.
router.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const where = buildTaskListWhere(req.organizationId!, {
      status: req.query.status,
      dueBefore: req.query.dueBefore,
    });

    const tasks = await prisma.task.findMany({
      where,
      orderBy: TASK_LIST_ORDER_BY as any,
      include: {
        contact: { select: CONTACT_SELECT },
        deal: { select: DEAL_SELECT },
      },
    });

    res.json({ success: true, data: tasks });
  } catch (err) {
    next(err);
  }
});

// PUT /api/tasks/:id — concluir (status=DONE) ou editar título/descrição/prazo.
// completedAt é DERIVADO do status no servidor (nunca vem do cliente):
//   - vira DONE  → completedAt = agora (se ainda não tinha)
//   - sai de DONE → completedAt = null
router.put('/:id', validate(updateTaskSchema), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const orgId = req.organizationId!;
    // IDOR: garante que a task pertence à MESMA org antes de editar.
    const existing = await prisma.task.findFirst({
      where: { id: req.params.id, organizationId: orgId },
      select: { id: true, status: true, completedAt: true },
    });
    if (!existing) {
      res.status(404).json({ error: 'Task not found' });
      return;
    }

    const { title, description, status, dueDate } = req.body as {
      title?: string;
      description?: string | null;
      status?: 'PENDING' | 'DONE' | 'CANCELLED';
      dueDate?: Date | null;
    };

    const data: Record<string, unknown> = {};
    if (title !== undefined) data.title = title;
    if (description !== undefined) data.description = description;
    if (dueDate !== undefined) data.dueDate = dueDate;

    if (status !== undefined) {
      data.status = status;
      // completedAt é DERIVADO do status no servidor (nunca vem do cliente).
      data.completedAt = resolveCompletedAt(status, existing.completedAt);
    }

    const updated = await prisma.task.update({
      where: { id: existing.id },
      data,
      include: {
        contact: { select: CONTACT_SELECT },
        deal: { select: DEAL_SELECT },
      },
    });

    res.json({ success: true, data: updated });
  } catch (err) {
    next(err);
  }
});

export default router;
