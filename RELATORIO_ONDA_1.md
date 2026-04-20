# RELATÓRIO ONDA 1 — CRITICAL (prazo 22/04/2026)

**Status:** 15/15 gaps tratados em código · 2 dependem de aprovação humana registrada em `BLOCKERS.md`.
**Geração automática:** 2026-04-19 (execução noturna enquanto o CEO/owner dorme).

---

## Escopo

Os 15 gaps CRITICAL são os que podem bloquear o D-Day de 30/04/2026 se deixados passar: risco de disputa legal (publicidade enganosa, LGPD), risco de credibilidade (métricas infladas, benchmarks sem fonte) e risco operacional (LLM sem fallback, webhook sem idempotência).

## Resultado por gap

| Gap | Descrição | Status | Arquivo-chave |
|-----|-----------|--------|---------------|
| V2-01 | Despublicar case Vida Plena até autorização LGPD | ✅ mitigado (flag AUTHORIZATION_STATUS=PENDING) | `apps/web/content/cases/vida-plena.ts` |
| V2-02 | Remover "Dra. Camila"/"Clínica Vida Plena" do site | ✅ concluído | Hero.tsx, HeroVariantA/B/C, Products.tsx, segmentos/saude, DemoPage, SeloPage |
| V2-03 | Cap 300% ROI + payback mín 90 dias | ✅ concluído | `apps/web/lib/roiMath.ts` + testes (4/4 passam) |
| V2-08 | Módulos canônicos no site (fonte única) | ✅ concluído | `LandingFooter.tsx` com 8 módulos |
| V2-09 | Registry de benchmarks exige evidenceUrl | ✅ concluído | `apps/web/content/competitor-benchmarks.ts` |
| V2-10 | Página pública de metodologia benchmarks | ✅ concluído | `apps/web/app/legal/benchmarks-concorrentes/page.tsx` |
| V2-11 | Trust-bar de parceiros tecnológicos (sem logos fake de cliente) | ✅ concluído | `SocialProof.tsx` reescrito |
| V2-16 | Disclaimer metodológico no ROI | ✅ concluído | `ROICalculator.tsx` bloco amber |
| V2-23 | `BLOCKERS.md` com 12 bloqueadores humanos | ✅ concluído | `BLOCKERS.md` |
| V2-25 | DPO externo · purgar nome Rodrigo | ✅ concluído | `/legal/dpa`, `/lgpd`, `LandingFooter.tsx` |
| V2-28 | 5 links legais públicos | ✅ concluído | `/legal/{termos,privacidade,cookies,dpa,fair-use}` |
| V2-30 | Remover ícones sociais (perfis não abertos) | ✅ concluído | `LandingFooter.tsx` |
| V2-34 | Docs/API apontam para subdomínios oficiais | ✅ concluído | `LandingFooter.tsx` |
| V2-44 | P&L stack real aprovado | ⏸️ bloqueado B-11 | registrado em BLOCKERS.md |
| V2-48 | Página `/migracao-zenvia` | ✅ concluído | `apps/web/app/migracao-zenvia/page.tsx` |

**Resumo:** 13 fechados em código · 1 mitigado com fallback (V2-01) · 1 bloqueado em B-11 (V2-44, precisa aprovação CFO do modelo com stack real).

## Riscos residuais após Onda 1

1. **V2-01 só sai de `PENDING` para `AUTHORIZED`** com documento assinado do cliente. UI já opera em modo seguro.
2. **B-05 — cotações concorrentes reais (PDFs)** continuam pendentes. Benchmarks exibidos no site têm `evidenceUrl: null` e a página `/legal/benchmarks-concorrentes` declara "em verificação".
3. **B-03 — DPO externo** precisa ser contratado antes do D-Day para evitar alegação de não-conformidade LGPD Art. 41. Todas as referências ao CEO como DPO foram removidas, mas o nome do DPO externo ainda é placeholder.

## Próxima ação humana (pela manhã do CEO/owner)

1. Rodar o checklist de commits per-gap em `MORNING_CHECKLIST.md` (split working-tree em branches canônicos).
2. Aprovar contratação de DPO externo (B-03) e iniciar contratação (opções pré-cotadas).
3. Autorizar publicação do case Vida Plena com cliente (B-01), ou manter em `PENDING`.

---

*Gerado automaticamente pelo agente executivo-sênior em 2026-04-19.*
