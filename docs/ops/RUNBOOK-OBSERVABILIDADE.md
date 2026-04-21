# Runbook — Observabilidade & Saúde do Sistema

**Para:** SRE/DevOps + On-Call
**Objetivo:** Diagnosticar saúde do sistema em <60 segundos pós-launch
**Última atualização:** 15 de abril de 2026

---

## 1. Verificação Rápida de Saúde (60 segundos)

### 1.1 Status de Disponibilidade

Execute em ordem:

```bash
# Terminal 1: Verificar status HTTP da API
curl -s -w "HTTP Status: %{http_code}\n" https://api.zappiq.com.br/health

# Terminal 2: Verificar database connectivity
curl -s https://api.zappiq.com.br/ready | jq '.database'

# Terminal 3: Verificar WebHook WhatsApp (último evento)
curl -s https://api.zappiq.com.br/api/webhooks/status | jq '.lastEvent'
```

**Esperado:**
- HTTP Status: 200 (health)
- database: "connected"
- lastEvent: timestamp <60s atrás

**Se falhar:**
- → Vá para **Seção 2: Debugging**

### 1.2 Status de Performance (Datadog/CloudWatch)

**URL rápida:** 
- Datadog: https://app.datadoghq.com/dashboard/list
- Painel "ZappIQ Launch 2026" → abrir

**Métricas críticas visíveis:**
1. **Request latency (p95):** deve estar <2.5s
2. **Error rate (%):** deve estar <2%
3. **Database connections:** deve estar <40/50
4. **Uptime:** percentual do período

**Se uma métrica vermelha:**
- → Vá para **Seção 2: Debugging**

---

## 2. Debugging — Árvore de Decisão

### 2.1 Se Health endpoint responde 200, mas latência alta (>3s p95)

```sql
-- Query Supabase: Verificar slow queries
SELECT 
  query,
  COUNT(*) as call_count,
  AVG(mean_exec_time) as avg_exec_ms
FROM pg_stat_statements
WHERE mean_exec_time > 500
ORDER BY mean_exec_time DESC
LIMIT 5;
```

**Ações:**
1. Verificar índices (especialmente `organizationId`, `userId`, `createdAt`)
2. Se fila Redis alta: `redis-cli INFO stats` → verificar `connected_clients`
3. Se Anthropic latência: `curl -s https://api.anthropic.com/health`

**Mitigation rápida:**
- Reiniciar worker de fila: `fly ssh console -a zappiq-api` → `systemctl restart worker`
- Scale up API: `fly scale count app=2` (se CPU >80%)

---

### 2.2 Se Health endpoint responde 500 ou timeout

```bash
# 1. Verificar logs da API
fly logs -a zappiq-api --level error | head -20

# 2. Verificar database status
psql $DATABASE_URL -c "SELECT version();"

# 3. Verificar Redis conectividade
redis-cli -u $REDIS_URL ping
```

**Esperado:** PONG (Redis), version string (Postgres)

**Se Postgres down:**
1. Trigger failover: `fly db failover -a zappiq-db`
2. Aguarde 2-3 min
3. Validar com `psql $DATABASE_URL -c "SELECT 1;"`

**Se Redis down:**
1. Reiniciar: `fly ssh console -a zappiq-redis` → `redis-cli FLUSHDB; exit`
2. Ou aumentar replica count: `fly scale count redis=2`

---

### 2.3 Se Error rate >5% (Sentry)

**Abrir Sentry:**
```
https://zappiq.sentry.io/issues/?environment=production
```

**Top 3 erros visíveis?**
1. Agrupar por tipo (Ex: `TimeoutError`, `AuthenticationError`)
2. Verificar stack trace → qual serviço/função falha
3. Procurar por padrão (horário, usuário, endpoint)

**Causas comuns:**

