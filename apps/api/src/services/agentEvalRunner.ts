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
import { classifyIntent, shouldEscalateToSonnet, type IzaIntent } from './llm/intentClassifier.js';
import { logger } from '../utils/logger.js';
import { CORE_AGENT_RULES_V1 } from '../agents/coreAgentRules.js';
import type { EvalScenario } from '../agents/agentEvalSet.js';

// ─── Tipos públicos ─────────────────────────────────────────────────

export interface ScenarioResult {
  scenarioId: string;
  category: string;
  severity: 'critical' | 'high' | 'medium';
  description: string;
  /**
   * FASE 2.2c (#246): mensagem que foi enviada ao agente. Antes ficava
   * só no AGENT_EVAL_SET em memória — agora persiste em results JSONB
   * pra UI mostrar contexto completo (pergunta + resposta).
   */
  userMessage: string;
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
  /**
   * Nível 1 auto-suggest (FASE 2.1 hotfix, 2026-05-13):
   * Quando combined=fail/partial, runner dispara Sonnet pra propor 1-3 patches
   * no system prompt que corrigiriam esse cenário. Custo: ~$0.05/fail.
   * Cliente/admin revisa e aplica manualmente — sem aplicar em prod sozinho.
   */
  suggestedFix?: {
    summary: string; // 1 linha executiva
    patches: Array<{
      where: string; // ex: "REGRA 13 (uso de nome)"
      diff: string; // patch em markdown
    }>;
    confidence: number; // 0-1
  };
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

// ─── Sugestão automática (Nível 1) ─────────────────────────────────

const SUGGEST_SYSTEM = `Você é um engenheiro de prompts especialista. Vai analisar
um cenário de teste que FALHOU num agente de IA conversacional e propor 1-3
ajustes específicos no system prompt que corrigiriam SÓ esse cenário sem
quebrar outros.

REGRAS DE FORMATO (CRÍTICO — modelos como Gemini Starter IGNORAM regras
em formato fraco e bullets soltos):

1. SEMPRE formate cada patch como REGRA INVIOLÁVEL nomeada e numerada:
   "**REGRA INVIOLÁVEL #N — TÍTULO EM CAPS:** instrução clara. Exemplo CORRETO:
   '...'. Exemplo INCORRETO: '...'."
   NUNCA emita patch em formato de bullet solto, frase corrida no meio do
   prompt ou linha sem cabeçalho — modelos pulam essas.

2. Em "where", se já existe uma regra inviolável sobre o mesmo tema no
   trecho recebido, FORTALEÇA ELA em vez de adicionar regra nova
   (where = "REGRA INVIOLÁVEL #X — fortalecer"). Só crie regra nova
   (where = "INVIOLÁVEIS — novo item #N") quando não houver overlap.
   Aplicar 4 vezes a mesma regra duplicada incha o prompt sem efeito.

3. Inclua SEMPRE Exemplo CORRETO e Exemplo INCORRETO no diff. Modelos
   aprendem por padrão, não por princípio.

4. Use CAPS e palavras absolutas (SEMPRE, NUNCA, OBRIGATORIAMENTE) — não
   "evite", "prefira", "tente".

5. Patches CIRÚRGICOS (1 regra por patch). Confiança 0-100: quão certo está
   que o patch resolve E não regride.

Output FORMATO EXATO (JSON único, sem prefixo, sem markdown):
{"summary": "1 linha executiva", "patches": [{"where": "INVIOLÁVEIS — novo item #N | REGRA INVIOLÁVEL #X — fortalecer", "diff": "+ **REGRA INVIOLÁVEL #N — TÍTULO:** ... Exemplo CORRETO: ... Exemplo INCORRETO: ..."}], "confidence": 0-100}`;

// FASE 2.2d (#252): exportado pra ser chamado on-demand pelo endpoint
// generate-suggestion (usuário pede sugestão pra cenário partial que não
// teve uma gerada automaticamente — sugestões automáticas só ocorrem em fail).
export async function suggestFix(
  scenarioId: string,
  expectedBehavior: string,
  agentResponse: string,
  judgeReason: string,
  systemPromptExcerpt: string,
): Promise<ScenarioResult['suggestedFix']> {
  try {
    const userPrompt = `### Cenário: ${scenarioId}

### Comportamento esperado
${expectedBehavior}

### Resposta real (FALHOU)
${agentResponse.slice(0, 1200)}

### Diagnóstico do juiz
${judgeReason}

### Trecho relevante do system prompt atual
${systemPromptExcerpt.slice(0, 2000)}

### Patches sugeridos (JSON)`;

    const out = await withRetry(() =>
      llmRouter.complete({
        system: SUGGEST_SYSTEM,
        messages: [{ role: 'user', content: userPrompt }],
        maxTokens: 600,
        temperature: 0.2,
        operation: 'classify',
      }),
    );

    const raw = out.text.trim();
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

    if (parsed && Array.isArray(parsed.patches)) {
      return {
        summary: String(parsed.summary || '').slice(0, 200),
        patches: parsed.patches.slice(0, 3).map((p: any) => ({
          where: String(p.where || '').slice(0, 100),
          diff: String(p.diff || '').slice(0, 600),
        })),
        confidence: Math.min(100, Math.max(0, Number(parsed.confidence) || 50)) / 100,
      };
    }
    return undefined;
  } catch (err: any) {
    logger.warn('[agentEvalRunner] suggestFix falhou', { err: err?.message, scenarioId });
    return undefined;
  }
}

// ─── Cenário runner ────────────────────────────────────────────────

async function runScenario(
  scenario: EvalScenario,
  agent: { id: string; systemPrompt: string | null; name: string },
): Promise<ScenarioResult> {
  // FASE 2.1 fix (2026-05-13): mock condicional do bloco "Cliente atual".
  // Cenários cr5_nome_ausente_* testam o comportamento de PERGUNTAR nome —
  // injetar "Nome registrado: Rod" forçava o agent a usar o nome (falso pass)
  // e quebrava esses cenários (falso fail). Solução: se scenarioId contém
  // 'nome_ausente', mock omite o nome.
  const nameMockEnabled = !scenario.id.includes('nome_ausente');

  const systemPrompt = [
    CORE_AGENT_RULES_V1,
    agent.systemPrompt || '(agente sem system_prompt customizado — só CORE rules)',
    '',
    '# Cliente atual (eval test mock)',
    nameMockEnabled ? 'Nome registrado: Rod' : 'Nome registrado: (não informado)',
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

  // V5 fix (2026-05-26): eval runner DEVE espelhar prod 1:1. Antes chamava
  // llmRouter.complete direto, sem classify — ou seja, eval testava Gemini
  // Starter puro enquanto prod já escalava pra Sonnet em intent crítica
  // (handoff/objection/enterprise/purchase_intent/price_question). Resultado:
  // cenários como zappiq_voice_preco_correto sempre apareciam como 'partial'
  // no eval (Gemini reflex "começa em R$ X"), mesmo com Sonnet acertando
  // em prod. Agora roda classifyIntent + shouldEscalateToSonnet ANTES da
  // chamada principal — mesma cascata do izaTurnRouter.
  let intent: IzaIntent = 'normal';
  let preferProvider: 'anthropic-sonnet' | undefined;
  try {
    intent = await classifyIntent(scenario.userMessage, messages.slice(0, -1) as any, {
      orgId: null,
      conversationId: null,
    });
    if (shouldEscalateToSonnet(intent)) {
      // PR #216: preferProvider (com fallback) em vez de forceProvider (sem).
      // Bug anterior: Sonnet rate-limit derrubava 7 cenarios com "all providers
      // exhausted". Agora cai pra Haiku/Gemini se Sonnet falhar.
      preferProvider = 'anthropic-sonnet';
    }
  } catch (err: any) {
    logger.warn('[agentEvalRunner] classifyIntent falhou no eval — usando default tier', {
      scenarioId: scenario.id,
      err: err?.message,
    });
  }

  const t0 = Date.now();
  const resp = await withRetry(() => llmRouter.complete({
    system: systemPrompt,
    messages: messages as any,
    maxTokens: 800,
    temperature: 0.3,
    operation: 'chat',
    preferProvider,
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

  // Nível 1 auto-suggest: gera sugestão pra TODA NÃO-aprovação (fail + partial).
  // Mudanca 2026-05-25: parciais tambem ganham sugestao e botao Aplicar — o
  // objetivo e fechar o loop curto e empurrar o score em direcao a 90%+ (sem
  // depender do usuario lembrar de pedir sob demanda pra desvios menores).
  let suggestedFix: ScenarioResult['suggestedFix'] = undefined;
  if (combined === 'fail' || combined === 'partial') {
    suggestedFix = await suggestFix(
      scenario.id,
      scenario.expectedBehavior,
      response,
      judge.reason,
      agent.systemPrompt || '(sem prompt customizado)',
    );
  }

  return {
    scenarioId: scenario.id,
    category: scenario.category,
    severity: scenario.severity,
    description: scenario.description,
    userMessage: scenario.userMessage,
    response,
    responseLatencyMs,
    responseTokens: {
      input: resp.usage?.inputTokens,
      output: resp.usage?.outputTokens,
    },
    suggestedFix,
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

// ─── Re-verify verdict helper (Q1 — fecha o loop pós-fix) ────────

/**
 * Computa o veredicto de re-verificação comparando o resultado anterior
 * (before) com o novo resultado (after) de um re-run pós-fix.
 *
 * Pure function — sem I/O, testável em isolamento.
 *
 * @param before - combined anterior (do results JSONB da run), ou null se
 *                 não disponível (runs antigas).
 * @param afterResult - combined retornado pelo executeAgentEvalRun após o fix.
 * @returns { scenarioId, before, after, improved } — improved = after === 'pass'.
 */
export function computeReverifyVerdict(
  before: 'pass' | 'partial' | 'fail' | null,
  afterResult: 'pass' | 'partial' | 'fail',
): { before: typeof before; after: typeof afterResult; improved: boolean } {
  return {
    before,
    after: afterResult,
    improved: afterResult === 'pass',
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
        userMessage: s.userMessage,
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
