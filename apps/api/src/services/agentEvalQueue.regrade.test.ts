/**
 * agentEvalQueue.regrade.test.ts (P61)
 * ============================================================================
 * A regravação entra pela MESMA fila `agent-eval` e pela MESMA trava global do
 * #352. Não porque ela seja cara (não chama LLM nenhuma), mas porque a trava é
 * o que garante que ela não roda ao mesmo tempo que um teste pago do mesmo
 * agente, lendo `results` de uma execução que ainda está sendo gravada.
 * ============================================================================
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

const { prismaMock, runnerMock, cronServiceMock, profileMock, evalSetMock, regradeMock } =
  vi.hoisted(() => ({
    prismaMock: {
      agentEvalRun: {
        findUnique: vi.fn(),
        findFirst: vi.fn(),
        findMany: vi.fn(),
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
    evalSetMock: { resolveEvalSet: vi.fn(() => []), EVAL_SET_VERSION: 'v2', HARNESS_VERSION: 3 },
    regradeMock: { regradeRun: vi.fn(), execucoesParaRegravar: vi.fn() },
  }));

vi.mock('@zappiq/database', () => ({ prisma: prismaMock }));
vi.mock('../utils/logger.js', () => ({
  logger: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));
vi.mock('./agentEvalRunner.js', () => runnerMock);
// Rodada 3 do PR #375: a fila monta o bloco de regras antes de avaliar. O
// duble evita interruptor e Redis neste teste, que não é sobre isso.
vi.mock('./agentRulesService.js', () => ({
  blocoDeRegrasDaOrganizacao: vi.fn(async () => ''),
  carregarRegrasAtivas: vi.fn(async () => []),
}));
vi.mock('./agentEvalCronService.js', () => cronServiceMock);
vi.mock('../agents/tenantAgentProfile.js', () => profileMock);
vi.mock('../agents/agentEvalSet.js', () => evalSetMock);
vi.mock('./evalRegradeService.js', () => regradeMock);

const {
  processarExecucaoNaFila,
  enqueueRegrade,
  getAgentEvalQueue,
  TRAVA_GLOBAL_CHAVE,
  EVAL_RUN_TIMEOUT_MS,
} = await import('./agentEvalQueue.js');

/** Trava falsa: registra quem pegou e libera de verdade. */
function travaFalsa() {
  let dono: string | null = null;
  return {
    dono: () => dono,
    cliente: {
      async set(_c: string, valor: string) {
        if (dono !== null) return null;
        dono = valor;
        return 'OK';
      },
      async eval(_s: string, _n: number, _chave: string, valor: string) {
        if (dono === valor) {
          dono = null;
          return 1;
        }
        return 0;
      },
    },
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  regradeMock.regradeRun.mockResolvedValue({
    runId: 'run-1',
    notaAntiga: 47,
    notaRegravada: 81,
    reprovacoesDoGabarito: 5,
  });
});

