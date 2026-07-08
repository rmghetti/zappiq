# Trial Enforcement & Conversão — Design

**Data:** 2026-07-06
**Autor:** Rodrigo Ghetti (CEO) + Claude Code
**Branch:** `feat/trial-enforcement-conversao` (worktree `.worktrees/trial-enforcement`, base `main` = `e5a9930`)
**Projeto prod (Supabase):** `hwdeezdxyphvxikvgjyf`

---

## 1. Problema (verificado empiricamente em produção)

O fim do trial de 14 dias é **rastreado** mas **não é imposto**. Uma org com trial vencido continua com acesso total à plataforma.

**Incidente confirmado** (query read-only em prod, 2026-07-06):

| Campo | Valor |
|---|---|
| Usuário | `rodrigo.ghetti@icloud.com` (role ADMIN) |
| Org | "Antonella Italian Food" (`cmpe3153b002eohhtpqxmw733`) |
| Plano | STARTER (legado, `deprecated`) |
| Trial | iniciou 2026-05-20, terminou **2026-06-03** (há **33 dias**) |
| Pagamento | `stripeSubscriptionId` = null, `paidAt` = null → **nunca pagou** |
| `subscriptionStatus` | **"trialing"** (obsoleto — o Stripe nunca atualizou porque ela nunca fez checkout) |
| `deriveLifecycleStage` ao vivo | **TRIAL_EXPIRED** |

**Achado crítico de arquitetura:** o `subscriptionStatus` está podre ("trialing" numa conta que nunca pagou). Qualquer gate que confie nesse campo cru **deixaria a conta passar**. O `deriveLifecycleStage` (`apps/api/src/services/accountLifecycle.ts:65-97`) acerta porque exige `stripeSubscriptionId` real para valer como ACTIVE. **Logo: o gate DEVE usar `deriveLifecycleStage`, nunca `subscriptionStatus` isolado.**

**Raio de impacto** (todas as orgs, estágio calculado ao vivo, 2026-07-06):

| Estágio | Orgs | Com usuários | Janela |
|---|---|---|---|
| TRIAL_EXPIRED | **8** | 7 | venceram há 21 a 86 dias |
| TRIAL (ativo) | 1 | 1 | ~11 dias restantes (Gustavo/CMJ) |
| NOVO | 8 | 8 | leads/onboarding sem trial iniciado |

No go-live, o gate barra 8 orgs (7 reais), nenhuma pagante. NOVO **não** pode ser barrado (quebraria onboarding).

---

## 2. Objetivos e não-objetivos

**Objetivos:**
1. Impor o fim do trial: conta sem plano pago ativo só acessa `/billing` (+ auth/logout/onboarding). Fronteira de segurança na **API** (402); web só espelha por UX.
2. Paywall = `/billing` turbinado: estado "seu teste terminou", **plano anual como padrão em destaque**, plano recomendado por uso, e addons compráveis.
3. Motor de recomendação de plano por perfil de uso.
4. Banner de contagem regressiva no dashboard durante o trial ("Dia X de 14 · faltam Y dias").
5. E-mails ao cliente em **T-3, T-2, T-1, T-0**.
6. Digest diário ao superadmin (e-mail `founders@` + Slack em canal dedicado) das orgs a ≤3 dias do fim.
7. Checkout self-serve de addons (inclui criar produtos/preços no Stripe).

**Não-objetivos:**
- Não mexer no roteamento de LLM, nem nos números de preço vigentes (Pricing V4).
- Não reescrever o fluxo de assinatura Stripe (funciona; `billing.ts` + `stripeWebhook.ts`).
- Não alterar planos legados (STARTER/BUSINESS) além de mapeá-los para o plano V4 mais próximo na recomendação.

---

## 3. Decisões travadas (CEO, 2026-07-06)

1. **Cutover:** carência de **7 dias** para as 8 orgs já vencidas (cortesia de migração). **Política go-forward continua dura no T-0** — os 4 e-mails (T-3…T-0) já avisam. Modelado via campo `paywallGraceUntil`, setado **só** nas orgs já vencidas na migração.
2. **Estados com bloqueio total:** `TRIAL_EXPIRED` + `CHURNED`. `PAST_DUE` recebe aviso + portal de pagamento, **sem** trava total (Stripe já está em dunning).
3. **Slack:** canal dedicado novo. Nome + webhook de entrada = passo do CEO (`.command` + Fly secret).
4. **Addons:** exibir **+ checkout self-serve completo** (requer criar price IDs de addon no Stripe — `.command` do CEO).

