# Maestro v3 — Spec 1B: Geração de Fluxos Ricos por IA (Design)

> **Data:** 2026-06-13 · **Status:** aprovado, pronto para plano
> **Pacote:** 1 (Fundação) — sub-spec 1B (parte "geração"). Analytics por nó fica para uma spec 1B-analytics separada; subfluxos = 1C.
> **Depende de:** Spec 1A (motor + editor) — branch `maestro-v3-spec1a-motor`. Os blocos produzem exatamente os `data` shapes que o motor 1A executa e o editor 1A renderiza.

---

## 1. Objetivo

Hoje a IA do Maestro (`flowGenerator`) só preenche o **conteúdo** de um esqueleto fixo (`Início → Mensagem → Marcar tag → Nó-IA`). Esta spec ensina a IA a **gerar fluxos ricos** — com nós `ask` (captura), perguntas com botões, ramificações por variável/horário — mantendo o eixo do produto: *a IA constrói o fluxo inteiro a partir do contexto de onboarding, e o cliente vê/aprova no canvas*.

**Abordagem (escolhida no brainstorm): composição de blocos validados.** Uma biblioteca de "blocos ricos" pré-validados; a IA **monta** o fluxo escolhendo e encadeando blocos (semântica de alto nível); um **montador determinístico** transforma o plano em `nodes`/`edges` válidos por construção. A IA nunca escreve grafo cru — elimina a classe de erro "grafo inválido".

### Invariante-chave
O motor nunca recebe um grafo que não saiba executar: a IA fala só em blocos semânticos; o montador (puro + validado) é o único que escreve nodes/edges.

---

## 2. Escopo

**Dentro (1B-geração):**
- Biblioteca de blocos `flowBlocks` (catálogo v1).
- Montador `flowAssembler` (plano → grafo válido).
- Validação de grafo pura `flowGraphValidation` (porta da `validateGraph` do editor 1A para o backend).
- `generateRichDraft` no `flowGenerator`: prompt de plano de blocos → parse → montagem → validação → fallback.
- Receitas-semente por objetivo (guiam o prompt).
- Integração rica-primeiro + fallback no `generateDraftForObjective` (usado por `generateSmartFlows` e `generateJourney`).

**Fora (YAGNI / outras specs):**
- `send_media` na geração por IA — a IA não tem URLs reais de assets; mídia fica para inserção manual no editor (o motor/editor já suportam).
- Ramificação por **atributo de CRM** (tags/leadStatus/funnelStage) na geração — a IA não conhece a taxonomia de tags da org; geraria condições quebradas. Ramos gerados restritos a: botão tocado, variável capturada, horário comercial. CRM-branching continua manual no canvas.
- `wait`/`schedule` (follow-up temporal gerado) → Pacote 2.
- `goto_flow` entre fluxos → já coberto pelo Arquiteto de Jornada (handoffs).
- Analytics por nó → spec 1B-analytics separada.

---

## 3. Arquitetura

Três módulos puros novos + extensão do gerador (IO). Padrão herdado: estrutura determinística + IA, fail-soft, nunca quebra.

```
flowGenerator.generateRichDraft  (IO: LLM)
   │  brief do negócio + objetivo + spec dos blocos + few-shot
   ▼
LLM → PLANO (JSON de blocos)  → extractJson (existente)
   ▼
flowAssembler.assemble(plan)   (PURO)
   ├─ valida o plano (refs, slots, types)
   ├─ flowBlocks.expand(slot)  (PURO) → fragmentos {nodes,edges,entry,exits}
   ├─ costura exits→entries (arestas com predicates/when corretos)
   ├─ else-completion (todo ramo/ask ganha ramo padrão seguro)
   ├─ start + layout em coluna (posições cosméticas)
   └─ flowGraphValidation.validate(graph)  (PURO, defesa em profundidade)
   ▼
{ ok, graph } → FlowDraft (source:'ai-rich')   |   inválido → fallback blueprint atual
```

Composição com 1A: blocos emitem `ask`, `condition` com `predicates`, `message` interactive — que o motor 1A executa e o editor 1A renderiza/edita. Todo fluxo gerado nasce auditável.

---

## 4. Catálogo de blocos (v1)

Cada bloco: slots (IA preenche) → `expand(slots)` → `{ nodes, edges, entry, exits[] }`. Slots sanitizados no expand (limites 1A: texto 600, tag 40 kebab, prompt 900, título botão 20, varName `[a-z0-9_]`).

