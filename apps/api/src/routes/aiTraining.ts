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
import { buildKnowledgeBase, surveyDocFilename, countAnsweredQuestions } from '../services/knowledgeBaseBuilder.js';
import { logAuditEvent } from '../services/auditService.js';
import { buildSystemPromptForContact, pickTierAndOverride } from '../agents/agentOrchestrator.js';
import { routeIzaTurn } from '../services/llm/izaTurnRouter.js';
import { testMessageSchema, buildPlaygroundResult } from './aiTraining.playground.js';
import { textDocSchema } from './aiTraining.text.util.js';
import {
  appointmentTypeSchema,
  schedulingConfigSchema,
  buildSchedulingKnowledge,
  SCHEDULING_RAG_SOURCE,
} from './scheduling.util.js';
import { getToolsForContext } from '../services/llm/tools.js';
import { resolveSchedulingAccess, type PlanId } from '@zappiq/shared';

// Entitlement do Agendamento: incluído no GROWTH+; no Lite exige o add-on
// SCHEDULING_AGENT (settings.addons). Lê plano + add-ons ativos da org.
async function schedulingAccessFor(orgId: string) {
  const org = await prisma.organization.findUnique({ where: { id: orgId }, select: { plan: true, settings: true } });
  const addons = Array.isArray((org?.settings as any)?.addons) ? (org!.settings as any).addons as string[] : [];
  return resolveSchedulingAccess((org?.plan as PlanId) || 'IZA_LITE', addons);
}

const router = Router();
router.use(authMiddleware);

// 2026-05-20 — helper de log de treinamento. Reusa a cadeia append-only
// (hash-chained) de audit_logs: histórico INALTERÁVEL com usuário, data/hora.
// Fail-soft: nunca quebra a request principal se o log falhar.
async function logTraining(
  req: Request,
  action: string,
  resource: string,
  resourceId: string | undefined,
  summary: string,
  extra?: { before?: unknown; after?: unknown },
): Promise<void> {
  try {
    await logAuditEvent(req, {
      action,            // ex: "kb.qa.update"
      resource,          // ex: "qa_pair"
      resourceId,
      details: { summary, area: 'ai-training' },
      before: extra?.before,
      after: extra?.after,
    });
  } catch (err: any) {
    logger.warn(`[AITraining] log falhou (${action}): ${err?.message}`);
  }
}

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
// POST /api/ai-training/test — Playground "Testar minha IA"
// ─────────────────────────────────────────────────────────
// FEATURE 5a.2. O dono do negócio testa o treino ANTES de conectar o
// WhatsApp: manda uma mensagem, ela roda pela MESMA IA da org (prompt do
// Agent live + retrieval RAG real + roteamento de tier/provider), e volta a
// resposta — SEM WhatsApp e SEM criar Conversation/Contact reais.
//
// Reuso deliberado do caminho de produção (agentOrchestrator):
//   - buildSystemPromptForContact → CORE rules + facts gating + Agent live + RAG
//   - pickTierAndOverride         → mesmo tier/forceProvider do bot real
//   - routeIzaTurn                → mesmo pre-filter + classify + cascade LLM
// A única diferença: usamos um contactId sintético que NÃO existe no banco.
// O lookup de Contact retorna null (fail-soft no orchestrator) → o prompt cai
// no comportamento de "primeiro contato", que é exatamente o teste desejado.
// Nada é persistido: sem Message, sem Conversation, sem Contact.
// ═══════════════════════════════════════════════════════════
router.post('/test', validate(testMessageSchema), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const orgId = req.user!.organizationId;
    const { message } = req.body as { message: string };

    // Settings da org (niche/agentName/tone) pro fallback do promptEngine
    // quando a org ainda não tem Agent seedado.
    const org = await prisma.organization.findUnique({
      where: { id: orgId },
      select: { settings: true },
    });
    const orgSettings = (org?.settings as any) || {};

    // 1. Retrieval RAG real (namespace da org) + fontes estruturadas pra UI.
    const { context: ragContext, sources } = await ragService.searchWithSources(orgId, message, 5);

    // 2. System prompt idêntico ao de produção. contactId sintético → sem DB write.
    const systemPrompt = await buildSystemPromptForContact({
      organizationId: orgId,
      contactId: `playground:${orgId}`,
      orgSettings,
      ragContext,
    });

    // 3. Mesmo roteamento de tier/provider do bot real.
    const { tier, forceProvider } = await pickTierAndOverride(orgId);

    // Agendamento no playground: só a tool de CONSULTA (read-only) — o teste
    // mostra a IA oferecendo horários reais, mas NÃO cria agendamentos de
    // verdade (create_appointment fica fora pra não poluir a agenda com testes).
    const schedulingOn = Boolean(orgSettings?.scheduling?.enabled) && !orgSettings?.scheduling?.optOut;
    const playgroundTools = schedulingOn
      ? getToolsForContext({ hasScheduling: true }).filter((t) => t.name === 'check_availability')
      : undefined;

    // 4. Mesmo turno da Iza (pre-filter + classify + cascade). history vazio:
    // é um teste isolado, sem conversa prévia. conversationId null (sem persistência).
    const turn = await routeIzaTurn({
      systemPrompt,
      userMessage: message,
      history: [],
      tier,
      forceProvider,
      orgId,
      conversationId: null,
      tools: playgroundTools,
    });

    // Vertical bloqueada (apostas/cripto/...) devolve template estático, sem LLM.
    const rawText = turn.kind === 'blocked' ? turn.response : turn.response.text;

    const result = buildPlaygroundResult({ rawLlmText: rawText, sources });

    await logTraining(req, 'kb.playground.test', 'ai_playground', undefined,
      `Teste de IA executado (${result.usedContext ? 'com' : 'sem'} contexto RAG)`);

    res.json(result);
  } catch (err) {
    logger.warn('[AITraining] Playground test falhou', { err: String(err) });
    next(err);
  }
});

