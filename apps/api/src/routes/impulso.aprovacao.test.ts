/**
 * POST /api/impulso — a criação da Tarefa de aprovação do Co-Piloto.
 *
 * A lógica pura (quando aprovar, o texto da tarefa) já tem cobertura própria em
 * services/impulsoAprovacao.test.ts. Este teste prova só a FIAÇÃO: toda
 * campanha nova (DRAFT/SCHEDULED, os dois únicos status de criação) precisa
 * criar a Task vinculada por campaignId, na org certa.
 *
 * Abordagem (mesma de tasks.tenant.test.ts): mocka I/O, extrai o handler real
 * do router.stack, invoca com req/res falsos.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@zappiq/database', () => ({
  prisma: {
    campaign: { create: vi.fn(), findMany: vi.fn() },
    organization: { findUnique: vi.fn() },
    task: { create: vi.fn() },
  },
  Prisma: {},
}));

vi.mock('../middleware/validate.js', () => ({
  validate: () => (_req: any, _res: any, next: any) => next(),
}));

vi.mock('../services/impulsoStrategist.js', () => ({
  draftCampaignFromObjective: vi.fn(),
}));

vi.mock('../services/impulsoCoach.js', () => ({
  computeCoachInsights: vi.fn(() => ({})),
}));

vi.mock('../services/asaasPix.js', () => ({
  getAsaasConfigFromSettings: vi.fn(),
  ensureAsaasCustomer: vi.fn(),
  createPixCharge: vi.fn(),
  buildPixReference: vi.fn(),
  formatPixMessage: vi.fn(),
  pixAllowedForTier: vi.fn(),
}));

vi.mock('../services/channelDispatcher.js', () => ({
  sendReplyText: vi.fn(),
}));

vi.mock('../utils/logger.js', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

const { prisma } = await import('@zappiq/database');
const { default: router } = await import('./impulso.js');

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

const next = vi.fn();

beforeEach(() => {
  vi.clearAllMocks();
  (prisma.organization.findUnique as any).mockResolvedValue({ instagramAccountId: null });
});

describe('POST /api/impulso — Tarefa de aprovação', () => {
  const handler = getHandler('post', '/');

  it('campanha SEM agendamento (DRAFT) cria a Tarefa vinculada por campaignId', async () => {
    (prisma.campaign.create as any).mockResolvedValue({
      id: 'camp_1',
      name: 'Black Friday',
      status: 'DRAFT',
      channels: ['whatsapp'],
      audienceSegment: null,
      scheduledAt: null,
    });

    await handler(
      { organizationId: 'orgA', body: { name: 'Black Friday', channels: ['whatsapp'] } },
      makeRes(),
      next,
    );

    expect(prisma.task.create).toHaveBeenCalledTimes(1);
    const data = (prisma.task.create as any).mock.calls[0][0].data;
    expect(data.campaignId).toBe('camp_1');
    expect(data.organizationId).toBe('orgA');
    expect(data.origem).toBe('IMPULSO');
    expect(data.title).toContain('Black Friday');
  });

  it('campanha COM agendamento (SCHEDULED) também cria a Tarefa', async () => {
    (prisma.campaign.create as any).mockResolvedValue({
      id: 'camp_2',
      name: 'Reativação',
      status: 'SCHEDULED',
      channels: ['whatsapp'],
      audienceSegment: null,
      scheduledAt: '2026-08-01T10:00:00.000Z',
    });

    await handler(
      {
        organizationId: 'orgA',
        body: { name: 'Reativação', channels: ['whatsapp'], scheduledAt: '2026-08-01T10:00:00.000Z' },
      },
      makeRes(),
      next,
    );

    expect(prisma.task.create).toHaveBeenCalledTimes(1);
  });

  it('a Tarefa nasce SEM responsável e é NULA em contactId/dealId — não confundir com follow-up de cliente', async () => {
    (prisma.campaign.create as any).mockResolvedValue({
      id: 'camp_3',
      name: 'Teste',
      status: 'DRAFT',
      channels: [],
      audienceSegment: null,
      scheduledAt: null,
    });

    await handler({ organizationId: 'orgA', body: { name: 'Teste' } }, makeRes(), next);

    const data = (prisma.task.create as any).mock.calls[0][0].data;
    expect(data.contactId).toBeUndefined();
    expect(data.dealId).toBeUndefined();
    expect(data.assignedToId).toBeUndefined();
  });

  it('a rota continua devolvendo 201 com a campanha mesmo criando a tarefa', async () => {
    (prisma.campaign.create as any).mockResolvedValue({
      id: 'camp_4',
      name: 'X',
      status: 'DRAFT',
      channels: [],
      audienceSegment: null,
      scheduledAt: null,
    });
    const res = makeRes();
    await handler({ organizationId: 'orgA', body: { name: 'X' } }, res, next);
    expect(res.statusCode).toBe(201);
    expect(res.body.data.id).toBe('camp_4');
  });

  it('FAIL-SOFT: a campanha sobrevive se a tarefa de aprovação falhar (regressão da auditoria)', async () => {
    // A tarefa é lembrete SECUNDÁRIO. Se este create ficasse fora de try/catch,
    // a falha dele derrubaria a resposta (500) com a campanha JÁ gravada, e o
    // cliente repetiria o POST criando campanha DUPLICADA. A campanha, que é a
    // operação principal, não pode depender do lembrete.
    (prisma.campaign.create as any).mockResolvedValue({
      id: 'camp_5',
      name: 'Reativação',
      status: 'DRAFT',
      channels: [],
      audienceSegment: null,
      scheduledAt: null,
    });
    (prisma.task.create as any).mockRejectedValue(new Error('timeout do banco'));

    const res = makeRes();
    await handler({ organizationId: 'orgA', body: { name: 'Reativação' } }, res, next);

    // A resposta É 201 com a campanha — a falha da tarefa NÃO virou erro 500.
    expect(res.statusCode).toBe(201);
    expect(res.body.data.id).toBe('camp_5');
    // E o erro NÃO foi propagado pro next (que viraria 500 no cliente).
    expect(next).not.toHaveBeenCalled();
  });
});