| Erro | Causa | Ação |
|------|-------|------|
| `TimeoutError` | API Anthropic lenta | Aumentar timeout de 30s para 45s em `.env`; verificar Anthropic status |
| `AuthenticationError` | JWT expirado em batch | Rodar `regenerate-tokens` job |
| `DatabaseConnection` | Pool esgotado | Aumentar `max_connections` Supabase ou reduzir pool size na API |
| `RateLimitError` | WhatsApp quota excedida | Verificar Webhook logs; possível abuse de bot |

---

### 2.4 Se Database query lento (<500ms p95 violado)

```sql
-- Supabase: Mostrar queries em execução
SELECT 
  pid, 
  usename, 
  query, 
  now() - pg_stat_activity.query_start AS duration
FROM pg_stat_activity
WHERE (now() - pg_stat_activity.query_start) > interval '1 second';
```

**Ação rápida:**
```sql
-- Reindex tabelas críticas (fora de pico se possível)
REINDEX TABLE documents;
REINDEX TABLE ai_training_qa;
REINDEX TABLE conversations;
```

**Se travado:**
```sql
-- Terminar query lenta (use com cuidado!)
SELECT pg_terminate_backend(pid) FROM pg_stat_activity 
WHERE query ILIKE '%SELECT%documents%' AND state = 'active';
```

---

## 3. Dashboards Essenciais (SQL Direto)

**Acesso:** Supabase SQL Editor ou psql direto

### 3.1 SLO #1 — Latência API (últimas 24h)

```sql
SELECT 
  DATE_TRUNC('hour', created_at) as hour,
  COUNT(*) as request_count,
  ROUND(PERCENTILE_CONT(0.95) WITHIN GROUP (ORDER BY response_time_ms)::numeric, 1) as p95_ms,
  ROUND(PERCENTILE_CONT(0.99) WITHIN GROUP (ORDER BY response_time_ms)::numeric, 1) as p99_ms,
  ROUND(AVG(response_time_ms)::numeric, 1) as avg_ms
FROM http_requests
WHERE created_at > NOW() - INTERVAL '24 hours'
GROUP BY DATE_TRUNC('hour', created_at)
ORDER BY hour DESC;
```

**Target:** p95 <2.500ms (verde), <3.000ms (amarelo), >3.500ms (vermelho)

---

### 3.2 SLO #2 — Error Rate (últimas 24h)

```sql
SELECT 
  DATE_TRUNC('hour', created_at) as hour,
  COUNT(*) as total_requests,
  SUM(CASE WHEN status_code >= 500 THEN 1 ELSE 0 END) as server_errors,
  SUM(CASE WHEN status_code >= 400 AND status_code < 500 THEN 1 ELSE 0 END) as client_errors,
  ROUND(100.0 * SUM(CASE WHEN status_code >= 500 THEN 1 ELSE 0 END) / COUNT(*)::numeric, 2) as error_rate_pct
FROM http_requests
WHERE created_at > NOW() - INTERVAL '24 hours'
GROUP BY DATE_TRUNC('hour', created_at)
ORDER BY hour DESC;
```

**Target:** <2% (verde), <5% (amarelo), >5% (vermelho/alert)

---

### 3.3 SLO #3 — Mensagens de IA processadas/hora

```sql
SELECT 
  DATE_TRUNC('hour', created_at) as hour,
  COUNT(*) as message_count,
  SUM(CASE WHEN processed_by_ai = true THEN 1 ELSE 0 END) as ai_processed,
  ROUND(AVG(processing_time_ms)::numeric, 1) as avg_processing_ms
FROM whatsapp_messages
WHERE created_at > NOW() - INTERVAL '24 hours'
GROUP BY DATE_TRUNC('hour', created_at)
ORDER BY hour DESC;
```

**Target:** >100 msg/hora em pico (PMM comercial)

---

### 3.4 SLO #4 — Trials ativos & conversion

```sql
SELECT 
  DATE_TRUNC('day', created_at) as signup_date,
  COUNT(*) as new_trials,
  SUM(CASE WHEN status = 'active' THEN 1 ELSE 0 END) as still_active,
  SUM(CASE WHEN status = 'converted_to_paid' THEN 1 ELSE 0 END) as converted,
  ROUND(100.0 * SUM(CASE WHEN status = 'converted_to_paid' THEN 1 ELSE 0 END) / COUNT(*)::numeric, 2) as conversion_pct
FROM trial_subscriptions
WHERE created_at > NOW() - INTERVAL '30 days'
GROUP BY DATE_TRUNC('day', created_at)
ORDER BY signup_date DESC;
```

