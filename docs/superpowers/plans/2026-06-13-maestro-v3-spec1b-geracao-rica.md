# Maestro v3 — Spec 1B (Geração Rica por IA) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:subagent-driven-development. Pure modules use TDD (failing test first). Test: `pnpm --filter @zappiq/api exec vitest run <pattern>`. ESM imports use `.js` suffix. Steps use `- [ ]`.

**Goal:** Ensinar a IA do Maestro a gerar fluxos ricos (ask, perguntas-com-botões, ramificações por variável/horário) via **composição de blocos validados**: a IA produz um plano de blocos semânticos; um montador puro o transforma em `nodes`/`edges` válidos por construção; fallback para o blueprint atual em qualquer falha.

**Architecture:** 3 módulos puros (`flowGraphValidation`, `flowBlocks`, `flowAssembler`) + extensão IO no `flowGenerator` (`generateRichDraft`). Os blocos emitem os `data` shapes que o motor 1A executa e o editor 1A renderiza. Spec: `docs/superpowers/specs/2026-06-13-maestro-v3-spec1b-geracao-rica-design.md`.

**Tech Stack:** TypeScript, Vitest, Anthropic via `llmRouter`, Prisma. Branch: continua em `maestro-v3-spec1a-motor`.

**Contratos existentes (de `flowGenerator.ts`/`flowBlueprints.ts`, já lidos):**
- nó: `{ id, type, data: { label, ...campos } }`; aresta: `{ id, source, target, data? }`.
- Tipos de nó do motor: `start|message|condition|ai|tag|update_lead|transfer|wait|schedule|goto_flow|ask`.
- `data.predicates: Predicate[]` (ramos), `data.when={match:'else'}` (ramo padrão), `ask` data `{question,varName,crmField?,validation?}`, `message` interactive `data.interactive={type,options:[{id,title}]}`.
- `BLUEPRINTS: Record<BlueprintGoal, Blueprint>`, `Blueprint{id,goal,label,description,defaults}`, `buildGraphFromContent(content)`.
- `generateDraftForObjective(ctx, blueprint, organizationId, multiAgent): Promise<FlowDraft>` — núcleo usado por `generateSmartFlows` e `generateJourney`.
- `loadBusinessContext(orgId) → { brief, plan, ... }`; `extractJson(text)`; `llmRouter.complete({system,messages,maxTokens,temperature,tier,forceProvider,orgId,operation}) → {text}`.
- `FlowDraft.source: 'ai' | 'fallback'` (vamos adicionar `'ai-rich'`).

**Plano de blocos (formato que a IA devolve):**
```
{ flowName, entry, blocks: [ {id, type, ...slots, next?/options?/cases?/elseNext?/openNext?/closedNext?} ], rationale?, summary? }
```
`type` ∈ `message|ask|ask_buttons|branch_var|branch_hours|tag|ai|handoff`.

---

## Estrutura de arquivos

| Arquivo | Ação | Responsabilidade |
|---|---|---|
| `apps/api/src/agents/flowGraphValidation.ts` | criar | `validateGraph(nodes,edges)` puro — porta da regra do editor E5. |
| `apps/api/src/agents/flowGraphValidation.test.ts` | criar | Testes das regras. |
| `apps/api/src/agents/flowBlocks.ts` | criar | Catálogo: `expandBlock(block) → Fragment`. Puro. |
| `apps/api/src/agents/flowBlocks.test.ts` | criar | Testes de expansão por bloco. |
| `apps/api/src/agents/flowAssembler.ts` | criar | `assemble(plan) → {ok,graph}|{ok:false,errors}`. Puro. |
| `apps/api/src/agents/flowAssembler.test.ts` | criar | Testes de costura/else-completion/rejeição. |
| `apps/api/src/agents/flowRecipes.ts` | criar | Receita-semente de blocos por objetivo (dados puros). |
| `apps/api/src/agents/flowGenerator.ts` | modificar | `generateRichDraft` + integração rica-primeiro no `generateDraftForObjective`; `FlowDraft.source` += `'ai-rich'`. |
| `apps/api/src/agents/flowGenerator.rich.test.ts` | criar | Integração com `llmRouter` mockado (plano válido → rico; lixo → fallback). |

---

## Phase 1 — Validação de grafo (puro)

### Task B1: `flowGraphValidation`

**Files:** create `flowGraphValidation.ts` + `.test.ts`.