// ═══════════════════════════════════════════════════════════
// DOCUMENTOS
// ═══════════════════════════════════════════════════════════

// Contagem de chunks por source no vector store (mesma instância Postgres).
// É o que torna o status por item HONESTO: "indexado" só se chunks > 0 de fato.
async function ragChunkCounts(orgId: string): Promise<Map<string, number>> {
  const namespace = ragService.namespaceFor(orgId);
  const rows = await prisma.$queryRaw<Array<{ source: string; n: bigint }>>`
    SELECT source, count(*)::bigint AS n
      FROM rag_chunks
     WHERE namespace = ${namespace}
     GROUP BY source`;
  return new Map(rows.map((r) => [r.source, Number(r.n)]));
}

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
    const counts = await ragChunkCounts(orgId).catch(() => new Map<string, number>());
    const documents = docs.map((d) => ({
      ...d,
      // URLs são ingeridas com source = hostname+pathname (ver urlToSource);
      // arquivos usam o próprio título/filename.
      ragChunks:
        counts.get(
          d.sourceType === 'url' && d.sourceUrl ? ragService.urlToSource(d.sourceUrl) : d.title,
        ) ?? 0,
    }));
    res.json({ documents });
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

      await logTraining(req, 'kb.document.create', 'kb_document', doc.id,
        `Documento enviado: "${file.originalname}"`);

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

      await logTraining(req, 'kb.url.create', 'kb_document', doc.id, `URL ingerida: ${url}`);

      const readiness = await refreshAIReadiness(orgId).catch(() => null);
      res.status(201).json({ document: doc, readiness });
    } catch (err: any) {
      logger.warn(`[AITraining] URL ingest falhou: ${err.message}`);
      next(err);
    }
  },
);

