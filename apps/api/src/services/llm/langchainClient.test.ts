/* ══════════════════════════════════════════════════════════════════════
 * V2-018 · langchainClient.test.ts
 * --------------------------------------------------------------------
 * Testes dos wrappers chatCompletion / classify / analyzeSentiment.
 * Garante que:
 *  - interface pública NÃO mudou (back-compat com agentOrchestrator)
 *  - classify força Haiku via forceProvider
 *  - chatCompletion vai pra cascade default
 *  - context (orgId, conversationId) é propagado pro Router
 *  - classify faz fallback automático se Haiku cair
 *  - analyzeSentiment retorna enum normalizado
 * ══════════════════════════════════════════════════════════════════════ */

import { describe, it, expect, beforeEach, vi } from 'vitest';

// Mock LLMRouter inteiro
vi.mock('./LLMRouter.js', () => {
  const mockComplete = vi.fn();
  return {
    llmRouter: { complete: mockComplete },
    __mockComplete: mockComplete,
  };
});

import { chatCompletion, classify, analyzeSentiment } from './langchainClient.js';
// Recupera o spy do mock
const { llmRouter } = await import('./LLMRouter.js');
const mockComplete = (llmRouter as any).complete as ReturnType<typeof vi.fn>;

beforeEach(() => {
  mockComplete.mockReset();
});

describe('chatCompletion', () => {
  it('chama Router com cascade default (sem forceProvider)', async () => {
    mockComplete.mockResolvedValueOnce({
      text: 'Resposta principal',
      provider: 'anthropic-sonnet',
      model: 'claude-sonnet-4-6',
      latencyMs: 1234,
      attempt: 1,
      usage: { inputTokens: 100, outputTokens: 50 },
    });

    const resp = await chatCompletion(
      'system prompt',
      [{ role: 'user', content: 'oi' }],
      512,
      { orgId: 'org-1', conversationId: 'conv-1' },
    );

    expect(mockComplete).toHaveBeenCalledWith({
      system: 'system prompt',
      messages: [{ role: 'user', content: 'oi' }],
      maxTokens: 512,
      operation: 'chat',
      orgId: 'org-1',
      conversationId: 'conv-1',
    });
    expect(resp.text).toBe('Resposta principal');
    expect(resp.inputTokens).toBe(100);
    expect(resp.outputTokens).toBe(50);
    expect(resp.provider).toBe('anthropic-sonnet');
    expect(resp.model).toBe('claude-sonnet-4-6');
    expect(resp.attempt).toBe(1);
  });

  it('aceita context vazio (orgId/conversationId null)', async () => {
    mockComplete.mockResolvedValueOnce({
      text: 'OK', usage: { inputTokens: 10, outputTokens: 5 },
      provider: 'anthropic-sonnet', model: 'claude-sonnet-4-6', latencyMs: 100, attempt: 1,
    });
    await chatCompletion('sys', [{ role: 'user', content: 'a' }]);
    expect(mockComplete).toHaveBeenCalledWith(
      expect.objectContaining({ orgId: null, conversationId: null }),
    );
  });

  it('default maxTokens = 1024', async () => {
    mockComplete.mockResolvedValueOnce({
      text: '', usage: {},
      provider: 'anthropic-sonnet', model: 'claude-sonnet-4-6', latencyMs: 0, attempt: 1,
    });
    await chatCompletion('sys', []);
    expect(mockComplete).toHaveBeenCalledWith(
      expect.objectContaining({ maxTokens: 1024 }),
    );
  });

  it('usage ausente vira inputTokens=0/outputTokens=0', async () => {
    mockComplete.mockResolvedValueOnce({
      text: 'sem usage',
      provider: 'anthropic-sonnet', model: 'claude-sonnet-4-6', latencyMs: 100, attempt: 1,
      // usage omitido
    });
    const resp = await chatCompletion('sys', []);
    expect(resp.inputTokens).toBe(0);
    expect(resp.outputTokens).toBe(0);
  });
});

describe('classify', () => {
  it('força Haiku via forceProvider e devolve lowercase trimmed', async () => {
    mockComplete.mockResolvedValueOnce({
      text: '  PRICING  ',
      provider: 'anthropic-haiku', model: 'claude-haiku-4-5-20251001', latencyMs: 200, attempt: 1,
      usage: { inputTokens: 30, outputTokens: 5 },
    });
    const intent = await classify('What intent is "quanto custa?"');
    expect(intent).toBe('pricing');
    expect(mockComplete).toHaveBeenCalledWith(
      expect.objectContaining({
        forceProvider: 'anthropic-haiku',
        operation: 'classify',
        maxTokens: 30,
      }),
    );
  });

  it('faz fallback automático pra cascade completa se Haiku falhar', async () => {
    mockComplete
      .mockRejectedValueOnce(new Error('Haiku down'))                 // 1ª chamada (forceProvider Haiku) falha
      .mockResolvedValueOnce({                                         // 2ª chamada (cascade completa) OK
        text: 'pricing',
        provider: 'anthropic-sonnet', model: 'claude-sonnet-4-6', latencyMs: 800, attempt: 1,
        usage: {},
      });
    const intent = await classify('quanto?');
    expect(intent).toBe('pricing');
    expect(mockComplete).toHaveBeenCalledTimes(2);
    // 2ª chamada NÃO tem forceProvider
    expect(mockComplete.mock.calls[1][0].forceProvider).toBeUndefined();
  });

  it('propaga context (orgId, conversationId) pro Router', async () => {
    mockComplete.mockResolvedValueOnce({
      text: 'greeting',
      provider: 'anthropic-haiku', model: 'claude-haiku-4-5-20251001', latencyMs: 100, attempt: 1,
      usage: {},
    });
    await classify('oi', { orgId: 'org-z', conversationId: 'conv-z' });
    expect(mockComplete).toHaveBeenCalledWith(
      expect.objectContaining({
        orgId: 'org-z',
        conversationId: 'conv-z',
      }),
    );
  });
});

describe('analyzeSentiment', () => {
  beforeEach(() => {
    mockComplete.mockReset();
  });

  it('detecta POSITIVE', async () => {
    mockComplete.mockResolvedValueOnce({
      text: 'POSITIVE', provider: 'anthropic-haiku', model: 'claude-haiku-4-5-20251001',
      latencyMs: 100, attempt: 1, usage: {},
    });
    const result = await analyzeSentiment('Adorei o atendimento!');
    expect(result).toBe('POSITIVE');
  });

  it('detecta NEGATIVE', async () => {
    mockComplete.mockResolvedValueOnce({
      text: 'negative', provider: 'anthropic-haiku', model: 'claude-haiku-4-5-20251001',
      latencyMs: 100, attempt: 1, usage: {},
    });
    const result = await analyzeSentiment('Estou muito insatisfeito.');
    expect(result).toBe('NEGATIVE');
  });

  it('NEUTRAL é o default seguro', async () => {
    mockComplete.mockResolvedValueOnce({
      text: 'algo estranho', provider: 'anthropic-haiku', model: 'claude-haiku-4-5-20251001',
      latencyMs: 100, attempt: 1, usage: {},
    });
    const result = await analyzeSentiment('Ok.');
    expect(result).toBe('NEUTRAL');
  });

  it('aceita ambos POSITIVE e Positive (case-insensitive)', async () => {
    mockComplete.mockResolvedValueOnce({
      text: 'Positive', provider: 'anthropic-haiku', model: 'claude-haiku-4-5-20251001',
      latencyMs: 100, attempt: 1, usage: {},
    });
    expect(await analyzeSentiment('test')).toBe('POSITIVE');
  });
});
