# Observability DAY 1 — Grafana queries, alertas e runbook

**Versão:** V2-025 (Sprint 0)
**Status:** Em produção
**Última atualização:** 2026-04-28

## 1. Pra que serve este documento

Operacionalizar a observabilidade do dia do launch. Cobre:

1. **Métricas OTel custom** que já estão exportando — o que cada uma significa.
2. **PromQL queries canônicas** pra dashboards Grafana (latency, error rate, queue depth, fallback rate, cost per call).
3. **Definições de alertas** que vão pra `#zappiq-alerts` no Slack.
4. **Runbook on-call** — o que fazer quando cada alerta dispara.

Tudo já existe como métrica em prod (Blockers 1, 2, 3 mergeados). Falta apenas configurar dashboards e alertas no Grafana Cloud.

## 2. Métricas exportadas (catálogo)

Todas exportadas via OpenTelemetry → Grafana Cloud OTLP (`https://otlp-gateway-prod-us-east-0.grafana.net/otlp`). Resource attribute `service.name=zappiq-api`.

### 2.1 LLM (Blocker 1 V2-018)

| Métrica | Tipo | Labels | O que mede |
|---|---|---|---|
| `zappiq_llm_request_duration_seconds` | histogram | `model`, `operation` | Latência de cada chamada Anthropic/OpenAI |
| `zappiq_llm_tokens_total` | counter | `model`, `operation`, `kind` (input/output) | Tokens processados |
| `zappiq_llm_cost_usd_total` | counter | `model`, `operation`, `kind` | Custo USD acumulado |
| `zappiq_llm_errors_total` | counter | `model`, `operation`, `error_type` | Erros LLM (rate_limit, timeout, etc) |

Tabela auxiliar SQL: `llm_call_logs` (Supabase) — para queries agregadas que Grafana não cobre bem (cost-per-tenant).

### 2.2 Pipeline do agente

| Métrica | Tipo | Labels | O que mede |
|---|---|---|---|
| `zappiq_agent_pipeline_duration_seconds` | histogram | — | Latência fim-a-fim (webhook recebe → resposta WhatsApp enviada) |
| `zappiq_conversation_messages_total` | counter | — | Mensagens processadas |
| `zappiq_conversation_handoff_total` | counter | — | Handoffs bot → humano |
| `zappiq_intent_classified_total` | counter | `intent` | Distribuição de intents |

### 2.3 Filas BullMQ (Blocker 2 V2-023)

| Métrica | Tipo | Labels | O que mede |
|---|---|---|---|
| `zappiq_queue_depth` | observable gauge | `queue` | Jobs waiting + active na fila |
| `zappiq_queue_oldest_job_age_seconds` | observable gauge | `queue` | Idade do job mais antigo aguardando |
| `zappiq_queue_jobs_completed_total` | counter | `queue`, `attempts` | Jobs concluídos com sucesso |
| `zappiq_queue_jobs_failed_total` | counter | `queue`, `attempts`, `error_type` | Jobs que falharam após todas as tentativas |
| `zappiq_queue_job_duration_seconds` | histogram | `queue` | Duração enqueue → completion |

## 3. PromQL queries canônicas (montar dashboard)

Cole no Grafana Cloud → Dashboards → New Dashboard → Add panel. Datasource: o Prometheus do Grafana Cloud (`grafanacloud-zappiq-prom`).

### Painel 1 — LLM latency p50/p95

```promql
# p50
histogram_quantile(0.50,
  sum by (le) (rate(zappiq_llm_request_duration_seconds_bucket[5m]))
)

# p95
histogram_quantile(0.95,
  sum by (le) (rate(zappiq_llm_request_duration_seconds_bucket[5m]))
)
```

Threshold dashboard: linha vermelha em 5s (target Plano §8.3).

### Painel 2 — Error rate LLM

```promql
sum(rate(zappiq_llm_errors_total[5m])) /
sum(rate(zappiq_llm_request_duration_seconds_count[5m]))
```

Threshold: 1% (alerta se >1% por 10min).

### Painel 3 — Queue depth ai-process

```promql
zappiq_queue_depth{queue="ai-process"}
```

Threshold: 20 sustained (alerta).

### Painel 4 — Fallback rate por provider

```promql
sum by (provider) (
  rate(zappiq_queue_jobs_completed_total{queue="ai-process",attempts!="1"}[5m])
) /
sum (rate(zappiq_queue_jobs_completed_total{queue="ai-process"}[5m]))
```

Mostra quanto % dos jobs precisaram de retry (Anthropic instável).

### Painel 5 — Cost per hour (estimado)

```promql
sum(rate(zappiq_llm_cost_usd_total[1h])) * 3600
```

