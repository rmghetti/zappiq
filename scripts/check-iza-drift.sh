#!/usr/bin/env bash
# ============================================================================
# check-iza-drift.sh - Camada 3 anti-drift gate
# ----------------------------------------------------------------------------
# Falha se PR tocou path SENSIVEL sem atualizar docs/iza-facts-changelog.md
# nem ter label `no-iza-impact`.
#
# Uso:
#   bash scripts/check-iza-drift.sh <base_sha> <head_sha>
#
# Paths sensiveis (qualquer mudanca aqui exige decisao consciente sobre
# impacto na Iza):
#   - apps/web/components/landing/**                  copy do site
#   - apps/web/app/(marketing)/**                     paginas marketing
#   - packages/shared/src/planConfig.ts               tiers + precos
#   - apps/api/src/agents/coreAgentRules.ts           regras imutaveis
#   - apps/api/src/agents/promptEngine.ts             prompt fallback
#   - apps/api/src/agents/nichePrompts.ts             prompts por niche
#   - fly.toml                                        env vars de prod
# ============================================================================

set -eo pipefail

BASE_SHA="${1:-origin/main}"
HEAD_SHA="${2:-HEAD}"

SENSITIVE_PATTERNS=(
  "^apps/web/components/landing/"
  "^apps/web/app/.*marketing.*/"
  "^packages/shared/src/planConfig\.ts$"
  "^apps/api/src/agents/coreAgentRules\.ts$"
  "^apps/api/src/agents/promptEngine\.ts$"
  "^apps/api/src/agents/nichePrompts\.ts$"
  "^fly\.toml$"
)

CHANGELOG_PATH="docs/iza-facts-changelog.md"

echo "[drift] Comparando ${BASE_SHA}...${HEAD_SHA}"

CHANGED_FILES=$(git diff --name-only "${BASE_SHA}" "${HEAD_SHA}" || git diff --name-only "${BASE_SHA}" "${HEAD_SHA}")

if [ -z "${CHANGED_FILES}" ]; then
  echo "[drift] Nenhum arquivo mudou. PASS."
  exit 0
fi

# Detectar tocou path sensivel
TOUCHED_SENSITIVE=""
for pattern in "${SENSITIVE_PATTERNS[@]}"; do
  matches=$(echo "${CHANGED_FILES}" | grep -E "${pattern}" || true)
  if [ -n "${matches}" ]; then
    TOUCHED_SENSITIVE="${TOUCHED_SENSITIVE}${matches}\n"
  fi
done

if [ -z "${TOUCHED_SENSITIVE}" ]; then
  echo "[drift] PR nao tocou nenhum path sensivel. PASS."
  exit 0
fi

echo ""
echo "[drift] PR tocou os seguintes paths sensiveis:"
echo -e "${TOUCHED_SENSITIVE}" | sed 's/^/   /'

# Conferir se changelog foi atualizado
if echo "${CHANGED_FILES}" | grep -q "^${CHANGELOG_PATH}$"; then
  echo ""
  echo "[drift] OK: ${CHANGELOG_PATH} foi atualizado neste PR. PASS."
  exit 0
fi

# Falha — explica o que fazer
cat <<EOF

============================================================
[drift] FAIL: PR toca paths que afetam o conhecimento da Iza
        sem atualizar ${CHANGELOG_PATH}.

Por que isso importa:
  Quando produto/canal/preco/feature muda, o system prompt
  da Iza precisa refletir. Senao ela alucina (ex: PR #153
  quando Iza disse 'Instagram nao esta no roadmap' apos IG
  Direct ja estar LIVE).

O que fazer (escolhe um):

  1. (preferido) Edita docs/iza-facts-changelog.md descrevendo:
     - O que mudou
     - Se precisa novo iza_facts OU update num existente
     - Quando a mudanca vai LIVE em prod
     Use /admin/iza-knowledge depois do merge pra atualizar
     os facts no DB.

  2. (excecao cosmetica) Adicione label 'no-iza-impact' no PR
     se a mudanca for puramente visual/tecnica sem afetar o
     que a Iza fala (ex: refactor de CSS, fix de tipo,
     ajuste de teste).

Documentacao: docs/iza-facts-changelog.md (header explica formato).
============================================================

EOF
exit 1
