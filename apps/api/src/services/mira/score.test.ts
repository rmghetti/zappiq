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
