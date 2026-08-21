/**
 * planLimits.trialCap.test.ts — Resposta Meta out/2026 (PR-E)
 * ============================================================================
 * Regime de custo do TRIAL/NOVO revivido:
 *   ✓ decideLlmCostStage (pura): TRIAL, NOVO, org pagante e expirado
 *   ✓ getTrialLlmStage: cache de 5 min, isenção da org ZappIQ, fail-soft
 *   ✓ assertTrialCostCap: bloqueia acima do teto, libera org pagante,
 *     acumula via recordTrialCost (incrbyfloat), fail-soft em erro
 *   ✓ consumeTrialContactReplyBudget: 30 passam, a 31ª na mesma hora bloqueia
 *   ✓ consumeWebChatOrgReplyBudget: 300 passam, a 301ª bloqueia
 *   ✓ backend de cache fora do ar: tudo libera (nunca trava cliente)
 * ============================================================================
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../config/env.js', () => ({
  env: { QUOTA_OVERAGE_MODE: 'audit_only', RESOURCE_LIMITS_MODE: 'audit_only' },
}));

const { prismaMock } = vi.hoisted(() => ({
  prismaMock: { organization: { findUnique: vi.fn() } },
}));

vi.mock('@zappiq/database', () => ({ prisma: prismaMock }));

vi.mock('../services/quotaOverageService.js', () => ({
  reportOverageMeterEvent: vi.fn(async () => ({ reported: false, skipped: 'mode_audit_only' })),
  estimateOverageBrl: (n: number) => n * 0.03,
}));

vi.mock('../utils/logger.js', () => ({
  logger: { warn: vi.fn(), info: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

// ── cache em memória com a MESMA semântica fail-soft do ICache ───────────
const store = new Map<string, string>();
let backendFora = false;

const incrby = vi.fn(async (key: string, amount = 1) => {
  if (backendFora) return null;
  const next = parseInt(store.get(key) ?? '0', 10) + amount;
  store.set(key, String(next));
  return next;
});
const incrbyfloat = vi.fn(async (key: string, amount: number) => {
  if (backendFora) return null;
  const next = parseFloat(store.get(key) ?? '0') + amount;
  store.set(key, String(next));
  return next;
});
const cacheGet = vi.fn(async (key: string) => (backendFora ? null : (store.get(key) ?? null)));
const cacheSet = vi.fn(async (key: string, value: string) => {
  if (backendFora) return false;
  store.set(key, value);
  return true;
});
const expire = vi.fn(async () => !backendFora);

vi.mock('../services/cloud/index.js', () => ({
  cache: {
    incrby: (...a: any[]) => incrby(...(a as [string, number])),
    incrbyfloat: (...a: any[]) => incrbyfloat(...(a as [string, number])),
    get: (...a: any[]) => cacheGet(...(a as [string])),
    set: (...a: any[]) => cacheSet(...(a as [string, string])),
    expire: (...a: any[]) => expire(...(a as [string, number])),
    setNX: vi.fn(async () => true),
    del: vi.fn(async () => true),
    mget: vi.fn(async () => []),
    ping: vi.fn(async () => true),
  },
}));

const {
  decideLlmCostStage,
  getTrialLlmStage,
  assertTrialCostCap,
  recordTrialCost,
  consumeTrialContactReplyBudget,
  consumeWebChatOrgReplyBudget,
  TRIAL_CONTACT_REPLIES_PER_HOUR,
  WEBCHAT_ORG_REPLIES_PER_HOUR,
} = await import('./planLimits.js');
const { ZAPPIQ_ORG_ID } = await import('../config/zappiqOrg.js');

const DIA = 24 * 3600 * 1000;

/** Org em TRIAL com janela aberta (7 dias pra frente). */
function orgTrial(overrides: Record<string, unknown> = {}) {
  return {
    trialStartedAt: new Date(Date.now() - 3 * DIA),
    trialEndsAt: new Date(Date.now() + 7 * DIA),
    isTrialActive: true,
    trialConverted: false,
    stripeSubscriptionId: null,
    trialCostCapUsd: 15,
    ...overrides,
  };
}

