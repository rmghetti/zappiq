/* ══════════════════════════════════════════════════════════════════════
 * O que o questionário vira quando chega na base de conhecimento.
 * --------------------------------------------------------------------
 * Este arquivo não existia, e o defeito que ele tranca estava em produção:
 *
 *   A006: resposta aninhada (as perguntas de especialidade) virava o texto
 *         literal '[object Object]'. A MACHIA tinha 47 respostas nesse
 *         bloco e NENHUMA chegou ao vetor.
 *   A023: o rótulo de cada linha era a chave de código ('pre_tabela_precos:')
 *         em vez do que foi perguntado ao dono, e tudo caía num documento
 *         só, fatiado por tamanho, misturando preço, CNPJ e tom de voz no
 *         mesmo trecho.
 *   A075: os rótulos iam em markdown ('**chave:**'), que as regras base do
 *         agente proíbem na resposta.
 *
 * O teste abaixo é o contrato do formato novo: um documento por SEÇÃO do
 * questionário, com o TEXTO da pergunta, sem markdown, sem '[object
 * Object]', e só com o que tem destino 'base'.
 * ══════════════════════════════════════════════════════════════════════ */

import { describe, it, expect } from 'vitest';

import {
  buildSurveyKnowledgeBlocks,
  sourceDaSecao,
  countAnsweredQuestions,
} from './knowledgeBaseBuilder.js';

/** O shape REAL gravado em settings.surveyAnswers (ver onboarding/page.tsx). */
const RESPOSTAS_REAIS = {
  identidade_empresa: {
    ide_nome_fantasia: 'Academia Corpo em Foco',
    ide_tem_filiais: true,
    ide_endereco_principal: 'Rua das Palmeiras, 120, Centro, Campinas, SP',
    ide_cnpj: '',
  },
  precos_condicoes: {
    pre_tabela_precos: 'Plano mensal R$ 149. Plano trimestral R$ 399.',
    pre_formas_pagamento: ['Pix', 'Cartão de crédito', 'Boleto'],
    // Destino 'instrucao': vai para o prompt, não para a busca.
    pre_quando_informar_preco: 'Só depois de entender o objetivo do aluno',
  },
  // Destino 'fora_da_ia' e 'funcao_do_sistema': não entram em lugar nenhum.
  com_maior_margem: 'Personal trainer, 62% de margem',
  crm_nps: 'Sim, pedir nota de 0 a 10',
  // Chave que não é pergunta de catálogo nenhum.
  chave_esquisita_de_versao_antiga: 'sobra de uma migração antiga',
  subsegmentos: {
    academia: {
      academia_modalidades_oferecidas: ['Musculação', 'Crossfit'],
      academia_diferenciais: 'Estacionamento coberto e avaliação física gratuita',
    },
  },
};

const ENTRADA = {
  businessName: 'Academia Corpo em Foco',
  niche: 'academia',
  surveyAnswers: RESPOSTAS_REAIS,
};

describe('documento do questionário por seção', () => {
  it('escreve o texto da pergunta e a resposta, sem chave de código e sem markdown', () => {
    const blocos = buildSurveyKnowledgeBlocks(ENTRADA);
    const precos = blocos.find((b) => b.secaoId === 'precos_condicoes');

    expect(precos?.texto).toBe(
      [
        'Questionário de qualificação: Preços e Condições',
        'Empresa: Academia Corpo em Foco (segmento: academia)',
        '',
        'Pergunta: Se aplicável, informe a tabela de preços principal',
        'Resposta: Plano mensal R$ 149. Plano trimestral R$ 399.',
        '',
        'Pergunta: Quais formas de pagamento são aceitas?',
        'Resposta: Pix, Cartão de crédito, Boleto',
      ].join('\n'),
    );
  });

  it('não deixa passar [object Object] em resposta aninhada (A006)', () => {
    const blocos = buildSurveyKnowledgeBlocks(ENTRADA);
    const tudo = blocos.map((b) => b.texto).join('\n');
    expect(tudo).not.toContain('[object Object]');
    // As perguntas de especialidade entram com o texto delas.
    expect(tudo).toContain('Quais modalidades sua academia oferece?');
    expect(tudo).toContain('Musculação, Crossfit');
  });

  it('não escreve rótulo de código nem asterisco (A023, A075)', () => {
    const tudo = buildSurveyKnowledgeBlocks(ENTRADA).map((b) => b.texto).join('\n');
    expect(tudo).not.toContain('**');
    expect(tudo).not.toContain('pre_tabela_precos');
    expect(tudo).not.toContain('academia_modalidades_oferecidas');
  });

  it('dá um source estável por seção, para a reingestão substituir só aquela', () => {
    const blocos = buildSurveyKnowledgeBlocks(ENTRADA);
    const sources = blocos.map((b) => b.source).sort();
    expect(sources).toEqual([
      'survey-academia_modalidades',
      'survey-identidade_empresa',
      'survey-precos_condicoes',
    ]);
    expect(sourceDaSecao('precos_condicoes')).toBe('survey-precos_condicoes');
    // Um bloco por seção: nada de 27 trechos misturando seções diferentes.
    expect(new Set(sources).size).toBe(sources.length);
  });

  it('leva só o que tem destino base', () => {
    const tudo = buildSurveyKnowledgeBlocks(ENTRADA).map((b) => b.texto).join('\n');
    // instrução (vai para o prompt)
    expect(tudo).not.toContain('Só depois de entender o objetivo do aluno');
    // fora da IA (margem)
    expect(tudo).not.toContain('62% de margem');
    // função do sistema (NPS)
    expect(tudo).not.toContain('pedir nota de 0 a 10');
    // chave que não é pergunta de nenhum catálogo
    expect(tudo).not.toContain('sobra de uma migração antiga');
  });

  it('escreve booleano em português e omite resposta vazia', () => {
    const identidade = buildSurveyKnowledgeBlocks(ENTRADA).find(
      (b) => b.secaoId === 'identidade_empresa',
    );
    expect(identidade?.texto).toContain(
      'Pergunta: A empresa possui mais de uma unidade/filial?\nResposta: Sim',
    );
    // CNPJ veio vazio: não vira linha nenhuma.
    expect(identidade?.texto).not.toContain('CNPJ');
  });

  it('aceita resposta aninhada livre sem virar objeto', () => {
    const blocos = buildSurveyKnowledgeBlocks({
      businessName: 'Empresa X',
      niche: 'geral',
      surveyAnswers: {
        identidade_empresa: {
          // Uma resposta que chegou como objeto (formato antigo de tela).
          ide_endereco_principal: { rua: 'Av. Brasil, 10', cidade: 'Campinas' },
        },
      },
    });
    expect(blocos[0].texto).toContain('Rua: Av. Brasil, 10');
    expect(blocos[0].texto).toContain('Cidade: Campinas');
    expect(blocos[0].texto).not.toContain('[object Object]');
  });

  it('questionário vazio não gera documento nenhum', () => {
    expect(buildSurveyKnowledgeBlocks({ businessName: 'X', niche: 'geral', surveyAnswers: {} })).toEqual([]);
    expect(
      buildSurveyKnowledgeBlocks({
        businessName: 'X',
        niche: 'geral',
        surveyAnswers: { identidade_empresa: { ide_cnpj: '   ' } },
      }),
    ).toEqual([]);
  });

  it('conta as respostas preenchidas atravessando os níveis', () => {
    // 3 de identidade (CNPJ vazio não conta) + 3 de preços + 2 de especialidade
    // + margem + NPS + a chave esquisita = 11.
    expect(countAnsweredQuestions(RESPOSTAS_REAIS)).toBe(11);
  });
});
