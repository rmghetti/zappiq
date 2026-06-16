/**
 * Maestro v3 (Spec 1A) — avaliação de predicados de aresta. PURO. NUNCA lança.
 * evalEdge: predicados em E; sem predicados → compat com 'when' legado; sem
 * nenhum → else (true). Campo/var inexistente → exists/not_exists resolvem,
 * demais ops retornam false (degrada para próxima aresta).
 */
import { isOpen } from './businessHours.js';
import { matchCondition, type EvalContext, type FlowEdge, type Predicate, type PredicateOp, type FlowCondition } from './flowEngine.js';

function getContactField(ctx: EvalContext, field: string): any {
  if (field.startsWith('customFields.')) {
    return ctx.contact.customFields?.[field.slice('customFields.'.length)];
  }
  switch (field) {
    case 'tags': return ctx.contact.tags;
    case 'leadStatus': return ctx.contact.leadStatus;
    case 'leadScore': return ctx.contact.leadScore;
    case 'funnelStage': return ctx.contact.funnelStage;
    case 'name': return ctx.contact.name;
    default: return undefined;
  }
}

function applyOp(actual: any, op: PredicateOp, expected: any): boolean {
  switch (op) {
    case 'exists': return actual !== undefined && actual !== null;
    case 'not_exists': return actual === undefined || actual === null;
    case 'eq': return String(actual) === String(expected);
    case 'neq': return String(actual) !== String(expected);
    case 'contains':
      if (Array.isArray(actual)) return actual.map(String).includes(String(expected));
      return String(actual ?? '').toLowerCase().includes(String(expected ?? '').toLowerCase());
    case 'gt': case 'lt': case 'gte': case 'lte': {
      const a = Number(actual), b = Number(expected);
      if (Number.isNaN(a) || Number.isNaN(b)) return false;
      return op === 'gt' ? a > b : op === 'lt' ? a < b : op === 'gte' ? a >= b : a <= b;
    }
    default: return false;
  }
}

export function evalPredicate(
  pred: Predicate,
  ctx: EvalContext,
  vars: Record<string, any>,
  text: string,
): boolean {
  switch (pred.kind) {
    case 'keyword':
      return matchCondition({ match: pred.match, value: pred.value } as FlowCondition, text);
    case 'contact_attr':
      return applyOp(getContactField(ctx, pred.field), pred.op, pred.value);
    case 'var':
      return applyOp(vars?.[pred.name], pred.op, pred.value);
    case 'business_hours':
      return isOpen(ctx.businessHours, ctx.now) === (pred.expect === 'open');
    default:
      return false;
  }
}

/** true se a aresta deve ser seguida. Predicados em E; compat com 'when'. */
export function evalEdge(
  edge: FlowEdge,
  ctx: EvalContext,
  vars: Record<string, any>,
  text: string,
): boolean {
  const preds = (edge.data?.predicates as Predicate[] | undefined);
  if (preds && preds.length > 0) {
    return preds.every((p) => evalPredicate(p, ctx, vars, text));
  }
  // Compat: aresta legada com 'when' (keyword/else/regex…)
  const when = edge.data?.when;
  if (when) {
    if (when.match === 'else') return true;
    return matchCondition(when, text);
  }
  // Sem predicados nem when → ramo default (else implícito)
  return true;
}
