/**
 * Maestro v2 — patch de conteúdo com ESTRUTURA TRAVADA (spec Frente 2).
 * Puro: extrai/aplica/difere conteúdo textual de nós sem tocar ids/edges/posições.
 */
export interface ContentField { nodeId: string; field: 'text' | 'tag' | 'prompt'; value: string }
export interface ContentDiff { nodeId: string; field: string; before: string; after: string }

const FIELD_BY_TYPE: Record<string, 'text' | 'tag' | 'prompt'> = {
  message: 'text', tag: 'tag', ai: 'prompt',
};

export function extractEditableContent(nodes: any[]): ContentField[] {
  const out: ContentField[] = [];
  for (const n of nodes ?? []) {
    const field = FIELD_BY_TYPE[n?.type];
    if (!field) continue;
    out.push({ nodeId: String(n.id), field, value: String(n?.data?.[field] ?? '') });
  }
  return out;
}

export function applyContentPatch(nodes: any[], patch: ContentField[]): any[] {
  const byNode = new Map(patch.map((p) => [`${p.nodeId}:${p.field}`, p.value]));
  return (nodes ?? []).map((n) => {
    const field = FIELD_BY_TYPE[n?.type];
    if (!field) return n;
    const key = `${n.id}:${field}`;
    if (!byNode.has(key)) return n;
    return { ...n, data: { ...n.data, [field]: byNode.get(key) } };
  });
}

export function diffContent(nodes: any[], patch: ContentField[]): ContentDiff[] {
  const current = new Map(extractEditableContent(nodes).map((c) => [`${c.nodeId}:${c.field}`, c.value]));
  const diffs: ContentDiff[] = [];
  for (const p of patch) {
    const key = `${p.nodeId}:${p.field}`;
    if (!current.has(key)) continue;
    const before = current.get(key)!;
    if (before !== p.value) diffs.push({ nodeId: p.nodeId, field: p.field, before, after: p.value });
  }
  return diffs;
}
