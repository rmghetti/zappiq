/**
 * Maestro v3 (Spec 1A) — montagem do EvalContext (camada IO).
 * Compartilhado entre flowRuntime (inbound) e flowScheduler (retomada por timer)
 * para que contact_attr/business_hours/interpolação avaliem igual nos dois caminhos.
 * Fail-soft: erro ao carregar o contato → defaults seguros (não derruba o turno).
 */
import { prisma } from '@zappiq/database';
import { logger } from '../utils/logger.js';
import type { EvalContext, BusinessHoursConfig } from './flowEngine.js';

export async function buildEvalContext(params: {
  contactId?: string | null;
  orgSettings?: any;
  now?: Date;
}): Promise<EvalContext> {
  let contact: EvalContext['contact'] = {
    name: null, tags: [], leadStatus: null, leadScore: 0, funnelStage: null, customFields: {},
  };
  if (params.contactId) {
    try {
      const c = await prisma.contact.findUnique({
        where: { id: params.contactId },
        select: { name: true, tags: true, leadStatus: true, leadScore: true, funnelStage: true, customFields: true },
      });
      if (c) {
        contact = {
          name: c.name ?? null,
          tags: c.tags ?? [],
          leadStatus: c.leadStatus ? String(c.leadStatus) : null, // coerção enum→string
          leadScore: typeof c.leadScore === 'number' ? c.leadScore : 0,
          funnelStage: c.funnelStage ?? null,
          customFields: (c.customFields as Record<string, any>) ?? {},
        };
      }
    } catch (e) {
      logger.debug('[Maestro] buildEvalContext: contact load falhou — usando defaults', { contactId: params.contactId, err: String(e) });
    }
  }
  const bhRaw = params.orgSettings?.businessHoursConfig;
  const businessHours: BusinessHoursConfig | null =
    bhRaw && typeof bhRaw === 'object' && bhRaw.days ? (bhRaw as BusinessHoursConfig) : null;
  return {
    contact,
    now: params.now ?? new Date(),
    businessHours,
    system: {
      businessName: params.orgSettings?.businessName ?? params.orgSettings?.niche ?? undefined,
      agentName: params.orgSettings?.agentName ?? undefined,
    },
  };
}