- [ ] **Step 1: Teste que falha** — `apps/api/src/agents/flowGraphValidation.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { validateGraph } from './flowGraphValidation.js';

const N = (id: string, type: string, data: any = {}) => ({ id, type, data });
const E = (source: string, target: string, data?: any) => ({ id: `${source}_${target}`, source, target, data });

describe('validateGraph', () => {
  it('ask sem varName → erro; ask sem else → erro', () => {
    const r = validateGraph([N('q', 'ask', { question: 'x' })], [E('q', 'fim')]);
    expect(r.errors.some((e) => /vari/i.test(e))).toBe(true);
    expect(r.errors.some((e) => /else|padr/i.test(e))).toBe(true);
  });

  it('ask com varName e aresta else → ok', () => {
    const r = validateGraph(
      [N('q', 'ask', { question: 'x', varName: 'nome' }), N('ok', 'ai'), N('no', 'ai')],
      [E('q', 'ok'), E('q', 'no', { when: { match: 'else' } })],
    );
    expect(r.errors).toEqual([]);
  });

  it('interactive: 0 opções, título vazio, id duplicado, excesso → erros', () => {
    const dup = validateGraph([N('m', 'message', { interactive: { type: 'button', options: [{ id: 'a', title: 'X' }, { id: 'a', title: 'Y' }] } })], []);
    expect(dup.errors.some((e) => /duplicad/i.test(e))).toBe(true);
    const empty = validateGraph([N('m', 'message', { interactive: { type: 'button', options: [{ id: 'a', title: '' }] } })], []);
    expect(empty.errors.some((e) => /texto/i.test(e))).toBe(true);
    const over = validateGraph([N('m', 'message', { interactive: { type: 'button', options: [1,2,3,4].map((i) => ({ id: 'o' + i, title: 'T' + i })) } })], []);
    expect(over.errors.some((e) => /máximo|maximo/i.test(e))).toBe(true);
  });

  it('condition com saídas sem ramo padrão → warning', () => {
    const r = validateGraph(
      [N('c', 'condition'), N('a', 'ai'), N('b', 'ai')],
      [E('c', 'a', { predicates: [{ kind: 'keyword', match: 'equals', value: 'sim' }] }), E('c', 'b', { predicates: [{ kind: 'keyword', match: 'equals', value: 'nao' }] })],
    );
    expect(r.warnings.some((w) => /padr/i.test(w))).toBe(true);
  });

  it('grafo simples válido → sem erros nem warnings', () => {
    const r = validateGraph([N('s', 'start'), N('m', 'message', { text: 'oi' })], [E('s', 'm')]);
    expect(r.errors).toEqual([]);
    expect(r.warnings).toEqual([]);
  });
});
```

- [ ] **Step 2: Rodar, ver falhar** — `pnpm --filter @zappiq/api exec vitest run flowGraphValidation` → FAIL (módulo ausente).

- [ ] **Step 3: Implementar** — `apps/api/src/agents/flowGraphValidation.ts`. Porta da `validateGraph` do editor (apps/web .../flows/page.tsx, função homônima da E5). Regras: por nó — `ask` sem `varName` → erro; `ask` com saídas mas sem aresta `when.match==='else'` → erro; `message.interactive` com 0 opções / >limite (3 botão, 10 lista) / título vazio / id duplicado → erro; predicado `contact_attr` com `field==='customFields.'` → erro. Warning: `condition` com saídas mas sem ramo padrão (`else` ou aresta sem `when`/`predicates`). Assinatura:
```ts
export interface GraphIssues { errors: string[]; warnings: string[] }
export function validateGraph(nodes: any[], edges: any[]): GraphIssues { /* ... */ }
```
Implemente seguindo os testes acima e a lógica do editor E5 (adapte para o tipo `ask` exigir else explícito, igual ao motor `pickElseBranch`).

- [ ] **Step 4: Rodar, ver passar** — `pnpm --filter @zappiq/api exec vitest run flowGraphValidation` → PASS.

- [ ] **Step 5: Commit** — `git add apps/api/src/agents/flowGraphValidation.ts apps/api/src/agents/flowGraphValidation.test.ts && git commit -m "feat(maestro): validateGraph puro no backend (1B)"`

---

## Phase 2 — Catálogo de blocos (puro)

### Task B2: `flowBlocks.expandBlock`

