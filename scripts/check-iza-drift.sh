#!/usr/bin/env bash
# ============================================================================
# check-iza-drift.sh - Camada 3 anti-drift gate
# ----------------------------------------------------------------------------
# Duas conferencias, com alcances diferentes de proposito:
#
#   PARTE 1 - prazo das acoes abertas em docs/iza-facts-changelog.md.
#             O relatorio eh IMPRESSO em todo PR, mas so REPROVA o PR que toca
#             caminho da Iza. A excecao eh a acao com data de vencimento
#             propria ('vence em AAAA-MM-DD'), que reprova qualquer PR a partir
#             daquele dia, porque ali o prazo eh do mundo, nao do repositorio
#             (a tarifa da Meta comeca em 01/10 tenha ou nao PR de Iza aberto).
#
#   PARTE 2 - PR que toca path SENSIVEL sem atualizar o changelog nem ter a
#             label `no-iza-impact`.
#
# Uso:
#   bash scripts/check-iza-drift.sh <base_sha> <head_sha>
#
# Paths SENSIVEIS (qualquer mudanca aqui exige decisao consciente sobre
# impacto na Iza, e dispara a Parte 2):
#   - apps/web/components/landing/**                  copy do site
#   - apps/web/app/(marketing)/**                     paginas marketing
#   - packages/shared/src/planConfig.ts               tiers + precos
#   - apps/api/src/agents/coreAgentRules.ts           regras imutaveis
#   - apps/api/src/agents/promptEngine.ts             prompt fallback
#   - apps/api/src/agents/nichePrompts.ts             prompts por niche
#   - fly.toml                                        env vars de prod
#
# Paths da IZA (os sensiveis MAIS os abaixo). Sao os que fazem a Parte 1
# reprovar, porque quem esta mexendo no conhecimento da Iza eh quem tem
# contexto para fechar uma acao aberta:
#   - docs/iza-facts-changelog.md
#   - apps/api/src/services/izaFactsService.ts
#   - apps/api/src/agents/evalSetZappIQ.ts
#   - apps/api/scripts/removerTabelaDePrecosDaIza.ts
#
# Variaveis de teste:
#   IZA_CHANGELOG_PATH  outro arquivo de changelog (fixture)
#   IZA_HOJE            outra data de hoje (AAAA-MM-DD)
#   IZA_LIMITE_DIAS     outro limite padrao (default 7)
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

IZA_EXTRA_PATTERNS=(
  "^docs/iza-facts-changelog\.md$"
  "^apps/api/src/services/izaFactsService\.ts$"
  "^apps/api/src/agents/evalSetZappIQ\.ts$"
  "^apps/api/scripts/removerTabelaDePrecosDaIza\.ts$"
)

CHANGELOG_PATH="${IZA_CHANGELOG_PATH:-docs/iza-facts-changelog.md}"

# ============================================================================
# ARQUIVOS MUDADOS - as duas partes precisam saber o que o PR tocou
# ============================================================================

echo "[drift] Comparando ${BASE_SHA}...${HEAD_SHA}"

CHANGED_FILES=$(git diff --name-only "${BASE_SHA}" "${HEAD_SHA}" || git diff --name-only "${BASE_SHA}" "${HEAD_SHA}")

# Quais dos arquivos mudados casam com a lista de padroes recebida.
casa_padroes() {
  local achados=""
  local pattern
  for pattern in "$@"; do
    local matches
    matches=$(echo "${CHANGED_FILES}" | grep -E "${pattern}" || true)
    if [ -n "${matches}" ]; then
      achados="${achados}${matches}"$'\n'
    fi
  done
  printf '%s' "${achados}"
}

TOUCHED_SENSITIVE="$(casa_padroes "${SENSITIVE_PATTERNS[@]}")"
TOUCHED_IZA="$(casa_padroes "${SENSITIVE_PATTERNS[@]}" "${IZA_EXTRA_PATTERNS[@]}")"

