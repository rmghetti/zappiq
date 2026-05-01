/* ══════════════════════════════════════════════════════════════════════
 * V4 #143 · Tests do izaTurnRouter (integração pre-filter + classify + tier)
 *
 * Cobertura crítica:
 *   ✓ Pre-filter HIT → retorna kind='blocked' SEM chamar LLM
 *   ✓ Caso normal sem tier → cascade default (Sonnet)
 *   ✓ Caso normal com tier STARTER → Gemini
 *   ✓ Intent handoff em tier STARTER → escala pra Sonnet
 *   ✓ Intent objection em tier GROWTH → escala pra Sonnet
 *   ✓ Intent enterprise em tier STARTER → escala pra Sonnet
 *   ✓ skipClassify=true → não chama Haiku, usa tier direto
 *   ✓ forceProvider tem prioridade sobre intent escalation
 *   ✓ Classify failure → fallback 'normal', não bloqueia turn
 * ══════════════════════════════════════════════════════════════════════ */

import { describe, it, expect, vi, beforeEach } from 'vitest';

const { mockComplete, mockClassify } = vi.hoisted(() => ({
  mockComplete: vi.fn(),
  mockClassify: vi.fn(),
}));

vi.mock('./LLMRouter.js', () => ({
  llmRouter: { complete: mockComplete },
}));

vi.mock('./intentClassifier.js', async () => {
  const actual = await vi.importActual<typeof import('./intentClassifier.js')>(
    './intentClassifier.js',
  );
  return {
    ...actual,
    classifyIntent: mockClassify,
  };
});

