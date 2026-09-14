import { describe, it, expect } from 'vitest';
import { normalizePlanChosen } from './onboarding.js';
import { PLAN_IDS, SELF_SIGNUP_PLAN_IDS } from '@zappiq/shared';

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

// A242 (14/09/2026) — o plano de ENTRADA não era reconhecido. O lead que
// mantinha o padrão da tela (Lite) era rebaixado a STARTER, plano
// descontinuado, e a organização nascia no plano errado. A lista passou a
// derivar do catálogo de @zappiq/shared; nada mais é escrito à mão aqui.
describe('normalizePlanChosen — catálogo único (A242)', () => {
  it('reconhece IZA_LITE, o plano que a tela pré-seleciona', () => {
    expect(normalizePlanChosen('IZA_LITE')).toBe('IZA_LITE');
    expect(normalizePlanChosen('iza_lite')).toBe('IZA_LITE');
  });

  it('NÃO rebaixa o Lite para STARTER (o defeito)', () => {
    expect(normalizePlanChosen('IZA_LITE')).not.toBe('STARTER');
  });

  it('todo plano de self-signup é reconhecido', () => {
    for (const plano of SELF_SIGNUP_PLAN_IDS) {
      expect(normalizePlanChosen(plano)).toBe(plano);
    }
  });

  it('todo plano do catálogo é reconhecido (inclusive os descontinuados)', () => {
    for (const plano of PLAN_IDS) {
      expect(normalizePlanChosen(plano)).toBe(plano);
    }
  });
});
