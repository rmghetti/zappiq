# ADR 0001 — Row-Level Security (RLS) como camada de isolamento multi-tenant

- **Status:** Proposta (não aplicada)
- **Data:** 2026-04-13
- **Contexto:** FASE 4 — Segurança de Dados / Multi-tenancy
- **Autores:** Time de Plataforma (ZappIQ)

## 1. Contexto

O ZappIQ opera como SaaS multi-tenant. Todos os dados de negócio
(contatos, conversas, mensagens, campanhas, deals, KB, auditoria, DSR) são
escopados por `organizationId`. Hoje o isolamento é garantido **exclusivamente**
no código aplicativo: cada query Prisma recebe `where: { organizationId: req.organizationId }`.

Esse modelo funciona enquanto 100% dos acessos passam pelo caminho dourado
(middleware `authMiddleware` → route handler). Porém:

1. **Qualquer rota nova que esqueça o filtro vira vazamento cross-tenant.**
   Não há rede de segurança no banco.
2. **Jobs de background (BullMQ)** executam fora do contexto HTTP. Um bug no
   `processMessage` pode operar com `organizationId` errado.
3. **Queries raw** (`prisma.$queryRaw`) não passam pelo mesmo filtro automático.
4. **Acesso direto ao Supabase** (dashboard, psql, scripts one-off) opera como
   superuser e enxerga tudo.

Em incidente de segurança — ou auditoria LGPD (Art. 46, 48) — precisamos
demonstrar **defesa em profundidade**, não um único ponto de falha.

## 2. Decisão

Adotar **Row-Level Security (RLS) do Postgres** como segunda camada de isolamento,
ativada em todas as tabelas tenant-scoped. A aplicação continua filtrando por
`organizationId` em todas as queries (primeira camada), mas o banco passa a
**rejeitar qualquer leitura/escrita** que não case com o tenant da sessão corrente.

### 2.1 Mecanismo

- Cada request autenticada seta `SET LOCAL app.org_id = '<uuid>'` na conexão.
- Policies RLS usam `current_setting('app.org_id')::uuid` para filtrar linhas.
- Papel do Prisma no banco (`zappiq_app`) **não é superuser** e tem RLS forçado
  (`FORCE ROW LEVEL SECURITY`).
- Papel de migração (`zappiq_migrator`) bypass RLS (para `prisma db push`).
- Papel de análise read-only (`zappiq_analyst`) também bypass, com auditoria.

### 2.2 Escopo das tabelas cobertas

| Tabela | RLS | Justificativa |
|---|---|---|
| `Organization` | ❌ | Raiz do tenant; filtrada por `id`, não por `organizationId` |
| `User` | ✅ | Usuários pertencem a uma org |
| `Contact`, `Conversation`, `Message` | ✅ | Core de dados do cliente |
| `Campaign`, `Template`, `Flow` | ✅ | Configuração comercial |
| `Deal`, `Pipeline` | ✅ | Pipeline de vendas |
| `KnowledgeBase`, `KBDocument` | ✅ | Dados proprietários da org |
| `AuditLog` | ✅ | Crítico — vazamento de audit log quebra LGPD |
| `DataSubjectRequest` | ✅ | DSR de um tenant nunca deve aparecer em outro |
| `ApiKey`, `Integration` | ✅ | Credenciais sensíveis |
| `Subscription`, `Invoice` | ✅ | Dados financeiros |

### 2.3 Integração Prisma

Prisma 6 **não seta variáveis de sessão nativamente**. Solução:

```ts
// apps/api/src/middleware/tenantContext.ts
export async function withTenant<T>(orgId: string, fn: () => Promise<T>): Promise<T> {
  return prisma.$transaction(async (tx) => {
    await tx.$executeRawUnsafe(`SET LOCAL app.org_id = '${orgId}'`);
    return fn();
  });
}
```

Em rotas Express, envolver o handler:
```ts
router.get('/...', authMiddleware, (req, res, next) =>
  withTenant(req.organizationId!, async () => { /* handler */ })
);
```

