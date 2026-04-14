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

---

## SESSÃO ESTRATÉGICA (madrugada 2 — pós-decisões comerciais)

Decisões tomadas pelo Rodrigo: (1) executar tudo de Nível 1 e Nível 2; (2) cadastrar **+55 (11) 97210-5451** como contato primário de alerta; (3) Nível 3 — SLA, plano Enterprise, multi-region preparado mas BR-only, sem on-premise, LGPD como diferencial na landing, observabilidade como produto (Radar 360°) — default no Enterprise, add-on monetizado nos demais.

### Plano Enterprise — criado do zero

- **Pricing:** R$ 2.997/mês base + R$ 9.997 setup fee (waivable em compromisso anual). Desconto 15% anual, 25% bi-anual.
- **Posicionamento:** "competitive premium" — entre Octadesk (R$ 1,8k–3,5k) e Zendesk (R$ 3k+)/Hubspot (R$ 6k+).
- **12 categorias de feature:** capacidade ilimitada, SLA 99,9% contratual, Radar 360° incluso, SOC/NOC 24/7, onboarding white-glove, GS dedicado, LGPD Enterprise (DSR 48h, ROP customizado), retenção customizada, infra isolada (opcional), suporte 24/7 multicanal, integrações custom (40h/mês), SSO.
- **Detalhamento completo:** `docs/PRICING-STRATEGY.md` (ICP, benchmarks competitivos, KPI targets, jornada de venda).

### Radar 360° — produto de observabilidade

- **Default no Enterprise.** Add-on nos demais: R$ 197 (Starter/Growth) e R$ 397 (Scale).
- **9 módulos:** dashboards executivos, alertas inteligentes, cohort analysis, funil de conversão, churn prediction, sentiment analysis das conversas WhatsApp, performance por agente, ROI de campanhas Spark, integrações com BI (Looker/Metabase).
- **Justificativa do preço:** vs. analista de BI (R$ 8k–15k/mês) — payback claro.
- **Página dedicada:** `apps/web/app/observabilidade/page.tsx`.

### Landing page — atualizações

- **Nova página `/enterprise`** — Hero dark gradient, 4 KPIs, 8 blocos de feature, ICP, tabela de pricing 6 linhas, CTA.
- **Nova página `/observabilidade`** — Radar 360° com 9 features, 5 value points, tabela de pricing por plano com toggle.
- **Nova página `/lgpd`** — 6 artigos LGPD comentados (Art. 6, 18, 37, 46, 48, 41), 6 medidas técnicas, portal DSR, responsabilidades do cliente, CTA do DPO.
- **Nova página `/sla`** — Hero, "99,9% = 43 min/mês", tabela 4 planos, créditos por descumprimento, metodologia de mensuração, exclusões.
- **Nova section TrustAndCompliance** — 3 pilares (LGPD, SLA, Radar 360°) + 6 selos de segurança em grid escuro. Inserida entre `ROICalculator` e `Pricing` no `LandingPage.tsx`.
- **Pricing.tsx** — agora com 4 colunas (Starter, Growth, Scale, **Enterprise** com badge "Premium" e gradient escuro/âmbar). Toggle de Radar 360° por plano. Grid `md:grid-cols-2 lg:grid-cols-4`.
- **Navbar** — adicionados links `/enterprise`, `/observabilidade` (Radar 360°), `/lgpd`. Cases mantido.
- **Footer** — expandido para 6 colunas. Novas: Planos, Conformidade. 5 selos de segurança no rodapé.
- **FAQ** — expandido de 8 para 12 perguntas (LGPD, Radar Insights vs Radar 360°, plano Enterprise, SLA, contato DPO, descontos Enterprise).

### Multi-region — preparado, não ativado

- **Decisão:** atendimento BR-only nesta fase. Infra preparada para ativar regiões internacionais quando expandirmos.
- **`fly.toml`** — comentários documentando regiões standby (gig, mia, iad, cdg) e como ativar.
- **`docs/MULTI-REGION-READY.md`** — triggers de ativação, 3 opções de custo, checklist de ativação, considerações LGPD para transferência internacional Art. 33, comportamento Supabase read replicas + Upstash Global + Vercel Edge.

### LGPD — formalização

- **`docs/LGPD-ROP.md`** — Registro de Operações de Tratamento (Art. 37). 8 seções:
  - A) ZappIQ como Controladora — 4 operações (cadastro/auth, faturamento, comunicação comercial, logs técnicos)
  - B) ZappIQ como Operadora — 4 operações (conversas WhatsApp, CRM Nexus, embeddings RAG, mídias)
  - C) Transferências internacionais Art. 33 — Anthropic, OpenAI, Voyage, WhatsApp Cloud, Grafana
  - D) 11 operadores sub-encarregados com DPA/contrato
  - E) Controles de acesso interno (RLS, RBAC, audit log, MFA, segregation of duties)
  - F) Tempos de resposta DSR (15d padrão, 48h Enterprise)
  - G) Plano de resposta a incidentes (Art. 48, ANPD em 72h)
  - H) Revisão semestral
