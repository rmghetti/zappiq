/* ══════════════════════════════════════════════════════════════════════
 * V2-018 · langchainClient — agora wrapper sobre LLMRouter
 * --------------------------------------------------------------------
 * Sprint 0 (Blocker 1) refactor:
 *
 * ANTES: chamava Anthropic SDK direto, sem fallback. Outage Anthropic =
 *        Iza muda em todos os tenants simultaneamente.
 *
 * DEPOIS: wrapper fino sobre llmRouter.complete(). Cascade Sonnet 4.6 →
 *        Haiku 4.5 → GPT-4o-mini com circuit breaker e audit por turn.
 *
 * Interface pública NÃO mudou — chatCompletion(), classify() e
 * analyzeSentiment() continuam aceitando os mesmos parâmetros e
 * retornando o mesmo shape. Mas agora aceitam um 4º parâmetro opcional
 * de contexto (orgId + conversationId) pra audit por turn em llm_call_logs.
 *
 * Nota sobre o nome do arquivo: "langchainClient" é histórico — o módulo
 * NÃO importa langchain. Mantido pra evitar churn de imports na Sprint 0.
 * Renomear pra llmClient.ts é tarefa cosmética pra Onda 2.
 *
 * Política de uso:
 *   - chatCompletion() vai pela cascade completa (Sonnet primário).
 *   - classify() força Haiku (operação simples + barata; cascade só
 *     vai pra GPT-4o-mini se Haiku cair).
 *   - analyzeSentiment() = classify() com prompt específico.
 * ══════════════════════════════════════════════════════════════════════ */

import { llmRouter, type LLMMessage as RouterMessage } from './LLMRouter.js';

/** Interface mantida estável pra back-compat com agentOrchestrator. */
export interface LLMMessage {
  role: 'user' | 'assistant';
  content: string;
}

export interface LLMResponse {
  text: string;
  inputTokens: number;
  outputTokens: number;
  /** Novo na V2-018: rastreabilidade de cascade. */
  provider?: string;
  model?: string;
  attempt?: number;
}

/** Contexto opcional pra audit. Aceito por todas as funções. */
export interface LLMContext {
  orgId?: string | null;
  conversationId?: string | null;
}

/**
 * Main conversation call — vai pela cascade completa (Sonnet 4.6 →
 * Haiku 4.5 → GPT-4o-mini). Use pra resposta principal da Iza.
 */
export async function chatCompletion(
  systemPrompt: string,
  messages: LLMMessage[],
  maxTokens = 1024,
  ctx: LLMContext = {},
): Promise<LLMResponse> {
  const resp = await llmRouter.complete({
    system: systemPrompt,
    messages: messages as RouterMessage[],
    maxTokens,
    operation: 'chat',
    orgId: ctx.orgId ?? null,
    conversationId: ctx.conversationId ?? null,
  });

  return {
    text: resp.text,
    inputTokens: resp.usage?.inputTokens ?? 0,
    outputTokens: resp.usage?.outputTokens ?? 0,
    provider: resp.provider,
    model: resp.model,
    attempt: resp.attempt,
  };
}

/**
 * Fast classification call — força Haiku 4.5 (forceProvider).
 * Se Haiku cair (breaker aberto / erro), faz fallback automático pra
 * cascade completa. Custo extra é aceitável pra preservar disponibilidade
 * da Iza (intent classification é gate pra todo turno).
 */
export async function classify(
  prompt: string,
  ctx: LLMContext = {},
): Promise<string> {
  try {
    const resp = await llmRouter.complete({
      messages: [{ role: 'user', content: prompt }],
      maxTokens: 30,
      forceProvider: 'anthropic-haiku',
      operation: 'classify',
      orgId: ctx.orgId ?? null,
      conversationId: ctx.conversationId ?? null,
    });
    return (resp.text ?? '').trim().toLowerCase();
  } catch (err) {
    // Haiku indisponível: tenta cascade completa como fallback.
    const resp = await llmRouter.complete({
      messages: [{ role: 'user', content: prompt }],
      maxTokens: 30,
      operation: 'classify',
      orgId: ctx.orgId ?? null,
      conversationId: ctx.conversationId ?? null,
    });
    return (resp.text ?? '').trim().toLowerCase();
  }
}

/**
 * Sentiment analysis — wrapper sobre classify() com prompt específico.
 */
export async function analyzeSentiment(
  text: string,
  ctx: LLMContext = {},
): Promise<'POSITIVE' | 'NEUTRAL' | 'NEGATIVE'> {
  const result = await classify(
    `Classify the sentiment of this customer message as POSITIVE, NEUTRAL, or NEGATIVE. Reply with ONLY the word.\n\nMessage: "${text}"`,
    ctx,
  );

  const upper = result.toUpperCase();
  if (upper.includes('POSITIVE')) return 'POSITIVE';
  if (upper.includes('NEGATIVE')) return 'NEGATIVE';
  return 'NEUTRAL';
}
