# Trial Enforcement & Conversão — Implementation Plan (Fase 1)

> **For agentic workers:** REQUIRED SUB-SKILL: use superpowers:subagent-driven-development (recommended) ou superpowers:executing-plans. Steps usam checkbox (`- [ ]`).

**Goal:** Impor o fim do trial (conta sem plano pago só acessa `/billing`), com paywall que recomenda plano por uso e destaca o anual, banner regressivo, e-mails T-3..T-0 e alerta diário ao superadmin.

**Architecture:** Um helper puro `computeAccessState(org)` (fonte única) alimenta (a) o middleware `requireActivePlan` na API (402, fronteira de segurança) e (b) o `/api/auth/me` → `AuthGuard` no web (redirect, UX). Carência de 7 dias só para as 8 orgs já vencidas via `paywallGraceUntil`. E-mails e digest reusam a infra BullMQ/Resend/Slack existente.

**Tech Stack:** Express + TypeScript, Prisma/Postgres (Supabase), BullMQ/Redis, Vitest, Next.js 14 (App Router), Zustand, Stripe, Resend, Slack incoming webhook.

**Test cmd (API):** `pnpm --filter @zappiq/api test` · **um arquivo:** `pnpm --filter @zappiq/api exec vitest run src/<path>.test.ts`
**Convenção:** teste co-locado `*.test.ts` ao lado do source. Worktree: `.worktrees/trial-enforcement`.

---

## File Structure

**Criar:**
- `apps/api/src/services/accountAccess.ts` — `computeAccessState()` + tipos `PaywallMode`/`AccessState` (regra de paywall pura).
- `apps/api/src/services/accountAccess.test.ts` — testes de todos os estágios + carência.
- `apps/api/src/middleware/requireActivePlan.ts` — middleware de bloqueio (402) + loader com cache.
- `apps/api/src/middleware/requireActivePlan.test.ts`.
- `apps/api/src/services/planRecommendation.ts` — `recommendPlan()` puro + `buildRecommendation()` (lê uso).
- `apps/api/src/services/planRecommendation.test.ts`.
- `apps/api/src/services/superadminTrialDigestCron.ts` — cron diário e-mail+Slack.
- `apps/api/src/services/email/templates/trialReminder3d.ts`, `trialReminder2d.ts`, `trialReminder1d.ts`, `trialEnded.ts`, `superadminTrialDigest.ts`.
- `apps/api/scripts/seedPaywallGrace.ts` — seta carência das 8 legadas + catch-up email.
- `apps/web/components/shared/PaywallGate.tsx` — banner/overlay de paywall (soft/hard/past_due).
- `apps/web/app/(dashboard)/billing/RecommendationHero.tsx` — hero "seu teste terminou" + plano recomendado.

**Modificar:**
- `packages/database/prisma/schema.prisma` — + `paywallGraceUntil DateTime?` em `Organization` (+ migration).
- `apps/api/src/server.ts:283-302` — inserir `requireActivePlan` nas rotas de produto (não em billing/onboarding/auth/dsr); registrar `initSuperadminTrialDigestJob` (~L360).
- `apps/api/src/routes/auth.ts` (`/me`, ~L291-318) — incluir `lifecycleStage` + `paywall` na org.
- `apps/api/src/routes/billing.ts` — + `GET /recommendation`.
- `apps/api/src/services/trialFollowupService.ts` — cadência T-3/T-2/T-1/T-0 (troca D3/D7).
- `apps/web/stores/authStore.ts` (`fetchMe`) — expor `paywall`/`lifecycleStage`.
- `apps/web/components/AuthGuard.tsx` — redirect quando `paywall==='hard'`.
- `apps/web/app/(dashboard)/billing/page.tsx` — hero recomendação + anual default.
- `apps/web/components/shared/TrialSavingsBanner.tsx` — "Dia X de 14 · faltam Y dias".

---

