/**
 * impulsoAudience.test.ts — Impulso: resolver de audiência segmentada.
 * ============================================================================
 * resolveAudienceWhere transforma o audienceSegment (JSON livre vindo da
 * campanha) num where do Prisma para Contact. Requisitos inegociáveis:
 *  - SEMPRE filtra pela organização passada (isolamento de tenant);
 *  - SEMPRE exige consentMarketing=true (piso LGPD), o segmento não desliga;
 *  - allowlist de critérios: JSON arbitrário NÃO vira operador Prisma.
 * Função pura e determinística (recebe `now`) — 100% testável sem banco.
 * ============================================================================
 */
import { describe, it, expect } from 'vitest';
import { resolveAudienceWhere } from './impulsoAudience.js';

const NOW = new Date('2026-07-07T12:00:00.000Z');
const DAY = 86_400_000;
const BASELINE = { organizationId: 'org-1', consentMarketing: true };

describe('resolveAudienceWhere — piso de segurança (LGPD + tenant)', () => {
  it('segmento nulo → só org + consentMarketing (preserva o disparo atual)', () => {
    const r = resolveAudienceWhere('org-1', null, NOW);
    expect(r.where).toEqual(BASELINE);
    expect(r.take).toBeUndefined();
  });

  it('objeto vazio → baseline', () => {
    expect(resolveAudienceWhere('org-1', {}, NOW).where).toEqual(BASELINE);
  });

  it('NUNCA deixa o segmento desligar o consentimento de marketing', () => {
    const r = resolveAudienceWhere('org-1', { consentMarketing: false }, NOW);
    expect(r.where.consentMarketing).toBe(true);
  });

  it('NUNCA deixa o segmento trocar a organização (isolamento de tenant)', () => {
    const r = resolveAudienceWhere('org-1', { organizationId: 'org-evil' }, NOW);
    expect(r.where.organizationId).toBe('org-1');
  });

  it('ignora chaves desconhecidas (não vaza operador Prisma arbitrário)', () => {
    const r = resolveAudienceWhere(
      'org-1',
      { OR: [{ id: 'x' }], deleteMany: true, leadScore: { gt: 1 } },
      NOW,
    );
    expect(r.where).toEqual(BASELINE);
  });

  it('segmento não-objeto (string/array) → baseline', () => {
    expect(resolveAudienceWhere('org-1', 'todos', NOW).where).toEqual(BASELINE);
    expect(resolveAudienceWhere('org-1', [1, 2], NOW).where).toEqual(BASELINE);
  });
});

describe('resolveAudienceWhere — critérios permitidos', () => {
  it('tagsAny → tags.hasSome', () => {
    const r = resolveAudienceWhere('org-1', { tagsAny: ['vip', 'black-friday'] }, NOW);
    expect(r.where.tags).toEqual({ hasSome: ['vip', 'black-friday'] });
  });

  it('tagsAll → tags.hasEvery', () => {
    const r = resolveAudienceWhere('org-1', { tagsAll: ['cliente', 'sp'] }, NOW);
    expect(r.where.tags).toEqual({ hasEvery: ['cliente', 'sp'] });
  });

  it('excludeTags → NOT.tags.hasSome (supressão)', () => {
    const r = resolveAudienceWhere('org-1', { excludeTags: ['descadastro'] }, NOW);
    expect(r.where.NOT).toEqual({ tags: { hasSome: ['descadastro'] } });
  });

  it('tags vazias ou não-string são descartadas', () => {
    const r = resolveAudienceWhere('org-1', { tagsAny: ['vip', '', 3, null] }, NOW);
    expect(r.where.tags).toEqual({ hasSome: ['vip'] });
  });

  it('leadStatusIn valida contra o enum (descarta inválidos)', () => {
    const r = resolveAudienceWhere('org-1', { leadStatusIn: ['QUALIFIED', 'CONVERTED', 'HACK'] }, NOW);
    expect(r.where.leadStatus).toEqual({ in: ['QUALIFIED', 'CONVERTED'] });
  });

  it('leadStatusIn sem nenhum valor válido → não adiciona o filtro', () => {
    const r = resolveAudienceWhere('org-1', { leadStatusIn: ['HACK'] }, NOW);
    expect(r.where.leadStatus).toBeUndefined();
  });

  it('funnelStageIn → funnelStage.in', () => {
    const r = resolveAudienceWhere('org-1', { funnelStageIn: ['proposta', 'negociacao'] }, NOW);
    expect(r.where.funnelStage).toEqual({ in: ['proposta', 'negociacao'] });
  });

  it('leadScoreMin/Max → leadScore gte/lte', () => {
    const r = resolveAudienceWhere('org-1', { leadScoreMin: 50, leadScoreMax: 90 }, NOW);
    expect(r.where.leadScore).toEqual({ gte: 50, lte: 90 });
  });

  it('notInteractedForDays → lastInteractionAt.lt = agora - N dias', () => {
    const r = resolveAudienceWhere('org-1', { notInteractedForDays: 30 }, NOW);
    expect(r.where.lastInteractionAt).toEqual({ lt: new Date(NOW.getTime() - 30 * DAY) });
  });

  it('interactedSinceDays → lastInteractionAt.gte = agora - N dias', () => {
    const r = resolveAudienceWhere('org-1', { interactedSinceDays: 7 }, NOW);
    expect(r.where.lastInteractionAt).toEqual({ gte: new Date(NOW.getTime() - 7 * DAY) });
  });

  it('hasEmail=true → email não nulo (para canais de e-mail)', () => {
    const r = resolveAudienceWhere('org-1', { hasEmail: true }, NOW);
    expect(r.where.email).toEqual({ not: null });
  });

  it('sourceCampaignId → filtra pela origem de atribuição', () => {
    const r = resolveAudienceWhere('org-1', { sourceCampaignId: 'camp-x' }, NOW);
    expect(r.where.sourceCampaignId).toBe('camp-x');
  });

  it('combina múltiplos critérios preservando o piso de segurança', () => {
    const r = resolveAudienceWhere('org-1', { tagsAny: ['vip'], leadScoreMin: 30 }, NOW);
    expect(r.where).toEqual({
      ...BASELINE,
      tags: { hasSome: ['vip'] },
      leadScore: { gte: 30 },
    });
  });
});

describe('resolveAudienceWhere — limite (cap de verba/segurança)', () => {
  it('limit positivo → take', () => {
    expect(resolveAudienceWhere('org-1', { limit: 4000 }, NOW).take).toBe(4000);
  });

  it('limit inválido (0, negativo, não-número) → sem take', () => {
    expect(resolveAudienceWhere('org-1', { limit: 0 }, NOW).take).toBeUndefined();
    expect(resolveAudienceWhere('org-1', { limit: -5 }, NOW).take).toBeUndefined();
    expect(resolveAudienceWhere('org-1', { limit: 'x' }, NOW).take).toBeUndefined();
  });

  it('limit fracionário → arredonda para baixo', () => {
    expect(resolveAudienceWhere('org-1', { limit: 10.9 }, NOW).take).toBe(10);
  });
});
