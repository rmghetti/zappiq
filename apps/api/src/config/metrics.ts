import { metrics } from '@opentelemetry/api';

// ── Meter singleton ────────────────────────────────────
// O nome do meter vira atributo `otel_scope_name` no Prometheus
// Manter consistente para facilitar filtros: {otel_scope_name="zappiq.product"}
const meter = metrics.getMeter('zappiq.product', '1.0.0');

// ── LLM metrics ────────────────────────────────────────
// Latencia total da chamada LLM (wall clock). Buckets em segundos.
export const llmRequestDuration = meter.createHistogram('zappiq_llm_request_duration_seconds', {
  description: 'LLM API call duration (seconds)',
  unit: 's',
});

// Tokens processados. Counter separado por tipo (input/output) para calcular
// mix de contexto vs. geracao e custo real.
export const llmTokens = meter.createCounter('zappiq_llm_tokens_total', {
  description: 'LLM tokens processed (input or output)',
});

// Custo em USD. Contador acumulado. Derivado de tokens x pricing por modelo.
export const llmCostUsd = meter.createCounter('zappiq_llm_cost_usd_total', {
  description: 'LLM cost accumulated in USD',
  unit: 'USD',
});

// Erros na camada LLM. Classificados por tipo (rate_limit, timeout, invalid_request, unknown).
export const llmErrors = meter.createCounter('zappiq_llm_errors_total', {
  description: 'LLM request errors by type',
});

// ── Conversation metrics ───────────────────────────────
// Cada mensagem processada pelo pipeline (inbound + outbound).
export const conversationMessages = meter.createCounter('zappiq_conversation_messages_total', {
  description: 'Messages processed in conversations',
});

// Fechamento de conversa (resolucao). Label outcome permite calcular:
// resolution_rate = rate(ai_resolved) / (rate(ai_resolved) + rate(human_handoff))
export const conversationClosed = meter.createCounter('zappiq_conversation_closed_total', {
  description: 'Conversations closed, by outcome',
});

// Handoff explicito (bot -> humano). Sinal mais forte de limitacao do bot.
export const conversationHandoff = meter.createCounter('zappiq_conversation_handoff_total', {
  description: 'Conversations handed off from bot to human',
});

// Intencoes classificadas. Distribuicao ajuda a direcionar roadmap de skills do bot.
export const intentClassified = meter.createCounter('zappiq_intent_classified_total', {
  description: 'Intents classified in incoming messages',
});

// Latencia end-to-end do pipeline do agente: de recebimento do webhook WhatsApp
// ate envio da resposta. P95 deste eh o que o cliente final percebe.
export const agentPipelineDuration = meter.createHistogram('zappiq_agent_pipeline_duration_seconds', {
  description: 'End-to-end agent pipeline duration (inbound -> reply sent)',
  unit: 's',
});

// ── Pricing helper ─────────────────────────────────────
// Pricing oficial Anthropic (USD por 1M tokens). Mantido local para calculo
// em tempo real sem dependencia externa. Atualizar quando Anthropic mudar tabela.
// Docs: https://www.anthropic.com/pricing
const PRICING: Record<string, { input: number; output: number }> = {
  // Claude Sonnet 4
  'claude-sonnet-4-20250514': { input: 3.0, output: 15.0 }, // deprecado, mantido pra rollback
  'claude-sonnet-4-5': { input: 3.0, output: 15.0 },
  'claude-sonnet-4-6': { input: 3.0, output: 15.0 }, // padrão atual (Apr 2026)
  // Claude Haiku 4.5
  'claude-haiku-4-5-20251001': { input: 0.8, output: 4.0 },
  'claude-haiku-4-5': { input: 0.8, output: 4.0 },
  // Claude Opus 4.x
  'claude-opus-4': { input: 15.0, output: 75.0 },
  'claude-opus-4-6': { input: 15.0, output: 75.0 },
};

function getPricing(model: string): { input: number; output: number } {
  // Match exato primeiro, depois prefix match para lidar com versoes datadas
  if (PRICING[model]) return PRICING[model];
  for (const key of Object.keys(PRICING)) {
    if (model.startsWith(key)) return PRICING[key];
  }
  // Fallback conservador (Sonnet tier) se modelo nao mapeado.
  // Previne custo subestimado em alertas; melhor ruim que zero.
  return { input: 3.0, output: 15.0 };
}

