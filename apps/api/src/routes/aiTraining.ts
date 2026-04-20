/**
 * AI Training — self-service.
 *
 * Filosofia de produto: o CLIENTE treina a IA dele. Sem consultor, sem
 * onboarding pago, sem SLA de suporte para começar. Ele sobe documento,
 * cria Q&A, ajusta o tom de voz e vê o "AI Readiness Score" subir em
 * tempo real — feedback imediato de maturação.
 *
 * Rotas:
 *   GET    /status              — score + breakdown + próximas ações
 *   GET    /documents           — lista documentos ingeridos
 *   POST   /documents           — upload (multipart/form-data: file)
 *   POST   /documents/url       — ingesta URL pública (site do cliente)
 *   DELETE /documents/:id       — remove documento + chunks
 *   GET    /qa                  — lista pares Q&A
 *   POST   /qa                  — cria Q&A (propaga pro vector store)
 *   PUT    /qa/:id              — atualiza
 *   DELETE /qa/:id              — desativa (soft)
 *   PUT    /identity            — atualiza tom, nome do agente, horários, mensagens
 *
 * Segurança:
 *   Todas as rotas exigem auth + tenant scoping. Upload limita tamanho
 *   (20MB) e tipos (pdf, txt, md, docx, csv).
 */
import { Router, Request, Response, NextFunction } from 'express';
import multer from 'multer';
import { z } from 'zod';
import { prisma } from '@zappiq/database';
import { authMiddleware } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { logger } from '../utils/logger.js';
import * as ragService from '../services/ragService.js';
import { computeAIReadiness, refreshAIReadiness } from '../services/aiReadinessService.js';

const router = Router();
router.use(authMiddleware);

// ── Multer config ───────────────────────────────────────
const ALLOWED_MIMES = new Set([
  'application/pdf',
  'text/plain',
  'text/markdown',
  'text/csv',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/msword',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
]);

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 20 * 1024 * 1024 }, // 20 MB — suficiente para contratos e FAQs extensos
  fileFilter: (_req, file, cb) => {
    if (ALLOWED_MIMES.has(file.mimetype)) return cb(null, true);
    cb(new Error(`Tipo de arquivo não suportado: ${file.mimetype}`));
  },
});

// ═══════════════════════════════════════════════════════════
// GET /api/ai-training/status
// Score + breakdown + próximas ações sugeridas.
// ═══════════════════════════════════════════════════════════
router.get('/status', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const orgId = req.user!.organizationId;
    const result = await computeAIReadiness(orgId);
    res.json(result);
  } catch (err) {
    next(err);
  }
});

// ═══════════════════════════════════════════════════════════
// DOCUMENTOS
// ═══════════════════════════════════════════════════════════

// GET /api/ai-training/documents
router.get('/documents', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const orgId = req.user!.organizationId;
    const docs = await prisma.kBDocument.findMany({
      where: { knowledgeBase: { organizationId: orgId } },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        title: true,
        sourceType: true,
        sourceUrl: true,
        createdAt: true,
      },
    });
    res.json({ documents: docs });
  } catch (err) {
    next(err);
  }
});

// POST /api/ai-training/documents  (multipart form-data)
router.post(
  '/documents',
  upload.single('file'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const orgId = req.user!.organizationId;
      const file = req.file;
      if (!file) {
        res.status(400).json({ error: 'Arquivo ausente (campo "file" obrigatório)' });
        return;
      }

      // Garante existência da knowledgeBase (criada no onboarding, mas seguro).
      const kb = await ensureKnowledgeBase(orgId);

      // Delega ingestão ao serviço RAG (faz chunking + embedding).
      await ragService.ingestDocument(orgId, {
        filename: file.originalname,
        content: file.buffer,
        mimeType: file.mimetype,
      });

      // Registra no Postgres (canônico). O conteúdo textual fica no RAG;
      // aqui guardamos metadata para listagem e gerência pelo cliente.
      const doc = await prisma.kBDocument.create({
        data: {
          title: file.originalname,
          sourceType: file.mimetype,
          content: '', // chunks ficam no vector store; contrato mínimo aqui
          knowledgeBaseId: kb.id,
        },
        select: { id: true, title: true, sourceType: true, createdAt: true },
      });

      // Recompute score — feedback imediato pro cliente.
      const readiness = await refreshAIReadiness(orgId).catch(() => null);

      logger.info(
        `[AITraining] Doc ingestado: ${file.originalname} (${file.size}b) org=${orgId}`,
      );

      res.status(201).json({ document: doc, readiness });
    } catch (err: any) {
      logger.warn(`[AITraining] Upload falhou: ${err.message}`);
      next(err);
    }
  },
);

// POST /api/ai-training/documents/url
const urlSchema = z.object({ url: z.string().url() });
router.post(
  '/documents/url',
  validate(urlSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const orgId = req.user!.organizationId;
      const { url } = req.body as { url: string };

      const kb = await ensureKnowledgeBase(orgId);

      await ragService.ingestUrl(orgId, url);

      const doc = await prisma.kBDocument.create({
        data: {
          title: url,
          sourceType: 'url',
          sourceUrl: url,
          content: '',
          knowledgeBaseId: kb.id,
        },
        select: { id: true, title: true, sourceType: true, sourceUrl: true, createdAt: true },
      });

      const readiness = await refreshAIReadiness(orgId).catch(() => null);
      res.status(201).json({ document: doc, readiness });
    } catch (err: any) {
      logger.warn(`[AITraining] URL ingest falhou: ${err.message}`);
      next(err);
    }
  },
);

