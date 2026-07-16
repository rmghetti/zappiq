/**
 * POST /api/mira-access/pack/checkout — quem pode comprar pacote avulso.
 *
 * TRAVA DE UM BUG DE COBRANÇA REAL (16/07/2026): o gate checava `entitled`, e
 * quem está no TESTE GRÁTIS também é entitled (source:'trial') — passava. Só
 * que o trial é teto vitalício lido do ledger monthKey:'TRIAL' com
 * `packExtra: 0` FIXO, enquanto creditMiraPack SEMPRE credita em
 * currentMonthKey(). O cliente pagava até R$ 1.436 e o pack caía num balde que
 * a cota dele nunca lê: dinheiro entra, nada é entregue.
 *
 * Era alcançável: ao esgotar os 10 Alvos do teste, /mira/alvos mostrava
 * "Compre um pacote avulso para continuar mapeando agora".
 *
 * A regra: pacote exige FAIXA (tier), não só acesso. No trial, tier é null.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

const getMiraEntitlementMock = vi.fn();
const sessionsCreateMock = vi.fn();

vi.mock('@zappiq/database', () => ({
  prisma: { organization: { findUnique: vi.fn().mockResolvedValue({ stripeCustomerId: 'cus_1' }) } },
  Prisma: {},
}));

vi.mock('../middleware/requireMira.js', () => ({
  getMiraEntitlement: getMiraEntitlementMock,
  requireMira: () => (_req: any, _res: any, next: any) => next(),
  consumeMiraQuota: vi.fn(),
  creditMiraPack: vi.fn(),
}));

// O módulo instancia o Stripe na carga a partir do env — então o mock precisa
// ser do PACOTE + do env, não de um wrapper (que não existe aqui).
vi.mock('stripe', () => ({
  default: class {
    checkout = { sessions: { create: sessionsCreateMock } };
  },
}));

vi.mock('../config/env.js', () => ({
  env: {
    STRIPE_SECRET_KEY: 'sk_test_fake',
    NEXT_PUBLIC_APP_URL: 'https://zappiq.com.br',
  },
}));

vi.mock('../utils/logger.js', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

vi.mock('../middleware/validate.js', () => ({
  validate: () => (_req: any, _res: any, next: any) => next(),
}));

const { default: router } = await import('./miraAccess.js');

type RouteLayer = {
  route?: { path: string; methods: Record<string, boolean>; stack: Array<{ handle: any }> };
};

function getHandler(method: string, path: string) {
  const stack = (router as unknown as { stack: RouteLayer[] }).stack;
  const layer = stack.find((l) => l.route?.path === path && !!l.route?.methods?.[method.toLowerCase()]);
  if (!layer || !layer.route) throw new Error(`rota ${method} ${path} não encontrada`);
  const rs = layer.route.stack;
  return rs[rs.length - 1].handle as (req: any, res: any, next: any) => Promise<void>;
}

function makeRes() {
  const res: any = { statusCode: 200, body: undefined };
  res.status = vi.fn((c: number) => { res.statusCode = c; return res; });
  res.json = vi.fn((b: any) => { res.body = b; return res; });
  return res;
}

const next = vi.fn();
const PACK = 'MIRA_PACK_50';

beforeEach(() => {
  vi.clearAllMocks();
  sessionsCreateMock.mockResolvedValue({ id: 'cs_1', url: 'https://checkout.stripe.com/x' });
});

describe('pacote avulso exige FAIXA, não só acesso', () => {
  const handler = getHandler('post', '/pack/checkout');

  it('TESTE GRÁTIS não compra pacote — e o Stripe NUNCA é chamado', async () => {
    // O caso do bug: entitled=true (trial dá acesso), mas tier=null.
    getMiraEntitlementMock.mockResolvedValue({
      access: { entitled: true, tier: null, source: 'trial' },
    });
    const res = makeRes();
    await handler({ organizationId: 'orgA', body: { pack: PACK } }, res, next);

    expect(res.statusCode).toBe(403);
    expect(res.body.error).toBe('no_active_tier');
    // A prova que importa: não abriu cobrança nenhuma.
    expect(sessionsCreateMock).not.toHaveBeenCalled();
  });

  it('a recusa do trial explica POR QUE, em vez de só barrar', async () => {
    getMiraEntitlementMock.mockResolvedValue({
      access: { entitled: true, tier: null, source: 'trial' },
    });
    const res = makeRes();
    await handler({ organizationId: 'orgA', body: { pack: PACK } }, res, next);
    expect(res.body.message).toMatch(/recarrega a cota de uma faixa/i);
    expect(res.body.message).toMatch(/[Aa]ssine uma faixa/);
  });

  it('quem NÃO tem acesso nenhum também não compra', async () => {
    getMiraEntitlementMock.mockResolvedValue({
      access: { entitled: false, tier: null, source: null },
    });
    const res = makeRes();
    await handler({ organizationId: 'orgA', body: { pack: PACK } }, res, next);
    expect(res.statusCode).toBe(403);
    expect(sessionsCreateMock).not.toHaveBeenCalled();
  });

  it('quem TEM faixa compra normalmente', async () => {
    getMiraEntitlementMock.mockResolvedValue({
      access: { entitled: true, tier: 'MIRA_PRO', source: 'addon' },
    });
    const res = makeRes();
    await handler({ organizationId: 'orgA', body: { pack: PACK } }, res, next);
    expect(sessionsCreateMock).toHaveBeenCalledTimes(1);
    expect(res.body?.url).toContain('checkout.stripe.com');
  });

  it('o checkout do pacote tem campo de cupom (decisão: todo produto pago tem)', async () => {
    getMiraEntitlementMock.mockResolvedValue({
      access: { entitled: true, tier: 'MIRA_PRO', source: 'addon' },
    });
    await handler({ organizationId: 'orgA', body: { pack: PACK } }, makeRes(), next);
    const arg = sessionsCreateMock.mock.calls[0][0];
    expect(arg.allow_promotion_codes, 'pacote sem campo de cupom').toBe(true);
    expect(arg.mode).toBe('payment');
  });

  it('faixa "included" pelo plano também compra pacote', async () => {
    // BUSINESS/ENTERPRISE já incluem faixa: têm tier real, logo têm cota.
    getMiraEntitlementMock.mockResolvedValue({
      access: { entitled: true, tier: 'MIRA_SCALE', source: 'included' },
    });
    await handler({ organizationId: 'orgA', body: { pack: PACK } }, makeRes(), next);
    expect(sessionsCreateMock).toHaveBeenCalledTimes(1);
  });

  it('pack inválido é recusado antes de qualquer coisa', async () => {
    const res = makeRes();
    await handler({ organizationId: 'orgA', body: { pack: 'MIRA_PACK_999999' } }, res, next);
    expect(res.statusCode).toBe(400);
    expect(getMiraEntitlementMock).not.toHaveBeenCalled();
    expect(sessionsCreateMock).not.toHaveBeenCalled();
  });
});
