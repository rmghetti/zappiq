/* ══════════════════════════════════════════════════════════════════════
 * FEATURE 5b.2 · messageTemplate.test.ts
 * --------------------------------------------------------------------
 * Cobre categoria (validação + normalização), aprovação, elegibilidade de
 * reengajamento e a decisão de janela de 24h.
 * ══════════════════════════════════════════════════════════════════════ */

import { describe, it, expect } from 'vitest';
import {
  META_TEMPLATE_CATEGORIES,
  META_24H_WINDOW_MS,
  isValidCategory,
  normalizeCategory,
  isApproved,
  canReopenWindow,
  isWithin24hWindow,
  outboundSendMode,
} from './messageTemplate.js';

describe('messageTemplate', () => {
  describe('isValidCategory', () => {
    it('aceita as três categorias oficiais (case-insensitive)', () => {
      expect(isValidCategory('MARKETING')).toBe(true);
      expect(isValidCategory('utility')).toBe(true);
      expect(isValidCategory('Authentication')).toBe(true);
    });
    it('rejeita valores desconhecidos e não-string', () => {
      expect(isValidCategory('PROMO')).toBe(false);
      expect(isValidCategory('')).toBe(false);
      expect(isValidCategory(null)).toBe(false);
      expect(isValidCategory(42)).toBe(false);
    });
    it('cobre exatamente as categorias exportadas', () => {
      expect(META_TEMPLATE_CATEGORIES).toEqual(['MARKETING', 'UTILITY', 'AUTHENTICATION']);
    });
  });

  describe('normalizeCategory', () => {
    it('normaliza case e passa válidas adiante', () => {
      expect(normalizeCategory('utility')).toBe('UTILITY');
      expect(normalizeCategory('AUTHENTICATION')).toBe('AUTHENTICATION');
    });
    it('faz fallback pra MARKETING em valor desconhecido/ausente', () => {
      expect(normalizeCategory('promo')).toBe('MARKETING');
      expect(normalizeCategory(undefined)).toBe('MARKETING');
      expect(normalizeCategory(null)).toBe('MARKETING');
      expect(normalizeCategory(123)).toBe('MARKETING');
    });
  });

  describe('isApproved', () => {
    it('true só quando metaStatus === APPROVED (case-insensitive)', () => {
      expect(isApproved({ metaStatus: 'APPROVED' })).toBe(true);
      expect(isApproved({ metaStatus: 'approved' })).toBe(true);
      expect(isApproved({ metaStatus: 'PENDING' })).toBe(false);
      expect(isApproved({ metaStatus: 'REJECTED' })).toBe(false);
      expect(isApproved({ metaStatus: null })).toBe(false);
      expect(isApproved({})).toBe(false);
    });
  });

  describe('canReopenWindow', () => {
    it('exige isReengagement E aprovação', () => {
      expect(canReopenWindow({ isReengagement: true, metaStatus: 'APPROVED' })).toBe(true);
      expect(canReopenWindow({ isReengagement: true, metaStatus: 'PENDING' })).toBe(false);
      expect(canReopenWindow({ isReengagement: false, metaStatus: 'APPROVED' })).toBe(false);
      expect(canReopenWindow({})).toBe(false);
    });
  });

  describe('isWithin24hWindow', () => {
    const now = 1_700_000_000_000;
    it('true quando o último inbound foi há menos de 24h', () => {
      expect(isWithin24hWindow(now - 1000, now)).toBe(true);
      expect(isWithin24hWindow(new Date(now - 60_000), now)).toBe(true);
    });
    it('false na fronteira exata e além dela', () => {
      expect(isWithin24hWindow(now - META_24H_WINDOW_MS, now)).toBe(false);
      expect(isWithin24hWindow(now - META_24H_WINDOW_MS - 1, now)).toBe(false);
    });
    it('false pra null/undefined/NaN', () => {
      expect(isWithin24hWindow(null, now)).toBe(false);
      expect(isWithin24hWindow(undefined, now)).toBe(false);
      expect(isWithin24hWindow(Number.NaN, now)).toBe(false);
    });
  });

  describe('outboundSendMode', () => {
    const now = 1_700_000_000_000;
    it('permite free-form dentro da janela', () => {
      expect(outboundSendMode(now - 1000, now)).toBe('freeform_or_template');
    });
    it('exige template fora da janela ou sem inbound', () => {
      expect(outboundSendMode(now - META_24H_WINDOW_MS - 1, now)).toBe('template_required');
      expect(outboundSendMode(null, now)).toBe('template_required');
    });
  });
});
