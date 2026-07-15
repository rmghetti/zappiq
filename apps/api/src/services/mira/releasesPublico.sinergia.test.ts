/**
 * Releases viram inteligência acionável: a matéria traz a fonte, a data real
 * de publicação, e o que ela EVIDENCIA (demanda) e ABRE (oportunidade no
 * catálogo). Pedido do Rodrigo em 15/07/2026:
 *
 *   "trazer as últimas matérias/anúncios publicados na internet e junto o link
 *    da fonte. Melhor ainda se analisar o que essa publicação teria de
 *    sinergia com os produtos do nosso cliente e isso gerar uma demanda
 *    recente e/ou Oportunidade no portfólio."
 *
 * Até aqui o release era título + link. O LLM já devolvia material para mais
 * que isso; a gente é que só gravava a casca.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

const prismaMock = {
  miraRelease: { findFirst: vi.fn(), create: vi.fn() },
  miraDemanda: { upsert: vi.fn() },
  miraOportunidade: { upsert: vi.fn() },
};

vi.mock('@zappiq/database', () => ({ prisma: prismaMock }));
vi.mock('../../utils/logger.js', () => ({ logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() } }));
vi.mock('../llm/LLMRouter.js', () => ({ llmRouter: { complete: vi.fn() } }));
vi.mock('./buscaPublica.js', () => ({ webSearch: vi.fn(), buscaPublicaDisponivel: vi.fn(() => true) }));

const { pesquisarPegadaPublica, persistirReleaseDrafts, verificarDataPublicacao, confiancaDaFonte, hashUrl } =
  await import('./releasesPublico.js');
const { webSearch } = await import('./buscaPublica.js');
const { llmRouter } = await import('../llm/LLMRouter.js');

const ALVO = { id: 'alvo1', nome: 'Metalúrgica Exemplo LTDA', nomeFantasia: 'Metalex', municipio: 'Sorocaba', uf: 'SP' };
const CATALOGO = [{ nome: 'Esteira transportadora' }, { nome: 'Manutenção preditiva' }];

beforeEach(() => {
  vi.clearAllMocks();
  prismaMock.miraRelease.findFirst.mockResolvedValue(null); // nada duplicado
  prismaMock.miraRelease.create.mockResolvedValue({ id: 'rel1' });
  prismaMock.miraDemanda.upsert.mockImplementation(({ create }: any) => Promise.resolve({ id: create.id }));
  prismaMock.miraOportunidade.upsert.mockResolvedValue({ id: 'op1' });
});

/** Resposta do LLM no formato que o prompt pede. */
function respostaLlm(releases: any[], extras: any = {}) {
  return {
    text: JSON.stringify({ releases, incumbentes: [], demandas: [], janela: null, ...extras }),
  };
}

describe('verificarDataPublicacao: data inventada nunca entra no dossiê', () => {
  const agora = new Date('2026-07-15T12:00:00.000Z');

  it('aceita data ISO real e passada', () => {
    expect(verificarDataPublicacao('2026-06-12', agora)?.toISOString().slice(0, 10)).toBe('2026-06-12');
  });

  it('recusa data no futuro (não existe notícia de amanhã)', () => {
    expect(verificarDataPublicacao('2026-09-01', agora)).toBeNull();
  });

  it('recusa data velha demais para ser novidade (> 5 anos)', () => {
    expect(verificarDataPublicacao('2015-01-01', agora)).toBeNull();
  });

  it('recusa formato livre: "12/06" não vira mês errado', () => {
    expect(verificarDataPublicacao('12/06/2026', agora)).toBeNull();
    expect(verificarDataPublicacao('junho de 2026', agora)).toBeNull();
  });

  it('recusa null, string vazia e não-string', () => {
    expect(verificarDataPublicacao(null, agora)).toBeNull();
    expect(verificarDataPublicacao('null', agora)).toBeNull();
    expect(verificarDataPublicacao('', agora)).toBeNull();
    expect(verificarDataPublicacao(20260612, agora)).toBeNull();
  });
});

