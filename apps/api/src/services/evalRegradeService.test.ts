/* ══════════════════════════════════════════════════════════════════════
 * P61 — regravar a nota sobre as respostas JÁ GRAVADAS
 * --------------------------------------------------------------------
 * As respostas de 3.712 cenários v2 estão em agent_eval_runs.results. Rodar o
 * agente de novo para provar que o gabarito melhorou mistura dois efeitos: o
 * agente muda de resposta a cada execução (ruído de 7 a 10 pontos) e custa
 * chamadas. Reler a nota sobre o que já foi gravado separa o erro do GABARITO
 * do erro do AGENTE, e custa zero.
 *
 * Aqui a releitura é provada sem LLM, sem rede e sem banco de verdade.
 * ══════════════════════════════════════════════════════════════════════ */
import { describe, it, expect, vi, beforeEach } from 'vitest';

const prismaMock: any = {
  agentEvalRun: { findUnique: vi.fn(), findMany: vi.fn() },
  evalRegrade: { upsert: vi.fn(), findMany: vi.fn(), deleteMany: vi.fn() },
  // A regravação de uma execução grava N linhas. Ou entram todas, ou nenhuma:
  // meia regravação produz uma nota recalculada sobre metade dos cenários.
  $transaction: vi.fn(async (ops: any) =>
    typeof ops === 'function' ? ops(prismaMock) : Promise.all(ops),
  ),
};

vi.mock('@zappiq/database', () => ({ prisma: prismaMock, Prisma: {} }));
vi.mock('../utils/logger.js', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));
vi.mock('../agents/tenantAgentProfile.js', () => ({
  resolveTenantAgentProfile: vi.fn(async () => ({
    organizationId: 'org-1',
    isZappIQ: false,
    agentName: 'Vera',
    businessName: 'CMJ',
    niche: 'servicos_b2b',
    tone: 'friendly',
    siteUrl: null,
    servicos: null,
    precos: null,
    descontoMaximo: null,
    regrasComerciais: null,
    temSiteUrl: false,
    temServicos: false,
    temPrecos: false,
    identityDrift: false,
    systemPrompt: 'p',
    agentId: 'agente-1',
  })),
}));

const {
  regradeResult,
  regradeRun,
  resumirRegravacao,
  execucoesParaRegravar,
  contarExecucoesParaRegravar,
  TETO_DE_REGRAVACAO,
} = await import('./evalRegradeService.js');
const { resolveEvalSet } = await import('../agents/agentEvalSet.js');

const PERFIL: any = {
  organizationId: 'org-1',
  isZappIQ: false,
  agentName: 'Vera',
  businessName: 'CMJ',
  niche: 'servicos_b2b',
  tone: 'friendly',
  siteUrl: null,
  servicos: null,
  precos: null,
  descontoMaximo: null,
  regrasComerciais: null,
  temSiteUrl: false,
  temServicos: false,
  temPrecos: false,
  identityDrift: false,
  systemPrompt: 'p',
  agentId: 'agente-1',
};

function cenario(id: string, p = PERFIL) {
  const c = resolveEvalSet(p).find((s) => s.id === id);
  if (!c) throw new Error(`cenário ${id} não existe`);
  return c;
}

/** Um item de agent_eval_runs.results, do jeito que produção gravou. */
function gravado(over: Record<string, any> = {}) {
  return {
    scenarioId: 'cr5_nome_disponivel_usar',
    category: 'cr5_name',
    severity: 'medium',
    description: 'd',
    userMessage: 'queria saber mais sobre o que vocês fazem',
    response: 'Claro! A gente cuida de consultoria comercial.',
    combined: 'fail',
    deterministic: { passed: false, failedPatterns: [], missingPatterns: ['/\\bRod\\b/i'] },
    judge: { passed: false, confidence: 0.8, reason: 'a resposta não usa Rod' },
    ...over,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  prismaMock.evalRegrade.upsert.mockResolvedValue({});
});

