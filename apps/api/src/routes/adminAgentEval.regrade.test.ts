/**
 * adminAgentEval.regrade.test.ts (P61)
 * ============================================================================
 * As duas rotas que o fundador usa para recalcular a nota sobre o que já está
 * gravado, sem gastar nada:
 *
 *   POST /api/admin/agent-eval/regrade      { organizationId?, runIds?, dryRun }
 *   GET  /api/admin/agent-eval/regrade/:runId
 *
 * SUPERADMIN, como toda rota deste arquivo. Sem supertest: mocamos o I/O e
 * chamamos o handler real.
 * ============================================================================
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

const prismaMock: any = {
  agent: { findUnique: vi.fn(), findMany: vi.fn() },
  agentEvalRun: { findUnique: vi.fn(), findFirst: vi.fn(), findMany: vi.fn(), create: vi.fn() },
  agentEvalFixDecision: { findFirst: vi.fn(), findMany: vi.fn(), create: vi.fn() },
  evalRegrade: { findMany: vi.fn() },
  organization: { findUnique: vi.fn() },
  user: { findUnique: vi.fn() },
  $transaction: vi.fn(async (fn: any) => fn(prismaMock)),
};

vi.mock('@zappiq/database', () => ({ prisma: prismaMock, Prisma: {} }));
vi.mock('../utils/logger.js', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));
vi.mock('../middleware/auth.js', () => ({
  authMiddleware: (_req: any, _res: any, next: any) => next(),
  requireRole: vi.fn(() => (_req: any, _res: any, next: any) => next()),
}));

const filaMock = {
  enqueueEvalRun: vi.fn(async () => undefined),
  enqueueRegrade: vi.fn(async () => 'regrade-123'),
  resolveScenariosForRun: vi.fn(() => []),
};
vi.mock('../services/agentEvalQueue.js', () => filaMock);

const regradeMock = {
  execucoesParaRegravar: vi.fn(async () => ['run-1', 'run-2']),
  resumirRegravacao: vi.fn(),
};
vi.mock('../services/evalRegradeService.js', () => regradeMock);

vi.mock('../services/agentEvalRunner.js', () => ({
  executeAgentEvalRun: vi.fn(),
  computeReverifyVerdict: vi.fn(),
  suggestFix: vi.fn(),
}));
vi.mock('../services/agentEvalCronService.js', () => ({ notifySlackQualityIssue: vi.fn() }));
vi.mock('../services/slackNotifier.js', () => ({
  sendSlackAlert: vi.fn(),
  buildHeaderBlock: vi.fn(),
  buildSectionBlock: vi.fn(),
}));

const { default: router } = await import('./adminAgentEval.js');
const { requireRole } = await import('../middleware/auth.js');

// Os guardas são montados no import do módulo, e o beforeEach limpa os spies.
// Guardamos aqui o que foi pedido na montagem das rotas.
const PAPEIS_EXIGIDOS: string[] = (requireRole as any).mock.calls.map((c: any[]) => c[0]);

type RouteLayer = {
  route?: { path: string; methods: Record<string, boolean>; stack: Array<{ handle: any }> };
};

function getHandler(method: string, path: string) {
  const stack = (router as unknown as { stack: RouteLayer[] }).stack;
  const layer = stack.find(
    (l) => l.route?.path === path && !!l.route?.methods?.[method.toLowerCase()],
  );
  if (!layer || !layer.route) throw new Error(`rota ${method} ${path} não encontrada`);
  const rs = layer.route.stack;
  return rs[rs.length - 1].handle as (req: any, res: any) => Promise<void>;
}

function makeRes() {
  const res: any = { statusCode: 200, body: undefined };
  res.status = vi.fn((c: number) => {
    res.statusCode = c;
    return res;
  });
  res.json = vi.fn((b: any) => {
    res.body = b;
    return res;
  });
  return res;
}

beforeEach(() => {
  vi.clearAllMocks();
  regradeMock.execucoesParaRegravar.mockResolvedValue(['run-1', 'run-2']);
  filaMock.enqueueRegrade.mockResolvedValue('regrade-123');
});

describe('POST /regrade — o botão do fundador', () => {
  it('enfileira e devolve 202 com o que vai ser relido', async () => {
    const res = makeRes();
    await getHandler('post', '/regrade')(
      { user: { userId: 'u1' }, body: { organizationId: 'org-1', dryRun: true } },
      res,
    );

    expect(res.statusCode).toBe(202);
    expect(res.body.jobId).toBe('regrade-123');
    expect(res.body.execucoes).toBe(2);
    expect(res.body.dryRun).toBe(true);
    expect(filaMock.enqueueRegrade).toHaveBeenCalledWith({
      runIds: ['run-1', 'run-2'],
      dryRun: true,
    });
  });

  it('dryRun é o padrão: sem dizer nada, não grava', async () => {
    const res = makeRes();
    await getHandler('post', '/regrade')({ user: { userId: 'u1' }, body: {} }, res);
    expect(filaMock.enqueueRegrade.mock.calls[0][0].dryRun).toBe(true);
  });

  it('runIds explícito atravessa sem consultar o banco', async () => {
    const res = makeRes();
    await getHandler('post', '/regrade')(
      { user: { userId: 'u1' }, body: { runIds: ['run-9'], dryRun: false } },
      res,
    );
    expect(regradeMock.execucoesParaRegravar).toHaveBeenCalledWith({
      organizationId: undefined,
      runIds: ['run-9'],
    });
    expect(filaMock.enqueueRegrade).toHaveBeenCalledWith({ runIds: ['run-1', 'run-2'], dryRun: false });
  });

  it('nada elegível devolve 400 em vez de enfileirar job vazio', async () => {
    regradeMock.execucoesParaRegravar.mockResolvedValue([]);
    const res = makeRes();
    await getHandler('post', '/regrade')({ user: { userId: 'u1' }, body: {} }, res);
    expect(res.statusCode).toBe(400);
    expect(filaMock.enqueueRegrade).not.toHaveBeenCalled();
  });

  it('exige SUPERADMIN, como toda rota deste arquivo', () => {
    // Uma entrada por rota montada, e todas pedem SUPERADMIN.
    expect(PAPEIS_EXIGIDOS.length).toBeGreaterThan(0);
    expect(PAPEIS_EXIGIDOS.every((p) => p === 'SUPERADMIN')).toBe(true);
    // As duas rotas da regravação carregam três camadas: auth, papel, handler.
    const stack = (router as any).stack as RouteLayer[];
    for (const caminho of ['/regrade', '/regrade/:runId']) {
      const layer = stack.find((l) => l.route?.path === caminho);
      expect(layer?.route?.stack).toHaveLength(3);
    }
  });
});

describe('GET /regrade/:runId — o resumo que o fundador lê', () => {
  it('devolve nota antiga, nota regravada e o que era do gabarito', async () => {
    regradeMock.resumirRegravacao.mockResolvedValue({
      runId: 'run-1',
      agentName: 'Vera',
      notaAntiga: 47,
      notaRegravada: 81,
      reprovacoesDoGabarito: 6,
      continuamReprovados: ['cr8_no_pede_cpf'],
      porCenario: [],
    });
    const res = makeRes();

    await getHandler('get', '/regrade/:runId')({ params: { runId: 'run-1' } }, res);

    expect(res.statusCode).toBe(200);
    expect(res.body.notaAntiga).toBe(47);
    expect(res.body.notaRegravada).toBe(81);
    expect(res.body.reprovacoesDoGabarito).toBe(6);
  });

  it('execução sem regravação devolve 404 com texto em português', async () => {
    regradeMock.resumirRegravacao.mockResolvedValue(null);
    const res = makeRes();
    await getHandler('get', '/regrade/:runId')({ params: { runId: 'run-x' } }, res);
    expect(res.statusCode).toBe(404);
    expect(String(res.body.error)).toMatch(/regravação/i);
  });
});
