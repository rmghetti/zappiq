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
// Resposta Meta out/2026 (PR-E): custo de org em TRIAL/NOVO acumula no teto
// do trial (zappiq:trial_cost_usd:{orgId}). getTrialLlmStage é cacheado em
// Redis por 5 min, então o caminho quente é 1 GET por chamada.
import { getTrialLlmStage, recordTrialCost } from '../../middleware/planLimits.js';
// Resposta Meta out/2026 (PR-I): TODA org acumula o custo do mês em
// zappiq:llmcost:{orgId}:{yyyy-mm}; o orchestrator compara com a premissa
// do contrato no início do turno e arma o Modo Econômico quando estourar.
import { recordMonthlyLlmCost } from './circuitBreaker.js';

export interface LLMCallAuditInput {
  /** ID da organização (tenant). null aceito pra contextos system. */
  organizationId?: string | null;
  /** ID da conversa (rastreabilidade fim-a-fim). */
  conversationId?: string | null;
  /** Provider que efetivamente respondeu (anthropic-sonnet, openai-mini, etc). */
  provider: string;
  /** Modelo usado (string da API: claude-sonnet-4-6, gpt-4o-mini, etc). */
  model: string;
  /**
   * Operação: chat (default), classify (intent), sentiment, extract, eval.
   *
   * 'eval' é o teste da Qualidade do Agente: gasto de BASTIDOR da casa, não
   * de atendimento. Grava custo com a organização (para o painel por tenant
   * enxergar), mas fica fora dos dois orçamentos do cliente. Ver
   * OPERACOES_FORA_DO_ORCAMENTO logo abaixo.
   */
  operation?: 'chat' | 'classify' | 'sentiment' | 'extract' | 'eval';
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
  /**
   * Resposta Meta out/2026 (PR-E): atalho pro cap de trial. Caller que JÁ tem
   * a org carregada informa aqui se ela está em TRIAL/NOVO e evita a consulta
   * (cacheada) de estágio. undefined = descobrir via getTrialLlmStage.
   */
  orgIsTrialOrNew?: boolean;
}

/**
 * A067 / A209 / A225 — orçamento de ATENDIMENTO x orçamento de BASTIDOR.
 *
 * O teto de custo do trial (zappiq:trial_cost_usd) e o acumulador mensal do
 * disjuntor (recordMonthlyLlmCost, que arma o Modo Econômico) existem para
 * proteger a margem do ATENDIMENTO REAL. Quando o gasto da casa entra neles,
 * quem paga é o cliente final: no trial ele passa a receber a frase fixa de
 * modo limitado; no plano pago o atendimento cai em Modo Econômico por 6 h.
 *
 * O teste da Qualidade roda por conta da ZappIQ (cron semanal e botão do
 * painel), não por conta do cliente. Então 'eval' grava a linha de custo COM
 * a organização (o painel por tenant precisa enxergar o gasto, que antes ia
 * com organization_id nulo) e NÃO entra em nenhum dos dois acumuladores.
 *
 * Entrar uma operação nova aqui é decisão de produto: significa que a casa
 * assume aquele gasto. Não adicione sem esse critério.
 */
export const OPERACOES_FORA_DO_ORCAMENTO: ReadonlySet<string> = new Set(['eval']);

/**
 * Persiste um registro de chamada LLM. Calcula cost_usd_estimate
 * automaticamente via tabela MODEL_PRICING.
 *
 * Fail-soft: erro de DB não propaga.
 */
export async function logLLMCall(input: LLMCallAuditInput): Promise<void> {
  let cost = 0;
  // Gasto de bastidor da casa: registra, mas não consome orçamento do cliente.
  const foraDoOrcamento = OPERACOES_FORA_DO_ORCAMENTO.has(input.operation ?? 'chat');
  try {
    cost = estimateCostUsd(input.model, input.inputTokens, input.outputTokens);

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

  // ── Resposta Meta out/2026 (PR-E): teto de custo do TRIAL/NOVO ──────
  // Acumula o custo desta chamada quando a org está em trial ou no estágio
  // NOVO (sem assinatura). Cobre TODAS as operações (chat, classify,
  // transcribe, tts): o cap protege o gasto total de LLM do tenant em teste.
  // Bloco isolado e fail-soft: falha aqui nunca afeta o audit nem a resposta,
  // e falha no audit acima não impede o acúmulo aqui.
  try {
    if (input.organizationId && cost > 0 && !foraDoOrcamento) {
      const capped =
        typeof input.orgIsTrialOrNew === 'boolean'
          ? input.orgIsTrialOrNew
          : (await getTrialLlmStage(input.organizationId)).capped;
      if (capped) {
        await recordTrialCost(input.organizationId, cost);
      }
    }
  } catch (err) {
    logger.warn('[llmCallAudit] Falha ao acumular custo de trial (fail-soft)', {
      error: err instanceof Error ? err.message : String(err),
      organizationId: input.organizationId,
    });
  }

  // ── Resposta Meta out/2026 (PR-I): acumulador do circuit breaker ────
  // TODA org (não só trial) soma o custo desta chamada no acumulador mensal
  // do breaker. Bloco isolado e fail-soft, independente dos dois acima:
  // falha aqui nunca afeta o audit, o teto de trial nem a resposta.
  try {
    if (input.organizationId && cost > 0 && !foraDoOrcamento) {
      await recordMonthlyLlmCost(input.organizationId, cost);
    }
  } catch (err) {
    logger.warn('[llmCallAudit] Falha ao acumular custo mensal do breaker (fail-soft)', {
      error: err instanceof Error ? err.message : String(err),
      organizationId: input.organizationId,
    });
  }
}
