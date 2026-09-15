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
  // Nota 3 da revisão de 14/09: a porta do superadmin passa a gravar
  // registro quando o interruptor da organização está ligado.
  aplicarRegraDoCenario: vi.fn(async () => ({
    regra: { id: 'regra-nova', scenarioId: 'cr7_no_invent_sla', status: 'ativa' },
    substituiu: 0,
  })),
  reverterRegra: vi.fn(async () => ({ id: 'regra-1', status: 'revertida' })),
  regraDaDecisao: vi.fn(async () => null),
  TetoDeRegrasError: class TetoDeRegrasError extends Error {
    readonly code = 'teto_de_regras';
  },
};
vi.mock('../services/agentRulesService.js', () => regrasMock);

const flagsMock = { isFlagOn: vi.fn(async () => false) };
vi.mock('../services/featureFlags.js', () => flagsMock);

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

const REGRAS = [
  {
    id: 'regra-1',
    organizationId: 'org-cliente',
    agentId: 'agent-1',
    scenarioId: 'cr7_no_invent_sla',
    texto: 'Nunca prometa prazo que não esteja cadastrado.',
    status: 'ativa',
  },
];

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
  flagsMock.isFlagOn.mockResolvedValue(false);
  regrasMock.regraDaDecisao.mockResolvedValue(null);
  regrasMock.reverterRegra.mockResolvedValue({ id: 'regra-1', status: 'revertida' });
  regrasMock.aplicarRegraDoCenario.mockResolvedValue({
    regra: { id: 'regra-nova', scenarioId: 'cr7_no_invent_sla', status: 'ativa' },
    substituiu: 0,
  });
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

  // Rodada 4 do PR #375: o sugeridor desta execução lia "Nenhuma regra
  // aprovada ainda" com as regras no bloco, e propunha a mesma de novo.
  it('com bloco, o sugeridor recebe as regras ativas do agente', async () => {
    regrasMock.carregarRegrasAtivas.mockResolvedValue(REGRAS as any);

    const res = makeRes();
    await getHandler('post', '/run')({ user: { userId: 'super-1' }, body: { agentId: 'agent-1' } }, res);

    expect(res.statusCode).toBe(200);
    expect(regrasMock.carregarRegrasAtivas).toHaveBeenCalledWith({
      organizationId: 'org-cliente',
      agentId: 'agent-1',
    });
    expect(runnerMock.executeAgentEvalRun.mock.calls[0][3]).toMatchObject({
      regrasBlock: BLOCO,
      regrasAtivas: REGRAS,
    });
  });

  it('bloco vazio (interruptor desligado): nenhuma consulta a mais e lista vazia', async () => {
    regrasMock.blocoDeRegrasDaOrganizacao.mockResolvedValue('');

    const res = makeRes();
    await getHandler('post', '/run')({ user: { userId: 'super-1' }, body: { agentId: 'agent-1' } }, res);

    expect(res.statusCode).toBe(200);
    expect(regrasMock.carregarRegrasAtivas).not.toHaveBeenCalled();
    // Rodada 2 do PR #377: o montador do motor único vai no MESMO objeto das
    // regras (um parâmetro só). As regras continuam exatamente estas.
    // C2, nota 1: e a política da faixa do plano (evalNoTier), preguiçosa.
    expect(runnerMock.executeAgentEvalRun.mock.calls[0][3]).toEqual({
      regrasBlock: '',
      regrasAtivas: [],
      montarContexto: expect.any(Function),
      politica: expect.any(Function),
    });
  });

  it('regras indisponíveis não derrubam a execução: segue com lista vazia', async () => {
    regrasMock.carregarRegrasAtivas.mockRejectedValue(new Error('banco fora'));

    const res = makeRes();
    await getHandler('post', '/run')({ user: { userId: 'super-1' }, body: { agentId: 'agent-1' } }, res);

    expect(res.statusCode).toBe(200);
    expect(runnerMock.executeAgentEvalRun.mock.calls[0][3]).toMatchObject({
      regrasBlock: BLOCO,
      regrasAtivas: [],
    });
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

  // Rodada 4 do PR #375: o re-verify também leva as regras ao sugeridor.
  it('com bloco, o re-verify entrega as regras ativas do agente', async () => {
    prismaMock.agentEvalRun.findUnique.mockResolvedValue(runComSugestao());
    regrasMock.carregarRegrasAtivas.mockResolvedValue(REGRAS as any);

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
    expect(runnerMock.executeAgentEvalRun).toHaveBeenCalledTimes(1);
    expect(runnerMock.executeAgentEvalRun.mock.calls[0][3]).toMatchObject({
      regrasBlock: BLOCO,
      regrasAtivas: REGRAS,
    });
  });

  it('bloco vazio: o re-verify não consulta as regras de novo e segue com lista vazia', async () => {
    prismaMock.agentEvalRun.findUnique.mockResolvedValue(runComSugestao());
    regrasMock.blocoDeRegrasDaOrganizacao.mockResolvedValue('');

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
    // A única leitura é a do verificador de conflito, antes de aplicar.
    expect(regrasMock.carregarRegrasAtivas).toHaveBeenCalledTimes(1);
    // Rodada 2 do PR #377: o montador do motor único vai no MESMO objeto.
    // Nota 8 da revisão de 14/09: o re-verify não pede sugestão nova.
    expect(runnerMock.executeAgentEvalRun.mock.calls[0][3]).toEqual({
      regrasBlock: '',
      regrasAtivas: [],
      montarContexto: expect.any(Function),
      pularSugestao: true,
      politica: expect.any(Function),
    });
  });
});

