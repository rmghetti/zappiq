/**
 * ISOLAMENTO DE TENANT (IDOR) — handlers de conversas.
 *
 * Bugs corrigidos:
 *   • POST /:id/notes criava nota interna em conversa de QUALQUER org (create
 *     direto com conversationId do param, sem checar dono).
 *   • PUT /:id/assign atribuía a conversa a um agentId do body sem validar que
 *     o usuário pertence à MESMA org (dava para atribuir a usuário de outra org).
 *
 * Abordagem (mesma de contacts.routeOrder.test.ts — SEM supertest): mockamos as
 * deps de I/O, importamos o router e extraímos o handler real do router.stack
 * para invocá-lo com req/res falsos. A lógica pura de handoff (planAssign) fica
 * REAL — já tem cobertura própria em conversations.handoff.test.ts.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@zappiq/database', () => ({
  prisma: {
    conversation: { findFirst: vi.fn(), update: vi.fn() },
    internalNote: { create: vi.fn() },
    user: { findFirst: vi.fn() },
  },
  Prisma: {},
}));

vi.mock('../middleware/validate.js', () => ({
  validate: () => (_req: any, _res: any, next: any) => next(),
}));

vi.mock('../middleware/auth.js', () => ({
  requireRole: () => (_req: any, _res: any, next: any) => next(),
  authMiddleware: (_req: any, _res: any, next: any) => next(),
}));

vi.mock('../services/auditService.js', () => ({
  logAuditEvent: vi.fn().mockResolvedValue(undefined),
}));

// Cache é só espelho (fast-path). No teste, no-op resolvido.
vi.mock('../services/cloud/index.js', () => ({
  cache: { set: vi.fn().mockResolvedValue(undefined), del: vi.fn().mockResolvedValue(undefined) },
}));

vi.mock('../utils/logger.js', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

const { prisma } = await import('@zappiq/database');
const { default: router } = await import('./conversations.js');

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

const noIo = { get: () => null };

beforeEach(() => {
  vi.clearAllMocks();
});

describe('PUT /:id/assign — isolamento de tenant do responsável', () => {
  const handler = getHandler('put', '/:id/assign');
  const existingConv = {
    id: 'conv1',
    assignedToId: null,
    status: 'OPEN',
    contactId: 'c1',
    contact: { whatsappId: '5511999' },
  };

  it('agentId de OUTRA org → 404 e NÃO atualiza a conversa', async () => {
    (prisma.conversation.findFirst as any).mockResolvedValue(existingConv);
    (prisma.user.findFirst as any).mockResolvedValue(null);
    const req = {
      params: { id: 'conv1' },
      body: { agentId: 'userOther' },
      organizationId: 'orgA',
      user: { userId: 'actor', organizationId: 'orgA', role: 'ADMIN' },
      app: noIo,
    };
    const res = makeRes();

    await handler(req, res, vi.fn());

    expect(prisma.user.findFirst).toHaveBeenCalledWith({
      where: { id: 'userOther', organizationId: 'orgA' },
      select: { id: true },
    });
    expect(res.statusCode).toBe(404);
    expect(prisma.conversation.update).not.toHaveBeenCalled();
  });

  it('agentId da própria org → atribui (comportamento legítimo intacto)', async () => {
    (prisma.conversation.findFirst as any).mockResolvedValue(existingConv);
    (prisma.user.findFirst as any).mockResolvedValue({ id: 'userA' });
    (prisma.conversation.update as any).mockResolvedValue({
      id: 'conv1',
      assignedToId: 'userA',
      status: 'ASSIGNED',
      closedAt: null,
    });
    const req = {
      params: { id: 'conv1' },
      body: { agentId: 'userA' },
      organizationId: 'orgA',
      user: { userId: 'actor', organizationId: 'orgA', role: 'ADMIN' },
      app: noIo,
    };
    const res = makeRes();

    await handler(req, res, vi.fn());

    expect(prisma.conversation.update).toHaveBeenCalledTimes(1);
    const updateArg = (prisma.conversation.update as any).mock.calls[0][0];
    expect(updateArg.data.assignedToId).toBe('userA');
    expect(res.body).toEqual({ success: true });
  });

  it('desatribuir (agentId vazio) → NÃO valida usuário e devolve à IA', async () => {
    (prisma.conversation.findFirst as any).mockResolvedValue({
      ...existingConv,
      assignedToId: 'userA',
      status: 'ASSIGNED',
    });
    (prisma.conversation.update as any).mockResolvedValue({
      id: 'conv1',
      assignedToId: null,
      status: 'OPEN',
      closedAt: null,
    });
    const req = {
      params: { id: 'conv1' },
      body: { agentId: '' },
      organizationId: 'orgA',
      user: { userId: 'actor', organizationId: 'orgA', role: 'ADMIN' },
      app: noIo,
    };
    const res = makeRes();

    await handler(req, res, vi.fn());

    expect(prisma.user.findFirst).not.toHaveBeenCalled();
    const updateArg = (prisma.conversation.update as any).mock.calls[0][0];
    expect(updateArg.data.assignedToId).toBeNull();
    expect(res.body).toEqual({ success: true });
  });

  it('conversa de OUTRA org → 404 antes de validar agentId', async () => {
    (prisma.conversation.findFirst as any).mockResolvedValue(null);
    const req = {
      params: { id: 'convX' },
      body: { agentId: 'userA' },
      organizationId: 'orgA',
      user: { userId: 'actor', organizationId: 'orgA', role: 'ADMIN' },
      app: noIo,
    };
    const res = makeRes();

    await handler(req, res, vi.fn());

    expect(res.statusCode).toBe(404);
    expect(prisma.user.findFirst).not.toHaveBeenCalled();
    expect(prisma.conversation.update).not.toHaveBeenCalled();
  });
});

describe('POST /:id/notes — isolamento de tenant', () => {
  const handler = getHandler('post', '/:id/notes');

  it('conversa de OUTRA org → 404 e NÃO cria nota', async () => {
    (prisma.conversation.findFirst as any).mockResolvedValue(null);
    const req = {
      params: { id: 'convOther' },
      body: { content: 'segredo' },
      organizationId: 'orgA',
      user: { userId: 'actor' },
    };
    const res = makeRes();

    await handler(req, res, vi.fn());

    expect(prisma.conversation.findFirst).toHaveBeenCalledWith({
      where: { id: 'convOther', organizationId: 'orgA', deletedAt: null },
      select: { id: true },
    });
    expect(res.statusCode).toBe(404);
    expect(prisma.internalNote.create).not.toHaveBeenCalled();
  });

  it('sem content → 400 sem tocar o banco', async () => {
    const req = { params: { id: 'conv1' }, body: {}, organizationId: 'orgA', user: { userId: 'actor' } };
    const res = makeRes();

    await handler(req, res, vi.fn());

    expect(res.statusCode).toBe(400);
    expect(prisma.conversation.findFirst).not.toHaveBeenCalled();
    expect(prisma.internalNote.create).not.toHaveBeenCalled();
  });

  it('conversa da própria org → cria nota (comportamento legítimo intacto)', async () => {
    (prisma.conversation.findFirst as any).mockResolvedValue({ id: 'conv1' });
    (prisma.internalNote.create as any).mockResolvedValue({ id: 'note1', content: 'oi' });
    const req = {
      params: { id: 'conv1' },
      body: { content: 'oi' },
      organizationId: 'orgA',
      user: { userId: 'actor' },
    };
    const res = makeRes();

    await handler(req, res, vi.fn());

    expect(prisma.internalNote.create).toHaveBeenCalledTimes(1);
    const createArg = (prisma.internalNote.create as any).mock.calls[0][0];
    expect(createArg.data.conversationId).toBe('conv1');
    expect(createArg.data.authorId).toBe('actor');
    expect(res.statusCode).toBe(201);
    expect(res.body).toEqual({ success: true, data: { id: 'note1', content: 'oi' } });
  });
});
