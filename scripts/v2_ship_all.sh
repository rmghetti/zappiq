#!/usr/bin/env bash
# ============================================================
# v2_ship_all.sh — Fase 0 · split em 18 PRs automatizados
# Dossiê V2 · D-Day 30/04/2026
# ============================================================
# Uso: bash scripts/v2_ship_all.sh
# Pré-req: cd até a raiz do repo zappiq/ antes de rodar.
# ============================================================

set -euo pipefail

# ------- cores e logs -------
G='\033[0;32m'; R='\033[0;31m'; Y='\033[1;33m'; B='\033[0;34m'; C='\033[1;36m'; N='\033[0m'
hr()   { echo -e "${B}────────────────────────────────────────────────${N}"; }
step() { echo -e "\n${C}▶ [${1}/18] ${2}${N}"; }
ok()   { echo -e "${G}  ✓ ${1}${N}"; }
skip() { echo -e "${Y}  ↷ ${1}${N}"; }
fail() { echo -e "${R}  ✗ ${1}${N}"; exit 1; }
warn() { echo -e "${Y}  ! ${1}${N}"; }

# ------- diretório temporário p/ mensagens de commit -------
MSG_DIR="$(mktemp -d -t zappiq-v2.XXXXXX)"
trap 'rm -rf "$MSG_DIR"' EXIT

# ============================================================
# 0. PRÉ-VOO
# ============================================================
clear
echo -e "${B}"
echo "╔══════════════════════════════════════════════════════╗"
echo "║   ZAPPIQ V2 · SHIP ALL · 18 PRs automatizados        ║"
echo "║   Gerado pelo agente executivo-sênior · 2026-04-19   ║"
echo "╚══════════════════════════════════════════════════════╝"
echo -e "${N}"

hr
echo "Pré-voo (checando ambiente)..."
hr

[[ -f "scripts/v2_regression_check.ts" ]] \
  || fail "Não estou na raiz do repo. cd até a pasta zappiq/ que contém scripts/v2_regression_check.ts"
ok "Diretório do repo OK"

command -v git  >/dev/null || fail "git não instalado"
command -v gh   >/dev/null || fail "gh (GitHub CLI) não instalado · rode: brew install gh"
command -v pnpm >/dev/null || fail "pnpm não instalado · rode: npm install -g pnpm"
ok "Ferramentas OK (git, gh, pnpm)"

gh auth status >/dev/null 2>&1 \
  || fail "gh não autenticado · rode uma vez: gh auth login"
ok "GitHub CLI autenticado"

[[ -f .git/index.lock ]] && rm -f .git/index.lock && warn "index.lock órfão removido"

CUR_BRANCH=$(git branch --show-current)
if [[ "$CUR_BRANCH" != "main" ]]; then
  warn "Você estava na branch '$CUR_BRANCH' · trocando para main"
  git checkout main
fi
ok "Branch main ativa"

echo "  Sincronizando com origin/main (só fetch, sem rebase)..."
git fetch origin --quiet || warn "fetch falhou · seguindo mesmo assim"
LOCAL_SHA=$(git rev-parse HEAD 2>/dev/null || echo "")
REMOTE_SHA=$(git rev-parse origin/main 2>/dev/null || echo "")
if [[ -n "$REMOTE_SHA" && "$LOCAL_SHA" != "$REMOTE_SHA" ]]; then
  if git merge-base --is-ancestor "$LOCAL_SHA" "$REMOTE_SHA" 2>/dev/null; then
    warn "main local está ATRÁS de origin/main · conflitos podem aparecer no merge dos PRs"
  elif git merge-base --is-ancestor "$REMOTE_SHA" "$LOCAL_SHA" 2>/dev/null; then
    ok "main local está à frente de origin/main (commits pendentes de push)"
  else
    warn "main local divergiu de origin/main · revise antes dos PRs"
  fi
else
  ok "main local sincronizada com origin/main"
fi

hr
echo "Sanity check da regression (esperado ≥ 45/52)..."
hr
if pnpm tsx scripts/v2_regression_check.ts; then
  ok "Regression passou no sanity"
else
  fail "Regression abaixo do mínimo. NÃO commite. Abra o output e investigue."
fi