## Task 1: `computeAccessState` — regra de paywall pura

**Files:**
- Create: `apps/api/src/services/accountAccess.ts`
- Test: `apps/api/src/services/accountAccess.test.ts`

- [ ] **Step 1: Failing test**

```typescript
// apps/api/src/services/accountAccess.test.ts
import { describe, it, expect } from 'vitest';
import { computeAccessState } from './accountAccess.js';

const base = { churnedAt: null, subscriptionStatus: null, stripeSubscriptionId: null,
  trialEndsAt: null, isTrialActive: false, trialConverted: false, paidAt: null,
  paywallGraceUntil: null, plan: 'IZA_LITE' as const };
const now = new Date('2026-07-06T12:00:00Z');
const past = new Date('2026-06-01T12:00:00Z');
const future = new Date('2026-07-20T12:00:00Z');

describe('computeAccessState', () => {
  it('ACTIVE pagante → paywall none', () => {
    expect(computeAccessState({ ...base, stripeSubscriptionId: 'sub_1', subscriptionStatus: 'active', now }).paywall).toBe('none');
  });
  it('TRIAL em janela → none', () => {
    expect(computeAccessState({ ...base, isTrialActive: true, trialEndsAt: future, now }).paywall).toBe('none');
  });
  it('TRIAL_EXPIRED sem carência → hard', () => {
    const s = computeAccessState({ ...base, trialEndsAt: past, now });
    expect(s.stage).toBe('TRIAL_EXPIRED'); expect(s.paywall).toBe('hard');
  });
  it('TRIAL_EXPIRED com carência ativa → soft', () => {
    expect(computeAccessState({ ...base, trialEndsAt: past, paywallGraceUntil: future, now }).paywall).toBe('soft');
  });
  it('TRIAL_EXPIRED com carência vencida → hard', () => {
    expect(computeAccessState({ ...base, trialEndsAt: past, paywallGraceUntil: past, now }).paywall).toBe('hard');
  });
  it('CHURNED → hard (ignora carência)', () => {
    expect(computeAccessState({ ...base, churnedAt: past, paywallGraceUntil: future, now }).paywall).toBe('hard');
  });
  it('PAST_DUE → past_due (não trava)', () => {
    expect(computeAccessState({ ...base, subscriptionStatus: 'past_due', now }).paywall).toBe('past_due');
  });
  it('subscriptionStatus "trialing" podre sem sub real → hard (incidente Antonella)', () => {
    const s = computeAccessState({ ...base, subscriptionStatus: 'trialing', stripeSubscriptionId: null, trialEndsAt: past, now });
    expect(s.stage).toBe('TRIAL_EXPIRED'); expect(s.paywall).toBe('hard');
  });
});
```

- [ ] **Step 2: Run — expect FAIL** (`Cannot find module './accountAccess.js'`)
Run: `pnpm --filter @zappiq/api exec vitest run src/services/accountAccess.test.ts`

- [ ] **Step 3: Implement**

```typescript
// apps/api/src/services/accountAccess.ts
import { deriveLifecycleStage, type LifecycleStage, type LifecycleInput } from './accountLifecycle.js';

export type PaywallMode = 'none' | 'soft' | 'hard' | 'past_due';
export interface AccessState { stage: LifecycleStage; paywall: PaywallMode; }
export interface AccessInput extends LifecycleInput {
  paywallGraceUntil?: Date | string | null;
}

function toDate(v: Date | string | null | undefined): Date | null {
  if (v == null) return null;
  const d = v instanceof Date ? v : new Date(v);
  return Number.isNaN(d.getTime()) ? null : d;
}

/** Fonte única da decisão de acesso. Usada pelo middleware (API) e pelo /me (web). */
export function computeAccessState(input: AccessInput): AccessState {
  const now = input.now ?? new Date();
  const stage = deriveLifecycleStage(input);
  if (stage === 'ACTIVE' || stage === 'TRIAL' || stage === 'NOVO') {
    return { stage, paywall: 'none' };
  }
  if (stage === 'PAST_DUE') return { stage, paywall: 'past_due' };
  // TRIAL_EXPIRED | CHURNED → bloqueio, com carência só p/ TRIAL_EXPIRED.
  if (stage === 'TRIAL_EXPIRED') {
    const grace = toDate(input.paywallGraceUntil);
    if (grace && grace > now) return { stage, paywall: 'soft' };
  }
  return { stage, paywall: 'hard' };
}
```

