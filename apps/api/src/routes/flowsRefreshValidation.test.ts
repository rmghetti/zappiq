import { describe, it, expect } from 'vitest';
import { sameStructure } from './flowsRefreshValidation.js';

const A = [{ id: 'a', type: 'start' }, { id: 'b', type: 'message', data: { text: 'x' } }];

describe('sameStructure', () => {
  it('mesmos ids e tipos → true (conteúdo pode diferir)', () => {
    const B = [{ id: 'a', type: 'start' }, { id: 'b', type: 'message', data: { text: 'NOVO' } }];
    expect(sameStructure(A as any, B as any)).toBe(true);
  });
  it('nó a mais/a menos/tipo diferente → false', () => {
    expect(sameStructure(A as any, [A[0]] as any)).toBe(false);
    expect(sameStructure(A as any, [...A, { id: 'c', type: 'ai' }] as any)).toBe(false);
    expect(sameStructure(A as any, [{ id: 'a', type: 'start' }, { id: 'b', type: 'ai' }] as any)).toBe(false);
  });
});