// POST /api/ai-training/documents/text
// Texto colado direto (sem arquivo/URL). Vira documento e chunks no RAG igual
// a um upload. `source` = título → a contagem de chunks (GET /documents) e o
// DELETE reaproveitam o mesmo caminho dos arquivos.
router.post(
  '/documents/text',
  validate(textDocSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const orgId = req.user!.organizationId;
      const { title, content } = req.body as { title: string; content: string };

      const kb = await ensureKnowledgeBase(orgId);

      await ragService.ingestDocument(orgId, {
        filename: title,
        content: Buffer.from(content, 'utf-8'),
        mimeType: 'text/plain',
      });

      const doc = await prisma.kBDocument.create({
        data: {
          title,
          sourceType: 'text',
          content, // texto colado é curto: guardamos o canônico aqui também
          knowledgeBaseId: kb.id,
        },
        select: { id: true, title: true, sourceType: true, createdAt: true },
      });

      await logTraining(req, 'kb.text.create', 'kb_document', doc.id,
        `Texto colado: "${title}"`);

      const readiness = await refreshAIReadiness(orgId).catch(() => null);
      res.status(201).json({ document: doc, readiness });
    } catch (err: any) {
      logger.warn(`[AITraining] Texto colado falhou: ${err.message}`);
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
      select: { id: true, title: true },
    });
    if (!doc) {
      res.status(404).json({ error: 'Documento não encontrado' });
      return;
    }

    await prisma.kBDocument.delete({ where: { id } });

    // Remove do RAG também (best-effort, por filename estável = título do doc)
    await ragService
      .deleteDocument(orgId, doc.title)
      .catch((err: any) => logger.warn(`[AITraining] RAG remove doc falhou: ${err.message}`));

    await logTraining(req, 'kb.document.delete', 'kb_document', id,
      `Documento removido: "${doc.title}"`);

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
    const counts = await ragChunkCounts(orgId).catch(() => new Map<string, number>());
    res.json({
      qaPairs: pairs.map((p: any) => ({ ...p, ragChunks: counts.get(`qa-${p.id}.txt`) ?? 0 })),
    });
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

    await logTraining(req, 'kb.qa.create', 'qa_pair', pair.id,
      `Q&A criado: "${String(question).slice(0, 80)}"`);

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

    // Sincroniza o vector store com o ESTADO FINAL do par:
    //  - ativo   → re-ingere (filename estável qa-{id}.txt substitui a versão anterior)
    //  - inativo → REMOVE do RAG; sem isso o toggle "Desativar" era cosmético
    //    (só mexia no banco) e a IA continuava respondendo com o Q&A desativado.
    if (pair.isActive === false) {
      await ragService
        .deleteDocument(orgId, `qa-${pair.id}.txt`)
        .catch((err: any) => logger.warn(`[AITraining] RAG remove Q&A (desativado) falhou: ${err.message}`));
    } else {
      const content = `Pergunta: ${pair.question}\n\nResposta: ${pair.answer}`;
      await ragService
        .ingestDocument(orgId, {
          filename: `qa-${pair.id}.txt`,
          content: Buffer.from(content),
          mimeType: 'text/plain',
        })
        .catch((err: any) => logger.warn(`[AITraining] RAG re-sync Q&A (update) falhou: ${err.message}`));
    }

    await logTraining(req, 'kb.qa.update', 'qa_pair', pair.id,
      `Q&A editado: "${String(pair.question).slice(0, 80)}"`,
      { before: { question: existing.question, answer: existing.answer }, after: { question: pair.question, answer: pair.answer } });

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
      select: { id: true, question: true },
    });
    if (!existing) {
      res.status(404).json({ error: 'Q&A não encontrado' });
      return;
    }

    await (prisma as any).QAPair.delete({ where: { id } });

    // 2026-05-20 FIX — remove o doc correspondente do RAG. Antes o Q&A
    // deletado continuava na base vetorial (a IA seguia respondendo com ele).
    // Best-effort: o RAG externo dedupe/identifica pelo filename estável.
    await ragService
      .deleteDocument(orgId, `qa-${id}.txt`)
      .catch((err: any) => logger.warn(`[AITraining] RAG remove Q&A falhou: ${err.message}`));

    await logTraining(req, 'kb.qa.delete', 'qa_pair', id,
      `Q&A removido: "${String(existing.question).slice(0, 80)}"`);

    const readiness = await refreshAIReadiness(orgId).catch(() => null);
    res.json({ ok: true, readiness });
  } catch (err) {
    next(err);
  }
});

