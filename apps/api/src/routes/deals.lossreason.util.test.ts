import { describe, it, expect } from 'vitest';
import { normalizeLossReason, LOSS_REASONS } from './deals.lossreason.util.js';

describe('normalizeLossReason', () => {
  it('aceita o valor canônico do enum (UPPERCASE)', () => {
    expect(normalizeLossReason('lost', 'PRICE')).toBe('PRICE');
    expect(normalizeLossReason('lost', 'NO_BUDGET')).toBe('NO_BUDGET');
  });

  it('normaliza minúsculo (front legado) para o enum UPPERCASE — o bug', () => {
    expect(normalizeLossReason('lost', 'price')).toBe('PRICE');
    expect(normalizeLossReason('lost', 'no_response')).toBe('NO_RESPONSE');
    expect(normalizeLossReason('lost', 'competitor')).toBe('COMPETITOR');
  });

  it('mapeia o alias legado morto not_qualified -> OTHER', () => {
    expect(normalizeLossReason('lost', 'not_qualified')).toBe('OTHER');
    expect(normalizeLossReason('lost', 'NOT_QUALIFIED')).toBe('OTHER');
  });

  it('valor inválido vira null (o move acontece, só não grava motivo)', () => {
    expect(normalizeLossReason('lost', 'garbage')).toBeNull();
    expect(normalizeLossReason('lost', 123)).toBeNull();
  });

  it('só grava motivo quando o estágio é lost', () => {
    expect(normalizeLossReason('proposal', 'PRICE')).toBeNull();
    expect(normalizeLossReason('won', 'price')).toBeNull();
  });

  it('sem motivo -> null', () => {
    expect(normalizeLossReason('lost', undefined)).toBeNull();
    expect(normalizeLossReason('lost', null)).toBeNull();
    expect(normalizeLossReason('lost', '')).toBeNull();
  });

  it('todos os 7 valores do enum são aceitos', () => {
    for (const v of LOSS_REASONS) {
      expect(normalizeLossReason('lost', v)).toBe(v);
    }
  });
});
