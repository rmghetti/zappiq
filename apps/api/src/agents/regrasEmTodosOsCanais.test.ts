/* ══════════════════════════════════════════════════════════════════════
 * As regras aprovadas pelo dono em TODOS os canais do motor único.
 * --------------------------------------------------------------------
 * Rodada 2 do PR #377 (C1a), item 4. O PR #375 transformou a correção
 * aprovada em registro (agent_rules), montado no bloco
 * "# Regras aprovadas pelo dono" atrás de `regrasComoRegistros`. O motor
 * único (`contextoUnico`) reservava o lugar do bloco e não o preenchia: a
 * organização com os DOIS interruptores perdia as regras em todos os canais.
 *
 * Teste de ponta, pelos pontos de entrada de produção, com dublês só na
 * borda (banco, interruptores, modelo, base): nada de LLM, rede ou banco
 * real. O `system` de cada canal é o que chega ao modelo, capturado no dublê.
 *
 *   WhatsApp ........ buildAgentContextForContact (o que o turno usa)
 *   Testar minha IA . buildAgentContextForContact com o contato da sessão,
 *                     como a rota do playground chama (aiTraining.ts)
 *   Chat do site .... processWebChatTurn (system capturado no chatCompletion)
 *   Qualidade ....... executeRunJob (a fila), system capturado no llmRouter
 *   Re-teste ........ rota POST /runs/:runId/scenarios/:scenarioId/re-test
 *   Retomada ........ generateAiResumeReply (o Maestro passa pelo motor único)
 *
 * Com os dois ligados, todos têm o bloco com o texto da regra. Com os dois
 * desligados, cada um é byte a byte o que o caminho de antes monta, e a
 * tabela de regras nem é consultada.
 * ══════════════════════════════════════════════════════════════════════ */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const {
  isFlagOn,
  complete,
  chatCompletion,
  agentFindFirst,
  contactFindUnique,
  messageCount,
  orgFindUnique,
  agentRuleFindMany,
  queryRawUnsafe,
  runFindUnique,
  runFindFirst,
  runUpdate,
  runUpdateMany,
  runCreate,
} = vi.hoisted(() => ({
  isFlagOn: vi.fn(),
  complete: vi.fn(),
  chatCompletion: vi.fn(),
  agentFindFirst: vi.fn(),
  contactFindUnique: vi.fn(),
  messageCount: vi.fn(),
  orgFindUnique: vi.fn(),
  agentRuleFindMany: vi.fn(),
  queryRawUnsafe: vi.fn(),
  runFindUnique: vi.fn(),
  runFindFirst: vi.fn(),
  runUpdate: vi.fn(),
  runUpdateMany: vi.fn(),
  runCreate: vi.fn(),
}));

vi.mock('@zappiq/database', () => ({
  prisma: {
    agent: { findFirst: (...a: any[]) => agentFindFirst(...a) },
    contact: {
      findUnique: (...a: any[]) => contactFindUnique(...a),
      upsert: vi.fn(async () => ({ id: 'contato-1' })),
    },
    message: {
      count: (...a: any[]) => messageCount(...a),
      create: vi.fn(async () => ({ id: 'msg-1' })),
      findMany: vi.fn(async () => []),
    },
    conversation: {
      findFirst: vi.fn(async () => ({ id: 'conversa-1' })),
      create: vi.fn(async () => ({ id: 'conversa-1' })),
      // O chat do site lê aiPaused; a retomada lê o contato da conversa.
      findUnique: vi.fn(async () => ({
        aiPaused: false,
        contactId: 'contato-1',
        contact: { phone: '5511999999999' },
      })),
    },
    organization: { findUnique: (...a: any[]) => orgFindUnique(...a) },
    appointmentType: { findMany: vi.fn(async () => []) },
    agentRule: { findMany: (...a: any[]) => agentRuleFindMany(...a) },
    agentEvalRun: {
      findUnique: (...a: any[]) => runFindUnique(...a),
      findFirst: (...a: any[]) => runFindFirst(...a),
      update: (...a: any[]) => runUpdate(...a),
      updateMany: (...a: any[]) => runUpdateMany(...a),
      create: (...a: any[]) => runCreate(...a),
    },
    agentEvalFixDecision: { findFirst: vi.fn(async () => null) },
    agentPromptVersion: { findFirst: vi.fn(async () => null) },
    kBDocument: { findMany: vi.fn(async () => []) },
    QAPair: { findMany: vi.fn(async () => []) },
    $queryRawUnsafe: (...a: any[]) => queryRawUnsafe(...a),
  },
}));

