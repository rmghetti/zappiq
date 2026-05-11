# Changelog

All notable changes to this project will be documented in this file.
Format based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

## [Live] — 2026-05-11 — Onda 6 Quota Management + V4-003/V4-006

### Added — Quota Management (Audit-Only Fase 1)
- **PR #111** `feat(web)`: aba "Cobrança & Limites" em `/settings` — toggle `autoOverage`, input teto BRL, slider `notifyAtPercent` (50-100). Persiste em `organization.settings.billing` JSON. Sem mudança em schema.
- **PR #149** `feat(api)`: cron BullMQ `usage-reconciliation` diário 04:00 UTC cruzando `TenantUsageMonthly × PLAN_CONFIG × settings.billing`. Decide ação por org (`no_action | notify_only | would_pause | would_charge_overage | over_ceiling`) sem executar. Estado em Redis hash (`zappiq:reconcil:{orgId}:{YYYY-MM}`, TTL 60d). Notificação Slack idempotente por threshold.
- **PR #149** `feat(api)`: `apps/api/src/services/slackNotifier.ts` — webhook helper com Block Kit + fail-soft. Env `SLACK_WEBHOOK_QUOTA_ALERTS`.
- **PR #149** `fix(api)`: wire-up de `initTenantUsageJob` (H10 unit economics) que estava órfão em `server.ts`. Cron 03:10 UTC agora rodando em prod pela primeira vez.

### Added — V4 LLM Infrastructure
- **PR #134 / V4-003** `feat(api)`: `apps/api/src/services/llm/redisBreaker.ts` — circuit breaker Redis-backed substituindo o Map in-memory. Chaves `zappiq:breaker:{providerId}:{failures|open_until|last_failure_at}` com TTLs naturais. Coordenação multi-instância Fly + sobrevive a restart. Fail-OPEN graceful em erro de Redis.
- **PR #137 / V4-006** `feat(api)`: tool/function calling no LLMRouter. Tipos `ToolDefinition`, `ToolCall`, `stopReason` em `LLMCompletionResponse`. AnthropicProvider + OpenAIProvider passam tools e extraem tool_calls. GoogleProvider ignora silenciosamente (TODO V4-006.1). Novo módulo `apps/api/src/services/llm/tools.ts` com registry + 1 tool PoC `get_org_billing_summary`. Passivo — agentOrchestrator não usa tools ainda.
- **PR #135-alt** `feat(web+api)`: endpoint `GET /api/admin/llm-health` (JWT + SUPERADMIN) + página `/admin/llm-health` com cards visuais dos providers + auto-refresh 30s. Independente de Grafana.

### Added — Landing / Marketing
- **PR #158** `feat(web)`: tier Business adicionado à tabela `/sla` com mesmos termos do Enterprise (99,9% contratual, RPO 1h, RTO 4h). CTAs finais agora duplos (Business + Enterprise). Copy ajustada pra plural.

### Changed
- **PR #134** `refactor(api)`: `LLMRouter.complete()` e `getStatus()` ficaram async. `recordFailure` no error path é fire-and-forget pra não bloquear cascade. `recordSuccess` aguarda Redis pra garantir consistência entre instâncias antes de retornar.
- **PR #134** `refactor(api)`: `apps/api/src/routes/adminLlm.ts` — `llmRouter.getStatus()` virou `await`. Mantida rota `/llm-status` com X-Admin-Secret pra curl operacional; nova rota `/llm-health` para frontend JWT.
- **`ARCHITECTURE.md`**: seção "Circuit Breaker (Futuro)" reescrita como "Circuit Breaker (Implementado — V4-003)". Adicionadas seções "Quota Management — Audit-Only Fase 1" e "Tool/Function Calling (V4-006 PoC)". Próximos Passos reescrito refletindo entregas reais e descopos estratégicos.

