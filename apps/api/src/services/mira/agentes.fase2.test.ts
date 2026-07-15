/**
 * "Aprofundar com IA" — Fase 2 (pesquisa na web).
 *
 * Pedido do Rodrigo (15/07/2026): os Alvos chegavam com "Demandas recentes",
 * "Fornecedores atuais" e "Releases desta conta" vazios. Não era falta de dado
 * no mundo, era falta de quem fosse buscar: `miraIncumbente` não tinha UM
 * escritor no código inteiro, releases só nasciam num cron semanal, e o botão
 * "Aprofundar" nunca pesquisou nada além de cruzar o que a Receita já sabia.
 *
 * O outro defeito que estes testes travam: mesmo depois de preencher o
 * dossiê, a NOTA não mudava. `aprofundarAlvo` nunca recalculava o miraScore,
 * então o fator "Janela e incumbente" (15 pontos) seguiria zerado para
 * sempre, capando todo Alvo em 85.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

const findFirstAlvo = vi.fn();
const findUniquePerfil = vi.fn();
const incumbenteDeleteMany = vi.fn();
const incumbenteCreate = vi.fn();
const demandaUpsert = vi.fn();
const alvoUpdate = vi.fn();

vi.mock('@zappiq/database', () => ({
  Prisma: {},
  prisma: {
    miraAlvo: { findFirst: (...a: any[]) => findFirstAlvo(...a), update: (...a: any[]) => alvoUpdate(...a) },
    miraPerfil: { findUnique: (...a: any[]) => findUniquePerfil(...a) },
    miraIncumbente: {
      deleteMany: (...a: any[]) => incumbenteDeleteMany(...a),
      create: (...a: any[]) => incumbenteCreate(...a),
    },
    miraDemanda: { upsert: (...a: any[]) => demandaUpsert(...a) },
    $transaction: async (fn: any) =>
      fn({
        miraOportunidade: { deleteMany: vi.fn(), create: vi.fn() },
        miraDemanda: { upsert: vi.fn() },
        miraAlvo: { update: vi.fn() },
      }),
  },
}));
vi.mock('../../utils/logger.js', () => ({ logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() } }));

const complete = vi.fn();
vi.mock('../llm/LLMRouter.js', () => ({ llmRouter: { complete: (...a: any[]) => complete(...a) } }));

const buscaPublicaDisponivel = vi.fn();
vi.mock('./buscaPublica.js', () => ({ buscaPublicaDisponivel: () => buscaPublicaDisponivel() }));

const pesquisarPegadaPublica = vi.fn();
const persistirReleaseDrafts = vi.fn();
vi.mock('./releasesPublico.js', () => ({
  pesquisarPegadaPublica: (...a: any[]) => pesquisarPegadaPublica(...a),
  persistirReleaseDrafts: (...a: any[]) => persistirReleaseDrafts(...a),
}));
vi.mock('./cagedMirror.js', () => ({ buscarSinalSetorial: vi.fn().mockResolvedValue(null) }));

const { aprofundarAlvo } = await import('./agentes.js');

const ALVO = {
  id: 'alvo-1',
  kind: 'B2B',
  nome: 'ACME METALURGICA LTDA',
  nomeFantasia: null,
  cnpj: '11222333000181',
  cnae: '2451-2',
  porte: '3',
  capitalSocial: 500_000,
  situacaoCadastral: 'ATIVA',
  municipio: 'São Paulo',
  uf: 'SP',
  telefone: null,
  site: null,
  miraScore: 33,
  resumo: 'resumo antigo',
  fontes: [],
  decisores: [{ id: 'd1', nome: 'Carlos Rondello', papel: 'Sócio' }],
};

const PERFIL = {
  catalogo: [{ nome: 'Consultoria de infra' }],
  doresResolvidas: ['Downtime derruba a operação'],
  alvoB2B: { cnaesAlvo: ['2451'], sinaisIntencao: ['expandindo filiais'] },
};

/** Saída válida da Fase 1 (o LLM analista), para o teste focar na Fase 2. */
const RESPOSTA_FASE1 = JSON.stringify({
  resumo: 'ACME metalúrgica em SP, porte médio, situação ativa e quadro societário mapeado.',
  oportunidades: [{ rank: 1, produto: 'Consultoria de infra', racional: 'racional suficientemente longo para passar', demandaPresumida: 'provável dor de infra' }],
  roteiros: [{ decisor: 'Carlos Rondello', mensagem: 'mensagem de abordagem com tamanho suficiente para passar no verificador do roteiro' }],
});

beforeEach(() => {
  vi.clearAllMocks();
  findFirstAlvo.mockResolvedValue(ALVO);
  findUniquePerfil.mockResolvedValue(PERFIL);
  complete.mockResolvedValue({ text: RESPOSTA_FASE1 });
  buscaPublicaDisponivel.mockReturnValue(true);
  persistirReleaseDrafts.mockResolvedValue({ criados: 0 });
  alvoUpdate.mockResolvedValue({});
  incumbenteDeleteMany.mockResolvedValue({});
  incumbenteCreate.mockResolvedValue({});
  demandaUpsert.mockResolvedValue({});
  pesquisarPegadaPublica.mockResolvedValue({
    releases: [],
    incumbentes: [],
    demandas: [],
    janela: null,
    buscas: 3,
  });
});

