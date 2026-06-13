# Maestro v3 — Spec 1A (Editor/Canvas) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:subagent-driven-development. UI subsystem — NO unit-test harness in `apps/web`, so verification per task = TypeScript typecheck (`pnpm --filter @zappiq/web exec tsc --noEmit`) + visual verification in the running dev server (preview tools). Steps use `- [ ]`.

**Goal:** Tornar autoráveis e auditáveis no canvas os recursos ricos que o motor já executa (Spec 1A motor): nó `ask`, condições por predicados (4 critérios), e mensagens com botões/listas/mídia — além de uma UI de horário comercial estruturado nas configurações.

**Architecture:** O editor é um único arquivo React Flow (`apps/web/app/(dashboard)/flows/page.tsx`, ~1400 linhas, Tailwind cru, lucide-react). O `data` de cada nó/aresta é passado adiante intacto por `toApiGraph`/`apiNodesToCanvas`, então escrever `node.data`/`edge.data` nas MESMAS formas que o motor consome (`AskNodeData`, `Predicate[]`, `data.media`, `data.interactive`) faz o round-trip funcionar sem mudar o backend. Para não inchar o arquivo gigante, os novos blocos de UI vão em componentes presentacionais próprios sob `apps/web/app/(dashboard)/flows/_components/`, recebendo valor + onChange por props; o `page.tsx` mantém o estado.

**Tech Stack:** Next.js 14, React 18, React Flow v11, Tailwind, lucide-react. Verificação: `tsc --noEmit` + dev server (`next dev` porta 3000) + preview tools.

**Branch:** continua em `maestro-v3-spec1a-motor` (mesma fatia 1A; o motor já está nela).

**Contratos do motor que a UI deve produzir (de `apps/api/src/agents/flowEngine.ts`):**
- `AskNodeData = { question: string; varName: string; crmField?: string; validation?: { type:'text'|'number'|'email'|'phone'; errorMessage: string; maxRetries: number } }` no `node.data` de um nó `type:'ask'`.
- `Predicate` (aresta `data.predicates: Predicate[]`, avaliados em E): `{kind:'keyword',match,value}` | `{kind:'contact_attr',field,op,value?}` | `{kind:'var',name,op,value?}` | `{kind:'business_hours',expect:'open'|'closed'}`. `op` ∈ eq|neq|gt|lt|gte|lte|contains|exists|not_exists.
- Mensagem rica no `node.data` de um `type:'message'`: `media?: { type:'image'|'audio'|'document'; url:string; caption?:string }` OU `interactive?: { type:'button'|'list'; options:{id:string;title:string}[] }` (precedência media > interactive > text, conforme o motor). Botão ≤3, lista ≤10.
- Horário: `org.settings.businessHoursConfig = { timezone:string; days: Record<0..6, {open:string;close:string}|null> }` (HH:mm).

---

## Estrutura de arquivos

| Arquivo | Ação | Responsabilidade |
|---|---|---|
| `apps/web/app/(dashboard)/flows/_components/AskNodeFields.tsx` | criar | Form do nó `ask` (question/varName/crmField/validation). |
| `apps/web/app/(dashboard)/flows/_components/PredicateBuilder.tsx` | criar | Editor de chips de `Predicate[]` de uma aresta. |
| `apps/web/app/(dashboard)/flows/_components/MessageRichFields.tsx` | criar | Anexar mídia ou botões/lista a um nó `message`. |
| `apps/web/app/(dashboard)/flows/_components/BusinessHoursEditor.tsx` | criar | Editor de `businessHoursConfig` (reutilizável). |
| `apps/web/app/(dashboard)/flows/page.tsx` | modificar | Registrar nó `ask`, montar os novos campos no inspector, builder de predicados na aresta, resumo visual, validação de publicação. |
| `apps/web/app/(dashboard)/settings/page.tsx` | modificar | Seção "Horário comercial" usando `BusinessHoursEditor`, persistindo via `api.put('/api/settings', { settings })`. |

---

## Task E1 — Nó `ask` no editor

**Files:** create `_components/AskNodeFields.tsx`; modify `page.tsx`.

- [ ] **Step 1: Criar `apps/web/app/(dashboard)/flows/_components/AskNodeFields.tsx`**