**Isenções do gate (sempre):** role `SUPERADMIN`; plano `ENTERPRISE` (faturado sob consulta); fluxo de onboarding/NOVO (sem `trialEndsAt` ainda).

---

## 4. Arquitetura

### 4.1 Fonte única de verdade do acesso

Novo helper puro `computeAccessState(org)` em `apps/api/src/services/accountLifecycle.ts` (ao lado de `deriveLifecycleStage`):

```
computeAccessState(org, now) -> { stage, paywall }
  stage = deriveLifecycleStage(org, now)
  // paywall: 'none' | 'soft' | 'hard' | 'past_due'
  if stage == 'PAST_DUE'                       -> paywall 'past_due'
  if stage in {'TRIAL_EXPIRED','CHURNED'}:
     if stage == 'TRIAL_EXPIRED'
        and org.paywallGraceUntil != null
        and now < org.paywallGraceUntil        -> paywall 'soft'   (carência ativa)
     else                                       -> paywall 'hard'
  else                                          -> paywall 'none'
```

- `soft` = ainda acessa, mas com banner agressivo + e-mails (só as 8 legadas, durante os 7 dias).
- `hard` = bloqueio total (402 na API / redirect no web).
- `past_due` = acessa, banner de pagamento pendente + link do portal.

Usado por **ambos** os chokepoints (API e /me), garantindo consistência e zero duplicação de regra no cliente.

### 4.2 Chokepoint API (fronteira de segurança)

Novo middleware `apps/api/src/middleware/requireActivePlan.ts`, inserido **após** `authMiddleware` + `rlsTenantMiddleware` nas rotas de produto em `apps/api/src/server.ts` (~L284-306):

```
requireActivePlan(req,res,next):
  if req.user.role == 'SUPERADMIN' -> next()
  org = loadOrgAccessFields(req.organizationId)   // cache Redis 60s, invalidado no stripeWebhook
  if org.plan == 'ENTERPRISE' -> next()
  { paywall } = computeAccessState(org, now)
  if paywall == 'hard' -> 402 { error, reason:'trial_expired'|'churned', redirectTo:'/billing' }
  req.paywall = paywall   // 'none'|'soft'|'past_due' seguem
  next()
```

**Rotas isentas do middleware** (montadas sem ele): `/api/auth/*` (me, logout, refresh), `/api/billing/*` (plans, checkout, addon-checkout, portal, subscription, usage), `/api/onboarding/*`, `/api/webhook/*` e `/api/stripe/webhook`. Toda rota de produto (contacts, conversations, campaigns, flows, settings de operação, analytics, crm, etc.) passa pelo gate.

**Kill-switch:** `TRIAL_PAYWALL_ENFORCE=0` desliga o hard-block sem redeploy (mirror dos crons existentes). Default = ligado.

**Perf:** `loadOrgAccessFields` seleciona só os campos necessários (PK indexada) com cache Redis curto (60s), invalidado quando o `stripeWebhook` muda a org. Evita findUnique por request.

### 4.3 Chokepoint Web (UX)

- `apps/api/src/routes/auth.ts` (`GET /api/auth/me`, ~L291-318): incluir no payload `organization.lifecycleStage` e `organization.paywall` (via `computeAccessState`). Sem duplicar regra no cliente.
- `apps/web/stores/authStore.ts` (`fetchMe`): já carrega a org; passa a expor `paywall`/`lifecycleStage`.
- `apps/web/components/AuthGuard.tsx` (chokepoint único do dashboard): se `paywall == 'hard'` e a rota atual não está na allowlist (`/billing`, `/billing/success`, `/billing/cancel`, `/logout`) → `router.replace('/billing?reason=trial_expired')`. Se `soft`/`past_due` → renderiza normal + monta o banner de paywall. (Rota canônica confirmada: `/billing` = `apps/web/app/(dashboard)/billing/page.tsx`.)

### 4.4 Paywall = `/billing` turbinado

`apps/web/app/(dashboard)/billing/page.tsx`:
- Novo estado de topo quando `paywall in {soft,hard}`: headline "Seu teste terminou — escolha um plano para continuar", subtítulo com o resumo de uso.
- **Toggle Mensal/Anual passa a nascer em "Anual"** (default) com selo "-20% no anual" reforçado. Os price IDs anuais já existem (`packages/shared/src/planStripeIds.ts`, modo LIVE).
- Card do **plano recomendado** com selo "Recomendado para você" + razão ("você usou ~X mensagens/mês, cabe no Growth").
- Seção de addons vira **comprável** (Fase 2, ver 4.8).
- Checkout reusa `POST /api/billing/checkout` (já suporta `cycle: 'annual'`).

