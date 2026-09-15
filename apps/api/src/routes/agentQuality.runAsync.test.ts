/**
 * agentQuality.runAsync.test.ts (A048, rodada 3)
 * ============================================================================
 * O teste da Qualidade virou job de fila. Entre o clique e a conclusão a linha
 * fica 'pending' enquanto a trava global não libera, o que em dia cheio são
 * dezenas de minutos. A porta do cliente (POST /run-async) só olhava para
 * execução 'completed' nas últimas 24 h: com a fila, cada clique impaciente
 * criava OUTRA execução paga, todas na fila, todas cobradas.
 *
 * A porta passa a ter duas travas, com mensagens diferentes:
 *   ✓ execução VIVA ('pending' ou 'running') do próprio cliente barra na hora,
 *     sem janela de tempo, sem criar linha e sem enfileirar;
 *   ✓ execução 'completed' do próprio cliente barra por 24 h (cooldown);
 *   ✓ execução 'failed' não barra nada;
 *   ✓ execução do superadmin ('manual') não gasta o direito do cliente.
 *
 * Sem supertest: mocamos o I/O, importamos o router e chamamos o handler real
 * (mesma abordagem de adminAgentEval.revert.test.ts).
 * ============================================================================
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

const AGORA = new Date('2026-09-14T12:00:00Z');

/** Linhas de AgentEvalRun que o banco falso conhece nesta execução do teste. */
let bancoDeRuns: any[] = [];

const prismaMock: any = {
  agent: { findFirst: vi.fn() },
  agentEvalRun: { findFirst: vi.fn(), findMany: vi.fn(), create: vi.fn() },
  organization: { findUnique: vi.fn() },
  user: { findUnique: vi.fn() },
};

// C2, nota 1: o interruptor evalNoTier decide se a cota é a da faixa do
// plano. Dublê para o teste não ir ao Redis.
const flagsMock = { isFlagOn: vi.fn(async () => false) };
vi.mock('../services/featureFlags.js', () => flagsMock);

vi.mock('@zappiq/database', () => ({ prisma: prismaMock, Prisma: {} }));

