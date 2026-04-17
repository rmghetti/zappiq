#!/bin/bash
# ═══════════════════════════════════════════════════════════════════════
# Setup ZappIQ RAG Service on Fly.io
# ───────────────────────────────────────────────────────────────────────
# Pré-requisitos:
#   1. flyctl instalado e autenticado (fly auth login)
#   2. App criada: fly apps create zappiq-rag --org personal
#   3. Secrets configurados (ver abaixo)
#
# Secrets obrigatórios:
#   flyctl secrets set -a zappiq-rag \
#     DATABASE_URL="postgresql://..." \
#     VOYAGE_API_KEY="pa-..."
#
# Secrets opcionais:
#   flyctl secrets set -a zappiq-rag \
#     OPENAI_API_KEY="sk-..." \
#     OTEL_EXPORTER_OTLP_ENDPOINT="https://otlp-gateway-prod-sa-east-1.grafana.net/otlp" \
#     OTEL_EXPORTER_OTLP_HEADERS="Authorization=Basic ..."
#
# Deploy:
#   cd <raiz-monorepo>
#   flyctl deploy --remote-only --config services/rag/fly.toml
#
# Monitoramento:
#   flyctl logs -a zappiq-rag
#   flyctl status -a zappiq-rag
#   curl https://zappiq-rag.fly.dev/health
#   curl https://zappiq-rag.fly.dev/ready
# ═══════════════════════════════════════════════════════════════════════

set -euo pipefail

APP="zappiq-rag"
REGION="gru"

echo "🚀 ZappIQ RAG — Fly.io Setup"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# Verificar flyctl
if ! command -v flyctl &> /dev/null; then
  echo "❌ flyctl não encontrado. Instale: curl -L https://fly.io/install.sh | sh"
  exit 1
fi

# Verificar se app existe
if ! flyctl apps list 2>/dev/null | grep -q "$APP"; then
  echo "📦 Criando app $APP na região $REGION..."
  flyctl apps create "$APP" --org personal
else
  echo "✅ App $APP já existe"
fi

# Verificar secrets
echo ""
echo "🔐 Verificando secrets..."
SECRETS=$(flyctl secrets list -a "$APP" 2>/dev/null || echo "")

check_secret() {
  local name="$1" required="$2"
  if echo "$SECRETS" | grep -q "$name"; then
    echo "  ✅ $name"
  elif [ "$required" = "true" ]; then
    echo "  ❌ $name (OBRIGATÓRIO — configurar com: flyctl secrets set -a $APP $name=...)"
  else
    echo "  ⚠️  $name (opcional)"
  fi
}

check_secret "DATABASE_URL" "true"
check_secret "VOYAGE_API_KEY" "true"
check_secret "OPENAI_API_KEY" "false"
check_secret "OTEL_EXPORTER_OTLP_ENDPOINT" "false"
check_secret "OTEL_EXPORTER_OTLP_HEADERS" "false"

echo ""
echo "🏗️  Para deploy, execute:"
echo "  cd $(git rev-parse --show-toplevel 2>/dev/null || echo '<raiz-monorepo>')"
echo "  flyctl deploy --remote-only --config services/rag/fly.toml"
