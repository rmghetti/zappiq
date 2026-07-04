import { describe, it, expect } from 'vitest';
import { normalizePlanChosen } from './onboarding.js';

// Fix do §0.6 — o onboarding forçava STARTER e perdia o plano escolhido no
// site (signups.plan_chosen). normalizePlanChosen mapeia o texto do lead para
// um PlanType válido; a rota usa o retorno (ou STARTER como fallback).
describe('normalizePlanChosen', () => {
  it('reconhece planos válidos independente de caixa/espaços', () => {
    expect(normalizePlanChosen('SCALE')).toBe('SCALE');
    expect(normalizePlanChosen('scale')).toBe('SCALE');
    expect(normalizePlanChosen('  Growth ')).toBe('GROWTH');
    expect(normalizePlanChosen('starter')).toBe('STARTER');
    expect(normalizePlanChosen('BUSINESS')).toBe('BUSINESS');
    expect(normalizePlanChosen('enterprise')).toBe('ENTERPRISE');
  });

  it('retorna null para valores desconhecidos ou vazios (rota cai em STARTER)', () => {
    expect(normalizePlanChosen(null)).toBeNull();
    expect(normalizePlanChosen(undefined)).toBeNull();
    expect(normalizePlanChosen('')).toBeNull();
    expect(normalizePlanChosen('PRO')).toBeNull();
    expect(normalizePlanChosen('free')).toBeNull();
  });
});