- [ ] **Step 4: Run — expect PASS**
- [ ] **Step 5: Commit** — `git add apps/api/src/services/accountAccess.* && git commit -m "feat(trial): computeAccessState (fonte única de paywall)"`

---

## Task 2: Schema — `paywallGraceUntil`

**Files:** Modify `packages/database/prisma/schema.prisma` (model `Organization`)

- [ ] **Step 1:** Adicionar campo logo após `trialCostCapUsd`:
```prisma
  paywallGraceUntil DateTime? // carência de migração (só as orgs já vencidas no go-live)
```
- [ ] **Step 2:** Gerar migration aditiva:
Run: `pnpm --filter @zappiq/database exec prisma migrate dev --name add_paywall_grace_until --create-only`
- [ ] **Step 3:** Conferir SQL gerado = só `ALTER TABLE "organizations" ADD COLUMN "paywallGraceUntil" TIMESTAMP;` (aditivo, nullable).
- [ ] **Step 4:** `pnpm --filter @zappiq/database exec prisma generate`
- [ ] **Step 5: Commit** — `git commit -am "feat(trial): coluna paywallGraceUntil (aditiva)"`

---

## Task 3: `requireActivePlan` middleware

**Files:**
- Create: `apps/api/src/middleware/requireActivePlan.ts`, `apps/api/src/middleware/requireActivePlan.test.ts`

- [ ] **Step 1: Failing test** (usa Request/Response fake)

```typescript
// apps/api/src/middleware/requireActivePlan.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';

const findUnique = vi.fn();
vi.mock('@zappiq/database', () => ({ prisma: { organization: { findUnique: (...a: any) => findUnique(...a) } } }));
vi.mock('../services/cloud/index.js', () => ({ cache: { get: vi.fn().mockResolvedValue(null), set: vi.fn().mockResolvedValue(true) } }));
vi.mock('../config/env.js', () => ({ env: { TRIAL_PAYWALL_ENFORCE: '1' } }));

import { requireActivePlan } from './requireActivePlan.js';
function mkRes() { const r: any = {}; r.status = vi.fn(() => r); r.json = vi.fn(() => r); return r; }
const past = new Date(Date.now() - 40 * 864e5);

beforeEach(() => { findUnique.mockReset(); });

describe('requireActivePlan', () => {
  it('SUPERADMIN passa sem tocar no banco', async () => {
    const next = vi.fn();
    await requireActivePlan({ user: { role: 'SUPERADMIN' }, organizationId: 'o1' } as any, mkRes(), next);
    expect(next).toHaveBeenCalledOnce(); expect(findUnique).not.toHaveBeenCalled();
  });
  it('TRIAL_EXPIRED sem carência → 402', async () => {
    findUnique.mockResolvedValue({ plan: 'IZA_LITE', trialEndsAt: past, isTrialActive: false, trialConverted: false, paidAt: null, churnedAt: null, stripeSubscriptionId: null, subscriptionStatus: 'trialing', paywallGraceUntil: null });
    const res = mkRes(); const next = vi.fn();
    await requireActivePlan({ user: { role: 'ADMIN' }, organizationId: 'o1' } as any, res, next);
    expect(res.status).toHaveBeenCalledWith(402); expect(next).not.toHaveBeenCalled();
  });
  it('ENTERPRISE isento', async () => {
    findUnique.mockResolvedValue({ plan: 'ENTERPRISE', trialEndsAt: past, isTrialActive: false, trialConverted: false, paidAt: null, churnedAt: null, stripeSubscriptionId: null, subscriptionStatus: null, paywallGraceUntil: null });
    const next = vi.fn(); await requireActivePlan({ user: { role: 'ADMIN' }, organizationId: 'o1' } as any, mkRes(), next);
    expect(next).toHaveBeenCalledOnce();
  });
  it('kill-switch off → passa sempre', async () => {
    const env = await import('../config/env.js'); (env.env as any).TRIAL_PAYWALL_ENFORCE = '0';
    const next = vi.fn(); await requireActivePlan({ user: { role: 'ADMIN' }, organizationId: 'o1' } as any, mkRes(), next);
    expect(next).toHaveBeenCalledOnce(); (env.env as any).TRIAL_PAYWALL_ENFORCE = '1';
  });
});
```

