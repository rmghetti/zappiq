/**
 * /api/admin/agent-eval — Eval contínuo de agentes (task #235)
 *
 * SUPERADMIN-only. Roda o golden set (apps/api/src/agents/agentEvalSet.ts)
 * contra qualquer agent ativo e retorna pass/fail por cenário.
 *
 * Por cenário:
 *   1. Constrói system prompt usando o mesmo path do agentOrchestrator
 *      (CORE_AGENT_RULES_V1 + agent.systemPrompt do DB) — garante que
 *      o teste reproduz o que cliente real receberia.
 *   2. Chama LLMRouter.complete() com forceProvider=anthropic-sonnet
 *      (judging consistente — Sonnet é o "ground truth" da plataforma).
 *   3. Roda check determinístico (passPatterns/failPatterns regex).
 *   4. Roda Sonnet judge: avalia se a resposta cumpre o expectedBehavior.
 *   5. Combina determinístico + judge em pass/partial/fail.
 *
 * Custo: ~50 chamadas Sonnet por run (25 scenarios × 2 calls cada).
 * Tempo: ~3-5 min por run (sequencial pra não saturar).
 *
 * Endpoints:
 *   POST /api/admin/agent-eval/run
 *     body: { agentId: string, scenarios?: string[], category?: EvalCategory, criticalOnly?: boolean }
 *     resp: { agentId, runId, total, passed, failed, partial, results: [...] }
 *
 *   GET /api/admin/agent-eval/scenarios
 *     resp: { total, byCategory: {...}, scenarios: [...] }
 */

import { Router, Request, Response } from 'express';
import { prisma } from '@zappiq/database';
import { logger } from '../utils/logger.js';
import { authMiddleware, requireRole } from '../middleware/auth.js';
import { CORE_RULES_VERSION } from '../agents/coreAgentRules.js';
import {
  AGENT_EVAL_SET,
  EVAL_SET_VERSION,
  getScenariosByCategory,
  getCriticalScenarios,
  type EvalScenario,
} from '../agents/agentEvalSet.js';
// V5/FASE 2 (#241): runner extraído pra service compartilhado (cron + route).
import { executeAgentEvalRun } from '../services/agentEvalRunner.js';

const router = Router();

// ─── Routes ─────────────────────────────────────────────────────────

router.get(
  '/scenarios',
  authMiddleware as any,
  requireRole('SUPERADMIN') as any,
  (_req: Request, res: Response) => {
    const byCategory: Record<string, number> = {};
    for (const s of AGENT_EVAL_SET) {
      byCategory[s.category] = (byCategory[s.category] || 0) + 1;
    }
    res.json({
      version: EVAL_SET_VERSION,
      total: AGENT_EVAL_SET.length,
      byCategory,
      scenarios: AGENT_EVAL_SET.map((s) => ({
        id: s.id,
        category: s.category,
        severity: s.severity,
        description: s.description,
      })),
    });
  },
);

// ─── Filtro de cenários (helper compartilhado pelos 2 endpoints) ────

function filterScenarios(opts: {
  scenarioIds?: string[];
  category?: string;
  criticalOnly?: boolean;
}): EvalScenario[] {
  if (opts.scenarioIds && opts.scenarioIds.length > 0) {
    return AGENT_EVAL_SET.filter((s) => opts.scenarioIds!.includes(s.id));
  }
  if (opts.criticalOnly) return getCriticalScenarios();
  if (opts.category) return getScenariosByCategory(opts.category as any);
  return AGENT_EVAL_SET;
}

// ─── executeRunLoop e computeSummary agora vêm de services/agentEvalRunner ─
//    (extraídos em FASE 2 / V5 — reusados pelo agentEvalCronService).

// ─── POST /run (sync — backwards compat) ────────────────────────────

router.post(
  '/run',
  authMiddleware as any,
  requireRole('SUPERADMIN') as any,
  async (req: Request, res: Response) => {
    const agentId = String(req.body?.agentId || '');
    if (!agentId) {
      res.status(400).json({ error: 'agentId obrigatório' });
      return;
    }

    try {
      const agent = await prisma.agent.findUnique({
        where: { id: agentId },
        select: { id: true, name: true, systemPrompt: true },
      });
      if (!agent) {
        res.status(404).json({ error: `agent ${agentId} não encontrado` });
        return;
      }

      const scenarios = filterScenarios({
        scenarioIds: Array.isArray(req.body?.scenarios) ? req.body.scenarios : undefined,
        category: req.body?.category,
        criticalOnly: req.body?.criticalOnly === true,
      });
      if (scenarios.length === 0) {
        res.status(400).json({ error: 'nenhum scenario corresponde ao filtro' });
        return;
      }

      logger.info(`[agentEval] sync run iniciado agentId=${agentId} scenarios=${scenarios.length}`);
      const { results, durationMs, summary } = await executeAgentEvalRun(scenarios, agent);

      res.json({
        version: EVAL_SET_VERSION,
        agentId,
        agentName: agent.name,
        totalMs: durationMs,
        total: results.length,
        ...summary,
        results,
        generatedAt: new Date().toISOString(),
      });
    } catch (err: any) {
      logger.error('[agentEval] erro:', err);
      res.status(500).json({ error: 'erro ao executar eval', message: err?.message });
    }
  },
);

// ─── POST /run-async (V3.2 — persistido, retorna runId pra polling) ─