/* ══════════════════════════════════════════════════════════════════════
 * Rodada 4 do PR #375. O re-teste do cliente é gravado como execução
 * 'completed' com 3 amostras no formato {amostra, combined, resposta,
 * motivoDoJuiz}: sem scenarioId e sem judge. A tela do superadmin
 * (admin/agent-quality) abre a última concluída da lista e o
 * FixSuggestionCard lê `judge.reason`: com o re-teste no topo, a tela
 * quebrava com "Cannot read properties of undefined (reading 'reason')".
 * Vale com o interruptor DESLIGADO, ou seja, no dia do merge.
 * ══════════════════════════════════════════════════════════════════════ */
describe('GET /runs do superadmin: o re-teste do cliente não entra na lista', () => {
  const SEMANAL = {
    id: 'run-semanal',
    agentId: 'agent-1',
    status: 'completed',
    triggeredBy: 'cron',
    startedAt: new Date('2026-09-11T04:30:00Z'),
  };
  const RETESTE = {
    id: 'run-reteste',
    agentId: 'agent-1',
    status: 'completed',
    triggeredBy: 'client_retest',
    startedAt: new Date('2026-09-14T10:00:00Z'),
  };

  beforeEach(() => {
    const linhas = [SEMANAL, RETESTE];
    // O banco falso honra o `where`: se a rota não excluir o re-teste, ele
    // vem, e vem PRIMEIRO (é o mais novo).
    prismaMock.agentEvalRun.findMany.mockImplementation(async ({ where, take }: any) =>
      linhas
        .filter((l) => !where?.agentId || l.agentId === where.agentId)
        .filter((l) => !where?.status || l.status === where.status)
        .filter((l) => !(where?.triggeredBy?.not && l.triggeredBy === where.triggeredBy.not))
        .sort((a, b) => b.startedAt.getTime() - a.startedAt.getTime())
        .slice(0, take ?? linhas.length),
    );
  });

  it('com um re-teste mais novo que a execução semanal, a lista não o devolve', async () => {
    const res = makeRes();
    await getHandler('get', '/runs')({ user: { userId: 'super-1' }, query: {} }, res);

    expect(res.statusCode).toBe(200);
    expect(res.body.runs.map((r: any) => r.id)).toEqual(['run-semanal']);
    // A tela abre a primeira concluída: tem de ser a semanal, que tem judge.
    expect(res.body.runs.find((r: any) => r.status === 'completed')?.id).toBe('run-semanal');
  });

  it('filtrando por agente e por status, o re-teste continua de fora', async () => {
    const res = makeRes();
    await getHandler('get', '/runs')(
      { user: { userId: 'super-1' }, query: { agentId: 'agent-1', status: 'completed' } },
      res,
    );

    expect(res.body.runs.map((r: any) => r.id)).toEqual(['run-semanal']);
    const where = prismaMock.agentEvalRun.findMany.mock.calls[0][0].where;
    expect(where).toMatchObject({
      agentId: 'agent-1',
      status: 'completed',
      triggeredBy: { not: 'client_retest' },
    });
  });
});

/* ══════════════════════════════════════════════════════════════════════
 * Notas 3, 7 e 8 da revisão de 14/09 (tarefa C2).
 *
 * Nota 3: a porta do superadmin ignorava `regrasComoRegistros` e colava o
 * texto no prompt mesmo com o interruptor ligado. A MACHIA está com ele
 * ligado desde 14/09: aplicar pelo admin DUPLICAVA a regra (no prompt e no
 * bloco), e desfazer pela tela do cliente tirava só a do bloco. Agora as
 * duas portas seguem o mesmo interruptor, pela organização DO AGENTE.
 *
 * Nota 8: o re-verify do superadmin pedia uma sugestão nova que era jogada
 * fora. Passa `pularSugestao: true`.
 * ══════════════════════════════════════════════════════════════════════ */