- [ ] **Step 2: Run — expect FAIL**
- [ ] **Step 3: Implement**

```typescript
// apps/api/src/middleware/requireActivePlan.ts
import type { Request, Response, NextFunction } from 'express';
import { prisma } from '@zappiq/database';
import { cache } from '../services/cloud/index.js';
import { env } from '../config/env.js';
import { logger } from '../utils/logger.js';
import { computeAccessState } from '../services/accountAccess.js';

const ACCESS_FIELDS = { plan: true, trialEndsAt: true, isTrialActive: true, trialConverted: true,
  paidAt: true, churnedAt: true, stripeSubscriptionId: true, subscriptionStatus: true, paywallGraceUntil: true } as const;
const CACHE_TTL = 60;
const key = (id: string) => `zappiq:access:${id}`;

async function loadOrgAccess(orgId: string): Promise<any | null> {
  const cached = await cache.get(key(orgId));
  if (cached) { try { return JSON.parse(cached); } catch { /* ignore */ } }
  const org = await prisma.organization.findUnique({ where: { id: orgId }, select: ACCESS_FIELDS });
  if (org) await cache.set(key(orgId), JSON.stringify(org), CACHE_TTL);
  return org;
}
export async function invalidateOrgAccess(orgId: string): Promise<void> { await cache.del?.(key(orgId)); }

export async function requireActivePlan(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    if (env.TRIAL_PAYWALL_ENFORCE === '0') return next();
    if ((req as any).user?.role === 'SUPERADMIN') return next();
    const orgId = (req as any).organizationId;
    if (!orgId) return next(); // sem org → deixa camadas anteriores decidirem
    const org = await loadOrgAccess(orgId);
    if (!org) return next();
    if (org.plan === 'ENTERPRISE') return next();
    const { stage, paywall } = computeAccessState(org);
    if (paywall === 'hard') {
      res.status(402).json({ error: 'Seu período de teste terminou. Escolha um plano para continuar.',
        reason: stage === 'CHURNED' ? 'churned' : 'trial_expired', redirectTo: '/billing' });
      return;
    }
    (req as any).paywall = paywall; // 'none' | 'soft' | 'past_due'
    next();
  } catch (err) {
    logger.error({ msg: 'requireActivePlan_error', err: String(err) });
    next(); // fail-open: nunca derruba a plataforma por erro do gate
  }
}
```

- [ ] **Step 4:** Adicionar `TRIAL_PAYWALL_ENFORCE` ao `apps/api/src/config/env.ts` (default `'1'`, tipo string). Confirmar `cache.set(key,val,ttl)` e `cache.del` existem na ICache; se `del` faltar, usar `cache.set(key,'',1)`.
- [ ] **Step 5: Run — expect PASS**
- [ ] **Step 6: Commit**

---

## Task 4: Montar o gate no `server.ts`

**Files:** Modify `apps/api/src/server.ts`

