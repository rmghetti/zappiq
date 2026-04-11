import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { prisma } from '@zappiq/database';
import { validate } from '../middleware/validate.js';
import * as ragService from '../services/ragService.js';
import { logger } from '../utils/logger.js';

const router = Router();

const createSchema = z.object({ name: z.string().min(2) });

// GET /api/kb
router.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const kbs = await prisma.knowledgeBase.findMany({
      where: { organizationId: req.organizationId! },
      include: { _count: { select: { documents: true } } },
      orderBy: { createdAt: 'desc' },
    });
    res.json({ success: true, data: kbs });
  } catch (err) { next(err); }
});

// POST /api/kb
router.post('/', validate(createSchema), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const kb = await prisma.knowledgeBase.create({
      data: { name: req.body.name, organizationId: req.organizationId! },
    });
    res.status(201).json({ success: true, data: kb });
  } catch (err) { next(err); }
});

// GET /api/kb/:id
router.get('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const kb = await prisma.knowledgeBase.findFirst({
      where: { id: req.params.id, organizationId: req.organizationId! },
      include: { documents: { include: { _count: { select: { chunks: true } } } } },
    });
    if (!kb) { res.status(404).json({ error: 'Knowledge base not found' }); return; }
    res.json({ success: true, data: kb });
  } catch (err) { next(err); }
});

// DELETE /api/kb/:id
router.delete('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await prisma.knowledgeBase.deleteMany({ where: { id: req.params.id, organizationId: req.organizationId! } });
    if (result.count === 0) { res.status(404).json({ error: 'Knowledge base not found' }); return; }
    res.json({ success: true, message: 'Knowledge base deleted' });
  } catch (err) { next(err); }
});

// POST /api/kb/:id/documents — upload document for RAG
router.post('/:id/documents', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { title, sourceType, sourceUrl, content } = req.body;
    if (!title || !content) { res.status(400).json({ error: 'title and content required' }); return; }

    const doc = await prisma.kBDocument.create({
      data: {
        title,
        sourceType: sourceType || 'manual',
        sourceUrl,
        content,
        knowledgeBaseId: req.params.id,
      },
    });

    // Trigger RAG ingestion asynchronously
    ragService.ingestDocument(req.organizationId!, {
      filename: title,
      content: Buffer.from(content),
      mimeType: 'text/plain',
    }).catch((err: any) => logger.error('[KB] RAG ingestion failed:', err));

    res.status(201).json({ success: true, data: doc });
  } catch (err) { next(err); }
});

// DELETE /api/kb/:id/documents/:docId
router.delete('/:id/documents/:docId', async (req: Request, res: Response, next: NextFunction) => {
  try {
    await prisma.kBDocument.delete({ where: { id: req.params.docId } });
    ragService.deleteDocument(req.organizationId!, req.params.docId).catch(() => {});
    res.json({ success: true, message: 'Document deleted' });
  } catch (err) { next(err); }
});

export default router;
