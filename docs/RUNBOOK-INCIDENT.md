# Runbook de Incidentes — ZappIQ

Playbook operacional para incidentes comuns. Foco: diagnóstico em <5min, mitigação em <15min, resolução ou escalação em <60min.

**Severidades:**

- **SEV1** — Outage total ou vazamento de dados. Acionar on-call imediato + comunicar diretoria.
- **SEV2** — Degradação parcial (subset de tenants, latência >3x baseline, queue backlog). Acionar on-call em horário comercial, plantão se fora.
- **SEV3** — Problema não bloqueante (métrica acima de threshold mas sem impacto de SLA). Abrir ticket, tratar em business hours.

**Canais:** `#zappiq-incidents` (Slack), pager via PagerDuty rotation `zappiq-oncall`.

---

## 1. 5xx spike na API

**Sintomas:** alerta Fly "5xx rate > 1% por 2min", usuários reportando erros, healthcheck `/health` pode estar passando ou não.

**Diagnóstico (primeiros 3 min):**

```bash
# Logs recentes com erro
fly logs -a zappiq-api | grep -E "ERROR|5[0-9][0-9]" | tail -100

# Status das machines
fly status -a zappiq-api

# Ready endpoint (mostra se Postgres/Redis estão OK)
curl -s https://zappiq-api.fly.dev/ready | jq
```

Cenários comuns:

| Sintoma nos logs | Causa provável | Ação |
|------------------|----------------|------|
| `ECONNREFUSED` para Postgres | Supabase indisponível ou connection pool exaurido | Ver seção 2 |
| `ECONNREFUSED` para Redis | Upstash indisponível ou rate limit | Ver seção 3 |
| `anthropic.APIError: rate_limit` | Claude API throttling | Ver seção 4 |
| `Out of memory` | Memory leak ou spike de tráfego | Rollout imediato + aumentar memory |
| Sem pattern claro | Code bug introduzido no último deploy | Ver seção 5 (rollback) |

**Mitigação imediata:**

Se 5xx >5% e não há diagnóstico em 5min → rollback:

```bash
fly releases -a zappiq-api          # pega o ID da release anterior saudável
fly deploy --image <previous-image-ref> -a zappiq-api
```

---

## 2. Postgres connection pool exhausted

**Sintomas:** `Error: Too many connections`, `/ready` retorna 503 com `postgres: false`, Prisma timeout.

**Diagnóstico:**

```bash
# Ver conexões ativas no Supabase
psql "$DATABASE_URL" -c "
  SELECT state, count(*), max(now() - state_change) as oldest
  FROM pg_stat_activity
  WHERE datname = current_database()
  GROUP BY state
  ORDER BY count(*) DESC;
"

# Ver queries rodando mais de 30s
psql "$DATABASE_URL" -c "
  SELECT pid, now() - query_start as duration, state, left(query, 200) as query
  FROM pg_stat_activity
  WHERE state != 'idle' AND (now() - query_start) > interval '30 seconds'
  ORDER BY duration DESC
  LIMIT 20;
"
```

**Mitigação:**

1. Kill queries travadas (apenas as que você TEM certeza que podem morrer):
   ```sql
   SELECT pg_cancel_backend(<pid>);        -- tenta cancelar
   SELECT pg_terminate_backend(<pid>);     -- mata
   ```

2. Se pool da app está legítimamente cheio (não queries travadas), reiniciar machines:
   ```bash
   fly machines restart --app zappiq-api
   ```

3. Escalar pooler do Supabase (Dashboard > Database > Connection pooling → aumentar `pool_size`).

**Pós-incidente:**
- Validar se o spike foi tráfego legítimo (precisa aumentar pool) ou bug (N+1 query, transação esquecida aberta)
- Verificar logs da aplicação por `Transaction took Xms` patterns
- Ver ADR-0001 — pooler RLS settings têm implicações aqui

---

## 3. Redis / BullMQ queue backlog

**Sintomas:** alerta "queue depth > 1000", mensagens WhatsApp atrasadas, usuários reportando "não recebi o bot".

**Diagnóstico:**

```bash
# Stats da fila
redis-cli -u "$REDIS_URL" INFO keyspace
redis-cli -u "$REDIS_URL" KEYS "bull:*:waiting" | head

# Ver a profundidade da fila principal
redis-cli -u "$REDIS_URL" LLEN "bull:message-processing:waiting"

# Failed jobs
redis-cli -u "$REDIS_URL" LLEN "bull:message-processing:failed"
```

**Cenários:**

| Sintoma | Causa provável | Ação |
|---------|----------------|------|
| `waiting` cresce, `active` ~0 | Workers caíram | Reiniciar: `fly machines restart` |
| `waiting` estável, `active` cheio, jobs lentos | Worker concurrency baixo ou jobs pesados | Aumentar concurrency no código, deploy |
| `failed` cresce | Jobs erroneando continuamente | Ver DLQ, investigar classe de erro |
| Redis `max_memory_exceeded` | Jobs não estão sendo removidos | Limpar completed/failed manualmente |

**Mitigação — drain emergencial do backlog:**

```bash
# CUIDADO: só se você confirmou que jobs duplicados/antigos podem ser descartados
redis-cli -u "$REDIS_URL" DEL "bull:message-processing:waiting"
```

NÃO faça isso sem entender o impacto — jobs de envio de mensagem descartados = mensagens perdidas.

