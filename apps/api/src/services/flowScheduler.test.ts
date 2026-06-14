import { describe, it, expect } from 'vitest';
import { computeRunAt, validateTimerFire, buildStoredFlowState } from './flowScheduler.js';

const NOW = new Date('2026-06-11T12:00:00.000Z');

describe('computeRunAt', () => {
  it('delayMinutes vira now + delay', () => {
    expect(computeRunAt({ kind: 'wait', delayMinutes: 60, runAt: null, resumeNodeId: 'n' }, NOW).toISOString())
      .toBe('2026-06-11T13:00:00.000Z');
  });
  it('runAt absoluto tem precedência', () => {
    expect(computeRunAt({ kind: 'schedule', delayMinutes: null, runAt: '2026-06-12T09:00:00.000Z', resumeNodeId: 'n' }, NOW).toISOString())
      .toBe('2026-06-12T09:00:00.000Z');
  });
  it('runAt no passado é clampado para now+1min (não dispara retroativo em rajada)', () => {
    expect(computeRunAt({ kind: 'schedule', delayMinutes: null, runAt: '2020-01-01T00:00:00.000Z', resumeNodeId: 'n' }, NOW).getTime())
      .toBe(NOW.getTime() + 60_000);
  });
});

describe('validateTimerFire', () => {
  const base = {
    timer: { kind: 'wait', flowVersion: 3, status: 'pending' },
    flow: { isActive: true, version: 3 },
    aiPaused: false,
    lastInboundAt: new Date('2026-06-11T11:30:00.000Z'),
    timerCreatedAt: new Date('2026-06-11T11:40:00.000Z'),
    now: NOW,
  };
  it('tudo válido → fire', () => {
    expect(validateTimerFire(base as any)).toEqual({ ok: true });
  });
  it('fluxo despublicado → cancelled', () => {
    expect(validateTimerFire({ ...base, flow: { ...base.flow, isActive: false } } as any))
      .toEqual({ ok: false, status: 'cancelled', reason: 'flow_inactive' });
  });
  it('versão mudou (publish/restore) → cancelled', () => {
    expect(validateTimerFire({ ...base, flow: { ...base.flow, version: 4 } } as any))
      .toEqual({ ok: false, status: 'cancelled', reason: 'flow_version_changed' });
  });
  it('takeover humano (IA pausada) → cancelled', () => {
    expect(validateTimerFire({ ...base, aiPaused: true } as any))
      .toEqual({ ok: false, status: 'cancelled', reason: 'human_takeover' });
  });
  it('wait: cliente respondeu depois do agendamento → cancelled', () => {
    expect(validateTimerFire({ ...base, lastInboundAt: new Date('2026-06-11T11:50:00.000Z') } as any))
      .toEqual({ ok: false, status: 'cancelled', reason: 'customer_replied' });
  });
  it('schedule: resposta do cliente NÃO cancela', () => {
    expect(validateTimerFire({
      ...base,
      timer: { ...base.timer, kind: 'schedule' },
      lastInboundAt: new Date('2026-06-11T11:50:00.000Z'),
    } as any)).toEqual({ ok: true });
  });
  it('fora da janela de 24h da Meta → expired (não envia mensagem livre)', () => {
    expect(validateTimerFire({ ...base, lastInboundAt: new Date('2026-06-10T11:00:00.000Z'), timerCreatedAt: new Date('2026-06-10T11:05:00.000Z') } as any))
      .toEqual({ ok: false, status: 'expired', reason: 'meta_24h_window' });
  });
});

describe('buildStoredFlowState (mesma regra de persistência do flowRuntime)', () => {
  it('cursor non-null → salva com flowId e callStack (próximo inbound continua no fluxo)', () => {
    expect(buildStoredFlowState({ cursor: 'node-7', vars: { nome: 'Ana' } }, 'flow-1'))
      .toEqual({ cursor: 'node-7', vars: { nome: 'Ana' }, flowId: 'flow-1', callStack: [] });
  });
  it('cursor non-null com callStack → preserva callStack (subfluxo com timer)', () => {
    expect(buildStoredFlowState({ cursor: 'node-7', vars: {}, callStack: [{ flowId: 'caller', returnNodeId: 'ret-1' }] } as any, 'flow-1'))
      .toEqual({ cursor: 'node-7', vars: {}, flowId: 'flow-1', callStack: [{ flowId: 'caller', returnNodeId: 'ret-1' }] });
  });
  it('cursor null → ENDED com callStack:[] (Iza pura assume; timer retoma do snapshot)', () => {
    expect(buildStoredFlowState({ cursor: null, vars: { nome: 'Ana' } }, 'flow-1'))
      .toEqual({ cursor: '__ended__', vars: { nome: 'Ana' }, callStack: [] });
  });
  it('state undefined → ENDED com vars vazio e callStack:[] (defensivo)', () => {
    expect(buildStoredFlowState(undefined, 'flow-1'))
      .toEqual({ cursor: '__ended__', vars: {}, callStack: [] });
  });
});