vi.mock('../utils/logger.js', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

vi.mock('../middleware/auth.js', () => ({
  authMiddleware: (_req: any, _res: any, next: any) => next(),
  requireRole: () => (_req: any, _res: any, next: any) => next(),
}));

vi.mock('../agents/agentEvalSet.js', () => ({
  resolveEvalSet: vi.fn(() => []),
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

const filaMock = {
  enqueueEvalRun: vi.fn(async () => undefined),
  resolveScenariosForRun: vi.fn(() => [{ id: 'cr1' }, { id: 'cr2' }]),
};
vi.mock('../services/agentEvalQueue.js', () => filaMock);

vi.mock('../services/agentEvalRunner.js', () => ({
  executeAgentEvalRun: vi.fn(),
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

/**
 * Banco falso de AgentEvalRun: aplica os mesmos filtros que a rota usa
 * (agentId, triggeredBy, status simples ou `in`, startedAt.gte). Sem isso o
 * teste provaria só que a rota chamou o Prisma, não que a consulta acha o que
 * tem de achar.
 */
function achaRun(where: any) {
  const candidatos = bancoDeRuns.filter((r) => {
    if (where.agentId && r.agentId !== where.agentId) return false;
    if (where.triggeredBy && r.triggeredBy !== where.triggeredBy) return false;
    const st = where.status;
    if (typeof st === 'string' && r.status !== st) return false;
    if (st && typeof st === 'object' && Array.isArray(st.in) && !st.in.includes(r.status)) {
      return false;
    }
    if (where.startedAt?.gte && r.startedAt < where.startedAt.gte) return false;
    return true;
  });
  // orderBy startedAt desc: a mais recente primeiro.
  candidatos.sort((a, b) => b.startedAt.getTime() - a.startedAt.getTime());
  return candidatos[0] ?? null;
}

function run(status: string, minutosAtras: number, triggeredBy = 'client_manual') {
  return {
    id: `run-${status}-${minutosAtras}`,
    agentId: 'agent-1',
    status,
    triggeredBy,
    startedAt: new Date(AGORA.getTime() - minutosAtras * 60_000),
  };
}

function req() {
  return { user: { id: 'user-1', organizationId: 'org-1' }, body: { agentId: 'agent-1' } };
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.setSystemTime(AGORA);
  bancoDeRuns = [];
  prismaMock.agent.findFirst.mockResolvedValue({
    id: 'agent-1',
    name: 'Vera',
    systemPrompt: 'prompt',
    organizationId: 'org-1',
  });
  prismaMock.agentEvalRun.findFirst.mockImplementation(async ({ where }: any) => achaRun(where));
  prismaMock.agentEvalRun.findMany.mockImplementation(async ({ where }: any) => {
    const lista: any[] = [];
    const salvo = bancoDeRuns;
    for (const r of salvo) {
      bancoDeRuns = [r];
      if (achaRun(where)) lista.push(r);
    }
    bancoDeRuns = salvo;
    return lista.sort((a, b) => a.startedAt.getTime() - b.startedAt.getTime());
  });
  prismaMock.agentEvalRun.create.mockResolvedValue({ id: 'run-novo', startedAt: AGORA });
  flagsMock.isFlagOn.mockResolvedValue(false);
  prismaMock.organization.findUnique.mockResolvedValue({
    plan: 'SCALE',
    trialStartedAt: null,
    trialEndsAt: null,
    isTrialActive: false,
    trialConverted: true,
    stripeSubscriptionId: 'sub_1',
  });
});

describe('POST /run-async: execução viva barra o segundo clique', () => {
  it("execução 'pending' do cliente devolve 429 e não cria nem enfileira", async () => {
    // Clique de 5 minutos atrás: a linha está na fila, esperando a trava.
    bancoDeRuns.push(run('pending', 5));
    const res = makeRes();

    await getHandler('post', '/run-async')(req(), res);

    expect(res.statusCode).toBe(429);
    expect(res.body.message).toBe(
      'Já existe um teste em andamento para este agente. Aguarde ele terminar.',
    );
    expect(prismaMock.agentEvalRun.create).not.toHaveBeenCalled();
    expect(filaMock.enqueueEvalRun).not.toHaveBeenCalled();
  });

  it("execução 'running' do cliente também barra, sem janela de tempo", async () => {
    // Bem mais velha que o cooldown de 24 h: o que barra é estar viva.
    bancoDeRuns.push(run('running', 40 * 60));
    const res = makeRes();

    await getHandler('post', '/run-async')(req(), res);

    expect(res.statusCode).toBe(429);
    expect(res.body.message).toContain('em andamento');
    expect(prismaMock.agentEvalRun.create).not.toHaveBeenCalled();
  });

  it('a mensagem da execução viva é diferente da mensagem do cooldown', async () => {
    bancoDeRuns.push(run('pending', 5));
    const viva = makeRes();
    await getHandler('post', '/run-async')(req(), viva);

    bancoDeRuns = [run('completed', 120)];
    const cooldown = makeRes();
    await getHandler('post', '/run-async')(req(), cooldown);

    expect(viva.body.message).not.toBe(cooldown.body.message);
    expect(cooldown.body.message).toContain('24h');
  });
});

describe('POST /run-async: cooldown de 24 h vale só para execução concluída', () => {
  it("'completed' de 2 h atrás devolve 429 de cooldown com o próximo horário", async () => {
    bancoDeRuns.push(run('completed', 120));
    const res = makeRes();

    await getHandler('post', '/run-async')(req(), res);

    expect(res.statusCode).toBe(429);
    expect(res.body.error).toBe('cooldown');
    expect(res.body.message).toContain('Você já executou um teste');
    expect(res.body.nextAvailableAt).toBe(new Date(AGORA.getTime() + 22 * 3600 * 1000).toISOString());
    expect(prismaMock.agentEvalRun.create).not.toHaveBeenCalled();
  });

  it("'completed' de 30 h atrás já liberou", async () => {
    bancoDeRuns.push(run('completed', 30 * 60));
    const res = makeRes();

    await getHandler('post', '/run-async')(req(), res);

    expect(res.statusCode).toBe(202);
    expect(filaMock.enqueueEvalRun).toHaveBeenCalledWith('run-novo');
  });

  it("'failed' não barra: o cliente pode tentar de novo na hora", async () => {
    bancoDeRuns.push(run('failed', 1));
    const res = makeRes();

    await getHandler('post', '/run-async')(req(), res);

    expect(res.statusCode).toBe(202);
    expect(prismaMock.agentEvalRun.create).toHaveBeenCalledTimes(1);
    expect(filaMock.enqueueEvalRun).toHaveBeenCalledWith('run-novo');
  });

  it("execução do superadmin ('manual') não gasta o direito do cliente", async () => {
    bancoDeRuns.push(run('pending', 5, 'manual'));
    bancoDeRuns.push(run('completed', 30, 'manual'));
    const res = makeRes();

    await getHandler('post', '/run-async')(req(), res);

    expect(res.statusCode).toBe(202);
    expect(prismaMock.agentEvalRun.create).toHaveBeenCalledTimes(1);
  });

  it('agente de outra organização devolve 404, não 403', async () => {
    prismaMock.agent.findFirst.mockResolvedValue(null);
    const res = makeRes();

    await getHandler('post', '/run-async')(req(), res);

    expect(res.statusCode).toBe(404);
    expect(prismaMock.agentEvalRun.create).not.toHaveBeenCalled();
  });
});

/* ══════════════════════════════════════════════════════════════════════
 * C2, nota 1 da revisão de 14/09: com `evalNoTier` ligado, a cota de
 * testes manuais é a da faixa do plano. Desligado, a regra de hoje.
 * ══════════════════════════════════════════════════════════════════════ */
describe('POST /run-async: cota da faixa do plano (evalNoTier)', () => {
  it('desligado: a regra de hoje, 1 por 24 h, e o plano nem é lido', async () => {
    bancoDeRuns = [run('completed', 120)];
    const res = makeRes();
    await getHandler('post', '/run-async')(req(), res);
    expect(res.statusCode).toBe(429);
    expect(prismaMock.organization.findUnique).not.toHaveBeenCalled();
  });

  it('ligado, plano SCALE (2 por 24 h): o segundo teste do dia passa', async () => {
    flagsMock.isFlagOn.mockImplementation(async (_o: string, f: string) => f === 'evalNoTier');
    bancoDeRuns = [run('completed', 120)];
    const res = makeRes();
    await getHandler('post', '/run-async')(req(), res);
    expect(res.statusCode).toBe(202);
    expect(prismaMock.agentEvalRun.create).toHaveBeenCalledTimes(1);
  });

  it('ligado, plano SCALE: o terceiro teste do dia é barrado, com o horário em Brasília', async () => {
    flagsMock.isFlagOn.mockImplementation(async (_o: string, f: string) => f === 'evalNoTier');
    bancoDeRuns = [run('completed', 120), run('completed', 600)];
    const res = makeRes();
    await getHandler('post', '/run-async')(req(), res);
    expect(res.statusCode).toBe(429);
    expect(res.body.error).toBe('cooldown');
    expect(res.body.reason).toBe('cota_da_faixa');
    expect(res.body.message).toMatch(/2 testes/);
    expect(res.body.message).toMatch(/Próximo disponível em/);
    expect(prismaMock.agentEvalRun.create).not.toHaveBeenCalled();
  });

  it('ligado, organização em trial: a faixa de entrada (1 por 24 h), qualquer que seja o plano', async () => {
    flagsMock.isFlagOn.mockImplementation(async (_o: string, f: string) => f === 'evalNoTier');
    prismaMock.organization.findUnique.mockResolvedValue({
      plan: 'SCALE',
      trialStartedAt: new Date('2026-09-10T00:00:00Z'),
      trialEndsAt: new Date('2026-09-24T00:00:00Z'),
      isTrialActive: true,
      trialConverted: false,
      stripeSubscriptionId: null,
    });
    bancoDeRuns = [run('completed', 120)];
    const res = makeRes();
    await getHandler('post', '/run-async')(req(), res);
    expect(res.statusCode).toBe(429);
  });
});
