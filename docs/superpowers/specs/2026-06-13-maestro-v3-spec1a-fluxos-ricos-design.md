# Maestro v3 — Spec 1A: Fluxos Ricos (Design)

> **Data:** 2026-06-13 · **Status:** aprovado, pronto para plano de implementação
> **Pacote:** 1 (Fundação) — sub-spec 1A de 3 (1A Fluxos Ricos · 1B Analytics por nó · 1C Subfluxos call/return)
> **Doc base:** `docs/maestro/MAESTRO-TECNICO.md` (seções 4.7, 4.8, 4.14 do inventário de capacidades)

---

## 1. Objetivo

Levar o motor do Maestro de "fluxos de texto com condição por palavra-chave" para **fluxos ricos**: capturar respostas do cliente em variáveis, interpolá-las em qualquer conteúdo, enviar botões/listas/mídia no WhatsApp e ramificar por atributos do contato, variáveis e horário comercial — **sem quebrar o padrão de motor puro** (zero IO, 100% testável) que sustenta a auditabilidade do produto.

Esta sub-spec entrega a **capacidade de execução**. A geração desses recursos por IA (`flowGenerator`) fica para a 1B+ — primeiro o motor executa, depois a IA gera. Isso mantém a 1A focada e testável.

### Posicionamento (invariante de produto)
O Maestro é uma IA autônoma que **constrói** fluxos a partir do contexto de onboarding (survey, documentos, Q&A, identidade do agente). O editor é camada de transparência. Esta spec amplia o vocabulário que a IA poderá gerar — não transforma o produto num builder manual.

---

## 2. Escopo

**Dentro (1A):**
1. Nó `ask` — captura resposta → `vars` + CRM + validação + re-pergunta.
2. Interpolação `{{var}}` em todo conteúdo de saída.
3. Inputs ricos — botões e listas interativas, mídia (imagem/áudio/documento).
4. Condições avançadas — predicados em E por aresta, 4 kinds (keyword, contact_attr, var, business_hours).

**Fora (sub-specs seguintes / pacotes seguintes):**
- Geração desses recursos por IA (`flowGenerator`) — 1B+.
- Analytics por nó (`FlowRun`/`FlowStepEvent`) — 1B.
- Subfluxos call/return — 1C.
- AI step agêntico, auto-otimização, simulação — Pacote 2.
- Fallback HSM fora da janela 24h — Pacote 3.

---

## 3. Arquitetura

### 3.1 Princípio central
O motor `flowEngine` continua **puro**. A única adição é um `EvalContext` montado pelo `flowRuntime` (camada de IO) e passado ao motor. Tudo que *decide* (render, validação, ramificação) é função pura recebendo `ctx`; IO existe só nas duas pontas — webhook na entrada, effects na saída.

### 3.2 EvalContext (novo)
Injetado pelo runtime no motor antes de cada `resolveStep`:

```ts
interface EvalContext {
  contact: {
    tags: string[]
    leadStatus: LeadStatus
    leadScore: number
    funnelStage: string
    customFields: Record<string, any>
  }
  vars: Record<string, any>        // espelho de FlowState.vars
  now: Date                        // injetado pelo runtime → motor permanece testável
  businessHours: BusinessHoursConfig
  selectedId?: string              // id de botão/lista tocado (normalizado do inbound)
}
```

`now` é injetado deliberadamente: o núcleo não pode chamar `Date.now()`, o que é garantia arquitetural além de testável.

### 3.3 Predicados por aresta (Opção B — predicados em E)
Cada `FlowEdge` ganha `predicates: Predicate[]`, avaliados em **E** (todos verdadeiros → segue). "OU" se resolve com múltiplas arestas para o mesmo destino. Ordem das arestas decide prioridade; aresta sem predicados é o `else` (último, sempre verdadeiro).

```ts
type Op = 'eq'|'neq'|'gt'|'lt'|'gte'|'lte'|'contains'|'exists'|'not_exists'
type MatchMode = 'contains'|'equals'|'starts_with'|'regex'

type Predicate =
  | { kind: 'keyword',        match: MatchMode, value: string }
  | { kind: 'contact_attr',   field: string,    op: Op, value?: any }
  | { kind: 'var',            name: string,     op: Op, value?: any }
  | { kind: 'business_hours', expect: 'open'|'closed' }
```

