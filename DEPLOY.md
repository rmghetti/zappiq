# DEPLOY.md — Runbook ZappIQ

## Escopo

Guia passo-a-passo para primeiro deploy em produção: Supabase (DB) → Upstash (Redis) → Fly API → Vercel Web → Cloudflare DNS.

**Tempo estimado:** 2–3 horas (incluindo criação de contas).

**Pré-requisitos:**
- Contas criadas em: Fly.io, Vercel, Supabase, Upstash, Cloudflare, Anthropic, Meta for Developers, Stripe
- Git + CLI tools: `flyctl`, `vercel` CLI (opcionais mas recomendados)
- Domínio registrado (ex: zappiq.com.br)
- API keys rotacionadas (vide `KEYS_ROTATION_CHECKLIST.md`)

---

## Etapa 1: Supabase PostgreSQL + pgvector

### 1.1 Criar projeto

1. Acesse https://supabase.com/dashboard
2. Clique em "New Project"
3. Configure:
   - **Name:** `zappiq-prod`
   - **Database Password:** gere senha forte (mín. 16 chars, mix)
   - **Region:** São Paulo (sa-east-1, menor latência Brasil)
   - **Compute:** Starter (upsizável depois)
4. Aguarde provisionamento (~3 min)

### 1.2 Habilitar extensões

1. Acesse "SQL Editor"
2. Selecione "New query"
3. Cole:
   ```sql
   CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
   CREATE EXTENSION IF NOT EXISTS vector;
   ```
4. Clique "RUN"

**Critério de sucesso:** Query executa sem erro.

### 1.3 Capturar connection strings

1. Acesse "Settings" → "Database"
2. Copie:
   - **Pooled connection** (port 6543, Supavisor):
     ```
     postgresql://postgres.xyzabc:[PASSWORD]@aws-0-sa-east-1.pooler.supabase.com:6543/postgres
     ```
     → Salve em `DATABASE_URL` no Fly.io
   - **Direct connection** (port 5432, session):
     ```
     postgresql://postgres.xyzabc:[PASSWORD]@aws-0-sa-east-1.db.supabase.com:5432/postgres
     ```
     → Salve em `DIRECT_URL` no Fly.io

**⚠️ Nota PRISMA_SCHEMA_DISABLE_ADVISORY_LOCK:**
Supabase Supavisor não suporta `pg_advisory_lock`. Ao fazer migrations em release machine (isolada), use:
```bash
PRISMA_SCHEMA_DISABLE_ADVISORY_LOCK=1 prisma db push --skip-generate --accept-data-loss
```
Já configurado em `fly.toml` release command.

### 1.4 Testar conexão local

Opcional, mas recomendado:
```bash
export DATABASE_URL="postgresql://...@pooler..." 
export DIRECT_URL="postgresql://...@db..."
pnpm db:generate
pnpm db:deploy
```

**Critério de sucesso:** Migrations rodam sem erro.

---

## Etapa 2: Upstash Redis

### 2.1 Criar banco Redis

1. Acesse https://console.upstash.com/
2. Clique em "Create Database"
3. Configure:
   - **Name:** `zappiq-prod`
   - **Region:** São Paulo (sa-east-1)
   - **Type:** Fixed (ou Pay-as-you-go se volume imprevisível)
4. Confirme criação

### 2.2 Capturar connection string

1. Acesse o banco criado
2. Clique em "Details"
3. Copie **Redis URL (TLS):**
   ```
   redis://default:[TOKEN]@us1-bright-...upstash.io:6379
   ```
   → Salve em `REDIS_URL` no Fly.io

**Critério de sucesso:** URL contém `default:[token]@...upstash.io`.

### 2.3 Testar conexão (opcional)

```bash
redis-cli -u "redis://..." ping
# Resposta esperada: PONG
```

---

## Etapa 3: Fly.io API

### 3.1 Setup CLI

```bash
brew install flyctl  # macOS
# ou
curl -L https://fly.io/install.sh | sh  # Linux/WSL
flyctl auth login
```

### 3.2 Criar app

```bash
cd /path/to/zappiq
flyctl apps create zappiq-api --region gru
```

**Critério:** App criado, vá a https://fly.io/apps/zappiq-api/

### 3.3 Setar secrets

