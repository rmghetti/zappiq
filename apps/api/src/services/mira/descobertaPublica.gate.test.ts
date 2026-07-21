/**
 * Alvo cru não sobe.
 *
 * Pedido do Rodrigo (15/07/2026): "precisamos garantir que o Alvo nem suba
 * para a campanha se já na pesquisa tiver apenas informação do nome da empresa
 * (que é o que tem vindo em muitos casos). Isso compromete a qualidade do Mira
 * e cria uma visão negativa do cliente com relação à entrega."
 *
 * O diagnóstico em produção deu razão a ele: 11 dos 20 Alvos da MACHIA sem
 * decisor nenhum, score 9 a 13, todos parados em QUALIFYING. O gate já exigia
 * 1 decisor, mas só decidia PROMOÇÃO: o reprovado era criado assim mesmo e
 * ficava na base.
 *
 * A ordem destes testes é a ordem do desenho: PERSISTIR primeiro (o titular do
 * Empresário Individual), BARRAR só o que sobrar. Barrar sem enriquecer
 * trocaria "Alvo ruim" por "campanha vazia".
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

const findUniquePerfil = vi.fn();
const findFirstAlvo = vi.fn();
const createAlvo = vi.fn();
vi.mock('@zappiq/database', () => ({
  prisma: {
    miraPerfil: { findUnique: (...a: any[]) => findUniquePerfil(...a) },
    miraAlvo: { findFirst: (...a: any[]) => findFirstAlvo(...a), create: (...a: any[]) => createAlvo(...a), update: vi.fn() },
    $queryRawUnsafe: vi.fn().mockResolvedValue([]),
  },
}));
vi.mock('../../utils/logger.js', () => ({ logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() } }));

const buscarCnpjsBigQuery = vi.fn();
const enriquecerCnpjsBigQuery = vi.fn();
vi.mock('./descobertaBigQuery.js', () => ({
  buscarCnpjsBigQuery: (...a: any[]) => buscarCnpjsBigQuery(...a),
  enriquecerCnpjsBigQuery: (...a: any[]) => enriquecerCnpjsBigQuery(...a),
}));

const webSearch = vi.fn();
vi.mock('./buscaPublica.js', () => ({
  webSearch: (...a: any[]) => webSearch(...a),
  buscaPublicaDisponivel: () => true,
}));

const fetchCnpj = vi.fn();
// `titularDoRegistro` roda de verdade: é o coração da persistência.
vi.mock('./cnpj.js', async (importOriginal) => ({
  ...(await importOriginal<typeof import('./cnpj.js')>()),
  fetchCnpj: (...a: any[]) => fetchCnpj(...a),
  normalizeCnpj: (s: string) => s.replace(/\D/g, '') || null,
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

/** Registro do espelho no formato que `enriquecerCnpjsBigQuery` devolve. */
function doEspelho(over: Partial<any> = {}) {
  return {
    cnpj: '11222333000181',
    razaoSocial: 'METALURGICA EXEMPLO LTDA',
    nomeFantasia: null,
    cnae: '2451200',
    uf: 'SP',
    idMunicipio: '3504107',
    municipio: 'Atibaia',
    cnaeDescricao: 'Fundição de ferro e aço',
    dataInicioAtividade: '2010-01-01',
    telefone: '1144117333',
    capitalSocial: 100000,
    porte: '5',
    naturezaJuridica: '2062',
    qsa: [{ nome: 'ANA COSTA', qualificacao: 'Sócia-Administradora' }],
    ...over,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  findUniquePerfil.mockResolvedValue({ prontidao: 90 });
  findFirstAlvo.mockResolvedValue(null);
  createAlvo.mockResolvedValue({ id: 'a1' });
  webSearch.mockResolvedValue([]);
  fetchCnpj.mockResolvedValue(null);
  buscarCnpjsBigQuery.mockResolvedValue(['11222333000181']);
});

