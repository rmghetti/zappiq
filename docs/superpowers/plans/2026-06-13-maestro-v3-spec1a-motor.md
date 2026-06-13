# Maestro v3 — Spec 1A (Motor/Backend) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Estender o motor puro do Maestro para capturar respostas em variáveis, interpolar `{{var}}` em conteúdo, enviar botões/listas/mídia no WhatsApp e ramificar por atributos do contato + variáveis + horário comercial — sem quebrar o padrão motor-puro nem os testes existentes.

**Architecture:** O motor `flowEngine.resolveFlowStep` continua puro; recebe um `EvalContext` (contato, horário, agora) via `ResolveOptions.ctx`, montado pela camada IO `flowRuntime`. Três módulos puros novos (`flowInterpolate`, `businessHours`, `flowPredicates`) concentram a lógica de decisão. Efeitos novos (`send_interactive`, `send_media`) são executados por `flowEffects` reusando senders WhatsApp já existentes. Inbound de botão é normalizado no `parseWebhookEvent`.

**Tech Stack:** TypeScript, Vitest, Express, Prisma 6, WhatsApp Cloud API. Testes rodam com `pnpm --filter @zappiq/api test`.

**Escopo deste plano:** motor + camada IO de backend. **Fora deste plano (vai para o plano-irmão do editor):** UI do canvas (nó `ask`, condition builder em chips, inspetor de mídia/botões). Este plano entrega software funcional e testável: a API executa fluxos ricos autorados em JSON mesmo antes da UI existir.

**Refinamentos sobre o spec (consistentes):**
- Horário comercial estruturado vive numa **chave nova** `org.settings.businessHoursConfig` (não substitui o `businessHours` texto-livre, que o `flowGenerator`/`promptEngine` ainda consomem). Zero migração de dados; ausência → fail-closed (`closed`).
- Casamento de botão usa o **título** do botão (que o inbound passa a entregar como `text`), então keyword/captura funcionam sem tocar no `agentOrchestrator`. O `id` do botão (`selectedId`) é exposto no ctx para uso futuro, sem ser exigido nesta fatia.

---

## Estrutura de arquivos

| Arquivo | Ação | Responsabilidade |
|---|---|---|
| `apps/api/src/agents/flowEngine.ts` | modificar | Tipos `EvalContext`/`BusinessHoursConfig`/`Predicate`/`AskNodeData`; `ctx` em `ResolveOptions`; nó `ask`; ramificação por predicados; emissão de efeitos ricos; interpolação. |
| `apps/api/src/agents/flowInterpolate.ts` | criar | `renderTemplate(text, scope)` — puro. |
| `apps/api/src/agents/flowInterpolate.test.ts` | criar | Testes de interpolação. |
| `apps/api/src/agents/businessHours.ts` | criar | `isOpen(config, now)` — puro. |
| `apps/api/src/agents/businessHours.test.ts` | criar | Testes de horário. |
| `apps/api/src/agents/flowPredicates.ts` | criar | `evalPredicate`/`evalEdge` — puro. |
| `apps/api/src/agents/flowPredicates.test.ts` | criar | Testes de predicados. |
| `apps/api/src/agents/flowEngine.test.ts` | modificar | Novos casos: ask, predicados, efeitos ricos, interpolação. |
| `apps/api/src/services/whatsappService.ts` | modificar | `sendImage`/`sendDocument` (por link). |
| `apps/api/src/services/channelDispatcher.ts` | modificar | `sendReplyInteractive`/`sendReplyMedia` (WA + fallback texto IG). |
| `apps/api/src/agents/flowEffects.ts` | modificar | Executar `send_interactive`/`send_media`. |
| `apps/api/src/agents/flowRuntime.ts` | modificar | Montar `EvalContext` (Contact + businessHoursConfig) e passar via `ctx`. |

---

## Phase 0 — Fundação de tipos (sem mudança de comportamento)

### Task 1: Tipos novos + `ctx` opcional em ResolveOptions

**Files:**
- Modify: `apps/api/src/agents/flowEngine.ts`

- [ ] **Step 1: Adicionar os tipos no topo de flowEngine.ts** (após o bloco `FlowEffect`, antes de `FlowSchedule`):

```ts
// ── Contexto de avaliação (injetado pela camada IO; mantém o motor puro) ──────
export interface BusinessHoursConfig {
  /** IANA tz, ex 'America/Sao_Paulo'. */
  timezone: string;
  /** 0=domingo … 6=sábado. null = fechado nesse dia. Horários 'HH:mm' 24h. */
  days: Record<number, { open: string; close: string } | null>;
}

export interface EvalContact {
  name: string | null;
  tags: string[];
  leadStatus: string | null;
  leadScore: number;
  funnelStage: string | null;
  customFields: Record<string, any>;
}

export interface EvalContext {
  contact: EvalContact;
  /** 'agora' injetado pelo runtime — o motor NUNCA chama Date. */
  now: Date | null;
  businessHours: BusinessHoursConfig | null;
  /** id do botão/lista tocado (normalizado do inbound). Reservado p/ uso futuro. */
  selectedId?: string;
  /** Identidade do negócio para interpolação {{system.*}}. */
  system?: { businessName?: string; agentName?: string };
}

/** Predicado de aresta (Spec 1A — avaliados em E). */
export type PredicateOp =
  | 'eq' | 'neq' | 'gt' | 'lt' | 'gte' | 'lte'
  | 'contains' | 'exists' | 'not_exists';

export type Predicate =
  | { kind: 'keyword'; match: 'contains' | 'equals' | 'starts_with' | 'regex'; value: string }
  | { kind: 'contact_attr'; field: string; op: PredicateOp; value?: any }
  | { kind: 'var'; name: string; op: PredicateOp; value?: any }
  | { kind: 'business_hours'; expect: 'open' | 'closed' };

/** Dados do nó 'ask' (captura de resposta). */
export interface AskNodeData {
  question: string;
  varName: string;
  crmField?: string;
  validation?: {
    type: 'text' | 'number' | 'email' | 'phone';
    errorMessage: string;
    maxRetries: number;
  };
}
```

- [ ] **Step 2: Adicionar `ctx` em ResolveOptions** — substituir a interface `ResolveOptions`:

```ts
/** Opções de controle para resolveFlowStep. */
export interface ResolveOptions {
  /** false na retomada por timer: nenhum texto novo do usuário disponível. */
  hasIncomingMessage?: boolean;
  /** Contexto de avaliação (contato, horário, agora). Ausente → defaults seguros. */
  ctx?: EvalContext;
}

/** Contexto default fail-closed quando o caller não injeta ctx (ex: testes legados). Exportado p/ uso nos testes. */
export const DEFAULT_CTX: EvalContext = {
  contact: { name: null, tags: [], leadStatus: null, leadScore: 0, funnelStage: null, customFields: {} },
  now: null,
  businessHours: null,
};
```

- [ ] **Step 3: Rodar a suíte existente — nada deve quebrar (ctx é opcional)**

Run: `pnpm --filter @zappiq/api test flowEngine`
Expected: PASS (todos os testes atuais continuam verdes; só adicionamos tipos).

- [ ] **Step 4: Commit**