// Os interruptores: cada caso liga só os seus.
vi.mock('../services/featureFlags.js', () => ({
  isFlagOn: (...a: any[]) => isFlagOn(...a),
}));

// O modelo: parcial de propósito (a política lê constantes do roteador real).
vi.mock('../services/llm/LLMRouter.js', async (importOriginal) => {
  const real = (await importOriginal()) as Record<string, unknown>;
  return { ...real, llmRouter: { complete: (...a: any[]) => complete(...a) } };
});
vi.mock('../services/llm/intentClassifier.js', async (importOriginal) => {
  const real = (await importOriginal()) as Record<string, unknown>;
  return { ...real, classifyIntent: vi.fn(async () => 'normal'), shouldEscalateToSonnet: vi.fn(() => false) };
});
vi.mock('../services/llm/langchainClient.js', () => ({
  chatCompletion: (...a: any[]) => chatCompletion(...a),
}));

// A base de conhecimento: sem resultado, sem rede.
vi.mock('../services/ragService.js', () => ({
  searchDetailed: vi.fn(async () => ({ context: '', sources: [], status: 'sem_resultado', fromCache: false })),
  searchWithSources: vi.fn(async () => ({ context: '', sources: [] })),
  search: vi.fn(async () => ''),
  namespaceFor: (id: string) => `org_${id}`,
}));
vi.mock('../services/aiReadinessService.js', () => ({ countRagChunksByNamespaceOrNull: vi.fn() }));
vi.mock('../services/izaFactsService.js', () => ({
  getIzaFactsBlock: vi.fn(async () => ''),
  invalidateIzaFactsCache: vi.fn(),
}));
vi.mock('../services/cloud/index.js', () => ({
  cache: {
    setNX: vi.fn(async () => true),
    incrby: vi.fn(async () => 1),
    expire: vi.fn(async () => true),
    get: vi.fn(async () => null),
    set: vi.fn(async () => true),
    del: vi.fn(async () => true),
  },
}));
vi.mock('../utils/socketRegistry.js', () => ({ getIo: vi.fn(() => null) }));
vi.mock('../utils/redis.js', () => ({ default: {}, redis: {} }));

// O import do orquestrador alcança o flowScheduler, que cria a fila BullMQ
// no import. Fila falsa (o mesmo padrão do PR #375).
vi.mock('bullmq', () => ({
  Queue: class {
    add = vi.fn();
    on = vi.fn();
  },
  Worker: class {
    on = vi.fn();
  },
  DelayedError: class extends Error {},
}));

// A rota do re-teste: sem autenticação e sem cota de verdade.
vi.mock('../middleware/auth.js', () => ({
  authMiddleware: (_req: any, _res: any, next: any) => next(),
  requireRole: vi.fn(() => (_req: any, _res: any, next: any) => next()),
}));
vi.mock('../middleware/cotaDiaria.js', () => ({
  cotaDiaria: vi.fn(() => (_req: any, _res: any, next: any) => next()),
}));

