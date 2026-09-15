/* ══════════════════════════════════════════════════════════════════════
 * agentOrchestrator.saidaUnica.test.ts (C1b, Passo 12 parte B)
 * --------------------------------------------------------------------
 * WhatsApp e Instagram pelo pós-processador único (A189): a guarda de
 * marca roda sobre a resposta real e o caminho agêntico do Maestro passa
 * a extrair <reply> e a aplicar o filtro de voz.
 *
 * Tudo dublê: nenhum modelo, nenhum banco, nenhuma fila de verdade.
 * ══════════════════════════════════════════════════════════════════════ */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// O orquestrador importa o motor de fluxos, e o agendador dele cria a fila
// BullMQ no import. Fila falsa, o mesmo padrão dos PRs #375 e #377.
vi.mock('bullmq', () => ({
  Queue: class {
    add = vi.fn();
    on = vi.fn();
  },
  Worker: class {
    on = vi.fn();
  },
}));

const enforceAiReplyQuotaStub = vi.fn();
const getTrialLlmStageStub = vi.fn();
const assertTrialCostCapStub = vi.fn();
vi.mock('../middleware/planLimits.js', async (importOriginal) => {
  const actual = (await importOriginal()) as Record<string, unknown>;
  return {
    ...actual,
    enforceAiReplyQuota: (...a: unknown[]) => enforceAiReplyQuotaStub(...a),
    recordAttendanceShadow: vi.fn(async () => undefined),
    getTrialLlmStage: (...a: unknown[]) => getTrialLlmStageStub(...a),
    assertTrialCostCap: (...a: unknown[]) => assertTrialCostCapStub(...a),
    consumeTrialContactReplyBudget: vi.fn(async () => ({ allowed: true, count: 1 })),
  };
});
vi.mock('../config/env.js', () => ({
  env: { QUOTA_OVERAGE_MODE: 'audit_only', RESOURCE_LIMITS_MODE: 'audit_only', REDIS_URL: 'redis://x' },
}));

const prismaMock = {
  organization: { findUnique: vi.fn() },
  conversation: { findUnique: vi.fn(), updateMany: vi.fn() },
  message: { findMany: vi.fn(), create: vi.fn(), count: vi.fn(), updateMany: vi.fn() },
  contact: { findUnique: vi.fn(), update: vi.fn() },
  agent: { findFirst: vi.fn() },
  prefilterEvent: { create: vi.fn() },
  orgFeatureFlag: { findMany: vi.fn(), findUnique: vi.fn() },
  appointmentType: { findMany: vi.fn() },
  agentRule: { findMany: vi.fn() },
};
vi.mock('@zappiq/database', () => ({ prisma: prismaMock }));

