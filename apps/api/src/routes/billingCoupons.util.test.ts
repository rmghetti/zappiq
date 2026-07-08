import { describe, it, expect } from 'vitest';
import {
  isAllowedPercent,
  isCouponDuration,
  generateCouponCode,
  bytesToCode,
  buildCouponCreateParams,
  ALLOWED_PERCENTS,
} from './billingCoupons.util.js';

describe('validações', () => {
  it('percentuais permitidos = 10..100 passo 10', () => {
    expect(ALLOWED_PERCENTS).toEqual([10, 20, 30, 40, 50, 60, 70, 80, 90, 100]);
    expect(isAllowedPercent(30)).toBe(true);
    expect(isAllowedPercent(100)).toBe(true);
    expect(isAllowedPercent(25)).toBe(false);
    expect(isAllowedPercent(0)).toBe(false);
    expect(isAllowedPercent(110)).toBe(false);
  });
  it('durações válidas', () => {
    expect(isCouponDuration('once')).toBe(true);
    expect(isCouponDuration('repeating')).toBe(true);
    expect(isCouponDuration('forever')).toBe(true);
    expect(isCouponDuration('weekly')).toBe(false);
  });
});

describe('geração de código', () => {
  it('prefixo do produto + corpo alfanumérico', () => {
    expect(generateCouponCode('GROWTH', 'abc123xy')).toBe('GRO-ABC123XY');
    expect(generateCouponCode('AGENT_SEAT', 'k3q9x7m2')).toBe('AGE-K3Q9X7M2');
  });
  it('remove ambíguos do corpo e limita a 8', () => {
    const code = generateCouponCode('SCALE', 'a!b@c#d$e%f^g&h*');
    expect(code.startsWith('SCA-')).toBe(true);
    expect(code.slice(4)).toMatch(/^[A-Z0-9]{1,8}$/);
  });
  it('key sem letras → prefixo ZAP', () => {
    expect(generateCouponCode('123', 'xyzw')).toBe('ZAP-XYZW');
  });
  it('bytesToCode usa só o alfabeto seguro (sem 0/O/1/I/L)', () => {
    const code = bytesToCode(new Uint8Array([0, 5, 10, 20, 30, 40, 250, 3]), 8);
    expect(code).toMatch(/^[ABCDEFGHJKMNPQRSTUVWXYZ23456789]{8}$/);
    expect(code).not.toMatch(/[O01IL]/);
  });
});

describe('buildCouponCreateParams', () => {
  const PID = 'prod_UaxMhgBJ6c0HDl';

  it('sempre escopa ao produto e trava uso único', () => {
    const p = buildCouponCreateParams({ percentOff: 30, productId: PID, duration: 'once' });
    expect(p.applies_to.products).toEqual([PID]);
    expect(p.max_redemptions).toBe(1);
    expect(p.percent_off).toBe(30);
    expect(p.duration).toBe('once');
    expect(p.duration_in_months).toBeUndefined();
  });

  it('repeating exige duration_in_months', () => {
    const p = buildCouponCreateParams({ percentOff: 50, productId: PID, duration: 'repeating', durationInMonths: 6 });
    expect(p.duration).toBe('repeating');
    expect(p.duration_in_months).toBe(6);
  });

  it('forever não leva duration_in_months', () => {
    const p = buildCouponCreateParams({ percentOff: 100, productId: PID, duration: 'forever' });
    expect(p.duration).toBe('forever');
    expect(p.duration_in_months).toBeUndefined();
  });

  it('rejeita percentual inválido', () => {
    expect(() => buildCouponCreateParams({ percentOff: 25, productId: PID, duration: 'once' })).toThrow('invalid_percent');
  });
  it('rejeita produto vazio', () => {
    expect(() => buildCouponCreateParams({ percentOff: 30, productId: '', duration: 'once' })).toThrow('invalid_product');
  });
  it('rejeita repeating sem meses válidos', () => {
    expect(() => buildCouponCreateParams({ percentOff: 30, productId: PID, duration: 'repeating' })).toThrow('invalid_duration_months');
    expect(() => buildCouponCreateParams({ percentOff: 30, productId: PID, duration: 'repeating', durationInMonths: 0 })).toThrow('invalid_duration_months');
  });
});
