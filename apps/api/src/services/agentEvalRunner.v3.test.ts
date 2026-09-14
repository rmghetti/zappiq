/* ══════════════════════════════════════════════════════════════════════
 * Arnês v3 do avaliador (B1, Passo 6)
 * --------------------------------------------------------------------
 * A171  Falha do provedor virava reprovação com nota 0 e GERAVA sugestão:
 *       em 16/06 uma correção nascida de 25 respostas VAZIAS foi aplicada no
 *       prompt da Iza e continua lá. 90 cenários "Scenario crashed".
 * A050  Juiz com maxTokens 200 cortava o JSON: 9 vezes desde 20/07 uma
 *       aprovação ({"passed": true, "confidence": 62 ...) virou reprovação.
 * A088  O juiz lia a resposta CRUA, com <reply> e o texto dobrado.
 * A245  138 desvios críticos saíram como "Parcial" e o indicador "Críticos"
 *       marcou 0 em 26 de 28 execuções de clientes.
 * A052  O bloco "Cliente atual" do teste divergia do de produção.
 *
 * Tudo aqui roda com um llmRouter falso: nenhuma chamada paga.
 * ══════════════════════════════════════════════════════════════════════ */
import { describe, it, expect, vi, beforeEach } from 'vitest';

const { completeMock, classifyMock } = vi.hoisted(() => ({
  completeMock: vi.fn(),
  classifyMock: vi.fn(),
}));