```bash
flyctl secrets set -a zappiq-api \
  DATABASE_URL="postgresql://..." \
  DIRECT_URL="postgresql://..." \
  REDIS_URL="redis://..." \
  NODE_ENV="production" \
  PORT="3001" \
  JWT_SECRET="$(openssl rand -base64 64)" \
  ANTHROPIC_API_KEY="sk-ant-..." \
  WHATSAPP_ACCESS_TOKEN="EAAx..." \
  WHATSAPP_WEBHOOK_VERIFY_TOKEN="token_xyz" \
  WHATSAPP_BUSINESS_ACCOUNT_ID="123456" \
  STRIPE_SECRET_KEY="sk_live_..." \
  STRIPE_WEBHOOK_SECRET="whsec_..." \
  GOOGLE_CLIENT_ID="...apps.googleusercontent.com" \
  GOOGLE_CLIENT_SECRET="GOCSPX-..." \
  NEXT_PUBLIC_APP_URL="https://zappiq.vercel.app" \
  CORS_ORIGINS="https://zappiq.vercel.app,https://zappiq.com.br"
```

**⚠️ IMPORTANTE:** Cada secret é criptografado. Nunca cole em terminal compartilhado.

### 3.4 Deploy primeira imagem

```bash
flyctl deploy -c fly.toml --remote-only
```

Monitorar logs em tempo real:
```bash
flyctl logs -a zappiq-api
```

Aguarde "v1 became available" (2–5 min, primeira build é lenta).

**Critério de sucesso:**
```bash
curl https://zappiq-api.fly.dev/health
# Esperado:
# {
#   "status": "ok",
#   "service": "zappiq-api",
#   "version": "2.0.0",
#   "uptime": 45,
#   "environment": "production"
# }
```

### 3.5 Verificar release migrations

```bash
flyctl logs -a zappiq-api | grep -i "prisma\|migration"
```

Procure por:
```
=== Generating Prisma client in /deploy ===
=== Prisma client generated ===
```

Se não houver migrations pendentes:
```
[Release] Database is already in sync with Prisma schema
```

**Critério:** Log mostra sucesso, nenhum erro.

---

## Etapa 4: Vercel Web

### 4.1 Conectar GitHub

1. Acesse https://vercel.com
2. Clique "New Project"
3. Selecione repositório ZappIQ
4. Framework auto-detecta: Next.js

### 4.2 Configurar build

Vercel auto-detecta `turbo.json` e `pnpm-workspace.yaml`. Customize se necessário:

- **Build Command:** `pnpm turbo run build --filter=@zappiq/web`
- **Output Directory:** `.next`
- **Install Command:** `pnpm install --frozen-lockfile`

### 4.3 Setar env vars

Em "Settings" → "Environment Variables":

```
NEXT_PUBLIC_API_URL=https://zappiq-api.fly.dev
NEXT_PUBLIC_STRIPE_PUBLIC_KEY=pk_live_...
NEXT_PUBLIC_GOOGLE_CLIENT_ID=...apps.googleusercontent.com
NEXT_PUBLIC_SOCKET_IO_URL=https://zappiq-api.fly.dev
```

### 4.4 Deploy

Clique "Deploy". Vercel automaticamente faz build e deploy em staging antes de prod.

**Critério de sucesso:**
- Build completa sem erro
- Deployment vira "Production"
- URL automática: `zappiq.vercel.app` ou custom domain

---

## Etapa 5: Cloudflare DNS + TLS

### 5.1 Apontar nameservers

1. Acesse seu registrador de domínio (GoDaddy, NameCheap, etc.)
2. Edite nameservers para Cloudflare (fornecido após criar zona)
3. Aguarde propagação (até 24h, geralmente < 1h)

Verificar:
```bash
dig zappiq.com.br NS
# Deve mostrar nameservers da Cloudflare
```

### 5.2 Criar registros DNS

No painel Cloudflare:

| Type | Name | Content | Proxy | TTL |
|---|---|---|---|---|
| CNAME | api | zappiq-api.fly.dev | Proxied | Auto |
| CNAME | www | zappiq.vercel.app | Proxied | Auto |
| CNAME | @ (root) | zappiq.vercel.app | Proxied | Auto |

**Nota:** Vercel pode solicitar validação de domínio (token TXT), siga instruções.

### 5.3 SSL/TLS

Cloudflare auto-emite certificado. Acesse https://zappiq.com.br (redirect automático de http).

**Critério de sucesso:**
```bash
curl -I https://api.zappiq.com.br/health
# HTTP/2 200
# Content-Type: application/json
```

---

## Etapa 6: WhatsApp Business Webhook

### 6.1 Registrar webhook

