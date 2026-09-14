/**
 * agentEvalQueue.trava.test.ts: concorrência 1 vale por PROCESSO
 * ============================================================================
 * A fila `agent-eval` foi criada com `concurrency: 1` e o comentário dizia que
 * isso impede duas execuções ao mesmo tempo. Não impede: `min_machines_running
 * = 2` no fly.toml sobe DOIS workers, cada um com a sua concorrência 1. São
 * duas execuções simultâneas, dois testes pagos e 429 no provedor, que é o
 * problema que a concorrência 1 existia para evitar.
 *
 * A trava é uma chave única no Redis (SET NX PX), fora do BullMQ:
 *   ✓ quem pega a trava executa e devolve no fim
 *   ✓ quem não pega adia o job por 30 s (moveToDelayed + DelayedError, o
 *     padrão do BullMQ para adiar de dentro do processador) e não executa
 *   ✓ a liberação só apaga a trava se o valor ainda for o próprio runId
 *   ✓ execução que falha também devolve a trava
 *   ✓ Redis fora do ar não impede o teste de rodar (fail-soft)
 * ============================================================================
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { DelayedError } from 'bullmq';

const { prismaMock, runnerMock, cronServiceMock, profileMock, evalSetMock, redisFake } =
  vi.hoisted(() => {
    const guardado = new Map<string, string>();
    return {
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
      /** Redis falso: só SET com NX/PX e EVAL do script de liberação. */
      redisFake: {
        guardado,
        set: vi.fn(async (chave: string, valor: string, _px: string, _ttl: number, nx: string) => {
          if (nx === 'NX' && guardado.has(chave)) return null;
          guardado.set(chave, valor);
          return 'OK';
        }),
        eval: vi.fn(async (_script: string, _n: number, chave: string, valor: string) => {
          if (guardado.get(chave) !== valor) return 0;
          guardado.delete(chave);
          return 1;
        }),
      },
    };
  });

