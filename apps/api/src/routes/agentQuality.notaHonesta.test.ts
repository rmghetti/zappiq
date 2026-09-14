/**
 * agentQuality.notaHonesta.test.ts (B1, Passo 6)
 * ============================================================================
 * Três defeitos da porta do cliente, provados aqui sem banco e sem LLM:
 *
 *   A055  GET /runs/:id abria execução 'invalidated'. As 26 execuções sob o
 *         gabarito contaminado (v1.1, média 47) somem da listagem mas ainda
 *         abrem por id: o cliente vê uma nota que nunca foi sobre o negócio
 *         dele.
 *   A151  "Próximo disponível em" era formatado sem fuso e o Fly roda em UTC:
 *         o horário saía 3 h adiantado para o cliente.
 *   A188  A sugestão do avaliador sai cortada no meio (170 de 324 com
 *         exatamente 600 caracteres) e era gravada assim no prompt vivo. Cinco
 *         fragmentos truncados estão hoje nos prompts da Iza e da Marcia.
 *
 * Sem supertest: mocamos o I/O, importamos o router e chamamos o handler real.
 * ============================================================================
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

const AGORA = new Date('2026-09-14T12:00:00Z');

const prismaMock: any = {
  agent: { findFirst: vi.fn() },
  agentEvalRun: { findFirst: vi.fn(), create: vi.fn(), findMany: vi.fn() },
  agentEvalFixDecision: { findFirst: vi.fn(), create: vi.fn() },
  evalRegrade: { findMany: vi.fn() },
  user: { findUnique: vi.fn() },
  $transaction: vi.fn(async (fn: any) => fn(prismaMock)),
  $queryRaw: vi.fn(async () => []),
};

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
  HARNESS_VERSION: 3,
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
vi.mock('../services/agentEvalRunner.js', () => ({
  executeAgentEvalRun: vi.fn(),
  suggestFix: vi.fn(),
}));
vi.mock('../services/agentPromptPatcher.js', () => ({
  applyPatch: vi.fn(() => ({
    promptBefore: 'antes',
    promptAfter: 'depois',
    strategy: 'append',
    insertedAtLine: 1,
  })),
  DuplicatePatchError: class DuplicatePatchError extends Error {},
  // A188: a régua real, não um espelho. Copiar a lógica aqui provaria só que
  // a rota chama alguma coisa.
  regraTerminaEmFraseCompleta: (t: string) =>
    /[.!?…]$/u.test(String(t ?? '').trim().replace(/[”"'’»)\]*`]+$/u, '').trimEnd()),
}));
const ruidoMock = {
  carregarRuidoDoAgente: vi.fn(async () => ({ desvio: 8, n: 8 })),
  classificarMudanca: vi.fn(() => ({
    estado: 'estavel',
    explicacao: 'A IA está estável: a diferença está dentro da variação normal deste agente.',
  })),
};
vi.mock('../services/evalRuidoService.js', () => ruidoMock);

const regradeMock = { resumirRegravacao: vi.fn(async () => null) };
vi.mock('../services/evalRegradeService.js', () => regradeMock);

vi.mock('../services/promptVersionService.js', () => ({
  publishPrompt: vi.fn(),
  hashPrompt: vi.fn(() => 'hash'),
  PromptChangedError: class PromptChangedError extends Error {},
}));

const { default: router, formatarHorarioDeBrasilia } = await import('./agentQuality.js');

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

beforeEach(() => {
  vi.clearAllMocks();
  vi.setSystemTime(AGORA);
  prismaMock.evalRegrade.findMany.mockResolvedValue([]);
  ruidoMock.carregarRuidoDoAgente.mockResolvedValue({ desvio: 8, n: 8 });
  ruidoMock.classificarMudanca.mockReturnValue({
    estado: 'estavel',
    explicacao: 'A IA está estável: a diferença está dentro da variação normal deste agente.',
  });
  regradeMock.resumirRegravacao.mockResolvedValue(null);
  prismaMock.agentEvalRun.findMany.mockResolvedValue([]);
  prismaMock.agent.findFirst.mockResolvedValue({
    id: 'agent-1',
    name: 'Vera',
    systemPrompt: 'prompt',
    organizationId: 'org-1',
  });
});

// ════════════════════════════════════════════════════════════════════
describe('A055 — execução invalidada não abre nem por id', () => {
  it('o filtro de status vai junto na consulta por id', async () => {
    prismaMock.agentEvalRun.findFirst.mockResolvedValue(null);
    const res = makeRes();

    await getHandler('get', '/runs/:id')(
      { user: { organizationId: 'org-1' }, params: { id: 'run-v1' }, query: {} },
      res,
    );

    const where = prismaMock.agentEvalRun.findFirst.mock.calls[0][0].where;
    expect(where.status).toEqual({ not: 'invalidated' });
    expect(res.statusCode).toBe(404);
  });

  it('execução legítima continua abrindo', async () => {
    prismaMock.agentEvalRun.findFirst.mockResolvedValue({
      id: 'run-ok',
      agentId: 'agent-1',
      status: 'completed',
      results: [],
      scorePercent: 88,
      startedAt: AGORA,
      agent: { id: 'agent-1', name: 'Vera', organizationId: 'org-1' },
      fixDecisions: [],
    });
    const res = makeRes();

    await getHandler('get', '/runs/:id')(
      { user: { organizationId: 'org-1' }, params: { id: 'run-ok' }, query: {} },
      res,
    );

    expect(res.statusCode).toBe(200);
    expect(res.body.id).toBe('run-ok');
  });
});

// ════════════════════════════════════════════════════════════════════
describe('A151 — o horário do cooldown é o de Brasília', () => {
  it('formata em America/Sao_Paulo, e não no fuso da máquina', () => {
    // Fixo de propósito: o CI roda em UTC e a máquina do desenvolvedor não.
    // Sem o timeZone explícito, esta mesma data sairia "09:00" no Fly.
    expect(formatarHorarioDeBrasilia(new Date('2026-09-15T09:00:00Z'))).toBe(
      '15/09/2026, 06:00:00',
    );
    expect(formatarHorarioDeBrasilia(new Date('2026-01-01T02:30:00Z'))).toBe(
      '31/12/2025, 23:30:00',
    );
  });

  it('mostra 09:00 quando o servidor (UTC) marca 12:00', async () => {
    prismaMock.agentEvalRun.findFirst.mockImplementation(async ({ where }: any) => {
      if (where.status === 'completed') {
        // Concluída às 09:00 UTC de hoje: o próximo é 09:00 UTC de amanhã,
        // que em Brasília (UTC-3) é 06:00 de 15/09.
        return { id: 'r1', startedAt: new Date('2026-09-14T09:00:00Z'), status: 'completed' };
      }
      return null;
    });
    const res = makeRes();

    await getHandler('post', '/run-async')(
      { user: { organizationId: 'org-1' }, body: { agentId: 'agent-1' } },
      res,
    );

    expect(res.statusCode).toBe(429);
    expect(res.body.reason).toBe('aguardando_24h');
    // 06:00 de 15/09 em Brasília. O texto antigo dizia 09:00, 3 h adiantado.
    expect(res.body.message).toContain('15/09/2026');
    expect(res.body.message).toContain('06:00');
    expect(res.body.message).not.toContain('09:00');
  });

  it('as duas travas do #352 continuam de pé', async () => {
    prismaMock.agentEvalRun.findFirst.mockImplementation(async ({ where }: any) => {
      if (where.status?.in) return { id: 'viva', status: 'running' };
      return null;
    });
    const res = makeRes();

    await getHandler('post', '/run-async')(
      { user: { organizationId: 'org-1' }, body: { agentId: 'agent-1' } },
      res,
    );

    expect(res.statusCode).toBe(429);
    expect(res.body.reason).toBe('execucao_em_andamento');
    expect(prismaMock.agentEvalRun.create).not.toHaveBeenCalled();
  });
});

// ════════════════════════════════════════════════════════════════════
describe('A188 — regra cortada no meio não é gravada no prompt', () => {
  const REGRA_CORTADA =
    '+ **REGRA INVIOLÁVEL #14 — PRAZO:** nunca prometa prazo que não está cadastrado. ' +
    'Exemplo CORRETO: "vou confirmar com o time". Exemplo INCORRETO: "respondo em milissegund';

  const REGRA_INTEIRA =
    '+ **REGRA INVIOLÁVEL #14 — PRAZO:** nunca prometa prazo que não está cadastrado. ' +
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
      agent: { id: 'agent-1', name: 'Vera', systemPrompt: 'prompt', organizationId: 'org-1' },
    };
  }

  it('recusa com 422 quando a regra termina no meio de palavra', async () => {
    prismaMock.agentEvalRun.findFirst.mockResolvedValue(runComSugestao(REGRA_CORTADA));
    prismaMock.agentEvalFixDecision.findFirst.mockResolvedValue(null);
    const res = makeRes();

    await getHandler('post', '/runs/:runId/scenarios/:scenarioId/apply-fix')(
      {
        user: { organizationId: 'org-1', userId: 'u1' },
        params: { runId: 'run-1', scenarioId: 'cr7_no_invent_sla' },
        body: {},
      },
      res,
    );

    expect(res.statusCode).toBe(422);
    expect(res.body.error).toBe('regra_incompleta');
    expect(res.body.message).toMatch(/cortad/i);
    expect(prismaMock.agentEvalFixDecision.create).not.toHaveBeenCalled();
  });

  it('recusa também o texto editado pelo cliente que veio cortado', async () => {
    prismaMock.agentEvalRun.findFirst.mockResolvedValue(runComSugestao(REGRA_INTEIRA));
    prismaMock.agentEvalFixDecision.findFirst.mockResolvedValue(null);
    const res = makeRes();

    await getHandler('post', '/runs/:runId/scenarios/:scenarioId/apply-fix')(
      {
        user: { organizationId: 'org-1', userId: 'u1' },
        params: { runId: 'run-1', scenarioId: 'cr7_no_invent_sla' },
        body: { finalDiff: 'texto que para no meio de uma palav' },
      },
      res,
    );

    expect(res.statusCode).toBe(422);
    expect(res.body.error).toBe('regra_incompleta');
  });

  it('aceita a regra inteira', async () => {
    prismaMock.agentEvalRun.findFirst.mockResolvedValue(runComSugestao(REGRA_INTEIRA));
    prismaMock.agentEvalFixDecision.findFirst.mockResolvedValue(null);
    prismaMock.user.findUnique.mockResolvedValue({
      id: 'u1',
      email: 'rod@zappiq.com.br',
      name: 'Rod',
      role: 'ADMIN',
    });
    prismaMock.agentEvalFixDecision.create.mockResolvedValue({ id: 'dec-1' });
    const res = makeRes();

    await getHandler('post', '/runs/:runId/scenarios/:scenarioId/apply-fix')(
      {
        user: { organizationId: 'org-1', userId: 'u1' },
        params: { runId: 'run-1', scenarioId: 'cr7_no_invent_sla' },
        body: {},
      },
      res,
    );

    expect(res.statusCode).toBe(200);
    expect(res.body.ok).toBe(true);
    expect(prismaMock.agentEvalFixDecision.create).toHaveBeenCalled();
  });
});

// ════════════════════════════════════════════════════════════════════
describe('P56 — piso de ruído por agente em GET /runs', () => {
  it('devolve o piso do agente junto da lista', async () => {
    prismaMock.agentEvalRun.findMany.mockResolvedValue([
      { id: 'r1', agentId: 'agent-1', scorePercent: 80, status: 'completed' },
    ]);
    const res = makeRes();

    await getHandler('get', '/runs')(
      { user: { organizationId: 'org-1' }, query: { agentId: 'agent-1' } },
      res,
    );

    expect(res.body.ruido).toEqual({ desvio: 8, n: 8 });
    expect(ruidoMock.carregarRuidoDoAgente).toHaveBeenCalledWith('agent-1');
  });

  it('sem agente escolhido, não inventa piso', async () => {
    prismaMock.agentEvalRun.findMany.mockResolvedValue([]);
    const res = makeRes();
    await getHandler('get', '/runs')({ user: { organizationId: 'org-1' }, query: {} }, res);
    expect(res.body.ruido).toBeNull();
    expect(ruidoMock.carregarRuidoDoAgente).not.toHaveBeenCalled();
  });
});

// ════════════════════════════════════════════════════════════════════
describe('P61 — o aviso da regravação chega à tela do cliente', () => {
  function runCompleta() {
    return {
      id: 'run-ok',
      agentId: 'agent-1',
      status: 'completed',
      results: [],
      scorePercent: 74,
      startedAt: AGORA,
      agent: { id: 'agent-1', name: 'Vera', organizationId: 'org-1' },
      fixDecisions: [],
    };
  }

  it('sem regravação, o campo vem nulo e a tela não mostra aviso', async () => {
    prismaMock.agentEvalRun.findFirst.mockResolvedValue(runCompleta());
    const res = makeRes();
    await getHandler('get', '/runs/:id')(
      { user: { organizationId: 'org-1' }, params: { id: 'run-ok' }, query: {} },
      res,
    );
    expect(res.body.regravacao).toBeNull();
  });

  it('com regravação, devolve nota antiga, nova e o que continua reprovado', async () => {
    prismaMock.agentEvalRun.findFirst.mockResolvedValue(runCompleta());
    regradeMock.resumirRegravacao.mockResolvedValue({
      runId: 'run-ok',
      notaAntiga: 74,
      notaRegravada: 86,
      reprovacoesDoGabarito: 4,
      continuamReprovados: ['cr8_no_pede_cpf'],
      porCenario: [],
    });
    const res = makeRes();

    await getHandler('get', '/runs/:id')(
      { user: { organizationId: 'org-1' }, params: { id: 'run-ok' }, query: {} },
      res,
    );

    expect(res.body.regravacao.notaAntiga).toBe(74);
    expect(res.body.regravacao.notaRegravada).toBe(86);
    expect(res.body.regravacao.continuamReprovados).toEqual(['cr8_no_pede_cpf']);
  });

  it('devolve o estado leigo, comparando com a execução anterior', async () => {
    prismaMock.agentEvalRun.findFirst
      .mockResolvedValueOnce(runCompleta())
      .mockResolvedValueOnce({ scorePercent: 80 });
    const res = makeRes();

    await getHandler('get', '/runs/:id')(
      { user: { organizationId: 'org-1' }, params: { id: 'run-ok' }, query: {} },
      res,
    );

    expect(res.body.estado.estado).toBe('estavel');
    expect(ruidoMock.classificarMudanca).toHaveBeenCalledWith({
      nota: 74,
      notaAnterior: 80,
      ruido: { desvio: 8, n: 8 },
    });
  });
});
