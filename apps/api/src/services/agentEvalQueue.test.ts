/**
 * agentEvalQueue.test.ts — A048
 * ============================================================================
 * A execução do teste da Qualidade rodava DENTRO do processo da API: o cron
 * em linha e a rota do cliente num setImmediate. Reinício de máquina no meio
 * deixava a linha em 'running' para sempre — duas execuções da Iza de 15/07
 * continuavam 'running' quase dois meses depois — e o cooldown de 24 h do
 * cliente lia essas linhas presas e travava o botão dele por um dia.
 *
 * Agora existe um corpo único (executeRunJob) e uma varredura horária:
 *   ✓ executeRunJob leva a execução de pending a completed e grava o resumo
 *   ✓ grava slackAlertStatus SEMPRE ('skipped' quando não há o que alertar)
 *   ✓ alerta e grava 'sent' quando um cenário crítico reprova
 *   ✓ erro no meio marca 'failed' com a mensagem, e não deixa 'running'
 *   ✓ execução já concluída não roda de novo (repetição do job é inofensiva)
 *   ✓ a varredura marca 'failed' só o que passou de 1 hora
 * ============================================================================
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const { prismaMock, runnerMock, cronServiceMock, profileMock, evalSetMock } = vi.hoisted(() => ({
  prismaMock: {
    agentEvalRun: {
      findUnique: vi.fn(),
      findFirst: vi.fn(),
      update: vi.fn(),
      updateMany: vi.fn(),
    },
  },
  runnerMock: { executeAgentEvalRun: vi.fn() },
  cronServiceMock: {
    notifySlackQualityIssue: vi.fn(),
    shouldAlertQuality: vi.fn(),
    scenariosFailingTwice: vi.fn(),
  },
  profileMock: { resolveTenantAgentProfile: vi.fn() },
  evalSetMock: { resolveEvalSet: vi.fn(), EVAL_SET_VERSION: 'v2', HARNESS_VERSION: 3 },
}));

vi.mock('@zappiq/database', () => ({ prisma: prismaMock }));
vi.mock('../utils/logger.js', () => ({
  logger: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));
vi.mock('./agentEvalRunner.js', () => runnerMock);
vi.mock('./agentEvalCronService.js', () => cronServiceMock);
vi.mock('../agents/tenantAgentProfile.js', () => profileMock);
vi.mock('../agents/agentEvalSet.js', () => evalSetMock);

const {
  executeRunJob,
  sweepStuckEvalRuns,
  enqueueEvalRun,
  getAgentEvalQueue,
  EVAL_RUN_STUCK_AFTER_MS,
  EVAL_RUN_TIMEOUT_MS,
  ERRO_TEMPO_LIMITE,
  ERRO_TETO_EXECUCAO,
  ERRO_NAO_ENFILEIRADA,
} = await import('./agentEvalQueue.js');

const CENARIOS = [
  { id: 'cr1', category: 'cr1_acceptance', severity: 'high' },
  { id: 'cr2', category: 'cr2_handoff', severity: 'critical' },
];

const RESUMO_LIMPO = {
  passed: 2,
  partial: 0,
  failed: 0,
  criticalFailed: 0,
  erros: 0,
  scorePercent: 100,
};

function runPendente(overrides: Record<string, unknown> = {}) {
  return {
    id: 'run-1',
    status: 'pending',
    triggeredBy: 'client_manual',
    scenarioFilter: null,
    startedAt: new Date('2026-09-14T04:30:00Z'),
    agentId: 'agent-1',
    agent: {
      id: 'agent-1',
      name: 'Vera',
      systemPrompt: 'prompt',
      organizationId: 'org-1',
      organization: { name: 'CMJ' },
    },
    ...overrides,
  };
}

/** data das chamadas de update que tocaram um campo. */
function updatesCom(campo: string): any[] {
  return prismaMock.agentEvalRun.update.mock.calls
    .filter((c: any[]) => c[0]?.data && campo in c[0].data)
    .map((c: any[]) => c[0].data);
}

