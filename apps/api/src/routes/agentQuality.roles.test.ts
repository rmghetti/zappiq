/**
 * agentQuality.roles.test.ts (A115, A204 em parte)
 * ============================================================================
 * A porta do cliente da Qualidade do Agente estava aberta para qualquer usuário
 * autenticado. Um atendente com perfil AGENT aplicava e revertia correção no
 * prompt do agente da empresa, e o re-teste não tinha nenhum teto: cada clique
 * gastava um chat mais um juiz em Sonnet.
 *
 * O que este teste prova, chamando a cadeia real da rota (middlewares na ordem
 * em que o Express roda, com o requireRole de verdade):
 *   1. AGENT recebe 403 em apply-fix, e o handler nem roda.
 *   2. ADMIN passa pelo portão de papel.
 *   3. A 21ª chamada de re-test da mesma organização no mesmo dia recebe 429,
 *      em português, e não chega no handler.
 *   4. Sem Redis (contador devolve null) a cota não barra ninguém e o servidor
 *      registra o aviso, em vez de derrubar o cliente por causa do cache.
 * ============================================================================
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

const prismaMock: any = {
  agent: { findFirst: vi.fn() },
  agentEvalRun: { findFirst: vi.fn(async () => null), create: vi.fn(), update: vi.fn() },
  agentEvalFixDecision: { findFirst: vi.fn(async () => null) },
  user: { findUnique: vi.fn(async () => null) },
};
vi.mock('@zappiq/database', () => ({ prisma: prismaMock, Prisma: {} }));

const avisos: any[] = [];
vi.mock('../utils/logger.js', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn((...args: any[]) => avisos.push(args)),
    error: vi.fn(),
    debug: vi.fn(),
  },
}));

// authMiddleware não pode exigir token aqui (o teste injeta req.user direto),
// mas o requireRole é o DE VERDADE: é ele que está sendo provado.
vi.mock('../middleware/auth.js', async () => {
  const real = await vi.importActual<typeof import('../middleware/auth.js')>(
    '../middleware/auth.js',
  );
  return { ...real, authMiddleware: (_req: any, _res: any, next: any) => next() };
});

/** Redis falso: Map com semântica de INCRBY. `redisNoAr = false` simula queda. */
const contadores = new Map<string, number>();
let redisNoAr = true;
vi.mock('../services/cloud/index.js', () => ({
  cache: {
    incrby: vi.fn(async (chave: string, quanto = 1) => {
      if (!redisNoAr) return null;
      const proximo = (contadores.get(chave) ?? 0) + quanto;
      contadores.set(chave, proximo);
      return proximo;
    }),
    expire: vi.fn(async () => true),
  },
}));

vi.mock('../agents/agentEvalSet.js', () => ({
  resolveEvalSet: vi.fn(() => [{ id: 'cr1', expectedBehavior: 'x' }]),
  getSkippedScenarios: vi.fn(() => []),
  EVAL_SET_VERSION: 'v2',
}));

vi.mock('../agents/tenantAgentProfile.js', () => ({
  resolveTenantAgentProfile: vi.fn(async () => ({
    organizationId: 'org-1',
    isZappIQ: false,
    agentName: 'Vera',
    businessName: 'CMJ',
  })),
}));

vi.mock('../services/agentEvalQueue.js', () => ({
  enqueueEvalRun: vi.fn(async () => undefined),
  resolveScenariosForRun: vi.fn(() => [{ id: 'cr1' }]),
}));

const executarEval = vi.fn(async () => ({ results: [{ combined: 'pass' }] }));
vi.mock('../services/agentEvalRunner.js', () => ({
  executeAgentEvalRun: (...args: any[]) => (executarEval as any)(...args),
  suggestFix: vi.fn(),
}));

vi.mock('../services/agentPromptPatcher.js', () => ({
  applyPatch: vi.fn(),
  DuplicatePatchError: class DuplicatePatchError extends Error {},
}));

vi.mock('../services/promptVersionService.js', () => ({
  publishPrompt: vi.fn(),
  hashPrompt: vi.fn(() => 'hash'),
  PromptChangedError: class PromptChangedError extends Error {},
}));

const { default: router } = await import('./agentQuality.js');

type RouteLayer = {
  route?: { path: string; methods: Record<string, boolean>; stack: Array<{ handle: any }> };
};

function camadasDaRota(metodo: string, caminho: string) {
  const stack = (router as unknown as { stack: RouteLayer[] }).stack;
  const camada = stack.find(
    (l) => l.route?.path === caminho && !!l.route?.methods?.[metodo.toLowerCase()],
  );
  if (!camada || !camada.route) throw new Error(`rota ${metodo} ${caminho} não encontrada`);
  return camada.route.stack.map((s) => s.handle as (req: any, res: any, next: any) => any);
}

