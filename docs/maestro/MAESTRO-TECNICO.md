# MAESTRO — Documentação Técnica

> **Versão:** 2.0 (Maestro v2, em produção desde 12/06/2026)
> **Escopo:** arquitetura, modelos de dados, padrões de engenharia, capacidades atuais, limitações conhecidas e roadmap de evolução.
> **Audiência:** engenharia, produto técnico, due diligence.

---

## 1. O que é o Maestro

O Maestro é o orquestrador de fluxos conversacionais da ZappIQ para WhatsApp e Instagram. Seu eixo central **não é o editor visual** (commodity de mercado), e sim a **autonomia da IA**: o Maestro gera, atualiza e versiona fluxos completos a partir do contexto que o cliente fornece no onboarding —

1. **Survey de qualificação** preenchido no onboarding;
2. **Documentos enviados** pelo cliente (base de conhecimento);
3. **Perguntas e respostas** cadastradas no campo específico do onboarding;
4. **Identidade do agente** (persona configurada).

O editor visual existe como camada de transparência e ajuste fino: a IA cria, o canvas mostra, o cliente confia e aprova.

### Diferenciais já verificados contra o mercado (pesquisa jun/2026, claims verificadas adversarialmente)

- **Geração de fluxo completo por linguagem natural**: não observada em nenhum concorrente verificado (a alegação equivalente do Botpress foi refutada 0-3 na verificação).
- **Atualização Inteligente multi-nó com diff visual**: a IA reescreve todos os nós de conteúdo de um fluxo a partir do conhecimento atualizado do negócio e apresenta diff (antes/depois) para aprovação — não observada em nenhum concorrente verificado.
- **Versionamento imutável com restore** integrado ao ciclo de publicação.
- **Timers duráveis** (BullMQ + Postgres) com validação de janela de 24h da Meta e retomada por IA.

---

## 2. Arquitetura

### 2.1 Visão de módulos (apps/api)

```
┌────────────────────────────────────────────────────────────────┐
│                        INBOUND (webhook)                        │
│  mensagem WhatsApp/Instagram → orquestrador → flowRuntime       │
└──────────────────────────┬─────────────────────────────────────┘
                           ▼
┌─────────────── CAMADA DE ORQUESTRAÇÃO (IO) ────────────────────┐
│ flowRuntime.ts   resolve passo ativo: cancela timers de wait,   │
│                  roteia entre fluxos ativos, persiste cursor    │
│ flowEffects.ts   executa efeitos: send_text, tag, update_lead,  │
│                  handoff, IA (extraído do orquestrador)         │
│ flowScheduler.ts agenda/cancela timers, worker BullMQ           │
│ flowAiResume.ts  retomada por IA em timer (LLM lean path)       │
│ flowGenerator.ts geração e refresh de fluxos por IA             │
│ flowVersionService.ts snapshots serializáveis com retry         │
└──────────────────────────┬─────────────────────────────────────┘
                           ▼
┌─────────────── NÚCLEO PURO (zero IO, 100% testável) ───────────┐
│ flowEngine.ts      motor de execução de nós e efeitos           │
│ flowRouter.ts      pickFlowForMessage — roteador determinístico │
│ flowContentPatch.ts extract/apply/diff de conteúdo multi-nó     │
│ flowsRefreshValidation.ts sameStructure (validação de refresh)  │
│ computeRunAt / validateTimerFire (parte pura do scheduler)      │
└──────────────────────────┬─────────────────────────────────────┘
                           ▼
┌─────────────────── PERSISTÊNCIA / FILAS ───────────────────────┐
│ Postgres (Supabase): Flow, FlowVersion, FlowTimer, FlowTemplate │
│   — RLS por organizationId (multi-tenant)                       │
│ Redis: cache de FlowState (TTL 7 dias), pausa de IA,            │
│   BullMQ fila 'flow-timer'                                      │
└────────────────────────────────────────────────────────────────┘
```

### 2.2 Padrão "motor puro"

`flowEngine.ts` não faz IO: recebe `(flow, state, message, options)` e retorna `{ effects, next, cursor }`. Todos os módulos novos do v2 seguem o mesmo padrão (router, content patch, validação, cálculo de timers) — o que permite TDD integral do núcleo (35+ testes unitários no v2) e isola side effects nos módulos de orquestração.

### 2.3 Ciclo de vida de uma mensagem inbound

1. Webhook recebe a mensagem → orquestrador chama `resolveActiveFlowStep`.
2. `cancelPendingWaitTimers` cancela timers de `wait` pendentes (cliente respondeu).
3. Se há cursor ativo, retoma o fluxo do ponto salvo; senão, `pickFlowForMessage` roteia entre **todos** os fluxos ativos da org.
4. `flowEngine.resolveStep` executa nós até parar em: efeito de IA, `wait`/`schedule` (→ timer), `goto_flow` (→ hop, máx 5), `transfer` (→ handoff) ou fim.
5. Efeitos são executados por `flowEffects.executeFlowEffects`.
6. Cursor é persistido (`{...state, flowId}`) ou marcado `__ended__`.

### 2.4 Roteador determinístico (`flowRouter`)

