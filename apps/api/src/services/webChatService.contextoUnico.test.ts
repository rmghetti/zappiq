/* ══════════════════════════════════════════════════════════════════════
 * Chat do site pelo motor único (C1a, interruptor `contextoUnico`).
 * --------------------------------------------------------------------
 * O que este teste prova:
 *   1. DESLIGADO, o chat do site monta o prompt como antes: carregador com
 *      cache, sem base, sem links, sem '# Cliente atual'.
 *   2. LIGADO, o prompt vem do MESMO motor do WhatsApp: CORE primeiro, a
 *      instrução de canal logo depois (A076), o prompt do agente, links,
 *      '# Cliente atual', '# Agora'. O Agent é lido a cada turno, sem o
 *      cache de 5 minutos (A089).
 *   3. A base só entra com `ragNoChatDoSite` também ligado (portão da P02,
 *      achado A197); sem ele, nenhuma busca é feita.
 *   4. Sem agente vivo, o erro é o mesmo de antes (SystemPromptNaoEncontrado).
 *   5. Erro de código no motor único não cala o visitante: cai no caminho de
 *      antes, com registro no log.
 * ══════════════════════════════════════════════════════════════════════ */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const chatCompletionMock = vi.fn(async () => ({
  text: 'Oi! Posso ajudar?',
  inputTokens: 10,
  outputTokens: 5,
  provider: 'anthropic',
  model: 'sonnet',
}));
const isFlagOn = vi.fn();
const orgFindUnique = vi.fn();
const agentFindFirst = vi.fn();
const contactFindUnique = vi.fn();
const messageCount = vi.fn();
const queryRawUnsafe = vi.fn();
const searchDetailed = vi.fn();
const loggerError = vi.fn();

const mensagensGravadas = vi.fn(async () => [] as Array<{ direction: string; content: string }>);

vi.mock('@zappiq/database', () => ({
  prisma: {
    contact: {
      upsert: vi.fn(async () => ({ id: 'contato-1' })),
      findUnique: (...a: any[]) => contactFindUnique(...a),
    },
    conversation: {
      findFirst: vi.fn(async () => ({ id: 'conversa-1' })),
      findUnique: vi.fn(async () => ({ aiPaused: false })),
      create: vi.fn(async () => ({ id: 'conversa-1' })),
    },
    message: {
      create: vi.fn(async () => ({ id: 'msg-1' })),
      findMany: (...args: any[]) => (mensagensGravadas as any)(...args),
      count: (...a: any[]) => messageCount(...a),
    },
    agent: { findFirst: (...a: any[]) => agentFindFirst(...a) },
    organization: { findUnique: (...args: any[]) => orgFindUnique(...args) },
    $queryRawUnsafe: (...a: any[]) => queryRawUnsafe(...a),
  },
}));

vi.mock('./cloud/index.js', () => ({
  cache: {
    setNX: vi.fn(async () => true),
    incrby: vi.fn(async () => 1),
    expire: vi.fn(async () => true),
  },
}));
vi.mock('./ragService.js', () => ({
  searchDetailed: (...a: any[]) => searchDetailed(...a),
}));
vi.mock('../utils/socketRegistry.js', () => ({ getIo: vi.fn(() => null) }));
vi.mock('./llm/langchainClient.js', () => ({
  chatCompletion: (...args: any[]) => (chatCompletionMock as any)(...args),
}));
vi.mock('./izaFactsService.js', () => ({
  getIzaFactsBlock: vi.fn(async () => '# FATOS ATUAIS\n- Lite: R$ 197'),
  invalidateIzaFactsCache: vi.fn(),
}));
vi.mock('./featureFlags.js', () => ({ isFlagOn: (...args: any[]) => isFlagOn(...args) }));
vi.mock('../utils/logger.js', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: (...a: any[]) => loggerError(...a), debug: vi.fn() },
}));

const { processWebChatTurn, SystemPromptNaoEncontrado, buildWebChatChannelInstruction } = await import(
  './webChatService.js'
);
const { CORE_AGENT_RULES_V1 } = await import('../agents/coreAgentRules.js');

const ORG = 'org-do-cmj';
const AGORA = new Date('2026-09-16T17:00:00Z');
const PROMPT_DA_VERA = '## IDENTIDADE\nVocê é Vera, atendente virtual da CMJ.';
const SETTINGS = {
  agentName: 'Vera',
  businessName: 'CMJ',
  tone: 'formal',
  greetingMessage: 'Olá, bom dia! Que bom te ver por aqui.',
  surveyAnswers: { identidade_empresa: { ide_site_url: 'cmj.com.br' } },
};