- **DPO formal:** Rodrigo Ghetti — dpo@zappiq.com — +55 (11) 97210-5451.

### SLA — formalização

- **`docs/SLA.md`** — 11 seções. Por plano: Starter/Growth best effort, Scale 99,5% alvo (sem créditos), **Enterprise 99,9% contratual (43 min/mês máx)**.
- **Créditos por descumprimento:** 10% (<99,9%), 25% (<99,0%), 50% (<95,0%) — aplicados auto na fatura seguinte.
- **RPO/RTO Enterprise:** 1h / 4h. Validação mensal via `scripts/validate-restore.sh`, trimestral via chaos engineering, anual via DR drill completo.
- **Mensuração:** healthcheck `/ready` a cada 15s multi-região. Status page público.
- **Severidades SEV1–SEV4** com tempos de primeira resposta e resolução por plano.

### Operações — Secrets Rotation Policy

- **`docs/SECRETS-ROTATION-POLICY.md`** — cadência por tipo (90/180/365 dias), 7 gatilhos de rotação emergencial, runbook bash por secret (Anthropic/OpenAI/Voyage/JWT/WhatsApp/DB/Redis), template `SECRETS-INVENTORY.md`, matriz de acesso por função, checklist de offboarding.

### Alertas — contato primário cadastrado

- **`observability/fly-alerts.md`** — adicionado bloco de escalation com Rodrigo Ghetti +55 (11) 97210-5451 / rmghetti@gmail.com.
- **3 opções técnicas para entregar SMS/ligação:** (A) Fly webhook → Twilio/Zenvia, (B) PagerDuty free tier (5 users), (C) provisório Slack + e-mail com push notification no celular.
- **Matriz de escalation por severidade:** SEV1 SMS+WhatsApp+ligar; SEV2 WhatsApp+e-mail; SEV3 Slack.

### O que rodar pela manhã (sessão estratégica)

```bash
cd ~/zappiq

# 1. Validar build local da landing
cd apps/web && pnpm run build && cd ../..

# 2. Push do que foi feito
git pull --rebase origin main
git push origin main

# 3. Deploy frontend (Vercel auto-deploy via GitHub) — esperar build verde

# 4. Configurar contato de oncall (escolher 1 das 3 opções):
#    Opção C (provisório, 0 custo): configurar e-mail rmghetti@gmail.com
#    como destino de alertas Fly + push notif no celular.
#    Opção B (recomendado curto prazo): criar conta PagerDuty free tier
#    com SMS+ligação para +55 11 97210-5451.

# 5. Atualizar status.zappiq.com.br (criar se não existir) — alinhar
#    com SLA publicado.

# 6. Treinar time comercial no novo posicionamento Enterprise:
#    R$ 2.997/mês + R$ 9.997 setup, ICP, jornada de venda.
```

### Pendências dessa sessão (curto prazo)

- ~~**CNPJ ZappIQ**~~ — **Feito.** Controladora: ONZE E ONZE CONSULTORIA EMPRESARIAL LTDA (CNPJ 46.788.145/0001-08). Atualizado em ROP, página /lgpd e Footer.
- **Pendências jurídico-financeiras destravadas pelo CNPJ** — ver `docs/PENDENCIAS-JURIDICO-FINANCEIRAS.md` (e-CNPJ A1, carta de designação do DPO, conta Stripe Business BRL). Prazo sugerido: implementar antes do primeiro contrato Enterprise fechar.
- **status.zappiq.com.br** — criar página pública (sugestão: Statuspage, Atlassian Statuspage Free, ou auto-hospedar com Cachet).
- **DPA assinados com clientes Enterprise** — template necessário para fechar primeiros contratos.
- **Página `/cases`** — Navbar referencia mas página não existe. Criar com 3 cases piloto quando houver.
- **MFA obrigatório admins Enterprise** — meta Q3/2026 conforme ROP. Implementação pendente.
- **CI/CD para frontend Vercel** — checar que branches `feat/*` viram preview deploy automático.

### Por que essas decisões — racional executivo

1. **Plano Enterprise existir desde o dia 1** — captura clientes corporativos no piloto. Quem paga Enterprise vira referência comercial. Sem tier premium, ficamos travados em SMB.
2. **Radar 360° como add-on monetizado** — observabilidade é o produto que mais gera valor percebido em B2B (insight de negócio). Cobrar por ele evita comoditização e abre upsell óbvio dos planos médios.
3. **Multi-region preparado, não ativado** — custo de ativar é alto (~+R$ 800/mês mínimo) mas custo de NÃO ter preparado quando primeiro cliente internacional aparecer é maior (refactor de DB, latência, LGPD/GDPR). Documentação + comentários no IaC = zero custo, alta opcionalidade.
4. **LGPD na landing como diferencial** — concorrentes (Octadesk, Huggy) tratam LGPD como nota de rodapé. Tratar como pilar comercial diferencia em RFP corporativo onde compliance é requisito hard.
5. **SLA público com créditos** — sinal de confiança. Quem oferece créditos automáticos demonstra que mede de verdade. Marketing assimétrico vs. concorrentes que vendem "alta disponibilidade" sem número.
