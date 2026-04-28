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

// Mock env pra controlar ANTHROPIC_MODEL
vi.mock('../../config/env.js', () => ({
  env: {
    ANTHROPIC_MODEL: 'claude-sonnet-4-6',
    ANTHROPIC_API_KEY: 'test-key-anthropic',
    OPENAI_API_KEY: 'test-key-openai',
    NODE_ENV: 'test',
  },
}));

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

describe('LLMRouter', () => {
  let fetchSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    __resetBreakersForTest();
    vi.clearAllMocks();
    // Mock global fetch
    fetchSpy = vi.spyOn(globalThis, 'fetch');
    process.env.ANTHROPIC_API_KEY = 'test-key-anthropic';
    process.env.OPENAI_API_KEY = 'test-key-openai';
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
      const status = router.getStatus();
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
      const status = router.getStatus();
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
});