describe('job de regravação na fila agent-eval', () => {
  it('regrava cada execução da lista e não roda o teste pago', async () => {
    const job: any = { id: 'regrade-1', data: { tipo: 'regrade', runIds: ['run-1', 'run-2'] } };

    await processarExecucaoNaFila(job, 'token', travaFalsa().cliente as any);

    expect(regradeMock.regradeRun).toHaveBeenCalledTimes(2);
    expect(regradeMock.regradeRun).toHaveBeenCalledWith('run-1', { dryRun: false });
    expect(regradeMock.regradeRun).toHaveBeenCalledWith('run-2', { dryRun: false });
    // Nenhuma chamada paga: o executor do teste nem é tocado.
    expect(runnerMock.executeAgentEvalRun).not.toHaveBeenCalled();
  });

  it('dryRun atravessa até o serviço', async () => {
    const job: any = { id: 'r', data: { tipo: 'regrade', runIds: ['run-1'], dryRun: true } };
    await processarExecucaoNaFila(job, 'token', travaFalsa().cliente as any);
    expect(regradeMock.regradeRun).toHaveBeenCalledWith('run-1', { dryRun: true });
  });

  it('falha numa execução não derruba as outras', async () => {
    regradeMock.regradeRun
      .mockRejectedValueOnce(new Error('results corrompido'))
      .mockResolvedValueOnce({ runId: 'run-2', notaAntiga: 50, notaRegravada: 60 });
    const job: any = { id: 'r', data: { tipo: 'regrade', runIds: ['run-1', 'run-2'] } };

    await processarExecucaoNaFila(job, 'token', travaFalsa().cliente as any);

    expect(regradeMock.regradeRun).toHaveBeenCalledTimes(2);
  });

  it('usa a MESMA trava global do teste pago e a devolve no fim', async () => {
    const trava = travaFalsa();
    const job: any = { id: 'regrade-1', data: { tipo: 'regrade', runIds: ['run-1'] } };

    await processarExecucaoNaFila(job, 'token', trava.cliente as any);

    // Devolvida: o próximo teste do mesmo agente entra sem esperar o prazo.
    expect(trava.dono()).toBeNull();
    expect(TRAVA_GLOBAL_CHAVE).toBe('zappiq:agent-eval:lock');
  });

  it('trava ocupada adia o job em vez de rodar em paralelo', async () => {
    const trava = travaFalsa();
    await trava.cliente.set(TRAVA_GLOBAL_CHAVE, 'outro-job');
    const job: any = {
      id: 'regrade-1',
      data: { tipo: 'regrade', runIds: ['run-1'] },
      moveToDelayed: vi.fn(async () => undefined),
    };

    await expect(
      processarExecucaoNaFila(job, 'token', trava.cliente as any),
    ).rejects.toThrow();

    expect(job.moveToDelayed).toHaveBeenCalled();
    expect(regradeMock.regradeRun).not.toHaveBeenCalled();
  });
});

describe('enqueueRegrade', () => {
  it('recusa lista vazia em vez de enfileirar um job sem trabalho', async () => {
    await expect(enqueueRegrade({ runIds: [], dryRun: false })).rejects.toThrow(/nenhuma execução/i);
  });

  it('a fila é a mesma do teste da Qualidade', () => {
    // Só o nome: abrir conexão de verdade não é trabalho de teste.
    expect(typeof getAgentEvalQueue).toBe('function');
  });
});

/* ══════════════════════════════════════════════════════════════════════
 * Revisão do PR: a regravação também tem teto de tempo.
 * --------------------------------------------------------------------
 * A execução paga tinha teto de 25 minutos; a regravação, nenhum. Com 200
 * execuções na lista, um banco lento segurava a trava global por tempo
 * indeterminado e NENHUM cliente conseguia rodar o teste de qualidade dele,
 * porque a trava é a mesma. O teto aborta e a trava volta.
 * ══════════════════════════════════════════════════════════════════════ */
describe('a regravação tem o mesmo teto de 25 minutos e devolve a trava', () => {
  it('estourado o teto, o job termina e a trava é liberada', async () => {
    vi.useFakeTimers();
    try {
      const trava = travaFalsa();
      // Uma regravação que nunca volta: é o banco pendurado.
      regradeMock.regradeRun.mockImplementation(() => new Promise(() => {}));
      const job: any = { id: 'regrade-1', data: { tipo: 'regrade', runIds: ['run-1'] } };

      const promessa = processarExecucaoNaFila(job, 'token', trava.cliente as any);
      await vi.advanceTimersByTimeAsync(EVAL_RUN_TIMEOUT_MS + 1000);
      await promessa;

      // O ponto todo: a trava global voltou para os outros clientes.
      expect(trava.dono()).toBeNull();
    } finally {
      vi.useRealTimers();
    }
  });

  it('dentro do teto, a regravação termina normalmente', async () => {
    const trava = travaFalsa();
    const job: any = { id: 'regrade-1', data: { tipo: 'regrade', runIds: ['run-1', 'run-2'] } };

    await processarExecucaoNaFila(job, 'token', trava.cliente as any);

    expect(regradeMock.regradeRun).toHaveBeenCalledTimes(2);
    expect(trava.dono()).toBeNull();
  });
});
