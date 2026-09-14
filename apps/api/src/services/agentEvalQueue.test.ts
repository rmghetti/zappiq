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
import { describe, it, expect, vi, beforeEach } from 'vitest';

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
  evalSetMock: { resolveEvalSet: vi.fn(), EVAL_SET_VERSION: 'v2' },
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
  ERRO_TEMPO_LIMITE,
  ERRO_NAO_ENFILEIRADA,
} = await import('./agentEvalQueue.js');

const CENARIOS = [
  { id: 'cr1', category: 'cr1_acceptance', severity: 'high' },
  { id: 'cr2', category: 'cr2_handoff', severity: 'critical' },
];

const RESUMO_LIMPO = { passed: 2, partial: 0, failed: 0, criticalFailed: 0, scorePercent: 100 };

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

beforeEach(() => {
  vi.clearAllMocks();
  prismaMock.agentEvalRun.findUnique.mockResolvedValue(runPendente());
  prismaMock.agentEvalRun.findFirst.mockResolvedValue(null);
  prismaMock.agentEvalRun.update.mockResolvedValue({});
  prismaMock.agentEvalRun.updateMany.mockResolvedValue({ count: 0 });
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

    const porStatus = updatesCom('status');
    // Primeiro marca 'running' (é o que a tela do cliente mostra), depois conclui.
    expect(porStatus[0]).toMatchObject({ status: 'running' });
    const concluida = porStatus[porStatus.length - 1];
    expect(concluida).toMatchObject({
      status: 'completed',
      scorePercent: 100,
      passed: 2,
      durationMs: 12_345,
    });
    expect(concluida.completedAt).toBeInstanceOf(Date);
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

    expect(ultimoUpdate('status')).toMatchObject({
      status: 'failed',
      error: 'provedor fora do ar',
    });
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