`keyword` continua casando contra `msg.text` (retrocompatível, inclui `selectedId` normalizado como texto).

### 3.4 Nó `ask` (novo)
Substitui o padrão manual "message + condition de texto".

```ts
interface AskNodeData {
  question: string                 // suporta {{var}}
  varName: string                  // salva em FlowState.vars[varName]
  crmField?: string                // se set → emite update_lead automático
  validation?: {
    type: 'text'|'number'|'email'|'phone'
    errorMessage: string           // reenviado se inválido
    maxRetries: number             // padrão 3 → ramo else
  }
}
```

Ciclo: motor emite a `question` (interpolada), retorna `next:'await_input'` com cursor parado no `ask` e grava `state.vars._awaiting = { varName, crmField, validation, retriesLeft }`. Na próxima inbound, valida → grava var → (se `crmField`) emite `update_lead` → segue. Inválido → re-emite `errorMessage`, decrementa `retriesLeft`; esgotou → ramo `else`.

### 3.5 Efeitos ricos (extensão de FlowEffect)
```ts
type FlowEffect =
  | { kind: 'send_text', text: string }                                              // existente, inalterado
  | { kind: 'send_interactive', type: 'button'|'list', body: string,
      options: { id: string, title: string }[] }                                     // novo
  | { kind: 'send_media', mediaType: 'image'|'audio'|'document',
      url: string, caption?: string }                                                // novo
  | { kind: 'set_tag', ... } | { kind: 'update_lead', ... }
  | { kind: 'handoff', ... } | { kind: 'goto_flow', ... }                            // inalterados
```

### 3.6 Business hours estruturado (breaking change controlado)
`org.settings.businessHours` é hoje **texto livre**. Passa a:

```ts
interface BusinessHoursConfig {
  timezone: string                 // default 'America/Sao_Paulo'
  days: Record<0|1|2|3|4|5|6, { open: string, close: string } | null>  // 'HH:mm'; null = fechado
}
```

Migration **aditiva no JSON de settings** (sem coluna nova, sem drop). Settings sem o campo → default seguro (todos os dias `null` → `business_hours` sempre resolve `closed`, fail-closed). O texto livre legado permanece em outro campo para referência humana; não é parseado.

---

## 4. Componentes

### 4.1 Núcleo puro (zero IO)
| Módulo | Estado | Responsabilidade |
|---|---|---|
| `flowPredicates.ts` | novo | `evalPredicate(pred, ctx)` e `evalEdge(edge, ctx)`. Resolve os 4 kinds. Substitui `matchCondition`. **Nunca lança.** |
| `flowInterpolate.ts` | novo | `renderTemplate(text, scope)` — `{{vars.x}}`, `{{contact.name}}`, `{{system.businessName}}`, fallback `{{vars.x \| "default"}}`. |
| `businessHours.ts` | novo | `isOpen(config, now)` — pura, recebe `now`. Resolve timezone/dias/vira-noite. |
| `flowEngine.ts` | alterado | `resolveStep(flow, state, message, ctx, options)` ganha `ctx`. Interpola conteúdo, chama `evalEdge`, trata nó `ask`. |

### 4.2 Orquestração (IO)
| Módulo | Estado | Responsabilidade |
|---|---|---|
| `flowRuntime.ts` | alterado | Carrega Contact + `businessHoursConfig`, monta `EvalContext`, persiste `vars` após `ask`. |
| `flowEffects.ts` | alterado | Executa `send_interactive` e `send_media` via provider; falha isolada não derruba os demais efeitos do passo. |
| `whatsappSender` | alterado | Builders: reply buttons (≤3), list (≤10 rows), media por URL. |
| webhook inbound | alterado | Normaliza `interactive.button_reply`/`list_reply` → `msg.text = title` + `ctx.selectedId = id`. |

