/* ══════════════════════════════════════════════════════════════════════
 * Contrato do cadastro: um só catálogo para tela, API, banco e onboarding.
 * ══════════════════════════════════════════════════════════════════════ */

import { describe, it, expect } from 'vitest';
import { PLAN_IDS, isSelfSignupPlan } from './planConfig.js';
import {
  SIGNUP_PLAN_CHOSEN_VALUES,
  ONBOARDING_PATHS,
  isOnboardingPath,
  normalizarPlanoDoSignup,
} from './signupContract.js';

describe('signupContract: plan_chosen', () => {
  it('aceita exatamente os planos do catálogo, nem um a mais', () => {
    expect([...SIGNUP_PLAN_CHOSEN_VALUES].sort()).toEqual([...PLAN_IDS].sort());
  });

  it('inclui IZA_LITE, o plano de entrada que o cadastro pré-seleciona', () => {
    expect(SIGNUP_PLAN_CHOSEN_VALUES).toContain('IZA_LITE');
  });
});

describe('signupContract: onboarding_path', () => {
  it('inclui wizard, que é o caminho que o produto grava de verdade', () => {
    expect(ONBOARDING_PATHS).toContain('wizard');
  });

  it('mantém os dois caminhos históricos', () => {
    expect(ONBOARDING_PATHS).toContain('assisted');
    expect(ONBOARDING_PATHS).toContain('self_service');
  });

  it('isOnboardingPath recusa valor fora do catálogo', () => {
    expect(isOnboardingPath('wizard')).toBe(true);
    expect(isOnboardingPath('auto_service')).toBe(false);
    expect(isOnboardingPath(null)).toBe(false);
  });
});

describe('signupContract: normalizarPlanoDoSignup', () => {
  it('devolve IZA_LITE para o plano de entrada (era o caso que quebrava)', () => {
    expect(normalizarPlanoDoSignup('IZA_LITE')).toBe('IZA_LITE');
    expect(isSelfSignupPlan('IZA_LITE')).toBe(true);
  });

  it('aceita minúsculas e espaços', () => {
    expect(normalizarPlanoDoSignup('  growth ')).toBe('GROWTH');
  });

  it('preserva ENTERPRISE, que existe no catálogo mas não é self-signup', () => {
    expect(normalizarPlanoDoSignup('ENTERPRISE')).toBe('ENTERPRISE');
  });

  it('devolve null para plano desconhecido e para vazio', () => {
    expect(normalizarPlanoDoSignup('PLANO_QUE_NAO_EXISTE')).toBeNull();
    expect(normalizarPlanoDoSignup('')).toBeNull();
    expect(normalizarPlanoDoSignup(null)).toBeNull();
    expect(normalizarPlanoDoSignup(undefined)).toBeNull();
  });

  it('não devolve STARTER por engano quando o plano é o Lite', () => {
    // O defeito A242: o Lite caía em STARTER, plano descontinuado.
    expect(normalizarPlanoDoSignup('IZA_LITE')).not.toBe('STARTER');
  });
});
