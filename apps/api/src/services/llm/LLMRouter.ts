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
// PR #V4-004: streaming opt-in. Parser SSE + tipo de chunk em arquivo separado
// pra manter LLMRouter.ts focado em routing/cascade.
import { parseAnthropicSSE, type LLMStreamChunk } from './LLMStream.js';
// PR #V4-003: circuit breaker migrado de Map in-memory pra Redis-backed.
// Coordena estado entre instâncias Fly + sobrevive a restart. Fail-open
// graceful: Redis down => breaker reporta closed (prefere servir a bloquear).
import {
  breakerIsOpen as breakerIsOpenRedis,
  recordSuccess as recordSuccessRedis,
  recordFailure as recordFailureRedis,
  getBreakerState as getBreakerStateRedis,
  __resetBreakersForTest as __resetBreakersForTestRedis,
} from './redisBreaker.js';

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
  /**
   * Override HARD de provider (Enterprise contract / classify forçando Haiku).
   * Cadeia = [provider], SEM fallback. Use quando provider especifico eh
   * requisito contratual ou semantico (ex: classifier DEVE rodar em Haiku).
   * Tem prioridade sobre tier e preferProvider.
   */
  forceProvider?: LLMProviderId;
  /**
   * Preferencia SOFT de provider (escalada por intent, etc). Cadeia =
   * [preferProvider, ...defaultChain.filter(!=prefer)] — fallback completo
   * se primario falhar. PR #216: criado pra fix do crash "all providers
   * exhausted" quando Sonnet rate-limita. Use quando voce QUER um provider
   * especifico mas tolera fallback (caso geral de escalada por intent).
   */
  preferProvider?: LLMProviderId;
  /**
   * Tier do tenant — quando setado, determina provider primário via
   * TIER_PRIMARY_PROVIDER. Se nenhum (force/prefer/tier) estiver setado,
   * usa cascade default (Sonnet primário). V4 #V4-001.
   */
  tier?: LLMTier;
  /** ID da org (tenant) — vai pra audit. */
  orgId?: string | null;
  /** ID da conversa — rastreabilidade fim-a-fim. */
  conversationId?: string | null;
  /** Operação semântica — vai pra audit. */
  operation?: LLMOperation;
  /**
   * Tools/function calling (V4-006). Quando setado, o modelo pode optar por
   * chamar uma das tools em vez de gerar texto. O caller é responsável por
   * executar a tool e enviar o resultado de volta numa próxima iteração do
   * loop (formato segue Anthropic Messages API: tool_use → tool_result).
   *
   * Por enquanto suportado em providers Anthropic e OpenAI. Gemini ignora
   * silenciosamente (TODO: V4-006.1). Se o request tem tools e cai num
   * Gemini, ainda funciona mas o modelo vê só o texto — útil pra graceful
   * degrade durante cascade.
   */
  tools?: ToolDefinition[];
};

/**
 * Schema de uma tool exposta ao modelo (V4-006).
 * Compatível com Anthropic + OpenAI (JSON Schema simplificado).
 */
export type ToolDefinition = {
  /** Nome único da tool (snake_case recomendado, ex: 'get_org_billing'). */
  name: string;
  /** Descrição em linguagem natural — o modelo lê isso pra decidir quando chamar. */
  description: string;
  /** JSON Schema dos parâmetros. Use `type: 'object'` no root. */
  inputSchema: Record<string, unknown>;
};

/**
 * Chamada de tool feita pelo modelo (V4-006).
 * O caller deve executar com base no `name` + `input` e enviar tool_result
 * numa próxima iteração.
 */
export type ToolCall = {
  id: string;
  name: string;
  input: Record<string, unknown>;
};