### Deferred — não fazer agora
- **PR #135 V4-004 (LLM streaming opt-in):** SKIPPED. WhatsApp não suporta streaming. ROI restrito a dashboard interno. Substituído por PR #135-alt.
- **PR #136 V4-005 (cloud-agnostic abstrações):** PENDENTE. Skip até sinal de migração de Fly.
- **PR #150 Quota Mgmt #7 (Self-Signup limit choice):** DEFERRED estratégico. Reativar SE primeiro cliente Business pagante pedir pré-declarar tolerância a overage no contrato.
- **PR #147 Quota Mgmt #4 (Stripe overage automation):** adiar pra ≥ 2026-05-25 (após 2 semanas de audit-only validado em prod).

### Fixed (drift descoberto durante exploração)
- Identificado: tasks #144 #146 #177 marcadas como completed em sprints anteriores não tinham código real (`UsageAlert` schema, Slack helper, wire-up do tenant-usage cron). PR #149 resolve o gap do cron órfão como bonus.

## [Pre-launch] — 2026-04-30 — Onda V2 · Dossiê Cru (52 gaps)

### Added — Conformidade & institucional
- **V2-023** `docs`: `BLOCKERS.md` com 12 bloqueadores humanos, owner, prazo e fallback técnico
- **V2-028** `feat(web)`: 5 páginas legais públicas — `/legal/termos`, `/legal/privacidade`, `/legal/cookies`, `/legal/dpa`, `/legal/fair-use`
- **V2-013** `feat(web)`: `/legal/parceria-meta` explicando BSP 360Dialog homologado (anti-publicidade enganosa)
- **V2-010 V2-050** `feat(web)`: `/legal/benchmarks-concorrentes` com metodologia pública e direito de resposta
- **V2-027** `feat(web)`: `/legal/enderecos-comerciais` (CDC Art. 39 XII)
- **V2-033** `feat(web)`: páginas institucionais `/sobre`, `/contato`, `/carreiras`
- **V2-043 V2-052** `feat(web)`: `/parceiros` com Programa ZappIQ Partners (3 tiers, até 30% recorrente)
- **V2-005 V2-007** `feat(web)`: `/founders` restruturado com 50 vagas · 30% vitalício
- **V2-048 V2-049** `feat(web)`: `/migracao-zenvia` playbook 4 fases, setup fee zero

### Added — Source-of-truth & conteúdo canônico
- **V2-001 V2-002** `feat(web)`: `apps/web/content/cases/vida-plena.ts` fonte canônica do case + flag `AUTHORIZATION_STATUS`
- **V2-009** `feat(web)`: `apps/web/content/competitor-benchmarks.ts` registry com `evidenceUrl/capturedAt/verifiedBy`
- **V2-024** `refactor(web)`: footer lista 8 módulos canônicos (ZappIQCore, PulseAI, SparkCampaigns, RadarInsights, NexusCRM, ForgeStudio, EchoCopilot, ShieldCompliance)

### Added — Back-end de segurança e resiliência
- **V2-018 V2-019** `feat(api)`: `LLMRouter` com fallback Claude Opus 4.6 → Haiku 4.5 → GPT-4o-mini + circuit breaker por provedor
- **V2-021** `feat(api)`: `AuthRevocationService` (JTI blacklist Redis + revogação user-wide)
- **V2-022** `feat(api)`: `webhookReplayProtection` middleware (janela ±5min + dedup messageId 24h)

### Added — Métricas & observabilidade
- **V2-003 V2-016** `feat(web)`: `roiMath.ts` puro + cap 300% / payback mín 90d + disclaimer metodológico no ROICalculator
- **V2-003** `test(web)`: 4 testes de ROI passando (tsx runner)

