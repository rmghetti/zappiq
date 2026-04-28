/* ══════════════════════════════════════════════════════════════════════
 * V2-018 · llmCost.test.ts
 * --------------------------------------------------------------------
 * Testes do cost estimator. Validam:
 *  - cálculo correto pra cada modelo conhecido (Sonnet, Haiku, GPT-4o-mini)
 *  - precisão 6 casas decimais (sem float drift)
 *  - modelo desconhecido devolve 0 (fail-safe)
 *  - tokens null/undefined viram 0
 * ══════════════════════════════════════════════════════════════════════ */

import { describe, it, expect, vi } from 'vitest';
import {
  estimateCostUsd,
  getModelPricing,
  listKnownModels,
  MODEL_PRICING,
  PRICING_VERSION,
} from './llmCost.js';

describe('llmCost', () => {
  describe('estimateCostUsd', () => {
    it('calcula custo Sonnet 4.6 corretamente', () => {
      // 1500 in tokens × $3/1M = $0.0045
      // 250  out tokens × $15/1M = $0.00375
      // total = $0.00825
      const cost = estimateCostUsd('claude-sonnet-4-6', 1500, 250);
      expect(cost).toBe(0.00825);
    });

    it('calcula custo Haiku 4.5 corretamente', () => {
      // 1000 in × $1/1M = $0.001
      // 500  out × $5/1M = $0.0025
      // total = $0.0035
      const cost = estimateCostUsd('claude-haiku-4-5-20251001', 1000, 500);
      expect(cost).toBe(0.0035);
    });

    it('calcula custo GPT-4o-mini corretamente', () => {
      // 2000 in × $0.15/1M = $0.0003
      // 300  out × $0.60/1M = $0.00018
      // total = $0.00048
      const cost = estimateCostUsd('gpt-4o-mini', 2000, 300);
      expect(cost).toBe(0.00048);
    });

    it('arredonda em 6 casas decimais (sem float drift)', () => {
      const cost = estimateCostUsd('claude-sonnet-4-6', 1, 1);
      // 1/1e6 * 3 + 1/1e6 * 15 = 0.000003 + 0.000015 = 0.000018
      expect(cost).toBe(0.000018);
      expect(cost.toString()).not.toContain('e');
    });

    it('devolve 0 e loga warn pra modelo desconhecido', () => {
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      const cost = estimateCostUsd('claude-modelo-inexistente', 1000, 500);
      expect(cost).toBe(0);
      expect(warnSpy).toHaveBeenCalledWith(
        expect.stringContaining('Unknown model "claude-modelo-inexistente"'),
      );
      warnSpy.mockRestore();
    });

    it('aceita tokens null/undefined sem crashar', () => {
      expect(estimateCostUsd('claude-sonnet-4-6', null, null)).toBe(0);
      expect(estimateCostUsd('claude-sonnet-4-6', undefined, undefined)).toBe(0);
      expect(estimateCostUsd('claude-sonnet-4-6', 1000, null)).toBe(0.003);
      expect(estimateCostUsd('claude-sonnet-4-6', null, 500)).toBe(0.0075);
    });

    it('cost de chamada zero-token é zero', () => {
      expect(estimateCostUsd('claude-sonnet-4-6', 0, 0)).toBe(0);
    });

    it('cost por 1M tokens bate exatamente o pricing publicado', () => {
      // 1M input tokens Sonnet = $3.00
      expect(estimateCostUsd('claude-sonnet-4-6', 1_000_000, 0)).toBe(3.0);
      // 1M output tokens Sonnet = $15.00
      expect(estimateCostUsd('claude-sonnet-4-6', 0, 1_000_000)).toBe(15.0);
      // 1M input tokens Haiku = $1.00
      expect(estimateCostUsd('claude-haiku-4-5-20251001', 1_000_000, 0)).toBe(1.0);
    });
  });

  describe('getModelPricing', () => {
    it('devolve pricing pra modelo conhecido', () => {
      const p = getModelPricing('claude-sonnet-4-6');
      expect(p).not.toBeNull();
      expect(p?.inputUsdPerMillion).toBe(3.0);
      expect(p?.outputUsdPerMillion).toBe(15.0);
    });

    it('devolve null pra modelo desconhecido', () => {
      expect(getModelPricing('modelo-inexistente')).toBeNull();
    });
  });

  describe('listKnownModels', () => {
    it('inclui pelo menos os 4 modelos críticos do plano V2.0', () => {
      const models = listKnownModels();
      expect(models).toContain('claude-sonnet-4-6');
      expect(models).toContain('claude-haiku-4-5-20251001');
      expect(models).toContain('gpt-4o-mini');
      expect(models).toContain('claude-opus-4-6');
    });
  });

  describe('MODEL_PRICING canônica', () => {
    it('PRICING_VERSION segue formato YYYY-MM-DD', () => {
      expect(PRICING_VERSION).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    });

    it('todos os preços são números positivos', () => {
      for (const [model, pricing] of Object.entries(MODEL_PRICING)) {
        expect(pricing.inputUsdPerMillion, `${model} input`).toBeGreaterThan(0);
        expect(pricing.outputUsdPerMillion, `${model} output`).toBeGreaterThan(0);
      }
    });

    it('output sempre custa mais ou igual ao input (sanity check)', () => {
      // Pricing histórico de LLMs: output é ~3-5x input. Catch errado-fácil.
      for (const [model, pricing] of Object.entries(MODEL_PRICING)) {
        expect(
          pricing.outputUsdPerMillion,
          `${model}: output ($${pricing.outputUsdPerMillion}) deveria ser >= input ($${pricing.inputUsdPerMillion})`,
        ).toBeGreaterThanOrEqual(pricing.inputUsdPerMillion);
      }
    });
  });
});
