import { describe, it, expect } from 'vitest';
import { resolveSchedulingAccess } from './schedulingEntitlement.js';

describe('resolveSchedulingAccess', () => {
  it('incluído do Growth pra cima (sem add-on)', () => {
    for (const p of ['GROWTH', 'SCALE', 'BUSINESS', 'ENTERPRISE'] as const) {
      expect(resolveSchedulingAccess(p, [])).toEqual({ entitled: true, reason: 'included' });
    }
  });

  it('Lite sem add-on: bloqueado', () => {
    expect(resolveSchedulingAccess('IZA_LITE', [])).toEqual({ entitled: false, reason: 'none' });
    expect(resolveSchedulingAccess('IZA_LITE', ['CONTACTS_PACK_5K'])).toEqual({ entitled: false, reason: 'none' });
  });

  it('Lite COM o add-on SCHEDULING_AGENT: liberado', () => {
    expect(resolveSchedulingAccess('IZA_LITE', ['SCHEDULING_AGENT'])).toEqual({ entitled: true, reason: 'addon' });
  });

  it('STARTER (descontinuado) tratado como Lite: precisa do add-on', () => {
    expect(resolveSchedulingAccess('STARTER', []).entitled).toBe(false);
    expect(resolveSchedulingAccess('STARTER', ['SCHEDULING_AGENT']).entitled).toBe(true);
  });
});
