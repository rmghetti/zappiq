/**
 * costGuardService.test.ts: teto de custo Meta por org (PR-H, decisão D5)
 * ============================================================================
 * Cobertura:
 *   - teto derivado por plano: aritmética conferida com o PLAN_CONFIG atual,
 *     antes de 01/10 usa a vigência de 01/10 (não nasce com service = 0),
 *     ilimitado/desconhecido devolve null
 *   - soma do mês conta SÓ billable=true entregue no mês, tarifa por categoria
 *   - alerta de 70% dispara uma vez (idempotência por chave Redis mensal)
 *   - 100% arma a flag zappiq:metacap com TTL 48h + metaCapState no settings
 *     com merge que preserva o resto do Json
 *   - modo pico multiplica o teto efetivo na janela
 *   - GET /api/billing/cost-guard: shape exato do status
 *   - validação do PATCH: mínimo R$ 10, null volta ao derivado
 * ============================================================================
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const orgFindUniqueMock = vi.fn();
const orgUpdateMock = vi.fn();
const userFindFirstMock = vi.fn();
const eventGroupByMock = vi.fn();

vi.mock('@zappiq/database', () => ({
  prisma: {
    organization: {
      findUnique: (...a: any[]) => orgFindUniqueMock(...a),
      update: (...a: any[]) => orgUpdateMock(...a),
    },
    user: { findFirst: (...a: any[]) => userFindFirstMock(...a) },
    metaBillingEvent: { groupBy: (...a: any[]) => eventGroupByMock(...a) },
  },
}));

const redisMock = {
  hget: vi.fn(),
  hset: vi.fn(),
  expire: vi.fn(),
  set: vi.fn(),
  exists: vi.fn(),
};
vi.mock('../utils/redis.js', () => ({ default: redisMock, redis: redisMock }));

vi.mock('../utils/logger.js', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

const sendEmailMock = vi.fn();
vi.mock('./email/emailProvider.js', () => ({
  sendEmail: (...a: any[]) => sendEmailMock(...a),
}));

const {
  deriveMetaCostCapBrl,
  resolveEffectiveMetaCap,
  computeMonthSpendBrl,
  projectLinearToMonthEnd,
  runCostGuardCycle,
  getCostGuardStatus,
  metaCapFlagKey,
  SOFT_STOP_TTL_SECONDS,
} = await import('./costGuardService.js');

const { costGuardPatchSchema } = await import('../routes/billingCostGuard.js');

// Novembro/2026: mês inteiro dentro da vigência de 01/10 (service cobrada).
const AGORA = new Date('2026-11-15T12:00:00.000Z');

/** Rotas de groupBy do mock: lista de orgs OU contagem por categoria. */
function armGroupBy(
  orgRows: Array<{ organizationId: string }>,
  categoryRows: Array<{ category: string | null; _count: { _all: number } }>,
) {
  eventGroupByMock.mockImplementation((args: any) =>
    Promise.resolve(args.by.includes('organizationId') ? orgRows : categoryRows),
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.useFakeTimers();
  vi.setSystemTime(AGORA);
  redisMock.hget.mockResolvedValue(null);
  redisMock.hset.mockResolvedValue(1);
  redisMock.expire.mockResolvedValue(1);
  redisMock.set.mockResolvedValue('OK');
  redisMock.exists.mockResolvedValue(0);
  sendEmailMock.mockResolvedValue({ success: true });
  userFindFirstMock.mockResolvedValue({ email: 'admin@org.com.br' });
});

afterEach(() => {
  vi.useRealTimers();
});

// ─── Teto derivado ─────────────────────────────────────────────

