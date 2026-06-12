# Maestro v2 — Evolução do construtor de fluxos

**Data:** 2026-06-11
**Status:** Aprovado em brainstorm (Rodrigo), aguardando revisão final da spec
**Escopo:** Primeira de duas evoluções (a segunda, Qualidade da IA, terá spec própria)

## Contexto

O Maestro hoje tem motor puro testado (`apps/api/src/agents/flowEngine.ts`), gerador assistido por IA (`flowGenerator.ts`: `generateFlowDraft`, `generateSmartFlows`, `generateJourney`), templates por vertical, editor React Flow (`apps/web/app/(dashboard)/flows/page.tsx`) e detecção de fluxo desatualizado (badge "stale"). Quatro lacunas estruturais impedem o produto descrito no documento "MAESTRO INTELIGENTE" (2026-05-23):

1. Nós `wait`/`schedule` passam direto (TODO "Fase 3" em `flowEngine.ts`).
2. A atualização inteligente só sinaliza desatualização; não regenera nem aplica.
3. Apenas 1 fluxo ativo por organização — mas o gerador já cria especialistas por objetivo e desenha jornadas com handoffs que não podem rodar em produção.
4. Editar/publicar sobrescreve sem histórico; não há rollback.

## Decisões de produto (tomadas no brainstorm)

- **Gating por plano:** limite de fluxos ativos = cota de fluxos do plano (Lite 3, Growth 15, Scale conforme plano). Sem sub-limite novo de "ativos".
- **Critério de sucesso:** as 4 frentes completas-porém-enxutas, robustez inegociável no runtime (TDD), mirando produção antes de 30/06/2026 (Cohort Founders).
- **Filosofia:** nada muda sem autorização do cliente (mesmo princípio do loop de Qualidade da IA).

## Princípio arquitetural

`flowEngine` permanece puro (sem IO) e intocado em sua API atual; ganha apenas novos tipos de efeito/nó. Tudo novo entra como módulo separado com fronteira clara:

| Módulo | Responsabilidade | Tipo |
|---|---|---|
| `flowRouter` | Decidir **qual** fluxo ativo atende a mensagem | Função pura nova |
| `flowScheduler` | Decidir **quando** retomar (timers via BullMQ) | Serviço novo |
| `flowRefresher` | Decidir **o que** atualizar (regen + diff + apply) | Serviço novo |
| `flowRuntime` | Orquestrar estado, efeitos e persistência | Existente, estendido |

Padrões do repo respeitados: RLS por `organizationId` em toda operação, BullMQ para assíncrono (padrão de `queueService.ts`), soft-delete, feature flag por organização.

## Frente 1 — Timing real (nós `wait` e `schedule`)

### Semântica

- **`wait`**: "espere a resposta do cliente por X tempo; se não responder, siga o ramo de timeout". Se o cliente responder antes, o timer é cancelado e o fluxo segue pelo caminho normal.
- **`schedule`**: "retome o fluxo (e envie a mensagem do nó seguinte) em horário/atraso definido na configuração do nó".

### Mecânica

1. O motor emite efeito `schedule_resume` (`{ resumeNodeId, delayMs | runAt }`) ao encontrar `wait`/`schedule`, em vez de atravessá-los.
2. `flowRuntime` grava um registro **`FlowTimer`** em Postgres — fonte de verdade durável (o estado Redis atual não sobrevive a esperas de dias): `organizationId`, `conversationId`, `flowId`, `flowVersion`, `resumeNodeId`, `stateSnapshot` (JSON), `runAt`, `status` (`pending | fired | cancelled | expired`), `jobId`.
3. Job atrasado na fila BullMQ **`flow-timer`** (novo par Queue/Worker em `queueService.ts`, mesmo padrão das filas existentes).
4. Ao disparar, o worker valida ANTES de agir:
   - fluxo ainda ativo e na mesma versão (senão `cancelled` + log);
   - conversa sem takeover humano;
   - cliente realmente não respondeu desde o agendamento (senão `cancelled` — o `wait` perdeu o propósito);
   - **janela de 24h da Meta**: fora da janela, NÃO envia mensagem livre — marca `expired` e loga. Suporte a template aprovado fica explicitamente fora deste escopo.
5. Validado, reidrata o estado do snapshot e retoma o fluxo no `resumeNodeId` pelo runtime normal.
6. Mensagens disparadas por timer contam na cota de **disparos** do plano.
7. Resposta do cliente durante uma espera: o runtime cancela o timer pendente da conversa (status `cancelled` + remoção do job) e processa a mensagem normalmente.

## Frente 2 — Atualização Inteligente 1-clique

### Endpoints

- `POST /api/flows/:id/refresh-preview` — roda o gerador existente com a **estrutura travada**: nós e edges imutáveis; apenas conteúdo textual (textos de mensagem, prompt do nó-IA, tags) regenerado a partir do treinamento atual da organização. Retorna diff campo a campo: `[{ nodeId, field, before, after }]`. Nada é persistido.
- `POST /api/flows/:id/refresh-apply` — recebe o conteúdo proposto (eco do preview), cria snapshot `FlowVersion` (source `refresh`) ANTES de aplicar, grava o novo conteúdo e limpa o flag de desatualizado.

### Regras

- Falha de LLM no preview → erro limpo (HTTP 502 com mensagem), fluxo intacto. O refresher nunca aplica nada sozinho.
- Treinamento vazio/insuficiente → HTTP 422 orientando o cliente a preencher o Treinar IA.
- Validação de integridade no apply: o conjunto de `nodeId`s do payload deve ser idêntico ao do fluxo atual (estrutura travada de verdade, não só por convenção).

