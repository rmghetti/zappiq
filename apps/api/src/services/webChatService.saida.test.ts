/* ══════════════════════════════════════════════════════════════════════
 * Chat do site: a saída passa pelo pós-processador único (C1b, A189).
 * --------------------------------------------------------------------
 * O chat do site limpava a resposta por conta própria: sem filtro de voz
 * (3 de 4 respostas do CMJ em setembro saíram com travessão), sem guarda
 * de marca e jogando fora a tag de transbordo. Aqui a prova de que ele usa
 * o MESMO pós-processador do WhatsApp.
 *
 * Tudo dublê: nenhum modelo, nenhum banco real.
 * ══════════════════════════════════════════════════════════════════════ */

import { describe, it, expect, vi, beforeEach } from 'vitest';

const chatCompletionMock = vi.fn();
const messageCreate = vi.fn(async (args: any) => ({ id: 'msg-1', ...args.data }));
const prefilterCreate = vi.fn(async () => ({ id: 'ev-1' }));
const orgFindUnique = vi.fn();

vi.mock('@zappiq/database', () => ({
  prisma: {
    contact: { upsert: vi.fn(async () => ({ id: 'contato-1' })) },
    conversation: {
      findFirst: vi.fn(async () => ({ id: 'conversa-1' })),
      findUnique: vi.fn(async () => ({ aiPaused: false })),
      create: vi.fn(async () => ({ id: 'conversa-1' })),
      updateMany: vi.fn(async () => ({ count: 1 })),
    },
    message: {
      create: (...a: any[]) => (messageCreate as any)(...a),
      findMany: vi.fn(async () => []),
    },
    organization: { findUnique: (...a: any[]) => orgFindUnique(...a) },
    agent: {
      findFirst: vi.fn(async () => ({ id: 'a1', name: 'Vera', role: 'comercial', systemPrompt: 'Você é a Vera.' })),
    },
    agentRule: { findMany: vi.fn(async () => []) },
    orgFeatureFlag: { findMany: vi.fn(async () => []), findUnique: vi.fn(async () => null) },
    prefilterEvent: { create: (...a: any[]) => (prefilterCreate as any)(...a) },
    $queryRawUnsafe: vi.fn(async () => [{ system_prompt: 'Você é a Vera.' }]),
  },
}));
vi.mock('./cloud/index.js', () => ({
  cache: {
    get: vi.fn(async () => null),
    set: vi.fn(async () => true),
    del: vi.fn(async () => true),
    setNX: vi.fn(async () => true),
    incrby: vi.fn(async () => 1),
    expire: vi.fn(async () => true),
  },
}));
vi.mock('../utils/socketRegistry.js', () => ({ getIo: vi.fn(() => undefined) }));
vi.mock('./llm/langchainClient.js', () => ({
  chatCompletion: (...a: any[]) => chatCompletionMock(...a),
}));
vi.mock('./izaFactsService.js', () => ({
  getIzaFactsBlock: vi.fn(async () => ''),
  invalidateIzaFactsCache: vi.fn(),
}));
vi.mock('../utils/logger.js', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

const { processWebChatTurn } = await import('./webChatService.js');
const { TEXTO_SEGURO_AO_CLIENTE } = await import('../agents/postProcessReply.js');

const ORG = 'org-do-cmj';

function responde(texto: string) {
  chatCompletionMock.mockResolvedValue({ text: texto, inputTokens: 1, outputTokens: 1, provider: 'p', model: 'm' });
}

/** A última mensagem OUTBOUND gravada na conversa. */
function outboundGravada(): any {
  const outs = messageCreate.mock.calls.map((c: any[]) => c[0].data).filter((d: any) => d.direction === 'OUTBOUND');
  return outs[outs.length - 1];
}

beforeEach(() => {
  vi.clearAllMocks();
  orgFindUnique.mockResolvedValue({ settings: { agentName: 'Vera', businessName: 'CMJ' } });
});

describe('o chat do site usa o pós-processador único', () => {
  it('o filtro de voz vale no site: sem travessão e sem conectivo de redação', async () => {
    responde('Temos turmas \u2014 inclusive aos sábados. No entanto, as vagas acabam rápido.');
    const r = await processWebChatTurn({ sessionId: 's1', message: 'tem turma?', organizationId: ORG });
    expect(r.reply).not.toContain('\u2014');
    expect(r.reply).toBe('Temos turmas, inclusive aos sábados. Mas as vagas acabam rápido.');
    expect(outboundGravada().content).toBe(r.reply);
  });

  it('com <reply>, sai só o conteúdo dele', async () => {
    responde('Oi! A consultoria dura 3 meses.\n<reply>A consultoria dura 3 meses.</reply>');
    const r = await processWebChatTurn({ sessionId: 's1', message: 'quanto dura?', organizationId: ORG });
    expect(r.reply).toBe('A consultoria dura 3 meses.');
  });

  it('cliente cuja agente se chama Iza: o nome dela não é vazamento (as settings só são lidas quando a guarda dispara)', async () => {
    orgFindUnique.mockResolvedValue({ settings: { agentName: 'Iza', businessName: 'Clínica Luz' } });
    responde('Oi! Sou a Iza, da Clínica Luz.');
    const r = await processWebChatTurn({ sessionId: 's1', message: 'oi', organizationId: ORG });
    expect(r.reply).toBe('Oi! Sou a Iza, da Clínica Luz.');
    expect(prefilterCreate).not.toHaveBeenCalled();
  });

  it('marca da ZappIQ na resposta de um cliente: o visitante recebe a resposta segura e o alerta é registrado', async () => {
    responde('Aqui é a Vera, da ZappIQ, a plataforma que a CMJ usa.');
    const r = await processWebChatTurn({ sessionId: 's1', message: 'quem é você?', organizationId: ORG });
    expect(r.reply).toBe(TEXTO_SEGURO_AO_CLIENTE);
    expect(outboundGravada().content).toBe(TEXTO_SEGURO_AO_CLIENTE);
    expect(prefilterCreate).toHaveBeenCalledTimes(1);
    expect((prefilterCreate.mock.calls[0] as any[])[0].data).toMatchObject({
      organizationId: ORG,
      conversationId: 'conversa-1',
      canal: 'site',
      categoria: 'guarda-de-marca',
      regra: 'ZappIQ',
      acao: 'resposta_segura',
    });
  });
});
