import { Router, Request, Response, NextFunction } from 'express';
import { prisma } from '@zappiq/database';
import { logger } from '../utils/logger.js';

const router = Router();

// GET /api/flows/templates — lista todos os templates ativos
router.get('/', async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const templates = await prisma.flowTemplate.findMany({
      where: { isActive: true },
      orderBy: [{ vertical: 'asc' }, { order: 'asc' }],
      select: {
        id: true, name: true, description: true, vertical: true, category: true,
        triggerType: true, order: true, createdAt: true,
      },
    });
    res.json({ success: true, data: templates });
  } catch (err) { next(err); }
});

// POST /api/flows/templates/:id/duplicate — clona template no org do cliente
router.post('/:id/duplicate', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const orgId = req.organizationId!;
    const template = await prisma.flowTemplate.findUnique({ where: { id } });
    if (!template) {
      res.status(404).json({ error: 'Template nao encontrado' });
      return;
    }
    const flow = await prisma.flow.create({
      data: {
        name: `${template.name} (copia)`,
        description: template.description,
        nodes: template.nodes as any,
        edges: template.edges as any,
        triggerType: template.triggerType,
        triggerConfig: template.triggerConfig as any,
        isActive: false, // cliente ativa quando estiver pronto
        organizationId: orgId,
      },
    });
    logger.info('flow_template.duplicated', { orgId, templateId: id, flowId: flow.id });
    res.json({ success: true, data: { flowId: flow.id, name: flow.name } });
  } catch (err) { next(err); }
});

export default router;
