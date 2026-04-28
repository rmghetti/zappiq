# Soak Overnight Checklist (Sprint 0 Onda 3)

**Versão:** V2-026
**Quando executar:** sábado 10/05 18h → domingo 11/05 09h (12h+ contínuas)
**Objetivo:** validar que não há leak de memória, drift de latência, deadlock de conexão DB ou job stuck na BullMQ que só apareceria em janela longa.
**Tempo ativo:** ~10min em cada checkpoint (4 checkpoints) + análise final.

## 1. Pré-requisitos (sábado 17h45 — 15min antes do início)

- [ ] CI verde no último commit em main
- [ ] Fly api saudável: `fly status -a zappiq-api` mostra ≥2 machines healthy
- [ ] `/health` responde 200 com latência <500ms
- [ ] `/ready` responde 200 (Postgres + Redis ok)
- [ ] Grafana dashboard "ZappIQ Production Day 1" aberto e exportando
- [ ] Alertas A1–A4 configurados em Grafana Alerting + Slack `#zappiq-alerts`
- [ ] SQL client conectado ao Supabase (queries em mãos)
- [ ] Tela de logs Fly aberta: `fly logs -a zappiq-api -f`

## 2. Setup do tráfego sintético

Pra simular tráfego contínuo durante 12h sem custo absurdo, usar **k6 em rate baixo** (2–5 msg/s):

```bash
# Em terminal dedicado, rodar em background
K6_TARGET_RPS=3 \
K6_DURATION_SECONDS=43200 \
K6_TARGET_URL="https://zappiq-api.fly.dev" \
K6_META_APP_SECRET="$META_APP_SECRET" \
k6 run tools/load-test/zappiq-webhook.k6.js \
  --out json=/tmp/soak_$(date +%Y%m%d_%H%M).json &
```

3 msg/s × 12h = ~130k mensagens. Custo Anthropic ~US$ 50 (Sonnet). Aceitável pra soak.

**Alternativa sem custo:** rodar k6 em batches de 10min × 5/h, com pausas. Confere drift sem cobrir o cenário "carga sustained".

## 3. Checkpoints horários

### CHECKPOINT 1 — 21h sábado (T+3h)

| Métrica | Esperado | Como verificar |
|---|---|---|
| Latência p95 LLM | ≤ 4s | Grafana painel 1 |
| Error rate | < 0.5% | Grafana painel 2 |
| Queue depth ai-process | 0 ou ≤ 2 | Grafana painel 3 |
| Memória Fly | < 70% | `fly status -a zappiq-api` ou Grafana node-exporter |
| Conexões DB | < 60 | Supabase dashboard "Database" |
| Custo acumulado | ≤ US$ 13 | Query SQL `SUM(cost_usd_estimate)` em llm_call_logs |

```sql
-- Query sanity check
SELECT
  COUNT(*) as total_calls,
  AVG(latency_ms)::int as avg_ms,
  MAX(latency_ms) as max_ms,
  SUM(cost_usd_estimate)::numeric(10,4) as cost_usd,
  SUM(CASE WHEN fallback_triggered THEN 1 ELSE 0 END) as fallbacks
FROM llm_call_logs
WHERE created_at > NOW() - INTERVAL '3 hours';
```

**FALHA AQUI:** abortar soak, investigar via runbook on-call.

### CHECKPOINT 2 — 00h domingo (T+6h)

Mesmos campos. Compare com CHECKPOINT 1:

- Latency p95 NÃO subiu mais de 20%
- Memória Fly NÃO cresceu mais de 10pp (sinal de leak)
- Queue depth ainda em 0–2

```bash
# Compare com snapshot anterior
fly logs -a zappiq-api --since 6h | grep -c "AIProcess"
# esperado: ~65k linhas (3 msg/s × 6h × 60s × ~6 logs/processamento)
```

### CHECKPOINT 3 — 04h domingo (T+10h)

Sinal de leak/drift mais forte agora. Mesmos campos.

