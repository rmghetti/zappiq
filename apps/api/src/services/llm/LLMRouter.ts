/* ══════════════════════════════════════════════════════════════════════
 * V2-018 · Multi-LLM fallback + circuit breaker + audit por turn
 * V4 #V4-001 (2026-04-30) · Tier-based default routing + GoogleProvider
 * --------------------------------------------------------------------
 * Sprint 0 (Blocker 1): promovido ao caminho de produção.
 *
 * Cascade DEFAULT (sem tier especificado):
 *   1. Claude Sonnet 4.6     (primário — qualidade pt-BR superior)
 *   2. Claude Haiku 4.5      (fallback 1 — barato/rápido)
 *   3. GPT-4o-mini           (fallback 2 — independência de vendor)
 *
 * Cascade TIER-BASED (V4 — quando req.tier está setado):
 *   - STARTER/GROWTH    → Gemini 2.5 Flash → Sonnet → Haiku → GPT-4o-mini
 *   - SCALE/BUSINESS/ENTERPRISE → Sonnet → Haiku → GPT-4o-mini (=default)
 *
 * Decisão consolidada pós-Gate 1 (2026-04-30): Gemini 2.5 Flash é 200×
 * mais barato que Sonnet com qualidade comparável em conversa standard.
 * Tiers premium ficam em Sonnet pra preservar margem percebida.
 * Iza (org cmo1ywwfe00ko1jskexiexsm4) usa cascade default = Sonnet.
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

/** Tier do tenant — usado em V4 pra tier-based default routing. */
export type LLMTier = 'STARTER' | 'GROWTH' | 'SCALE' | 'BUSINESS' | 'ENTERPRISE';

/**
 * Mapping tier → provider primário (V4 #V4-001).
 *
 * Decisão consolidada pós-Gate 1 (2026-04-30): tiers menores rodam Gemini
 * 2.5 Flash (200× mais barato que Sonnet com qualidade equivalente em
 * conversa standard). Tiers premium ficam em Sonnet pra preservar margem
 * percebida e absorver casos complexos sem cascade.
 *
 * Iza (vitrine) NÃO passa tier — usa cascade default (Sonnet primário).
 * Override per-org futuramente via organizations.settings.llm_routing.
 */
export const TIER_PRIMARY_PROVIDER: Record<LLMTier, LLMProviderId> = {
  STARTER: 'google-gemini-flash',
  GROWTH: 'google-gemini-flash',
  SCALE: 'anthropic-sonnet',
  BUSINESS: 'anthropic-sonnet',
  ENTERPRISE: 'anthropic-sonnet',
};

