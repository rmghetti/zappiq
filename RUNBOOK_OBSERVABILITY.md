# ZappIQ API — Runbook de Observabilidade

> **Para quem é isso:** quem está on-call e recebeu uma notificação. Cada seção mapeia para uma regra de alerta no Grafana Cloud (`zappiq-observability` ou `zappiq-slo-burn`) e te diz exatamente o que verificar e o que fazer.

## Sumário rápido (one-pager)

| Alerta | Severidade | Ação |
|---|---|---|
| P95 latency > 500ms | Warning | Investigar gargalo: trace correlation no Loki → Tempo |
| Error rate 5xx > 0.1 req/s | Critical | Chamar squad backend, abrir incidente |
| Silêncio de requests | Critical | Verificar Fly.io, DNS, rotear failover |
| Error ratio > 5% | Warning | Análise por rota, correlação com último deploy |
| SLO Fast burn (14.4x) | Critical | Page on-call. Mitigar em < 1h ou virar incidente |
| SLO Slow burn (6x) | Warning | Abrir ticket. Mitigar em até 6h |

**Stack:**
- Logs: Loki (`grafanacloud-rmghetti-logs`), service `zappiq-api`
- Traces: Tempo (`grafanacloud-rmghetti-traces`), service `zappiq-api`
- Metrics: Prometheus (`grafanacloud-rmghetti-prom`), namespace `http_server_*`
- Dashboard SRE: `https://rmghetti.grafana.net/d/zappiq-api-sre`

---

## Alerta: P95 latency > 500ms

**O que disparou:** O 95º percentil de latência das requisições HTTP do `zappiq-api` ficou acima de 500ms por 5 minutos contínuos.

**Por que importa:** SLA típico de API B2B é P95 < 300ms. 500ms é o teto absoluto antes de o cliente perceber lentidão. Persistente, vira churn.

**Diagnóstico (ordem de execução):**

1. Abrir o dashboard `ZappIQ API — SRE Overview`. Painel "Latency P50/P95/P99". Confirmar se é todo o serviço ou rota específica.
2. Painel "Throughput por rota (top 10)" — quais rotas estão recebendo mais carga?
3. Ir em Explore → Loki: `{service_name="zappiq-api"} | json | severity_text="error" or severity_text="warn"` para ver se há erros correlacionados.
4. Ir em Explore → Tempo: `{resource.service.name="zappiq-api"} | duration > 500ms` — pegar 5 traces lentos. Cada span vai te mostrar onde foi o tempo (DB, HTTP outbound, lógica).
5. Verificar Postgres (Neon ou supabase) — connection pool exausto? Slow queries?

**Causas comuns:**
- Pool de conexões Postgres saturado → escalar pool size ou aumentar máquinas Fly.
- N+1 query em endpoint novo → rollback ou hotfix.
- Provedor externo (Anthropic, Google, Stripe) lento → considerar timeout + circuit breaker.

**Ações de mitigação:**
- Curto prazo: `fly scale count 2 -a zappiq-api` (subir mais uma máquina).
- Médio prazo: identificar a rota em destaque e abrir issue de otimização.

---

## Alerta: Error rate 5xx > 0.1 req/s

**O que disparou:** Mais de 0.1 respostas com código 5xx por segundo (~6 erros/min) por 2 minutos.

**Por que importa:** 5xx significa nossa falha. Cliente está sendo prejudicado AGORA. Cada minuto adicional consome error budget e pode disparar SLO burn.

**Diagnóstico:**

1. Painel "Error rate por status" no dashboard SRE. Ver se é 500, 502, 503, 504.
2. Loki: `{service_name="zappiq-api"} | json | severity_text=~"error|fatal"` — pegar mensagem de erro específica.
3. Pegar `trace_id` de uma linha de erro → click em "View trace" → analisar exceção e stack.
4. Verificar `fly status -a zappiq-api` — alguma máquina morta ou em restart?
5. Verificar deploy mais recente: `fly releases -a zappiq-api`. Se foi nas últimas 30min, considerar rollback.

**Ações:**
- Se for regressão de deploy: `fly releases rollback -a zappiq-api`.
- Se for problema de banco: verificar status do Neon/Supabase, testar conexão.
- Se for provedor externo down: ativar feature flag de degradação graciosa (se houver) ou comunicar usuários.

---

## Alerta: Silêncio de requests por 10min

**O que disparou:** Zero requisições HTTP servidas em 5min, por 10min consecutivos.

**Por que importa:** Ou o serviço morreu, ou o pipeline de métricas quebrou, ou ninguém está usando a API. Os dois primeiros são **incidentes severos**.

**Diagnóstico:**

1. **Primeiro teste:** `curl -i https://zappiq-api.fly.dev/health` — está retornando 200?
   - Se sim: o pipeline de métricas OTel quebrou. Ir para passo 2.
   - Se não: a API está down. Ir para passo 3.