Multiplicado por 3600 = USD/hora. Sanity check: Plano §9 estima ~R$0,82/conversa; em 100 conversas/hora = ~US$ 16/hora.

### Painel 6 — Pipeline p95 (latência percebida pelo cliente)

```promql
histogram_quantile(0.95,
  sum by (le) (rate(zappiq_agent_pipeline_duration_seconds_bucket[5m]))
)
```

Target: ≤5s (Plano §8.3).

### Painel 7 — Mensagens processadas (volume)

```promql
sum(rate(zappiq_conversation_messages_total[5m])) * 60
```

Multiplicado por 60 = msgs/min. Útil pra correlacionar pico com latência.

### Painel 8 — Handoff rate

```promql
sum(rate(zappiq_conversation_handoff_total[1h])) /
sum(rate(zappiq_conversation_messages_total[1h]))
```

Target: <35% (Plano §8.3 — "escalation rate").

## 4. Alertas (Grafana Alerting)

Setup: Grafana Cloud → Alerting → New rule. Notification policy: Slack contact point apontando pro webhook `#zappiq-alerts`.

### A1 — LLM error rate >1% por 10min

```yaml
condition: |
  sum(rate(zappiq_llm_errors_total[5m])) /
  sum(rate(zappiq_llm_request_duration_seconds_count[5m])) > 0.01
for: 10m
labels:
  severity: warning
  team: zappiq-eng
annotations:
  summary: "LLM error rate acima de 1% nos últimos 10min"
  description: "Provider degradado. Cascade do LLMRouter pode estar caindo pra fallback."
  runbook: "docs/operations/observability_day1.md#runbook-A1"
```

### A2 — Pipeline latency p95 >7s por 5min

```yaml
condition: |
  histogram_quantile(0.95,
    sum by (le) (rate(zappiq_agent_pipeline_duration_seconds_bucket[5m]))
  ) > 7
for: 5m
labels:
  severity: warning
  team: zappiq-eng
annotations:
  summary: "Pipeline da Iza com p95 >7s — cliente percebendo lentidão"
  runbook: "docs/operations/observability_day1.md#runbook-A2"
```

### A3 — Queue depth ai-process crescente sem decrescer por 30min

```yaml
condition: |
  delta(zappiq_queue_depth{queue="ai-process"}[30m]) > 0 AND
  zappiq_queue_depth{queue="ai-process"} > 5
for: 30m
labels:
  severity: critical
  team: zappiq-eng
annotations:
  summary: "Fila ai-process com backlog crescente — worker não dá conta"
  runbook: "docs/operations/observability_day1.md#runbook-A3"
```

### A4 — LLM circuit breaker aberto (qualquer provider)

```yaml
# Métrica indireta: fallback_triggered=true >50% das chamadas
condition: |
  sum(rate(zappiq_queue_jobs_completed_total{queue="ai-process",attempts!="1"}[5m])) /
  sum(rate(zappiq_queue_jobs_completed_total{queue="ai-process"}[5m])) > 0.5
for: 5m
labels:
  severity: critical
  team: zappiq-eng
annotations:
  summary: "Mais de 50% das respostas vêm de fallback — provider primário em queda"
  runbook: "docs/operations/observability_day1.md#runbook-A4"
```

### A5 — Custo LLM excedendo trial cap (preventivo)

```yaml
# Custo mensal por org > 50 USD em 1h (não tem como fazer per-tenant em PromQL
# direto — usar query SQL via /api/admin/llm-status)
condition: "manual via cronjob OU dashboard SQL"
runbook: "docs/operations/observability_day1.md#runbook-A5"
```

Por enquanto manual; cronjob fica pra Onda 3 follow-up.

## 5. Runbook on-call

### <a id="runbook-A1"></a>A1 — LLM error rate >1%

**O que verificar primeiro:**

1. Status oficial dos providers:
   - Anthropic: https://status.anthropic.com
   - OpenAI: https://status.openai.com
2. Endpoint admin local:
   ```bash
   curl -H "X-Admin-Secret: $META_APP_SECRET" \
     https://zappiq-api.fly.dev/api/admin/llm-status
   ```
3. Procura por `breakerOpen: true` no output — provider tá fora.

**Ações:**

- Se Anthropic Sonnet com breaker aberto e Haiku ok: cascade tá funcionando, espera 2min pro breaker fechar (half-open). Se estabilizar, fim.
- Se TODOS providers em breaker aberto: rollback do último deploy via `gh pr revert` ou `fly deploy --image registry.fly.io/zappiq-api:deployment-<SHA-anterior>`.
- Se nenhum provider em breaker mas erros persistem: provavelmente erro 4xx (input). Verificar `fly logs --since 10m | grep -E "Anthropic|OpenAI" | grep -iE "error|400|422"`.

