/**
 * analyticsFormat.ts — FIX W3.2
 * ============================================================================
 * Helpers PUROS de apresentacao pro dashboard/home. Existiam numeros
 * INVENTADOS na home (deltas fixos "+12,5%", grafico mock, "Taxa de retorno"
 * com fallback 68). A /api/analytics/overview JA devolve `prev` (janela
 * anterior) e `volumeByDay` (serie real). Estes helpers transformam esses
 * dados reais em delta e em path de grafico, e — o principal — devolvem
 * "vazio honesto" quando NAO ha base de comparacao, em vez de fabricar numero.
 *
 * Sao puros de proposito: vivem em @zappiq/shared pra ter cobertura de teste
 * sob o vitest do @zappiq/api (o web nao tem runner de teste).
 * ============================================================================
 */

/** Ponto da serie temporal real devolvida por /overview (volumeByDay). */
export interface VolumePoint {
  bucket: string;
  count: number;
}

/**
 * Resultado de um delta vs. periodo anterior.
 *  - `available: false` => NAO ha base real (periodo anterior sem dado, ou
 *    valores nao numericos). O consumidor deve mostrar vazio honesto, NUNCA
 *    um numero inventado.
 *  - `available: true`  => `label` ja vem formatado em pt-BR com sinal
 *    (ex.: "+12,5%", "−3,1%", "0%") e `up` indica a direcao.
 */
export type DeltaResult =
  | { available: false }
  | { available: true; up: boolean; pct: number; label: string };

/**
 * Calcula o delta percentual real entre o valor atual e o do periodo anterior.
 *
 * Regras de honestidade:
 *  - `previous` ausente/negativo/NaN  => sem base => { available: false }.
 *  - `previous === 0`:
 *      - `current === 0` => 0% (estavel, ha base: os dois periodos zerados).
 *      - `current > 0`   => sem base pra %, pois dividir por zero fabrica
 *                            infinito; devolve { available: false }.
 *  - caso normal => ((current - previous) / previous) * 100, arredondado a
 *    1 casa e formatado em pt-BR (virgula decimal, sinal "+"/"−").
 */
export function computeDelta(
  current: number | null | undefined,
  previous: number | null | undefined,
): DeltaResult {
  if (
    current == null || previous == null ||
    !Number.isFinite(current) || !Number.isFinite(previous) ||
    previous < 0 || current < 0
  ) {
    return { available: false };
  }

  if (previous === 0) {
    if (current === 0) {
      return { available: true, up: true, pct: 0, label: '0%' };
    }
    // Ha atividade agora mas base zero: % nao e representavel sem inventar.
    return { available: false };
  }

  const pctRaw = ((current - previous) / previous) * 100;
  const pct = Math.round(pctRaw * 10) / 10;
  return {
    available: true,
    up: pct >= 0,
    pct,
    label: formatSignedPct(pct),
  };
}

/** Formata um percentual ja calculado em pt-BR com sinal explicito. */
export function formatSignedPct(pct: number): string {
  if (!Number.isFinite(pct)) return '0%';
  const rounded = Math.round(pct * 10) / 10;
  if (rounded === 0) return '0%';
  const abs = new Intl.NumberFormat('pt-BR', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 1,
  }).format(Math.abs(rounded));
  const sign = rounded > 0 ? '+' : '−'; // minus U+2212, padrao MACHIA (sem hifen)
  return `${sign}${abs}%`;
}

/**
 * Converte a serie real `volumeByDay` num path SVG de area (para gera o
 * grafico de verdade em vez do path hardcoded). Devolve `null` quando NAO ha
 * dado suficiente (0 ou 1 ponto) — o consumidor mostra estado vazio honesto.
 *
 * O viewBox e parametrizavel; o eixo Y e normalizado pelo maior valor da
 * serie. Com todos os pontos iguais (inclui todos zero) a linha fica no meio,
 * evitando divisao por zero.
 */
export function buildAreaPath(
  points: VolumePoint[] | null | undefined,
  width = 600,
  height = 140,
): { line: string; area: string } | null {
  if (!Array.isArray(points) || points.length < 2) return null;

  const counts = points.map((p) => (Number.isFinite(p.count) ? p.count : 0));
  const max = Math.max(...counts);
  const min = Math.min(...counts);
  const span = max - min;
  const n = counts.length;

  const coords = counts.map((c, i) => {
    const x = n === 1 ? 0 : (i / (n - 1)) * width;
    // Sem variacao => linha no meio vertical; senao normaliza [min,max].
    const yNorm = span === 0 ? 0.5 : (c - min) / span;
    // yNorm=1 (pico) => topo (y pequeno); yNorm=0 => base do desenho.
    const y = height - yNorm * (height * 0.85) - height * 0.05;
    return { x: round2(x), y: round2(y) };
  });

  const line = coords
    .map((pt, i) => `${i === 0 ? 'M' : 'L'} ${pt.x} ${pt.y}`)
    .join(' ');
  const area = `${line} L ${round2(width)} ${height} L 0 ${height} Z`;
  return { line, area };
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
