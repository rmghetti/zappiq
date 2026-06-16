export interface Experiment {
  active: boolean;
  variantFlowId: string;
  splitPercent: number;
  conversionNodeId?: string;
}

export interface NodeStatRow {
  nodeId: string;
  nodeType: string;
  nodeLabel?: string | null;
  entries: number;
  ends: number;
}

export interface AbVariantResult {
  variant: 'A' | 'B';
  entries: number;
  conversions: number;
  conversionRate: number;
}

export interface AbResults {
  variants: AbVariantResult[];
  winner: 'A' | 'B' | null;
  note: string;
}

const MIN_SAMPLE = 20; // amostra mínima por variante p/ declarar vencedor

/** Hash estável (FNV-1a 32-bit) → 0..99. */
function bucket(seed: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return Math.abs(h) % 100;
}

export function assignVariant(exp: Experiment | null | undefined, seed: string): 'A' | 'B' {
  if (!exp || !exp.active || !exp.variantFlowId) return 'A';
  const pct = Math.max(0, Math.min(100, Number(exp.splitPercent) || 0));
  if (pct <= 0) return 'A';
  if (pct >= 100) return 'B';
  return bucket(String(seed)) < pct ? 'B' : 'A';
}

function statsFor(
  rows: NodeStatRow[],
  conversionNodeId: string | undefined,
  entryNodeId: string,
): { entries: number; conversions: number } {
  const entryRow = rows.find((r) => r.nodeId === entryNodeId);
  const entries = entryRow ? entryRow.entries : rows.reduce((m, r) => Math.max(m, r.entries), 0);
  let conversions: number;
  if (conversionNodeId) {
    const c = rows.find((r) => r.nodeId === conversionNodeId);
    conversions = c ? c.entries : 0;
  } else {
    conversions = rows.reduce((s, r) => s + r.ends, 0); // conclusão do fluxo
  }
  return { entries, conversions };
}

export function computeAbResults(input: {
  aStats: NodeStatRow[];
  bStats: NodeStatRow[];
  conversionNodeId?: string;
  entryNodeId: string;
}): AbResults {
  const build = (variant: 'A' | 'B', rows: NodeStatRow[]): AbVariantResult => {
    const { entries, conversions } = statsFor(rows, input.conversionNodeId, input.entryNodeId);
    return { variant, entries, conversions, conversionRate: entries > 0 ? conversions / entries : 0 };
  };

  const a = build('A', input.aStats || []);
  const b = build('B', input.bStats || []);

  let winner: 'A' | 'B' | null = null;
  let note = 'Sem dados suficientes para declarar um vencedor.';

  if (
    a.entries >= MIN_SAMPLE &&
    b.entries >= MIN_SAMPLE &&
    a.conversionRate !== b.conversionRate
  ) {
    winner = a.conversionRate > b.conversionRate ? 'A' : 'B';
    note = `Variante ${winner} converte melhor (${Math.round((winner === 'A' ? a : b).conversionRate * 100)}% vs ${Math.round((winner === 'A' ? b : a).conversionRate * 100)}%).`;
  }

  return { variants: [a, b], winner, note };
}