```tsx
'use client';
import React from 'react';

export interface AskData {
  question?: string;
  varName?: string;
  crmField?: string;
  validation?: { type: 'text' | 'number' | 'email' | 'phone'; errorMessage: string; maxRetries: number };
}

const inputCls = 'w-full px-2 py-1.5 border border-gray-200 rounded text-xs outline-none focus:ring-2 focus:ring-primary-400';
const CRM_FIELDS = ['', 'name', 'email', 'company', 'funnelStage', 'leadScore'];

export function AskNodeFields({ data, onChange }: { data: AskData; onChange: (patch: Partial<AskData>) => void }) {
  const v = data.validation;
  const setValidationEnabled = (on: boolean) =>
    onChange({ validation: on ? { type: 'text', errorMessage: 'Resposta inválida, tente de novo.', maxRetries: 2 } : undefined });
  return (
    <div className="space-y-2">
      <div>
        <label className="text-[10px] text-gray-500">Pergunta (suporta {'{{var}}'})</label>
        <textarea className={inputCls} rows={2} value={data.question ?? ''}
          onChange={(e) => onChange({ question: e.target.value })} placeholder="Qual seu nome?" />
      </div>
      <div>
        <label className="text-[10px] text-gray-500">Salvar resposta na variável</label>
        <input className={inputCls} value={data.varName ?? ''}
          onChange={(e) => onChange({ varName: e.target.value.replace(/[^a-zA-Z0-9_]/g, '') })} placeholder="nome" />
      </div>
      <div>
        <label className="text-[10px] text-gray-500">Gravar também no campo do lead (CRM)</label>
        <select className={inputCls} value={data.crmField ?? ''} onChange={(e) => onChange({ crmField: e.target.value || undefined })}>
          {CRM_FIELDS.map((f) => <option key={f} value={f}>{f === '' ? '— não gravar —' : f}</option>)}
        </select>
      </div>
      <label className="flex items-center gap-2 text-[11px] text-gray-600">
        <input type="checkbox" checked={!!v} onChange={(e) => setValidationEnabled(e.target.checked)} />
        Validar a resposta
      </label>
      {v && (
        <div className="space-y-2 pl-2 border-l-2 border-gray-100">
          <div>
            <label className="text-[10px] text-gray-500">Tipo</label>
            <select className={inputCls} value={v.type}
              onChange={(e) => onChange({ validation: { ...v, type: e.target.value as AskData['validation']['type'] } })}>
              <option value="text">Texto</option>
              <option value="number">Número</option>
              <option value="email">E-mail</option>
              <option value="phone">Telefone</option>
            </select>
          </div>
          <div>
            <label className="text-[10px] text-gray-500">Mensagem se inválido</label>
            <input className={inputCls} value={v.errorMessage}
              onChange={(e) => onChange({ validation: { ...v, errorMessage: e.target.value } })} />
          </div>
          <div>
            <label className="text-[10px] text-gray-500">Tentativas extras (maxRetries)</label>
            <input type="number" min={0} max={5} className={inputCls} value={v.maxRetries}
              onChange={(e) => onChange({ validation: { ...v, maxRetries: Math.max(0, Number(e.target.value) || 0) } })} />
          </div>
          <p className="text-[10px] text-gray-400">Esgotando as tentativas, o fluxo segue pela aresta “else” (ou encerra se não houver).</p>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Registrar o nó `ask` no `page.tsx`**

Read `page.tsx` and make these edits, matching the existing patterns:
1. In `NODE_META` (after `condition`), add: `ask: { kind: 'fixed', label: 'Perguntar e capturar', palette: true }` (use the exact shape of the other entries — confirm whether they carry a `palette`/`docKey` field and mirror it).
2. In the `nodeSummary(node)` helper, add a case for `ask`: return something like `data.varName ? \`→ {{\${data.varName}}}\` : 'captura resposta'`.
3. In `NODE_DOCS` (the tooltip/education map), add an `ask` entry describing: "Faz uma pergunta, espera a resposta do cliente, valida e salva numa variável (e opcionalmente no CRM). Use {{a_variavel}} depois para personalizar."
4. In `NodeProperties`, add a branch `node.type === 'ask'` that renders `<AskNodeFields data={node.data ?? {}} onChange={updateNodeData} />`. Import `AskNodeFields` at the top.
5. Confirm `addNode('ask')` produces a node whose default `data` includes at least `{ label: 'Perguntar e capturar' }` (the generic addNode already sets label).