/** Org NOVA: nunca iniciou trial, sem assinatura. */
function orgNova(overrides: Record<string, unknown> = {}) {
  return {
    trialStartedAt: null,
    trialEndsAt: null,
    isTrialActive: true,
    trialConverted: false,
    stripeSubscriptionId: null,
    trialCostCapUsd: 15,
    ...overrides,
  };
}

/** Org PAGANTE: assinatura Stripe real. */
function orgPaga(overrides: Record<string, unknown> = {}) {
  return {
    trialStartedAt: new Date(Date.now() - 40 * DIA),
    trialEndsAt: new Date(Date.now() - 26 * DIA),
    isTrialActive: false,
    trialConverted: true,
    stripeSubscriptionId: 'sub_123',
    trialCostCapUsd: 15,
    ...overrides,
  };
}

beforeEach(() => {
  store.clear();
  backendFora = false;
  vi.clearAllMocks();
});

describe('decideLlmCostStage (pura)', () => {
  it('org com trial na janela aberta: TRIAL', () => {
    expect(decideLlmCostStage(orgTrial())).toBe('TRIAL');
  });

  it('org que nunca iniciou trial e sem assinatura: NOVO', () => {
    expect(decideLlmCostStage(orgNova())).toBe('NOVO');
  });

  it('org com assinatura Stripe: OTHER, mesmo com flags de trial ligadas', () => {
    expect(decideLlmCostStage(orgPaga())).toBe('OTHER');
    // Mesmo que o seed tenha deixado isTrialActive=true com janela aberta,
    // a presença de stripeSubscriptionId vence: conta pagante não entra.
    expect(
      decideLlmCostStage(orgTrial({ stripeSubscriptionId: 'sub_real' })),
    ).toBe('OTHER');
  });

  it('trial expirado (já tem paywall próprio): OTHER', () => {
    expect(
      decideLlmCostStage(
        orgTrial({ trialEndsAt: new Date(Date.now() - 1 * DIA) }),
      ),
    ).toBe('OTHER');
  });

  it('trial convertido sem assinatura registrada (seed suspeito): OTHER', () => {
    expect(decideLlmCostStage(orgTrial({ trialConverted: true }))).toBe('OTHER');
  });
});

describe('getTrialLlmStage — cache de 5 min + isenções', () => {
  it('consulta a org 1 vez e serve a segunda chamada do cache', async () => {
    prismaMock.organization.findUnique.mockResolvedValue(orgTrial());

    const primeira = await getTrialLlmStage('org-trial');
    const segunda = await getTrialLlmStage('org-trial');

    expect(primeira).toEqual({ capped: true, stage: 'TRIAL', capUsd: 15 });
    expect(segunda).toEqual(primeira);
    expect(prismaMock.organization.findUnique).toHaveBeenCalledTimes(1);
    expect(store.has('zappiq:trial_stage:org-trial')).toBe(true);
  });

  it('org da ZappIQ (vitrine Iza) fica fora do regime sem consultar o banco', async () => {
    const stage = await getTrialLlmStage(ZAPPIQ_ORG_ID);

    expect(stage.capped).toBe(false);
    expect(prismaMock.organization.findUnique).not.toHaveBeenCalled();
  });

  it('org inexistente: OTHER (não capa)', async () => {
    prismaMock.organization.findUnique.mockResolvedValue(null);
    expect((await getTrialLlmStage('org-fantasma')).capped).toBe(false);
  });

  it('fail-soft: erro de banco devolve OTHER e não lança', async () => {
    prismaMock.organization.findUnique.mockRejectedValue(new Error('db off'));
    await expect(getTrialLlmStage('org-x')).resolves.toEqual({
      capped: false,
      stage: 'OTHER',
      capUsd: 0,
    });
  });
});

