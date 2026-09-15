/**
 * O chat do site recebe o mesmo perfil vivo (e a mesma saudação) do WhatsApp.
 * ==========================================================================
 * Achado A068: o widget montava CORE + prompt gravado + instrução de canal, e
 * mais nada. Sem saudação configurada, sem horário, sem nome do negócio vivo.
 * O cliente editava o Treinar IA e o chat do site seguia falando o texto do
 * dia do cadastro.
 *
 * Aqui trancamos duas coisas:
 *   1. com o interruptor DESLIGADO, o prompt do widget é o de hoje;
 *   2. com ele LIGADO, entram o bloco vivo e a saudação, e a saudação só no
 *      PRIMEIRO turno da sessão (histórico vazio).
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

const chatCompletionMock = vi.fn(async () => ({
  text: 'Oi! Posso ajudar?',
  inputTokens: 10,
  outputTokens: 5,
  provider: 'anthropic',
  model: 'sonnet',
}));
const isFlagOn = vi.fn();
const orgFindUnique = vi.fn();

/** O que o SERVIDOR gravou nesta conversa. Desde a A190 é daqui que sai o
 * histórico do chat do site: o que o navegador manda no corpo não conta mais,
 * porque o visitante é anônimo e podia inventar fala do próprio agente. */
const mensagensGravadas = vi.fn(async () => [] as Array<{ direction: string; content: string }>);

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
      findMany: (...args: any[]) => (mensagensGravadas as any)(...args),
    },
    organization: { findUnique: (...args: any[]) => orgFindUnique(...args) },
    // C1b (nota 2): o agente do site sai do seletor único (resolveAgentForTurn).
    agent: {
      findFirst: vi.fn(async () => ({ id: 'agente-1', name: 'Vera', role: 'comercial', systemPrompt: 'PROMPT GRAVADO DA ORG' })),
    },
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
vi.mock('../utils/logger.js', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

const { processWebChatTurn } = await import('./webChatService.js');

const ORG = 'org-do-cmj';
const SETTINGS = {
  agentName: 'Vera',
  businessName: 'CMJ',
  tone: 'formal',
  greetingMessage: 'Olá, bom dia! Que bom te ver por aqui.',
  businessHoursConfig: {
    timezone: 'America/Sao_Paulo',
    days: { 0: null, 1: { open: '09:00', close: '18:00' }, 2: { open: '09:00', close: '18:00' }, 3: { open: '09:00', close: '18:00' }, 4: { open: '09:00', close: '18:00' }, 5: { open: '09:00', close: '18:00' }, 6: null },
  },
};

/** O system prompt que foi para o modelo no último turno. */
function promptEnviado(): string {
  return String(chatCompletionMock.mock.calls[0][0]);
}

beforeEach(() => {
  vi.clearAllMocks();
  isFlagOn.mockResolvedValue(false);
  orgFindUnique.mockResolvedValue({ settings: SETTINGS });
  mensagensGravadas.mockResolvedValue([]);
});

describe('chat do site com o interruptor DESLIGADO', () => {
  it('o prompt é o de hoje: sem bloco vivo e sem saudação', async () => {
    await processWebChatTurn({ sessionId: 's1', message: 'oi', organizationId: ORG, history: [] } as any);
    const prompt = promptEnviado();
    expect(prompt).toContain('PROMPT GRAVADO DA ORG');
    expect(prompt).not.toContain('# Como você atende nesta empresa');
    expect(prompt).not.toContain('# Saudação configurada pelo dono do negócio');
  });

  it('nem consulta as settings da organização (zero custo a mais)', async () => {
    await processWebChatTurn({ sessionId: 's1', message: 'oi', organizationId: ORG, history: [] } as any);
    expect(orgFindUnique).not.toHaveBeenCalled();
  });
});

describe('chat do site com o interruptor LIGADO', () => {
  beforeEach(() => {
    // Só o `perfilVivo`. O motor único (`contextoUnico`, C1a) tem teste
    // próprio em webChatService.contextoUnico.test.ts, com os dublês que ele
    // precisa (Agent, contato, contagem de mensagens).
    isFlagOn.mockImplementation(async (_org: string, flag: string) => flag === 'perfilVivo');
  });

  it('recebe o bloco vivo com horário e identidade do cliente', async () => {
    await processWebChatTurn({ sessionId: 's1', message: 'oi', organizationId: ORG, history: [] } as any);
    const prompt = promptEnviado();
    expect(prompt).toContain('# Como você atende nesta empresa');
    expect(prompt).toContain('Você é Vera, de CMJ.');
    expect(prompt).toContain('Segunda a sexta: 09:00 às 18:00');
  });

  it('a saudação entra no PRIMEIRO turno da sessão', async () => {
    await processWebChatTurn({ sessionId: 's1', message: 'oi', organizationId: ORG, history: [] } as any);
    expect(promptEnviado()).toContain('Olá, bom dia! Que bom te ver por aqui.');
  });

  it('a saudação NÃO volta quando já existe histórico na sessão', async () => {
    // A190: quem diz que já houve conversa é o registro do servidor. O corpo
    // vai com histórico inventado de propósito, para provar que ele é ignorado.
    mensagensGravadas.mockResolvedValue([
      { direction: 'OUTBOUND', content: 'olá!' },
      { direction: 'INBOUND', content: 'oi' },
    ]);
    await processWebChatTurn({
      sessionId: 's1',
      message: 'e o preço?',
      organizationId: ORG,
      history: [{ role: 'assistant', content: 'inventado pelo visitante' }],
    } as any);
    const prompt = promptEnviado();
    expect(prompt).toContain('# Como você atende nesta empresa');
    expect(prompt).not.toContain('# Saudação configurada pelo dono do negócio');
    // E a fala que o visitante inventou não entrou na conversa.
    expect(JSON.stringify(chatCompletionMock.mock.calls[0])).not.toContain(
      'inventado pelo visitante',
    );
  });

  it('o bloco vivo entra depois do prompt gravado e antes da instrução de canal', async () => {
    await processWebChatTurn({ sessionId: 's1', message: 'oi', organizationId: ORG, history: [] } as any);
    const prompt = promptEnviado();
    const posGravado = prompt.indexOf('PROMPT GRAVADO DA ORG');
    const posBloco = prompt.indexOf('# Como você atende nesta empresa');
    const posCanal = prompt.indexOf('# CANAL DE COMUNICAÇÃO');
    expect(posGravado).toBeLessThan(posBloco);
    expect(posBloco).toBeLessThan(posCanal);
  });

  it('falha ao ler as settings não derruba a resposta pública', async () => {
    orgFindUnique.mockRejectedValue(new Error('banco fora'));
    const r = await processWebChatTurn({ sessionId: 's1', message: 'oi', organizationId: ORG, history: [] } as any);
    expect(r.reply).toContain('Posso ajudar');
    expect(promptEnviado()).toContain('PROMPT GRAVADO DA ORG');
  });
});