- [ ] **Step 1:** Import: `import { requireActivePlan } from './middleware/requireActivePlan.js';`
- [ ] **Step 2:** Inserir `requireActivePlan` após `rlsTenantMiddleware` nas rotas de produto L283-302 **exceto** `/api/billing` (L299). Padrão:
```typescript
app.use('/api/contacts', authMiddleware, rlsTenantMiddleware, requireActivePlan, contactsRoutes);
```
Aplicar a: contacts, conversations(x2), campaigns, analytics, flows/templates, flows, kb, ai-training, templates, deals, crm, tasks, settings, audit-logs, embedded-signup. **NÃO** aplicar a: `/api/billing`, `/api/onboarding`, `/api/auth`, `/api/dsr` (direito LGPD), `/api/admin/*` (já superadmin-gated), webhooks.
- [ ] **Step 3:** `pnpm --filter @zappiq/api exec tsc --noEmit` → sem erro.
- [ ] **Step 4:** Teste de fumaça manual documentado (curl com JWT de org expirada → 402 em `/api/contacts`, 200 em `/api/billing/plans`). Feito na verificação em prod (Task 13).
- [ ] **Step 5: Commit**

---

## Task 5: `/api/auth/me` expõe `paywall` + `lifecycleStage`

**Files:** Modify `apps/api/src/routes/auth.ts` (~L291-318)

- [ ] **Step 1:** No handler `/me`, após carregar a org, computar e anexar:
```typescript
import { computeAccessState } from '../services/accountAccess.js';
// ...
const access = computeAccessState(orgRow); // orgRow deve conter os ACCESS_FIELDS + paywallGraceUntil
const organization = { ...existingOrgPayload, lifecycleStage: access.stage, paywall: access.paywall };
```
- [ ] **Step 2:** Garantir que a query da org em `/me` inclui `paywallGraceUntil`, `paidAt`, `churnedAt`, `stripeSubscriptionId`, `subscriptionStatus`, `isTrialActive`, `trialConverted`, `trialEndsAt`, `plan` (adicionar ao `select` se estiver enxuto).
- [ ] **Step 3:** `tsc --noEmit` limpo.
- [ ] **Step 4: Commit**

---

## Task 6: Web — `AuthGuard` + store + `PaywallGate`

**Files:** Modify `apps/web/stores/authStore.ts`, `apps/web/components/AuthGuard.tsx`; Create `apps/web/components/shared/PaywallGate.tsx`

- [ ] **Step 1:** `authStore.ts`: tipar `organization.paywall: 'none'|'soft'|'hard'|'past_due'` e `organization.lifecycleStage`; já vêm do `/me`.
- [ ] **Step 2:** `AuthGuard.tsx`: após o check de auth, adicionar:
```tsx
const ALLOW = ['/billing', '/logout'];
useEffect(() => {
  if (isLoading || !isAuthenticated || !organization) return;
  if (organization.paywall === 'hard' && !ALLOW.some(p => pathname.startsWith(p))) {
    router.replace('/billing?reason=trial_expired');
  }
}, [isLoading, isAuthenticated, organization, pathname, router]);
```
- [ ] **Step 3:** `PaywallGate.tsx`: componente que, dado `paywall`, renderiza banner fixo no topo do dashboard: `soft` = "Seu teste terminou — faltam N dias de acesso. Escolha um plano." (CTA /billing); `past_due` = "Pagamento pendente" + link portal. Montar no `(dashboard)/layout.tsx`.
- [ ] **Step 4: Verificar no preview** (server web): mock de org `hard` redireciona pra /billing; `soft` mostra banner. `preview_start` + `preview_console_logs` sem erro.
- [ ] **Step 5: Commit**

---

## Task 7: Motor de recomendação

**Files:** Create `apps/api/src/services/planRecommendation.ts` + `.test.ts`; Modify `apps/api/src/routes/billing.ts` (+ `GET /recommendation`)

- [ ] **Step 1: Failing test** (função pura `recommendPlan`)

