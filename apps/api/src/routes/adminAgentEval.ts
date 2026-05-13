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
import { CORE_AGENT_RULES_V1 } from '../agents/coreAgentRules.js';
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

    const judge = await llmRouter.complete({
      system: JUDGE_SYSTEM,
      messages: [{ role: 'user', content: userPrompt }],
      maxTokens: 200,
      temperature: 0,
      forceProvider: 'anthropic-sonnet',
      operation: 'classify',
    });

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
  const resp = await llmRouter.complete({
    system: systemPrompt,
    messages: messages as any,
    maxTokens: 800,
    temperature: 0.3,
    forceProvider: 'anthropic-sonnet',
    operation: 'chat',
  });
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

router.post(
  '/run',
  authMiddleware as any,
  requireRole('SUPERADMIN') as any,
  async (req: Request, res: Response) => {
    const agentId = String(req.body?.agentId || '');
    const scenarioIds: string[] = Array.isArray(req.body?.scenarios) ? req.body.scenarios : [];
    const category: string | undefined = req.body?.category;
    const criticalOnly: boolean = req.body?.criticalOnly === true;

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

      // Filtra scenarios por criterio
      let scenarios: EvalScenario[];
      if (scenarioIds.length > 0) {
        scenarios = AGENT_EVAL_SET.filter((s) => scenarioIds.includes(s.id));
      } else if (criticalOnly) {
        scenarios = getCriticalScenarios();
      } else if (category) {
        scenarios = getScenariosByCategory(category as any);
      } else {
        scenarios = AGENT_EVAL_SET;
      }

      if (scenarios.length === 0) {
        res.status(400).json({ error: 'nenhum scenario corresponde ao filtro' });
        return;
      }

      logger.info(`[agentEval] run iniciado agentId=${agentId} scenarios=${scenarios.length}`);
      const t0 = Date.now();
      const results: ScenarioResult[] = [];
      for (const s of scenarios) {
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
      const totalMs = Date.now() - t0;

      const passed = results.filter((r) => r.combined === 'pass').length;
      const partial = results.filter((r) => r.combined === 'partial').length;
      const failed = results.filter((r) => r.combined === 'fail').length;
      const criticalFailed = results.filter(
        (r) => r.combined === 'fail' && r.severity === 'critical',
      ).length;

      res.json({
        version: EVAL_SET_VERSION,
        agentId,
        agentName: agent.name,
        totalMs,
        total: results.length,
        passed,
        partial,
        failed,
        criticalFailed,
        scorePercent: Math.round((passed / results.length) * 100),
        results,
        generatedAt: new Date().toISOString(),
      });
    } catch (err: any) {
      logger.error('[agentEval] erro:', err);
      res.status(500).json({ error: 'erro ao executar eval', message: err?.message });
    }
  },
);

export default router;
