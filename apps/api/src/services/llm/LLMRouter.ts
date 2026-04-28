/* ══════════════════════════════════════════════════════════════════════
 * V2-018 · Multi-LLM fallback + circuit breaker + audit por turn
 * --------------------------------------------------------------------
 * Sprint 0 (Blocker 1): promovido ao caminho de produção.
 *
 * Cascade ATUAL (decisão Plano V2.0 §4.3):
 *   1. Claude Sonnet 4.6     (primário — qualidade pt-BR superior)
 *   2. Claude Haiku 4.5      (fallback 1 — barato/rápido)
 *   3. GPT-4o-mini           (fallback 2 — independência de vendor)
 *
 * Modelo primário é env-driven via ANTHROPIC_MODEL (default: claude-sonnet-4-6).
 * Permite hotfix sem deploy: trocar env no Fly + restart.
 *
 * Circuit breaker por provedor: 3 falhas consecutivas em janela de 60s
 * abrem o breaker por 120s. Falhas consideradas: timeout, 5xx, 429,
 * quota_exceeded. Erros 4xx de input (400, 422) NÃO contam — são falhas
 * do cliente, não do provedor. Estado em memória por instância (aceitável
 * pra Sprint 0 — multi-instância coordenada vai entrar pós-launch).
 *
 * Audit: cada chamada bem-sucedida e cada cascade exhausted gera 1 linha
 * em llm_call_logs com provider/model/tokens/cost_usd_estimate/latency_ms/
 * fallback_triggered/attempt_count. Backbone do dashboard cost-per-tenant
 * (Semana 2 pós-launch).
 *
 * Uso:
 *   import { llmRouter } from './LLMRouter';
 *   const resp = await llmRouter.complete({
 *     system: '...',
 *     messages: [{ role: 'user', content: '...' }],
 *     orgId: organizationId,
 *     conversationId: conversationId,
 *     operation: 'chat',
 *   });
 * ══════════════════════════════════════════════════════════════════════ */

import { logger } from '../../utils/logger.js';
import { env } from '../../config/env.js';
import { logLLMCall } from './llmCallAudit.js';

export type LLMMessage = { role: 'user' | 'assistant' | 'system'; content: string };

export type LLMOperation = 'chat' | 'classify' | 'sentiment';

export type LLMCompletionRequest = {
  system?: string;
  messages: LLMMessage[];
  maxTokens?: number;
  temperature?: number;
  /** Override de provider (Enterprise / classify forçando Haiku / etc). */
  forceProvider?: LLMProviderId;
  /** ID da org (tenant) — vai pra audit. */
  orgId?: string | null;
  /** ID da conversa — rastreabilidade fim-a-fim. */
  conversationId?: string | null;
  /** Operação semântica — vai pra audit. */
  operation?: LLMOperation;
};

export type LLMCompletionResponse = {
  text: string;
  provider: LLMProviderId;
  model: string;
  latencyMs: number;
  usage?: { inputTokens?: number; outputTokens?: number };
  /** 1 = primário; 2 = fallback 1; 3 = fallback 2. */
  attempt: number;
};

export type LLMProviderId = 'anthropic-sonnet' | 'anthropic-haiku' | 'openai-mini';

interface LLMProvider {
  id: LLMProviderId;
  label: string;
  model: string;
  invoke(req: LLMCompletionRequest): Promise<LLMCompletionResponse>;
}

// ══════════════════════════════════════════════════════════════════
// Circuit breaker
// ══════════════════════════════════════════════════════════════════

interface BreakerState {
  failures: number;
  openUntil: number | null;
  lastFailureAt: number | null;
}

const BREAKER_FAIL_THRESHOLD = 3;
const BREAKER_FAIL_WINDOW_MS = 60 * 1000;
const BREAKER_OPEN_DURATION_MS = 120 * 1000;

const breakers = new Map<LLMProviderId, BreakerState>();

function getBreaker(id: LLMProviderId): BreakerState {
  let b = breakers.get(id);
  if (!b) {
    b = { failures: 0, openUntil: null, lastFailureAt: null };
    breakers.set(id, b);
  }
  return b;
}