// ═══════════════════════════════════════════════════════════
// SURVEY DE QUALIFICAÇÃO (editável pós-onboarding)
// 2026-05-20 — antes as respostas só eram ingeridas 1x no onboarding e
// sumiam. Agora persistem em organization.settings.surveyAnswers e podem
// ser re-completadas/editadas a qualquer momento, re-alimentando o RAG.
// ═══════════════════════════════════════════════════════════

// GET /api/ai-training/survey — retorna as respostas salvas (frontend cruza
// com o catálogo local de perguntas pra calcular faltantes/destaque vermelho).
router.get('/survey', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const orgId = req.user!.organizationId;
    const org = await prisma.organization.findUnique({
      where: { id: orgId },
      select: { settings: true },
    });
    const settings = (org?.settings as any) || {};
    const surveyAnswers = settings.surveyAnswers || {};
    res.json({
      surveyAnswers,
      answeredCount: countAnsweredQuestions(surveyAnswers),
      niche: settings.niche || 'geral',
      segmento: settings.segmento || settings.niche || 'geral',
      subsegmentos: Array.isArray(settings.subsegmentos) ? settings.subsegmentos : [],
    });
  } catch (err) {
    next(err);
  }
});

// PUT /api/ai-training/survey — salva o conjunto completo de respostas +
// re-ingere o documento de conhecimento no RAG + loga.
const surveySchema = z.object({ surveyAnswers: z.record(z.any()) });
router.put('/survey', validate(surveySchema), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const orgId = req.user!.organizationId;
    const { surveyAnswers } = req.body as { surveyAnswers: Record<string, any> };

    const org = await prisma.organization.findUnique({
      where: { id: orgId },
      select: { settings: true, name: true },
    });
    const settings = (org?.settings as any) || {};
    const before = settings.surveyAnswers || {};

    const niche = settings.niche || 'geral';
    const currentFilename = surveyDocFilename(niche);
    // Se o niche mudou desde o último save, o filename muda junto — o doc
    // antigo viraria órfão no RAG (a IA leria a qualificação desatualizada).
    const previousFilename: string | undefined = settings.surveyDocFilename;

    const merged = { ...settings, surveyAnswers, surveyDocFilename: currentFilename };
    await prisma.organization.update({ where: { id: orgId }, data: { settings: merged } });

    // Re-ingere o doc de conhecimento (filename estável → substitui versão anterior)
    const businessName = settings.businessName || org?.name || 'Empresa';
    const kb = buildKnowledgeBase({ businessName, niche, surveyAnswers });
    await ragService
      .ingestDocument(orgId, {
        filename: currentFilename,
        content: Buffer.from(kb),
        mimeType: 'text/plain',
      })
      .catch((err: any) => logger.warn(`[AITraining] RAG re-sync survey falhou: ${err.message}`));

    if (previousFilename && previousFilename !== currentFilename) {
      await ragService
        .deleteDocument(orgId, previousFilename)
        .catch((err: any) => logger.warn(`[AITraining] RAG remove survey antigo falhou: ${err.message}`));
    }

    const answeredCount = countAnsweredQuestions(surveyAnswers);
    await logTraining(req, 'kb.survey.update', 'survey', undefined,
      `Questionário atualizado (${answeredCount} respostas preenchidas)`,
      { before: { answered: countAnsweredQuestions(before) }, after: { answered: answeredCount } });

    const readiness = await refreshAIReadiness(orgId).catch(() => null);
    res.json({ surveyAnswers, answeredCount, readiness });
  } catch (err) {
    next(err);
  }
});

// GET /api/ai-training/activity — histórico inalterável (hash-chained) de
// tudo que alimentou a base de conhecimento: quem, o quê, quando.
router.get('/activity', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const orgId = req.user!.organizationId;
    const logs = await prisma.auditLog.findMany({
      where: { organizationId: orgId, action: { startsWith: 'kb.' } },
      orderBy: { createdAt: 'desc' },
      take: 200,
      select: {
        id: true, action: true, resource: true, resourceId: true,
        details: true, createdAt: true,
        user: { select: { name: true, email: true } },
      },
    });
    res.json({ activity: logs });
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
  // Horário: strings livres por período (ex.: "09:00 às 18:00"). Objeto
  // fechado evita lixo entrando no prompt (o buildHoursSection lê essas chaves).
  businessHours: z
    .object({
      weekdays: z.string().max(120).optional(),
      saturday: z.string().max(120).optional(),
      sunday: z.string().max(120).optional(),
      holidays: z.string().max(120).optional(),
    })
    .partial()
    .optional(),
  greetingMessage: z.string().max(1000).optional(),
  handoffMessage: z.string().max(1000).optional(),
});

