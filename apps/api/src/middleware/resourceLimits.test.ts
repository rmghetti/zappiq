import { describe, it, expect } from 'vitest';
import { decideResourceLimit, resourceLimitBody } from './planLimits.js';

describe('decideResourceLimit (Camada 2 — pura)', () => {
  it('ilimitado (-1) sempre passa', () => {
    const d = decideResourceLimit({ limit: -1, current: 9999, delta: 1, mode: 'enforce' });
    expect(d.allowed).toBe(true);
    expect(d.withinLimit).toBe(true);
  });

  it('dentro do limite → permite (ambos os modos)', () => {
    expect(decideResourceLimit({ limit: 1000, current: 999, delta: 1, mode: 'enforce' }).allowed).toBe(true);
    expect(decideResourceLimit({ limit: 1000, current: 999, delta: 1, mode: 'audit_only' }).allowed).toBe(true);
  });

  it('no teto exato (current+delta == limit) → permite', () => {
    const d = decideResourceLimit({ limit: 1000, current: 999, delta: 1, mode: 'enforce' });
    expect(d.withinLimit).toBe(true);
    expect(d.allowed).toBe(true);
  });

  it('estouraria + enforce → BLOQUEIA (allowed false, withinLimit false)', () => {
    const d = decideResourceLimit({ limit: 1000, current: 1000, delta: 1, mode: 'enforce' });
    expect(d.withinLimit).toBe(false);
    expect(d.allowed).toBe(false);
  });

  it('estouraria + audit_only → NÃO bloqueia mas marca withinLimit false (observa)', () => {
    const d = decideResourceLimit({ limit: 1000, current: 1000, delta: 1, mode: 'audit_only' });
    expect(d.withinLimit).toBe(false);
    expect(d.allowed).toBe(true);
  });

  it('addon subiu o limite: 6000 efetivo permite o 1001º contato', () => {
    // limite base 1000 + CONTACTS_PACK_5K (=6000) → cabe folgado
    const d = decideResourceLimit({ limit: 6000, current: 1000, delta: 1, mode: 'enforce' });
    expect(d.allowed).toBe(true);
  });
});

describe('resourceLimitBody', () => {
  it('monta 429 com kind/limit/current', () => {
    const body = resourceLimitBody('contacts', {
      allowed: false,
      withinLimit: false,
      limit: 1000,
      current: 1000,
      mode: 'enforce',
    });
    expect(body.error).toBe('plan_limit_exceeded');
    expect(body.kind).toBe('contacts');
    expect(body.limit).toBe(1000);
    expect(body.upgradeUrl).toBe('/billing');
  });
});