```bash
git add apps/api/src/agents/flowEngine.ts
git commit -m "feat(maestro): tipos EvalContext/Predicate/AskNodeData + ctx opcional (1A fundação)"
```

---

## Phase 1 — Interpolação `{{var}}` (puro)

### Task 2: Módulo flowInterpolate

**Files:**
- Create: `apps/api/src/agents/flowInterpolate.ts`
- Test: `apps/api/src/agents/flowInterpolate.test.ts`

- [ ] **Step 1: Escrever o teste que falha**

```ts
import { describe, it, expect } from 'vitest';
import { renderTemplate } from './flowInterpolate.js';

const scope = {
  vars: { nome: 'Ana', idade: 30, pedido: { id: 7 } },
  contact: { name: 'Ana Silva', tags: ['vip'] },
  system: { businessName: 'Loja X', agentName: 'Iza' },
};

describe('renderTemplate', () => {
  it('resolve vars, contact e system', () => {
    expect(renderTemplate('Oi {{vars.nome}}, da {{system.businessName}}', scope))
      .toBe('Oi Ana, da Loja X');
    expect(renderTemplate('{{contact.name}}', scope)).toBe('Ana Silva');
  });

  it('var ausente vira vazio; fallback é respeitado', () => {
    expect(renderTemplate('[{{vars.x}}]', scope)).toBe('[]');
    expect(renderTemplate('[{{vars.x | "padrão"}}]', scope)).toBe('[padrão]');
  });

  it('tolera espaços e múltiplos tokens', () => {
    expect(renderTemplate('{{ vars.nome }} tem {{ vars.idade }}', scope)).toBe('Ana tem 30');
  });

  it('objeto/array vira JSON seguro, nunca [object Object]', () => {
    expect(renderTemplate('{{vars.pedido}}', scope)).toBe('{"id":7}');
  });

  it('token malformado é deixado intacto, sem lançar', () => {
    expect(renderTemplate('a {{ } b', scope)).toBe('a {{ } b');
  });

  it('string sem token retorna igual', () => {
    expect(renderTemplate('texto puro', scope)).toBe('texto puro');
  });
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `pnpm --filter @zappiq/api test flowInterpolate`
Expected: FAIL ("Cannot find module './flowInterpolate.js'").

- [ ] **Step 3: Implementar o módulo**

```ts
/**
 * Maestro v3 (Spec 1A) — interpolação {{var}} em conteúdo de fluxo. PURO.
 * Sintaxe: {{ caminho.com.pontos }} com fallback opcional {{ x | "default" }}.
 * Nunca lança: token ausente → fallback ou vazio; malformado → deixa intacto.
 */
export interface RenderScope {
  vars?: Record<string, any>;
  contact?: Record<string, any>;
  system?: Record<string, any>;
}

const TOKEN = /\{\{\s*([a-zA-Z0-9_$.]+)\s*(?:\|\s*"([^"]*)"\s*)?\}\}/g;

function resolvePath(scope: RenderScope, path: string): any {
  const parts = path.split('.');
  let cur: any = scope;
  for (const p of parts) {
    if (cur == null || typeof cur !== 'object') return undefined;
    cur = cur[p];
  }
  return cur;
}

function stringify(value: any): string {
  if (value == null) return '';
  if (typeof value === 'object') {
    try { return JSON.stringify(value).slice(0, 200); } catch { return ''; }
  }
  return String(value);
}

export function renderTemplate(text: string, scope: RenderScope): string {
  if (!text) return text ?? '';
  return text.replace(TOKEN, (_m, path: string, fallback?: string) => {
    const v = resolvePath(scope, path);
    if (v === undefined || v === null) return fallback ?? '';
    return stringify(v);
  });
}
```

- [ ] **Step 4: Rodar e ver passar**

Run: `pnpm --filter @zappiq/api test flowInterpolate`
Expected: PASS (6 testes).

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/agents/flowInterpolate.ts apps/api/src/agents/flowInterpolate.test.ts
git commit -m "feat(maestro): renderTemplate puro para interpolação {{var}} (1A)"
```

---

## Phase 2 — Horário comercial (puro)

### Task 3: Módulo businessHours

**Files:**
- Create: `apps/api/src/agents/businessHours.ts`
- Test: `apps/api/src/agents/businessHours.test.ts`

- [ ] **Step 1: Escrever o teste que falha**

```ts
import { describe, it, expect } from 'vitest';
import { isOpen } from './businessHours.js';
import type { BusinessHoursConfig } from './flowEngine.js';

// Seg-Sex 09:00–18:00, América/Sao_Paulo. Sáb/Dom fechado.
const cfg: BusinessHoursConfig = {
  timezone: 'America/Sao_Paulo',
  days: {
    0: null,
    1: { open: '09:00', close: '18:00' },
    2: { open: '09:00', close: '18:00' },
    3: { open: '09:00', close: '18:00' },
    4: { open: '09:00', close: '18:00' },
    5: { open: '09:00', close: '18:00' },
    6: null,
  },
};

// Helper: instante UTC. SP = UTC-3 (sem horário de verão desde 2019).
const at = (iso: string) => new Date(iso);

describe('isOpen', () => {
  it('dentro do horário em dia útil → aberto', () => {
    // Terça 2026-06-16 14:00 SP = 17:00Z
    expect(isOpen(cfg, at('2026-06-16T17:00:00Z'))).toBe(true);
  });

  it('antes de abrir → fechado', () => {
    // Terça 08:00 SP = 11:00Z
    expect(isOpen(cfg, at('2026-06-16T11:00:00Z'))).toBe(false);
  });

  it('exatamente no fechamento → fechado (intervalo [open, close))', () => {
    // Terça 18:00 SP = 21:00Z
    expect(isOpen(cfg, at('2026-06-16T21:00:00Z'))).toBe(false);
  });

  it('fim de semana → fechado', () => {
    // Domingo 2026-06-14 14:00 SP = 17:00Z
    expect(isOpen(cfg, at('2026-06-14T17:00:00Z'))).toBe(false);
  });

  it('config null ou now null → fechado (fail-closed)', () => {
    expect(isOpen(null, at('2026-06-16T17:00:00Z'))).toBe(false);
    expect(isOpen(cfg, null)).toBe(false);
  });

  it('janela vira-noite (22:00–02:00) cobre madrugada', () => {
    const night: BusinessHoursConfig = {
      timezone: 'America/Sao_Paulo',
      days: { 0:null,1:null,2:null,3:null,4:null,5:{ open:'22:00', close:'02:00' },6:null },
    };
    // Sexta 23:00 SP = sábado 02:00Z → aberto (lado da sexta)
    expect(isOpen(night, at('2026-06-13T02:00:00Z'))).toBe(true);
  });
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `pnpm --filter @zappiq/api test businessHours`
Expected: FAIL ("Cannot find module './businessHours.js'").

- [ ] **Step 3: Implementar o módulo**

```ts
/**
 * Maestro v3 (Spec 1A) — avaliação de horário comercial. PURO.
 * Recebe 'now' (Date) injetado; calcula dia/hora no timezone do config via Intl.
 * Fail-closed: config/now ausentes → fechado.
 */
import type { BusinessHoursConfig } from './flowEngine.js';

const WD: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };

