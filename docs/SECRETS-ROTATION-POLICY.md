# Política de Rotação de Secrets

## Princípio

Secrets têm prazo de validade. Rotação periódica reduz a janela de exposição em caso de vazamento e é exigência de compliance em auditorias (ISO 27001, SOC 2, LGPD Art. 46).

## Cadência de rotação

| Tipo de secret                       | Cadência padrão | Rotação emergencial disparada por         |
|--------------------------------------|-----------------|-------------------------------------------|
| `ANTHROPIC_API_KEY`                  | 90 dias         | Key leaked, devs saindo do time           |
| `OPENAI_API_KEY`                     | 90 dias         | Key leaked                                |
| `VOYAGE_API_KEY`                     | 90 dias         | Key leaked                                |
| `JWT_SECRET`                         | 180 dias        | Incidente de auth, CVE em libs JWT        |
| `WHATSAPP_ACCESS_TOKEN`              | 60 dias (Meta)  | Meta notifica expiração, acesso suspeito  |
| `WHATSAPP_WEBHOOK_VERIFY_TOKEN`      | 180 dias        | Webhook leaked                            |
| `STRIPE_SECRET_KEY`                  | 90 dias         | Key leaked, dev saindo do time            |
| `STRIPE_WEBHOOK_SECRET`              | 180 dias        | Webhook leaked                            |
| `GOOGLE_CLIENT_SECRET`               | 180 dias        | OAuth compromise                          |
| `DATABASE_URL` (Supabase)            | 180 dias        | DBA sai, senha comprometida               |
| `REDIS_URL` (Upstash)                | 180 dias        | Access leaked                             |
| `RAG_SERVICE_SECRET` (internal)      | 90 dias         | —                                         |
| `SUPABASE_SERVICE_ROLE_KEY`          | 180 dias        | —                                         |
| Chaves SSH GitHub deploy             | 365 dias        | Colaborador sai, laptop roubado           |
| AWS (S3 backup) IAM access keys      | 90 dias         | Key leaked, dev muda de função            |
| OTel Grafana Cloud token             | 365 dias        | Token leaked                              |

## Gatilhos de rotação emergencial (fora da cadência)

Rotacionar IMEDIATAMENTE (<24h) em qualquer um destes cenários:

1. Colaborador com acesso aos secrets sai da empresa
2. Laptop/equipamento com acesso roubado ou perdido
3. Suspeita de vazamento (log público, código commitado por engano, screenshot acidental)
4. CVE crítica na library/provider correspondente
5. Incidente de segurança SEV1 ou SEV2
6. Auditoria de compliance solicitar

## Procedimento operacional (runbook)

### 1. Anthropic / OpenAI / Voyage API Keys

```bash
# 1. Gerar nova key no console do provider
# - Anthropic: https://console.anthropic.com/settings/keys
# - OpenAI: https://platform.openai.com/api-keys
# - Voyage: https://dash.voyageai.com/api-keys

# 2. Atualizar Fly secrets (deploy automático rolling)
fly secrets set ANTHROPIC_API_KEY=sk-ant-new-key -a zappiq-api
fly secrets set ANTHROPIC_API_KEY=sk-ant-new-key -a zappiq-rag

# 3. Validar (smoke test)
curl https://zappiq-api.fly.dev/ready
./scripts/smoke-test.sh

# 4. Revogar key antiga no console (aguardar 5min para confirmar nenhum request pendente)

# 5. Atualizar .env local dos devs (comunicado Slack)

# 6. Atualizar documento SECRETS-INVENTORY.md com nova data
```

### 2. JWT_SECRET

**Atenção:** rotacionar `JWT_SECRET` invalida TODAS as sessões ativas. Planejar janela de manutenção.

```bash
# 1. Gerar novo secret (64+ chars)
openssl rand -hex 64

# 2. Avisar clientes Enterprise (1 semana antes) via e-mail + banner no app
# "Em <data> às <hora>, sessões ativas serão encerradas por renovação de
#  credencial de segurança. Basta fazer login novamente."

# 3. Atualizar Fly secret (apenas API, RAG não usa)
fly secrets set JWT_SECRET=<new-64-char-hex> -a zappiq-api

# 4. Após deploy, validar novo login + criação de novo JWT
```

### 3. WhatsApp Access Token

Meta tokens expiram automaticamente. Configurar lembrete 7 dias antes de expirar:

