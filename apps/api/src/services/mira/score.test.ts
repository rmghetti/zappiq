/**
 * Mira Score: os campos de alvo do Perfil mudam a nota de verdade.
 *
 * Fecha o gap apontado pela auditoria adversarial: cnaesAlvo, portes e
 * regioes (B2B) e regiaoCidade (B2C) tinham consumo no score sem nenhum
 * teste provando a influência. Cada teste compara a MESMA conta com e sem o
 * campo declarado: a diferença de nota é a prova, sem amarrar em peso exato.
 */
import { describe, it, expect } from 'vitest';
import { computeMiraScoreV1, computeMiraScoreB2C } from './score.js';
import type { CnpjData } from './cnpj.js';

const CONTA: CnpjData = {
  cnpj: '11222333000181',
  razaoSocial: 'ACME COMERCIO DE INFORMATICA LTDA',
  nomeFantasia: 'ACME',
  cnae: '4651-6/01',
  cnaeDescricao: 'comercio atacadista de equipamentos de informatica',
  porte: 'MICRO EMPRESA',
  capitalSocial: 50_000,
  naturezaJuridica: 'LTDA',
  situacaoCadastral: 'ATIVA',
  municipio: 'São Paulo',
  uf: 'SP',
  telefone: null,
  dataInicioAtividade: '2010-01-01',
  optanteSimples: null,
  qsa: [],
  fonteUrl: 'https://brasilapi.com.br',
};

const PERFIL_VAZIO = { catalogo: [{ nome: 'Produto' }], alvoB2B: {} };

describe('computeMiraScoreV1 (B2B)', () => {
  it('cnaesAlvo declarado que casa com o CNAE da conta sobe a nota', () => {
    const sem = computeMiraScoreV1(PERFIL_VAZIO, CONTA, 0, null);
    const com = computeMiraScoreV1({ ...PERFIL_VAZIO, alvoB2B: { cnaesAlvo: ['4651'] } }, CONTA, 0, null);
    expect(com.score).toBeGreaterThan(sem.score);
  });

  it('cnaesAlvo que NÃO casa não sobe nada', () => {
    const sem = computeMiraScoreV1(PERFIL_VAZIO, CONTA, 0, null);
    const com = computeMiraScoreV1({ ...PERFIL_VAZIO, alvoB2B: { cnaesAlvo: ['8630'] } }, CONTA, 0, null);
    expect(com.score).toBe(sem.score);
  });

  it('regioes declaradas que cobrem a UF da conta sobem a nota', () => {
    const sem = computeMiraScoreV1(PERFIL_VAZIO, CONTA, 0, null);
    const com = computeMiraScoreV1({ ...PERFIL_VAZIO, alvoB2B: { regioes: ['SP'] } }, CONTA, 0, null);
    expect(com.score).toBeGreaterThan(sem.score);
  });

  it('portes declarados que casam com o porte da conta sobem a nota', () => {
    const sem = computeMiraScoreV1(PERFIL_VAZIO, CONTA, 0, null);
    const com = computeMiraScoreV1({ ...PERFIL_VAZIO, alvoB2B: { portes: ['ME'] } }, CONTA, 0, null);
    expect(com.score).toBeGreaterThan(sem.score);
  });
});

describe('computeMiraScoreB2C', () => {
  const PLACE = { nome: 'Cantina da Vila', telefone: '11999990000', site: null, rating: 4.6, totalAvaliacoes: 120 };
  const LOCAL = { municipio: 'Moema', uf: 'SP' };

  it('regiaoCidade declarada que casa com o local do negócio sobe a nota', () => {
    const sem = computeMiraScoreB2C({ catalogo: [{ nome: 'P' }], alvoB2C: { regiaoCidade: [] } }, PLACE, LOCAL);
    const com = computeMiraScoreB2C({ catalogo: [{ nome: 'P' }], alvoB2C: { regiaoCidade: ['Moema'] } }, PLACE, LOCAL);
    expect(com.score).toBeGreaterThan(sem.score);
  });

  it('as regioes do alvo B2B servem de reserva quando o B2C não tem região', () => {
    const sem = computeMiraScoreB2C({ catalogo: [{ nome: 'P' }] }, PLACE, { municipio: 'São Paulo', uf: 'SP' });
    const com = computeMiraScoreB2C(
      { catalogo: [{ nome: 'P' }], alvoB2B: { regioes: ['São Paulo'] } },
      PLACE,
      { municipio: 'São Paulo', uf: 'SP' }
    );
    expect(com.score).toBeGreaterThan(sem.score);
  });
});

/**
 * Fator "Janela e incumbente" (15 pontos) — a Fase 2 do "Aprofundar com IA".
 *
 * Ficou escrito `valor: 0` até 15/07/2026, com o motivo "entra na próxima
 * fase". Era honesto (nada pesquisava a web), mas capava TODO Alvo em 85 e
 * nunca destravava, porque nada nunca preenchia incumbente nem janela. Os
 * Alvos reais do Rodrigo vinham com 27, 29, 33: não era azar, era a fase que
 * faltava. Estes testes travam os três estados do fator.
 */
