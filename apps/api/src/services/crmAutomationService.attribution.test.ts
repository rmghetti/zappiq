/**
 * crmAutomationService.attribution.test.ts — W2.8 (atribuição campanha→venda)
 * ============================================================================
 * Cobre a propagação de sourceCampaignId do Contact para o Deal criado por
 * purchase_intent. Antes deste fix, o Deal nascia sem sourceCampaignId e a
 * página de atribuição (receita/ROI por campanha) ficava eternamente zerada.
 *
 * Casos:
 *   ✓ contato COM sourceCampaignId → Deal criado herda a origem
 *   ✓ contato SEM sourceCampaignId → Deal criado sem sourceCampaignId
 *   ✓ Deal já existente → não recria (sem sobrescrever atribuição)
 * ============================================================================
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── prisma singleton mockado ──────────────────────────────────────────────
// vi.hoisted: a factory de vi.mock é içada pro topo; o db precisa existir lá.
const db: any = vi.hoisted(() => ({
  contact: { findUnique: vi.fn(), update: vi.fn().mockResolvedValue({}) },
  activity: { create: vi.fn().mockResolvedValue({}) },
  pipelineStage: { findFirst: vi.fn().mockResolvedValue({ id: 'stage-proposta', name: 'Proposta' }) },
  deal: { findFirst: vi.fn(), create: vi.fn(), update: vi.fn().mockResolvedValue({}) },
  task: { findFirst: vi.fn().mockResolvedValue(null), create: vi.fn().mockResolvedValue({}) },
}));
vi.mock('@zappiq/database', () => ({ prisma: db }));

vi.mock('../utils/logger.js', () => ({
  logger: { warn: vi.fn(), info: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

import { syncContactToCrm } from './crmAutomationService.js';

const baseContact = {
  id: 'contact-1',
  leadStatus: 'QUALIFIED',
  leadScore: 40,
  funnelStage: 'contatado',
  firstTouchAt: new Date('2026-07-01T00:00:00Z'),
  name: 'Fulano',
  phone: '+5511999999999',
};

beforeEach(() => {
  vi.clearAllMocks();
  db.pipelineStage.findFirst.mockResolvedValue({ id: 'stage-proposta', name: 'Proposta' });
  db.task.findFirst.mockResolvedValue(null);
  db.deal.create.mockResolvedValue({ id: 'deal-new' });
});

describe('syncContactToCrm — propagação de sourceCampaignId (W2.8)', () => {
  it('contato COM sourceCampaignId → Deal criado herda a origem', async () => {
    db.contact.findUnique.mockResolvedValue({ ...baseContact, sourceCampaignId: 'camp-42' });
    db.deal.findFirst.mockResolvedValue(null); // nenhum deal aberto → cria

    await syncContactToCrm({
      organizationId: 'org-1',
      contactId: 'contact-1',
      conversationId: 'conv-1',
      intent: 'purchase_intent',
    });

    expect(db.deal.create).toHaveBeenCalledTimes(1);
    const dealData = db.deal.create.mock.calls[0][0].data;
    expect(dealData.sourceCampaignId).toBe('camp-42');
    expect(dealData.contactId).toBe('contact-1');
  });

  it('contato SEM sourceCampaignId → Deal criado sem sourceCampaignId', async () => {
    db.contact.findUnique.mockResolvedValue({ ...baseContact, sourceCampaignId: null });
    db.deal.findFirst.mockResolvedValue(null);

    await syncContactToCrm({
      organizationId: 'org-1',
      contactId: 'contact-1',
      conversationId: 'conv-1',
      intent: 'purchase_intent',
    });

    expect(db.deal.create).toHaveBeenCalledTimes(1);
    const dealData = db.deal.create.mock.calls[0][0].data;
    expect(dealData.sourceCampaignId).toBeUndefined();
  });

  it('Deal já existente → não recria (sem sobrescrever atribuição)', async () => {
    db.contact.findUnique.mockResolvedValue({ ...baseContact, sourceCampaignId: 'camp-42' });
    db.deal.findFirst.mockResolvedValue({ id: 'deal-existing', stageId: 'stage-proposta' });

    await syncContactToCrm({
      organizationId: 'org-1',
      contactId: 'contact-1',
      conversationId: 'conv-1',
      intent: 'purchase_intent',
    });

    expect(db.deal.create).not.toHaveBeenCalled();
  });
});
