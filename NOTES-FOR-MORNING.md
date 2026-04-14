# NOTES FOR MORNING — 2026-04-14

Bom dia. Tudo pronto, só falta empurrar os commits pra origem.

## Estado atual do repo local (no seu Mac, pasta `~/zappiq`)

**Branch `main`** — 7 commits novos à frente de `origin/main`, todos **seguros** (nenhuma nova dep npm, lockfile intocado):

```
b33afec feat(p5): /ready endpoint + graceful shutdown em camadas
e653f6f feat(p4): rls.sql de referencia (NAO aplicado)
5c4d5e5 chore(scripts): typecheck, test, db:deploy, db:seed, deploy:api/web
37571aa feat(rag): esqueleto FastAPI com /health, /embed, /query
886fb69 ci(p8): pipeline completo - lint/typecheck/build/test/docker + db-migrate manual
b41a94c feat(p7): infra-as-code - Fly (api+rag), Supabase/Upstash docs, Vercel
d95d8ba docs(p9): ARCHITECTURE, DEPLOY, MIGRATION, README + ADR-0001 RLS
```

**Branch `feat/p5-observability`** — 1 commit extra a partir de `main`, tem OTel + rate-limit-redis + logger traceId. **Precisa `pnpm install` antes de mergear** (adiciona 7 deps novas, lockfile desatualizado).

```
501e546 feat(p5): OpenTelemetry SDK + rate-limit-redis + logger traceId
```

## O que rodar pela manhã — 3 comandos

### 1) Push do `main` — zero risco, pode rodar antes do café

```bash
cd ~/zappiq
git push origin main
```

CI dispara automaticamente (`.github/workflows/ci.yml`). Se passar, você pode rodar `fly deploy` ou deixar CI fazer (se configurou auto-deploy). O `/ready` endpoint e o graceful shutdown novo vão pra produção — é mudança conservadora, testada mentalmente mas recomendo validar com:

```bash
curl https://zappiq-api.fly.dev/health     # deve continuar 200
curl https://zappiq-api.fly.dev/ready      # novo: 200 com checks de postgres+redis
```

### 2) Branch de observabilidade — precisa `pnpm install` antes

```bash
cd ~/zappiq
git checkout feat/p5-observability
pnpm install                                # regenera pnpm-lock.yaml com as 7 deps novas
git add pnpm-lock.yaml apps/api/pnpm-lock.yaml 2>/dev/null || git add pnpm-lock.yaml
git commit -m "chore: lockfile para OTel + rate-limit-redis"
git push -u origin feat/p5-observability
```

Depois abra PR de `feat/p5-observability` → `main` pra revisar com calma. Os riscos dessa branch são:

- **OTel SDK pode dar ruído no startup** se `OTEL_EXPORTER_OTLP_ENDPOINT` não estiver setado — fica tentando enviar pra localhost:4318 e loga warnings. Para silenciar em produção, ou configure um provider (Honeycomb/Grafana/Tempo) ou adicione `OTEL_SDK_DISABLED=true` em `fly.toml` até ter provider.
- **rate-limit-redis** reduz o limite efetivo se você rodar 2+ máquinas Fly. Hoje você tem 1, então não muda nada — só vira preparação pra escala horizontal.
- **logger JSON em prod** já era o comportamento; agora inclui `traceId` quando há span OTel ativo.

### 3) (Opcional) Ajustar Fly pra rolling deploy sem downtime

Já recomendei ontem à noite. Hoje você tem 1 máquina → todo deploy tem gap. Adicione no `fly.toml`:

```toml
[http_service]
  min_machines_running = 2
```

Custa ~U$ 3/mes a mais. Elimina o downtime.

---

## Providers OTel — escolha rápida

Se for seguir pra observabilidade completa hoje, sugestão por ordem de custo/benefício:

1. **Honeycomb** — free tier 20M events/mês (vai sobrar). Setup em 2 minutos:
   ```bash
   fly secrets set OTEL_EXPORTER_OTLP_ENDPOINT=https://api.honeycomb.io OTEL_EXPORTER_OTLP_HEADERS="x-honeycomb-team=<key>"
   ```

2. **Grafana Cloud Tempo** — se você já tem Grafana, use esse. Free tier generoso.

3. **Sentry Performance** — se você já paga Sentry pra erros, traces ficam no mesmo painel.

4. **Datadog** — parrudo mas caro, só se a empresa já usa.

---

## O que NÃO foi feito (e racional)

- **Typecheck local** — não rodei porque sandbox não tem pnpm nem acesso a registry npm. Você deveria rodar `pnpm typecheck` antes de pushar o `main`, mas as mudanças são conservadoras (imports novos + um handler async novo). Baixo risco.
- **`fly deploy`** — não rodei porque sandbox não tem `fly` CLI. Depois do `git push origin main`, seu CI pode rodar automaticamente ou rode manualmente.
- **RLS aplicado** — deixado em `packages/database/prisma/rls.sql` pra revisão humana + shadow test em staging. Ver ADR-0001.

---

## Se algo der errado

### CI falha no main
```bash
# Olhar logs
gh run list --branch main --limit 3
gh run view <id> --log-failed
```

### Deploy Fly trava no `/ready`
Supervalido: o `/ready` faz SELECT 1 no Postgres e PING no Redis. Se qualquer um falhar, retorna 503 e Fly pode tirar a máquina do load balancer. Se isso acontecer:
```bash
fly logs -a zappiq-api | grep -i "ready\|postgres\|redis"
```

### Reverter `/ready` (plano B)
```bash
git revert b33afec
git push origin main
```

---

## TL;DR

```bash
cd ~/zappiq && git push origin main
```

Isso sozinho já leva pra produção: docs + infra-as-code + CI/CD + RAG skeleton + RLS doc + scripts + `/ready` + graceful shutdown.

Depois, quando tiver 5 minutos:
```bash
git checkout feat/p5-observability && pnpm install && git add -A && git commit -m "chore: lockfile" && git push -u origin feat/p5-observability
```

E abre PR pra revisar com calma.

---

## Roadmap restante (pós-P9)

- **FASE 6 completa**: retry/backoff nos SDKs Anthropic/OpenAI (Anthropic SDK já tem `maxRetries`, só setar pra 3 no construtor).
- **RLS rollout Sprint 1**: aplicar `rls.sql` apenas em AuditLog+DSR em staging, shadow test 48h.
- **Alertas Fly**: CPU > 80%, memory > 90%, `/ready` 503 por 2min.
- **Winston → Sentry**: adicionar Sentry transport pra erros com traceId.
- **RAG**: começar ingestão real (services/rag hoje é esqueleto).