**Files:** create `flowBlocks.ts` + `.test.ts`.

Contrato:
```ts
export interface BlockExit { key: string; from: string; edgeData?: any } // key: 'next'|'ok'|'else'|`opt:<i>`|`case:<i>`|'open'|'closed'
export interface Fragment { nodes: any[]; edges: any[]; entry: string; exits: BlockExit[] }
export function expandBlock(block: any): Fragment
```
Cada `expandBlock` usa ids locais prefixados com `block.id` (ex.: `${id}`, `${id}_cond`). Sanitiza slots (limites 1A: text 600, tag 40 kebab `[a-z0-9-]`, prompt 900, título botão 20, varName `[a-z0-9_]`). As arestas internas do fragmento já vão em `edges`; as ligações para outros blocos saem em `exits` (o montador resolve os targets).

- [ ] **Step 1: Teste que falha** — `flowBlocks.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { expandBlock } from './flowBlocks.js';

describe('expandBlock', () => {
  it('message: 1 nó message + exit next', () => {
    const f = expandBlock({ id: 'b1', type: 'message', text: 'Oi {{vars.x}}' });
    expect(f.nodes).toHaveLength(1);
    expect(f.nodes[0]).toMatchObject({ id: 'b1', type: 'message', data: { text: 'Oi {{vars.x}}' } });
    expect(f.entry).toBe('b1');
    expect(f.exits).toEqual([{ key: 'next', from: 'b1' }]);
  });

  it('ask: nó ask com varName saneado + exits ok/else', () => {
    const f = expandBlock({ id: 'b2', type: 'ask', question: 'Seu e-mail?', varName: 'e mail!', validationType: 'email', errorMessage: 'inválido', crmField: 'email' });
    expect(f.nodes[0]).toMatchObject({ id: 'b2', type: 'ask', data: { question: 'Seu e-mail?', varName: 'email', crmField: 'email', validation: { type: 'email', errorMessage: 'inválido' } } });
    expect(f.exits.map((e) => e.key).sort()).toEqual(['else', 'ok']);
  });

  it('ask_buttons: message interactive + condition; exits por opção (predicate keyword) + else', () => {
    const f = expandBlock({ id: 'b3', type: 'ask_buttons', question: 'O que procura?', options: [{ title: 'Planos' }, { title: 'Suporte' }] });
    const msg = f.nodes.find((n) => n.type === 'message');
    const cond = f.nodes.find((n) => n.type === 'condition');
    expect(msg.data.interactive.type).toBe('button');
    expect(msg.data.interactive.options.map((o: any) => o.title)).toEqual(['Planos', 'Suporte']);
    expect(msg.data.interactive.options.every((o: any) => !!o.id)).toBe(true);
    expect(f.entry).toBe(msg.id);
    // aresta interna message → condition
    expect(f.edges.some((e) => e.source === msg.id && e.target === cond.id)).toBe(true);
    const optExits = f.exits.filter((e) => e.key.startsWith('opt:'));
    expect(optExits).toHaveLength(2);
    expect(optExits[0].from).toBe(cond.id);
    expect(optExits[0].edgeData.predicates[0]).toMatchObject({ kind: 'keyword', match: 'equals', value: 'Planos' });
    expect(f.exits.some((e) => e.key === 'else')).toBe(true);
  });

  it('branch_var: condition com predicate var por caso + else', () => {
    const f = expandBlock({ id: 'b4', type: 'branch_var', varName: 'plano', cases: [{ op: 'eq', value: 'pro' }, { op: 'eq', value: 'free' }] });
    expect(f.nodes[0].type).toBe('condition');
    const caseExits = f.exits.filter((e) => e.key.startsWith('case:'));
    expect(caseExits[0].edgeData.predicates[0]).toMatchObject({ kind: 'var', name: 'plano', op: 'eq', value: 'pro' });
    expect(f.exits.some((e) => e.key === 'else')).toBe(true);
  });

  it('branch_hours: open (predicate) + closed (else)', () => {
    const f = expandBlock({ id: 'b5', type: 'branch_hours' });
    expect(f.nodes[0].type).toBe('condition');
    const open = f.exits.find((e) => e.key === 'open');
    const closed = f.exits.find((e) => e.key === 'closed');
    expect(open!.edgeData.predicates[0]).toMatchObject({ kind: 'business_hours', expect: 'open' });
    expect(closed!.edgeData.when).toMatchObject({ match: 'else' });
  });

  it('tag/ai/handoff', () => {
    expect(expandBlock({ id: 't', type: 'tag', tag: 'Lead Quente!' }).nodes[0].data.tag).toBe('lead-quente');
    expect(expandBlock({ id: 'a', type: 'ai', prompt: 'faça X' }).nodes[0]).toMatchObject({ type: 'ai', data: { prompt: 'faça X' } });
    const h = expandBlock({ id: 'h', type: 'handoff' });
    expect(h.nodes[0].type).toBe('transfer');
    expect(h.exits).toEqual([]);
  });
});
```

