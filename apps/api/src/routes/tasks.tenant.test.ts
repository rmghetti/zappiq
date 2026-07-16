/**
 * ISOLAMENTO DE TENANT (IDOR) — handlers de tarefas.
 *
 * POST /api/tasks e PUT /api/tasks/:id aceitam ids do cliente: assignedToId,
 * contactId, dealId e tagIds. NENHUM deles é validável só pelo formato — um
 * cuid válido de OUTRA org passa no zod. Sem a checagem de dono, o cliente A
 * manda o contactId do cliente B e a tarefa dele aponta pra base do outro
 * (mesma família da falha de mass-assignment já corrigida no Impulso).
 *
 * Em produção isto é a ÚNICA barreira: a RLS não filtra para a API, que conecta
 * como `postgres` e bypassa (ver middleware/rlsTenant.ts).
 *
 * Abordagem (mesma de conversations.tenant.test.ts, SEM supertest): mockamos as
 * deps de I/O, importamos o router e extraímos o handler real do router.stack.
 * A camada pura (buildTaskListWhere, resolveCompletedAt, zod) fica REAL — tem
 * cobertura própria em tasks.planner.test.ts.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@zappiq/database', () => ({
  prisma: {
    task: { findFirst: vi.fn(), findMany: vi.fn(), create: vi.fn(), update: vi.fn() },
    taskTag: { count: vi.fn(), findFirst: vi.fn(), findMany: vi.fn(), create: vi.fn(), updateMany: vi.fn(), deleteMany: vi.fn() },
    user: { findFirst: vi.fn() },
    contact: { findFirst: vi.fn() },
    deal: { findFirst: vi.fn() },
  },
  Prisma: {},
}));

vi.mock('../middleware/validate.js', () => ({
  validate: () => (_req: any, _res: any, next: any) => next(),
}));

vi.mock('../services/mira/planoAcao.js', () => ({
  registrarConclusaoNoCrm: vi.fn().mockResolvedValue(undefined),
}));

const { prisma } = await import('@zappiq/database');
const { default: router } = await import('./tasks.js');

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
  return rs[rs.length - 1].handle as (req: any, res: any, next: any) => Promise<void>;
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

const ID_OUTRO = 'clx9k2m4f0000qw3h5t8n1a2b';
const next = vi.fn();

beforeEach(() => {
  vi.clearAllMocks();
});

describe('POST /api/tasks — vínculos de outra org', () => {
  const handler = getHandler('post', '/');

  it('recusa responsável que não é da org', async () => {
    (prisma.user.findFirst as any).mockResolvedValue(null); // não achou NA ORG
    const res = makeRes();
    await handler(
      { organizationId: 'orgA', user: { userId: 'u1' }, body: { title: 'x', assignedToId: ID_OUTRO } },
      res,
      next,
    );
    expect(res.statusCode).toBe(400);
    expect(res.body.error).toMatch(/Responsável/);
    expect(prisma.task.create).not.toHaveBeenCalled();
  });

  it('recusa contato de outra org (não cria a tarefa)', async () => {
    (prisma.contact.findFirst as any).mockResolvedValue(null);
    const res = makeRes();
    await handler(
      { organizationId: 'orgA', user: { userId: 'u1' }, body: { title: 'x', contactId: ID_OUTRO } },
      res,
      next,
    );
    expect(res.statusCode).toBe(400);
    expect(res.body.error).toMatch(/Contato/);
    expect(prisma.task.create).not.toHaveBeenCalled();
  });

  it('recusa negócio de outra org', async () => {
    (prisma.deal.findFirst as any).mockResolvedValue(null);
    const res = makeRes();
    await handler(
      { organizationId: 'orgA', user: { userId: 'u1' }, body: { title: 'x', dealId: ID_OUTRO } },
      res,
      next,
    );
    expect(res.statusCode).toBe(400);
    expect(prisma.task.create).not.toHaveBeenCalled();
  });

  it('recusa etiqueta que não está no catálogo da org', async () => {
    (prisma.taskTag.count as any).mockResolvedValue(0); // 0 das 1 pedidas
    const res = makeRes();
    await handler(
      { organizationId: 'orgA', user: { userId: 'u1' }, body: { title: 'x', tagIds: [ID_OUTRO] } },
      res,
      next,
    );
    expect(res.statusCode).toBe(400);
    expect(res.body.error).toMatch(/Etiqueta/);
    expect(prisma.task.create).not.toHaveBeenCalled();
  });

  it('recusa o LOTE quando só UMA das etiquetas é de fora', async () => {
    // A checagem é por CONTAGEM: 2 pedidas, 1 encontrada → recusa tudo.
    // Se comparasse "achou alguma", a etiqueta alheia entraria de carona.
    (prisma.taskTag.count as any).mockResolvedValue(1);
    const res = makeRes();
    await handler(
      {
        organizationId: 'orgA',
        user: { userId: 'u1' },
        body: { title: 'x', tagIds: [ID_OUTRO, 'clx9k2m4f0001qw3h5t8n1a2c'] },
      },
      res,
      next,
    );
    expect(res.statusCode).toBe(400);
    expect(prisma.task.create).not.toHaveBeenCalled();
  });

  it('a tarefa nasce SEMPRE na org do usuário logado', async () => {
    (prisma.task.create as any).mockResolvedValue({ id: 't1', tags: [] });
    const res = makeRes();
    await handler({ organizationId: 'orgA', user: { userId: 'u1' }, body: { title: 'x' } }, res, next);

    expect(res.statusCode).toBe(201);
    const data = (prisma.task.create as any).mock.calls[0][0].data;
    expect(data.organizationId).toBe('orgA');
  });

  it('completedAt é derivado do status, não do cliente', async () => {
    (prisma.task.create as any).mockResolvedValue({ id: 't1', tags: [] });
    const res = makeRes();
    await handler({ organizationId: 'orgA', user: { userId: 'u1' }, body: { title: 'x' } }, res, next);
    expect((prisma.task.create as any).mock.calls[0][0].data.completedAt).toBeNull();
  });
});

describe('PUT /api/tasks/:id — vínculos de outra org', () => {
  const handler = getHandler('put', '/:id');

  it('404 quando a tarefa é de outra org (não vaza existência)', async () => {
    (prisma.task.findFirst as any).mockResolvedValue(null);
    const res = makeRes();
    await handler(
      { organizationId: 'orgA', user: { userId: 'u1' }, params: { id: 't1' }, body: { title: 'y' } },
      res,
      next,
    );
    expect(res.statusCode).toBe(404);
    expect(prisma.task.update).not.toHaveBeenCalled();
  });

  it('recusa carimbar a tarefa com etiqueta de outro cliente', async () => {
    (prisma.task.findFirst as any).mockResolvedValue({ id: 't1', status: 'PENDING', completedAt: null });
    (prisma.taskTag.count as any).mockResolvedValue(0);
    const res = makeRes();
    await handler(
      {
        organizationId: 'orgA',
        user: { userId: 'u1' },
        params: { id: 't1' },
        body: { tagIds: [ID_OUTRO] },
      },
      res,
      next,
    );
    expect(res.statusCode).toBe(400);
    expect(prisma.task.update).not.toHaveBeenCalled();
  });

  it('tagIds SUBSTITUI as etiquetas (não soma)', async () => {
    (prisma.task.findFirst as any).mockResolvedValue({ id: 't1', status: 'PENDING', completedAt: null });
    (prisma.taskTag.count as any).mockResolvedValue(1);
    (prisma.task.update as any).mockResolvedValue({ id: 't1', tags: [] });
    const res = makeRes();
    await handler(
      {
        organizationId: 'orgA',
        user: { userId: 'u1' },
        params: { id: 't1' },
        body: { tagIds: [ID_OUTRO] },
      },
      res,
      next,
    );
    const data = (prisma.task.update as any).mock.calls[0][0].data;
    expect(data.tags.deleteMany).toEqual({});
    expect(data.tags.create).toEqual([{ tagId: ID_OUTRO }]);
  });
});

describe('PUT /api/tasks/tags/:id — catálogo de outra org', () => {
  const handler = getHandler('put', '/tags/:id');

  it('404 ao editar etiqueta de outra org, e o update trava por org', async () => {
    (prisma.taskTag.updateMany as any).mockResolvedValue({ count: 0 });
    const res = makeRes();
    await handler(
      { organizationId: 'orgA', params: { id: ID_OUTRO }, body: { name: 'roubada' } },
      res,
      next,
    );
    expect(res.statusCode).toBe(404);
    // updateMany + where com org: um update direto por id editaria a alheia.
    expect((prisma.taskTag.updateMany as any).mock.calls[0][0].where.organizationId).toBe('orgA');
  });
});

describe('GET /api/tasks — filtro por responsável', () => {
  const handler = getHandler('get', '/');

  it('"me" é resolvido no SERVIDOR, com o id de quem está logado', async () => {
    (prisma.task.findMany as any).mockResolvedValue([]);
    const res = makeRes();
    await handler(
      { organizationId: 'orgA', user: { userId: 'clx9k2m4f0002qw3h5t8n1a2d' }, query: { assignedToId: 'me' } },
      res,
      next,
    );
    const where = (prisma.task.findMany as any).mock.calls[0][0].where;
    expect(where.assignedToId).toBe('clx9k2m4f0002qw3h5t8n1a2d');
    expect(where.organizationId).toBe('orgA');
  });
});