// ── High-level recording helpers ───────────────────────
/**
 * Registra métricas da chamada LLM e retorna o custo calculado em USD.
 * O retorno permite ao chamador atribuir o custo ao tenant (trial cap, H10).
 */
export function recordLlmCall(params: {
  model: string;
  operation: 'chat' | 'classify' | 'sentiment';
  durationSeconds: number;
  inputTokens: number;
  outputTokens: number;
}): { costUsd: number } {
  const attrs = { model: params.model, operation: params.operation };

  llmRequestDuration.record(params.durationSeconds, attrs);

  if (params.inputTokens > 0) {
    llmTokens.add(params.inputTokens, { ...attrs, kind: 'input' });
  }
  if (params.outputTokens > 0) {
    llmTokens.add(params.outputTokens, { ...attrs, kind: 'output' });
  }

  const pricing = getPricing(params.model);
  const inputCost = (params.inputTokens / 1_000_000) * pricing.input;
  const outputCost = (params.outputTokens / 1_000_000) * pricing.output;

  if (inputCost > 0) llmCostUsd.add(inputCost, { ...attrs, kind: 'input' });
  if (outputCost > 0) llmCostUsd.add(outputCost, { ...attrs, kind: 'output' });

  return { costUsd: inputCost + outputCost };
}

export function recordLlmError(params: { model: string; operation: string; errorType: string }): void {
  llmErrors.add(1, {
    model: params.model,
    operation: params.operation,
    error_type: params.errorType,
  });
}

// Heuristica para classificar erro do SDK Anthropic em categoria util p/ alerta
export function classifyAnthropicError(err: unknown): string {
  const anyErr = err as any;
  const status = anyErr?.status ?? anyErr?.response?.status;
  const name = anyErr?.name ?? '';
  const msg = String(anyErr?.message ?? '').toLowerCase();

  if (status === 429 || msg.includes('rate limit')) return 'rate_limit';
  if (status === 401 || status === 403) return 'auth';
  if (status === 400) return 'invalid_request';
  if (status && status >= 500) return 'server_error';
  if (msg.includes('timeout') || name === 'AbortError') return 'timeout';
  if (msg.includes('network') || msg.includes('enotfound') || msg.includes('econnreset')) return 'network';
  return 'unknown';
}

// ── BullMQ queue metrics ────────────────────────────────
// V2-023 (Sprint 0 Blocker 2): observabilidade da fila ai-process e demais.
// Usadas pelo poller em queueService.startMetricsPoller() — emite a cada 15s.

// Profundidade da fila (waiting + active). Alerta quando > 20 sustained.
export const queueDepth = meter.createObservableGauge('zappiq_queue_depth', {
  description: 'Number of jobs in queue (waiting + active)',
});

// Idade do job mais antigo aguardando (segundos). Indica saturação.
export const queueOldestJobAge = meter.createObservableGauge('zappiq_queue_oldest_job_age_seconds', {
  description: 'Age of oldest waiting job in seconds',
  unit: 's',
});

// Counter de jobs concluídos (sucesso) e falhos. Permite calcular fail_rate
// = rate(failed) / (rate(completed) + rate(failed)).
export const queueJobsCompleted = meter.createCounter('zappiq_queue_jobs_completed_total', {
  description: 'Jobs completed successfully',
});
export const queueJobsFailed = meter.createCounter('zappiq_queue_jobs_failed_total', {
  description: 'Jobs failed permanently (after all retry attempts)',
});

// Latência fim-a-fim do job (enqueue → completion). Diferente de
// agentPipelineDuration (que mede só o processIncomingMessage).
export const queueJobLatency = meter.createHistogram('zappiq_queue_job_duration_seconds', {
  description: 'Job duration from enqueue to completion (seconds)',
  unit: 's',
});

export function recordQueueJobCompleted(params: { queue: string; durationSeconds: number; attempts: number }): void {
  const attrs = { queue: params.queue };
  queueJobsCompleted.add(1, { ...attrs, attempts: String(params.attempts) });
  queueJobLatency.record(params.durationSeconds, attrs);
}

export function recordQueueJobFailed(params: { queue: string; attempts: number; errorType: string }): void {
  queueJobsFailed.add(1, {
    queue: params.queue,
    attempts: String(params.attempts),
    error_type: params.errorType,
  });
}