export function isOpen(config: BusinessHoursConfig | null | undefined, now: Date | null | undefined): boolean {
  if (!config || !now || !config.days) return false;
  let parts: Record<string, string>;
  try {
    const dtf = new Intl.DateTimeFormat('en-US', {
      timeZone: config.timezone || 'America/Sao_Paulo',
      weekday: 'short', hour: '2-digit', minute: '2-digit', hour12: false,
    });
    parts = Object.fromEntries(dtf.formatToParts(now).map((p) => [p.type, p.value]));
  } catch {
    return false; // timezone inválido → fail-closed
  }
  const day = WD[parts.weekday];
  if (day === undefined) return false;
  const win = config.days[day];
  if (!win || !win.open || !win.close) return false;
  // '24:00' que alguns ambientes emitem à meia-noite → normaliza p/ '00:00'
  const hh = parts.hour === '24' ? '00' : parts.hour;
  const cur = `${hh}:${parts.minute}`; // 'HH:mm' zero-padded → comparável lexicograficamente
  const { open, close } = win;
  if (open === close) return false;
  if (open < close) return cur >= open && cur < close;
  // vira-noite: aberto se >= open (noite) OU < close (madrugada)
  return cur >= open || cur < close;
}
```

- [ ] **Step 4: Rodar e ver passar**

Run: `pnpm --filter @zappiq/api test businessHours`
Expected: PASS (6 testes).

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/agents/businessHours.ts apps/api/src/agents/businessHours.test.ts
git commit -m "feat(maestro): isOpen puro p/ horário comercial estruturado (1A)"
```

---

## Phase 3 — Predicados de aresta (puro)

### Task 4: Módulo flowPredicates

**Files:**
- Create: `apps/api/src/agents/flowPredicates.ts`
- Test: `apps/api/src/agents/flowPredicates.test.ts`

- [ ] **Step 1: Escrever o teste que falha**

```ts
import { describe, it, expect } from 'vitest';
import { evalPredicate, evalEdge } from './flowPredicates.js';
import type { EvalContext, FlowEdge } from './flowEngine.js';

const baseCtx: EvalContext = {
  contact: { name: 'Ana', tags: ['vip', 'lead'], leadStatus: 'QUALIFIED', leadScore: 80, funnelStage: 'Planos', customFields: { cidade: 'SP' } },
  now: new Date('2026-06-16T17:00:00Z'),
  businessHours: { timezone: 'America/Sao_Paulo', days: { 1: { open: '09:00', close: '18:00' }, 2: { open: '09:00', close: '18:00' } } as any },
  system: {},
};
const vars = { plano: 'pro', score: 5 };

describe('evalPredicate', () => {
  it('keyword casa contra o texto', () => {
    expect(evalPredicate({ kind: 'keyword', match: 'contains', value: 'quero' }, baseCtx, vars, 'eu QUERO')).toBe(true);
    expect(evalPredicate({ kind: 'keyword', match: 'equals', value: 'sim' }, baseCtx, vars, 'não')).toBe(false);
  });

  it('contact_attr: tags contains, score gt, exists', () => {
    expect(evalPredicate({ kind: 'contact_attr', field: 'tags', op: 'contains', value: 'vip' }, baseCtx, vars, '')).toBe(true);
    expect(evalPredicate({ kind: 'contact_attr', field: 'leadScore', op: 'gt', value: 50 }, baseCtx, vars, '')).toBe(true);
    expect(evalPredicate({ kind: 'contact_attr', field: 'customFields.cidade', op: 'eq', value: 'SP' }, baseCtx, vars, '')).toBe(true);
    expect(evalPredicate({ kind: 'contact_attr', field: 'customFields.idade', op: 'exists' }, baseCtx, vars, '')).toBe(false);
  });

  it('var: eq, gt, exists', () => {
    expect(evalPredicate({ kind: 'var', name: 'plano', op: 'eq', value: 'pro' }, baseCtx, vars, '')).toBe(true);
    expect(evalPredicate({ kind: 'var', name: 'score', op: 'gte', value: 5 }, baseCtx, vars, '')).toBe(true);
    expect(evalPredicate({ kind: 'var', name: 'inexistente', op: 'not_exists' }, baseCtx, vars, '')).toBe(true);
  });

  it('business_hours respeita expect', () => {
    expect(evalPredicate({ kind: 'business_hours', expect: 'open' }, baseCtx, vars, '')).toBe(true);
    expect(evalPredicate({ kind: 'business_hours', expect: 'closed' }, baseCtx, vars, '')).toBe(false);
  });

  it('campo inexistente nunca lança; op incompatível → false', () => {
    expect(evalPredicate({ kind: 'contact_attr', field: 'naoexiste', op: 'gt', value: 1 }, baseCtx, vars, '')).toBe(false);
  });
});

describe('evalEdge (predicados em E)', () => {
  const ctx = baseCtx;
  it('todos verdadeiros → true', () => {
    const edge: FlowEdge = { source: 'c', target: 'a', data: { predicates: [
      { kind: 'contact_attr', field: 'tags', op: 'contains', value: 'vip' },
      { kind: 'business_hours', expect: 'open' },
    ] } };
    expect(evalEdge(edge, ctx, vars, '')).toBe(true);
  });

  it('um falso → false', () => {
    const edge: FlowEdge = { source: 'c', target: 'a', data: { predicates: [
      { kind: 'contact_attr', field: 'tags', op: 'contains', value: 'vip' },
      { kind: 'business_hours', expect: 'closed' },
    ] } };
    expect(evalEdge(edge, ctx, vars, '')).toBe(false);
  });

  it('sem predicates e sem when legado → else (true)', () => {
    expect(evalEdge({ source: 'c', target: 'a' }, ctx, vars, '')).toBe(true);
  });

  it('compat: aresta legada com when keyword ainda casa', () => {
    const edge: FlowEdge = { source: 'c', target: 'a', data: { when: { match: 'contains', value: 'oi' } } };
    expect(evalEdge(edge, ctx, vars, 'oi tudo bem')).toBe(true);
    expect(evalEdge(edge, ctx, vars, 'tchau')).toBe(false);
  });
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `pnpm --filter @zappiq/api test flowPredicates`
Expected: FAIL ("Cannot find module './flowPredicates.js'").

- [ ] **Step 3: Implementar o módulo**

```ts
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
```

- [ ] **Step 4: Rodar e ver passar**

Run: `pnpm --filter @zappiq/api test flowPredicates`
Expected: PASS (10 testes).

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/agents/flowPredicates.ts apps/api/src/agents/flowPredicates.test.ts
git commit -m "feat(maestro): evalPredicate/evalEdge puros — 4 critérios em E (1A)"
```

---

## Phase 4 — Fiação no motor: predicados + interpolação

### Task 5: condition usa evalEdge; message interpola texto

**Files:**
- Modify: `apps/api/src/agents/flowEngine.ts`
- Modify: `apps/api/src/agents/flowEngine.test.ts`

- [ ] **Step 1: Escrever os testes que falham** — primeiro atualizar o import no topo de flowEngine.test.ts para trazer `DEFAULT_CTX`:

```ts
import { resolveFlowStep, DEFAULT_CTX, type FlowGraph, type FlowState } from './flowEngine.js';
```

Depois acrescentar ao final do `describe`:

