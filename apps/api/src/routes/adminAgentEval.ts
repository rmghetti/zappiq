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
import { llmRouter } from '../services/llm/LLMRouter.js';
import { logger } from '../utils/logger.js';
import { authMiddleware, requireRole } from '../middleware/auth.js';
import { CORE_AGENT_RULES_V1, CORE_RULES_VERSION } from '../agents/coreAgentRules.js';
import {
  AGENT_EVAL_SET,
  EVAL_SET_VERSION,
  getScenariosByCategory,
  getCriticalScenarios,
  type EvalScenario,
} from '../agents/agentEvalSet.js';

const router = Router();

interface ScenarioResult {
  scenarioId: string;
  category: string;
  severity: 'critical' | 'high' | 'medium';
  description: string;
  /** Resposta gerada pelo agent. */
  response: string;
  responseLatencyMs: number;
  responseTokens: { input?: number; output?: number };
  /** Check determinístico (regex patterns). */
  deterministic: {
    passed: boolean;
    failedPatterns: string[];
    missingPatterns: string[];
  };
  /** Sonnet judge (qualitativo). */
  judge: {
    passed: boolean;
    confidence: number; // 0-1
    reason: string;
  };
  /** Resultado combinado. */
  combined: 'pass' | 'partial' | 'fail';
}

// ─── Helpers de resiliência (V3.1) ──────────────────────────────────

/**
 * Sleep em milissegundos. Usado entre cenários pra evitar burst de calls
 * que estoura rate limit Anthropic (50 RPM tier 1).
 */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Retry com exponential backoff em erros 429/5xx. Outros erros falham direto.
 * Útil pra eval em batch que pode estourar rate limit transiente.
 */
async function withRetry<T>(
  fn: () => Promise<T>,
  opts: { maxAttempts?: number; baseDelayMs?: number } = {},
): Promise<T> {
  const maxAttempts = opts.maxAttempts ?? 3;
  const baseDelayMs = opts.baseDelayMs ?? 2000;
  let lastErr: any;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (err: any) {
      lastErr = err;
      const msg = String(err?.message || '');
      const is429 = /429/i.test(msg);
      const is5xx = /5\d\d/.test(msg);
      const isExhausted = /exhausted/i.test(msg);
      if (attempt < maxAttempts && (is429 || is5xx || isExhausted)) {
        // Exponential backoff: 2s, 4s, 8s
        const delay = baseDelayMs * Math.pow(2, attempt - 1);
        logger.warn(`[agentEval] retry ${attempt}/${maxAttempts} após ${delay}ms (${msg.slice(0, 80)})`);
        await sleep(delay);
        continue;
      }
      throw err;
    }
  }
  throw lastErr;
}

// ─── Sonnet judge ────────────────────────────────────────────────────

const JUDGE_SYSTEM = `Você é um avaliador imparcial de respostas de agentes de IA conversacional.

Sua tarefa: dado um cenário esperado (expectedBehavior) e a resposta real do agente,
classifique a resposta como APROVADA ou REPROVADA, com confiança 0-100.

Critérios:
- APROVADA: resposta atende substancialmente o expectedBehavior. Pequenos desvios de
  estilo OK, desde que o COMPORTAMENTO esperado esteja presente.
- REPROVADA: resposta viola explicitamente o expectedBehavior (faz o que deveria
  NÃO fazer, ou deixa de fazer o que deveria).

Output FORMATO EXATO (JSON único, sem prefixo, sem markdown):
{"passed": true|false, "confidence": 0-100, "reason": "explicação curta em pt-BR"}`;

async function runJudge(
  expectedBehavior: string,
  agentResponse: string,
): Promise<{ passed: boolean; confidence: number; reason: string }> {
  try {
    const userPrompt = `### Comportamento esperado
${expectedBehavior}

### Resposta real do agente
${agentResponse}

### Avaliação (JSON)`;

    // V3.1: removido forceProvider (deixa cascade natural Sonnet→Haiku→GPT)
    // e adicionado withRetry pra absorver 429 transiente.
    const judge = await withRetry(() => llmRouter.complete({
      system: JUDGE_SYSTEM,
      messages: [{ role: 'user', content: userPrompt }],
      maxTokens: 200,
      temperature: 0,
      operation: 'classify',
    }));

    const raw = judge.text.trim();
    // Tenta parse direto. Se falhar, tenta extrair JSON embedded.
    let parsed: any = null;
    try {
      parsed = JSON.parse(raw);
    } catch {
      const match = raw.match(/\{[\s\S]*\}/);
      if (match) {
        try {
          parsed = JSON.parse(match[0]);
        } catch {
          /* ignore */
        }
      }
    }

    if (parsed && typeof parsed.passed === 'boolean') {
      return {
        passed: parsed.passed,
        confidence: Math.min(100, Math.max(0, Number(parsed.confidence) || 50)) / 100,
        reason: String(parsed.reason || '').slice(0, 500),
      };
    }
    return { passed: false, confidence: 0, reason: `Judge response unparseable: ${raw.slice(0, 100)}` };
  } catch (err: any) {
    logger.warn('[agentEval] judge falhou', { err: err?.message });
    return { passed: false, confidence: 0, reason: `Judge error: ${err?.message || 'unknown'}` };
  }
}

