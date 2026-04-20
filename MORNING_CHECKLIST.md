# MORNING CHECKLIST — 2026-04-19 (manhã)

> **Contexto:** execução noturna do Dossiê V2 terminou com todas as edições aplicadas no working-tree do repo. O sandbox não teve permissão para criar `.git/index.lock`, então **branches e commits ficaram pendentes para você aplicar à mão pela manhã**. Este documento traz as sequências exatas.

---

## 0. Pré-voo (5 min)

Abrir terminal em `~/.../PROJETO ZAPPIQ 2026/zappiq/` e conferir o estado:

```bash
cd "PROJETO ZAPPIQ 2026/zappiq"
git status | head -40
git diff --stat | head -40
node --version   # deve ser >= 20
pnpm --version
```

Se `.git/index.lock` ainda existir:

```bash
rm -f .git/index.lock
```

Se o CI já tiver merged algum PR que toca os mesmos arquivos, fazer rebase primeiro:

```bash
git fetch origin
git rebase origin/main
```

---

## 1. Sanity check do trabalho noturno (3 min)

Rodar a regression V2 contra a árvore atual (ainda sem commits):

```bash
pnpm tsx scripts/v2_regression_check.ts
```

Esperar ≥ 45/52 verdes. Os que restarem como FAIL são os diferidos registrados em `BLOCKERS.md` — nenhum deles bloqueia o D-Day.

Se houver FAIL inesperado: checar o output do script e abrir issue antes de commitar.

---

## 2. Split em branches per-gap · 1 commit por gap (45–60 min)

**Padrão de branch:** `fix/v2-###-slug-curto` · **commit em pt-BR** no formato Conventional Commits.

A execução é sequencial — cada bloco fecha 1 gap. Depois do `git commit`, rodar `pnpm lint && pnpm typecheck && pnpm build` ao menos 1× por grupo para capturar regressões.

### 2.1 · V2-01 · Case Vida Plena em modo PENDING

```bash
git checkout -b fix/v2-001-case-vida-plena-pending
git add apps/web/content/cases/vida-plena.ts apps/web/content/cases/index.ts
git commit -m "feat(web): [V2-001] case Vida Plena em modo PENDING até autorização LGPD

Fonte canônica em apps/web/content/cases/vida-plena.ts com flag
AUTHORIZATION_STATUS controlando renderização. Quando PENDING (default),
UI exibe 'Exemplo ilustrativo · cliente Saúde' sem atribuir dados
mensuráveis a pessoa/empresa nomeada. Desbloqueio via B-01."
git push -u origin HEAD
gh pr create --title "[V2-001] case Vida Plena em modo PENDING" --body "Closes V2-001. Fallback LGPD-safe. Ver BLOCKERS B-01."
git checkout main
```

### 2.2 · V2-02 · Hero e variantes livres de "Dra. Camila"

```bash
git checkout -b fix/v2-002-hero-anonimo
git add apps/web/components/landing/Hero.tsx apps/web/components/landing/HeroVariantA.tsx apps/web/components/landing/HeroVariantB.tsx apps/web/components/landing/HeroVariantC.tsx apps/web/components/landing/Products.tsx apps/web/app/demo/DemoPage.tsx apps/web/app/selo-zappiq/SeloPage.tsx
git commit -m "fix(web): [V2-002] remover nomes fictícios 'Dra. Camila'/'Clínica Vida Plena'

Hero + variantes A/B/C + Products + DemoPage + SeloPage. Substituído
por placeholders anônimos ('Sua Clínica', 'Dra. responsável'). Depende
de B-01 para voltar com nomes reais."
git push -u origin HEAD
gh pr create --title "[V2-002] anonimizar heroes até autorização LGPD" --body "Closes V2-002. Pair com V2-001."
git checkout main
```

### 2.3 · V2-03 & V2-16 · ROI cap 300% + disclaimer