### <a id="runbook-A2"></a>A2 — Pipeline latency p95 >7s

**Diagnóstico:**

1. Quem está lento — LLM ou DB?
   ```promql
   histogram_quantile(0.95, sum by (le) (rate(zappiq_llm_request_duration_seconds_bucket[5m])))
   ```
   Se p95 LLM > 4s: gargalo é o provider. Ver A1.
2. Se LLM ok mas pipeline ruim: provavelmente RAG (services/rag Python) ou Postgres.
3. Verificar Fly.io machines:
   ```bash
   fly status -a zappiq-api
   fly logs -a zappiq-api --since 10m | grep -E "slow|timeout"
   ```

**Ações:**

- Scale up Fly machines: `fly scale count 4 -a zappiq-api` (de 2 pra 4).
- Se ainda ruim: aumentar concurrency do worker via env (`fly secrets set BULLMQ_LLM_CONCURRENCY=20 -a zappiq-api`).
- Last resort: rollback.

### <a id="runbook-A3"></a>A3 — Queue depth crescente sem parar

**Sintoma:** worker BullMQ não dá conta do backlog. Mensagens demoram pra serem respondidas.

**Diagnóstico:**

```bash
fly logs -a zappiq-api --since 5m | grep "Queue:AIProcess"
```

Se ver muitos `failed` ou nenhum `Completed`: worker travou ou crashando.

**Ações:**

1. Restart dos pods Fly: `fly machine restart -a zappiq-api`.
2. Se continuar: aumentar concorrência do worker (env `BULLMQ_LLM_CONCURRENCY` de 10 → 20 → 50).
3. Se Redis estiver cheio (Upstash quota): purge dos jobs failed antigos via Bull Board (pendente de implementar) ou direto no Redis: `redis-cli FLUSHDB` em LAST CASE.

### <a id="runbook-A4"></a>A4 — Circuit breaker maioria aberto

**Sintoma:** mais de 50% das respostas vêm de fallback. Provider primário (Sonnet) em outage prolongada.

**Ações:**

1. Comunicar status interno (Slack `#zappiq-launch`).
2. Verificar Anthropic status. Se incident público, esperar.
3. Se impacto ao cliente perceptível: ativar mensagem de degradação (rollout de feature flag — implementar em Onda 3).

### <a id="runbook-A5"></a>A5 — Custo LLM excedendo trial cap

**Sintoma:** uma org gastou >US$ 50 em 1 hora no trial.

**Diagnóstico via SQL:**

```sql
SELECT organization_id, SUM(cost_usd_estimate) as cost_usd, COUNT(*) as calls
FROM llm_call_logs
WHERE created_at > NOW() - INTERVAL '1 hour'
GROUP BY organization_id
ORDER BY cost_usd DESC
LIMIT 10;
```

**Ações:**

- Se for tenant em trial: forçar conversão ou pausar via dashboard admin.
- Se for tenant pago: investigar se é uso normal ou anomalia (loop infinito, ataque).
- Adicionar `organizationId` na lista `BLOCKED_ORG_IDS` (env Fly) se for ataque.

## 6. Validação no dia do launch

Pré-launch checklist (sábado 18h):

- [ ] Dashboard Grafana com 8 painéis criado e visível pelo war room.
- [ ] 4 alertas (A1–A4) configurados em Grafana Alerting.
- [ ] Slack `#zappiq-alerts` recebendo notificações de teste (manual trigger).
- [ ] Endpoint `/api/admin/llm-status` respondendo com `META_APP_SECRET` correto.
- [ ] Runbook acessível offline (printed + Notion duplicado).
- [ ] Plantão definido: incident commander + dev backup + DevOps + CSM.

## 7. Pós-launch (Semana 1)

Métricas que ainda faltam pra cobertura completa (Plano §8.2):

- **Langfuse self-hosted** (semana 1): traces detalhados de LLM, prompt versioning, eval.
- **Cost-per-tenant dashboard Grafana** (semana 2): query SQL agregada → dashboard.
- **Sentry SDK oficial** (semana 3): performance monitoring + replay.
- **Synthetic eval suite** (semana 5): Vitest noturno com perguntas-gold.

## 8. Refs

- `apps/api/src/config/metrics.ts` — definição das métricas
- `apps/api/src/services/queueService.ts` — instrumentação BullMQ
- `apps/api/src/services/llm/LLMRouter.ts` — circuit breaker + audit
- `apps/api/src/routes/adminLlm.ts` — endpoint healthcheck
- Plano V2.0 §8 — observabilidade