describe('confiancaDaFonte: a conta falando de si vale menos que a imprensa', () => {
  it('post da própria conta (LinkedIn/Instagram) = 60, mesmo com data', () => {
    expect(confiancaDaFonte('https://www.instagram.com/p/xyz', true)).toBe(60);
    expect(confiancaDaFonte('https://www.linkedin.com/posts/abc', true)).toBe(60);
  });

  it('matéria de terceiro com data verificada = 75', () => {
    expect(confiancaDaFonte('https://exame.com/negocios/metalex-investe', true)).toBe(75);
  });

  it('matéria de terceiro sem data = 65 (vale menos que a datada)', () => {
    expect(confiancaDaFonte('https://exame.com/negocios/metalex-investe', false)).toBe(65);
  });

  it('nunca chega em 90: esse patamar é do registro oficial da Receita', () => {
    for (const url of ['https://exame.com/x', 'https://instagram.com/p/y', 'https://qualquer.site/z']) {
      for (const data of [true, false]) expect(confiancaDaFonte(url, data)).toBeLessThan(90);
    }
  });
});

describe('a matéria vira demanda e oportunidade, com a fonte junto', () => {
  it('extrai data, demanda e oportunidade do fato publicado', async () => {
    (webSearch as any).mockResolvedValue([
      {
        title: 'Metalex anuncia nova unidade em Sorocaba',
        url: 'https://exame.com/negocios/metalex-nova-unidade',
        snippet: 'A Metalex anunciou em 12/06/2026 a construção de uma unidade que dobra a capacidade produtiva.',
      },
    ]);
    (llmRouter.complete as any).mockResolvedValue(
      respostaLlm([
        {
          fonteIndice: 1,
          titulo: 'Nova unidade em Sorocaba',
          resumo: 'A empresa anunciou uma unidade que dobra a capacidade produtiva.',
          dataPublicacao: '2026-06-12',
          relevancia: 'Unidade nova precisa equipar linha de produção do zero.',
          angulo: 'Fale agora, antes de a linha ser especificada.',
          produtoRelacionado: 'Esteira transportadora',
          demandaGerada: 'Equipar a linha de produção da unidade nova.',
          oportunidade: { produto: 'Esteira transportadora', racional: 'Linha nova precisa de transporte interno.' },
        },
      ])
    );

    const r = await pesquisarPegadaPublica('org1', ALVO, CATALOGO);

    expect(r.releases).toHaveLength(1);
    const rel = r.releases[0];
    expect(rel.url).toBe('https://exame.com/negocios/metalex-nova-unidade'); // o link da fonte
    expect(rel.dataPublicacao?.toISOString().slice(0, 10)).toBe('2026-06-12');
    expect(rel.demandaGerada).toContain('Equipar a linha');
    expect(rel.oportunidade).toEqual({
      produto: 'Esteira transportadora',
      racional: 'Linha nova precisa de transporte interno.',
    });
    expect(rel.confianca).toBe(75); // imprensa + data verificada
  });

  it('oportunidade com produto FORA do catálogo é descartada (não inventa linha de produto)', async () => {
    (webSearch as any).mockResolvedValue([
      { title: 'Metalex cresce', url: 'https://exame.com/metalex', snippet: 'A Metalex cresceu 30% no ano.' },
    ]);
    (llmRouter.complete as any).mockResolvedValue(
      respostaLlm([
        {
          fonteIndice: 1,
          titulo: 'Crescimento de 30%',
          resumo: 'A empresa cresceu 30% no último ano segundo a matéria.',
          dataPublicacao: null,
          relevancia: 'Crescimento puxa investimento em capacidade.',
          angulo: 'Use o crescimento como gancho.',
          produtoRelacionado: null,
          demandaGerada: 'Ampliar capacidade para sustentar o crescimento.',
          // "Consultoria tributária" NÃO está no catálogo do cliente
          oportunidade: { produto: 'Consultoria tributária', racional: 'Crescimento gera complexidade fiscal.' },
        },
      ])
    );

    const r = await pesquisarPegadaPublica('org1', ALVO, CATALOGO);

    expect(r.releases).toHaveLength(1);
    expect(r.releases[0].oportunidade).toBeNull(); // o verificador barrou
    expect(r.releases[0].demandaGerada).toContain('Ampliar capacidade'); // a demanda sobrevive
  });

  it('release sem fonte real (fonteIndice inválido) não entra, com sinergia ou sem', async () => {
    (webSearch as any).mockResolvedValue([
      { title: 'Metalex', url: 'https://exame.com/metalex', snippet: 'Texto qualquer sobre a Metalex.' },
    ]);
    (llmRouter.complete as any).mockResolvedValue(
      respostaLlm([
        {
          fonteIndice: 99, // não existe
          titulo: 'Fato inventado',
          resumo: 'Um fato que nenhuma fonte sustenta, mas com sinergia linda.',
          demandaGerada: 'Demanda linda que ninguém publicou.',
          oportunidade: { produto: 'Esteira transportadora', racional: 'Racional lindo.' },
        },
      ])
    );

    const r = await pesquisarPegadaPublica('org1', ALVO, CATALOGO);
    expect(r.releases).toHaveLength(0);
  });

  it('busca no Instagram entra nas queries (pedido explícito do Rodrigo)', async () => {
    (webSearch as any).mockResolvedValue([]);
    (llmRouter.complete as any).mockResolvedValue(respostaLlm([]));

    await pesquisarPegadaPublica('org1', ALVO, CATALOGO);

    const queries = (webSearch as any).mock.calls.map((c: any[]) => c[1]);
    expect(queries.some((q: string) => q.includes('instagram.com'))).toBe(true);
    expect(queries.some((q: string) => q.includes('linkedin.com'))).toBe(true);
  });

  it('post do Instagram ganha prefixo no título (o vendedor sabe de onde veio)', async () => {
    (webSearch as any).mockResolvedValue([
      {
        title: 'Metalex no Instagram',
        url: 'https://www.instagram.com/p/abc123',
        snippet: 'Inauguramos nosso novo galpão nesta semana!',
      },
    ]);
    (llmRouter.complete as any).mockResolvedValue(
      respostaLlm([
        {
          fonteIndice: 1,
          titulo: 'Novo galpão inaugurado',
          resumo: 'A conta publicou a inauguração de um galpão novo.',
          dataPublicacao: null,
          relevancia: 'Galpão novo precisa de equipamento.',
          angulo: 'Parabenize e ofereça.',
          produtoRelacionado: null,
          demandaGerada: null,
          oportunidade: null,
        },
      ])
    );

    const r = await pesquisarPegadaPublica('org1', ALVO, CATALOGO);
    expect(r.releases[0].titulo.startsWith('Instagram: ')).toBe(true);
    expect(r.releases[0].confianca).toBe(60); // a conta falando de si
  });
});

