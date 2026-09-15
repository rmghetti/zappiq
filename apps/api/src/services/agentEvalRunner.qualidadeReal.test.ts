/* ══════════════════════════════════════════════════════════════════════
 * Qualidade que testa o agente real (C2, Passo 13): o avaliador.
 * --------------------------------------------------------------------
 * Nenhuma chamada paga: o roteador de LLM é um dublê que devolve, em ordem,
 * a resposta do agente, a do juiz e a do sugeridor.
 *
 *   Passo 1 (A226)  todo resultado grava quem respondeu, quem julgou, quem
 *                   sugeriu, as fontes e o ragStatus. Resposta de um modelo
 *                   diferente do pedido vira 'inconclusivo', fora da nota.
 *   Nota 1          com a política da faixa do plano (evalNoTier), o agente
 *                   é pedido no tier ou no override da produção.
 *   Passo 2 (A039,  o juiz vê pergunta, histórico e os MESMOS trechos da base,
 *   A208)           escreve a evidência antes do veredito, dá a causa, e é de
 *                   outra família quando há chave para isso.
 *   Passo 3 (P21)   natureza gravada, placar em duas partes, e reprovação de
 *                   conhecimento por falta de informação vira ação de treino.
 *   Passo 4 (P13)   caso de conhecimento só conta com a base no teste, roda
 *                   2 vezes e aprova só se as duas passarem.
 * ══════════════════════════════════════════════════════════════════════ */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const { completeMock, classifyMock, escalarMock } = vi.hoisted(() => ({
  completeMock: vi.fn(),
  classifyMock: vi.fn(),
  escalarMock: vi.fn(),
}));

