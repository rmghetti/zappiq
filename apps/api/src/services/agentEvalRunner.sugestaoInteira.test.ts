/* ══════════════════════════════════════════════════════════════════════
 * A188 — a CAUSA do corte, não só a trava de escrita.
 * --------------------------------------------------------------------
 * A trava (regraTerminaEmFraseCompleta) impede que um fragmento entre no
 * prompt vivo, mas o sugeridor continuava produzindo fragmento: 600 tokens
 * de teto, nenhuma instrução de tamanho e um slice(0, 600) em silêncio no
 * fim. O cliente via o botão Aplicar recusar e não entendia por quê.
 *
 * Aqui se prova o outro lado: o pedido diz o tamanho, o corte cego saiu, e
 * quando a regra volta pela metade o sugeridor é chamado UMA segunda vez.
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
const { regraTerminaEmFraseCompleta } = await import('./agentPromptPatcher.js');

const PERFIL = {
  isZappIQ: false,
  agentName: 'Vera',
  businessName: 'CMJ',
  niche: 'servicos_b2b',
  tone: 'friendly',
} as any;

/** Uma chamada do sugeridor: devolve o JSON que o teste mandar. */
function respondeCom(...respostas: string[]) {
  let i = 0;
  completeMock.mockImplementation(async () => {
    const text = respostas[Math.min(i, respostas.length - 1)];
    i += 1;
    return {
      text,
      provider: 'anthropic-sonnet',
      model: 'claude',
      latencyMs: 5,
      attempt: 1,
      stopReason: 'end_turn',
      usage: {},
    };
  });
}

const CORTADA = JSON.stringify({
  summary: 'reforçar a regra de prazo',
  patches: [
    {
      where: 'INVIOLÁVEIS — novo item #12',
      diff: '+ **REGRA INVIOLÁVEL #12 — PRAZO:** nunca prometa prazo. Exemplo CORRETO: "vou confirmar com o tec',
    },
  ],
  confidence: 80,
});

const INTEIRA = JSON.stringify({
  summary: 'reforçar a regra de prazo',
  patches: [
    {
      where: 'INVIOLÁVEIS — novo item #12',
      diff:
        '+ **REGRA INVIOLÁVEL #12 — PRAZO:** NUNCA prometa prazo que não esteja cadastrado. ' +
        'Exemplo CORRETO: "vou confirmar com o time e te retorno". ' +
        'Exemplo INCORRETO: "respondo em milissegundos".',
    },
  ],
  confidence: 80,
});

async function sugerir() {
  return suggestFix(
    'cr7_no_invent_sla',
    'Responder honestamente sobre prazo.',
    'A gente responde em milissegundos!',
    'prometeu prazo inventado',
    'Você é Vera, da CMJ.',
    PERFIL,
  );
}

beforeEach(() => vi.clearAllMocks());

describe('A188 — o sugeridor entrega a regra inteira', () => {
  it('pede tamanho e ponto final no próprio prompt do sugeridor', async () => {
    respondeCom(INTEIRA);
    await sugerir();

    const system = String(completeMock.mock.calls[0][0].system);
    expect(system).toMatch(/500 caracteres/);
    expect(system).toMatch(/ponto final/i);
  });

  it('tem teto de tokens folgado para a regra caber', async () => {
    respondeCom(INTEIRA);
    await sugerir();

    expect(completeMock.mock.calls[0][0].maxTokens).toBeGreaterThanOrEqual(900);
  });

  it('corta na primeira e completa na segunda: tenta de novo e devolve a inteira', async () => {
    respondeCom(CORTADA, INTEIRA);
    const out = await sugerir();

    expect(completeMock).toHaveBeenCalledTimes(2);
    expect(out?.patches[0].diff).toContain('Exemplo INCORRETO');
    expect(regraTerminaEmFraseCompleta(out!.patches[0].diff)).toBe(true);
  });

  it('quando já vem inteira, não gasta uma segunda chamada', async () => {
    respondeCom(INTEIRA);
    const out = await sugerir();

    expect(completeMock).toHaveBeenCalledTimes(1);
    expect(regraTerminaEmFraseCompleta(out!.patches[0].diff)).toBe(true);
  });

  it('se as duas vierem cortadas, devolve a última e a trava de escrita recusa', async () => {
    respondeCom(CORTADA, CORTADA);
    const out = await sugerir();

    expect(completeMock).toHaveBeenCalledTimes(2);
    // Não inventa fim de frase: quem barra o Aplicar é a trava, não o sugeridor.
    expect(regraTerminaEmFraseCompleta(out!.patches[0].diff)).toBe(false);
  });

  it('regra longa e inteira não é mais decapitada em 600 caracteres', async () => {
    const miolo = 'NUNCA prometa prazo que não esteja cadastrado na base de conhecimento. '.repeat(
      9,
    );
    const longa = JSON.stringify({
      summary: 'regra longa',
      patches: [
        {
          where: 'INVIOLÁVEIS — novo item #12',
          diff: `+ **REGRA INVIOLÁVEL #12 — PRAZO:** ${miolo}Exemplo INCORRETO: "respondo em milissegundos".`,
        },
      ],
      confidence: 80,
    });
    respondeCom(longa);
    const out = await sugerir();

    expect(out!.patches[0].diff.length).toBeGreaterThan(600);
    expect(out!.patches[0].diff).toContain('Exemplo INCORRETO');
    expect(completeMock).toHaveBeenCalledTimes(1);
  });
});