1. Acesse https://developers.facebook.com/apps
2. Selecione app ZappIQ
3. Acesse "Messenger" → "Webhooks"
4. Clique "Edit subscription"
5. Configure:
   - **Callback URL:** `https://api.zappiq.com.br/api/webhook/whatsapp`
   - **Verify Token:** `token_xyz` (use o mesmo do secret Fly)
6. Selecione eventos: `messages`, `message_status`, `message_template_status_update`
7. Clique "Save and Continue"

### 6.2 Testar webhook

Meta envia POST de validação. Verify:
```bash
flyctl logs -a zappiq-api | grep "webhook"
```

Procure por:
```
[Webhook] Validação do Facebook recebida com sucesso
```

**Critério:** Meta marca webhook como "Verified".

---

## Etapa 7: Stripe Webhook

### 7.1 Registrar endpoint

1. Acesse https://dashboard.stripe.com/webhooks
2. Clique "Add endpoint"
3. Configure:
   - **Endpoint URL:** `https://api.zappiq.com.br/api/stripe-webhook`
   - **Events:** `charge.succeeded`, `invoice.payment_failed`, `customer.subscription.updated`
4. Clique "Add endpoint"
5. Copie **Signing secret** (`whsec_...`) e atualize `STRIPE_WEBHOOK_SECRET` em Fly

```bash
flyctl secrets set -a zappiq-api STRIPE_WEBHOOK_SECRET="whsec_..."
flyctl deploy -a zappiq-api
```

**Critério:** Stripe marca endpoint como "Active" (verde).

---

## Smoke Test (Pós-Deploy)

Validar end-to-end:

### 7.1 Criar usuário

```bash
curl -X POST https://api.zappiq.com.br/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@zappiq.com.br",
    "password": "SecurePass123!",
    "name": "Test User"
  }'
# Esperado: { userId, organizationId, token }
```

### 7.2 Acessar dashboard

Abra https://zappiq.com.br em navegador.
- Login com credenciais acima
- Confirmar carregamento da dashboard
- Verificar WebSocket conectado (ícone verde no console)

### 7.3 Simular webhook WhatsApp

```bash
TOKEN="token_xyz"
SIGNATURE=$(echo -n "get_started${TOKEN}" | openssl dgst -sha256 -hex | awk '{print $2}')

curl -X POST https://api.zappiq.com.br/api/webhook/whatsapp \
  -H "Content-Type: application/json" \
  -H "X-Hub-Signature-256: sha256=${SIGNATURE}" \
  -d '{
    "entry": [{
      "messaging": [{
        "sender": { "id": "123456" },
        "message": { "text": "Oi ZappIQ" }
      }]
    }]
  }'
# Esperado: HTTP 200, AuditLog criado, Message enqueue
```

### 7.4 Verificar audit log

Acesse dashboard → Audit Logs. Filtrar por recurso "message". Confirmar entrada criada 30s atrás.

### 7.5 Health checks

```bash
curl https://api.zappiq.com.br/health
curl https://api.zappiq.com.br/ready
# Ambos devem retornar status=ok
```

---

## Troubleshooting Comum

### Problema: Webhook Meta retorna 403

**Causa:** Assinatura inválida ou token desatualizado.

**Solução:**
1. Copie `WHATSAPP_WEBHOOK_VERIFY_TOKEN` exato de Fly:
   ```bash
   flyctl secrets list -a zappiq-api | grep WHATSAPP
   ```
2. Re-registre webhook com esse valor
3. Teste com curl (usando assinatura correta)

### Problema: Cold start lento (10s+)

**Causa:** Primeira requisição ativa máquina Fly.

**Solução:**
1. Incrementar `min_machines_running` em `fly.toml` de 1 para 2:
   ```toml
   [http_service]
   min_machines_running = 2
   ```
2. Deploy:
   ```bash
   flyctl deploy -a zappiq-api
   ```

### Problema: Timeout Prisma (30s)

**Causa:** Supabase pooler saturado ou query lenta.

**Solução:**
1. Aumentar `connectionLimit` em DATABASE_URL:
   ```
   postgresql://...?schema=public&poolSize=5
   ```
2. Verificar query len em Supabase dashboard
3. Desabilitar índices desnecessários

### Problema: CORS bloqueado

**Causa:** `CORS_ORIGINS` faltando ou incorreto.

