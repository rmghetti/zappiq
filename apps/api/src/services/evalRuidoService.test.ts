/* ══════════════════════════════════════════════════════════════════════
 * P56 item 4 — piso de ruído por agente
 * --------------------------------------------------------------------
 * Com o prompt PARADO desde 14/07, o Tauã varia em média 10,4 pontos entre
 * execuções consecutivas (desvio 7,9; de 63 a 88) e os agentes STAGING variam
 * 7,7 (desvio 7,4). Com 17 cenários e uma amostra, o piso de ruído é da ordem
 * de 24 pontos.
 *
 * Isso quer dizer que "caiu 5 pontos" não é queda: é o mesmo agente, medido
 * duas vezes. Alertar por isso, ou dizer ao cliente que ele piorou, é ler
 * ruído como sinal.
 * ══════════════════════════════════════════════════════════════════════ */
import { describe, it, expect, vi, beforeEach } from 'vitest';

const prismaMock: any = {
  agentPromptVersion: { findFirst: vi.fn() },
  agentEvalRun: { findMany: vi.fn() },
};

vi.mock('@zappiq/database', () => ({ prisma: prismaMock }));
vi.mock('../utils/logger.js', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

const { pisoDeRuido, classificarMudanca, carregarRuidoDoAgente } = await import(
  './evalRuidoService.js'
);
const { HARNESS_VERSION } = await import('../agents/agentEvalSet.js');

beforeEach(() => vi.clearAllMocks());

describe('pisoDeRuido', () => {
  it('calcula o desvio das notas com prompt constante', () => {
    // As oito execuções do Tauã, de 63 a 88.
    const r = pisoDeRuido([63, 88, 75, 81, 70, 84, 72, 79]);
    expect(r.n).toBe(8);
    expect(r.desvio).toBeGreaterThan(6);
    expect(r.desvio).toBeLessThan(10);
  });

  it('nota sempre igual tem desvio zero', () => {
    expect(pisoDeRuido([80, 80, 80])).toEqual({ desvio: 0, n: 3 });
  });

  it('devolve o n junto do desvio: é ele que diz o quanto confiar', () => {
    // Com duas execuções o desvio existe, mas não significa nada. Quem barra
    // a conclusão é classificarMudanca, pelo MINIMO_DE_EXECUCOES.
    expect(pisoDeRuido([80, 70])).toEqual({ desvio: 5, n: 2 });
    expect(pisoDeRuido([])).toEqual({ desvio: 0, n: 0 });
  });

  it('ignora nota ausente em vez de contar como zero', () => {
    const r = pisoDeRuido([80, null as any, 80, undefined as any, 80]);
    expect(r.n).toBe(3);
    expect(r.desvio).toBe(0);
  });
});

describe('classificarMudanca — o que o cliente leigo lê', () => {
  const ruidoTipico = { desvio: 8, n: 8 };

  it('sem execução anterior, não há o que comparar', () => {
    const r = classificarMudanca({ nota: 80, notaAnterior: null, ruido: ruidoTipico });
    expect(r.estado).toBe('sem_base');
  });

  it('com menos de três execuções, ainda não dá para dizer', () => {
    const r = classificarMudanca({ nota: 90, notaAnterior: 60, ruido: { desvio: 0, n: 2 } });
    expect(r.estado).toBe('sem_base');
    expect(r.explicacao).toMatch(/ainda/i);
  });

  it('queda dentro do ruído é ESTÁVEL, não piora', () => {
    // 5 pontos abaixo, com desvio de 8: é a mesma nota medida duas vezes.
    const r = classificarMudanca({ nota: 75, notaAnterior: 80, ruido: ruidoTipico });
    expect(r.estado).toBe('estavel');
    expect(r.explicacao).toMatch(/variação normal/i);
  });

  it('subida dentro do ruído também é ESTÁVEL', () => {
    expect(classificarMudanca({ nota: 86, notaAnterior: 80, ruido: ruidoTipico }).estado).toBe(
      'estavel',
    );
  });

  it('subida fora do ruído é melhora de verdade', () => {
    const r = classificarMudanca({ nota: 97, notaAnterior: 60, ruido: ruidoTipico });
    expect(r.estado).toBe('melhorou');
    expect(r.explicacao).toMatch(/melhor/i);
  });

  it('queda fora do ruído é piora de verdade', () => {
    const r = classificarMudanca({ nota: 40, notaAnterior: 85, ruido: ruidoTipico });
    expect(r.estado).toBe('piorou');
  });

  it('agente muito estável detecta mudança menor', () => {
    // Desvio 1: uma queda de 6 pontos já está fora da faixa.
    const r = classificarMudanca({ nota: 74, notaAnterior: 80, ruido: { desvio: 1, n: 10 } });
    expect(r.estado).toBe('piorou');
  });

  it('nunca mostra o número da faixa na explicação do cliente', () => {
    for (const caso of [
      { nota: 75, notaAnterior: 80 },
      { nota: 97, notaAnterior: 60 },
      { nota: 40, notaAnterior: 85 },
    ]) {
      const r = classificarMudanca({ ...caso, notaAnterior: caso.notaAnterior, ruido: ruidoTipico });
      expect(r.explicacao).not.toMatch(/\d/);
    }
  });
});

describe('carregarRuidoDoAgente', () => {
  it('conta só as execuções desde a última mudança de prompt', async () => {
    const trocaDoPrompt = new Date('2026-08-01T00:00:00Z');
    prismaMock.agentPromptVersion.findFirst.mockResolvedValue({ createdAt: trocaDoPrompt });
    prismaMock.agentEvalRun.findMany.mockResolvedValue([
      { scorePercent: 80 },
      { scorePercent: 72 },
      { scorePercent: 88 },
    ]);

    const r = await carregarRuidoDoAgente('agente-1');

    const where = prismaMock.agentEvalRun.findMany.mock.calls[0][0].where;
    expect(where.agentId).toBe('agente-1');
    expect(where.status).toBe('completed');
    expect(where.startedAt.gte).toEqual(trocaDoPrompt);
    expect(r.n).toBe(3);
  });

  it('sem versão de prompt registrada, usa o que houver', async () => {
    prismaMock.agentPromptVersion.findFirst.mockResolvedValue(null);
    prismaMock.agentEvalRun.findMany.mockResolvedValue([{ scorePercent: 90 }]);
    const r = await carregarRuidoDoAgente('agente-1');
    expect(r.n).toBe(1);
  });

  it('banco fora não derruba a tela: devolve piso vazio', async () => {
    prismaMock.agentPromptVersion.findFirst.mockRejectedValue(new Error('down'));
    const r = await carregarRuidoDoAgente('agente-1');
    expect(r).toEqual({ desvio: 0, n: 0 });
  });

  /* Revisão do PR: o piso de ruído mede a oscilação do MESMO agente sob a
   * MESMA régua. Misturar nota de régua v2 com nota de régua v3 mede a troca
   * da régua, não o agente, e infla o piso justamente quando ele é usado para
   * dizer ao cliente se a IA mudou de verdade. */
  it('prefere as execuções medidas com a régua atual', async () => {
    prismaMock.agentPromptVersion.findFirst.mockResolvedValue(null);
    prismaMock.agentEvalRun.findMany.mockResolvedValue([
      { scorePercent: 80 },
      { scorePercent: 72 },
      { scorePercent: 88 },
    ]);

    await carregarRuidoDoAgente('agente-1');

    const where = prismaMock.agentEvalRun.findMany.mock.calls[0][0].where;
    expect(where.harnessVersion).toBe(HARNESS_VERSION);
  });

  it('sem execução suficiente na régua atual, cai para o que houver', async () => {
    prismaMock.agentPromptVersion.findFirst.mockResolvedValue(null);
    prismaMock.agentEvalRun.findMany
      .mockResolvedValueOnce([{ scorePercent: 80 }]) // só uma na régua nova
      .mockResolvedValueOnce([
        { scorePercent: 80 },
        { scorePercent: 72 },
        { scorePercent: 88 },
      ]);

    const r = await carregarRuidoDoAgente('agente-1');

    expect(prismaMock.agentEvalRun.findMany).toHaveBeenCalledTimes(2);
    const segunda = prismaMock.agentEvalRun.findMany.mock.calls[1][0].where;
    expect(segunda.harnessVersion).toBeUndefined();
    expect(r.n).toBe(3);
  });

  // Rodada 3 do PR #375. O re-teste do cliente nasce 'completed' com nota
  // nula e a régua atual: ocupava vaga no `take: 20` e contava no mínimo
  // para o piso, que então "existia" com uma nota só e nunca caía para o
  // histórico da régua anterior.
  it('o re-teste (nota nula) não ocupa vaga nem conta para o mínimo do piso', async () => {
    prismaMock.agentPromptVersion.findFirst.mockResolvedValue(null);
    const linhas = [
      { scorePercent: null, triggeredBy: 'client_retest', harnessVersion: HARNESS_VERSION },
      { scorePercent: null, triggeredBy: 'client_retest', harnessVersion: HARNESS_VERSION },
      { scorePercent: 80, triggeredBy: 'cron', harnessVersion: HARNESS_VERSION },
      { scorePercent: 80, triggeredBy: 'cron', harnessVersion: HARNESS_VERSION - 1 },
      { scorePercent: 72, triggeredBy: 'cron', harnessVersion: HARNESS_VERSION - 1 },
      { scorePercent: 88, triggeredBy: 'cron', harnessVersion: HARNESS_VERSION - 1 },
    ];
    // O banco falso honra os filtros: sem eles no `where`, o re-teste vem.
    prismaMock.agentEvalRun.findMany.mockImplementation(async ({ where }: any) =>
      linhas
        .filter((l) => where.harnessVersion === undefined || l.harnessVersion === where.harnessVersion)
        .filter((l) => !(where?.triggeredBy?.not && l.triggeredBy === where.triggeredBy.not))
        .filter((l) => !(where?.scorePercent && 'not' in where.scorePercent && where.scorePercent.not === null && l.scorePercent === null))
        .map((l) => ({ scorePercent: l.scorePercent })),
    );

    const r = await carregarRuidoDoAgente('agente-1');

    // Só UMA execução de verdade na régua atual: cai para o histórico inteiro.
    expect(prismaMock.agentEvalRun.findMany).toHaveBeenCalledTimes(2);
    expect(r.n).toBe(4);
    const where = prismaMock.agentEvalRun.findMany.mock.calls[0][0].where;
    expect(where.triggeredBy).toEqual({ not: 'client_retest' });
    expect(where.scorePercent).toEqual({ not: null });
  });

  it('com execuções bastantes na régua atual, não consulta de novo', async () => {
    prismaMock.agentPromptVersion.findFirst.mockResolvedValue(null);
    prismaMock.agentEvalRun.findMany.mockResolvedValue([
      { scorePercent: 80 },
      { scorePercent: 72 },
    ]);

    await carregarRuidoDoAgente('agente-1');

    expect(prismaMock.agentEvalRun.findMany).toHaveBeenCalledTimes(1);
  });
});
