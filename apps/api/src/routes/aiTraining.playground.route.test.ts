/**
 * POST /api/ai-training/test (teste de ROTA): o Testar minha IA pelo motor único.
 *
 * A072: o playground usava um contato sintético que não existe no banco, então
 * todo turno da sessão de teste era "primeiro contato" (a saudação entrava em
 * toda mensagem) e a ferramenta de agendamento entrava só pelo interruptor das
 * settings, mesmo sem tipo cadastrado, mandando o turno para Sonnet.
 *
 * O que este teste prova, com o orquestrador dublado:
 *   1. o contexto é pedido com origem 'playground' e a memória da SESSÃO:
 *      primeiro contato só sem histórico; a contagem é a de turnos enviados;
 *   2. com os interruptores desligados, nada a mais é consultado
 *      (resolveSchedulingRuntime não roda) e as ferramentas seguem a regra
 *      antiga (só check_availability, pelo interruptor das settings);
 *   3. com modeloPorPolitica ligado, o agendamento REAL é resolvido, a política
 *      chega pelo pickTierAndOverride e as ferramentas vêm de toolsDaPolitica.
 *
 * Mesmo harness do aiTraining.qa.route.test.ts: router num Express nu,
 * prisma/RAG/auth mockados, HTTP de verdade.
 */
import { describe, it, expect, vi, beforeEach, afterAll, beforeAll } from 'vitest';
import express from 'express';
import type { Server } from 'node:http';

const ORG = 'org-do-teste';

const orgFindUnique = vi.fn();
vi.mock('@zappiq/database', () => ({
  prisma: {
    organization: { findUnique: (...a: any[]) => orgFindUnique(...a), update: vi.fn() },
    QAPair: { findMany: vi.fn().mockResolvedValue([]) },
    kBDocument: { findMany: vi.fn().mockResolvedValue([]) },
    $queryRaw: vi.fn().mockResolvedValue([]),
  },
}));

const searchDetailed = vi.fn();
vi.mock('../services/ragService.js', () => ({
  searchDetailed: (...a: any[]) => searchDetailed(...a),
  ingestDocument: vi.fn(),
  deleteDocument: vi.fn(),
  ingestUrl: vi.fn(),
  urlToSource: (u: string) => u,
  search: vi.fn(),
  searchWithSources: vi.fn(),
  namespaceFor: (o: string) => `org_${o}`,
}));

vi.mock('../middleware/auth.js', () => ({
  authMiddleware: (req: any, _res: any, next: any) => {
    req.user = { organizationId: ORG, id: 'user-1', email: 'teste@zappiq.com.br', role: 'ADMIN' };
    next();
  },
}));

vi.mock('../services/aiReadinessService.js', () => ({
  refreshAIReadiness: vi.fn().mockResolvedValue({ score: 42 }),
  computeAIReadiness: vi.fn().mockResolvedValue({ score: 42 }),
}));
const logAuditEvent = vi.fn().mockResolvedValue(undefined);
vi.mock('../services/auditService.js', () => ({ logAuditEvent: (...a: any[]) => logAuditEvent(...a) }));
vi.mock('../services/knowledgeBaseBuilder.js', () => ({
  buildKnowledgeBase: vi.fn(),
  surveyDocFilename: vi.fn(() => 'survey.txt'),
  countAnsweredQuestions: vi.fn(() => 0),
}));

const buildAgentContextForContact = vi.fn();
const pickTierAndOverride = vi.fn();
const resolveSchedulingRuntime = vi.fn();
const toolsDaPolitica = vi.fn();
vi.mock('../agents/agentOrchestrator.js', () => ({
  buildAgentContextForContact: (...a: any[]) => buildAgentContextForContact(...a),
  pickTierAndOverride: (...a: any[]) => pickTierAndOverride(...a),
  resolveSchedulingRuntime: (...a: any[]) => resolveSchedulingRuntime(...a),
  toolsDaPolitica: (...a: any[]) => toolsDaPolitica(...a),
}));

const flagLigada = vi.fn();
// C1b (nota 1): o teste lê os interruptores UMA vez (lerFlagsDoTurno); o
// dublê devolve o mesmo estado que o flagLigada de antes.
const lerFlagsDoTurno = vi.fn();
vi.mock('../agents/agentContextLoader.js', () => ({
  flagLigada: (...a: any[]) => flagLigada(...a),
  lerFlagsDoTurno: (...a: any[]) => lerFlagsDoTurno(...a),
}));