router.post(
  '/run-async',
  authMiddleware as any,
  requireRole('SUPERADMIN') as any,
  async (req: Request, res: Response) => {
    const agentId = String(req.body?.agentId || '');
    if (!agentId) {
      res.status(400).json({ error: 'agentId obrigatório' });
      return;
    }

    try {
      const agent = await prisma.agent.findUnique({
        where: { id: agentId },
        select: { id: true, name: true, systemPrompt: true },
      });
      if (!agent) {
        res.status(404).json({ error: `agent ${agentId} não encontrado` });
        return;
      }

      const scenarioIds = Array.isArray(req.body?.scenarios) ? req.body.scenarios : undefined;
      const category = req.body?.category;
      const criticalOnly = req.body?.criticalOnly === true;
      const triggeredBy = String(req.body?.triggeredBy || 'manual'); // 'manual' | 'cron' | 'pre_release'

      const scenarios = filterScenarios({ scenarioIds, category, criticalOnly });
      if (scenarios.length === 0) {
        res.status(400).json({ error: 'nenhum scenario corresponde ao filtro' });
        return;
      }

      // Cria row pending em DB
      const run = await prisma.agentEvalRun.create({
        data: {
          agentId,
          status: 'pending',
          evalSetVersion: EVAL_SET_VERSION,
          coreRulesVersion: CORE_RULES_VERSION,
          triggeredBy,
          scenarioFilter: { scenarioIds, category, criticalOnly } as any,
          totalScenarios: scenarios.length,
        },
        select: { id: true, startedAt: true },
      });

      // Dispara execução em background (setImmediate libera response imediato)
      setImmediate(async () => {
        try {
          await prisma.agentEvalRun.update({
            where: { id: run.id },
            data: { status: 'running' },
          });
          logger.info(`[agentEval] async run iniciado runId=${run.id} agentId=${agentId} scenarios=${scenarios.length}`);

          const { results, durationMs, summary } = await executeAgentEvalRun(scenarios, agent);

          await prisma.agentEvalRun.update({
            where: { id: run.id },
            data: {
              status: 'completed',
              ...summary,
              results: results as any,
              completedAt: new Date(),
              durationMs,
            },
          });
          logger.info(`[agentEval] async run completed runId=${run.id} score=${summary.scorePercent}%`);
        } catch (err: any) {
          logger.error(`[agentEval] async run failed runId=${run.id}`, { err: err?.message });
          await prisma.agentEvalRun.update({
            where: { id: run.id },
            data: {
              status: 'failed',
              error: String(err?.message || 'unknown'),
              completedAt: new Date(),
            },
          }).catch(() => {});
        }
      });

      res.status(202).json({
        runId: run.id,
        status: 'pending',
        agentId,
        agentName: agent.name,
        totalScenarios: scenarios.length,
        evalSetVersion: EVAL_SET_VERSION,
        coreRulesVersion: CORE_RULES_VERSION,
        startedAt: run.startedAt,
        pollUrl: `/api/admin/agent-eval/runs/${run.id}`,
      });
    } catch (err: any) {
      logger.error('[agentEval] run-async erro:', err);
      res.status(500).json({ error: 'erro ao criar run', message: err?.message });
    }
  },
);

// ─── GET /runs/:id (polling de status) ──────────────────────────────

router.get(
  '/runs/:id',
  authMiddleware as any,
  requireRole('SUPERADMIN') as any,
  async (req: Request, res: Response) => {
    try {
      const includeResults = req.query.includeResults === 'true';
      const run = await prisma.agentEvalRun.findUnique({
        where: { id: req.params.id },
        include: {
          agent: { select: { id: true, name: true, organizationId: true } },
        },
      });
      if (!run) {
        res.status(404).json({ error: 'run não encontrada' });
        return;
      }
      // Omite results por padrão (pode ser MB) — frontend pede explicitamente
      const { results, ...rest } = run as any;
      res.json({
        ...rest,
        results: includeResults ? results : undefined,
        hasResults: results != null,
      });
    } catch (err: any) {
      logger.error('[agentEval] runs/:id erro:', err);
      res.status(500).json({ error: 'erro ao buscar run', message: err?.message });
    }
  },
);

// ─── GET /runs (histórico por agent) ────────────────────────────────

router.get(
  '/runs',
  authMiddleware as any,
  requireRole('SUPERADMIN') as any,
  async (req: Request, res: Response) => {
    try {
      const agentId = req.query.agentId ? String(req.query.agentId) : undefined;
      const limit = Math.min(Number(req.query.limit) || 20, 100);
      const status = req.query.status ? String(req.query.status) : undefined;

      const where: any = {};
      if (agentId) where.agentId = agentId;
      if (status) where.status = status;

      const runs = await prisma.agentEvalRun.findMany({
        where,
        orderBy: { startedAt: 'desc' },
        take: limit,
        select: {
          id: true,
          agentId: true,
          status: true,
          evalSetVersion: true,
          coreRulesVersion: true,
          triggeredBy: true,
          totalScenarios: true,
          passed: true,
          partial: true,
          failed: true,
          criticalFailed: true,
          scorePercent: true,
          startedAt: true,
          completedAt: true,
          durationMs: true,
          error: true,
          agent: { select: { name: true } },
        },
      });
      res.json({ total: runs.length, runs });
    } catch (err: any) {
      logger.error('[agentEval] runs (list) erro:', err);
      res.status(500).json({ error: 'erro ao listar runs', message: err?.message });
    }
  },
);

export default router;
