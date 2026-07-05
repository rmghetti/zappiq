/**
 * analyticsFormat.util.test.ts — FIX W3.2
 * ============================================================================
 * Cobre os helpers puros que a home usa pra parar de exibir numeros
 * INVENTADOS: delta real vs. periodo anterior (`prev`) e path do grafico a
 * partir da serie real (`volumeByDay`). O ponto central: quando NAO ha base
 * real, o helper devolve "sem dado" (available:false / null) em vez de
 * fabricar +12,5% ou um grafico mock.
 *
 * Roda contra o dist buildado de @zappiq/shared (mesmo padrao dos outros
 * *.util.test que importam @zappiq/shared).
 * ============================================================================
 */
import { describe, it, expect } from 'vitest';
import {
  computeDelta,
  formatSignedPct,
  buildAreaPath,
  type VolumePoint,
} from '@zappiq/shared';

describe('computeDelta', () => {
  it('calcula delta positivo real e formata pt-BR com sinal', () => {
    const d = computeDelta(120, 100);
    expect(d.available).toBe(true);
    if (!d.available) throw new Error('esperava disponivel');
    expect(d.up).toBe(true);
    expect(d.pct).toBe(20);
    expect(d.label).toBe('+20%');
  });

  it('calcula delta negativo real', () => {
    const d = computeDelta(90, 100);
    expect(d.available).toBe(true);
    if (!d.available) throw new Error('esperava disponivel');
    expect(d.up).toBe(false);
    expect(d.pct).toBe(-10);
    expect(d.label).toBe('−10%'); // minus U+2212, nao hifen
  });

  it('usa virgula decimal pt-BR e 1 casa', () => {
    const d = computeDelta(112.5, 100);
    if (!d.available) throw new Error('esperava disponivel');
    expect(d.label).toBe('+12,5%');
  });

  it('NAO inventa: previous ausente => sem base', () => {
    expect(computeDelta(100, null).available).toBe(false);
    expect(computeDelta(100, undefined).available).toBe(false);
  });

  it('NAO inventa: previous === 0 com atividade atual => sem base (evita /0)', () => {
    expect(computeDelta(50, 0).available).toBe(false);
  });

  it('previous e current ambos 0 => 0% estavel (ha base)', () => {
    const d = computeDelta(0, 0);
    expect(d.available).toBe(true);
    if (!d.available) throw new Error('esperava disponivel');
    expect(d.pct).toBe(0);
    expect(d.label).toBe('0%');
  });

  it('rejeita valores nao finitos ou negativos', () => {
    expect(computeDelta(Number.NaN, 100).available).toBe(false);
    expect(computeDelta(100, Number.POSITIVE_INFINITY).available).toBe(false);
    expect(computeDelta(-5, 100).available).toBe(false);
    expect(computeDelta(100, -5).available).toBe(false);
  });
});

describe('formatSignedPct', () => {
  it('0 vira "0%" sem sinal', () => {
    expect(formatSignedPct(0)).toBe('0%');
    expect(formatSignedPct(0.04)).toBe('0%'); // arredonda pra 0
  });
  it('positivo ganha +, negativo ganha minus real', () => {
    expect(formatSignedPct(3.1)).toBe('+3,1%');
    expect(formatSignedPct(-3.1)).toBe('−3,1%');
  });
  it('nao finito vira 0%', () => {
    expect(formatSignedPct(Number.NaN)).toBe('0%');
    expect(formatSignedPct(Number.POSITIVE_INFINITY)).toBe('0%');
  });
});

describe('buildAreaPath', () => {
  const series: VolumePoint[] = [
    { bucket: '2026-07-01', count: 10 },
    { bucket: '2026-07-02', count: 20 },
    { bucket: '2026-07-03', count: 5 },
  ];

  it('NAO inventa grafico: 0 ou 1 ponto => null', () => {
    expect(buildAreaPath([])).toBeNull();
    expect(buildAreaPath([{ bucket: 'x', count: 3 }])).toBeNull();
    expect(buildAreaPath(null)).toBeNull();
    expect(buildAreaPath(undefined)).toBeNull();
  });

  it('gera path real com >= 2 pontos', () => {
    const p = buildAreaPath(series, 600, 140);
    expect(p).not.toBeNull();
    expect(p!.line.startsWith('M ')).toBe(true);
    // primeiro x=0, ultimo x=width
    expect(p!.line).toContain('M 0 ');
    expect(p!.line).toContain('L 600 ');
    // area fecha ate a base (height) e volta pra x=0
    expect(p!.area.endsWith('L 0 140 Z')).toBe(true);
  });

  it('pico da serie fica no topo (y menor) que o vale', () => {
    const p = buildAreaPath(series, 600, 140)!;
    // extrai os y de cada "cmd x y"
    const ys = p.line
      .split(/[ML]\s+/)
      .filter(Boolean)
      .map((seg) => Number(seg.trim().split(/\s+/)[1]));
    // series: 10,20,5 => indice 1 (20) e o pico => menor y
    expect(ys[1]).toBeLessThan(ys[0]);
    expect(ys[1]).toBeLessThan(ys[2]);
  });

  it('serie constante (inclui tudo zero) nao quebra: linha no meio', () => {
    const flat: VolumePoint[] = [
      { bucket: 'a', count: 0 },
      { bucket: 'b', count: 0 },
      { bucket: 'c', count: 0 },
    ];
    const p = buildAreaPath(flat, 600, 140);
    expect(p).not.toBeNull();
    expect(p!.line).not.toContain('NaN');
  });
});
