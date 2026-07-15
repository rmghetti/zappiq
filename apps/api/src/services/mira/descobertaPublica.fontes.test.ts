/**
 * As duas fontes somam na mesma campanha.
 *
 * Regra atual, depois da campanha 1 de teste do Rodrigo ter voltado com zero:
 *
 *  1. Código de CNAE -> base oficial de CNPJs.
 *  2. Atividade escrita que a gente sabe traduzir -> TAMBÉM base oficial (via
 *     cnaeMapa). É a fonte boa: 28M empresas, dado da Receita, sem depender de
 *     provedor externo.
 *  3. Só o que não traduz (ex.: "empresas PME", que é porte e não ramo) sobra
 *     para a busca pública.
 *  4. Fonte que QUEBRA não vira "0 resultados": estoura 502 e a campanha fica
 *     FALHOU com o motivo.
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
const enriquecerCnpjsBigQuery = vi.fn();
vi.mock('./descobertaBigQuery.js', () => ({
  buscarCnpjsBigQuery: (...a: any[]) => buscarCnpjsBigQuery(...a),
  enriquecerCnpjsBigQuery: (...a: any[]) => enriquecerCnpjsBigQuery(...a),
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
  enriquecerCnpjsBigQuery.mockResolvedValue(new Map());
  webSearch.mockResolvedValue([]);
  buscaPublicaDisponivel.mockReturnValue(true);
  fetchCnpj.mockResolvedValue(null);
});

describe('cada alvo vai para a fonte certa', () => {
  it('código de CNAE: base oficial, sem gastar busca web', async () => {
    buscarCnpjsBigQuery.mockResolvedValue(['11222333000181']);

    const r = await runDescobertaPublica('org-1', { alvos: ['4651-6'], regioes: ['SP'] });

    expect(buscarCnpjsBigQuery).toHaveBeenCalledWith(['46516'], ['SP']);
    expect(webSearch).not.toHaveBeenCalled();
    expect(r.fonte).toBe('bigquery');
  });

  it('atividade escrita que traduz vai para a base oficial, não para a web', async () => {
    buscarCnpjsBigQuery.mockResolvedValue(['11222333000181']);

    await runDescobertaPublica('org-1', { alvos: ['distribuidoras de TI'], regioes: ['SP'] });

    // "distribuidoras" é comércio atacadista = divisão 46.
    expect(buscarCnpjsBigQuery).toHaveBeenCalledWith(['46'], ['SP']);
    expect(webSearch).not.toHaveBeenCalled();
  });

  it('o caso real da MACHIA: 5 alvos escritos passam a acionar a base de 28M', async () => {
    buscarCnpjsBigQuery.mockResolvedValue(['11222333000181']);

    const r = await runDescobertaPublica('org-1', {
      alvos: ['serviços', 'comércio varejista', 'industria', 'todos as verticais de serviços', 'empresas PME'],
      regioes: ['Brasil'],
    });

    // Antes: codigos=[] -> BigQuery nem era chamado -> tudo dependia da web (403) -> 0 alvos.
    const divisoes = buscarCnpjsBigQuery.mock.calls[0][0];
    expect(divisoes).toContain('47'); // comércio varejista
    expect(divisoes).toContain('10'); // indústria
    expect(divisoes).toContain('62'); // serviços (TI)
    expect(r.fonte).toBe('bigquery');
  });

  it('só o que não traduz sobra para a busca pública', async () => {
    buscarCnpjsBigQuery.mockResolvedValue(['11222333000181']);

    await runDescobertaPublica('org-1', { alvos: ['comércio varejista', 'xpto artesanal'], regioes: [] });

    // O que traduz foi para a base oficial...
    expect(buscarCnpjsBigQuery).toHaveBeenCalledWith(['47'], []);
    // ...e só o intraduzível virou busca.
    const queries = webSearch.mock.calls.map((c) => c[1]);
    expect(queries.every((q: string) => q.includes('xpto artesanal'))).toBe(true);
    expect(queries.some((q: string) => q.includes('varejista'))).toBe(false);
  });

  it('os CNPJs das duas fontes somam no mesmo conjunto', async () => {
    buscarCnpjsBigQuery.mockResolvedValue(['11222333000181']);
    webSearch.mockResolvedValue([
      { title: 'Alfa Ltda', snippet: 'CNPJ 99.888.777/0001-66', url: 'https://alfa.com.br' },
    ]);

    await runDescobertaPublica('org-1', { alvos: ['comércio varejista', 'xpto artesanal'], regioes: [] });

    const verificados = fetchCnpj.mock.calls.map((c) => c[1]);
    expect(verificados).toContain('11222333000181'); // base oficial
    expect(verificados).toContain('99888777000166'); // snippet da web
  });
});

describe('fonte quebrada nunca vira campanha vazia', () => {
  it('busca com erro e nada da base: 502 com o motivo, não 0 alvos calado', async () => {
    // Exatamente a campanha 1 de teste: google_cse_403 nas 3 buscas.
    const erro: any = new Error('google_cse_403');
    erro.detail = 'This project does not have the access to Custom Search JSON API.';
    webSearch.mockRejectedValue(erro);

    await expect(runDescobertaPublica('org-1', { alvos: ['xpto artesanal'], regioes: [] })).rejects.toMatchObject({
      status: 502,
      message: 'fonte_falhou',
    });
  });

  it('busca com erro mas a base oficial trouxe: campanha segue, com aviso', async () => {
    buscarCnpjsBigQuery.mockResolvedValue(['11222333000181']);
    webSearch.mockRejectedValue(new Error('google_cse_403'));

    const r = await runDescobertaPublica('org-1', { alvos: ['comércio varejista', 'xpto artesanal'], regioes: [] });

    expect(r.fonte).toBe('bigquery');
    expect(r.avisos?.[0]).toContain('busca pública falhou');
  });

  it('sem provedor de busca e só alvo intraduzível: 501 honesto', async () => {
    buscaPublicaDisponivel.mockReturnValue(false);
    await expect(runDescobertaPublica('org-1', { alvos: ['xpto artesanal'], regioes: [] })).rejects.toMatchObject({
      status: 501,
    });
  });

  it('gate de prontidão continua de pé', async () => {
    findUniquePerfil.mockResolvedValue({ prontidao: 50 });
    await expect(runDescobertaPublica('org-1', { alvos: ['4651-6'], regioes: [] })).rejects.toMatchObject({
      status: 412,
    });
  });
});

describe('verificação sem BrasilAPI (o 403 que zerava tudo)', () => {
  const doEspelho = (cnpj: string) => ({
    cnpj,
    razaoSocial: 'METALURGICA ACME LTDA',
    nomeFantasia: 'ACME',
    cnae: '2599301',
    uf: 'SP',
    idMunicipio: '3550308',
    dataInicioAtividade: '2015-03-01',
    telefone: '1140028922',
    capitalSocial: 500000,
    porte: '03',
    naturezaJuridica: '2062',
    qsa: [{ nome: 'Maria Silva', qualificacao: '49' }],
  });

  it('o espelho enriquece e a BrasilAPI nem é chamada', async () => {
    buscarCnpjsBigQuery.mockResolvedValue(['11222333000181']);
    enriquecerCnpjsBigQuery.mockResolvedValue(new Map([['11222333000181', doEspelho('11222333000181')]]));

    const r = await runDescobertaPublica('org-1', { alvos: ['indústrias metalúrgicas'], regioes: ['SP'] });

    expect(fetchCnpj).not.toHaveBeenCalled(); // era aqui que o 403 matava a campanha
    expect(r.cnpjsVerificados).toBe(1);
    expect(r.criados).toBe(1);
  });

  it('espelho antigo (sem as colunas novas): cai na BrasilAPI como reserva', async () => {
    buscarCnpjsBigQuery.mockResolvedValue(['11222333000181']);
    enriquecerCnpjsBigQuery.mockResolvedValue(new Map()); // materialização antiga
    fetchCnpj.mockResolvedValue({
      cnpj: '11222333000181', razaoSocial: 'ACME', nomeFantasia: null, cnae: '2599301', cnaeDescricao: null,
      porte: null, capitalSocial: null, naturezaJuridica: null, situacaoCadastral: 'ATIVA', municipio: 'São Paulo',
      uf: 'SP', telefone: null, dataInicioAtividade: null, optanteSimples: null,
      qsa: [{ nome: 'Maria', qualificacao: '49' }], fonteUrl: 'x',
    });

    const r = await runDescobertaPublica('org-1', { alvos: ['indústrias metalúrgicas'], regioes: ['SP'] });

    expect(fetchCnpj).toHaveBeenCalled();
    expect(r.cnpjsVerificados).toBe(1);
  });

  it('candidatos achados e verificação quebrada: 502, não 0 calado', async () => {
    // Exatamente a campanha "Teste real": 300 candidatos, 0 verificados.
    buscarCnpjsBigQuery.mockResolvedValue(['11222333000181']);
    enriquecerCnpjsBigQuery.mockResolvedValue(new Map());
    fetchCnpj.mockRejectedValue(new Error('brasilapi_status_403'));

    await expect(
      runDescobertaPublica('org-1', { alvos: ['indústrias metalúrgicas'], regioes: ['SP'] })
    ).rejects.toMatchObject({ status: 502, message: 'verificacao_falhou' });
  });
});