```ts
  it('condition ramifica por atributo do contato (predicates em E)', () => {
    const graph: FlowGraph = {
      nodes: [
        { id: 's', type: 'start' },
        { id: 'c', type: 'condition' },
        { id: 'vip', type: 'message', data: { text: 'Atendimento VIP' } },
        { id: 'comum', type: 'message', data: { text: 'Atendimento padrão' } },
      ],
      edges: [
        { source: 's', target: 'c' },
        { source: 'c', target: 'vip', data: { predicates: [{ kind: 'contact_attr', field: 'tags', op: 'contains', value: 'vip' }] } },
        { source: 'c', target: 'comum', data: { when: { match: 'else' } } },
      ],
    };
    const ctx = {
      contact: { name: null, tags: ['vip'], leadStatus: null, leadScore: 0, funnelStage: null, customFields: {} },
      now: null, businessHours: null,
    };
    const r = resolveFlowStep(graph, { cursor: 'c', vars: {} }, 'qualquer', { ctx });
    expect(r.effects).toEqual([{ kind: 'send_text', text: 'Atendimento VIP' }]);
  });

  it('message interpola {{vars}} e {{contact.name}}', () => {
    const graph: FlowGraph = {
      nodes: [
        { id: 's', type: 'start' },
        { id: 'm', type: 'message', data: { text: 'Oi {{contact.name}}, plano {{vars.plano}}' } },
      ],
      edges: [{ source: 's', target: 'm' }],
    };
    const ctx = {
      contact: { name: 'Ana', tags: [], leadStatus: null, leadScore: 0, funnelStage: null, customFields: {} },
      now: null, businessHours: null,
    };
    const r = resolveFlowStep(graph, { cursor: null, vars: { plano: 'pro' } }, 'oi', { ctx });
    expect(r.effects).toEqual([{ kind: 'send_text', text: 'Oi Ana, plano pro' }]);
  });
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `pnpm --filter @zappiq/api test flowEngine`
Expected: FAIL (condition ainda usa só keyword; message não interpola).

- [ ] **Step 3: Implementar a fiação em flowEngine.ts**

3a. Adicionar imports no topo (após o comentário de cabeçalho, antes dos tipos):

```ts
import { renderTemplate, type RenderScope } from './flowInterpolate.js';
import { evalEdge } from './flowPredicates.js';
```

3b. No início de `resolveFlowStep`, montar ctx e um helper de escopo/render. Logo após `const vars = { ...(state.vars || {}) };` inserir:

```ts
  const ctx = options?.ctx ?? DEFAULT_CTX;
  const scope: RenderScope = { vars, contact: ctx.contact, system: ctx.system };
  const render = (t: string) => renderTemplate(t, scope);
```

3c. Substituir o corpo do `case 'message'` para interpolar:

```ts
      case 'message': {
        const raw = (node.data?.text ?? node.label ?? '').toString();
        const text = render(raw);
        if (text.trim()) {
          effects.push({ kind: 'send_text', text });
          sentMessageThisWalk = true;
        }
        current = firstTargetFrom(graph, node.id);
        break;
      }
```

3d. Substituir a função `pickConditionBranch` por uma versão que usa `evalEdge` (passa a receber ctx/vars/text):

```ts
function pickConditionBranch(
  graph: FlowGraph,
  nodeId: string,
  text: string,
  ctx: EvalContext,
  vars: Record<string, any>,
): string | null {
  const outgoing = graph.edges.filter((e) => e.source === nodeId);
  // 1) primeira aresta NÃO-else cujos predicados/when casam
  for (const e of outgoing) {
    const isElse = e.data?.when?.match === 'else' || (!e.data?.predicates && !e.data?.when);
    if (isElse) continue;
    if (evalEdge(e, ctx, vars, text)) return e.target;
  }
  // 2) aresta 'else' explícita
  const elseEdge = outgoing.find((e) => e.data?.when?.match === 'else');
  if (elseEdge) return elseEdge.target;
  // 3) aresta sem condição declarada (fallback default)
  const bare = outgoing.find((e) => !e.data?.when && !e.data?.predicates);
  return bare ? bare.target : null;
}
```

3e. Atualizar a chamada no `case 'condition'`:

```ts
          current = pickConditionBranch(graph, node.id, incomingText, ctx, vars);
```

- [ ] **Step 4: Rodar e ver passar (incluindo todos os testes legados)**

Run: `pnpm --filter @zappiq/api test flowEngine`
Expected: PASS (legados + 2 novos).

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/agents/flowEngine.ts apps/api/src/agents/flowEngine.test.ts
git commit -m "feat(maestro): condition por predicados + interpolação no message (1A)"
```

---

## Phase 5 — Nó `ask` (captura + validação + CRM)

### Task 6: motor trata o nó ask

**Files:**
- Modify: `apps/api/src/agents/flowEngine.ts`
- Modify: `apps/api/src/agents/flowEngine.test.ts`

- [ ] **Step 1: Escrever os testes que falham**

```ts
  it('ask: primeira passada pergunta (interpolada) e aguarda input', () => {
    const graph: FlowGraph = {
      nodes: [
        { id: 's', type: 'start' },
        { id: 'q', type: 'ask', data: { question: 'Qual seu nome, {{vars.saud}}?', varName: 'nome' } },
        { id: 'fim', type: 'message', data: { text: 'Obrigado {{vars.nome}}' } },
      ],
      edges: [{ source: 's', target: 'q' }, { source: 'q', target: 'fim' }],
    };
    const r = resolveFlowStep(graph, { cursor: null, vars: { saud: 'cliente' } }, '', { ctx: DEFAULT_CTX, hasIncomingMessage: false });
    expect(r.effects).toEqual([{ kind: 'send_text', text: 'Qual seu nome, cliente?' }]);
    expect(r.next).toBe('await_input');
    expect(r.state.cursor).toBe('q');
  });

  it('ask: resposta válida grava var, emite update_lead (crmField) e avança', () => {
    const graph: FlowGraph = {
      nodes: [
        { id: 's', type: 'start' },
        { id: 'q', type: 'ask', data: { question: 'Seu nome?', varName: 'nome', crmField: 'name' } },
        { id: 'fim', type: 'message', data: { text: 'Oi {{vars.nome}}' } },
      ],
      edges: [{ source: 's', target: 'q' }, { source: 'q', target: 'fim' }],
    };
    const r = resolveFlowStep(graph, { cursor: 'q', vars: {} }, 'Ana', { ctx: DEFAULT_CTX });
    expect(r.state.vars.nome).toBe('Ana');
    expect(r.effects).toEqual([
      { kind: 'update_lead', field: 'name', value: 'Ana' },
      { kind: 'send_text', text: 'Oi Ana' },
    ]);
    expect(r.next).toBe('end');
  });

  it('ask: resposta inválida re-pergunta e decrementa retries', () => {
    const graph: FlowGraph = {
      nodes: [
        { id: 'q', type: 'ask', data: { question: 'Seu email?', varName: 'email',
          validation: { type: 'email', errorMessage: 'Email inválido, tente de novo', maxRetries: 2 } } },
        { id: 'fim', type: 'message', data: { text: 'ok' } },
      ],
      edges: [{ source: 'q', target: 'fim' }],
    };
    const r = resolveFlowStep(graph, { cursor: 'q', vars: {} }, 'não é email', { ctx: DEFAULT_CTX });
    expect(r.effects).toEqual([{ kind: 'send_text', text: 'Email inválido, tente de novo' }]);
    expect(r.next).toBe('await_input');
    expect(r.state.cursor).toBe('q');
    expect(r.state.vars._askRetries).toBe(1);
  });

  it('ask: retries esgotados caem no ramo else', () => {
    const graph: FlowGraph = {
      nodes: [
        { id: 'q', type: 'ask', data: { question: 'Email?', varName: 'email',
          validation: { type: 'email', errorMessage: 'inválido', maxRetries: 1 } } },
        { id: 'ok', type: 'message', data: { text: 'capturado' } },
        { id: 'desiste', type: 'message', data: { text: 'tudo bem, sem email' } },
      ],
      edges: [
        { source: 'q', target: 'ok' },
        { source: 'q', target: 'desiste', data: { when: { match: 'else' } } },
      ],
    };
    // retries já em 0 → próxima inválida esgota
    const r = resolveFlowStep(graph, { cursor: 'q', vars: { _askRetries: 0 } }, 'xxx', { ctx: DEFAULT_CTX });
    expect(r.effects).toEqual([{ kind: 'send_text', text: 'tudo bem, sem email' }]);
    expect(r.state.vars._askRetries).toBeUndefined();
  });
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `pnpm --filter @zappiq/api test flowEngine`
Expected: FAIL (nó 'ask' cai no default → end).

- [ ] **Step 3: Implementar o nó ask em flowEngine.ts**

3a. Adicionar helpers de validação e de ramo else, logo após `pickConditionBranch`:

```ts
function validateAnswer(text: string, type?: 'text' | 'number' | 'email' | 'phone'): boolean {
  const t = (text ?? '').trim();
  if (!t) return false;
  switch (type) {
    case 'number': return /^-?\d+([.,]\d+)?$/.test(t);
    case 'email': return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(t);
    case 'phone': return (t.match(/\d/g)?.length ?? 0) >= 8;
    case 'text':
    default: return true;
  }
}

