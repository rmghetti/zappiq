#!/bin/bash
# ZappIQ — Pre-commit local (typecheck + lint + format check)
# Roda rápido, falha loud se algo quebra. Objetivo: menor que 20s em projeto atual.
#
# Uso:
#   ./scripts/precommit.sh              # tudo
#   ./scripts/precommit.sh --fix        # aplica format/lint fixes in-place
#   ./scripts/precommit.sh --api        # só apps/api
#   ./scripts/precommit.sh --web        # só apps/web
#
# Pode ser usado via husky: `.husky/pre-commit → ./scripts/precommit.sh`

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

MODE="${1:-all}"
FIX=0
[[ "${1:-}" == "--fix" ]] && FIX=1

GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[0;33m'
NC='\033[0m'

info() { echo -e "${YELLOW}→${NC} $*"; }
ok()   { echo -e "${GREEN}✓${NC} $*"; }
fail() { echo -e "${RED}✗${NC} $*"; exit 1; }

START_TS=$(date +%s)

# ─────────────────────────────────────────────
# Verifica dependências
# ─────────────────────────────────────────────
if ! command -v pnpm >/dev/null 2>&1; then
  fail "pnpm não encontrado. Instalar: npm install -g pnpm"
fi

if [[ ! -d node_modules ]]; then
  info "node_modules ausente — rodando pnpm install..."
  pnpm install --frozen-lockfile
fi

# ─────────────────────────────────────────────
# Typecheck (TS)
# ─────────────────────────────────────────────
info "Typecheck (pnpm -r typecheck)..."
if pnpm -r typecheck; then
  ok "Typecheck OK"
else
  fail "Typecheck falhou — corrigir antes de commitar"
fi

# ─────────────────────────────────────────────
# Lint
# ─────────────────────────────────────────────
LINT_CMD="pnpm -r lint"
[[ $FIX -eq 1 ]] && LINT_CMD="pnpm -r lint --fix"

info "Lint ($LINT_CMD)..."
if $LINT_CMD; then
  ok "Lint OK"
else
  if [[ $FIX -eq 0 ]]; then
    echo ""
    echo "  Tentar auto-fix: ./scripts/precommit.sh --fix"
  fi
  fail "Lint falhou"
fi

# ─────────────────────────────────────────────
# Format check (prettier)
# ─────────────────────────────────────────────
if [[ -f ".prettierrc" || -f ".prettierrc.json" || -f "prettier.config.js" ]]; then
  if [[ $FIX -eq 1 ]]; then
    info "Prettier write..."
    pnpm exec prettier --write . >/dev/null
    ok "Format aplicado"
  else
    info "Prettier check..."
    if pnpm exec prettier --check . >/dev/null 2>&1; then
      ok "Format OK"
    else
      echo "  Arquivos fora do padrão. Rodar: ./scripts/precommit.sh --fix"
      fail "Format falhou"
    fi
  fi
fi

# ─────────────────────────────────────────────
# Python RAG — typecheck + format (se houver mudanças em services/rag/)
# ─────────────────────────────────────────────
if git diff --cached --name-only 2>/dev/null | grep -q "^services/rag/"; then
  info "Mudanças em services/rag/ detectadas..."

  if [[ -f "services/rag/pyproject.toml" ]] && command -v ruff >/dev/null 2>&1; then
    if [[ $FIX -eq 1 ]]; then
      ruff check --fix services/rag/ && ruff format services/rag/
    else
      ruff check services/rag/ || fail "Ruff falhou em services/rag/"
      ruff format --check services/rag/ || fail "Ruff format falhou — rodar com --fix"
    fi
    ok "services/rag/ OK (ruff)"
  fi

  if command -v mypy >/dev/null 2>&1; then
    if mypy --ignore-missing-imports services/rag/main.py 2>&1 | grep -v "note:" | grep -q "error:"; then
      fail "mypy falhou em services/rag/"
    fi
    ok "services/rag/ OK (mypy)"
  fi
fi

# ─────────────────────────────────────────────
# Testes rápidos (se tag @unit existir)
# ─────────────────────────────────────────────
# Opcional: descomentar quando suite estabilizar
# info "Unit tests (apenas @unit)..."
# pnpm -r test -- --testPathPattern=unit || fail "Tests falharam"
# ok "Unit tests OK"

# ─────────────────────────────────────────────
# Checks de segurança — secrets staged
# ─────────────────────────────────────────────
info "Escaneando por secrets staged..."
STAGED=$(git diff --cached --name-only 2>/dev/null || true)
if [[ -n "$STAGED" ]]; then
  # Padrões óbvios de secret
  SUSPICIOUS=$(echo "$STAGED" | xargs -I{} grep -lE "(sk-ant-[a-zA-Z0-9]{40,}|sk-[a-zA-Z0-9]{32,}|ghp_[a-zA-Z0-9]{30,}|AKIA[0-9A-Z]{16}|whsec_[a-zA-Z0-9]{32,})" {} 2>/dev/null || true)
  if [[ -n "$SUSPICIOUS" ]]; then
    echo ""
    echo -e "${RED}✗ SECRET DETECTADO nos arquivos:${NC}"
    echo "$SUSPICIOUS"
    echo ""
    echo "  Se for placeholder, ajustar o pattern. Se for secret real, REMOVER e rotacionar."
    fail "Não commita secret"
  fi
fi
ok "Nenhum secret staged"

# ─────────────────────────────────────────────
# Resumo
# ─────────────────────────────────────────────
END_TS=$(date +%s)
DURATION=$((END_TS - START_TS))

echo ""
echo "═══════════════════════════════════════════════════"
echo -e "  ${GREEN}✓ Pre-commit OK${NC} em ${DURATION}s"
echo "═══════════════════════════════════════════════════"