/** data da ÚLTIMA chamada de update que tocou um campo. */
function ultimoUpdate(campo: string): any {
  const calls = updatesCom(campo);
  return calls.length ? calls[calls.length - 1] : undefined;
}

/**
 * Chamadas de updateMany que gravaram um campo. A gravação final da execução
 * (conclusão e falha) usa updateMany de propósito: é o filtro de status que
 * impede a conclusão atrasada de regravar por cima da falha por tempo limite.
 */
function updateManysCom(campo: string): any[] {
  return prismaMock.agentEvalRun.updateMany.mock.calls
    .filter((c: any[]) => c[0]?.data && campo in c[0].data)
    .map((c: any[]) => c[0]);
}

beforeEach(() => {
  vi.clearAllMocks();
  prismaMock.agentEvalRun.findUnique.mockResolvedValue(runPendente());
  prismaMock.agentEvalRun.findFirst.mockResolvedValue(null);
  prismaMock.agentEvalRun.update.mockResolvedValue({});
  // Banco falso: gravação endereçada a UMA linha (id no filtro) pega; a
  // varredura, que não filtra por id, não acha nada por padrão.
  prismaMock.agentEvalRun.updateMany.mockImplementation(async ({ where }: any) =>
    where?.id ? { count: 1 } : { count: 0 },
  );
  profileMock.resolveTenantAgentProfile.mockResolvedValue({
    organizationId: 'org-1',
    isZappIQ: false,
    agentName: 'Vera',
    businessName: 'CMJ',
  });
  evalSetMock.resolveEvalSet.mockReturnValue(CENARIOS);
  runnerMock.executeAgentEvalRun.mockResolvedValue({
    results: [{ scenarioId: 'cr1', combined: 'pass' }],
    durationMs: 12_345,
    summary: RESUMO_LIMPO,
  });
  cronServiceMock.scenariosFailingTwice.mockReturnValue([]);
  cronServiceMock.shouldAlertQuality.mockReturnValue(false);
  cronServiceMock.notifySlackQualityIssue.mockResolvedValue(true);
});

