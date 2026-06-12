import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { prisma } from '@zappiq/database';
import { validate } from '../middleware/validate.js';
import { snapshotFlowVersion } from '../services/flowVersionService.js';
// ZappIQ Maestro (#280) — engine PURO compartilhado com a produção
// (agentOrchestrator → flowRuntime → flowEngine). O /test usa o MESMO motor pra
// que "testar fluxo" reflita exatamente o comportamento real, sem simulação
// paralela divergente.
import { resolveFlowStep, type FlowGraph, type FlowState } from '../agents/flowEngine.js';
// Maestro "monta pra você" (#288) — gerador híbrido: estrutura determinística
// + IA preenche conteúdo. Devolve um DRAFT (não persiste); o cliente edita e salva.
import { generateFlowDraft, generateSmartFlows, regenerateFlowContent, generateJourney } from '../agents/flowGenerator.js';

const router = Router();

const TRIGGER_TYPES = ['KEYWORD', 'FIRST_CONTACT', 'SCHEDULE', 'MANUAL', 'EVENT'] as const;

const createFlowSchema = z.object({
  name: z.string().min(2),
  description: z.string().optional(),
  triggerType: z.enum(TRIGGER_TYPES),
  triggerConfig: z.record(z.any()).optional(),
  nodes: z.array(z.any()).default([]),
  edges: z.array(z.any()).default([]),
});

// PUT: campos editáveis (NUNCA organizationId/id). Zod remove chaves desconhecidas.
const updateFlowSchema = z.object({
  name: z.string().min(2).optional(),
  description: z.string().nullable().optional(),
  triggerType: z.enum(TRIGGER_TYPES).optional(),
  triggerConfig: z.record(z.any()).nullable().optional(),
  nodes: z.array(z.any()).optional(),
  edges: z.array(z.any()).optional(),
  isActive: z.boolean().optional(),
});

// POST /api/flows/generate — "Maestro monta pra você" (#288)
// Gera um DRAFT de fluxo personalizado (estrutura determinística + IA preenche
// conteúdo) com base no segmento/identidade do negócio. NÃO persiste — o cliente
// revisa, edita e salva via POST /. Devolve também o racional nó a nó.
const generateFlowSchema = z.object({ goal: z.string().optional() });
router.post('/generate', validate(generateFlowSchema), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const draft = await generateFlowDraft({
      organizationId: req.organizationId!,
      goal: req.body?.goal,
    });
    res.json({ success: true, data: draft });
  } catch (err) { next(err); }
});

// POST /api/flows/generate-smart — MAESTRO INTELIGENTE (Onda 1)
// Usa TODO o ai-training (survey completo, docs, Q&A, segmento) + os objetivos
// escolhidos pra gerar 1+ DRAFTS personalizados. multiAgent=true => 1 fluxo
// especialista por objetivo. NÃO persiste — o cliente revisa/edita/salva.
const generateSmartSchema = z.object({
  objectives: z.array(z.string()).optional(),
  multiAgent: z.boolean().optional(),
});
router.post('/generate-smart', validate(generateSmartSchema), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await generateSmartFlows({
      organizationId: req.organizationId!,
      objectives: req.body?.objectives,
      multiAgent: req.body?.multiAgent,
    });
    res.json({ success: true, data: result });
  } catch (err) { next(err); }
});

// POST /api/flows/generate-journey — MAESTRO INTELIGENTE 2.0 (Arquiteto de Jornada)
// Lê TODO o ai-training e desenha a OPERAÇÃO INTEIRA: 1 fluxo especialista por
// objetivo + a malha de interligações (handoffs) entre eles, cada aresta com a
// intenção que dispara o salto + o racional do consultor. Cada Nó-IA já sai
// ciente das transições (handoff "quente"). NÃO persiste — devolve a jornada
// pro cliente revisar/editar/salvar (settings.journeyMap + cada fluxo via POST /).
const generateJourneySchema = z.object({ objectives: z.array(z.string()).optional() });
router.post('/generate-journey', validate(generateJourneySchema), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await generateJourney({
      organizationId: req.organizationId!,
      objectives: req.body?.objectives,
    });
    res.json({ success: true, data: result });
  } catch (err) { next(err); }
});

