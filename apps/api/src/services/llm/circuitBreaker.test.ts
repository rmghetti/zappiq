/**
 * circuitBreaker.test.ts — Resposta Meta out/2026 (PR-I)
 * ============================================================================
 * Circuit breaker de custo LLM por org:
 *   ✓ recordMonthlyLlmCost: acumula (INCRBYFLOAT) na chave do mês UTC, TTL 40d
 *   ✓ premissaMensalUsd (pura): franquia/25 x R$0,12 x 2 em USD; -1 = null
 *   ✓ evaluateCostBreaker: abaixo do limiar não arma; acima arma
 *     zappiq:ecomode:{org} com TTL 6h e retorna true
 *   ✓ bandeira já armada: true direto, sem nova consulta ao banco
 *   ✓ org da casa (ZappIQ): NUNCA entra em Modo Econômico
 *   ✓ plano ilimitado (aiMessagesPerMonth -1): breaker nunca arma
 *   ✓ fail-soft: erro de banco ou cache fora do ar retornam false
 * ============================================================================
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

const { prismaMock } = vi.hoisted(() => ({
  prismaMock: { organization: { findUnique: vi.fn() } },
}));

vi.mock('@zappiq/database', () => ({ prisma: prismaMock }));

vi.mock('../../utils/logger.js', () => ({
  logger: { warn: vi.fn(), info: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

// ── cache em memória com a MESMA semântica fail-soft do ICache ───────────
const store = new Map<string, string>();
const ttls = new Map<string, number>();
let backendFora = false;

const cacheGet = vi.fn(async (key: string) => (backendFora ? null : (store.get(key) ?? null)));
const cacheSet = vi.fn(async (key: string, value: string, ttlSeconds?: number) => {
  if (backendFora) return false;
  store.set(key, value);
  if (ttlSeconds) ttls.set(key, ttlSeconds);
  return true;
});
const incrbyfloat = vi.fn(async (key: string, amount: number) => {
  if (backendFora) return null;
  const next = parseFloat(store.get(key) ?? '0') + amount;
  store.set(key, String(next));
  return next;
});
const expire = vi.fn(async (key: string, ttlSeconds: number) => {
  if (backendFora) return false;
  ttls.set(key, ttlSeconds);
  return true;
});

vi.mock('../cloud/index.js', () => ({
  cache: {
    get: (...a: unknown[]) => cacheGet(...(a as [string])),
    set: (...a: unknown[]) => cacheSet(...(a as [string, string, number?])),
    del: vi.fn(async () => true),
    incrby: vi.fn(async () => 1),
    incrbyfloat: (...a: unknown[]) => incrbyfloat(...(a as [string, number])),
    expire: (...a: unknown[]) => expire(...(a as [string, number])),
    setNX: vi.fn(async () => true),
    mget: vi.fn(async () => []),
    ping: vi.fn(async () => true),
  },
}));

const { ZAPPIQ_ORG_ID } = await import('../../config/zappiqOrg.js');
const {
  llmCostMonthKey,
  ecoModeKey,
  recordMonthlyLlmCost,
  premissaMensalUsd,
  evaluateCostBreaker,
  LLMCOST_TTL_SECONDS,
  ECOMODE_TTL_SECONDS,
} = await import('./circuitBreaker.js');

// Premissa do STARTER (aiMessagesPerMonth 1500):
//   1500/25 = 60 atendimentos x R$ 0,12 = R$ 7,20 x 2 = R$ 14,40 / 5,40
//   = US$ 2,6666...
const PREMISSA_STARTER_USD = 2.6666666666666665;

beforeEach(() => {
  vi.clearAllMocks();
  store.clear();
  ttls.clear();
  backendFora = false;
  prismaMock.organization.findUnique.mockResolvedValue({ plan: 'STARTER' });
});

describe('llmCostMonthKey — chave do mês UTC', () => {
  it('usa yyyy-mm em UTC', () => {
    const key = llmCostMonthKey('org-1', new Date(Date.UTC(2026, 9, 5)));
    expect(key).toBe('zappiq:llmcost:org-1:2026-10');
  });

  it('vira o mês pela hora UTC (23h59 de 31/10 UTC ainda é 10)', () => {
    const key = llmCostMonthKey('org-1', new Date(Date.UTC(2026, 9, 31, 23, 59, 59)));
    expect(key).toBe('zappiq:llmcost:org-1:2026-10');
  });
});

describe('recordMonthlyLlmCost — acumulador soma', () => {
  it('duas chamadas acumulam via INCRBYFLOAT na mesma chave do mês', async () => {
    await recordMonthlyLlmCost('org-1', 0.018);
    await recordMonthlyLlmCost('org-1', 0.005);

    const key = llmCostMonthKey('org-1');
    expect(incrbyfloat).toHaveBeenCalledTimes(2);
    expect(incrbyfloat).toHaveBeenNthCalledWith(1, key, 0.018);
    expect(incrbyfloat).toHaveBeenNthCalledWith(2, key, 0.005);
    expect(parseFloat(store.get(key)!)).toBeCloseTo(0.023, 9);
  });

  it('seta TTL de 40 dias no acumulador', async () => {
    await recordMonthlyLlmCost('org-1', 0.01);

    expect(ttls.get(llmCostMonthKey('org-1'))).toBe(LLMCOST_TTL_SECONDS);
    expect(LLMCOST_TTL_SECONDS).toBe(40 * 24 * 3600);
  });

  it('sem org ou custo <= 0: não toca o cache', async () => {
    await recordMonthlyLlmCost('', 0.01);
    await recordMonthlyLlmCost('org-1', 0);
    await recordMonthlyLlmCost('org-1', -1);

    expect(incrbyfloat).not.toHaveBeenCalled();
  });

  it('backend fora do ar: não lança e não seta TTL', async () => {
    backendFora = true;

    await expect(recordMonthlyLlmCost('org-1', 0.01)).resolves.toBeUndefined();
    expect(expire).not.toHaveBeenCalled();
  });
});

describe('premissaMensalUsd — função pura', () => {
  it('STARTER (1500 msgs): US$ 2,67 por mês', () => {
    expect(premissaMensalUsd(1500)).toBeCloseTo(PREMISSA_STARTER_USD, 10);
  });

  it('GROWTH (8000 msgs): escala linear', () => {
    // 8000/25 = 320 x 0,12 x 2 / 5,4 = 14,2222...
    expect(premissaMensalUsd(8000)).toBeCloseTo((320 * 0.12 * 2) / 5.4, 10);
  });

  it('-1 (ilimitado), 0 e valores inválidos: null (breaker nunca arma)', () => {
    expect(premissaMensalUsd(-1)).toBeNull();
    expect(premissaMensalUsd(0)).toBeNull();
    expect(premissaMensalUsd(Number.NaN)).toBeNull();
    expect(premissaMensalUsd(null)).toBeNull();
    expect(premissaMensalUsd(undefined)).toBeNull();
  });
});

describe('evaluateCostBreaker — arma e desarma', () => {
  it('gasto abaixo da premissa: false e NÃO seta ecomode', async () => {
    store.set(llmCostMonthKey('org-1'), '2.0'); // < 2,6666

    await expect(evaluateCostBreaker('org-1')).resolves.toBe(false);
    expect(store.has(ecoModeKey('org-1'))).toBe(false);
  });

  it('gasto acima da premissa: true e seta zappiq:ecomode com TTL 6h', async () => {
    store.set(llmCostMonthKey('org-1'), '2.7'); // > 2,6666

    await expect(evaluateCostBreaker('org-1')).resolves.toBe(true);
    expect(store.get(ecoModeKey('org-1'))).toBe('1');
    expect(ttls.get(ecoModeKey('org-1'))).toBe(ECOMODE_TTL_SECONDS);
    expect(ECOMODE_TTL_SECONDS).toBe(6 * 3600);
  });

  it('bandeira já armada: true direto, sem consultar o banco de novo', async () => {
    store.set(ecoModeKey('org-1'), '1');

    await expect(evaluateCostBreaker('org-1')).resolves.toBe(true);
    expect(prismaMock.organization.findUnique).not.toHaveBeenCalled();
  });

  it('sem gasto acumulado no mês: false sem consultar o banco', async () => {
    await expect(evaluateCostBreaker('org-1')).resolves.toBe(false);
    expect(prismaMock.organization.findUnique).not.toHaveBeenCalled();
  });

  it('org da casa (ZappIQ): NUNCA arma, mesmo com gasto altíssimo', async () => {
    store.set(llmCostMonthKey(ZAPPIQ_ORG_ID), '9999');

    await expect(evaluateCostBreaker(ZAPPIQ_ORG_ID)).resolves.toBe(false);
    expect(store.has(ecoModeKey(ZAPPIQ_ORG_ID))).toBe(false);
    expect(prismaMock.organization.findUnique).not.toHaveBeenCalled();
  });

  it('plano ilimitado (ENTERPRISE, -1 msgs): nunca arma', async () => {
    prismaMock.organization.findUnique.mockResolvedValue({ plan: 'ENTERPRISE' });
    store.set(llmCostMonthKey('org-ent'), '9999');

    await expect(evaluateCostBreaker('org-ent')).resolves.toBe(false);
    expect(store.has(ecoModeKey('org-ent'))).toBe(false);
  });

  it('org inexistente ou plano desconhecido: false (fail-soft)', async () => {
    store.set(llmCostMonthKey('org-x'), '9999');
    prismaMock.organization.findUnique.mockResolvedValue(null);
    await expect(evaluateCostBreaker('org-x')).resolves.toBe(false);

    prismaMock.organization.findUnique.mockResolvedValue({ plan: 'PLANO_QUE_NAO_EXISTE' });
    await expect(evaluateCostBreaker('org-x')).resolves.toBe(false);
  });

  it('erro de banco: false, nunca lança', async () => {
    store.set(llmCostMonthKey('org-1'), '9999');
    prismaMock.organization.findUnique.mockRejectedValue(new Error('db off'));

    await expect(evaluateCostBreaker('org-1')).resolves.toBe(false);
  });

  it('cache fora do ar: false (turno normal, nunca degrada por engano)', async () => {
    backendFora = true;

    await expect(evaluateCostBreaker('org-1')).resolves.toBe(false);
  });
});
