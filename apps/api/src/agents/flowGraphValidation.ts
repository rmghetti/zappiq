/**
 * Pure backend graph validator — mirrors the editor's validateGraph (E5 rules).
 * No IO, no side-effects, no Date.
 */

export interface GraphIssues {
  errors: string[];
  warnings: string[];
}

const INTERACTIVE_LIMITS: Record<string, number> = {
  button: 3,
  list: 10,
};

function label(n: any): string {
  return (n.data?.label as string) || n.type || n.id;
}

export function validateGraph(nodes: any[], edges: any[]): GraphIssues {
  const errors: string[] = [];
  const warnings: string[] = [];

  for (const node of nodes) {
    const outgoing = edges.filter((e) => e.source === node.id);

    // ── ask ──────────────────────────────────────────────────────────────────
    if (node.type === 'ask' && outgoing.length > 0) {
      const varName = node.data?.varName as string | undefined;
      if (!varName || varName.trim() === '') {
        errors.push(
          `Nó "${label(node)}": defina a variável (varName) para o nó ask.`,
        );
      }

      const hasElse = outgoing.some(
        (e) => e.data?.when?.match === 'else',
      );
      if (!hasElse) {
        errors.push(
          `Nó "${label(node)}": ask requer um ramo padrão (else) explícito.`,
        );
      }
    }

    // ── message with interactive ──────────────────────────────────────────────
    if (node.type === 'message' && node.data?.interactive) {
      const interactive = node.data.interactive as {
        type: string;
        options: Array<{ id: string; title: string }>;
      };
      const opts = interactive.options ?? [];
      const iType = interactive.type ?? 'button';
      const limit = INTERACTIVE_LIMITS[iType] ?? 3;

      if (opts.length === 0) {
        errors.push(
          `Nó "${label(node)}": interactive "${iType}" precisa de pelo menos 1 opção.`,
        );
      }

      if (opts.length > limit) {
        errors.push(
          `Nó "${label(node)}": interactive "${iType}" tem máximo de ${limit} opções (${opts.length} fornecidas).`,
        );
      }

      for (const opt of opts) {
        if (!opt.title || opt.title.trim() === '') {
          errors.push(
            `Nó "${label(node)}": opção "${opt.id}" tem texto vazio (título obrigatório).`,
          );
        }
      }

      const ids = opts.map((o) => o.id);
      const seen = new Set<string>();
      for (const id of ids) {
        if (seen.has(id)) {
          errors.push(
            `Nó "${label(node)}": id de opção duplicado "${id}".`,
          );
          break; // report once per node
        }
        seen.add(id);
      }
    }

    // ── edge predicates: contact_attr with bad customFields ───────────────────
    for (const edge of outgoing) {
      const predicates: any[] = edge.data?.predicates ?? [];
      for (const pred of predicates) {
        if (
          pred.kind === 'contact_attr' &&
          pred.field === 'customFields.'
        ) {
          errors.push(
            `Aresta "${edge.id}": predicado contact_attr com campo "customFields." inválido.`,
          );
        }
      }
    }

    // ── condition: missing default branch → warning ───────────────────────────
    if (node.type === 'condition' && outgoing.length > 0) {
      const hasDefault = outgoing.some((e) => {
        // else edge
        if (e.data?.when?.match === 'else') return true;
        // bare edge: no when, no predicates
        if (!e.data?.when && (!e.data?.predicates || e.data.predicates.length === 0)) return true;
        return false;
      });

      if (!hasDefault) {
        warnings.push(
          `Nó "${label(node)}": condition sem ramo padrão (else ou aresta sem predicados).`,
        );
      }
    }
  }

  return { errors, warnings };
}