let flags: Record<string, boolean> = {};

function promptEnviado(indice = 0): string {
  return String(chatCompletionMock.mock.calls[indice][0]);
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.useFakeTimers();
  vi.setSystemTime(AGORA);
  flags = {};
  isFlagOn.mockImplementation(async (_org: string, flag: string) => flags[flag] === true);
  orgFindUnique.mockResolvedValue({ settings: SETTINGS });
  agentFindFirst.mockResolvedValue({ id: 'a1', name: 'Vera', role: 'comercial', systemPrompt: PROMPT_DA_VERA });
  contactFindUnique.mockResolvedValue({ leadStatus: 'NEW', name: null, _count: {} });
  messageCount.mockResolvedValue(1);
  queryRawUnsafe.mockResolvedValue([{ system_prompt: 'PROMPT GRAVADO DA ORG (cache)' }]);
  searchDetailed.mockResolvedValue({
    context: '[catalogo.pdf] A serra circular custa R$ 890.',
    sources: [{ source: 'catalogo.pdf', similarity: 0.7, snippet: 'serra' }],
    status: 'ok',
    fromCache: false,
  });
  mensagensGravadas.mockResolvedValue([]);
});

afterEach(() => {
  vi.useRealTimers();
});

describe('contextoUnico DESLIGADO: o chat do site como antes', () => {
  it('usa o carregador com cache, não consulta a base e não monta Cliente atual', async () => {
    await processWebChatTurn({ sessionId: 's1', message: 'oi', organizationId: ORG, history: [] } as any);

    expect(queryRawUnsafe).toHaveBeenCalled();
    expect(agentFindFirst).not.toHaveBeenCalled();
    expect(searchDetailed).not.toHaveBeenCalled();
    const prompt = promptEnviado();
    expect(prompt).toContain('PROMPT GRAVADO DA ORG (cache)');
    // O CORE cita o cabeçalho '# Cliente atual' numa regra; o que prova a
    // ausência do bloco é a linha que só ele escreve.
    expect(prompt).not.toContain('Mensagens trocadas até agora:');
    expect(prompt).not.toContain('# Contexto recuperado (RAG)');
    expect(prompt).not.toContain('# Agora');
    // A instrução de canal fica no FIM, como sempre foi neste caminho.
    expect(prompt.endsWith(buildWebChatChannelInstruction(false))).toBe(true);
  });
});