```bash
git checkout -b fix/v2-003-roi-cap-300
git add apps/web/lib/roiMath.ts apps/web/lib/__tests__/roiMath.test.ts apps/web/components/landing/ROICalculator.tsx
git commit -m "feat(web): [V2-003,V2-016] cap 300% e payback mín 90d no ROI + disclaimer

Módulo puro roiMath.ts com sanity caps institucionais. ROICalculator
consome e renderiza bloco amber com metodologia e limites. Testes via
tsx passam 4/4 (cap, range PME, linhas independentes, NaN-free)."
git push -u origin HEAD
gh pr create --title "[V2-003,V2-016] sanity caps e disclaimer no ROI" --body "Closes V2-003 e V2-016."
git checkout main
```

### 2.4 · V2-08 · Módulos canônicos (via footer que está dentro do V2-024 — se quiser granularidade máxima, unir)

Observação: V2-08 (fonte de verdade 8 módulos) está concretizado no mesmo commit do footer (V2-024, V2-025, V2-026, V2-028, V2-030, V2-033, V2-034, V2-038). Sugiro **agrupar em 1 PR multi-gap** em vez de 8 PRs triviais, reduzindo fricção de review:

```bash
git checkout -b fix/v2-footer-canonical
git add apps/web/components/landing/LandingFooter.tsx
git commit -m "feat(web): [V2-008,V2-024,V2-025,V2-026,V2-028,V2-030,V2-033,V2-034,V2-038] footer canônico

- V2-008 / V2-024: 8 módulos canônicos (ZappIQCore, PulseAI, SparkCampaigns,
  RadarInsights, NexusCRM, ForgeStudio, EchoCopilot, ShieldCompliance)
- V2-025: CEO removido como DPO — caixa dpo@zappiq.com.br (LGPD Art. 41)
- V2-026: razão social Onze e Onze Consultoria Empresarial Ltda (d.b.a. ZappIQ)
- V2-028: 5 links legais canônicos (termos, privacidade, cookies, DPA, fair-use)
- V2-030: ícones sociais removidos até B-06; contato marketing exposto
- V2-033: coluna Empresa com /sobre /contato /carreiras /parceiros /founders
- V2-034: docs e API apontam para subdomínios oficiais docs.zappiq.com.br
- V2-038: status.zappiq.com.br no footer"
git push -u origin HEAD
gh pr create --title "[V2-footer] footer canônico (8 gaps)" --body "Closes V2-008,V2-024,V2-025,V2-026,V2-028,V2-030,V2-033,V2-034,V2-038."
git checkout main
```

### 2.5 · V2-09 & V2-10 & V2-50 & V2-51 · Benchmarks concorrentes

```bash
git checkout -b fix/v2-010-benchmarks-publicos
git add apps/web/content/competitor-benchmarks.ts apps/web/app/legal/benchmarks-concorrentes/page.tsx
git commit -m "feat(web): [V2-009,V2-010,V2-050,V2-051] registry e metodologia pública de benchmarks

Registry em content/competitor-benchmarks.ts exige evidenceUrl,
capturedAt, verifiedBy. Página /legal/benchmarks-concorrentes publica
metodologia, fontes permitidas/vedadas, janela de revalidação 60 dias,
direito de resposta conforme CONAR."
git push -u origin HEAD
gh pr create --title "[V2-010] metodologia benchmark pública" --body "Closes V2-009, V2-010, V2-050, V2-051."
git checkout main
```

### 2.6 · V2-11 & V2-14 · Trust-bar de parceiros tecnológicos

```bash
git checkout -b fix/v2-011-trustbar-parceiros
git add apps/web/components/landing/SocialProof.tsx
git commit -m "refactor(web): [V2-011,V2-014] trust-bar de parceiros tecnológicos

Substitui logos fakes de cliente por parceiros reais (Meta BSP via
360Dialog, Anthropic, Stripe, Cloudflare, Supabase, Vercel). Badge Meta
passa a ser 'Parceria WhatsApp Business via BSP homologado Meta' —
evita alegação de 'Parceiro Oficial Meta' sem homologação (B-08)."
git push -u origin HEAD
gh pr create --title "[V2-011] trust-bar parceiros tecnológicos" --body "Closes V2-011 e V2-014. Sem logo-washing."
git checkout main
```

