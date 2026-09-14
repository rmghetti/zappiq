/**
 * agentEvalCronService.ciclo.test.ts — duplicidade e teto por organização
 * ============================================================================
 * Dois defeitos que a revisão do PR apontou:
 *
 *   1. O ciclo semanal de clientes (segunda, 04:30) executava EM LINHA, agente
 *      por agente, dentro do worker da fila `cron`. O ciclo por mudança começa
 *      às 04:50, no meio disso: agente que o semanal ainda não tinha alcançado
 *      ganhava DUAS execuções na mesma madrugada, cada uma com o custo de LLM
 *      de um teste inteiro.
 *   2. O teto do ciclo por mudança contava por `agentId`. A spec diz por
 *      ORGANIZAÇÃO: quem tem dois agentes 'live' pagava dois testes por dia.
 *
 * A correção tem duas partes, provadas aqui:
 *   ✓ os três ciclos CRIAM a linha e ENFILEIRAM (nada roda em linha no worker
 *     da fila `cron`)
 *   ✓ um único `podeAgendarAvaliacao(organizationId)` guarda os três: barra
 *     organização com execução viva e organização já avaliada hoje (UTC)
 *   ✓ organização com dois agentes recebe UMA avaliação por dia
 *   ✓ erro na consulta do RAG não pula a organização (A revisão: o fail-soft
 *     estava na função errada e devolvia 0/0, que o cron lia como "sem base")
 * ============================================================================
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

const { prismaMock, filaMock, ragMock, perfilMock, evalSetMock } = vi.hoisted(() => ({
  prismaMock: {
    agent: { findMany: vi.fn() },
    agentEvalRun: { count: vi.fn(), create: vi.fn(), findFirst: vi.fn() },
    auditLog: { count: vi.fn() },
    qAPair: { count: vi.fn() },
  },
  filaMock: { enqueueEvalRun: vi.fn() },
  ragMock: { countRagChunksByNamespaceOrNull: vi.fn() },
  perfilMock: { resolveTenantAgentProfile: vi.fn() },
  evalSetMock: { resolveEvalSet: vi.fn(), EVAL_SET_VERSION: 'v2' },
}));

vi.mock('@zappiq/database', () => ({ prisma: prismaMock }));
vi.mock('../utils/logger.js', () => ({
  logger: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));
vi.mock('./agentEvalQueue.js', () => filaMock);
vi.mock('./aiReadinessService.js', () => ragMock);
vi.mock('../agents/tenantAgentProfile.js', () => perfilMock);
vi.mock('../agents/agentEvalSet.js', () => evalSetMock);
vi.mock('../agents/coreAgentRules.js', () => ({ CORE_RULES_VERSION: 'v2' }));
vi.mock('./slackNotifier.js', () => ({
  sendSlackAlert: vi.fn().mockResolvedValue(true),
  buildSectionBlock: vi.fn(),
}));

const { runAgentEvalCronCycle, runAgentEvalOnChangeCycle, podeAgendarAvaliacao } = await import(
  './agentEvalCronService.js'
);

const AGORA = new Date('2026-09-14T04:50:00Z');
const ONTEM = new Date('2026-09-13T22:00:00Z');

/** Organização paga e com base: o caso elegível. */
function org(id: string, overrides: Record<string, unknown> = {}) {
  return {
    id,
    name: `Cliente ${id}`,
    slug: id,
    churnedAt: null,
    subscriptionStatus: 'active',
    stripeSubscriptionId: 'sub_real',
    trialEndsAt: null,
    isTrialActive: false,
    trialConverted: true,
    paidAt: ONTEM,
    paywallGraceUntil: null,
    ...overrides,
  };
}

/** De qual organização é cada agente, para o banco falso resolver a linha. */
const orgPorAgente = new Map<string, string>();

function agente(id: string, organizationId: string) {
  orgPorAgente.set(id, organizationId);
  return { id, organizationId, name: `Agente ${id}`, organization: org(organizationId) };
}

/**
 * Banco falso com memória: `create` grava a linha e `count` responde a partir
 * do que já foi gravado. É o que permite provar o teto DENTRO do mesmo ciclo:
 * o segundo agente da mesma organização tem de enxergar a linha 'pending' que
 * o primeiro acabou de criar.
 */