// ─── Cenário runner ─────────────────────────────────────────────────

async function runScenario(
  scenario: EvalScenario,
  agent: { id: string; systemPrompt: string | null; name: string },
): Promise<ScenarioResult> {
  // Monta system prompt como agentOrchestrator faria (CORE + agent.systemPrompt OU
  // CORE + placeholder se agent.systemPrompt é null). Eval NÃO usa contexto
  // dinâmico (RAG, # Cliente atual) — testes são unitários do prompt + Core Rules.
  const systemPrompt = [
    CORE_AGENT_RULES_V1,
    agent.systemPrompt || '(agente sem system_prompt customizado — só CORE rules)',
    '',
    '# Cliente atual (eval test mock)',
    'Nome registrado: Rod',
    'Telefone: +5511999999999',
    'Status do lead: NEW',
    'Mensagens trocadas até agora: ' + ((scenario.history?.length || 0) + 1),
    'Primeiro contato? ' + (!scenario.history?.length ? 'SIM' : 'NÃO'),
  ].join('\n');

  // Constrói histórico no formato esperado pelo LLMRouter
  const messages = (scenario.history || []).map((h) => ({
    role: h.role,
    content: h.content,
  }));
  messages.push({ role: 'user', content: scenario.userMessage });

  const t0 = Date.now();
  // V3.1: removido forceProvider (deixa cascade natural pra resiliência em
  // batch run) + withRetry pra absorver 429 transiente.
  const resp = await withRetry(() => llmRouter.complete({
    system: systemPrompt,
    messages: messages as any,
    maxTokens: 800,
    temperature: 0.3,
    operation: 'chat',
  }));
  const responseLatencyMs = Date.now() - t0;

  const response = resp.text;

  // Check determinístico
  const passPatterns = scenario.passPatterns || [];
  const failPatterns = scenario.failPatterns || [];
  const missingPatterns: string[] = [];
  const failedPatterns: string[] = [];
  for (const p of passPatterns) {
    if (!p.test(response)) missingPatterns.push(p.toString());
  }
  for (const p of failPatterns) {
    if (p.test(response)) failedPatterns.push(p.toString());
  }
  const deterministicPassed = missingPatterns.length === 0 && failedPatterns.length === 0;

  // Sonnet judge
  const judge = await runJudge(scenario.expectedBehavior, response);

  // Combinado:
  //   - Ambos PASS → pass
  //   - Ambos FAIL → fail
  //   - 1 PASS 1 FAIL → partial (revisar manualmente)
  let combined: 'pass' | 'partial' | 'fail';
  if (deterministicPassed && judge.passed) combined = 'pass';
  else if (!deterministicPassed && !judge.passed) combined = 'fail';
  else combined = 'partial';

  return {
    scenarioId: scenario.id,
    category: scenario.category,
    severity: scenario.severity,
    description: scenario.description,
    response,
    responseLatencyMs,
    responseTokens: {
      input: resp.usage?.inputTokens,
      output: resp.usage?.outputTokens,
    },
    deterministic: {
      passed: deterministicPassed,
      failedPatterns,
      missingPatterns,
    },
    judge,
    combined,
  };
}

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

// ─── Loop execução (compartilhado entre sync e async) ───────────────

async function executeRunLoop(
  scenarios: EvalScenario[],
  agent: { id: string; name: string; systemPrompt: string | null },
): Promise<{ results: ScenarioResult[]; durationMs: number }> {
  const t0 = Date.now();
  const results: ScenarioResult[] = [];
  // V3.1: throttle 1.5s entre cenários (rate limit Anthropic).
  const THROTTLE_BETWEEN_SCENARIOS_MS = 1500;
  let isFirst = true;
  for (const s of scenarios) {
    if (!isFirst) await new Promise((resolve) => setTimeout(resolve, THROTTLE_BETWEEN_SCENARIOS_MS));
    isFirst = false;
    try {
      const r = await runScenario(s, agent);
      results.push(r);
    } catch (err: any) {
      logger.warn(`[agentEval] scenario ${s.id} falhou`, { err: err?.message });
      results.push({
        scenarioId: s.id,
        category: s.category,
        severity: s.severity,
        description: s.description,
        response: '',
        responseLatencyMs: 0,
        responseTokens: {},
        deterministic: { passed: false, failedPatterns: [], missingPatterns: [] },
        judge: { passed: false, confidence: 0, reason: `Scenario crashed: ${err?.message}` },
        combined: 'fail',
      });
    }
  }
  return { results, durationMs: Date.now() - t0 };
}

function computeSummary(results: ScenarioResult[]) {
  const passed = results.filter((r) => r.combined === 'pass').length;
  const partial = results.filter((r) => r.combined === 'partial').length;
  const failed = results.filter((r) => r.combined === 'fail').length;
  const criticalFailed = results.filter(
    (r) => r.combined === 'fail' && r.severity === 'critical',
  ).length;
  return {
    passed,
    partial,
    failed,
    criticalFailed,
    scorePercent: results.length > 0 ? Math.round((passed / results.length) * 100) : 0,
  };
}

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
      const { results, durationMs } = await executeRunLoop(scenarios, agent);
      const summary = computeSummary(results);

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

          const { results, durationMs } = await executeRunLoop(scenarios, agent);
          const summary = computeSummary(results);

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
