# NOTES FOR MORNING — 2026-04-14

Bom dia. Estado final depois da sessão noturna.

## Resumo executivo em 30 segundos

1. `main` tem **13 commits** à frente de origin. Nenhum mexe em lockfile do Node. Seguros.
2. `feat/p5-observability` tem OTel + rate-limit-redis. **Precisa `pnpm install` local antes de pushar** — mexe em `package.json`.
3. `feat/p8-ci` tem os workflows `.github/workflows/*`. **Precisa PAT com `workflow` scope** (ou SSH) — seu PAT atual recusou o push ontem.
4. RAG `/ingest` real foi adicionado — **requer `pip install -r services/rag/requirements.txt`** + aplicar `packages/database/prisma/rag_pgvector.sql` no Supabase antes de subir o servico RAG. Main compila sem isso (Python service e isolado do Node).

## O que rodar pela manhã — ordem exata

### 1) Primeiro: arrumar o PAT (5 minutos)

Seu push HTTPS falhou ontem porque o PAT não tem `workflow` scope. Duas opções:

**Opção A — atualizar PAT existente:**
1. Abrir https://github.com/settings/tokens
2. Clicar no token que você usa pra `git push`
3. Marcar checkbox **`workflow`** (Update GitHub Action workflows)
4. Salvar. Usar o mesmo token no próximo push.

**Opção B — usar SSH (recomendada, uma vez só pra sempre):**
```bash
# Se ainda não tem chave:
ssh-keygen -t ed25519 -C "rmghetti@gmail.com"
cat ~/.ssh/id_ed25519.pub   # copia e cola em github.com/settings/ssh

# Mudar remote pra SSH:
cd ~/zappiq
git remote set-url origin git@github.com:<owner>/zappiq.git
```

### 2) Push do `main` — zero risco

```bash
cd ~/zappiq
git pull --rebase origin main 2>/dev/null || true
git push origin main
```

Os 13 commits que vão subir:

```
9316675 feat(rag): /ingest + /query reais com PyMuPDF, Voyage/OpenAI, pgvector HNSW
98df10f docs: NOTES-FOR-MORNING atualizado com PAT workflow scope + sequencia final
099e8d8 docs(p1): ADR-0003 audit log retention policy (hot/warm/cold/delete)
fdf825c docs(p10): ADR-0002 backup & restore strategy
479b45e ops(fly): rolling deploy sem downtime + health check em /ready
032e2cd feat(p6): Anthropic SDK retry + timeout explicitos
456f2d1 docs: NOTES-FOR-MORNING com runbook de push (v1)
3313404 feat(p5): /ready endpoint + graceful shutdown em camadas
93d410e feat(p4): rls.sql de referencia (NAO aplicado)
201c88a chore(scripts): typecheck, test, db:deploy, db:seed, deploy:api/web
36ccde0 feat(rag): esqueleto FastAPI com /health, /embed, /query
b41a94c feat(p7): infra-as-code - Fly (api+rag), Supabase/Upstash docs, Vercel
d95d8ba docs(p9): ARCHITECTURE, DEPLOY, MIGRATION, README + ADR-0001 RLS
```

Validar em produção:

```bash
curl https://zappiq-api.fly.dev/health   # 200
curl https://zappiq-api.fly.dev/ready    # 200 com {postgres, redis} checks
```

Se `fly.toml` foi atualizado, rodar `fly deploy` manualmente (ou deixar CI rodar após o passo 4).

### 3) Push do `feat/p8-ci` — DEPOIS de arrumar o PAT

```bash
cd ~/zappiq
git push -u origin feat/p8-ci
```

Isso libera os workflows (`.github/workflows/ci.yml`, `db-migrate.yml`). Depois abra PR `feat/p8-ci` → `main`, mergeie.

### 4) Branch de observabilidade — precisa `pnpm install` antes

```bash
cd ~/zappiq
git checkout feat/p5-observability
pnpm install                             # regenera lockfile com 7 deps OTel
git add pnpm-lock.yaml
git commit -m "chore: lockfile para OTel + rate-limit-redis"
git push -u origin feat/p5-observability
```

Abrir PR pra revisar com calma. Riscos:

- **OTel sem endpoint configurado** loga warnings. Setar `OTEL_SDK_DISABLED=true` no Fly até ter provider (Honeycomb free tier resolve).
- **rate-limit-redis** só importa com 2+ máquinas. Agora que `min_machines_running=2`, faz diferença de verdade — limite compartilhado entre as duas.
- **logger JSON** agora inclui `traceId` quando há span ativo.