### 4.3 Editor (canvas)
| Alvo | Estado | Responsabilidade |
|---|---|---|
| Paleta de nós | alterado | Nó `ask`. |
| Inspector de aresta | alterado | Condition builder em "chips": kind → field → op → value (monta `predicates[]`). Valida presença de ramo `else`. |
| Inspector de nó `message` | alterado | Anexar mídia ou transformar saída em botões/lista (valida ≤3/≤10). |

---

## 5. Fluxo de dados (exemplo ponta a ponta)

Nó `ask` "Qual seu interesse, {{vars.nome}}?" com botões, capturando em `vars.interesse` + `funnelStage`, ramificando por VIP:

1. **Outbound:** `renderTemplate` → "Qual seu interesse, Ana?"; emite `send_interactive`; `next:'await_input'`; cursor no `ask`; grava `_awaiting`.
2. **Inbound:** botão chega como `button_reply{id,title}`; webhook normaliza `msg.text='Planos'`, `ctx.selectedId='planos'`; runtime monta `ctx` (contact.tags, vars, now, businessHours).
3. **Captura:** retoma do cursor; valida; `vars.interesse='Planos'`; `crmField` → emite `update_lead{funnelStage:'Planos'}`.
4. **Ramificação:** aresta A `[contact_attr tags contains 'vip', business_hours open]` → `evalEdge` true && true → segue A; aresta B `[]` (else) não alcançada.

Persistência: cursor + `vars` + `_awaiting` no `FlowState` (Redis, TTL 7 dias). Nenhuma tabela nova nesta sub-spec.

---

## 6. Tratamento de erros (fail-closed, nunca erro ao cliente)

**Captura:** inválido → re-pergunta + decrementa retry; esgotou → `else`. Botão antigo sem aresta correspondente → `else`. Não-texto onde espera texto → conta como inválido. TTL expira no meio → recomeça pelo roteador (sem regressão).

**Interpolação:** var ausente → vazio ou fallback (nunca imprime `{{}}` cru). Malformado → token ignorado, texto original mantido, sem exceção. Objeto/array → stringify seguro truncado.

**Predicados:** `evalPredicate` **nunca lança**. Campo/var inexistente → `exists`/`not_exists` resolvem; demais ops → `false` (segue avaliando). Nada casa e sem `else` → fluxo encerra (`__ended__`); editor alerta "fluxo sem ramo padrão".

**Inputs ricos:** >3 botões / >10 rows → editor bloqueia publicação; runtime trunca defensivamente + loga. Fora da janela 24h Meta → regra existente `meta_24h_window` (não envia). Provider rejeita mídia → efeito falha isolado, `effects_failed`, não derruba os demais.

Validações de **estrutura** ficam no editor (impedem publicar fluxo quebrado); erros de **runtime** são absorvidos pelas funções puras retornando valores seguros + logs `[Maestro]`.

---

## 7. Estratégia de testes

**Núcleo puro (TDD, ~40-50 testes novos):**
- `flowPredicates`: cada kind × op; AND múltiplo; first-match / ordem; `else` por último; campo inexistente → `false` sem throw; `exists`/`not_exists`.
- `flowInterpolate`: presente; ausente → vazio; fallback; malformado; objeto/array; múltiplos `{{}}`; escopos.
- `businessHours`: dentro/fora; vira-noite; dia fechado; timezone; bordas exatas. `now` fixo injetado.
- `flowEngine`: `ask` (captura, crmField → update_lead, retry, esgotamento → else, interpolação); ramificação integrando os 3 puros.

**Integração (mais fino):** `flowRuntime` monta `ctx` correto; normalização de `button_reply`; `flowEffects` interactive/media (payload ≤3/≤10/URL); migration businessHours (legado → estrutura; ausente → default seguro).

**Limites honestos:** provider WhatsApp real → smoke manual no `.command` de validação (como no v2). Rendering do canvas → validação manual no dashboard. Foco da automação = lógica de decisão pura.

---

## 8. Referências
- `docs/maestro/MAESTRO-TECNICO.md` §4 (inventário), §2.2 (motor puro), §2.5 (janela 24h)
- `docs/superpowers/specs/2026-06-11-maestro-v2-design.md` (fundação do motor)
- Próximas: 1B Analytics por nó · 1C Subfluxos call/return