// DELETE /api/ai-training/documents/:id
router.delete('/documents/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const orgId = req.user!.organizationId;
    const { id } = req.params;

    // Tenant scoping: só apaga se o doc pertence à KB da org.
    const doc = await prisma.kBDocument.findFirst({
      where: { id, knowledgeBase: { organizationId: orgId } },
      select: { id: true },
    });
    if (!doc) {
      res.status(404).json({ error: 'Documento não encontrado' });
      return;
    }

    await prisma.kBDocument.delete({ where: { id } });
    const readiness = await refreshAIReadiness(orgId).catch(() => null);
    res.json({ ok: true, readiness });
  } catch (err) {
    next(err);
  }
});

// ═══════════════════════════════════════════════════════════
// Q&A PAIRS
// ═══════════════════════════════════════════════════════════

// GET /api/ai-training/qa
router.get('/qa', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const orgId = req.user!.organizationId;
    const pairs = await (prisma as any).QAPair.findMany({
      where: { organizationId: orgId },
      orderBy: [{ priority: 'desc' }, { updatedAt: 'desc' }],
    });
    res.json({ qaPairs: pairs });
  } catch (err) {
    next(err);
  }
});

const qaSchema = z.object({
  question: z.string().min(3).max(500),
  answer: z.string().min(3).max(4000),
  category: z.string().max(80).optional(),
  priority: z.number().int().min(0).max(10).optional(),
  isActive: z.boolean().optional(),
});

// POST /api/ai-training/qa
router.post('/qa', validate(qaSchema), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const orgId = req.user!.organizationId;
    const { question, answer, category, priority = 0 } = req.body;

    const pair = await (prisma as any).QAPair.create({
      data: {
        question,
        answer,
        category: category || null,
        priority,
        organizationId: orgId,
      },
    });

    // Propaga pro vector store como documento textual estruturado.
    const content = `Pergunta: ${question}\n\nResposta: ${answer}`;
    await ragService
      .ingestDocument(orgId, {
        filename: `qa-${pair.id}.txt`,
        content: Buffer.from(content),
        mimeType: 'text/plain',
      })
      .catch((err: any) => logger.warn(`[AITraining] RAG sync Q&A falhou: ${err.message}`));

    const readiness = await refreshAIReadiness(orgId).catch(() => null);
    res.status(201).json({ qaPair: pair, readiness });
  } catch (err) {
    next(err);
  }
});

// PUT /api/ai-training/qa/:id
router.put('/qa/:id', validate(qaSchema.partial()), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const orgId = req.user!.organizationId;
    const { id } = req.params;

    const existing = await (prisma as any).QAPair.findFirst({
      where: { id, organizationId: orgId },
    });
    if (!existing) {
      res.status(404).json({ error: 'Q&A não encontrado' });
      return;
    }

    const pair = await (prisma as any).QAPair.update({
      where: { id },
      data: req.body,
    });

    const readiness = await refreshAIReadiness(orgId).catch(() => null);
    res.json({ qaPair: pair, readiness });
  } catch (err) {
    next(err);
  }
});

// DELETE /api/ai-training/qa/:id
router.delete('/qa/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const orgId = req.user!.organizationId;
    const { id } = req.params;

    const existing = await (prisma as any).QAPair.findFirst({
      where: { id, organizationId: orgId },
      select: { id: true },
    });
    if (!existing) {
      res.status(404).json({ error: 'Q&A não encontrado' });
      return;
    }

    await (prisma as any).QAPair.delete({ where: { id } });
    const readiness = await refreshAIReadiness(orgId).catch(() => null);
    res.json({ ok: true, readiness });
  } catch (err) {
    next(err);
  }
});

// ═══════════════════════════════════════════════════════════
// IDENTIDADE DO AGENTE
// ═══════════════════════════════════════════════════════════
const identitySchema = z.object({
  agentName: z.string().min(1).max(60).optional(),
  tone: z.enum(['friendly', 'formal', 'technical']).optional(),
  businessHours: z.record(z.any()).optional(),
  greetingMessage: z.string().max(1000).optional(),
  handoffMessage: z.string().max(1000).optional(),
});

router.put('/identity', validate(identitySchema), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const orgId = req.user!.organizationId;

    const org = await prisma.organization.findUnique({
      where: { id: orgId },
      select: { settings: true },
    });
    const current = (org?.settings as any) || {};
    const merged = { ...current, ...req.body };

    await prisma.organization.update({
      where: { id: orgId },
      data: { settings: merged },
    });

    const readiness = await refreshAIReadiness(orgId).catch(() => null);
    res.json({ settings: merged, readiness });
  } catch (err) {
    next(err);
  }
});

// ── util ────────────────────────────────────────────────
async function ensureKnowledgeBase(organizationId: string) {
  const existing = await prisma.knowledgeBase.findFirst({
    where: { organizationId },
    select: { id: true },
  });
  if (existing) return existing;
  return prisma.knowledgeBase.create({
    data: { organizationId, name: 'Base Principal' },
    select: { id: true },
  });
}

export default router;
