import { describe, it, expect } from 'vitest';
import { nextHopIntent } from './flowHop.js';
describe('nextHopIntent', () => {
  it('call', () => expect(nextHopIntent({ targetFlowId: 'S', mode: 'call' }, 'end', false)).toBe('call'));
  it('switch (goto one-way)', () => expect(nextHopIntent({ targetFlowId: 'S' }, 'end', false)).toBe('switch'));
  it('return quando fim com frames', () => expect(nextHopIntent(undefined, 'end', true)).toBe('return'));
  it('stop quando fim sem frames', () => expect(nextHopIntent(undefined, 'end', false)).toBe('stop'));
  it('stop em await_input mesmo com frames', () => expect(nextHopIntent(undefined, 'await_input', true)).toBe('stop'));
});
