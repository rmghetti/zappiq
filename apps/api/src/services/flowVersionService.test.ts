import { describe, it, expect } from 'vitest';
import { buildVersionSnapshot } from './flowVersionService.js';

const FLOW = {
  id: 'f1', organizationId: 'org1', name: 'Boas-vindas',
  nodes: [{ id: 's', type: 'start' }], edges: [],
  triggerType: 'FIRST_CONTACT', triggerConfig: null, version: 3,
};

describe('buildVersionSnapshot', () => {
  it('monta o snapshot imutável com a versão informada e a origem', () => {
    const snap = buildVersionSnapshot(FLOW as any, 4, 'publish', 'user-9');
    expect(snap).toEqual({
      flowId: 'f1', organizationId: 'org1', version: 4, name: 'Boas-vindas',
      nodes: [{ id: 's', type: 'start' }], edges: [],
      triggerType: 'FIRST_CONTACT', triggerConfig: null,
      source: 'publish', createdById: 'user-9',
    });
  });
  it('createdById null para ações de sistema', () => {
    const snap = buildVersionSnapshot(FLOW as any, 4, 'refresh', null);
    expect(snap.createdById).toBeNull();
    expect(snap.source).toBe('refresh');
  });
});