/** Ramo else/default de saída de um nó (sem casar predicados). */
function pickElseBranch(graph: FlowGraph, nodeId: string): string | null {
  const outgoing = graph.edges.filter((e) => e.source === nodeId);
  const elseEdge = outgoing.find((e) => e.data?.when?.match === 'else');
  if (elseEdge) return elseEdge.target;
  const bare = outgoing.find((e) => !e.data?.when && !e.data?.predicates);
  return bare ? bare.target : (outgoing[0]?.target ?? null);
}
```

3b. Adicionar o `case 'ask'` no switch (antes do `case 'condition'`):

```ts
      case 'ask': {
        const d = (node.data ?? {}) as Partial<AskNodeData>;
        const resuming = state.cursor === node.id;
        if (resuming && messageAvailable && !sentMessageThisWalk) {
          // a mensagem deste turno é a resposta
          messageAvailable = false;
          const ans = incomingText;
          if (!validateAnswer(ans, d.validation?.type)) {
            const start = typeof d.validation?.maxRetries === 'number' ? d.validation.maxRetries : 3;
            const left = (typeof vars._askRetries === 'number' ? vars._askRetries : start) - 1;
            if (left >= 0) {
              vars._askRetries = left;
              const msg = render(d.validation?.errorMessage ?? d.question ?? '');
              if (msg.trim()) effects.push({ kind: 'send_text', text: msg });
              return { effects, next: 'await_input', state: { cursor: node.id, vars } };
            }
            // esgotou → ramo else
            delete vars._askRetries;
            current = pickElseBranch(graph, node.id);
            break;
          }
          // resposta válida
          delete vars._askRetries;
          if (d.varName) vars[d.varName] = ans;
          if (d.crmField) effects.push({ kind: 'update_lead', field: d.crmField, value: ans });
          current = firstTargetFrom(graph, node.id);
          break;
        }
        // primeira passada (ou já enviamos algo neste walk) → pergunta e aguarda
        const q = render(d.question ?? node.label ?? '');
        if (q.trim()) effects.push({ kind: 'send_text', text: q });
        return { effects, next: 'await_input', state: { cursor: node.id, vars } };
      }
```

- [ ] **Step 4: Rodar e ver passar**

Run: `pnpm --filter @zappiq/api test flowEngine`
Expected: PASS (legados + 4 novos de ask).

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/agents/flowEngine.ts apps/api/src/agents/flowEngine.test.ts
git commit -m "feat(maestro): nó ask — captura + validação + CRM + retries (1A)"
```

---

## Phase 6 — Efeitos ricos: tipos + emissão no motor

### Task 7: send_interactive e send_media

**Files:**
- Modify: `apps/api/src/agents/flowEngine.ts`
- Modify: `apps/api/src/agents/flowEngine.test.ts`

- [ ] **Step 1: Escrever os testes que falham**

```ts
  it('message com botões emite send_interactive (titles interpolados)', () => {
    const graph: FlowGraph = {
      nodes: [
        { id: 'm', type: 'message', data: {
          text: 'Escolha {{vars.nome}}:',
          interactive: { type: 'button', options: [{ id: 'planos', title: 'Planos' }, { id: 'sup', title: 'Suporte' }] },
        } },
      ],
      edges: [],
    };
    const ctx = { ...DEFAULT_CTX };
    const r = resolveFlowStep(graph, { cursor: null, vars: { nome: 'Ana' } }, 'oi', { ctx });
    expect(r.effects).toEqual([{
      kind: 'send_interactive', type: 'button', body: 'Escolha Ana:',
      options: [{ id: 'planos', title: 'Planos' }, { id: 'sup', title: 'Suporte' }],
    }]);
  });

  it('message com mídia emite send_media com caption interpolada', () => {
    const graph: FlowGraph = {
      nodes: [
        { id: 'm', type: 'message', data: {
          media: { type: 'image', url: 'https://x/y.png', caption: 'Catálogo {{vars.nome}}' },
        } },
      ],
      edges: [],
    };
    const r = resolveFlowStep(graph, { cursor: null, vars: { nome: 'Ana' } }, 'oi', { ctx: DEFAULT_CTX });
    expect(r.effects).toEqual([{ kind: 'send_media', mediaType: 'image', url: 'https://x/y.png', caption: 'Catálogo Ana' }]);
  });
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `pnpm --filter @zappiq/api test flowEngine`
Expected: FAIL (message só emite send_text).

- [ ] **Step 3: Estender o tipo FlowEffect e o case message**

3a. Substituir o tipo `FlowEffect`:

```ts
export type FlowEffect =
  | { kind: 'send_text'; text: string }
  | { kind: 'send_interactive'; type: 'button' | 'list'; body: string; options: { id: string; title: string }[] }
  | { kind: 'send_media'; mediaType: 'image' | 'audio' | 'document'; url: string; caption?: string }
  | { kind: 'set_tag'; tag: string }
  | { kind: 'update_lead'; field: string; value: any }
  | { kind: 'handoff' }
  | { kind: 'goto_flow'; targetFlowId: string };
