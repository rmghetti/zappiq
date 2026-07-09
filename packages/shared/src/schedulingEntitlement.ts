/**
 * Entitlement do Agendamento pela IA.
 *
 * Regra comercial (Rodrigo, 2026-07-08): incluído a partir do GROWTH;
 * no IZA_LITE é add-on pago (SCHEDULING_AGENT, R$49/mês, anual -20%).
 * STARTER é plano descontinuado; tratado como Lite (precisa do add-on).
 */
import type { PlanId } from './planConfig.js';

/** Planos que já incluem o Agendamento sem custo adicional. */
export const SCHEDULING_INCLUDED_PLANS: PlanId[] = ['GROWTH', 'SCALE', 'BUSINESS', 'ENTERPRISE'];

export const SCHEDULING_ADDON_KEY = 'SCHEDULING_AGENT';

export type SchedulingAccessReason = 'included' | 'addon' | 'none';

export interface SchedulingAccess {
  entitled: boolean;
  reason: SchedulingAccessReason;
}

/**
 * Resolve o acesso ao Agendamento a partir do plano + add-ons ativos da org.
 * `activeAddonKeys` vem de organization.settings.addons (array de keys).
 */
export function resolveSchedulingAccess(plan: PlanId, activeAddonKeys: readonly string[] = []): SchedulingAccess {
  if (SCHEDULING_INCLUDED_PLANS.includes(plan)) return { entitled: true, reason: 'included' };
  if (activeAddonKeys.includes(SCHEDULING_ADDON_KEY)) return { entitled: true, reason: 'addon' };
  return { entitled: false, reason: 'none' };
}