### 2.7 · V2-23 · BLOCKERS.md (se ainda não commitado)

```bash
# BLOCKERS.md já pode estar commitado. Se git status mostrar:
#   modified: BLOCKERS.md  →  criar commit:
git checkout -b docs/v2-023-blockers
git add BLOCKERS.md
git commit -m "docs: [V2-023] BLOCKERS.md com 12 bloqueadores humanos

Inventariam apenas as ações que dependem de contrato/aprovação. Todo
código já implementa fallback técnico. Formato: id | descrição | quem
libera | prazo | fallback implementado."
git push -u origin HEAD
gh pr create --title "[V2-023] BLOCKERS.md" --body "Closes V2-023."
git checkout main
```

### 2.8 · V2-25 · Purge Rodrigo como DPO

```bash
git checkout -b fix/v2-025-dpo-externo
git add apps/web/app/legal/dpa/page.tsx apps/web/app/lgpd/page.tsx
git commit -m "fix(web): [V2-025] remover nome do CEO do papel de DPO (LGPD Art. 41)

Referências a 'Rodrigo Ghetti' como DPO em /legal/dpa e /lgpd substituídas
por 'DPO externo em homologação' + dpo@zappiq.com.br. Contratação do
DPO externo segue em B-03 (opções pré-cotadas: DPOnet, Protejo, Saraiva,
OneTrust)."
git push -u origin HEAD
gh pr create --title "[V2-025] DPO externo · purgar CEO" --body "Closes V2-025. Desbloqueio em B-03."
git checkout main
```

### 2.9 · V2-12 & V2-13 & V2-17 & V2-28 · páginas legais

```bash
git checkout -b feat/v2-legal-pages
git add apps/web/app/legal/cookies/page.tsx apps/web/app/legal/fair-use/page.tsx apps/web/app/legal/parceria-meta/page.tsx apps/web/app/legal/enderecos-comerciais/page.tsx
git commit -m "feat(web): [V2-012,V2-013,V2-017,V2-028] 4 páginas legais novas

- /legal/cookies — categorias, base legal, revogação
- /legal/fair-use — envelope por plano + hardcap de abuso
- /legal/parceria-meta — esclarecimento BSP 360Dialog (anti enganoso)
- /legal/enderecos-comerciais — CDC Art. 39 XII"
git push -u origin HEAD
gh pr create --title "[V2-legal] 4 páginas legais novas" --body "Closes V2-012, V2-013, V2-017, V2-028 (parte)."
git checkout main
```

### 2.10 · V2-31 & V2-32 & V2-33 · páginas institucionais

```bash
git checkout -b feat/v2-institucional
git add apps/web/app/sobre/page.tsx apps/web/app/contato/page.tsx apps/web/app/carreiras/page.tsx
git commit -m "feat(web): [V2-031,V2-032,V2-033] páginas /sobre /contato /carreiras

Conteúdo institucional em pt-BR. /contato com 6 canais por tipo de
solicitação. /carreiras em modo pipeline aberto até primeiras vagas
formais."
git push -u origin HEAD
gh pr create --title "[V2-inst] 3 páginas institucionais" --body "Closes V2-031, V2-032, V2-033."
git checkout main
```

### 2.11 · V2-43 & V2-52 · /parceiros

```bash
git checkout -b feat/v2-043-parceiros
git add apps/web/app/parceiros/page.tsx
git commit -m "feat(web): [V2-043,V2-052] Programa ZappIQ Partners v1

Tiers Authorized/Preferred/Elite com comissão recorrente 10/20/30%.
Benefícios: sandbox, certificação, co-marketing, AM dedicado no Elite."
git push -u origin HEAD
gh pr create --title "[V2-043] Programa Parceiros v1" --body "Closes V2-043 e V2-052."
git checkout main
```

### 2.12 · V2-05 & V2-07 · /founders