vi.mock('../utils/logger.js', () => ({
  logger: { warn: vi.fn(), info: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));
vi.mock('../services/quotaOverageService.js', () => ({
  reportOverageMeterEvent: vi.fn(async () => ({ reported: false, skipped: 'mode_audit_only' })),
  estimateOverageBrl: (n: number) => n * 0.03,
}));

const cacheStore = new Map<string, string>();
const cacheGet = vi.fn(async (k: string) => cacheStore.get(k) ?? null);
vi.mock('../services/cloud/index.js', () => ({
  cache: {
    get: (...a: any[]) => (cacheGet as any)(...a),
    set: vi.fn(async (k: string, v: string) => {
      cacheStore.set(k, v);
      return true;
    }),
    del: vi.fn(async () => true),
    incrby: vi.fn(async () => 1),
    incrbyfloat: vi.fn(async () => 0),
    expire: vi.fn(async () => true),
    setNX: vi.fn(async () => true),
    mget: vi.fn(async () => []),
    ping: vi.fn(async () => true),
  },
}));

const sendReplyTextMock = vi.fn();
const sendReplyInteractiveMock = vi.fn();
vi.mock('../services/channelDispatcher.js', () => ({
  sendReplyText: (...a: unknown[]) => sendReplyTextMock(...(a as [])),
  sendReplyInteractive: (...a: unknown[]) => sendReplyInteractiveMock(...(a as [])),
  markIncomingAsRead: vi.fn(async () => undefined),
}));

const sendAudioMock = vi.fn();
vi.mock('../services/whatsappService.js', () => ({ sendAudio: (...a: unknown[]) => sendAudioMock(...(a as [])) }));
vi.mock('../services/ragService.js', () => ({
  searchDetailed: vi.fn(async () => ({ context: '', sources: [], status: 'sem_resultado' })),
}));

const classifyMock = vi.fn(async () => '{"intent":"faq","consulta":""}');
vi.mock('../services/llm/langchainClient.js', () => ({
  chatCompletion: vi.fn(),
  classify: (...a: unknown[]) => classifyMock(...(a as [])),
}));
vi.mock('../services/crmAutomationService.js', () => ({ syncContactToCrm: vi.fn(async () => undefined) }));

const routeIzaTurnMock = vi.fn();
vi.mock('../services/llm/izaTurnRouter.js', () => ({
  routeIzaTurn: (...a: unknown[]) => routeIzaTurnMock(...(a as [])),
}));
vi.mock('../services/llm/tools.js', () => ({ getToolsForContext: vi.fn(() => []) }));
vi.mock('../services/llm/LLMRouter.js', async (importOriginal) => {
  const real = (await importOriginal()) as Record<string, unknown>;
  return { ...real, llmRouter: { complete: vi.fn() } };
});
const transcribeAudioMock = vi.fn();
vi.mock('../services/llm/audioTranscription.js', () => ({
  transcribeAudio: (...a: unknown[]) => transcribeAudioMock(...(a as [])),
}));
vi.mock('../services/izaFactsService.js', () => ({
  getIzaFactsBlock: vi.fn(async () => ''),
  invalidateIzaFactsCache: vi.fn(),
}));
vi.mock('../services/llm/circuitBreaker.js', () => ({ evaluateCostBreaker: vi.fn(async () => false) }));

const resolveActiveFlowStepMock = vi.fn(async () => null as unknown);
vi.mock('./flowRuntime.js', () => ({
  resolveActiveFlowStep: (...a: unknown[]) => resolveActiveFlowStepMock(...(a as [])),
}));
vi.mock('./flowEffects.js', () => ({ executeFlowEffects: vi.fn(async () => undefined) }));
const runAgenticTurnMock = vi.fn();
vi.mock('./flowAiAgent.js', () => ({ runAgenticTurn: (...a: unknown[]) => runAgenticTurnMock(...(a as [])) }));
vi.mock('./webhookTool.js', () => ({
  buildWebhookToolDef: vi.fn((t: any) => ({ name: t.name, description: 'x', input_schema: {} })),
  executeWebhook: vi.fn(),
}));

const emitMock = vi.fn();
const ioMock = { to: vi.fn(() => ({ emit: emitMock })) };
vi.mock('../utils/socketRegistry.js', () => ({ getIo: vi.fn(() => ioMock) }));

const { processIncomingMessage } = await import('./agentOrchestrator.js');
const { TEXTO_SEGURO_AO_CLIENTE } = await import('./postProcessReply.js');
const { extractProductionReplyText } = await import('./replyText.js');
const { MACHIA_ORG_ID } = await import('../config/zappiqOrg.js');
const { AI_PAUSE_TTL_SECONDS } = await import('../routes/conversations.handoff.js');

/** Liga interruptores da organização na leitura única do turno. */
function ligarInterruptores(...flags: string[]) {
  prismaMock.orgFeatureFlag.findMany.mockResolvedValue(flags.map((flag) => ({ flag, enabled: true })));
}

function inputBase(over: Record<string, unknown> = {}) {
  return {
    organizationId: 'org-cliente',
    conversationId: 'conv-1',
    contactId: 'contact-1',
    contactPhone: '+5511999998888',
    contactName: 'Cliente Teste',
    messageContent: 'quanto custa a consultoria?',
    messageType: 'text',
    whatsappMessageId: 'wamid-in-1',
    orgSettings: { businessName: 'CMJ', agentName: 'Vera' },
    channel: 'whatsapp' as const,
    ...over,
  };
}

function respostaDoModelo(texto: string) {
  routeIzaTurnMock.mockResolvedValue({
    kind: 'llm',
    response: { text: texto, provider: 'g', model: 'm', latencyMs: 10 },
    intent: 'faq',
    escalated: false,
    tierUsed: 'GROWTH',
    llmCallsMade: 2,
  });
}

function textosEnviados(): string[] {
  return sendReplyTextMock.mock.calls.map((c) => String((c[0] as any).content ?? ''));
}

beforeEach(() => {
  vi.clearAllMocks();
  cacheStore.clear();
  delete process.env.IZA_AUTOREPLY_TEMPLATE;

  prismaMock.organization.findUnique.mockResolvedValue({
    plan: 'GROWTH',
    settings: {},
    whatsappPhoneNumberId: 'phone-1',
    whatsappAccessToken: null,
    trialStartedAt: null,
    trialEndsAt: null,
    isTrialActive: false,
    trialConverted: true,
    stripeSubscriptionId: 'sub_1',
  });
  prismaMock.conversation.findUnique.mockResolvedValue({ aiPaused: false, status: 'OPEN', assignedToId: null });
  prismaMock.conversation.updateMany.mockResolvedValue({ count: 1 });
  prismaMock.message.findMany.mockResolvedValue([]);
  prismaMock.message.create.mockImplementation(async (args: any) => ({
    id: `msg-${prismaMock.message.create.mock.calls.length}`,
    createdAt: new Date('2026-09-14T12:00:00Z'),
    ...args.data,
  }));
  prismaMock.message.count.mockResolvedValue(1);
  prismaMock.contact.findUnique.mockResolvedValue({ leadStatus: 'NEW', name: 'Cliente Teste', _count: {} });
  prismaMock.agent.findFirst.mockResolvedValue({ id: 'a1', name: 'Vera', systemPrompt: 'Você é a Vera, da CMJ.' });
  prismaMock.prefilterEvent.create.mockResolvedValue({ id: 'ev-1' });
  prismaMock.orgFeatureFlag.findMany.mockResolvedValue([]);
  prismaMock.orgFeatureFlag.findUnique.mockResolvedValue(null);
  prismaMock.appointmentType.findMany.mockResolvedValue([]);
  prismaMock.agentRule.findMany.mockResolvedValue([]);

  enforceAiReplyQuotaStub.mockResolvedValue({ allowed: true, mode: 'audit_only' });
  getTrialLlmStageStub.mockResolvedValue({ capped: false, stage: 'OTHER', capUsd: 0 });
  assertTrialCostCapStub.mockResolvedValue({ allowed: true, spentUsd: 0, capUsd: 15 });
  transcribeAudioMock.mockResolvedValue({ text: '', error: 'falhou', latencyMs: 1 });
  sendAudioMock.mockResolvedValue({ messages: [{ id: 'wamid-audio' }] });
  resolveActiveFlowStepMock.mockResolvedValue(null);
  classifyMock.mockResolvedValue('{"intent":"faq","consulta":""}');
  sendReplyTextMock.mockResolvedValue({ channel: 'whatsapp', externalMessageId: 'wamid-out' });
  sendReplyInteractiveMock.mockResolvedValue({ channel: 'whatsapp', externalMessageId: 'wamid-btn' });
  respostaDoModelo('A consultoria dura 3 meses.');
});

describe('Passo 1: WhatsApp pelo pós-processador único', () => {
  /** A frase real do CMJ que a revisão de 15/09 viu a guarda segurar. */
  const CMJ_USA_A_PLATAFORMA = 'Sim, nosso atendimento usa a plataforma ZappIQ';

  it('guarda DESLIGADA (padrão): a frase com a marca sai INTACTA e o alerta é registrado (rodada 1, item 1a)', async () => {
    respostaDoModelo(CMJ_USA_A_PLATAFORMA);
    await processIncomingMessage(inputBase());

    expect(textosEnviados()).toEqual([CMJ_USA_A_PLATAFORMA]);
    expect(prismaMock.prefilterEvent.create).toHaveBeenCalledTimes(1);
    expect(prismaMock.prefilterEvent.create.mock.calls[0][0].data).toMatchObject({
      organizationId: 'org-cliente',
      conversationId: 'conv-1',
      canal: 'whatsapp',
      categoria: 'guarda-de-marca',
      regra: 'ZappIQ',
      acao: 'alerta',
    });
  });

  it('guarda LIGADA (interruptor guardaDeMarca): sai a resposta segura, nunca o vazamento', async () => {
    ligarInterruptores('guardaDeMarca');
    respostaDoModelo('Aqui é a Vera, da ZappIQ, a plataforma que a CMJ usa.');
    await processIncomingMessage(inputBase());

    expect(textosEnviados()).toEqual([TEXTO_SEGURO_AO_CLIENTE]);
    expect(prismaMock.prefilterEvent.create).toHaveBeenCalledTimes(1);
    expect(prismaMock.prefilterEvent.create.mock.calls[0][0].data).toMatchObject({
      organizationId: 'org-cliente',
      conversationId: 'conv-1',
      canal: 'whatsapp',
      categoria: 'guarda-de-marca',
      regra: 'ZappIQ',
      acao: 'resposta_segura',
    });
  });

  it('Instagram: mesma guarda (ligada), canal registrado como instagram', async () => {
    ligarInterruptores('guardaDeMarca');
    respostaDoModelo('Somos da ZappIQ.');
    await processIncomingMessage(inputBase({ channel: 'instagram' }));

    expect(textosEnviados()).toEqual([TEXTO_SEGURO_AO_CLIENTE]);
    expect(prismaMock.prefilterEvent.create.mock.calls[0][0].data.canal).toBe('instagram');
  });

  it('Instagram com a guarda desligada: o texto sai intacto, só o alerta', async () => {
    respostaDoModelo('Somos da ZappIQ.');
    await processIncomingMessage(inputBase({ channel: 'instagram' }));

    expect(textosEnviados()).toEqual(['Somos da ZappIQ.']);
    expect(prismaMock.prefilterEvent.create.mock.calls[0][0].data).toMatchObject({ canal: 'instagram', acao: 'alerta' });
  });

  /* A MACHIA faz a ZappIQ (rodada 1, item 1b): o perfil vivo dela leva ao
   * prompt a resposta do questionário que cita a ZappIQ, e a resposta do
   * agente cita a ZappIQ de volta. Nada disso é vazamento. */
  const MACHIA_SETTINGS = {
    businessName: 'MACHIA',
    agentName: 'Mach',
    surveyAnswers: {
      identidade_empresa: {
        reg_pode_responder: 'As frentes e ofertas da MACHIA (Radar, Build, ZappIQ, Academy) e como contratar.',
      },
    },
  };
  const RESPOSTA_DA_MACHIA =
    'A MACHIA desenvolve a ZappIQ, nossa plataforma de atendimento com IA. Veja os planos em https://zappiq.com.br/precos';

  for (const guarda of ['desligada', 'ligada']) {
    it(`MACHIA (marca licenciada), guarda ${guarda}, perfil vivo citando a ZappIQ: a resposta sai inteira, sem alerta`, async () => {
      ligarInterruptores('perfilVivo', ...(guarda === 'ligada' ? ['guardaDeMarca'] : []));
      respostaDoModelo(RESPOSTA_DA_MACHIA);

      await processIncomingMessage(inputBase({ organizationId: MACHIA_ORG_ID, orgSettings: MACHIA_SETTINGS }));

      // O perfil vivo levou a resposta do questionário (com a ZappIQ) ao prompt.
      const prompt = String((routeIzaTurnMock.mock.calls[0][0] as any).systemPrompt);
      expect(prompt).toContain('Radar, Build, ZappIQ, Academy');
      expect(textosEnviados()).toEqual([extractProductionReplyText(RESPOSTA_DA_MACHIA)]);
      expect(textosEnviados()[0]).toMatch(/ZappIQ/);
      expect(prismaMock.prefilterEvent.create).not.toHaveBeenCalled();
    });
  }

  it('CMJ com o MESMO perfil vivo e a mesma frase: continua sendo alerta (a licença é da organização, não do texto)', async () => {
    ligarInterruptores('perfilVivo');
    respostaDoModelo(RESPOSTA_DA_MACHIA);
    await processIncomingMessage(inputBase({ orgSettings: { ...MACHIA_SETTINGS, businessName: 'CMJ', agentName: 'Vera' } }));
    expect(prismaMock.prefilterEvent.create).toHaveBeenCalledTimes(1);
    expect(prismaMock.prefilterEvent.create.mock.calls[0][0].data).toMatchObject({ regra: 'ZappIQ', acao: 'alerta' });
  });

  it('resposta limpa sai como sempre saiu, sem alerta', async () => {
    respostaDoModelo('Claro!\n<reply>A consultoria dura 3 meses.</reply>');
    await processIncomingMessage(inputBase());

    expect(textosEnviados()).toEqual(['A consultoria dura 3 meses.']);
    expect(prismaMock.prefilterEvent.create).not.toHaveBeenCalled();
  });

  it('caminho agêntico do Maestro: extrai <reply> e aplica o filtro de voz (antes saía cru)', async () => {
    resolveActiveFlowStepMock.mockResolvedValue({
      next: 'ai',
      effects: [],
      aiPrompt: 'Consulte o estoque.',
      aiTools: [{ type: 'webhook', name: 'estoque', url: 'https://x' }],
    });
    runAgenticTurnMock.mockResolvedValue({
      text: 'Temos sim.\n<reply>Temos sim \u2014 chegou ontem.</reply>',
      toolsUsed: ['estoque'],
    });

    await processIncomingMessage(inputBase());

    expect(routeIzaTurnMock).not.toHaveBeenCalled();
    expect(textosEnviados()).toEqual(['Temos sim, chegou ontem.']);
  });
});

/* ══════════════════════════════════════════════════════════════════════
 * Passo 2: toda saída que chama o envio grava a mensagem (A167, A193)
 * ══════════════════════════════════════════════════════════════════════ */

/** Quantas vezes o orquestrador mandou algo ao cliente, por qualquer via. */
function totalDeEnvios(): number {
  return (
    sendReplyTextMock.mock.calls.length +
    sendReplyInteractiveMock.mock.calls.length +
    sendAudioMock.mock.calls.length
  );
}

/** As mensagens OUTBOUND gravadas no turno. */
function registrosDeSaida(): any[] {
  return prismaMock.message.create.mock.calls
    .map((c: any[]) => c[0].data)
    .filter((d: any) => d.direction === 'OUTBOUND');
}

const CRISE = 'não aguento mais viver, não vejo sentido em continuar';

const SAIDAS: Array<{ nome: string; preparar: () => void; entrada?: Record<string, unknown> }> = [
  {
    nome: 'modo autoreply',
    preparar: () => {
      process.env.IZA_AUTOREPLY_TEMPLATE = 'Recebemos sua mensagem.';
    },
  },
  {
    nome: 'falha ao transcrever o áudio',
    preparar: () => undefined,
    entrada: { messageType: 'audio', mediaId: 'media-1' },
  },
  { nome: 'resposta a imagem (não texto)', preparar: () => undefined, entrada: { messageType: 'image' } },
  { nome: 'opt-out (SAIR)', preparar: () => undefined, entrada: { messageContent: 'SAIR' } },
  {
    nome: 'pedido de humano (aviso de transbordo)',
    preparar: () => classifyMock.mockResolvedValue('{"intent":"request_human","consulta":""}'),
    entrada: { messageContent: 'quero falar com um atendente' },
  },
  {
    nome: 'cap de custo do trial (mensagem degradada)',
    preparar: () => {
      getTrialLlmStageStub.mockResolvedValue({ capped: true, stage: 'TRIAL', capUsd: 15 });
      assertTrialCostCapStub.mockResolvedValue({ allowed: false, spentUsd: 16, capUsd: 15 });
    },
  },
  {
    nome: 'quota estourada com sinal de crise (acolhimento)',
    preparar: () =>
      enforceAiReplyQuotaStub.mockResolvedValue({ allowed: false, mode: 'enforce', current: 9, limit: 9, planId: 'GROWTH' }),
    entrada: { messageContent: CRISE },
  },
  {
    nome: 'caminho agêntico do Maestro',
    preparar: () => {
      resolveActiveFlowStepMock.mockResolvedValue({
        next: 'ai',
        effects: [],
        aiPrompt: 'Consulte o estoque.',
        aiTools: [{ type: 'webhook', name: 'estoque', url: 'https://x' }],
      });
      runAgenticTurnMock.mockResolvedValue({ text: 'Temos sim.', toolsUsed: ['estoque'] });
    },
  },
  {
    nome: 'vertical bloqueada (template do pré-filtro)',
    preparar: () =>
      routeIzaTurnMock.mockResolvedValue({
        kind: 'blocked',
        vertical: 'apostas',
        response: 'Não trabalhamos com isso.',
        matchedSnippet: 'aposta',
        action: 'recusa',
      }),
  },
  { nome: 'resposta normal do agente', preparar: () => undefined },
  {
    nome: 'resposta com botões',
    preparar: () => respostaDoModelo('Qual você prefere?<buttons>[{"id":"a","title":"Ver planos"}]</buttons>'),
  },
  {
    nome: 'resposta em áudio (TTS)',
    preparar: () => undefined,
    entrada: {
      messageType: 'audio',
      mediaId: 'media-1',
      orgSettings: {
        businessName: 'CMJ',
        agentName: 'Vera',
        whatsappPhoneNumberId: 'phone-1',
        voice_routing: { enabled: true, trigger: 'mirror_input' },
      },
    },
  },
  {
    nome: 'tag de transbordo na resposta (aviso + resposta)',
    preparar: () => respostaDoModelo('<reply>Vou chamar alguém da equipe.</reply><action>handoff</action>'),
  },
  {
    nome: 'erro geral do turno (aviso de erro técnico)',
    preparar: () => routeIzaTurnMock.mockRejectedValue(new Error('provedor fora')),
  },
];

vi.mock('../services/llm/textToSpeech.js', () => ({
  generateAndUploadSpeech: vi.fn(async () => ({ mediaId: 'tts-media', minutesEstimate: 0.1 })),
}));

describe('Passo 2: 0 envios sem registro', () => {
  for (const saida of SAIDAS) {
    it(`${saida.nome}: cada envio tem a sua mensagem gravada`, async () => {
      if (saida.nome === 'resposta em áudio (TTS)') {
        transcribeAudioMock.mockResolvedValue({ text: 'quanto custa?', latencyMs: 5 });
      }
      saida.preparar();

      await processIncomingMessage(inputBase(saida.entrada ?? {}));

      const envios = totalDeEnvios();
      expect(envios, 'o caminho precisa mandar alguma coisa').toBeGreaterThan(0);
      expect(registrosDeSaida().length, `envios=${envios}`).toBe(envios);
      for (const r of registrosDeSaida()) {
        expect(r).toMatchObject({ direction: 'OUTBOUND', isFromBot: true, conversationId: 'conv-1' });
        expect(String(r.content).length).toBeGreaterThan(0);
      }
    });
  }

  it('cada mensagem gravada vai para o Inbox em tempo real (new_message), uma vez', async () => {
    await processIncomingMessage(inputBase());
    const eventos = emitMock.mock.calls.filter((c: any[]) => c[0] === 'new_message');
    expect(eventos).toHaveLength(1);
    expect(eventos[0][1]).toMatchObject({
      conversationId: 'conv-1',
      message: { content: 'A consultoria dura 3 meses.', direction: 'OUTBOUND', isFromBot: true },
    });
    expect(eventos[0][1].message.id).toBeTruthy();
  });

  it('o registro guarda o id externo devolvido pelo canal (status de entrega alcança a IA)', async () => {
    await processIncomingMessage(inputBase());
    expect(registrosDeSaida()[0]).toMatchObject({ whatsappMessageId: 'wamid-out' });

    vi.clearAllMocks();
    sendReplyTextMock.mockResolvedValue({ channel: 'instagram', externalMessageId: 'ig-mid' });
    respostaDoModelo('Oi!');
    await processIncomingMessage(inputBase({ channel: 'instagram' }));
    expect(registrosDeSaida()[0]).toMatchObject({ externalMessageId: 'ig-mid' });
  });

  it('as quatro saídas do A167 gravam o texto exato que o cliente recebeu', async () => {
    const casos: Array<{ entrada: Record<string, unknown>; preparar?: () => void; texto: RegExp }> = [
      { entrada: { messageType: 'audio', mediaId: 'm' }, texto: /Não consegui processar seu áudio/ },
      { entrada: { messageType: 'document' }, texto: /Recebi seu documento/ },
      {
        entrada: { messageContent: 'quero falar com um atendente' },
        preparar: () => classifyMock.mockResolvedValue('{"intent":"request_human","consulta":""}'),
        texto: /especialistas/,
      },
      {
        entrada: {},
        preparar: () => routeIzaTurnMock.mockRejectedValue(new Error('provedor fora')),
        texto: /dificuldade técnica/,
      },
    ];
    for (const caso of casos) {
      vi.clearAllMocks();
      // O transbordo do caso anterior deixou a pausa no cache (é o que ele
      // deve fazer): cada caso começa de uma conversa sem pausa.
      cacheStore.clear();
      classifyMock.mockResolvedValue('{"intent":"faq","consulta":""}');
      respostaDoModelo('A consultoria dura 3 meses.');
      caso.preparar?.();
      await processIncomingMessage(inputBase(caso.entrada));
      const gravados = registrosDeSaida().map((r) => String(r.content));
      expect(gravados.some((t) => caso.texto.test(t)), `gravados: ${JSON.stringify(gravados)}`).toBe(true);
      expect(textosEnviados()).toEqual(gravados);
    }
  });
});

describe('Passo 2: o erro geral chama o transbordo de verdade (A193)', () => {
  beforeEach(() => {
    routeIzaTurnMock.mockRejectedValue(new Error('provedor fora'));
  });

  it('pausa TEMPORÁRIA (rodada 1, item 2): WAITING sem aiPaused no banco, espelho no cache por 1 hora, ANTES do aviso', async () => {
    const { cache } = await import('../services/cloud/index.js');
    await processIncomingMessage(inputBase());

    // O erro técnico é transitório (modelo 5xx, tempo do banco): pausar de
    // forma durável deixaria o cliente sem resposta até alguém clicar
    // "Retomar". A conversa vai para WAITING (a equipe vê), mas aiPaused
    // NÃO é gravado: passada 1 hora, a IA volta sozinha.
    expect(prismaMock.conversation.updateMany).toHaveBeenCalledTimes(1);
    const gravado = prismaMock.conversation.updateMany.mock.calls[0][0];
    expect(gravado).toMatchObject({ where: { id: 'conv-1', organizationId: 'org-cliente' }, data: { status: 'WAITING' } });
    expect(gravado.data).not.toHaveProperty('aiPaused');

    const setDaPausa = (cache.set as any).mock.calls.find((c: any[]) => String(c[0]).startsWith('ai_paused:'));
    expect(setDaPausa).toBeTruthy();
    expect(setDaPausa[0]).toBe('ai_paused:org-cliente:+5511999998888');
    expect(setDaPausa[2]).toBe(3600);

    const ordemDaPausa = prismaMock.conversation.updateMany.mock.invocationCallOrder[0];
    const ordemDoAviso = sendReplyTextMock.mock.invocationCallOrder[0];
    expect(ordemDaPausa).toBeLessThan(ordemDoAviso);
  });

  it('enquanto a pausa temporária vale (cache), a IA fica calada; passada 1 hora, com o cache vazio e sem aiPaused, volta a responder', async () => {
    await processIncomingMessage(inputBase());
    vi.clearAllMocks();
    respostaDoModelo('Voltei. A consultoria dura 3 meses.');

    // Dentro da hora: o espelho no cache segura.
    await processIncomingMessage(inputBase({ messageContent: 'alguém aí?' }));
    expect(routeIzaTurnMock).not.toHaveBeenCalled();

    // Passada a hora: o cache venceu e o banco não tem aiPaused (WAITING não pausa).
    cacheStore.clear();
    prismaMock.conversation.findUnique.mockResolvedValue({ aiPaused: false, status: 'WAITING', assignedToId: null });
    await processIncomingMessage(inputBase({ messageContent: 'alguém aí?' }));
    expect(routeIzaTurnMock).toHaveBeenCalledTimes(1);
    expect(textosEnviados()).toEqual(['Voltei. A consultoria dura 3 meses.']);
  });

  it('avisa a equipe (notificação) e manda UMA mensagem só: o aviso de erro técnico, gravado', async () => {
    await processIncomingMessage(inputBase());

    const notificacoes = emitMock.mock.calls.filter((c: any[]) => c[0] === 'notification');
    expect(notificacoes).toHaveLength(1);
    expect(notificacoes[0][1]).toMatchObject({ type: 'warning', title: 'Transbordo solicitado' });
    expect(textosEnviados()).toHaveLength(1);
    expect(textosEnviados()[0]).toMatch(/dificuldade técnica/);
    expect(registrosDeSaida()).toHaveLength(1);
  });

  it('banco fora no meio do transbordo não impede o aviso ao cliente', async () => {
    prismaMock.conversation.updateMany.mockRejectedValue(new Error('db down'));
    await processIncomingMessage(inputBase());
    expect(textosEnviados()).toHaveLength(1);
  });
});

describe('Passo 2: o transbordo não expira sozinho em 1 hora (A167)', () => {
  beforeEach(() => {
    classifyMock.mockResolvedValue('{"intent":"request_human","consulta":""}');
  });

  it('a pausa vai para o banco (aiPaused) e o espelho no cache não vence em 1 hora', async () => {
    const { cache } = await import('../services/cloud/index.js');

    await processIncomingMessage(inputBase({ messageContent: 'quero falar com um atendente' }));

    expect(prismaMock.conversation.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({ data: { status: 'WAITING', aiPaused: true } }),
    );
    const setDaPausa = (cache.set as any).mock.calls.find((c: any[]) => String(c[0]).startsWith('ai_paused:'));
    expect(setDaPausa).toBeTruthy();
    expect(setDaPausa[2]).toBeGreaterThan(3600);
    // Rodada 1, item 2: o pedido de humano segue DURÁVEL (7 dias no espelho,
    // aiPaused no banco); só o erro técnico virou pausa temporária.
    expect(setDaPausa[2]).toBe(AI_PAUSE_TTL_SECONDS);
    expect(prismaMock.conversation.updateMany.mock.calls[0][0].data).toEqual({ status: 'WAITING', aiPaused: true });
  });

  it('passada 1 hora, com o cache vazio, a IA continua calada: quem manda é conversation.aiPaused', async () => {
    cacheStore.clear();
    prismaMock.conversation.findUnique.mockResolvedValue({ aiPaused: true, status: 'WAITING', assignedToId: null });

    await processIncomingMessage(inputBase({ messageContent: 'alguém aí?' }));

    expect(routeIzaTurnMock).not.toHaveBeenCalled();
    expect(totalDeEnvios()).toBe(0);
  });
});

describe('rodada 1, item 3: resposta segurada pela guarda não executa ação, exceto o handoff', () => {
  const COM_NOME = '<action>set_contact_name</action><action_data>{"name":"Ana"}</action_data>Ana, usamos a ZappIQ.';

  it('guarda ligada e resposta trocada: set_contact_name NÃO grava o nome', async () => {
    ligarInterruptores('guardaDeMarca');
    respostaDoModelo(COM_NOME);
    await processIncomingMessage(inputBase());

    expect(textosEnviados()).toEqual([TEXTO_SEGURO_AO_CLIENTE]);
    const gravacoesDeNome = prismaMock.contact.update.mock.calls.filter((c: any[]) => c[0]?.data?.name !== undefined);
    expect(gravacoesDeNome).toEqual([]);
  });

  it('guarda ligada e resposta trocada: o handoff segue valendo (a IA pausa, a equipe é avisada)', async () => {
    ligarInterruptores('guardaDeMarca');
    respostaDoModelo('<action>handoff</action>Vou te passar para a equipe da ZappIQ.');
    await processIncomingMessage(inputBase());

    expect(prismaMock.conversation.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({ data: { status: 'WAITING', aiPaused: true } }),
    );
    const notificacoes = emitMock.mock.calls.filter((c: any[]) => c[0] === 'notification');
    expect(notificacoes).toHaveLength(1);
  });

  it('guarda desligada (padrão): o texto saiu como veio e a ação é executada', async () => {
    respostaDoModelo(COM_NOME);
    await processIncomingMessage(inputBase());

    expect(textosEnviados()).toEqual(['Ana, usamos a ZappIQ.']);
    expect(prismaMock.contact.update).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 'contact-1' }, data: { name: 'Ana' } }),
    );
  });
});