export type LLMCompletionRequest = {
  system?: string;
  messages: LLMMessage[];
  maxTokens?: number;
  temperature?: number;
  /** Override de provider (Enterprise / classify forçando Haiku / etc). Tem prioridade sobre tier. */
  forceProvider?: LLMProviderId;
  /**
   * Tier do tenant — quando setado, determina provider primário via
   * TIER_PRIMARY_PROVIDER. Se nem tier nem forceProvider estiverem
   * setados, usa cascade default (Sonnet primário). V4 #V4-001.
   */
  tier?: LLMTier;
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

export type LLMProviderId =
  | 'google-gemini-flash'
  | 'anthropic-sonnet'
  | 'anthropic-haiku'
  | 'openai-mini';

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

/**
 * Google Gemini provider (V4 #V4-001).
 *
 * Usa Generative Language API (v1beta). Gemini tem schema diferente do
 * Anthropic/OpenAI — mensagens vão em `contents` com role 'user'/'model',
 * system instruction em campo separado. Mapeamos pra `LLMMessage` na entrada.
 *
 * Pricing (2026-04): $0.075 input / $0.30 output por 1M tokens — ~200× mais
 * barato que Sonnet 4.6 (validado no Gate 1, 2026-04-30).
 *
 * Free tier: 10 RPM, 250 RPD. Paid tier removido o limite.
 * Em produção V4, paid tier obrigatório quando volume passar de ~50 conv/dia.
 */
class GoogleProvider implements LLMProvider {
  constructor(public id: LLMProviderId, public label: string, public model: string) {}
  async invoke(req: LLMCompletionRequest): Promise<LLMCompletionResponse> {
    const apiKey = process.env.GOOGLE_API_KEY;
    if (!apiKey) throw new ProviderError('missing GOOGLE_API_KEY', 'client');
    const t0 = Date.now();
    // Gemini usa role 'model' em vez de 'assistant'. Mensagens 'system' viram
    // systemInstruction em campo separado.
    const contents = req.messages
      .filter((m) => m.role !== 'system')
      .map((m) => ({
        role: m.role === 'assistant' ? 'model' : 'user',
        parts: [{ text: m.content }],
      }));
    const body: any = {
      contents,
      generationConfig: {
        temperature: req.temperature ?? 0.3,
        maxOutputTokens: req.maxTokens ?? 1024,
      },
    };
    if (req.system) body.systemInstruction = { parts: [{ text: req.system }] };
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${this.model}:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      },
    );
    const latencyMs = Date.now() - t0;
    if (!res.ok) {
      const kind = res.status === 429 ? '429' : res.status >= 500 ? '5xx' : 'client';
      throw new ProviderError(`Gemini ${res.status}`, kind, latencyMs);
    }
    const data: any = await res.json();
    const text = data?.candidates?.[0]?.content?.parts?.[0]?.text ?? '';
    return {
      text,
      provider: this.id,
      model: this.model,
      latencyMs,
      usage: {
        inputTokens: data?.usageMetadata?.promptTokenCount,
        outputTokens: data?.usageMetadata?.candidatesTokenCount,
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
  /**
   * Pool de providers indexado por id. V4 #V4-001 substitui o array fixo
   * (`chain`) por um pool — `complete()` constrói a cadeia em runtime
   * conforme `req.tier`/`req.forceProvider`.
   *
   * `defaultChain` preserva o comportamento V3 (Sonnet→Haiku→OpenAI) pra
   * requests sem tier nem forceProvider — usado pela Iza e por callers
   * legados.
   */
  private readonly providers: Record<LLMProviderId, LLMProvider>;
  private readonly defaultChain: LLMProvider[];

  constructor(providers?: LLMProvider[]) {
    // Cascade DEFAULT (V3 preservado): Sonnet 4.6 → Haiku 4.5 → GPT-4o-mini.
    // Modelo primário Anthropic é env-driven (env.ANTHROPIC_MODEL).
    // V4 #V4-001 adiciona GoogleProvider (gemini-2.5-flash) ao pool.
    const sonnet = new AnthropicProvider(
      'anthropic-sonnet',
      'Claude Sonnet 4.6',
      env.ANTHROPIC_MODEL || 'claude-sonnet-4-6',
    );
    const haiku = new AnthropicProvider(
      'anthropic-haiku',
      'Claude Haiku 4.5',
      'claude-haiku-4-5-20251001',
    );
    const openai = new OpenAIProvider(
      'openai-mini',
      'GPT-4o-mini',
      'gpt-4o-mini',
    );
    const gemini = new GoogleProvider(
      'google-gemini-flash',
      'Gemini 2.5 Flash',
      env.GEMINI_MODEL || 'gemini-2.5-flash',
    );

    if (providers && providers.length > 0) {
      // Tests podem injetar providers customizados; mantém compat
      this.providers = providers.reduce(
        (acc, p) => ({ ...acc, [p.id]: p }),
        {} as Record<LLMProviderId, LLMProvider>,
      );
      this.defaultChain = providers;
    } else {
      this.providers = {
        'anthropic-sonnet': sonnet,
        'anthropic-haiku': haiku,
        'openai-mini': openai,
        'google-gemini-flash': gemini,
      };
      this.defaultChain = [sonnet, haiku, openai];
    }
  }

  /**
   * Constrói a cadeia de providers pra uma request específica.
   *
   * Prioridade (V4 #V4-001):
   *   1. forceProvider → cadeia com 1 elemento (sem fallback)
   *   2. tier → primário do tier + fallback comum [Sonnet, Haiku, OpenAI]
   *   3. nada → cadeia default (Sonnet → Haiku → OpenAI) — comportamento V3
   *
   * Garantia de não-duplicação: se o primário já está no fallback, não duplica.
   */
  private buildChain(req: LLMCompletionRequest): LLMProvider[] {
    if (req.forceProvider) {
      const p = this.providers[req.forceProvider];
      return p ? [p] : [];
    }
    if (req.tier) {
      const primaryId = TIER_PRIMARY_PROVIDER[req.tier];
      const primary = this.providers[primaryId];
      if (!primary) return this.defaultChain;
      // Fallback comum (sem o primary se ele já estiver lá)
      const fallback = this.defaultChain.filter((p) => p.id !== primaryId);
      return [primary, ...fallback];
    }
    return this.defaultChain;
  }

  /**
   * Executa cascade e devolve a primeira resposta bem-sucedida.
   * Audita cada chamada (sucesso ou cascade exhausted) em llm_call_logs.
   */
  async complete(req: LLMCompletionRequest): Promise<LLMCompletionResponse> {
    const startCascade = Date.now();
    const chain = this.buildChain(req);

    if (chain.length === 0) {
      throw new Error(
        req.forceProvider
          ? `LLMRouter: forceProvider=${req.forceProvider} não encontrado na cascade`
          : `LLMRouter: cascade vazia (tier=${req.tier})`,
      );
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

  /** Exposto pra healthcheck /api/admin/llm-status. Lista todos os providers do pool. */
  getStatus() {
    return Object.values(this.providers).map((p) => ({
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
