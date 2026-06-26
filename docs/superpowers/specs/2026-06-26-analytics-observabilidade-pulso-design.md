# Camada de Observabilidade do Analytics — "Pulso"

**Data:** 2026-06-26
**Autor:** Rodrigo Ghetti + Claude
**Status:** Aprovado (design) — em implementação

## Contexto e problema

A rota `/analytics` da plataforma ZappIQ existe mas entrega quase nada: hoje mostra 4 KPIs
(mensagens, taxa de automação, novos contatos, CSAT), um gráfico de volume e um de sentimento —
com dados de fallback hardcoded. O banco, porém, já captura **muito** mais do que a tela expõe:
`LLMCallLog` (custo/tokens/latência/fallback), `AgentEvalRun` (qualidade), `FlowNodeStat`
(drop-off de fluxo pré-agregado), `TenantUsageMonthly` (receita, margem, % resolvido por IA vs.
humano, handoffs), `Conversation` (sentimento, urgência, CSAT, resumo, status), e o CRM completo
(`Deal`, `PipelineStage`, `Activity`, `Contact` com leadScore/leadStatus/funnelStage).

Ou seja: a matéria-prima para uma camada de observabilidade de alto nível **já existe** —
está subaproveitada. Boa parte do trabalho é visualização + inteligência, não captura nova.

## Objetivo

Transformar `/analytics` numa **camada de observabilidade em camadas** coroada por uma camada de
**inteligência ("Pulso")**: a própria IA da ZappIQ lê os números, detecta anomalias, explica a
causa-raiz em português e recomenda ação. Motor único; duas superfícies (cliente primeiro, interno
depois).

> **Nota de marca:** o nome da camada de inteligência é **"Pulso"** — NÃO usar "Iza" nem o nome de
> qualquer agente, porque "Iza" é a agente da ZappIQ e cada cliente pode renomear a própria agente.
> "Pulso" comunica sinais vitais da operação e é neutro.

## Decisões tomadas no brainstorming

1. **Formato:** painel em camadas para todos os públicos — Resultado (ROI) → Operação → Funil.
2. **Inteligência:** a tela interpreta e age, não só mostra números — narra + alerta + recomenda.
3. **Públicos:** duas visões sobre o mesmo motor — Superfície A (cliente) e Superfície B (interno MACHIA).
4. **Motor "Pulso":** cron diário + regras determinísticas; a LLM **só redige** a narrativa sobre
   fatos já detectados (nunca inventa número); fallback determinístico se a LLM cair.

## Arquitetura

Três blocos + duas superfícies:

1. **Camada de métricas** — serviço que agrega do Postgres (expande `apps/api/src/routes/analytics.ts`),
   cacheia no Redis (já há cache de 300s por org/período), e expõe via API.
2. **Motor Pulso** — cron noturno (mesmo padrão do cron de eval das 04:30 UTC):
   - (a) tira snapshot diário de métricas por org → `analytics_metric_daily`;
   - (b) detector de anomalias **determinístico** (z-score / limiar / comparação por janela
     dia-da-semana × hora);
   - (c) a LLM **só redige** a narrativa sobre os fatos detectados (JSON via tool-call,
     proibido número fora dos fatos, payload pseudonimizado sem PII de contato);
   - (d) persiste em `analytics_insights`.
   - Drill "explicar" = agente ao vivo no chat (deep-link). Fallback determinístico se a LLM
     indisponível (reusa o padrão de resiliência do roteador de LLM).
3. **Superfícies** — A (cliente, `/analytics` em camadas) e B (interno, fleet/admin), consumindo
   a mesma API.

## Modelo de dados (novo)

### `analytics_metric_daily` (pré-agregação)
Snapshot diário por org. Serve trend rápido e baseline de detecção de anomalia.
- `id`, `organizationId`, `date` (YYYY-MM-DD, UTC)
- métricas: `messagesIn`, `messagesOut`, `botMessages`, `automationRate`, `newContacts`,
  `openConversations`, `closedConversations`, `aiResolved`, `humanResolved`, `handoffs`,
  `avgFirstResponseMs`, `p95FirstResponseMs`, `csatAvg`, `csatCount`,
  `sentimentPos`, `sentimentNeu`, `sentimentNeg`, `qualifiedLeads`,
  `llmCostUsd`, `llmCalls`, `llmFallbacks`
- `computedAt`, `updatedAt`
- unique `(organizationId, date)`

### `analytics_insights` (saída do Pulso)
- `id`, `organizationId`, `period` (ex.: "7d" / "2026-06-26")
- `kind` (ex.: `sla_spike`, `csat_drop`, `flow_dropoff`, `roi_summary`, `volume_anomaly`)
- `severity` (`info` | `attention` | `critical`)
- `title` (curto), `narrative` (texto pt-BR)
- `facts` (jsonb — os fatos/anomalias determinísticos que embasaram a narrativa)
- `recommendedActions` (jsonb — lista `{ label, prompt }` para deep-link no chat)
- `source` (`rule` | `llm`)
- `createdAt`
- index `(organizationId, createdAt)`