describe('executeRunJob — corpo único da execução', () => {
  it('leva a execução de pending a completed com o resumo gravado', async () => {
    await executeRunJob('run-1');

    // Primeiro marca 'running' (é o que a tela do cliente mostra)...
    expect(updatesCom('status')[0]).toMatchObject({ status: 'running' });

    // ...e a conclusão é gravada com o filtro de status, para não passar por
    // cima de uma linha que a varredura ou o teto já deram por encerrada.
    const [conclusao] = updateManysCom('status');
    expect(conclusao.where).toEqual({ id: 'run-1', status: 'running' });
    expect(conclusao.data).toMatchObject({
      status: 'completed',
      scorePercent: 100,
      passed: 2,
      erros: 0,
      durationMs: 12_345,
      // A régua com que esta execução foi medida. Sem isso, comparar a nota
      // de agosto com a de setembro é comparar duas réguas sem saber.
      harnessVersion: 3,
    });
    expect(conclusao.data.completedAt).toBeInstanceOf(Date);
  });

  it('avalia o agente com o perfil da organização DELE', async () => {
    await executeRunJob('run-1');

    expect(profileMock.resolveTenantAgentProfile).toHaveBeenCalledWith('org-1', {
      agentId: 'agent-1',
    });
    const [, agente, perfil] = runnerMock.executeAgentEvalRun.mock.calls[0];
    expect(agente).toMatchObject({ id: 'agent-1', name: 'Vera' });
    expect(perfil).toMatchObject({ organizationId: 'org-1' });
  });

  it("grava slackAlertStatus 'skipped' quando não há o que alertar", async () => {
    await executeRunJob('run-1');

    expect(cronServiceMock.notifySlackQualityIssue).not.toHaveBeenCalled();
    expect(ultimoUpdate('slackAlertStatus')).toMatchObject({ slackAlertStatus: 'skipped' });
  });

  it("alerta e grava 'sent' quando há o que alertar", async () => {
    cronServiceMock.shouldAlertQuality.mockReturnValue(true);

    await executeRunJob('run-1');

    expect(cronServiceMock.notifySlackQualityIssue).toHaveBeenCalledTimes(1);
    const alerta = cronServiceMock.notifySlackQualityIssue.mock.calls[0][0];
    expect(alerta.organizationName).toBe('CMJ');
    // Execução do cliente leva o link para o painel do CLIENTE, não /admin.
    expect(alerta.dashboardPath).toBe('/treinar/qualidade');
    expect(ultimoUpdate('slackAlertStatus')).toMatchObject({ slackAlertStatus: 'sent' });
  });

  it('compara com a execução concluída anterior do mesmo agente', async () => {
    prismaMock.agentEvalRun.findFirst.mockResolvedValue({
      results: [{ scenarioId: 'cr1', combined: 'fail' }],
    });
    cronServiceMock.scenariosFailingTwice.mockReturnValue(['cr1']);
    cronServiceMock.shouldAlertQuality.mockReturnValue(true);

    await executeRunJob('run-1');

    expect(cronServiceMock.scenariosFailingTwice).toHaveBeenCalledTimes(1);
    expect(cronServiceMock.shouldAlertQuality).toHaveBeenCalledWith(RESUMO_LIMPO, {
      repetidos: ['cr1'],
    });
  });

  it("erro no meio marca 'failed' com a mensagem, sem deixar 'running'", async () => {
    runnerMock.executeAgentEvalRun.mockRejectedValue(new Error('provedor fora do ar'));

    await executeRunJob('run-1');

    const [falha] = updateManysCom('status');
    expect(falha.data).toMatchObject({ status: 'failed', error: 'provedor fora do ar' });
    // Nunca por cima de linha já encerrada (completed ou failed da varredura).
    expect(falha.where).toEqual({ id: 'run-1', status: { in: ['pending', 'running'] } });
  });

  it("execução que falhou também grava slackAlertStatus ('not_sent')", async () => {
    runnerMock.executeAgentEvalRun.mockRejectedValue(new Error('provedor fora do ar'));

    await executeRunJob('run-1');

    expect(updateManysCom('status')[0].data).toMatchObject({ slackAlertStatus: 'not_sent' });
  });

  it('execução já concluída não roda de novo', async () => {
    prismaMock.agentEvalRun.findUnique.mockResolvedValue(
      runPendente({ status: 'completed' }),
    );

    await executeRunJob('run-1');

    expect(runnerMock.executeAgentEvalRun).not.toHaveBeenCalled();
    expect(prismaMock.agentEvalRun.update).not.toHaveBeenCalled();
  });

  it('execução inexistente não derruba o worker', async () => {
    prismaMock.agentEvalRun.findUnique.mockResolvedValue(null);

    await expect(executeRunJob('sumiu')).resolves.toBeUndefined();
    expect(runnerMock.executeAgentEvalRun).not.toHaveBeenCalled();
  });
});

/**
 * O teto de 25 minutos não existia: `lockDuration` só protege contra máquina
 * morta, e o BullMQ RENOVA o lock enquanto o processador está vivo. Uma
 * execução de 38 minutos, como a de 11/09, rodava inteira e ainda segurava a
 * fila de concorrência 1. Agora há um relógio de verdade.
 */
