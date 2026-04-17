#!/bin/bash
# ═══════════════════════════════════════════════════════════════════════
# ZappIQ Smoke Tests — 6 Endpoints Críticos + Extras
# ───────────────────────────────────────────────────────────────────────
# Executa smoke tests contra staging/produção. Exit code = número de falhas.
# Uso: ./scripts/smoke-staging.sh [base_url]
# Default: https://zappiq-api.fly.dev
#
# Endpoints críticos (P0-14):
#   1. GET  /health            — liveness (infra)
#   2. GET  /ready             — readiness (Postgres + Redis)
#   3. POST /api/auth/login    — autenticação JWT
#   4. GET  /api/webhook       — webhook WhatsApp verification
#   5. GET  /api/contacts      — CRUD principal (auth + RLS)
#   6. GET  /api/conversations — pipeline de conversas (auth + RLS)
#
# Extras:
#   - AI Training, Savings, Admin (403), Onboarding
#
# Requer: curl, python3
# CI: .github/workflows/fly-deploy.yml (post-deploy step)
# ═══════════════════════════════════════════════════════════════════════

set -uo pipefail
export PATH="/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin:$PATH"

BASE="${1:-https://zappiq-api.fly.dev}"
PASS=0; FAIL=0; TOTAL=0; SKIPPED=0

# Credentials from env (CI secrets) or defaults (staging seed)
SMOKE_EMAIL="${SMOKE_TEST_EMAIL:-zappiq@zappiq.com.br}"
SMOKE_PASS="${SMOKE_TEST_PASSWORD:-wozdkIEvFJcdqSNcXB3NAa1!}"

check() {
  local name="$1" expected="$2" actual="$3"
  TOTAL=$((TOTAL+1))
  if [ "$actual" = "$expected" ]; then
    echo "  ✅ $name (HTTP $actual)"; PASS=$((PASS+1))
  else
    echo "  ❌ $name (expected $expected, got $actual)"; FAIL=$((FAIL+1))
  fi
}

check_range() {
  local name="$1" min="$2" max="$3" actual="$4"
  TOTAL=$((TOTAL+1))
  if [ "$actual" -ge "$min" ] 2>/dev/null && [ "$actual" -le "$max" ] 2>/dev/null; then
    echo "  ✅ $name (HTTP $actual)"; PASS=$((PASS+1))
  else
    echo "  ❌ $name (expected $min-$max, got $actual)"; FAIL=$((FAIL+1))
  fi
}

echo ""
echo "🔥 ZappIQ Smoke Tests — $BASE"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# ── CRITICAL 1/6: Liveness ───────────────────────────
echo ""
echo "📡 [1/6] Liveness"
check "GET /health" "200" "$(curl -s -o /dev/null -w '%{http_code}' --max-time 10 "$BASE/health")"

# ── CRITICAL 2/6: Readiness ──────────────────────────
echo ""
echo "📡 [2/6] Readiness"
check "GET /ready" "200" "$(curl -s -o /dev/null -w '%{http_code}' --max-time 15 "$BASE/ready")"

# ── CRITICAL 3/6: Auth Login ─────────────────────────
echo ""
echo "🔐 [3/6] Auth Login"
LOGIN_CODE=$(curl -s -o /dev/null -w '%{http_code}' --max-time 10 -X POST "$BASE/api/auth/login" \
  -H "Content-Type: application/json" \
  -d "{\"email\":\"$SMOKE_EMAIL\",\"password\":\"$SMOKE_PASS\"}")
check "POST /api/auth/login" "200" "$LOGIN_CODE"

# Extract token
LOGIN_RESP=$(curl -s --max-time 10 -X POST "$BASE/api/auth/login" \
  -H "Content-Type: application/json" \
  -d "{\"email\":\"$SMOKE_EMAIL\",\"password\":\"$SMOKE_PASS\"}")
TOKEN=$(echo "$LOGIN_RESP" | python3 -c "import sys,json; print(json.load(sys.stdin).get('token',''))" 2>/dev/null || echo "")

if [ -z "$TOKEN" ]; then
  echo "  ⚠️  No token — skipping authenticated endpoints"
  SKIPPED=3
else
  echo "  🎫 Token: ${TOKEN:0:20}..."

  # ── CRITICAL 4/6: Webhook WhatsApp ─────────────────
  echo ""
  echo "📨 [4/6] Webhook Verification"
  WEBHOOK_CODE=$(curl -s -o /dev/null -w '%{http_code}' --max-time 10 \
    "$BASE/api/webhook?hub.mode=subscribe&hub.verify_token=invalid_test&hub.challenge=test123")
  check_range "GET /api/webhook (verify)" "200" "403" "$WEBHOOK_CODE"

  # ── CRITICAL 5/6: Contacts ─────────────────────────
  echo ""
  echo "👥 [5/6] Contacts"
  check "GET /api/contacts" "200" "$(curl -s -o /dev/null -w '%{http_code}' --max-time 10 \
    "$BASE/api/contacts" -H "Authorization: Bearer $TOKEN")"

  # ── CRITICAL 6/6: Conversations ────────────────────
  echo ""
  echo "💬 [6/6] Conversations"
  check "GET /api/conversations" "200" "$(curl -s -o /dev/null -w '%{http_code}' --max-time 10 \
    "$BASE/api/conversations" -H "Authorization: Bearer $TOKEN")"

  # ── Extras (non-blocking) ──────────────────────────
  echo ""
  echo "── Extras ──"
  check "GET /api/ai-training/status" "200" "$(curl -s -o /dev/null -w '%{http_code}' --max-time 10 \
    "$BASE/api/ai-training/status" -H "Authorization: Bearer $TOKEN")"
  check "GET /api/ai-training/qa" "200" "$(curl -s -o /dev/null -w '%{http_code}' --max-time 10 \
    "$BASE/api/ai-training/qa" -H "Authorization: Bearer $TOKEN")"
  check "GET /api/savings-email/preview (400)" "400" "$(curl -s -o /dev/null -w '%{http_code}' --max-time 10 \
    "$BASE/api/savings-email/preview" -H "Authorization: Bearer $TOKEN")"
  check "GET /api/admin/organizations (403)" "403" "$(curl -s -o /dev/null -w '%{http_code}' --max-time 10 \
    "$BASE/api/admin/organizations" -H "Authorization: Bearer $TOKEN")"
  check "GET /api/onboarding/status" "200" "$(curl -s -o /dev/null -w '%{http_code}' --max-time 10 \
    "$BASE/api/onboarding/status" -H "Authorization: Bearer $TOKEN")"
fi

# ── Summary ──────────────────────────────────────────
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
if [ $FAIL -eq 0 ] && [ $SKIPPED -eq 0 ]; then
  echo "🎉 ALL PASSED: $PASS/$TOTAL"
  exit 0
elif [ $FAIL -eq 0 ]; then
  echo "⚠️  PASSED: $PASS/$TOTAL ($SKIPPED skipped — no auth token)"
  exit 0
else
  echo "❌ FAILED: $FAIL/$TOTAL ($PASS passed, $SKIPPED skipped)"
  exit $FAIL
fi
