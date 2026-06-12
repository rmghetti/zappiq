/** Maestro v2 — estrutura travada de verdade: ids e tipos idênticos, ordem livre. */
export function sameStructure(current: any[], proposed: any[]): boolean {
  if (!Array.isArray(current) || !Array.isArray(proposed)) return false;
  if (current.length !== proposed.length) return false;
  const sig = (ns: any[]) => ns.map((n) => `${n?.id}:${n?.type}`).sort().join('|');
  return sig(current) === sig(proposed);
}
