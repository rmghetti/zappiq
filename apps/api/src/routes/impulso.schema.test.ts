/**
 * Segurança — mass assignment + vazamento entre clientes em /api/impulso.
 *
 * Abordagem: teste puro (vitest, zero I/O) sobre o schema extraído do route
 * handler — mesmo padrão de settings.security.test / deals.schema.test. O
 * contrato de segurança do PUT é o `updateImpulsoCampaignSchema.strict()`:
 * bloqueia organizationId (troca de tenant), isImpulso (flag do módulo) e os
 * contadores de métrica. O Impulso carrega `message` (copy por canal disparada),
 * então a proteção contra sequestro de campanha é ainda mais sensível aqui.
 */
import { describe, it, expect } from 'vitest';
import { updateImpulsoCampaignSchema } from './impulso.schema.js';

// ── PUT: whitelist bloqueia mass assignment ─────────────────────────────────
describe('updateImpulsoCampaignSchema — anti mass assignment', () => {
  it('aceita campos legítimos do cliente', () => {
    const r = updateImpulsoCampaignSchema.safeParse({
      name: 'Reativação 30 dias',
      objective: 'reativar quem sumiu há 30 dias',
      type: 'BROADCAST',
      channels: ['whatsapp', 'instagram'],
      audienceSegment: { description: 'inativos 30d' },
      budgetPlan: { recommendedContacts: 500 },
      optimization: { mode: 'bandit' },
      message: { whatsapp: 'Oi! Sentimos sua falta.' },
      autonomyLevel: 2,
      scheduledAt: '2026-08-01T12:00:00.000Z',
    });
    expect(r.success).toBe(true);
  });

  it('aceita payload parcial (só a copy)', () => {
    const r = updateImpulsoCampaignSchema.safeParse({ message: { whatsapp: 'Nova copy' } });
    expect(r.success).toBe(true);
  });

  it('REJEITA organizationId no body (troca de tenant — o vazamento entre clientes)', () => {
    const r = updateImpulsoCampaignSchema.safeParse({ organizationId: 'org_vitima' });
    expect(r.success).toBe(false);
  });

  it('REJEITA organizationId mesmo junto da copy (.strict())', () => {
    // O ataque real: gravar a copy do atacante E mover a campanha pra org da vítima.
    const r = updateImpulsoCampaignSchema.safeParse({
      message: { whatsapp: 'copy do atacante' },
      organizationId: 'org_vitima',
    });
    expect(r.success).toBe(false);
  });

  it('REJEITA isImpulso no body (rebaixar a flag esconderia a campanha das rotas /impulso)', () => {
    const r = updateImpulsoCampaignSchema.safeParse({ isImpulso: false });
    expect(r.success).toBe(false);
  });

  it('REJEITA id no body', () => {
    const r = updateImpulsoCampaignSchema.safeParse({ id: 'camp_forjado' });
    expect(r.success).toBe(false);
  });

  it('REJEITA contadores de métrica forjados', () => {
    for (const field of ['sentCount', 'deliveredCount', 'readCount', 'repliedCount', 'failedCount']) {
      const r = updateImpulsoCampaignSchema.safeParse({ [field]: 999999 });
      expect(r.success, `${field} deveria ser rejeitado`).toBe(false);
    }
  });

  it('REJEITA createdAt/completedAt (timestamps do sistema)', () => {
    for (const field of ['createdAt', 'completedAt']) {
      const r = updateImpulsoCampaignSchema.safeParse({ [field]: new Date().toISOString() });
      expect(r.success, `${field} deveria ser rejeitado`).toBe(false);
    }
  });

  it('REJEITA autonomyLevel fora do intervalo 0..4', () => {
    expect(updateImpulsoCampaignSchema.safeParse({ autonomyLevel: 9 }).success).toBe(false);
    expect(updateImpulsoCampaignSchema.safeParse({ autonomyLevel: -1 }).success).toBe(false);
  });

  it('REJEITA type fora do enum', () => {
    const r = updateImpulsoCampaignSchema.safeParse({ type: 'SMS_BLAST' });
    expect(r.success).toBe(false);
  });

  it('não deixa organizationId/isImpulso entrar pelo output mesmo se presentes', () => {
    const r = updateImpulsoCampaignSchema.safeParse({
      name: 'OK',
      organizationId: 'org_vitima',
      isImpulso: false,
    } as any);
    if (r.success) {
      expect((r.data as any).organizationId).toBeUndefined();
      expect((r.data as any).isImpulso).toBeUndefined();
    } else {
      expect(r.success).toBe(false);
    }
  });
});
