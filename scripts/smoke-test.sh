#!/usr/bin/env bash
# Smoke test pos-deploy. Roda apos cada `fly deploy` em prod/staging.
#
# Verifica:
#   1. /health retorna 200 (liveness)
#   2. /ready retorna 200 com { postgres: ok, redis: ok } (readiness)
#   3. Login endpoint aceita credenciais de service account (se SMOKE_EMAIL/PASSWORD setados)
#   4. /api/conversations retorna 200 com JWT (auth funcionando)
#   5. RAG /ready (se RAG_URL setado)
#
# Uso:
#   API_URL=https://zappiq-api.fly.dev ./scripts/smoke-test.sh
#
#   # Com teste de auth tambem:
#   API_URL=https://zappiq-api.fly.dev \
#   SMOKE_EMAIL=smoke@zappiq.test \
#   SMOKE_PASSWORD='***' \
#     ./scripts/smoke-test.sh
#
#   # Com RAG tambem:
#   RAG_URL=https://zappiq-rag.fly.dev ./scripts/smoke-test.sh
#
# Exit codes:
#   0 = tudo passou
#   1 = algum check falhou (loga qual)

set -euo pipefail

API_URL="${API_URL:-http://localhost:3001}"
RAG_URL="${RAG_URL:-}"
TIMEOUT="${TIMEOUT:-10}"

PASS=0
FAIL=0

green()  { printf '\033[0;32m%s\033[0m\n' "$1"; }
red()    { printf '\033[0;31m%s\033[0m\n' "$1"; }
yellow() { printf '\033[0;33m%s\033[0m\n' "$1"; }

check() {
  local name="$1" url="$2" expected_status="${3:-200}" body_grep="${4:-}"

  printf "  %-40s " "$name"
  local response status body
  response=$(curl -sS -o /tmp/smoke-body.$$ -w "%{http_code}" \
    --max-time "$TIMEOUT" "$url" || echo "000")
  status="$response"
  body=$(cat /tmp/smoke-body.$$ 2>/dev/null || echo "")
  rm -f /tmp/smoke-body.$$

  if [[ "$status" != "$expected_status" ]]; then
    red "FAIL (status $status, esperado $expected_status)"
    [[ -n "$body" ]] && echo "    body: $(echo "$body" | head -c 200)"
    FAIL=$((FAIL + 1))
    return 1
  fi

  if [[ -n "$body_grep" ]] && ! echo "$body" | grep -q "$body_grep"; then
    red "FAIL (body nao contem '$body_grep')"
    echo "    body: $(echo "$body" | head -c 200)"
    FAIL=$((FAIL + 1))
    return 1
  fi

  green "PASS"
  PASS=$((PASS + 1))
}

echo ""
echo "Smoke test — $(date -u +%Y-%m-%dT%H:%M:%SZ)"
echo "API: $API_URL"
[[ -n "$RAG_URL" ]] && echo "RAG: $RAG_URL"
echo ""

echo "[API]"
check "GET /health"           "$API_URL/health"  200 '"status"'
check "GET /ready"            "$API_URL/ready"   200 '"postgres"'
check "GET / (nao existe)"    "$API_URL/"        404

# Auth flow (opcional — exige conta smoke)
if [[ -n "${SMOKE_EMAIL:-}" && -n "${SMOKE_PASSWORD:-}" ]]; then
  echo ""
  echo "[Auth]"
  printf "  %-40s " "POST /auth/login"
  token=$(curl -sS --max-time "$TIMEOUT" -X POST "$API_URL/auth/login" \
    -H "Content-Type: application/json" \
    -d "{\"email\":\"$SMOKE_EMAIL\",\"password\":\"$SMOKE_PASSWORD\"}" \
    | grep -o '"token":"[^"]*"' | cut -d'"' -f4 || true)

  if [[ -z "$token" ]]; then
    red "FAIL (sem token na resposta)"
    FAIL=$((FAIL + 1))
  else
    green "PASS"
    PASS=$((PASS + 1))

    printf "  %-40s " "GET /api/conversations (com JWT)"
    status=$(curl -sS -o /dev/null -w "%{http_code}" --max-time "$TIMEOUT" \
      "$API_URL/api/conversations" \
      -H "Authorization: Bearer $token")
    if [[ "$status" == "200" ]]; then
      green "PASS"
      PASS=$((PASS + 1))
    else
      red "FAIL (status $status)"
      FAIL=$((FAIL + 1))
    fi
  fi
else
  yellow "[Auth] skip (defina SMOKE_EMAIL e SMOKE_PASSWORD para testar login)"
fi

# RAG (opcional)
if [[ -n "$RAG_URL" ]]; then
  echo ""
  echo "[RAG]"
  check "GET /health"           "$RAG_URL/health"  200 '"zappiq-rag"'
  check "GET /ready"            "$RAG_URL/ready"   200 '"postgres"'
fi

echo ""
echo "─────────────────────────────────────────"
if [[ "$FAIL" -eq 0 ]]; then
  green "Todos os $PASS checks passaram."
  exit 0
else
  red "$FAIL check(s) falharam ($PASS passaram). Investigue antes de promover o deploy."
  exit 1
fi
