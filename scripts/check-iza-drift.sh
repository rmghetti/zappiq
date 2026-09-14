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

CHANGELOG_PATH="${IZA_CHANGELOG_PATH:-docs/iza-facts-changelog.md}"

# ============================================================================
# PARTE 1 - PRAZO DAS ACOES ABERTAS (achado A229)
# ----------------------------------------------------------------------------
# A trava antiga so exigia EDITAR o changelog. Resultado: 13 acoes '- [ ]' e
# nenhuma '- [x]', incluindo 'UPDATE facts de pricing: Scale' aberta desde
# julho enquanto a Iza vendia o Scale pelo preco de antes do Pricing V4.
# Registrar virou um ritual sem consequencia.
#
# Agora toda acao aberta carrega a data em que foi aberta e tem 7 dias:
#
#   - [ ] (aberto em AAAA-MM-DD) UPDATE fact `xxx` ...
#   - [x] (aberto em AAAA-MM-DD, feito em AAAA-MM-DD) ...
#
# Esta parte roda SEMPRE, tenha o PR tocado path sensivel ou nao: o prazo eh
# do repositorio, nao do diff.
#
# Para testar com outro arquivo e outra data de hoje:
#   IZA_CHANGELOG_PATH=/tmp/fixture.md IZA_HOJE=2026-09-30 bash scripts/check-iza-drift.sh
# ============================================================================

LIMITE_DIAS="${IZA_LIMITE_DIAS:-7}"
HOJE="${IZA_HOJE:-$(date +%F)}"

# Converte AAAA-MM-DD em epoch. BSD (macOS) usa -j -f; GNU usa -d.
para_epoch() {
  date -j -f "%Y-%m-%d %H:%M:%S" "${1} 00:00:00" "+%s" 2>/dev/null \
    || date -d "${1} 00:00:00" "+%s" 2>/dev/null \
    || echo ""
}

HOJE_EPOCH="$(para_epoch "${HOJE}")"
if [ -z "${HOJE_EPOCH}" ]; then
  echo "[drift] FAIL: nao consegui interpretar a data de hoje '${HOJE}'."
  exit 1
fi

PRAZO_ERROS=""

if [ ! -f "${CHANGELOG_PATH}" ]; then
  echo "[drift] FAIL: ${CHANGELOG_PATH} nao existe."
  exit 1
fi

echo "[drift] Conferindo prazo das acoes abertas em ${CHANGELOG_PATH} (limite ${LIMITE_DIAS} dias, hoje ${HOJE})"

# O bloco '## Formato de entrada' mostra o modelo de uma acao dentro de uma
# cerca de codigo. Exemplo nao eh acao: a cerca liga e desliga a conferencia.
DENTRO_DE_CERCA=0
NUMERO=0

while IFS= read -r texto || [ -n "${texto}" ]; do
  NUMERO=$((NUMERO + 1))

  case "${texto}" in
    '```'*)
      DENTRO_DE_CERCA=$((1 - DENTRO_DE_CERCA))
      continue
      ;;
  esac
  [ "${DENTRO_DE_CERCA}" -eq 1 ] && continue

  printf '%s' "${texto}" | grep -qE '^[[:space:]]*- \[ \]' || continue

  numero="${NUMERO}"
  data="$(printf '%s' "${texto}" | grep -oE '\(aberto em [0-9]{4}-[0-9]{2}-[0-9]{2}' | head -1 | grep -oE '[0-9]{4}-[0-9]{2}-[0-9]{2}' || true)"

  if [ -z "${data}" ]; then
    PRAZO_ERROS="${PRAZO_ERROS}  linha ${numero}: acao aberta SEM data. Use '- [ ] (aberto em ${HOJE}) ...'\n"
    continue
  fi

  data_epoch="$(para_epoch "${data}")"
  if [ -z "${data_epoch}" ]; then
    PRAZO_ERROS="${PRAZO_ERROS}  linha ${numero}: data '${data}' invalida.\n"
    continue
  fi

  dias=$(( (HOJE_EPOCH - data_epoch) / 86400 ))
  if [ "${dias}" -gt "${LIMITE_DIAS}" ]; then
    resumo="$(printf '%s' "${texto}" | cut -c1-110)"
    PRAZO_ERROS="${PRAZO_ERROS}  linha ${numero}: aberta ha ${dias} dias (limite ${LIMITE_DIAS}) -> ${resumo}\n"
  fi
done < "${CHANGELOG_PATH}"

if [ -n "${PRAZO_ERROS}" ]; then
  cat <<EOF

============================================================
[drift] FAIL: ha acao aberta vencida em ${CHANGELOG_PATH}.

EOF
  echo -e "${PRAZO_ERROS}"
  cat <<EOF
O que fazer:
  1. Execute a acao (em /admin/iza-knowledge ou por SQL) e marque
     '- [x] (aberto em AAAA-MM-DD, feito em ${HOJE})'.
  2. Se a acao nao faz mais sentido, marque '- [x]' explicando por que
     foi descartada. Nao apague a linha: o historico fica.
  3. Se ainda precisa de prazo, reabra com a data de hoje e diga por que,
     na propria linha. Prorrogar eh uma decisao consciente, nao o padrao.

Por que isso importa: entre 03/05 e 25/05 a Iza ofereceu o Scale a um preco
que ja tinha mudado, porque a acao de atualizar os facts ficou aberta.
============================================================

EOF
  exit 1
fi

echo "[drift] Nenhuma acao aberta vencida. OK."
echo ""

# ============================================================================
# PARTE 2 - PATHS SENSIVEIS SEM ENTRADA NO CHANGELOG
# ============================================================================

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
