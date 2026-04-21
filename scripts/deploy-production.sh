#!/usr/bin/env bash
# ═══════════════════════════════════════════════════════════════════
# ZappIQ — Deploy de Produção (D-Day)
#
# Carrega secrets de scripts/.env.production (NAO COMMITADO) e
# configura os fly secrets via `fly secrets set`. Rode 1x antes
# do go-live ou sempre que rotacionar credenciais.
#
# Pre-req: copiar scripts/.env.production.example -> scripts/.env.production
# e preencher com os valores vigentes.
# ═══════════════════════════════════════════════════════════════════
set -euo pipefail

cd "$(dirname "$0")/.." || exit 1

ENV_FILE="scripts/.env.production"

echo "══════════════════════════════════════════"
echo " ZappIQ — Deploy de Produção"
echo "══════════════════════════════════════════"

# ── 0. Validar .env.production ──
if [[ ! -f "$ENV_FILE" ]]; then
  echo ""
  echo "✗ $ENV_FILE nao encontrado."
  echo "  Copie scripts/.env.production.example -> $ENV_FILE"
  echo "  e preencha com os secrets vigentes (rotacionados)."
  exit 1
fi

# Source: torna as variaveis disponiveis no shell
# set -a: auto-export de toda variavel definida apos isso
set -a
# shellcheck disable=SC1090
source "$ENV_FILE"
set +a

REQUIRED_VARS=(
  DATABASE_URL DIRECT_URL JWT_SECRET REDIS_URL
  WHATSAPP_PHONE_NUMBER_ID WHATSAPP_BUSINESS_ACCOUNT_ID
  WHATSAPP_ACCESS_TOKEN WHATSAPP_WEBHOOK_VERIFY_TOKEN
  STRIPE_SECRET_KEY STRIPE_WEBHOOK_SECRET STRIPE_PRICE_IDS
  ANTHROPIC_API_KEY OPENAI_API_KEY
)
MISSING=()
for V in "${REQUIRED_VARS[@]}"; do
  if [[ -z "${!V:-}" ]]; then MISSING+=("$V"); fi
done
if [[ ${#MISSING[@]} -gt 0 ]]; then
  echo ""
  echo "✗ Variaveis ausentes em $ENV_FILE:"
  for V in "${MISSING[@]}"; do echo "    - $V"; done
  exit 1
fi

# ── 1. Git: pega os fixes e envia pro GitHub ──
echo ""
echo "[1/3] Enviando código para o GitHub..."
git pull --rebase origin main
git push origin main
echo "✓ Código no GitHub (deploy automático vai iniciar)"

# ── 2. Secrets do Fly.io ──
echo ""
echo "[2/3] Configurando secrets no Fly.io..."

fly secrets set --app zappiq-api \
  DATABASE_URL="$DATABASE_URL" \
  DIRECT_URL="$DIRECT_URL" \
  JWT_SECRET="$JWT_SECRET" \
  REDIS_URL="$REDIS_URL" \
  WHATSAPP_PHONE_NUMBER_ID="$WHATSAPP_PHONE_NUMBER_ID" \
  WHATSAPP_BUSINESS_ACCOUNT_ID="$WHATSAPP_BUSINESS_ACCOUNT_ID" \
  WHATSAPP_ACCESS_TOKEN="$WHATSAPP_ACCESS_TOKEN" \
  WHATSAPP_WEBHOOK_VERIFY_TOKEN="$WHATSAPP_WEBHOOK_VERIFY_TOKEN" \
  STRIPE_SECRET_KEY="$STRIPE_SECRET_KEY" \
  ANTHROPIC_API_KEY="$ANTHROPIC_API_KEY" \
  OPENAI_API_KEY="$OPENAI_API_KEY" \
  STRIPE_WEBHOOK_SECRET="$STRIPE_WEBHOOK_SECRET" \
  STRIPE_PRICE_IDS="$STRIPE_PRICE_IDS"

echo "✓ 13 secrets configurados"

# ── 3. Verificação ──
echo ""
echo "[3/3] Verificando..."
fly secrets list --app zappiq-api
echo ""
echo "══════════════════════════════════════════"
echo " ✅ PRONTO! Verifique em 2-3 minutos:"
echo "══════════════════════════════════════════"
echo ""
echo "  fly logs --app zappiq-api"
echo "  curl https://zappiq-api.fly.dev/health"
echo ""
