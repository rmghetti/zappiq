/**
 * adminAgentEval.applyFix.test.ts (A188, rodada 3)
 * ============================================================================
 * A trava que impede uma regra cortada no meio de entrar no system_prompt
 * vivo existia só na porta do cliente (agentQuality.ts). A porta do
 * superadmin escrevia no prompt de QUALQUER cliente sem passar por ela, que
 * é justamente por onde os cinco fragmentos truncados chegaram aos prompts
 * da Iza e da Marcia.
 *
 * Aqui provamos a mesma recusa em POST /runs/:runId/scenarios/:scenarioId/
 * apply-fix do admin: 422 sem gravar decisão nem publicar prompt, tanto na
 * sugestão crua quanto no texto que o admin editou antes de aplicar.
 *
 * Sem supertest e sem banco: mocamos o I/O e chamamos o handler real. A régua
 * em si vem do módulo de verdade (importActual), para o teste não provar
 * apenas que a rota chama alguma coisa.
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

// Gabarito vazio: o re-verify pós-apply não acha o cenário e não roda LLM.
vi.mock('../agents/agentEvalSet.js', () => ({
  resolveEvalSet: vi.fn(() => []),
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

const applyPatchMock = vi.fn(() => ({
  promptBefore: 'antes',
  promptAfter: 'depois',
  strategy: 'append' as const,
  insertedAtLine: 1,
}));
vi.mock('../services/agentPromptPatcher.js', async () => {
  const real =
    await vi.importActual<typeof import('../services/agentPromptPatcher.js')>(
      '../services/agentPromptPatcher.js',
    );
  return {
    applyPatch: applyPatchMock,
    DuplicatePatchError: real.DuplicatePatchError,
    // A régua de verdade, não uma cópia: se ela mudar, este teste acompanha.
    regraTerminaEmFraseCompleta: real.regraTerminaEmFraseCompleta,
  };
});

const publishPromptMock = vi.fn(async () => undefined);
vi.mock('../services/promptVersionService.js', () => ({
  publishPrompt: publishPromptMock,
  hashPrompt: vi.fn(() => 'hash'),
  PromptChangedError: class PromptChangedError extends Error {},
}));

vi.mock('../services/agentEvalQueue.js', () => ({
  enqueueEvalRun: vi.fn(async () => undefined),
  enqueueRegrade: vi.fn(async () => 'regrade-123'),
  resolveScenariosForRun: vi.fn(() => []),
}));
vi.mock('../services/evalRegradeService.js', () => ({
  execucoesParaRegravar: vi.fn(async () => []),
  contarExecucoesParaRegravar: vi.fn(async () => 0),
  resumirRegravacao: vi.fn(),
  TETO_DE_REGRAVACAO: 50,
}));
const runnerMock = {
  executeAgentEvalRun: vi.fn(),
  computeReverifyVerdict: vi.fn(),
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

const ROTA = '/runs/:runId/scenarios/:scenarioId/apply-fix';

const REGRA_CORTADA =
  '+ **REGRA INVIOLÁVEL #14 (PRAZO):** nunca prometa prazo que não está cadastrado. ' +
  'Exemplo CORRETO: "vou confirmar com o time". Exemplo INCORRETO: "respondo em milissegund';

const REGRA_INTEIRA =
  '+ **REGRA INVIOLÁVEL #14 (PRAZO):** nunca prometa prazo que não está cadastrado. ' +
  'Exemplo CORRETO: "vou confirmar com o time". Exemplo INCORRETO: "respondo em milissegundos".';

function runComSugestao(diff: string) {
  return {
    id: 'run-1',
    agentId: 'agent-1',
    results: [
      {
        scenarioId: 'cr7_no_invent_sla',
        severity: 'high',
        combined: 'fail',
        suggestedFix: { summary: 's', patches: [{ where: 'novo', diff }], confidence: 0.9 },
      },
    ],
    agent: {
      id: 'agent-1',
      name: 'Vera',
      systemPrompt: 'prompt do cliente',
      organizationId: 'org-cliente',
    },
  };
}

function chamar(body: Record<string, unknown>) {
  const res = makeRes();
  return getHandler('post', ROTA)(
    {
      user: { userId: 'super-1', role: 'SUPERADMIN' },
      params: { runId: 'run-1', scenarioId: 'cr7_no_invent_sla' },
      body,
    },
    res,
  ).then(() => res);
}

beforeEach(() => {
  vi.clearAllMocks();
  prismaMock.agentEvalFixDecision.findFirst.mockResolvedValue(null);
  prismaMock.agentEvalFixDecision.create.mockResolvedValue({ id: 'dec-1' });
  prismaMock.user.findUnique.mockResolvedValue({
    id: 'super-1',
    email: 'rod@zappiq.com.br',
    name: 'Rod',
    role: 'SUPERADMIN',
  });
  applyPatchMock.mockReturnValue({
    promptBefore: 'antes',
    promptAfter: 'depois',
    strategy: 'append',
    insertedAtLine: 1,
  });
});

describe('A188 na porta do superadmin: regra cortada não entra no prompt vivo', () => {
  it('recusa com 422 a sugestão que termina no meio da palavra', async () => {
    prismaMock.agentEvalRun.findUnique.mockResolvedValue(runComSugestao(REGRA_CORTADA));

    const res = await chamar({});

    expect(res.statusCode).toBe(422);
    expect(res.body.error).toBe('regra_incompleta');
    expect(res.body.message).toMatch(/cortad/i);
    expect(res.body.fim).toContain('milissegund');
    // Nada gravado: nem a decisão de auditoria, nem a versão do prompt.
    expect(prismaMock.agentEvalFixDecision.create).not.toHaveBeenCalled();
    expect(publishPromptMock).not.toHaveBeenCalled();
    expect(applyPatchMock).not.toHaveBeenCalled();
  });

  it('recusa também o finalDiff que o admin editou e deixou cortado', async () => {
    prismaMock.agentEvalRun.findUnique.mockResolvedValue(runComSugestao(REGRA_INTEIRA));

    const res = await chamar({ finalDiff: 'texto que para no meio de uma palav' });

    expect(res.statusCode).toBe(422);
    expect(res.body.error).toBe('regra_incompleta');
    expect(prismaMock.agentEvalFixDecision.create).not.toHaveBeenCalled();
    expect(publishPromptMock).not.toHaveBeenCalled();
  });

  it('deixa passar a regra inteira', async () => {
    prismaMock.agentEvalRun.findUnique.mockResolvedValue(runComSugestao(REGRA_INTEIRA));

    const res = await chamar({});

    expect(res.statusCode).toBe(200);
    expect(res.body.ok).toBe(true);
    expect(prismaMock.agentEvalFixDecision.create).toHaveBeenCalled();
    expect(publishPromptMock).toHaveBeenCalled();
  });
});
