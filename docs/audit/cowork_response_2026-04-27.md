# Cowork Audit Response — 2026-04-27

**Contexto**: Levantamento honesto e exato do estado real do monorepo ZappIQ pra consolidação do Plano Técnico-Estratégico Iza V2.0.
**Quem respondeu**: Claude (via Cowork), com leitura direta do repo no estado de `main @ 25b133a`.
**Convenções**:
- "Implementado" = código presente e referenciado no caminho de produção.
- "Parcial" = stub, TODO ou implementação que coexiste com versão antiga divergente.
- "Não implementado" = ausente.
- "Não tenho visibilidade" = Cowork não conseguiu ler/inferir; precisa de input humano ou inspeção fora do repo.

---

## Descobertas críticas (TL;DR antes dos blocos)

1. **`services/rag/`** (FastAPI Python) é um **3º app deployado**, não documentado no overview V5.3 anterior. RAG roda em Python, não em Node.
2. **Duas implementações de LLM client coexistem**: `langchainClient.ts` (Anthropic SDK puro, **sem fallback**, usado pelo orchestrator) e `LLMRouter.ts` (HTTP direto, **com circuit breaker**, **órfão** — não chamado em produção).
3. **Modelo primário diverge**: env `ANTHROPIC_MODEL=claude-sonnet-4-6` (caminho real); LLMRouter hardcoda `claude-opus-4-6` (caminho órfão). Hoje quem responde no WhatsApp é Sonnet, não Opus.
4. **Áudio (STT/TTS)** está vendido em `planConfig` mas **não implementado** — só placeholders.
5. **Webhook WhatsApp processa IA inline** (fire-and-forget no event loop), sem fila, sem backpressure. BullMQ existe pra envio de mensagens e campanhas, não pra inferência LLM.
6. **RLS Postgres + pgbouncer transaction-mode**: `SET LOCAL` é frágil em conexões pooladas. Deve estar funcionando hoje por sorte/uso restrito; risco real em queries fora de `prisma.$transaction`.
7. **Sem Langfuse/LangSmith/Helicone, sem prompt caching, sem tool use, sem streaming.** Resposta estruturada vem de XML tags parseadas com regex.
8. **Sentry é implementação custom HTTP**, não SDK oficial — apenas error tracking, sem APM/Replay/Releases.
9. **PII redaction parcial**: sem regex de CPF/CNPJ. PII pode vazar pra OTel/Sentry/audit_logs.
10. **Cliente NÃO escolhe modelo, sem BYOK, sem diferenciador de modelo por tier.**

---

## Bloco 1 — Estrutura geral do monorepo

### 1.1 Árvore real

```
zappiq/
├── apps/
│   ├── api/          # Backend Express + BullMQ (Fly.io)
│   │   ├── src/
│   │   ├── package.json
│   │   ├── Dockerfile
│   │   └── .env.example
│   └── web/          # Next.js 14 App Router (Vercel)
│       ├── app/      # 32+ rotas
│       ├── components/
│       ├── lib/
│       ├── public/
│       ├── stores/
│       ├── content/
│       └── vercel.json
├── packages/
│   ├── ui/           # Design system (em construção)
│   ├── database/     # Prisma + migrations
│   └── shared/       # Types/Zod, planConfig
└── services/
    └── rag/          # FastAPI Python (Fly.io separado)
        ├── main.py
        ├── requirements.txt
        └── fly.toml
```

### 1.2 Versões

- **Node**: `20` (apenas em CI workflows; sem `.nvmrc`/`engines`/`volta`).
- **pnpm**: `9.15.0` (`packageManager` no package.json raiz).
- **Turborepo**: `^2.4.0`.

### 1.3 Branches e pipeline

- Branch produção: **`main`** (única; sem `develop`/`staging`).
- Pipeline:
  - **GitHub Actions** (`.github/workflows/ci.yml` + `fly-deploy.yml`): lint, type-check, build, deploy api/rag em Fly, Prisma migrate.
  - **Vercel** (apps/web): integração nativa, sem workflow GH.
