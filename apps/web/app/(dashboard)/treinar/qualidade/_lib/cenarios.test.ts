/**
 * C2 (Passo 5): a lista completa de cenários, o diagnóstico em português, a
 * resposta sem tags e o "Cadastrar esta informação".
 */
import { describe, it, expect } from 'vitest';
import {
  rotuloDoVeredito,
  EXPLICACAO_PARCIAL,
  respostaParaExibir,
  diagnosticoLegivel,
  podeCadastrarInformacao,
  linkDaAcaoDeTreino,
  textoDoAvisoDeTreino,
  ordenarParaALista,
  rotuloDoBotaoDaAcao,
  tituloDoCartaoDaAcao,
} from './cenarios';

const ACAO_QA = { tipo: 'qa' as const, pergunta: 'Vocês entregam no domingo?' };

describe('rotuloDoVeredito e a explicação do parcial (A055)', () => {
  it('cada veredito em uma palavra, inclusive o inconclusivo', () => {
    expect(rotuloDoVeredito('pass')).toBe('Aprovado');
    expect(rotuloDoVeredito('partial')).toBe('Parcial');
    expect(rotuloDoVeredito('fail')).toBe('Reprovado');
    expect(rotuloDoVeredito('erro')).toBe('Não avaliado');
    expect(rotuloDoVeredito('inconclusivo')).toBe('Inconclusivo');
  });

  it('a explicação diz que parcial conta como não aprovado, sem travessão', () => {
    expect(EXPLICACAO_PARCIAL).toMatch(/Parcial conta como não aprovado/);
    expect(EXPLICACAO_PARCIAL).not.toContain('—');
  });
});

describe('respostaParaExibir (A088)', () => {
  it('mostra só o conteúdo de <reply>, sem o texto dobrado', () => {
    expect(respostaParaExibir('Oi! Tudo bem?\n<reply>Oi! Tudo bem?</reply>')).toBe('Oi! Tudo bem?');
  });

  it('tira as tags de ação e de botões', () => {
    expect(respostaParaExibir('Já chamo alguém. <action>handoff</action><buttons>Sim</buttons>')).toBe(
      'Já chamo alguém.',
    );
  });

  it('resposta limpa atravessa igual', () => {
    expect(respostaParaExibir('Abrimos às 9h.')).toBe('Abrimos às 9h.');
  });
});

describe('diagnosticoLegivel (A151)', () => {
  it('"Judge error" e "Scenario crashed" viram frase em português', () => {
    const a = diagnosticoLegivel({ combined: 'fail', judge: { passed: false, confidence: 0, reason: 'Judge error: timeout' } });
    const b = diagnosticoLegivel({ combined: 'fail', judge: { passed: false, confidence: 0, reason: 'Scenario crashed: x' } });
    expect(a).toMatch(/avaliador não respondeu/);
    expect(b).toMatch(/falha técnica/);
    expect(`${a} ${b}`).not.toMatch(/Judge|Scenario|crashed/);
  });

  it('inconclusivo e falha técnica usam a explicação gravada', () => {
    expect(
      diagnosticoLegivel({
        combined: 'inconclusivo',
        judge: { passed: null, confidence: 0, reason: 'x' },
        inconclusivo: { motivo: 'modelo_diferente', explicacao: 'Veio de um modelo de reserva.' },
      }),
    ).toBe('Veio de um modelo de reserva.');
    expect(
      diagnosticoLegivel({ combined: 'erro', judge: { passed: null, confidence: 0, reason: '' }, falhaTecnica: 'Resposta vazia.' }),
    ).toBe('Resposta vazia.');
  });

  it('o motivo do avaliador em português passa como veio', () => {
    expect(diagnosticoLegivel({ combined: 'partial', judge: { passed: false, confidence: 1, reason: 'Não disse o preço.' } })).toBe(
      'Não disse o preço.',
    );
  });
});

