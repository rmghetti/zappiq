/**
 * adminAgentEval.revert.test.ts
 * ============================================================================
 * Mesma trava do lado cliente (A083), agora na rota do superadmin: reverter
 * uma correção só vale enquanto o prompt do agente ainda for o que aquela
 * correção deixou. Se o cliente editou depois, reverter apagaria o trabalho
 * dele sem avisar.
 *
 * Sem supertest: mocamos as dependências de I/O, importamos o router e
 * chamamos o handler real (mesma abordagem de conversations.tenant.test.ts).
 * ============================================================================
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

const prismaMock: any = {
  agent: { findFirst: vi.fn(), findUnique: vi.fn(), update: vi.fn() },
  agentEvalFixDecision: { findUnique: vi.fn(), findFirst: vi.fn(), create: vi.fn() },
  agentPromptVersion: { findFirst: vi.fn(), findMany: vi.fn() },
  agentEvalRun: { findUnique: vi.fn(), update: vi.fn() },
  user: { findUnique: vi.fn() },
  $executeRaw: vi.fn(async () => 1),
  $transaction: vi.fn(async (fn: any) => fn(prismaMock)),
};

vi.mock('@zappiq/database', () => ({ prisma: prismaMock, Prisma: {} }));

vi.mock('../utils/logger.js', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

vi.mock('../middleware/auth.js', () => ({
  authMiddleware: (_req: any, _res: any, next: any) => next(),
  requireRole: () => (_req: any, _res: any, next: any) => next(),
}));

vi.mock('../services/agentEvalRunner.js', () => ({
  executeAgentEvalRun: vi.fn(),
  computeReverifyVerdict: vi.fn(),
  suggestFix: vi.fn(),
}));

vi.mock('../services/agentEvalCronService.js', () => ({
  notifySlackQualityIssue: vi.fn(),
  shouldAlertQuality: vi.fn(() => false),
}));

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
  return rs[rs.length - 1].handle as (req: any, res: any, next?: any) => Promise<void>;
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

const PROMPT_DA_EPOCA = 'prompt como ficou quando a correção foi aplicada';
const PROMPT_DE_ANTES = 'prompt como estava antes da correção';

function decisaoAplicada() {
  return {
    id: 'dec-1',
    runId: 'run-1',
    scenarioId: 'cr3',
    agentId: 'ag1',
    decision: 'applied',
    originalSuggestion: {},
    promptBefore: PROMPT_DE_ANTES,
    promptAfter: PROMPT_DA_EPOCA,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  prismaMock.$transaction.mockImplementation(async (fn: any) => fn(prismaMock));
  prismaMock.$executeRaw.mockResolvedValue(1);
  prismaMock.user.findUnique.mockResolvedValue({
    id: 'su-1',
    email: 'super@zappiq.com.br',
    name: 'Super',
    role: 'SUPERADMIN',
  });
});

describe('POST /fix-decisions/:decisionId/revert (admin)', () => {
  it('recusa com 409 quando o prompt mudou depois da correção', async () => {
    prismaMock.agentEvalFixDecision.findUnique.mockResolvedValue(decisaoAplicada());
    prismaMock.agent.findUnique.mockResolvedValue({
      id: 'ag1',
      systemPrompt: 'o cliente editou o prompt depois',
    });

    const res = makeRes();
    await getHandler('post', '/fix-decisions/:decisionId/revert')(
      { user: { userId: 'su-1' }, params: { decisionId: 'dec-1' }, body: {} },
      res,
    );

    expect(res.statusCode).toBe(409);
    // A frase legível vai em `error` (é o que o front mostra); o código
    // estável, para o programa decidir, vai em `code`.
    expect(res.body.error).toContain('histórico de versões');
    expect(res.body.code).toBe('prompt_mudou');
    expect(prismaMock.agent.update).not.toHaveBeenCalled();
    expect(prismaMock.agentEvalFixDecision.create).not.toHaveBeenCalled();
  });

  it('reverte e declara a origem fix_revert quando o prompt não mudou', async () => {
    prismaMock.agentEvalFixDecision.findUnique.mockResolvedValue(decisaoAplicada());
    prismaMock.agent.findUnique.mockResolvedValue({ id: 'ag1', systemPrompt: PROMPT_DA_EPOCA });
    prismaMock.agentEvalFixDecision.create.mockResolvedValue({ id: 'dec-2', decision: 'reverted' });
    prismaMock.agentPromptVersion.findFirst.mockResolvedValue({ version: 4, hash: 'h4' });

    const res = makeRes();
    await getHandler('post', '/fix-decisions/:decisionId/revert')(
      { user: { userId: 'su-1' }, params: { decisionId: 'dec-1' }, body: {} },
      res,
    );

    expect(res.statusCode).toBe(200);
    expect(prismaMock.agent.update).toHaveBeenCalledWith({
      where: { id: 'ag1' },
      data: { systemPrompt: PROMPT_DE_ANTES },
    });
    const raws = prismaMock.$executeRaw.mock.calls.map(
      (c: any[]) => `${c[0].join('?')} :: ${c.slice(1).join('|')}`,
    );
    expect(
      raws.some((s: string) => s.includes('zappiq.prompt_source') && s.includes('fix_revert')),
    ).toBe(true);
  });

  it('decisão inexistente responde 404', async () => {
    prismaMock.agentEvalFixDecision.findUnique.mockResolvedValue(null);

    const res = makeRes();
    await getHandler('post', '/fix-decisions/:decisionId/revert')(
      { user: { userId: 'su-1' }, params: { decisionId: 'nao-existe' }, body: {} },
      res,
    );

    expect(res.statusCode).toBe(404);
  });

  it('agente apagado responde 404 em vez de gravar às cegas', async () => {
    prismaMock.agentEvalFixDecision.findUnique.mockResolvedValue(decisaoAplicada());
    prismaMock.agent.findUnique.mockResolvedValue(null);

    const res = makeRes();
    await getHandler('post', '/fix-decisions/:decisionId/revert')(
      { user: { userId: 'su-1' }, params: { decisionId: 'dec-1' }, body: {} },
      res,
    );

    expect(res.statusCode).toBe(404);
    expect(prismaMock.agent.update).not.toHaveBeenCalled();
  });
});