```bash
git checkout -b feat/v2-005-founders
git add apps/web/app/founders/page.tsx
git commit -m "feat(web): [V2-005,V2-007] /founders · 50 vagas · 30% vitalício

Plano Founders restruturado com 50 vagas teto, 30% vitalício enquanto
contrato ativo, 12 meses compromisso, 6 perks (Slack direto, early
access, case study opcional, voto em roadmap)."
git push -u origin HEAD
gh pr create --title "[V2-005] Founders restruturado" --body "Closes V2-005 e V2-007."
git checkout main
```

### 2.13 · V2-48 & V2-49 · /migracao-zenvia

```bash
git checkout -b feat/v2-048-migracao-zenvia
git add apps/web/app/migracao-zenvia/page.tsx
git commit -m "feat(web): [V2-048,V2-049] /migracao-zenvia · playbook 4 fases, setup fee zero

Diagnóstico → re-templating → paralelo controlado → cutover. 30 dias,
BSP change gerido pela ZappIQ. Setup fee ZERO."
git push -u origin HEAD
gh pr create --title "[V2-048] Playbook anti-Zenvia" --body "Closes V2-048 e V2-049."
git checkout main
```

### 2.14 · V2-18 & V2-19 · LLMRouter + circuit breaker

```bash
git checkout -b feat/v2-018-llm-router
git add apps/api/src/services/llm/LLMRouter.ts
git commit -m "feat(api): [V2-018,V2-019] LLMRouter multi-provider com circuit breaker

Cadeia: Claude Opus 4.6 → Haiku 4.5 → GPT-4o-mini. Circuit breaker
por provedor (3 falhas/60s abre por 120s). Erros 4xx do cliente NÃO
escalam para fallback. Status público via getStatus() para healthcheck."
git push -u origin HEAD
gh pr create --title "[V2-018] LLMRouter fallback + breaker" --body "Closes V2-018 e V2-019."
git checkout main
```

### 2.15 · V2-21 · AuthRevocation

```bash
git checkout -b feat/v2-021-auth-revocation
git add apps/api/src/services/AuthRevocationService.ts
git commit -m "feat(api): [V2-021] AuthRevocationService · JTI blacklist + user-wide revoke

Redis SETEX com TTL = exp - now. Fallback in-memory para dev/test.
Função revokeAllUserTokens para password reset / account lock. Middleware
auth.ts deve chamar isRevoked antes de validar."
git push -u origin HEAD
gh pr create --title "[V2-021] AuthRevocationService" --body "Closes V2-021."
git checkout main
```

### 2.16 · V2-22 · Webhook replay protection

```bash
git checkout -b feat/v2-022-webhook-replay
git add apps/api/src/middleware/webhookReplayProtection.ts
git commit -m "feat(api): [V2-022] middleware webhookReplayProtection

Janela ±5min no X-Hub-Timestamp + dedup messageId via Redis SETNX
(TTL 24h). Fallback in-memory. Fail-open em produção se Redis cair
(perder webhook é pior que replay raro). Plugar em server.ts antes
da rota /api/webhook/whatsapp."
git push -u origin HEAD
gh pr create --title "[V2-022] webhook replay protection" --body "Closes V2-022."
git checkout main
```

### 2.17 · V2 · Regression script

```bash
git checkout -b ci/v2-regression-check
git add scripts/v2_regression_check.ts
git commit -m "ci: regression script com 52 assertions para o Dossiê V2

Roda no CI como gate de merge. Cada assertion corresponde a 1 gap V2
identificado no Diagnóstico Cru de 17/04. Falhas impedem merge para
main até correção ou registro explícito em BLOCKERS.md."
git push -u origin HEAD
gh pr create --title "[V2-ci] regression 52 assertions" --body "Gate automático."
git checkout main
```

### 2.18 · Docs finais (CHANGELOG, Relatórios, este MORNING)

