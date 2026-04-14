# NOTES FOR MORNING — 2026-04-14

Bom dia. Estado final depois da sessão noturna.

## Resumo executivo em 30 segundos

1. `main` está à frente de `origin/main` com ~18 commits. SSH já configurado (via `SETUP-SSH.command`). Push funciona direto.
2. `feat/p5-observability` tem OTel + rate-limit-redis. **Precisa `pnpm install` local antes de pushar** — mexe em `package.json`.
3. `feat/p8-ci` tem os workflows `.github/workflows/*`. SSH agora libera o push (antes era bloqueado pelo PAT sem `workflow` scope).
4. RAG `/ingest` real foi adicionado — **requer `pip install -r services/rag/requirements.txt`** + aplicar `packages/database/prisma/rag_pgvector.sql` no Supabase antes de subir o serviço RAG. Main compila sem isso (Python service é isolado do Node).
5. Novo hoje: ADR-0004 (RAG architecture), RUNBOOK-INCIDENT, Grafana dashboard + README, Fly alerts docs, .env.example consolidado, validate-restore.sh, precommit.sh, docker-compose.local.yml.

---

## O que rodar pela manhã — ordem exata

### 1) Push do `main` (SSH já pronto)

```bash
cd ~/zappiq
git pull --rebase origin main 2>/dev/null || true
git push origin main
```

Validar em produção:

```bash
curl https://zappiq-api.fly.dev/health   # 200
curl https://zappiq-api.fly.dev/ready    # 200 com {postgres, redis}
./scripts/smoke-test.sh                  # suite completa
```

Se `fly.toml` mudou: `fly deploy -a zappiq-api` (ou deixar CI rodar depois do passo 2).

### 2) Push do `feat/p8-ci`

```bash
git push -u origin feat/p8-ci
```

Libera os workflows. Abrir PR `feat/p8-ci` → `main`, mergear.

### 3) Branch de observabilidade (precisa `pnpm install`)

```bash
git checkout feat/p5-observability
pnpm install                             # regenera lockfile com 7 deps OTel
git add pnpm-lock.yaml
git commit -m "chore: lockfile OTel + rate-limit-redis"
git push -u origin feat/p5-observability
```

### 4) RAG — aplicar migração e subir serviço

```bash
# Aplicar SQL pgvector no Supabase (idempotente)
DATABASE_URL="..." ./scripts/apply-rag-migration.sh

# Subir serviço Python
cd services/rag
pip install -r requirements.txt
fly secrets set VOYAGE_API_KEY=... -a zappiq-rag
fly deploy --config fly.toml
```

### 5) Grafana Cloud — importar dashboard

- Criar conta free tier: https://grafana.com/auth/sign-up/create-user
- Gerar token OTLP (Access Policies → metrics:write + traces:write)
- `fly secrets set OTEL_EXPORTER_OTLP_ENDPOINT=... OTEL_EXPORTER_OTLP_HEADERS=... -a zappiq-api`
- Grafana → Dashboards → Import → `observability/grafana-dashboard.json`

Detalhes em `observability/README.md`.

### 6) Alertas Fly

Seguir `observability/fly-alerts.md`. 7 alertas recomendados (CPU, mem, crash, deploy, /ready, 5xx, min_machines).

---

## O que já foi feito nesta sessão (madrugada)

