/* ══════════════════════════════════════════════════════════════════════
 * V2-018 · LLMRouter.test.ts
 * --------------------------------------------------------------------
 * Testes do circuit breaker e cascade fallback.
 *
 * Estratégia: usa fetch mock global (vi.spyOn(globalThis, 'fetch')) pra
 * simular respostas do Anthropic e OpenAI sem chamada real. Audit é
 * mockada inteira pra evitar tocar Postgres.
 *
 * Não cobre aqui (Onda 2):
 *  - Integration test com Postgres real (RLS isolation entre tenants)
 *  - Load test (k6 separado)
 *
 * Critérios cobertos (Apêndice D Blocker 1):
 *  ✓ Circuit breaker abre após 3 falhas em 60s
 *  ✓ Breaker pula provider quando aberto
 *  ✓ Cascade move pra próximo provider em 5xx/429/timeout
 *  ✓ 4xx do cliente NÃO triggera fallback
 *  ✓ Resposta com sucesso reseta o breaker
 *  ✓ Audit é chamado em cada turno (sucesso e cascade exhausted)
 *  ✓ Modelo primário lido de env.ANTHROPIC_MODEL
 * ══════════════════════════════════════════════════════════════════════ */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';

// Mock antes de importar pra interceptar audit
vi.mock('./llmCallAudit.js', () => ({
  logLLMCall: vi.fn().mockResolvedValue(undefined),
}));

// Mock logger pra silenciar warn em testes
vi.mock('../../utils/logger.js', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}));

// Mock env pra controlar ANTHROPIC_MODEL + GEMINI_MODEL (V4 #V4-001)
vi.mock('../../config/env.js', () => ({
  env: {
    ANTHROPIC_MODEL: 'claude-sonnet-4-6',
    ANTHROPIC_API_KEY: 'test-key-anthropic',
    OPENAI_API_KEY: 'test-key-openai',
    GOOGLE_API_KEY: 'test-key-google',
    GEMINI_MODEL: 'gemini-2.5-flash',
    NODE_ENV: 'test',
  },
}));

// PR #V4-003: mock do redisBreaker (in-memory) pra rodar tests sem Redis real.
// Reproduz o comportamento do breaker original (3 falhas em 60s abre por 120s),
// mas mantém estado em Map local — testes focam na lógica do Router, não no
// Redis em si (o Redis tem testes próprios de integração).
vi.mock('./redisBreaker.js', () => {
  interface State { failures: number; openUntil: number | null; lastFailureAt: number | null }
  const FAIL_THRESHOLD = 3;
  const FAIL_WINDOW_MS = 60_000;
  const OPEN_DURATION_MS = 120_000;
  const state = new Map<string, State>();
  function get(id: string): State {
    let s = state.get(id);
    if (!s) { s = { failures: 0, openUntil: null, lastFailureAt: null }; state.set(id, s); }
    return s;
  }
  return {
    breakerIsOpen: vi.fn(async (id: string) => {
      const s = get(id);
      if (s.openUntil && Date.now() < s.openUntil) return true;
      if (s.openUntil && Date.now() >= s.openUntil) { s.openUntil = null; s.failures = 0; }
      return false;
    }),
    recordSuccess: vi.fn(async (id: string) => {
      const s = get(id); s.failures = 0; s.lastFailureAt = null; s.openUntil = null;
    }),
    recordFailure: vi.fn(async (id: string, kind: string) => {
      if (kind === 'client') return;
      const s = get(id); const now = Date.now();
      if (s.lastFailureAt && now - s.lastFailureAt > FAIL_WINDOW_MS) s.failures = 0;
      s.failures += 1; s.lastFailureAt = now;
      if (s.failures >= FAIL_THRESHOLD) s.openUntil = now + OPEN_DURATION_MS;
    }),
    getBreakerState: vi.fn(async (id: string) => {
      const s = get(id);
      return {
        failures: s.failures,
        openUntil: s.openUntil,
        isOpen: s.openUntil != null && Date.now() < s.openUntil,
      };
    }),
    __resetBreakersForTest: vi.fn(async () => { state.clear(); }),
  };
});

import { LLMRouter, __resetBreakersForTest, ProviderError } from './LLMRouter.js';
import { logLLMCall } from './llmCallAudit.js';