vi.mock('./llm/LLMRouter.js', () => ({
  llmRouter: { complete: (...a: any[]) => completeMock(...a) },
}));
vi.mock('./llm/intentClassifier.js', () => ({
  classifyIntent: (...a: any[]) => classifyMock(...a),
  shouldEscalateToSonnet: (...a: any[]) => escalarMock(...a),
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
  computePlacar,
  escolherProvedorDoJuiz,
  familiasConfiguradas,
  lerVereditoComEvidencia,
  pedidoDoAgente,
  acaoDeTreinoPorFaltaDeInformacao,
} = await import('./agentEvalRunner.js');

const PERFIL = {
  organizationId: 'org-do-cliente',
  isZappIQ: false,
  agentName: 'Vera',
  businessName: 'CMJ',
  niche: 'servicos_b2b',
} as any;
const AGENTE = { id: 'agent-1', name: 'Vera', systemPrompt: 'prompt do cliente' };

const COMPORTAMENTO = {
  id: 'cr2_quero_humano_explicito',
  category: 'cr2_handoff',
  natureza: 'comportamento',
  description: 'pede humano',
  history: [{ role: 'user', content: 'oi' }, { role: 'assistant', content: 'Oi! Me conta.' }],
  userMessage: 'quero falar com gente',
  expectedBehavior: 'aceitar e encaminhar',
  severity: 'critical',
  failPatterns: [/proibido/i],
} as any;

const CONHECIMENTO = {
  id: 'kb_qa_qa1',
  category: 'kb_conhecimento',
  natureza: 'conhecimento',
  description: 'Pergunta cadastrada: "entregam domingo?"',
  userMessage: 'Vocês entregam no domingo?',
  expectedBehavior: 'responder conforme cadastrado: das 11h às 15h, taxa de R$ 12',
  severity: 'high',
  repeticoes: 2,
  conhecimento: {
    origem: 'qa',
    fonte: 'qa1',
    referencia: 'Sim, das 11h às 15h, com taxa de R$ 12.',
    valoresEsperados: ['h:11:00', 'h:15:00', 'n:12'],
    exigencia: 'todos',
    reaisPermitidos: ['12'],
    acaoDeTreino: { tipo: 'qa', pergunta: 'Vocês entregam no domingo?' },
  },
} as any;

const CONTEXTO_COM_BASE = {
  systemPrompt: '# REGRAS BASE\nprompt\n# Contexto recuperado (RAG)\n[qa] Sim, das 11h às 15h, taxa R$ 12.',
  hash: 'a'.repeat(64),
  partes: [],
  ragStatus: 'ok' as const,
  trechos: '[qa] Sim, das 11h às 15h, taxa R$ 12.',
  fontes: ['chunk-7', 'chunk-9'],
};

function resposta(text: string, provider = 'anthropic-sonnet', model = 'claude-sonnet-4-6') {
  return { text, provider, model, latencyMs: 5, attempt: 1, stopReason: 'end_turn', usage: {} };
}
const JUIZ_APROVA = (provider = 'anthropic-sonnet') =>
  resposta(
    JSON.stringify({
      evidencia: 'A resposta diz "vou te passar para uma pessoa".',
      causa: null,
      veredito: 'aprovado',
      confianca: 90,
      motivo: 'Encaminhou na hora.',
    }),
    provider,
    provider === 'openai-mini' ? 'gpt-4o-mini' : 'claude-sonnet-4-6',
  );
const JUIZ_REPROVA_FALTOU = () =>
  resposta(
    JSON.stringify({
      evidencia: 'Os trechos recebidos não falam de domingo; a resposta diz "não sei".',
      causa: 'faltou_informacao',
      veredito: 'reprovado',
      confianca: 80,
      motivo: 'O agente não tinha a informação de domingo.',
    }),
  );
const SUGESTAO = () =>
  resposta(
    JSON.stringify({
      summary: 'encaminhar na hora',
      patches: [{ where: 'novo', diff: 'Quando pedirem uma pessoa, encaminhe na hora.' }],
      confidence: 80,
    }),
    'anthropic-sonnet',
    'claude-sonnet-4-6',
  );

/**
 * Rodada 1 do PR #378, item 1: o juiz de outra família só sai com o
 * interruptor `juizDeOutraFamilia` da organização ligado. A política carrega
 * a leitura (juizOutraFamilia); sem ela, o juiz é o da cascata padrão.
 */
const JUIZ_LIGADO = { modelo: 'anthropic-sonnet' as const, motivo: 'cascata padrão', juizOutraFamilia: true };

const envAntes = { ...process.env };
beforeEach(() => {
  vi.clearAllMocks();
  classifyMock.mockResolvedValue('normal');
  escalarMock.mockReturnValue(false);
  delete process.env.OPENAI_API_KEY;
  delete process.env.GOOGLE_API_KEY;
  delete process.env.ANTHROPIC_API_KEY;
});
afterEach(() => {
  process.env = { ...envAntes };
});

const CHAVES_DO_PASSO_1 = ['agente', 'juiz', 'sugeridor', 'fontes', 'ragStatus', 'natureza', 'history', 'modeloPedido'];

// ════════════════════════════════════════════════════════════════════
describe('Passo 1 (A226): cada resultado diz quem respondeu, quem julgou e quem sugeriu', () => {
  it('100% dos cenários de uma execução nova têm os campos, em todo desfecho', async () => {
    const montarContexto = async () => CONTEXTO_COM_BASE;
    const rodar = async (...respostas: any[]) => {
      completeMock.mockReset();
      for (const r of respostas) completeMock.mockResolvedValueOnce(r);
      const { results } = await executeAgentEvalRun([COMPORTAMENTO], AGENTE, PERFIL, { montarContexto });
      return results[0];
    };
    const aprovado = await rodar(resposta('Claro, já chamo uma pessoa. <action>handoff</action>'), JUIZ_APROVA());
    const vazio = await rodar(resposta('   '));
    const reprovado = await rodar(
      resposta('isso é proibido'),
      resposta('{"evidencia":"disse proibido","causa":"comportamento","veredito":"reprovado","confianca":90,"motivo":"errou"}'),
      SUGESTAO(),
    );
    const reserva = await rodar(resposta('Oi!', 'anthropic-haiku', 'claude-haiku-4-5'));
    const results = [aprovado, vazio, reprovado, reserva];

    expect(results.map((r) => r.combined)).toEqual(['pass', 'erro', 'fail', 'inconclusivo']);
    for (const r of results) {
      for (const chave of CHAVES_DO_PASSO_1) expect(r, `${r.combined}.${chave}`).toHaveProperty(chave);
    }
    expect(aprovado.agente).toEqual({ provider: 'anthropic-sonnet', model: 'claude-sonnet-4-6' });
    expect(aprovado.juiz).toEqual({ provider: 'anthropic-sonnet', model: 'claude-sonnet-4-6' });
    expect(aprovado.fontes).toEqual(['chunk-7', 'chunk-9']);
    expect(aprovado.ragStatus).toBe('ok');
    expect(aprovado.history).toEqual(COMPORTAMENTO.history);
    expect(reprovado.sugeridor).toEqual({ provider: 'anthropic-sonnet', model: 'claude-sonnet-4-6' });
    expect(aprovado.sugeridor).toBeNull();
    expect(vazio.juiz).toBeNull();
  });

  it('resposta servida por modelo diferente do pedido: inconclusivo, sem juiz, sem sugestão, fora da nota', async () => {
    completeMock.mockResolvedValueOnce(resposta('Claro!', 'openai-mini', 'gpt-4o-mini'));

    const { results, summary, placar } = await executeAgentEvalRun([COMPORTAMENTO], AGENTE, PERFIL);

    expect(results[0].combined).toBe('inconclusivo');
    expect(results[0].inconclusivo?.motivo).toBe('modelo_diferente');
    expect(results[0].inconclusivo?.explicacao).toMatch(/anthropic-sonnet/);
    expect(results[0].modeloPedido).toBe('anthropic-sonnet');
    expect(results[0].agente).toEqual({ provider: 'openai-mini', model: 'gpt-4o-mini' });
    expect(results[0].suggestedFix).toBeUndefined();
    expect(completeMock).toHaveBeenCalledTimes(1);
    // Fora do denominador e do crítico; entra no portão de falha do provedor.
    expect(summary.passed + summary.failed + summary.partial).toBe(0);
    expect(summary.criticalFailed).toBe(0);
    expect(summary.erros).toBe(1);
    expect(placar.inconclusivos).toBe(1);
  });

  it('sem montador, ragStatus fica null e fontes vazias (o teste não consultou a base)', async () => {
    completeMock.mockResolvedValueOnce(resposta('ok')).mockResolvedValueOnce(JUIZ_APROVA());
    const { results } = await executeAgentEvalRun([COMPORTAMENTO], AGENTE, PERFIL);
    expect(results[0].ragStatus).toBeNull();
    expect(results[0].fontes).toEqual([]);
  });
});

// ════════════════════════════════════════════════════════════════════
describe('nota 1: evalNoTier, o modelo da faixa do plano', () => {
  it('com tier, o agente é pedido no tier e a resposta do mesmo provedor é avaliada', async () => {
    completeMock
      .mockResolvedValueOnce(resposta('ok', 'google-gemini-flash', 'gemini-2.5-flash'))
      .mockResolvedValueOnce(JUIZ_APROVA());

    const { results } = await executeAgentEvalRun([COMPORTAMENTO], AGENTE, PERFIL, {
      politica: { tier: 'GROWTH', modelo: 'google-gemini-flash', motivo: 'tier do plano GROWTH' },
    });

    expect(completeMock.mock.calls[0][0].tier).toBe('GROWTH');
    expect(completeMock.mock.calls[0][0].preferProvider).toBeUndefined();
    expect(results[0].modeloPedido).toBe('google-gemini-flash');
    expect(results[0].combined).toBe('pass');
  });

  it('com tier, a cascata que caiu em Sonnet mede outro modelo: inconclusivo', async () => {
    completeMock.mockResolvedValueOnce(resposta('ok', 'anthropic-sonnet'));
    const { results } = await executeAgentEvalRun([COMPORTAMENTO], AGENTE, PERFIL, {
      politica: { tier: 'STARTER', modelo: 'google-gemini-flash', motivo: 'x' },
    });
    expect(results[0].combined).toBe('inconclusivo');
  });

  it('override contratual vira forceProvider; escalada por intenção vira preferProvider', () => {
    expect(pedidoDoAgente({ override: 'openai-mini', modelo: 'openai-mini', motivo: 'x' }, true)).toEqual({
      params: { forceProvider: 'openai-mini' },
      pedido: 'openai-mini',
    });
    expect(pedidoDoAgente({ tier: 'GROWTH', modelo: 'google-gemini-flash', motivo: 'x' }, true)).toEqual({
      params: { preferProvider: 'anthropic-sonnet' },
      pedido: 'anthropic-sonnet',
    });
    expect(pedidoDoAgente(null, false)).toEqual({ params: {}, pedido: 'anthropic-sonnet' });
  });

  it('a política preguiçosa é lida UMA vez por execução', async () => {
    vi.useFakeTimers();
    try {
      completeMock
        .mockResolvedValueOnce(resposta('ok'))
        .mockResolvedValueOnce(JUIZ_APROVA())
        .mockResolvedValueOnce(resposta('ok'))
        .mockResolvedValueOnce(JUIZ_APROVA());
      const politica = vi.fn(async () => null);
      const promessa = executeAgentEvalRun([COMPORTAMENTO, { ...COMPORTAMENTO, id: 'outro' }], AGENTE, PERFIL, {
        politica,
      });
      // O intervalo entre cenários (1,5 s) corre no relógio falso.
      await vi.advanceTimersByTimeAsync(2_000);
      await promessa;
      expect(politica).toHaveBeenCalledTimes(1);
    } finally {
      vi.useRealTimers();
    }
  });
});

// ════════════════════════════════════════════════════════════════════
describe('Passo 2 (A039, A208): o juiz com evidência, de outra família', () => {
  it('o juiz vê a pergunta, o histórico e os MESMOS trechos que o agente viu', async () => {
    completeMock.mockResolvedValueOnce(resposta('ok')).mockResolvedValueOnce(JUIZ_APROVA());
    await executeAgentEvalRun([COMPORTAMENTO], AGENTE, PERFIL, {
      montarContexto: async () => CONTEXTO_COM_BASE,
    });
    const doJuiz = completeMock.mock.calls[1][0];
    const texto = String(doJuiz.messages[0].content);
    expect(texto).toContain('quero falar com gente');
    expect(texto).toContain('Vera: Oi! Me conta.');
    expect(texto).toContain(CONTEXTO_COM_BASE.trechos);
    expect(String(doJuiz.system)).toMatch(/evid[êe]ncia PRIMEIRO/i);
    expect(doJuiz.operation).toBe('eval');
  });

  it('sem a base no teste, o juiz é avisado disso (não chama de inventado o que o agente nem recebeu)', async () => {
    completeMock.mockResolvedValueOnce(resposta('ok')).mockResolvedValueOnce(JUIZ_APROVA());
    await executeAgentEvalRun([COMPORTAMENTO], AGENTE, PERFIL);
    expect(String(completeMock.mock.calls[1][0].messages[0].content)).toMatch(/não consultou a base/);
  });

  it('agente Anthropic com chave da OpenAI: o juiz é pedido à OpenAI e grava que é outra família', async () => {
    process.env.OPENAI_API_KEY = 'chave-de-teste';
    process.env.ANTHROPIC_API_KEY = 'chave-de-teste';
    completeMock.mockResolvedValueOnce(resposta('ok')).mockResolvedValueOnce(JUIZ_APROVA('openai-mini'));

    const { results } = await executeAgentEvalRun([COMPORTAMENTO], AGENTE, PERFIL, { politica: JUIZ_LIGADO });

    expect(completeMock.mock.calls[1][0].forceProvider).toBe('openai-mini');
    expect(results[0].juiz).toEqual({ provider: 'openai-mini', model: 'gpt-4o-mini' });
    expect(results[0].juizMesmaFamilia).toBe(false);
  });

  it('só uma família configurada: cascata padrão e juizMesmaFamilia true', async () => {
    process.env.ANTHROPIC_API_KEY = 'chave-de-teste';
    completeMock.mockResolvedValueOnce(resposta('ok')).mockResolvedValueOnce(JUIZ_APROVA());

    const { results } = await executeAgentEvalRun([COMPORTAMENTO], AGENTE, PERFIL, { politica: JUIZ_LIGADO });

    expect(completeMock.mock.calls[1][0].forceProvider).toBeUndefined();
    expect(results[0].juizMesmaFamilia).toBe(true);
  });

  it('o juiz de outra família caiu: segue pela cascata e grava quem julgou de fato', async () => {
    process.env.OPENAI_API_KEY = 'chave-de-teste';
    completeMock
      .mockResolvedValueOnce(resposta('ok'))
      .mockRejectedValueOnce(new Error('OpenAI 401'))
      .mockResolvedValueOnce(JUIZ_APROVA('anthropic-sonnet'));

    const { results } = await executeAgentEvalRun([COMPORTAMENTO], AGENTE, PERFIL, { politica: JUIZ_LIGADO });

    expect(results[0].combined).toBe('pass');
    expect(results[0].juiz?.provider).toBe('anthropic-sonnet');
    expect(results[0].juizMesmaFamilia).toBe(true);
  });

  it('a evidência e a causa ficam gravadas no veredito', async () => {
    completeMock
      .mockResolvedValueOnce(resposta('isso é proibido'))
      .mockResolvedValueOnce(resposta('{"evidencia":"a resposta diz proibido","causa":"comportamento","veredito":"reprovado","confianca":70,"motivo":"falou o que não devia"}'))
      .mockResolvedValueOnce(SUGESTAO());
    const { results } = await executeAgentEvalRun([COMPORTAMENTO], AGENTE, PERFIL);
    expect(results[0].judge.evidencia).toBe('a resposta diz proibido');
    expect(results[0].judge.causa).toBe('comportamento');
    expect(results[0].judge.reason).toBe('falou o que não devia');
  });

  it('escolha do juiz: outra família, na ordem OpenAI, Anthropic, Google', () => {
    expect(escolherProvedorDoJuiz('anthropic-sonnet', new Set(['anthropic', 'openai', 'google']))).toBe('openai-mini');
    expect(escolherProvedorDoJuiz('anthropic-sonnet', new Set(['anthropic', 'google']))).toBe('google-gemini-flash');
    expect(escolherProvedorDoJuiz('google-gemini-flash', new Set(['anthropic', 'google']))).toBe('anthropic-sonnet');
    expect(escolherProvedorDoJuiz('anthropic-sonnet', new Set(['anthropic']))).toBeNull();
    expect([...familiasConfiguradas({ OPENAI_API_KEY: 'x', ANTHROPIC_API_KEY: '' })]).toEqual(['openai']);
  });

  it('leitura tolerante: formato antigo, cortado e ilegível', () => {
    expect(lerVereditoComEvidencia('{"passed": true, "confidence": 80, "reason": "ok"}').passed).toBe(true);
    expect(lerVereditoComEvidencia('{"evidencia": "a resposta cita o preço", "veredito": "aprovado", "confi').passed).toBe(true);
    const ilegivel = lerVereditoComEvidencia('não sei');
    expect(ilegivel.passed).toBeNull();
    // Aprovado não tem causa, mesmo que o juiz escreva uma.
    expect(lerVereditoComEvidencia('{"veredito":"aprovado","causa":"comportamento"}').causa).toBeNull();
  });
});

// ════════════════════════════════════════════════════════════════════
// Rodada 1 do PR #378, item 1 (crítico A). O juiz de outra família trocava o
// juiz de TODAS as organizações no deploy, sem interruptor: os vereditos
// mudavam de uma semana para a outra sem ninguém ter ligado nada. Agora a
// política da execução diz se a organização quer o juiz de outra família;
// desligado (o padrão), o juiz é o Sonnet da cascata, como hoje.
// ════════════════════════════════════════════════════════════════════
describe('item 1: o juiz de outra família atrás do interruptor juizDeOutraFamilia', () => {
  it('desligado: mesmo com chave da OpenAI, o juiz vai pela cascata padrão e grava juizMesmaFamilia true', async () => {
    process.env.OPENAI_API_KEY = 'chave-de-teste';
    process.env.ANTHROPIC_API_KEY = 'chave-de-teste';
    completeMock.mockResolvedValueOnce(resposta('ok')).mockResolvedValueOnce(JUIZ_APROVA());

    const { results } = await executeAgentEvalRun([COMPORTAMENTO], AGENTE, PERFIL);

    expect(completeMock.mock.calls[1][0].forceProvider).toBeUndefined();
    expect(results[0].juiz).toEqual({ provider: 'anthropic-sonnet', model: 'claude-sonnet-4-6' });
    expect(results[0].juizMesmaFamilia).toBe(true);
  });

  it('desligado com a política da faixa lida (evalNoTier ligado, juiz desligado): idem', async () => {
    process.env.OPENAI_API_KEY = 'chave-de-teste';
    completeMock.mockResolvedValueOnce(resposta('ok')).mockResolvedValueOnce(JUIZ_APROVA());

    await executeAgentEvalRun([COMPORTAMENTO], AGENTE, PERFIL, {
      politica: { modelo: 'anthropic-sonnet', motivo: 'cascata padrão', juizOutraFamilia: false },
    });

    expect(completeMock.mock.calls[1][0].forceProvider).toBeUndefined();
  });

  it('ligado: o juiz é pedido à outra família (forceProvider openai-mini)', async () => {
    process.env.OPENAI_API_KEY = 'chave-de-teste';
    process.env.ANTHROPIC_API_KEY = 'chave-de-teste';
    completeMock.mockResolvedValueOnce(resposta('ok')).mockResolvedValueOnce(JUIZ_APROVA('openai-mini'));

    const { results } = await executeAgentEvalRun([COMPORTAMENTO], AGENTE, PERFIL, { politica: JUIZ_LIGADO });

    expect(completeMock.mock.calls[1][0].forceProvider).toBe('openai-mini');
    expect(results[0].juizMesmaFamilia).toBe(false);
  });

  it('o placar grava a família do juiz, para comparar só execuções do mesmo juiz (P56)', async () => {
    process.env.OPENAI_API_KEY = 'chave-de-teste';
    process.env.ANTHROPIC_API_KEY = 'chave-de-teste';
    completeMock.mockResolvedValueOnce(resposta('ok')).mockResolvedValueOnce(JUIZ_APROVA('openai-mini'));
    const ligado = await executeAgentEvalRun([COMPORTAMENTO], AGENTE, PERFIL, { politica: JUIZ_LIGADO });
    expect(ligado.placar.juiz).toEqual({ familia: 'openai', outraFamilia: true });

    completeMock.mockReset();
    completeMock.mockResolvedValueOnce(resposta('ok')).mockResolvedValueOnce(JUIZ_APROVA());
    const desligado = await executeAgentEvalRun([COMPORTAMENTO], AGENTE, PERFIL);
    expect(desligado.placar.juiz).toEqual({ familia: 'anthropic', outraFamilia: false });

    // Sem juiz nenhum (resposta vazia): família nula.
    expect(computePlacar([{ combined: 'erro', natureza: 'comportamento' } as any]).juiz).toEqual({
      familia: null,
      outraFamilia: null,
    });
  });
});

// ════════════════════════════════════════════════════════════════════
describe('Passo 4 (P13) e Passo 3 (P21): o caso de conhecimento', () => {
  it('sem a base no teste, fica inconclusivo sem chamar modelo nenhum e fora do portão de falha', async () => {
    const { results, summary, placar } = await executeAgentEvalRun([CONHECIMENTO], AGENTE, PERFIL);
    expect(results[0].combined).toBe('inconclusivo');
    expect(results[0].inconclusivo?.motivo).toBe('base_nao_consultada');
    expect(completeMock).not.toHaveBeenCalled();
    expect(summary.erros).toBe(0);
    expect(placar.conhecimento.estado).toBe('nao_testado');
    expect(placar.conhecimento.motivo).toBe('base_nao_consultada');
  });

  it('com a base fora do ar, é falha técnica', async () => {
    const { results } = await executeAgentEvalRun([CONHECIMENTO], AGENTE, PERFIL, {
      montarContexto: async () => ({ ...CONTEXTO_COM_BASE, ragStatus: 'servico_fora' as const, trechos: '', fontes: [] }),
    });
    expect(results[0].combined).toBe('erro');
    expect(results[0].falhaTecnica).toMatch(/base de conhecimento estava fora do ar/);
    expect(completeMock).not.toHaveBeenCalled();
  });

  it('roda 2 vezes e aprova quando as duas passam', async () => {
    const certa = 'Entregamos sim, das 11h às 15h, com taxa de R$ 12.';
    completeMock
      .mockResolvedValueOnce(resposta(certa))
      .mockResolvedValueOnce(JUIZ_APROVA())
      .mockResolvedValueOnce(resposta(certa))
      .mockResolvedValueOnce(JUIZ_APROVA());

    const { results } = await executeAgentEvalRun([CONHECIMENTO], AGENTE, PERFIL, {
      montarContexto: async () => CONTEXTO_COM_BASE,
    });

    expect(results[0].combined).toBe('pass');
    expect(results[0].amostras).toHaveLength(2);
    expect(results[0].natureza).toBe('conhecimento');
    expect(classifyMock).toHaveBeenCalledTimes(2);
  });

  it('uma das duas passadas errou o valor: reprova, e a representante é a que errou', async () => {
    completeMock
      .mockResolvedValueOnce(resposta('Entregamos sim, das 11h às 15h, com taxa de R$ 12.'))
      .mockResolvedValueOnce(JUIZ_APROVA())
      .mockResolvedValueOnce(resposta('Entregamos das 11h às 15h, taxa de R$ 20.'))
      .mockResolvedValueOnce(resposta('{"evidencia":"disse R$ 20, cadastrado é R$ 12","causa":"ignorou_informacao","veredito":"reprovado","confianca":90,"motivo":"valor errado"}'))
      .mockResolvedValueOnce(SUGESTAO());

    const { results } = await executeAgentEvalRun([CONHECIMENTO], AGENTE, PERFIL, {
      montarContexto: async () => CONTEXTO_COM_BASE,
    });

    expect(results[0].combined).toBe('fail');
    expect(results[0].response).toContain('R$ 20');
    expect(results[0].deterministic.failedPatterns).toContain('valor em reais fora da tabela: 20');
    // "ignorou_informacao" é conduta: continua recebendo sugestão de ajuste.
    expect(results[0].suggestedFix?.patches.length).toBeGreaterThan(0);
  });

  it('reprovação de conhecimento por FALTA de informação: ação de treino, sem patch e sem chamar o sugeridor', async () => {
    completeMock
      .mockResolvedValueOnce(resposta('Não tenho essa informação, vou verificar com a equipe.'))
      .mockResolvedValueOnce(JUIZ_REPROVA_FALTOU());

    const { results } = await executeAgentEvalRun([{ ...CONHECIMENTO, repeticoes: 1 }], AGENTE, PERFIL, {
      montarContexto: async () => CONTEXTO_COM_BASE,
    });

    expect(results[0].combined).toBe('fail');
    expect(results[0].judge.causa).toBe('faltou_informacao');
    expect(results[0].suggestedFix?.patches).toEqual([]);
    // Rodada 1 do PR #378, item 7: o caso nasceu do Q&A, então a informação
    // EXISTE. A ação é revisar o cadastrado, sem pré-preencher pergunta nova.
    expect(results[0].suggestedFix?.acaoDeTreino).toEqual({
      tipo: 'revisar',
      origem: 'qa',
      fonte: 'qa1',
      pergunta: 'Vocês entregam no domingo?',
    });
    expect(results[0].suggestedFix?.summary).toMatch(/cadastrada/);
    expect(results[0].suggestedFix?.summary).toMatch(/não chegou ao agente/);
    expect(results[0].suggestedFix?.summary).not.toContain('—');
    expect(results[0].sugeridor).toBeNull();
    // Agente e juiz: nenhuma terceira chamada para o sugeridor.
    expect(completeMock).toHaveBeenCalledTimes(2);
  });

  // Rodada 1 do PR #378, item 7: os três casos.
  it('item 7: caso do questionário com faltou_informacao vira revisar o campo, sem pergunta nova', async () => {
    const doQuestionario = {
      ...CONHECIMENTO,
      id: 'kb_questionario_pre_tabela_precos',
      repeticoes: 1,
      userMessage: 'quanto custa?',
      conhecimento: {
        ...CONHECIMENTO.conhecimento,
        origem: 'questionario',
        fonte: 'pre_tabela_precos',
        acaoDeTreino: { tipo: 'questionario', secao: 'precos_condicoes', campo: 'pre_tabela_precos', rotulo: 'tabela de preços' },
      },
    };
    completeMock.mockResolvedValueOnce(resposta('Vou verificar.')).mockResolvedValueOnce(JUIZ_REPROVA_FALTOU());

    const { results } = await executeAgentEvalRun([doQuestionario], AGENTE, PERFIL, {
      montarContexto: async () => CONTEXTO_COM_BASE,
    });

    expect(results[0].suggestedFix?.acaoDeTreino).toEqual({
      tipo: 'revisar',
      origem: 'questionario',
      fonte: 'pre_tabela_precos',
      secao: 'precos_condicoes',
      campo: 'pre_tabela_precos',
      rotulo: 'tabela de preços',
    });
    expect(results[0].suggestedFix?.summary).toMatch(/tabela de preços/);
    expect(results[0].suggestedFix?.summary).toMatch(/não chegou ao agente/);
    expect(completeMock).toHaveBeenCalledTimes(2);
  });

  it('item 7: cenário de conhecimento do catálogo da Iza (não gerado) NÃO cai para {tipo: qa}: mantém a sugestão de conduta', async () => {
    const daIza = {
      id: 'zappiq_preco_starter_correto',
      category: 'cr7_integrity',
      natureza: 'conhecimento',
      description: 'Preço do plano Starter',
      userMessage: 'quanto custa o plano Starter?',
      expectedBehavior: 'dizer o preço do catálogo',
      severity: 'critical',
      failPatterns: [/não sei/i],
    } as any;
    completeMock
      .mockResolvedValueOnce(resposta('Não sei o preço.'))
      .mockResolvedValueOnce(JUIZ_REPROVA_FALTOU())
      .mockResolvedValueOnce(SUGESTAO());

    const { results } = await executeAgentEvalRun([daIza], AGENTE, PERFIL);

    expect(results[0].combined).toBe('fail');
    expect(results[0].suggestedFix?.acaoDeTreino).toBeUndefined();
    expect(results[0].suggestedFix?.patches).toHaveLength(1);
    expect(results[0].sugeridor).toEqual({ provider: 'anthropic-sonnet', model: 'claude-sonnet-4-6' });
    expect(completeMock).toHaveBeenCalledTimes(3);
  });

  it('item 7: sem ação vinda do próprio caso, nenhuma ação é inventada a partir da mensagem', () => {
    expect(
      acaoDeTreinoPorFaltaDeInformacao({ natureza: 'conhecimento', causa: 'faltou_informacao', userMessage: 'quanto custa?' }),
    ).toBeNull();
    expect(
      acaoDeTreinoPorFaltaDeInformacao({
        natureza: 'conhecimento',
        causa: 'faltou_informacao',
        origem: 'qa',
        fonte: 'qa1',
        acaoDeTreino: { tipo: 'qa', pergunta: 'Entregam?' },
      }),
    ).toEqual({ tipo: 'revisar', origem: 'qa', fonte: 'qa1', pergunta: 'Entregam?' });
  });

  // Rodada 1 do PR #378, item 4: valor em reais que veio nos TRECHOS que o
  // agente recebeu não é "fora da tabela". Os valores como 379,90 e 197,60
  // da MACHIA só existem nos trechos, não no Q&A.
  it('item 4: valor em reais dos trechos recebidos não reprova como "fora da tabela"', async () => {
    const caso = {
      ...CONHECIMENTO,
      repeticoes: 1,
      conhecimento: { ...CONHECIMENTO.conhecimento, referencia: 'Custa R$ 1.200,00.', valoresEsperados: ['n:1200'], reaisPermitidos: ['1200'] },
    };
    const contexto = { ...CONTEXTO_COM_BASE, trechos: '[tabela.pdf] Instalação: R$ 350,00.' };
    completeMock
      .mockResolvedValueOnce(resposta('Custa R$ 1.200,00 e a instalação sai R$ 350,00.'))
      .mockResolvedValueOnce(JUIZ_APROVA());

    const { results } = await executeAgentEvalRun([caso], AGENTE, PERFIL, { montarContexto: async () => contexto });

    expect(results[0].deterministic.failedPatterns).toEqual([]);
    expect(results[0].deterministic.passed).toBe(true);
    expect(results[0].deterministic.reaisDosTrechos).toEqual(['350']);
    expect(results[0].combined).toBe('pass');
  });

  it('item 4: sem o valor nos trechos, o mesmo R$ 350 continua fora da tabela', async () => {
    const caso = {
      ...CONHECIMENTO,
      repeticoes: 1,
      conhecimento: { ...CONHECIMENTO.conhecimento, referencia: 'Custa R$ 1.200,00.', valoresEsperados: ['n:1200'], reaisPermitidos: ['1200'] },
    };
    completeMock
      .mockResolvedValueOnce(resposta('Custa R$ 1.200,00 e a instalação sai R$ 350,00.'))
      .mockResolvedValueOnce(JUIZ_APROVA());

    const { results } = await executeAgentEvalRun([caso], AGENTE, PERFIL, {
      montarContexto: async () => ({ ...CONTEXTO_COM_BASE, trechos: '' }),
    });

    expect(results[0].deterministic.failedPatterns).toEqual(['valor em reais fora da tabela: 350']);
    expect(results[0].deterministic.reaisDosTrechos).toEqual([]);
  });

  it('o re-teste pede uma passada só (semRepeticoes)', async () => {
    completeMock
      .mockResolvedValueOnce(resposta('Entregamos das 11h às 15h, taxa de R$ 12.'))
      .mockResolvedValueOnce(JUIZ_APROVA());
    const { results } = await executeAgentEvalRun([CONHECIMENTO], AGENTE, PERFIL, {
      montarContexto: async () => CONTEXTO_COM_BASE,
      semRepeticoes: true,
      pularSugestao: true,
    });
    expect(results[0].amostras).toBeUndefined();
    expect(completeMock).toHaveBeenCalledTimes(2);
  });
});

// ════════════════════════════════════════════════════════════════════
describe('Passo 3 (P21): o placar em duas partes', () => {
  it('conhecimento e comportamento calculados separadamente, com a mesma régua da nota', () => {
    const placar = computePlacar([
      { natureza: 'conhecimento', combined: 'pass' },
      { natureza: 'conhecimento', combined: 'partial' },
      { natureza: 'comportamento', combined: 'pass' },
      { natureza: 'comportamento', combined: 'pass' },
      { natureza: 'comportamento', combined: 'fail' },
      { natureza: 'comportamento', combined: 'erro' },
    ] as any);
    expect(placar.conhecimento).toMatchObject({ estado: 'avaliado', avaliados: 2, aprovados: 1, percent: 50 });
    expect(placar.comportamento).toMatchObject({ estado: 'avaliado', avaliados: 3, aprovados: 2, percent: 67 });
  });

  it('agente sem nenhum caso de conhecimento: "sem base cadastrada", e não uma porcentagem', () => {
    const placar = computePlacar([{ natureza: 'comportamento', combined: 'pass' }] as any);
    expect(placar.conhecimento.estado).toBe('sem_base');
    expect(placar.conhecimento.percent).toBeNull();
  });

  it('a execução devolve o placar junto com a nota única', async () => {
    completeMock.mockResolvedValueOnce(resposta('ok')).mockResolvedValueOnce(JUIZ_APROVA());
    const r = await executeAgentEvalRun([COMPORTAMENTO], AGENTE, PERFIL);
    expect(r.summary.scorePercent).toBe(100);
    expect(r.placar.comportamento.percent).toBe(100);
    expect(r.placar.conhecimento.estado).toBe('sem_base');
  });
});