Em workers BullMQ, chamar `withTenant(job.data.organizationId, ...)` no começo
de cada job.

**⚠️ Custo operacional:** todas as queries passam a rodar dentro de `$transaction`.
Isso adiciona latência (overhead de ~1ms por BEGIN/COMMIT) e consome mais
conexões do pooler. Supavisor tem que estar em modo `transaction` (padrão).

### 2.4 Migração gradual (low-risk rollout)

1. **Sprint 1:** Criar roles + aplicar `FORCE ROW LEVEL SECURITY` apenas em
   tabelas **sem escrita crítica** (AuditLog, DSR). Validar que queries existentes
   continuam passando (deveriam, pois o middleware já seta o filtro).
2. **Sprint 2:** Expandir para Contact/Conversation/Message em staging com
   shadow-testing (log de queries que seriam bloqueadas).
3. **Sprint 3:** Rollout produção com feature flag `RLS_ENABLED=true`.
4. **Sprint 4:** Remover flag e aplicar às demais tabelas.

## 3. Alternativas consideradas

### 3.1 Schema-per-tenant (Postgres schemas)
- ✅ Isolamento físico absoluto
- ❌ 1000 tenants = 1000 schemas → migrações viram pesadelo operacional
- ❌ Connection pooling fica inviável (cada tenant precisa `SET search_path`)
- ❌ Não escala para o modelo SaaS do ZappIQ

### 3.2 Database-per-tenant
- ✅ Isolamento máximo, inclusive backup e restore
- ❌ Custo Supabase/RDS multiplicado por N
- ❌ Time-to-onboard de novo cliente: minutos → horas
- ❌ Rejeitado para o tier atual; pode ser reavaliado para enterprise dedicado

### 3.3 Apenas filtro aplicativo (status quo)
- ✅ Zero complexidade adicional no banco
- ❌ **Single point of failure** — bug em 1 rota = vazamento cross-tenant
- ❌ Auditoria LGPD fraca: "confiamos que todo dev lembra do `where`"
- ❌ Não cobre acesso direto ao banco

### 3.4 Proxy de segurança na camada de pool (pgbouncer + RLS custom)
- ❌ Complexidade ops alta, pouco valor sobre RLS nativo
- ❌ Supabase não expõe pgbouncer customizável

## 4. Consequências

### Positivas
- Defesa em profundidade real (banco + aplicação)
- Mesmo bug em rota nova não gera vazamento (policy bloqueia)
- Evidência tangível para auditoria LGPD / SOC 2
- Permite abrir read-only para analistas com garantia de isolamento

### Negativas
- Todas as operações de negócio passam a rodar em transação explícita
- ~1-3ms de overhead por operação (BEGIN + SET LOCAL + COMMIT)
- Debug de "query não retorna linhas" fica mais confuso (pode ser RLS, não dado ausente)
- Requer disciplina: toda rota/worker nova tem que chamar `withTenant`
- Migrações Prisma exigem role dedicado com `BYPASSRLS`

### Mitigações
- ESLint rule custom: bloqueia `prisma.X.findMany/findFirst/...` fora de `withTenant`
- Middleware `authMiddleware` automaticamente embala o handler em `withTenant`
- Logs do Postgres em modo `log_statement = 'mod'` para detectar RLS blocks

## 5. Referências

- PostgreSQL Docs — Row Security Policies: https://www.postgresql.org/docs/current/ddl-rowsecurity.html
- Supabase RLS: https://supabase.com/docs/guides/auth/row-level-security
- Prisma + RLS (GitHub issue #5128): padrão `$transaction + SET LOCAL`
- LGPD Art. 46 (medidas técnicas de segurança) e Art. 48 (comunicação de incidentes)

## 6. SQL de referência

Ver `packages/database/prisma/rls.sql`. **Esse arquivo não é executado
automaticamente.** Ele fica versionado para revisão humana antes de qualquer
aplicação manual em staging/prod.