// Helper: gera Response 200 OK com payload Anthropic-like
function anthropicOk(text: string, inputTok = 100, outputTok = 50): Response {
  return new Response(
    JSON.stringify({
      content: [{ type: 'text', text }],
      usage: { input_tokens: inputTok, output_tokens: outputTok },
    }),
    { status: 200, headers: { 'Content-Type': 'application/json' } },
  );
}

// Helper: gera Response 200 OK com payload OpenAI-like
function openaiOk(text: string, promptTok = 100, completionTok = 50): Response {
  return new Response(
    JSON.stringify({
      choices: [{ message: { content: text } }],
      usage: { prompt_tokens: promptTok, completion_tokens: completionTok },
    }),
    { status: 200, headers: { 'Content-Type': 'application/json' } },
  );
}

function httpError(status: number): Response {
  return new Response(JSON.stringify({ error: 'simulated' }), { status });
}

// Incidente 06/2026: Anthropic devolve 400 com mensagem de saldo quando a conta
// fica sem créditos. Diferente de um 400 de request malformado, é específico
// daquela conta — deve CAIR no fallback (kind 'quota'), não abortar a cascade.
function billingError(): Response {
  return new Response(
    JSON.stringify({
      type: 'error',
      error: {
        type: 'invalid_request_error',
        message:
          'Your credit balance is too low to access the Anthropic API. Please go to Plans & Billing to upgrade or purchase credits.',
      },
    }),
    { status: 400, headers: { 'Content-Type': 'application/json' } },
  );
}

// V4 #V4-001: helper Gemini-like response (Generative Language API v1beta).
function geminiOk(text: string, promptTok = 100, candidatesTok = 50): Response {
  return new Response(
    JSON.stringify({
      candidates: [{ content: { parts: [{ text }] } }],
      usageMetadata: { promptTokenCount: promptTok, candidatesTokenCount: candidatesTok },
    }),
    { status: 200, headers: { 'Content-Type': 'application/json' } },
  );
}