**Atenção especial:**
- `node_memory_MemAvailable_bytes` — se caiu mais de 30% do início, é leak
- `pg_stat_activity` count — se crescente, pool exhaustion (típico do RLS issue se algo deu errado)

```sql
-- Conexões ativas no Postgres
SELECT state, COUNT(*) FROM pg_stat_activity
WHERE datname = 'postgres' AND application_name LIKE '%zappiq%'
GROUP BY state;
```

### CHECKPOINT 4 — 09h domingo (T+15h, pré-launch)

Análise final. Critério Go-No-Go:

**GO se TODOS:**
- ✅ Latency p95 estável (sem drift > 30% vs início)
- ✅ Error rate < 0.1% (não houve regressão)
- ✅ Queue depth p95 ≤ 5 durante TODO o período
- ✅ Memória Fly estável (sem leak detectável)
- ✅ Zero exceptions críticas em Sentry
- ✅ Fallback rate < 2% (cascade Anthropic estável)
- ✅ Pool DB Postgres sem saturação
- ✅ k6 thresholds passaram (`http_req_failed: rate<0.01`)

**NO-GO se qualquer:**
- ❌ Latency p95 dobrou em algum momento
- ❌ Memória crescente sem cair (leak)
- ❌ Pool DB esgotado (>80% das conexões max)
- ❌ Mais de 3 jobs em `failed` não-recuperáveis
- ❌ Anthropic indisponível por > 5min seguidos

## 4. Comandos de cleanup pós-soak

```bash
# Mata processo k6
pkill -f "k6 run.*zappiq"

# Limpa contacts/conversations criados pelo soak
# (cuidado: filtra apenas LoadTest-* gerados pelo k6 script)
```

```sql
-- Cleanup contacts sintéticos
DELETE FROM messages WHERE "conversationId" IN (
  SELECT id FROM conversations c
  JOIN contacts ct ON c."contactId" = ct.id
  WHERE ct.name LIKE 'LoadTest-%'
);
DELETE FROM conversations WHERE "contactId" IN (
  SELECT id FROM contacts WHERE name LIKE 'LoadTest-%'
);
DELETE FROM contacts WHERE name LIKE 'LoadTest-%';

-- Mantém llm_call_logs (audit) mas pode marcar pra exclusão futura:
-- (não delete agora — análise pós-launch precisa)
```

## 5. Decisão final 09h30 domingo

Reunião 30min com você mesmo + Cowork pra revisar:

1. CHECKPOINTS 1–4: todos verde?
2. QA full pass de sexta/sábado: aprovado?
3. Load test k6 dedicado de sexta: passou?
4. Apêndice D: 100% ✅?

Se TUDO verde: **GO** pro flip `LAUNCH_MODE=live` às 10h.

Se algum falhou: **NO-GO** + decisão entre:
- (a) Fix imediato (se trivial) + retry às 14h
- (b) Adiar pra 18/05

## 6. Documentação dos resultados

Criar `docs/incidents/2026-05-11-soak-results.md` ANTES do flip:

```markdown
# Soak Overnight Results — 10-11/05/2026

## Métricas finais (CHECKPOINT 4)
- Latency p50 LLM: __ s
- Latency p95 LLM: __ s
- Latency p99 LLM: __ s
- Error rate (12h): __%
- Queue depth p95: __
- Custo total LLM: US$ __
- Mensagens processadas: __
- Fallback rate: __%

## Anomalias observadas
- (lista vazia se tudo estável)

## Decisão Go-No-Go
- [x] GO / [ ] NO-GO
- Justificativa: __

## Próximos passos
- 10h: flip LAUNCH_MODE=live
- 10h05: smoke test pós-flip (runbook §8)
```

Esse arquivo serve de baseline pro pós-launch e como evidência de gate na retro.

## 7. Refs

- `tools/load-test/zappiq-webhook.k6.js` — script k6
- `docs/operations/observability_day1.md` — queries Grafana e runbook on-call
- `docs/operations/launch_runbook_2026-05-11.md` — gate Go-Live e cronograma launch
- `docs/sprint0/qa_full_pass_roteiro.md` — validação E2E (executar antes deste)
