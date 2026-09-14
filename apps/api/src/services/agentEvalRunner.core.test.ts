/* ══════════════════════════════════════════════════════════════════════
 * A043 e A078 — o sugeridor passa a ver o CORE e as regras já ativas.
 * --------------------------------------------------------------------
 * O suggestFix recebia 2.000 caracteres do prompt do cliente e mais nada.
 * Medido: na Iza (26.898 caracteres) só 1 das 12 regras aparecia nesse
 * trecho; na Marcia, 0 de 4. A instrução do próprio prompt do sugeridor
 * ("fortaleça a regra existente em vez de criar nova") era impossível de
 * cumprir, e a numeração saía colidindo: cinco "#14", três "#13".
 *
 * Pior: ele nunca via as REGRAS BASE. Foi assim que nasceu a correção da
 * Iza que manda "sugerir o plano anual com 20% de desconto" enquanto o
 * CR-7 proíbe passar de 10%.
 *
 * Nenhuma chamada paga: o roteador de LLM é um duble.
 * ══════════════════════════════════════════════════════════════════════ */
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

const { suggestFix } = await import('./agentEvalRunner.js');

const PERFIL = {
  isZappIQ: false,
  agentName: 'Vera',
  businessName: 'CMJ',
  niche: 'servicos_b2b',
  tone: 'friendly',
} as any;

const RESPOSTA = JSON.stringify({
  summary: 'reforçar a regra de prazo',
  patches: [
    {
      where: 'INVIOLÁVEIS — novo item',
      diff: 'NUNCA prometa prazo que não esteja cadastrado. Exemplo CORRETO: "vou confirmar".',
    },
  ],
  confidence: 80,
});

beforeEach(() => {
  vi.clearAllMocks();
  completeMock.mockResolvedValue({
    text: RESPOSTA,
    provider: 'anthropic-sonnet',
    model: 'claude',
    latencyMs: 5,
    attempt: 1,
    stopReason: 'end_turn',
    usage: {},
  });
});

function textoEnviado(indice = 0) {
  const chamada = completeMock.mock.calls[indice][0];
  return {
    system: String(chamada.system),
    user: String(chamada.messages[0].content),
  };
}

describe('suggestFix recebe as REGRAS BASE resumidas', () => {
  it('o CORE resumido vai no pedido, com os dois limites que as correções atropelaram', async () => {
    await suggestFix(
      'cr7_no_invent_preco_desconto',
      'Não inventa desconto.',
      'Posso dar 20% para você.',
      'ofereceu desconto que não existe',
      'Você é Vera, da CMJ.',
      PERFIL,
    );

    const { user } = textoEnviado();
    expect(user).toContain('REGRAS BASE DO AGENTE');
    expect(user).toMatch(/desconto\s*>?\s*10%/i);
    expect(user).toContain('30-40%');
  });

  it('o sugeridor é proibido de propor regra que contradiga o CORE', async () => {
    await suggestFix('cr1', 'esperado', 'resposta', 'motivo', 'prompt', PERFIL);
    const { system } = textoEnviado();
    expect(system).toMatch(/REGRAS BASE/i);
    expect(system).toMatch(/contradiga|contradiz|contrarie/i);
  });
});

describe('suggestFix recebe as regras JÁ ativas (A043)', () => {
  it('lista as regras ativas com o cenário de cada uma', async () => {
    await suggestFix('cr7_no_invent_sla', 'esperado', 'resposta', 'motivo', 'prompt', PERFIL, {
      regrasAtivas: [
        {
          id: 'r1',
          scenarioId: 'cr5_nome_disponivel_usar',
          texto: 'Chame o cliente pelo nome quando souber.',
          origem: 'sugestao_ia',
        },
      ],
    });

    const { user } = textoEnviado();
    expect(user).toContain('cr5_nome_disponivel_usar');
    expect(user).toContain('Chame o cliente pelo nome quando souber.');
  });

  it('sem regra ativa, diz isso em vez de omitir a seção', async () => {
    await suggestFix('cr7_no_invent_sla', 'esperado', 'resposta', 'motivo', 'prompt', PERFIL, {
      regrasAtivas: [],
    });
    expect(textoEnviado().user).toContain('Nenhuma regra aprovada');
  });

  it('o bloco vivo entra quando quem chamou souber dele', async () => {
    await suggestFix('cr7_no_invent_sla', 'esperado', 'resposta', 'motivo', 'prompt', PERFIL, {
      blocoVivo: '# Como você atende nesta empresa\nHorário: 09:00 às 18:00',
    });
    expect(textoEnviado().user).toContain('Horário: 09:00 às 18:00');
  });

  it('chamada antiga (sem o contexto novo) continua funcionando', async () => {
    const out = await suggestFix('cr1', 'esperado', 'resposta', 'motivo', 'prompt', PERFIL);
    expect(out?.patches).toHaveLength(1);
  });
});