### UI (`/flows`)

Badge "desatualizado" existente ganha botão "Ver atualização" → modal com diff antes/depois por nó → botão "Aplicar atualização". Estados de loading e erro explícitos.

## Frente 3 — Múltiplos fluxos ativos + jornada

### Roteamento

- Remove a trava "máximo 1 ativo por organização" no endpoint de publish.
- Novo `flowRouter` (função pura, em `apps/api/src/agents/`):
  1. Conversa já no meio de um fluxo → continua nele (prioridade absoluta).
  2. Senão, ranqueia os fluxos ativos por especificidade do gatilho: keyword com match exato > keyword fuzzy > evento (`EVENT`, `CART_ABANDONED`...) > `FIRST_CONTACT` (apenas conversas novas).
  3. Desempate: campo novo `Flow.priority` (int, default 0, maior vence); persiste empate → fluxo mais recentemente publicado.
  4. Nenhum match → comportamento atual (conversa segue com a Iza sem fluxo).
- Resultado determinístico; testável sem mock.

### Handoff (`goto_flow`)

- Novo tipo de nó `goto_flow` no motor: efeito que transfere a conversa para o nó `start` de outro fluxo da mesma organização, carregando as variáveis (`FlowState.vars`).
- Materializa os handoffs que `generateJourney` já desenha mas não executa.
- Proteção anti-loop: máximo **5 handoffs por mensagem recebida**; excedeu → log de aviso e a conversa segue no fluxo atual.
- Handoff para fluxo inativo/deletado → segue o ramo de fallback do nó (edge `else`/default); sem edge de fallback → conversa continua no fluxo atual com log.

### UI

Editor React Flow ganha o nó "Enviar para outro fluxo" (família âmbar, mesma do transbordo humano), com seletor de fluxo destino.

## Frente 4 — Versionamento e rollback

### Modelo

`FlowVersion` (nova tabela): `id`, `organizationId`, `flowId`, `version` (int sequencial por fluxo), `name`, `nodes`, `edges`, `triggerType`, `triggerConfig`, `source` (`publish | refresh | restore`), `createdById` (nullable para ações de sistema), `createdAt`. Imutável — nunca é editada nem deletada (exceto cascata LGPD da organização).

### Mecânica

- Snapshot criado a cada **publicação**, **refresh-apply** e **restore**.
- `POST /api/flows/:id/restore/:versionId` — restaura o conteúdo da versão escolhida como **nova versão** (source `restore`); histórico nunca reescreve. Mesmo padrão do audit trail `AgentEvalFixDecision`.
- Incremento de `version` em transação (atomicidade contra publicações simultâneas).
- Timers pendentes referenciam `flowVersion`; restore/publish invalida timers de versões anteriores (regra da Frente 1, item 4).

### UI

Aba "Histórico" no editor: lista de versões (data, origem, autor), preview e "Restaurar esta versão" com confirmação.

## Banco de dados (migrations Prisma)

1. `FlowTimer` — nova; índices em (`status`, `runAt`) e (`organizationId`, `conversationId`).
2. `FlowVersion` — nova; índice único em (`flowId`, `version`).
3. `Flow.priority Int @default(0)` — alteração aditiva.

Sem mudança destrutiva; zero risco para dados existentes. RLS em todas.

## Erros e casos-limite (consolidado)

| Caso | Comportamento |
|---|---|
| Timer dispara para fluxo deletado/despublicado/nova versão | no-op, status `cancelled`, log |
| Estado Redis perdido durante espera | reidrata do `stateSnapshot` do `FlowTimer` |
| Fora da janela de 24h da Meta no disparo | não envia; status `expired`, log |
| Publicações simultâneas | transação com incremento atômico de versão |
| Handoff para fluxo inativo | ramo de fallback; sem fallback → continua no atual |
| Loop de handoffs | corte em 5 por mensagem, log de aviso |
| LLM falha no refresh-preview | HTTP 502, nada persistido |
| Treinamento insuficiente no refresh | HTTP 422 com orientação |
| Payload de refresh-apply com estrutura divergente | HTTP 409, nada aplicado |

## Estratégia de testes (TDD em tudo)

- **Motor** (`flowEngine`): novos efeitos `schedule_resume` e `goto_flow` — testes puros, sem mock.
- **Router** (`flowRouter`): matriz de casos de ranqueamento/desempate — testes puros.
- **Scheduler**: worker com relógio fake; casos de validação (cancelado, expirado, takeover, resposta antecipada).
- **Refresher**: LLM mockado; golden tests de diff; validação de estrutura travada.
- **Versionamento**: round-trip publicar → editar → restaurar; atomicidade.
- **Integração**: ciclo completo publicar → conversar → esperar → timer dispara → retoma.

## Rollout

Feature flag por organização (padrão existente no `flowRuntime`), nesta ordem: org interna de testes → primeiros clientes Founders → geral. As 4 frentes são entregáveis de forma independente; ordem de implementação sugerida: Frente 4 (versionamento, base para as demais) → Frente 3 (router/multi-ativo) → Frente 1 (timing) → Frente 2 (refresh).

## Fora de escopo (explícito)

- Envio de template aprovado da Meta fora da janela de 24h.
- A/B testing de fluxos e analytics por nó.
- Evolução da Qualidade da IA (spec própria, próximo ciclo).
- Mudanças no gerador (`flowGenerator`) além do modo "estrutura travada".