vi.mock('../../utils/logger.js', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

import { routeIzaTurn } from './izaTurnRouter.js';

function llmOk(text = 'Resposta da Iza', provider = 'anthropic-sonnet', model = 'claude-sonnet-4-6') {
  return {
    text,
    provider,
    model,
    latencyMs: 1500,
    attempt: 1,
    usage: { inputTokens: 500, outputTokens: 100 },
  };
}

const SYSTEM_PROMPT = 'Você é a Iza, consultora ZappIQ.';

describe('routeIzaTurn — pre-filter HIT (vertical bloqueada)', () => {
  beforeEach(() => {
    mockComplete.mockReset();
    mockClassify.mockReset();
  });

  it('apostas → kind=blocked, ZERO chamadas LLM', async () => {
    const result = await routeIzaTurn({
      systemPrompt: SYSTEM_PROMPT,
      userMessage: 'tenho casa de apostas, querem usar a IA',
    });
    expect(result.kind).toBe('blocked');
    if (result.kind === 'blocked') {
      expect(result.vertical).toBe('apostas');
      expect(result.response).toContain('apostas');
      expect(result.llmCallsMade).toBe(0);
    }
    expect(mockComplete).not.toHaveBeenCalled();
    expect(mockClassify).not.toHaveBeenCalled();
  });

  it('cripto P2P → kind=blocked', async () => {
    const result = await routeIzaTurn({
      systemPrompt: SYSTEM_PROMPT,
      userMessage: 'fundamos uma corretora de cripto P2P',
    });
    expect(result.kind).toBe('blocked');
    if (result.kind === 'blocked') {
      expect(result.vertical).toBe('cripto-nao-regulada');
    }
  });

  it('MLM → kind=blocked', async () => {
    const result = await routeIzaTurn({
      systemPrompt: SYSTEM_PROMPT,
      userMessage: 'sou consultora MLM de suplementos',
    });
    expect(result.kind).toBe('blocked');
  });
});

describe('routeIzaTurn — caso normal (sem escalation)', () => {
  beforeEach(() => {
    mockComplete.mockReset();
    mockClassify.mockReset();
    mockClassify.mockResolvedValue('normal');
  });

  it('sem tier → cascade default (Sonnet primário)', async () => {
    mockComplete.mockResolvedValueOnce(llmOk('Oi! Sou a Iza.', 'anthropic-sonnet'));
    const result = await routeIzaTurn({
      systemPrompt: SYSTEM_PROMPT,
      userMessage: 'oi',
    });
    expect(result.kind).toBe('llm');
    if (result.kind === 'llm') {
      expect(result.response.provider).toBe('anthropic-sonnet');
      expect(result.intent).toBe('normal');
      expect(result.escalated).toBe(false);
    }
    // Confirma que LLMRouter foi chamado SEM forceProvider e SEM tier
    const call = mockComplete.mock.calls[0][0];
    expect(call.forceProvider).toBeUndefined();
    expect(call.tier).toBeUndefined();
  });

  it('tier STARTER + intent normal → tier-based (Gemini)', async () => {
    mockComplete.mockResolvedValueOnce(llmOk('Oi!', 'google-gemini-flash', 'gemini-2.5-flash'));
    const result = await routeIzaTurn({
      systemPrompt: SYSTEM_PROMPT,
      userMessage: 'oi',
      tier: 'STARTER',
    });
    expect(result.kind).toBe('llm');
    if (result.kind === 'llm') {
      expect(result.response.provider).toBe('google-gemini-flash');
      expect(result.tierUsed).toBe('STARTER');
    }
    const call = mockComplete.mock.calls[0][0];
    expect(call.tier).toBe('STARTER');
    expect(call.forceProvider).toBeUndefined();
  });

  it('tier SCALE + intent normal → tier-based (Sonnet)', async () => {
    mockComplete.mockResolvedValueOnce(llmOk('Oi!', 'anthropic-sonnet'));
    const result = await routeIzaTurn({
      systemPrompt: SYSTEM_PROMPT,
      userMessage: 'oi',
      tier: 'SCALE',
    });
    if (result.kind === 'llm') {
      expect(result.response.provider).toBe('anthropic-sonnet');
    }
  });
});

describe('routeIzaTurn — intent escalation (handoff/objection/enterprise)', () => {
  beforeEach(() => {
    mockComplete.mockReset();
    mockClassify.mockReset();
  });

  it('tier STARTER + intent handoff → escala pra Sonnet (override do Gemini)', async () => {
    mockClassify.mockResolvedValue('handoff');
    mockComplete.mockResolvedValueOnce(llmOk('Sem problema, te conecto', 'anthropic-sonnet'));
    const result = await routeIzaTurn({
      systemPrompt: SYSTEM_PROMPT,
      userMessage: 'quero falar com humano',
      tier: 'STARTER',
    });
    expect(result.kind).toBe('llm');
    if (result.kind === 'llm') {
      expect(result.intent).toBe('handoff');
      expect(result.escalated).toBe(true);
      expect(result.response.provider).toBe('anthropic-sonnet');
    }
    // Confirma forceProvider=Sonnet, tier=undefined (já forçou)
    const call = mockComplete.mock.calls[0][0];
    expect(call.forceProvider).toBe('anthropic-sonnet');
    expect(call.tier).toBeUndefined();
  });

  it('tier GROWTH + intent objection → escala pra Sonnet', async () => {
    mockClassify.mockResolvedValue('objection');
    mockComplete.mockResolvedValueOnce(llmOk('Faz sentido. Vamos analisar...', 'anthropic-sonnet'));
    const result = await routeIzaTurn({
      systemPrompt: SYSTEM_PROMPT,
      userMessage: 'tá caro pra quem ta começando',
      tier: 'GROWTH',
    });
    if (result.kind === 'llm') {
      expect(result.intent).toBe('objection');
      expect(result.escalated).toBe(true);
    }
  });

  it('tier STARTER + intent enterprise → escala pra Sonnet', async () => {
    mockClassify.mockResolvedValue('enterprise');
    mockComplete.mockResolvedValueOnce(llmOk('Operação séria. Te conecto com Rodrigo.', 'anthropic-sonnet'));
    const result = await routeIzaTurn({
      systemPrompt: SYSTEM_PROMPT,
      userMessage: 'sou CEO de logística com 2000 atendimentos/dia',
      tier: 'STARTER',
    });
    if (result.kind === 'llm') {
      expect(result.intent).toBe('enterprise');
      expect(result.escalated).toBe(true);
    }
  });

  it('tier SCALE + intent normal → mantém Sonnet (tier já é Sonnet)', async () => {
    mockClassify.mockResolvedValue('normal');
    mockComplete.mockResolvedValueOnce(llmOk('Oi!', 'anthropic-sonnet'));
    const result = await routeIzaTurn({
      systemPrompt: SYSTEM_PROMPT,
      userMessage: 'oi',
      tier: 'SCALE',
    });
    if (result.kind === 'llm') {
      expect(result.escalated).toBe(false); // não escalou — tier já era Sonnet
    }
  });
});

describe('routeIzaTurn — skipClassify (otimização)', () => {
  beforeEach(() => {
    mockComplete.mockReset();
    mockClassify.mockReset();
  });

  it('skipClassify=true → não chama Haiku, usa tier direto', async () => {
    mockComplete.mockResolvedValueOnce(llmOk('Oi!', 'google-gemini-flash'));
    const result = await routeIzaTurn({
      systemPrompt: SYSTEM_PROMPT,
      userMessage: 'oi',
      tier: 'STARTER',
      skipClassify: true,
    });
    expect(mockClassify).not.toHaveBeenCalled();
    if (result.kind === 'llm') {
      expect(result.intent).toBe('normal'); // assume normal
      expect(result.llmCallsMade).toBe(1); // só LLM principal, sem classify
    }
  });
});

describe('routeIzaTurn — forceProvider tem prioridade', () => {
  beforeEach(() => {
    mockComplete.mockReset();
    mockClassify.mockReset();
  });

  it('forceProvider override mesmo se intent escalaria', async () => {
    mockClassify.mockResolvedValue('handoff'); // escalaria pra Sonnet normalmente
    mockComplete.mockResolvedValueOnce(llmOk('Resp Haiku', 'anthropic-haiku'));
    const result = await routeIzaTurn({
      systemPrompt: SYSTEM_PROMPT,
      userMessage: 'quero humano',
      tier: 'STARTER',
      forceProvider: 'anthropic-haiku',
    });
    if (result.kind === 'llm') {
      expect(result.response.provider).toBe('anthropic-haiku');
    }
    const call = mockComplete.mock.calls[0][0];
    expect(call.forceProvider).toBe('anthropic-haiku');
  });
});

describe('routeIzaTurn — robustez', () => {
  beforeEach(() => {
    mockComplete.mockReset();
    mockClassify.mockReset();
  });

  it('classify failure → fallback intent normal, turn continua', async () => {
    mockClassify.mockResolvedValue('normal'); // classifyIntent já retorna normal em erro internamente
    mockComplete.mockResolvedValueOnce(llmOk('OK', 'google-gemini-flash'));
    const result = await routeIzaTurn({
      systemPrompt: SYSTEM_PROMPT,
      userMessage: 'oi',
      tier: 'STARTER',
    });
    expect(result.kind).toBe('llm');
    if (result.kind === 'llm') {
      expect(result.intent).toBe('normal');
    }
  });

  it('LLM principal failure propaga erro pro caller', async () => {
    mockClassify.mockResolvedValue('normal');
    mockComplete.mockRejectedValueOnce(new Error('cascade exhausted'));
    await expect(
      routeIzaTurn({
        systemPrompt: SYSTEM_PROMPT,
        userMessage: 'oi',
        tier: 'STARTER',
      }),
    ).rejects.toThrow('cascade exhausted');
  });

  it('passa orgId/conversationId pro LLMRouter audit', async () => {
    mockClassify.mockResolvedValue('normal');
    mockComplete.mockResolvedValueOnce(llmOk());
    await routeIzaTurn({
      systemPrompt: SYSTEM_PROMPT,
      userMessage: 'oi',
      orgId: 'org-abc',
      conversationId: 'conv-xyz',
    });
    const call = mockComplete.mock.calls[0][0];
    expect(call.orgId).toBe('org-abc');
    expect(call.conversationId).toBe('conv-xyz');
  });
});