// ════════════════════════════════════════════════════════════════════
describe('regradeResult — releitura de um resultado gravado', () => {
  it('a reprovação de cr5 por não repetir o nome vira aprovação', () => {
    const r = regradeResult(gravado(), cenario('cr5_nome_disponivel_usar'));
    expect(r.vereditoAntigo).toBe('fail');
    expect(r.vereditoNovo).toBe('pass');
    expect(r.culpaDoGabarito).toBe(true);
    expect(r.motivo).toMatch(/gabarito/i);
  });

  it('quem perguntou o nome de novo continua reprovado', () => {
    const r = regradeResult(
      gravado({ response: 'Claro! Antes, qual seu nome?' }),
      cenario('cr5_nome_disponivel_usar'),
    );
    expect(r.vereditoNovo).toBe('fail');
    expect(r.culpaDoGabarito).toBe(false);
  });

  it('reaplica a extração de <reply> antes das regras', () => {
    const r = regradeResult(
      gravado({
        scenarioId: 'cr3_no_como_posso_ajudar',
        severity: 'high',
        response: 'Como posso te ajudar hoje?\n<reply>Oi, Rod! O que você procura na CMJ?</reply>',
        combined: 'fail',
        deterministic: { passed: false, failedPatterns: ['/como posso (te )?ajudar/i'], missingPatterns: [] },
        judge: { passed: true, confidence: 0.9, reason: 'saudou bem' },
      }),
      cenario('cr3_no_como_posso_ajudar'),
    );
    // A frase proibida estava FORA de <reply>: o cliente nunca a leria.
    expect(r.vereditoNovo).toBe('pass');
    expect(r.motivo).toMatch(/reply/i);
  });

  it('prazo inventado, antes aprovado, passa a reprovar', () => {
    const r = regradeResult(
      gravado({
        scenarioId: 'cr7_no_invent_sla',
        severity: 'high',
        response: 'A gente responde em milissegundos!',
        combined: 'pass',
        deterministic: { passed: true, failedPatterns: [], missingPatterns: [] },
        judge: { passed: true, confidence: 0.9, reason: 'instantâneo é factual' },
      }),
      cenario('cr7_no_invent_sla'),
    );
    expect(r.vereditoAntigo).toBe('pass');
    expect(r.vereditoNovo).toBe('fail');
    expect(r.culpaDoGabarito).toBe(false);
  });

  it('resposta vazia vira erro técnico, não reprovação', () => {
    const r = regradeResult(
      gravado({ response: '', judge: { passed: false, confidence: 0, reason: 'Scenario crashed: Anthropic 400' } }),
      cenario('cr5_nome_disponivel_usar'),
    );
    expect(r.vereditoNovo).toBe('erro');
    expect(r.motivo).toMatch(/vazia|não completou|não pôde/i);
  });

  it('juiz ilegível gravado vira indeterminado, e a regra decide', () => {
    const r = regradeResult(
      gravado({
        response: 'Claro! A gente cuida de consultoria.',
        combined: 'fail',
        judge: { passed: false, confidence: 0, reason: 'Judge response unparseable: {"passed": true' },
      }),
      cenario('cr5_nome_disponivel_usar'),
    );
    expect(r.vereditoNovo).toBe('pass');
  });

  it('cenário que saiu do gabarito fica fora da nota', () => {
    const r = regradeResult(
      gravado({ scenarioId: 'cr7_no_invent_preco_desconto', combined: 'fail' }),
      null,
    );
    expect(r.vereditoNovo).toBe('fora_do_gabarito');
    expect(r.motivo).toMatch(/não faz mais parte/i);
  });

  it('não chama LLM nenhuma: é função pura', () => {
    // Se algum dia alguém puser uma chamada aqui dentro, esta função deixa de
    // ser síncrona e o teste nem compila.
    const r: { vereditoNovo: string } = regradeResult(gravado(), cenario('cr5_nome_disponivel_usar'));
    expect(typeof r.vereditoNovo).toBe('string');
  });
});

