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

const { prismaMock, runnerMock, cronServiceMock, profileMock, evalSetMock, regrasMock } = vi.hoisted(() => ({
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
  // Rodada 3 do PR #375: a fila monta o bloco de regras do agente e entrega
  // ao avaliador. Duble para o teste não tocar interruptor nem Redis.
  regrasMock: {
    blocoDeRegrasDaOrganizacao: vi.fn(async () => ''),
    // Rodada 4: as regras ativas, para o sugeridor fortalecer em vez de
    // duplicar. Só é consultado quando o bloco não é vazio.
    carregarRegrasAtivas: vi.fn(async (): Promise<any[]> => []),
  },
}));

vi.mock('@zappiq/database', () => ({ prisma: prismaMock }));
vi.mock('./agentRulesService.js', () => regrasMock);
vi.mock('../utils/logger.js', () => ({
  logger: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));
vi.mock('./agentEvalRunner.js', () => runnerMock);
vi.mock('./agentEvalCronService.js', () => cronServiceMock);
vi.mock('../agents/tenantAgentProfile.js', () => profileMock);
vi.mock('../agents/agentEvalSet.js', () => evalSetMock);
// Rodada 4 do PR #375: um teste abaixo carrega o agentEvalCronService REAL
// (as regras do alerta de reprovação repetida). A contagem de trechos do RAG
// que ele importa puxaria o ragService e o cache; aqui ela não é usada.
vi.mock('./aiReadinessService.js', () => ({ countRagChunksByNamespaceOrNull: vi.fn() }));
// A fila é preguiçosa, mas os testes do enqueueEvalRun a criam de verdade
// (getAgentEvalQueue) e o BullMQ abria conexão com o Redis em segundo plano.
// O erro de conexão aparecia no meio dos testes seguintes. Fila falsa: os
// testes só espiam o `add`.
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
  ERRO_FALHA_TECNICA_DO_PROVEDOR,
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
  // clearAllMocks não desfaz implementação: sem isto, o bloco ou a falha
  // de um teste vazaria para o seguinte.
  regrasMock.blocoDeRegrasDaOrganizacao.mockResolvedValue('');
  regrasMock.carregarRegrasAtivas.mockResolvedValue([]);
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

/* ══════════════════════════════════════════════════════════════════════
 * A171 — mais de 20% da execução sem resposta válida não vira nota.
 * --------------------------------------------------------------------
 * Em 15/06 uma execução com 25 de 25 respostas vazias foi gravada com nota
 * zero, alertou o Slack e virou correção aplicada no prompt da Iza. O
 * cenário 'erro' já sai do denominador, mas a execução inteira continuava
 * virando nota: 20 de 25 cenários quebrados produziam uma "nota" medida em
 * cinco respostas.
 * ══════════════════════════════════════════════════════════════════════ */
describe('A171 — execução majoritariamente quebrada é falha técnica, não nota', () => {
  const RESUMO_QUEBRADO = {
    passed: 1,
    partial: 0,
    failed: 0,
    criticalFailed: 0,
    erros: 1,
    scorePercent: 100,
  };

  it("com mais de 20% de erros grava 'failed' e não grava nota", async () => {
    // 1 de 2 cenários sem resposta válida: 50%.
    runnerMock.executeAgentEvalRun.mockResolvedValue({
      results: [
        { scenarioId: 'cr1', combined: 'pass' },
        { scenarioId: 'cr2', combined: 'erro' },
      ],
      durationMs: 1000,
      summary: RESUMO_QUEBRADO,
    });

    await executeRunJob('run-1');

    const [gravacao] = updateManysCom('status');
    expect(gravacao.where).toEqual({ id: 'run-1', status: 'running' });
    expect(gravacao.data).toMatchObject({
      status: 'failed',
      error: ERRO_FALHA_TECNICA_DO_PROVEDOR,
      slackAlertStatus: 'not_sent',
    });
    expect(gravacao.data.scorePercent).toBeUndefined();
  });

  it('não alerta a nota de uma execução que não foi avaliada', async () => {
    cronServiceMock.shouldAlertQuality.mockReturnValue(true);
    runnerMock.executeAgentEvalRun.mockResolvedValue({
      results: [
        { scenarioId: 'cr1', combined: 'pass' },
        { scenarioId: 'cr2', combined: 'erro' },
      ],
      durationMs: 1000,
      summary: RESUMO_QUEBRADO,
    });

    await executeRunJob('run-1');

    expect(cronServiceMock.notifySlackQualityIssue).not.toHaveBeenCalled();
  });

  it('a mensagem explica o que houve, em português e sem jargão de stack', () => {
    expect(ERRO_FALHA_TECNICA_DO_PROVEDOR).toBe(
      'falha técnica do provedor: mais de 20% dos cenários sem resposta válida',
    );
    expect(ERRO_FALHA_TECNICA_DO_PROVEDOR).not.toContain('—');
  });

  it('exatamente 20% de erros ainda vira nota: a régua é MAIS de 20%', async () => {
    evalSetMock.resolveEvalSet.mockReturnValue([
      { id: 'c1', category: 'x', severity: 'high' },
      { id: 'c2', category: 'x', severity: 'high' },
      { id: 'c3', category: 'x', severity: 'high' },
      { id: 'c4', category: 'x', severity: 'high' },
      { id: 'c5', category: 'x', severity: 'high' },
    ]);
    runnerMock.executeAgentEvalRun.mockResolvedValue({
      results: [{ scenarioId: 'c1', combined: 'pass' }],
      durationMs: 1000,
      summary: { ...RESUMO_LIMPO, erros: 1, passed: 4 },
    });

    await executeRunJob('run-1');

    const [gravacao] = updateManysCom('status');
    expect(gravacao.data).toMatchObject({ status: 'completed' });
  });

  it('sem erro nenhum, o caminho normal continua igual', async () => {
    await executeRunJob('run-1');

    const [gravacao] = updateManysCom('status');
    expect(gravacao.data).toMatchObject({ status: 'completed', scorePercent: 100 });
  });
});

/* ══════════════════════════════════════════════════════════════════════
 * O alerta do Slack tem de listar o que a própria contagem chama de crítico.
 * --------------------------------------------------------------------
 * criticalFailed conta 'fail' E 'partial' de severidade crítica (A052), mas
 * topFails só listava 'fail'. O alerta dizia "3 críticos reprovados" e
 * mostrava um. Quem abre o Slack não tem como saber quais são os outros dois.
 * ══════════════════════════════════════════════════════════════════════ */
describe('topFails do Slack bate com a contagem de críticos', () => {
  it('inclui o crítico parcial, que a contagem já considera reprovado', async () => {
    cronServiceMock.shouldAlertQuality.mockReturnValue(true);
    runnerMock.executeAgentEvalRun.mockResolvedValue({
      results: [
        { scenarioId: 'cr1', category: 'cr1_acceptance', severity: 'high', combined: 'fail' },
        { scenarioId: 'cr2', category: 'cr2_handoff', severity: 'critical', combined: 'partial' },
        { scenarioId: 'cr3', category: 'cr3_anti_pattern', severity: 'high', combined: 'partial' },
        { scenarioId: 'cr4', category: 'cr4_x', severity: 'critical', combined: 'pass' },
        { scenarioId: 'cr5', category: 'cr5_x', severity: 'critical', combined: 'erro' },
      ],
      durationMs: 1000,
      summary: { ...RESUMO_LIMPO, failed: 1, partial: 2, criticalFailed: 1 },
    });

    await executeRunJob('run-1');

    const [alerta] = cronServiceMock.notifySlackQualityIssue.mock.calls[0];
    const ids = alerta.topFails.map((f: any) => f.scenarioId);
    expect(ids).toContain('cr1'); // fail comum
    expect(ids).toContain('cr2'); // crítico parcial, que conta como reprovado
    expect(ids).not.toContain('cr3'); // parcial não crítico segue fora
    expect(ids).not.toContain('cr4'); // aprovado
    expect(ids).not.toContain('cr5'); // falha técnica não é reprovação
  });
});

/* ══════════════════════════════════════════════════════════════════════
 * Rodada 3 do PR #375: a execução completa (cron e botão do cliente) mede o
 * agente COM as regras aprovadas. Sem isto, depois da migração dos patches a
 * nota da organização migrada cai e nunca mais reflete as regras.
 * ══════════════════════════════════════════════════════════════════════ */
describe('executeRunJob entrega o bloco de regras do agente ao avaliador', () => {
  const BLOCO = '# Regras aprovadas pelo dono\n1. Chame o cliente pelo nome quando souber.';

  beforeEach(() => {
    prismaMock.agentEvalRun.findUnique.mockResolvedValue(runPendente());
    prismaMock.agentEvalRun.update.mockResolvedValue({});
    prismaMock.agentEvalRun.updateMany.mockResolvedValue({ count: 1 });
    profileMock.resolveTenantAgentProfile.mockResolvedValue({ organizationId: 'org-1' });
    evalSetMock.resolveEvalSet.mockReturnValue(CENARIOS);
    runnerMock.executeAgentEvalRun.mockResolvedValue({
      results: [],
      durationMs: 10,
      summary: RESUMO_LIMPO,
    });
    cronServiceMock.shouldAlertQuality.mockReturnValue(false);
    cronServiceMock.scenariosFailingTwice.mockResolvedValue([]);
  });

  it('monta o bloco pela organização E pelo agente da execução', async () => {
    regrasMock.blocoDeRegrasDaOrganizacao.mockResolvedValue(BLOCO);

    await executeRunJob('run-1');

    expect(regrasMock.blocoDeRegrasDaOrganizacao).toHaveBeenCalledWith('org-1', {
      agentId: 'agent-1',
    });
    expect(runnerMock.executeAgentEvalRun).toHaveBeenCalledTimes(1);
    expect(runnerMock.executeAgentEvalRun.mock.calls[0][3]).toMatchObject({ regrasBlock: BLOCO });
  });

  it('bloco indisponível não derruba a execução: segue sem ele', async () => {
    regrasMock.blocoDeRegrasDaOrganizacao.mockRejectedValue(new Error('banco fora'));

    await executeRunJob('run-1');

    expect(runnerMock.executeAgentEvalRun).toHaveBeenCalledTimes(1);
    expect(runnerMock.executeAgentEvalRun.mock.calls[0][3]).toMatchObject({ regrasBlock: '' });
    // A conclusão é gravada por updateMany (filtro de status): a execução
    // terminou 'completed', e não ficou presa nem virou 'failed'.
    expect(updateManysCom('status').map((c) => c.data.status)).toContain('completed');
  });

  // ── Rodada 4 do PR #375: o sugeridor também vê as regras ─────────
  // O bloco chegava ao agente, mas o sugeridor das execuções completas lia
  // "Nenhuma regra aprovada ainda para este agente" e propunha a mesma
  // regra de novo. Pré-condição para ligar o interruptor.
  it('com bloco, o sugeridor recebe as regras ativas DO AGENTE', async () => {
    const REGRAS = [
      {
        id: 'regra-1',
        organizationId: 'org-1',
        agentId: 'agent-1',
        scenarioId: 'cr1',
        texto: 'Chame o cliente pelo nome quando souber.',
        status: 'ativa',
      },
    ];
    regrasMock.blocoDeRegrasDaOrganizacao.mockResolvedValue(BLOCO);
    regrasMock.carregarRegrasAtivas.mockResolvedValue(REGRAS);

    await executeRunJob('run-1');

    expect(regrasMock.carregarRegrasAtivas).toHaveBeenCalledWith({
      organizationId: 'org-1',
      agentId: 'agent-1',
    });
    expect(runnerMock.executeAgentEvalRun.mock.calls[0][3]).toMatchObject({
      regrasBlock: BLOCO,
      regrasAtivas: REGRAS,
    });
  });

  it('bloco vazio (interruptor desligado): nenhuma consulta a mais e lista vazia', async () => {
    regrasMock.blocoDeRegrasDaOrganizacao.mockResolvedValue('');

    await executeRunJob('run-1');

    expect(regrasMock.carregarRegrasAtivas).not.toHaveBeenCalled();
    // Rodada 2 do PR #377: o montador do motor único vai no MESMO objeto das
    // regras (um parâmetro só). As regras continuam exatamente estas.
    expect(runnerMock.executeAgentEvalRun.mock.calls[0][3]).toEqual({
      regrasBlock: '',
      regrasAtivas: [],
      montarContexto: expect.any(Function),
      // C2, nota 1: o modelo da faixa do plano, preguiçoso (evalNoTier).
      politica: expect.any(Function),
    });
  });

  it('regras indisponíveis não derrubam a execução: o sugeridor segue com lista vazia', async () => {
    regrasMock.blocoDeRegrasDaOrganizacao.mockResolvedValue(BLOCO);
    regrasMock.carregarRegrasAtivas.mockRejectedValue(new Error('banco fora'));

    await executeRunJob('run-1');

    expect(runnerMock.executeAgentEvalRun.mock.calls[0][3]).toMatchObject({
      regrasBlock: BLOCO,
      regrasAtivas: [],
    });
    expect(updateManysCom('status').map((c) => c.data.status)).toContain('completed');
  });
});

/* ══════════════════════════════════════════════════════════════════════
 * Rodada 4 do PR #375: o alerta de "reprovou duas vezes" compara com a
 * execução concluída anterior. O re-teste do cliente também nasce
 * 'completed', e as amostras dele não têm scenarioId: um re-teste entre
 * duas semanais virava a "anterior", a comparação dava vazio e o alerta do
 * cenário que reprovou nas duas semanais ficava 'skipped'. Vale com a flag
 * desligada.
 *
 * As regras de comparação são as REAIS (scenariosFailingTwice e
 * shouldAlertQuality do agentEvalCronService), não o duble: o teste prova
 * o alerta, não só a consulta.
 * ══════════════════════════════════════════════════════════════════════ */
describe('alerta de reprovação repetida: o re-teste do meio não é a execução anterior', () => {
  const SEMANAL_ANTERIOR = {
    id: 'run-semanal-1',
    agentId: 'agent-1',
    status: 'completed',
    triggeredBy: 'cron',
    startedAt: new Date('2026-09-07T04:30:00Z'),
    results: [
      { scenarioId: 'cr1', combined: 'fail' },
      { scenarioId: 'cr2', combined: 'pass' },
    ],
  };
  const RETESTE_NO_MEIO = {
    id: 'run-reteste',
    agentId: 'agent-1',
    status: 'completed',
    triggeredBy: 'client_retest',
    startedAt: new Date('2026-09-10T15:00:00Z'),
    results: [
      { amostra: 1, combined: 'pass', resposta: 'oi', motivoDoJuiz: 'ok' },
      { amostra: 2, combined: 'pass', resposta: 'oi', motivoDoJuiz: 'ok' },
      { amostra: 3, combined: 'fail', resposta: 'oi', motivoDoJuiz: 'não' },
    ],
  };

  beforeEach(async () => {
    const real = await vi.importActual<typeof import('./agentEvalCronService.js')>(
      './agentEvalCronService.js',
    );
    cronServiceMock.scenariosFailingTwice.mockImplementation(real.scenariosFailingTwice);
    cronServiceMock.shouldAlertQuality.mockImplementation(real.shouldAlertQuality);

    const linhas = [SEMANAL_ANTERIOR, RETESTE_NO_MEIO];
    // O banco falso honra o `where`: sem o filtro, o re-teste (mais novo) vem.
    prismaMock.agentEvalRun.findFirst.mockImplementation(async ({ where }: any) => {
      const [primeira] = linhas
        .filter((l) => l.agentId === where.agentId && l.status === where.status)
        .filter((l) => !(where?.id?.not && l.id === where.id.not))
        .filter((l) => !(where?.triggeredBy?.not && l.triggeredBy === where.triggeredBy.not))
        .sort((a, b) => b.startedAt.getTime() - a.startedAt.getTime());
      return primeira ? { results: primeira.results } : null;
    });

    prismaMock.agentEvalRun.findUnique.mockResolvedValue(
      runPendente({ id: 'run-semanal-2', triggeredBy: 'cron' }),
    );
    runnerMock.executeAgentEvalRun.mockResolvedValue({
      results: [
        { scenarioId: 'cr1', combined: 'fail', severity: 'high', category: 'cr1_acceptance' },
        { scenarioId: 'cr2', combined: 'pass', severity: 'critical', category: 'cr2_handoff' },
      ],
      durationMs: 10,
      summary: { passed: 1, partial: 0, failed: 1, criticalFailed: 0, erros: 0, scorePercent: 50 },
    });
  });

  it('a semanal que reprova X de novo alerta, com X na lista de repetidos', async () => {
    await executeRunJob('run-semanal-2');

    expect(ultimoUpdate('slackAlertStatus')).toMatchObject({ slackAlertStatus: 'sent' });
    expect(cronServiceMock.scenariosFailingTwice).toHaveReturnedWith(['cr1']);
    expect(cronServiceMock.notifySlackQualityIssue).toHaveBeenCalledTimes(1);
    expect(cronServiceMock.notifySlackQualityIssue.mock.calls[0][0].repetidos).toEqual(['cr1']);
    const where = prismaMock.agentEvalRun.findFirst.mock.calls[0][0].where;
    expect(where.triggeredBy).toEqual({ not: 'client_retest' });
  });
});

/* ══════════════════════════════════════════════════════════════════════
 * C2 (Passo 13, P13): rodízio dos casos de conhecimento na execução.
 * No máximo 8 por execução; os ids pedidos um a um não entram no rodízio;
 * a execução usa o started_at da própria linha como relógio.
 * ══════════════════════════════════════════════════════════════════════ */
describe('resolveScenariosForRun: rodízio dos casos de conhecimento (C2)', () => {
  const caso = (id: string, origem: 'qa' | 'questionario') => ({
    id,
    severity: 'high',
    category: 'kb_conhecimento',
    natureza: 'conhecimento',
    conhecimento: { origem },
  });
  const FIXOS = [{ id: 'cr1', severity: 'critical', category: 'cr1_acceptance', natureza: 'comportamento' }];
  const GERADOS = Array.from({ length: 12 }, (_, i) => caso(`kb_qa_${i}`, 'qa'));

  it('uma execução completa leva no máximo 8 casos gerados, e todos os fixos', async () => {
    const { resolveScenariosForRun } = await import('./agentEvalQueue.js');
    evalSetMock.resolveEvalSet.mockReturnValue([...FIXOS, ...GERADOS]);
    const lista = resolveScenariosForRun({} as any, {}, { agora: new Date('2026-09-14T12:00:00Z') });
    expect(lista.filter((c: any) => c.conhecimento)).toHaveLength(8);
    expect(lista.map((c: any) => c.id)).toContain('cr1');
  });

  it('ids pedidos um a um não passam pelo rodízio (re-teste de um caso fora da vez)', async () => {
    const { resolveScenariosForRun } = await import('./agentEvalQueue.js');
    evalSetMock.resolveEvalSet.mockReturnValue([...FIXOS, ...GERADOS]);
    const lista = resolveScenariosForRun({} as any, { scenarioIds: ['kb_qa_11'] });
    expect(lista.map((c: any) => c.id)).toEqual(['kb_qa_11']);
  });

  it('a execução usa o started_at da linha: o total da criação é o total que roda', async () => {
    const { executeRunJob } = await import('./agentEvalQueue.js');
    evalSetMock.resolveEvalSet.mockReturnValue([...FIXOS, ...GERADOS]);
    prismaMock.agentEvalRun.findUnique.mockResolvedValue(
      runPendente({ startedAt: new Date('2026-09-14T12:00:00Z') }),
    );

    await executeRunJob('run-1');

    const cenarios = runnerMock.executeAgentEvalRun.mock.calls[0][0];
    expect(cenarios.filter((c: any) => c.conhecimento)).toHaveLength(8);
  });
});

/* ══════════════════════════════════════════════════════════════════════
 * C2 (Passo 3, P21): a conclusão grava o placar dividido junto com a nota
 * única, e o avaliador recebe a política da faixa do plano (nota 1).
 * ══════════════════════════════════════════════════════════════════════ */
describe('executeRunJob grava o placar e entrega a política (C2)', () => {
  const PLACAR = {
    versao: 1,
    conhecimento: { estado: 'sem_base', total: 0, avaliados: 0, aprovados: 0, percent: null },
    comportamento: { estado: 'avaliado', total: 2, avaliados: 2, aprovados: 2, percent: 100 },
    inconclusivos: 0,
  };

  it('a linha concluída recebe o placar, e a nota única continua', async () => {
    const { executeRunJob } = await import('./agentEvalQueue.js');
    runnerMock.executeAgentEvalRun.mockResolvedValue({
      results: [{ scenarioId: 'cr1', combined: 'pass' }],
      durationMs: 10,
      summary: RESUMO_LIMPO,
      placar: PLACAR,
    });

    await executeRunJob('run-1');

    const conclusao = updateManysCom('status').find((c) => c.data.status === 'completed');
    expect(conclusao.data.placar).toEqual(PLACAR);
    expect(conclusao.data.scorePercent).toBe(RESUMO_LIMPO.scorePercent);
  });

  it('o avaliador recebe a política da faixa do plano como função preguiçosa', async () => {
    const { executeRunJob } = await import('./agentEvalQueue.js');
    await executeRunJob('run-1');
    expect(typeof runnerMock.executeAgentEvalRun.mock.calls[0][3].politica).toBe('function');
  });
});
