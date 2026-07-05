/**
 * campaignStatus.util.test.ts — W2.4 (fechar loop de campanhas)
 * ============================================================================
 * Cobre applyMessageStatusUpdate: propaga o status callback da Meta para a
 * Message e para os contadores delivered/read da Campanha. ANTES delivered/read
 * nunca eram escritos — o loop de métricas da campanha ficava zerado.
 * ============================================================================
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

// queueService importa bullmq no top-level — mocka pra não abrir Redis.
vi.mock('bullmq', () => ({
  Queue: class { add = vi.fn(); addBulk = vi.fn(); getJobCounts = vi.fn().mockResolvedValue({}); getWaiting = vi.fn().mockResolvedValue([]); close = vi.fn(); },
  Worker: class { on = vi.fn(); close = vi.fn(); },
  Job: class {},
}));

import { applyMessageStatusUpdate, normalizeMetaStatus, attributeCampaignReply } from './campaignStatus.util.js';

function makePrisma(msg: any) {
  return {
    message: {
      findUnique: vi.fn().mockResolvedValue(msg),
      update: vi.fn().mockResolvedValue({}),
    },
    campaign: {
      update: vi.fn().mockResolvedValue({}),
    },
  };
}

beforeEach(() => vi.clearAllMocks());

describe('normalizeMetaStatus', () => {
  it('mapeia read/delivered/sent (case-insensitive), default SENT', () => {
    expect(normalizeMetaStatus('read')).toBe('READ');
    expect(normalizeMetaStatus('DELIVERED')).toBe('DELIVERED');
    expect(normalizeMetaStatus('sent')).toBe('SENT');
    expect(normalizeMetaStatus('failed')).toBe('SENT');
    expect(normalizeMetaStatus(undefined)).toBe('SENT');
  });
});

describe('applyMessageStatusUpdate', () => {
  it('mensagem inexistente → no-op', async () => {
    const prisma = makePrisma(null);
    const res = await applyMessageStatusUpdate(prisma, { id: 'wamid.x', status: 'delivered' });
    expect(res).toEqual({ updated: false, deliveredBumped: false, readBumped: false });
    expect(prisma.message.update).not.toHaveBeenCalled();
    expect(prisma.campaign.update).not.toHaveBeenCalled();
  });

  it('SENT→DELIVERED de msg de campanha incrementa deliveredCount 1x', async () => {
    const prisma = makePrisma({ id: 'm1', status: 'SENT', campaignId: 'camp-1' });
    const res = await applyMessageStatusUpdate(prisma, { id: 'wamid.1', status: 'delivered' });

    expect(prisma.message.update).toHaveBeenCalledWith({ where: { id: 'm1' }, data: { status: 'DELIVERED' } });
    expect(prisma.campaign.update).toHaveBeenCalledWith({ where: { id: 'camp-1' }, data: { deliveredCount: { increment: 1 } } });
    expect(res).toEqual({ updated: true, deliveredBumped: true, readBumped: false });
  });

  it('SENT→READ direto conta delivered E read (READ implica DELIVERED)', async () => {
    const prisma = makePrisma({ id: 'm2', status: 'SENT', campaignId: 'camp-2' });
    const res = await applyMessageStatusUpdate(prisma, { id: 'wamid.2', status: 'read' });

    expect(prisma.campaign.update).toHaveBeenCalledWith({ where: { id: 'camp-2' }, data: { deliveredCount: { increment: 1 } } });
    expect(prisma.campaign.update).toHaveBeenCalledWith({ where: { id: 'camp-2' }, data: { readCount: { increment: 1 } } });
    expect(res).toEqual({ updated: true, deliveredBumped: true, readBumped: true });
  });

  it('DELIVERED→DELIVERED (reenvio) não reconta', async () => {
    const prisma = makePrisma({ id: 'm3', status: 'DELIVERED', campaignId: 'camp-3' });
    const res = await applyMessageStatusUpdate(prisma, { id: 'wamid.3', status: 'delivered' });

    expect(prisma.message.update).not.toHaveBeenCalled();
    expect(prisma.campaign.update).not.toHaveBeenCalled();
    expect(res).toEqual({ updated: false, deliveredBumped: false, readBumped: false });
  });

  it('DELIVERED→READ conta só read (delivered já contado antes)', async () => {
    const prisma = makePrisma({ id: 'm4', status: 'DELIVERED', campaignId: 'camp-4' });
    const res = await applyMessageStatusUpdate(prisma, { id: 'wamid.4', status: 'read' });

    expect(prisma.campaign.update).toHaveBeenCalledTimes(1);
    expect(prisma.campaign.update).toHaveBeenCalledWith({ where: { id: 'camp-4' }, data: { readCount: { increment: 1 } } });
    expect(res).toEqual({ updated: true, deliveredBumped: false, readBumped: true });
  });

  it('msg SEM campaignId atualiza status mas não toca contadores', async () => {
    const prisma = makePrisma({ id: 'm5', status: 'SENT', campaignId: null });
    const res = await applyMessageStatusUpdate(prisma, { id: 'wamid.5', status: 'delivered' });

    expect(prisma.message.update).toHaveBeenCalled();
    expect(prisma.campaign.update).not.toHaveBeenCalled();
    expect(res).toEqual({ updated: true, deliveredBumped: false, readBumped: false });
  });
});

describe('attributeCampaignReply', () => {
  function makeReplyPrisma(lastCampaignMsg: any, priorReply: any) {
    return {
      message: {
        findFirst: vi.fn()
          .mockResolvedValueOnce(lastCampaignMsg) // último OUTBOUND de campanha
          .mockResolvedValueOnce(priorReply),      // INBOUND anterior?
      },
      campaign: { update: vi.fn().mockResolvedValue({}) },
      contact: { updateMany: vi.fn().mockResolvedValue({ count: 1 }) },
    };
  }

  it('primeira resposta a uma campanha incrementa repliedCount', async () => {
    const prisma = makeReplyPrisma(
      { id: 'out-1', campaignId: 'camp-1', createdAt: new Date('2026-07-05T10:00:00Z') },
      null,
    );
    const res = await attributeCampaignReply(prisma, 'conv-1', 'in-new');

    expect(res).toBe('camp-1');
    expect(prisma.campaign.update).toHaveBeenCalledWith({
      where: { id: 'camp-1' },
      data: { repliedCount: { increment: 1 } },
    });
  });

  it('conversa sem OUTBOUND de campanha → não conta', async () => {
    const prisma = makeReplyPrisma(null, null);
    const res = await attributeCampaignReply(prisma, 'conv-2', 'in-new');
    expect(res).toBeNull();
    expect(prisma.campaign.update).not.toHaveBeenCalled();
  });

  it('já houve resposta anterior à campanha → não reconta', async () => {
    const prisma = makeReplyPrisma(
      { id: 'out-1', campaignId: 'camp-3', createdAt: new Date('2026-07-05T10:00:00Z') },
      { id: 'in-earlier' },
    );
    const res = await attributeCampaignReply(prisma, 'conv-3', 'in-new');
    expect(res).toBeNull();
    expect(prisma.campaign.update).not.toHaveBeenCalled();
  });

  // W2.8 — grava sourceCampaignId no Contact (first-touch, idempotente).
  it('W2.8: com contactId, grava sourceCampaignId no Contact em first-touch', async () => {
    const prisma = makeReplyPrisma(
      { id: 'out-1', campaignId: 'camp-9', createdAt: new Date('2026-07-05T10:00:00Z') },
      null,
    );
    const res = await attributeCampaignReply(prisma, 'conv-9', 'in-new', 'contact-9');

    expect(res).toBe('camp-9');
    expect(prisma.contact.updateMany).toHaveBeenCalledWith({
      where: { id: 'contact-9', sourceCampaignId: null },
      data: { sourceCampaignId: 'camp-9' },
    });
  });

  it('W2.8: sem contactId, não toca no Contact (back-compat)', async () => {
    const prisma = makeReplyPrisma(
      { id: 'out-1', campaignId: 'camp-10', createdAt: new Date('2026-07-05T10:00:00Z') },
      null,
    );
    const res = await attributeCampaignReply(prisma, 'conv-10', 'in-new');

    expect(res).toBe('camp-10');
    expect(prisma.contact.updateMany).not.toHaveBeenCalled();
  });

  it('W2.8: reply não atribuído (sem OUTBOUND de campanha) não escreve no Contact', async () => {
    const prisma = makeReplyPrisma(null, null);
    const res = await attributeCampaignReply(prisma, 'conv-11', 'in-new', 'contact-11');
    expect(res).toBeNull();
    expect(prisma.contact.updateMany).not.toHaveBeenCalled();
  });
});
