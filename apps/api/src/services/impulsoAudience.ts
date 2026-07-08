import type { Prisma, LeadStatus } from '@zappiq/database';

/*
 * Impulso — resolve o audienceSegment (JSON livre da campanha) num where do
 * Prisma para Contact. Allowlist de critérios: chaves desconhecidas do JSON
 * são ignoradas, nunca viram operador Prisma arbitrário (ex.: um segmento
 * não pode injetar "deleteMany" ou trocar "organizationId"). organizationId
 * e consentMarketing=true são aplicados por último, depois do segmento, para
 * que nada nele consiga desligar o piso de isolamento de tenant e de LGPD.
 */

const LEAD_STATUS_VALUES = new Set<LeadStatus>(['NEW', 'CONTACTED', 'QUALIFIED', 'UNQUALIFIED', 'CONVERTED']);
const DAY_MS = 86_400_000;

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

function stringArray(v: unknown): string[] {
  return Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string' && x.length > 0) : [];
}

export function resolveAudienceWhere(
  organizationId: string,
  segment: unknown,
  now: Date,
): { where: Prisma.ContactWhereInput; take?: number } {
  const where: Prisma.ContactWhereInput = {};
  let take: number | undefined;

  if (isPlainObject(segment)) {
    const tagsAny = stringArray(segment.tagsAny);
    if (tagsAny.length > 0) where.tags = { hasSome: tagsAny };

    const tagsAll = stringArray(segment.tagsAll);
    if (tagsAll.length > 0) where.tags = { hasEvery: tagsAll };

    const excludeTags = stringArray(segment.excludeTags);
    if (excludeTags.length > 0) where.NOT = { tags: { hasSome: excludeTags } };

    if (Array.isArray(segment.leadStatusIn)) {
      const valid = segment.leadStatusIn.filter(
        (v): v is LeadStatus => typeof v === 'string' && LEAD_STATUS_VALUES.has(v as LeadStatus),
      );
      if (valid.length > 0) where.leadStatus = { in: valid };
    }

    const funnelStageIn = stringArray(segment.funnelStageIn);
    if (funnelStageIn.length > 0) where.funnelStage = { in: funnelStageIn };

    const leadScoreMin = typeof segment.leadScoreMin === 'number' ? segment.leadScoreMin : undefined;
    const leadScoreMax = typeof segment.leadScoreMax === 'number' ? segment.leadScoreMax : undefined;
    if (leadScoreMin !== undefined || leadScoreMax !== undefined) {
      where.leadScore = {
        ...(leadScoreMin !== undefined ? { gte: leadScoreMin } : {}),
        ...(leadScoreMax !== undefined ? { lte: leadScoreMax } : {}),
      };
    }

    if (typeof segment.notInteractedForDays === 'number') {
      where.lastInteractionAt = { lt: new Date(now.getTime() - segment.notInteractedForDays * DAY_MS) };
    }
    if (typeof segment.interactedSinceDays === 'number') {
      where.lastInteractionAt = { gte: new Date(now.getTime() - segment.interactedSinceDays * DAY_MS) };
    }

    if (segment.hasEmail === true) {
      where.email = { not: null };
    }

    if (typeof segment.sourceCampaignId === 'string' && segment.sourceCampaignId.length > 0) {
      where.sourceCampaignId = segment.sourceCampaignId;
    }

    if (typeof segment.limit === 'number' && Number.isFinite(segment.limit) && segment.limit > 0) {
      take = Math.floor(segment.limit);
    }
  }

  // Piso de segurança — sempre por último, o segmento não sobrescreve.
  where.organizationId = organizationId;
  where.consentMarketing = true;

  return take !== undefined ? { where, take } : { where };
}