### 4.5 Motor de recomendação

Novo `apps/api/src/services/planRecommendation.ts` — função pura + serviço de leitura de uso:

```
recommendPlan(usage, testedPlan) -> { planId, cycle:'annual', reasons[], addonSuggestions[] }
  // usage: aiMessages/mês projetado, contatos, atendentes, broadcasts, custo LLM, docs KB
  // 1. floorPlan = mapLegacyToV4(testedPlan)  (STARTER->IZA_LITE, BUSINESS->SCALE)
  // 2. menor plano V4 (>= floorPlan) cujos tetos cabem com folga de ~20% em todas as dimensões
  // 3. se só 1-2 dimensões estouram o plano recomendado, sugerir addon pontual em vez de subir tier
  // 4. cycle sempre 'annual' (economia destacada)
```

Sinais de uso (todos já existem): `TenantUsageMonthly` (`schema.prisma:345-374`), `llm_call_logs`, contagens de `Contact`/`User`/`Flow`/`KBDocument`, `computeBillingUsage` (`apps/api/src/routes/billingUsage.util.ts`). Tetos por plano em `packages/shared/src/planConfig.ts` (`PLAN_CONFIG`).
Exposto em `GET /api/billing/recommendation` (rota isenta do gate) → consumido pela paywall.

### 4.6 Banner de contagem regressiva

`apps/web/components/shared/TrialSavingsBanner.tsx`: mostrar "Dia X de 14 · faltam Y dias" com urgência crescente (neutro > amarelo em ≤3 > vermelho em ≤1). CTA "Escolher plano" → `/billing`. Só quando `stage == 'TRIAL'`.

### 4.7 E-mails ao cliente (T-3/T-2/T-1/T-0)

Remodelar `apps/api/src/services/trialFollowupService.ts` (cron BullMQ 14:00 UTC, já registrado):
- Trocar a cadência D+1/D+3/D+7 por `daysUntilEnd = ceil((trialEndsAt - now)/dia)`; disparar quando `daysUntilEnd ∈ {3,2,1,0}`.
- Novos templates em `apps/api/src/services/email/templates/`: `trialReminder3d`, `trialReminder2d`, `trialReminder1d`, `trialEnded` (o T-0 já anuncia o paywall + plano recomendado + destaque anual).
- Manter `trialWelcome`. Idempotência por (orgId, marco) — reusar o mecanismo de dedupe já existente no serviço.
- Provedor Resend pronto (`apps/api/src/services/email/emailProvider.ts`; `EMAIL_FROM='ZappIQ <hello@zappiq.com.br>'`).
- Copy final passa pela skill `voz-humana` (sem travessão, natural).

### 4.8 Digest superadmin + Slack

Novo `apps/api/src/services/superadminTrialDigestCron.ts` (BullMQ diário, ~13:00 UTC, registrado em `server.ts`):
- Busca orgs com `daysUntilEnd == 3` (ou ≤3 ainda não alertadas) + as em `soft` paywall (carência acabando).
- E-mail a `founders@zappiq.com.br` (template `superadminTrialDigest`) com: org, dias restantes, snapshot de uso, plano recomendado, contato do admin.
- Slack via `apps/api/src/services/slackNotifier.ts` (`sendSlackAlert` + Block Kit) para o webhook `SLACK_WEBHOOK_TRIAL_ALERTS` (canal dedicado novo). Fallback: `SLACK_WEBHOOK_QUOTA_ALERTS`.
- Kill-switch `SUPERADMIN_TRIAL_DIGEST_CRON=0`.

### 4.9 Addons self-serve (Fase 2)

- `packages/shared/src/addonStripeIds.ts` (novo): mapa `addonKey -> { productId, priceId }`, preenchido após o `.command` de criação no Stripe.
- `apps/api/scripts/createAddonStripePrices.ts` (novo): cria produtos/preços idempotentemente a partir de `ADDONS_V4_LIST` (`planConfig.ts`) usando `STRIPE_SECRET_KEY`; imprime os IDs pra popular o mapa. Entregue como `.command`.
- `POST /api/billing/addon-checkout` (novo, isento do gate): monta Checkout Session / subscription items pros addons escolhidos.
- `apps/api/src/routes/stripeWebhook.ts`: tratar line items de addon (persistir addons ativos na org).
- UI de carrinho de addons em `billing/page.tsx`.