// GET /identity — devolve os campos de identidade atuais (org.settings) para
// pré-preencher o painel. Sem isso o cliente não consegue EDITAR o que já
// existe, só sobrescrever do zero.
router.get('/identity', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const orgId = req.user!.organizationId;
    const org = await prisma.organization.findUnique({
      where: { id: orgId },
      select: { settings: true },
    });
    const s = (org?.settings as any) || {};
    res.json({
      identity: {
        agentName: s.agentName || '',
        tone: (s.tone as 'friendly' | 'formal' | 'technical') || 'friendly',
        greetingMessage: s.greetingMessage || '',
        handoffMessage: s.handoffMessage || '',
        // Horário alimenta a seção "HORÁRIO DE FUNCIONAMENTO" do prompt
        // (promptEngine.buildHoursSection). Sem devolver aqui, o cliente não
        // conseguia EDITAR o que já tinha salvo.
        businessHours: {
          weekdays: s.businessHours?.weekdays || '',
          saturday: s.businessHours?.saturday || '',
          sunday: s.businessHours?.sunday || '',
          holidays: s.businessHours?.holidays || '',
        },
      },
    });
  } catch (err) {
    next(err);
  }
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

    await logTraining(req, 'kb.identity.update', 'agent_identity', undefined,
      `Identidade do agente atualizada: ${Object.keys(req.body).join(', ')}`,
      { before: current, after: merged });

    const readiness = await refreshAIReadiness(orgId).catch(() => null);
    res.json({ settings: merged, readiness });
  } catch (err) {
    next(err);
  }
});

// ═══════════════════════════════════════════════════════════
// AGENDAMENTO — o dono do negócio define os tipos que a IA pode agendar.
// A config vira documento no RAG (a IA "sabe" as regras). Fonte estável
// `agendamento-config.txt` (replace-on-ingest). Opt-out remove do RAG.
// ═══════════════════════════════════════════════════════════

// Reconstrói o doc de RAG a partir do estado atual dos tipos. Se opt-out ou
// nenhum tipo ativo, remove o doc do RAG (a IA deixa de oferecer agendamento).
async function resyncSchedulingRag(orgId: string): Promise<void> {
  const org = await prisma.organization.findUnique({ where: { id: orgId }, select: { settings: true } });
  const optOut = Boolean((org?.settings as any)?.scheduling?.optOut);
  const types = optOut
    ? []
    : await (prisma as any).appointmentType.findMany({ where: { organizationId: orgId, active: true } });

  if (types.length === 0) {
    await ragService
      .deleteDocument(orgId, SCHEDULING_RAG_SOURCE)
      .catch((err: any) => logger.warn(`[AITraining] RAG remove agendamento falhou: ${err.message}`));
    return;
  }
  const doc = buildSchedulingKnowledge(types);
  await ragService
    .ingestDocument(orgId, {
      filename: SCHEDULING_RAG_SOURCE,
      content: Buffer.from(doc, 'utf-8'),
      mimeType: 'text/plain',
    })
    .catch((err: any) => logger.warn(`[AITraining] RAG sync agendamento falhou: ${err.message}`));
}

// GET /api/ai-training/scheduling — config (opt-out) + tipos cadastrados.
router.get('/scheduling', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const orgId = req.user!.organizationId;
    const org = await prisma.organization.findUnique({ where: { id: orgId }, select: { settings: true } });
    const optOut = Boolean((org?.settings as any)?.scheduling?.optOut);
    const types = await (prisma as any).appointmentType.findMany({
      where: { organizationId: orgId },
      orderBy: { createdAt: 'asc' },
    });
    const access = await schedulingAccessFor(orgId);
    res.json({ optOut, types, entitled: access.entitled, accessReason: access.reason });
  } catch (err) {
    next(err);
  }
});

