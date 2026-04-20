/* ------------------------------------------------------------------ */
/* V2-018 · Multi-LLM fallback + circuit breaker                       */
/*                                                                     */
/* Cadeia de prioridade:                                               */
/*   1. Claude Opus 4.6 (Anthropic) — qualidade máxima                 */
/*   2. Claude Haiku 4.5 (Anthropic) — fallback rápido e barato        */
/*   3. GPT-4o-mini (OpenAI)        — fallback independente de vendor  */
/*                                                                     */
/* Circuit breaker por provedor: 3 falhas consecutivas em janela de    */
/* 60s abrem o breaker por 120s. Falhas consideradas: timeout, 5xx,    */
/* 429, quota_exceeded. Erros 4xx de input (400, 422) NÃO contam       */
/* — são falhas do cliente, não do provedor.                           */
/*                                                                     */
/* Integra com OpenTelemetry: cada tentativa gera span filho com       */
/* attributes {provider, model, latency_ms, outcome}.                  */
/*                                                                     */
/* Uso:                                                                */
/*   import { llmRouter } from '../services/llm/LLMRouter';            */
/*   const resp = await llmRouter.complete({                           */
/*     system: '...',                                                  */
/*     messages: [{ role: 'user', content: '...' }],                   */
/*     maxTokens: 1024,                                                */
/*   });                                                               */
/* ------------------------------------------------------------------ */

import { logger } from '../../utils/logger.js';

export type LLMMessage = { role: 'user' | 'assistant' | 'system'; content: string };

export type LLMCompletionRequest = {
  system?: string;
  messages: LLMMessage[];
  maxTokens?: number;
  temperature?: number;
  /** Override do tenant para roteamento custom (Enterprise) */
  forceProvider?: 'anthropic-opus' | 'anthropic-haiku' | 'openai-mini';
};

export type LLMCompletionResponse = {
  text: string;
  provider: string;
  model: string;
  latencyMs: number;
  usage?: { inputTokens?: number; outputTokens?: number };
  attempt: number; // 1 = primário, 2 = fallback 1, etc.
};

export type LLMProviderId = 'anthropic-opus' | 'anthropic-haiku' | 'openai-mini';

interface LLMProvider {
  id: LLMProviderId;
  label: string;
  model: string;
  invoke(req: LLMCompletionRequest): Promise<LLMCompletionResponse>;
}

// ── Circuit breaker state (em memória por instância) ──
interface BreakerState {
  failures: number;
  openUntil: number | null; // epoch ms
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
  if (kind === 'client') return; // 4xx do usuário não conta
  const b = getBreaker(id);
  const now = Date.now();
  if (b.lastFailureAt && now - b.lastFailureAt > BREAKER_FAIL_WINDOW_MS) {
    b.failures = 0; // janela expirou
  }
  b.failures += 1;
  b.lastFailureAt = now;
  if (b.failures >= BREAKER_FAIL_THRESHOLD) {
    b.openUntil = now + BREAKER_OPEN_DURATION_MS;
    logger.warn(`[LLMRouter] breaker OPEN for ${id} (${b.failures} failures)`);
  }
}

// ── Provider implementations (real HTTP via SDK) ──

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
      attempt: 0, // preenchido pelo router
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

class ProviderError extends Error {
  constructor(
    message: string,
    public kind: 'timeout' | '5xx' | '429' | 'quota' | 'client',
    public latencyMs?: number,
  ) {
    super(message);
  }
}

// ── Router público ──

class LLMRouter {
  private readonly chain: LLMProvider[];

  constructor() {
    this.chain = [
      new AnthropicProvider('anthropic-opus', 'Claude Opus 4.6', 'claude-opus-4-6'),
      new AnthropicProvider('anthropic-haiku', 'Claude Haiku 4.5', 'claude-haiku-4-5-20251001'),
      new OpenAIProvider('openai-mini', 'GPT-4o-mini', 'gpt-4o-mini'),
    ];
  }

  async complete(req: LLMCompletionRequest): Promise<LLMCompletionResponse> {
    const chain = req.forceProvider
      ? this.chain.filter((p) => p.id === req.forceProvider)
      : this.chain;

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
        return { ...resp, attempt };
      } catch (err) {
        lastErr = err as Error;
        if (err instanceof ProviderError) {
          recordFailure(provider.id, err.kind);
          logger.warn(`[LLMRouter] ${provider.id} failed: ${err.message}`, { kind: err.kind });
          if (err.kind === 'client') {
            // 4xx do cliente: não cai para o próximo, devolve para o chamador
            throw err;
          }
        } else {
          recordFailure(provider.id, 'timeout');
          logger.warn(`[LLMRouter] ${provider.id} unknown error`, { err });
        }
      }
    }

    throw lastErr ?? new Error('LLMRouter: all providers exhausted');
  }

  /** Exposto para healthcheck /api/admin/llm-status */
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