- [ ] **Step 2: Rodar, ver falhar.**
- [ ] **Step 3: Implementar `flowBlocks.ts`** conforme os testes. Detalhes:
  - `ask_buttons`: gera `${id}` (message interactive, `data.interactive={type:'button',options:[{id:slug(title)||'opt_'+i, title:trunc(title,20)}]}` + `data.text=question`) e `${id}_cond` (condition); aresta interna message→cond; exits `opt:<i>` saem do cond com `edgeData.predicates=[{kind:'keyword',match:'equals',value:title}]`; exit `else` do cond.
  - `ask`: 1 nó; `validation` só se `validationType` presente (`{type, errorMessage: errorMessage||'Resposta inválida, tente de novo.', maxRetries: 2}`); exits `ok` (sem edgeData) e `else` (`edgeData.when={match:'else'}`).
  - `branch_var`: 1 condition; exits `case:<i>` com `predicates=[{kind:'var',name:varName,op,value}]`; exit `else`.
  - `branch_hours`: 1 condition; exit `open` (`predicates business_hours open`), exit `closed` (`when else`).
  - `message`/`tag`/`ai`: 1 nó, exit `next`. `handoff`: 1 `transfer`, sem exits.
  - Helper `slug` (igual ao do editor) e limites.
- [ ] **Step 4: Rodar, ver passar.**
- [ ] **Step 5: Commit** — `git commit -m "feat(maestro): catálogo de blocos flowBlocks (expand puro) (1B)"`

---

## Phase 3 — Montador (puro)

### Task B3: `flowAssembler.assemble`

**Files:** create `flowAssembler.ts` + `.test.ts`.

Contrato:
```ts
export interface AssembleResult { ok: true; graph: { nodes: any[]; edges: any[] }; warnings: string[] } | { ok: false; errors: string[] }
export function assemble(plan: any): AssembleResult
```
Algoritmo (ver spec §6): valida plano → expande blocos → costura exits→entries → else-completion → start+layout → `validateGraph` final. Resolução de targets a partir do plano:
- exit `next` → `block.next`; `ok` → `block.next`; `opt:<i>` → `block.options[i].next`; `case:<i>` → `block.cases[i].next`; `open` → `block.openNext`; `closed` → `block.closedNext`; `else` → `block.elseNext` (se ausente → else-completion).

