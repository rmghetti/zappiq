/**
 * Segurança — mass assignment + vazamento entre clientes em /api/campaigns.
 *
 * Abordagem: teste puro (vitest, zero I/O) sobre o schema extraído do route
 * handler — mesmo padrão de settings.security.test / deals.schema.test. O
 * contrato de segurança do PUT é o `updateCampaignSchema.strict()` (whitelist):
 * o campo `organizationId` NÃO pode passar (era o vetor de vazamento entre
 * clientes), nem contadores de métrica, nem a flag isImpulso.
 */
import { describe, it, expect } from 'vitest';
import { updateCampaignSchema } from './campaigns.schema.js';

// ── PUT: whitelist bloqueia mass assignment ─────────────────────────────────
describe('updateCampaignSchema — anti mass assignment', () => {
  it('aceita campos legítimos do cliente', () => {
    const r = updateCampaignSchema.safeParse({
      name: 'Promoção de Julho',
      type: 'BROADCAST',
      templateId: 'tmpl_1',
      audienceFilter: { tag: 'vip' },
      scheduledAt: '2026-08-01T12:00:00.000Z',
    });
    expect(r.success).toBe(true);
  });

  it('aceita payload parcial (só name)', () => {
    const r = updateCampaignSchema.safeParse({ name: 'Novo nome' });
    expect(r.success).toBe(true);
  });

  it('aceita null para des-agendar / limpar template (campos nullable no Prisma)', () => {
    const r = updateCampaignSchema.safeParse({ scheduledAt: null, templateId: null });
    expect(r.success).toBe(true);
  });

  it('REJEITA organizationId no body (troca de tenant — o vazamento entre clientes)', () => {
    const r = updateCampaignSchema.safeParse({ organizationId: 'org_vitima' });
    expect(r.success).toBe(false);
  });

  it('REJEITA organizationId mesmo junto de um campo válido (.strict())', () => {
    const r = updateCampaignSchema.safeParse({ name: 'OK', organizationId: 'org_vitima' });
    expect(r.success).toBe(false);
  });

  it('REJEITA isImpulso no body (não vira campanha do outro módulo por request)', () => {
    const r = updateCampaignSchema.safeParse({ isImpulso: true });
    expect(r.success).toBe(false);
  });

  it('REJEITA id no body', () => {
    const r = updateCampaignSchema.safeParse({ id: 'camp_forjado' });
    expect(r.success).toBe(false);
  });

  it('REJEITA contadores de métrica forjados', () => {
    for (const field of ['sentCount', 'deliveredCount', 'readCount', 'repliedCount', 'failedCount']) {
      const r = updateCampaignSchema.safeParse({ [field]: 999999 });
      expect(r.success, `${field} deveria ser rejeitado`).toBe(false);
    }
  });

  it('REJEITA createdAt/completedAt (timestamps do sistema)', () => {
    for (const field of ['createdAt', 'completedAt']) {
      const r = updateCampaignSchema.safeParse({ [field]: new Date().toISOString() });
      expect(r.success, `${field} deveria ser rejeitado`).toBe(false);
    }
  });

  it('REJEITA type fora do enum', () => {
    const r = updateCampaignSchema.safeParse({ type: 'SMS_BLAST' });
    expect(r.success).toBe(false);
  });

  it('não deixa organizationId entrar pelo output mesmo se presente', () => {
    const r = updateCampaignSchema.safeParse({ name: 'OK', organizationId: 'org_vitima' } as any);
    if (r.success) {
      expect((r.data as any).organizationId).toBeUndefined();
    } else {
      expect(r.success).toBe(false);
    }
  });
});