vi.mock('@zappiq/database', () => ({ prisma: prismaMock }));
vi.mock('../utils/logger.js', () => ({
  logger: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));
vi.mock('../utils/redis.js', () => ({ default: redisFake, redis: redisFake }));
vi.mock('./agentEvalRunner.js', () => runnerMock);
// Rodada 3 do PR #375: a fila monta o bloco de regras antes de avaliar. O
// duble evita interruptor e Redis neste teste, que não é sobre isso.
vi.mock('./agentRulesService.js', () => ({ blocoDeRegrasDaOrganizacao: vi.fn(async () => '') }));
vi.mock('./agentEvalCronService.js', () => cronServiceMock);
vi.mock('../agents/tenantAgentProfile.js', () => profileMock);
vi.mock('../agents/agentEvalSet.js', () => evalSetMock);

const {
  processarExecucaoNaFila,
  adquirirTravaGlobal,
  liberarTravaGlobal,
  TRAVA_GLOBAL_CHAVE,
  TRAVA_GLOBAL_TTL_MS,
  ESPERA_TRAVA_OCUPADA_MS,
  EVAL_RUN_TIMEOUT_MS,
} = await import('./agentEvalQueue.js');

/** Job da fila, no mínimo que o processador toca. */
function jobDe(runId: string | undefined) {
  return {
    id: 'job-1',
    data: runId ? { runId } : {},
    moveToDelayed: vi.fn().mockResolvedValue(undefined),
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  redisFake.guardado.clear();
  prismaMock.agentEvalRun.findUnique.mockResolvedValue({
    id: 'run-1',
    status: 'pending',
    triggeredBy: 'cron',
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
  });
  prismaMock.agentEvalRun.findFirst.mockResolvedValue(null);
  prismaMock.agentEvalRun.update.mockResolvedValue({});
  prismaMock.agentEvalRun.updateMany.mockImplementation(async ({ where }: any) =>
    where?.id ? { count: 1 } : { count: 0 },
  );
  profileMock.resolveTenantAgentProfile.mockResolvedValue({ organizationId: 'org-1' });
  evalSetMock.resolveEvalSet.mockReturnValue([{ id: 'cr1' }]);
  runnerMock.executeAgentEvalRun.mockResolvedValue({
    results: [{ scenarioId: 'cr1', combined: 'pass' }],
    durationMs: 10,
    summary: { passed: 1, partial: 0, failed: 0, criticalFailed: 0, scorePercent: 100 },
  });
  cronServiceMock.scenariosFailingTwice.mockReturnValue([]);
  cronServiceMock.shouldAlertQuality.mockReturnValue(false);
});

describe('trava global: SET NX PX numa chave só', () => {
  it('a chave e o prazo são os combinados', async () => {
    expect(TRAVA_GLOBAL_CHAVE).toBe('zappiq:agent-eval:lock');
    // O prazo cobre o teto da execução com folga de 1 minuto: trava que
    // vencesse antes liberaria uma segunda execução por cima da primeira.
    expect(TRAVA_GLOBAL_TTL_MS).toBe(EVAL_RUN_TIMEOUT_MS + 60_000);
  });

  it('grava com NX e PX e devolve true quando a trava estava livre', async () => {
    expect(await adquirirTravaGlobal('run-1')).toBe(true);
    expect(redisFake.set).toHaveBeenCalledWith(
      'zappiq:agent-eval:lock',
      'run-1',
      'PX',
      TRAVA_GLOBAL_TTL_MS,
      'NX',
    );
  });

  it('devolve false quando outra execução já está com a trava', async () => {
    await adquirirTravaGlobal('run-1');

    expect(await adquirirTravaGlobal('run-2')).toBe(false);
  });

  it('liberar só apaga a trava do próprio runId', async () => {
    await adquirirTravaGlobal('run-1');

    // A execução 2 nunca teve a trava: não pode apagar a da execução 1.
    expect(await liberarTravaGlobal('run-2')).toBe(false);
    expect(redisFake.guardado.get('zappiq:agent-eval:lock')).toBe('run-1');

    expect(await liberarTravaGlobal('run-1')).toBe(true);
    expect(redisFake.guardado.has('zappiq:agent-eval:lock')).toBe(false);
  });
});

describe('processador da fila agent-eval', () => {
  it('executa e devolve a trava quando ela estava livre', async () => {
    await processarExecucaoNaFila(jobDe('run-1') as any, 'token-1');

    expect(runnerMock.executeAgentEvalRun).toHaveBeenCalledTimes(1);
    expect(redisFake.guardado.has(TRAVA_GLOBAL_CHAVE)).toBe(false);
  });

  it('adia o job em 30 s quando a outra máquina está executando', async () => {
    await adquirirTravaGlobal('run-da-outra-maquina');
    const job = jobDe('run-1');
    const antes = Date.now();

    await expect(processarExecucaoNaFila(job as any, 'token-1')).rejects.toBeInstanceOf(
      DelayedError,
    );

    expect(runnerMock.executeAgentEvalRun).not.toHaveBeenCalled();
    expect(job.moveToDelayed).toHaveBeenCalledTimes(1);
    const [quando, token] = job.moveToDelayed.mock.calls[0];
    expect(quando).toBeGreaterThanOrEqual(antes + ESPERA_TRAVA_OCUPADA_MS);
    expect(quando).toBeLessThanOrEqual(Date.now() + ESPERA_TRAVA_OCUPADA_MS + 1000);
    // O token é obrigatório: sem ele o BullMQ recusa mover o job.
    expect(token).toBe('token-1');
    // E a trava da outra máquina continua de pé.
    expect(redisFake.guardado.get(TRAVA_GLOBAL_CHAVE)).toBe('run-da-outra-maquina');
  });

  it('devolve a trava mesmo quando a execução falha', async () => {
    runnerMock.executeAgentEvalRun.mockRejectedValue(new Error('provedor fora do ar'));

    await processarExecucaoNaFila(jobDe('run-1') as any, 'token-1');

    expect(redisFake.guardado.has(TRAVA_GLOBAL_CHAVE)).toBe(false);
  });

  it('job sem runId não toma a trava nem executa', async () => {
    await processarExecucaoNaFila(jobDe(undefined) as any, 'token-1');

    expect(redisFake.set).not.toHaveBeenCalled();
    expect(runnerMock.executeAgentEvalRun).not.toHaveBeenCalled();
  });

  it('Redis fora do ar não impede o teste de rodar', async () => {
    // Fail-soft deliberado: a trava existe para não gastar LLM duas vezes, não
    // para bloquear o produto. Sem Redis, a alternativa seria nunca avaliar.
    redisFake.set.mockRejectedValueOnce(new Error('Redis fora do ar'));

    await processarExecucaoNaFila(jobDe('run-1') as any, 'token-1');

    expect(runnerMock.executeAgentEvalRun).toHaveBeenCalledTimes(1);
  });
});