- [ ] **Step 1: Teste que falha** — `flowAssembler.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { assemble } from './flowAssembler.js';

describe('assemble', () => {
  it('plano linear válido → grafo com start + nós + arestas', () => {
    const r = assemble({
      flowName: 'F', entry: 'b1',
      blocks: [
        { id: 'b1', type: 'message', text: 'Oi', next: 'b2' },
        { id: 'b2', type: 'ai', prompt: 'ajude' },
      ],
    });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    const start = r.graph.nodes.find((n) => n.type === 'start');
    expect(start).toBeTruthy();
    // start liga ao entry expandido
    expect(r.graph.edges.some((e) => e.source === start.id)).toBe(true);
    expect(r.graph.nodes.some((n) => n.type === 'message')).toBe(true);
    expect(r.graph.nodes.some((n) => n.type === 'ai')).toBe(true);
  });

  it('ask_buttons: cada opção vira aresta de predicate keyword para o alvo certo', () => {
    const r = assemble({
      flowName: 'Q', entry: 'b1',
      blocks: [
        { id: 'b1', type: 'ask_buttons', question: 'O que?', options: [{ title: 'Planos', next: 'b2' }, { title: 'Suporte', next: 'b3' }], elseNext: 'b3' },
        { id: 'b2', type: 'ai', prompt: 'planos' },
        { id: 'b3', type: 'ai', prompt: 'suporte' },
      ],
    });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    const cond = r.graph.nodes.find((n) => n.type === 'condition');
    const out = r.graph.edges.filter((e) => e.source === cond.id);
    // 2 opções + 1 else
    expect(out.some((e) => e.data?.predicates?.[0]?.value === 'Planos')).toBe(true);
    expect(out.some((e) => e.data?.when?.match === 'else')).toBe(true);
  });

  it('else-completion: ask sem elseNext recebe um destino seguro (não fica órfão)', () => {
    const r = assemble({
      flowName: 'A', entry: 'b1',
      blocks: [
        { id: 'b1', type: 'ask', question: 'email?', varName: 'email', validationType: 'email', next: 'b2' },
        { id: 'b2', type: 'ai', prompt: 'segue' },
      ],
    });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    const askId = 'b1';
    const elseEdge = r.graph.edges.find((e) => e.source === askId && e.data?.when?.match === 'else');
    expect(elseEdge).toBeTruthy();
    expect(elseEdge!.target).toBeTruthy(); // ligado a algo (ai de fallback / primeiro ai)
  });

  it('plano inválido: next órfão → ok:false', () => {
    const r = assemble({ flowName: 'X', entry: 'b1', blocks: [{ id: 'b1', type: 'message', text: 'oi', next: 'naoexiste' }] });
    expect(r.ok).toBe(false);
  });

  it('plano inválido: type desconhecido → ok:false', () => {
    const r = assemble({ flowName: 'X', entry: 'b1', blocks: [{ id: 'b1', type: 'foobar' }] });
    expect(r.ok).toBe(false);
  });

  it('grafo montado passa na validateGraph (todo ramo com else, ids únicos)', () => {
    const r = assemble({
      flowName: 'Q', entry: 'b1',
      blocks: [
        { id: 'b1', type: 'ask_buttons', question: 'O que?', options: [{ title: 'A', next: 'b2' }, { title: 'B', next: 'b2' }] },
        { id: 'b2', type: 'ai', prompt: 'x' },
      ],
    });
    expect(r.ok).toBe(true);
  });
});
```

- [ ] **Step 2: Rodar, ver falhar.**
- [ ] **Step 3: Implementar `flowAssembler.ts`.** Importa `expandBlock` de `./flowBlocks.js` e `validateGraph` de `./flowGraphValidation.js`. Passos:
  1. Validação do plano: `plan.blocks` array não-vazio; `plan.entry` existe; cada `block.id` único; cada `block.type` ∈ catálogo; resolver cada exit-target referenciado e checar que aponta para um `block.id` existente (targets de `else`/`closed` ausentes são permitidos — vão para else-completion). Falha → `{ ok:false, errors }`.
  2. Expande todos os blocos; mapa `blockId → Fragment`.
  3. Costura: para cada bloco e cada exit do seu fragmento, resolve o target (tabela acima). Se houver target → aresta `{ source: exit.from, target: targetFragment.entry, data: exit.edgeData }`. Se exit `else`/`closed` sem target → else-completion: liga ao primeiro nó `ai` do grafo; se não houver `ai`, cria um nó `ai` de fallback `{ type:'ai', data:{ label:'Atendimento', prompt:'Entenda o pedido do cliente e ajude usando o conhecimento do negócio.' } }` e liga nele. (exit `ok`/`next`/`opt`/`case`/`open` sem target = fim natural — não cria aresta.)
  4. Prepende `start` (`{id:'start', type:'start', data:{label:'Início'}}`) com aresta `start → fragment(plan.entry).entry`.
  5. Layout: BFS a partir do start; `position = { x: depth*240, y: indexNoNível*120 }` em cada nó (cosmético).
  6. `validateGraph(nodes, edges)`: se `errors.length` → `{ ok:false, errors }`; senão `{ ok:true, graph, warnings }`.
  - Garante ids de aresta únicos (`e_${source}_${target}_${i}`).
- [ ] **Step 4: Rodar, ver passar.**
- [ ] **Step 5: Commit** — `git commit -m "feat(maestro): montador flowAssembler (plano→grafo válido) (1B)"`

---

## Phase 4 — Receitas-semente por objetivo (dados puros)

### Task B4: `flowRecipes`

**Files:** create `flowRecipes.ts` (+ opcional teste leve).