describe('deriveMetaCostCapBrl', () => {
  // Tarifas da vigência 01/10/2026: service 0,035 e marketing 0,3217 (BRL).
  it('confere a aritmética com os limites atuais do PLAN_CONFIG', () => {
    // GROWTH: (8000 × 0,035 + 5000 × 0,3217) × 1,3 = 2455,05 → 2455
    expect(deriveMetaCostCapBrl('GROWTH', AGORA)).toBe(2455);
    // IZA_LITE: (1500 × 0,035 + 200 × 0,3217) × 1,3 = 151,892 → 152
    expect(deriveMetaCostCapBrl('IZA_LITE', AGORA)).toBe(152);
    // SCALE: (80000 × 0,035 + 60000 × 0,3217) × 1,3 = 28732,6 → 28733
    expect(deriveMetaCostCapBrl('SCALE', AGORA)).toBe(28733);
    // STARTER (legado): (1500 × 0,035 + 500 × 0,3217) × 1,3 = 277,355 → 277
    expect(deriveMetaCostCapBrl('STARTER', AGORA)).toBe(277);
  });

  it('antes de 01/10 usa a vigência de 01/10: o teto não nasce com service = 0', () => {
    const antesDeOutubro = new Date('2026-08-20T12:00:00Z');
    // Igual ao valor pós-outubro...
    expect(deriveMetaCostCapBrl('GROWTH', antesDeOutubro)).toBe(2455);
    // ...e diferente do que sairia com service grátis (só broadcasts):
    // 5000 × 0,3217 × 1,3 = 2091,05 → 2091.
    expect(deriveMetaCostCapBrl('GROWTH', antesDeOutubro)).not.toBe(2091);
  });

  it('plano ilimitado (-1) ou desconhecido não tem teto derivável', () => {
    expect(deriveMetaCostCapBrl('ENTERPRISE', AGORA)).toBeNull();
    expect(deriveMetaCostCapBrl('PLANO_QUE_NAO_EXISTE', AGORA)).toBeNull();
  });
});

// ─── Teto efetivo + modo pico ──────────────────────────────────

describe('resolveEffectiveMetaCap', () => {
  it('sem custom usa o derivado; com metaCostCapBrl vira custom', () => {
    expect(resolveEffectiveMetaCap({ plan: 'GROWTH', settings: {}, date: AGORA })).toEqual({
      capBrl: 2455,
      capSource: 'derived',
      peakActive: false,
    });
    expect(
      resolveEffectiveMetaCap({
        plan: 'GROWTH',
        settings: { billing: { metaCostCapBrl: 500 } },
        date: AGORA,
      }),
    ).toEqual({ capBrl: 500, capSource: 'custom', peakActive: false });
  });

  it('modo pico multiplica o teto na janela e desliga fora dela', () => {
    const settings = {
      billing: { peakWindows: [{ start: '2026-11-10', end: '2026-11-20', multiplier: 2 }] },
    };
    // Dentro da janela: 2455 × 2 = 4910.
    expect(resolveEffectiveMetaCap({ plan: 'GROWTH', settings, date: AGORA })).toEqual({
      capBrl: 4910,
      capSource: 'derived',
      peakActive: true,
    });
    // Fora da janela: teto normal (end de data pura cobre o dia 20 inteiro).
    expect(
      resolveEffectiveMetaCap({ plan: 'GROWTH', settings, date: new Date('2026-11-25T00:00:00Z') }),
    ).toEqual({ capBrl: 2455, capSource: 'derived', peakActive: false });
    // Pico multiplica também o teto custom.
    expect(
      resolveEffectiveMetaCap({
        plan: 'GROWTH',
        settings: { billing: { metaCostCapBrl: 500, peakWindows: settings.billing.peakWindows } },
        date: AGORA,
      }),
    ).toEqual({ capBrl: 1000, capSource: 'custom', peakActive: true });
  });

  it('janela malformada é ignorada sem quebrar', () => {
    const settings = {
      billing: { peakWindows: [{ start: 'nada', end: '2026-11-20', multiplier: 2 }, null, 'x'] },
    };
    expect(resolveEffectiveMetaCap({ plan: 'GROWTH', settings, date: AGORA })).toEqual({
      capBrl: 2455,
      capSource: 'derived',
      peakActive: false,
    });
  });
});