export type LLMCompletionResponse = {
  text: string;
  provider: LLMProviderId;
  model: string;
  latencyMs: number;
  usage?: { inputTokens?: number; outputTokens?: number };
  /** 1 = primário; 2 = fallback 1; 3 = fallback 2. */
  attempt: number;
  /**
   * V4-006: tool calls que o modelo decidiu fazer neste turn. Quando preenchido,
   * `text` pode estar vazio ou ter conteúdo parcial. Caller decide se executa.
   */
  toolCalls?: ToolCall[];
  /**
   * V4-006: razão de stop do modelo. 'tool_use' indica que o modelo quer
   * chamar tool(s); 'end_turn' = conversa pronta; 'max_tokens' = truncado.
   */
  stopReason?: 'end_turn' | 'tool_use' | 'max_tokens' | 'stop_sequence' | 'unknown';
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
  /**
   * PR #V4-004: streaming opt-in. Providers que suportam SSE retornam
   * AsyncIterable<LLMStreamChunk>; quem não suporta deixa undefined e
   * cai no fallback no-stream (ou skip pelo router em modo streaming-only).
   */
  invokeStream?(req: LLMCompletionRequest): AsyncIterable<LLMStreamChunk>;
}

// Re-export pra callers (rotas /api/admin/llm-stream-test, etc).
export type { LLMStreamChunk };

// ══════════════════════════════════════════════════════════════════
// Circuit breaker (PR #V4-003 — Redis-backed, multi-instância)
// ──────────────────────────────────────────────────────────────────
// Estado movido pra Redis (apps/api/src/services/llm/redisBreaker.ts).
// Comentário V2-018/Sprint 0 "Estado em memória por instância (aceitável
// pra Sprint 0...)" — gap fechado neste PR. Coordenação entre instâncias
// Fly + sobrevive a restart. Thresholds preservados: 3 falhas em 60s
// abrem por 120s.
//
// As 4 funções abaixo são thin adapters async que delegam ao Redis
// helpers, mantendo a assinatura conceitual usada em `complete()`.
// Funções assíncronas — call sites passaram a usar `await`.

// Thresholds (3 falhas em 60s abre por 120s) ficam em redisBreaker.ts.

async function breakerIsOpen(id: LLMProviderId): Promise<boolean> {
  return breakerIsOpenRedis(id);
}

async function recordSuccess(id: LLMProviderId): Promise<void> {
  await recordSuccessRedis(id);
}

async function recordFailure(
  id: LLMProviderId,
  kind: 'timeout' | '5xx' | '429' | 'quota' | 'client',
): Promise<void> {
  await recordFailureRedis(id, kind);
}