- [ ] **Step 1: Implementar** — exporta `RECIPES: Record<BlueprintGoal, string>` onde cada valor é um **exemplo de plano** (texto compacto pt-BR) que será injetado no prompt como ponto de partida para aquele objetivo. Ex. (qualificação): boas-vindas → ask_buttons(o que procura) → ramos por interesse → tag + ai. Mantenha curto (≤ ~25 linhas por receita). Importa `BlueprintGoal` de `./flowBlueprints.js`. Também exporta `BLOCK_SPEC: string` — a tabela compacta type→slots (Seção 4 do spec) para o prompt, e `FEW_SHOT: string` — um plano-exemplo JSON completo (o da spec §5).
- [ ] **Step 2: Commit** — `git commit -m "feat(maestro): receitas-semente e spec de blocos p/ prompt (1B)"`

---

## Phase 5 — Geração rica (IO) + integração

### Task B5: `generateRichDraft` + wiring

**Files:** modify `flowGenerator.ts`; create `flowGenerator.rich.test.ts`.

- [ ] **Step 1: Teste de integração (LLM mockado)** — `flowGenerator.rich.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../services/llm/LLMRouter.js', () => ({
  llmRouter: { complete: vi.fn() },
}));
vi.mock('@zappiq/database', () => ({
  prisma: { organization: { findUnique: vi.fn().mockResolvedValue({ plan: 'GROWTH', settings: { businessName: 'Loja X', niche: 'varejo' } }) }, kBDocument: { findMany: vi.fn().mockResolvedValue([]) }, QAPair: { findMany: vi.fn().mockResolvedValue([]) } },
}));

import { llmRouter } from '../services/llm/LLMRouter.js';
import { generateRichDraft } from './flowGenerator.js';
import { loadBusinessContext } from './flowGenerator.js';
import { BLUEPRINTS } from './flowBlueprints.js';

const PLAN = JSON.stringify({
  flowName: 'Qualificação',
  entry: 'b1',
  blocks: [
    { id: 'b1', type: 'message', text: 'Oi!', next: 'b2' },
    { id: 'b2', type: 'ask_buttons', question: 'O que procura?', options: [{ title: 'Planos', next: 'b3' }, { title: 'Suporte', next: 'b3' }] },
    { id: 'b3', type: 'ai', prompt: 'ajude' },
  ],
  summary: 'fluxo rico', rationale: [],
});

describe('generateRichDraft', () => {
  beforeEach(() => vi.clearAllMocks());

  it('plano válido → draft rico (ask/condition/interactive, source ai-rich)', async () => {
    (llmRouter.complete as any).mockResolvedValue({ text: PLAN });
    const ctx = await loadBusinessContext('org1');
    const draft = await generateRichDraft(ctx, BLUEPRINTS.qualificacao, 'org1', false);
    expect(draft.source).toBe('ai-rich');
    expect(draft.nodes.some((n: any) => n.type === 'condition')).toBe(true);
    expect(draft.nodes.some((n: any) => n.data?.interactive)).toBe(true);
  });

  it('JSON inválido → fallback (não ai-rich, grafo do blueprint)', async () => {
    (llmRouter.complete as any).mockResolvedValue({ text: 'desculpa, não consigo' });
    const ctx = await loadBusinessContext('org1');
    const draft = await generateRichDraft(ctx, BLUEPRINTS.qualificacao, 'org1', false);
    expect(draft.source).not.toBe('ai-rich');
    expect(draft.nodes.length).toBeGreaterThan(0);
  });

  it('LLM lança → fallback', async () => {
    (llmRouter.complete as any).mockRejectedValue(new Error('boom'));
    const ctx = await loadBusinessContext('org1');
    const draft = await generateRichDraft(ctx, BLUEPRINTS.qualificacao, 'org1', false);
    expect(draft.source).not.toBe('ai-rich');
  });
});
```

(Confirme os caminhos de mock — `loadBusinessContext` faz queries Prisma; ajuste o mock de `prisma` para os models realmente usados: `organization`, `kBDocument`, `QAPair`. Se o nome do model/condições diferirem, adapte o mock ao real.)

- [ ] **Step 2: Rodar, ver falhar** (função inexistente / não exportada).