describe('contextoUnico LIGADO: o mesmo motor do WhatsApp', () => {
  beforeEach(() => {
    flags = { contextoUnico: true };
  });

  it('CORE primeiro, instrução de canal logo depois (A076), depois o prompt do agente', async () => {
    await processWebChatTurn({ sessionId: 's1', message: 'oi', organizationId: ORG, history: [] } as any);

    const prompt = promptEnviado();
    expect(prompt.startsWith(CORE_AGENT_RULES_V1)).toBe(true);
    expect(prompt.indexOf(buildWebChatChannelInstruction(false))).toBe(CORE_AGENT_RULES_V1.length + 1);
    expect(prompt.indexOf(PROMPT_DA_VERA)).toBeGreaterThan(prompt.indexOf('# CANAL DE COMUNICAÇÃO'));
    expect(prompt).not.toContain('PROMPT GRAVADO DA ORG (cache)');
  });

  it('ganha links, Cliente atual, saudação no primeiro turno e Agora, como o WhatsApp', async () => {
    await processWebChatTurn({ sessionId: 's1', message: 'oi', organizationId: ORG, history: [] } as any);

    const prompt = promptEnviado();
    expect(prompt).toContain('### Links oficiais de CMJ');
    expect(prompt).toContain('- Site oficial: https://cmj.com.br');
    expect(prompt).toContain('# Cliente atual');
    expect(prompt).toContain('Mensagens trocadas até agora: 1');
    expect(prompt).toContain('Primeiro contato? SIM');
    expect(prompt).toContain('# Saudação configurada pelo dono do negócio');
    expect(prompt).toContain('# Agora\n16/09/2026, 14:00:00');
    // Perfil vivo continua atrás do próprio interruptor.
    expect(prompt).not.toContain('# Como você atende nesta empresa');
  });

  it('lê o Agent a cada turno, sem o cache de 5 minutos (A089)', async () => {
    await processWebChatTurn({ sessionId: 's1', message: 'oi', organizationId: ORG, history: [] } as any);
    await processWebChatTurn({ sessionId: 's1', message: 'e o preço?', organizationId: ORG, history: [] } as any);

    expect(queryRawUnsafe).not.toHaveBeenCalled();
    expect(agentFindFirst).toHaveBeenCalledTimes(2);
    expect(agentFindFirst.mock.calls[0][0].where).toEqual({ organizationId: ORG, role: 'comercial', status: 'live' });
  });

  it('o contato do lead vale: segundo turno não é primeiro contato e a saudação não volta', async () => {
    messageCount.mockResolvedValue(3);
    mensagensGravadas.mockResolvedValue([
      { direction: 'INBOUND', content: 'oi' },
      { direction: 'OUTBOUND', content: 'olá!' },
    ]);

    await processWebChatTurn({ sessionId: 's1', message: 'e o preço?', organizationId: ORG, history: [] } as any);

    const prompt = promptEnviado();
    expect(contactFindUnique).toHaveBeenCalledWith(expect.objectContaining({ where: { id: 'contato-1' } }));
    expect(prompt).toContain('Mensagens trocadas até agora: 3');
    expect(prompt).toContain('Primeiro contato? NÃO (já tem histórico');
    expect(prompt).not.toContain('# Saudação configurada pelo dono do negócio');
  });

  it('sem ragNoChatDoSite, nenhuma busca na base (portão da P02)', async () => {
    await processWebChatTurn({ sessionId: 's1', message: 'quanto custa a serra?', organizationId: ORG, history: [] } as any);

    expect(searchDetailed).not.toHaveBeenCalled();
    expect(promptEnviado()).not.toContain('serra circular custa');
  });

  it('com ragNoChatDoSite, a base entra pelo mesmo ragService do WhatsApp', async () => {
    flags = { contextoUnico: true, ragNoChatDoSite: true };

    await processWebChatTurn({ sessionId: 's1', message: 'quanto custa a serra?', organizationId: ORG, history: [] } as any);

    expect(searchDetailed).toHaveBeenCalledWith(ORG, 'quanto custa a serra?', 5);
    expect(promptEnviado()).toContain('# Contexto recuperado (RAG)\n[catalogo.pdf] A serra circular custa R$ 890.');
  });

  it('base fora do ar vira o aviso honesto, não silêncio (A028)', async () => {
    flags = { contextoUnico: true, ragNoChatDoSite: true };
    searchDetailed.mockResolvedValue({ context: '', sources: [], status: 'servico_fora', fromCache: false });

    await processWebChatTurn({ sessionId: 's1', message: 'oi', organizationId: ORG, history: [] } as any);

    expect(promptEnviado()).toContain('base de conhecimento indisponível neste momento');
  });

  it('a Iza recebe os iza_facts entre a instrução de canal e o prompt', async () => {
    const IZA = 'cmo1ywwfe00ko1jskexiexsm4';
    orgFindUnique.mockResolvedValue({ settings: { businessName: 'ZappIQ' } });

    await processWebChatTurn({ sessionId: 's1', message: 'oi', organizationId: IZA, history: [] } as any);

    const prompt = promptEnviado();
    expect(prompt).toContain('# FATOS ATUAIS');
    expect(prompt.indexOf('# FATOS ATUAIS')).toBeGreaterThan(prompt.indexOf('# CANAL DE COMUNICAÇÃO'));
    expect(prompt.indexOf('# FATOS ATUAIS')).toBeLessThan(prompt.indexOf(PROMPT_DA_VERA));
    expect(prompt).toContain('zappiq.com.br');
  });

  it('sem agente vivo, o erro é o mesmo de antes', async () => {
    agentFindFirst.mockResolvedValue(null);

    await expect(
      processWebChatTurn({ sessionId: 's1', message: 'oi', organizationId: ORG, history: [] } as any),
    ).rejects.toBeInstanceOf(SystemPromptNaoEncontrado);
    expect(chatCompletionMock).not.toHaveBeenCalled();
  });

  it('erro de código no motor único não cala o visitante: cai no caminho de antes e registra', async () => {
    agentFindFirst.mockRejectedValue(new TypeError('coluna inexistente'));

    const res = await processWebChatTurn({ sessionId: 's1', message: 'oi', organizationId: ORG, history: [] } as any);

    expect(res.reply).toBe('Oi! Posso ajudar?');
    expect(promptEnviado()).toContain('PROMPT GRAVADO DA ORG (cache)');
    expect(loggerError).toHaveBeenCalledWith(
      expect.stringContaining('motor único falhou'),
      expect.objectContaining({ organizationId: ORG }),
    );
  });
});