const routeIzaTurn = vi.fn();
vi.mock('../services/llm/izaTurnRouter.js', () => ({ routeIzaTurn: (...a: any[]) => routeIzaTurn(...a) }));

const getToolsForContext = vi.fn();
vi.mock('../services/llm/tools.js', () => ({ getToolsForContext: (...a: any[]) => getToolsForContext(...a) }));
vi.mock('../services/agentIdentitySync.js', () => ({ syncAgentIdentity: vi.fn() }));
vi.mock('../services/llm/crisisSafetyNet.js', () => ({
  acionarRedeDeCrise: vi.fn().mockResolvedValue(undefined),
  acrescentarAcolhimento: (t: string) => t,
}));
vi.mock('../utils/logger.js', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

let server: Server;
let base: string;

beforeAll(async () => {
  const { default: router } = await import('./aiTraining.js');
  const app = express();
  app.use(express.json());
  app.use('/api/ai-training', router);
  await new Promise<void>((resolve) => {
    server = app.listen(0, () => {
      base = `http://127.0.0.1:${(server.address() as any).port}`;
      resolve();
    });
  });
});

afterAll(() => new Promise<void>((r) => server.close(() => r())));

const CONSULTA = { name: 'check_availability', description: 'consulta', inputSchema: {} };
const MARCAR = { name: 'create_appointment', description: 'marca', inputSchema: {} };

let flags: Record<string, boolean> = {};

beforeEach(() => {
  vi.clearAllMocks();
  flags = {};
  flagLigada.mockImplementation(async (_org: string, flag: string) => flags[flag] === true);
  lerFlagsDoTurno.mockImplementation(async () => ({
    contextoUnico: flags.contextoUnico === true,
    modeloPorPolitica: flags.modeloPorPolitica === true,
    perfilVivo: flags.perfilVivo === true,
    regrasComoRegistros: flags.regrasComoRegistros === true,
  }));
  orgFindUnique.mockResolvedValue({ settings: { scheduling: { enabled: true } } });
  searchDetailed.mockResolvedValue({ context: '', sources: [], status: 'sem_resultado', fromCache: false });
  buildAgentContextForContact.mockResolvedValue({
    systemPrompt: 'PROMPT',
    hash: 'abc123',
    partes: [],
    viaContextoUnico: false,
  });
  pickTierAndOverride.mockResolvedValue({ tier: 'GROWTH' });
  resolveSchedulingRuntime.mockResolvedValue({ ativo: true, tipos: ['Consulta'], motivo: 'ativo' });
  getToolsForContext.mockReturnValue([CONSULTA, MARCAR]);
  toolsDaPolitica.mockReturnValue([CONSULTA]);
  routeIzaTurn.mockResolvedValue({
    kind: 'llm',
    response: { text: '<reply>Olá!</reply>', provider: 'google-gemini-flash', model: 'flash' },
  });
});

async function testar(body: unknown) {
  const res = await fetch(`${base}/api/ai-training/test`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
  return { status: res.status, body: await res.json() };
}

describe('POST /api/ai-training/test: memória da sessão de teste (A072)', () => {
  it('primeiro turno: primeiro contato SIM, 1 mensagem, origem playground', async () => {
    const r = await testar({ message: 'oi' });

    expect(r.status).toBe(200);
    expect(r.body.reply).toBe('Olá!');
    const pedido = buildAgentContextForContact.mock.calls[0][0];
    expect(pedido).toMatchObject({
      origem: 'playground',
      organizationId: ORG,
      contactId: `playground:${ORG}`,
      contato: { nome: null, leadStatus: 'NEW', primeiroContato: true, totalMensagens: 1 },
      temHistoricoNoContexto: false,
    });
  });

  it('turno seguinte: primeiro contato NÃO e a contagem é a de turnos enviados', async () => {
    const history = [
      { role: 'user', content: 'meu nome é João' },
      { role: 'assistant', content: 'Prazer, João!' },
    ];
    await testar({ message: 'e o preço?', history });

    const pedido = buildAgentContextForContact.mock.calls[0][0];
    expect(pedido.contato).toEqual({ nome: null, leadStatus: 'NEW', primeiroContato: false, totalMensagens: 3 });
    expect(pedido.temHistoricoNoContexto).toBe(true);
    // O histórico da sessão segue para o roteador, como antes.
    expect(routeIzaTurn.mock.calls[0][0].history).toEqual(history);
  });

  it('o rastro do teste leva o hash do contexto', async () => {
    await testar({ message: 'oi' });

    const evento = logAuditEvent.mock.calls.find((c: any[]) => c[1]?.action === 'kb.playground.test');
    expect(evento?.[1]?.after).toEqual({ contextoHash: 'abc123', viaContextoUnico: false });
  });
});

describe('POST /api/ai-training/test: ferramentas e política', () => {
  it('interruptores desligados: nada a mais é consultado e vale a regra antiga (só consulta de horários)', async () => {
    await testar({ message: 'quero agendar' });

    expect(resolveSchedulingRuntime).not.toHaveBeenCalled();
    expect(pickTierAndOverride).toHaveBeenCalledWith(
      ORG,
      expect.objectContaining({ canal: 'playground', agendamentoAtivo: false }),
    );
    expect(toolsDaPolitica).not.toHaveBeenCalled();
    expect(routeIzaTurn.mock.calls[0][0].tools).toEqual([CONSULTA]);
    expect(buildAgentContextForContact.mock.calls[0][0].agendamento).toBeUndefined();
  });

  it('interruptores desligados e agendamento desligado nas settings: sem ferramentas', async () => {
    orgFindUnique.mockResolvedValue({ settings: { scheduling: { enabled: false } } });

    await testar({ message: 'quero agendar' });

    expect(routeIzaTurn.mock.calls[0][0].tools).toBeUndefined();
  });

  it('modeloPorPolitica ligado: agendamento real resolvido e ferramentas pela política', async () => {
    flags = { modeloPorPolitica: true };
    const politica = { tier: 'GROWTH', tools: ['check_availability'], modelo: 'anthropic-sonnet', motivo: 'x' };
    pickTierAndOverride.mockResolvedValue({ tier: 'GROWTH', politica });

    await testar({ message: 'quero agendar' });

    expect(resolveSchedulingRuntime).toHaveBeenCalledWith(ORG, { scheduling: { enabled: true } });
    expect(pickTierAndOverride).toHaveBeenCalledWith(
      ORG,
      expect.objectContaining({ canal: 'playground', agendamentoAtivo: true }),
    );
    expect(toolsDaPolitica).toHaveBeenCalledWith(politica, false);
    expect(routeIzaTurn.mock.calls[0][0].tools).toEqual([CONSULTA]);
    // O estado real do agendamento também vai para o prompt (bloco vivo).
    expect(buildAgentContextForContact.mock.calls[0][0].agendamento).toEqual({ ativo: true, tipos: ['Consulta'], motivo: 'ativo' });
  });

  it('contextoUnico ligado sozinho também resolve o agendamento real para o prompt', async () => {
    flags = { contextoUnico: true };
    resolveSchedulingRuntime.mockResolvedValue({ ativo: false, tipos: [], motivo: 'sem_tipo_ativo' });

    await testar({ message: 'quero agendar' });

    expect(resolveSchedulingRuntime).toHaveBeenCalledTimes(1);
    expect(pickTierAndOverride).toHaveBeenCalledWith(
      ORG,
      expect.objectContaining({ canal: 'playground', agendamentoAtivo: false }),
    );
    expect(buildAgentContextForContact.mock.calls[0][0].agendamento).toEqual({ ativo: false, tipos: [], motivo: 'sem_tipo_ativo' });
  });
});

describe('nota 1 (C1b): o Testar minha IA lê os interruptores uma vez', () => {
  it('uma leitura só, passada ao montador e à política', async () => {
    flags = { contextoUnico: true, modeloPorPolitica: true };
    const res = await fetch(`${base}/api/ai-training/test`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ message: 'oi' }),
    });
    expect(res.status).toBe(200);
    expect(lerFlagsDoTurno).toHaveBeenCalledTimes(1);
    expect(flagLigada).not.toHaveBeenCalled();
    const flagsPassadas = await lerFlagsDoTurno.mock.results[0].value;
    expect(buildAgentContextForContact.mock.calls[0][0].flags).toEqual(flagsPassadas);
    expect(pickTierAndOverride.mock.calls[0][1].flags).toEqual(flagsPassadas);
  });
});