Ranking: keyword exata (3) > substring (2) > primeiro contato (1). Tiebreak total: `priority desc → updatedAt desc → id.localeCompare`. Triggers `SCHEDULE/MANUAL/EVENT` são fail-closed no roteador (não auto-iniciam por inbound).

### 2.5 Timers duráveis (`FlowTimer` + BullMQ)

- `wait`: pausa N minutos com ramo `timeout` ("sem resposta") e cancelamento automático se o cliente responder.
- `schedule`: dispara em data/hora absoluta.
- **Claim atômico anti-duplicidade**: o worker faz `updateMany WHERE status='pending' → 'fired'` **antes** de executar efeitos. Retry do BullMQ nunca reenvia mensagem; falha pós-claim marca `statusReason='effects_failed'` sem voltar a pending.
- `validateTimerFire` (puro) decide na ordem: `not_pending → flow_inactive → flow_version_changed → human_takeover → customer_replied (wait) → meta_24h_window → ok`.
- **Janela 24h Meta**: timer que dispararia fora da janela de atendimento expira com `reason='meta_24h_window'` (não envia mensagem livre fora da janela; evolução prevista: fallback para template HSM aprovado).
- **Retomada por IA**: se o ramo do timer cai num nó-IA, `flowAiResume` monta um prompt lean (contexto do negócio + persona + últimas 20 mensagens + instrução do nó) e gera a mensagem de reengajamento. Totalmente fail-closed: qualquer falha → silêncio, nunca erro ao cliente.

### 2.6 Versionamento (`FlowVersion`)

- Snapshot imutável a cada publicação/refresh: `nodes`, `edges`, `triggerType`, `triggerConfig`, `source` (`publish`/`refresh`/`restore`), autor.
- Numeração sequencial por fluxo com transação **Serializable + retry** (P2034/P2002) — publicações simultâneas nunca colidem.
- Restore de qualquer versão pelo dashboard.

### 2.7 Atualização Inteligente multi-nó

1. `extractEditableContent` (puro) coleta todos os nós `message`/`tag`/`ai` em ordem.
2. O LLM recebe o conhecimento atualizado do negócio + lista de itens e devolve JSON com novos conteúdos + nota de mudança (limites: texto 600, tag 40 kebab, prompt 900).
3. `applyContentPatch` altera **somente** o campo de conteúdo (estrutura/ordem intactas), `sameStructure` valida, `diffContent` gera o diff exibido no dash (antes riscado / depois em verde).
4. Aplicar = snapshot `source='refresh'` + update.

### 2.8 Multi-tenancy e segurança

- RLS por `organizationId` em todas as tabelas de fluxo (policy `tenant_isolation`).
- GRANTs condicionais (`DO $$ IF EXISTS pg_roles → app_user`) — produção Supabase não tem o role.
- Zod com strip de chaves desconhecidas nas rotas (sem mass-assignment).
- Pausa de IA por humano em Redis: `ai_paused:{orgId}:{contactPhone}` (respeitada por inbound e por timers).

---

## 3. Modelos de dados (Prisma)

| Model | Papel | Campos-chave |
|---|---|---|
| `Flow` | Fluxo publicável | `nodes/edges Json`, `triggerType`, `triggerConfig`, `priority Int`, `isActive` |
| `FlowVersion` | Snapshot imutável | `@@unique([flowId, version])`, `source`, `createdById` |
| `FlowTimer` | Timer durável | `kind (wait/schedule)`, `resumeNodeId`, `stateSnapshot`, `runAt`, `status`, `statusReason`, `jobId` |
| `FlowTemplate` | Galeria de templates | — |
| `Campaign` | Broadcast outbound (separado do Maestro hoje) | `type=BROADCAST`, usa `MessageTemplate` (HSM) |

Estado de conversa: `FlowState { cursor, vars }` em Redis (TTL 7 dias) + espelho `currentFlowState` na `Conversation`.

Tipos de nó atuais: `start, message, condition, ai, tag, update_lead, transfer, wait, schedule, goto_flow`.

---

## 4. Capacidades atuais — inventário honesto (auditoria de código, jun/2026)

