import { describe, it, expect } from 'vitest';
import { trainingFieldsChanged } from './trainingChange.js';

describe('trainingFieldsChanged', () => {
  it('mudança de identidade (tone) → true', () => {
    expect(trainingFieldsChanged({ tone: 'formal', x: 1 }, { tone: 'casual', x: 1 })).toBe(true);
  });
  it('mudança de businessHoursConfig → true', () => {
    expect(trainingFieldsChanged({ businessHoursConfig: { timezone: 'A' } }, { businessHoursConfig: { timezone: 'B' } })).toBe(true);
  });
  it('só campo não-treino mudou (ex: maestro.enabled) → false', () => {
    expect(trainingFieldsChanged({ tone: 'x', maestro: { enabled: false } }, { tone: 'x', maestro: { enabled: true } })).toBe(false);
  });
  it('settings idênticas → false', () => {
    expect(trainingFieldsChanged({ niche: 'varejo', surveyAnswers: { a: 1 } }, { niche: 'varejo', surveyAnswers: { a: 1 } })).toBe(false);
  });
  it('campo de treino adicionado (antes ausente) → true', () => {
    expect(trainingFieldsChanged({}, { businessName: 'Loja X' })).toBe(true);
  });
  it('null/undefined safe', () => {
    expect(trainingFieldsChanged(null, null)).toBe(false);
    expect(trainingFieldsChanged(undefined, { tone: 'x' })).toBe(true);
  });
});
