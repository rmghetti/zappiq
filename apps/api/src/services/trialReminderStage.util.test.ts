import { describe, it, expect } from 'vitest';
import { pickTrialReminderStage, type TrialReminderSent } from './trialReminderStage.util.js';

const none: TrialReminderSent = { T0: false, T1: false, T2: false, T3: false };

describe('pickTrialReminderStage', () => {
  it('cadência diária normal: 3→T3, 2→T2, 1→T1, 0→T0', () => {
    expect(pickTrialReminderStage(3, none)).toBe('T3');
    expect(pickTrialReminderStage(2, { ...none, T3: true })).toBe('T2');
    expect(pickTrialReminderStage(1, { ...none, T3: true, T2: true })).toBe('T1');
    expect(pickTrialReminderStage(0, { ...none, T3: true, T2: true, T1: true })).toBe('T0');
  });

  it('dia pulado (dtl 3→1) manda o mais urgente aplicável, não um T-3 obsoleto', () => {
    expect(pickTrialReminderStage(1, none)).toBe('T1');
  });

  it('trial já vencido (dtl 0) manda T0 mesmo sem os anteriores', () => {
    expect(pickTrialReminderStage(0, none)).toBe('T0');
  });

  it('não duplica: se o stage do dtl já foi enviado, retorna null (ou o próximo urgente)', () => {
    expect(pickTrialReminderStage(3, { ...none, T3: true })).toBeNull();
    expect(pickTrialReminderStage(0, { T0: true, T1: false, T2: false, T3: false })).toBeNull();
  });

  it('ainda cedo (dtl ≥ 4) → null', () => {
    expect(pickTrialReminderStage(4, none)).toBeNull();
    expect(pickTrialReminderStage(14, none)).toBeNull();
  });

  it('tudo enviado → null', () => {
    expect(pickTrialReminderStage(0, { T0: true, T1: true, T2: true, T3: true })).toBeNull();
  });
});
