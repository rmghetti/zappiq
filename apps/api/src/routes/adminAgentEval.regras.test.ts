/**
 * adminAgentEval.regras.test.ts (rodada 3 do PR #375)
 * ============================================================================
 * As duas portas do superadmin que executam o avaliador (POST /run e o
 * re-verify dentro de POST /runs/:runId/scenarios/:scenarioId/apply-fix)
 * chamavam executeAgentEvalRun sem o bloco "# Regras aprovadas pelo dono".
 * Com o interruptor ligado na organização, o superadmin media o agente SEM
 * as regras que o dono aprovou.
 *
 * Sem supertest e sem banco: mocamos o I/O e chamamos o handler real. O
 * bloco vem de um duble de agentRulesService que registra com quem foi
 * chamado.
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

const CENARIO = {
  id: 'cr7_no_invent_sla',
  category: 'cr7_facts',
  description: 'não inventa prazo',
  userMessage: 'em quanto tempo entregam?',
  expectedBehavior: 'não promete prazo que não está cadastrado',
  severity: 'high',
};

// O gabarito TEM o cenário: é o que faz o re-verify pós-apply rodar.
vi.mock('../agents/agentEvalSet.js', () => ({
  resolveEvalSet: vi.fn(() => [CENARIO]),
  EVAL_SET_VERSION: 'v2',
}));

vi.mock('../agents/tenantAgentProfile.js', () => ({
  resolveTenantAgentProfile: vi.fn(async () => ({
    organizationId: 'org-cliente',
    isZappIQ: false,
    agentName: 'Vera',
    businessName: 'CMJ',
  })),
}));

vi.mock('../services/agentPromptPatcher.js', async () => {
  const real = await vi.importActual<typeof import('../services/agentPromptPatcher.js')>(
    '../services/agentPromptPatcher.js',
  );
  return {
    applyPatch: vi.fn(() => ({
      promptBefore: 'antes',
      promptAfter: 'depois',
      strategy: 'append' as const,
      insertedAtLine: 1,
    })),
    DuplicatePatchError: real.DuplicatePatchError,
    regraTerminaEmFraseCompleta: real.regraTerminaEmFraseCompleta,
  };
});

vi.mock('../services/promptVersionService.js', () => ({
  publishPrompt: vi.fn(async () => undefined),
  hashPrompt: vi.fn(() => 'hash'),
  PromptChangedError: class PromptChangedError extends Error {},
}));

vi.mock('../services/agentEvalQueue.js', () => ({
  enqueueEvalRun: vi.fn(async () => undefined),
  enqueueRegrade: vi.fn(async () => 'regrade-123'),
  resolveScenariosForRun: vi.fn(() => [CENARIO]),
}));
vi.mock('../services/evalRegradeService.js', () => ({
  execucoesParaRegravar: vi.fn(async () => []),
  contarExecucoesParaRegravar: vi.fn(async () => 0),
  resumirRegravacao: vi.fn(),
  TETO_DE_REGRAVACAO: 50,
}));
const runnerMock = {
  executeAgentEvalRun: vi.fn(),
  computeReverifyVerdict: vi.fn(() => ({ before: 'fail', after: 'pass', improved: true })),
  suggestFix: vi.fn(),
};
vi.mock('../services/agentEvalRunner.js', () => runnerMock);
vi.mock('../services/evalRuidoService.js', () => ({
  carregarRuidoDoAgente: vi.fn(async () => null),
}));
vi.mock('../services/agentEvalCronService.js', () => ({ notifySlackQualityIssue: vi.fn() }));
vi.mock('../services/slackNotifier.js', () => ({
  sendSlackAlert: vi.fn(),
  buildHeaderBlock: vi.fn(),
  buildSectionBlock: vi.fn(),
}));

const regrasMock = {
  carregarRegrasAtivas: vi.fn(async () => []),
  blocoDeRegrasDaOrganizacao: vi.fn(async () => ''),
};
vi.mock('../services/agentRulesService.js', () => regrasMock);

const { default: router } = await import('./adminAgentEval.js');

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

const BLOCO = '# Regras aprovadas pelo dono\n1. Nunca prometa prazo que não esteja cadastrado.';

const AGENTE = {
  id: 'agent-1',
  name: 'Vera',
  systemPrompt: 'prompt do cliente',
  organizationId: 'org-cliente',
};

const REGRA_INTEIRA =
  '+ **REGRA INVIOLÁVEL #14 (PRAZO):** nunca prometa prazo que não está cadastrado. ' +
  'Exemplo CORRETO: "vou confirmar com o time". Exemplo INCORRETO: "respondo em milissegundos".';

beforeEach(() => {
  vi.clearAllMocks();
  regrasMock.blocoDeRegrasDaOrganizacao.mockResolvedValue(BLOCO);
  regrasMock.carregarRegrasAtivas.mockResolvedValue([]);
  runnerMock.executeAgentEvalRun.mockResolvedValue({
    results: [{ scenarioId: 'cr7_no_invent_sla', combined: 'pass' }],
    durationMs: 10,
    summary: { passed: 1, partial: 0, failed: 0, criticalFailed: 0, erros: 0, scorePercent: 100 },
  });
  runnerMock.computeReverifyVerdict.mockReturnValue({ before: 'fail', after: 'pass', improved: true });
  prismaMock.agent.findUnique.mockResolvedValue(AGENTE);
  prismaMock.agentEvalFixDecision.findFirst.mockResolvedValue(null);
  prismaMock.agentEvalFixDecision.create.mockResolvedValue({ id: 'dec-1' });
  prismaMock.user.findUnique.mockResolvedValue({
    id: 'super-1',
    email: 'rod@zappiq.com.br',
    name: 'Rod',
    role: 'SUPERADMIN',
  });
});

describe('POST /run (síncrono): o superadmin mede o agente COM as regras aprovadas', () => {
  it('monta o bloco pela organização DO AGENTE e pelo agente, e entrega ao avaliador', async () => {
    const res = makeRes();
    await getHandler('post', '/run')({ user: { userId: 'super-1' }, body: { agentId: 'agent-1' } }, res);

    expect(res.statusCode).toBe(200);
    expect(regrasMock.blocoDeRegrasDaOrganizacao).toHaveBeenCalledWith('org-cliente', {
      agentId: 'agent-1',
    });
    expect(runnerMock.executeAgentEvalRun).toHaveBeenCalledTimes(1);
    expect(runnerMock.executeAgentEvalRun.mock.calls[0][3]).toMatchObject({ regrasBlock: BLOCO });
  });

  it('bloco indisponível não derruba a execução: segue sem ele', async () => {
    regrasMock.blocoDeRegrasDaOrganizacao.mockRejectedValue(new Error('banco fora'));

    const res = makeRes();
    await getHandler('post', '/run')({ user: { userId: 'super-1' }, body: { agentId: 'agent-1' } }, res);

    expect(res.statusCode).toBe(200);
    expect(runnerMock.executeAgentEvalRun.mock.calls[0][3]).toMatchObject({ regrasBlock: '' });
  });
});

describe('apply-fix do superadmin: o re-verify mede o prompt novo COM as regras', () => {
  const ROTA = '/runs/:runId/scenarios/:scenarioId/apply-fix';

  function runComSugestao() {
    return {
      id: 'run-1',
      agentId: 'agent-1',
      results: [
        {
          scenarioId: 'cr7_no_invent_sla',
          severity: 'high',
          combined: 'fail',
          suggestedFix: {
            summary: 's',
            patches: [{ where: 'novo', diff: REGRA_INTEIRA }],
            confidence: 0.9,
          },
        },
      ],
      agent: AGENTE,
    };
  }

  it('o re-verify recebe o bloco do agente da execução', async () => {
    prismaMock.agentEvalRun.findUnique.mockResolvedValue(runComSugestao());

    const res = makeRes();
    await getHandler('post', ROTA)(
      {
        user: { userId: 'super-1', role: 'SUPERADMIN' },
        params: { runId: 'run-1', scenarioId: 'cr7_no_invent_sla' },
        body: {},
      },
      res,
    );

    expect(res.statusCode).toBe(200);
    expect(res.body.ok).toBe(true);
    // O re-verify rodou de verdade (o gabarito tem o cenário).
    expect(runnerMock.executeAgentEvalRun).toHaveBeenCalledTimes(1);
    expect(regrasMock.blocoDeRegrasDaOrganizacao).toHaveBeenCalledWith('org-cliente', {
      agentId: 'agent-1',
    });
    expect(runnerMock.executeAgentEvalRun.mock.calls[0][3]).toMatchObject({ regrasBlock: BLOCO });
    // E mede o prompt recém-aplicado, como antes.
    expect(runnerMock.executeAgentEvalRun.mock.calls[0][1]).toMatchObject({
      systemPrompt: 'depois',
    });
  });
});