// CRUD
router.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const orgId = req.organizationId!;
    const flows = await prisma.flow.findMany({
      where: { organizationId: orgId },
      orderBy: { updatedAt: 'desc' },
    });
    // MAESTRO INTELIGENTE (Onda 3): marca o fluxo como "stale" quando o
    // treinamento da IA mudou DEPOIS do fluxo ser gerado/editado. Sinal barato
    // (sem LLM): aiReadinessUpdatedAt (bumpa em toda mudança de treino) > flow.updatedAt.
    const org = await prisma.organization.findUnique({
      where: { id: orgId },
      select: { aiReadinessUpdatedAt: true } as any,
    });
    const trainingAt = (org as any)?.aiReadinessUpdatedAt as Date | null | undefined;
    const data = flows.map((f) => ({
      ...f,
      stale: !!(trainingAt && f.updatedAt && new Date(f.updatedAt) < new Date(trainingAt)),
    }));
    res.json({ success: true, data });
  } catch (err) { next(err); }
});

router.post('/', validate(createFlowSchema), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const flow = await prisma.flow.create({
      data: { ...req.body, organizationId: req.organizationId! },
    });
    res.status(201).json({ success: true, data: flow });
  } catch (err) { next(err); }
});

router.get('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const flow = await prisma.flow.findFirst({ where: { id: req.params.id, organizationId: req.organizationId! } });
    if (!flow) { res.status(404).json({ error: 'Flow not found' }); return; }
    res.json({ success: true, data: flow });
  } catch (err) { next(err); }
});

router.put('/:id', validate(updateFlowSchema), async (req: Request, res: Response, next: NextFunction) => {
  try {
    // req.body já validado/sanitizado pelo updateFlowSchema (sem id/organizationId).
    const result = await prisma.flow.updateMany({ where: { id: req.params.id, organizationId: req.organizationId! }, data: req.body });
    if (result.count === 0) { res.status(404).json({ error: 'Flow not found' }); return; }
    const updated = await prisma.flow.findUnique({ where: { id: req.params.id } });
    res.json({ success: true, data: updated });
  } catch (err) { next(err); }
});

router.delete('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await prisma.flow.deleteMany({ where: { id: req.params.id, organizationId: req.organizationId! } });
    if (result.count === 0) { res.status(404).json({ error: 'Flow not found' }); return; }
    res.json({ success: true, message: 'Flow deleted' });
  } catch (err) { next(err); }
});

// POST /api/flows/:id/refresh-suggestion — MAESTRO INTELIGENTE (Onda 3)
// Regenera SÓ o conteúdo textual do fluxo (mensagem/tag/prompt do nó-IA) com
// base no treinamento ATUAL, preservando a estrutura. NÃO persiste — devolve um
// preview; o cliente aplica com 1 clique (PUT /:id). O clique é a autorização.
router.post('/:id/refresh-suggestion', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const flow = await prisma.flow.findFirst({ where: { id: req.params.id, organizationId: req.organizationId! } });
    if (!flow) { res.status(404).json({ error: 'Flow not found' }); return; }
    const result = await regenerateFlowContent({
      organizationId: req.organizationId!,
      flow: { name: flow.name, nodes: (flow.nodes as any) || [], edges: (flow.edges as any) || [] },
    });
    res.json({ success: true, data: result });
  } catch (err) { next(err); }
});

// POST /api/flows/:id/publish
// Maestro v2 (spec 2026-06-11): múltiplos fluxos ATIVOS por org são suportados —
// o flowRouter (Frente 3) decide qual atende cada conversa. Ao publicar, um
// snapshot imutável é gravado ANTES da ativação (garante rollback via /restore).
// O bump de versão ocorre dentro de snapshotFlowVersion (transação serializável).
router.post('/:id/publish', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const orgId = req.organizationId!;
    const flow = await prisma.flow.findFirst({ where: { id: req.params.id, organizationId: orgId } });
    if (!flow) { res.status(404).json({ error: 'Flow not found' }); return; }

    // Maestro v2: snapshot ANTES de ativar (rollback garantido) + multi-ativo
    // (não desativa mais os demais — o flowRouter decide quem atende; spec 2026-06-11).
    const version = await snapshotFlowVersion(flow.id, orgId, 'publish', req.user?.userId ?? null);
    const published = await prisma.flow.update({
      where: { id: flow.id },
      data: { isActive: true },
    });

    const org = await prisma.organization.findUnique({ where: { id: orgId }, select: { settings: true } });
    const settings = (org?.settings as Record<string, any>) || {};
    const maestro = { ...(settings.maestro || {}), enabled: true };
    await prisma.organization.update({
      where: { id: orgId },
      data: { settings: { ...settings, maestro } as any },
    });

    res.json({ success: true, message: `Flow publicado (versão ${version})`, data: published });
  } catch (err) { next(err); }
});

