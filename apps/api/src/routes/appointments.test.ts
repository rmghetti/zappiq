/**
 * Tenant scoping do POST /api/appointments.
 *
 * Bug (auditoria): o POST gravava appointmentTypeId e contactId vindos do body
 * SEM validar que pertencem à org do usuário. O PATCH /:id já validava. Como a
 * RLS do Postgres está DESLIGADA, o isolamento depende 100% do código: sem a
 * checagem, o cliente A referenciava tipo/contato do cliente B e passava a ver
 * dados de outra org via o include do GET. O fix espelha a checagem do PATCH:
 * findFirst({ where: { id, organizationId } }) e 404 se não achar.
 *
 * Abordagem: mesmo padrão de contacts.routeOrder.test.ts — sem supertest
 * (server.ts puxa Redis/OTel/BullMQ). Mockamos as deps de I/O, importamos o
 * router e invocamos o handler POST direto do router.stack. Zero I/O real.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Request, Response, NextFunction } from 'express';

// prisma mockado: só os models que o POST toca.
const { prismaMock } = vi.hoisted(() => ({
  prismaMock: {
    appointmentType: { findFirst: vi.fn() },
    contact: { findFirst: vi.fn() },
    appointment: { create: vi.fn() },
  },
}));

vi.mock('@zappiq/database', () => ({ prisma: prismaMock, Prisma: {} }));
// authMiddleware é registrado via router.use no import; vira no-op no teste.
vi.mock('../middleware/auth.js', () => ({
  authMiddleware: (_req: Request, _res: Response, next: NextFunction) => next(),
}));
// Evita puxar googleapis/env; não está no caminho do POST.
vi.mock('../services/googleCalendar.js', () => ({ deleteEvent: vi.fn() }));

const { default: router } = await import('./appointments.js');

const ORG_A = 'org-a';

/** Pega o handler final (após validate) de uma rota do router. */
function getHandler(method: string, path: string) {
  const stack = (router as unknown as { stack: any[] }).stack;
  for (const layer of stack) {
    if (layer.route && layer.route.path === path && layer.route.methods[method]) {
      const handlers = layer.route.stack;
      return handlers[handlers.length - 1].handle as (
        req: Request,
        res: Response,
        next: NextFunction,
      ) => Promise<void>;
    }
  }
  throw new Error(`handler não encontrado: ${method.toUpperCase()} ${path}`);
}

function mockRes() {
  const res: any = { statusCode: 200, body: undefined };
  res.status = vi.fn((code: number) => {
    res.statusCode = code;
    return res;
  });
  res.json = vi.fn((payload: unknown) => {
    res.body = payload;
    return res;
  });
  return res as Response & { statusCode: number; body: any };
}

/** Body válido mínimo; sobrescreve com o que cada teste precisa. */
function makeBody(overrides: Record<string, unknown> = {}) {
  return {
    status: 'confirmed',
    startAt: '2026-07-20T13:00:00.000Z',
    endAt: '2026-07-20T13:30:00.000Z',
    timezone: 'America/Sao_Paulo',
    modality: 'online',
    customerName: 'Fulano',
    answers: {},
    ...overrides,
  };
}

const postHandler = getHandler('post', '/');

async function invokePost(body: Record<string, unknown>) {
  const req = { user: { organizationId: ORG_A }, body } as unknown as Request;
  const res = mockRes();
  const next = vi.fn() as unknown as NextFunction;
  await postHandler(req, res, next);
  return { res, next };
}

beforeEach(() => {
  vi.clearAllMocks();
  prismaMock.appointment.create.mockResolvedValue({ id: 'appt-1' });
});

describe('POST /api/appointments — tenant scoping (espelha PATCH /:id)', () => {
  it('REJEITA (404) appointmentTypeId de outra org e NÃO cria', async () => {
    prismaMock.appointmentType.findFirst.mockResolvedValue(null); // não achou na org do user
    const { res } = await invokePost(makeBody({ appointmentTypeId: 'type-de-outra-org' }));

    expect(res.statusCode).toBe(404);
    expect(res.body).toEqual({ error: 'Tipo de agendamento não encontrado' });
    // a checagem é escopada pela org do usuário (é o cerne do fix)
    expect(prismaMock.appointmentType.findFirst).toHaveBeenCalledWith({
      where: { id: 'type-de-outra-org', organizationId: ORG_A },
      select: { id: true },
    });
    expect(prismaMock.appointment.create).not.toHaveBeenCalled();
  });

  it('REJEITA (404) contactId de outra org e NÃO cria', async () => {
    prismaMock.contact.findFirst.mockResolvedValue(null);
    const { res } = await invokePost(makeBody({ contactId: 'contact-de-outra-org' }));

    expect(res.statusCode).toBe(404);
    expect(res.body).toEqual({ error: 'Contato não encontrado' });
    expect(prismaMock.contact.findFirst).toHaveBeenCalledWith({
      where: { id: 'contact-de-outra-org', organizationId: ORG_A },
      select: { id: true },
    });
    expect(prismaMock.appointment.create).not.toHaveBeenCalled();
  });

  it('ACEITA (201) quando tipo e contato são da própria org', async () => {
    prismaMock.appointmentType.findFirst.mockResolvedValue({ id: 'type-1' });
    prismaMock.contact.findFirst.mockResolvedValue({ id: 'contact-1' });
    const { res, next } = await invokePost(
      makeBody({ appointmentTypeId: 'type-1', contactId: 'contact-1' }),
    );

    expect(res.statusCode).toBe(201);
    expect(next).not.toHaveBeenCalled();
    expect(prismaMock.appointment.create).toHaveBeenCalledTimes(1);
    const arg = prismaMock.appointment.create.mock.calls[0][0];
    expect(arg.data.organizationId).toBe(ORG_A);
    expect(arg.data.appointmentTypeId).toBe('type-1');
    expect(arg.data.contactId).toBe('contact-1');
  });

  it('ACEITA (201) sem tipo nem contato, sem consultar as tabelas de referência', async () => {
    const { res } = await invokePost(makeBody());

    expect(res.statusCode).toBe(201);
    expect(prismaMock.appointmentType.findFirst).not.toHaveBeenCalled();
    expect(prismaMock.contact.findFirst).not.toHaveBeenCalled();
    expect(prismaMock.appointment.create).toHaveBeenCalledTimes(1);
    const arg = prismaMock.appointment.create.mock.calls[0][0];
    expect(arg.data.appointmentTypeId).toBeNull();
    expect(arg.data.contactId).toBeNull();
  });
});