describe('Cadastrar esta informação (P21)', () => {
  const base = {
    natureza: 'conhecimento' as const,
    combined: 'fail' as const,
    ragStatus: 'ok' as const,
    suggestedFix: { summary: 's', patches: [], confidence: 1, acaoDeTreino: ACAO_QA },
  };

  it('aparece em conhecimento reprovado, com ação de treino e com a base no teste', () => {
    expect(podeCadastrarInformacao(base)).toBe(true);
  });

  // Rodada 1 do PR #378, item 3: a base consultada SEM resultado também
  // conta como "o teste usou a base": é justamente o caso em que cadastrar
  // resolve. Só a base fora do ar e o teste sem consulta ficam sem botão.
  it('não aparece quando a base estava fora do ar ou o teste não consultou a base', () => {
    expect(podeCadastrarInformacao({ ...base, ragStatus: null })).toBe(false);
    expect(podeCadastrarInformacao({ ...base, ragStatus: 'servico_fora' })).toBe(false);
  });

  it('aparece também quando a base foi consultada e não trouxe nada (sem_resultado)', () => {
    expect(podeCadastrarInformacao({ ...base, ragStatus: 'sem_resultado' })).toBe(true);
  });

  it('não aparece em comportamento, em aprovado nem sem ação de treino', () => {
    expect(podeCadastrarInformacao({ ...base, natureza: 'comportamento' })).toBe(false);
    expect(podeCadastrarInformacao({ ...base, combined: 'pass' })).toBe(false);
    expect(podeCadastrarInformacao({ ...base, suggestedFix: { summary: 's', patches: [], confidence: 1 } })).toBe(false);
  });

  it('o link abre a aba Perguntas e Respostas com a pergunta; o do questionário abre o questionário', () => {
    expect(linkDaAcaoDeTreino(ACAO_QA)).toMatch(/^\/ai-training\?pergunta=.+#qa$/);
    expect(linkDaAcaoDeTreino({ tipo: 'questionario', secao: 'precos_condicoes', rotulo: 'tabela de preços' })).toBe(
      '/ai-training#survey',
    );
  });
});

/* Rodada 1 do PR #378, item 7: nos casos gerados a informação EXISTE por
 * construção (o caso nasceu do Q&A ou do questionário). Quando o juiz diz
 * 'faltou_informacao', ela está cadastrada mas não chegou ao agente: a ação
 * é revisar o texto, sem pré-preencher pergunta nova. */
describe('item 7: ação de revisar (a informação está cadastrada, não chegou ao agente)', () => {
  const REVISAR_QA = { tipo: 'revisar' as const, origem: 'qa' as const, fonte: 'qa1', pergunta: 'Vocês entregam no domingo?' };
  const REVISAR_Q = {
    tipo: 'revisar' as const,
    origem: 'questionario' as const,
    fonte: 'pre_tabela_precos',
    secao: 'precos_condicoes',
    rotulo: 'tabela de preços',
  };

  it('o link não pré-preenche pergunta nova: abre a aba de perguntas e respostas, ou o questionário', () => {
    expect(linkDaAcaoDeTreino(REVISAR_QA)).toBe('/ai-training#qa');
    expect(linkDaAcaoDeTreino(REVISAR_Q)).toBe('/ai-training#survey');
  });

  it('o botão e o título do cartão falam em revisar, não em cadastrar', () => {
    expect(rotuloDoBotaoDaAcao(REVISAR_QA)).toBe('Revisar esta informação');
    expect(rotuloDoBotaoDaAcao(ACAO_QA)).toBe('Cadastrar esta informação');
    expect(tituloDoCartaoDaAcao(REVISAR_QA)).toMatch(/cadastrada.*não chegou ao agente/);
    expect(tituloDoCartaoDaAcao(ACAO_QA)).toMatch(/não tinha esta informação/);
    for (const t of [rotuloDoBotaoDaAcao(REVISAR_QA), tituloDoCartaoDaAcao(REVISAR_QA)]) expect(t).not.toContain('—');
  });

  it('o botão também aparece para a ação de revisar', () => {
    expect(
      podeCadastrarInformacao({
        natureza: 'conhecimento',
        combined: 'fail',
        ragStatus: 'ok',
        suggestedFix: { summary: 's', patches: [], confidence: 1, acaoDeTreino: REVISAR_QA },
      }),
    ).toBe(true);
  });

  it('o aviso separa o que falta do que está cadastrado e não chegou', () => {
    const texto = textoDoAvisoDeTreino([
      { natureza: 'conhecimento', combined: 'fail', suggestedFix: { summary: '', patches: [], confidence: 1, acaoDeTreino: REVISAR_Q } },
      { natureza: 'conhecimento', combined: 'fail', suggestedFix: { summary: '', patches: [], confidence: 1, acaoDeTreino: ACAO_QA } },
      { natureza: 'conhecimento', combined: 'partial', suggestedFix: { summary: '', patches: [], confidence: 1, acaoDeTreino: REVISAR_QA } },
    ]);
    expect(texto).toBe(
      'Faltam: resposta para "Vocês entregam no domingo?". ' +
        'Cadastradas, mas não chegaram ao agente: tabela de preços, resposta para "Vocês entregam no domingo?".',
    );
  });
});

describe('o aviso de treino específico', () => {
  it('só existe com reprovação de conhecimento por falta de informação, e diz o que falta', () => {
    const texto = textoDoAvisoDeTreino([
      { natureza: 'conhecimento', combined: 'fail', suggestedFix: { summary: '', patches: [], confidence: 1, acaoDeTreino: { tipo: 'questionario', secao: 'precos_condicoes', rotulo: 'tabela de preços' } } },
      { natureza: 'conhecimento', combined: 'partial', suggestedFix: { summary: '', patches: [], confidence: 1, acaoDeTreino: ACAO_QA } },
      { natureza: 'comportamento', combined: 'fail', suggestedFix: { summary: '', patches: [{ where: 'x', diff: 'y' }], confidence: 1 } },
    ]);
    expect(texto).toBe('Faltam: tabela de preços, resposta para "Vocês entregam no domingo?".');
  });

  it('sem reprovação de conhecimento, nenhum aviso (o genérico antigo aparecia em toda nota abaixo de 90)', () => {
    expect(textoDoAvisoDeTreino([{ natureza: 'comportamento', combined: 'fail' }])).toBeNull();
    expect(textoDoAvisoDeTreino([])).toBeNull();
  });
});

describe('ordenarParaALista', () => {
  it('reprovado e parcial primeiro, aprovados por último, crítico antes', () => {
    const lista = ordenarParaALista([
      { combined: 'pass', severity: 'critical', id: 'a' },
      { combined: 'fail', severity: 'medium', id: 'b' },
      { combined: 'fail', severity: 'critical', id: 'c' },
      { combined: 'partial', severity: 'high', id: 'd' },
    ] as any);
    expect(lista.map((x: any) => x.id)).toEqual(['c', 'b', 'd', 'a']);
  });
});