// GET /api/flows/:id/versions — histórico (imutável) do fluxo
router.get('/:id/versions', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const orgId = req.organizationId!;
    const flow = await prisma.flow.findFirst({ where: { id: req.params.id, organizationId: orgId }, select: { id: true } });
    if (!flow) { res.status(404).json({ error: 'Flow not found' }); return; }
    const versions = await prisma.flowVersion.findMany({
      where: { flowId: flow.id, organizationId: orgId },
      orderBy: { version: 'desc' },
      select: { id: true, version: true, name: true, source: true, createdById: true, createdAt: true },
      take: 50,
    });
    res.json({ success: true, data: versions });
  } catch (err) { next(err); }
});

// POST /api/flows/:id/restore/:versionId — restaura como NOVA versão (histórico nunca reescreve)
router.post('/:id/restore/:versionId', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const orgId = req.organizationId!;
    const target = await prisma.flowVersion.findFirst({
      where: { id: req.params.versionId, flowId: req.params.id, organizationId: orgId },
    });
    if (!target) { res.status(404).json({ error: 'Version not found' }); return; }
    await prisma.flow.update({
      where: { id: req.params.id },
      data: { name: target.name, nodes: target.nodes as any, edges: target.edges as any, triggerType: target.triggerType, triggerConfig: target.triggerConfig as any },
    });
    const version = await snapshotFlowVersion(req.params.id, orgId, 'restore', req.user?.userId ?? null);
    const flow = await prisma.flow.findFirst({ where: { id: req.params.id, organizationId: orgId } });
    res.json({ success: true, message: `Versão ${target.version} restaurada como versão ${version}`, data: flow });
  } catch (err) { next(err); }
});

// POST /api/flows/:id/test
// Replay do fluxo usando o MESMO engine da produção (flowEngine.resolveFlowStep).
// Aceita { message } (1 turno) OU { messages: ["...", "..."] } (multi-turno, pra
// exercitar condition/await_input). Devolve, por turno, os efeitos
// (send_text/handoff/tag/update_lead), o próximo passo (await_input|ai|end) e o
// prompt do nó-IA — exatamente o que o orchestrator faria em prod.
router.post('/:id/test', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const flow = await prisma.flow.findFirst({ where: { id: req.params.id, organizationId: req.organizationId! } });
    if (!flow) { res.status(404).json({ error: 'Flow not found' }); return; }

    const graph: FlowGraph = {
      nodes: Array.isArray(flow.nodes) ? (flow.nodes as any[]) : [],
      edges: Array.isArray(flow.edges) ? (flow.edges as any[]) : [],
    };
    if (graph.nodes.length === 0) {
      res.json({ success: true, data: { turns: [], message: 'Flow has no nodes' } });
      return;
    }

    // Normaliza input: aceita messages[] ou message único.
    const rawMessages: unknown[] = Array.isArray(req.body?.messages)
      ? req.body.messages
      : [req.body?.message ?? req.body?.input?.text ?? ''];

    let state: FlowState = { cursor: null, vars: {} };
    const turns: Array<{
      input: string;
      effects: { kind: string; [k: string]: any }[];
      next: 'await_input' | 'ai' | 'end';
      aiPrompt: string | null;
    }> = [];

    const MAX_TURNS = 25; // trava de segurança
    for (const raw of rawMessages.slice(0, MAX_TURNS)) {
      const msg = String(raw ?? '');
      const step = resolveFlowStep(graph, state, msg);
      turns.push({
        input: msg,
        effects: step.effects,
        next: step.next,
        aiPrompt: step.aiPrompt ?? null,
      });
      state = step.state;
      if (step.next === 'end') break;
    }

    res.json({
      success: true,
      data: { engine: 'flowEngine', turns, finalState: state },
    });
  } catch (err) {
    const error = err instanceof Error ? err : new Error(String(err));
    res.status(500).json({ success: false, error: 'Flow test execution failed', details: error.message });
  }
});

export default router;
