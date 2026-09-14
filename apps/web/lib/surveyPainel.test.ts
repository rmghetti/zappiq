/* ══════════════════════════════════════════════════════════════════════
 * O painel do questionário no Treinar IA.
 * --------------------------------------------------------------------
 * A177: as perguntas do segmento e da especialidade só existiam no
 * cadastro. Quem pulou no cadastro (e o próprio popup incentivava pular)
 * nunca mais conseguia responder, e quem respondeu não conseguia corrigir.
 * Em produção: uma organização com 201 respostas globais e ZERO do
 * segmento, outra com 202 globais e zero do segmento dela.
 *
 * A211: o questionário pede 20 configurações de funções que a plataforma
 * não executa. A tela precisa dizer isso, em vez de deixar o dono achar
 * que configurou algo.
 *
 * A008: quando a ingestão falha, a tela dizia "salvo automaticamente".
 * ══════════════════════════════════════════════════════════════════════ */

import { describe, it, expect } from 'vitest';

import {
  secoesDoPainel,
  lerResposta,
  gravarResposta,
  progressoDoPainel,
  avisoDaPergunta,
  textoDaSincronizacao,
} from './surveyPainel';

describe('seções do painel', () => {
  it('sempre traz as perguntas globais', () => {
    const secoes = secoesDoPainel({});
    expect(secoes.length).toBeGreaterThanOrEqual(12);
    expect(secoes.every((s) => s.origem === 'global')).toBe(true);
    expect(secoes[0].caminho).toEqual(['identidade_empresa']);
  });

  it('traz também os blocos do segmento e da especialidade (A177)', () => {
    const secoes = secoesDoPainel({ segmento: 'academia', subsegmentos: ['academia'] });
    const doSegmento = secoes.filter((s) => s.origem === 'segmento');
    const daEspecialidade = secoes.filter((s) => s.origem === 'especialidade');

    expect(doSegmento.length).toBeGreaterThan(0);
    expect(doSegmento[0].caminho).toEqual(['segmento']);
    expect(daEspecialidade.length).toBeGreaterThan(0);
    expect(daEspecialidade[0].caminho).toEqual(['subsegmentos', 'academia']);
  });

  it('segmento desconhecido não quebra a tela', () => {
    const secoes = secoesDoPainel({ segmento: 'nao_existe', subsegmentos: ['tambem_nao'] });
    expect(secoes.every((s) => s.origem === 'global')).toBe(true);
  });

  it('não repete o mesmo bloco duas vezes quando segmento e especialidade coincidem', () => {
    const secoes = secoesDoPainel({ segmento: 'academia', subsegmentos: ['academia', 'academia'] });
    const ids = secoes.map((s) => `${s.caminho.join('.')}:${s.bloco.id}`);
    expect(new Set(ids).size).toBe(ids.length);
  });
});

describe('ler e gravar resposta no lugar certo', () => {
  const RESPOSTAS = {
    identidade_empresa: { ide_cnpj: '12.345.678/0001-90' },
    subsegmentos: { academia: { academia_capacidade: '120 alunos' } },
  };

  it('lê de cada nível', () => {
    expect(lerResposta(RESPOSTAS, ['identidade_empresa'], 'ide_cnpj')).toBe('12.345.678/0001-90');
    expect(lerResposta(RESPOSTAS, ['subsegmentos', 'academia'], 'academia_capacidade')).toBe('120 alunos');
    expect(lerResposta(RESPOSTAS, ['segmento'], 'qualquer')).toBeUndefined();
  });

  it('grava sem destruir o resto do JSON', () => {
    const novo = gravarResposta(RESPOSTAS, ['subsegmentos', 'academia'], 'academia_equipamentos', 'Premium');

    expect(novo.subsegmentos.academia).toEqual({
      academia_capacidade: '120 alunos',
      academia_equipamentos: 'Premium',
    });
    expect(novo.identidade_empresa).toEqual(RESPOSTAS.identidade_empresa);
    // Imutável: quem chamou continua com o objeto antigo intacto.
    expect((RESPOSTAS as any).subsegmentos.academia.academia_equipamentos).toBeUndefined();
  });

  it('cria o caminho que ainda não existe', () => {
    const novo = gravarResposta({}, ['subsegmentos', 'restaurante'], 'restaurante_delivery', 'Sim');
    expect(novo.subsegmentos.restaurante.restaurante_delivery).toBe('Sim');
  });
});