describe('assertTrialCostCap + recordTrialCost', () => {
  it('org em TRIAL abaixo do teto: allowed', async () => {
    prismaMock.organization.findUnique.mockResolvedValue(orgTrial());
    await recordTrialCost('org-trial', 3.5);

    const r = await assertTrialCostCap('org-trial');

    expect(r.allowed).toBe(true);
    expect(r.spentUsd).toBeCloseTo(3.5);
    expect(r.capUsd).toBe(15);
  });

  it('org em TRIAL acima do teto: bloqueia com razão', async () => {
    prismaMock.organization.findUnique.mockResolvedValue(orgTrial());
    await recordTrialCost('org-trial', 15.2);

    const r = await assertTrialCostCap('org-trial');

    expect(r.allowed).toBe(false);
    expect(r.reason).toContain('Cap de custo');
    expect(r.spentUsd).toBeCloseTo(15.2);
  });

  it('org NOVA (sem trial iniciado) também respeita o teto', async () => {
    prismaMock.organization.findUnique.mockResolvedValue(orgNova());
    await recordTrialCost('org-nova', 16);

    const r = await assertTrialCostCap('org-nova');

    expect(r.allowed).toBe(false);
    expect(r.reason).toContain('NOVO');
  });

  it('org PAGANTE nunca é bloqueada, mesmo com custo alto registrado', async () => {
    prismaMock.organization.findUnique.mockResolvedValue(orgPaga());
    await recordTrialCost('org-paga', 999);

    const r = await assertTrialCostCap('org-paga');

    expect(r.allowed).toBe(true);
  });

  it('custo acumula em zappiq:trial_cost_usd:{orgId} com incrbyfloat', async () => {
    await recordTrialCost('org-1', 0.01);
    await recordTrialCost('org-1', 0.02);

    expect(parseFloat(store.get('zappiq:trial_cost_usd:org-1')!)).toBeCloseTo(0.03);
    // TTL da janela (trial + grace)
    expect(expire).toHaveBeenCalledWith('zappiq:trial_cost_usd:org-1', 60 * 24 * 3600);
  });

  it('fail-soft: erro interno libera (allowed=true) e não lança', async () => {
    prismaMock.organization.findUnique.mockRejectedValue(new Error('db off'));
    await expect(assertTrialCostCap('org-x')).resolves.toMatchObject({ allowed: true });
  });
});

describe('consumeTrialContactReplyBudget — 30 respostas/contato/hora', () => {
  it('permite as 30 primeiras e bloqueia a 31ª na mesma hora', async () => {
    for (let i = 1; i <= TRIAL_CONTACT_REPLIES_PER_HOUR; i++) {
      const r = await consumeTrialContactReplyBudget('org-1', 'contato-1');
      expect(r.allowed).toBe(true);
    }

    const r31 = await consumeTrialContactReplyBudget('org-1', 'contato-1');

    expect(r31.allowed).toBe(false);
    expect(r31.count).toBe(31);
    expect(store.get('zappiq:rl:contact:org-1:contato-1')).toBe('31');
  });

  it('seta TTL de 1h só na criação da chave', async () => {
    await consumeTrialContactReplyBudget('org-1', 'contato-1');
    await consumeTrialContactReplyBudget('org-1', 'contato-1');

    const chamadasDeTtl = expire.mock.calls.filter(
      (c: any[]) => c[0] === 'zappiq:rl:contact:org-1:contato-1',
    );
    expect(chamadasDeTtl).toHaveLength(1);
    expect(chamadasDeTtl[0][1]).toBe(3600);
  });

  it('contatos diferentes têm tetos independentes', async () => {
    for (let i = 0; i < 31; i++) await consumeTrialContactReplyBudget('org-1', 'contato-1');

    const outro = await consumeTrialContactReplyBudget('org-1', 'contato-2');

    expect(outro.allowed).toBe(true);
  });

  it('backend de cache fora do ar: libera (nunca trava cliente) e não lança', async () => {
    backendFora = true;
    await expect(consumeTrialContactReplyBudget('org-1', 'contato-1')).resolves.toEqual({
      allowed: true,
      count: 0,
    });
  });
});

describe('consumeWebChatOrgReplyBudget — 300 mensagens/org/hora', () => {
  it('permite as 300 primeiras e bloqueia a 301ª', async () => {
    // Semeia o contador direto (300 INCRs no loop seria só ruído de teste).
    store.set('zappiq:rl:webchat:org-1', String(WEBCHAT_ORG_REPLIES_PER_HOUR - 1));

    const r300 = await consumeWebChatOrgReplyBudget('org-1');
    const r301 = await consumeWebChatOrgReplyBudget('org-1');

    expect(r300.allowed).toBe(true);
    expect(r301.allowed).toBe(false);
    expect(r301.count).toBe(301);
  });
});
