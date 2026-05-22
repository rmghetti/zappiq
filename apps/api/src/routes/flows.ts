import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { prisma } from '@zappiq/database';
import { validate } from '../middleware/validate.js';
// ZappIQ Maestro (#280) — engine PURO compartilhado com a produção
// (agentOrchestrator → flowRuntime → flowEngine). O /test usa o MESMO motor pra
// que "testar fluxo" reflita exatamente o comportamento real, sem simulação
// paralela divergente.
import { resolveFlowStep, type FlowGraph, type FlowState } from '../agents/flowEngine.js';
// Maestro "monta pra você" (#288) — gerador híbrido: estrutura determinística
// + IA preenche conteúdo. Devolve um DRAFT (não persiste); o cliente edita e salva.
import { generateFlowDraft } from '../agents/flowGenerator.js';

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

// CRUD
router.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const flows = await prisma.flow.findMany({
      where: { organizationId: req.organizationId! },
      orderBy: { updatedAt: 'desc' },
    });
    res.json({ success: true, data: flows });
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

// POST /api/flows/:id/publish
// Garante 1 fluxo ATIVO por org: desativa os demais e ativa este. O runtime
// (resolveActiveFlowStep) faz findFirst({isActive:true}); com 2 ativos o
// comportamento ficaria ambíguo, por isso o invariante de exclusividade.
router.post('/:id/publish', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const orgId = req.organizationId!;
    const flow = await prisma.flow.findFirst({ where: { id: req.params.id, organizationId: orgId } });
    if (!flow) { res.status(404).json({ error: 'Flow not found' }); return; }

    // desativa os outros fluxos da org (scoped por orgId — RLS-safe)
    await prisma.flow.updateMany({
      where: { organizationId: orgId, isActive: true, NOT: { id: flow.id } },
      data: { isActive: false },
    });
    // ativa este (+ bump de versão)
    const published = await prisma.flow.update({
      where: { id: flow.id },
      data: { isActive: true, version: { increment: 1 } },
    });

    // GA self-serve: publicar TAMBÉM liga o Maestro para a org. Sem isto, o
    // runtime (resolveActiveFlowStep) exige settings.maestro.enabled e o fluxo
    // publicado não rodaria — cliente publicaria e "nada aconteceria". Merge
    // preservando o resto do settings.
    const org = await prisma.organization.findUnique({ where: { id: orgId }, select: { settings: true } });
    const settings = (org?.settings as Record<string, any>) || {};
    const maestro = { ...(settings.maestro || {}), enabled: true };
    await prisma.organization.update({
      where: { id: orgId },
      data: { settings: { ...settings, maestro } as any },
    });

    res.json({ success: true, message: 'Flow published (demais desativados; Maestro ativado na org)', data: published });
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
