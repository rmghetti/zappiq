# Observabilidade — ZappIQ

Setup completo de OTel traces + Prometheus metricas + Grafana.

## O que tem aqui

- `grafana-dashboard.json` — dashboard principal com Golden Signals, recursos, Postgres/Redis/BullMQ, LLM/RAG, e trace search.

## Stack recomendada (free tier)

1. **Grafana Cloud** — 10k series de metricas + 50GB de logs + 50GB de traces grátis.
   - Prometheus OTLP endpoint
   - Tempo para traces
   - Logs via Loki (se quiser centralizar)

Alternativas:
- **Honeycomb** — free tier 20M events/mes, ótimo para traces. Sem dashboard tão completo quanto Grafana.
- **Self-hosted** — Prometheus + Tempo + Grafana via docker-compose. Pra depois, quando tiver volume.

## Setup rapido (Grafana Cloud)

### 1. Criar conta e pegar OTLP endpoint

https://grafana.com/auth/sign-up/create-user → criar stack gratuita.

Em "My Account > Security > Access Policies", criar access policy com scopes:
- `metrics:write`
- `traces:write`
- `logs:write`

Gerar token. Copiar.

### 2. Configurar secrets no Fly

```bash
# OTLP endpoint formato (Grafana Cloud):
# https://otlp-gateway-<region>.grafana.net/otlp

fly secrets set \
  OTEL_EXPORTER_OTLP_ENDPOINT="https://otlp-gateway-prod-us-east-0.grafana.net/otlp" \
  OTEL_EXPORTER_OTLP_HEADERS="Authorization=Basic <base64(instance_id:token)>" \
  OTEL_SERVICE_NAME="zappiq-api" \
  OTEL_RESOURCE_ATTRIBUTES="deployment.environment=production" \
  -a zappiq-api

fly deploy -a zappiq-api
```

### 3. Importar dashboard

No Grafana Cloud: Dashboards → New → Import → Upload `grafana-dashboard.json`.

Ajustar datasource se necessário (o JSON referencia `prometheus` e `tempo` como uids).

## Metricas customizadas no código

OTel auto-instrumentations cobrem HTTP, Prisma, Redis, fetch. Para métricas de negócio, use:

```typescript
// apps/api/src/metrics.ts
import { metrics } from '@opentelemetry/api';

const meter = metrics.getMeter('zappiq-api');

export const llmTokensInput = meter.createCounter('llm_tokens_input_total', {
  description: 'Tokens de input enviados ao LLM',
});

export const llmRequestDuration = meter.createHistogram('llm_request_duration_seconds', {
  description: 'Duracao das chamadas ao LLM',
  unit: 's',
});

// Em uso:
// llmTokensInput.add(response.usage.input_tokens, { provider: 'anthropic', model: 'claude-sonnet-4-6' });
```

Métricas de queue (BullMQ) e pool (Prisma) precisam de collectors específicos — adicionar em `apps/api/src/observability/queue-metrics.ts` (TODO).

## Alerts Grafana

Dashboard vem com thresholds visuais. Para alertas acionáveis (notificação PagerDuty/Slack), criar em **Alerting → Alert rules**:

1. **API error rate > 1%** — 5min sustained → PagerDuty SEV2
2. **API p95 latency > 2s** — 5min sustained → Slack `#zappiq-alerts`
3. **BullMQ queue waiting > 500** — 3min sustained → Slack
4. **Postgres pool pending > 5** — 2min sustained → PagerDuty SEV2
5. **LLM error rate > 5%** — 5min sustained → Slack
6. **RAG p95 > 300ms** — 10min sustained → Slack SEV3

Detalhes no `RUNBOOK-INCIDENT.md`.

## Trace sampling

Produção: 10% sampling (`OTEL_TRACES_SAMPLER=parentbased_traceidratio`, `OTEL_TRACES_SAMPLER_ARG=0.1`).

Aumentar para 100% temporariamente durante investigação de incidente:

```bash
fly secrets set OTEL_TRACES_SAMPLER_ARG=1.0 -a zappiq-api
fly machines restart -a zappiq-api
# Investigar, depois reverter para 0.1
```

## Custo estimado

Grafana Cloud free tier cobre uso até ~50 RPS consistente. Acima disso:

- Pro plan US$ 8/user/mes + ~US$ 0.50/GB de ingestão extra
- ~US$ 30-50/mes estimado para ZappIQ em carga atual

Comparação:
- Datadog: ~US$ 150/mes pra cobertura similar
- New Relic: ~US$ 100/mes
- Honeycomb só traces: ~US$ 150/mes a partir do free tier