- [ ] **Step 3: Typecheck**

Run: `pnpm --filter @zappiq/web exec tsc --noEmit`
Expected: clean (no new errors).

- [ ] **Step 4: Commit**

```bash
git add "apps/web/app/(dashboard)/flows/_components/AskNodeFields.tsx" "apps/web/app/(dashboard)/flows/page.tsx"
git commit -m "feat(web): nó ask no editor de fluxos (captura+validação+CRM) (1A editor)"
```

*Visual verification (controller, not subagent): run dev server, open /flows, add an "Perguntar e capturar" node, confirm the inspector shows question/varName/CRM/validation and that toApiGraph serializes `data.varName`.*

---

## Task E2 — Builder de condições por predicados (arestas)

**Files:** create `_components/PredicateBuilder.tsx`; modify `page.tsx` (edge inspector + edge label).

- [ ] **Step 1: Criar `apps/web/app/(dashboard)/flows/_components/PredicateBuilder.tsx`**

```tsx
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
      <p className="text-[10px] text-gray-400">Todos os critérios precisam ser verdadeiros (E). Para “OU”, crie outra aresta para o mesmo destino.</p>
      {predicates.map((p, i) => (
        <div key={i} className="rounded border border-gray-150 p-1.5 space-y-1 bg-gray-50/50">
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
              <select className={inputCls} value={p.field} onChange={(e) => update(i, { ...p, field: e.target.value })}>
                {CONTACT_FIELDS.map((f) => <option key={f} value={f}>{f}</option>)}
                <option value={p.field.startsWith('customFields.') ? p.field : 'customFields.'}>campo custom…</option>
              </select>
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
              <select className={inputCls} value={p.match} onChange={(e) => update(i, { ...p, match: e.target.value as any })}>
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
    if (p.kind === 'contact_attr') return `${p.field} ${p.op}${p.value != null && p.value !== '' ? ' ' + p.value : ''}`;
    if (p.kind === 'var') return `${p.name} ${p.op}${p.value != null && p.value !== '' ? ' ' + p.value : ''}`;
    return p.expect === 'open' ? 'no horário' : 'fora do horário';
  };
  return predicates.map(one).join(' e ');
}
```

- [ ] **Step 2: Wire into the edge inspector in `page.tsx`**

Read the edge-inspector section (around the existing `setEdgeCondition` and the wait-branch dropdown). For a selected edge whose SOURCE node is a `condition` or `ask` node (i.e., not a `wait` node — wait keeps its existing reply/timeout dropdown), render the `PredicateBuilder`:
1. Import `{ PredicateBuilder, summarizePredicates, type Predicate }`.
2. Add a handler:
```ts
function setEdgePredicates(preds: Predicate[]) {
  setEdges((eds) => eds.map((e) => e.id === selectedEdgeId
    ? { ...e, label: preds.length ? summarizePredicates(preds) : undefined, data: { ...e.data, predicates: preds.length ? preds : undefined, when: undefined } }
    : e));
}
```
3. In the edge inspector JSX, for non-wait source nodes, replace the single keyword text input with:
   - a small note + `<PredicateBuilder predicates={(selectedEdge?.data?.predicates as Predicate[]) ?? []} onChange={setEdgePredicates} />`
   - PLUS a way to mark the edge as the default/else branch: a checkbox "Aresta padrão (else)" that sets `data: { when: { match: 'else' } , predicates: undefined }` and `label: 'padrão'`. When checked, hide the PredicateBuilder.
   Keep BACK-COMPAT: if an edge already has legacy `data.when` (non-else keyword), show it migrated as a single `keyword` predicate on first edit (read `when` → seed `[{kind:'keyword',match:when.match,value:when.value}]`) — do this seeding in the inspector when `predicates` is absent but `when` exists and is not else/timeout.
4. Update the edge label derivation (the `apiEdgesToCanvas`/label logic) so an edge with `data.predicates` shows `summarizePredicates(...)`, an else edge shows "padrão", a timeout edge still shows "sem resposta".

- [ ] **Step 3: Typecheck**

Run: `pnpm --filter @zappiq/web exec tsc --noEmit`
Expected: clean.

- [ ] **Step 4: Commit**

```bash
git add "apps/web/app/(dashboard)/flows/_components/PredicateBuilder.tsx" "apps/web/app/(dashboard)/flows/page.tsx"
git commit -m "feat(web): builder de condições por predicados (4 critérios em E) (1A editor)"
```