// ─── Soma do mês ───────────────────────────────────────────────

describe('computeMonthSpendBrl', () => {
  it('soma só billable=true entregue no mês, categoria × tarifa vigente', async () => {
    armGroupBy(
      [],
      [
        { category: 'service', _count: { _all: 100 } },   // 100 × 0,035  = 3,50
        { category: 'marketing', _count: { _all: 10 } },  // 10 × 0,3217  = 3,217
        { category: null, _count: { _all: 5 } },          // sem categoria: fora
        { category: 'coisa_nova', _count: { _all: 7 } },  // desconhecida: fora
      ],
    );

    const spent = await computeMonthSpendBrl('org1', AGORA);

    expect(spent).toBe(6.72); // 3,50 + 3,217 = 6,717 → 6,72
    // Novembro cai inteiro numa vigência só: uma única consulta agregada.
    expect(eventGroupByMock).toHaveBeenCalledTimes(1);
    const args = eventGroupByMock.mock.calls[0][0];
    expect(args.where.billable).toBe(true);
    expect(args.where.organizationId).toBe('org1');
    expect(args.where.deliveredAt).toEqual({
      gte: new Date('2026-11-01T00:00:00.000Z'),
      lt: new Date('2026-12-01T00:00:00.000Z'),
    });
  });

  it('projeção linear: gasto do meio do mês extrapolado até o fim', () => {
    // 15/11 12:00 = 14,5 dias corridos de 30: 3,50 × (30 / 14,5) = 7,24.
    expect(projectLinearToMonthEnd(3.5, AGORA)).toBe(7.24);
  });
});

// ─── Ciclo: alertas idempotentes e soft-stop ───────────────────

function armOrg(plan: string, settings: unknown = {}) {
  orgFindUniqueMock.mockResolvedValue({
    id: 'org1',
    name: 'Clínica Exemplo',
    plan,
    settings,
  });
}

describe('runCostGuardCycle', () => {
  it('>=70%: alerta por e-mail UMA vez (idempotente pela chave Redis do mês)', async () => {
    armOrg('GROWTH');
    // 50.000 service × 0,035 = R$ 1.750 = 71,3% do teto 2455.
    armGroupBy([{ organizationId: 'org1' }], [{ category: 'service', _count: { _all: 50000 } }]);

    const primeira = await runCostGuardCycle();

    expect(primeira.orgsProcessed).toBe(1);
    expect(primeira.alertsSent).toBe(1);
    expect(primeira.softStopsSet).toBe(0);
    expect(sendEmailMock).toHaveBeenCalledTimes(1);
    const email = sendEmailMock.mock.calls[0][0];
    expect(email.to).toBe('admin@org.com.br');
    expect(email.subject).toContain('71%');
    // Copy obrigatório da D5: valor, teto, link do dash e a promessa.
    expect(email.text).toContain('1.750,00');
    expect(email.text).toContain('2.455,00');
    expect(email.text).toContain('https://zappiq.com.br/settings#billing');
    expect(email.text).toContain('Conversa aberta nunca cai');
    // Marcou o threshold no hash mensal.
    expect(redisMock.hset).toHaveBeenCalledWith(
      'zappiq:costguard:org1:2026-11',
      { notify_pct_70: AGORA.toISOString() },
    );

    // Segunda rodada no mesmo mês: threshold já marcado, nada reenvia.
    redisMock.hget.mockResolvedValue(AGORA.toISOString());
    const segunda = await runCostGuardCycle();

    expect(segunda.alertsSent).toBe(0);
    expect(sendEmailMock).toHaveBeenCalledTimes(1);
  });

  it('>=100%: arma a flag com TTL 48h e grava metaCapState com merge do settings', async () => {
    armOrg('GROWTH', { niche: 'saude', billing: { autoOverage: true } });
    // 80.000 service × 0,035 = R$ 2.800 > teto 2455 (114%).
    armGroupBy([{ organizationId: 'org1' }], [{ category: 'service', _count: { _all: 80000 } }]);

    const r = await runCostGuardCycle();

    expect(r.softStopsSet).toBe(1);
    expect(r.alertsSent).toBe(1);

    // Flag de soft-stop: chave contratada + carência de 48h.
    expect(redisMock.set).toHaveBeenCalledWith(
      metaCapFlagKey('org1'),
      JSON.stringify({ hitAt: AGORA.toISOString(), capBrl: 2455 }),
      'EX',
      SOFT_STOP_TTL_SECONDS,
    );
    expect(SOFT_STOP_TTL_SECONDS).toBe(48 * 3600);

    // Estado no settings SEM perder o que já existia no Json.
    expect(orgUpdateMock).toHaveBeenCalledTimes(1);
    expect(orgUpdateMock.mock.calls[0][0]).toEqual({
      where: { id: 'org1' },
      data: {
        settings: {
          niche: 'saude',
          billing: {
            autoOverage: true,
            metaCapState: { hitAt: AGORA.toISOString(), capBrl: 2455, acknowledged: false },
          },
        },
      },
    });
  });

  it('org sem teto derivável nem custom (Enterprise) é pulada sem alerta', async () => {
    armOrg('ENTERPRISE');
    armGroupBy([{ organizationId: 'org1' }], [{ category: 'service', _count: { _all: 999999 } }]);

    const r = await runCostGuardCycle();

    expect(r.orgsProcessed).toBe(1);
    expect(r.orgsSkippedNoCap).toBe(1);
    expect(r.alertsSent).toBe(0);
    expect(sendEmailMock).not.toHaveBeenCalled();
    // Nem chegou a somar o mês: só a consulta da lista de orgs.
    expect(eventGroupByMock).toHaveBeenCalledTimes(1);
  });
});