```typescript
// apps/api/src/services/planRecommendation.test.ts
import { describe, it, expect } from 'vitest';
import { recommendPlan } from './planRecommendation.js';

describe('recommendPlan', () => {
  it('uso baixo + testou STARTER → recomenda IZA_LITE anual', () => {
    const r = recommendPlan({ aiMessages: 400, contacts: 200, agents: 1, broadcasts: 50 }, 'STARTER');
    expect(r.planId).toBe('IZA_LITE'); expect(r.cycle).toBe('annual');
  });
  it('estoura mensagens do Lite → sobe pra GROWTH', () => {
    const r = recommendPlan({ aiMessages: 6000, contacts: 500, agents: 2, broadcasts: 100 }, 'STARTER');
    expect(r.planId).toBe('GROWTH');
  });
  it('nunca recomenda abaixo do plano testado (BUSINESS→SCALE)', () => {
    const r = recommendPlan({ aiMessages: 100, contacts: 10, agents: 1, broadcasts: 0 }, 'BUSINESS');
    expect(r.planId).toBe('SCALE');
  });
  it('1 dimensão estoura → sugere addon em vez de subir tier', () => {
    const r = recommendPlan({ aiMessages: 1600, contacts: 200, agents: 1, broadcasts: 50 }, 'STARTER');
    expect(r.planId).toBe('IZA_LITE'); expect(r.addonSuggestions.length).toBeGreaterThan(0);
  });
});
```

- [ ] **Step 2: Run — expect FAIL**
- [ ] **Step 3: Implement** `recommendPlan(usage, testedPlan)`:
  - `mapLegacyToV4`: `STARTER→IZA_LITE`, `BUSINESS→SCALE`, V4 mantém, `ENTERPRISE→SCALE` (piso).
  - Ordem `['IZA_LITE','GROWTH','SCALE']`; piso = índice de `mapLegacyToV4(testedPlan)`.
  - Escolhe menor plano ≥ piso cujos tetos (de `PLAN_CONFIG[p].limits`, dims aiMessagesPerMonth/contacts/agents/broadcastsPerMonth) cabem com folga 20% (`usage <= limit*0.8`, `-1`=ilimitado passa).
  - Se nenhum ≥ piso cabe totalmente, pega o maior (SCALE) e lista addons.
  - Se cabe em X mas 1-2 dims passam de `limit*0.8`, retorna X + `addonSuggestions` (AI_MSG_PACK_10K, BROADCAST_PACK_5K, CONTACTS_PACK_25K conforme a dim).
  - `cycle` sempre `'annual'`; `reasons[]` textual.
- [ ] **Step 4:** `buildRecommendation(orgId)` — lê uso real: `computeBillingUsage` (billingUsage.util) + `SUM(cost_usd_estimate)` (llm_call_logs) + contagens; chama `recommendPlan`.
- [ ] **Step 5:** `billing.ts`: `router.get('/recommendation', ...)` → `buildRecommendation(req.organizationId)`.
- [ ] **Step 6: Run — expect PASS · Commit**

---

## Task 8: Paywall UI (`/billing`) — anual default + hero recomendação

**Files:** Modify `apps/web/app/(dashboard)/billing/page.tsx`; Create `apps/web/app/(dashboard)/billing/RecommendationHero.tsx`

- [ ] **Step 1:** `cycle` inicial passa de `'monthly'` para `'annual'`; selo "-20% no anual" reforçado no toggle.
- [ ] **Step 2:** Quando `?reason=trial_expired` OU `organization.paywall in ('soft','hard')`: renderizar `RecommendationHero` no topo — headline "Seu teste terminou", card do plano recomendado (fetch `GET /api/billing/recommendation`) com selo "Recomendado para você" + razões, addons sugeridos.
- [ ] **Step 3:** Card recomendado com destaque visual; CTA "Assinar anual" chama `handleCheckout(planId,'annual')`.
- [ ] **Step 4: Verificar no preview** — hero aparece, plano recomendado bate com o mock de uso, screenshot.
- [ ] **Step 5: Commit**

