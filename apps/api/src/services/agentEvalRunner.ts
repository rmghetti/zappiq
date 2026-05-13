/**
 * Agent Eval Runner — service compartilhado entre route e cron.
 *
 * Extraído de apps/api/src/routes/adminAgentEval.ts (V3.2) durante FASE 2 (V5)
 * pra permitir reuso pelo agentEvalCronService sem duplicação de lógica.
 *
 * Exporta um único entry-point limpo: `executeAgentEvalRun(scenarios, agent)`.
 * Tudo mais (judge, retry, throttle, score compute) é interno.
 */

import { llmRouter } from './llm/LLMRouter.js';
import { logger } from '../utils/logger.js';
import { CORE_AGENT_RULES_V1 } from '../agents/coreAgentRules.js';
import type { EvalScenario } from '../agents/agentEvalSet.js';

// ─── Tipos públicos ─────────────────────────────────────────────────

export interface ScenarioResult {
  scenarioId: string;
  category: string;
  severity: 'critical' | 'high' | 'medium';
  description: string;
  response: string;
  responseLatencyMs: number;
  responseTokens: { input?: number; output?: number };
  deterministic: {
    passed: boolean;
    failedPatterns: string[];
    missingPatterns: string[];
  };
  judge: {
    passed: boolean;
    confidence: number; // 0-1
    reason: string;
  };
  combined: 'pass' | 'partial' | 'fail';
}

export interface RunSummary {
  passed: number;
  partial: number;
  failed: number;
  criticalFailed: number;
  scorePercent: number;
}

// ─── Helpers de resiliência ─────────────────────────────────────────

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

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
        const delay = baseDelayMs * Math.pow(2, attempt - 1);
        logger.warn(`[agentEvalRunner] retry ${attempt}/${maxAttempts} após ${delay}ms (${msg.slice(0, 80)})`);
        await sleep(delay);
        continue;
      }
      throw err;
    }
  }
  throw lastErr;
}

// ─── Sonnet judge ───────────────────────────────────────────────────

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

    const judge = await withRetry(() => llmRouter.complete({
      system: JUDGE_SYSTEM,
      messages: [{ role: 'user', content: userPrompt }],
      maxTokens: 200,
      temperature: 0,
      operation: 'classify',
    }));

    const raw = judge.text.trim();
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
    logger.warn('[agentEvalRunner] judge falhou', { err: err?.message });
    return { passed: false, confidence: 0, reason: `Judge error: ${err?.message || 'unknown'}` };
  }
}

// ─── Cenário runner ────────────────────────────────────────────────

async function runScenario(
  scenario: EvalScenario,
  agent: { id: string; systemPrompt: string | null; name: string },
): Promise<ScenarioResult> {
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

  const messages = (scenario.history || []).map((h) => ({
    role: h.role,
    content: h.content,
  }));
  messages.push({ role: 'user', content: scenario.userMessage });

  const t0 = Date.now();
  const resp = await withRetry(() => llmRouter.complete({
    system: systemPrompt,
    messages: messages as any,
    maxTokens: 800,
    temperature: 0.3,
    operation: 'chat',
  }));
  const responseLatencyMs = Date.now() - t0;

  const response = resp.text;

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

  const judge = await runJudge(scenario.expectedBehavior, response);

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

// ─── Score compute ─────────────────────────────────────────────────

export function computeSummary(results: ScenarioResult[]): RunSummary {
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

// ─── Public entry-point ───────────────────────────────────────────

const THROTTLE_BETWEEN_SCENARIOS_MS = 1500;

/**
 * Executa o golden set inteiro num agent. Throttle de 1.5s entre cenários
 * pra absorver rate limit Anthropic. Retries automáticos em 429/5xx
 * (3 attempts, exponential backoff).
 *
 * Cenário que crasha durante exec não trava o run — vira fail registrado.
 */
export async function executeAgentEvalRun(
  scenarios: EvalScenario[],
  agent: { id: string; name: string; systemPrompt: string | null },
): Promise<{ results: ScenarioResult[]; durationMs: number; summary: RunSummary }> {
  const t0 = Date.now();
  const results: ScenarioResult[] = [];
  let isFirst = true;
  for (const s of scenarios) {
    if (!isFirst) await sleep(THROTTLE_BETWEEN_SCENARIOS_MS);
    isFirst = false;
    try {
      const r = await runScenario(s, agent);
      results.push(r);
    } catch (err: any) {
      logger.warn(`[agentEvalRunner] scenario ${s.id} falhou`, { err: err?.message });
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
  const durationMs = Date.now() - t0;
  const summary = computeSummary(results);
  return { results, durationMs, summary };
}
