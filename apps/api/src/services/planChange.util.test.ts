import { describe, it, expect } from 'vitest';
import {
  classifyPlanChange,
  isImmediateCharge,
  isScheduled,
  type PlanSelection,
} from './planChange.util.js';

const sel = (plan: PlanSelection['plan'], cycle: PlanSelection['cycle']): PlanSelection => ({
  plan,
  cycle,
});

describe('classifyPlanChange', () => {
  describe('noop', () => {
    it('mesmo plano e mesmo ciclo (mensal)', () => {
      expect(classifyPlanChange(sel('GROWTH', 'monthly'), sel('GROWTH', 'monthly'))).toEqual({
        kind: 'noop',
        effectiveTiming: 'none',
      });
    });
    it('mesmo plano e mesmo ciclo (anual)', () => {
      expect(classifyPlanChange(sel('SCALE', 'annual'), sel('SCALE', 'annual')).kind).toBe('noop');
    });
  });

  describe('upgrade de tier — imediato, qualquer ciclo', () => {
    it('Lite→Growth mensal', () => {
      expect(classifyPlanChange(sel('IZA_LITE', 'monthly'), sel('GROWTH', 'monthly'))).toEqual({
        kind: 'upgrade',
        effectiveTiming: 'immediate',
      });
    });
    it('Growth→Scale anual', () => {
      expect(classifyPlanChange(sel('GROWTH', 'annual'), sel('SCALE', 'annual')).kind).toBe('upgrade');
    });
    it('Lite mensal → Scale anual (sobe tier e ciclo)', () => {
      expect(classifyPlanChange(sel('IZA_LITE', 'monthly'), sel('SCALE', 'annual')).kind).toBe('upgrade');
    });
    it('Scale anual → Growth... NÃO é upgrade (é redução)', () => {
      expect(classifyPlanChange(sel('SCALE', 'annual'), sel('GROWTH', 'annual')).kind).not.toBe('upgrade');
    });
  });

  describe('mensal → anual (mesmo tier) = upgrade imediato', () => {
    it('Growth mensal → Growth anual', () => {
      expect(classifyPlanChange(sel('GROWTH', 'monthly'), sel('GROWTH', 'annual'))).toEqual({
        kind: 'upgrade',
        effectiveTiming: 'immediate',
      });
    });
  });

  describe('downgrade mensal = fim do ciclo', () => {
    it('Scale mensal → Growth mensal', () => {
      expect(classifyPlanChange(sel('SCALE', 'monthly'), sel('GROWTH', 'monthly'))).toEqual({
        kind: 'downgrade',
        effectiveTiming: 'period_end',
      });
    });
    it('Growth mensal → Lite mensal', () => {
      expect(classifyPlanChange(sel('GROWTH', 'monthly'), sel('IZA_LITE', 'monthly')).kind).toBe('downgrade');
    });
  });

  describe('downgrade anual = travado, só na renovação', () => {
    it('Scale anual → Growth anual (reduz tier no anual)', () => {
      expect(classifyPlanChange(sel('SCALE', 'annual'), sel('GROWTH', 'annual'))).toEqual({
        kind: 'downgrade_annual_locked',
        effectiveTiming: 'renewal',
      });
    });
    it('Growth anual → Growth mensal (anual→mensal mesmo tier)', () => {
      expect(classifyPlanChange(sel('GROWTH', 'annual'), sel('GROWTH', 'monthly'))).toEqual({
        kind: 'downgrade_annual_locked',
        effectiveTiming: 'renewal',
      });
    });
    it('Scale anual → Lite mensal (reduz tier E mensaliza)', () => {
      expect(classifyPlanChange(sel('SCALE', 'annual'), sel('IZA_LITE', 'monthly')).kind).toBe(
        'downgrade_annual_locked'
      );
    });
    it('cliente anual NUNCA gera downgrade imediato', () => {
      const combos: Array<[PlanSelection, PlanSelection]> = [
        [sel('SCALE', 'annual'), sel('GROWTH', 'annual')],
        [sel('SCALE', 'annual'), sel('GROWTH', 'monthly')],
        [sel('GROWTH', 'annual'), sel('IZA_LITE', 'annual')],
        [sel('GROWTH', 'annual'), sel('IZA_LITE', 'monthly')],
      ];
      for (const [a, b] of combos) {
        const c = classifyPlanChange(a, b);
        expect(c.kind).toBe('downgrade_annual_locked');
        expect(c.effectiveTiming).toBe('renewal');
      }
    });
  });

  describe('Enterprise como alvo = contact_sales', () => {
    it('Growth → Enterprise', () => {
      expect(classifyPlanChange(sel('GROWTH', 'monthly'), sel('ENTERPRISE', 'monthly'))).toEqual({
        kind: 'contact_sales',
        effectiveTiming: 'none',
      });
    });
    it('Enterprise → Enterprise ainda é contact_sales (não noop)', () => {
      // Enterprise é sob consulta; troca dentro dele passa por vendas.
      expect(classifyPlanChange(sel('ENTERPRISE', 'annual'), sel('ENTERPRISE', 'annual')).kind).toBe(
        'contact_sales'
      );
    });
  });

  describe('helpers', () => {
    it('isImmediateCharge só p/ upgrade', () => {
      expect(isImmediateCharge(classifyPlanChange(sel('GROWTH', 'monthly'), sel('SCALE', 'monthly')))).toBe(true);
      expect(isImmediateCharge(classifyPlanChange(sel('SCALE', 'monthly'), sel('GROWTH', 'monthly')))).toBe(false);
    });
    it('isScheduled p/ ambos downgrades', () => {
      expect(isScheduled(classifyPlanChange(sel('SCALE', 'monthly'), sel('GROWTH', 'monthly')))).toBe(true);
      expect(isScheduled(classifyPlanChange(sel('SCALE', 'annual'), sel('GROWTH', 'annual')))).toBe(true);
      expect(isScheduled(classifyPlanChange(sel('GROWTH', 'monthly'), sel('SCALE', 'monthly')))).toBe(false);
    });
  });
});