2. **Pipeline OTel:** verificar logs no Loki: `{service_name="zappiq-api"} | json |= "OTel"`. Procurar por erros do exporter.
3. **API down:** `fly status -a zappiq-api`. Se máquinas estão `stopped` mas deveriam estar up, `fly machine start <id>`. Se estão em crash loop, `fly logs -a zappiq-api`.
4. **DNS:** `dig zappiq-api.fly.dev` — está resolvendo?
5. **Edge da Fly:** `curl https://api.fly.io/v1/apps/zappiq-api/status` (precisa token).

**Ações:**
- Reiniciar máquinas: `fly machine restart <id>`.
- Rollback se foi deploy recente.
- Comunicar status público (se houver canal).

---

## Alerta: Error ratio (4xx + 5xx) > 5%

**O que disparou:** Mais de 5% das requisições nos últimos 5min retornaram 4xx ou 5xx.

**Por que importa:** Indica problema sistêmico. 4xx em massa pode ser: cliente integrando errado, mudança de contrato, ou ataque. 5xx é problema nosso.

**Diagnóstico:**
1. Painel "Error rate por status" — separar 4xx de 5xx.
2. Se predominantemente 4xx: identificar rota e código (401 = auth, 403 = permission, 404 = client errado, 429 = rate limit).
3. Loki: filtrar por `http_status_code` específico, ver IPs e padrões de uso.
4. Se 5xx: seguir runbook "Error rate 5xx".

**Ações:**
- 401/403 em massa: pode ser token expirado de cliente, ou mudança de auth não comunicada.
- 404 em massa: rota foi removida sem deprecation? Restaurar com 410 e header `Sunset`.
- 429: alguém abusando? Ver se rate-limit precisa de ajuste ou se é necessário banir IP.

---

## Alerta: SLO Fast Burn (14.4x)

**O que disparou:** Em uma janela curta (5min) E uma janela longa (1h), a taxa de erro está consumindo o error budget mensal a uma velocidade 14.4x. Se mantida, o budget mensal acaba em ~52 horas.

**Por que importa:** Este é o sinal mais forte que temos de **incidente em curso**. O Google SRE recomenda paginar imediatamente.

