import { describe, it, expect } from 'vitest';
import { pickFlowForMessage, type RoutableFlow } from './flowRouter.js';

function f(p: Partial<RoutableFlow>): RoutableFlow {
  return {
    id: 'f', triggerType: 'FIRST_CONTACT', triggerConfig: null,
    priority: 0, updatedAt: new Date('2026-06-01'), ...p,
  } as RoutableFlow;
}

describe('pickFlowForMessage', () => {
  it('keyword exata vence keyword substring', () => {
    const exact = f({ id: 'exact', triggerType: 'KEYWORD', triggerConfig: { keywords: ['promo'] } });
    const sub = f({ id: 'sub', triggerType: 'KEYWORD', triggerConfig: { keywords: ['pro'] } });
    expect(pickFlowForMessage([sub, exact], 'promo', { conversationEnded: false })?.id).toBe('exact');
  });
  it('keyword vence FIRST_CONTACT', () => {
    const kw = f({ id: 'kw', triggerType: 'KEYWORD', triggerConfig: { keywords: ['agendar'] } });
    const fc = f({ id: 'fc', triggerType: 'FIRST_CONTACT' });
    expect(pickFlowForMessage([fc, kw], 'quero agendar', { conversationEnded: false })?.id).toBe('kw');
  });
  it('desempata por priority e depois por updatedAt mais recente', () => {
    const a = f({ id: 'a', priority: 1 });
    const b = f({ id: 'b', priority: 5 });
    expect(pickFlowForMessage([a, b], 'oi', { conversationEnded: false })?.id).toBe('b');
    const c = f({ id: 'c', priority: 5, updatedAt: new Date('2026-06-10') });
    expect(pickFlowForMessage([b, c], 'oi', { conversationEnded: false })?.id).toBe('c');
  });
  it('conversa já encerrada (ENDED): só keyword re-dispara, nunca FIRST_CONTACT', () => {
    const fc = f({ id: 'fc', triggerType: 'FIRST_CONTACT' });
    const kw = f({ id: 'kw', triggerType: 'KEYWORD', triggerConfig: { keywords: ['humano'] } });
    expect(pickFlowForMessage([fc], 'oi', { conversationEnded: true })).toBeNull();
    expect(pickFlowForMessage([fc, kw], 'falar com humano', { conversationEnded: true })?.id).toBe('kw');
  });
  it('SCHEDULE/MANUAL/EVENT não auto-iniciam no inbound (fail-closed)', () => {
    const ev = f({ id: 'ev', triggerType: 'EVENT' });
    expect(pickFlowForMessage([ev], 'qualquer', { conversationEnded: false })).toBeNull();
  });
  it('nenhum match → null (Iza pura assume)', () => {
    const kw = f({ id: 'kw', triggerType: 'KEYWORD', triggerConfig: { keywords: ['preço'] } });
    expect(pickFlowForMessage([kw], 'bom dia', { conversationEnded: false })).toBeNull();
  });
});