---

## 4. Anthropic / LLM rate limit

**Sintomas:** logs com `anthropic.RateLimitError`, usuário recebe "estou com muita gente agora, volte já" do bot.

**Diagnóstico:**

```bash
fly logs -a zappiq-api | grep -E "RateLimitError|429" | tail -50
```

**Mitigação:**

1. Backoff automático já está configurado (`maxRetries: 3` no SDK, vide P6). Se ainda está pegando ratelimit muito:

2. Reduzir concurrency do worker LLM:
   ```bash
   fly secrets set BULLMQ_LLM_CONCURRENCY=5 -a zappiq-api
   fly machines restart -a zappiq-api
   ```

3. Escalar cota com Anthropic (sales): https://console.anthropic.com/settings/limits
4. Ativar fallback para modelo mais barato (Haiku) em tenants com SLA menor:
   ```bash
   fly secrets set LLM_FALLBACK_ON_RATELIMIT=claude-haiku-4-5 -a zappiq-api
   ```

**Pós-incidente:** verificar se um tenant específico está consumindo desproporcionalmente (pode ser bug de loop ou abuse).

---

## 5. Deploy ruim — rollback

**Sintomas:** deploy recente correlacionado com degradação (5xx, latência, erros específicos).

```bash
# Listar releases recentes
fly releases -a zappiq-api

# Rollback pra N-1
fly deploy --image registry.fly.io/zappiq-api:deployment-<older-hash> -a zappiq-api

# Confirmar
curl https://zappiq-api.fly.dev/health
./scripts/smoke-test.sh
```

**Comunicação:** postar em `#zappiq-incidents` com:
- O que foi observado
- Release revertida (hash + SHA git)
- Hipótese do causa raiz
- ETA para fix

---

## 6. Vazamento cross-tenant suspeito (SEV1)

**Sintomas:** usuário reporta ver dados que não são dele. Logs com query retornando dados de org diferente.

**Ações imediatas:**

1. **Isolar o tenant suspeito** (bloquear novas requests):
   ```bash
   fly secrets set BLOCKED_ORG_IDS=<org_id> -a zappiq-api
   fly machines restart -a zappiq-api
   ```

2. **Capturar evidência** — NÃO limpar logs:
   ```bash
   fly logs -a zappiq-api > /tmp/incident-$(date +%s).log
   ```

3. **Acionar DPO** (Data Protection Officer) — notificação LGPD em <72h é obrigatória se houver vazamento confirmado (Art. 48).

4. **Forensics query no Postgres:**
   ```sql
   -- Ver se RLS está ativo
   SELECT schemaname, tablename, rowsecurity
     FROM pg_tables
    WHERE schemaname = 'public' AND tablename IN ('conversations', 'messages', 'contacts');

   -- Ver últimas queries do usuário suspeito (precisa auditoria já em AuditLog)
   SELECT * FROM audit_logs
    WHERE user_id = '<uid>' AND created_at > now() - interval '24 hours'
    ORDER BY created_at DESC;
   ```

5. **Root cause analysis** em até 5 dias úteis, com relatório formal.

Ver ADR-0001 e ADR-0003 para contexto de RLS e retenção.

---

## 7. Supabase indisponível total

**Sintomas:** Supabase status page reportando outage ou Postgres 100% inacessível.

**Mitigação (sem DB não há como operar):**

1. Colocar a API em modo manutenção:
   ```bash
   fly secrets set MAINTENANCE_MODE=true -a zappiq-api
   fly machines restart -a zappiq-api
   ```
   Frontend precisa tratar 503 `{"maintenance": true}` e mostrar página de "voltamos em breve".

2. Comunicar status:
   - Tweet/LinkedIn: "Estamos enfrentando instabilidade em nosso provedor de banco de dados. Time trabalhando na resolução."
   - Email pra tenants enterprise (via Resend/Mailchimp, independente do DB).

3. Monitorar Supabase status: https://status.supabase.com

4. Se outage passar de 4h, avaliar restore em banco alternativo a partir do backup mais recente (ver ADR-0002). RTO de 4h documentado — é a hora.

---

## 8. Checklist pós-incidente

Para **TODO incidente SEV1 ou SEV2**, 24h depois:

- [ ] Timeline detalhada (sintoma → detecção → mitigação → resolução)
- [ ] Root cause analysis (5 whys)
- [ ] O que funcionou? (manter)
- [ ] O que não funcionou? (consertar)
- [ ] Action items com responsável e prazo
- [ ] Atualização do runbook (este documento) se houver gap

**Postmortem blameless** — foco em processo e sistema, não em pessoas.

Template: `docs/postmortem-template.md` (criar se não existir ainda).

---

## Apêndice: contatos e acessos

| Sistema | Acesso | Owner |
|---------|--------|-------|
| Fly.io | `fly auth login` — equipe tem acesso via OAuth | Eng Platform |
| Supabase | Dashboard via SSO | Eng Platform + DBA |
| Upstash | Dashboard | Eng Platform |
| Anthropic Console | Compartilhado | Eng Platform + COO |
| Voyage AI | Compartilhado | Eng Platform |
| PagerDuty | Rotação `zappiq-oncall` | Eng Ops |

**DPO (LGPD):** dpo@zappiq.com (resposta garantida em 4h horário comercial).
