/**
 * Aprofundar (agentes.ts): o Perfil de Prospecção inteiro pesa na análise.
 *
 * O que estes testes travam:
 *  1. TODO campo do caminho ativo do Perfil chega ao prompt do especialista
 *     (é a fiação que faz a tela cumprir o que promete: o que o cliente
 *     preenche influencia a qualificação do Alvo).
 *  2. O bloco do caminho INATIVO não vaza (perfil B2B não fala de momento de
 *     vida; B2C não fala de technographics).
 *  3. Red flags e must-haves declarados chegam ao prompt, e o verificador só
 *     aceita de volta o que estiver ANCORADO na lista declarada. Corte
 *     inventado pelo modelo cai como qualquer outra invenção.
 *  4. O corte confirmado persiste no resumo do dossiê (onde o vendedor lê).
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

const findFirstAlvo = vi.fn();
const findUniquePerfil = vi.fn();
const txOportunidadeCreate = vi.fn();
const txAlvoUpdate = vi.fn();
vi.mock('@zappiq/database', () => ({
  prisma: {
    miraAlvo: { findFirst: (...a: any[]) => findFirstAlvo(...a) },
    miraPerfil: { findUnique: (...a: any[]) => findUniquePerfil(...a) },
    $transaction: async (fn: any) =>
      fn({
        miraOportunidade: { deleteMany: vi.fn(), create: (...a: any[]) => txOportunidadeCreate(...a) },
        miraDemanda: { upsert: vi.fn() },
        miraAlvo: { update: (...a: any[]) => txAlvoUpdate(...a) },
      }),
  },
}));
vi.mock('../../utils/logger.js', () => ({ logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() } }));
const complete = vi.fn();
vi.mock('../llm/LLMRouter.js', () => ({ llmRouter: { complete: (...a: any[]) => complete(...a) } }));

const { aprofundarAlvo, montarContextoPerfil, criteriosDeCorte } = await import('./agentes.js');

const PERFIL_CHEIO = {
  segmento: 'Infraestrutura de TI',
  subsegmentos: ['Cloud', 'NOC'],
  catalogo: [{ nome: 'Consultoria de infra', descricao: 'Projeto e operação' }],
  doresResolvidas: ['Downtime derruba a operação'],
  resultadosEsperados: ['Reduz custo de infra em 30%'],
  casosDeUso: ['Migração para nuvem'],
  diferenciais: ['SLA 99,9%'],
  concorrentes: ['Empresa X'],
  ticketMedio: 'R$ 5k a 15k por mês',
  alvoB2B: {
    cnaesAlvo: ['6201-5'],
    portes: ['Médio'],
    regioes: ['SP'],
    faturamentoAnual: 'R$ 10M a 50M',
    numFuncionarios: '50 a 200',
    technographics: ['usa ERP'],
    sinaisIntencao: ['contratando na área de TI'],
    decisor: ['Diretor de TI'],
    influenciadores: ['Gerente de TI'],
    usuarioFinal: ['Analistas de operação'],
    objecoes: 'Já temos fornecedor: mostrar SLA',
    cicloVenda: 'MEDIO',
    redFlagsB2B: ['Setor regulado'],
    mustHavesB2B: ['Ter equipe de TI própria'],
    clientesReferencia: ['Empresa A'],
  },
  alvoB2C: {
    faixaEtaria: '25 a 45 anos',
    genero: 'FEMININO',
    faixaRenda: 'Classe B',
    ocupacao: ['CLT'],
    composicaoFamiliar: ['Casado com filhos'],
    regiaoCidade: ['Moema'],
    tipoRegiao: ['raio 8km'],
    interesses: ['gastronomia'],
    canais: ['Instagram'],
    habitosConsumo: ['pede delivery'],
    momentoDeVida: ['mudou de casa'],
    doresDesejos: ['comer bem sem demora'],
    capacidadePagamento: 'até R$ 200',
    redFlagsB2C: ['fora do raio de entrega'],
    influenciadoresB2C: ['cônjuge'],
  },
};

const ALVO_B2B = {
  id: 'alvo-1',
  kind: 'B2B',
  nome: 'ACME LTDA',
  nomeFantasia: 'ACME',
  cnae: '6201-5',
  situacaoCadastral: 'ATIVA',
  porte: 'MEDIO',
  municipio: 'São Paulo',
  uf: 'SP',
  resumo: null,
  fontes: [],
  decisores: [{ id: 'd1', nome: 'Maria Silva', papel: 'Sócia-diretora', confianca: 80 }],
};

const respostaLLM = (obj: unknown) => ({ text: JSON.stringify(obj), provider: 'anthropic', model: 'x', latencyMs: 1, attempt: 1 });

const SAIDA_VALIDA = {
  resumo:
    'Conta ativa de desenvolvimento de software em São Paulo, porte médio, com sócia mapeada no quadro societário. O encaixe com consultoria de infra vem direto da atividade declarada.',
  oportunidades: [
    {
      rank: 1,
      produto: 'Consultoria de infra',
      racional: 'Atividade 6201-5 com porte médio indica operação de TI própria, onde downtime dói e a migração para nuvem é gatilho típico.',
      demandaPresumida: 'Reduzir downtime da operação',
    },
    { rank: 2, produto: 'Produto Fantasma', racional: 'inventado pelo modelo sem base no catálogo.', demandaPresumida: 'x' },
  ],
  roteiros: [
    {
      decisor: 'Maria Silva',
      mensagem:
        'Olá Maria, vi que a ACME atua com software em São Paulo. Operações nesse estágio costumam sofrer com indisponibilidade. Já ajudamos empresas parecidas a reduzir custo de infra em 30%. Faz sentido conversarmos?',
    },
  ],
  corte: {
    redFlagsConfirmadas: ['Setor regulado', 'Flag Inventada'],
    mustHavesNaoConfirmados: ['Ter equipe de TI própria'],
  },
};

beforeEach(() => {
  vi.clearAllMocks();
  findFirstAlvo.mockResolvedValue(ALVO_B2B);
  findUniquePerfil.mockResolvedValue(PERFIL_CHEIO);
  complete.mockResolvedValue(respostaLLM(SAIDA_VALIDA));
});

describe('montarContextoPerfil', () => {
  it('B2B: todo campo comum e do bloco B2B aparece no contexto', () => {
    const ctx = montarContextoPerfil(PERFIL_CHEIO, 'B2B');
    for (const trecho of [
      'Infraestrutura de TI',
      'Cloud; NOC',
      'Consultoria de infra',
      'Downtime derruba a operação',
      'Reduz custo de infra em 30%',
      'Migração para nuvem',
      'SLA 99,9%',
      'Empresa X',
      'R$ 5k a 15k por mês',
      'R$ 10M a 50M',
      '50 a 200',
      'usa ERP',
      'contratando na área de TI',
      'Gerente de TI',
      'Analistas de operação',
      'Já temos fornecedor: mostrar SLA',
      'Ciclo de venda típico: médio',
      'Empresa A',
    ]) {
      expect(ctx, `faltou no contexto B2B: ${trecho}`).toContain(trecho);
    }
    // O caminho inativo não vaza.
    expect(ctx).not.toContain('mudou de casa');
    expect(ctx).not.toContain('Moema');
  });

  it('B2C: todo campo do bloco B2C aparece e o B2B não vaza', () => {
    const ctx = montarContextoPerfil(PERFIL_CHEIO, 'B2C');
    for (const trecho of [
      '25 a 45 anos',
      'feminino',
      'Classe B',
      'CLT',
      'Casado com filhos',
      'raio 8km',
      'gastronomia',
      'Instagram',
      'pede delivery',
      'mudou de casa',
      'comer bem sem demora',
      'até R$ 200',
      'cônjuge',
    ]) {
      expect(ctx, `faltou no contexto B2C: ${trecho}`).toContain(trecho);
    }
    expect(ctx).not.toContain('usa ERP');
    expect(ctx).not.toContain('contratando na área de TI');
  });

  it('gênero TODOS não vira linha (não é filtro)', () => {
    const ctx = montarContextoPerfil(
      { ...PERFIL_CHEIO, alvoB2C: { ...PERFIL_CHEIO.alvoB2C, genero: 'TODOS' } },
      'B2C'
    );
    expect(ctx).not.toContain('Gênero predominante');
  });

  it('campo vazio some do prompt em vez de virar ruído', () => {
    const ctx = montarContextoPerfil({ segmento: 'X', catalogo: [{ nome: 'P' }] }, 'B2B');
    expect(ctx).not.toContain('Dores que o cliente resolve');
    expect(ctx).not.toContain('Ticket médio');
  });
});

describe('criteriosDeCorte', () => {
  it('B2B usa redFlagsB2B + mustHavesB2B; B2C usa redFlagsB2C', () => {
    expect(criteriosDeCorte(PERFIL_CHEIO, 'B2B')).toEqual({
      redFlags: ['Setor regulado'],
      mustHaves: ['Ter equipe de TI própria'],
    });
    expect(criteriosDeCorte(PERFIL_CHEIO, 'B2C')).toEqual({
      redFlags: ['fora do raio de entrega'],
      mustHaves: [],
    });
  });
});

describe('aprofundarAlvo', () => {
  it('injeta o perfil e os critérios de corte no prompt do especialista', async () => {
    await aprofundarAlvo('org-1', 'alvo-1');

    const req = complete.mock.calls[0][0];
    expect(req.user ?? req.messages[0].content).toBeDefined();
    const prompt = String(req.messages[0].content);
    expect(prompt).toContain('Downtime derruba a operação');
    expect(prompt).toContain('usa ERP');
    expect(prompt).toContain('CRITÉRIOS DE CORTE DECLARADOS PELO CLIENTE');
    expect(prompt).toContain('Setor regulado');
    expect(prompt).toContain('Ter equipe de TI própria');
    expect(String(req.system)).toContain('copiados literalmente das listas');
  });

  it('só aceita corte ancorado na lista declarada; o resto cai no verificador', async () => {
    const r = await aprofundarAlvo('org-1', 'alvo-1');

    expect(r.ok).toBe(true);
    expect(r.alertasCorte).toEqual([
      'Red flag confirmada: Setor regulado',
      'Must-have não confirmado nos dados: Ter equipe de TI própria',
    ]);
    expect(r.descartadosPeloVerificador).toContain('corte citou red flag fora da lista: "Flag Inventada"');
    // O verificador antigo continua de pé: produto fora do catálogo cai.
    expect(r.oportunidades).toBe(1);
    expect(r.descartadosPeloVerificador.some((d) => d.includes('Produto Fantasma'))).toBe(true);
  });

  it('persiste o corte confirmado no resumo do dossiê', async () => {
    await aprofundarAlvo('org-1', 'alvo-1');

    const update = txAlvoUpdate.mock.calls[0][0];
    expect(update.data.resumo).toContain('Atenção do verificador: Red flag confirmada: Setor regulado');
    expect(update.data.resumo).toContain('Must-have não confirmado nos dados: Ter equipe de TI própria');
  });

  it('sem critérios declarados, não pede corte e ignora corte espontâneo do modelo', async () => {
    findUniquePerfil.mockResolvedValue({
      ...PERFIL_CHEIO,
      alvoB2B: { ...PERFIL_CHEIO.alvoB2B, redFlagsB2B: [], mustHavesB2B: [] },
    });

    const r = await aprofundarAlvo('org-1', 'alvo-1');

    const prompt = String(complete.mock.calls[0][0].messages[0].content);
    expect(prompt).not.toContain('CRITÉRIOS DE CORTE');
    expect(r.alertasCorte).toEqual([]);
    expect(r.descartadosPeloVerificador.some((d) => d.includes('corte citou'))).toBe(false);
  });

  it('alvo B2C cruza com o bloco B2C do perfil (e usa redFlagsB2C)', async () => {
    findFirstAlvo.mockResolvedValue({ ...ALVO_B2B, kind: 'B2C', nome: 'Cantina da Vila' });
    complete.mockResolvedValue(
      respostaLLM({ ...SAIDA_VALIDA, corte: { redFlagsConfirmadas: ['fora do raio de entrega'], mustHavesNaoConfirmados: [] } })
    );

    const r = await aprofundarAlvo('org-1', 'alvo-1');

    const prompt = String(complete.mock.calls[0][0].messages[0].content);
    expect(prompt).toContain('mudou de casa');
    expect(prompt).toContain('fora do raio de entrega');
    expect(prompt).not.toContain('usa ERP');
    expect(r.alertasCorte).toEqual(['Red flag confirmada: fora do raio de entrega']);
  });
});