describe('Passo 2: amarra estática do orquestrador', () => {
  // O comportamento está provado acima, caminho por caminho. Esta amarra
  // impede que um caminho NOVO volte a enviar por fora da função que grava.
  it('o despachante só é chamado dentro de deliverAgentReply, e a gravação só em registrarSaidaDoAgente', async () => {
    const { readFileSync } = await import('node:fs');
    const { fileURLToPath } = await import('node:url');
    const codigo = readFileSync(fileURLToPath(new URL('./agentOrchestrator.ts', import.meta.url)), 'utf8')
      .replace(/\/\*[\s\S]*?\*\//g, '')
      .replace(/(^|[^:])\/\/.*$/gm, '$1');

    const corpo = (nome: string) => {
      const inicio = codigo.indexOf(`export async function ${nome}(`);
      const fim = codigo.indexOf('\n}\n', inicio);
      return codigo.slice(inicio, fim);
    };
    const contar = (texto: string, re: RegExp) => (texto.match(re) ?? []).length;

    const envio = /\bsendReply(Text|Interactive)\(/g;
    expect(contar(codigo, envio)).toBe(contar(corpo('deliverAgentReply'), envio));
    const gravacao = /prisma\.message\.create\(/g;
    expect(contar(codigo, gravacao)).toBe(1);
    expect(contar(corpo('registrarSaidaDoAgente'), gravacao)).toBe(1);
    // O áudio (TTS) é o único envio fora do despachante, e grava logo em seguida.
    const depoisDoAudio = codigo.slice(codigo.indexOf('waService.sendAudio('));
    expect(depoisDoAudio.indexOf('registrarSaidaDoAgente(')).toBeGreaterThan(0);
    expect(depoisDoAudio.indexOf('registrarSaidaDoAgente(')).toBeLessThan(600);
  });
});

/* ══════════════════════════════════════════════════════════════════════
 * Nota 1 da revisão de 14/09: um turno lê os interruptores UMA vez.
 * ══════════════════════════════════════════════════════════════════════ */

describe('nota 1: leitura única dos interruptores por turno', () => {
  /** As idas ao cache atrás de interruptor (chave por interruptor ou a única). */
  function leiturasDeInterruptor(): string[] {
    return cacheGet.mock.calls.map((c: any[]) => String(c[0])).filter((k) => k.startsWith('zappiq:flag'));
  }

  it('turno normal do WhatsApp, tudo desligado: 1 leitura, na chave única', async () => {
    await processIncomingMessage(inputBase());

    expect(leiturasDeInterruptor()).toEqual(['zappiq:flags:org-cliente']);
    expect(prismaMock.orgFeatureFlag.findUnique).not.toHaveBeenCalled();
    expect(prismaMock.orgFeatureFlag.findMany).toHaveBeenCalledTimes(1);
  });

  it('com os quatro interruptores do turno ligados (motor único, perfil vivo, regras e política): ainda 1 leitura', async () => {
    prismaMock.orgFeatureFlag.findMany.mockResolvedValue(
      ['contextoUnico', 'perfilVivo', 'regrasComoRegistros', 'modeloPorPolitica'].map((flag) => ({
        flag,
        enabled: true,
      })),
    );
    prismaMock.agent.findFirst.mockResolvedValue({
      id: 'a1',
      name: 'Vera',
      role: 'comercial',
      systemPrompt: 'Você é a Vera, da CMJ.',
    });

    await processIncomingMessage(inputBase());

    expect(leiturasDeInterruptor()).toEqual(['zappiq:flags:org-cliente']);
    expect(prismaMock.orgFeatureFlag.findUnique).not.toHaveBeenCalled();
    // Os interruptores valeram: o motor único montou (regras consultadas pelo
    // agente do turno) e a resposta saiu.
    expect(prismaMock.agentRule.findMany).toHaveBeenCalled();
    expect(textosEnviados()).toEqual(['A consultoria dura 3 meses.']);
  });

  it('Redis fora: uma tentativa só no turno, e o turno responde com tudo desligado', async () => {
    cacheGet.mockImplementation(async (k: string) => {
      if (String(k).startsWith('zappiq:flag')) throw new Error('redis down');
      return cacheStore.get(k) ?? null;
    });

    await processIncomingMessage(inputBase());

    expect(leiturasDeInterruptor()).toHaveLength(1);
    expect(textosEnviados()).toEqual(['A consultoria dura 3 meses.']);
    cacheGet.mockImplementation(async (k: string) => cacheStore.get(k) ?? null);
  });
});
