# Supabase — PostgreSQL + pgvector para ZappIQ

Documentação de setup e operação do Supabase como banco de dados principal do ZappIQ.

## Criação do Projeto

1. Acesse [supabase.com](https://supabase.com)
2. Clique em "New Project"
3. Selecione a organização ou crie uma
4. Configure:
   - **Project name**: `zappiq-prod` (ou similar)
   - **Database password**: Gere uma senha forte (salve em 1Password)
   - **Region**: Escolha `South America (São Paulo)` para latência mínima com clientes brasileiros, ou `us-east-1` se infraestrutura está nos EUA
   - **Plano**: 
     - **Free**: Até 500MB de armazenamento, bom para desenvolvimento/staging
     - **Pro**: $25/mês, 8GB armazenamento, backups automáticos, PITR (Point-in-Time Recovery), suporte prioritário — recomendado para produção

Aguarde ~3 minutos até o projeto estar pronto.

## Extensions Obrigatórias

No painel Supabase, vá para **SQL Editor** e execute:

```sql
-- Arquivo: packages/database/prisma/bootstrap.sql
-- Execute uma ÚNICA VEZ antes de rodar prisma migrate deploy

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS vector;
```

Estas extensões são necessárias para:
- `uuid-ossp`: Geração de UUIDs no banco (fallback para `cuid2` via Prisma)
- `vector`: Armazenamento e busca de embeddings (pgvector) para RAG

## Strings de Conexão

Supabase oferece **dois tipos de conexão**:

### 1. DATABASE_URL — Pooler (Supavisor)

Usar em aplicações que abrem múltiplas conexões (Next.js, Express, workers).

```
postgres://postgres.[PROJECTREF]:[PASSWORD]@db.[PROJECTREF].supabase.co:6543/postgres?pgbouncer=true&connection_limit=1
```

**Características**:
- Port `6543` (pooler)
- `?pgbouncer=true` — habilita connection pooling via pgBouncer
- `connection_limit=1` — máximo de conexões simultâneas por cliente
- Suporta até 100 conexões simultâneas no plano Free

**Pegadinha**: O Supavisor (pooler) **não suporta** `pg_advisory_lock`, que é usada por padrão em Prisma migrations. Solução: ver DIRECT_URL abaixo.

### 2. DIRECT_URL — Conexão Direta

Usar **exclusivamente** em migrations e tasks offline (sem pooling).

```
postgresql://postgres:[PASSWORD]@db.[PROJECTREF].supabase.co:5432/postgres
```

**Características**:
- Port `5432` (conexão direta)
- Sem pooling — máximo de 100 conexões simultâneas
- Suporta advisory locks para migrations
- Usar em: `prisma migrate deploy`, `prisma db push` (release_command no fly.toml)

### Configuração em Secrets

No GitHub Actions e Fly.io:

```bash
# Fly.io
flyctl secrets set DATABASE_URL='postgres://...' DIRECT_URL='postgresql://...'

# GitHub
gh secret set DATABASE_URL
gh secret set DIRECT_URL
```

## Backups e PITR

**Plano Free**: Backup automático 1x/dia, retenção 7 dias.

**Plano Pro**: 
- Backup automático a cada 6 horas
- PITR (Point-in-Time Recovery) até 30 dias atrás
- Opção de backup sob demanda

Para restore:

1. Painel Supabase → **Settings** → **Backups**
2. Escolha backup e clique "Restore"
3. Confirme (criará novo projeto com snapshot)

**Não há rollback automático** — sempre teste migrations em staging primeiro.

## Row-Level Security (RLS)

ZappIQ planejará ativar RLS na **FASE 4** (autenticação multi-tenant).

Referência: Arquitetura de Autenticação (documento futuro).

Até lá, RLS está desativado em `public` schema.

## Monitoramento e Troubleshooting

### Métricas Supabase

Dashboard Supabase → **Reports**:
- Conectados vs Máximo
- CPU, Memória
- Query performance

### Connection Timeout

**Sintoma**: `FATAL: remaining connection slots are reserved`

**Causa**: Limite de conexões simultâneas (100 em Free, mais em Pro).

**Solução**:
1. Aumente `connection_limit` em DATABASE_URL
2. Use pooling em aplicação (ex: Prisma `maxConnections`)
3. Feche conexões não-utilizadas (check logs de slow queries)

### Pool Exhaustion

**Sintoma**: Todas as conexões do pooler estão em uso; requests fila.

**Causa**: Queries lentas ou memory leaks em conexões.

**Solução**:
1. Aumente `max_pool_size` no Supavisor (dashboard → Settings → Pooling)
2. Otimize queries (índices, prepared statements)
3. Monitore logs de slow query (`pg_stat_statements`)

### pgvector Limits

`pgvector` suporta dimensionalidade até ~2000. Modelos OpenAI/Voyage geram 1536-dim vectors — está ok.

Se embeddings tiverem >2000 dim, reduza via PCA antes de armazenar.

## Backup Manual

```bash
# Exportar backup SQL
pg_dump "postgresql://..." > backup_$(date +%Y%m%d).sql

# Restaurar (na nova instância)
psql "postgresql://..." < backup_YYYYMMDD.sql
```

## Próximos Passos

- [ ] Setup extensions via SQL Editor
- [ ] Configurar backups automáticos (Pro)
- [ ] Testar migrations com `prisma migrate deploy`
- [ ] Monitorar performance nas primeiras 48h
- [ ] Documentar runbooks para restore (FASE 2)