```

3b. Substituir o corpo do `case 'message'` (que já interpola, da Task 5) por uma versão que decide entre texto/interativo/mídia:

```ts
      case 'message': {
        const d = node.data ?? {};
        const media = d.media as { type: 'image'|'audio'|'document'; url: string; caption?: string } | undefined;
        const interactive = d.interactive as { type: 'button'|'list'; options: { id: string; title: string }[] } | undefined;
        if (media?.url) {
          effects.push({ kind: 'send_media', mediaType: media.type, url: media.url, caption: media.caption ? render(media.caption) : undefined });
          sentMessageThisWalk = true;
        } else if (interactive?.options?.length) {
          effects.push({
            kind: 'send_interactive', type: interactive.type, body: render((d.text ?? node.label ?? '').toString()),
            options: interactive.options.slice(0, interactive.type === 'button' ? 3 : 10).map((o) => ({ id: o.id, title: render(o.title) })),
          });
          sentMessageThisWalk = true;
        } else {
          const text = render((d.text ?? node.label ?? '').toString());
          if (text.trim()) {
            effects.push({ kind: 'send_text', text });
            sentMessageThisWalk = true;
          }
        }
        current = firstTargetFrom(graph, node.id);
        break;
      }
```

- [ ] **Step 4: Rodar e ver passar**

Run: `pnpm --filter @zappiq/api test flowEngine`
Expected: PASS (legados + 2 novos).

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/agents/flowEngine.ts apps/api/src/agents/flowEngine.test.ts
git commit -m "feat(maestro): efeitos send_interactive/send_media emitidos pelo motor (1A)"
```

---

## Phase 7 — Camada IO: senders de mídia

### Task 8: whatsappService.sendImage / sendDocument

**Files:**
- Modify: `apps/api/src/services/whatsappService.ts`

- [ ] **Step 1: Adicionar os dois senders (por link), após `sendAudio` (linha ~116)**

```ts
export async function sendImage(to: string, link: string, caption?: string, creds?: WaCreds) {
  const payload = {
    messaging_product: 'whatsapp',
    recipient_type: 'individual',
    to,
    type: 'image',
    image: { link, ...(caption ? { caption } : {}) },
  };
  const { data } = await clientFor(creds).post(`/${phoneIdFor(creds)}/messages`, payload);
  logger.info(`[WA] Image sent to ${to}`, { messageId: data.messages?.[0]?.id });
  return data;
}

export async function sendDocument(to: string, link: string, caption?: string, filename?: string, creds?: WaCreds) {
  const payload = {
    messaging_product: 'whatsapp',
    recipient_type: 'individual',
    to,
    type: 'document',
    document: { link, ...(caption ? { caption } : {}), ...(filename ? { filename } : {}) },
  };
  const { data } = await clientFor(creds).post(`/${phoneIdFor(creds)}/messages`, payload);
  logger.info(`[WA] Document sent to ${to}`, { messageId: data.messages?.[0]?.id });
  return data;
}
```

- [ ] **Step 2: Verificar compilação de tipos**

Run: `pnpm --filter @zappiq/api exec tsc --noEmit`
Expected: sem erros novos relacionados a whatsappService.

- [ ] **Step 3: Commit**

```bash
git add apps/api/src/services/whatsappService.ts
git commit -m "feat(wa): sendImage/sendDocument por link (1A)"
```

> Nota: `sendImage`/`sendDocument` por link e `sendAudio` por mediaId não têm teste unitário (chamam a Cloud API real) — validação no `.command` de smoke, como no padrão v2. `sendButtons`/`sendList` já existiam.

---

## Phase 8 — Camada IO: dispatcher + execução de efeitos

### Task 9: channelDispatcher.sendReplyInteractive / sendReplyMedia

**Files:**
- Modify: `apps/api/src/services/channelDispatcher.ts`

- [ ] **Step 1: Adicionar as duas funções ao final do arquivo** (antes não existem; reusam o lookup de conversa/credenciais do `sendReplyText`):

```ts
/** Envia botões/lista pelo WhatsApp. IG não suporta interactive → fallback texto. */
export async function sendReplyInteractive(input: {
  organizationId: string;
  conversationId: string;
  kind: 'button' | 'list';
  body: string;
  options: { id: string; title: string }[];
}): Promise<SendReplyResult> {
  const conversation = await prisma.conversation.findUnique({
    where: { id: input.conversationId },
    select: { channel: true, contact: { select: { whatsappId: true, phone: true } } },
  });
  if (!conversation) throw new Error(`Conversation ${input.conversationId} not found`);

  // IG: degrada para texto (corpo + opções numeradas).
  if (conversation.channel === 'instagram') {
    const lines = [input.body, ...input.options.map((o, i) => `${i + 1}. ${o.title}`)].join('\n');
    return sendReplyText({ organizationId: input.organizationId, conversationId: input.conversationId, content: lines });
  }

  const phone = conversation.contact?.whatsappId || conversation.contact?.phone || '';
  if (!phone) throw new Error(`Conversation ${input.conversationId} sem phone/whatsappId`);
  const waOrg = await prisma.organization.findUnique({
    where: { id: input.organizationId },
    select: { whatsappPhoneNumberId: true, whatsappAccessToken: true },
  });
  const creds = { accessToken: waOrg?.whatsappAccessToken ?? undefined, phoneNumberId: waOrg?.whatsappPhoneNumberId ?? undefined };

  let result: any;
  if (input.kind === 'button') {
    result = await waService.sendButtons(phone, null, input.body, input.options.slice(0, 3), creds);
  } else {
    const rows = input.options.slice(0, 10).map((o) => ({ id: o.id, title: o.title }));
    result = await waService.sendList(phone, ' ', input.body, null, 'Ver opções', [{ title: ' ', rows }], creds);
  }
  return { channel: 'whatsapp', externalMessageId: result?.messages?.[0]?.id };
}

/** Envia mídia por link pelo WhatsApp. IG → fallback texto (caption + url). */
export async function sendReplyMedia(input: {
  organizationId: string;
  conversationId: string;
  mediaType: 'image' | 'audio' | 'document';
  url: string;
  caption?: string;
}): Promise<SendReplyResult> {
  const conversation = await prisma.conversation.findUnique({
    where: { id: input.conversationId },
    select: { channel: true, contact: { select: { whatsappId: true, phone: true } } },
  });
  if (!conversation) throw new Error(`Conversation ${input.conversationId} not found`);

  if (conversation.channel === 'instagram') {
    const txt = [input.caption, input.url].filter(Boolean).join('\n');
    return sendReplyText({ organizationId: input.organizationId, conversationId: input.conversationId, content: txt });
  }

  const phone = conversation.contact?.whatsappId || conversation.contact?.phone || '';
  if (!phone) throw new Error(`Conversation ${input.conversationId} sem phone/whatsappId`);
  const waOrg = await prisma.organization.findUnique({
    where: { id: input.organizationId },
    select: { whatsappPhoneNumberId: true, whatsappAccessToken: true },
  });
  const creds = { accessToken: waOrg?.whatsappAccessToken ?? undefined, phoneNumberId: waOrg?.whatsappPhoneNumberId ?? undefined };

  let result: any;
  if (input.mediaType === 'image') result = await waService.sendImage(phone, input.url, input.caption, creds);
  else if (input.mediaType === 'document') result = await waService.sendDocument(phone, input.url, input.caption, undefined, creds);
  else throw new Error(`sendReplyMedia: áudio por link não suportado (use mediaId)`); // áudio fica fora da 1A
  return { channel: 'whatsapp', externalMessageId: result?.messages?.[0]?.id };
}
```