describe('recorte de porte/faturamento: empresa fora do tamanho pedido não sobe', () => {
  it('cliente pediu faturamento acima de R$ 10M: MICRO (porte 01) não vira Alvo nem gasta cota', async () => {
    findUniquePerfil.mockResolvedValue({ prontidao: 90, alvoB2B: { faturamentoAnual: 'R$ 10M+' } });
    enriquecerCnpjsBigQuery.mockResolvedValue(new Map([['11222333000181', doEspelho({ porte: '01' })]]));

    const r = await runDescobertaPublica('org-1', { alvos: ['2451-2'], regioes: ['SP'] });

    expect(createAlvo).not.toHaveBeenCalled();
    expect(r.criados).toBe(0);
    expect(r.descartadosPorPorte).toBe(1);
    // Honestidade: a empresa foi verificada, nós é que a recusamos pelo porte.
    expect(r.cnpjsVerificados).toBe(1);
    expect(r.avisos?.some((a) => a.includes('porte'))).toBe(true);
  });

  it('cliente pediu faturamento acima de R$ 10M: DEMAIS (porte 05) vira Alvo normalmente', async () => {
    findUniquePerfil.mockResolvedValue({ prontidao: 90, alvoB2B: { faturamentoAnual: 'R$ 10M+' } });
    enriquecerCnpjsBigQuery.mockResolvedValue(new Map([['11222333000181', doEspelho({ porte: '05' })]]));

    const r = await runDescobertaPublica('org-1', { alvos: ['2451-2'], regioes: ['SP'] });

    expect(r.criados).toBe(1);
    expect(r.descartadosPorPorte).toBe(0);
  });

  it('sem recorte de tamanho no Perfil, porte não filtra (nenhuma regressão)', async () => {
    findUniquePerfil.mockResolvedValue({ prontidao: 90 }); // sem portes nem faturamento
    enriquecerCnpjsBigQuery.mockResolvedValue(new Map([['11222333000181', doEspelho({ porte: '01' })]]));

    const r = await runDescobertaPublica('org-1', { alvos: ['2451-2'], regioes: ['SP'] });

    expect(r.criados).toBe(1);
    expect(r.descartadosPorPorte).toBe(0);
  });

  it('ICP de porte PEQUENO não prioriza maiores por capital (senão o lote de 10 viria 100% descartável e a campanha zeraria)', async () => {
    // Achado convergente de DUAS revisões adversariais: ORDER BY capital DESC
    // incondicional + slice(0, MAX_CNPJS) + filtro de porte = campanha zerada
    // para quem pede "ME, EPP" (o exemplo do próprio placeholder da tela).
    findUniquePerfil.mockResolvedValue({ prontidao: 90, alvoB2B: { portes: ['ME', 'EPP'] } });
    enriquecerCnpjsBigQuery.mockResolvedValue(new Map([['11222333000181', doEspelho({ porte: '01' })]]));

    const r = await runDescobertaPublica('org-1', { alvos: ['2451-2'], regioes: ['SP'] });

    expect(buscarCnpjsBigQuery).toHaveBeenCalledWith(expect.any(Array), expect.any(Array), { priorizarMaiores: false });
    expect(r.criados).toBe(1); // a MICRO passa no recorte {MICRO, PEQUENO}
    expect(r.descartadosPorPorte).toBe(0);
  });

  it('pedido de porte grande prioriza maiores por capital (o caso do cliente de R$ 10M+)', async () => {
    findUniquePerfil.mockResolvedValue({ prontidao: 90, alvoB2B: { faturamentoAnual: 'R$ 10M+' } });
    enriquecerCnpjsBigQuery.mockResolvedValue(new Map([['11222333000181', doEspelho({ porte: '05' })]]));

    await runDescobertaPublica('org-1', { alvos: ['2451-2'], regioes: ['SP'] });

    expect(buscarCnpjsBigQuery).toHaveBeenCalledWith(expect.any(Array), expect.any(Array), { priorizarMaiores: true });
  });

  it('descarte por porte + erro de verificação em OUTRO CNPJ não vira "verificacao_falhou" (a campanha explica, não explode)', async () => {
    findUniquePerfil.mockResolvedValue({ prontidao: 90, alvoB2B: { faturamentoAnual: 'R$ 10M+' } });
    buscarCnpjsBigQuery.mockResolvedValue(['11222333000181', '99888777000166']);
    enriquecerCnpjsBigQuery.mockResolvedValue(new Map([['11222333000181', doEspelho({ porte: '01' })]]));
    fetchCnpj.mockRejectedValue(new Error('brasilapi_403')); // o 2º CNPJ cai na BrasilAPI e falha

    const r = await runDescobertaPublica('org-1', { alvos: ['2451-2'], regioes: ['SP'] });

    expect(r.descartadosPorPorte).toBe(1);
    expect(r.criados).toBe(0);
  });
});

describe('o Alvo com decisor sobe, como sempre', () => {
  it('LTDA com sócio no QSA vira Alvo READY', async () => {
    enriquecerCnpjsBigQuery.mockResolvedValue(new Map([['11222333000181', doEspelho()]]));

    const r = await runDescobertaPublica('org-1', { alvos: ['2451-2'], regioes: ['SP'] });

    expect(r.criados).toBe(1);
    expect(r.prontos).toBe(1);
    expect(r.descartadosCrus).toBe(0);
    expect(createAlvo).toHaveBeenCalledTimes(1);
    // A sócia-administradora (ECONOMIC_BUYER) é marcada como provável champion:
    // a coroa da UI, que nunca era escrita pelo backend, passa a aparecer.
    const decisorCriado = createAlvo.mock.calls[0][0].data.decisores.create[0];
    expect(decisorCriado.isChampion).toBe(true);
  });
});

