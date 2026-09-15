/**
 * O chat do site pede as regras do AGENTE, não da organização inteira.
 * ==========================================================================
 * PI-3 da revisão do PR #375. O bloco "# Regras aprovadas pelo dono" era
 * carregado só por organização, nos dois canais. Hoje cada organização tem um
 * agente comercial vivo, então dava no mesmo; basta a primeira ligar um
 * agente de suporte para as regras do comercial vazarem para ele.
 *
 * C1b (nota 2 da revisão de 14/09, A077): o prompt e o id saem agora do
 * MESMO registro, pelo seletor único (resolveAgentForTurn: papel comercial,
 * live, o mais recente) e com o mesmo cache de 5 minutos. Antes eram dois
 * lookups (SQL cru para o texto, findFirst para o id), com o risco de o
 * texto ser de um agente e as regras de outro.
 *
 * Fail-soft em tudo: erro aqui não pode segurar a resposta ao visitante.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

const chatCompletionMock = vi.fn(async () => ({
  text: 'Oi! Posso ajudar?',
  inputTokens: 10,
  outputTokens: 5,
  provider: 'anthropic',
  model: 'sonnet',
}));
const agentFindFirst = vi.fn();
const blocoDeRegras = vi.fn();
const isFlagOn = vi.fn();

vi.mock('@zappiq/database', () => ({
  prisma: {
    contact: { upsert: vi.fn(async () => ({ id: 'contato-1' })) },
    conversation: {
      findFirst: vi.fn(async () => ({ id: 'conversa-1' })),
      findUnique: vi.fn(async () => ({ aiPaused: false })),
      create: vi.fn(async () => ({ id: 'conversa-1' })),
    },
    message: {
      create: vi.fn(async () => ({ id: 'msg-1' })),
      findMany: vi.fn(async () => []),
    },
    organization: { findUnique: vi.fn(async () => ({ settings: {} })) },
    agent: { findFirst: (...args: any[]) => agentFindFirst(...args) },
    $queryRawUnsafe: vi.fn(async () => [{ system_prompt: 'PROMPT GRAVADO DA ORG' }]),
  },
}));

vi.mock('./cloud/index.js', () => ({
  cache: {
    setNX: vi.fn(async () => true),
    incrby: vi.fn(async () => 1),
    expire: vi.fn(async () => true),
  },
}));
vi.mock('../utils/socketRegistry.js', () => ({ getIo: vi.fn(() => null) }));
vi.mock('./llm/langchainClient.js', () => ({
  chatCompletion: (...args: any[]) => (chatCompletionMock as any)(...args),
}));
vi.mock('../agents/coreAgentRules.js', () => ({ CORE_AGENT_RULES_V1: 'CORE' }));
vi.mock('./izaFactsService.js', () => ({ getIzaFactsBlock: vi.fn(async () => '') }));
vi.mock('./featureFlags.js', async (importOriginal) => {
  const real = (await importOriginal()) as any;
  return {
    ...real,
    isFlagOn: (...args: any[]) => isFlagOn(...args),
    // C1b (nota 1): a leitura única do turno, derivada do mesmo dublê.
    lerFlagsDaOrganizacao: async (org: string) =>
      Object.fromEntries(
        await Promise.all(real.FLAG_NAMES.map(async (f: string) => [f, Boolean(await isFlagOn(org, f))])),
      ),
  };
});
vi.mock('./agentRulesService.js', () => ({
  blocoDeRegrasDaOrganizacao: (...args: any[]) => blocoDeRegras(...args),
}));
vi.mock('../utils/logger.js', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

const { processWebChatTurn, limparCacheDoAgenteDoSite, SystemPromptNaoEncontrado } = await import(
  './webChatService.js'
);

const ORG = 'org-do-cmj';
const TURNO = { sessionId: 's1', message: 'oi', organizationId: ORG, history: [] };

const BLOCO = ['# Regras aprovadas pelo dono', '', '1. Chame o visitante pelo nome.'].join('\n');

beforeEach(() => {
  vi.clearAllMocks();
  limparCacheDoAgenteDoSite();
  agentFindFirst.mockResolvedValue({
    id: 'agente-comercial-1',
    name: 'Vera',
    role: 'comercial',
    systemPrompt: 'PROMPT GRAVADO DA ORG',
  });
  blocoDeRegras.mockResolvedValue('');
  // Só o interruptor deste arquivo (rodada 2 do PR #377): `true` para todos
  // ligaria também o motor único (contextoUnico), que tem teste próprio.
  isFlagOn.mockImplementation(async (_o: string, f: string) => f === 'regrasComoRegistros');
});

describe('com o interruptor regrasComoRegistros DESLIGADO', () => {
  it('não pede regra nenhuma, e o único lookup do agente é o do prompt (zero consulta a mais)', async () => {
    isFlagOn.mockResolvedValue(false);
    await processWebChatTurn(TURNO as any);
    expect(blocoDeRegras).not.toHaveBeenCalled();
    expect(agentFindFirst).toHaveBeenCalledTimes(1);
  });
});

describe('o bloco de regras do chat do site', () => {
  it('é pedido para o agente comercial vivo daquela organização, com o interruptor já lido', async () => {
    await processWebChatTurn(TURNO as any);
    expect(blocoDeRegras).toHaveBeenCalledWith(ORG, { agentId: 'agente-comercial-1', ligado: true });
  });

  it('o prompt e as regras saem do MESMO lookup, pelo seletor único (o mais recente)', async () => {
    await processWebChatTurn(TURNO as any);
    expect(agentFindFirst).toHaveBeenCalledTimes(1);
    const args = agentFindFirst.mock.calls[0][0];
    expect(args.where).toMatchObject({
      organizationId: ORG,
      role: 'comercial',
      status: 'live',
    });
    expect(args.orderBy).toEqual({ createdAt: 'desc' });
    expect(String(chatCompletionMock.mock.calls[0][0])).toContain('PROMPT GRAVADO DA ORG');
  });

  it('o bloco pedido entra no prompt do visitante', async () => {
    blocoDeRegras.mockResolvedValue(BLOCO);
    const r = await processWebChatTurn(TURNO as any);
    expect(r.reply).toContain('Posso ajudar');
    expect(String(chatCompletionMock.mock.calls[0][0])).toContain(BLOCO);
  });

  it('sem agente vivo com prompt: o mesmo erro de sempre, e nenhuma regra é pedida', async () => {
    agentFindFirst.mockResolvedValue(null);
    await expect(processWebChatTurn(TURNO as any)).rejects.toBeInstanceOf(SystemPromptNaoEncontrado);
    expect(blocoDeRegras).not.toHaveBeenCalled();
  });

  it('banco fora na busca do agente é erro de banco, não "sem agente" (como antes)', async () => {
    agentFindFirst.mockRejectedValue(new Error('banco fora'));
    const erro = await processWebChatTurn(TURNO as any).catch((e) => e);
    expect(erro).toBeInstanceOf(Error);
    expect(erro).not.toBeInstanceOf(SystemPromptNaoEncontrado);
  });
});