- [ ] **Step 2: Verificar compilação**

Run: `pnpm --filter @zappiq/api exec tsc --noEmit`
Expected: sem erros novos.

- [ ] **Step 3: Commit**

```bash
git add apps/api/src/services/channelDispatcher.ts
git commit -m "feat(dispatcher): sendReplyInteractive/sendReplyMedia + fallback IG texto (1A)"
```

### Task 10: flowEffects executa os efeitos ricos

**Files:**
- Modify: `apps/api/src/agents/flowEffects.ts`

- [ ] **Step 1: Importar os novos senders** — substituir a linha de import do dispatcher:

```ts
import { sendReplyText, sendReplyInteractive, sendReplyMedia } from '../services/channelDispatcher.js';
```

- [ ] **Step 2: Adicionar os branches no loop de efeitos** — inserir logo após o bloco `if (eff.kind === 'send_text') { … }` (antes do `else if (eff.kind === 'handoff')`):

```ts
    } else if (eff.kind === 'send_interactive') {
      try {
        await sendReplyInteractive({ organizationId, conversationId, kind: eff.type, body: eff.body, options: eff.options });
        await prisma.message.create({
          data: {
            direction: 'OUTBOUND', type: 'INTERACTIVE',
            content: eff.body, status: 'SENT', conversationId, isFromBot: true, aiConfidence,
          },
        });
      } catch (e) {
        logger.warn('[Maestro] send_interactive falhou (fail-soft)', { organizationId, conversationId, err: String(e) });
      }
    } else if (eff.kind === 'send_media') {
      try {
        await sendReplyMedia({ organizationId, conversationId, mediaType: eff.mediaType, url: eff.url, caption: eff.caption });
        const typeMap = { image: 'IMAGE', audio: 'AUDIO', document: 'DOCUMENT' } as const;
        await prisma.message.create({
          data: {
            direction: 'OUTBOUND', type: typeMap[eff.mediaType],
            content: eff.caption ?? eff.url, status: 'SENT', conversationId, isFromBot: true, aiConfidence,
          },
        });
      } catch (e) {
        logger.warn('[Maestro] send_media falhou (fail-soft)', { organizationId, conversationId, err: String(e) });
      }
```

- [ ] **Step 3: Verificar compilação (o type union de FlowEffect agora cobre os novos kinds)**

Run: `pnpm --filter @zappiq/api exec tsc --noEmit`
Expected: sem erros novos. (O `else` final de "efeito não reconhecido" deixa de ser alcançado pelos novos kinds.)

- [ ] **Step 4: Commit**

```bash
git add apps/api/src/agents/flowEffects.ts
git commit -m "feat(maestro): executeFlowEffects envia interactive/media com fail-soft (1A)"
```

---

## Phase 9 — Inbound: normalizar resposta de botão/lista

### Task 11: parseWebhookEvent entrega título do botão como texto

**Files:**
- Modify: `apps/api/src/services/whatsappService.ts`

- [ ] **Step 1: Escrever um teste de parse** (criar `apps/api/src/services/whatsappService.parse.test.ts`):

```ts
import { describe, it, expect } from 'vitest';
import { parseWebhookEvent } from './whatsappService.js';

const evt = (message: any) => ({
  entry: [{ changes: [{ value: { metadata: { phone_number_id: 'p1' }, contacts: [{ profile: { name: 'Ana' } }], messages: [message] } }] }],
});

describe('parseWebhookEvent — interactive', () => {
  it('button_reply: text recebe o title e expõe buttonId', () => {
    const r = parseWebhookEvent(evt({ from: '55', id: 'm1', type: 'interactive',
      interactive: { type: 'button_reply', button_reply: { id: 'planos', title: 'Planos' } } }));
    expect(r?.text).toBe('Planos');
    expect((r as any)?.buttonId).toBe('planos');
  });

  it('list_reply: text recebe o title e expõe listId', () => {
    const r = parseWebhookEvent(evt({ from: '55', id: 'm2', type: 'interactive',
      interactive: { type: 'list_reply', list_reply: { id: 'opt3', title: 'Opção 3' } } }));
    expect(r?.text).toBe('Opção 3');
    expect((r as any)?.listId).toBe('opt3');
  });

  it('texto normal continua intacto', () => {
    const r = parseWebhookEvent(evt({ from: '55', id: 'm3', type: 'text', text: { body: 'oi' } }));
    expect(r?.text).toBe('oi');
  });
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `pnpm --filter @zappiq/api test whatsappService.parse`
Expected: FAIL (text vem vazio em button_reply; buttonId não existe).

- [ ] **Step 3: Ajustar o retorno de `parseWebhookEvent`** — no objeto retornado do ramo `type: 'message'`, trocar a linha `text:` e acrescentar os ids. Substituir:

```ts
      text: message.text?.body || message.caption || '',
      msgType: message.type,
      messageId: message.id,
      timestamp: message.timestamp,
      buttonTitle: message.interactive?.button_reply?.title,
      listTitle: message.interactive?.list_reply?.title,
```

por:

```ts
      text: message.text?.body
        || message.caption
        || message.interactive?.button_reply?.title
        || message.interactive?.list_reply?.title
        || '',
      msgType: message.type,
      messageId: message.id,
      timestamp: message.timestamp,
      buttonTitle: message.interactive?.button_reply?.title,
      listTitle: message.interactive?.list_reply?.title,
      buttonId: message.interactive?.button_reply?.id,
      listId: message.interactive?.list_reply?.id,
```

- [ ] **Step 4: Adicionar os campos à interface `ParsedWebhookEvent`** — localizar a interface (acima de `parseWebhookEvent`) e acrescentar:

```ts
  buttonId?: string;
  listId?: string;
