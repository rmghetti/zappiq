/**
 * agentQuality.versoes.test.ts
 * ============================================================================
 * Achado A083: reverter uma correção restaurava o prompt de antes SEM olhar o
 * que existia no agente naquele momento. Tudo o que veio depois (outra
 * correção, a troca de nome, a edição do cliente) era apagado em silêncio.
 * Caso real: o prompt da Vera tem 6.506 chars e o promptBefore de uma decisão
 * de 16/07 tem 3.978 — reverter apagaria a seção do curso.
 *
 * Agora: o revert compara o prompt atual com o promptAfter da decisão. Se
 * divergiu, responde 409 e manda o cliente usar o histórico de versões.
 *
 * Sem supertest (mesma abordagem de conversations.tenant.test.ts): mocamos as
 * dependências de I/O, importamos o router e chamamos o handler real.
 * ============================================================================
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

const prismaMock: any = {
  agent: { findFirst: vi.fn(), findUnique: vi.fn(), update: vi.fn() },
  agentEvalFixDecision: { findFirst: vi.fn(), create: vi.fn() },
  agentPromptVersion: { findMany: vi.fn(), findFirst: vi.fn() },
  agentEvalRun: { findFirst: vi.fn(), update: vi.fn() },
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
  suggestFix: vi.fn(),
}));

vi.mock('../services/agentEvalCronService.js', () => ({
  notifySlackQualityIssue: vi.fn(),
  shouldAlertQuality: vi.fn(() => false),
}));

const { hashPrompt } = await import('../services/promptVersionService.js');
const { default: router } = await import('./agentQuality.js');

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

const REQ_BASE = { user: { organizationId: 'org-cmj', userId: 'u-1' } };

beforeEach(() => {
  vi.clearAllMocks();
  prismaMock.$transaction.mockImplementation(async (fn: any) => fn(prismaMock));
  prismaMock.$executeRaw.mockResolvedValue(1);
  prismaMock.user.findUnique.mockResolvedValue({
    id: 'u-1',
    email: 'gestor@cmj.com.br',
    name: 'Gestor',
    role: 'ADMIN',
  });
});

// ════════════════════════════════════════════════════════════════════
describe('GET /agents/:agentId/versions', () => {
  it('lista as versões da organização sem devolver o texto do prompt', async () => {
    prismaMock.agent.findFirst.mockResolvedValue({
      id: 'ag1',
      name: 'Vera',
      systemPrompt: 'prompt atual',
      organizationId: 'org-cmj',
    });
    prismaMock.agentPromptVersion.findMany.mockResolvedValue([
      {
        version: 2,
        source: 'fix_apply',
        hash: 'h2',
        createdBy: 'gestor@cmj.com.br',
        createdAt: new Date('2026-09-14T10:00:00Z'),
        systemPrompt: 'texto com 21 chars..',
      },
      {
        version: 1,
        source: 'migracao',
        hash: 'h1',
        createdBy: null,
        createdAt: new Date('2026-09-13T10:00:00Z'),
        systemPrompt: 'curto',
      },
    ]);

    const res = makeRes();
    await getHandler('get', '/agents/:agentId/versions')(
      { ...REQ_BASE, params: { agentId: 'ag1' } },
      res,
    );

    expect(res.statusCode).toBe(200);
    expect(res.body.versions).toHaveLength(2);
    expect(res.body.versions[0]).toEqual({
      version: 2,
      source: 'fix_apply',
      hash: 'h2',
      created_by: 'gestor@cmj.com.br',
      created_at: '2026-09-14T10:00:00.000Z',
      chars: 20,
    });
    // O texto não sai na listagem.
    expect(JSON.stringify(res.body)).not.toContain('texto com 21 chars');
  });

  it('agente de outra organização responde 404 (não 403)', async () => {
    prismaMock.agent.findFirst.mockResolvedValue(null);

    const res = makeRes();
    await getHandler('get', '/agents/:agentId/versions')(
      { ...REQ_BASE, params: { agentId: 'ag-de-outra-org' } },
      res,
    );

    expect(res.statusCode).toBe(404);
    expect(prismaMock.agentPromptVersion.findMany).not.toHaveBeenCalled();
  });
});

describe('GET /agents/:agentId/versions/:version', () => {
  it('devolve o texto daquela versão', async () => {
    prismaMock.agent.findFirst.mockResolvedValue({
      id: 'ag1',
      name: 'Vera',
      systemPrompt: 'prompt atual',
      organizationId: 'org-cmj',
    });
    prismaMock.agentPromptVersion.findFirst.mockResolvedValue({
      version: 1,
      source: 'migracao',
      hash: 'h1',
      createdBy: null,
      createdAt: new Date('2026-09-13T10:00:00Z'),
      systemPrompt: 'o texto inteiro da versão 1',
    });

    const res = makeRes();
    await getHandler('get', '/agents/:agentId/versions/:version')(
      { ...REQ_BASE, params: { agentId: 'ag1', version: '1' } },
      res,
    );

    expect(res.statusCode).toBe(200);
    expect(res.body.version.systemPrompt).toBe('o texto inteiro da versão 1');
    expect(res.body.version.version).toBe(1);
  });

  it('versão inexistente responde 404', async () => {
    prismaMock.agent.findFirst.mockResolvedValue({
      id: 'ag1',
      name: 'Vera',
      systemPrompt: 'x',
      organizationId: 'org-cmj',
    });
    prismaMock.agentPromptVersion.findFirst.mockResolvedValue(null);

    const res = makeRes();
    await getHandler('get', '/agents/:agentId/versions/:version')(
      { ...REQ_BASE, params: { agentId: 'ag1', version: '99' } },
      res,
    );

    expect(res.statusCode).toBe(404);
  });

  it('versão não numérica responde 400', async () => {
    const res = makeRes();
    await getHandler('get', '/agents/:agentId/versions/:version')(
      { ...REQ_BASE, params: { agentId: 'ag1', version: 'ontem' } },
      res,
    );

    expect(res.statusCode).toBe(400);
  });
});

// ════════════════════════════════════════════════════════════════════
describe('POST /fix-decisions/:decisionId/revert', () => {
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

  it('recusa com 409 quando o prompt mudou depois da correção', async () => {
    prismaMock.agentEvalFixDecision.findFirst.mockResolvedValue(decisaoAplicada());
    prismaMock.agent.findFirst.mockResolvedValue({
      id: 'ag1',
      name: 'Vera',
      organizationId: 'org-cmj',
      systemPrompt: 'o cliente editou o prompt depois, com a seção do curso',
    });

    const res = makeRes();
    await getHandler('post', '/fix-decisions/:decisionId/revert')(
      { ...REQ_BASE, params: { decisionId: 'dec-1' }, body: {} },
      res,
    );

    expect(res.statusCode).toBe(409);
    expect(res.body.error).toBe('prompt_mudou');
    expect(res.body.message).toContain('histórico de versões');
    // Nada foi gravado.
    expect(prismaMock.agent.update).not.toHaveBeenCalled();
    expect(prismaMock.agentEvalFixDecision.create).not.toHaveBeenCalled();
  });

  it('reverte quando o prompt atual ainda é o promptAfter da decisão', async () => {
    prismaMock.agentEvalFixDecision.findFirst.mockResolvedValue(decisaoAplicada());
    prismaMock.agent.findFirst.mockResolvedValue({
      id: 'ag1',
      name: 'Vera',
      organizationId: 'org-cmj',
      systemPrompt: PROMPT_DA_EPOCA,
    });
    prismaMock.agent.findUnique.mockResolvedValue({ systemPrompt: PROMPT_DA_EPOCA });
    prismaMock.agentEvalFixDecision.create.mockResolvedValue({ id: 'dec-2', decision: 'reverted' });
    prismaMock.agentPromptVersion.findFirst.mockResolvedValue({ version: 3, hash: 'h3' });

    const res = makeRes();
    await getHandler('post', '/fix-decisions/:decisionId/revert')(
      { ...REQ_BASE, params: { decisionId: 'dec-1' }, body: {} },
      res,
    );

    expect(res.statusCode).toBe(200);
    expect(res.body.ok).toBe(true);

    // Escreveu o prompt de antes, declarando a origem fix_revert.
    expect(prismaMock.agent.update).toHaveBeenCalledWith({
      where: { id: 'ag1' },
      data: { systemPrompt: PROMPT_DE_ANTES },
    });
    const raws = prismaMock.$executeRaw.mock.calls.map(
      (c: any[]) => `${c[0].join('?')} :: ${c.slice(1).join('|')}`,
    );
    expect(raws.some((s: string) => s.includes('zappiq.prompt_source') && s.includes('fix_revert'))).toBe(
      true,
    );
  });

  it('decisão de outra organização responde 404', async () => {
    prismaMock.agentEvalFixDecision.findFirst.mockResolvedValue(null);

    const res = makeRes();
    await getHandler('post', '/fix-decisions/:decisionId/revert')(
      { ...REQ_BASE, params: { decisionId: 'dec-de-outra-org' }, body: {} },
      res,
    );

    expect(res.statusCode).toBe(404);
  });

  it('o hash comparado é o md5 do texto (mesma conta do Postgres)', () => {
    expect(hashPrompt(PROMPT_DA_EPOCA)).not.toBe(hashPrompt(PROMPT_DE_ANTES));
    expect(hashPrompt(PROMPT_DA_EPOCA)).toHaveLength(32);
  });
});
