/* ══════════════════════════════════════════════════════════════════════
 * Regressão — Self-signup plan validation (bug 2026-06-25)
 * --------------------------------------------------------------------
 * Bug: as rotas de signup (/api/signup, /api/signup/google, /auth/callback,
 * /api/auth/confirm-signup) tinham `VALID_PLANS` hardcoded como
 * ['STARTER','GROWTH','SCALE','BUSINESS'] — SEM o IZA_LITE, que é o tier
 * default e "Mais escolhido" pré-selecionado no wizard /cadastro.
 *
 * Resultado: todo lead que mantinha o plano pré-selecionado (a maioria)
 * recebia "Plano inválido" no Magic Link e "Falha ao iniciar Google" no
 * OAuth — bloqueando 100% desses cadastros.
 *
 * Fix: rotas passaram a derivar a lista válida de PLAN_CONFIG via
 * SELF_SIGNUP_PLAN_IDS / isSelfSignupPlan (fonte única de verdade), então
 * adicionar/remover plano no config atualiza a validação automaticamente.
 *
 * Este teste vive no apps/api (único pacote com runner vitest) e valida o
 * contrato exportado por @zappiq/shared. Roda contra o dist buildado.
 * ══════════════════════════════════════════════════════════════════════ */

import { describe, it, expect } from 'vitest';
import {
  SELF_SIGNUP_PLAN_IDS,
  isSelfSignupPlan,
  PLAN_CONFIG,
  type PlanId,
} from '@zappiq/shared';

describe('self-signup plan validation', () => {
  it('inclui IZA_LITE (o tier default/entry do wizard) — a regressão do bug', () => {
    expect(SELF_SIGNUP_PLAN_IDS).toContain('IZA_LITE');
    expect(isSelfSignupPlan('IZA_LITE')).toBe(true);
  });

  it('inclui os planos ativos vendáveis no self-signup', () => {
    expect(SELF_SIGNUP_PLAN_IDS).toEqual(['IZA_LITE', 'GROWTH', 'SCALE']);
  });

  it('exclui planos deprecated (STARTER, BUSINESS)', () => {
    expect(isSelfSignupPlan('STARTER')).toBe(false);
    expect(isSelfSignupPlan('BUSINESS')).toBe(false);
  });

  it('exclui ENTERPRISE (sem preço, é por contato comercial)', () => {
    expect(isSelfSignupPlan('ENTERPRISE')).toBe(false);
  });

  it('rejeita valores inválidos sem quebrar (string aleatória / null / undefined)', () => {
    expect(isSelfSignupPlan('BOGUS')).toBe(false);
    expect(isSelfSignupPlan(null)).toBe(false);
    expect(isSelfSignupPlan(undefined)).toBe(false);
  });

  it('contrato: todo plano self-signup é ativo (não deprecated) e tem preço', () => {
    for (const id of SELF_SIGNUP_PLAN_IDS) {
      const cfg = PLAN_CONFIG[id as PlanId];
      expect(cfg.deprecated).not.toBe(true);
      expect(cfg.priceMonthly).not.toBeNull();
    }
  });
});
