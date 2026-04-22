# Rotação Manual Stripe — 2 secrets restantes

Os outros 7 secrets já foram rotacionados automaticamente. A Stripe é a única que o Chrome MCP bloqueia por restrição de segurança — tem que ser na mão. Leva 3 minutos.

## 1. STRIPE_SECRET_KEY

1. Abre https://dashboard.stripe.com/apikeys
2. Na linha **"Secret key"** (sk_live_...), clica nos três pontinhos `⋯` à direita → **"Roll key"** (ou "Criar nova chave")
3. Escolhe expiração **"Now"** (imediata) ou **"In 1 hour"** se quiser uma janela de segurança
4. Copia a nova chave `sk_live_...` que aparece (só aparece 1x!)
5. Cola no comando:

```bash
cd "/Users/rodrigoghetti/Library/Mobile Documents/com~apple~CloudDocs/PROJETO ZAPPIQ 2026/zappiq"
# Substitui o valor dentro das aspas:
sed -i '' 's|sk_live_<VALOR_ANTIGO_DO_ENV>|sk_live_<COLA_NOVA_AQUI>|' scripts/.env.production
# Antes de rodar este sed, abra scripts/.env.production e confirme o valor antigo localmente.
# Não commite chaves reais neste runbook — use sempre o placeholder acima.
```

## 2. STRIPE_WEBHOOK_SECRET

1. Ainda no Stripe Dashboard → https://dashboard.stripe.com/webhooks
2. Clica no webhook que aponta pro `zappiq-api.fly.dev/webhooks/stripe`
3. Na aba **"Signing secret"** clica em **"Roll secret"** (expira em 24h por padrão)
4. Copia o `whsec_...` novo
5. Cola no comando:

```bash
sed -i '' 's|whsec_<VALOR_ANTIGO_DO_ENV>|whsec_<COLA_NOVO_AQUI>|' scripts/.env.production
# Mesmo princípio: leia o valor antigo do .env.production local, não cole aqui.
```

## 3. Atualiza o checklist do .env.production

```bash
sed -i '' 's|^#   \[ \] STRIPE_SECRET_KEY$|#   [x] STRIPE_SECRET_KEY     · 2026-04-20 · rolled manual|' scripts/.env.production
sed -i '' 's|^#   \[ \] STRIPE_WEBHOOK_SECRET$|#   [x] STRIPE_WEBHOOK_SECRET · 2026-04-20 · rolled manual|' scripts/.env.production
```

## 4. Valida (todos os `[x]`, nenhum `[ ]`)

```bash
grep '^#   \[' scripts/.env.production
```

Se aparecer só `[x]` nos 9 secrets, segue pro próximo passo.

## 5. Agora sim: push + deploy

```bash
# Na raiz do projeto zappiq:
./FIX_SECRETS_AND_PUSH.command      # limpa histórico e sobe pro GitHub
./scripts/deploy-production.sh      # sobe os secrets novos pro Fly
```

## 6. Pós-deploy · revogar chaves antigas

Depois que o `fly logs --app zappiq-api` mostrar que subiu limpo e o `curl https://zappiq-api.fly.dev/health` retornar 200, você **precisa** revogar as chaves antigas nos providers pra fechar o incidente:

- **Stripe**: no dashboard, chave antiga já fica marcada "rolled, expires at ..." — só confirma que já expirou
- **Anthropic / OpenAI**: deleta as keys antigas (v1) em https://console.anthropic.com/settings/keys e https://platform.openai.com/api-keys
- **Meta**: no Business Manager → zappiq-api → "Anular tokens" nos antigos
- **Supabase**: a senha antiga já foi substituída, nada a fazer
- **Upstash**: o token antigo já foi substituído, nada a fazer

---

**Status atual** (atualizado 2026-04-20):

| Secret | Status |
|---|---|
| ANTHROPIC_API_KEY | ✅ rotacionado |
| OPENAI_API_KEY | ✅ rotacionado |
| DATABASE_URL / DIRECT_URL | ✅ rotacionado |
| REDIS_URL (Upstash) | ✅ rotacionado |
| WHATSAPP_ACCESS_TOKEN (Meta) | ✅ rotacionado |
| JWT_SECRET | ✅ rotacionado |
| WHATSAPP_WEBHOOK_VERIFY_TOKEN | ✅ rotacionado |
| **STRIPE_SECRET_KEY** | ⏳ manual (3 min) |
| **STRIPE_WEBHOOK_SECRET** | ⏳ manual (3 min) |
