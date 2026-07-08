/**
 * campaignDispatch.test.ts — W2.4 (fechar loop de campanhas)
 * ============================================================================
 * Cobre dispatchCampaignJob: resolve audiência, enfileira uma mensagem por
 * contato e transiciona status. BUG corrigido: antes marcava
 * sentCount=contatos + COMPLETED no ENFILEIRAMENTO (contador falso, antes de
 * qualquer envio). Agora zera contadores, marca SENDING, enfileira, e só então
 * COMPLETED — sentCount/failedCount reais vêm do message-send worker.
 * ============================================================================
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('bullmq', () => ({
  Queue: class {
    add = vi.fn();
    addBulk = vi.fn();
    getJobCounts = vi.fn().mockResolvedValue({});
    getWaiting = vi.fn().mockResolvedValue([]);
    close = vi.fn();
  },
  Worker: class {
    on = vi.fn();
    close = vi.fn();
  },
  Job: class {},
}));

vi.mock('./channelDispatcher.js', () => ({ sendReplyText: vi.fn() }));

const campaignFindUnique = vi.fn();
const campaignUpdate = vi.fn();
const contactFindMany = vi.fn();
vi.mock('@zappiq/database', () => ({
  prisma: {
    campaign: {
      findUnique: (...a: any[]) => campaignFindUnique(...a),
      update: (...a: any[]) => campaignUpdate(...a),
    },
    contact: {
      findMany: (...a: any[]) => contactFindMany(...a),
    },
  },
}));

import { dispatchCampaignJob, messageSendQueue } from './queueService.js';

beforeEach(() => {
  vi.clearAllMocks();
  campaignUpdate.mockResolvedValue({});
});

describe('dispatchCampaignJob', () => {
  it('enfileira 1 msg por contato consentido e NÃO seta sentCount no enfileiramento', async () => {
    campaignFindUnique.mockResolvedValue({
      id: 'camp-1',
      template: { bodyText: 'Olá {{nome}}' },
    });
    contactFindMany.mockResolvedValue([
      { id: 'c1', whatsappId: '5511900000001', name: 'A' },
      { id: 'c2', whatsappId: '5511900000002', name: 'B' },
    ]);

    const addBulk = vi.spyOn(messageSendQueue, 'addBulk').mockResolvedValue([] as any);

    const res = await dispatchCampaignJob({ campaignId: 'camp-1', organizationId: 'org-1' });

    // Audiência filtra por consentMarketing.
    expect(contactFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { organizationId: 'org-1', consentMarketing: true },
      }),
    );
    // Enfileirou os 2 contatos com campaignId no payload.
    expect(addBulk).toHaveBeenCalledTimes(1);
    const jobs = addBulk.mock.calls[0][0] as any[];
    expect(jobs).toHaveLength(2);
    expect(jobs[0].data).toMatchObject({ campaignId: 'camp-1', contactId: 'c1', organizationId: 'org-1' });

    // Primeiro update = SENDING + contadores zerados (NÃO sentCount=2).
    const firstUpdate = campaignUpdate.mock.calls[0][0];
    expect(firstUpdate.data.status).toBe('SENDING');
    expect(firstUpdate.data.sentCount).toBe(0);

    // Último update = COMPLETED, sem sentCount falso.
    const lastUpdate = campaignUpdate.mock.calls[campaignUpdate.mock.calls.length - 1][0];
    expect(lastUpdate.data.status).toBe('COMPLETED');
    expect(lastUpdate.data.sentCount).toBeUndefined();

    expect(res).toEqual({ success: true, totalEnqueued: 2 });
  });

  it('marca CANCELLED e relança se a campanha não existe', async () => {
    campaignFindUnique.mockResolvedValue(null);

    await expect(
      dispatchCampaignJob({ campaignId: 'ghost', organizationId: 'org-1' }),
    ).rejects.toThrow(/not found/);

    expect(campaignUpdate).toHaveBeenCalledWith({
      where: { id: 'ghost' },
      data: { status: 'CANCELLED' },
    });
  });

  it('com audienceSegment, filtra a audiência por ele (não dispara pra base inteira)', async () => {
    campaignFindUnique.mockResolvedValue({
      id: 'camp-2',
      template: { bodyText: 'Oi {{nome}}' },
      audienceSegment: { tagsAny: ['vip'] },
    });
    contactFindMany.mockResolvedValue([{ id: 'c9', whatsappId: '5511900000009', name: 'VIP' }]);
    vi.spyOn(messageSendQueue, 'addBulk').mockResolvedValue([] as any);

    await dispatchCampaignJob({ campaignId: 'camp-2', organizationId: 'org-1' });

    // Continua exigindo consentMarketing + organizationId (piso de segurança),
    // e ADICIONA o critério do segmento (tags).
    expect(contactFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { organizationId: 'org-1', consentMarketing: true, tags: { hasSome: ['vip'] } },
      }),
    );
  });

  it('respeita o limit do audienceSegment (take no findMany)', async () => {
    campaignFindUnique.mockResolvedValue({
      id: 'camp-3',
      template: { bodyText: 'Oi' },
      audienceSegment: { limit: 500 },
    });
    contactFindMany.mockResolvedValue([]);
    vi.spyOn(messageSendQueue, 'addBulk').mockResolvedValue([] as any);

    await dispatchCampaignJob({ campaignId: 'camp-3', organizationId: 'org-1' });

    expect(contactFindMany).toHaveBeenCalledWith(expect.objectContaining({ take: 500 }));
  });

  it('sem audienceSegment (campanha legada), mantém o comportamento antigo (toda a base consentida)', async () => {
    campaignFindUnique.mockResolvedValue({
      id: 'camp-4',
      template: { bodyText: 'Oi' },
      audienceSegment: null,
    });
    contactFindMany.mockResolvedValue([]);
    vi.spyOn(messageSendQueue, 'addBulk').mockResolvedValue([] as any);

    await dispatchCampaignJob({ campaignId: 'camp-4', organizationId: 'org-1' });

    expect(contactFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { organizationId: 'org-1', consentMarketing: true },
      }),
    );
    // Sem limit no segmento -> sem take.
    expect(contactFindMany.mock.calls[0][0].take).toBeUndefined();
  });
});