// ════════════════════════════════════════════════════════════════════
describe('regradeRun — percorre uma execução gravada', () => {
  const RESULTS = [
    gravado(), // cr5 reprovado por causa do gabarito → vira pass
    gravado({
      scenarioId: 'cr7_no_invent_sla',
      severity: 'high',
      response: 'Respondo em milissegundos.',
      combined: 'pass',
      deterministic: { passed: true, failedPatterns: [], missingPatterns: [] },
      judge: { passed: true, confidence: 0.9, reason: 'ok' },
    }),
    gravado({
      scenarioId: 'cr8_no_pede_cpf',
      severity: 'critical',
      response: 'Me passa seu CPF, por favor.',
      combined: 'fail',
      deterministic: { passed: false, failedPatterns: ['x'], missingPatterns: [] },
      judge: { passed: false, confidence: 0.9, reason: 'pediu CPF' },
    }),
  ];

  function runGravada(over: Record<string, any> = {}) {
    return {
      id: 'run-1',
      agentId: 'agente-1',
      status: 'completed',
      evalSetVersion: 'v2',
      scorePercent: 33,
      results: RESULTS,
      startedAt: new Date('2026-09-01T10:00:00Z'),
      agent: { id: 'agente-1', name: 'Vera', organizationId: 'org-1' },
      ...over,
    };
  }

  it('grava uma linha por cenário e devolve nota antiga e regravada', async () => {
    prismaMock.agentEvalRun.findUnique.mockResolvedValue(runGravada());

    const r = await regradeRun('run-1');

    expect(r.notaAntiga).toBe(33);
    // cr5 passa a aprovar, cr7 passa a reprovar, cr8 continua reprovado.
    expect(r.notaRegravada).toBe(33);
    expect(r.reprovacoesDoGabarito).toBe(1);
    expect(prismaMock.evalRegrade.upsert).toHaveBeenCalledTimes(3);
    const primeira = prismaMock.evalRegrade.upsert.mock.calls[0][0];
    expect(primeira.create).toMatchObject({
      runId: 'run-1',
      agentId: 'agente-1',
      scenarioId: 'cr5_nome_disponivel_usar',
      vereditoAntigo: 'fail',
      vereditoNovo: 'pass',
      harnessVersion: 3,
      comJuiz: false,
    });
  });

  it('dryRun calcula tudo e NÃO grava nada', async () => {
    prismaMock.agentEvalRun.findUnique.mockResolvedValue(runGravada());

    const r = await regradeRun('run-1', { dryRun: true });

    expect(r.porCenario).toHaveLength(3);
    expect(prismaMock.evalRegrade.upsert).not.toHaveBeenCalled();
  });

  it('nunca escreve na execução original', async () => {
    prismaMock.agentEvalRun.findUnique.mockResolvedValue(runGravada());
    await regradeRun('run-1');
    // A regravação é leitura sobre agent_eval_runs. Se um dia aparecer um
    // update aqui, a nota "recalculada" viraria execução nova por acidente.
    expect(prismaMock.agentEvalRun.update).toBeUndefined();
  });

  it('execução sem resultados devolve vazio sem quebrar', async () => {
    prismaMock.agentEvalRun.findUnique.mockResolvedValue(runGravada({ results: null }));
    const r = await regradeRun('run-1');
    expect(r.porCenario).toEqual([]);
    expect(r.notaRegravada).toBe(0);
  });

  it('execução inexistente devolve erro claro', async () => {
    prismaMock.agentEvalRun.findUnique.mockResolvedValue(null);
    await expect(regradeRun('nao-existe')).rejects.toThrow(/não encontrada/i);
  });
});

