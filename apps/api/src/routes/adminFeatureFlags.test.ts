/**
 * adminFeatureFlags.test.ts
 * ============================================================================
 * A rota que liga o comportamento novo numa organização de cada vez. Regras:
 *   • só SUPERADMIN (a montagem exige requireRole; aqui provamos o resto);
 *   • organização inexistente responde 404, não cria linha órfã;
 *   • flag fora do registro responde 400, sem gravar;
 *   • quem ligou fica registrado.
 * ============================================================================
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

const prismaMock: any = {
  organization: { findUnique: vi.fn() },
  orgFeatureFlag: { findUnique: vi.fn(), findMany: vi.fn(), upsert: vi.fn() },
};

vi.mock('@zappiq/database', () => ({ prisma: prismaMock, Prisma: {} }));

vi.mock('../utils/logger.js', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

vi.mock('../middleware/auth.js', () => ({
  authMiddleware: (_req: any, _res: any, next: any) => next(),
  requireRole: () => (_req: any, _res: any, next: any) => next(),
}));

vi.mock('../services/cloud/index.js', () => ({
  cache: {
    get: vi.fn(async () => null),
    set: vi.fn(async () => true),
    del: vi.fn(async () => true),
  },
}));

const { FLAGS } = await import('../services/featureFlags.js');
const { cache } = await import('../services/cloud/index.js');
const { default: router } = await import('./adminFeatureFlags.js');

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
  prismaMock.organization.findUnique.mockResolvedValue({ id: 'org-cmj', name: 'CMJ' });
  prismaMock.orgFeatureFlag.findMany.mockResolvedValue([]);
  prismaMock.orgFeatureFlag.upsert.mockImplementation(async ({ create }: any) => create);
  (cache.del as any).mockResolvedValue(true);
});

describe('GET /:id/flags', () => {
  it('lista o registro inteiro com o estado da organização', async () => {
    prismaMock.orgFeatureFlag.findMany.mockResolvedValue([
      {
        organizationId: 'org-cmj',
        flag: 'perfilVivo',
        enabled: true,
        updatedBy: 'rodrigo@machia.tech',
        updatedAt: new Date('2026-09-14T12:00:00Z'),
        removeBy: null,
      },
    ]);

    const res = makeRes();
    await getHandler('get', '/:id/flags')({ params: { id: 'org-cmj' } }, res);

    expect(res.statusCode).toBe(200);
    expect(res.body.organizationId).toBe('org-cmj');
    expect(res.body.flags).toHaveLength(Object.keys(FLAGS).length);
    expect(res.body.flags.find((f: any) => f.flag === 'perfilVivo').enabled).toBe(true);
    expect(res.body.flags.find((f: any) => f.flag === 'evalNoTier').enabled).toBe(false);
  });

  it('organização inexistente responde 404', async () => {
    prismaMock.organization.findUnique.mockResolvedValue(null);

    const res = makeRes();
    await getHandler('get', '/:id/flags')({ params: { id: 'nao-existe' } }, res);

    expect(res.statusCode).toBe(404);
  });
});

describe('PUT /:id/flags/:flag', () => {
  const REQ = (body: any, flag = 'perfilVivo') => ({
    params: { id: 'org-cmj', flag },
    body,
    user: { userId: 'su-1', email: 'super@zappiq.com.br', role: 'SUPERADMIN' },
  });

  it('liga o interruptor, registra quem mudou e invalida o cache', async () => {
    const res = makeRes();
    await getHandler('put', '/:id/flags/:flag')(REQ({ enabled: true }), res);

    expect(res.statusCode).toBe(200);
    expect(res.body.flag).toBe('perfilVivo');
    expect(res.body.enabled).toBe(true);

    const chamada = prismaMock.orgFeatureFlag.upsert.mock.calls[0][0];
    expect(chamada.where.organizationId_flag).toEqual({
      organizationId: 'org-cmj',
      flag: 'perfilVivo',
    });
    expect(chamada.create.updatedBy).toBe('super@zappiq.com.br');
    expect(cache.del).toHaveBeenCalledWith('zappiq:flag:org-cmj:perfilVivo');
  });

  it('desliga o interruptor', async () => {
    const res = makeRes();
    await getHandler('put', '/:id/flags/:flag')(REQ({ enabled: false }), res);

    expect(res.statusCode).toBe(200);
    expect(res.body.enabled).toBe(false);
    expect(prismaMock.orgFeatureFlag.upsert.mock.calls[0][0].create.enabled).toBe(false);
  });

  it('flag fora do registro responde 400 e não grava', async () => {
    const res = makeRes();
    await getHandler('put', '/:id/flags/:flag')(REQ({ enabled: true }, 'flagInventada'), res);

    expect(res.statusCode).toBe(400);
    expect(prismaMock.orgFeatureFlag.upsert).not.toHaveBeenCalled();
  });

  it('enabled que não é booleano responde 400', async () => {
    const res = makeRes();
    await getHandler('put', '/:id/flags/:flag')(REQ({ enabled: 'sim' }), res);

    expect(res.statusCode).toBe(400);
    expect(prismaMock.orgFeatureFlag.upsert).not.toHaveBeenCalled();
  });

  it('removeBy em formato errado responde 400', async () => {
    const res = makeRes();
    await getHandler('put', '/:id/flags/:flag')(
      REQ({ enabled: true, removeBy: '31/12/2026' }),
      res,
    );

    expect(res.statusCode).toBe(400);
    expect(prismaMock.orgFeatureFlag.upsert).not.toHaveBeenCalled();
  });

  it('removeBy válido chega ao banco', async () => {
    const res = makeRes();
    await getHandler('put', '/:id/flags/:flag')(
      REQ({ enabled: true, removeBy: '2026-11-30' }),
      res,
    );

    expect(res.statusCode).toBe(200);
    expect(prismaMock.orgFeatureFlag.upsert.mock.calls[0][0].create.removeBy).toEqual(
      new Date('2026-11-30T00:00:00Z'),
    );
  });

  it('organização inexistente responde 404 e não cria linha órfã', async () => {
    prismaMock.organization.findUnique.mockResolvedValue(null);

    const res = makeRes();
    await getHandler('put', '/:id/flags/:flag')(REQ({ enabled: true }), res);

    expect(res.statusCode).toBe(404);
    expect(prismaMock.orgFeatureFlag.upsert).not.toHaveBeenCalled();
  });
});
