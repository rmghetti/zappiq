/**
 * ISOLAMENTO DE TENANT (IDOR) — handlers de documentos da base RAG.
 *
 * Bug corrigido: DELETE /:id/documents/:docId apagava documento de QUALQUER
 * org (delete direto por id, sem escopo) e POST /:id/documents criava documento
 * numa base sem checar se a base era da org do usuário.
 *
 * Abordagem (mesma de contacts.routeOrder.test.ts — SEM supertest, que puxa
 * Redis/OTel/BullMQ): mockamos as deps de I/O, importamos o router e extraímos
 * o handler real do router.stack para invocá-lo com req/res falsos. Assim
 * provamos, sem banco, que recurso de outra org devolve 404 e NÃO grava nada,
 * e que o caso legítimo (recurso da própria org) segue idêntico.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

// Evita conexão real com o banco ao importar o módulo do route.
vi.mock('@zappiq/database', () => ({
  prisma: {
    knowledgeBase: { findFirst: vi.fn() },
    kBDocument: { findFirst: vi.fn(), count: vi.fn(), create: vi.fn(), delete: vi.fn() },
  },
  Prisma: {},
}));

// RAG é best-effort no handler (.catch(...)): resolver é suficiente.
vi.mock('../services/ragService.js', () => ({
  ingestDocument: vi.fn().mockResolvedValue(undefined),
  deleteDocument: vi.fn().mockResolvedValue(undefined),
}));

// validate() é fábrica de middleware; no teste invocamos o handler direto.
vi.mock('../middleware/validate.js', () => ({
  validate: () => (_req: any, _res: any, next: any) => next(),
}));

// Sem limite de plano barrando o caso legítimo.
vi.mock('../middleware/planLimits.js', () => ({
  checkResourceLimit: vi.fn().mockResolvedValue({ allowed: true }),
  resourceLimitBody: vi.fn(() => ({ error: 'limit' })),
}));

vi.mock('../utils/logger.js', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

const { prisma } = await import('@zappiq/database');
const { default: router } = await import('./knowledgeBase.js');

type RouteLayer = {
  route?: { path: string; methods: Record<string, boolean>; stack: Array<{ handle: any }> };
};

/** Extrai o handler final (após middlewares) de uma rota do router.stack. */
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

beforeEach(() => {
  vi.clearAllMocks();
});

describe('DELETE /:id/documents/:docId — isolamento de tenant', () => {
  const handler = getHandler('delete', '/:id/documents/:docId');

  it('documento de OUTRA org → 404 e NÃO apaga nada', async () => {
    (prisma.kBDocument.findFirst as any).mockResolvedValue(null);
    const req = { params: { id: 'kbX', docId: 'docOther' }, organizationId: 'orgA' };
    const res = makeRes();
    const next = vi.fn();

    await handler(req, res, next);

    expect(prisma.kBDocument.findFirst).toHaveBeenCalledWith({
      where: { id: 'docOther', knowledgeBase: { organizationId: 'orgA' } },
      select: { id: true },
    });
    expect(res.statusCode).toBe(404);
    expect(prisma.kBDocument.delete).not.toHaveBeenCalled();
    expect(next).not.toHaveBeenCalled();
  });

  it('documento da própria org → apaga e responde igual ao legítimo', async () => {
    (prisma.kBDocument.findFirst as any).mockResolvedValue({ id: 'doc1' });
    (prisma.kBDocument.delete as any).mockResolvedValue({ id: 'doc1' });
    const req = { params: { id: 'kb1', docId: 'doc1' }, organizationId: 'orgA' };
    const res = makeRes();

    await handler(req, res, vi.fn());

    expect(prisma.kBDocument.delete).toHaveBeenCalledWith({ where: { id: 'doc1' } });
    expect(res.statusCode).toBe(200);
    expect(res.body).toEqual({ success: true, message: 'Document deleted' });
  });
});

describe('POST /:id/documents — isolamento de tenant', () => {
  const handler = getHandler('post', '/:id/documents');

  it('base de OUTRA org → 404 e NÃO cria documento', async () => {
    (prisma.knowledgeBase.findFirst as any).mockResolvedValue(null);
    const req = {
      params: { id: 'kbOther' },
      organizationId: 'orgA',
      body: { title: 'T', content: 'C' },
    };
    const res = makeRes();

    await handler(req, res, vi.fn());

    expect(prisma.knowledgeBase.findFirst).toHaveBeenCalledWith({
      where: { id: 'kbOther', organizationId: 'orgA' },
      select: { id: true },
    });
    expect(res.statusCode).toBe(404);
    expect(prisma.kBDocument.create).not.toHaveBeenCalled();
  });

  it('sem title/content → 400 sem tocar o banco', async () => {
    const req = { params: { id: 'kb1' }, organizationId: 'orgA', body: { title: '', content: '' } };
    const res = makeRes();

    await handler(req, res, vi.fn());

    expect(res.statusCode).toBe(400);
    expect(prisma.knowledgeBase.findFirst).not.toHaveBeenCalled();
    expect(prisma.kBDocument.create).not.toHaveBeenCalled();
  });

  it('base da própria org → cria documento (comportamento legítimo intacto)', async () => {
    (prisma.knowledgeBase.findFirst as any).mockResolvedValue({ id: 'kb1' });
    (prisma.kBDocument.count as any).mockResolvedValue(0);
    (prisma.kBDocument.create as any).mockResolvedValue({ id: 'doc1', title: 'T' });
    const req = {
      params: { id: 'kb1' },
      organizationId: 'orgA',
      body: { title: 'T', content: 'C', sourceType: 'manual' },
    };
    const res = makeRes();

    await handler(req, res, vi.fn());

    expect(prisma.kBDocument.create).toHaveBeenCalledTimes(1);
    const createArg = (prisma.kBDocument.create as any).mock.calls[0][0];
    expect(createArg.data.knowledgeBaseId).toBe('kb1');
    expect(res.statusCode).toBe(201);
    expect(res.body).toEqual({ success: true, data: { id: 'doc1', title: 'T' } });
  });
});