| Bloco | Slots | Expande para | Exits |
|---|---|---|---|
| `message` | `text` (`{{var}}` ok) | `message` | `next` |
| `ask` | `question`, `varName`, `validationType?`, `errorMessage?`, `crmField?` | `ask` (+validação) | `ok`, `else` |
| `ask_buttons` | `question`, `options[]={title,next}` (2–3) | `message`(interactive button) → `condition` (arestas `keyword equals "<título>"`) | 1 por opção + `else` |
| `branch_var` | `varName`, `cases[]={op,value,next}` | `condition` (arestas `predicates:[{kind:'var',name,op,value}]`) | 1 por caso + `else` |
| `branch_hours` | — | `condition` (aresta `business_hours:open` + `else`) | `open`, `closed` |
| `tag` | `tag` | `tag` | `next` |
| `ai` | `prompt` | `ai` | `next` |
| `handoff` | — | `transfer` | — (encerra) |

Composição típica (qualificação):
`message(boas-vindas) → ask_buttons("O que procura?",[Planos,Suporte,Outro]) → [Planos→tag→ai][Suporte→ai][Outro→ask("Conta mais?",obs)→ai]`

---

## 5. Formato do plano da IA + prompt

O LLM devolve um plano de blocos (não nodes/edges):

```json
{
  "flowName": "Qualificação de leads",
  "entry": "b1",
  "blocks": [
    { "id": "b1", "type": "message", "text": "Oi! Bem-vindo à {{businessName}} 👋", "next": "b2" },
    { "id": "b2", "type": "ask_buttons", "question": "O que você procura hoje?",
      "options": [ { "title": "Planos e preços", "next": "b3" }, { "title": "Suporte", "next": "b5" }, { "title": "Outro assunto", "next": "b6" } ] },
    { "id": "b3", "type": "tag", "tag": "lead-planos", "next": "b4" },
    { "id": "b4", "type": "ai", "prompt": "Apresente os planos e ajude a escolher..." },
    { "id": "b5", "type": "ai", "prompt": "Atenda a dúvida de suporte..." },
    { "id": "b6", "type": "ask", "question": "Pode me contar mais?", "varName": "assunto", "next": "b4" }
  ],
  "rationale": [ { "node": "b2", "why": "..." } ],
  "summary": "..."
}
```

**Princípios:** cada bloco tem `id`/`type`; `next`/`option.next` apontam para outro `id` (o montador resolve em arestas); bloco sem `next` (e não-ramo) = fim natural. A IA nunca escreve ids de nó, posições ou predicados crus.

**Prompt** (estende o caminho atual, reusa `loadBusinessContext().brief`):
- System: "Monte um fluxo ESCOLHENDO e ENCADEANDO blocos de uma lista fechada. Use só os tipos listados. Responda só com JSON válido."
- User: `brief` do negócio + objetivo (`blueprint.label/description`) + **spec compacta dos blocos** (tabela type→slots) + **few-shot** (1 plano modelo) + regras (pt-BR, WhatsApp, ≤3 botões, sempre ofereça caminho "Outro/else").
- `forceProvider:'anthropic-sonnet'`, `maxTokens ~1500`, `temperature 0.5` (igual aos caminhos existentes).
- **Receita-semente por objetivo** injetada no prompt como ponto de partida (reduz alucinação, dá consistência); a IA adapta.

**Parse:** reuso de `extractJson` (cercas, vírgula sobrando, control chars) + validação semântica do plano.

---

## 6. O montador (`flowAssembler.ts`, puro)

`assemble(plan): { ok: true, graph, warnings } | { ok: false, errors }`