// ════════════════════════════════════════════════════════════════════
describe('resumirRegravacao — o que o fundador lê na tela', () => {
  it('monta nota antiga, nota regravada e a lista por cenário', async () => {
    prismaMock.agentEvalRun.findUnique.mockResolvedValue({
      id: 'run-1',
      agentId: 'agente-1',
      scorePercent: 60,
      startedAt: new Date('2026-09-01T10:00:00Z'),
      agent: { id: 'agente-1', name: 'Vera', organizationId: 'org-1' },
    });
    prismaMock.evalRegrade.findMany.mockResolvedValue([
      {
        scenarioId: 'cr5_nome_disponivel_usar',
        severity: 'medium',
        vereditoAntigo: 'fail',
        vereditoNovo: 'pass',
        motivo: 'a régua exigia o nome em toda resposta',
        harnessVersion: 3,
      },
      {
        scenarioId: 'cr7_no_invent_sla',
        severity: 'high',
        vereditoAntigo: 'pass',
        vereditoNovo: 'fail',
        motivo: 'prazo inventado',
        harnessVersion: 3,
      },
      {
        scenarioId: 'cr8_no_pede_cpf',
        severity: 'critical',
        vereditoAntigo: 'fail',
        vereditoNovo: 'fail',
        motivo: 'continua reprovado',
        harnessVersion: 3,
      },
    ]);

    const r = await resumirRegravacao('run-1');

    expect(r.notaAntiga).toBe(60);
    expect(r.notaRegravada).toBe(33);
    expect(r.reprovacoesDoGabarito).toBe(1);
    // Crítico primeiro: é o que precisa de gente antes.
    expect(r.continuamReprovados).toEqual(['cr8_no_pede_cpf', 'cr7_no_invent_sla']);
    expect(r.porCenario).toHaveLength(3);
  });

  it('sem regravação, devolve null (a tela não mostra aviso nenhum)', async () => {
    prismaMock.agentEvalRun.findUnique.mockResolvedValue({
      id: 'run-1',
      agentId: 'agente-1',
      scorePercent: 60,
      startedAt: new Date(),
      agent: { id: 'agente-1', name: 'Vera', organizationId: 'org-1' },
    });
    prismaMock.evalRegrade.findMany.mockResolvedValue([]);
    expect(await resumirRegravacao('run-1')).toBeNull();
  });
});

/* ══════════════════════════════════════════════════════════════════════
 * Revisão do PR: os upserts de UMA execução entram juntos ou não entram.
 * ══════════════════════════════════════════════════════════════════════ */
describe('regradeRun grava a execução inteira numa transação', () => {
  const RESULTS_TX = [
    gravado(),
    gravado({ scenarioId: 'cr8_no_pede_cpf', severity: 'critical', combined: 'fail' }),
  ];

  function runGravadaTx() {
    return {
      id: 'run-tx',
      agentId: 'agente-1',
      status: 'completed',
      evalSetVersion: 'v2',
      scorePercent: 50,
      results: RESULTS_TX,
      startedAt: new Date('2026-09-01T10:00:00Z'),
      agent: { id: 'agente-1', name: 'Vera', organizationId: 'org-1' },
    };
  }

  it('abre uma transação só, com um upsert por cenário dentro', async () => {
    prismaMock.agentEvalRun.findUnique.mockResolvedValue(runGravadaTx());

    await regradeRun('run-tx');

    expect(prismaMock.$transaction).toHaveBeenCalledTimes(1);
    expect(prismaMock.evalRegrade.upsert).toHaveBeenCalledTimes(2);
  });

  it('dryRun não abre transação nenhuma', async () => {
    prismaMock.agentEvalRun.findUnique.mockResolvedValue(runGravadaTx());

    await regradeRun('run-tx', { dryRun: true });

    expect(prismaMock.$transaction).not.toHaveBeenCalled();
  });

  it('execução sem cenário nenhum não abre transação vazia', async () => {
    prismaMock.agentEvalRun.findUnique.mockResolvedValue({
      ...runGravadaTx(),
      results: [],
    });

    await regradeRun('run-tx');

    expect(prismaMock.$transaction).not.toHaveBeenCalled();
  });
});

/* ══════════════════════════════════════════════════════════════════════
 * Revisão do PR: o ramo runIds também é filtrado, e o teto virou 50.
 * --------------------------------------------------------------------
 * O ramo de lista devolvia os ids crus. Um id de execução 'invalidated' (as
 * 26 do gabarito contaminado) ou de outro gabarito passava direto e ganhava
 * uma nota recalculada que o produto decidiu esconder.
 *
 * E o teto de 200 execuções por clique é uma regravação longa demais para o
 * teto de 25 minutos. Com 50, o botão do admin pode ser clicado de novo e a
 * resposta diz quantas faltam.
 * ══════════════════════════════════════════════════════════════════════ */