/** Hook de teste: zera todos os breakers (uso restrito a Vitest). */
export async function __resetBreakersForTest(): Promise<void> {
  await __resetBreakersForTestRedis([
    'anthropic-sonnet',
    'anthropic-haiku',
    'openai-mini',
    'google-gemini-flash',
  ]);
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

/**
 * Lê o corpo de uma resposta de erro de um provedor LLM e extrai a mensagem
 * legível. Anthropic/OpenAI/Gemini compartilham o shape `{ error: { message } }`.
 * Fail-soft: nunca lança (retorna '' se não der pra ler). Trunca p/ não poluir
 * logs. Sem isso, um 400 de billing ("credit balance too low") fica
 * indistinguível de um 400 de request malformado.
 */
async function readLlmErrorBody(res: Response): Promise<string> {
  try {
    const raw = await res.text();
    if (!raw) return '';
    try {
      const parsed = JSON.parse(raw);
      const msg = parsed?.error?.message ?? parsed?.message;
      if (typeof msg === 'string' && msg) return msg.slice(0, 300);
    } catch {
      /* corpo não-JSON — usa texto cru */
    }
    return raw.slice(0, 300);
  } catch {
    return '';
  }
}

/**
 * Sinais de que um 4xx é uma condição de billing/saldo/quota da CONTA daquele
 * provedor — e não um request malformado. Cobre Anthropic ("credit balance is
 * too low"), OpenAI ("exceeded your current quota"/"billing"), etc.
 */
const BILLING_4XX_RE =
  /credit balance|billing|insufficient|quota|spend limit|usage limit|too low|exceeded your current|payment/i;

/**
 * Classifica a falha HTTP de um provedor no `kind` do ProviderError.
 *
 * Crucial: um 400 de billing/saldo é específico DAQUELA conta — o próximo
 * provedor da cascata é outra conta e provavelmente funciona. Por isso ele é
 * 'quota' (CAI no fallback), e NÃO 'client' (que aborta a cascata como se
 * fosse request malformado — ver loop em complete()). Um 4xx genuíno de
 * request continua 'client' (falharia igual em todo provedor; não adianta
 * tentar o próximo).
 */
function classifyHttpKind(status: number, body: string): ProviderError['kind'] {
  if (status === 429) return '429';
  if (status >= 500) return '5xx';
  if ((status === 400 || status === 402 || status === 403) && BILLING_4XX_RE.test(body)) {
    return 'quota';
  }
  return 'client';
}

class AnthropicProvider implements LLMProvider {
  constructor(public id: LLMProviderId, public label: string, public model: string) {}
  async invoke(req: LLMCompletionRequest): Promise<LLMCompletionResponse> {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) throw new ProviderError('missing ANTHROPIC_API_KEY', 'client');
    const t0 = Date.now();

    // V4-006: tools support. Anthropic aceita `tools` no body; formato:
    // [{ name, description, input_schema }]. Mapeamos do nosso ToolDefinition.
    const body: any = {
      model: this.model,
      max_tokens: req.maxTokens ?? 1024,
      temperature: req.temperature ?? 0.3,
      system: req.system,
      messages: req.messages.filter((m) => m.role !== 'system'),
    };
    if (req.tools && req.tools.length > 0) {
      body.tools = req.tools.map((t) => ({
        name: t.name,
        description: t.description,
        input_schema: t.inputSchema,
      }));
    }

    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify(body),
    });
    const latencyMs = Date.now() - t0;
    if (!res.ok) {
      const detail = await readLlmErrorBody(res);
      const kind = classifyHttpKind(res.status, detail);
      throw new ProviderError(`Anthropic ${res.status}${detail ? `: ${detail}` : ''}`, kind, latencyMs);
    }
    const data: any = await res.json();

    // V4-006: extrair texto + tool_use blocks da response.
    // Anthropic retorna content[] com mix de { type: 'text', text } e
    // { type: 'tool_use', id, name, input }. Concatenamos texto e listamos
    // tool calls.
    let text = '';
    const toolCalls: ToolCall[] = [];
    if (Array.isArray(data?.content)) {
      for (const block of data.content) {
        if (block?.type === 'text' && typeof block.text === 'string') {
          text += block.text;
        } else if (block?.type === 'tool_use' && block?.name) {
          toolCalls.push({
            id: block.id,
            name: block.name,
            input: block.input || {},
          });
        }
      }
    }

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
      toolCalls: toolCalls.length > 0 ? toolCalls : undefined,
      stopReason: mapAnthropicStopReason(data?.stop_reason),
    };
  }

  /**
   * PR #V4-004 — streaming via Anthropic Messages API (SSE).
   * Parser de chunks em LLMStream.ts. Cascade no LLMRouter trata erros
   * transientes; aqui só fazemos throw cedo e deixamos o parser yield
   * 'error' final se a conexão cair no meio do stream.
   */
  async *invokeStream(req: LLMCompletionRequest): AsyncIterable<LLMStreamChunk> {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) throw new ProviderError('missing ANTHROPIC_API_KEY', 'client');
    const t0 = Date.now();

    const body: any = {
      model: this.model,
      max_tokens: req.maxTokens ?? 1024,
      temperature: req.temperature ?? 0.3,
      system: req.system,
      messages: req.messages.filter((m) => m.role !== 'system'),
      stream: true,
    };
    if (req.tools && req.tools.length > 0) {
      body.tools = req.tools.map((t) => ({
        name: t.name,
        description: t.description,
        input_schema: t.inputSchema,
      }));
    }

    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        Accept: 'text/event-stream',
      },
      body: JSON.stringify(body),
    });
    if (!res.ok || !res.body) {
      const latencyMs = Date.now() - t0;
      const detail = await readLlmErrorBody(res);
      const kind = classifyHttpKind(res.status, detail);
      throw new ProviderError(`Anthropic stream ${res.status}${detail ? `: ${detail}` : ''}`, kind, latencyMs);
    }
    yield* parseAnthropicSSE(res.body, this.id, this.model, t0);
  }
}

