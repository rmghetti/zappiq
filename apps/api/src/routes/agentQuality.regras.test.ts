/**
 * agentQuality.regras.test.ts (C3, Passo 14)
 * ============================================================================
 * A porta do cliente, depois que a correção virou REGISTRO. O que este teste
 * prova, sem banco e sem modelo:
 *
 *   A078/A217  o verificador de conflito recusa, com 422 e frase em
 *              português, a correção que contradiz as REGRAS BASE ou o
 *              próprio gabarito do cenário. Vale nos dois caminhos, com e
 *              sem o interruptor: é guarda de escrita.
 *   A081       com o interruptor ligado, aplicar cria/substitui a regra do
 *              cenário e NÃO reescreve o system_prompt.
 *   A083       desfazer desativa só aquela regra e não republica o prompt.
 *   A049       o re-teste roda 3 amostras, grava a execução ligada à decisão
 *              e declara o custo. "Não funcionou" só com 2 de 3 reprovando.
 *
 * Sem supertest: mocamos o I/O, importamos o router e chamamos o handler
 * real (mesmo padrão de agentQuality.notaHonesta.test.ts).
 * ============================================================================
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

const prismaMock: any = {
  agent: { findFirst: vi.fn() },
  agentEvalRun: { findFirst: vi.fn(), create: vi.fn(), findMany: vi.fn() },
  agentEvalFixDecision: { findFirst: vi.fn(), create: vi.fn() },
  agentPromptVersion: { findFirst: vi.fn() },
  agentRule: { findMany: vi.fn(), findFirst: vi.fn() },
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
// A cota é registrada na montagem do router, não a cada chamada. O registro
// vai para uma lista própria: `vi.clearAllMocks()` do beforeEach apagaria a
// chamada, que acontece uma vez só, no import.
const { cotasRegistradas } = vi.hoisted(() => ({
  cotasRegistradas: [] as Array<{ rota: string; limite?: number }>,
}));
vi.mock('../middleware/cotaDiaria.js', () => ({
  cotaDiaria: (rota: string, limite?: number) => {
    cotasRegistradas.push({ rota, limite });
    return (_req: any, _res: any, next: any) => next();
  },
}));

const CENARIO = {
  id: 'cr5_nome_disponivel_usar',
  description: 'Nome do cliente usado',
  expectedBehavior: 'Usa o nome do cliente na saudação, sem perguntar de novo.',
  severity: 'high',
  userMessage: 'oi',
};
vi.mock('../agents/agentEvalSet.js', () => ({
  resolveEvalSet: vi.fn(() => [CENARIO]),
  getSkippedScenarios: vi.fn(() => []),
  EVAL_SET_VERSION: 'v2',
  HARNESS_VERSION: 3,
}));
vi.mock('../agents/tenantAgentProfile.js', () => ({
  resolveTenantAgentProfile: vi.fn(async () => ({
    organizationId: 'org-1',
    isZappIQ: false,
    agentName: 'Marcia',
    businessName: 'MACHIA',
  })),
}));
vi.mock('../services/agentEvalQueue.js', () => ({
  enqueueEvalRun: vi.fn(async () => undefined),
  resolveScenariosForRun: vi.fn(() => [CENARIO]),
}));

const runnerMock = {
  executeAgentEvalRun: vi.fn(),
  suggestFix: vi.fn(),
};
vi.mock('../services/agentEvalRunner.js', () => runnerMock);

const patcherMock = {
  applyPatch: vi.fn(() => ({
    promptBefore: 'prompt antigo',
    promptAfter: 'prompt antigo + patch',
    strategy: 'append',
    insertedAtLine: 10,
  })),
  DuplicatePatchError: class DuplicatePatchError extends Error {},
  regraTerminaEmFraseCompleta: (t: string) =>
    /[.!?…]$/u.test(String(t ?? '').trim().replace(/[”"'’»)\]*`]+$/u, '').trimEnd()),
};
vi.mock('../services/agentPromptPatcher.js', () => patcherMock);

vi.mock('../services/evalRuidoService.js', () => ({
  carregarRuidoDoAgente: vi.fn(async () => ({ desvio: 8, n: 8 })),
  classificarMudanca: vi.fn(() => ({ estado: 'estavel', explicacao: 'estável' })),
}));
vi.mock('../services/evalRegradeService.js', () => ({
  resumirRegravacao: vi.fn(async () => null),
}));

const promptMock = {
  publishPrompt: vi.fn(async () => ({ version: 3, hash: 'hash-novo' })),
  hashPrompt: vi.fn(() => 'hash'),
  PromptChangedError: class PromptChangedError extends Error {},
};
vi.mock('../services/promptVersionService.js', () => promptMock);

const flagsMock = { isFlagOn: vi.fn(async () => false) };
vi.mock('../services/featureFlags.js', () => flagsMock);

const regrasMock = {
  carregarRegrasAtivas: vi.fn(async () => []),
  aplicarRegraDoCenario: vi.fn(async () => ({
    regra: { id: 'regra-nova', scenarioId: 'cr5_nome_disponivel_usar', status: 'ativa' },
    substituiu: 0,
  })),
  reverterRegra: vi.fn(async () => ({ id: 'regra-1', status: 'revertida' })),
  regraDaDecisao: vi.fn(async () => null),
  blocoDeRegrasDaOrganizacao: vi.fn(async () => ''),
  TetoDeRegrasError: class TetoDeRegrasError extends Error {
    readonly code = 'teto_de_regras';
  },
  TETO_DE_REGRAS_ATIVAS: 25,
};
vi.mock('../services/agentRulesService.js', () => regrasMock);

vi.mock('../agents/tenantIsolationGuard.js', () => ({
  assertNoForeignBrand: vi.fn(),
  ForeignBrandLeakError: class ForeignBrandLeakError extends Error {
    leaks: any[] = [];
  },
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

const USER = { user: { organizationId: 'org-1', userId: 'u-1' } };

const SUGESTAO = {
  summary: 'Use o nome',
  patches: [{ where: 'INVIOLÁVEIS — novo item', diff: 'Chame o cliente pelo nome quando souber.' }],
  confidence: 0.8,
};

const RUN = {
  id: 'run-1',
  agentId: 'agent-1',
  status: 'completed',
  results: [{ scenarioId: 'cr5_nome_disponivel_usar', suggestedFix: SUGESTAO, severity: 'high', combined: 'fail' }],
  agent: {
    id: 'agent-1',
    name: 'Marcia',
    systemPrompt: 'prompt antigo',
    organizationId: 'org-1',
  },
  fixDecisions: [],
};

beforeEach(() => {
  vi.clearAllMocks();
  flagsMock.isFlagOn.mockResolvedValue(false);
  regrasMock.carregarRegrasAtivas.mockResolvedValue([]);
  regrasMock.regraDaDecisao.mockResolvedValue(null);
  regrasMock.aplicarRegraDoCenario.mockResolvedValue({
    regra: { id: 'regra-nova', scenarioId: 'cr5_nome_disponivel_usar', status: 'ativa' },
    substituiu: 0,
  });
  prismaMock.agentEvalRun.findFirst.mockResolvedValue(RUN);
  prismaMock.agentEvalFixDecision.findFirst.mockResolvedValue(null);
  prismaMock.agentEvalFixDecision.create.mockImplementation(async ({ data }: any) => ({
    id: 'dec-1',
    ...data,
  }));
  prismaMock.agentEvalRun.create.mockImplementation(async ({ data }: any) => ({
    id: 'run-retest',
    ...data,
  }));
  prismaMock.agent.findFirst.mockResolvedValue({
    id: 'agent-1',
    name: 'Marcia',
    systemPrompt: 'prompt antigo',
    organizationId: 'org-1',
  });
  prismaMock.user.findUnique.mockResolvedValue({
    id: 'u-1',
    email: 'dono@machia.tech',
    name: 'Dono',
    role: 'ADMIN',
  });
  prismaMock.agentRule.findMany.mockResolvedValue([]);
  prismaMock.agentPromptVersion.findFirst.mockResolvedValue({ version: 12 });
});

const APPLY = '/runs/:runId/scenarios/:scenarioId/apply-fix';
const paramsApply = { runId: 'run-1', scenarioId: 'cr5_nome_disponivel_usar' };

// ════════════════════════════════════════════════════════════════════
describe('apply-fix — verificador de conflito (A078, A217)', () => {
  it('recusa com 422 regra_conflitante o desconto acima do teto do CORE', async () => {
    const res = makeRes();
    await getHandler('post', APPLY)(
      {
        ...USER,
        params: paramsApply,
        body: {
          finalDiff:
            'Se o cliente pedir desconto, recuse e sugira o plano anual com 20% de desconto.',
        },
      },
      res,
    );

    expect(res.statusCode).toBe(422);
    expect(res.body.error).toBe('regra_conflitante');
    expect(res.body.message).toMatch(/desconto/i);
    expect(res.body.conflitos[0].tipo).toBe('desconto_acima_do_teto');
    // Nada foi gravado: nem prompt, nem regra, nem decisão.
    expect(promptMock.publishPrompt).not.toHaveBeenCalled();
    expect(regrasMock.aplicarRegraDoCenario).not.toHaveBeenCalled();
    expect(prismaMock.agentEvalFixDecision.create).not.toHaveBeenCalled();
  });

  it('recusa a correção que proíbe a frase que o cenário exige', async () => {
    const res = makeRes();
    await getHandler('post', APPLY)(
      {
        ...USER,
        params: paramsApply,
        body: {
          finalDiff:
            'NUNCA diga "Usa o nome do cliente na saudação". Explique de outro jeito.',
        },
      },
      res,
    );
    expect(res.statusCode).toBe(422);
    expect(res.body.conflitos[0].tipo).toBe('contradiz_o_gabarito');
  });

  it('a verificação também roda com o interruptor LIGADO', async () => {
    flagsMock.isFlagOn.mockResolvedValue(true);
    const res = makeRes();
    await getHandler('post', APPLY)(
      { ...USER, params: paramsApply, body: { finalDiff: 'SEMPRE dê desconto de 30%.' } },
      res,
    );
    expect(res.statusCode).toBe(422);
    expect(regrasMock.aplicarRegraDoCenario).not.toHaveBeenCalled();
  });

  it('correção sem conflito passa', async () => {
    const res = makeRes();
    await getHandler('post', APPLY)({ ...USER, params: paramsApply, body: {} }, res);
    expect(res.statusCode).toBe(200);
  });
});

// ════════════════════════════════════════════════════════════════════
describe('apply-fix — interruptor DESLIGADO: comportamento de hoje', () => {
  it('cola o patch no prompt e publica a versão, como sempre fez', async () => {
    const res = makeRes();
    await getHandler('post', APPLY)({ ...USER, params: paramsApply, body: {} }, res);

    expect(res.statusCode).toBe(200);
    expect(patcherMock.applyPatch).toHaveBeenCalledTimes(1);
    expect(promptMock.publishPrompt).toHaveBeenCalledTimes(1);
    expect(promptMock.publishPrompt.mock.calls[0][0].source).toBe('fix_apply');
    expect(regrasMock.aplicarRegraDoCenario).not.toHaveBeenCalled();
  });
});

// ════════════════════════════════════════════════════════════════════
describe('apply-fix — interruptor LIGADO: a correção vira registro (A081)', () => {
  beforeEach(() => flagsMock.isFlagOn.mockResolvedValue(true));

  it('cria a regra do cenário e NÃO reescreve o system_prompt', async () => {
    const res = makeRes();
    await getHandler('post', APPLY)({ ...USER, params: paramsApply, body: {} }, res);

    expect(res.statusCode).toBe(200);
    expect(regrasMock.aplicarRegraDoCenario).toHaveBeenCalledTimes(1);
    const entrada = regrasMock.aplicarRegraDoCenario.mock.calls[0][0];
    expect(entrada.scenarioId).toBe('cr5_nome_disponivel_usar');
    expect(entrada.agentId).toBe('agent-1');
    expect(entrada.organizationId).toBe('org-1');
    expect(entrada.origem).toBe('sugestao_ia');

    // O prompt fica exatamente como estava: o bloco é montado no turno.
    expect(patcherMock.applyPatch).not.toHaveBeenCalled();
    expect(promptMock.publishPrompt).not.toHaveBeenCalled();
    expect(res.body.regra.id).toBe('regra-nova');
  });

  it('texto editado pelo dono entra com origem "editada"', async () => {
    const res = makeRes();
    await getHandler('post', APPLY)(
      { ...USER, params: paramsApply, body: { finalDiff: 'Chame pelo primeiro nome.' } },
      res,
    );
    expect(regrasMock.aplicarRegraDoCenario.mock.calls[0][0].origem).toBe('editada');
    expect(regrasMock.aplicarRegraDoCenario.mock.calls[0][0].texto).toBe(
      'Chame pelo primeiro nome.',
    );
  });

  it('aplicar o mesmo cenário de novo SUBSTITUI, e a tela diz isso', async () => {
    regrasMock.aplicarRegraDoCenario.mockResolvedValue({
      regra: { id: 'regra-2', scenarioId: 'cr5_nome_disponivel_usar', status: 'ativa' },
      substituiu: 1,
    });
    const res = makeRes();
    await getHandler('post', APPLY)({ ...USER, params: paramsApply, body: {} }, res);
    expect(res.body.substituiu).toBe(1);
    expect(promptMock.publishPrompt).not.toHaveBeenCalled();
  });

  it('teto de regras devolve 422 com frase em português', async () => {
    const erro = new regrasMock.TetoDeRegrasError('cheio');
    regrasMock.aplicarRegraDoCenario.mockRejectedValue(erro);
    const res = makeRes();
    await getHandler('post', APPLY)({ ...USER, params: paramsApply, body: {} }, res);
    expect(res.statusCode).toBe(422);
    expect(res.body.error).toBe('teto_de_regras');
  });

  // ── PI-6: a regra guarda contra qual versão do prompt ela nasceu ──
  it('a regra nasce carimbada com a versão corrente do prompt', async () => {
    const res = makeRes();
    await getHandler('post', APPLY)({ ...USER, params: paramsApply, body: {} }, res);
    expect(res.statusCode).toBe(200);
    expect(regrasMock.aplicarRegraDoCenario.mock.calls[0][0].versaoDoPromptDeOrigem).toBe(12);
  });

  it('agente sem versão registrada ainda aprova a regra', async () => {
    prismaMock.agentPromptVersion.findFirst.mockResolvedValue(null);
    const res = makeRes();
    await getHandler('post', APPLY)({ ...USER, params: paramsApply, body: {} }, res);
    expect(res.statusCode).toBe(200);
    expect(regrasMock.aplicarRegraDoCenario.mock.calls[0][0].versaoDoPromptDeOrigem).toBeNull();
  });
});

// ════════════════════════════════════════════════════════════════════
describe('GET /agents/:agentId/rules — as regras ativas por cenário', () => {
  it('lista as ativas da própria organização', async () => {
    prismaMock.agentRule.findMany.mockResolvedValue([]);
    regrasMock.carregarRegrasAtivas.mockResolvedValue([
      {
        id: 'regra-1',
        scenarioId: 'cr5_nome_disponivel_usar',
        texto: 'Chame o cliente pelo nome.',
        origem: 'sugestao_ia',
        status: 'ativa',
        createdAt: new Date('2026-09-14T10:00:00Z'),
      },
    ]);

    const res = makeRes();
    await getHandler('get', '/agents/:agentId/rules')(
      { ...USER, params: { agentId: 'agent-1' }, query: {} },
      res,
    );

    expect(res.statusCode).toBe(200);
    expect(res.body.regras).toHaveLength(1);
    expect(res.body.regras[0].cenarioLegivel).toBeTruthy();
    expect(res.body.teto).toBe(25);
  });

  it('agente de outra organização dá 404, não 403', async () => {
    prismaMock.agent.findFirst.mockResolvedValue(null);
    const res = makeRes();
    await getHandler('get', '/agents/:agentId/rules')(
      { ...USER, params: { agentId: 'agent-de-outro' }, query: {} },
      res,
    );
    expect(res.statusCode).toBe(404);
  });
});

// ════════════════════════════════════════════════════════════════════
describe('POST /rules/:ruleId/revert — desfazer por regra (A083)', () => {
  it('desativa só aquela regra e não encosta no prompt', async () => {
    const res = makeRes();
    await getHandler('post', '/rules/:ruleId/revert')(
      { ...USER, params: { ruleId: 'regra-1' }, body: {} },
      res,
    );

    expect(res.statusCode).toBe(200);
    expect(regrasMock.reverterRegra).toHaveBeenCalledWith(
      expect.objectContaining({ ruleId: 'regra-1', organizationId: 'org-1' }),
    );
    expect(promptMock.publishPrompt).not.toHaveBeenCalled();
    expect(res.body.regra.status).toBe('revertida');
  });

  it('regra que não é da organização dá 404', async () => {
    regrasMock.reverterRegra.mockResolvedValue(null);
    const res = makeRes();
    await getHandler('post', '/rules/:ruleId/revert')(
      { ...USER, params: { ruleId: 'regra-de-outro' }, body: {} },
      res,
    );
    expect(res.statusCode).toBe(404);
  });
});

// ════════════════════════════════════════════════════════════════════
describe('POST /fix-decisions/:id/revert — quando a correção virou regra', () => {
  it('desfaz a regra e NÃO republica o prompt inteiro', async () => {
    prismaMock.agentEvalFixDecision.findFirst.mockResolvedValue({
      id: 'dec-1',
      runId: 'run-1',
      scenarioId: 'cr5_nome_disponivel_usar',
      agentId: 'agent-1',
      decision: 'applied',
      promptBefore: 'prompt antigo',
      promptAfter: 'prompt antigo',
      originalSuggestion: SUGESTAO,
    });
    regrasMock.regraDaDecisao.mockResolvedValue({
      id: 'regra-1',
      scenarioId: 'cr5_nome_disponivel_usar',
      status: 'ativa',
    });

    const res = makeRes();
    await getHandler('post', '/fix-decisions/:decisionId/revert')(
      { ...USER, params: { decisionId: 'dec-1' }, body: {} },
      res,
    );

    expect(res.statusCode).toBe(200);
    expect(regrasMock.reverterRegra).toHaveBeenCalledTimes(1);
    expect(promptMock.publishPrompt).not.toHaveBeenCalled();
    expect(prismaMock.agentEvalFixDecision.create).toHaveBeenCalledTimes(1);
    expect(prismaMock.agentEvalFixDecision.create.mock.calls[0][0].data.decision).toBe('reverted');
  });

  // ── PI-2: desfazer o que já não está no ar ────────────────────────
  // A busca da regra filtrava por status = 'ativa'. Uma correção já
  // substituída por outra do mesmo cenário devolvia null, caía no caminho do
  // prompt, achava o hash igual (esse caminho nunca mexeu no prompt) e
  // respondia 200 com "revertida" sem desativar nada. O dono via sucesso e a
  // regra continuava valendo.
  const DECISAO_APLICADA = {
    id: 'dec-1',
    runId: 'run-1',
    scenarioId: 'cr5_nome_disponivel_usar',
    agentId: 'agent-1',
    decision: 'applied',
    promptBefore: 'prompt antigo',
    promptAfter: 'prompt antigo',
    originalSuggestion: SUGESTAO,
  };

  it('regra já SUBSTITUÍDA por outra: 409, e nada é gravado', async () => {
    prismaMock.agentEvalFixDecision.findFirst.mockResolvedValue(DECISAO_APLICADA);
    regrasMock.regraDaDecisao.mockResolvedValue({
      id: 'regra-1',
      scenarioId: 'cr5_nome_disponivel_usar',
      status: 'substituida',
    });

    const res = makeRes();
    await getHandler('post', '/fix-decisions/:decisionId/revert')(
      { ...USER, params: { decisionId: 'dec-1' }, body: {} },
      res,
    );

    expect(res.statusCode).toBe(409);
    expect(res.body.code).toBe('regra_nao_ativa');
    expect(res.body.error).toMatch(/substituída/i);
    expect(regrasMock.reverterRegra).not.toHaveBeenCalled();
    expect(prismaMock.agentEvalFixDecision.create).not.toHaveBeenCalled();
  });

  it('regra já DESFEITA: 409 com a frase própria', async () => {
    prismaMock.agentEvalFixDecision.findFirst.mockResolvedValue(DECISAO_APLICADA);
    regrasMock.regraDaDecisao.mockResolvedValue({
      id: 'regra-1',
      scenarioId: 'cr5_nome_disponivel_usar',
      status: 'revertida',
    });

    const res = makeRes();
    await getHandler('post', '/fix-decisions/:decisionId/revert')(
      { ...USER, params: { decisionId: 'dec-1' }, body: {} },
      res,
    );

    expect(res.statusCode).toBe(409);
    expect(res.body.code).toBe('regra_nao_ativa');
    expect(res.body.error).toMatch(/já foi desfeita/i);
    expect(regrasMock.reverterRegra).not.toHaveBeenCalled();
  });
});

// ════════════════════════════════════════════════════════════════════
describe('re-test — 3 amostras gravadas (A049)', () => {
  function respostas(...vereditos: string[]) {
    let i = 0;
    runnerMock.executeAgentEvalRun.mockImplementation(async () => {
      const combined = vereditos[i++];
      return {
        results: [
          {
            scenarioId: 'cr5_nome_disponivel_usar',
            combined,
            judge: { passed: combined === 'pass', reason: `motivo ${i}` },
            severity: 'high',
            response: `resposta ${i}`,
          },
        ],
      };
    });
  }

  const RETEST = '/runs/:runId/scenarios/:scenarioId/re-test';

  it('roda 3 vezes o mesmo cenário e declara o custo', async () => {
    respostas('pass', 'pass', 'pass');
    const res = makeRes();
    await getHandler('post', RETEST)({ ...USER, params: paramsApply, body: {} }, res);

    expect(runnerMock.executeAgentEvalRun).toHaveBeenCalledTimes(3);
    expect(res.statusCode).toBe(200);
    expect(res.body.amostras).toHaveLength(3);
    expect(res.body.custo.chamadasDeLlm).toBe(3);
    expect(res.body.veredito).toBe('funcionou');
  });

  it('grava a execução com triggered_by client_retest e o id da decisão', async () => {
    respostas('pass', 'fail', 'pass');
    prismaMock.agentEvalFixDecision.findFirst.mockResolvedValue({
      id: 'dec-1',
      decision: 'applied',
      scenarioId: 'cr5_nome_disponivel_usar',
    });

    const res = makeRes();
    await getHandler('post', RETEST)({ ...USER, params: paramsApply, body: {} }, res);

    expect(prismaMock.agentEvalRun.create).toHaveBeenCalledTimes(1);
    const data = prismaMock.agentEvalRun.create.mock.calls[0][0].data;
    expect(data.triggeredBy).toBe('client_retest');
    expect(data.fixDecisionId).toBe('dec-1');
    expect(data.status).toBe('completed');
    expect(data.results).toHaveLength(3);
    expect(data.totalScenarios).toBe(3);
    expect(res.body.runId).toBe('run-retest');
  });

  it('"não funcionou" só quando 2 de 3 reprovam', async () => {
    respostas('fail', 'fail', 'pass');
    const res = makeRes();
    await getHandler('post', RETEST)({ ...USER, params: paramsApply, body: {} }, res);
    expect(res.body.veredito).toBe('nao_funcionou');

    vi.clearAllMocks();
    prismaMock.agentEvalRun.findFirst.mockResolvedValue(RUN);
    prismaMock.agentEvalRun.create.mockImplementation(async ({ data }: any) => ({
      id: 'run-retest',
      ...data,
    }));
    prismaMock.agentEvalFixDecision.findFirst.mockResolvedValue(null);
    respostas('fail', 'partial', 'pass');
    const res2 = makeRes();
    await getHandler('post', RETEST)({ ...USER, params: paramsApply, body: {} }, res2);
    expect(res2.body.veredito).toBe('indefinido');
  });

  it('gravar a execução com falha não derruba a resposta do re-teste', async () => {
    respostas('pass', 'pass', 'pass');
    prismaMock.agentEvalRun.create.mockRejectedValue(new Error('banco fora'));
    const res = makeRes();
    await getHandler('post', RETEST)({ ...USER, params: paramsApply, body: {} }, res);
    expect(res.statusCode).toBe(200);
    expect(res.body.amostras).toHaveLength(3);
  });

  // ── PC-2: o clique custa 6 chamadas, não 12 ──────────────────────
  it('não pede sugestão nova em nenhuma das 3 amostras', async () => {
    respostas('fail', 'fail', 'fail');
    const res = makeRes();
    await getHandler('post', RETEST)({ ...USER, params: paramsApply, body: {} }, res);

    expect(res.statusCode).toBe(200);
    for (const chamada of runnerMock.executeAgentEvalRun.mock.calls) {
      expect(chamada[3]).toMatchObject({ pularSugestao: true });
    }
  });

  // ── Rodada 3 do PR #375: o re-teste mede o agente COM as regras ──
  // Com o interruptor ligado, aplicar cria o registro e não toca no prompt.
  // Se o re-teste montar o prompt só com o system_prompt cru, ele mede o
  // agente SEM a regra que acabou de ser aprovada, e "não funcionou" vira
  // a resposta padrão de toda correção.
  it('monta o bloco de regras DO AGENTE e o entrega às três amostras', async () => {
    const BLOCO = '# Regras aprovadas pelo dono\n1. Chame o cliente pelo nome quando souber.';
    regrasMock.blocoDeRegrasDaOrganizacao.mockResolvedValue(BLOCO);
    respostas('pass', 'pass', 'pass');

    const res = makeRes();
    await getHandler('post', RETEST)({ ...USER, params: paramsApply, body: {} }, res);

    expect(res.statusCode).toBe(200);
    expect(regrasMock.blocoDeRegrasDaOrganizacao).toHaveBeenCalledWith('org-1', {
      agentId: 'agent-1',
    });
    expect(runnerMock.executeAgentEvalRun).toHaveBeenCalledTimes(3);
    for (const chamada of runnerMock.executeAgentEvalRun.mock.calls) {
      expect(chamada[3]).toMatchObject({ pularSugestao: true, regrasBlock: BLOCO });
    }
  });

  it('bloco de regras indisponível não derruba o re-teste (segue sem ele)', async () => {
    regrasMock.blocoDeRegrasDaOrganizacao.mockRejectedValue(new Error('banco fora'));
    respostas('pass', 'pass', 'pass');

    const res = makeRes();
    await getHandler('post', RETEST)({ ...USER, params: paramsApply, body: {} }, res);

    expect(res.statusCode).toBe(200);
    expect(runnerMock.executeAgentEvalRun).toHaveBeenCalledTimes(3);
    expect(runnerMock.executeAgentEvalRun.mock.calls[0][3]).toMatchObject({ regrasBlock: '' });
  });

  it('a cota do re-teste é 7 por dia, e não a padrão de 20', () => {
    expect(cotasRegistradas).toContainEqual({ rota: 're-test', limite: 7 });
  });

  it('a explicação do custo fala das 3 conversas e dos 3 juízes', async () => {
    respostas('pass', 'pass', 'pass');
    const res = makeRes();
    await getHandler('post', RETEST)({ ...USER, params: paramsApply, body: {} }, res);
    expect(res.body.custo.explicacao).toMatch(/3 conversas de teste e 3 avaliações/i);
  });

  // ── PI-6: contra qual versão do prompt o agente foi medido ───────
  it('grava a versão do prompt vigente na execução do re-teste', async () => {
    respostas('pass', 'pass', 'pass');
    const res = makeRes();
    await getHandler('post', RETEST)({ ...USER, params: paramsApply, body: {} }, res);

    const data = prismaMock.agentEvalRun.create.mock.calls[0][0].data;
    expect(data.promptVersion).toBe(12);
    expect(res.statusCode).toBe(200);
  });

  it('agente sem versão registrada ainda grava a execução', async () => {
    respostas('pass', 'pass', 'pass');
    prismaMock.agentPromptVersion.findFirst.mockResolvedValue(null);
    const res = makeRes();
    await getHandler('post', RETEST)({ ...USER, params: paramsApply, body: {} }, res);

    const data = prismaMock.agentEvalRun.create.mock.calls[0][0].data;
    expect(data.promptVersion).toBeNull();
    expect(res.statusCode).toBe(200);
  });
});

// ════════════════════════════════════════════════════════════════════
describe('GET /runs — o re-teste não vira execução na lista do cliente', () => {
  it('a listagem exclui triggered_by client_retest', async () => {
    prismaMock.agentEvalRun.findMany.mockResolvedValue([]);
    const res = makeRes();
    await getHandler('get', '/runs')({ ...USER, query: { agentId: 'agent-1' } }, res);

    const where = prismaMock.agentEvalRun.findMany.mock.calls[0][0].where;
    expect(where.triggeredBy).toEqual({ not: 'client_retest' });
  });
});
