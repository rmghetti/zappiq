# LLMRouter — Arquitetura, Cascade e Audit

**Versão:** V2-018 (Sprint 0 Blocker 1)
**Status:** Em produção
**Última atualização:** 2026-04-27

## 1. Resumo

O `LLMRouter` é a **única porta de entrada** para chamadas LLM no backend da ZappIQ. Substitui o `langchainClient.ts` original que chamava Anthropic SDK direto sem fallback. Implementa:

- **Cascade multi-provider** (Sonnet 4.6 → Haiku 4.5 → GPT-4o-mini).
- **Circuit breaker** por provedor (3 falhas em 60s abrem o breaker por 120s).
- **Audit por turn** em `llm_call_logs` (tabela dedicada, não polui `audit_logs` hash-chained).
- **Cost estimator** hardcoded por modelo (`utils/llmCost.ts`).

Decisão arquitetural correlata em `docs/audit/cowork_response_2026-04-27.md` §15.1 (blocker #1) e Plano V2.0 §4.

## 2. Cascade

| # | Provider ID | Provider | Modelo | Justificativa |
|---|---|---|---|---|
| 1 | `anthropic-sonnet` | Anthropic | `env.ANTHROPIC_MODEL` (default `claude-sonnet-4-6`) | Qualidade pt-BR superior |
| 2 | `anthropic-haiku` | Anthropic | `claude-haiku-4-5-20251001` | Fallback rápido e barato |
| 3 | `openai-mini` | OpenAI | `gpt-4o-mini` | Independência de vendor |

**Modelo primário env-driven**: trocar `ANTHROPIC_MODEL` no Fly + restart sem deploy. Útil em hotfix (ex.: deprecation de modelo).

**Sem Opus**: apesar de presente em `MODEL_PRICING`, não está na cascade default — Opus é caro demais pra ser primário em conversa. Reservado pra eval LLM-as-judge offline (Q3 conforme Plano §4.3).

## 3. Critério de "falhou" (triggers fallback)

| Erro | Triggera fallback? | Conta pro breaker? |
|---|---|---|
| Timeout (rede) | Sim | Sim |
| HTTP 5xx | Sim | Sim |
| HTTP 429 (rate limit) | Sim | Sim |
| HTTP 4xx (400, 401, 422) | **Não** — devolve direto pro chamador | Não |
| `quota_exceeded` | Sim | Sim |

Racional: 4xx do cliente é bug do payload (ex.: prompt mal-formado, contexto > 200k tokens). Não adianta tentar próximo provider — vai falhar igual. 4xx propaga pro caller.

## 4. Circuit breaker

```
3 falhas em janela de 60s  →  breaker abre por 120s
Próxima chamada:           →  pula provider, vai pro próximo da cascade
Após 120s:                 →  half-open, primeira chamada testa
Sucesso na half-open:      →  reseta failures = 0
```

Estado em **memória por instância** (não compartilhado entre pods Fly). Aceitável pra Sprint 0 — múltiplos pods vão abrir o breaker independentemente. Coordenação via Redis fica pra Onda 2 se necessário (provavelmente não).

Hook de teste: `__resetBreakersForTest()` zera estado entre tests Vitest.

## 5. Audit por turn (llm_call_logs)

Cada chamada bem-sucedida e cada cascade exhausted gera 1 linha em `llm_call_logs`:

| Campo | Tipo | Descrição |
|---|---|---|
| `id` | uuid | Auto |
| `organization_id` | text? | Tenant — propagado do orchestrator |
| `conversation_id` | text? | Conversa — rastreabilidade fim-a-fim |
| `provider` | text | `anthropic-sonnet` / `anthropic-haiku` / `openai-mini` / `none` |
| `model` | text | `claude-sonnet-4-6` / etc |
| `operation` | text | `chat` / `classify` / `sentiment` |
| `input_tokens` | int? | Do provider |
| `output_tokens` | int? | Do provider |
| `cost_usd_estimate` | numeric(10,6) | Calculado via `utils/llmCost.ts` |
| `latency_ms` | int | Total da cascade (não só do provider que respondeu) |
| `fallback_triggered` | bool | `true` se attempt > 1 |
| `attempt_count` | int | 1 = primário, 2 = fallback 1, 3 = fallback 2 |
| `error` | text? | Mensagem quando cascade exhausted |
| `created_at` | timestamptz | Auto |

**Por que não `audit_logs`?** Ver migration SQL em `packages/database/prisma/migrations/20260427_llm_call_logs/migration.sql` — racional documentado no header.

**Fail-soft**: erro ao persistir audit **não derruba** a chamada LLM. Loga warn estruturado e segue. Alerta Slack se fail rate > 1% (ver Onda 2 — Observabilidade DAY 1).

## 6. Como usar

### Caminho típico (orchestrator)

```typescript
import { chatCompletion, classify } from '../services/llm/langchainClient.js';

// Conversa principal — cascade Sonnet → Haiku → GPT-4o-mini
const resp = await chatCompletion(systemPrompt, messages, 1024, {
  orgId: organizationId,
  conversationId: conversationId,
});
console.log(resp.text, resp.provider, resp.attempt);

// Intent classification — força Haiku, fallback automático se Haiku cair
const intent = await classify(prompt, { orgId, conversationId });
```

### Acesso direto ao Router (raro)

```typescript
import { llmRouter } from '../services/llm/LLMRouter.js';

const resp = await llmRouter.complete({
  system: '...',
  messages: [{ role: 'user', content: '...' }],
  forceProvider: 'openai-mini',  // Enterprise customer override
  orgId, conversationId,
  operation: 'chat',
});
```

### Healthcheck

```typescript
import { llmRouter } from '../services/llm/LLMRouter.js';

llmRouter.getStatus();
// → [
//   { id: 'anthropic-sonnet', label: 'Claude Sonnet 4.6', model: 'claude-sonnet-4-6', breakerOpen: false, failures: 0 },
//   { id: 'anthropic-haiku',  label: 'Claude Haiku 4.5',  model: 'claude-haiku-4-5-20251001', breakerOpen: false, failures: 0 },
//   { id: 'openai-mini',      label: 'GPT-4o-mini',       model: 'gpt-4o-mini', breakerOpen: false, failures: 0 },
// ]
```

Endpoint REST `/api/admin/llm-status` (a criar em Onda 2).

## 7. Cost estimator

Tabela hardcoded em `utils/llmCost.ts` baseada em pricing público abril/2026:

| Modelo | Input ($/1M tok) | Output ($/1M tok) |
|---|---|---|
| `claude-sonnet-4-6` | 3.00 | 15.00 |
| `claude-haiku-4-5-20251001` | 1.00 | 5.00 |
| `claude-opus-4-6` | 15.00 | 75.00 |
| `gpt-4o-mini` | 0.15 | 0.60 |
| `gpt-4o` | 2.50 | 10.00 |

**Política de atualização:** quando preço mudar, atualizar `MODEL_PRICING` + bumpar `PRICING_VERSION` + nota em `CHANGELOG.md`. Sem fetch dinâmico de pricing — tabela hardcoded é mais previsível e barata.

**Limitações conhecidas:**
- Não conta cache hit (Anthropic prompt caching). Adicionar quando ativarmos em Q3 (Apêndice C do Plano).
- Não conta image tokens (vision). Adicionar quando entrar.

## 8. Testes

```bash
pnpm --filter @zappiq/api test
```

Cobertura atual:

| Arquivo | Casos |
|---|---|
| `utils/llmCost.test.ts` | 11 (cálculo por modelo, precisão, fail-safe, MODEL_PRICING canônica) |
| `services/llm/LLMRouter.test.ts` | 11 (happy path, cascade fallback, circuit breaker, 4xx no-fallback, audit) |
| `services/llm/langchainClient.test.ts` | 9 (wrappers, force provider, fallback automático classify, sentiment normalizado) |

CI roda em todo PR via `.github/workflows/ci.yml` step `Test API (Vitest)`. Bloqueia merge se falhar.

## 9. Roadmap

- **Semana 1 pós-launch**: Langfuse self-hosted pra observabilidade detalhada (prompts, completions, traces). Plano V2.0 §8.2.
- **Semana 2 pós-launch**: dashboard cost-per-tenant em Grafana usando `llm_call_logs` agregada por dia.
- **Semana 3 pós-launch**: prompt caching em system prompt + brand_rules (TTL 1h Anthropic). Plano §9.5.
- **Semana 4 pós-launch**: cascade real Haiku/Sonnet por heurística (rag groundedness > 0.9 + complexity < 0.3 → Haiku direto). Plano §9.5.
- **Q3/2026**: avaliar Mastra como framework completo (Plano §3.3).

## 10. Não fazer (anti-padrões)

- **Não** chamar `@anthropic-ai/sdk` direto — passe pelo Router.
- **Não** rodar Anthropic e OpenAI em paralelo no mesmo turn (custo dobrado, latência dobrada).
- **Não** deixar circuit breaker desativado em desenvolvimento — falhas em dev devem refletir prod.
- **Não** deixar cliente final escolher provider na V2.0 (Plano §4.6).
- **Não** usar OpenAI Assistants API.