*Visual verification (controller): create condition node with 2 outgoing edges; on one, add `tags contains vip` + `horário=dentro`; mark the other as padrão; confirm labels and that toApiGraph emits `data.predicates`.*

---

## Task E3 — Mensagem rica (mídia + botões/lista)

**Files:** create `_components/MessageRichFields.tsx`; modify `page.tsx` (message inspector + node summary).

- [ ] **Step 1: Criar `apps/web/app/(dashboard)/flows/_components/MessageRichFields.tsx`**

```tsx
'use client';
import React from 'react';
import { Trash2, Plus } from 'lucide-react';

export interface MediaData { type: 'image' | 'audio' | 'document'; url: string; caption?: string }
export interface InteractiveData { type: 'button' | 'list'; options: { id: string; title: string }[] }
export interface MessageData { text?: string; media?: MediaData; interactive?: InteractiveData }

const inputCls = 'w-full px-2 py-1.5 border border-gray-200 rounded text-xs outline-none focus:ring-2 focus:ring-primary-400';
type Mode = 'text' | 'interactive' | 'media';

function modeOf(d: MessageData): Mode { return d.media ? 'media' : d.interactive ? 'interactive' : 'text'; }
const slug = (s: string) => s.toLowerCase().normalize('NFD').replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '').slice(0, 24) || 'opt';

export function MessageRichFields({ data, onChange }: { data: MessageData; onChange: (patch: Partial<MessageData>) => void }) {
  const mode = modeOf(data);
  const setMode = (m: Mode) => {
    if (m === 'text') onChange({ media: undefined, interactive: undefined });
    else if (m === 'media') onChange({ interactive: undefined, media: { type: 'image', url: '', caption: data.text || '' } });
    else onChange({ media: undefined, interactive: { type: 'button', options: [{ id: 'opt_1', title: '' }] } });
  };
  const it = data.interactive;
  const max = it?.type === 'list' ? 10 : 3;
  const setOpt = (i: number, title: string) =>
    onChange({ interactive: { ...it!, options: it!.options.map((o, j) => (j === i ? { id: o.id || slug(title) || `opt_${i + 1}`, title } : o)) } });
  const addOpt = () => it && it.options.length < max && onChange({ interactive: { ...it, options: [...it.options, { id: `opt_${it.options.length + 1}`, title: '' }] } });
  const rmOpt = (i: number) => it && onChange({ interactive: { ...it, options: it.options.filter((_, j) => j !== i) } });

  return (
    <div className="space-y-2">
      <div className="flex gap-1">
        {(['text', 'interactive', 'media'] as Mode[]).map((m) => (
          <button key={m} onClick={() => setMode(m)}
            className={`px-2 py-1 rounded text-[11px] border ${mode === m ? 'bg-primary-50 border-primary-300 text-primary-700' : 'border-gray-200 text-gray-500'}`}>
            {m === 'text' ? 'Texto' : m === 'interactive' ? 'Botões/Lista' : 'Mídia'}
          </button>
        ))}
      </div>

      {mode === 'media' && data.media && (
        <div className="space-y-2">
          <select className={inputCls} value={data.media.type} onChange={(e) => onChange({ media: { ...data.media!, type: e.target.value as MediaData['type'] } })}>
            <option value="image">Imagem</option>
            <option value="document">Documento</option>
            <option value="audio">Áudio</option>
          </select>
          <input className={inputCls} value={data.media.url} onChange={(e) => onChange({ media: { ...data.media!, url: e.target.value } })} placeholder="URL pública (https://…)" />
          {data.media.type !== 'audio' && (
            <input className={inputCls} value={data.media.caption ?? ''} onChange={(e) => onChange({ media: { ...data.media!, caption: e.target.value } })} placeholder="Legenda (suporta {{var}})" />
          )}
          {data.media.type === 'audio' && <p className="text-[10px] text-amber-600">Áudio por URL ainda não é enviado nesta versão.</p>}
        </div>
      )}

      {mode === 'interactive' && it && (
        <div className="space-y-2">
          <select className={inputCls} value={it.type} onChange={(e) => onChange({ interactive: { ...it, type: e.target.value as InteractiveData['type'], options: it.options.slice(0, e.target.value === 'list' ? 10 : 3) } })}>
            <option value="button">Botões (até 3)</option>
            <option value="list">Lista (até 10)</option>
          </select>
          <input className={inputCls} value={data.text ?? ''} onChange={(e) => onChange({ text: e.target.value })} placeholder="Texto da mensagem (corpo)" />
          {it.options.map((o, i) => (
            <div key={i} className="flex items-center gap-1">
              <input className={inputCls} value={o.title} onChange={(e) => setOpt(i, e.target.value)} placeholder={`Opção ${i + 1}`} />
              <button onClick={() => rmOpt(i)} className="text-gray-400 hover:text-red-500" title="Remover"><Trash2 size={13} /></button>
            </div>
          ))}
          {it.options.length < max && (
            <button onClick={addOpt} className="flex items-center gap-1 text-[11px] text-primary-600"><Plus size={13} /> Adicionar opção</button>
          )}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Wire into the message inspector in `page.tsx`**

In `NodeProperties`, for `node.type === 'message'`, KEEP the existing label + text fields, and BELOW them render `<MessageRichFields data={node.data ?? {}} onChange={updateNodeData} />` (import it). The text mode keeps the existing `data.text` behavior; interactive mode reuses `data.text` as the body; media mode hides text. Also update `nodeSummary` for `message`: if `data.media` → `'🖼 mídia'`/`'📄 doc'`, if `data.interactive` → `\`${data.interactive.options.length} ${data.interactive.type === 'list' ? 'itens' : 'botões'}\``, else the text snippet as today. Optionally add a small badge in `MaestroNode` when media/interactive present.