```bash
# 1. Renovar token via Meta Business Manager
#    Settings → WhatsApp Accounts → System Users → Generate Token (60 days)

# 2. Atualizar Fly
fly secrets set WHATSAPP_ACCESS_TOKEN=<new-token> -a zappiq-api

# 3. Validar conexão
curl -X POST https://zappiq-api.fly.dev/api/webhooks/whatsapp/test \
  -H "Authorization: Bearer <admin-jwt>"
```

### 4. DATABASE_URL (Supabase)

```bash
# 1. Supabase Dashboard → Project Settings → Database → Reset Database Password

# 2. Atualizar tanto DATABASE_URL quanto DIRECT_URL
fly secrets set DATABASE_URL="postgresql://..." DIRECT_URL="postgresql://..." -a zappiq-api
fly secrets set DATABASE_URL="postgresql://..." -a zappiq-rag

# 3. Validar
curl https://zappiq-api.fly.dev/ready  # deve retornar 200 com postgres: true

# 4. Atualizar credenciais em outros locais:
# - Backup script (scripts/validate-restore.sh)
# - DBA ferramenta local (pgAdmin, DBeaver)
```

### 5. Redis URL (Upstash)

```bash
# 1. Upstash Console → Database → Regenerate Password

# 2. Atualizar
fly secrets set REDIS_URL="rediss://..." -a zappiq-api

# 3. Validar
curl https://zappiq-api.fly.dev/ready
```

## Inventário de secrets (SECRETS-INVENTORY)

Manter tabela com última rotação e próxima prevista. Sugestão: `docs/SECRETS-INVENTORY.md` (mas NUNCA commitar valores — só nomes, datas e responsável).

```markdown
| Secret name              | Última rotação | Próxima prevista | Responsável  | Location                |
|--------------------------|----------------|-------------------|--------------|-------------------------|
| ANTHROPIC_API_KEY        | 2026-04-14     | 2026-07-14        | Rodrigo      | Fly (api + rag)         |
| JWT_SECRET               | 2026-04-14     | 2026-10-14        | Rodrigo      | Fly (api)               |
| WHATSAPP_ACCESS_TOKEN    | 2026-04-10     | 2026-06-10        | Rodrigo      | Fly (api)               |
| ...                      | ...            | ...               | ...          | ...                     |
```

## Automação de lembrete

Opção 1 — Calendar reminders:
- Criar eventos recorrentes no Google Calendar do DPO/ops com antecedência de 7 dias

Opção 2 — Script de verificação (rodar mensal via cron):
```bash
#!/bin/bash
# scripts/check-secrets-age.sh
# Lê docs/SECRETS-INVENTORY.md, alerta se algum secret estiver >= (cadência - 7 dias)
```

Opção 3 — Integração com password manager:
- 1Password / Bitwarden / Vaultwarden com alerta automático de expiração

## Matriz de acesso a secrets

Quem tem acesso a quê:

| Pessoa/Função         | Secrets pessoais (.env dev)     | Fly secrets prod  | Supabase/Upstash console  | AWS backup         |
|-----------------------|----------------------------------|-------------------|---------------------------|---------------------|
| Rodrigo (fundador)    | Todos                            | Todos             | Owner                     | Owner               |
| Futuro CTO            | Todos                            | Todos             | Admin                     | Admin               |
| Futuro DevOps         | Infra (DB, Redis)                | Todos             | Admin                     | Admin               |
| Futuro Eng Software   | LLM APIs, Stripe test            | —                 | Read-only                 | —                   |
| Cliente Enterprise    | —                                | —                 | —                         | —                   |

## Auditoria

- **Trimestral:** revisar matriz de acesso + log de Fly secrets (`fly secrets list`)
- **Anual:** auditoria externa (contratação formal quando houver faturamento >R$500k/ano)
- **Pós-incidente:** sempre que SEV1 envolver credencial

## Checklist para offboarding de colaborador

Quando qualquer pessoa com acesso a secrets sair da empresa:

- [ ] Rotacionar TODOS os secrets aos quais a pessoa tinha acesso (ver matriz)
- [ ] Revogar acesso a Fly org (`fly orgs remove-user`)
- [ ] Revogar acesso a Supabase, Upstash, GitHub, Vercel
- [ ] Remover chaves SSH GitHub da pessoa
- [ ] Invalidar tokens PAT da pessoa no GitHub
- [ ] Atualizar `SECRETS-INVENTORY.md` com data da rotação emergencial
- [ ] Registrar no ROP LGPD como evento de controle de acesso