describe('progresso', () => {
  it('conta respondidas sobre o total das seções mostradas', () => {
    const secoes = secoesDoPainel({ segmento: 'academia' });
    const primeira = secoes[0];
    const respostas = gravarResposta({}, primeira.caminho, primeira.bloco.questions[0].id, 'algo');

    const { respondidas, total, pct } = progressoDoPainel(secoes, respostas);
    expect(respondidas).toBe(1);
    expect(total).toBeGreaterThan(200);
    expect(pct).toBe(Math.round((1 / total) * 100));
  });

  it('lista vazia e texto em branco não contam como resposta', () => {
    const secoes = secoesDoPainel({});
    const bloco = secoes[0];
    let respostas = gravarResposta({}, bloco.caminho, bloco.bloco.questions[0].id, '   ');
    respostas = gravarResposta(respostas, bloco.caminho, bloco.bloco.questions[1].id, []);
    expect(progressoDoPainel(secoes, respostas).respondidas).toBe(0);
  });
});

describe('aviso por pergunta (A211)', () => {
  it('marca em breve o que o produto ainda não faz', () => {
    const aviso = avisoDaPergunta('crm_aniversario');
    expect(aviso?.rotulo).toBe('em breve');
    expect(aviso?.detalhe).toBeTruthy();
  });

  it('manda para Configurações o que já tem campo de verdade', () => {
    expect(avisoDaPergunta('esc_mensagem_transicao')?.rotulo).toBe('fica em Configurações');
    expect(avisoDaPergunta('tom_principal')?.rotulo).toBe('fica em Configurações');
  });

  it('avisa o que não vai para a IA', () => {
    expect(avisoDaPergunta('com_maior_margem')?.rotulo).toBe('não vai para a IA');
  });

  it('pergunta comum não tem aviso nenhum', () => {
    expect(avisoDaPergunta('pre_tabela_precos')).toBeNull();
    expect(avisoDaPergunta('academia_capacidade')).toBeNull();
  });
});

describe('estado da sincronização com a IA (A008)', () => {
  it('nunca sincronizado: diz que a IA ainda não recebeu', () => {
    const estado = textoDaSincronizacao(null);
    expect(estado.tom).toBe('pendente');
    expect(estado.texto).toContain('ainda não recebeu');
  });

  it('pendente: diz que está a caminho', () => {
    const estado = textoDaSincronizacao({ status: 'pendente', at: '2026-09-14T12:00:00.000Z' });
    expect(estado.tom).toBe('pendente');
    expect(estado.texto).toContain('ainda não recebeu');
  });

  it('ok: mostra a data da última sincronização', () => {
    const estado = textoDaSincronizacao({ status: 'ok', at: '2026-09-14T12:00:00.000Z' });
    expect(estado.tom).toBe('ok');
    expect(estado.texto).toContain('14/09/2026');
  });

  it('falhou: mostra o motivo, sem dizer que está tudo certo', () => {
    const estado = textoDaSincronizacao({
      status: 'falhou',
      at: '2026-09-14T12:00:00.000Z',
      motivo: 'RAG fora do ar',
    });
    expect(estado.tom).toBe('falhou');
    expect(estado.texto).toContain('RAG fora do ar');
    expect(estado.texto).not.toContain('tudo certo');
  });

  it('não usa travessão em nada que o cliente lê', () => {
    for (const estado of [
      textoDaSincronizacao(null),
      textoDaSincronizacao({ status: 'ok', at: '2026-09-14T12:00:00.000Z' }),
      textoDaSincronizacao({ status: 'falhou', at: '2026-09-14T12:00:00.000Z', motivo: 'x' }),
    ]) {
      expect(estado.texto).not.toContain('—');
    }
  });
});
