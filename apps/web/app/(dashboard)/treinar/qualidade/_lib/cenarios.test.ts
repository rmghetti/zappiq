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

  it('não aparece quando o teste não usou a base (ragStatus diferente de ok)', () => {
    expect(podeCadastrarInformacao({ ...base, ragStatus: null })).toBe(false);
    expect(podeCadastrarInformacao({ ...base, ragStatus: 'servico_fora' })).toBe(false);
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