describe('persistirReleaseDrafts: a demanda e a oportunidade ficam LIGADAS à matéria', () => {
  const draftCompleto = {
    titulo: 'Nova unidade em Sorocaba',
    resumo: 'A empresa anunciou uma unidade que dobra a capacidade.',
    url: 'https://exame.com/negocios/metalex-nova-unidade',
    relevancia: 'Unidade nova precisa equipar linha.',
    anguloAbordagem: 'Fale antes da especificação.',
    produtoRelacionado: 'Esteira transportadora',
    confianca: 75,
    dataPublicacao: new Date('2026-06-12T12:00:00.000Z'),
    demandaGerada: 'Equipar a linha de produção da unidade nova.',
    oportunidade: { produto: 'Esteira transportadora', racional: 'Linha nova precisa de transporte interno.' },
  };

  it('cria demanda, oportunidade e liga o release à demanda por FK', async () => {
    const r = await persistirReleaseDrafts('org1', 'alvo1', [draftCompleto]);

    expect(r).toEqual({ criados: 1, demandasCriadas: 1, oportunidadesCriadas: 1 });

    // A demanda guarda a fonte e a data REAL da publicação (não a de hoje)
    const dem = prismaMock.miraDemanda.upsert.mock.calls[0][0];
    expect(dem.create.fonte).toBe(draftCompleto.url);
    expect(dem.create.dataFonte).toEqual(new Date('2026-06-12T12:00:00.000Z'));
    expect(dem.create.confianca).toBe(75);

    // O release aponta para a demanda criada
    const rel = prismaMock.miraRelease.create.mock.calls[0][0];
    expect(rel.data.demandaId).toBe(dem.create.id);
    expect(rel.data.dataPublicacao).toEqual(new Date('2026-06-12T12:00:00.000Z'));
    expect(rel.data.url).toBe(draftCompleto.url);

    // A oportunidade nasce com origem RELEASE e carrega a fonte
    const op = prismaMock.miraOportunidade.upsert.mock.calls[0][0];
    expect(op.create.origem).toBe('RELEASE');
    expect(op.create.fonte).toBe(draftCompleto.url);
    expect(op.create.produto).toBe('Esteira transportadora');
  });

  it('release sem sinergia grava só o release (não inventa demanda vazia)', async () => {
    const r = await persistirReleaseDrafts('org1', 'alvo1', [
      { ...draftCompleto, demandaGerada: null, oportunidade: null },
    ]);

    expect(r).toEqual({ criados: 1, demandasCriadas: 0, oportunidadesCriadas: 0 });
    expect(prismaMock.miraDemanda.upsert).not.toHaveBeenCalled();
    expect(prismaMock.miraOportunidade.upsert).not.toHaveBeenCalled();
    expect(prismaMock.miraRelease.create.mock.calls[0][0].data.demandaId).toBeNull();
  });

  it('sem data na fonte, dataFonte fica null em vez de virar a data de hoje', async () => {
    await persistirReleaseDrafts('org1', 'alvo1', [{ ...draftCompleto, dataPublicacao: null }]);

    const dem = prismaMock.miraDemanda.upsert.mock.calls[0][0];
    expect(dem.create.dataFonte).toBeNull(); // honesto: não sabemos quando saiu
    expect(prismaMock.miraRelease.create.mock.calls[0][0].data.dataPublicacao).toBeNull();
  });

  it('matéria já gravada nos últimos 45 dias não repete nem duplica a demanda', async () => {
    prismaMock.miraRelease.findFirst.mockResolvedValue({ id: 'ja-existe' });

    const r = await persistirReleaseDrafts('org1', 'alvo1', [draftCompleto]);

    expect(r).toEqual({ criados: 0, demandasCriadas: 0, oportunidadesCriadas: 0 });
    expect(prismaMock.miraRelease.create).not.toHaveBeenCalled();
    expect(prismaMock.miraDemanda.upsert).not.toHaveBeenCalled();
  });

  it('a mesma URL gera SEMPRE o mesmo id: reencontrar a matéria atualiza, não empilha', async () => {
    await persistirReleaseDrafts('org1', 'alvo1', [draftCompleto]);
    const idPrimeiro = prismaMock.miraDemanda.upsert.mock.calls[0][0].where.id;

    vi.clearAllMocks();
    prismaMock.miraRelease.findFirst.mockResolvedValue(null);
    prismaMock.miraRelease.create.mockResolvedValue({ id: 'rel2' });
    prismaMock.miraDemanda.upsert.mockImplementation(({ create }: any) => Promise.resolve({ id: create.id }));
    prismaMock.miraOportunidade.upsert.mockResolvedValue({ id: 'op2' });

    await persistirReleaseDrafts('org1', 'alvo1', [draftCompleto]);
    expect(prismaMock.miraDemanda.upsert.mock.calls[0][0].where.id).toBe(idPrimeiro);
    expect(idPrimeiro).toContain(hashUrl(draftCompleto.url));
  });

  it('URLs diferentes geram ids diferentes (não colidem entre matérias)', () => {
    expect(hashUrl('https://exame.com/a')).not.toBe(hashUrl('https://exame.com/b'));
    expect(hashUrl('https://exame.com/a')).toBe(hashUrl('https://exame.com/a'));
  });
});