**Solução:**
```bash
flyctl secrets set -a zappiq-api \
  CORS_ORIGINS="https://zappiq.vercel.app,https://zappiq.com.br,https://www.zappiq.com.br"
flyctl deploy -a zappiq-api
```

### Problema: RLS policy quebrada após migration

**Causa:** `SET LOCAL app.current_workspace_id` não executado.

**Solução:**
1. Verificar middleware `tenantContext.ts` está sendo aplicado
2. Garantir `authMiddleware` vem antes de rotas protegidas
3. Logs para debug:
   ```bash
   flyctl logs -a zappiq-api | grep "RLS\|tenant"
   ```

---

## Secrets Matrix: Onde cada secret vai

| Secret | Fly.io | Vercel | Supabase | Cloudflare | Anotações |
|---|---|---|---|---|---|
| `DATABASE_URL` | ✓ | - | - | - | Pooled (port 6543) |
| `DIRECT_URL` | ✓ | - | - | - | Session (port 5432) |
| `REDIS_URL` | ✓ | - | - | - | Upstash TLS |
| `JWT_SECRET` | ✓ | - | - | - | Gerado com openssl |
| `ANTHROPIC_API_KEY` | ✓ | - | - | - | Claude API |
| `WHATSAPP_ACCESS_TOKEN` | ✓ | - | - | - | Meta for Developers |
| `WHATSAPP_WEBHOOK_VERIFY_TOKEN` | ✓ | - | - | - | Custom token |
| `STRIPE_SECRET_KEY` | ✓ | - | - | - | sk_live_* |
| `STRIPE_WEBHOOK_SECRET` | ✓ | - | - | - | whsec_* |
| `GOOGLE_CLIENT_ID` | ✓ | ✓ | - | - | NEXT_PUBLIC_* em Vercel |
| `GOOGLE_CLIENT_SECRET` | ✓ | - | - | - | Sensível, não em Vercel |
| `NEXT_PUBLIC_STRIPE_PUBLIC_KEY` | - | ✓ | - | - | pk_live_* |
| `NEXT_PUBLIC_API_URL` | - | ✓ | - | - | https://api.zappiq.com.br |
| `NEXT_PUBLIC_SOCKET_IO_URL` | - | ✓ | - | - | Mesmo que API_URL |

---

## Observabilidade pós-deploy

### Logs do Fly

```bash
# Streaming em tempo real
flyctl logs -a zappiq-api

# Últimas 100 linhas
flyctl logs -a zappiq-api -n 100

# Filtrar por nível
flyctl logs -a zappiq-api | grep "error\|ERROR"
```

### Métricas Fly

Acesse https://fly.io/apps/zappiq-api/monitoring:
- CPU usage
- Memory usage
- Request rate
- Response time p50/p95/p99

### Logs Vercel

Acesse https://vercel.com/zappiq-org/zappiq/deployments → "Functions" para logs serverless.

### Dashboard Supabase

https://supabase.com/dashboard/project/[project-id]/logs:
- Query duration
- Conexões ativas
- Replicação status (se configurada)

### Monitoramento customizado

Integrar com Axiom, Better Stack ou Datadog para alertas de downtime. Vide `ARCHITECTURE.md` seção OpenTelemetry.

---

## Rolling Deploy & Rollback

### Deploy novo código

```bash
git push origin main  # Trigger GitHub Actions
# ou manual:
flyctl deploy -a zappiq-api
```

Monitorar:
```bash
flyctl logs -a zappiq-api -f
# Aguarde: "v2 became available"
```

### Rollback para versão anterior

```bash
flyctl releases -a zappiq-api  # Lista versions
flyctl releases rollback -a zappiq-api
```

Zero-downtime: Fly mantém máquina anterior ativa durante transição.

---

## Próximas Etapas Operacionais

1. **Configurar backups:** Supabase "Database" → "Backups" (Point-in-time recovery, 30d default)
2. **Monitoramento:** Configurar alertas no Fly (uptime, error rate > 5%)
3. **Segurança:** Ativar 2FA em Fly.io, Vercel, Supabase
4. **Logs centralizados:** Integrar com ELK, Axiom ou Cloud Logging
5. **Capacity planning:** Monitorar uso de conexões DB, Redis commands/day
6. **Disaster recovery:** Testar restore a partir de backup Supabase uma vez ao mês

---

## Referências

- Fly.io: https://fly.io/docs/
- Vercel: https://vercel.com/docs
- Supabase: https://supabase.com/docs
- Upstash: https://upstash.com/docs
- Prisma: https://www.prisma.io/docs/
