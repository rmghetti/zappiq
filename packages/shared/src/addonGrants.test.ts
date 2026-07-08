import { describe, it, expect } from 'vitest';
import {
  applyAddonGrants,
  isV4PackageAddonKey,
  V4_PACKAGE_ADDON_KEYS,
  ADDON_LIMIT_GRANTS,
} from './addonGrants.js';
import type { PlanLimits } from './planConfig.js';

const base: PlanLimits = {
  agents: 1,
  aiMessagesPerMonth: 1500,
  broadcastsPerMonth: 200,
  contacts: 1000,
  flows: 3,
  whatsappNumbers: 1,
  knowledgeBaseDocs: 10,
  logRetentionDays: 90,
  integrations: 2,
  customIntegrationHoursPerMonth: 0,
};

describe('applyAddonGrants', () => {
  it('sem addons → limites intactos', () => {
    expect(applyAddonGrants(base, [])).toEqual(base);
  });

  it('CONTACTS_PACK_5K soma 5.000 contatos', () => {
    expect(applyAddonGrants(base, ['CONTACTS_PACK_5K']).contacts).toBe(6000);
  });

  it('soma vários addons de campos diferentes', () => {
    const eff = applyAddonGrants(base, ['CONTACTS_PACK_25K', 'AGENT_SEAT', 'EXTRA_WA_NUMBER', 'KB_DOCS_PACK_100']);
    expect(eff.contacts).toBe(26000);
    expect(eff.agents).toBe(2);
    expect(eff.whatsappNumbers).toBe(2);
    expect(eff.knowledgeBaseDocs).toBe(110);
    // campos não tocados seguem iguais
    expect(eff.flows).toBe(3);
  });

  it('dedup: mesma key duas vezes soma uma vez', () => {
    expect(applyAddonGrants(base, ['AGENT_SEAT', 'AGENT_SEAT']).agents).toBe(2);
  });

  it('ilimitado (-1) permanece -1', () => {
    const unlimited: PlanLimits = { ...base, contacts: -1 };
    expect(applyAddonGrants(unlimited, ['CONTACTS_PACK_25K']).contacts).toBe(-1);
  });

  it('EXTRA_IG_DIRECT é addon de pacote mas não soma limite numérico', () => {
    expect(isV4PackageAddonKey('EXTRA_IG_DIRECT')).toBe(true);
    expect(applyAddonGrants(base, ['EXTRA_IG_DIRECT'])).toEqual(base);
  });

  it('keys desconhecidas / Impulso são ignoradas nos grants', () => {
    expect(applyAddonGrants(base, ['IMPULSO_PRO', 'NAO_EXISTE'])).toEqual(base);
  });

  it('não muta o objeto base', () => {
    const snapshot = { ...base };
    applyAddonGrants(base, ['CONTACTS_PACK_5K']);
    expect(base).toEqual(snapshot);
  });
});

describe('mapa de grants ↔ keys de pacote', () => {
  it('toda key com grant é uma key de pacote reconhecida', () => {
    for (const k of Object.keys(ADDON_LIMIT_GRANTS)) {
      expect(isV4PackageAddonKey(k), k).toBe(true);
    }
  });
  it('V4_PACKAGE_ADDON_KEYS inclui os canais sem grant numérico', () => {
    expect(V4_PACKAGE_ADDON_KEYS).toContain('EXTRA_IG_DIRECT');
    expect(V4_PACKAGE_ADDON_KEYS).toContain('EXTRA_WA_NUMBER');
  });
});