- Deploy automático em push em `main`.

### 1.4 Dependências de IA/LLM

| Dep | Versão | Workspace |
|---|---|---|
| `@anthropic-ai/sdk` | `^0.39.0` | `apps/api` |
| `voyageai` | `0.3.0` | `services/rag` (Python) |
| `openai` | `1.51.0` | `services/rag` (Python — fallback) |
| `@opentelemetry/api` | `^1.9.0` | `apps/api` |
| `@opentelemetry/sdk-node` | `^0.55.0` | `apps/api` |
| `@opentelemetry/exporter-trace-otlp-http` | `^0.55.0` | `apps/api` |

**Não existem**: langchain, @langchain/*, @mastra/*, ai (Vercel SDK), @ai-sdk/*, cohere-ai, @huggingface/*, groq-sdk, replicate, elevenlabs, @deepgram/sdk, @google/generative-ai, openai (no Node — é via fetch).

### 1.5 `.env.example` (ofuscado)

Ver `.env.example` no repo. Cobre: NODE_ENV, DATABASE_URL/DIRECT_URL (Supabase pooler 6543 + direct 5432), REDIS_URL, JWT_SECRET, ANTHROPIC_API_KEY/MODEL, OPENAI_API_KEY, VOYAGE_API_KEY + EMBEDDING_*, WhatsApp Meta API, Google Calendar, Stripe, Frontend URLs, RAG_SERVICE_*, BullMQ concurrency, OTel/Grafana, BLOCKED_ORG_IDS, MAINTENANCE_MODE, BACKUP_S3, DPO_EMAIL, LAUNCH_MODE V5.3.

---

## Bloco 2 — Anthropic (Claude)

### 2.1 Imports
- `apps/api/src/services/llm/langchainClient.ts`
- `apps/api/package.json`

### 2.2 Instanciação
`apps/api/src/services/llm/langchainClient.ts:1-14`:
```typescript
import Anthropic from '@anthropic-ai/sdk';
const anthropic = new Anthropic({
  apiKey: env.ANTHROPIC_API_KEY || '',
  maxRetries: 3,
  timeout: 60_000,
});
```

### 2.3 Models referenciados
| Model | Arquivo | Linha | Uso |
|---|---|---|---|
| `claude-sonnet-4-6` | `apps/api/src/config/env.ts` | 33 | Default `ANTHROPIC_MODEL` |
| `claude-haiku-4-5-20251001` | `langchainClient.ts` | 56 | `classify()` (Haiku) |
| `claude-opus-4-6` | `LLMRouter.ts` | 215 | Primário do router órfão |
| `claude-haiku-4-5-20251001` | `LLMRouter.ts` | 216 | Fallback 1 do router órfão |

### 2.4 Streaming
**Não usado.** Tudo síncrono.

### 2.5 Prompt caching
**Não usado.** Sem `cache_control`.

### 2.6 Tool use
**Não usado.** Resposta estruturada via XML tags `<reply>`, `<action>`, `<action_data>`, `<buttons>` parseadas no `agentOrchestrator.ts:178-198`.

### 2.7 MCP
**Não tenho visibilidade** de servidor MCP customizado.

### 2.8 Env vars Anthropic
Apenas `ANTHROPIC_API_KEY` e `ANTHROPIC_MODEL`. Sem Bedrock/Vertex.

### 2.9 Retry/circuit breaker
- **Retry**: SDK nativo (`maxRetries: 3`).
- **Circuit breaker**: existe em `LLMRouter.ts:57-109` (3 falhas/60s → abre 120s) mas **não no caminho de produção**.

### 2.10 Tokens/custo
Tokens **retornados** mas **não persistidos** em audit_log nem tabela usage. Faturamento por consumo não auditável.

---

## Bloco 3 — OpenAI

### 3.1 Imports no Node
**Nenhum.** Chamada via `fetch` direto em `LLMRouter.ts:155-196`.

### 3.2 Instanciação
**Sem client.** Usa `fetch('https://api.openai.com/v1/chat/completions')` com Bearer token via `process.env.OPENAI_API_KEY`.

### 3.3 Models
- `gpt-4o-mini` em `LLMRouter.ts:217` (único, fallback 3).

### 3.4 Uso
Apenas chat completion fallback. RAG Python usa OpenAI como fallback de embeddings; Whisper como TODO.

### 3.5 API
Chat Completions. Sem Assistants/Responses/Embeddings/Whisper (no Node).

### 3.6 Function calling
**Não implementado.**

### 3.7 Env vars
Apenas `OPENAI_API_KEY`. Sem ORG_ID/PROJECT_ID/BASE_URL.

### 3.8 Retry/breaker
Mesmo do `LLMRouter`.

### 3.9 Features exclusivas
**Nenhuma.**

---

## Bloco 4 — Roteamento entre providers (CRÍTICO)

### 4.1 Camada de abstração
**Dual e desconectada**:
- `langchainClient.ts` — caminho REAL de produção (orchestrator usa). Sem fallback.
- `LLMRouter.ts` — multi-provider com breaker, **órfão** (não importado pelo orchestrator).

### 4.2 Função de decisão (LLMRouter — não-produção)
`LLMRouter.ts:210-256`: cascata fixa Opus → Haiku → GPT-4o-mini com breaker.

### 4.3 Critérios (LLMRouter)
- [x] Sequência fixa
- [x] Fallback automático em erro
- [x] Override `forceProvider`
- [ ] Tipo de tarefa, contexto, custo, latência, feature flag, plano, A/B test

### 4.4 Lib externa
**Nenhuma**. Caseiro em TS puro.

### 4.5 "Falhou"
Timeout, 5xx, 429. 4xx do cliente devolve sem contar pro breaker.

### 4.6 Histórico em fallback
Re-enviado do zero. Tradução Anthropic ↔ OpenAI trivial (mesmo formato `{role, content}`).

### 4.7 Tools
Sem tools, sem tradução.

### 4.8 Provider primário
- **Real (produção)**: Sonnet 4.6 via `langchainClient`.
- **Documentado (LLMRouter)**: Opus 4.6.

### 4.9 Por que dois providers
LLMRouter tem header explicando "redundância operacional + qualidade máxima + independência de vendor", mas **não em uso**.

### 4.10 Documentação interna
Header de `LLMRouter.ts:1-24`, CHANGELOG, MORNING_CHECKLIST. **Sem ADR formal**.

---

## Bloco 5 — Embeddings (RAG)

### 5.1 Modelo
**Voyage `voyage-3`** primário (1024 dims), OpenAI fallback. Configurado via `EMBEDDING_PROVIDER`/`EMBEDDING_MODEL`/`EMBEDDING_DIM` no `.env.example`.

### 5.2 Caminho da chamada (Node)
`apps/api/src/services/ragService.ts:24-28`:
```typescript
const { data } = await ragClient.post('/search', {
  tenant_id: organizationId,
  query,
  top_k: topK,
});
```
Geração do embedding em si: serviço Python `services/rag/main.py` (não inspecionado em detalhe).

### 5.3 Dimensão (CONFLITO)
- `KBChunk` (Prisma): `vector(1536)` — `schema.prisma:416`
- `rag_chunks` (SQL puro): `vector(1024)` — `rag_pgvector.sql`

Schema Prisma e SQL real divergem. Provável `KBChunk` legacy.

### 5.4 Mistura de embeddings
Sem mistura na mesma coluna. Mas dois schemas separados podem causar inconsistência se alguém escrever no errado.

### 5.5 Reranker
**Sem visibilidade** de reranker no Node. Não inspecionei `services/rag/main.py`.

### 5.6 Hybrid search
**Sem visibilidade.** Sem `tsvector`/`ts_rank` no Node. Provavelmente só dense.

### 5.7 Contextual Retrieval
**Não implementado.** Concatenação simples no orchestrator.

---

## Bloco 6 — Whisper / STT

### 6.1 Processamento de áudio
Captura sim, processamento não. Webhook extrai `media_id` do áudio, orchestrator responde placeholder: `'Recebi seu áudio! 🎙️ Para agilizar...'`.

### 6.2 Provider STT
Não escolhido. TODO em `apps/api/src/services/queueService.ts:305-312` aponta OpenAI Whisper.

### 6.3 Download de mídia Meta
**Não implementado.** Apenas `media_id` capturado.

### 6.4 ffmpeg
Sem dep no `package.json`. Sem visibilidade do Dockerfile.

### 6.5 Por que não funciona
Adiamento intencional. Stub explícito + spec na task list (T9.A) mas código não escrito. Vendido em `planConfig` (R$197/mês `VOICE_INBOUND`).

---

## Bloco 7 — TTS

### 7.1 Código
**Não implementado.** Sem deps elevenlabs/openai-audio/azure/google-tts.

### 7.2 Add-on Voz Premium
**Apenas comercial**. `packages/shared/src/planConfig.ts:445-463` define `VOICE_INBOUND R$197` e `VOICE_OUTBOUND R$497` mencionando "OpenAI ou ElevenLabs", mas backend vazio.

### 7.3 Envio ao WhatsApp
Não implementado. Padrão esperado seria Media Upload Meta → `media_id` → send.

---

## Bloco 8 — Orquestração de agente

### 8.1 LLM client
`apps/api/src/services/llm/langchainClient.ts` (76 linhas). Singleton Anthropic + funções `chatCompletion()` (Sonnet via env), `classify()` (Haiku 4.5 hardcoded), `analyzeSentiment()`. **Nome do arquivo é histórico — não importa langchain.**

### 8.2 Orchestrator
`apps/api/src/agents/agentOrchestrator.ts` (295 linhas). 13 steps em `processIncomingMessage()`:
1. Mark as read
2. Check Redis pause (`ai_paused:{orgId}:{phone}`)
3. Handle non-text (placeholder)
4. Load history (últimas 20 messages)
5. Classify intent (Haiku + cache 300s)
6. Detectar `request_human` → handoff
7. RAG search
8. Build system prompt
9. Mount messages array
10. Call LLM (`chatCompletion`)
11. Parse XML tags
12. Execute actions (`schedule | handoff | save_lead`)
13. Send WhatsApp + persist outbound Message

### 8.3 Memória conversacional
Raw 20 turnos do Postgres a cada call. Sem summary buffer, sem vector memory. **Cresce linear → custo Anthropic infla em conversas longas.**

### 8.4 Handoff humano
`agentOrchestrator.ts:32-38` (check) e `:250-281` (handler). Redis `SET ai_paused:{orgId}:{phone} '1' EX 3600`. Conversation status → WAITING. Socket.io notification.

### 8.5 Tools registry
**Não existe.** Inline em switch no `executeAction()`.

### 8.6 Intent classification
ANTES da chamada principal. Haiku 4.5 + cache Redis 300s. 9 enums fechados.

---

## Bloco 9 — Frontend e API de leads

### 9.1 `/api/leads`
`apps/web/app/api/leads/route.ts`. POST validate → Supabase REST insert → Resend notify. Rate limit in-memory 5/min/IP.

### 9.2 LAUNCH_MODE
`apps/web/app/page.tsx:31` com `export const dynamic = 'force-dynamic'` (PR #51 hotfix). Lê `process.env.LAUNCH_MODE` em request-time.

### 9.3 Chat widget
**Não há chat real no /home.** Só `IzaChatStream.tsx` na pré-launch — mockup client-only com script hardcoded.

### 9.4 Server Actions
**Nenhuma `'use server'`** em apps/web/app. Tudo REST.

---

## Bloco 10 — Banco, RLS, multi-tenant

### 10.1 RLS
18 tabelas com RLS ativa. Migration `20260417_rls_multi_tenant/migration.sql`. Policies via `current_setting('app.current_organization_id')` (direto ou via JOIN).

### 10.2 `current_setting` por conexão
Middleware `apps/api/src/middleware/rlsTenant.ts` faz `SET LOCAL app.current_organization_id = '<orgId>'`. **CRÍTICO**: DATABASE_URL usa `?pgbouncer=true&port=6543` (transaction-mode pooler). `SET LOCAL` só vale na transação corrente. Handlers fora de `prisma.$transaction` podem perder a config → RLS bloqueia tudo. Recomendação forte: encapsular handlers RLS-dependentes em `prisma.$transaction`.

### 10.3 Tabelas core
Existem todas. Schema Prisma `packages/database/prisma/schema.prisma` (~573 linhas). Modelos principais: Organization, User, Contact, Conversation, Message, KnowledgeBase, KBDocument, KBChunk, AuditLog, DataSubjectRequest, MessageTemplate, Campaign, Flow, Deal, etc. **Sem modelo `Agent`** — overview anterior mencionou erradamente.

### 10.4 pgvector
Instalado via `CREATE EXTENSION IF NOT EXISTS vector` (versão Supabase default, ≥ 0.5). Índice **HNSW cosine** com `m=16`, `ef_construction=64` em `rag_chunks.embedding`.

### 10.5 `early_access_leads`
Schema em SQL puro fora do Prisma. Campos: `id`, `email` (unique), `name`, `company`, `volume`, `source`, `ip`, `user_agent`, `created_at`. Índices em `created_at DESC` e `source`. RLS ON com service_role bypass.

---

## Bloco 11 — Webhook Meta WhatsApp

### 11.1 Handler
`apps/api/src/routes/webhook.ts` (~200 linhas). GET pra verification handshake; POST pra mensagens.

### 11.2 HMAC SHA-256
`webhook.ts:13-32`. Usa `crypto.createHmac('sha256', appSecret)` + `crypto.timingSafeEqual` (constant-time). Secret: `META_APP_SECRET` (com fallback warn pra `WHATSAPP_ACCESS_TOKEN`).

### 11.3 Lookup org
`prisma.organization.findFirst({ where: { whatsappPhoneNumberId: phoneNumberId } })`. Sem cache.

### 11.4 200 imediato
Sim, antes do processamento.

### 11.5 Fila
**Não usa fila pra IA.** Inline fire-and-forget:
```typescript
processIncomingMessage({...}).catch((err) => logger.error(...));
```
BullMQ existe (`queueService.ts`, ~414 linhas) com queues `message-send`, `campaign-dispatch`, `ai-process` (placeholder), `audio-transcription` (placeholder), `sentiment-analysis` (placeholder). **Inferência LLM não passa por fila.**

---

## Bloco 12 — Observabilidade

### 12.1 Tracing/observability LLM
- **OpenTelemetry**: instrumentado, exporta pra Grafana Cloud (OTLP HTTP).
- **LLM-specific (Langfuse, LangSmith, Helicone)**: nada.

### 12.2 Logs estruturados
Winston + OTel transport. `apps/api/src/utils/logger.ts`. Dev: console colorizado. Prod: JSON com `traceId`/`spanId`.

### 12.3 Correlation ID
Via OpenTelemetry nativo (trace_id). Sem middleware explícito de `x-request-id`.

### 12.4 Sentry
**Custom HTTP, não SDK**. Backend `apps/api/src/config/sentry.ts`, frontend `apps/web/lib/sentry.ts`. Funções: `captureException()`, `captureMessage()`. Skip em dev. **Sem performance monitoring, sem replay, sem release tracking.**

### 12.5 Métricas custom
OTLP exporter ativo, **sem instrumentação custom de cost/tokens/p95 LLM**. Métricas devem ser derivadas em Grafana — se LLM call não estiver em span, não aparece.

---

## Bloco 13 — Segurança e LGPD

### 13.1 PII redactor
**Parcial**. `auditService.ts:96-100+` `sanitizeSnapshot()` remove `password`, `passwordHash`, etc. **Sem regex CPF/CNPJ/cartão** pra logs.

### 13.2 Lakera Guard / prompt injection defense
**Ausente.**

### 13.3 audit_logs
Schema robusto (tamper-evident hash chain). Eventos gravados: `conversation.delete`, `audit_log.list`, demais via `logAuditEvent()`. **Cobertura provavelmente incompleta** — preciso varredura adicional.

### 13.4 `/api/dsr/request`
Implementado em `apps/web/app/api/dsr/request/route.ts`. Tipos: EXCLUSAO, ACESSO, CORRECAO, ANONIMIZACAO, PORTABILIDADE, REVOGACAO_CONSENTIMENTO. Tabela `dsr_requests` no Supabase. SLA 15 dias manual.

### 13.5 Rate limiting
`express-rate-limit@7.5.0`:
- Global `/api/*`: 500 req / 15 min
- `/api/auth`: 10 req / 15 min
- `/api/leads` (Next.js, custom in-memory): 5 req / 1 min

### 13.6 CSP/CORS
- CORS: single origin = `env.NEXT_PUBLIC_APP_URL`, credentials true.
- **CSP: não configurado** (Helmet sem policy custom).

---

## Bloco 14 — Cliente final escolhe modelo?

### 14.1 UI dashboard
**Não existe.**

### 14.2 Schema
**Sem campos** de modelo em `Organization` ou alhures. **Sem modelo `Agent`** no schema.

### 14.3 Diferenciador comercial
**Não.** `planConfig` diferencia por agents/messages/contacts/features, não por modelo.

### 14.4 BYOK
**Não suportado.**

---

## Bloco 15 — Roadmap e blockers

### 15.1 Top 5 blockers técnicos pra 04/05/2026

1. **`langchainClient` vs `LLMRouter`**: caminho real sem fallback. Outage Anthropic = falha silenciosa em massa.
2. **RLS + pgbouncer transaction-mode**: `SET LOCAL` frágil. Auditar todos os handlers RLS-dependentes.
3. **Webhook inline**: sem fila → sem backpressure. Mover pra BullMQ `ai-process`.
4. **Conflito `KBChunk` (1536) vs `rag_chunks` (1024)**: definir canônico, remover legacy.
5. **PII em logs**: sem regex CPF/CNPJ → vazamento OTel/Sentry/audit.

### 15.2 Branches não-mergeadas relevantes
- `feat/p1-audit-log` — provável complemento auditoria
- `feat/p5-observability` — provável Langfuse/Helicone
- `feat/p8-ci` — melhoria pipeline
- `fix/iza-webhook-signature` (provável já merged em `836b4f8`)
- Várias `p0/*` históricas

Sem inspeção de diff (não autorizado).

### 15.3 Dívida técnica não no overview V5.3
- `services/rag/` (3º app) não documentado
- `langchainClient` vs `LLMRouter` duplicação
- `KBChunk` vs `rag_chunks` divergência
- `early_access_leads` fora do Prisma
- Sentry custom HTTP, não SDK
- Sem tools/function calling — XML tags no prompt
- Memória raw 20 turnos sem compressão
- Sem cost-per-tenant tracking

### 15.4 Arquivos frágeis
- `agentOrchestrator.ts` — monolítico procedural com early returns
- `rlsTenant.ts` — confia em propagação de transação
- `webhook.ts` — fire-and-forget sem retry estruturado
- `LLMRouter.ts` — código sofisticado órfão
- `schema.prisma` — 573 linhas, campos hibernando

### 15.5 Decisões não documentadas
**Nada autoral**. Toda arquitetura pré-existe. Cowork tocou apenas em landing/copy/scripts (V5/V5.1/V5.2/V5.3 + hotfixes).

---

## Bloco 16 — Confirmação final

### 16.1 Últimos 20 commits no main
```
25b133a chore(prelaunch): harmoniza co-branding onze.[ai] (#55)
9a9d548 chore(prelaunch): atualizar logo onze.[ai] (#54)
15649f2 chore(prelaunch): atualizar logo onze.[ai] (#53)
2a3084a chore(prelaunch): swap logo onze&onze.ai → onze.[ai] (#52)
45258d6 fix(landing): força dynamic rendering / pra LAUNCH_MODE (#51)
eb3a04c feat(landing): V5.3 página de pré-lançamento (#50)
34eb013 chore(api): ANTHROPIC_MODEL → claude-sonnet-4-6 (V5.2) (#47)
dde8d8c chore(iza): swap número 945633305 → 926160159 (V5.1) (#46)
860a90e feat(landing): V5 copy rewrite — Iza canonical (#45)
d0560ff feat(landing): Aurora hero + logo bump + partners V4 (#44)
5a65464 feat(app): purge Garantia 60d + trial 14d /app/* (#43)
a4e8933 feat(landing): alinhar V4 ao modelo Claude Design (#42)
c797455 feat(landing): V4 Chatbase-style + Geist + gradiente (#41)
836b4f8 fix(api): WhatsApp webhook signature META_APP_SECRET + raw body (#40)
6cb5759 chore(seo): metadata /legal/deletar-dados (#38)
2fe323d fix(landing): Iza WA fallback + cleanup placeholders (#39)
550d750 feat(v32): landing + satélites + DSR API + billing (#37)
d931628 chore(docs+scripts): GTM runbooks + launch/ops scripts
dce9d68 feat(db): ai_training unit_economics + 2026 plans
6a0d0b7 feat(web): admin unit-economics, legal, onboarding, ai-training
```

**~80% frontend/landing/copy.** Apenas 2 commits (#40, #47) tocam IA/backend de fato. **Foco recente: 100% pré-lançamento**.

### 16.2 Repositórios separados
**Sem visibilidade fora deste monorepo.** Pelo `.env.example` e configs, parece tudo aqui. Possíveis externos não confirmáveis: dashboard interno admin, scripts ETL legados, runbooks em wiki.

### 16.3 Serviços terceiros configurados / consumindo

| Serviço | Status | Evidência |
|---|---|---|
| Anthropic | Ativo, gastando | env + Iza operacional |
| OpenAI | Configurada, uso ≈ zero | env, fallback órfão, Whisper TODO |
| Voyage AI | Configurada, ativa em RAG | env + voyage-3 1024 dims |
| Supabase Postgres + Auth | Ativo | DATABASE_URL + RLS + pgvector |
| Upstash Redis | Provavelmente ativo | rediss://...upstash.io comentado |
| Resend | Ativo | leads + DSR fire-and-forget |
| Stripe | Configurado | env + planConfig V3.2 |
| Meta Cloud API | Ativa | Iza +5511 92616-0159 |
| Vercel | Ativo (frontend) | integração GH |
| Fly.io (api + rag) | Ativos | 2 apps |
| Grafana Cloud | Configurado | OTLP endpoint |
| Sentry | Configurado | DSN + custom HTTP transport |
| Google Calendar OAuth | Configurado | env (uso?) |
| AWS S3 backups | Planejado | bucket configurado |
| Lakera Guard | Não contratado | ausente |
| Langfuse / LangSmith / Helicone | Não contratados | ausentes |
| ElevenLabs | Vendido em planConfig, não contratado | ausente |
| Groq / Deepgram / Mistral OCR / Firecrawl | Não contratados | ausentes |

**Discrepância**: `BLOCKERS.md B-08` diz "BSP intermediário 360Dialog", mas todo código WhatsApp usa Meta Cloud API direto (`graph.facebook.com`). Conferir se a fatura WA hoje vem de Meta direto ou ainda passa por 360Dialog.

---

**Fim do levantamento.** Em caso de dúvida ou pedido de aprofundamento (ex.: inspecionar `services/rag/main.py`, varrer eventos audit_log, fazer diff de branches específicas), abrir nova rodada.