// A Qualidade: um cenário só, o perfil da organização testada e sem alerta.
const CENARIO = {
  id: 'cr7_no_invent_preco_desconto',
  category: 'cr7_no_invent',
  description: 'desconto só no PIX',
  userMessage: 'tem desconto?',
  expectedBehavior: 'não inventa desconto',
  severity: 'high',
};
vi.mock('../agents/agentEvalSet.js', async (importOriginal) => {
  const real = (await importOriginal()) as Record<string, unknown>;
  return { ...real, resolveEvalSet: vi.fn(() => [CENARIO]) };
});
vi.mock('../agents/tenantAgentProfile.js', async (importOriginal) => {
  const real = (await importOriginal()) as Record<string, unknown>;
  return {
    ...real,
    resolveTenantAgentProfile: vi.fn(async () => ({
      organizationId: 'org-do-cmj',
      isZappIQ: false,
      agentName: 'Vera',
      businessName: 'CMJ',
      niche: 'servicos_b2b',
    })),
  };
});
vi.mock('../services/agentEvalCronService.js', () => ({
  notifySlackQualityIssue: vi.fn(),
  shouldAlertQuality: vi.fn(() => false),
  scenariosFailingTwice: vi.fn(() => []),
}));

vi.mock('../utils/logger.js', () => ({
  logger: { warn: vi.fn(), info: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

const { buildAgentContextForContact } = await import('./agentOrchestrator.js');
const { processWebChatTurn, buildWebChatSystemPrompt } = await import('../services/webChatService.js');
const { executeRunJob } = await import('../services/agentEvalQueue.js');
const { buildEvalSystemPrompt } = await import('../services/agentEvalRunner.js');
const { default: rotasDaQualidade } = await import('../routes/agentQuality.js');
const { generateAiResumeReply, buildAiResumePrompt } = await import('./flowAiResume.js');
const { loadBusinessContext } = await import('./flowGenerator.js');
const { composeAgentContext } = await import('./composeAgentContext.js');
const { buildTenantLinksBlock } = await import('./tenantConversionUrls.js');
const { TITULO_BLOCO_DE_REGRAS } = await import('./regrasDoAgente.js');

/* ── O tenant ─────────────────────────────────────────────────────── */

const ORG = 'org-do-cmj';
const AGORA = new Date('2026-09-16T17:00:00Z');
const PROMPT_DA_VERA = '## IDENTIDADE\nVocê é Vera, atendente virtual da CMJ.';
const PROMPT_GRAVADO_DO_SITE = PROMPT_DA_VERA; // o SQL cru do chat do site lê o mesmo agente
const SETTINGS = {
  agentName: 'Vera',
  businessName: 'CMJ',
  greetingMessage: 'Olá! Aqui é a Vera, da CMJ.',
  surveyAnswers: { identidade_empresa: { ide_site_url: 'cmj.com.br' } },
};
const AGENTE = {
  id: 'agente-vera',
  name: 'Vera',
  role: 'comercial',
  systemPrompt: PROMPT_DA_VERA,
  organizationId: ORG,
};
const REGRA = {
  id: 'regra-1',
  organizationId: ORG,
  agentId: 'agente-vera',
  scenarioId: 'cr7_no_invent_preco_desconto',
  texto: 'Desconto só no PIX, até 5%. Acima disso, chame um especialista.',
  origem: 'sugestao_ia',
  status: 'ativa',
  createdAt: new Date('2026-09-12T12:00:00Z'),
};
const TEXTO_DA_REGRA = `1. ${REGRA.texto}`;

let flags: Record<string, boolean> = {};
const ligar = (...nomes: string[]) => {
  flags = Object.fromEntries(nomes.map((n) => [n, true]));
};

function respostaDoModelo(req: any) {
  // O juiz roda a temperatura 0; o agente, a 0,3 (runner) ou 0,6 (retomada).
  const ehJuiz = req?.temperature === 0;
  return {
    text: ehJuiz ? '{"passed": true, "confidence": 90, "reason": "ok"}' : '<reply>Olá! Posso ajudar?</reply>',
    provider: 'anthropic-sonnet',
    model: 'claude',
    latencyMs: 1,
    attempt: 1,
    usage: { inputTokens: 1, outputTokens: 1 },
    stopReason: 'end_turn',
  };
}

/** Os `system` que o AGENTE recebeu (o juiz fica de fora). */
function systemsDoAgente(): string[] {
  return complete.mock.calls
    .map((c: any[]) => c[0])
    .filter((req: any) => req?.temperature !== 0)
    .map((req: any) => String(req.system));
}

beforeEach(() => {
  vi.clearAllMocks();
  // Só a data é falsa: o '# Agora' do caminho de antes lê new Date().
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(AGORA);
  flags = {};
  isFlagOn.mockImplementation(async (_o: string, f: string) => flags[f] === true);
  complete.mockImplementation(async (req: any) => respostaDoModelo(req));
  chatCompletion.mockResolvedValue({ text: 'Oi! Posso ajudar?', inputTokens: 1, outputTokens: 1, provider: 'anthropic', model: 'sonnet' });
  agentFindFirst.mockResolvedValue(AGENTE);
  // Só o contato do lead existe; o contato sintético do playground não.
  contactFindUnique.mockImplementation(async (args: any) =>
    args?.where?.id === 'contato-1' ? { leadStatus: 'NEW', name: 'João', _count: {} } : null,
  );
  messageCount.mockResolvedValue(3);
  orgFindUnique.mockResolvedValue({ id: ORG, name: 'CMJ', plan: 'GROWTH', settings: SETTINGS });
  agentRuleFindMany.mockResolvedValue([REGRA]);
  queryRawUnsafe.mockResolvedValue([{ system_prompt: PROMPT_GRAVADO_DO_SITE }]);
  runFindUnique.mockResolvedValue({
    id: 'run-1',
    status: 'pending',
    triggeredBy: 'client_manual',
    scenarioFilter: null,
    agentId: AGENTE.id,
    agent: { ...AGENTE, organization: { name: 'CMJ' } },
  });
  runFindFirst.mockImplementation(async (args: any) =>
    // O re-teste carrega a execução pelo id e pela organização.
    args?.where?.id === 'run-1'
      ? { id: 'run-1', agentId: AGENTE.id, agent: { ...AGENTE } }
      : null,
  );
  runUpdate.mockResolvedValue({});
  runUpdateMany.mockResolvedValue({ count: 1 });
  runCreate.mockResolvedValue({ id: 'reteste-1' });
});

afterEach(() => {
  vi.useRealTimers();
});

/* ── Os seis pontos de entrada ────────────────────────────────────── */

async function systemDoWhatsApp() {
  return buildAgentContextForContact({
    origem: 'whatsapp',
    organizationId: ORG,
    contactId: 'contato-1',
    contactPhone: '5511999999999',
    orgSettings: SETTINGS,
    ragContext: '',
    ragStatus: 'sem_resultado',
    temHistoricoNoContexto: true,
  });
}

/** Os mesmos argumentos que a rota do Testar minha IA passa (aiTraining.ts). */
async function systemDoPlayground() {
  return buildAgentContextForContact({
    origem: 'playground',
    organizationId: ORG,
    contactId: `playground:${ORG}`,
    orgSettings: SETTINGS,
    ragContext: '',
    ragStatus: 'sem_resultado',
    contato: { nome: null, leadStatus: 'NEW', primeiroContato: true, totalMensagens: 1 },
    temHistoricoNoContexto: false,
  });
}

async function systemDoSite(): Promise<string> {
  await processWebChatTurn({ sessionId: 's1', message: 'tem desconto?', organizationId: ORG, history: [] } as any);
  expect(chatCompletion).toHaveBeenCalledTimes(1);
  return String(chatCompletion.mock.calls[0][0]);
}

async function systemDaQualidade(): Promise<string[]> {
  await executeRunJob('run-1');
  return systemsDoAgente();
}

async function systemDoReteste(): Promise<string[]> {
  const pilha = (rotasDaQualidade as any).stack.find(
    (l: any) => l.route?.path === '/runs/:runId/scenarios/:scenarioId/re-test' && l.route.methods.post,
  );
  const handler = pilha.route.stack[pilha.route.stack.length - 1].handle;
  const res: any = { statusCode: 200 };
  res.status = (c: number) => ((res.statusCode = c), res);
  res.json = (b: any) => ((res.body = b), res);
  await handler(
    {
      user: { userId: 'u1', organizationId: ORG, role: 'ADMIN' },
      params: { runId: 'run-1', scenarioId: CENARIO.id },
      body: {},
    },
    res,
  );
  expect(res.statusCode).toBe(200);
  expect(res.body.amostras).toHaveLength(3);
  return systemsDoAgente();
}

async function systemDaRetomada(): Promise<string> {
  const texto = await generateAiResumeReply({
    organizationId: ORG,
    conversationId: 'conversa-1',
    aiPrompt: 'Retome a conversa sobre o desconto.',
  });
  expect(texto).toBeTruthy();
  expect(complete).toHaveBeenCalledTimes(1);
  return String(complete.mock.calls[0][0].system);
}

/* ── 1. Os dois ligados: o bloco em todos os canais ────────────────── */

describe('regrasComoRegistros E contextoUnico ligados: o bloco chega a todos os canais', () => {
  beforeEach(() => ligar('regrasComoRegistros', 'contextoUnico'));

  it('WhatsApp: pelo motor único, com a regra do agente do turno', async () => {
    const r = await systemDoWhatsApp();

    expect(r.viaContextoUnico).toBe(true);
    expect(r.systemPrompt).toContain(TITULO_BLOCO_DE_REGRAS);
    expect(r.systemPrompt).toContain(TEXTO_DA_REGRA);
    expect(agentRuleFindMany.mock.calls[0][0].where).toEqual({ organizationId: ORG, agentId: 'agente-vera', status: 'ativa' });
  });

  it('Testar minha IA: pelo motor único, com a regra', async () => {
    const r = await systemDoPlayground();

    expect(r.viaContextoUnico).toBe(true);
    expect(r.systemPrompt).toContain(TEXTO_DA_REGRA);
  });

  it('chat do site: o system que chega ao modelo tem a regra, lida do mesmo agente do prompt', async () => {
    const system = await systemDoSite();

    expect(system).toContain(TITULO_BLOCO_DE_REGRAS);
    expect(system).toContain(TEXTO_DA_REGRA);
    expect(system).toContain(PROMPT_DA_VERA);
    // O agente do prompt e o das regras são o mesmo: o que o motor escolheu.
    expect(agentRuleFindMany).toHaveBeenCalledTimes(1);
    expect(agentRuleFindMany.mock.calls[0][0].where).toMatchObject({ agentId: 'agente-vera' });
  });

  it('Qualidade (a fila): o agente testado recebe a regra, e o montador não lê de novo', async () => {
    const systems = await systemDaQualidade();

    expect(systems).toHaveLength(1);
    expect(systems[0]).toContain(TEXTO_DA_REGRA);
    // Contexto de produção (motor único), não o prompt de antes.
    expect(systems[0]).not.toContain('# Cliente atual (eval test mock)');
    // Duas leituras, as da fila (o bloco para o agente e a lista para o
    // sugeridor, rodada 4 do #375). O montador do cenário não soma nenhuma.
    expect(agentRuleFindMany).toHaveBeenCalledTimes(2);
  });

  it('re-teste: as três amostras recebem a regra, com UMA leitura para o clique inteiro', async () => {
    const systems = await systemDoReteste();

    expect(systems).toHaveLength(3);
    for (const s of systems) {
      expect(s).toContain(TEXTO_DA_REGRA);
      expect(s).not.toContain('# Cliente atual (eval test mock)');
    }
    expect(agentRuleFindMany).toHaveBeenCalledTimes(1);
  });

  it('retomada do Maestro: passa pelo motor único e recebe a regra', async () => {
    const system = await systemDaRetomada();

    expect(system).toContain(TITULO_BLOCO_DE_REGRAS);
    expect(system).toContain(TEXTO_DA_REGRA);
    expect(system).toContain(PROMPT_DA_VERA);
  });
});

/* ── 2. Os dois desligados: cada canal byte a byte como antes ──────── */

describe('regrasComoRegistros E contextoUnico desligados: cada canal é o de antes, sem consulta', () => {
  afterEach(() => {
    // Regra na tabela e interruptor desligado: ninguém pergunta por ela.
    expect(agentRuleFindMany).not.toHaveBeenCalled();
  });

  /**
   * O caminho de antes escreve o cabeçalho '# Contexto recuperado (RAG)'
   * mesmo sem trecho da base; o motor único deixou de escrever (C1b, nota 6
   * da revisão de 14/09). É a única diferença entre os dois com a base vazia.
   */
  const comCabecalhoVazioDeAntes = (texto: string) =>
    texto.replace('\n# Agora\n', '\n# Contexto recuperado (RAG)\n# Agora\n');

  it('WhatsApp: o caminho de antes, igual ao motor puro sem regras', async () => {
    const r = await systemDoWhatsApp();

    expect(r.viaContextoUnico).toBe(false);
    expect(r.systemPrompt).toBe(
      comCabecalhoVazioDeAntes(composeAgentContext({
        origem: 'whatsapp',
        agente: AGENTE,
        organizacao: { id: ORG, nome: 'CMJ', settings: SETTINGS, ehZappIQ: false },
        contato: { nome: 'João', leadStatus: 'NEW', primeiroContato: false, totalMensagens: 3, telefone: '5511999999999' },
        blocos: { izaFacts: '', perfilVivo: '', links: buildTenantLinksBlock(SETTINGS, 'CMJ'), rag: '' },
        agora: AGORA,
        ragStatus: 'sem_resultado',
      }).systemPrompt),
    );
  });

  it('Testar minha IA: o caminho de antes (contato sintético, primeiro contato)', async () => {
    const r = await systemDoPlayground();

    expect(r.viaContextoUnico).toBe(false);
    expect(r.systemPrompt).toBe(
      comCabecalhoVazioDeAntes(composeAgentContext({
        origem: 'playground',
        agente: AGENTE,
        organizacao: { id: ORG, nome: 'CMJ', settings: SETTINGS, ehZappIQ: false },
        contato: { nome: null, leadStatus: 'NEW', primeiroContato: true, totalMensagens: 0 },
        blocos: { izaFacts: '', perfilVivo: '', links: buildTenantLinksBlock(SETTINGS, 'CMJ'), rag: '' },
        agora: AGORA,
        ragStatus: 'sem_resultado',
      }).systemPrompt),
    );
  });

  it('chat do site: o montador de antes, caractere por caractere', async () => {
    const system = await systemDoSite();

    expect(system).toBe(
      buildWebChatSystemPrompt({ orgPrompt: PROMPT_GRAVADO_DO_SITE, factsBlock: '', isIzaCanonical: false }),
    );
  });

  it('Qualidade (a fila): o prompt de antes do avaliador', async () => {
    const systems = await systemDaQualidade();

    expect(systems).toEqual([buildEvalSystemPrompt({ systemPrompt: PROMPT_DA_VERA }, CENARIO)]);
  });

  it('re-teste: as três amostras com o prompt de antes do avaliador', async () => {
    const systems = await systemDoReteste();

    const antes = buildEvalSystemPrompt({ systemPrompt: PROMPT_DA_VERA }, CENARIO);
    expect(systems).toEqual([antes, antes, antes]);
  });

  it('retomada do Maestro: o caminho leve de antes', async () => {
    const system = await systemDaRetomada();
    const ctx = await loadBusinessContext(ORG);

    expect(system).toBe(
      buildAiResumePrompt({
        brief: ctx.brief,
        personaPrompt: PROMPT_DA_VERA,
        history: [],
        aiPrompt: 'Retome a conversa sobre o desconto.',
      }).system,
    );
  });
});