function fazRes() {
  const res: any = { statusCode: 200, body: undefined, respondeu: false };
  res.status = vi.fn((c: number) => {
    res.statusCode = c;
    return res;
  });
  res.json = vi.fn((b: any) => {
    res.body = b;
    res.respondeu = true;
    return res;
  });
  return res;
}

/**
 * Roda a cadeia da rota na ordem do Express: cada middleware só chama o
 * seguinte se der next(). É isso que faz o teste provar o PORTÃO, e não só o
 * handler.
 */
async function rodaRota(metodo: string, caminho: string, req: any) {
  const cadeia = camadasDaRota(metodo, caminho);
  const res = fazRes();
  let alcancouOHandler = false;
  for (let i = 0; i < cadeia.length; i++) {
    let seguiu = false;
    const next = () => {
      seguiu = true;
    };
    if (i === cadeia.length - 1) alcancouOHandler = true;
    await cadeia[i](req, res, next);
    if (!seguiu) break;
  }
  return { res, alcancouOHandler };
}

function pedido(role: string, extras: Record<string, any> = {}) {
  return {
    user: { userId: 'user-1', email: 'a@b.com', role, organizationId: 'org-1' },
    organizationId: 'org-1',
    params: { runId: 'run-1', scenarioId: 'cr1', decisionId: 'dec-1' },
    body: {},
    ...extras,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  contadores.clear();
  avisos.length = 0;
  redisNoAr = true;
  prismaMock.agentEvalRun.findFirst.mockResolvedValue(null);
});

const APPLY_FIX = '/runs/:runId/scenarios/:scenarioId/apply-fix';
const RE_TEST = '/runs/:runId/scenarios/:scenarioId/re-test';
const GERAR = '/runs/:runId/scenarios/:scenarioId/generate-suggestion';

describe('portão de papel na Qualidade do Agente (A115)', () => {
  it('AGENT recebe 403 em apply-fix e o handler nem roda', async () => {
    const { res, alcancouOHandler } = await rodaRota('post', APPLY_FIX, pedido('AGENT'));
    expect(res.statusCode).toBe(403);
    expect(alcancouOHandler).toBe(false);
  });

  it('AUDITOR também recebe 403 em apply-fix, reject-fix, re-test e revert', async () => {
    for (const rota of [
      APPLY_FIX,
      '/runs/:runId/scenarios/:scenarioId/reject-fix',
      RE_TEST,
      GERAR,
      '/fix-decisions/:decisionId/revert',
      '/run-async',
    ]) {
      const { res } = await rodaRota('post', rota, pedido('AUDITOR'));
      expect(res.statusCode, `${rota} deveria recusar AUDITOR`).toBe(403);
    }
  });

  it('ADMIN passa pelo portão de papel', async () => {
    const { res, alcancouOHandler } = await rodaRota('post', APPLY_FIX, pedido('ADMIN'));
    expect(res.statusCode).not.toBe(403);
    expect(alcancouOHandler).toBe(true);
  });
});

describe('cota diária de 20 por organização (A115)', () => {
  it('a 21ª chamada de re-test no mesmo dia recebe 429 em português', async () => {
    for (let i = 1; i <= 20; i++) {
      const { res } = await rodaRota('post', RE_TEST, pedido('ADMIN'));
      expect(res.statusCode, `chamada ${i} não deveria ser barrada`).not.toBe(429);
    }
    const { res, alcancouOHandler } = await rodaRota('post', RE_TEST, pedido('ADMIN'));
    expect(res.statusCode).toBe(429);
    expect(alcancouOHandler).toBe(false);
    expect(String(res.body?.error || '')).toMatch(/hoje|limite|amanhã/i);
  });

  it('a cota é por organização e por rota, na chave do dia', async () => {
    for (let i = 1; i <= 21; i++) await rodaRota('post', RE_TEST, pedido('ADMIN'));
    const dia = new Date().toISOString().slice(0, 10);
    expect([...contadores.keys()]).toContain(`zappiq:quota:org-1:re-test:${dia}`);
    // Outra organização começa do zero.
    const outra = pedido('ADMIN');
    outra.user.organizationId = 'org-2';
    outra.organizationId = 'org-2';
    const { res } = await rodaRota('post', RE_TEST, outra);
    expect(res.statusCode).not.toBe(429);
    // generate-suggestion tem contador próprio.
    const { res: res2 } = await rodaRota('post', GERAR, pedido('ADMIN'));
    expect(res2.statusCode).not.toBe(429);
  });

  it('sem Redis a cota não barra ninguém, e o servidor avisa', async () => {
    redisNoAr = false;
    for (let i = 1; i <= 25; i++) {
      const { res } = await rodaRota('post', RE_TEST, pedido('ADMIN'));
      expect(res.statusCode).not.toBe(429);
    }
    expect(avisos.some((a) => JSON.stringify(a).includes('cota'))).toBe(true);
  });
});