function bancoComMemoria(linhasIniciais: Array<Record<string, any>> = []) {
  const linhas = [...linhasIniciais];

  let criadas = 0;
  prismaMock.agentEvalRun.create.mockImplementation(async ({ data }: any) => {
    criadas += 1;
    const linha = {
      id: `run-${criadas}`,
      startedAt: AGORA,
      organizationId: orgPorAgente.get(data.agentId),
      ...data,
    };
    linhas.push(linha);
    return { id: linha.id, startedAt: linha.startedAt };
  });

  prismaMock.agentEvalRun.count.mockImplementation(async ({ where }: any) => {
    const orgAlvo = where?.agent?.organizationId;
    return linhas.filter((l) => {
      if (orgAlvo && l.organizationId !== orgAlvo) return false;
      if (where?.status?.in && !where.status.in.includes(l.status)) return false;
      if (typeof where?.status === 'string' && where.status !== l.status) return false;
      if (where?.startedAt?.gte && !(l.startedAt >= where.startedAt.gte)) return false;
      return true;
    }).length;
  });

  return linhas;
}

beforeEach(() => {
  vi.clearAllMocks();
  prismaMock.agentEvalRun.findFirst.mockResolvedValue(null);
  prismaMock.auditLog.count.mockResolvedValue(1); // houve mudança na base
  prismaMock.qAPair.count.mockResolvedValue(3);
  ragMock.countRagChunksByNamespaceOrNull.mockResolvedValue({ docChunks: 10, qaChunks: 2 });
  perfilMock.resolveTenantAgentProfile.mockResolvedValue({ organizationId: 'org-a' });
  evalSetMock.resolveEvalSet.mockReturnValue([{ id: 'cr1' }, { id: 'cr2' }]);
  filaMock.enqueueEvalRun.mockResolvedValue(undefined);
  bancoComMemoria();
});

describe('o ciclo do cron enfileira, não executa em linha', () => {
  it('cria a linha pendente e manda para a fila agent-eval', async () => {
    prismaMock.agent.findMany.mockResolvedValue([agente('ag-1', 'org-a')]);

    const r = await runAgentEvalCronCycle('clients', AGORA);

    expect(r.agentsProcessed).toBe(1);
    const [{ data }] = prismaMock.agentEvalRun.create.mock.calls[0];
    expect(data).toMatchObject({ agentId: 'ag-1', status: 'pending', triggeredBy: 'cron' });
    expect(filaMock.enqueueEvalRun).toHaveBeenCalledWith('run-1');
  });

  it('o ciclo por mudança usa a mesma fila', async () => {
    prismaMock.agent.findMany.mockResolvedValue([agente('ag-1', 'org-a')]);

    await runAgentEvalOnChangeCycle(AGORA);

    expect(filaMock.enqueueEvalRun).toHaveBeenCalledWith('run-1');
  });

  it('fila fora do ar conta como falha do ciclo, não como execução', async () => {
    prismaMock.agent.findMany.mockResolvedValue([agente('ag-1', 'org-a')]);
    filaMock.enqueueEvalRun.mockRejectedValue(new Error('Redis fora do ar'));

    const r = await runAgentEvalCronCycle('clients', AGORA);

    expect(r.agentsProcessed).toBe(0);
    expect(r.agentsFailed).toBe(1);
  });
});

describe('podeAgendarAvaliacao — teto por organização', () => {
  it('barra organização com execução pendente viva', async () => {
    bancoComMemoria([
      { id: 'run-viva', organizationId: 'org-a', status: 'pending', startedAt: AGORA },
    ]);

    expect(await podeAgendarAvaliacao('org-a', AGORA)).toBe(false);
  });

  it('barra organização com execução em andamento', async () => {
    bancoComMemoria([
      { id: 'run-viva', organizationId: 'org-a', status: 'running', startedAt: AGORA },
    ]);

    expect(await podeAgendarAvaliacao('org-a', AGORA)).toBe(false);
  });

  it('barra organização já avaliada hoje (UTC)', async () => {
    bancoComMemoria([
      {
        id: 'run-hoje',
        organizationId: 'org-a',
        status: 'completed',
        startedAt: new Date('2026-09-14T00:10:00Z'),
      },
    ]);

    expect(await podeAgendarAvaliacao('org-a', AGORA)).toBe(false);
  });

  it('libera quando a última execução foi ontem', async () => {
    bancoComMemoria([
      { id: 'run-ontem', organizationId: 'org-a', status: 'completed', startedAt: ONTEM },
    ]);

    expect(await podeAgendarAvaliacao('org-a', AGORA)).toBe(true);
  });

  it('a execução de OUTRA organização não bloqueia esta', async () => {
    bancoComMemoria([
      { id: 'run-viva', organizationId: 'org-b', status: 'running', startedAt: AGORA },
    ]);

    expect(await podeAgendarAvaliacao('org-a', AGORA)).toBe(true);
  });

  it('execução falha não bloqueia: o cliente pode ser reavaliado', async () => {
    bancoComMemoria([
      { id: 'run-falha', organizationId: 'org-a', status: 'failed', startedAt: AGORA },
    ]);

    expect(await podeAgendarAvaliacao('org-a', AGORA)).toBe(true);
  });
});