# ============================================================================
# PARTE 1 - PRAZO DAS ACOES ABERTAS (achado A229)
# ----------------------------------------------------------------------------
# A trava antiga so exigia EDITAR o changelog. Resultado: 13 acoes '- [ ]' e
# nenhuma '- [x]', incluindo 'UPDATE facts de pricing: Scale' aberta desde
# julho enquanto a Iza vendia o Scale pelo preco de antes do Pricing V4.
# Registrar virou um ritual sem consequencia.
#
# Toda acao aberta carrega a data em que foi aberta e tem 7 dias:
#
#   - [ ] (aberto em AAAA-MM-DD) UPDATE fact `xxx` ...
#   - [x] (aberto em AAAA-MM-DD, feito em AAAA-MM-DD) ...
#
# Uma acao pode trocar os 7 dias por um vencimento proprio, quando o prazo eh
# do mundo e nao do repositorio:
#
#   - [ ] (aberto em AAAA-MM-DD, vence em AAAA-MM-DD) CREATE fact `yyy` ...
#
# Quem manda em cada caso:
#   - acao SEM 'vence em': 7 dias, e so reprova PR que toca caminho da Iza.
#     Nos demais PRs o relatorio sai e o check passa. O prazo existe para
#     cobrar quem tem contexto, nao para travar o repositorio inteiro.
#   - acao COM 'vence em': o vencimento substitui os 7 dias e reprova QUALQUER
#     PR a partir daquele dia. Foi uma decisao consciente de data.
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
VENCIMENTO_ERROS=""

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
  resumo="$(printf '%s' "${texto}" | cut -c1-110)"
  data="$(printf '%s' "${texto}" | grep -oE '\(aberto em [0-9]{4}-[0-9]{2}-[0-9]{2}' | head -1 | grep -oE '[0-9]{4}-[0-9]{2}-[0-9]{2}' || true)"
  vence="$(printf '%s' "${texto}" | grep -oE 'vence em [0-9]{4}-[0-9]{2}-[0-9]{2}' | head -1 | grep -oE '[0-9]{4}-[0-9]{2}-[0-9]{2}' || true)"

  if [ -z "${data}" ]; then
    PRAZO_ERROS="${PRAZO_ERROS}  linha ${numero}: acao aberta SEM data. Use '- [ ] (aberto em ${HOJE}) ...'\n"
    continue
  fi

  data_epoch="$(para_epoch "${data}")"
  if [ -z "${data_epoch}" ]; then
    PRAZO_ERROS="${PRAZO_ERROS}  linha ${numero}: data '${data}' invalida.\n"
    continue
  fi

  # Vencimento proprio manda: substitui os 7 dias e vale em qualquer PR.
  if [ -n "${vence}" ]; then
    vence_epoch="$(para_epoch "${vence}")"
    if [ -z "${vence_epoch}" ]; then
      PRAZO_ERROS="${PRAZO_ERROS}  linha ${numero}: vencimento '${vence}' invalido.\n"
      continue
    fi
    if [ "${HOJE_EPOCH}" -ge "${vence_epoch}" ]; then
      VENCIMENTO_ERROS="${VENCIMENTO_ERROS}  linha ${numero}: VENCEU em ${vence} -> ${resumo}\n"
    else
      echo "[drift]   linha ${numero}: aberta em ${data}, vence em ${vence} (ainda no prazo)."
    fi
    continue
  fi

  dias=$(( (HOJE_EPOCH - data_epoch) / 86400 ))
  if [ "${dias}" -gt "${LIMITE_DIAS}" ]; then
    PRAZO_ERROS="${PRAZO_ERROS}  linha ${numero}: aberta ha ${dias} dias (limite ${LIMITE_DIAS}) -> ${resumo}\n"
  fi
done < "${CHANGELOG_PATH}"