describe('apply-fix do superadmin segue o interruptor da organização (nota 3)', () => {
  const ROTA = '/runs/:runId/scenarios/:scenarioId/apply-fix';
  const pedido = (body: Record<string, unknown> = {}) => ({
    user: { userId: 'super-1', role: 'SUPERADMIN' },
    params: { runId: 'run-1', scenarioId: 'cr7_no_invent_sla' },
    body,
  });
  const run = () => ({
    id: 'run-1',
    agentId: 'agent-1',
    results: [
      {
        scenarioId: 'cr7_no_invent_sla',
        severity: 'high',
        combined: 'fail',
        suggestedFix: { summary: 's', patches: [{ where: 'novo', diff: REGRA_INTEIRA }], confidence: 0.9 },
      },
    ],
    agent: AGENTE,
  });

  it('interruptor LIGADO: vira registro da organização do agente e o prompt não é tocado', async () => {
    flagsMock.isFlagOn.mockResolvedValue(true);
    prismaMock.agentEvalRun.findUnique.mockResolvedValue(run());
    const { applyPatch } = await import('../services/agentPromptPatcher.js');
    const { publishPrompt } = await import('../services/promptVersionService.js');

    const res = makeRes();
    await getHandler('post', ROTA)(pedido(), res);

    expect(res.statusCode).toBe(200);
    // O interruptor lido é o da organização DO AGENTE, não o do superadmin.
    expect(flagsMock.isFlagOn).toHaveBeenCalledWith('org-cliente', 'regrasComoRegistros');
    expect(regrasMock.aplicarRegraDoCenario).toHaveBeenCalledTimes(1);
    const entrada = (regrasMock.aplicarRegraDoCenario.mock.calls[0] as any[])[0];
    expect(entrada.organizationId).toBe('org-cliente');
    expect(entrada.agentId).toBe('agent-1');
    expect(entrada.scenarioId).toBe('cr7_no_invent_sla');
    expect(applyPatch).not.toHaveBeenCalled();
    expect(publishPrompt).not.toHaveBeenCalled();
    // A decisão guarda o mesmo prompt nos dois lados: prova de que ele não mudou.
    const decisao = prismaMock.agentEvalFixDecision.create.mock.calls[0][0].data;
    expect(decisao.promptBefore).toBe(AGENTE.systemPrompt);
    expect(decisao.promptAfter).toBe(AGENTE.systemPrompt);
    expect(res.body.comoRegistro).toBe(true);
    // O re-verify mede o prompt de sempre, com o bloco que já traz a regra nova.
    expect(runnerMock.executeAgentEvalRun.mock.calls[0][1]).toMatchObject({
      systemPrompt: AGENTE.systemPrompt,
    });
  });

  it('interruptor DESLIGADO: cola no prompt, como sempre fez', async () => {
    prismaMock.agentEvalRun.findUnique.mockResolvedValue(run());
    const { applyPatch } = await import('../services/agentPromptPatcher.js');

    const res = makeRes();
    await getHandler('post', ROTA)(pedido(), res);

    expect(res.statusCode).toBe(200);
    expect(applyPatch).toHaveBeenCalledTimes(1);
    expect(regrasMock.aplicarRegraDoCenario).not.toHaveBeenCalled();
  });

  it('o texto gravado pelo superadmin também sai sem o nome fictício (nota 2)', async () => {
    flagsMock.isFlagOn.mockResolvedValue(true);
    prismaMock.agentEvalRun.findUnique.mockResolvedValue(run());

    const res = makeRes();
    await getHandler('post', ROTA)(
      pedido({ finalDiff: 'Nunca prometa prazo. Exemplo CORRETO: "Oi, Rod! Vou confirmar com o time."' }),
      res,
    );

    expect(res.statusCode).toBe(200);
    const texto = (regrasMock.aplicarRegraDoCenario.mock.calls[0] as any[])[0].texto;
    expect(texto).not.toMatch(/\bRod\b/);
    expect(texto).toContain('[nome]');
  });

  it('aprovação simultânea do mesmo cenário: 409 em português (nota 7)', async () => {
    flagsMock.isFlagOn.mockResolvedValue(true);
    prismaMock.agentEvalRun.findUnique.mockResolvedValue(run());
    regrasMock.aplicarRegraDoCenario.mockRejectedValue(
      Object.assign(new Error('Outra aprovação deste mesmo caso de teste terminou agora há pouco.'), {
        code: 'regra_concorrente',
      }),
    );

    const res = makeRes();
    await getHandler('post', ROTA)(pedido(), res);

    expect(res.statusCode).toBe(409);
    expect(res.body.error).toBe('regra_concorrente');
  });

  it('o re-verify passa pularSugestao: true, com e sem o interruptor (nota 8)', async () => {
    for (const ligado of [false, true]) {
      vi.clearAllMocks();
      flagsMock.isFlagOn.mockResolvedValue(ligado);
      regrasMock.aplicarRegraDoCenario.mockResolvedValue({
        regra: { id: 'regra-nova', scenarioId: 'cr7_no_invent_sla', status: 'ativa' },
        substituiu: 0,
      });
      prismaMock.agentEvalRun.findUnique.mockResolvedValue(run());
      prismaMock.agentEvalFixDecision.findFirst.mockResolvedValue(null);
      prismaMock.agentEvalFixDecision.create.mockResolvedValue({ id: 'dec-1' });
      runnerMock.executeAgentEvalRun.mockResolvedValue({
        results: [{ scenarioId: 'cr7_no_invent_sla', combined: 'pass' }],
        durationMs: 10,
        summary: { passed: 1, partial: 0, failed: 0, criticalFailed: 0, erros: 0, scorePercent: 100 },
      });
      runnerMock.computeReverifyVerdict.mockReturnValue({ before: 'fail', after: 'pass', improved: true });

      const res = makeRes();
      await getHandler('post', ROTA)(pedido(), res);

      expect(res.statusCode).toBe(200);
      expect(runnerMock.executeAgentEvalRun.mock.calls[0][3]).toMatchObject({ pularSugestao: true });
    }
  });
});

