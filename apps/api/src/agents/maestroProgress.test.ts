/* ══════════════════════════════════════════════════════════════════════
 * Maestro · progresso da geração — repartição da régua
 *
 * weightedSlices é o que garante que o número na barra do cliente signifique
 * alguma coisa. Se ele mentir, a barra anda torto (empaca num trecho, dispara
 * noutro) e o cliente volta a não saber se travou — que é justamente o bug que
 * essa feature existe pra matar.
 *
 * Cobertura:
 *   ✓ Fatias contíguas, sem buraco e sem sobreposição
 *   ✓ A última fecha EXATAMENTE no fim da faixa (sem drift de float)
 *   ✓ Reparte por peso, não em partes iguais
 *   ✓ Peso zero não consome régua (handoff que não vai rodar)
 *   ✓ Entradas degeneradas devolvem [] em vez de explodir
 * ══════════════════════════════════════════════════════════════════════ */

import { describe, it, expect } from 'vitest';
import { weightedSlices, EST_DRAFT_MS, EST_HANDOFFS_MS, EST_WIRING_MS, RULER_END } from './maestroProgress.js';

describe('weightedSlices', () => {
  it('devolve fatias contíguas cobrindo a faixa inteira', () => {
    const s = weightedSlices([1, 1, 1], { from: 6, to: 97 });
    expect(s).toHaveLength(3);
    expect(s[0].from).toBe(6);
    // Sem buraco nem sobreposição: cada fatia começa onde a anterior terminou.
    expect(s[1].from).toBe(s[0].to);
    expect(s[2].from).toBe(s[1].to);
    expect(s[2].to).toBe(97);
  });

  it('fecha a última fatia exatamente no fim, mesmo com peso que não divide redondo', () => {
    // 3 pesos iguais em 91 pontos dá dízima; sem o ajuste final a barra pararia
    // em 96.99999 e nunca entregaria o marco cheio.
    const s = weightedSlices([7, 7, 7], { from: 6, to: RULER_END });
    expect(s[s.length - 1].to).toBe(RULER_END);
  });

  it('reparte proporcional ao peso, não em partes iguais', () => {
    const s = weightedSlices([30, 10], { from: 0, to: 100 });
    // 30/40 da faixa pro primeiro, 10/40 pro segundo.
    expect(s[0].to).toBeCloseTo(75, 5);
    const larguraA = s[0].to - s[0].from;
    const larguraB = s[1].to - s[1].from;
    expect(larguraA).toBeCloseTo(larguraB * 3, 5);
  });

  it('peso zero não consome régua', () => {
    // Caso real: generateJourney com 1 objetivo só — designHandoffs volta [] sem
    // chamar LLM, então ele pesa 0 e não pode roubar espaço da barra.
    const s = weightedSlices([EST_DRAFT_MS, 0, EST_WIRING_MS], { from: 5, to: 97 });
    expect(s[1].to - s[1].from).toBe(0);
    // E o zero no meio não quebra a continuidade.
    expect(s[1].from).toBe(s[0].to);
    expect(s[2].from).toBe(s[1].to);
    expect(s[2].to).toBe(97);
  });

  it('a jornada completa (6 drafts + handoffs + fiação) sobe monotônica de 5 a 97', () => {
    const objetivos = 6;
    const s = weightedSlices(
      [...Array.from({ length: objetivos }, () => EST_DRAFT_MS), EST_HANDOFFS_MS, EST_WIRING_MS],
      { from: 5, to: RULER_END },
    );
    expect(s).toHaveLength(objetivos + 2);
    expect(s[0].from).toBe(5);
    expect(s[s.length - 1].to).toBe(RULER_END);
    // Nunca anda pra trás: a barra só pode subir.
    for (let i = 0; i < s.length; i++) {
      expect(s[i].to).toBeGreaterThanOrEqual(s[i].from);
      if (i > 0) expect(s[i].from).toBe(s[i - 1].to);
    }
    // O handoff (~15s) tem que ganhar menos régua que um draft (~22s).
    const draft = s[0].to - s[0].from;
    const handoff = s[objetivos].to - s[objetivos].from;
    expect(handoff).toBeLessThan(draft);
  });

  it('entradas degeneradas devolvem [] em vez de explodir', () => {
    expect(weightedSlices([], { from: 0, to: 100 })).toEqual([]);
    // Todos zero: divisão por zero viraria NaN e a barra sumiria.
    expect(weightedSlices([0, 0], { from: 0, to: 100 })).toEqual([]);
  });
});