function breakerIsOpen(id: LLMProviderId): boolean {
  const b = getBreaker(id);
  if (b.openUntil && Date.now() < b.openUntil) return true;
  if (b.openUntil && Date.now() >= b.openUntil) {
    // Half-open: zera e dá uma chance
    b.openUntil = null;
    b.failures = 0;
  }
  return false;
}

function recordSuccess(id: LLMProviderId) {
  const b = getBreaker(id);
  b.failures = 0;
  b.lastFailureAt = null;
}

function recordFailure(id: LLMProviderId, kind: 'timeout' | '5xx' | '429' | 'quota' | 'client') {
  if (kind === 'client') return;
  const b = getBreaker(id);
  const now = Date.now();
  if (b.lastFailureAt && now - b.lastFailureAt > BREAKER_FAIL_WINDOW_MS) {
    b.failures = 0;
  }
  b.failures += 1;
  b.lastFailureAt = now;
  if (b.failures >= BREAKER_FAIL_THRESHOLD) {
    b.openUntil = now + BREAKER_OPEN_DURATION_MS;
    logger.warn(`[LLMRouter] breaker OPEN for ${id} (${b.failures} failures)`);
  }
}

/** Hook de teste: zera todos os breakers (uso restrito a Vitest). */
export function __resetBreakersForTest() {
  breakers.clear();
}

// ══════════════════════════════════════════════════════════════════
// Provider implementations
// ══════════════════════════════════════════════════════════════════

class ProviderError extends Error {
  constructor(
    message: string,
    public kind: 'timeout' | '5xx' | '429' | 'quota' | 'client',
    public latencyMs?: number,
  ) {
    super(message);
  }
}

class AnthropicProvider implements LLMProvider {
  constructor(public id: LLMProviderId, public label: string, public model: string) {}
  async invoke(req: LLMCompletionRequest): Promise<LLMCompletionResponse> {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) throw new ProviderError('missing ANTHROPIC_API_KEY', 'client');
    const t0 = Date.now();
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: this.model,
        max_tokens: req.maxTokens ?? 1024,
        temperature: req.temperature ?? 0.3,
        system: req.system,
        messages: req.messages.filter((m) => m.role !== 'system'),
      }),
    });
    const latencyMs = Date.now() - t0;
    if (!res.ok) {
      const kind = res.status === 429 ? '429' : res.status >= 500 ? '5xx' : 'client';
      throw new ProviderError(`Anthropic ${res.status}`, kind, latencyMs);
    }
    const data: any = await res.json();
    const text = data?.content?.[0]?.text ?? '';
    return {
      text,
      provider: this.id,
      model: this.model,
      latencyMs,
      usage: {
        inputTokens: data?.usage?.input_tokens,
        outputTokens: data?.usage?.output_tokens,
      },
      attempt: 0,
    };
  }
}

class OpenAIProvider implements LLMProvider {
  constructor(public id: LLMProviderId, public label: string, public model: string) {}
  async invoke(req: LLMCompletionRequest): Promise<LLMCompletionResponse> {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) throw new ProviderError('missing OPENAI_API_KEY', 'client');
    const t0 = Date.now();
    const openaiMessages: any[] = [];
    if (req.system) openaiMessages.push({ role: 'system', content: req.system });
    openaiMessages.push(...req.messages);
    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: this.model,
        messages: openaiMessages,
        max_tokens: req.maxTokens ?? 1024,
        temperature: req.temperature ?? 0.3,
      }),
    });
    const latencyMs = Date.now() - t0;
    if (!res.ok) {
      const kind = res.status === 429 ? '429' : res.status >= 500 ? '5xx' : 'client';
      throw new ProviderError(`OpenAI ${res.status}`, kind, latencyMs);
    }
    const data: any = await res.json();
    const text = data?.choices?.[0]?.message?.content ?? '';
    return {
      text,
      provider: this.id,
      model: this.model,
      latencyMs,
      usage: {
        inputTokens: data?.usage?.prompt_tokens,
        outputTokens: data?.usage?.completion_tokens,
      },
      attempt: 0,
    };
  }
}

// ══════════════════════════════════════════════════════════════════
// Router público
// ══════════════════════════════════════════════════════════════════

export class LLMRouter {
  private readonly chain: LLMProvider[];