describe('Janela e incumbente: os três estados', () => {
  const fator = (r: ReturnType<typeof computeMiraScoreV1>) =>
    r.breakdown.fatores.find((f) => f.nome === 'Janela e incumbente')!;

  it('sem pesquisa (descoberta): 0 e o motivo convida a Aprofundar', () => {
    const r = computeMiraScoreV1(PERFIL_VAZIO, CONTA, 0, null);
    expect(fator(r).valor).toBe(0);
    expect(fator(r).motivo).toContain('Aprofundar com IA');
  });

  it('pesquisou e não achou: 0, mas o motivo diz que PROCURAMOS', () => {
    const r = computeMiraScoreV1(PERFIL_VAZIO, CONTA, 0, null, {
      pesquisaRodou: true,
      demandasEvidenciadas: 0,
      incumbentes: 0,
      janela: null,
    });
    expect(fator(r).valor).toBe(0);
    // A diferença entre "não procurei" e "procurei e não achei" é a razão
    // deste fator existir: os dois dão 0, mas só o segundo informa algo.
    expect(fator(r).motivo).toContain('pesquisamos');
    expect(fator(r).motivo).not.toContain('Aprofundar com IA');
  });

  it('janela encontrada pontua e aparece no motivo', () => {
    const r = computeMiraScoreV1(PERFIL_VAZIO, CONTA, 0, null, {
      pesquisaRodou: true,
      demandasEvidenciadas: 0,
      incumbentes: 0,
      janela: 'anunciou expansão de fábrica em julho',
    });
    expect(fator(r).valor).toBeGreaterThan(0);
    expect(fator(r).motivo).toContain('expansão de fábrica');
  });

  it('incumbente identificado pontua', () => {
    const semInc = computeMiraScoreV1(PERFIL_VAZIO, CONTA, 0, null, {
      pesquisaRodou: true,
      demandasEvidenciadas: 0,
      incumbentes: 0,
      janela: null,
    });
    const comInc = computeMiraScoreV1(PERFIL_VAZIO, CONTA, 0, null, {
      pesquisaRodou: true,
      demandasEvidenciadas: 0,
      incumbentes: 1,
      janela: null,
    });
    expect(comInc.score).toBeGreaterThan(semInc.score);
  });

  it('nunca estoura o peso do fator (15), mesmo com janela + incumbentes', () => {
    const r = computeMiraScoreV1(PERFIL_VAZIO, CONTA, 0, null, {
      pesquisaRodou: true,
      demandasEvidenciadas: 2,
      incumbentes: 3,
      janela: 'trocou de diretoria e anunciou investimento',
    });
    expect(fator(r).valor).toBeLessThanOrEqual(15);
  });

  it('o teto de 85 caiu: com evidência, o Alvo pode passar de 85', () => {
    const perfilBom = {
      catalogo: [{ nome: 'Produto' }],
      alvoB2B: { cnaesAlvo: ['4651'], portes: ['ME'], regioes: ['SP'] },
    };
    const semEvidencia = computeMiraScoreV1(perfilBom, CONTA, 3, null);
    const comEvidencia = computeMiraScoreV1(perfilBom, CONTA, 3, null, {
      pesquisaRodou: true,
      demandasEvidenciadas: 2,
      incumbentes: 1,
      janela: 'anunciou expansão',
    });
    expect(semEvidencia.score).toBeLessThanOrEqual(85);
    expect(comEvidencia.score).toBeGreaterThan(semEvidencia.score);
  });
});

describe('Demanda e sinais: evidência vale mais que presunção', () => {
  const fator = (r: ReturnType<typeof computeMiraScoreV1>) =>
    r.breakdown.fatores.find((f) => f.nome === 'Demanda e sinais')!;

  it('demanda evidenciada na web sobe a nota e diz que não é presunção', () => {
    const sem = computeMiraScoreV1(PERFIL_VAZIO, CONTA, 0, null);
    const com = computeMiraScoreV1(PERFIL_VAZIO, CONTA, 0, null, {
      pesquisaRodou: true,
      demandasEvidenciadas: 2,
      incumbentes: 0,
      janela: null,
    });
    expect(com.score).toBeGreaterThan(sem.score);
    expect(fator(com).motivo).toContain('evidência pública');
  });

  it('B2C também: o mesmo fator responde à evidência', () => {
    const place = { nome: 'Clinica X', telefone: '11999999999', site: null, rating: 4.5, totalAvaliacoes: 30 };
    const local = { municipio: 'São Paulo', uf: 'SP' };
    const sem = computeMiraScoreB2C(PERFIL_VAZIO, place, local);
    const com = computeMiraScoreB2C(PERFIL_VAZIO, place, local, {
      pesquisaRodou: true,
      demandasEvidenciadas: 1,
      incumbentes: 1,
      janela: 'abriu segunda unidade',
    });
    expect(com.score).toBeGreaterThan(sem.score);
  });
});