---

## O que já foi feito nesta sessão (madrugada)

- **P1 LGPD** — já em produção desde ontem
- **P4 RLS** — SQL de referência em `packages/database/prisma/rls.sql`, ADR-0001 documentando rollout em sprint
- **P5 Resiliência** — `/ready` endpoint + graceful shutdown em 5 fases (http → socket → BullMQ → Prisma → Redis) + timeout 30s
- **P5 Observabilidade** — OTel SDK + traceId em logs (branch separada, precisa `pnpm install`)
- **P6 Retry Anthropic** — `maxRetries: 3` + `timeout: 60s` explícitos no SDK
- **P7 Infra-as-code** — Fly (api+rag), docs Supabase/Upstash, Vercel
- **P8 CI/CD** — workflows lint/typecheck/build/test/docker + db-migrate manual (branch feat/p8-ci)
- **P9 Docs** — ARCHITECTURE, DEPLOY, MIGRATION, README
- **P10 Backup/Restore** — ADR-0002 com RPO/RTO, 3 tiers (PITR + dump semanal S3)
- **ADR-0003 Audit retention** — hot/warm/cold/delete tiers, cron BullMQ, DSR anonimização
- **Fly rolling deploy** — `min_machines_running=2`, `auto_stop_machines=false`, `[checks.ready]` gating cutover

---

## O que NÃO foi feito (e racional)

- **Typecheck local** — sandbox sem pnpm/registry. Mudanças em `main` são conservadoras, mas rode `pnpm typecheck` antes do push pra confirmar.
- **`fly deploy`** — sandbox sem fly CLI. Rodar manual após push ou deixar CI (depois que feat/p8-ci mergear).
- **RLS aplicado em prod** — ADR-0001 manda shadow test 48h em staging. Sprint 1 do rollout.
- **services/rag /ingest real** — **FEITO**. PyMuPDF + chunk por tokens + Voyage/OpenAI + upsert pgvector. Pendencias no seu lado:
  1. `pip install -r services/rag/requirements.txt` (voyageai, pymupdf, pgvector, asyncpg, tiktoken)
  2. Aplicar SQL em `packages/database/prisma/rag_pgvector.sql` no Supabase (`CREATE EXTENSION vector` + tabela + HNSW index)
  3. `fly secrets set VOYAGE_API_KEY=... -a zappiq-rag` (ou OPENAI_API_KEY + EMBEDDING_PROVIDER=openai)
  4. Rodar `fly deploy --config services/rag/fly.toml` (se ja tem o config, senao usar infra-as-code de P7)

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

### Custo dos 2 machines subiu mais do que o esperado
```bash
# Voltar pra 1 machine temporariamente:
# Em fly.toml: auto_stop_machines=true, min_machines_running=1
fly deploy
```

---

## Providers OTel — escolha rápida

1. **Honeycomb** — free tier 20M events/mês. `fly secrets set OTEL_EXPORTER_OTLP_ENDPOINT=https://api.honeycomb.io OTEL_EXPORTER_OTLP_HEADERS="x-honeycomb-team=<key>"`
2. **Grafana Cloud Tempo** — se já tem Grafana
3. **Sentry Performance** — se já paga Sentry
4. **Datadog** — só se a empresa já banca

---

## Roadmap pós-push matinal

- **RLS rollout Sprint 1** — aplicar `rls.sql` em AuditLog+DSR em staging, shadow test 48h
- **Alertas Fly** — CPU > 80%, memory > 90%, `/ready` 503 por 2min
- **Winston → Sentry** — transport pra erros com traceId
- **services/rag /ingest** — PyMuPDF + chunking + embeddings + pgvector upsert
- **Typecheck CI** — depois que feat/p8-ci mergear, CI valida PRs

---

## TL;DR — sequência de comandos

```bash
# 1. Arrumar PAT (github.com/settings/tokens, check `workflow`)

# 2. Push main
cd ~/zappiq && git push origin main

# 3. Push CI branch (precisa PAT com workflow scope)
git push -u origin feat/p8-ci

# 4. OTel branch (precisa pnpm install)
git checkout feat/p5-observability
pnpm install && git add pnpm-lock.yaml && git commit -m "chore: lockfile OTel"
git push -u origin feat/p5-observability

# 5. Validar prod
curl https://zappiq-api.fly.dev/ready
```