```bash
git checkout -b docs/v2-relatorios-finais
git add CHANGELOG.md RELATORIO_ONDA_1.md RELATORIO_ONDA_2.md RELATORIO_ONDA_3.md DOSSIE_V2_EXECUCAO_COMPLETA.md MORNING_CHECKLIST.md
git commit -m "docs: [V2] CHANGELOG + relatórios de onda + dossiê de execução

CHANGELOG seção [Pre-launch] 2026-04-30 com todos os 52 gaps rastreados.
Relatórios de onda 1/2/3 com status granular. Dossiê executivo com
síntese C-level. MORNING_CHECKLIST com comandos de split."
git push -u origin HEAD
gh pr create --title "[V2-docs] relatórios finais" --body "Closes nada — documentação da execução V2."
git checkout main
```

---

## 3. Ordem de merge recomendada (10 min)

Sugestão de ordem para evitar conflito e deixar `main` sempre rodando:

1. `docs/v2-023-blockers` (BLOCKERS zero dependências)
2. `docs/v2-relatorios-finais`
3. `fix/v2-002-hero-anonimo` + `fix/v2-001-case-vida-plena-pending` (pair)
4. `fix/v2-footer-canonical` (maior commit — conflito provável se concorrente tocar footer)
5. `fix/v2-025-dpo-externo`
6. `feat/v2-legal-pages`
7. `feat/v2-institucional`
8. `feat/v2-043-parceiros`, `feat/v2-005-founders`, `feat/v2-048-migracao-zenvia`
9. `fix/v2-010-benchmarks-publicos`, `fix/v2-011-trustbar-parceiros`, `fix/v2-003-roi-cap-300`
10. `feat/v2-018-llm-router`, `feat/v2-021-auth-revocation`, `feat/v2-022-webhook-replay`
11. `ci/v2-regression-check`

Após cada merge: `gh pr checks` e confirmar CI verde antes de passar para o próximo.

---

## 4. Ações humanas não-código para hoje

| B-### | Ação | Prazo | Tempo estimado |
|-------|------|-------|----------------|
| B-01 | Ligar Clínica Vida Plena · pedir autorização LGPD assinada | 23/04 | 30 min |
| B-03 | Board call para aprovar DPO externo · escolher entre DPOnet/Protejo/Saraiva/OneTrust | 22/04 | 45 min |
| B-05 | Pedir ao inteligência competitiva as cotações PDF Blip/Huggy/Zenvia/Poli | 26/04 | 1h |
| B-06 | Criar contas Instagram/LinkedIn/YouTube + seed 3 posts/canal | 15/05 (pós-D-Day) | 3h |
| B-08 | Submeter aplicação Meta Tech Provider | 30/04 | 2h |
| B-11 | Revisar P&L com stack real · autorizar publicação | 22/04 | 1h |

Links diretos para aplicação/contato em `BLOCKERS.md`.

---

## 5. Sanity final (5 min)

Quando todos os PRs estiverem merged:

```bash
git checkout main
git pull --rebase origin main
pnpm install
pnpm tsx scripts/v2_regression_check.ts  # espera ≥ 48/52
pnpm lint
pnpm typecheck
pnpm build
# Opcional: lighthouse CI local
npx @lhci/cli autorun --collect.url=http://localhost:3000
```

Se o resultado regression for < 45, abrir issue bloqueando release. Se ≥ 48, liberar deploy `main`.

---

## 6. Risco aceito · notas

- Nenhum commit foi feito no sandbox noturno (`.git/index.lock` bloqueado). Todo trabalho está no working-tree — é preciso fazer o split per-gap pela manhã. Fiz a pré-organização mental de quais arquivos pertencem a qual gap no item 2.
- `pnpm lint/typecheck/build` não foi executado durante a noite (npm registry sem acesso no sandbox). CI vai validar ao push.
- Alguns fixes menores (UpgradeBanner, ConsentLog, OG, JSON-LD) foram registrados em `BLOCKERS.md` em vez de serem implementados apressadamente — cada um tem bloco detalhado de desbloqueio.

---

*Bom dia. Boa execução.*
