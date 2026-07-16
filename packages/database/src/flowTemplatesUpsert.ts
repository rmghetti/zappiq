/**
 * Regra unica de semeadura dos templates Maestro.
 *
 * Mora aqui (e nao no bootstrap do apps/api) porque DOIS lugares semeiam:
 *   - apps/api/src/bootstrap/seedFlowTemplates.ts (startup do API)
 *   - packages/database/prisma/seeds/flowTemplates.ts (seed manual)
 * Com a regra duplicada, os dois divergem — que e exatamente a classe de bug que
 * deixou os templates fora do contrato do motor.
 *
 * CHAVE NATURAL: (vertical, category). Sao 16 verticais x 3 jornadas = 48
 * combinacoes unicas. Deliberadamente NAO usamos `name` como chave: nome e texto
 * de vitrine e muda; usa-lo como chave faz um rename virar linha duplicada.
 *
 * SEGURO SOBRESCREVER: flow_templates e tabela global do sistema (sem
 * organizationId, sem tela de edicao). O cliente nunca escreve aqui — ao "usar"
 * um template ele ganha uma COPIA em `flows`. Logo o codigo e a fonte de
 * verdade, e corrigir um template chega em producao no proximo boot.
 */

import { FLOW_TEMPLATES_DATA } from './flowTemplatesData';

export interface UpsertTemplatesResult {
  created: number;
  updated: number;
  unchanged: number;
  failed: number;
}

/** JSON com chaves ordenadas — o Postgres (jsonb) nao preserva a ordem das
 *  chaves, entao comparar com JSON.stringify cru acusaria "mudou" todo boot. */
function stableStringify(value: any): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value) ?? 'null';
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(',')}]`;
  const keys = Object.keys(value).sort();
  return `{${keys.map((k) => `${JSON.stringify(k)}:${stableStringify(value[k])}`).join(',')}}`;
}

/** true se a linha do DB ja reflete exatamente o template do codigo. */
function isUpToDate(row: any, tpl: (typeof FLOW_TEMPLATES_DATA)[number]): boolean {
  return (
    row.name === tpl.name &&
    row.description === tpl.description &&
    row.triggerType === tpl.triggerType &&
    row.order === tpl.order &&
    row.isActive === tpl.isActive &&
    stableStringify(row.nodes) === stableStringify(tpl.nodes) &&
    stableStringify(row.edges) === stableStringify(tpl.edges)
  );
}

export interface UpsertLogger {
  info: (msg: string) => void;
  error: (msg: string) => void;
}

/**
 * Insere os templates faltantes e atualiza os que mudaram no codigo.
 * Idempotente: sem mudanca no codigo, nao escreve nada.
 */
export async function upsertFlowTemplates(
  prisma: { flowTemplate: { findMany: Function; create: Function; update: Function } },
  log?: UpsertLogger,
): Promise<UpsertTemplatesResult> {
  const existing = (await prisma.flowTemplate.findMany()) as any[];
  const byKey = new Map(existing.map((t) => [`${t.vertical}|${t.category}`, t]));

  const result: UpsertTemplatesResult = { created: 0, updated: 0, unchanged: 0, failed: 0 };

  for (const tpl of FLOW_TEMPLATES_DATA) {
    const key = `${tpl.vertical}|${tpl.category}`;
    const row = byKey.get(key);
    try {
      if (!row) {
        await prisma.flowTemplate.create({ data: tpl as any });
        result.created++;
      } else if (!isUpToDate(row, tpl)) {
        await prisma.flowTemplate.update({ where: { id: row.id }, data: tpl as any });
        result.updated++;
      } else {
        result.unchanged++;
      }
    } catch (err: any) {
      result.failed++;
      // Loud: um template que nao sobe fica com o contrato velho no banco e
      // duplica fluxo quebrado pro cliente. Nao pode passar batido no log.
      log?.error(`[flowTemplates] FALHOU em "${tpl.name}" (${key}): ${err?.message ?? err}`);
    }
  }

  return result;
}

export function formatUpsertResult(r: UpsertTemplatesResult): string {
  return `${r.created} criados, ${r.updated} atualizados, ${r.unchanged} sem mudanca, ${r.failed} falhas (codigo tem ${FLOW_TEMPLATES_DATA.length})`;
}