describe('teto de 25 minutos por execução', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  /** Execução que só termina quando o teste mandar. */
  function execucaoQuePendura() {
    let terminar: (saida: unknown) => void = () => undefined;
    runnerMock.executeAgentEvalRun.mockImplementation(
      () => new Promise((resolve) => { terminar = resolve; }),
    );
    return (saida: unknown) => terminar(saida);
  }

  it('a régua é de 25 minutos', () => {
    expect(EVAL_RUN_TIMEOUT_MS).toBe(25 * 60 * 1000);
  });

  it('estourou o teto: a linha vira failed com a mensagem do teto', async () => {
    execucaoQuePendura();

    const promessa = executeRunJob('run-1');
    await vi.advanceTimersByTimeAsync(EVAL_RUN_TIMEOUT_MS + 1000);
    await promessa;

    const [falha] = updateManysCom('status');
    expect(falha.data).toMatchObject({
      status: 'failed',
      error: 'tempo limite da execução (25 min)',
    });
    expect(ERRO_TETO_EXECUCAO).toBe('tempo limite da execução (25 min)');
  });

  it('o completed atrasado NÃO sobrescreve a falha por tempo limite', async () => {
    const terminar = execucaoQuePendura();

    const promessa = executeRunJob('run-1');
    await vi.advanceTimersByTimeAsync(EVAL_RUN_TIMEOUT_MS + 1000);
    await promessa;

    // A linha já está 'failed': daqui em diante o filtro não acha nada.
    prismaMock.agentEvalRun.updateMany.mockResolvedValue({ count: 0 });

    // A execução termina 10 minutos depois, como acontece de verdade: o
    // provedor não foi cancelado, só deixou de segurar a fila.
    terminar({ results: [{ scenarioId: 'cr1', combined: 'pass' }], durationMs: 1, summary: RESUMO_LIMPO });
    await vi.advanceTimersByTimeAsync(10 * 60 * 1000);

    const tardia = updateManysCom('status').find((c) => c.data.status === 'completed');
    expect(tardia, 'a conclusão atrasada tem de ser TENTADA, com filtro').toBeDefined();
    expect(tardia.where).toEqual({ id: 'run-1', status: 'running' });
    // E, como não achou linha 'running', não alertou o Slack por uma
    // execução que o cliente já viu como falha.
    expect(cronServiceMock.notifySlackQualityIssue).not.toHaveBeenCalled();
  });

  it('conclusão que vence o teto por milissegundos não deixa slackAlertStatus nulo', async () => {
    execucaoQuePendura();

    // A janela: gravarConclusao já gravou 'completed' e, milissegundos depois,
    // o relógio de 25 minutos disparou. Nada mais a marcar como falha (o
    // filtro de marcarFalha só pega 'pending'/'running')...
    prismaMock.agentEvalRun.updateMany.mockResolvedValue({ count: 0 });
    // ...e é a leitura do status EFETIVAMENTE gravado que revela a corrida.
    prismaMock.agentEvalRun.findUnique
      .mockResolvedValueOnce(runPendente())
      .mockResolvedValueOnce({
        id: 'run-1',
        status: 'completed',
        triggeredBy: 'client_manual',
        slackAlertStatus: null,
        results: [{ scenarioId: 'cr2', combined: 'fail', severity: 'critical' }],
        passed: 1,
        partial: 0,
        failed: 1,
        criticalFailed: 1,
        scorePercent: 50,
        durationMs: EVAL_RUN_TIMEOUT_MS,
        totalScenarios: 2,
      });
    cronServiceMock.shouldAlertQuality.mockReturnValue(true);

    const promessa = executeRunJob('run-1');
    await vi.advanceTimersByTimeAsync(EVAL_RUN_TIMEOUT_MS + 1000);
    await promessa;

    // O alerta sai com os números que ficaram GRAVADOS na linha.
    expect(cronServiceMock.notifySlackQualityIssue).toHaveBeenCalledTimes(1);
    const alerta = cronServiceMock.notifySlackQualityIssue.mock.calls[0][0];
    expect(alerta).toMatchObject({ runId: 'run-1', scorePercent: 50, criticalFailed: 1 });
    expect(ultimoUpdate('slackAlertStatus')).toMatchObject({ slackAlertStatus: 'sent' });
  });

  it('linha que já estava failed não vira alerta de execução morta', async () => {
    execucaoQuePendura();

    prismaMock.agentEvalRun.updateMany.mockResolvedValue({ count: 0 });
    prismaMock.agentEvalRun.findUnique
      .mockResolvedValueOnce(runPendente())
      .mockResolvedValueOnce({
        id: 'run-1',
        status: 'failed',
        triggeredBy: 'client_manual',
        slackAlertStatus: 'not_sent',
        results: null,
        passed: null,
        partial: null,
        failed: null,
        criticalFailed: null,
        scorePercent: null,
        durationMs: null,
        totalScenarios: 2,
      });
    cronServiceMock.shouldAlertQuality.mockReturnValue(true);

    const promessa = executeRunJob('run-1');
    await vi.advanceTimersByTimeAsync(EVAL_RUN_TIMEOUT_MS + 1000);
    await promessa;

    expect(cronServiceMock.notifySlackQualityIssue).not.toHaveBeenCalled();
  });

  it('execução dentro do teto conclui normalmente', async () => {
    const terminar = execucaoQuePendura();

    const promessa = executeRunJob('run-1');
    await vi.advanceTimersByTimeAsync(60_000);
    terminar({ results: [{ scenarioId: 'cr1', combined: 'pass' }], durationMs: 60_000, summary: RESUMO_LIMPO });
    await promessa;

    const [gravacao] = updateManysCom('status');
    expect(gravacao.data).toMatchObject({ status: 'completed' });
  });
});