vi.mock('./llm/LLMRouter.js', () => ({
  llmRouter: { complete: (...a: any[]) => completeMock(...a) },
}));
vi.mock('./llm/intentClassifier.js', () => ({
  classifyIntent: (...a: any[]) => classifyMock(...a),
  shouldEscalateToSonnet: vi.fn().mockReturnValue(false),
}));
vi.mock('../utils/logger.js', () => ({
  logger: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));
vi.mock('../agents/coreAgentRules.js', () => ({
  CORE_AGENT_RULES_V1: '# REGRAS BASE',
  CORE_RULES_VERSION: 'v2',
}));

const {
  executeAgentEvalRun,
  runJudge,
  computeSummary,
  buildEvalSystemPrompt,
  MAX_TOKENS_DO_JUIZ,
} = await import('./agentEvalRunner.js');

const PERFIL = {
  organizationId: 'org-do-cliente',
  isZappIQ: false,
  agentName: 'Vera',
  businessName: 'CMJ',
  niche: 'servicos_b2b',
};

const AGENTE = { id: 'agent-1', name: 'Vera', systemPrompt: 'prompt do cliente' };

const CENARIO = {
  id: 'cr1_teste',
  category: 'cr1_acceptance' as const,
  description: 'cenário de teste',
  userMessage: 'quero',
  expectedBehavior: 'avançar',
  severity: 'critical' as const,
  failPatterns: [/proibido/i],
};

/** Resposta do provedor no formato que o LLMRouter devolve. */
function resposta(text: string, extra: Record<string, unknown> = {}) {
  return {
    text,
    provider: 'anthropic-sonnet',
    model: 'claude',
    latencyMs: 10,
    attempt: 1,
    usage: { inputTokens: 1, outputTokens: 1 },
    stopReason: 'end_turn',
    ...extra,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  classifyMock.mockResolvedValue('normal');
});

// ════════════════════════════════════════════════════════════════════
describe('A171 — falha técnica fica FORA da nota e nunca vira sugestão', () => {
  it('resposta vazia vira status erro, sem sugestão', async () => {
    completeMock.mockResolvedValueOnce(resposta('   '));

    const { results, summary } = await executeAgentEvalRun([CENARIO] as any, AGENTE, PERFIL as any);

    expect(results[0].combined).toBe('erro');
    expect(results[0].suggestedFix).toBeUndefined();
    expect(results[0].falhaTecnica).toMatch(/vazia/i);
    // Uma chamada só: nem juiz nem sugeridor foram acionados.
    expect(completeMock).toHaveBeenCalledTimes(1);
    expect(summary.erros).toBe(1);
    expect(summary.failed).toBe(0);
    expect(summary.criticalFailed).toBe(0);
  });

  it('exceção do provedor vira erro, não reprovação com nota 0', async () => {
    completeMock.mockRejectedValue(new Error('Anthropic 400 invalid_request'));

    const { results, summary } = await executeAgentEvalRun([CENARIO] as any, AGENTE, PERFIL as any);

    expect(results[0].combined).toBe('erro');
    expect(results[0].suggestedFix).toBeUndefined();
    expect(summary.scorePercent).toBe(0);
    expect(summary.erros).toBe(1);
  });

  it('resposta cortada no limite de tokens vira erro', async () => {
    completeMock.mockResolvedValueOnce(resposta('Claro, o plano ideal pra vo', { stopReason: 'max_tokens' }));

    const { results } = await executeAgentEvalRun([CENARIO] as any, AGENTE, PERFIL as any);

    expect(results[0].combined).toBe('erro');
    expect(results[0].falhaTecnica).toMatch(/limite de tokens/i);
  });

  it('cenário com erro sai do denominador da nota', async () => {
    const summary = computeSummary([
      { combined: 'pass', severity: 'medium' },
      { combined: 'pass', severity: 'medium' },
      { combined: 'erro', severity: 'critical' },
    ] as any);

    // 2 de 2 avaliáveis, não 2 de 3.
    expect(summary.scorePercent).toBe(100);
    expect(summary.erros).toBe(1);
  });

  it('execução inteira em erro não vira nota 0 fantasma', async () => {
    const summary = computeSummary([
      { combined: 'erro', severity: 'critical' },
      { combined: 'erro', severity: 'medium' },
    ] as any);
    expect(summary.scorePercent).toBe(0);
    expect(summary.erros).toBe(2);
    expect(summary.failed).toBe(0);
  });
});

// ════════════════════════════════════════════════════════════════════
describe('A050 — o juiz passa a ser lido com tolerância', () => {
  it('pede 500 tokens, não 200', async () => {
    completeMock.mockResolvedValueOnce(resposta('{"passed":true,"confidence":90,"reason":"ok"}'));
    await runJudge('esperado', 'resposta', PERFIL as any);
    expect(MAX_TOKENS_DO_JUIZ).toBe(500);
    expect(completeMock.mock.calls[0][0].maxTokens).toBe(500);
  });

  it('aceita JSON dentro de cerca de código', async () => {
    completeMock.mockResolvedValueOnce(
      resposta('```json\n{"passed": true, "confidence": 88, "reason": "atendeu"}\n```'),
    );
    const j = await runJudge('esperado', 'resposta', PERFIL as any);
    expect(j.passed).toBe(true);
    expect(j.reason).toBe('atendeu');
  });

  it('extrai o PRIMEIRO objeto válido quando vem texto em volta', async () => {
    completeMock.mockResolvedValueOnce(
      resposta('Avaliação: {"passed": false, "confidence": 70, "reason": "faltou o link"} fim'),
    );
    const j = await runJudge('esperado', 'resposta', PERFIL as any);
    expect(j.passed).toBe(false);
    expect(j.reason).toBe('faltou o link');
  });

  it('JSON cortado no meio do motivo ainda entrega o veredito', async () => {
    // O caso real de 20/07: {"passed": true, "confidence": 62, "reason": "a
    // resposta cumpre o esperado porque ... (corte)
    completeMock.mockResolvedValueOnce(
      resposta('{"passed": true, "confidence": 62, "reason": "a resposta cumpre o esperado porque'),
    );
    const j = await runJudge('esperado', 'resposta', PERFIL as any);
    expect(j.passed).toBe(true);
  });

  it('saída ilegível vira INDETERMINADO, nunca reprovação', async () => {
    completeMock.mockResolvedValueOnce(resposta('não consegui avaliar essa resposta'));
    const j = await runJudge('esperado', 'resposta', PERFIL as any);
    expect(j.passed).toBeNull();
    expect(j.reason).toMatch(/indetermin/i);
  });

  it('campo passed ausente vira indeterminado', async () => {
    completeMock.mockResolvedValueOnce(resposta('{"confidence": 80, "reason": "boa"}'));
    const j = await runJudge('esperado', 'resposta', PERFIL as any);
    expect(j.passed).toBeNull();
  });

  it('juiz indeterminado não derruba o cenário que passou na regra', async () => {
    completeMock
      .mockResolvedValueOnce(resposta('resposta boa do agente'))
      .mockResolvedValueOnce(resposta('texto solto sem json'));

    const { results } = await executeAgentEvalRun([CENARIO] as any, AGENTE, PERFIL as any);
    expect(results[0].combined).toBe('pass');
  });

  it('erro na chamada do juiz é falha técnica, não reprovação', async () => {
    completeMock
      .mockResolvedValueOnce(resposta('resposta boa do agente'))
      .mockRejectedValue(new Error('timeout'));

    const { results } = await executeAgentEvalRun([CENARIO] as any, AGENTE, PERFIL as any);
    expect(results[0].combined).toBe('erro');
    expect(results[0].suggestedFix).toBeUndefined();
  });
});

// ════════════════════════════════════════════════════════════════════
describe('A088 — o juiz julga a resposta que o cliente leria', () => {
  it('extrai o conteúdo de <reply> antes da regra e do juiz', async () => {
    completeMock
      .mockResolvedValueOnce(
        resposta('proibido falar isso\n<reply>Perfeito, Rod! Já te encaminho.</reply>'),
      )
      .mockResolvedValueOnce(resposta('{"passed":true,"confidence":90,"reason":"ok"}'));

    const { results } = await executeAgentEvalRun([CENARIO] as any, AGENTE, PERFIL as any);

    // A palavra proibida estava FORA de <reply>: o cliente nunca a veria.
    expect(results[0].response).toBe('Perfeito, Rod! Já te encaminho.');
    expect(results[0].deterministic.passed).toBe(true);
    // O juiz recebeu o texto limpo, não o cru.
    const promptDoJuiz = completeMock.mock.calls[1][0].messages[0].content;
    expect(promptDoJuiz).toContain('Perfeito, Rod! Já te encaminho.');
    expect(promptDoJuiz).not.toContain('<reply>');
  });
});

// ════════════════════════════════════════════════════════════════════
describe('A245 — todo crítico que não passou conta como crítico', () => {
  it('crítico parcial entra na contagem de críticos', () => {
    const s = computeSummary([
      { combined: 'partial', severity: 'critical' },
      { combined: 'fail', severity: 'critical' },
      { combined: 'partial', severity: 'medium' },
      { combined: 'pass', severity: 'critical' },
    ] as any);
    expect(s.criticalFailed).toBe(2);
  });

  it('crítico em erro técnico NÃO conta (está fora da nota)', () => {
    const s = computeSummary([{ combined: 'erro', severity: 'critical' }] as any);
    expect(s.criticalFailed).toBe(0);
  });
});

// ════════════════════════════════════════════════════════════════════
describe('A052 — o bloco Cliente atual fala como a produção fala', () => {
  it('nome ausente explica o que fazer, como em produção', () => {
    const p = buildEvalSystemPrompt({ systemPrompt: 'x' }, { id: 'cr5_nome_ausente_perguntar' });
    expect(p).toContain('(ainda não capturado, peça no primeiro turno conforme REGRA 9)');
  });

  it('com histórico, diz para não perguntar o nome de novo', () => {
    const p = buildEvalSystemPrompt(
      { systemPrompt: 'x' },
      { id: 'cr5_nome_disponivel_usar', history: [{ role: 'user', content: 'oi' }] },
    );
    expect(p).toContain('NÃO (já tem histórico, não pergunte nome de novo, use o que está acima)');
  });

  it('primeiro contato continua dizendo SIM', () => {
    const p = buildEvalSystemPrompt({ systemPrompt: 'x' }, { id: 'cr1_teste' });
    expect(p).toContain('Primeiro contato? SIM');
  });
});