1. **Valida o plano**: types conhecidos; `entry` e todo `next`/`option.next` referenciam `id` existente; slots obrigatórios presentes. Falha → `{ok:false}`.
2. **Expande** cada bloco (`flowBlocks.expand`) com ids locais (`b2_msg`, `b2_cond`), slots sanitizados.
3. **Costura**: cada `exit` → aresta do nó de saída do fragmento até o `entry` do fragmento-alvo, com `predicates`/`when` corretos (opção de botão → `keyword equals título`; caso de var → `predicates var`; horário → `business_hours`; `ok`/`next` → aresta simples).
4. **Else-completion**: todo `condition` (de ask_buttons/branch_var/branch_hours) e todo `ask` recebem ramo padrão garantido. Plano definiu "Outro/else" → liga nele. Senão, política segura: liga ao primeiro nó-IA do fluxo (ou cria um `ai` de fallback). Nunca deixa ramo morto que encerra por acidente.
5. **`start` + layout**: prepende `start → entry`; posições em coluna (x por profundidade, y por ordem) — cosméticas, o cliente reposiciona.
6. **Validação final** (`flowGraphValidation.validate`): ids de opção únicos, ≤3 botões/≤10 itens, todo ramo com else, sem `next` órfão, `ask` com varName. Erro → tratado como `{ok:false}` (defesa em profundidade).

Pureza: `expand` e `assemble` sem IO — testáveis em isolamento.

---

## 7. Validação de grafo (`flowGraphValidation.ts`, puro)

Porta backend da `validateGraph` do editor (Spec 1A, E5). `validate(nodes, edges): { errors: string[]; warnings: string[] }`:
- `ask` sem `varName` → erro; `ask` sem ramo `else` explícito → erro (alinhado ao `pickElseBranch` do motor).
- `message.interactive`: 0 opções / >limite (3 botão, 10 lista) / título vazio / id duplicado → erro.
- `condition` com saídas sem ramo padrão (else/bare) → warning.
- `contact_attr` com `field==='customFields.'` → erro.

Usado pelo montador (passo 6) e disponível para outros caminhos (ex.: validar drafts antes de salvar, futuro).

---

## 8. Integração e fallback

- **`generateRichDraft(ctx, blueprint, organizationId, multiAgent)`** (novo, em `flowGenerator`): monta o prompt de plano, chama o LLM, `extractJson`, `flowAssembler.assemble`. Sucesso → `FlowDraft { source:'ai-rich', nodes, edges, rationale, summary }`. Qualquer falha (LLM erro, JSON inválido, plano inválido, assemble `ok:false`) → chama o caminho atual (`generateDraftForObjective` content-fill) como fallback. **Nunca quebra.**
- **`generateDraftForObjective`** passa a tentar `generateRichDraft` primeiro; fallback para o comportamento de blueprint atual. Assim `generateSmartFlows` e `generateJourney` entregam fluxos ricos automaticamente. O Arquiteto de Jornada continua desenhando os handoffs entre os fluxos (agora ricos) — sem mudança.
- **Retrocompat**: `FlowDraft` ganha `'ai-rich'` no union de `source`; nenhum campo removido. Caminhos `generateFlowDraft`/refresh inalterados.

---

## 9. Estratégia de testes

**Puro (TDD):**
- `flowBlocks`: cada bloco expande para o fragmento correto (shape do motor, ids locais, exits certos, slots sanitizados/limites).
- `flowAssembler`: costura correta (exits→entries viram arestas certas); else-completion (ramo/ask sem else ganha destino seguro); start+layout; **rejeita planos inválidos** (ref quebrada, type desconhecido, slot faltando); grafo montado passa na validação.
- `flowGraphValidation`: cada regra (espelha os casos do editor E5).

**Integração (LLM mockado):**
- `generateRichDraft`: mock `llmRouter.complete` devolve um plano válido → assert grafo rico (`ask`/`condition`/interactive presentes, `source:'ai-rich'`); mock devolve lixo/JSON inválido → assert fallback (`source:'ai'|'fallback'`, grafo do blueprint); mock lança → fallback.

**Limites honestos:** não testamos a *qualidade* do conteúdo gerado pelo LLM (subjetivo) — só que o pipeline produz grafo válido e cai no fallback quando devido. Qualidade entra no smoke manual.

---

## 10. Referências
- Spec 1A: `docs/superpowers/specs/2026-06-13-maestro-v3-spec1a-fluxos-ricos-design.md`
- `flowGenerator.ts` (caminhos atuais: generateDraftForObjective, generateSmartFlows, generateJourney, loadBusinessContext, extractJson)
- `flowBlueprints.ts` (BLUEPRINTS, buildGraphFromContent, BlueprintGoal)
- Editor `validateGraph` (origem da porta backend): `apps/web/app/(dashboard)/flows/page.tsx`
- Próximas: 1B-analytics (FlowRun/FlowStepEvent), 1C (subfluxos call/return)
