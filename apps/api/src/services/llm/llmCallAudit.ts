/* ══════════════════════════════════════════════════════════════════════
 * V2-018 · LLM call audit (Sprint 0 Blocker 1)
 * --------------------------------------------------------------------
 * Persiste 1 linha em llm_call_logs por chamada do LLMRouter.complete().
 *
 * Não usa auditService.logAuditEvent porque:
 *   1. logAuditEvent exige req.user + req.organizationId (HTTP context).
 *      LLM é chamado do worker BullMQ, sem req.
 *   2. Hash chain de audit_logs é caro pra escrever 5-10x por conversa.
 *   3. Cost-per-tenant dashboard (Semana 2) precisa de query agregada
 *      simples. Tabela dedicada permite índices apropriados.
 *
 * Fail-soft: erro persistir audit NÃO derruba a chamada LLM. Loga warn
 * estruturado e segue. Se Grafana detectar fail rate > 1%, alerta.
 * ══════════════════════════════════════════════════════════════════════ */

import { prisma, Prisma } from '@zappiq/database';
import { logger } from '../../utils/logger.js';
import { estimateCostUsd } from '../../utils/llmCost.js';

export interface LLMCallAuditInput {
  /** ID da organização (tenant). null aceito pra contextos system. */
  organizationId?: string | null;
  /** ID da conversa (rastreabilidade fim-a-fim). */
  conversationId?: string | null;
  /** Provider que efetivamente respondeu (anthropic-sonnet, openai-mini, etc). */
  provider: string;
  /** Modelo usado (string da API: claude-sonnet-4-6, gpt-4o-mini, etc). */
  model: string;
  /** Operação: chat (default), classify (intent), sentiment. */
  operation?: 'chat' | 'classify' | 'sentiment';
  /** Tokens de input retornados pelo provider. */
  inputTokens?: number | null;
  /** Tokens de output retornados pelo provider. */
  outputTokens?: number | null;
  /** Latência total da chamada (incluindo tentativas anteriores se fallback). */
  latencyMs: number;
  /** true se essa resposta veio de fallback (attempt > 1). */
  fallbackTriggered?: boolean;
  /** Número da tentativa (1 = primário, 2 = fallback 1, etc). */
  attemptCount?: number;
  /** Mensagem de erro quando todos providers falharam. */
  error?: string | null;
}

/**
 * Persiste um registro de chamada LLM. Calcula cost_usd_estimate
 * automaticamente via tabela MODEL_PRICING.
 *
 * Fail-soft: erro de DB não propaga.
 */
export async function logLLMCall(input: LLMCallAuditInput): Promise<void> {
  try {
    const cost = estimateCostUsd(input.model, input.inputTokens, input.outputTokens);

    await prisma.lLMCallLog.create({
      data: {
        organizationId: input.organizationId ?? null,
        conversationId: input.conversationId ?? null,
        provider: input.provider,
        model: input.model,
        operation: input.operation ?? 'chat',
        inputTokens: input.inputTokens ?? null,
        outputTokens: input.outputTokens ?? null,
        costUsdEstimate: cost > 0 ? new Prisma.Decimal(cost) : null,
        latencyMs: Math.round(input.latencyMs),
        fallbackTriggered: input.fallbackTriggered ?? false,
        attemptCount: input.attemptCount ?? 1,
        error: input.error ?? null,
      },
    });
  } catch (err) {
    // Audit MAIS é log de telemetria — falha não pode afetar resposta ao cliente.
    logger.warn('[llmCallAudit] Failed to persist LLM call log', {
      error: err instanceof Error ? err.message : String(err),
      provider: input.provider,
      model: input.model,
      organizationId: input.organizationId,
    });
  }
}
