/* ══════════════════════════════════════════════════════════════════════
 * Maestro · curva da barra de progresso
 *
 * A promessa que a UI faz ao cliente: a barra sempre se mexe, nunca volta, e
 * nunca anuncia um marco que o servidor não confirmou. As três dependem desta
 * curva — se ela furar o teto, a barra chega em 100% com o fluxo ainda sendo
 * gerado, que é pior que o spinner mudo que essa feature veio substituir.
 *
 * Cobertura:
 *   ✓ Sai exatamente do marco real
 *   ✓ Cobre ~95% do trecho no ETA estimado (a barra parece viva)
 *   ✓ NUNCA alcança o teto, mesmo demorando 10x o estimado
 *   ✓ Monotônica: nunca anda pra trás
 *   ✓ Relógio pra trás não faz a barra recuar
 *   ✓ Casos degenerados (eta 0, trecho de largura 0) não viram NaN
 * ══════════════════════════════════════════════════════════════════════ */

import { describe, it, expect } from 'vitest';
import { easeTowards, type MaestroAnchor } from './maestroCurve';

const anchor: MaestroAnchor = { at: 1_000, from: 6, to: 97, eta: 22_000 };

describe('easeTowards', () => {
  it('sai exatamente do marco real que o servidor mandou', () => {
    expect(easeTowards(anchor, 1_000)).toBe(6);
  });

  it('cobre ~95% do trecho quando bate o ETA estimado', () => {
    // É o que faz a barra "parecer certa": no tempo típico ela está quase lá.
    const p = easeTowards(anchor, 1_000 + 22_000);
    expect(p).toBeCloseTo(6 + 0.95 * (97 - 6), 0);
  });

  it('nunca alcança o teto, nem demorando 10x o estimado', () => {
    // O caso que importa: LLM lento. A barra desacelera e espera, em vez de
    // furar o teto e anunciar um marco que o servidor não confirmou.
    for (const mult of [1, 2, 5, 10]) {
      const p = easeTowards(anchor, 1_000 + 22_000 * mult);
      expect(p).toBeLessThan(97);
    }
  });

  it('é monotônica: a barra nunca anda pra trás', () => {
    let prev = -Infinity;
    for (let t = 0; t <= 60_000; t += 250) {
      const p = easeTowards(anchor, 1_000 + t);
      expect(p).toBeGreaterThanOrEqual(prev);
      prev = p;
    }
  });

  it('relógio pra trás não faz a barra recuar', () => {
    // Aba em background, ajuste de horário: now pode vir antes do at.
    expect(easeTowards(anchor, 0)).toBe(6);
    expect(easeTowards(anchor, -5_000)).toBe(6);
  });

  it('etapa instantânea (eta 0) salta pro teto sem virar NaN', () => {
    const p = easeTowards({ at: 0, from: 50, to: 60, eta: 0 }, 1_000);
    expect(Number.isFinite(p)).toBe(true);
    expect(p).toBeCloseTo(60, 5);
  });

  it('trecho de largura zero fica parado, sem NaN', () => {
    // Caso real: o handoff da jornada com 1 objetivo só (nem vai rodar).
    const flat: MaestroAnchor = { at: 0, from: 80, to: 80, eta: 15_000 };
    expect(easeTowards(flat, 5_000)).toBe(80);
    expect(easeTowards(flat, 500_000)).toBe(80);
  });
});
