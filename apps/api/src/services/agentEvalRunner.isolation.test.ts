/**
 * agentEvalRunner.isolation.test.ts
 * ============================================================================
 * O runner V1 não sabia de qual org era o agente. O juiz recebia só
 * (expectedBehavior, response) e o suggestFix propunha patches sem saber quem
 * era o agente. Saída real de produção em 13/07, para a Vera (agente do CMJ):
 *
 *   juiz:     "A resposta não saúda especificamente a ZappIQ (saudou apenas
 *              'Rod' e mencionou CMJ)"  → REPROVADA
 *   sugestão: "patch cria regra obrigatória de saudação [em nome da ZappIQ]"
 *
 * Aqui provamos que:
 *   ✓ o juiz recebe a identidade do tenant e a proibição de cobrar outra marca
 *   ✓ a Iza continua sendo julgada como Iza
 *   ✓ patch que vazaria marca da ZappIQ é DESCARTADO antes de chegar ao cliente
 *   ✓ patch legítimo do cliente passa
 * ============================================================================
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

const completeMock = vi.fn();

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
vi.mock('../agents/coreAgentRules.js', () => ({
  CORE_AGENT_RULES_V1: '# REGRAS BASE',
  CORE_RULES_VERSION: 'v2',
}));

const { runJudge, suggestFix } = await import('./agentEvalRunner.js');

const VERA = { isZappIQ: false, agentName: 'Vera', businessName: 'CMJ', niche: 'servicos_b2b' };
const IZA = { isZappIQ: true, agentName: 'Iza', businessName: 'ZappIQ' };

beforeEach(() => vi.clearAllMocks());

function respondeJson(obj: any) {
  completeMock.mockResolvedValue({ text: JSON.stringify(obj), usage: {} });
}

/** system prompt efetivamente enviado ao LLM na última chamada. */
function systemEnviado(): string {
  return completeMock.mock.calls[0][0].system as string;
}

describe('o juiz sabe quem está julgando', () => {
  it('recebe a identidade do agente do cliente', async () => {
    respondeJson({ passed: true, confidence: 90, reason: 'ok' });
    await runJudge('Saudar e conduzir', 'Oi, Rod! Aqui é a Vera, da CMJ.', VERA);

    const system = systemEnviado();
    expect(system).toContain('Vera');
    expect(system).toContain('CMJ');
    expect(system).toContain('servicos_b2b');
  });

  it('é proibido de reprovar o agente por não citar outra marca', async () => {
    respondeJson({ passed: true, confidence: 90, reason: 'ok' });
    await runJudge('Saudar', 'Oi! Aqui é a Vera, da CMJ.', VERA);

    const system = systemEnviado();
    // A instrução que impede exatamente o veredicto de 13/07.
    expect(system).toMatch(/NUNCA reprove/i);
    expect(system).toContain('EXCLUSIVAMENTE');
    expect(system).toMatch(/comportamento CORRETO/i);
  });

  it('a Iza continua sendo julgada como Iza, sem a regra de isolamento', async () => {
    respondeJson({ passed: true, confidence: 90, reason: 'ok' });
    await runJudge('Saudar', 'Oi! Sou a Iza da ZappIQ.', IZA);

    const system = systemEnviado();
    expect(system).toContain('Iza');
    expect(system).not.toMatch(/REGRA INEGOCIÁVEL DE ISOLAMENTO/);
  });
});

describe('suggestFix não pode contaminar o prompt do cliente', () => {
  it('instrui o modelo a não propor marca de terceiro', async () => {
    respondeJson({ summary: 'ok', patches: [{ where: 'X', diff: '+ use o nome' }], confidence: 80 });
    await suggestFix('cr3', 'Saudar', 'resposta', 'motivo', 'prompt', VERA);

    const system = systemEnviado();
    expect(system).toMatch(/REGRA DE ISOLAMENTO/);
    expect(system).toContain('CMJ');
    expect(system).toMatch(/PROIBIDO/);
  });

  it('DESCARTA o patch que mandaria a Vera se dizer Iza da ZappIQ', async () => {
    // Exatamente o patch que a plataforma gerou em produção.
    respondeJson({
      summary: 'Vera não reconhece o nome da empresa na saudação',
      patches: [
        {
          where: 'INVIOLÁVEIS — novo item #14',
          diff:
            '+ **REGRA INVIOLÁVEL #14 — SAUDAÇÃO:** SEMPRE se apresente como Iza da ZappIQ ' +
            'e envie https://zappiq.com.br/cadastro.',
        },
      ],
      confidence: 90,
    });

    const out = await suggestFix('cr3', 'Saudar', 'resposta', 'motivo', 'prompt', VERA);
    expect(out).toBeUndefined(); // não chega nem a ser oferecido ao cliente
  });

  it('mantém o patch legítimo, que fala só do negócio do cliente', async () => {
    respondeJson({
      summary: 'Vera deve abrir descoberta após saudar',
      patches: [
        {
          where: 'INVIOLÁVEIS — novo item #14',
          diff:
            '+ **REGRA INVIOLÁVEL #14 — SAUDAÇÃO:** SEMPRE se apresente como Vera, da CMJ, ' +
            'e faça uma pergunta de descoberta na mesma mensagem.',
        },
      ],
      confidence: 90,
    });

    const out = await suggestFix('cr3', 'Saudar', 'resposta', 'motivo', 'prompt', VERA);
    expect(out).toBeDefined();
    expect(out!.patches).toHaveLength(1);
    expect(out!.patches[0].diff).toContain('Vera');
  });

  it('descarta só o patch sujo e preserva o limpo', async () => {
    respondeJson({
      summary: 'mix',
      patches: [
        { where: 'A', diff: '+ Sempre mande https://zappiq.com.br/cadastro' },
        { where: 'B', diff: '+ Sempre use o nome do cliente na primeira frase.' },
      ],
      confidence: 80,
    });

    const out = await suggestFix('cr1', 'Avançar', 'resposta', 'motivo', 'prompt', VERA);
    expect(out!.patches).toHaveLength(1);
    expect(out!.patches[0].where).toBe('B');
  });

  it('para a Iza, o patch com a marca da ZappIQ é legítimo e passa', async () => {
    respondeJson({
      summary: 'link do trial',
      patches: [{ where: 'A', diff: '+ Sempre mande https://zappiq.com.br/cadastro' }],
      confidence: 90,
    });

    const out = await suggestFix('zappiq_trial', 'Mandar link', 'resposta', 'motivo', 'prompt', IZA);
    expect(out!.patches).toHaveLength(1);
  });
});