// ─── Endpoint ──────────────────────────────────────────────────

describe('GET /api/billing/cost-guard (getCostGuardStatus)', () => {
  it('devolve o shape exato do medidor', async () => {
    armOrg('GROWTH');
    armGroupBy([], [{ category: 'service', _count: { _all: 100 } }]); // R$ 3,50

    const status = await getCostGuardStatus('org1', AGORA);

    expect(status).toEqual({
      capBrl: 2455,
      capSource: 'derived',
      spentBrl: 3.5,
      projectedBrl: 7.24, // 3,50 × (30 / 14,5)
      percent: 0.1,
      softStop: false,
      peakActive: false,
    });
  });

  it('reflete soft-stop ativo (flag no Redis) e teto custom', async () => {
    armOrg('GROWTH', { billing: { metaCostCapBrl: 500 } });
    armGroupBy([], [{ category: 'service', _count: { _all: 100 } }]);
    redisMock.exists.mockResolvedValue(1);

    const status = await getCostGuardStatus('org1', AGORA);

    expect(status.capBrl).toBe(500);
    expect(status.capSource).toBe('custom');
    expect(status.softStop).toBe(true);
    expect(redisMock.exists).toHaveBeenCalledWith('zappiq:metacap:org1');
  });
});

describe('PATCH /api/billing/cost-guard (validação zod)', () => {
  it('mínimo R$ 10; null volta ao derivado; resto é rejeitado', () => {
    expect(costGuardPatchSchema.safeParse({ capBrl: 9.99 }).success).toBe(false);
    expect(costGuardPatchSchema.safeParse({ capBrl: 0 }).success).toBe(false);
    expect(costGuardPatchSchema.safeParse({ capBrl: 10 }).success).toBe(true);
    expect(costGuardPatchSchema.safeParse({ capBrl: 350 }).success).toBe(true);
    expect(costGuardPatchSchema.safeParse({ capBrl: null }).success).toBe(true);
    expect(costGuardPatchSchema.safeParse({ capBrl: '350' }).success).toBe(false);
    expect(costGuardPatchSchema.safeParse({}).success).toBe(false);
  });
});