describe('nenhuma organização recebe duas avaliações no mesmo dia', () => {
  it('o ciclo por mudança pula organização com execução viva do semanal', async () => {
    // Cenário real: o semanal das 04:30 ainda está rodando quando o ciclo
    // por mudança das 04:50 começa.
    bancoComMemoria([
      { id: 'run-semanal', organizationId: 'org-a', status: 'running', startedAt: AGORA },
    ]);
    prismaMock.agent.findMany.mockResolvedValue([agente('ag-1', 'org-a')]);

    const r = await runAgentEvalOnChangeCycle(AGORA);

    expect(r.agentsProcessed).toBe(0);
    expect(r.agentsSkipped).toBe(1);
    expect(filaMock.enqueueEvalRun).not.toHaveBeenCalled();
  });

  it('o ciclo semanal pula organização já avaliada hoje', async () => {
    bancoComMemoria([
      {
        id: 'run-on-change',
        organizationId: 'org-a',
        status: 'completed',
        startedAt: new Date('2026-09-14T01:00:00Z'),
      },
    ]);
    prismaMock.agent.findMany.mockResolvedValue([agente('ag-1', 'org-a')]);

    const r = await runAgentEvalCronCycle('clients', AGORA);

    expect(r.agentsProcessed).toBe(0);
    expect(r.agentsSkipped).toBe(1);
    expect(filaMock.enqueueEvalRun).not.toHaveBeenCalled();
  });

  it('organização com dois agentes recebe UMA avaliação por dia', async () => {
    prismaMock.agent.findMany.mockResolvedValue([
      agente('ag-1', 'org-a'),
      agente('ag-2', 'org-a'),
    ]);

    const r = await runAgentEvalCronCycle('clients', AGORA);

    expect(r.agentsProcessed).toBe(1);
    expect(r.agentsSkipped).toBe(1);
    expect(filaMock.enqueueEvalRun).toHaveBeenCalledTimes(1);
  });

  it('organizações diferentes continuam recebendo a sua', async () => {
    prismaMock.agent.findMany.mockResolvedValue([
      agente('ag-1', 'org-a'),
      agente('ag-2', 'org-b'),
    ]);

    const r = await runAgentEvalCronCycle('clients', AGORA);

    expect(r.agentsProcessed).toBe(2);
    expect(filaMock.enqueueEvalRun).toHaveBeenCalledTimes(2);
  });
});

describe('falha de infraestrutura não exclui o cliente do teste', () => {
  it('erro na consulta do RAG não pula a organização', async () => {
    // countRagChunksByNamespace engolia o erro e devolvia 0/0, que o cron lia
    // como "sem base cadastrada": o cliente que treinou a IA era pulado em
    // silêncio por uma falha de banco.
    ragMock.countRagChunksByNamespaceOrNull.mockResolvedValue(null);
    prismaMock.qAPair.count.mockResolvedValue(0);
    prismaMock.agent.findMany.mockResolvedValue([agente('ag-1', 'org-a')]);

    const r = await runAgentEvalCronCycle('clients', AGORA);

    expect(r.agentsProcessed).toBe(1);
    expect(filaMock.enqueueEvalRun).toHaveBeenCalledTimes(1);
  });

  it('contagem zerada de verdade continua pulando a organização', async () => {
    ragMock.countRagChunksByNamespaceOrNull.mockResolvedValue({ docChunks: 0, qaChunks: 0 });
    prismaMock.qAPair.count.mockResolvedValue(0);
    prismaMock.agent.findMany.mockResolvedValue([agente('ag-1', 'org-a')]);

    const r = await runAgentEvalCronCycle('clients', AGORA);

    expect(r.agentsProcessed).toBe(0);
    expect(r.skippedByReason).toEqual({ sem_base: 1 });
  });
});