---

## Task 9: Banner de contagem regressiva

**Files:** Modify `apps/web/components/shared/TrialSavingsBanner.tsx`

- [ ] **Step 1:** Render "Dia {14 - daysLeft} de 14 · faltam {daysLeft} dias" quando `lifecycleStage==='TRIAL'`. `daysLeft = ceil((trialEndsAt-now)/dia)`.
- [ ] **Step 2:** Urgência: ≤3 dias amarelo, ≤1 vermelho; CTA "Escolher plano" → `/billing`.
- [ ] **Step 3: Verificar no preview** (mock trialEndsAt a 2 dias → banner amarelo) · **Commit**

---

## Task 10: E-mails T-3/T-2/T-1/T-0

**Files:** Modify `apps/api/src/services/trialFollowupService.ts`; Create 4 templates em `apps/api/src/services/email/templates/`

- [ ] **Step 1:** Novos templates `renderTrialReminder3dEmail`/`2d`/`1d` e `renderTrialEndedEmail` (input: orgName, daysLeft, recommendedPlan, annualSavingsBrl, ctaUrl). Copy provisória (marcada `<!-- REVISAR voz-humana -->`); versão final aprovada pelo CEO (Task 14).
- [ ] **Step 2:** `TrialStage` passa a `'D1' | 'T3' | 'T2' | 'T1' | 'T0'`. Seleção de stage por `daysUntilTrialEnds(trialEndsAt)`:
  - `=== 3 → 'T3'`, `=== 2 → 'T2'`, `=== 1 → 'T1'`, `<= 0 → 'T0'` (mantém D1 por `daysSinceCreated===1`).
- [ ] **Step 3:** Cada stage: `if (await alreadySent(orgId, stage)) skip; else render+sendEmail+markSent`. Dedupe via `onboarding_journey_state` (stage é texto — sem migração).
- [ ] **Step 4:** Teste unitário: dado `trialEndsAt` a 3/2/1/0 dias, escolhe T3/T2/T1/T0; a 5 dias, nenhum novo lembrete.
- [ ] **Step 5: Run tests · Commit**

---

## Task 11: Digest superadmin (e-mail + Slack)

**Files:** Create `apps/api/src/services/superadminTrialDigestCron.ts`, `templates/superadminTrialDigest.ts`; Modify `apps/api/src/server.ts`

- [ ] **Step 1:** Cron BullMQ `superadmin-trial-digest` (repeatable `'0 13 * * *'` = 13:00 UTC), kill-switch `SUPERADMIN_TRIAL_DIGEST_CRON==='0'`. Mirror de `initTrialExpirationCronJob`.
- [ ] **Step 2:** Worker: buscar orgs com `daysUntilTrialEnds ∈ {3}` **e** as em `soft` (carência acabando); para cada, snapshot de uso + plano recomendado + contato admin.
- [ ] **Step 3:** E-mail `founders@zappiq.com.br` (`renderSuperadminTrialDigestEmail`) + `sendSlackAlert({ webhook: env.SLACK_WEBHOOK_TRIAL_ALERTS ?? env.SLACK_WEBHOOK_QUOTA_ALERTS, blocks })` (Block Kit, mirror do agentEval).
- [ ] **Step 4:** Registrar `initSuperadminTrialDigestJob().catch(...)` em `server.ts` (~L360) + import.
- [ ] **Step 5:** `SLACK_WEBHOOK_TRIAL_ALERTS` opcional em `env.ts`.
- [ ] **Step 6:** Teste unitário do seletor (org a 3 dias entra; a 5, não). **Commit**

---

## Task 12: Migração das 8 legadas + catch-up

**Files:** Create `apps/api/scripts/seedPaywallGrace.ts`

