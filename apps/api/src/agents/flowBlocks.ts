/**
 * ZappIQ Maestro — Catálogo de Blocos Ricos (PURO, sem IO/Date)
 * ============================================================================
 * expandBlock: recebe um bloco do plano da IA e devolve um Fragment
 * (subgraph local). O assembler (próxima tarefa) costura os fragments.
 *
 * Ids são LOCAIS, prefixados com block.id.
 * Cross-block links são emitidos como exits (assembler resolve targets).
 * ============================================================================
 */

// ── Tipos públicos ────────────────────────────────────────────────────────────

export interface BlockExit {
  key: string;          // 'next'|'ok'|'else'|`opt:<i>`|`case:<i>`|'open'|'closed'
  from: string;         // node id que origina a saída
  edgeData?: any;       // dados da aresta (predicates, when, etc.)
}

export interface Fragment {
  nodes: any[];
  edges: any[];
  entry: string;        // id do nó de entrada do fragment
  exits: BlockExit[];
}

// ── Helpers de sanitização ────────────────────────────────────────────────────

/**
 * slug: lowercase, remove diacritics (NFD), substitui não-alfanumérico por '_'.
 * Usado para option ids.
 */
function slug(s: string): string {
  return s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
}

/**
 * sanitizeTag: lowercase, substitui não [a-z0-9-] por '-', trim dashes, ≤40.
 */
function sanitizeTag(s: string): string {
  return s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40);
}

/**
 * sanitizeVarName: lowercase, remove diacritics, strip non [a-z0-9_].
 */
function sanitizeVarName(s: string): string {
  return s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9_]/g, '');
}

// ── expandBlock ───────────────────────────────────────────────────────────────

export function expandBlock(block: any): Fragment {
  const { id, type } = block;

  switch (type) {
    case 'message': {
      const text = (block.text ?? '').slice(0, 600);
      return {
        nodes: [{ id, type: 'message', data: { label: 'Mensagem', text } }],
        edges: [],
        entry: id,
        exits: [{ key: 'next', from: id }],
      };
    }

    case 'ask': {
      const varName = sanitizeVarName(block.varName ?? '');
      const question = (block.question ?? '').slice(0, 600);
      const data: any = { label: 'Perguntar', question, varName };

      if (block.crmField) {
        data.crmField = block.crmField;
      }

      if (block.validationType) {
        data.validation = {
          type: block.validationType,
          errorMessage: block.errorMessage ?? 'Resposta inválida, tente de novo.',
          maxRetries: 2,
        };
      }

      return {
        nodes: [{ id, type: 'ask', data }],
        edges: [],
        entry: id,
        exits: [
          { key: 'ok', from: id },
          { key: 'else', from: id, edgeData: { when: { match: 'else' } } },
        ],
      };
    }

    case 'ask_buttons': {
      const condId = `${id}_cond`;
      const question = (block.question ?? '').slice(0, 600);
      const rawOptions: Array<{ title: string }> = block.options ?? [];

      const options = rawOptions.map((opt, i) => {
        const title = (opt.title ?? '').slice(0, 20);
        const optId = slug(title) || `opt_${i}`;
        return { id: optId, title };
      });

      const msgNode = {
        id,
        type: 'message',
        data: {
          label: 'Botões',
          text: question,
          interactive: { type: 'button', options },
        },
      };

      const condNode = {
        id: condId,
        type: 'condition',
        data: { label: 'Condição' },
      };

      const internalEdge = {
        id: `${id}_e`,
        source: id,
        target: condId,
      };

      const optExits: BlockExit[] = rawOptions.map((opt, i) => ({
        key: `opt:${i}`,
        from: condId,
        edgeData: {
          predicates: [{ kind: 'keyword', match: 'equals', value: opt.title }],
        },
      }));

      const elseExit: BlockExit = {
        key: 'else',
        from: condId,
        edgeData: { when: { match: 'else' } },
      };

      return {
        nodes: [msgNode, condNode],
        edges: [internalEdge],
        entry: id,
        exits: [...optExits, elseExit],
      };
    }

    case 'branch_var': {
      const varName = sanitizeVarName(block.varName ?? '');
      const cases: Array<{ op: string; value: string }> = block.cases ?? [];

      const condNode = {
        id,
        type: 'condition',
        data: { label: 'Condição' },
      };

      const caseExits: BlockExit[] = cases.map((c, i) => ({
        key: `case:${i}`,
        from: id,
        edgeData: {
          predicates: [{ kind: 'var', name: varName, op: c.op, value: c.value }],
        },
      }));

      const elseExit: BlockExit = {
        key: 'else',
        from: id,
        edgeData: { when: { match: 'else' } },
      };

      return {
        nodes: [condNode],
        edges: [],
        entry: id,
        exits: [...caseExits, elseExit],
      };
    }

    case 'branch_hours': {
      const condNode = {
        id,
        type: 'condition',
        data: { label: 'Horário' },
      };

      return {
        nodes: [condNode],
        edges: [],
        entry: id,
        exits: [
          {
            key: 'open',
            from: id,
            edgeData: { predicates: [{ kind: 'business_hours', expect: 'open' }] },
          },
          {
            key: 'closed',
            from: id,
            edgeData: { when: { match: 'else' } },
          },
        ],
      };
    }

    case 'tag': {
      const tag = sanitizeTag(block.tag ?? '');
      return {
        nodes: [{ id, type: 'tag', data: { label: 'Marcar tag', tag } }],
        edges: [],
        entry: id,
        exits: [{ key: 'next', from: id }],
      };
    }

    case 'ai': {
      const prompt = (block.prompt ?? '').slice(0, 900);
      return {
        nodes: [{ id, type: 'ai', data: { label: 'Nó-IA', prompt } }],
        edges: [],
        entry: id,
        exits: [{ key: 'next', from: id }],
      };
    }

    case 'handoff': {
      return {
        nodes: [{ id, type: 'transfer', data: { label: 'Humano' } }],
        edges: [],
        entry: id,
        exits: [],
      };
    }

    default:
      throw new Error(`bloco desconhecido: ${type}`);
  }
}