# Cerca que abriu e nao fechou engole o resto do arquivo em silencio: toda acao
# depois dela vira 'exemplo' e sai da conferencia. Isso ja seria a trava
# inteira desligada por um acento de crase esquecido.
if [ "${DENTRO_DE_CERCA}" -eq 1 ]; then
  echo ""
  echo "============================================================"
  echo "[drift] FAIL: cerca de codigo nao fechada em ${CHANGELOG_PATH}."
  echo ""
  echo "Ha um numero impar de linhas comecando com tres crases. A partir da"
  echo "cerca aberta, TODA acao do arquivo deixaria de ser conferida, porque o"
  echo "script trata o que esta dentro de cerca como exemplo. Feche a cerca."
  echo "============================================================"
  echo ""
  exit 1
fi

if [ -n "${VENCIMENTO_ERROS}" ]; then
  cat <<EOF

============================================================
[drift] FAIL: ha acao com VENCIMENTO PROPRIO ja vencido em ${CHANGELOG_PATH}.

EOF
  echo -e "${VENCIMENTO_ERROS}"
  cat <<EOF
Este prazo nao depende do PR: a data foi escrita na propria acao porque o
mundo cobra nela (a tarifa da Meta comeca em 01/10 tenha ou nao PR de Iza).
Por isso ele reprova qualquer PR do repositorio.

O que fazer:
  1. Execute a acao e marque '- [x] (aberto em ..., feito em ${HOJE})'.
  2. Se a acao nao faz mais sentido, marque '- [x]' explicando por que.
  3. Se a data precisa mudar, mude 'vence em' escrevendo na propria linha
     por que mudou. Adiar eh uma decisao consciente, nao o padrao.
============================================================

EOF
  exit 1
fi

if [ -n "${PRAZO_ERROS}" ]; then
  cat <<EOF

============================================================
[drift] Acao aberta vencida em ${CHANGELOG_PATH} (limite ${LIMITE_DIAS} dias):

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
  4. Se o prazo certo eh uma DATA e nao um numero de dias, escreva
     '(aberto em AAAA-MM-DD, vence em AAAA-MM-DD)'.

Por que isso importa: entre 03/05 e 25/05 a Iza ofereceu o Scale a um preco
que ja tinha mudado, porque a acao de atualizar os facts ficou aberta.
============================================================

EOF

  if [ -n "${TOUCHED_IZA}" ]; then
    echo "[drift] FAIL: este PR toca caminho da Iza, entao a acao vencida reprova."
    echo "[drift] Caminhos da Iza tocados:"
    printf '%s' "${TOUCHED_IZA}" | sed 's/^/   /'
    echo ""
    exit 1
  fi

  echo "[drift] Este PR nao toca caminho da Iza: o relatorio acima fica como"
  echo "[drift] aviso e o check segue. Quem mexer na Iza vai ser cobrado."
  echo ""
else
  echo "[drift] Nenhuma acao aberta vencida. OK."
  echo ""
fi

# ============================================================================
# PARTE 2 - PATHS SENSIVEIS SEM ENTRADA NO CHANGELOG
# ============================================================================

# Label no-iza-impact (passado pelo workflow como IZA_PULAR_PARTE2): pula so a
# Parte 2. A Parte 1 ja rodou acima e vale mesmo com o label.
if [ "${IZA_PULAR_PARTE2:-}" = "true" ]; then
  echo "[drift] label no-iza-impact: Parte 2 pulada. PASS."
  exit 0
fi

if [ -z "${CHANGED_FILES}" ]; then
  echo "[drift] Nenhum arquivo mudou. PASS."
  exit 0
fi

if [ -z "${TOUCHED_SENSITIVE}" ]; then
  echo "[drift] PR nao tocou nenhum path sensivel. PASS."
  exit 0
fi

echo ""
echo "[drift] PR tocou os seguintes paths sensiveis:"
printf '%s' "${TOUCHED_SENSITIVE}" | sed 's/^/   /'

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
