/**
 * As duas fontes somam na mesma campanha.
 *
 * O Perfil aceita CNAE em código e atividade em texto no mesmo campo (o
 * placeholder convida os dois). Antes era ou/ou: bastando UM código render
 * candidatos, os alvos em texto do cliente não rodavam, calados. Quem
 * declarava "4651-6" e "distribuidoras de TI" perdia metade do que pediu.
 *
 * Estes testes travam: código aciona a base oficial, texto aciona a busca
 * pública, e os dois entram no mesmo conjunto de candidatos.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

const findUniquePerfil = vi.fn();
const findFirstAlvo = vi.fn();
vi.mock('@zappiq/database', () => ({
  prisma: {
    miraPerfil: { findUnique: (...a: any[]) => findUniquePerfil(...a) },
    miraAlvo: { findFirst: (...a: any[]) => findFirstAlvo(...a), create: vi.fn().mockResolvedValue({ id: 'a1' }), update: vi.fn() },
    $queryRawUnsafe: vi.fn().mockResolvedValue([]),
  },
}));
vi.mock('../../utils/logger.js', () => ({ logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() } }));

const buscarCnpjsBigQuery = vi.fn();
vi.mock('./descobertaBigQuery.js', () => ({
  buscarCnpjsBigQuery: (...a: any[]) => buscarCnpjsBigQuery(...a),
  bigQueryDisponivel: () => true,
}));

const webSearch = vi.fn();
const buscaPublicaDisponivel = vi.fn();
vi.mock('./buscaPublica.js', () => ({
  webSearch: (...a: any[]) => webSearch(...a),
  buscaPublicaDisponivel: () => buscaPublicaDisponivel(),
}));

const fetchCnpj = vi.fn();
vi.mock('./cnpj.js', () => ({
  fetchCnpj: (...a: any[]) => fetchCnpj(...a),
  normalizeCnpj: (s: string) => s.replace(/\D/g, '') || null,
  arquetipoFromQualificacao: () => null,
}));
vi.mock('./cagedMirror.js', () => ({ buscarSinalSetorial: vi.fn().mockResolvedValue(null) }));
vi.mock('./score.js', () => ({
  computeMiraScoreV1: () => ({ score: 70, breakdown: { fatores: [] }, confianca: 80 }),
}));
vi.mock('../../middleware/requireMira.js', () => ({
  getMiraEntitlement: vi.fn().mockResolvedValue({ monthKey: '2026-07', quota: { used: 0, total: 10, remaining: 10, blocked: false } }),
  consumeMiraQuota: vi.fn().mockResolvedValue({ used: 1, total: 10, remaining: 9, blocked: false }),
  MiraQuotaExceededError: class extends Error {},
}));

const { runDescobertaPublica } = await import('./descobertaPublica.js');

beforeEach(() => {
  vi.clearAllMocks();
  findUniquePerfil.mockResolvedValue({ prontidao: 90 });
  findFirstAlvo.mockResolvedValue(null);
  buscarCnpjsBigQuery.mockResolvedValue([]);
  webSearch.mockResolvedValue([]);
  buscaPublicaDisponivel.mockReturnValue(true);
  fetchCnpj.mockResolvedValue(null);
});

describe('código de CNAE e atividade em texto convivem', () => {
  it('só código: usa a base oficial e não gasta busca web', async () => {
    buscarCnpjsBigQuery.mockResolvedValue(['11222333000181']);

    const r = await runDescobertaPublica('org-1', { alvos: ['4651-6'], regioes: ['SP'] });

    expect(buscarCnpjsBigQuery).toHaveBeenCalledWith(['46516'], ['SP']);
    expect(webSearch).not.toHaveBeenCalled();
    expect(r.fonte).toBe('bigquery');
  });

  it('só texto: usa a busca pública com a atividade declarada', async () => {
    await runDescobertaPublica('org-1', { alvos: ['distribuidoras de TI'], regioes: ['Campinas'] });

    expect(buscarCnpjsBigQuery).not.toHaveBeenCalled();
    const queries = webSearch.mock.calls.map((c) => c[1]);
    expect(queries.some((q: string) => q.includes('distribuidoras de TI') && q.includes('Campinas'))).toBe(true);
  });

  it('os dois juntos: a base oficial roda E a busca web roda (era ou/ou)', async () => {
    buscarCnpjsBigQuery.mockResolvedValue(['11222333000181']);

    await runDescobertaPublica('org-1', { alvos: ['4651-6', 'distribuidoras de TI'], regioes: ['SP'] });

    // O código foi para a base oficial...
    expect(buscarCnpjsBigQuery).toHaveBeenCalledWith(['46516'], ['SP']);
    // ...e o texto NÃO foi engolido: virou busca.
    const queries = webSearch.mock.calls.map((c) => c[1]);
    expect(queries.some((q: string) => q.includes('distribuidoras de TI'))).toBe(true);
  });

  it('os CNPJs das duas fontes somam no mesmo conjunto de candidatos', async () => {
    buscarCnpjsBigQuery.mockResolvedValue(['11222333000181']);
    webSearch.mockResolvedValue([
      { title: 'Alfa Distribuidora', snippet: 'CNPJ 99.888.777/0001-66', url: 'https://alfa.com.br' },
    ]);

    await runDescobertaPublica('org-1', { alvos: ['4651-6', 'distribuidoras de TI'], regioes: [] });

    const verificados = fetchCnpj.mock.calls.map((c) => c[1]);
    expect(verificados).toContain('11222333000181'); // veio da base oficial
    expect(verificados).toContain('99888777000166'); // veio do snippet da web
  });

  it('todos os alvos em texto (o caso da MACHIA): a busca roda com cada um', async () => {
    await runDescobertaPublica('org-1', {
      alvos: ['serviços', 'comércio varejista'],
      regioes: ['Brasil'],
    });

    const queries = webSearch.mock.calls.map((c) => c[1]);
    expect(queries.some((q: string) => q.includes('serviços'))).toBe(true);
    expect(queries.some((q: string) => q.includes('comércio varejista'))).toBe(true);
  });

  it('sem provedor de busca, o código ainda salva a campanha em vez de 501', async () => {
    buscaPublicaDisponivel.mockReturnValue(false);
    buscarCnpjsBigQuery.mockResolvedValue(['11222333000181']);

    const r = await runDescobertaPublica('org-1', { alvos: ['4651-6', 'distribuidoras de TI'], regioes: [] });

    expect(r.fonte).toBe('bigquery');
    expect(webSearch).not.toHaveBeenCalled();
  });

  it('sem provedor de busca e só texto: 501 honesto (nada tem fonte)', async () => {
    buscaPublicaDisponivel.mockReturnValue(false);
    await expect(runDescobertaPublica('org-1', { alvos: ['serviços'], regioes: [] })).rejects.toMatchObject({
      status: 501,
    });
  });

  it('código que não rende candidato e nenhum texto: 422 em vez de campanha vazia sem explicação', async () => {
    buscarCnpjsBigQuery.mockResolvedValue([]);
    await expect(runDescobertaPublica('org-1', { alvos: ['9999-9'], regioes: [] })).rejects.toMatchObject({
      status: 422,
    });
  });

  it('gate de prontidão continua de pé', async () => {
    findUniquePerfil.mockResolvedValue({ prontidao: 50 });
    await expect(runDescobertaPublica('org-1', { alvos: ['4651-6'], regioes: [] })).rejects.toMatchObject({
      status: 412,
    });
  });
});