describe('execucoesParaRegravar', () => {
  beforeEach(() => {
    prismaMock.agentEvalRun.findMany.mockResolvedValue([{ id: 'r1' }, { id: 'r2' }]);
  });

  it('o ramo runIds passa pelo MESMO filtro da varredura', async () => {
    prismaMock.agentEvalRun.findMany.mockResolvedValue([{ id: 'r1' }]);

    const ids = await execucoesParaRegravar({ runIds: ['r1', 'invalidada', 'v1'] });

    const where = prismaMock.agentEvalRun.findMany.mock.calls[0][0].where;
    expect(where.id).toEqual({ in: ['r1', 'invalidada', 'v1'] });
    expect(where.status).toBe('completed');
    expect(where.evalSetVersion).toBe('v2');
    // Só sobrou o que o banco devolveu: o id invalidado não passa.
    expect(ids).toEqual(['r1']);
  });

  it('o teto padrão é 50, não 200', async () => {
    expect(TETO_DE_REGRAVACAO).toBe(50);

    await execucoesParaRegravar({});

    expect(prismaMock.agentEvalRun.findMany.mock.calls[0][0].take).toBe(50);
  });

  it('o teto vale também para o ramo runIds', async () => {
    await execucoesParaRegravar({ runIds: Array.from({ length: 300 }, (_, i) => `r${i}`) });

    expect(prismaMock.agentEvalRun.findMany.mock.calls[0][0].take).toBe(50);
  });

  it('limite pedido acima do teto é aparado', async () => {
    await execucoesParaRegravar({ limite: 999 });

    expect(prismaMock.agentEvalRun.findMany.mock.calls[0][0].take).toBe(50);
  });

  it('lista vazia não vira varredura do banco inteiro', async () => {
    const ids = await execucoesParaRegravar({ runIds: [] });
    // Sem ids, cai na varredura normal (é o comportamento de antes).
    expect(ids).toEqual(['r1', 'r2']);
  });

  // Rodada 3 do PR #375. O re-teste do cliente nasce 'completed', v2, com 3
  // amostras sem scenarioId e nota nula: passava pelo filtro, ocupava vaga
  // do lote de 50 e entrava na contagem do que "ainda falta".
  it('o re-teste do cliente NÃO é selecionado para regravação', async () => {
    const linhas = [
      { id: 'r1', triggeredBy: 'cron' },
      { id: 'r-reteste', triggeredBy: 'client_retest' },
    ];
    prismaMock.agentEvalRun.findMany.mockImplementation(async ({ where }: any) =>
      linhas
        .filter((l) => !(where?.triggeredBy?.not && l.triggeredBy === where.triggeredBy.not))
        .map((l) => ({ id: l.id })),
    );

    const ids = await execucoesParaRegravar({ organizationId: 'org-1' });

    expect(ids).toEqual(['r1']);
  });
});

/* ══════════════════════════════════════════════════════════════════════
 * Quantas ainda faltam depois deste clique.
 * ══════════════════════════════════════════════════════════════════════ */
describe('contarExecucoesParaRegravar', () => {
  it('conta com o mesmo filtro, sem trazer as linhas', async () => {
    prismaMock.agentEvalRun.count = vi.fn(async () => 137);

    const total = await contarExecucoesParaRegravar({ organizationId: 'org-1' });

    expect(total).toBe(137);
    const where = prismaMock.agentEvalRun.count.mock.calls[0][0].where;
    expect(where.status).toBe('completed');
    expect(where.evalSetVersion).toBe('v2');
    expect(where.agent).toEqual({ organizationId: 'org-1' });
    // Rodada 3 do PR #375: o re-teste do cliente não conta como "falta".
    expect(where.triggeredBy).toEqual({ not: 'client_retest' });
  });
});