- [ ] **Step 3: Implementar em `flowGenerator.ts`:**
  1. `FlowDraft.source` union → adicionar `'ai-rich'`.
  2. `export async function generateRichDraft(ctx: BusinessContext, blueprint: Blueprint, organizationId: string, multiAgent: boolean): Promise<FlowDraft>`:
     - System: instruções de "monte ESCOLHENDO e ENCADEANDO blocos; só JSON".
     - User: `ctx.brief` + objetivo (`blueprint.label/description`) + `BLOCK_SPEC` + `FEW_SHOT` + `RECIPES[blueprint.goal]` + regras (≤3 botões, sempre ofereça "Outro/else", pt-BR). Importar de `./flowRecipes.js`.
     - `llmRouter.complete({ system, messages:[{role:'user',content:user}], maxTokens:1500, temperature:0.5, tier, forceProvider:'anthropic-sonnet', orgId:organizationId, operation:'chat' })`.
     - `const plan = extractJson(resp.text)`; `if (!plan) → fallback`.
     - `const res = assemble(plan)`; `if (!res.ok) → fallback`.
     - Sucesso → `FlowDraft`: `name: sanitize(plan.flowName)||blueprint.defaults.flowName`, `nodes:res.graph.nodes`, `edges:res.graph.edges`, `triggerType:'FIRST_CONTACT'`, `triggerConfig:{}`, `rationale: parse de plan.rationale (igual aos outros caminhos)`, `summary: plan.summary||default`, `blueprintId/Label`, `source:'ai-rich'`.
     - **fallback** = `return generateDraftForObjective(ctx, blueprint, organizationId, multiAgent)` (o caminho atual content-fill). Envolva TODO o corpo num try/catch que cai no fallback (fail-soft).
  3. **Wiring**: no início de `generateDraftForObjective`, ANTES de montar o prompt atual, tentar a rica — mas cuidado com recursão (generateRichDraft chama generateDraftForObjective no fallback). Solução: extrair o corpo ATUAL de `generateDraftForObjective` para uma função interna `generateContentFillDraft(ctx, blueprint, organizationId, multiAgent)` (o conteúdo de hoje, sem mudanças), e fazer:
     ```ts
     export async function generateDraftForObjective(ctx, blueprint, organizationId, multiAgent) {
       try {
         const rich = await generateRichDraft(ctx, blueprint, organizationId, multiAgent);
         if (rich.source === 'ai-rich') return rich;
       } catch { /* fail-soft */ }
       return generateContentFillDraft(ctx, blueprint, organizationId, multiAgent);
     }
     ```
     E `generateRichDraft`'s fallback chama `generateContentFillDraft` (NÃO `generateDraftForObjective`) para evitar recursão. Ajuste as referências internas.

- [ ] **Step 4: Rodar, ver passar** — `pnpm --filter @zappiq/api exec vitest run flowGenerator.rich` e a suíte de agents `pnpm --filter @zappiq/api exec vitest run src/agents` (nada quebrado). Também `tsc --noEmit`.

- [ ] **Step 5: Commit** — `git commit -m "feat(maestro): generateRichDraft + rica-primeiro no gerador (1B)"`

---

## Phase 6 — Smoke/doc

### Task B6: roteiro de smoke 1B

**Files:** create `docs/maestro/smoke-1b.md`.

- [ ] **Step 1:** Documentar: gerar fluxo via Maestro Inteligente/Jornada para uma org com brief preenchido → conferir no canvas que o fluxo gerado tem nó(s) `ask`/perguntas com botões/ramos (source ai-rich), e que cai em blueprint simples quando o LLM falha. Validar publicação (a `validateGraph` do editor não bloqueia o fluxo gerado).
- [ ] **Step 2: Commit** — `git commit -m "docs(maestro): roteiro de smoke 1B"`

---

## Cobertura do spec
| Item | Task |
|---|---|
| validateGraph backend | B1 |
| Catálogo de blocos (expand) | B2 |
| Montador (costura/else/layout/validação) | B3 |
| Receitas-semente + spec de blocos p/ prompt | B4 |
| generateRichDraft + fallback + wiring | B5 |
| Smoke | B6 |

## Notas
- Tudo aditivo: caminhos existentes (`generateFlowDraft`, refresh, `generateJourney`, `generateSmartFlows`) intactos; só `generateDraftForObjective` ganha a tentativa rica-primeiro com fallback idêntico ao de hoje.
- Sem mudança de schema/DB. Os fluxos gerados são DRAFTS (não persistem) — o cliente revisa/salva, como hoje.
- Os shapes emitidos pelos blocos são exatamente os da 1A → renderizam/editam no canvas e executam no motor sem mudança.
