/**
 * agentEvalRunner.regras.test.ts (rodada 3 do PR #375)
 * ============================================================================
 * O avaliador montava o prompt com CORE + system_prompt cru + mock do cliente,
 * e nenhum chamador injetava o bloco "# Regras aprovadas pelo dono". Com o
 * interruptor `regrasComoRegistros` ligado, aplicar cria o registro e não
 * toca no prompt: o re-teste e a execução semanal mediam o agente SEM a
 * regra recém-aprovada.
 *
 * Aqui provamos, com o roteador de LLM como duble, que o `system` que chega
 * ao modelo carrega o bloco quando ele é passado por `contexto.regrasBlock`,
 * e que sem ele o prompt é byte a byte o de hoje.
 * ============================================================================
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

const { completeMock } = vi.hoisted(() => ({ completeMock: vi.fn() }));

vi.mock('./llm/LLMRouter.js', () => ({
  llmRouter: { complete: (...a: any[]) => completeMock(...a) },
}));
vi.mock('./llm/intentClassifier.js', () => ({
  classifyIntent: vi.fn().mockResolvedValue('normal'),
  shouldEscalateToSonnet: vi.fn().mockReturnValue(false),
}));
vi.mock('../utils/logger.js', () => ({
  logger: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

const { executeAgentEvalRun, buildEvalSystemPrompt } = await import('./agentEvalRunner.js');

const PERFIL = {
  organizationId: 'org-1',
  isZappIQ: false,
  agentName: 'Marcia',
  businessName: 'MACHIA',
  niche: 'servicos_b2b',
} as any;

const AGENTE = { id: 'agent-1', name: 'Marcia', systemPrompt: '## IDENTIDADE\nVocê é a Marcia.' };

/** Cenário que passa no determinístico: sem juiz de LLM, uma chamada só. */
const CENARIO = {
  id: 'cr5_nome_disponivel_usar',
  category: 'cr5_name' as const,
  description: 'usa o nome',
  userMessage: 'oi, sou o Rod',
  expectedBehavior: 'usa o nome',
  passPatterns: [/rod/i],
  severity: 'high' as const,
};

const BLOCO = '# Regras aprovadas pelo dono\n1. Chame o cliente pelo nome quando souber.';

beforeEach(() => {
  vi.clearAllMocks();
  completeMock.mockResolvedValue({
    text: 'Oi, Rod! Como posso ajudar?',
    provider: 'gemini',
    model: 'gemini',
    latencyMs: 5,
    attempt: 1,
    stopReason: 'end_turn',
    usage: { inputTokens: 10, outputTokens: 5 },
  });
});

/** O `system` da PRIMEIRA chamada ao roteador: é a conversa com o agente. */
function systemDoAgente(): string {
  expect(completeMock).toHaveBeenCalled();
  return String(completeMock.mock.calls[0][0].system);
}

describe('executeAgentEvalRun leva o bloco de regras ao modelo', () => {
  it('com regrasBlock no contexto, o system enviado traz o título e o texto da regra', async () => {
    await executeAgentEvalRun([CENARIO], AGENTE, PERFIL, { regrasBlock: BLOCO });

    const system = systemDoAgente();
    expect(system).toContain('# Regras aprovadas pelo dono');
    expect(system).toContain('1. Chame o cliente pelo nome quando souber.');
    // Na mesma posição do orquestrador: depois do prompt do agente, antes do
    // bloco do cliente. O cabeçalho procurado é o do mock do avaliador, porque
    // o CORE também fala em "# Cliente atual" bem antes.
    expect(system.indexOf('Você é a Marcia.')).toBeLessThan(system.indexOf(BLOCO));
    expect(system.indexOf(BLOCO)).toBeLessThan(system.indexOf('# Cliente atual (eval test mock)'));
  });

  it('sem regrasBlock, o system é byte a byte o prompt de hoje', async () => {
    await executeAgentEvalRun([CENARIO], AGENTE, PERFIL);

    expect(systemDoAgente()).toBe(buildEvalSystemPrompt(AGENTE, CENARIO));
    expect(systemDoAgente()).not.toContain('# Regras aprovadas pelo dono');
  });

  it('regrasBlock vazio (interruptor desligado) também não muda um byte', async () => {
    await executeAgentEvalRun([CENARIO], AGENTE, PERFIL, { regrasBlock: '' });

    expect(systemDoAgente()).toBe(buildEvalSystemPrompt(AGENTE, CENARIO));
  });
});