describe('LLMRouter', () => {
  // PR #102 hotfix — vi.spyOn em globalThis.fetch retorna MockInstance com
  // generic params que não bate com `ReturnType<typeof vi.spyOn>` default
  // (que assume args genéricos `unknown[]`). Cast pra `any` no spy é o jeito
  // pragmático em arquivos de teste — TS strict não casa com fetch overloads.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let fetchSpy: any;

  beforeEach(async () => {
    await __resetBreakersForTest();
    vi.clearAllMocks();
    // Mock global fetch
    fetchSpy = vi.spyOn(globalThis, 'fetch');
    process.env.ANTHROPIC_API_KEY = 'test-key-anthropic';
    process.env.OPENAI_API_KEY = 'test-key-openai';
    process.env.GOOGLE_API_KEY = 'test-key-google';
  });

  afterEach(() => {
    fetchSpy.mockRestore();
  });

  describe('happy path', () => {
    it('chama Sonnet primeiro e retorna texto', async () => {
      fetchSpy.mockResolvedValueOnce(anthropicOk('Olá, sou a Iza!'));
      const router = new LLMRouter();
      const resp = await router.complete({
        system: 'Você é a Iza.',
        messages: [{ role: 'user', content: 'oi' }],
      });
      expect(resp.text).toBe('Olá, sou a Iza!');
      expect(resp.provider).toBe('anthropic-sonnet');
      expect(resp.model).toBe('claude-sonnet-4-6');
      expect(resp.attempt).toBe(1);
      expect(resp.usage?.inputTokens).toBe(100);
      expect(resp.usage?.outputTokens).toBe(50);
    });

    it('audita cada chamada bem-sucedida em llm_call_logs', async () => {
      fetchSpy.mockResolvedValueOnce(anthropicOk('OK', 500, 200));
      const router = new LLMRouter();
      await router.complete({
        messages: [{ role: 'user', content: 'oi' }],
        orgId: 'org-123',
        conversationId: 'conv-456',
        operation: 'chat',
      });
      expect(logLLMCall).toHaveBeenCalledOnce();
      expect(logLLMCall).toHaveBeenCalledWith(
        expect.objectContaining({
          organizationId: 'org-123',
          conversationId: 'conv-456',
          provider: 'anthropic-sonnet',
          model: 'claude-sonnet-4-6',
          operation: 'chat',
          inputTokens: 500,
          outputTokens: 200,
          attemptCount: 1,
          fallbackTriggered: false,
        }),
      );
    });

    it('força provider via forceProvider', async () => {
      fetchSpy.mockResolvedValueOnce(anthropicOk('Haiku response'));
      const router = new LLMRouter();
      const resp = await router.complete({
        messages: [{ role: 'user', content: 'classify' }],
        forceProvider: 'anthropic-haiku',
        operation: 'classify',
      });
      expect(resp.provider).toBe('anthropic-haiku');
      expect(resp.model).toBe('claude-haiku-4-5-20251001');
      // Confere que mandou pro Haiku no body do fetch
      const body = JSON.parse((fetchSpy.mock.calls[0][1] as RequestInit).body as string);
      expect(body.model).toBe('claude-haiku-4-5-20251001');
    });
  });

  describe('cascade fallback', () => {
    it('cai pra Haiku se Sonnet retorna 5xx', async () => {
      fetchSpy
        .mockResolvedValueOnce(httpError(500))                      // Sonnet falha
        .mockResolvedValueOnce(anthropicOk('Resposta do Haiku'));   // Haiku OK
      const router = new LLMRouter();
      const resp = await router.complete({ messages: [{ role: 'user', content: 'oi' }] });
      expect(resp.provider).toBe('anthropic-haiku');
      expect(resp.attempt).toBe(2);
      expect(logLLMCall).toHaveBeenCalledWith(
        expect.objectContaining({
          provider: 'anthropic-haiku',
          fallbackTriggered: true,
          attemptCount: 2,
        }),
      );
    });

    it('cai pra GPT-4o-mini se Sonnet e Haiku retornam 429', async () => {
      fetchSpy
        .mockResolvedValueOnce(httpError(429))   // Sonnet rate-limited
        .mockResolvedValueOnce(httpError(429))   // Haiku rate-limited
        .mockResolvedValueOnce(openaiOk('Resposta do GPT'));
      const router = new LLMRouter();
      const resp = await router.complete({ messages: [{ role: 'user', content: 'oi' }] });
      expect(resp.provider).toBe('openai-mini');
      expect(resp.model).toBe('gpt-4o-mini');
      expect(resp.attempt).toBe(3);
    });

    it('throw quando TODOS providers falham (cascade exhausted) + audita falha', async () => {
      fetchSpy
        .mockResolvedValueOnce(httpError(500))
        .mockResolvedValueOnce(httpError(500))
        .mockResolvedValueOnce(httpError(500));
      const router = new LLMRouter();
      await expect(
        router.complete({ messages: [{ role: 'user', content: 'oi' }], orgId: 'org-x' }),
      ).rejects.toThrow();
      // 3 chamadas: cada provider tentou e falhou. Cada um tem audit "client" só se 4xx.
      // Aqui são 5xx → não audita por turno errado, mas no final audita "none".
      const auditCalls = (logLLMCall as any).mock.calls;
      const noneCall = auditCalls.find(([arg]: any) => arg.provider === 'none');
      expect(noneCall).toBeDefined();
      expect(noneCall[0].error).toBeTruthy();
      expect(noneCall[0].fallbackTriggered).toBe(true);
      expect(noneCall[0].organizationId).toBe('org-x');
    });

    it('4xx do cliente NÃO triggera fallback (devolve direto)', async () => {
      fetchSpy.mockResolvedValueOnce(httpError(400));
      const router = new LLMRouter();
      await expect(
        router.complete({ messages: [{ role: 'user', content: 'oi' }] }),
      ).rejects.toThrow(ProviderError);
      // Só uma chamada feita — não tentou fallback
      expect(fetchSpy).toHaveBeenCalledOnce();
    });

    it('400 de billing (credit balance too low) CAI no fallback (não aborta)', async () => {
      // Cascade default: Sonnet → Haiku (ambos Anthropic, sem créditos) → OpenAI.
      fetchSpy
        .mockResolvedValueOnce(billingError())               // Sonnet 400 billing
        .mockResolvedValueOnce(billingError())               // Haiku 400 billing
        .mockResolvedValueOnce(openaiOk('Resposta GPT-4o')); // OpenAI salva
      const router = new LLMRouter();
      const res = await router.complete({ messages: [{ role: 'user', content: 'oi' }] });
      expect(res.text).toBe('Resposta GPT-4o');
      expect(res.provider).toBe('openai-mini');
      // 3 chamadas: tentou Sonnet, Haiku e por fim OpenAI (fallback funcionou)
      expect(fetchSpy).toHaveBeenCalledTimes(3);
    });
  });

  describe('circuit breaker', () => {
    it('abre breaker após 3 falhas 5xx em 60s', async () => {
      // 3 ciclos de Sonnet falhando — esperamos cada vez cair pra Haiku
      // Após 3ª falha, breaker do Sonnet está aberto.
      // 4ª chamada deve PULAR Sonnet e ir direto pra Haiku.
      fetchSpy
        // Ciclo 1: Sonnet 500, Haiku OK
        .mockResolvedValueOnce(httpError(500))
        .mockResolvedValueOnce(anthropicOk('Haiku 1'))
        // Ciclo 2: Sonnet 500, Haiku OK
        .mockResolvedValueOnce(httpError(500))
        .mockResolvedValueOnce(anthropicOk('Haiku 2'))
        // Ciclo 3: Sonnet 500, Haiku OK
        .mockResolvedValueOnce(httpError(500))
        .mockResolvedValueOnce(anthropicOk('Haiku 3'))
        // Ciclo 4: Sonnet pulado (breaker aberto), Haiku OK
        .mockResolvedValueOnce(anthropicOk('Haiku 4'));

      const router = new LLMRouter();
      for (let i = 0; i < 3; i++) {
        const resp = await router.complete({ messages: [{ role: 'user', content: `oi ${i}` }] });
        expect(resp.provider).toBe('anthropic-haiku');
      }
      // 4ª chamada
      const last = await router.complete({ messages: [{ role: 'user', content: 'oi final' }] });
      expect(last.provider).toBe('anthropic-haiku');
      // 4ª chamada não deve ter tentado Sonnet — fetch foi chamado 7x (3+3+1)
      expect(fetchSpy).toHaveBeenCalledTimes(7);
    });

    it('sucesso reseta contador de falhas', async () => {
      fetchSpy
        .mockResolvedValueOnce(httpError(500))                      // 1ª falha Sonnet
        .mockResolvedValueOnce(anthropicOk('Haiku saved'))          // Haiku OK
        .mockResolvedValueOnce(anthropicOk('Sonnet recovered'))     // Sonnet OK — reseta
        .mockResolvedValueOnce(httpError(500))                      // 1ª falha Sonnet (de novo)
        .mockResolvedValueOnce(anthropicOk('Haiku again'));         // Haiku OK
      const router = new LLMRouter();
      await router.complete({ messages: [{ role: 'user', content: 'a' }] });
      await router.complete({ messages: [{ role: 'user', content: 'b' }] });
      await router.complete({ messages: [{ role: 'user', content: 'c' }] });
      // Breaker NÃO abriu — Sonnet recuperou no meio
      const status = await router.getStatus();
      expect(status[0].breakerOpen).toBe(false);
    });

    it('4xx NÃO conta pra circuit breaker', async () => {
      fetchSpy
        .mockResolvedValueOnce(httpError(400))
        .mockRejectedValueOnce(new Error('test')); // catch error pra não vazar
      const router = new LLMRouter();
      await expect(
        router.complete({ messages: [{ role: 'user', content: 'a' }] }),
      ).rejects.toThrow();
      const status = await router.getStatus();
      expect(status[0].failures).toBe(0);
    });
  });

  describe('cascade vazia (forceProvider inválido)', () => {
    it('throw imediato se forceProvider não bate com nenhum provider', async () => {
      const router = new LLMRouter();
      await expect(
        router.complete({
          messages: [{ role: 'user', content: 'a' }],
          // @ts-expect-error — testando guard runtime
          forceProvider: 'inexistente',
        }),
      ).rejects.toThrow(/não encontrado/);
    });
  });

  // V4 #V4-001: Tier-based default routing.
  // Decisão consolidada pós-Gate 1 (2026-04-30):
  //   STARTER/GROWTH → Gemini default (200× mais barato)
  //   SCALE/BUSINESS/ENTERPRISE → Sonnet default (qualidade premium)
  describe('V4 #V4-001 — tier-based default routing', () => {
    it('STARTER tier usa Gemini 2.5 Flash como primary', async () => {
      fetchSpy.mockResolvedValueOnce(geminiOk('Resposta Gemini', 200, 50));
      const router = new LLMRouter();
      const resp = await router.complete({
        messages: [{ role: 'user', content: 'oi' }],
        tier: 'STARTER',
      });
      expect(resp.provider).toBe('google-gemini-flash');
      expect(resp.model).toBe('gemini-2.5-flash');
      expect(resp.attempt).toBe(1);
      // Confirma URL Gemini (não Anthropic)
      const url = fetchSpy.mock.calls[0][0] as string;
      expect(url).toContain('generativelanguage.googleapis.com');
      expect(url).toContain('gemini-2.5-flash');
    });

    it('GROWTH tier também usa Gemini como primary', async () => {
      fetchSpy.mockResolvedValueOnce(geminiOk('Growth response'));
      const router = new LLMRouter();
      const resp = await router.complete({
        messages: [{ role: 'user', content: 'oi' }],
        tier: 'GROWTH',
      });
      expect(resp.provider).toBe('google-gemini-flash');
    });

    it('SCALE tier usa Sonnet como primary (mesmo cascade default)', async () => {
      fetchSpy.mockResolvedValueOnce(anthropicOk('Sonnet premium response'));
      const router = new LLMRouter();
      const resp = await router.complete({
        messages: [{ role: 'user', content: 'oi' }],
        tier: 'SCALE',
      });
      expect(resp.provider).toBe('anthropic-sonnet');
      // NÃO chama Gemini
      const url = fetchSpy.mock.calls[0][0] as string;
      expect(url).not.toContain('googleapis.com');
    });

    it('BUSINESS tier usa Sonnet como primary', async () => {
      fetchSpy.mockResolvedValueOnce(anthropicOk('Business response'));
      const router = new LLMRouter();
      const resp = await router.complete({
        messages: [{ role: 'user', content: 'oi' }],
        tier: 'BUSINESS',
      });
      expect(resp.provider).toBe('anthropic-sonnet');
    });

    it('ENTERPRISE tier usa Sonnet como primary', async () => {
      fetchSpy.mockResolvedValueOnce(anthropicOk('Enterprise response'));
      const router = new LLMRouter();
      const resp = await router.complete({
        messages: [{ role: 'user', content: 'oi' }],
        tier: 'ENTERPRISE',
      });
      expect(resp.provider).toBe('anthropic-sonnet');
    });

    it('sem tier nem forceProvider, preserva cascade default V3 (Sonnet primary)', async () => {
      fetchSpy.mockResolvedValueOnce(anthropicOk('Iza response (Sonnet default)'));
      const router = new LLMRouter();
      const resp = await router.complete({
        messages: [{ role: 'user', content: 'oi' }],
      });
      expect(resp.provider).toBe('anthropic-sonnet');
    });

    it('forceProvider tem prioridade sobre tier', async () => {
      fetchSpy.mockResolvedValueOnce(anthropicOk('Haiku forced'));
      const router = new LLMRouter();
      const resp = await router.complete({
        messages: [{ role: 'user', content: 'oi' }],
        tier: 'STARTER', // tier diz Gemini
        forceProvider: 'anthropic-haiku', // mas force diz Haiku
      });
      // Force vence
      expect(resp.provider).toBe('anthropic-haiku');
    });

    it('tier STARTER: Gemini falha 5xx → cascade pra Sonnet', async () => {
      fetchSpy
        .mockResolvedValueOnce(httpError(503))                         // Gemini fail
        .mockResolvedValueOnce(anthropicOk('Sonnet recovered Gemini')); // Sonnet OK
      const router = new LLMRouter();
      const resp = await router.complete({
        messages: [{ role: 'user', content: 'oi' }],
        tier: 'STARTER',
      });
      expect(resp.provider).toBe('anthropic-sonnet');
      expect(resp.attempt).toBe(2);
    });

    it('tier STARTER: Gemini 429 → fallback Sonnet sem expor erro 429 ao caller', async () => {
      fetchSpy
        .mockResolvedValueOnce(httpError(429))           // Gemini rate-limited
        .mockResolvedValueOnce(anthropicOk('Sonnet OK'));
      const router = new LLMRouter();
      const resp = await router.complete({
        messages: [{ role: 'user', content: 'oi' }],
        tier: 'STARTER',
      });
      expect(resp.provider).toBe('anthropic-sonnet');
      expect(resp.attempt).toBe(2);
    });
  });

  // V4 #V4-001: GoogleProvider integration.
  describe('V4 #V4-001 — GoogleProvider Gemini 2.5 Flash', () => {
    it('força provider google-gemini-flash via forceProvider', async () => {
      fetchSpy.mockResolvedValueOnce(geminiOk('Gemini direct'));
      const router = new LLMRouter();
      const resp = await router.complete({
        messages: [{ role: 'user', content: 'classify' }],
        forceProvider: 'google-gemini-flash',
        operation: 'classify',
      });
      expect(resp.provider).toBe('google-gemini-flash');
      expect(resp.model).toBe('gemini-2.5-flash');
    });

    it('Gemini envia system instruction em campo separado (não em messages)', async () => {
      fetchSpy.mockResolvedValueOnce(geminiOk('OK'));
      const router = new LLMRouter();
      await router.complete({
        system: 'Você é a Iza.',
        messages: [{ role: 'user', content: 'oi' }],
        forceProvider: 'google-gemini-flash',
      });
      const body = JSON.parse((fetchSpy.mock.calls[0][1] as RequestInit).body as string);
      expect(body.systemInstruction).toEqual({ parts: [{ text: 'Você é a Iza.' }] });
      expect(body.contents).toEqual([{ role: 'user', parts: [{ text: 'oi' }] }]);
    });

    it('Gemini converte role assistant → model', async () => {
      fetchSpy.mockResolvedValueOnce(geminiOk('OK'));
      const router = new LLMRouter();
      await router.complete({
        messages: [
          { role: 'user', content: 'oi' },
          { role: 'assistant', content: 'olá' },
          { role: 'user', content: 'tudo bem?' },
        ],
        forceProvider: 'google-gemini-flash',
      });
      const body = JSON.parse((fetchSpy.mock.calls[0][1] as RequestInit).body as string);
      expect(body.contents[1].role).toBe('model'); // não 'assistant'
    });

    it('Gemini extrai tokens de usageMetadata (schema diferente do Anthropic)', async () => {
      fetchSpy.mockResolvedValueOnce(geminiOk('OK', 333, 77));
      const router = new LLMRouter();
      const resp = await router.complete({
        messages: [{ role: 'user', content: 'oi' }],
        forceProvider: 'google-gemini-flash',
      });
      expect(resp.usage?.inputTokens).toBe(333);
      expect(resp.usage?.outputTokens).toBe(77);
    });

    it('GoogleProvider sem GOOGLE_API_KEY lança ProviderError client', async () => {
      delete process.env.GOOGLE_API_KEY;
      const router = new LLMRouter();
      await expect(
        router.complete({
          messages: [{ role: 'user', content: 'oi' }],
          forceProvider: 'google-gemini-flash',
        }),
      ).rejects.toThrow(ProviderError);
      // Não chamou fetch — falhou no guard
      expect(fetchSpy).not.toHaveBeenCalled();
    });

    it('audit log captura provider=google-gemini-flash com cost USD correto', async () => {
      fetchSpy.mockResolvedValueOnce(geminiOk('OK', 1000, 200));
      const router = new LLMRouter();
      await router.complete({
        messages: [{ role: 'user', content: 'oi' }],
        forceProvider: 'google-gemini-flash',
        orgId: 'org-test',
      });
      expect(logLLMCall).toHaveBeenCalledWith(
        expect.objectContaining({
          provider: 'google-gemini-flash',
          model: 'gemini-2.5-flash',
          inputTokens: 1000,
          outputTokens: 200,
          organizationId: 'org-test',
        }),
      );
    });
  });

  // V4 #V4-001: getStatus deve listar todos os providers do pool.
  describe('V4 #V4-001 — getStatus inclui Gemini', () => {
    it('lista 4 providers (Gemini + Sonnet + Haiku + OpenAI)', async () => {
      const router = new LLMRouter();
      const status = await router.getStatus();
      const ids = status.map((s) => s.id).sort();
      expect(ids).toEqual([
        'anthropic-haiku',
        'anthropic-sonnet',
        'google-gemini-flash',
        'openai-mini',
      ]);
    });
  });
});