### Changed
- **V2-011** `refactor(web)`: `SocialProof` agora é trust bar de parceiros tecnológicos (Meta BSP, Anthropic, Stripe, Cloudflare, Supabase, Vercel), sem logo-washing de cliente
- **V2-025** `fix(web)`: nome "Rodrigo Ghetti" removido do papel de DPO em `/legal/dpa`, `/lgpd` e footer (LGPD Art. 41 exige independência)
- **V2-026 V2-004** `refactor(web)`: razão social canônica "ONZE E ONZE CONSULTORIA EMPRESARIAL LTDA (d.b.a. ZappIQ)" em footer, `/sobre`, `/lgpd`, `/legal/dpa`, `/legal/enderecos-comerciais`
- **V2-030** `fix(web)`: ícones sociais removidos do footer (até abertura dos perfis oficiais — B-06); substituídos por canal marketing
- **V2-034 V2-038** `refactor(web)`: links footer Documentação/API/Status apontam para subdomínios oficiais (`docs.zappiq.com.br`, `status.zappiq.com.br`)
- **V2-002 V2-035 V2-039** `fix(web)`: "Dra. Camila"/"Clínica Vida Plena" substituídos por placeholders anônimos em Hero, HeroVariantA/B/C, Products, SegmentTemplate (saúde), DemoPage, SeloPage
- **V2-014** `refactor(web)`: SocialProof cita "Parceria WhatsApp Business via BSP homologado Meta (360Dialog)" em lugar de "Parceiro Oficial Meta"

### Infrastructure
- **V2** `feat(scripts)`: `scripts/v2_regression_check.ts` com 52 assertions (gate de merge)
- **V2** `docs`: `MORNING_CHECKLIST.md`, `RELATORIO_ONDA_1.md`, `RELATORIO_ONDA_2.md`, `RELATORIO_ONDA_3.md`, `DOSSIE_V2_EXECUCAO_COMPLETA.md`

### Deferred — Bloqueadores humanos (rastreados em `BLOCKERS.md`)
- B-01 · autorização LGPD Vida Plena · B-02 · logos reais de clientes · B-03 · DPO externo · B-04 · nova razão social · B-05 · cotações concorrentes PDFs · B-06 · contas sociais · B-07 · Anthropic Enterprise · B-08 · Meta Tech Provider · B-09 · validação endereço CENU · B-10 · produção de vídeo demo · B-11 · aprovação P&L stack real · B-12 · aprovação dossiê V3.1.

---

## [Unreleased] — Onda P0 (Pre-Launch) — 2026-04-17

### Added
- **P0-04** `feat(web)`: Standalone `/precos` page resolving sitemap 404 — `19edf88`
- **P0-09** `feat(web)`: LGPD-compliant granular cookie consent banner with backward-compatible API — `d04516e`
- **P0-10** `feat(database,api)`: RLS multi-tenant isolation across 16 tables + Express middleware — `e434024`
- **P0-11** `feat(rag)`: Fly.io deploy config (`fly.toml`) and setup script for RAG service (GRU region) — `1fc02d4`
- **P0-12** `feat(rag)`: OpenTelemetry traces and metrics in RAG service (completes backend coverage) — `66faf5d`
- **P0-13** `feat(ci)`: Full CI pipeline (lint, type-check, audit, Prisma validate) + expanded deploy workflow (API + RAG + migrate) — `0d87dab`
- **P0-15** `feat(web)`: Premium landing page — trust signals, Programa Fundadores, honest content — `3b41089`

### Changed
- **P0-01** `feat(web)`: All public pages consume `planConfig.ts` as single source of truth for pricing (247/797/1697/3997) — `10f7ef8`
- **P0-02** `feat(web,api)`: Trial period unified from 21 days to 14 days across all surfaces — `640861c`
- **P0-14** `feat(scripts)`: Smoke tests expanded to 6 critical endpoints with CI-compatible exit codes — `042e9af`

### Fixed
- **P0-03** `fix(web)`: Replaced inflated vanity metrics with honest pre-launch data — `076736f`
- **P0-05** `fix(web)`: Replaced fictional case studies with honest segment-based `/cases` page — `436c3e5`
- **P0-06** `fix(web)`: Replaced placeholder WhatsApp number with real number (+55 11 94563-3305 — substituído por +55 11 92616-0159 em V5.1) — `447a3cc`
- **P0-07** `fix(web)`: Replaced `#META_PARTNER_URL` placeholder with real Meta partner directory URL — `2a04313`
- **P0-08** `fix(web)`: Footer updated with full legal info (CNPJ, CENU address, DPO contact) — `5886f6d`
