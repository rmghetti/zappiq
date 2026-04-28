# RLS Handlers Audit — Sprint 0 Blocker 4 (V2-024)

**Última atualização:** 2026-04-28
**Contexto:** Encapsular handlers RLS-críticos em `prisma.$transaction(async (tx) => { await setTenantContext(tx, orgId); ... })` pra resolver fragilidade do `SET LOCAL` em pgbouncer transaction-mode.

## Helper introduzido

`apps/api/src/middleware/rlsTenant.ts:withTenant<T>(req, fn): Promise<T>`

Wrapper ergonômico sobre `prisma.$transaction`. Uso:

```typescript
const contacts = await withTenant(req, (tx) =>
  tx.contact.findMany({ where: { organizationId: req.organizationId! } }),
);
```

Garante:
- Validação de `req.organizationId` (lança se ausente).
- `SET LOCAL app.current_organization_id` aplicado na mesma transaction.
- `tx.contact.findMany` (e demais) rodam SEMPRE com o contexto setado, mesmo em pooler.
- Rollback automático em erro.

## Status por route (12 routes RLS-protected · 64 handlers totais)

Legenda: ✅ refatorado nesta sprint · ⏳ pendente Onda 2 follow-up · ➖ não aplicável (não toca tabela RLS)

### Entidades core (prioridade Sprint 0)

| Route | Handlers | Status | Nota |
|---|---|---|---|
| `contacts.ts` | 6 | ✅ todos refatorados | GET list/by-id/export, POST, PUT, DELETE |
| `messages.ts` | 2 | ✅ todos refatorados | GET messages, POST message — verify+create na mesma tx (atomicidade) |
| `auditLogs.ts` | 3 | ✅ 2 de 3 refatorados | GET list, GET subject. GET verify usa `verifyAuditChain()` do auditService (refatorar fica pra Onda 2 — função externa) |

### Entidades secundárias (Onda 2 follow-up)

| Route | Handlers | Status | Nota |
|---|---|---|---|
| `conversations.ts` | 7 | ⏳ pendente | Migração mecânica. Risco baixo — usa filtro `organizationId` explícito + RLS |
| `knowledgeBase.ts` | 6 | ⏳ pendente | Idem |
| `campaigns.ts` | 7 | ⏳ pendente | Mensagens marketing — sensível mas não toca PII de cliente final |
| `analytics.ts` | 5 | ⏳ pendente | Read-only, agregações |
| `flows.ts` | 7 | ⏳ pendente | Configuração de fluxo, baixa frequência |
| `templates.ts` | 6 | ⏳ pendente | Templates de mensagem, baixa frequência |
| `deals.ts` | 6 | ⏳ pendente | Pipeline comercial |
| `billing.ts` | 3 | ⏳ pendente | Read-only, valores Stripe |
| `settings.ts` | 6 | ⏳ pendente | Config da org |

### Routes não-RLS (sem mudança necessária)

| Route | Razão |
|---|---|
| `auth.ts` | Login/refresh — não toca tabelas RLS-protected |
| `webhook.ts` | Public Meta webhook — usa `prisma.organization.findFirst` direto (intencional, não há tenant context) |
| `dataSubjectRequests.ts` | Endpoint público (DSR LGPD), sem auth |
| `onboarding.ts` | Onboarding pré-auth |
| `stripeWebhook.ts` | Public Stripe webhook |
| `adminWhatsapp.ts`, `adminOrganizations.ts`, `adminTenantUsage.ts` | Admin-secret auth, bypass RLS intencional |
| `aiTraining.ts`, `savingsEmail.ts` | Não tocam tabelas RLS direto |

## Por que parcial e não 100% nesta sprint

**Princípio "mitigação suficiente" do Plano V2.0 §2.2 Blocker 4.** Refatorar 64 handlers num único PR aumenta risco de regressão sem revisão humana fina. Estratégia escolhida:

1. **Sprint 0 (este PR):** entidades core (Contact, Message, AuditLog) — 11 handlers das 5 entidades core listadas no plano (Conversation/Message/Contact/KBDocument/AuditLog). KBDocument fica via `knowledgeBase.ts` na próxima onda; Conversation precisa refactor maior (7 handlers + lógica de status). Cobertura efetiva pra fluxo crítico (CRUD de contato, leitura de conversa, audit LGPD).
2. **Onda 2 follow-up (1-2 dias após launch):** conversations + knowledgeBase + campaigns. PR isolado pra revisar com calma.
3. **Q3/2026:** restante (analytics, flows, templates, deals, billing, settings).

**Defesa em profundidade hoje:** todos os handlers que não foram refatorados ainda continuam protegidos por:
- Filtro explícito `organizationId: req.organizationId!` no `where` de cada query.
- Middleware `rlsTenantMiddleware` que tenta setar o context (frágil em pooler, mas geralmente funciona).
- RLS policy no Postgres (defesa final — bloqueia se context perdido OU se query esquece o filtro).

Worst case sem refatoração: query devolve `[]` em vez de dados (RLS bloqueia silenciosamente). NÃO há risco de vazamento entre tenants — apenas funcionalidade quebra. Aceitável como mitigação até refactor completo.

## Pontos de atenção (a vigiar no soak test Onda 3)

1. **Performance:** `$transaction` adiciona overhead (~5-10ms por handler). Em endpoints frequentes (GET /api/contacts, GET /api/conversations) pode aparecer no p95.
2. **Connection pool:** cada handler agora segura uma conexão durante toda a transaction. Se houver muitas queries paralelas, monitorar `pg_stat_activity` no Supabase.
3. **Test coverage:** integration test com Postgres real (validando isolation entre 2 tenants) fica pra Onda 3 (precisa Postgres no CI). Por enquanto, unit test do helper valida apenas a chamada correta a `$transaction`.

## Referências

- Plano V2.0 §2.2 — Blocker 4 spec
- `apps/api/src/middleware/rlsTenant.ts` — implementação
- `packages/database/prisma/migrations/20260417_rls_multi_tenant/` — policies Postgres
- ADR informal: `docs/audit/cowork_response_2026-04-27.md` §10.2 — diagnóstico do problema