# ============================================================
# 1. HELPER · 1 block = 1 branch = 1 PR
# ============================================================
run_block() {
  local num="$1"      # "01" .. "18"
  local branch="$2"
  local title="$3"
  local body="$4"
  local msg_file="$5"
  shift 5
  local files=("$@")

  step "$num" "$title"

  # Branch já foi processada em rodada anterior?
  if git show-ref --verify --quiet "refs/heads/$branch"; then
    skip "Branch $branch já existe localmente · pulando (rode 'git branch -D $branch' para refazer)"
    return 0
  fi

  git checkout -b "$branch" >/dev/null

  # Adiciona somente arquivos que existem (evita falha silenciosa)
  local existing=()
  for f in "${files[@]}"; do
    if [[ -e "$f" ]]; then existing+=("$f"); else warn "arquivo ausente · ignorado: $f"; fi
  done
  if [[ ${#existing[@]} -eq 0 ]]; then
    warn "Nenhum arquivo para adicionar · voltando para main"
    git checkout main >/dev/null
    git branch -D "$branch" >/dev/null 2>&1 || true
    return 0
  fi
  git add -- "${existing[@]}"

  # Nada staged? (já commitado em rodada anterior)
  if git diff --cached --quiet; then
    skip "Nada novo para commitar em $branch"
    git checkout main >/dev/null
    git branch -D "$branch" >/dev/null 2>&1 || true
    return 0
  fi

  git commit -F "$msg_file" --quiet
  ok "commit criado"

  if git push -u origin HEAD --quiet 2>/dev/null; then
    ok "push para origin/$branch"
  else
    warn "push falhou · provavelmente branch já existe remotamente · segue"
  fi

  if gh pr view "$branch" >/dev/null 2>&1; then
    skip "PR já existia para $branch"
  else
    gh pr create --title "$title" --body "$body" >/dev/null \
      && ok "PR criado: $title" \
      || warn "gh pr create falhou · abra manualmente"
  fi

  git checkout main >/dev/null
}

# ============================================================
# 2. MENSAGENS DE COMMIT (pt-BR · heredoc)
# ============================================================

cat > "$MSG_DIR/01.txt" <<'EOF'
feat(web): [V2-001] case Vida Plena em modo PENDING até autorização LGPD

Fonte canônica em apps/web/content/cases/vida-plena.ts com flag
AUTHORIZATION_STATUS controlando renderização. Quando PENDING (default),
UI exibe 'Exemplo ilustrativo · cliente Saúde' sem atribuir dados
mensuráveis a pessoa/empresa nomeada. Desbloqueio via B-01.

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>
EOF

cat > "$MSG_DIR/02.txt" <<'EOF'
fix(web): [V2-002] remover nomes fictícios 'Dra. Camila' / 'Clínica Vida Plena'

Hero + variantes A/B/C + Products + DemoPage + SeloPage. Substituído
por placeholders anônimos ('Sua Clínica', 'Dra. responsável'). Depende
de B-01 para voltar com nomes reais.

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>
EOF

cat > "$MSG_DIR/03.txt" <<'EOF'
feat(web): [V2-003,V2-016] cap 300% e payback mínimo 90d no ROI + disclaimer

Módulo puro roiMath.ts com sanity caps institucionais. ROICalculator
consome e renderiza bloco amber com metodologia e limites. Testes via
tsx passam 4/4 (cap, range PME, linhas independentes, NaN-free).

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>
EOF

cat > "$MSG_DIR/04.txt" <<'EOF'
feat(web): [V2-008,V2-024,V2-025,V2-026,V2-028,V2-030,V2-033,V2-034,V2-038] footer canônico

- V2-008 / V2-024: 8 módulos canônicos (ZappIQCore, PulseAI, SparkCampaigns,
  RadarInsights, NexusCRM, ForgeStudio, EchoCopilot, ShieldCompliance)
- V2-025: CEO removido como DPO · caixa dpo@zappiq.com.br (LGPD Art. 41)
- V2-026: razão social Onze e Onze Consultoria Empresarial Ltda (d.b.a. ZappIQ)
- V2-028: 5 links legais canônicos (termos, privacidade, cookies, DPA, fair-use)
- V2-030: ícones sociais removidos até B-06; contato marketing exposto
- V2-033: coluna Empresa com /sobre /contato /carreiras /parceiros /founders
- V2-034: docs e API apontam para subdomínios oficiais docs.zappiq.com.br
- V2-038: status.zappiq.com.br no footer

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>
EOF

cat > "$MSG_DIR/05.txt" <<'EOF'
feat(web): [V2-009,V2-010,V2-050,V2-051] registry e metodologia pública de benchmarks

Registry em content/competitor-benchmarks.ts exige evidenceUrl,
capturedAt, verifiedBy. Página /legal/benchmarks-concorrentes publica
metodologia, fontes permitidas/vedadas, janela de revalidação 60 dias,
direito de resposta conforme CONAR.

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>
EOF

cat > "$MSG_DIR/06.txt" <<'EOF'
refactor(web): [V2-011,V2-014] trust-bar de parceiros tecnológicos

Substitui logos fakes de cliente por parceiros reais (Meta BSP via
360Dialog, Anthropic, Stripe, Cloudflare, Supabase, Vercel). Badge Meta
passa a ser 'Parceria WhatsApp Business via BSP homologado Meta' —
evita alegação de 'Parceiro Oficial Meta' sem homologação (B-08).

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>
EOF

cat > "$MSG_DIR/07.txt" <<'EOF'
docs: [V2-023] BLOCKERS.md com 12 bloqueadores humanos

Inventariam apenas as ações que dependem de contrato/aprovação. Todo
código já implementa fallback técnico. Formato: id | descrição | quem
libera | prazo | fallback implementado.

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>
EOF

cat > "$MSG_DIR/08.txt" <<'EOF'
fix(web): [V2-025] remover nome do CEO do papel de DPO (LGPD Art. 41)

Referências a 'Rodrigo Ghetti' como DPO em /legal/dpa e /lgpd substituídas
por 'DPO externo em homologação' + dpo@zappiq.com.br. Contratação do
DPO externo segue em B-03 (opções pré-cotadas: DPOnet, Protejo, Saraiva,
OneTrust).

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>
EOF

cat > "$MSG_DIR/09.txt" <<'EOF'
feat(web): [V2-012,V2-013,V2-017,V2-028] 4 páginas legais novas

- /legal/cookies · categorias, base legal, revogação
- /legal/fair-use · envelope por plano + hardcap de abuso
- /legal/parceria-meta · esclarecimento BSP 360Dialog (anti enganoso)
- /legal/enderecos-comerciais · CDC Art. 39 XII

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>
EOF

cat > "$MSG_DIR/10.txt" <<'EOF'
feat(web): [V2-031,V2-032,V2-033] páginas /sobre /contato /carreiras

Conteúdo institucional em pt-BR. /contato com 6 canais por tipo de
solicitação. /carreiras em modo pipeline aberto até primeiras vagas
formais.

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>
EOF

cat > "$MSG_DIR/11.txt" <<'EOF'
feat(web): [V2-043,V2-052] Programa ZappIQ Partners v1

Tiers Authorized/Preferred/Elite com comissão recorrente 10/20/30%.
Benefícios: sandbox, certificação, co-marketing, AM dedicado no Elite.

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>
EOF

cat > "$MSG_DIR/12.txt" <<'EOF'
feat(web): [V2-005,V2-007] /founders · 50 vagas · 30% vitalício

Plano Founders restruturado com 50 vagas teto, 30% vitalício enquanto
contrato ativo, 12 meses compromisso, 6 perks (Slack direto, early
access, case study opcional, voto em roadmap).

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>
EOF

cat > "$MSG_DIR/13.txt" <<'EOF'
feat(web): [V2-048,V2-049] /migracao-zenvia · playbook 4 fases · setup fee zero

Diagnóstico → re-templating → paralelo controlado → cutover. 30 dias,
BSP change gerido pela ZappIQ. Setup fee ZERO.

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>
EOF

cat > "$MSG_DIR/14.txt" <<'EOF'
feat(api): [V2-018,V2-019] LLMRouter multi-provider com circuit breaker

Cadeia: Claude Opus 4.6 → Haiku 4.5 → GPT-4o-mini. Circuit breaker
por provedor (3 falhas/60s abre por 120s). Erros 4xx do cliente NÃO
escalam para fallback. Status público via getStatus() para healthcheck.

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>
EOF

cat > "$MSG_DIR/15.txt" <<'EOF'
feat(api): [V2-021] AuthRevocationService · JTI blacklist + user-wide revoke

Redis SETEX com TTL = exp - now. Fallback in-memory para dev/test.
Função revokeAllUserTokens para password reset / account lock. Middleware
auth.ts deve chamar isRevoked antes de validar.

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>
EOF

cat > "$MSG_DIR/16.txt" <<'EOF'
feat(api): [V2-022] middleware webhookReplayProtection

Janela ±5min no X-Hub-Timestamp + dedup messageId via Redis SETNX
(TTL 24h). Fallback in-memory. Fail-open em produção se Redis cair
(perder webhook é pior que replay raro). Plugar em server.ts antes
da rota /api/webhook/whatsapp.

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>
EOF

cat > "$MSG_DIR/17.txt" <<'EOF'
ci: regression script com 52 assertions para o Dossiê V2

Roda no CI como gate de merge. Cada assertion corresponde a 1 gap V2
identificado no Diagnóstico Cru de 17/04. Falhas impedem merge para
main até correção ou registro explícito em BLOCKERS.md.

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>
EOF

cat > "$MSG_DIR/18.txt" <<'EOF'
docs: [V2] CHANGELOG + relatórios de onda + dossiê de execução

CHANGELOG seção [Pre-launch] 2026-04-30 com todos os 52 gaps rastreados.
Relatórios de onda 1/2/3 com status granular. Dossiê executivo com
síntese C-level. MORNING_CHECKLIST com comandos de split.

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>
EOF

# ============================================================
# 3. EXECUÇÃO · 18 BLOCOS
# ============================================================
hr
echo -e "${C}Iniciando split em 18 PRs...${N}"
hr

run_block "01" "fix/v2-001-case-vida-plena-pending" \
  "[V2-001] case Vida Plena em modo PENDING" \
  "Closes V2-001. Fallback LGPD-safe. Ver BLOCKERS B-01." \
  "$MSG_DIR/01.txt" \
  "apps/web/content/cases/vida-plena.ts" \
  "apps/web/content/cases/index.ts"

run_block "02" "fix/v2-002-hero-anonimo" \
  "[V2-002] anonimizar heroes até autorização LGPD" \
  "Closes V2-002. Pair com V2-001." \
  "$MSG_DIR/02.txt" \
  "apps/web/components/landing/Hero.tsx" \
  "apps/web/components/landing/HeroVariantA.tsx" \
  "apps/web/components/landing/HeroVariantB.tsx" \
  "apps/web/components/landing/HeroVariantC.tsx" \
  "apps/web/components/landing/Products.tsx" \
  "apps/web/app/demo/DemoPage.tsx" \
  "apps/web/app/selo-zappiq/SeloPage.tsx"

run_block "03" "fix/v2-003-roi-cap-300" \
  "[V2-003,V2-016] sanity caps e disclaimer no ROI" \
  "Closes V2-003 e V2-016." \
  "$MSG_DIR/03.txt" \
  "apps/web/lib/roiMath.ts" \
  "apps/web/lib/__tests__/roiMath.test.ts" \
  "apps/web/components/landing/ROICalculator.tsx"

run_block "04" "fix/v2-footer-canonical" \
  "[V2-footer] footer canônico (8 gaps)" \
  "Closes V2-008,V2-024,V2-025,V2-026,V2-028,V2-030,V2-033,V2-034,V2-038." \
  "$MSG_DIR/04.txt" \
  "apps/web/components/landing/LandingFooter.tsx"

run_block "05" "fix/v2-010-benchmarks-publicos" \
  "[V2-010] metodologia benchmark pública" \
  "Closes V2-009, V2-010, V2-050, V2-051." \
  "$MSG_DIR/05.txt" \
  "apps/web/content/competitor-benchmarks.ts" \
  "apps/web/app/legal/benchmarks-concorrentes/page.tsx"

run_block "06" "fix/v2-011-trustbar-parceiros" \
  "[V2-011] trust-bar parceiros tecnológicos" \
  "Closes V2-011 e V2-014. Sem logo-washing." \
  "$MSG_DIR/06.txt" \
  "apps/web/components/landing/SocialProof.tsx"

run_block "07" "docs/v2-023-blockers" \
  "[V2-023] BLOCKERS.md" \
  "Closes V2-023." \
  "$MSG_DIR/07.txt" \
  "BLOCKERS.md"

run_block "08" "fix/v2-025-dpo-externo" \
  "[V2-025] DPO externo · purgar CEO" \
  "Closes V2-025. Desbloqueio em B-03." \
  "$MSG_DIR/08.txt" \
  "apps/web/app/legal/dpa/page.tsx" \
  "apps/web/app/lgpd/page.tsx"

run_block "09" "feat/v2-legal-pages" \
  "[V2-legal] 4 páginas legais novas" \
  "Closes V2-012, V2-013, V2-017, V2-028 (parte)." \
  "$MSG_DIR/09.txt" \
  "apps/web/app/legal/cookies/page.tsx" \
  "apps/web/app/legal/fair-use/page.tsx" \
  "apps/web/app/legal/parceria-meta/page.tsx" \
  "apps/web/app/legal/enderecos-comerciais/page.tsx"

run_block "10" "feat/v2-institucional" \
  "[V2-inst] 3 páginas institucionais" \
  "Closes V2-031, V2-032, V2-033." \
  "$MSG_DIR/10.txt" \
  "apps/web/app/sobre/page.tsx" \
  "apps/web/app/contato/page.tsx" \
  "apps/web/app/carreiras/page.tsx"

run_block "11" "feat/v2-043-parceiros" \
  "[V2-043] Programa Parceiros v1" \
  "Closes V2-043 e V2-052." \
  "$MSG_DIR/11.txt" \
  "apps/web/app/parceiros/page.tsx"

run_block "12" "feat/v2-005-founders" \
  "[V2-005] Founders restruturado" \
  "Closes V2-005 e V2-007." \
  "$MSG_DIR/12.txt" \
  "apps/web/app/founders/page.tsx"

run_block "13" "feat/v2-048-migracao-zenvia" \
  "[V2-048] Playbook anti-Zenvia" \
  "Closes V2-048 e V2-049." \
  "$MSG_DIR/13.txt" \
  "apps/web/app/migracao-zenvia/page.tsx"

run_block "14" "feat/v2-018-llm-router" \
  "[V2-018] LLMRouter fallback + breaker" \
  "Closes V2-018 e V2-019." \
  "$MSG_DIR/14.txt" \
  "apps/api/src/services/llm/LLMRouter.ts"

run_block "15" "feat/v2-021-auth-revocation" \
  "[V2-021] AuthRevocationService" \
  "Closes V2-021." \
  "$MSG_DIR/15.txt" \
  "apps/api/src/services/AuthRevocationService.ts"

run_block "16" "feat/v2-022-webhook-replay" \
  "[V2-022] webhook replay protection" \
  "Closes V2-022." \
  "$MSG_DIR/16.txt" \
  "apps/api/src/middleware/webhookReplayProtection.ts"

run_block "17" "ci/v2-regression-check" \
  "[V2-ci] regression 52 assertions" \
  "Gate automático." \
  "$MSG_DIR/17.txt" \
  "scripts/v2_regression_check.ts"

run_block "18" "docs/v2-relatorios-finais" \
  "[V2-docs] relatórios finais" \
  "Documentação de execução V2 (sem closes)." \
  "$MSG_DIR/18.txt" \
  "CHANGELOG.md" \
  "RELATORIO_ONDA_1.md" \
  "RELATORIO_ONDA_2.md" \
  "RELATORIO_ONDA_3.md" \
  "DOSSIE_V2_EXECUCAO_COMPLETA.md" \
  "MORNING_CHECKLIST.md"

# ============================================================
# 4. SANITY FINAL
# ============================================================
hr
echo -e "${C}Sanity final...${N}"
hr

git checkout main >/dev/null
echo "PRs abertos no repositório:"
gh pr list --state open --limit 30 || warn "gh pr list falhou"

hr
echo -e "${G}╔══════════════════════════════════════════════════════╗${N}"
echo -e "${G}║  CONCLUÍDO · 18 blocos processados                   ║${N}"
echo -e "${G}╚══════════════════════════════════════════════════════╝${N}"
echo
echo "Próximos passos (manual):"
echo "  1. Abra o GitHub e revise cada PR · aprove e faça merge na"
echo "     ordem sugerida em MORNING_CHECKLIST.md §3."
echo "  2. Após todos merged, rode o sanity final:"
echo "       git checkout main && git pull --rebase origin main"
echo "       pnpm install && pnpm tsx scripts/v2_regression_check.ts"
echo "  3. Se regression ≥ 48/52, libere o deploy."
echo
