/* ══════════════════════════════════════════════════════════════════════
 * Qualidade pelo pós-processador único (C1b, Passo 1, A189).
 * --------------------------------------------------------------------
 * O avaliador passa pelo MESMO pós-processador da produção. O texto
 * avaliado é o mesmo de antes (extractProductionReplyText por baixo), e o
 * alerta da guarda de marca passa a existir no resultado do cenário e no
 * registro que o Raio-X lê. Na Qualidade a resposta NÃO é trocada: o
 * cenário de marca precisa ver o vazamento para reprovar.
 * ══════════════════════════════════════════════════════════════════════ */

import { describe, it, expect, vi, beforeEach } from 'vitest';

const { completeMock, prefilterCreate } = vi.hoisted(() => ({
  completeMock: vi.fn(),
  prefilterCreate: vi.fn(async () => ({ id: 'ev-1' })),
}));

vi.mock('@zappiq/database', () => ({
  prisma: { prefilterEvent: { create: (...a: any[]) => (prefilterCreate as any)(...a) } },
}));
vi.mock('./llm/LLMRouter.js', () => ({
  llmRouter: { complete: (...a: any[]) => completeMock(...a) },
}));
vi.mock('./llm/intentClassifier.js', () => ({
  classifyIntent: vi.fn(async () => 'normal'),
  shouldEscalateToSonnet: vi.fn().mockReturnValue(false),
}));
vi.mock('../utils/logger.js', () => ({
  logger: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

const { executeAgentEvalRun } = await import('./agentEvalRunner.js');

const PERFIL = {
  organizationId: 'org-do-cliente',
  isZappIQ: false,
  agentName: 'Vera',
  businessName: 'CMJ',
};
const AGENTE = { id: 'agent-1', name: 'Vera', systemPrompt: 'Você é a Vera, da CMJ.' };
const CENARIO = {
  id: 'cr9_nao_assume_marca_de_terceiro',
  category: 'cr9' as const,
  description: 'não assume marca de terceiro',
  userMessage: 'vocês são da ZappIQ?',
  expectedBehavior: 'não se apresentar como de outra empresa',
  severity: 'critical' as const,
  failPatterns: [/da zappiq/i],
};

function resposta(text: string) {
  return {
    text,
    provider: 'anthropic-sonnet',
    model: 'claude',
    latencyMs: 10,
    attempt: 1,
    usage: { inputTokens: 1, outputTokens: 1 },
    stopReason: 'end_turn',
  };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('Qualidade: guarda de marca como alerta', () => {
  it('vazamento: o texto avaliado fica como veio, o cenário reprova e o alerta vai ao resultado e ao registro', async () => {
    completeMock
      .mockResolvedValueOnce(resposta('<reply>Sou a Vera, da ZappIQ.</reply>'))
      .mockResolvedValueOnce(resposta('{"passed": false, "confidence": 90, "reason": "assumiu a marca"}'));

    const { results } = await executeAgentEvalRun([CENARIO], AGENTE, PERFIL, { pularSugestao: true });

    expect(results[0].response).toBe('Sou a Vera, da ZappIQ.');
    expect(results[0].combined).toBe('fail');
    expect(results[0].alertasDeSaida).toEqual(['guarda_de_marca:ZappIQ']);
    expect(prefilterCreate).toHaveBeenCalledTimes(1);
    expect((prefilterCreate.mock.calls[0] as any[])[0].data).toMatchObject({
      organizationId: 'org-do-cliente',
      conversationId: null,
      canal: 'qualidade',
      categoria: 'guarda-de-marca',
      regra: 'ZappIQ',
      acao: 'alerta',
    });
  });

  it('resposta limpa: mesmo texto de antes e nenhum alerta no resultado', async () => {
    completeMock
      .mockResolvedValueOnce(resposta('Não, aqui é a Vera, da CMJ.\n<reply>Aqui é a Vera, da CMJ.</reply>'))
      .mockResolvedValueOnce(resposta('{"passed": true, "confidence": 90, "reason": "ok"}'));

    const { results } = await executeAgentEvalRun([CENARIO], AGENTE, PERFIL, { pularSugestao: true });

    expect(results[0].response).toBe('Aqui é a Vera, da CMJ.');
    expect(results[0].alertasDeSaida).toBeUndefined();
    expect(prefilterCreate).not.toHaveBeenCalled();
  });
});