- [ ] **Step 3: Typecheck**

Run: `pnpm --filter @zappiq/web exec tsc --noEmit`
Expected: clean.

- [ ] **Step 4: Commit**

```bash
git add "apps/web/app/(dashboard)/flows/_components/MessageRichFields.tsx" "apps/web/app/(dashboard)/flows/page.tsx"
git commit -m "feat(web): mensagem com botões/lista/mídia no editor (1A editor)"
```

*Visual verification (controller): message node → switch to Botões, add 2 options, confirm node summary "2 botões" and toApiGraph emits `data.interactive.options` with ids.*

---

## Task E4 — Horário comercial nas configurações

**Files:** create `_components/BusinessHoursEditor.tsx`; modify `settings/page.tsx`.

- [ ] **Step 1: Criar `apps/web/app/(dashboard)/flows/_components/BusinessHoursEditor.tsx`**

```tsx
'use client';
import React from 'react';

export interface BusinessHoursConfig { timezone: string; days: Record<number, { open: string; close: string } | null> }
const DAYS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
const inputCls = 'px-2 py-1 border border-gray-200 rounded text-xs outline-none focus:ring-2 focus:ring-primary-400';

const DEFAULT: BusinessHoursConfig = {
  timezone: 'America/Sao_Paulo',
  days: { 0: null, 1: { open: '09:00', close: '18:00' }, 2: { open: '09:00', close: '18:00' }, 3: { open: '09:00', close: '18:00' }, 4: { open: '09:00', close: '18:00' }, 5: { open: '09:00', close: '18:00' }, 6: null },
};

export function defaultBusinessHours(): BusinessHoursConfig { return JSON.parse(JSON.stringify(DEFAULT)); }

export function BusinessHoursEditor({ value, onChange }: { value: BusinessHoursConfig; onChange: (c: BusinessHoursConfig) => void }) {
  const setDay = (d: number, win: { open: string; close: string } | null) => onChange({ ...value, days: { ...value.days, [d]: win } });
  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <label className="text-xs text-gray-600">Fuso</label>
        <input className={inputCls} value={value.timezone} onChange={(e) => onChange({ ...value, timezone: e.target.value })} />
      </div>
      <div className="space-y-1">
        {DAYS.map((name, d) => {
          const win = value.days[d];
          return (
            <div key={d} className="flex items-center gap-2">
              <label className="flex items-center gap-1 w-16 text-xs text-gray-600">
                <input type="checkbox" checked={!!win} onChange={(e) => setDay(d, e.target.checked ? { open: '09:00', close: '18:00' } : null)} />
                {name}
              </label>
              {win ? (
                <>
                  <input type="time" className={inputCls} value={win.open} onChange={(e) => setDay(d, { ...win, open: e.target.value })} />
                  <span className="text-gray-400 text-xs">às</span>
                  <input type="time" className={inputCls} value={win.close} onChange={(e) => setDay(d, { ...win, close: e.target.value })} />
                </>
              ) : <span className="text-xs text-gray-400">fechado</span>}
            </div>
          );
        })}
      </div>
      <p className="text-[10px] text-gray-400">Usado pelas condições “Horário comercial” dos fluxos. Janela vira-noite: use dois dias.</p>
    </div>
  );
}
```

