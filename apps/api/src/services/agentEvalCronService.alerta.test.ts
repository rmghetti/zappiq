/**
 * agentEvalCronService.alerta.test.ts — A047
 * ============================================================================
 * O alerta do Slack disparava por nota absoluta (< 90) ou 1 crítico. Como
 * toda organização de teste ficava abaixo de 90, a mesma falha estrutural
 * alertava todo dia: 13 mensagens numa única segunda, e o time parou de ler.
 *
 * O critério novo é "aconteceu algo que exige ação":
 *   ✓ um cenário CRÍTICO reprovou; ou
 *   ✓ o MESMO cenário reprovou nas duas últimas execuções concluídas.
 *
 * Nota baixa sozinha não alerta mais: ela aparece no painel, que é o lugar
 * dela.
 * ============================================================================
 */
import { describe, it, expect, vi } from 'vitest';

vi.mock('@zappiq/database', () => ({ prisma: {} }));
vi.mock('../utils/logger.js', () => ({
  logger: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

const { shouldAlertQuality, scenariosFailingTwice } = await import('./agentEvalCronService.js');

function resultado(scenarioId: string, combined: string) {
  return { scenarioId, combined, category: 'core', severity: 'high' };
}

describe('shouldAlertQuality — quando o Slack merece ser incomodado', () => {
  it('nota 80 sem crítico e sem repetição NÃO alerta', () => {
    expect(shouldAlertQuality({ scorePercent: 80, criticalFailed: 0 }, { repetidos: [] })).toBe(
      false,
    );
  });

  it('nota 80 sem contexto de repetição também não alerta', () => {
    expect(shouldAlertQuality({ scorePercent: 80, criticalFailed: 0 })).toBe(false);
  });

  it('um cenário crítico reprovado alerta, mesmo com nota alta', () => {
    expect(shouldAlertQuality({ scorePercent: 96, criticalFailed: 1 })).toBe(true);
  });

  it('o mesmo cenário reprovando duas vezes alerta, mesmo sem crítico', () => {
    expect(
      shouldAlertQuality({ scorePercent: 88, criticalFailed: 0 }, { repetidos: ['cr3_preco'] }),
    ).toBe(true);
  });

  // ── P56: o alerta NUNCA é pela nota ───────────────────────────────
  // Com o prompt parado, o Tauã varia 10,4 pontos entre execuções
  // consecutivas (desvio 7,9) e os STAGING variam 7,7. Alertar por "caiu 5
  // pontos" é alertar por ruído. A régua é crítico reprovado ou o MESMO
  // cenário falhando duas vezes seguidas, e este bloco existe para que
  // ninguém reintroduza o limiar de nota sem quebrar o CI.
  it('queda grande de nota, sozinha, NÃO alerta', () => {
    for (const scorePercent of [89, 70, 50, 20, 0]) {
      expect(
        shouldAlertQuality({ scorePercent, criticalFailed: 0 }, { repetidos: [] }),
        `nota ${scorePercent} não pode alertar sozinha`,
      ).toBe(false);
    }
  });

  it('a decisão não olha a nota: mesma entrada, notas opostas, mesmo veredito', () => {
    const comCritico = (scorePercent: number) =>
      shouldAlertQuality({ scorePercent, criticalFailed: 1 }, { repetidos: [] });
    const semNada = (scorePercent: number) =>
      shouldAlertQuality({ scorePercent, criticalFailed: 0 }, { repetidos: [] });

    expect(comCritico(100)).toBe(comCritico(0));
    expect(semNada(100)).toBe(semNada(0));
  });

  it('execução impecável não alerta', () => {
    expect(shouldAlertQuality({ scorePercent: 100, criticalFailed: 0 }, { repetidos: [] })).toBe(
      false,
    );
  });
});

describe('scenariosFailingTwice — o mesmo defeito na segunda execução seguida', () => {
  it('devolve só o cenário que reprovou nas DUAS execuções', () => {
    const anterior = [resultado('a', 'fail'), resultado('b', 'fail'), resultado('c', 'pass')];
    const atual = [resultado('a', 'fail'), resultado('b', 'pass'), resultado('c', 'fail')];

    expect(scenariosFailingTwice(atual, anterior)).toEqual(['a']);
  });

  it('parcial não conta como reprovação repetida', () => {
    const anterior = [resultado('a', 'partial')];
    const atual = [resultado('a', 'fail')];

    expect(scenariosFailingTwice(atual, anterior)).toEqual([]);
  });

  it('sem execução anterior (primeira vez do agente) não há repetição', () => {
    const atual = [resultado('a', 'fail')];

    expect(scenariosFailingTwice(atual, null)).toEqual([]);
    expect(scenariosFailingTwice(atual, undefined)).toEqual([]);
    expect(scenariosFailingTwice(atual, [])).toEqual([]);
  });

  it('aguenta results fora de formato sem quebrar o ciclo', () => {
    expect(scenariosFailingTwice('nao é json de results' as any, [resultado('a', 'fail')])).toEqual(
      [],
    );
    expect(scenariosFailingTwice([{ semId: true } as any], [{ semId: true } as any])).toEqual([]);
  });
});
