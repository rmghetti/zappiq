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
const conversationUpdateMany = vi.fn(async () => ({ count: 1 }));
const contactUpsert = vi.fn(async () => ({ id: 'contato-1' }));
const prefilterCreate = vi.fn(async () => ({ id: 'ev-1' }));
const orgFindUnique = vi.fn();

vi.mock('@zappiq/database', () => ({
  prisma: {
    contact: { upsert: (...a: any[]) => (contactUpsert as any)(...a) },
    conversation: {
      findFirst: vi.fn(async () => ({ id: 'conversa-1' })),
      findUnique: vi.fn(async () => ({ aiPaused: false })),
      create: vi.fn(async () => ({ id: 'conversa-1' })),
      updateMany: (...a: any[]) => (conversationUpdateMany as any)(...a),
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
const emitOrg = vi.fn();
const ioFalso = { to: vi.fn(() => ({ emit: emitOrg })) };
vi.mock('../utils/socketRegistry.js', () => ({ getIo: vi.fn(() => ioFalso) }));
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
  contactUpsert.mockResolvedValue({ id: 'contato-1' });
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

/* ══════════════════════════════════════════════════════════════════════
 * Passo 3: a tag de transbordo no chat do site vira transbordo de verdade
 * (A169). Antes era jogada fora: quem pedia uma pessoa ouvia "vou te
 * transferir" e nada acontecia.
 * ══════════════════════════════════════════════════════════════════════ */

describe('Passo 3: transbordo de verdade no chat do site', () => {
  it('a tag de handoff pausa a IA no banco, marca WAITING e avisa a equipe', async () => {
    responde('<reply>Vou chamar alguém da equipe para falar com você.</reply><action>handoff</action>');

    const r = await processWebChatTurn({ sessionId: 'sessao-1', message: 'quero falar com uma pessoa', organizationId: ORG });

    expect(r.reply).toBe('Vou chamar alguém da equipe para falar com você.');
    expect(r.transbordo).toBe(true);
    expect(conversationUpdateMany).toHaveBeenCalledWith({
      where: { contactId: 'contato-1', organizationId: ORG, status: { in: ['OPEN', 'ASSIGNED'] } },
      data: { status: 'WAITING', aiPaused: true },
    });
    const notificacoes = emitOrg.mock.calls.filter((c: any[]) => c[0] === 'notification');
    expect(notificacoes).toHaveLength(1);
    expect(notificacoes[0][1]).toMatchObject({
      type: 'warning',
      title: 'Transbordo solicitado',
      conversationId: 'conversa-1',
    });
    expect(String(notificacoes[0][1].message)).toMatch(/chat do site/);
  });

  it('a resposta que avisou o visitante fica gravada ANTES da pausa', async () => {
    responde('<reply>Vou chamar alguém da equipe.</reply><action>handoff</action>');
    await processWebChatTurn({ sessionId: 'sessao-1', message: 'atendente', organizationId: ORG });

    expect(outboundGravada().content).toBe('Vou chamar alguém da equipe.');
    const ordemDaGravacao = Math.max(...messageCreate.mock.invocationCallOrder);
    expect(conversationUpdateMany.mock.invocationCallOrder[0]).toBeGreaterThan(ordemDaGravacao);
  });

  it('tag de handoff sem texto: o visitante recebe a mensagem de espera do dono', async () => {
    orgFindUnique.mockResolvedValue({
      settings: { agentName: 'Vera', businessName: 'CMJ', handoffMessage: 'Já chamei a equipe da CMJ, um instante.' },
    });
    responde('<action>handoff</action>');

    const r = await processWebChatTurn({ sessionId: 'sessao-1', message: 'atendente', organizationId: ORG });

    expect(r.reply).toBe('Já chamei a equipe da CMJ, um instante.');
    expect(outboundGravada().content).toBe('Já chamei a equipe da CMJ, um instante.');
  });

  it('sem conversa no CRM (lead falhou), a resposta sai e nada é pausado', async () => {
    contactUpsert.mockRejectedValue(new Error('db down'));
    responde('<reply>Vou chamar alguém.</reply><action>handoff</action>');

    const r = await processWebChatTurn({ sessionId: 'sessao-1', message: 'atendente', organizationId: ORG });

    expect(r.reply).toBe('Vou chamar alguém.');
    expect(r.transbordo).toBeFalsy();
    expect(conversationUpdateMany).not.toHaveBeenCalled();
  });

  it('resposta sem tag de handoff não mexe na conversa', async () => {
    responde('A consultoria dura 3 meses.');
    const r = await processWebChatTurn({ sessionId: 'sessao-1', message: 'quanto dura?', organizationId: ORG });
    expect(r.transbordo).toBeFalsy();
    expect(conversationUpdateMany).not.toHaveBeenCalled();
  });
});