**Target:** >15% conversion (verde), >10% (amarelo), <10% (vermelho)

---

### 3.5 SLO #5 — MRR & Revenue do dia

```sql
SELECT 
  DATE(created_at) as payment_date,
  COUNT(*) as payment_count,
  SUM(amount_cents) / 100.0 as revenue_brl,
  AVG(amount_cents / 100.0) as avg_order_value_brl
FROM stripe_charges
WHERE created_at > NOW() - INTERVAL '30 days' AND status = 'succeeded'
GROUP BY DATE(created_at)
ORDER BY payment_date DESC;
```

**Target:** Crescimento diário >0% até D+7, depois avaliar burn rate

---

## 4. Top 5 Queries de SLO (Quick Copy-Paste)

```sql
-- Quick health check (run all 5 together, ctrl+shift+enter)

-- 1. Uptime (health endpoint responsiveness)
SELECT COUNT(*) as health_checks_passed FROM health_checks 
WHERE created_at > NOW() - INTERVAL '1 hour' AND http_code = 200;

-- 2. Database lag (replication status)
SELECT EXTRACT(EPOCH FROM (NOW() - pg_last_wal_receive_lsn())) as replication_lag_seconds;

-- 3. Active connections (spike detection)
SELECT COUNT(*) as active_connections FROM pg_stat_activity WHERE state = 'active';

-- 4. Disk usage (storage warning)
SELECT pg_size_pretty(pg_database_size(current_database())) as database_size;

-- 5. Slow query log (last 10 min)
SELECT COUNT(*) as slow_queries_10min FROM queries_log 
WHERE execution_time_ms > 1000 AND created_at > NOW() - INTERVAL '10 minutes';
```

---

## 5. Comandos de Rollback Rápido

### 5.1 Rollback de Deploy (API)

```bash
# Reverter para versão anterior (em segundos)
fly deploy --image $(fly image show -a zappiq-api --format json | jq -r '.Images[1].Digest')

# OU reverter via Git
git revert HEAD --no-edit
fly deploy
```

### 5.2 Rollback de Database Migration

```bash
# Se última migration quebrou
fly ssh console -a zappiq-db

# Dentro do console
psql $DATABASE_URL -c "SELECT * FROM schema_migrations ORDER BY version DESC LIMIT 1;"

# Rodar rollback manualmente (depende de migration script)
psql $DATABASE_URL -c "ROLLBACK;" 
```

**NUNCA deletar dados sem backup prévio.**

---

## 6. Escalação & Contatos

**On-Call Schedule:** [Link PagerDuty]

| Nível | Contato | Tempo Resposta |
|-------|---------|----------------|
| L1 (SRE) | slack #on-call | <5 min |
| L2 (DevOps Lead) | @rodrigo.ghetti | <15 min |
| L3 (Founder) | 📱 [phone] | <30 min |
| Vendors (Anthropic, Meta) | [Escalation emails] | N/A |

---

## 7. Checklist Pós-Incident

Após qualquer outage/error rate spike:

- [ ] Post-mortem iniciado em `/docs/incidents/YYYY-MM-DD-incident.md`
- [ ] Root cause identificado
- [ ] Fix deployado e validado
- [ ] Monitoring melhorado (nova alert adicionada se aplicável)
- [ ] Stakeholders notificados (customer via status page, internamente via Slack)
- [ ] Action items documentados em GitHub Issues

---

## 8. Contato & Updates

- **Dono:** SRE/DevOps Team
- **Última revisão:** 15 de abril de 2026
- **Próxima revisão:** 30 de maio de 2026 (pós-launch)

**Para atualizar este runbook:** criar PR em `/docs/ops/` com melhorias.

---

**Boa sorte no launch! 🚀**