// PUT /api/ai-training/scheduling — liga/desliga o agendamento (opt-out).
router.put('/scheduling', validate(schedulingConfigSchema), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const orgId = req.user!.organizationId;
    const { optOut } = req.body as { optOut: boolean };
    // Ativar (optOut=false) exige entitlement. Desativar é sempre permitido.
    if (!optOut) {
      const access = await schedulingAccessFor(orgId);
      if (!access.entitled) {
        res.status(402).json({ error: 'agendamento_requer_addon', addonKey: 'SCHEDULING_AGENT', message: 'O Agendamento pela IA está incluído a partir do plano Growth. No Lite, ative como add-on por R$ 49/mês.' });
        return;
      }
    }
    const org = await prisma.organization.findUnique({ where: { id: orgId }, select: { settings: true } });
    const settings = (org?.settings as any) || {};
    const merged = { ...settings, scheduling: { ...(settings.scheduling || {}), optOut, enabled: !optOut } };
    await prisma.organization.update({ where: { id: orgId }, data: { settings: merged } });

    await resyncSchedulingRag(orgId);
    await logTraining(req, 'kb.scheduling.config', 'scheduling', undefined,
      optOut ? 'Agendamento desativado' : 'Agendamento ativado');

    const readiness = await refreshAIReadiness(orgId).catch(() => null);
    res.json({ optOut, readiness });
  } catch (err) {
    next(err);
  }
});

// POST /api/ai-training/appointment-types — cria um tipo.
router.post('/appointment-types', validate(appointmentTypeSchema), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const orgId = req.user!.organizationId;
    const access = await schedulingAccessFor(orgId);
    if (!access.entitled) {
      res.status(402).json({ error: 'agendamento_requer_addon', addonKey: 'SCHEDULING_AGENT', message: 'O Agendamento pela IA está incluído a partir do plano Growth. No Lite, ative como add-on por R$ 49/mês.' });
      return;
    }
    const t = await (prisma as any).appointmentType.create({
      data: { ...req.body, organizationId: orgId },
    });
    await resyncSchedulingRag(orgId);
    await logTraining(req, 'kb.scheduling.type.create', 'appointment_type', t.id, `Tipo de agendamento criado: "${t.name}"`);
    const readiness = await refreshAIReadiness(orgId).catch(() => null);
    res.status(201).json({ type: t, readiness });
  } catch (err) {
    next(err);
  }
});

// PUT /api/ai-training/appointment-types/:id — atualiza.
router.put('/appointment-types/:id', validate(appointmentTypeSchema.partial()), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const orgId = req.user!.organizationId;
    const { id } = req.params;
    const existing = await (prisma as any).appointmentType.findFirst({ where: { id, organizationId: orgId } });
    if (!existing) {
      res.status(404).json({ error: 'Tipo não encontrado' });
      return;
    }
    const t = await (prisma as any).appointmentType.update({ where: { id }, data: req.body });
    await resyncSchedulingRag(orgId);
    await logTraining(req, 'kb.scheduling.type.update', 'appointment_type', t.id, `Tipo de agendamento editado: "${t.name}"`);
    const readiness = await refreshAIReadiness(orgId).catch(() => null);
    res.json({ type: t, readiness });
  } catch (err) {
    next(err);
  }
});

// DELETE /api/ai-training/appointment-types/:id — remove.
router.delete('/appointment-types/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const orgId = req.user!.organizationId;
    const { id } = req.params;
    const existing = await (prisma as any).appointmentType.findFirst({ where: { id, organizationId: orgId }, select: { id: true, name: true } });
    if (!existing) {
      res.status(404).json({ error: 'Tipo não encontrado' });
      return;
    }
    await (prisma as any).appointmentType.delete({ where: { id } });
    await resyncSchedulingRag(orgId);
    await logTraining(req, 'kb.scheduling.type.delete', 'appointment_type', id, `Tipo de agendamento removido: "${existing.name}"`);
    const readiness = await refreshAIReadiness(orgId).catch(() => null);
    res.json({ ok: true, readiness });
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