- [ ] **Step 2: Add a "Horário comercial" section to `settings/page.tsx`**

Read `settings/page.tsx` and follow its existing pattern for a settings card + save. Add a section that:
1. Reads current `settings.businessHoursConfig` (or `defaultBusinessHours()` if absent) into local state.
2. Renders `<BusinessHoursEditor value={bh} onChange={setBh} />` (import from the flows `_components` path).
3. On save, calls `api.put('/api/settings', { settings: { ...currentSettings, businessHoursConfig: bh } })` — mirror EXACTLY how the page already persists settings (find its existing settings-load and save pattern; do not invent an endpoint).

- [ ] **Step 3: Typecheck**

Run: `pnpm --filter @zappiq/web exec tsc --noEmit`
Expected: clean.

- [ ] **Step 4: Commit**

```bash
git add "apps/web/app/(dashboard)/flows/_components/BusinessHoursEditor.tsx" "apps/web/app/(dashboard)/settings/page.tsx"
git commit -m "feat(web): editor de horário comercial estruturado nas configurações (1A editor)"
```

*Visual verification (controller): settings → edit hours → save → reload → persisted; the engine's business_hours predicate now has data.*

---

## Task E5 — Validação de publicação (guard-rails)

**Files:** modify `page.tsx` (the `publish`/`save` path).

- [ ] **Step 1: Add client-side validation before publish**

Read the `publish()` function in `page.tsx`. Before sending, compute warnings and block/confirm if structural problems exist:
- Any `message` node with `interactive.type==='button'` and >3 options, or `list` and >10 options → block with a message (shouldn't happen since the editor caps, but defend).
- Any `interactive` option with empty `title` → block ("toda opção precisa de um texto").
- Any `condition` or `ask` node that has outgoing edges but NO default branch (no edge with `data.when.match==='else'` and no bare edge without predicates) → warn (allow publish via confirm, since ending is valid but often unintended).
- Any `ask` node missing `varName` → block.
- Any `media` node with empty `url` → block.

Implement as a `validateGraph(nodes, edges): { errors: string[]; warnings: string[] }` helper near `toApiGraph`, call it at the start of `publish()`; if `errors.length` show them and abort; if only `warnings`, `window.confirm` them.

- [ ] **Step 2: Typecheck**

Run: `pnpm --filter @zappiq/web exec tsc --noEmit`
Expected: clean.

- [ ] **Step 3: Commit**

```bash
git add "apps/web/app/(dashboard)/flows/page.tsx"
git commit -m "feat(web): validação de publicação para fluxos ricos (1A editor)"
```

*Visual verification (controller): publish a flow with an ask node missing varName → blocked with message; with a condition node lacking default → confirm prompt.*

---

## Verificação final (controller)
- `pnpm --filter @zappiq/web exec tsc --noEmit` limpo.
- `pnpm --filter @zappiq/web exec next build` conclui sem erro de tipo/build.
- Preview: criar um fluxo de ponta a ponta no canvas usando ask + condição por predicado + botões; salvar/publicar; abrir o painel de teste e confirmar que os efeitos saem (`send_interactive`, `update_lead`, etc.).

## Cobertura do spec (editor)
| Item do spec 1A (editor) | Task |
|---|---|
| Paleta com nó `ask` + inspetor | E1 |
| Condition builder em chips (4 critérios em E) | E2 |
| Inspetor de mídia/botões no `message` | E3 |
| UI de `businessHoursConfig` | E4 |
| Validação de estrutura (≤3/≤10, ramo padrão) | E5 |

## Notas
- Os componentes novos ficam em `flows/_components/` (pasta com `_` = não vira rota no App Router).
- Nenhuma mudança de backend: o `data` round-trips via `toApiGraph` → `PUT /api/flows/:id` (schema aceita `nodes/edges` como `z.any()`).
- Sem harness de teste de componente no `apps/web`; verificação = typecheck + `next build` + preview manual.