| # | Capacidade | Status | Detalhe |
|---|---|---|---|
| 1 | Geração de fluxo por linguagem natural | ✅ | `flowGenerator` — blueprint a partir de descrição + contexto de onboarding |
| 2 | Atualização Inteligente multi-nó com diff | ✅ | seção 2.7 |
| 3 | Versionamento + restore | ✅ | seção 2.6 |
| 4 | Timers duráveis (wait/schedule) + retomada IA | ✅ | seção 2.5 |
| 5 | Multi-fluxo ativo + roteador determinístico | ✅ | seção 2.4 |
| 6 | Salto entre fluxos | ⚠️ Parcial | `goto_flow` one-way; estado resetado; sem call/return |
| 7 | Variáveis | ⚠️ Parcial | `vars` existem no estado, **sem interpolação `{{var}}`** em mensagens e sem nó de captura de resposta |
| 8 | Condições | ⚠️ Limitado | apenas keyword/substring/regex da última mensagem; sem atributos do contato, tags, horário comercial |
| 9 | Nó-IA | ⚠️ Básico | prompt + RAG de contexto; **sem function calling/tools, sem KB escopada por nó** |
| 10 | Human handoff | ⚠️ One-way | `transfer` pausa IA; sem retomada estruturada pós-atendimento |
| 11 | Analytics por nó | ❌ | sem `FlowRun`/step log; nenhum funil ou drop-off |
| 12 | A/B testing / traffic split | ❌ | fluxos determinísticos sem variantes |
| 13 | Webhook/HTTP em fluxo | ❌ | nenhum nó de integração externa |
| 14 | Inputs ricos | ❌ | nó `message` envia só texto; sem botões, listas interativas, mídia |
| 15 | E-commerce em fluxo | ❌ | catálogo/carrinho/pagamento fora do fluxo; broadcast (HSM) em sistema separado |
| 16 | Triggers implementados | ⚠️ 2 de 11 | runtime auto-inicia só `KEYWORD` e `FIRST_CONTACT`; schema prevê SCHEDULE, EVENT, CART_ABANDONED, TIMEOUT_* |

---

## 5. Roadmap de evolução (proposto, pendente de aprovação)

### Pacote 1 — Fundação (paridade essencial)
Pré-requisitos para a IA gerar fluxos ricos e para qualquer otimização baseada em dados:

1. **Variáveis de verdade**: nó de captura de resposta (`ask` → salva em `vars`) + interpolação `{{var}}` em todos os conteúdos.
2. **Inputs ricos**: botões e listas interativas WhatsApp, mídia (imagem/áudio/documento) no nó `message`.
3. **Condições avançadas**: atributos do contato, tags, valores de `vars`, horário comercial/dias úteis.
4. **Analytics por nó**: model `FlowRun` + `FlowStepEvent` (entrou/saiu/respondeu/abandonou), funil por fluxo e drop-off por nó no dash.
5. **Subfluxos call/return**: pilha de chamadas no `FlowState` (`callStack: [{flowId, nodeId}]`); `goto_flow` ganha modo `call` com retorno ao chamador; vars compartilhadas.

### Pacote 2 — Cérebro (diferencial disruptivo)
O coração do posicionamento "Maestro autônomo":

6. **AI step agêntico**: nó-IA com tools/function calling (consultar pedido, agendar, chamar webhook), KB escopada por nó (RAG por tenant já existente no onboarding), saída estruturada que decide o próximo ramo.
7. **Loop analytics → IA (fluxo auto-otimizável)**: o Maestro lê o funil (Pacote 1.4), identifica nós com drop-off anômalo e **propõe nova versão com diff** (reutiliza a infra da Atualização Inteligente). Cliente só aprova. *Nenhum player verificado entrega isso hoje.*
8. **Simulação com personas sintéticas**: antes de publicar, a IA simula N conversas de clientes típicos (derivados do survey de onboarding) contra o fluxo e reporta travamentos/ambiguidades. Sinergia com o ciclo "Qualidade da IA".
9. **Maestro reativo ao conhecimento**: alteração em documentos/Q&A/identidade no onboarding → detecção → re-proposta dos fluxos afetados com diff. Onboarding vira motor vivo do produto.

### Pacote 3 — Receita
10. **A/B com traffic split** sobre o versionamento existente (variantes = duas `FlowVersion` ativas com % de tráfego; métrica de conversão por variante).
11. **Handoff estruturado com retomada**: fila/ticket, parada imediata da IA (já existe), e retomada controlada do fluxo quando o atendente encerra.
12. **E-commerce no fluxo**: nó de catálogo WhatsApp, carrinho, **Pix** (gap aberto — nenhum player verificado tem Pix nativo no fluxo), trigger `CART_ABANDONED`.
13. **Broadcast integrado**: campanha HSM que injeta o respondente direto num fluxo do Maestro (hoje são sistemas separados); fallback de timer expirado por janela 24h → template HSM.

---

## 6. Operação

- **Deploy API**: Fly.io `zappiq-api` (2 máquinas), `fly deploy --remote-only`; `release_command` roda `prisma migrate deploy`.
- **Deploy Web**: Vercel (push na `main` → produção zappiq.com.br).
- **Filas**: BullMQ sobre Redis; fila `flow-timer` com worker iniciado no boot da API (ambas as máquinas; claim atômico garante exatamente-um-disparo).
- **Migrations**: aditivas e idempotentes (`IF NOT EXISTS`), RLS + policy + GRANT condicional (produção sem role `app_user`).
- **Observabilidade atual**: logs estruturados `[Maestro]`/`[FlowScheduler]`; evolução prevista: métricas por nó via Pacote 1.4.

---

## 7. Referências cruzadas

- Spec do v2: `docs/superpowers/specs/2026-06-11-maestro-v2-design.md`
- Pesquisa competitiva verificada (jun/2026): global + brasileiros — ver `docs/gtm/` (battle card e fontes) e `docs/maestro/MAESTRO-COMERCIAL-GTM.md`
- Qualidade da IA (ciclo 2): `agentEvalRunner`, `agentQuality` — pipeline de avaliação que se integrará à simulação por personas (Pacote 2.8)
