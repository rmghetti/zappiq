/**
 * O chat do site pede as regras do AGENTE, não da organização inteira.
 * ==========================================================================
 * PI-3 da revisão do PR #375. O bloco "# Regras aprovadas pelo dono" era
 * carregado só por organização, nos dois canais. Hoje cada organização tem um
 * agente comercial vivo, então dava no mesmo; basta a primeira ligar um
 * agente de suporte para as regras do comercial vazarem para ele.
 *
 * O chat do site nem tinha o id do agente à mão: ele carrega o TEXTO do
 * prompt por SQL cru, com cache de 5 minutos. Agora existe um lookup próprio,
 * na mesma ordem do prompt (role 'comercial', status 'live', o mais antigo),
 * para o id e o texto serem do mesmo agente.
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
vi.mock('./featureFlags.js', () => ({ isFlagOn: vi.fn(async () => false) }));
vi.mock('./agentRulesService.js', () => ({
  blocoDeRegrasDaOrganizacao: (...args: any[]) => blocoDeRegras(...args),
}));
vi.mock('../utils/logger.js', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

const { processWebChatTurn } = await import('./webChatService.js');

const ORG = 'org-do-cmj';
const TURNO = { sessionId: 's1', message: 'oi', organizationId: ORG, history: [] };

const BLOCO = ['# Regras aprovadas pelo dono', '', '1. Chame o visitante pelo nome.'].join('\n');

beforeEach(() => {
  vi.clearAllMocks();
  agentFindFirst.mockResolvedValue({ id: 'agente-comercial-1' });
  blocoDeRegras.mockResolvedValue('');
});

describe('o bloco de regras do chat do site', () => {
  it('é pedido para o agente comercial vivo daquela organização', async () => {
    await processWebChatTurn(TURNO as any);
    expect(blocoDeRegras).toHaveBeenCalledWith(ORG, { agentId: 'agente-comercial-1' });
  });

  it('procura o agente na mesma ordem em que o prompt é carregado', async () => {
    await processWebChatTurn(TURNO as any);
    const args = agentFindFirst.mock.calls[0][0];
    expect(args.where).toMatchObject({
      organizationId: ORG,
      role: 'comercial',
      status: 'live',
    });
    expect(args.orderBy).toEqual({ createdAt: 'asc' });
  });

  it('organização sem agente encontrado pede sem id, e responde igual', async () => {
    agentFindFirst.mockResolvedValue(null);
    blocoDeRegras.mockResolvedValue(BLOCO);
    const r = await processWebChatTurn(TURNO as any);
    expect(blocoDeRegras).toHaveBeenCalledWith(ORG, { agentId: null });
    expect(r.reply).toContain('Posso ajudar');
    expect(String(chatCompletionMock.mock.calls[0][0])).toContain(BLOCO);
  });

  it('falha ao procurar o agente não derruba a resposta do visitante', async () => {
    agentFindFirst.mockRejectedValue(new Error('banco fora'));
    const r = await processWebChatTurn(TURNO as any);
    expect(r.reply).toContain('Posso ajudar');
    expect(blocoDeRegras).toHaveBeenCalledWith(ORG, { agentId: null });
  });
});