### 4.10 Migração das 8 orgs legadas

Migração aditiva (Prisma) + script idempotente:
- Coluna `paywallGraceUntil DateTime?` em `Organization` (`schema.prisma`).
- Script `apps/api/scripts/seedPaywallGrace.ts`: `SET paywallGraceUntil = now() + interval '7 days'` nas orgs que hoje seriam `TRIAL_EXPIRED`, `paywallGraceUntil IS NULL`, não-SUPERADMIN, não-ENTERPRISE. Idempotente.
- E-mail de "aviso de introdução" (catch-up) aos 7 admins dessas orgs.

---

## 5. Modelo de dados (mudanças)

| Tabela | Mudança | Motivo |
|---|---|---|
| `organizations` | + `paywallGraceUntil DateTime?` | carência de migração das 8 legadas |
| (novo) `addonStripeIds.ts` | mapa em código | price IDs dos addons V4 |
| `organizations.settings` (JSON) | + addons ativos (merge não-destrutivo) | rastrear addons contratados |

Migrations aditivas/idempotentes (padrão do repo). Nenhuma coluna removida.

---

## 6. Fases de entrega

**Fase 1 — P0 (fecha o bug + mecânica de conversão), sem novo setup no Stripe:**
gate API + web · `computeAccessState` · migração `paywallGraceUntil` + carência das 8 · paywall `/billing` com anual default + plano recomendado · banner regressivo · e-mails T-3…T-0 · digest superadmin (e-mail; Slack se o webhook estiver setado).

**Fase 2 — Addons self-serve (depende do `.command` de Stripe do CEO):**
`createAddonStripePrices` · `addonStripeIds.ts` · `addon-checkout` + webhook · carrinho na paywall.

Fase 1 é independente e verificável sozinha. O anual já existe, então a conversão principal funciona no primeiro deploy.

---

## 7. Verificação

- **Testes unitários:** `computeAccessState` (todos os estágios + carência), `requireActivePlan` (402 vs isenções), `recommendPlan`, cadência de e-mail (T-3…T-0), digest.
- **Integração:** org expirada mockada → 402 em `/api/contacts`; 200 em `/api/billing/*`. Org em carência → 200 + `paywall:'soft'`. SUPERADMIN/ENTERPRISE → 200 sempre.
- **Prod pós-deploy (read-only + smoke):** re-rodar a query de estágio; confirmar `paywallGraceUntil` nas 8; confirmar que Antonella (incidente) fica `hard` após a carência e é redirecionada; confirmar que o trial vivo (CMJ) recebe banner + e-mails.
- **Kill-switches** testados (`TRIAL_PAYWALL_ENFORCE`, `SUPERADMIN_TRIAL_DIGEST_CRON`).

## 8. Rollout

Padrão do repo (memory `zappiq-producao-quirks`): commit+push na branch → merge `main` → Vercel (web) + `fly deploy --remote-only` (API, `release_command` roda `prisma migrate deploy`). Deploy **antes** de setar secrets é seguro (gate tem kill-switch; addon-checkout dormante sem price IDs). `.command` na Área de Trabalho para os passos do CEO: (a) Stripe addon prices, (b) Slack webhook secret, (c) rodar `seedPaywallGrace` + catch-up email.

## 9. Itens abertos (dependem do CEO)

1. **Nome do canal Slack** dedicado (proponho `#zappiq-trials`) + criar o **incoming webhook** → Fly secret `SLACK_WEBHOOK_TRIAL_ALERTS`.
2. **Rodar o `.command`** que cria os produtos/preços de addon no Stripe (usa `STRIPE_SECRET_KEY`).
3. **Aprovar a copy** dos e-mails e da paywall (passe `voz-humana`).

## 10. Riscos

- **Falso bloqueio:** se `computeAccessState` errar, trava cliente pago. Mitigação: usar `deriveLifecycleStage` (já validado em prod), isenções explícitas, kill-switch, testes de todos os estágios, validação em prod pós-deploy.
- **Perf por request:** mitigado por cache Redis 60s + select mínimo.
- **`subscriptionStatus` podre:** nunca lido isolado; sempre via `deriveLifecycleStage`.
- **Enum Vercel/Prisma drift** (memory `feedback_vercel_record_enum_missing_keys`): `paywall` é string literal, não enum Prisma — sem risco de quebra silenciosa de build.