describe('revert do superadmin: correção que virou regra (notas 3 e 7)', () => {
  const ROTA = '/fix-decisions/:decisionId/revert';
  const DECISAO = {
    id: 'dec-1',
    runId: 'run-1',
    scenarioId: 'cr7_no_invent_sla',
    agentId: 'agent-1',
    decision: 'applied',
    promptBefore: 'prompt do cliente',
    promptAfter: 'prompt do cliente',
    originalSuggestion: {},
  };

  beforeEach(() => {
    (prismaMock.agentEvalFixDecision as any).findUnique = vi.fn(async () => DECISAO);
    prismaMock.agent.findUnique.mockResolvedValue({ ...AGENTE, organizationId: 'org-cliente' });
  });

  it('desativa só a regra e NÃO republica o prompt', async () => {
    regrasMock.regraDaDecisao.mockResolvedValue({ id: 'regra-1', status: 'ativa' } as any);
    const { publishPrompt } = await import('../services/promptVersionService.js');

    const res = makeRes();
    await getHandler('post', ROTA)({ user: { userId: 'super-1' }, params: { decisionId: 'dec-1' }, body: {} }, res);

    expect(res.statusCode).toBe(200);
    expect(regrasMock.reverterRegra).toHaveBeenCalledWith(
      expect.objectContaining({ ruleId: 'regra-1', organizationId: 'org-cliente' }),
      expect.anything(),
    );
    expect(publishPrompt).not.toHaveBeenCalled();
    expect(prismaMock.agentEvalFixDecision.create.mock.calls[0][0].data.decision).toBe('reverted');
  });

  it('regra que já saiu do ar: 409 e nada gravado', async () => {
    regrasMock.regraDaDecisao.mockResolvedValue({ id: 'regra-1', status: 'substituida' } as any);

    const res = makeRes();
    await getHandler('post', ROTA)({ user: { userId: 'super-1' }, params: { decisionId: 'dec-1' }, body: {} }, res);

    expect(res.statusCode).toBe(409);
    expect(res.body.code).toBe('regra_nao_ativa');
    expect(regrasMock.reverterRegra).not.toHaveBeenCalled();
    expect(prismaMock.agentEvalFixDecision.create).not.toHaveBeenCalled();
  });

  it('reversão que perdeu a corrida: 409 e nenhuma decisão com regra nula', async () => {
    regrasMock.regraDaDecisao.mockResolvedValue({ id: 'regra-1', status: 'ativa' } as any);
    regrasMock.reverterRegra.mockResolvedValue(null as any);

    const res = makeRes();
    await getHandler('post', ROTA)({ user: { userId: 'super-1' }, params: { decisionId: 'dec-1' }, body: {} }, res);

    expect(res.statusCode).toBe(409);
    expect(prismaMock.agentEvalFixDecision.create).not.toHaveBeenCalled();
  });
});