  constructor(providers?: LLMProvider[]) {
    // Cascade default Sprint 0: Sonnet 4.6 → Haiku 4.5 → GPT-4o-mini.
    // Modelo primário é env-driven (env.ANTHROPIC_MODEL).
    this.chain = providers ?? [
      new AnthropicProvider(
        'anthropic-sonnet',
        'Claude Sonnet 4.6',
        env.ANTHROPIC_MODEL || 'claude-sonnet-4-6',
      ),
      new AnthropicProvider(
        'anthropic-haiku',
        'Claude Haiku 4.5',
        'claude-haiku-4-5-20251001',
      ),
      new OpenAIProvider(
        'openai-mini',
        'GPT-4o-mini',
        'gpt-4o-mini',
      ),
    ];
  }

  /**
   * Executa cascade e devolve a primeira resposta bem-sucedida.
   * Audita cada chamada (sucesso ou cascade exhausted) em llm_call_logs.
   */
  async complete(req: LLMCompletionRequest): Promise<LLMCompletionResponse> {
    const startCascade = Date.now();
    const chain = req.forceProvider
      ? this.chain.filter((p) => p.id === req.forceProvider)
      : this.chain;

    if (chain.length === 0) {
      throw new Error(`LLMRouter: forceProvider=${req.forceProvider} não encontrado na cascade`);
    }

    let lastErr: ProviderError | Error | null = null;
    let attempt = 0;

    for (const provider of chain) {
      attempt += 1;
      if (breakerIsOpen(provider.id)) {
        logger.info(`[LLMRouter] skipping ${provider.id} (breaker open)`);
        continue;
      }
      try {
        const resp = await provider.invoke(req);
        recordSuccess(provider.id);
        const totalLatency = Date.now() - startCascade;

        // Audit (fail-soft) — não bloqueia resposta
        await logLLMCall({
          organizationId: req.orgId ?? null,
          conversationId: req.conversationId ?? null,
          provider: provider.id,
          model: provider.model,
          operation: req.operation ?? 'chat',
          inputTokens: resp.usage?.inputTokens ?? null,
          outputTokens: resp.usage?.outputTokens ?? null,
          latencyMs: totalLatency,
          fallbackTriggered: attempt > 1,
          attemptCount: attempt,
        });

        return { ...resp, attempt, latencyMs: totalLatency };
      } catch (err) {
        lastErr = err as Error;
        if (err instanceof ProviderError) {
          recordFailure(provider.id, err.kind);
          logger.warn(`[LLMRouter] ${provider.id} failed: ${err.message}`, { kind: err.kind });
          if (err.kind === 'client') {
            // 4xx do cliente: devolve direto, não tenta próximo
            await logLLMCall({
              organizationId: req.orgId ?? null,
              conversationId: req.conversationId ?? null,
              provider: provider.id,
              model: provider.model,
              operation: req.operation ?? 'chat',
              latencyMs: Date.now() - startCascade,
              fallbackTriggered: attempt > 1,
              attemptCount: attempt,
              error: err.message,
            });
            throw err;
          }
        } else {
          recordFailure(provider.id, 'timeout');
          logger.warn(`[LLMRouter] ${provider.id} unknown error`, { err });
        }
      }
    }

    // Cascade exhausted: registra falha total
    const totalLatency = Date.now() - startCascade;
    await logLLMCall({
      organizationId: req.orgId ?? null,
      conversationId: req.conversationId ?? null,
      provider: 'none',
      model: 'none',
      operation: req.operation ?? 'chat',
      latencyMs: totalLatency,
      fallbackTriggered: true,
      attemptCount: attempt,
      error: lastErr?.message ?? 'cascade exhausted',
    });

    throw lastErr ?? new Error('LLMRouter: all providers exhausted');
  }

  /** Exposto pra healthcheck /api/admin/llm-status. */
  getStatus() {
    return this.chain.map((p) => ({
      id: p.id,
      label: p.label,
      model: p.model,
      breakerOpen: breakerIsOpen(p.id),
      failures: getBreaker(p.id).failures,
    }));
  }
}

export const llmRouter = new LLMRouter();

// Re-export para testes
export { ProviderError };