describe('sweepStuckEvalRuns — varredura de execução presa', () => {
  it('marca failed só o que está há mais de 1 hora em running ou pending', async () => {
    prismaMock.agentEvalRun.updateMany.mockResolvedValue({ count: 2 });
    const agora = new Date('2026-09-14T12:00:00Z');

    const marcadas = await sweepStuckEvalRuns(agora);

    expect(marcadas).toBe(2);
    const [{ where, data }] = prismaMock.agentEvalRun.updateMany.mock.calls[0];
    expect(where.status).toEqual({ in: ['running', 'pending'] });
    expect(where.startedAt.lt).toEqual(new Date('2026-09-14T11:00:00Z'));
    expect(data).toMatchObject({ status: 'failed', error: ERRO_TEMPO_LIMITE });
  });

  it('a régua é de 1 hora', () => {
    expect(EVAL_RUN_STUCK_AFTER_MS).toBe(60 * 60 * 1000);
  });

  it('a mensagem de erro diz por que a execução morreu', () => {
    expect(ERRO_TEMPO_LIMITE).toBe('tempo limite: execução em running há mais de 1 hora');
  });

  it('sem execução presa, devolve 0 e não alarma', async () => {
    expect(await sweepStuckEvalRuns(new Date())).toBe(0);
  });
});

describe('enqueueEvalRun — fila fora do ar não deixa a linha pendurada', () => {
  it("marca 'failed' na hora e devolve o erro para a rota", async () => {
    const fila = getAgentEvalQueue();
    vi.spyOn(fila, 'add').mockRejectedValue(new Error('Redis fora do ar'));

    await expect(enqueueEvalRun('run-1')).rejects.toThrow('Redis fora do ar');

    expect(ultimoUpdate('status')).toMatchObject({
      status: 'failed',
      error: ERRO_NAO_ENFILEIRADA,
    });
  });

  it('jobId é o runId, para o mesmo teste não rodar duas vezes', async () => {
    const fila = getAgentEvalQueue();
    const add = vi.spyOn(fila, 'add').mockResolvedValue({} as any);

    await enqueueEvalRun('run-1');

    expect(add).toHaveBeenCalledWith('run', { runId: 'run-1' }, expect.objectContaining({ jobId: 'run-1' }));
  });
});
