import { describe, it, expect } from 'vitest';
import { recommendPlan, mapLegacyToV4 } from './planRecommendation.js';

describe('mapLegacyToV4', () => {
  it('mapeia legado para o V4 mais próximo (piso)', () => {
    expect(mapLegacyToV4('STARTER')).toBe('IZA_LITE');
    expect(mapLegacyToV4('BUSINESS')).toBe('SCALE');
    expect(mapLegacyToV4('ENTERPRISE')).toBe('SCALE');
    expect(mapLegacyToV4('GROWTH')).toBe('GROWTH');
  });
});

describe('recommendPlan', () => {
  it('uso baixo + testou STARTER → recomenda IZA_LITE anual', () => {
    const r = recommendPlan({ aiMessages: 400, contacts: 200, agents: 1, broadcasts: 50 }, 'STARTER');
    expect(r.planId).toBe('IZA_LITE');
    expect(r.cycle).toBe('annual');
    expect(r.addonSuggestions).toHaveLength(0);
  });

  it('estouro grande de mensagens → sobe para GROWTH', () => {
    const r = recommendPlan({ aiMessages: 6000, contacts: 500, agents: 2, broadcasts: 100 }, 'STARTER');
    expect(r.planId).toBe('GROWTH');
  });

  it('nunca recomenda abaixo do plano testado (BUSINESS→SCALE)', () => {
    const r = recommendPlan({ aiMessages: 100, contacts: 10, agents: 1, broadcasts: 0 }, 'BUSINESS');
    expect(r.planId).toBe('SCALE');
  });

  it('estouro pequeno em 1 dimensão → mantém plano e sugere addon', () => {
    const r = recommendPlan({ aiMessages: 1600, contacts: 200, agents: 1, broadcasts: 50 }, 'STARTER');
    expect(r.planId).toBe('IZA_LITE');
    expect(r.addonSuggestions.length).toBeGreaterThan(0);
    expect(r.addonSuggestions.map((a) => a.dimension)).toContain('aiMessages');
  });

  it('sempre devolve preço anual (mensal equivalente + economia)', () => {
    const r = recommendPlan({ aiMessages: 400, contacts: 200, agents: 1, broadcasts: 50 }, 'STARTER');
    expect(r.annualMonthlyBrl).toBeGreaterThan(0);
    expect(r.annualSavingsBrl).toBeGreaterThan(0);
    expect(r.annualMonthlyBrl).toBeLessThan(r.monthlyBrl);
  });
});