**Ação imediata:**
1. **Reconhecer o alerta no Grafana Alerting** (botão "Silence" temporário se já em mitigação).
2. **Abrir incidente** (mesmo que informal: criar canal #incident-YYYYMMDD-HHMM).
3. Seguir runbook "Error rate 5xx" para identificar causa raiz.
4. Definir IC (Incident Commander): pessoa única que coordena, escala se necessário.
5. Comunicar status em ~15min (interno) e ~30min (externo, se cliente afetado).

**Pós-incidente:**
- Postmortem obrigatório em 48h.
- Atualizar este runbook com novos sinais identificados.

---

## Alerta: SLO Slow Burn (6x)

**O que disparou:** Em janela média (30min) e longa (6h), taxa de erro consumindo budget a 6x. Se mantido, budget mensal acaba em ~5 dias.

**Por que importa:** Não é incidente urgente, mas é **degradação contínua**. Precisa ação dentro do dia.

**Ação:**
1. Criar issue/ticket no backlog com tag `[SLO Burn]` e prioridade alta.
2. Investigar dentro do horário comercial.
3. Não silenciar o alerta; ele continuará firing até a causa ser resolvida.

---

## Synthetic check

**Check:** `zappiq-api-health` (Grafana SM id 4830). HTTP GET `https://zappiq-api.fly.dev/health` a cada 60s, probes São Paulo + North Virginia.

**Alerta disparado:** ≥2 falhas em 10 execuções (janela de 5 min). Crítico — API externamente inacessível.

**Diagnóstico:**
1. `probe_success{job="zappiq-api-health"}` em PromQL — identificar qual probe falhou (se só uma → rede regional; se todas → API down).
2. `probe_http_status_code{job="zappiq-api-health"}` — se 5xx: app respondendo mas quebrada. Se timeout/conn refused: Fly.io ou DNS.
3. `probe_duration_seconds{job="zappiq-api-health"}` — pico precede falhas? Overload antes de outage.
4. Cruzar com `count_over_time({service_name="zappiq-api"}[5m])` — tráfego real cessou também?

**Mitigação:** ver alerta "Silêncio de requests". Se SM falha mas tráfego real OK → falso positivo de probe (raro; investigar depois).

---

## Painéis de saturação (runtime Node) — PÓS-DEPLOY

> As queries abaixo só retornam dados após deploy da instrumentação `@opentelemetry/instrumentation-runtime-node`. Aplicar no dashboard `zappiq-api-sre` quando métricas começarem a fluir (validar via Explore com `{__name__=~"nodejs_.*"}`).

**Event loop utilization (P95):**
```promql
quantile_over_time(0.95, nodejs_eventloop_utilization{service_name="zappiq-api"}[5m])
```
Threshold warning: 0.7 (70%). Acima disso: thread principal saturada, latência sobe inevitavelmente.

**Heap em uso (%):**
```promql
(sum by (service_name) (nodejs_heap_size_used_bytes{service_name="zappiq-api"}))
/ (sum by (service_name) (nodejs_heap_size_total_bytes{service_name="zappiq-api"}))
```
Threshold warning: 0.85. Acima: GC frequente, perto de OOM.

**GC duration P95:**
```promql
histogram_quantile(0.95, sum by (le, kind) (rate(nodejs_gc_duration_seconds_bucket{service_name="zappiq-api"}[5m])))
```
Threshold warning: 0.1s (major GC). Pausas longas = latência irregular.

**Active handles / requests (pressão de I/O):**
```promql
nodejs_active_handles_total{service_name="zappiq-api"}
nodejs_active_requests_total{service_name="zappiq-api"}
```
Sem threshold fixo — observar tendência. Subida monotônica = leak.

**Process CPU user + system:**
```promql
rate(process_cpu_user_seconds_total{service_name="zappiq-api"}[5m])
+ rate(process_cpu_system_seconds_total{service_name="zappiq-api"}[5m])
```
Threshold warning: 0.8 (80% de 1 vCPU). Fly machine default = 1 shared vCPU.

---

## Métricas de produto (H9)

> Instrumentação custom em `apps/api/src/config/metrics.ts`. Todas as métricas saem pelo mesmo pipeline OTLP (PeriodicExportingMetricReader → Grafana Cloud Prometheus). Namespace: `zappiq_*`. Scope: `otel_scope_name="zappiq.product"`.

**Inventário:**

| Métrica | Tipo | Labels | O que mede |
|---|---|---|---|
| `zappiq_llm_request_duration_seconds` | Histogram | model, operation | Latência wall-clock da chamada Anthropic |
| `zappiq_llm_tokens_total` | Counter | model, operation, kind (input\|output) | Tokens consumidos |
| `zappiq_llm_cost_usd_total` | Counter | model, operation, kind | Custo acumulado em USD (pricing hardcoded em `metrics.ts`) |
| `zappiq_llm_errors_total` | Counter | model, operation, error_type | Falhas na camada LLM (rate_limit, timeout, auth, etc.) |
| `zappiq_conversation_messages_total` | Counter | direction (inbound\|outbound), type | Volume de mensagens no pipeline |
| `zappiq_conversation_closed_total` | Counter | outcome (ai_resolved\|human_resolved) | Fechamentos, derivado do estado prévio |
| `zappiq_conversation_handoff_total` | Counter | reason (user_requested\|bot_decision) | Transbordos bot→humano |
| `zappiq_intent_classified_total` | Counter | intent | Distribuição das intenções classificadas (vocabulário fixo) |
| `zappiq_agent_pipeline_duration_seconds` | Histogram | outcome | Latência end-to-end do agente (inbound→reply) |

**Queries de negócio prontas:**

Taxa de resolução pelo bot (últimas 24h):
```promql
sum(rate(zappiq_conversation_closed_total{outcome="ai_resolved"}[24h]))
/
sum(rate(zappiq_conversation_closed_total[24h]))
```

Handoff rate (quanto % do tráfego o bot não resolve):
```promql
sum(rate(zappiq_conversation_handoff_total[1h]))
/
sum(rate(zappiq_conversation_messages_total{direction="inbound"}[1h]))
```

Custo LLM por hora (burn rate):
```promql
sum(rate(zappiq_llm_cost_usd_total[1h])) * 3600
```

Custo por conversa resolvida (eficiência econômica):
```promql
sum(increase(zappiq_llm_cost_usd_total[1h]))
/
sum(increase(zappiq_conversation_closed_total{outcome="ai_resolved"}[1h]))
```

Latência percebida pelo cliente (P95 do pipeline completo):
```promql
histogram_quantile(0.95, sum by (le) (rate(zappiq_agent_pipeline_duration_seconds_bucket[5m])))
```

Top-5 intents:
```promql
topk(5, sum by (intent) (rate(zappiq_intent_classified_total[1h])))
```

Error rate da LLM (sinal de degradação de provedor):
```promql
sum(rate(zappiq_llm_errors_total[5m])) by (error_type)
```

**Alertas recomendados (próximo ciclo):**

- Taxa de resolução do bot cai abaixo de 60% por 30min → ticket, revisar prompt/RAG.
- Custo LLM/hora excede baseline 3x → investigar conversas anômalas (loop, prompt-injection).
- `llm_errors_total{error_type="rate_limit"} > 0` sustentado → escalar tier Anthropic ou revisar fan-out.
- P95 agent_pipeline > 8s por 10min → degradação percebida, possível problema com Anthropic ou RAG.

---

## Princípios gerais

- **Prefira mitigar a investigar.** Se rollback resolve, faça o rollback e investigue depois.
- **Preserve evidências.** Antes de reiniciar uma máquina, capture logs e traces relevantes.
- **Comunique cedo, comunique sempre.** Cliente prefere saber de incidente em curso do que descobrir sozinho.
- **Postmortem sem culpa.** Aprenda do erro, não puna a pessoa.

## Owner deste runbook

Rodrigo Ghetti — `rmghetti@gmail.com`. Última revisão: 2026-04-14.
