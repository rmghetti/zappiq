/**
 * W1.6 (segurança) — mass assignment + IDOR em /api/deals.
 *
 * Abordagem: teste puro (vitest, zero I/O) sobre os schemas extraídos do route
 * handler — mesmo padrão de W1.3 (settings.security.test). O contrato de
 * segurança do PUT é o `updateDealSchema.strict()` (whitelist); o do POST é o
 * `createDealSchema` + a checagem de posse do contactId (esta última vive no
 * handler e é coberta como contrato: o schema NÃO deixa passar organizationId).
 */
import { describe, it, expect } from 'vitest';
import { updateDealSchema, createDealSchema } from './deals.schema.js';

// ── PUT: whitelist bloqueia mass assignment ─────────────────────────────────
describe('updateDealSchema — anti mass assignment', () => {
  it('aceita campos legítimos do cliente', () => {
    const r = updateDealSchema.safeParse({
      title: 'Deal renomeado',
      value: 1000,
      stage: 'qualified',
      stageId: 'stage_123',
      ownerId: 'user_1',
      expectedCloseDate: '2026-08-01T00:00:00.000Z',
      lossReason: 'PRICE',
      contactId: 'contact_1',
    });
    expect(r.success).toBe(true);
  });

  it('aceita payload parcial (só title)', () => {
    const r = updateDealSchema.safeParse({ title: 'Novo título' });
    expect(r.success).toBe(true);
  });

  it('REJEITA campos de desfecho forjados (wonAt/lostAt/closedAt)', () => {
    for (const field of ['wonAt', 'lostAt', 'closedAt']) {
      const r = updateDealSchema.safeParse({ [field]: new Date().toISOString() });
      expect(r.success, `${field} deveria ser rejeitado`).toBe(false);
    }
  });

  it('REJEITA campos de atribuição IA (sourceConversationId/aiLinkReviewed/sourceCampaignId/sourceAgentId)', () => {
    for (const field of ['sourceConversationId', 'sourceCampaignId', 'sourceAgentId']) {
      const r = updateDealSchema.safeParse({ [field]: 'roubado' });
      expect(r.success, `${field} deveria ser rejeitado`).toBe(false);
    }
    const r = updateDealSchema.safeParse({ aiLinkReviewed: true });
    expect(r.success, 'aiLinkReviewed deveria ser rejeitado').toBe(false);
  });

  it('REJEITA organizationId no body (troca de tenant)', () => {
    const r = updateDealSchema.safeParse({ organizationId: 'org_outra' });
    expect(r.success).toBe(false);
  });

  it('REJEITA id/createdAt/updatedAt', () => {
    for (const field of ['id', 'createdAt', 'updatedAt']) {
      const r = updateDealSchema.safeParse({ [field]: 'x' });
      expect(r.success, `${field} deveria ser rejeitado`).toBe(false);
    }
  });

  it('REJEITA payload misto (campo válido + campo fora da whitelist) por causa do .strict()', () => {
    const r = updateDealSchema.safeParse({ title: 'OK', wonAt: new Date().toISOString() });
    expect(r.success).toBe(false);
  });

  it('REJEITA lossReason fora do enum', () => {
    const r = updateDealSchema.safeParse({ lossReason: 'not_qualified' });
    expect(r.success).toBe(false);
  });
});

// ── POST: schema de criação não permite sequestrar organizationId ───────────
describe('createDealSchema — anti mass assignment na criação', () => {
  it('aceita criação legítima', () => {
    const r = createDealSchema.safeParse({ title: 'Novo deal', contactId: 'contact_1' });
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.stage).toBe('new'); // default
  });

  it('exige title (>= 2) e contactId', () => {
    expect(createDealSchema.safeParse({ contactId: 'c1' }).success).toBe(false);
    expect(createDealSchema.safeParse({ title: 'x' }).success).toBe(false);
    expect(createDealSchema.safeParse({ title: 'Ok', contactId: '' }).success).toBe(false);
  });

  it('não deixa organizationId entrar pelo output (definido só pelo handler)', () => {
    const r = createDealSchema.safeParse({ title: 'Deal', contactId: 'c1', organizationId: 'org_outra' } as any);
    expect(r.success).toBe(true);
    if (r.success) expect((r.data as any).organizationId).toBeUndefined();
  });
});