```

- [ ] **Step 5: Rodar e ver passar**

Run: `pnpm --filter @zappiq/api test whatsappService.parse`
Expected: PASS (3 testes).

- [ ] **Step 6: Commit**

```bash
git add apps/api/src/services/whatsappService.ts apps/api/src/services/whatsappService.parse.test.ts
git commit -m "feat(wa): inbound de botão/lista entrega title como text + ids (1A)"
```

---

## Phase 10 — Montar o EvalContext no runtime

### Task 12: flowRuntime carrega contato + horário e injeta ctx

**Files:**
- Modify: `apps/api/src/agents/flowRuntime.ts`

- [ ] **Step 1: Importar os tipos necessários** — acrescentar `EvalContext`, `BusinessHoursConfig` ao import de `./flowEngine.js` (linha ~31-38):

```ts
import {
  resolveFlowStep,
  type FlowGraph,
  type FlowNode,
  type FlowEdge,
  type FlowState,
  type FlowStepResult,
  type EvalContext,
  type BusinessHoursConfig,
} from './flowEngine.js';
```

- [ ] **Step 2: Adicionar `contactId` ao input** — estender `ActiveFlowStepInput`:

```ts
export interface ActiveFlowStepInput {
  organizationId: string;
  conversationId: string;
  messageContent: string;
  orgSettings: any;
  /** Contato da conversa, p/ montar o EvalContext (atributos/CRM). Opcional. */
  contactId?: string | null;
}
```

- [ ] **Step 3: Construir o ctx antes do loop de hops** — inserir logo após `if (!flow) { … }` ser resolvido e antes de `let currentFlow = flow;` (linha ~153). Monta o contato e o horário uma vez por turno:

```ts
    // ── Monta EvalContext (atributos do contato + horário comercial) ─────
    let evalContact: EvalContext['contact'] = {
      name: null, tags: [], leadStatus: null, leadScore: 0, funnelStage: null, customFields: {},
    };
    if (input.contactId) {
      try {
        const c = await prisma.contact.findUnique({
          where: { id: input.contactId },
          select: { name: true, tags: true, leadStatus: true, leadScore: true, funnelStage: true, customFields: true },
        });
        if (c) {
          evalContact = {
            name: c.name ?? null,
            tags: c.tags ?? [],
            leadStatus: c.leadStatus ? String(c.leadStatus) : null,
            leadScore: typeof c.leadScore === 'number' ? c.leadScore : 0,
            funnelStage: c.funnelStage ?? null,
            customFields: (c.customFields as Record<string, any>) ?? {},
          };
        }
      } catch { /* fail-soft: ctx com defaults */ }
    }
    const bhRaw = orgSettings?.businessHoursConfig;
    const businessHours: BusinessHoursConfig | null =
      bhRaw && typeof bhRaw === 'object' && bhRaw.days ? (bhRaw as BusinessHoursConfig) : null;
    const ctx: EvalContext = {
      contact: evalContact,
      now: new Date(),
      businessHours,
      system: { businessName: orgSettings?.businessName ?? orgSettings?.niche ?? undefined, agentName: orgSettings?.agentName ?? undefined },
    };
```

- [ ] **Step 4: Passar o ctx na chamada do motor** — na linha que chama `resolveFlowStep` dentro do loop de hops (linha ~166), trocar:

```ts
      result = resolveFlowStep(graph, currentState, messageContent, { hasIncomingMessage: !consumedMessage });
```

por:

```ts
      result = resolveFlowStep(graph, currentState, messageContent, { hasIncomingMessage: !consumedMessage, ctx });
```

- [ ] **Step 5: Passar `contactId` no call site do orchestrator** — em `apps/api/src/agents/agentOrchestrator.ts:196`, acrescentar `contactId` ao objeto passado para `resolveActiveFlowStep`. Localizar o objeto e adicionar a propriedade (o orchestrator já tem o contato em escopo — usar a variável local do contato; se o nome diferir, usar o id disponível no contexto da conversa):

```ts
    const flowStep = await resolveActiveFlowStep({
      organizationId,
      conversationId,
      messageContent,
      orgSettings,
      contactId, // <- já disponível no escopo do orchestrator (id do Contact da conversa)
    });
```

- [ ] **Step 6: Verificar compilação e suíte completa**

Run: `pnpm --filter @zappiq/api exec tsc --noEmit && pnpm --filter @zappiq/api test`
Expected: tsc sem erros; toda a suíte verde (incluindo flowRuntime se houver, e os novos módulos).

- [ ] **Step 7: Commit**

```bash
git add apps/api/src/agents/flowRuntime.ts apps/api/src/agents/agentOrchestrator.ts
git commit -m "feat(maestro): flowRuntime monta EvalContext (contato+horário) e injeta no motor (1A)"
```

> **Verificação no Step 5:** confirmar o nome exato da variável do id do contato no `agentOrchestrator` (pode ser `contactId`, `contact.id` ou similar). Ler o trecho ~150-200 antes de editar; se o contato não estiver em escopo ali, buscá-lo do `conversationId` no início do bloco do Maestro (mesmo padrão `prisma.conversation.findUnique({ select: { contactId: true } })`).

---

## Phase 11 — Smoke manual (fora dos unit tests)

### Task 13: roteiro de validação ponta a ponta

**Files:**
- Create: `docs/maestro/smoke-1a.md` (roteiro; sem código de produção)

- [ ] **Step 1: Documentar o roteiro de smoke** (a ser rodado pelo Rodrigo em sandbox WhatsApp):

```markdown
# Smoke 1A — Fluxos Ricos

Pré: org com maestro.enabled=true, número WA sandbox, 1 fluxo de teste.

1. **Captura + interpolação:** fluxo start → ask("Qual seu nome?") → message("Oi {{vars.nome}}").
   Enviar "João" → bot responde "Oi João". ✓
2. **Validação:** ask email com maxRetries 2. Enviar "abc" 1x → erro; enviar "a@b.com" → segue. ✓
3. **Botões:** message interactive button [Planos, Suporte]. Tocar "Planos" → fluxo ramifica por keyword "Planos". ✓
4. **Condição por atributo:** condition com predicate tags contains 'vip'. Contato com tag vip → ramo VIP. ✓
5. **Horário:** predicate business_hours expect open. Conferir aberto/fechado conforme businessHoursConfig. ✓
6. **Mídia:** message media image link → imagem chega com caption interpolada. ✓
```

- [ ] **Step 2: Commit**

```bash
git add docs/maestro/smoke-1a.md
git commit -m "docs(maestro): roteiro de smoke 1A ponta a ponta"
```

---

## Cobertura do spec (auto-revisão)

| Requisito do spec 1A | Task(s) |
|---|---|
| EvalContext + motor puro preservado | 1, 12 |
| Interpolação `{{var}}` + fallback | 2, 5 |
| Horário comercial estruturado (isOpen) | 3, 12 |
| Predicados 4 kinds em E (evalEdge) | 4, 5 |
| Nó `ask` (captura+CRM+validação+retries→else) | 6 |
| Efeitos send_interactive/send_media (motor) | 7 |
| Senders WA mídia | 8 |
| Dispatcher interactive/media + fallback IG | 9 |
| flowEffects executa ricos (fail-soft) | 10 |
| Inbound botão→texto + ids | 11 |
| ctx montado no runtime + contactId no orchestrator | 12 |
| Smoke ponta a ponta | 13 |

**Fora deste plano (plano-irmão do editor):** paleta com nó `ask`, condition builder em chips, inspetor de mídia/botões, validação de estrutura no editor (≤3 botões/≤10 rows/ramo else), UI de `businessHoursConfig` em settings.

---

## Notas de consistência (verificadas)

- Nome real da função do motor: **`resolveFlowStep`** (não `resolveStep`); `ctx` entra em `ResolveOptions` para não quebrar os ~35 testes que chamam com 3 args.
- `sendButtons`/`sendList` **já existiam** em `whatsappService` — só `sendImage`/`sendDocument` são novos.
- `business_hours` usa chave nova `org.settings.businessHoursConfig` (não toca o `businessHours` texto-livre consumido por `flowGenerator`/`promptEngine`).
- `_askRetries` e `_awaiting`-equivalente vivem em `vars` (Redis, TTL 7d) — sem tabela nova.
- `MessageType` já tem `INTERACTIVE`, `IMAGE`, `AUDIO`, `DOCUMENT` (usados na Task 10).