- **P1 LGPD** — já em produção desde ontem
- **P4 RLS** — SQL de referência, ADR-0001 documentando rollout em sprint
- **P5 Resiliência** — `/ready` endpoint + graceful shutdown em 5 fases + timeout 30s
- **P5 Observabilidade** — OTel SDK + traceId em logs (branch separada)
- **P6 Retry Anthropic** — `maxRetries: 3` + `timeout: 60s` explícitos
- **P7 Infra-as-code** — Fly (api+rag), docs Supabase/Upstash, Vercel
- **P8 CI/CD** — workflows lint/typecheck/build/test/docker + db-migrate manual
- **P9 Docs** — ARCHITECTURE, DEPLOY, MIGRATION, README
- **P10 Backup/Restore** — ADR-0002 com RPO/RTO, 3 tiers (PITR + dump semanal S3)
- **ADR-0003** — audit retention, hot/warm/cold/delete + DSR anonimização
- **ADR-0004** — RAG architecture (Voyage, pgvector HNSW, multi-tenant, DSR)
- **RAG `/ingest` real** — PyMuPDF + chunk por tokens + Voyage/OpenAI + upsert pgvector idempotente + DELETE por namespace/source (DSR)
- **Fly rolling deploy** — min_machines_running=2, auto_stop=false, [checks.ready]
- **RUNBOOK-INCIDENT** — 8 cenários com diagnóstico + mitigação (5xx, Postgres, Redis, LLM rate limit, deploy ruim, cross-tenant, Supabase outage, post-incident)
- **Grafana dashboard** — Golden Signals + Recursos + Postgres/Redis/BullMQ + LLM/RAG + Tempo trace search
- **Fly alerts** — 7 alertas documentados (CPU, memory, crash, deploy, /ready, 5xx, min_machines)
- **`.env.example`** — consolidado com Voyage, OTel, BullMQ concurrency, BLOCKED_ORG_IDS, backups
- **scripts/validate-restore.sh** — restore mensal do S3 em sandbox com 8 smoke tests SQL + medição RTO
- **scripts/precommit.sh** — typecheck + lint + format check + secret scan local
- **scripts/smoke-test.sh** — post-deploy validation com suite de curls
- **docker-compose.local.yml** — Postgres pgvector + Redis + Mailhog para dev local
- **SETUP-SSH.command** — executado com sucesso. SSH configurado.

---

## O que NÃO foi feito (e racional)

- **Typecheck local** — sandbox sem pnpm/registry. Rodar `./scripts/precommit.sh` antes do push pra confirmar.
- **`fly deploy`** — sandbox sem fly CLI. Rodar manual após push.
- **RLS aplicado em prod** — ADR-0001 manda shadow test 48h em staging. Sprint 1 do rollout.
- **Push do sandbox pra GitHub** — sandbox bloqueia git push. Rodar `git push origin main` do seu terminal (SSH já configurado).

---

## Se algo der errado

### CI falha no main
```bash
gh run list --branch main --limit 3
gh run view <id> --log-failed
```

### Deploy Fly trava no `/ready`
```bash
fly logs -a zappiq-api | grep -i "ready\|postgres\|redis"
```

### Reverter `/ready` (plano B)
```bash
git revert 3313404
git push origin main
```

### Push falha com "failed to push some refs"
```bash
git pull --rebase origin main
git push origin main
```

### RAG não sobe
Ver `services/rag/main.py` + `services/rag/requirements.txt`. Provável: `VOYAGE_API_KEY` não setado OU SQL pgvector não aplicado.

```bash
# Validar schema RAG
psql "$DATABASE_URL" -c "\dt rag_chunks"
psql "$DATABASE_URL" -c "SELECT extname FROM pg_extension WHERE extname='vector';"
```

---

## TL;DR — sequência de comandos

```bash
cd ~/zappiq

# 1. Push main (SSH já pronto)
git push origin main

# 2. Push CI branch
git push -u origin feat/p8-ci

# 3. OTel branch (precisa pnpm install primeiro)
git checkout feat/p5-observability
pnpm install && git add pnpm-lock.yaml && git commit -m "chore: lockfile OTel"
git push -u origin feat/p5-observability

# 4. Validar prod
curl https://zappiq-api.fly.dev/ready
./scripts/smoke-test.sh

# 5. (opcional) Setup Grafana + alertas Fly — ver docs observability/
```

---

## Roadmap pós-push matinal

- **RLS rollout Sprint 1** — aplicar `rls.sql` em AuditLog+DSR em staging, shadow test 48h
- **Alertas Fly** — criar os 7 via dashboard conforme `observability/fly-alerts.md`
- **Grafana Cloud** — importar dashboard, configurar OTLP endpoint
- **Husky precommit** — amarrar `scripts/precommit.sh` ao hook
- **Validate-restore mensal** — agendar `scripts/validate-restore.sh` em cron (ou Fly machine scheduled)