function mapAnthropicStopReason(reason: any): LLMCompletionResponse['stopReason'] {
  if (reason === 'end_turn' || reason === 'tool_use' || reason === 'max_tokens' || reason === 'stop_sequence') {
    return reason;
  }
  return 'unknown';
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
      const detail = await readLlmErrorBody(res);
      const kind = classifyHttpKind(res.status, detail);
      throw new ProviderError(`Gemini ${res.status}${detail ? `: ${detail}` : ''}`, kind, latencyMs);
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

    // V4-006: tools support. OpenAI usa formato function wrapper:
    // [{ type: 'function', function: { name, description, parameters } }]
    const body: any = {
      model: this.model,
      messages: openaiMessages,
      max_tokens: req.maxTokens ?? 1024,
      temperature: req.temperature ?? 0.3,
    };
    if (req.tools && req.tools.length > 0) {
      body.tools = req.tools.map((t) => ({
        type: 'function',
        function: {
          name: t.name,
          description: t.description,
          parameters: t.inputSchema,
        },
      }));
    }

    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify(body),
    });
    const latencyMs = Date.now() - t0;
    if (!res.ok) {
      const detail = await readLlmErrorBody(res);
      const kind = classifyHttpKind(res.status, detail);
      throw new ProviderError(`OpenAI ${res.status}${detail ? `: ${detail}` : ''}`, kind, latencyMs);
    }
    const data: any = await res.json();
    const choice = data?.choices?.[0];
    const text = choice?.message?.content ?? '';

    // V4-006: extrair tool_calls (estrutura OpenAI difere: cada tool_call tem
    // function.name + function.arguments como string JSON).
    const toolCalls: ToolCall[] = [];
    if (Array.isArray(choice?.message?.tool_calls)) {
      for (const tc of choice.message.tool_calls) {
        if (tc?.function?.name) {
          let parsed: Record<string, unknown> = {};
          try {
            parsed = tc.function.arguments ? JSON.parse(tc.function.arguments) : {};
          } catch {
            // Argumentos malformados — passa string raw como `_raw`
            parsed = { _raw: tc.function.arguments };
          }
          toolCalls.push({
            id: tc.id || `call_${Date.now()}_${toolCalls.length}`,
            name: tc.function.name,
            input: parsed,
          });
        }
      }
    }

    const finishReason = choice?.finish_reason;
    const stopReason: LLMCompletionResponse['stopReason'] =
      finishReason === 'tool_calls' ? 'tool_use' :
      finishReason === 'stop' ? 'end_turn' :
      finishReason === 'length' ? 'max_tokens' :
      'unknown';

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
      toolCalls: toolCalls.length > 0 ? toolCalls : undefined,
      stopReason,
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
    // PR #216: preferProvider monta [prefer, ...fallback] — sobrevive rate-limit/breaker.
    if (req.preferProvider) {
      const p = this.providers[req.preferProvider];
      if (!p) return this.defaultChain;
      const fallback = this.defaultChain.filter((x) => x.id !== req.preferProvider);
      return [p, ...fallback];
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
      // PR #V4-003: breakerIsOpen agora consulta Redis (async)
      if (await breakerIsOpen(provider.id)) {
        logger.info(`[LLMRouter] skipping ${provider.id} (breaker open)`);
        continue;
      }
      try {
        const resp = await provider.invoke(req);
        // Sucesso: limpa estado do breaker no Redis (await pra garantir
        // consistência entre instâncias antes de devolver a resposta).
        await recordSuccess(provider.id);
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
          // Fire-and-forget no error path: NÃO bloqueamos o fallback pro
          // próximo provider esperando o Redis. Falhas de Redis no
          // recordFailure já são fail-soft (só logam WARN).
          recordFailure(provider.id, err.kind).catch(() => {});
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
          recordFailure(provider.id, 'timeout').catch(() => {});
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

  /**
   * PR #V4-004 — streaming opt-in.
   *
   * Cascade conservadora: tenta cada provider na cadeia que IMPLEMENTA
   * `invokeStream`. Quem não suporta é skipado (próximo PR adiciona OpenAI
   * + Gemini). Falha hard no primeiro provider streaming-capable também
   * NÃO faz fallback no-stream — o caller que pediu streaming espera SSE,
   * cair pra `complete()` quebraria o contrato de chunks. Em vez disso,
   * yieldamos { type: 'error' } e o caller decide se faz retry sem stream.
   *
   * Auditoria: log no chunk 'done' (sucesso) ou 'error' (falha). Latência
   * mede do início do request até chunk 'done'.
   */
  async *completeStream(req: LLMCompletionRequest): AsyncIterable<LLMStreamChunk> {
    const startCascade = Date.now();
    const chain = this.buildChain(req);
    let attempt = 0;

    for (const provider of chain) {
      if (!provider.invokeStream) {
        logger.info(`[LLMRouter.stream] skipping ${provider.id} (no stream support)`);
        continue;
      }
      attempt += 1;
      if (await breakerIsOpen(provider.id)) {
        logger.info(`[LLMRouter.stream] skipping ${provider.id} (breaker open)`);
        continue;
      }

      try {
        let lastFinal: LLMCompletionResponse | null = null;
        for await (const chunk of provider.invokeStream(req)) {
          if (chunk.type === 'done') {
            lastFinal = chunk.final;
            const totalLatency = Date.now() - startCascade;
            const finalWithAttempt: LLMCompletionResponse = {
              ...chunk.final,
              attempt,
              latencyMs: totalLatency,
            };
            // Audit fail-soft
            logLLMCall({
              organizationId: req.orgId ?? null,
              conversationId: req.conversationId ?? null,
              provider: provider.id,
              model: provider.model,
              operation: req.operation ?? 'chat',
              inputTokens: chunk.final.usage?.inputTokens ?? null,
              outputTokens: chunk.final.usage?.outputTokens ?? null,
              latencyMs: totalLatency,
              fallbackTriggered: attempt > 1,
              attemptCount: attempt,
            }).catch(() => {});
            yield { type: 'done', final: finalWithAttempt };
          } else {
            yield chunk;
          }
        }
        if (lastFinal) {
          recordSuccess(provider.id).catch(() => {});
          return;
        }
        // Stream terminou sem 'done' — trata como erro
        throw new Error(`stream completed without 'done' chunk (${provider.id})`);
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        logger.warn(`[LLMRouter.stream] ${provider.id} failed: ${msg}`);
        if (err instanceof ProviderError) {
          recordFailure(provider.id, err.kind).catch(() => {});
          if (err.kind === 'client') {
            yield { type: 'error', error: msg, provider: provider.id };
            return;
          }
        } else {
          recordFailure(provider.id, 'timeout').catch(() => {});
        }
        // Continua pro próximo provider streaming-capable
      }
    }

    // Cascade streaming exhausted
    yield {
      type: 'error',
      error: 'streaming cascade exhausted — nenhum provider streaming-capable disponível',
      provider: chain[0]?.id ?? 'anthropic-sonnet',
    };
  }

  /**
   * Exposto pra healthcheck /api/admin/llm-status. Lista todos os providers
   * do pool com estado atual do breaker. Agora async — agrega estado do
   * Redis em paralelo (PR #V4-003).
   */
  async getStatus() {
    const providers = Object.values(this.providers);
    const states = await Promise.all(
      providers.map((p) => getBreakerStateRedis(p.id)),
    );
    return providers.map((p, i) => ({
      id: p.id,
      label: p.label,
      model: p.model,
      breakerOpen: states[i].isOpen,
      failures: states[i].failures,
      openUntil: states[i].openUntil,
    }));
  }
}

export const llmRouter = new LLMRouter();

// Re-export para testes
export { ProviderError };
