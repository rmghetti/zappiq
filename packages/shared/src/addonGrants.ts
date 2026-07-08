/* ══════════════════════════════════════════════════════════════════════
 * addonGrants — quanto cada addon recorrente "de pacote" AUMENTA no limite.
 * --------------------------------------------------------------------
 * Fonte única do mapa addon→limite. Consumido por:
 *   - getEffectivePlan (planLimits): soma ao limite do plano.
 *   - billingUsage: mostra o limite efetivo (plano + addons) na UI.
 *
 * Função pura (applyAddonGrants). Limite -1 (ilimitado) permanece -1.
 * EXTRA_IG_DIRECT é um canal (não um limite numérico do PlanLimits): entra
 * na lista de addons de pacote (é registrado), mas não concede limite aqui.
 * ══════════════════════════════════════════════════════════════════════ */
import type { PlanLimits } from './planConfig.js';

/** Keys dos addons recorrentes "de pacote" (capacidade/canal). NÃO inclui
 *  Impulso (assinatura separada) nem packs one-shot / overage. */
export const V4_PACKAGE_ADDON_KEYS = [
  'EXTRA_WA_NUMBER',
  'EXTRA_IG_DIRECT',
  'CONTACTS_PACK_5K',
  'CONTACTS_PACK_25K',
  'FLOWS_PACK_5',
  'KB_DOCS_PACK_25',
  'KB_DOCS_PACK_100',
  'AGENT_SEAT',
  'INTEGRATIONS_PACK_5',
] as const;

export type V4PackageAddonKey = (typeof V4_PACKAGE_ADDON_KEYS)[number];

export function isV4PackageAddonKey(k: unknown): k is V4PackageAddonKey {
  return typeof k === 'string' && (V4_PACKAGE_ADDON_KEYS as readonly string[]).includes(k);
}

/** addon key → delta que ele soma nos limites do plano (por unidade contratada). */
export const ADDON_LIMIT_GRANTS: Record<string, Partial<PlanLimits>> = {
  CONTACTS_PACK_5K: { contacts: 5_000 },
  CONTACTS_PACK_25K: { contacts: 25_000 },
  FLOWS_PACK_5: { flows: 5 },
  KB_DOCS_PACK_25: { knowledgeBaseDocs: 25 },
  KB_DOCS_PACK_100: { knowledgeBaseDocs: 100 },
  AGENT_SEAT: { agents: 1 },
  EXTRA_WA_NUMBER: { whatsappNumbers: 1 },
  INTEGRATIONS_PACK_5: { integrations: 5 },
  // EXTRA_IG_DIRECT: canal, sem limite numérico no PlanLimits (registrado, não soma).
};

/**
 * Aplica os addons ativos aos limites base do plano. Pura.
 * - Cada key presente soma seu delta (uma unidade por key; a UI é 1 por addon).
 * - Limite base -1 (ilimitado) permanece -1 (addon não "limita" o ilimitado).
 * - Keys sem grant (ex.: EXTRA_IG_DIRECT, keys desconhecidas) são ignoradas.
 */
export function applyAddonGrants(base: PlanLimits, activeAddonKeys: readonly string[]): PlanLimits {
  const out: PlanLimits = { ...base };
  const seen = new Set<string>();
  for (const key of activeAddonKeys) {
    if (seen.has(key)) continue; // dedup: cada addon soma uma vez
    seen.add(key);
    const grant = ADDON_LIMIT_GRANTS[key];
    if (!grant) continue;
    for (const [field, delta] of Object.entries(grant) as [keyof PlanLimits, number][]) {
      if (out[field] === -1) continue; // ilimitado permanece ilimitado
      out[field] = out[field] + delta;
    }
  }
  return out;
}
