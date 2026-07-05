/**
 * campaignScheduler.test.ts — W2.4 (fechar loop de campanhas)
 * ============================================================================
 * Cobre runCampaignSchedulerCycle: o sweep que dispara campanhas SCHEDULED
 * vencidas (scheduledAt<=now). ANTES nada varria SCHEDULED, então elas ficavam
 * agendadas pra sempre. Agora o cron reivindica (SCHEDULED→SENDING) e enfileira
 * o dispatch.
 *
 * Testa:
 *   - Nenhuma vencida → não enfileira.
 *   - Vencida → reivindica (updateMany status=SCHEDULED) e enfileira dispatch.
 *   - Corrida perdida (updateMany count=0) → não enfileira.
 * ============================================================================
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── Mock bullmq ANTES de importar (top-level new Queue) ──────────────────────
vi.mock('bullmq', () => ({
  Queue: class {
    add = vi.fn();
    close = vi.fn();
  },
  Worker: class {
    on = vi.fn();
    close = vi.fn();
  },
}));

// ── Mock da campaignDispatchQueue (import de queueService.js) ─────────────────
const dispatchAdd = vi.fn();
vi.mock('./queueService.js', () => ({
  campaignDispatchQueue: { add: (...a: any[]) => dispatchAdd(...a) },
}));

// ── Mock @zappiq/database ────────────────────────────────────────────────────
const campaignFindMany = vi.fn();
const campaignUpdateMany = vi.fn();
vi.mock('@zappiq/database', () => ({
  prisma: {
    campaign: {
      findMany: (...a: any[]) => campaignFindMany(...a),
      updateMany: (...a: any[]) => campaignUpdateMany(...a),
    },
  },
}));

import { runCampaignSchedulerCycle } from './campaignSchedulerCron.js';

beforeEach(() => {
  vi.clearAllMocks();
  campaignUpdateMany.mockResolvedValue({ count: 1 });
});

describe('runCampaignSchedulerCycle', () => {
  it('não enfileira nada quando não há campanha vencida', async () => {
    campaignFindMany.mockResolvedValue([]);

    const res = await runCampaignSchedulerCycle(new Date('2026-07-05T12:00:00Z'));

    expect(res).toEqual({ due: 0, enqueued: 0, failed: 0 });
    expect(dispatchAdd).not.toHaveBeenCalled();
  });

  it('busca SCHEDULED com scheduledAt<=now, reivindica e enfileira o dispatch', async () => {
    const now = new Date('2026-07-05T12:00:00Z');
    campaignFindMany.mockResolvedValue([
      { id: 'camp-a', organizationId: 'org-1' },
      { id: 'camp-b', organizationId: 'org-2' },
    ]);

    const res = await runCampaignSchedulerCycle(now);

    // Filtro correto no findMany
    expect(campaignFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { status: 'SCHEDULED', scheduledAt: { lte: now } },
      }),
    );
    // Reivindicou cada uma via updateMany filtrando status=SCHEDULED
    expect(campaignUpdateMany).toHaveBeenCalledWith({
      where: { id: 'camp-a', status: 'SCHEDULED' },
      data: { status: 'SENDING' },
    });
    // Enfileirou o dispatch de cada campanha
    expect(dispatchAdd).toHaveBeenCalledWith('dispatch', {
      campaignId: 'camp-a',
      organizationId: 'org-1',
    });
    expect(dispatchAdd).toHaveBeenCalledWith('dispatch', {
      campaignId: 'camp-b',
      organizationId: 'org-2',
    });
    expect(res).toEqual({ due: 2, enqueued: 2, failed: 0 });
  });

  it('não enfileira se perdeu a corrida (updateMany count=0)', async () => {
    campaignFindMany.mockResolvedValue([{ id: 'camp-a', organizationId: 'org-1' }]);
    campaignUpdateMany.mockResolvedValue({ count: 0 });

    const res = await runCampaignSchedulerCycle(new Date());

    expect(dispatchAdd).not.toHaveBeenCalled();
    expect(res).toEqual({ due: 1, enqueued: 0, failed: 0 });
  });
});