describe('Fase 2: a pesquisa na web preenche o que ficava vazio', () => {
  it('grava o fornecedor atual (miraIncumbente nunca teve escritor no código)', async () => {
    pesquisarPegadaPublica.mockResolvedValue({
      releases: [],
      incumbentes: [
        {
          fornecedor: 'TOTVS',
          categoria: 'ERP',
          evidencia: 'A conta publicou que implantou o ERP da TOTVS em 2025.',
          fonte: 'https://exemplo.com/noticia',
          deslocabilidade: 'BAIXA: contrato longo de ERP',
        },
      ],
      demandas: [],
      janela: null,
      buscas: 3,
    });

    const r = await aprofundarAlvo('org-1', 'alvo-1');

    expect(r.pesquisaWeb?.incumbentes).toBe(1);
    expect(incumbenteCreate).toHaveBeenCalledTimes(1);
    const data = incumbenteCreate.mock.calls[0][0].data;
    expect(data.fornecedor).toBe('TOTVS');
    expect(data.fonte).toBe('https://exemplo.com/noticia'); // sempre com fonte real
  });

  it('grava demanda EVIDENCIADA com confiança acima da presumida (55)', async () => {
    pesquisarPegadaPublica.mockResolvedValue({
      releases: [],
      incumbentes: [],
      demandas: [
        {
          descricao: 'Precisa de mais capacidade de produção para a nova planta',
          evidencia: 'A empresa anunciou expansão da fábrica em julho.',
          fonte: 'https://exemplo.com/expansao',
          confianca: 70,
        },
      ],
      janela: null,
      buscas: 3,
    });

    const r = await aprofundarAlvo('org-1', 'alvo-1');

    expect(r.pesquisaWeb?.demandasEvidenciadas).toBe(1);
    const data = demandaUpsert.mock.calls[0][0].create;
    expect(data.confianca).toBeGreaterThan(55); // acima da presunção da Fase 1
    expect(data.fonte).toBe('https://exemplo.com/expansao');
  });

  it('recalcula o score com a evidência: a nota SOBE e é gravada', async () => {
    pesquisarPegadaPublica.mockResolvedValue({
      releases: [],
      incumbentes: [{ fornecedor: 'TOTVS', categoria: 'ERP', evidencia: 'implantou ERP da TOTVS', fonte: 'https://e.com/1', deslocabilidade: null }],
      demandas: [{ descricao: 'precisa de capacidade', evidencia: 'anunciou expansão', fonte: 'https://e.com/2', confianca: 70 }],
      janela: 'anunciou expansão de fábrica',
      buscas: 3,
    });

    const r = await aprofundarAlvo('org-1', 'alvo-1');

    expect(r.pesquisaWeb?.scoreAntes).toBe(33);
    expect(r.pesquisaWeb?.scoreDepois).toBeGreaterThan(33);
    // A nota nova precisa PERSISTIR: sem isto, a Fase 2 preencheria o dossiê
    // e o cliente continuaria vendo a nota velha na fila.
    const updateScore = alvoUpdate.mock.calls.find((c: any[]) => c[0].data?.miraScore !== undefined);
    expect(updateScore).toBeTruthy();
    expect(updateScore![0].data.miraScore).toBe(r.pesquisaWeb?.scoreDepois);
  });

  it('sem incumbente achado, não apaga o que já existia', async () => {
    // deleteMany só roda quando há substituto: pesquisa vazia não pode
    // silenciosamente esvaziar um dossiê que já tinha fornecedor mapeado.
    await aprofundarAlvo('org-1', 'alvo-1');
    expect(incumbenteDeleteMany).not.toHaveBeenCalled();
  });
});

describe('Fase 2: honestidade', () => {
  it('busca quebrada vira erro explícito, sem fingir que a conta não tem pegada', async () => {
    pesquisarPegadaPublica.mockResolvedValue({
      releases: [],
      incumbentes: [],
      demandas: [],
      janela: null,
      buscas: 1,
      erro: 'fonte_falhou',
    });

    const r = await aprofundarAlvo('org-1', 'alvo-1');

    expect(r.pesquisaWeb?.erro).toBe('fonte_falhou');
    expect(r.pesquisaWeb?.rodou).toBe(false);
    // A Fase 1 já entregou valor: o cliente não perde as oportunidades por
    // causa da web.
    expect(r.ok).toBe(true);
    expect(r.oportunidades).toBe(1);
  });

  it('sem provedor de busca configurado: diz fonte_indisponivel e a Fase 1 sobrevive', async () => {
    buscaPublicaDisponivel.mockReturnValue(false);

    const r = await aprofundarAlvo('org-1', 'alvo-1');

    expect(r.pesquisaWeb?.erro).toBe('fonte_indisponivel');
    expect(r.pesquisaWeb?.rodou).toBe(false);
    expect(pesquisarPegadaPublica).not.toHaveBeenCalled();
    expect(r.ok).toBe(true);
  });

  it('pesquisa rodou e não achou nada: rodou=true e SEM erro (é informação, não falha)', async () => {
    const r = await aprofundarAlvo('org-1', 'alvo-1');

    expect(r.pesquisaWeb?.rodou).toBe(true);
    expect(r.pesquisaWeb?.erro).toBeUndefined();
    expect(r.pesquisaWeb?.buscas).toBe(3);
  });

  it('a Fase 2 quebrando não derruba a Fase 1', async () => {
    pesquisarPegadaPublica.mockRejectedValue(new Error('boom'));

    const r = await aprofundarAlvo('org-1', 'alvo-1');

    expect(r.ok).toBe(true);
    expect(r.oportunidades).toBe(1);
    expect(r.pesquisaWeb?.erro).toContain('boom');
  });
});
