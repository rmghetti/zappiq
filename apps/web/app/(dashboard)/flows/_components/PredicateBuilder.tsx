'use client';
import React from 'react';
import { Trash2, Plus } from 'lucide-react';

type Op = 'eq' | 'neq' | 'gt' | 'lt' | 'gte' | 'lte' | 'contains' | 'exists' | 'not_exists';
export type Predicate =
  | { kind: 'keyword'; match: 'contains' | 'equals' | 'starts_with' | 'regex'; value: string }
  | { kind: 'contact_attr'; field: string; op: Op; value?: any }
  | { kind: 'var'; name: string; op: Op; value?: any }
  | { kind: 'business_hours'; expect: 'open' | 'closed' };

const inputCls = 'w-full px-2 py-1 border border-gray-200 rounded text-[11px] outline-none focus:ring-2 focus:ring-primary-400';
const OPS: Op[] = ['eq', 'neq', 'gt', 'lt', 'gte', 'lte', 'contains', 'exists', 'not_exists'];
const OP_LABEL: Record<Op, string> = { eq: '=', neq: '≠', gt: '>', lt: '<', gte: '≥', lte: '≤', contains: 'contém', exists: 'existe', not_exists: 'não existe' };
const CONTACT_FIELDS = ['tags', 'leadStatus', 'leadScore', 'funnelStage', 'name'];

function newPredicate(kind: Predicate['kind']): Predicate {
  switch (kind) {
    case 'keyword': return { kind: 'keyword', match: 'contains', value: '' };
    case 'contact_attr': return { kind: 'contact_attr', field: 'tags', op: 'contains', value: '' };
    case 'var': return { kind: 'var', name: '', op: 'eq', value: '' };
    case 'business_hours': return { kind: 'business_hours', expect: 'open' };
  }
}

export function PredicateBuilder({ predicates, onChange }: { predicates: Predicate[]; onChange: (p: Predicate[]) => void }) {
  const update = (i: number, p: Predicate) => onChange(predicates.map((x, j) => (j === i ? p : x)));
  const remove = (i: number) => onChange(predicates.filter((_, j) => j !== i));
  const add = () => onChange([...predicates, newPredicate('contact_attr')]);
  const needsValue = (op: Op) => op !== 'exists' && op !== 'not_exists';

  return (
    <div className="space-y-2">
      <p className="text-[10px] text-gray-400">Todos os critérios precisam ser verdadeiros (E). Para "OU", crie outra aresta para o mesmo destino.</p>
      {predicates.map((p, i) => (
        <div key={i} className="rounded border border-gray-200 p-1.5 space-y-1 bg-gray-50/50">
          <div className="flex items-center gap-1">
            <select className={inputCls} value={p.kind} onChange={(e) => update(i, newPredicate(e.target.value as Predicate['kind']))}>
              <option value="contact_attr">Atributo do contato</option>
              <option value="var">Variável do fluxo</option>
              <option value="business_hours">Horário comercial</option>
              <option value="keyword">Palavra-chave</option>
            </select>
            <button onClick={() => remove(i)} className="text-gray-400 hover:text-red-500 shrink-0" title="Remover"><Trash2 size={13} /></button>
          </div>

          {p.kind === 'contact_attr' && (
            <div className="flex gap-1">
              <select className={inputCls} value={CONTACT_FIELDS.includes(p.field) ? p.field : 'customFields.'} onChange={(e) => update(i, { ...p, field: e.target.value })}>
                {CONTACT_FIELDS.map((f) => <option key={f} value={f}>{f}</option>)}
                <option value="customFields.">campo custom…</option>
              </select>
              {!CONTACT_FIELDS.includes(p.field) && (
                <input className={inputCls} value={p.field.replace(/^customFields\./, '')} onChange={(e) => update(i, { ...p, field: 'customFields.' + e.target.value })} placeholder="nome do campo" />
              )}
              <select className={inputCls} value={p.op} onChange={(e) => update(i, { ...p, op: e.target.value as Op })}>
                {OPS.map((o) => <option key={o} value={o}>{OP_LABEL[o]}</option>)}
              </select>
              {needsValue(p.op) && <input className={inputCls} value={p.value ?? ''} onChange={(e) => update(i, { ...p, value: e.target.value })} placeholder="valor" />}
            </div>
          )}

          {p.kind === 'var' && (
            <div className="flex gap-1">
              <input className={inputCls} value={p.name} onChange={(e) => update(i, { ...p, name: e.target.value.replace(/[^a-zA-Z0-9_]/g, '') })} placeholder="variável" />
              <select className={inputCls} value={p.op} onChange={(e) => update(i, { ...p, op: e.target.value as Op })}>
                {OPS.map((o) => <option key={o} value={o}>{OP_LABEL[o]}</option>)}
              </select>
              {needsValue(p.op) && <input className={inputCls} value={p.value ?? ''} onChange={(e) => update(i, { ...p, value: e.target.value })} placeholder="valor" />}
            </div>
          )}

          {p.kind === 'business_hours' && (
            <select className={inputCls} value={p.expect} onChange={(e) => update(i, { ...p, expect: e.target.value as 'open' | 'closed' })}>
              <option value="open">Dentro do horário</option>
              <option value="closed">Fora do horário</option>
            </select>
          )}

          {p.kind === 'keyword' && (
            <div className="flex gap-1">
              <select className={inputCls} value={p.match} onChange={(e) => update(i, { ...p, match: e.target.value as Extract<Predicate, { kind: 'keyword' }>['match'] })}>
                <option value="contains">contém</option>
                <option value="equals">é igual a</option>
                <option value="starts_with">começa com</option>
                <option value="regex">regex</option>
              </select>
              <input className={inputCls} value={p.value} onChange={(e) => update(i, { ...p, value: e.target.value })} placeholder="texto" />
            </div>
          )}
        </div>
      ))}
      <button onClick={add} className="flex items-center gap-1 text-[11px] text-primary-600 hover:text-primary-700"><Plus size={13} /> Adicionar critério</button>
    </div>
  );
}

/** Resumo curto para o label da aresta. */
export function summarizePredicates(predicates: Predicate[]): string {
  if (!predicates?.length) return '';
  const one = (p: Predicate): string => {
    if (p.kind === 'keyword') return `texto ${p.match} "${p.value}"`;
    if (p.kind === 'contact_attr') return `${p.field} ${OP_LABEL[p.op]}${p.value != null && p.value !== '' ? ' ' + p.value : ''}`;
    if (p.kind === 'var') return `${p.name} ${OP_LABEL[p.op]}${p.value != null && p.value !== '' ? ' ' + p.value : ''}`;
    return p.expect === 'open' ? 'no horário' : 'fora do horário';
  };
  return predicates.map(one).join(' e ');
}