describe('PERSISTIR: o Empresário Individual é recuperado antes de qualquer descarte', () => {
  it('EI sem QSA vira Alvo com o titular como decisor (o caso dos 8 em produção)', async () => {
    enriquecerCnpjsBigQuery.mockResolvedValue(
      new Map([
        [
          '11222333000181',
          doEspelho({
            razaoSocial: 'GISLAINE RODRIGUES DOS SANTOS BERSAN ARARAS',
            naturezaJuridica: '2135', // Empresário Individual: sem sócio POR LEI
            municipio: 'Araras',
            qsa: [],
          }),
        ],
      ])
    );

    const r = await runDescobertaPublica('org-1', { alvos: ['2451-2'], regioes: ['SP'] });

    // NÃO foi descartado: o titular estava no nome o tempo todo.
    expect(r.descartadosCrus).toBe(0);
    expect(r.criados).toBe(1);

    const decisores = createAlvo.mock.calls[0][0].data.decisores.create;
    expect(decisores).toHaveLength(1);
    expect(decisores[0].nome).toBe('GISLAINE RODRIGUES DOS SANTOS BERSAN'); // sufixo de município fora
    expect(decisores[0].papel).toBe('Empresário Individual');
  });
});

describe('BARRAR: o que sobra cru não sobe', () => {
  it('LTDA sem sócio nenhum NÃO vira Alvo (a Receita não tem, e não dá para inventar)', async () => {
    enriquecerCnpjsBigQuery.mockResolvedValue(
      new Map([
        [
          '11222333000181',
          doEspelho({
            razaoSocial: 'KRAMEPY INDUSTRIA E COMERCIO DE LIGAS LIMITADA',
            naturezaJuridica: '2062', // LTDA: tem sócio por definição, mas a fonte não tem
            qsa: [],
          }),
        ],
      ])
    );

    const r = await runDescobertaPublica('org-1', { alvos: ['2451-2'], regioes: ['SP'] });

    expect(createAlvo).not.toHaveBeenCalled();
    expect(r.criados).toBe(0);
    expect(r.prontos).toBe(0);
    // Honestidade: a busca ACHOU a empresa, nós é que a recusamos.
    expect(r.descartadosCrus).toBe(1);
  });

  it('empresa BAIXADA não sobe (filtro de situação, que já existia antes deste gate)', async () => {
    // "empresas PME" é porte, não ramo: não traduz para CNAE, então vai para a
    // busca web e o CNPJ sai do snippet, caindo na BrasilAPI (fonte reserva).
    buscarCnpjsBigQuery.mockResolvedValue([]);
    enriquecerCnpjsBigQuery.mockResolvedValue(new Map());
    webSearch.mockResolvedValue([{ title: 'x', url: 'https://x.com.br', snippet: 'CNPJ 11.222.333/0001-81' }]);
    fetchCnpj.mockResolvedValue({
      cnpj: '11222333000181',
      razaoSocial: 'EMPRESA BAIXADA LTDA',
      nomeFantasia: null,
      cnae: '2451200',
      cnaeDescricao: 'Fundição',
      porte: '5',
      capitalSocial: 1,
      naturezaJuridica: '2062',
      situacaoCadastral: 'BAIXADA',
      municipio: 'Atibaia',
      uf: 'SP',
      telefone: null,
      dataInicioAtividade: null,
      optanteSimples: null,
      qsa: [{ nome: 'ANA COSTA', qualificacao: 'Sócia' }],
      fonteUrl: 'brasilapi',
    });

    const r = await runDescobertaPublica('org-1', { alvos: ['empresas PME'], regioes: ['SP'] });

    expect(createAlvo).not.toHaveBeenCalled();
    // Não conta como "cru": empresa baixada é barrada antes, pelo filtro de
    // situação cadastral, e nem chega a ser verificada. `descartadosCrus` é
    // só para quem ESTÁ ativa e mesmo assim não tem decisor.
    expect(r.cnpjsVerificados).toBe(0);
    expect(r.descartadosCrus).toBe(0);
  });

  it('o "candidato" de só nome NUNCA mais vira Alvo', async () => {
    // Este era o pior ofensor: nascia do TÍTULO de um resultado de busca, sem
    // CNPJ, sem decisor, confiança 40, e nada nunca o promovia.
    buscarCnpjsBigQuery.mockResolvedValue([]);
    enriquecerCnpjsBigQuery.mockResolvedValue(new Map());
    webSearch.mockResolvedValue([
      { title: 'Metalúrgica Fulano', url: 'https://metalurgicafulano.com.br', snippet: 'A melhor da região' },
      { title: 'Metalúrgica Beltrano', url: 'https://beltrano.com.br', snippet: 'Desde 1980' },
    ]);

    const r = await runDescobertaPublica('org-1', { alvos: ['empresas PME'], regioes: ['SP'] });

    expect(createAlvo).not.toHaveBeenCalled();
    expect(r.criados).toBe(0);
    expect(r.candidatos).toBe(0);
    expect(r.descartadosSoNome).toBe(2); // achou 2, recusou 2, e conta
  });
});