### Instrumentação dos gaps (Fase 3)
- `Conversation.outcome` (enum: `resolved` | `abandoned` | `escalated` | `timeout`).
- Elo **venda↔conversa**: `Deal` já tem `sourceAgentId`/`sourceCampaignId`; adicionar
  `Deal.sourceConversationId` (nullable) para atribuir "vendas geradas pela IA".
- p95 por janela: query sobre dado cru existente (sem nova coluna), materializado no
  `analytics_metric_daily`.

## Superfície A (cliente) — camadas e origem do dado

| Camada | Métrica | Origem | Status |
|---|---|---|---|
| **Resultado** | Vendas atribuídas à IA | `Deal` + `sourceConversationId` | instrumentar (Fase 3) |
| | % atendido pela IA | `TenantUsageMonthly` / `Message.isFromBot` | pronto |
| | Horas economizadas | derivado (atendimentos IA × tempo médio) | derivado |
| | Leads qualificados | `Contact.leadStatus` | pronto |
| **Operação** | Volume (recebidas vs. IA) | `Message` | pronto |
| | 1ª resposta mediana + p95 | query sobre `Message` | query nova |
| | CSAT | `Conversation.csatScore` | pronto |
| | Sentimento | `Conversation.sentiment` | pronto |
| **Funil/Maestro** | Drop-off por nó | `FlowNodeStat` (entries/ends) | pronto |

O card **Pulso** fica no topo: narrativa + anomalia destacada + 1–2 ações que disparam o agente
no chat para aprofundar.

## Detecção de anomalias (determinística)

- Baseline: média móvel + desvio por métrica/janela a partir de `analytics_metric_daily`.
- Flag quando `z-score > limiar` OU `variação% vs. período anterior > limiar`.
- Segmentação por dia-da-semana × faixa de hora (é o que identifica padrões tipo "tardes de sexta").
- `severity` governa destaque visual e se vira alerta.

## Guardrails da IA (Pulso)

- A LLM recebe **só fatos já computados**, **pseudonimizados** (sem nome/telefone/email de contato
  — regra LGPD já aplicada no Radar).
- `tool_choice` forçado → JSON garantido `{ title, narrative, actions[] }`.
- Proibido inventar números: prompt instrui a usar exclusivamente os valores em `facts`.
- Custo-alvo ~US$0,05–0,15/org/dia com batch + prompt caching.
- Resiliência: se a LLM falhar (lembrar do incidente de billing de 14–15/06), renderiza narrativa
  por template determinístico a partir dos mesmos `facts`, com `source = 'rule'`.

## API

- Expandir `GET /api/analytics/overview`.
- Novos: `GET /api/analytics/timeseries`, `GET /api/analytics/funnel`,
  `GET /api/analytics/insights` (lê `analytics_insights`).
- Drill: deep-link para o chat do agente (sem novo endpoint pesado de LLM síncrono no pageview).
- Tudo isolado por `organizationId` (RLS / filtro de tenant já existente).

## Superfície B (interno MACHIA) — fast-follow

Fleet por tenant, protegida por RBAC interno (SUPERADMIN):
- Margem por tenant (`TenantUsageMonthly`).
- Custo / latência / fallback de LLM (`LLMCallLog`).
- Qualidade do agente (`AgentEvalRun.scorePercent`).
- Saúde / handoffs / anomalias por tenant.
Mesmo motor, mesma API com escopo ampliado.

## Faseamento

- **Fase 1 — Dashboard em camadas (Superfície A) com o que já existe.** Substitui a tela atual
  atrás de um feature flag. Métricas prontas: volume, automação, CSAT, sentimento, tempo de
  resposta, drop-off, resolvido-por-IA, leads qualificados. **Entregável e verificável agora;
  deploy primeiro em preview da Vercel, promoção à produção só após aprovação visual.**
- **Fase 2 — Motor Pulso.** `analytics_metric_daily` + cron + detecção de anomalias + narrativa
  LLM + fallback. Card Pulso no topo da Superfície A.
- **Fase 3 — Instrumentação de ROI.** `Conversation.outcome`, `Deal.sourceConversationId`,
  p95 por janela → KPIs de Resultado completos.
- **Fase 4 — Superfície B interna.**

## Riscos e mitigação

| Risco | Mitigação |
|---|---|
| Custo de LLM multi-tenant | Cron diário + cache + batch + prompt caching + fallback determinístico |
| Alucinação de números | A IA só narra fatos pré-computados; prompt proíbe número fora de `facts` |
| LGPD | Pseudonimizar o payload enviado à LLM (sem PII de contato) |
| Performance de agregação | Pré-agregação diária (`analytics_metric_daily`) + cache Redis |
| Quebrar a tela atual em produção | Feature flag; deploy em preview antes de promover; substituição incremental |
| Armadilhas de deploy prod (memória) | Migration condicional ao `app_user`; deploy git da Vercel via `main`; `fly deploy` roda `prisma migrate deploy` no release |

## Critérios de aceite (Fase 1)

1. `/analytics` renderiza as três camadas com dados reais da org logada (sem fallback hardcoded).
2. Período selecionável (Hoje / 7d / 30d) altera todos os números.
3. Isolamento por tenant verificado (org A não vê dado de org B).
4. Build do `apps/web` e do `apps/api` passam; testes existentes verdes.
5. Deploy em preview da Vercel acessível e funcional, validado com evidência (screenshot/network).