- [ ] **Step 1:** Script idempotente: para cada org onde `computeAccessState` = `TRIAL_EXPIRED` (ao vivo) **e** `paywallGraceUntil IS NULL` **e** plan≠ENTERPRISE **e** não superadmin: `UPDATE ... SET paywallGraceUntil = now() + interval '7 days'`. Suporta `--dry-run` (default) e `--apply`.
- [ ] **Step 2:** Modo `--apply` também dispara e-mail catch-up ao admin de cada org (template `trialEnded` com aviso "novo: acesso até {data}").
- [ ] **Step 3:** Log final: quantas setadas, lista de orgs. Rodar via `pnpm --filter @zappiq/api exec tsx apps/api/scripts/seedPaywallGrace.ts --dry-run`.
- [ ] **Step 4: Commit** (execução real fica no `.command` — Task 13).

---

## Task 13: Verificação em produção + `.command`s

- [ ] **Step 1:** Rodar suíte API completa: `pnpm --filter @zappiq/api test` → tudo verde (baseline + novos).
- [ ] **Step 2:** `tsc --noEmit` em api e web limpos; `prisma validate`.
- [ ] **Step 3:** Gerar `.command`s (Área de Trabalho, com chmod): (a) deploy (merge main→Vercel + `fly deploy` que aplica migration via release_command + roda `seedPaywallGrace --apply`); (b) `createAddonStripePrices` (Fase 2); (c) setar `SLACK_WEBHOOK_TRIAL_ALERTS` via `fly secrets`.
- [ ] **Step 4:** Pós-deploy (read-only via Supabase MCP): confirmar `paywallGraceUntil` setado nas 8; `computeAccessState` de Antonella = `soft` (durante 7d) → `hard` depois; trial vivo (CMJ) recebe banner/e-mail.
- [ ] **Step 5:** Smoke com JWT real: `/api/contacts` → 402 numa org já vencida fora da carência; `/api/billing/plans` → 200.

---

## Task 14: Copy final (voz-humana) — aprovação CEO

- [ ] **Step 1:** Reescrever copy dos 4 e-mails (T-3..T-0), do catch-up, do hero da paywall e do banner via skill `voz-humana` (sem travessão, natural).
- [ ] **Step 2:** Enviar ao CEO para aprovação; aplicar ajustes. **Commit** da copy final.

---

## Fase 2 (plano separado): Addons self-serve

Arquivo próprio `2026-07-06-addons-self-serve.md`. Resumo: `apps/api/scripts/createAddonStripePrices.ts` (cria produtos/preços de `ADDONS_V4_LIST` via `STRIPE_SECRET_KEY`; `.command` do CEO) → popula `packages/shared/src/addonStripeIds.ts` → `POST /api/billing/addon-checkout` + tratamento no `stripeWebhook.ts` → carrinho de addons na paywall. Dormante até os price IDs existirem, então não bloqueia a Fase 1.

---

## Self-Review (cobertura da spec)

- §4.1 computeAccessState → Task 1 ✔ · §4.2 gate API → Tasks 3-4 ✔ · §4.3 web → Tasks 5-6 ✔ · §4.4 paywall/anual → Task 8 ✔ · §4.5 recomendação → Task 7 ✔ · §4.6 banner → Task 9 ✔ · §4.7 e-mails T-3..T-0 → Task 10 ✔ · §4.8 digest+Slack → Task 11 ✔ · §4.10 migração 8 → Task 12 ✔ · §5 schema → Task 2 ✔ · §7 verificação → Task 13 ✔ · copy voz-humana → Task 14 ✔ · Fase 2 addons → plano separado ✔.
- Kill-switches (`TRIAL_PAYWALL_ENFORCE`, `SUPERADMIN_TRIAL_DIGEST_CRON`) presentes. Isenções SUPERADMIN/ENTERPRISE/onboarding/dsr explícitas. Nomes de tipo consistentes (`PaywallMode`, `AccessState`, `TrialStage`).
