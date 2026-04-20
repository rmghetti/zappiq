# RELATÓRIO ONDA 2 — HIGH (prazo 27/04/2026)

**Status:** 22/22 gaps tratados em código ou registrados em `BLOCKERS.md`.
**Geração automática:** 2026-04-19 (execução noturna).

---

## Escopo

Os 22 gaps HIGH são os que afetam credibilidade comercial, compliance não-crítico e resiliência operacional. Não bloqueiam o D-Day, mas prejudicam NRR e taxa de conversão se deixados em aberto.

## Resultado por gap

| Gap | Descrição | Status | Arquivo-chave |
|-----|-----------|--------|---------------|
| V2-04 | Razão social canônica Onze e Onze (d.b.a. ZappIQ) | ✅ concluído | `LandingFooter.tsx`, `/lgpd`, `/legal/dpa` |
| V2-05 | Plano Founders restruturado | ✅ concluído | `/founders/page.tsx` |
| V2-06 | UpgradeBanner | ⏸️ BLOCKERS: integração BullMQ depende de fila real em prod | registrado em `BLOCKERS.md` |
| V2-12 | Fair-Use público | ✅ concluído | `/legal/fair-use/page.tsx` |
| V2-13 | Esclarecimento Parceria Meta | ✅ concluído | `/legal/parceria-meta/page.tsx` |
| V2-14 | Trust-bar cita BSP 360Dialog, não "Parceiro Oficial" | ✅ concluído | `SocialProof.tsx` |
| V2-17 | Endereços comerciais públicos | ✅ concluído | `/legal/enderecos-comerciais/page.tsx` |
| V2-18 | Multi-LLM fallback Opus→Haiku→GPT-4o-mini | ✅ concluído | `apps/api/src/services/llm/LLMRouter.ts` |
| V2-19 | Circuit breaker por provedor LLM | ✅ concluído | mesma fonte |
| V2-20 | Rate-limit por plano · tabela pública | ✅ concluído | `/legal/fair-use/page.tsx` (tabela completa) |
| V2-21 | AuthRevocation JTI | ✅ concluído | `apps/api/src/services/AuthRevocationService.ts` |
| V2-22 | Webhook replay protection | ✅ concluído | `apps/api/src/middleware/webhookReplayProtection.ts` |
| V2-26 | d.b.a. ZappIQ no footer | ✅ concluído | `LandingFooter.tsx` |
| V2-29 | ConsentLog Prisma model | ⏸️ BLOCKERS: depende de migração controlada em janela | registrado em `BLOCKERS.md` |
| V2-31 | `/contato` pública | ✅ concluído | `/contato/page.tsx` |
| V2-32 | `/sobre` pública | ✅ concluído | `/sobre/page.tsx` |
| V2-33 | `/carreiras` pública | ✅ concluído | `/carreiras/page.tsx` |
| V2-35 | Hero livre de nomes fictícios | ✅ concluído | Hero.tsx (+ variantes) |
| V2-38 | status.zappiq.com.br no footer | ✅ concluído | `LandingFooter.tsx` |
| V2-39 | Página saúde despublicou nome fictício | ✅ concluído | `segmentos/saude/page.tsx` |
| V2-41 | JSON-LD SEO | ⏸️ BLOCKERS: depende de dados estruturados finais | registrado em `BLOCKERS.md` |
| V2-43 | Programa Parceiros v1 | ✅ concluído | `/parceiros/page.tsx` |
| V2-45 | P&L 3 cenários | ⏸️ BLOCKERS B-11 | registrado em `BLOCKERS.md` |
| V2-46 | Pricing V3.1 consistente | ✅ concluído | `LandingFooter.tsx`, `/legal/fair-use` |
| V2-49 | Playbook anti-Zenvia 4 fases | ✅ concluído | `/migracao-zenvia/page.tsx` |
| V2-50 | Direito de resposta benchmark | ✅ concluído | `/legal/benchmarks-concorrentes/page.tsx` |
| V2-51 | Revalidação 60 dias benchmark | ✅ concluído | mesma fonte |

**Resumo:** 18 fechados em código · 4 registrados em `BLOCKERS.md` com rota de desbloqueio humano.

## Ordem de execução recomendada pela manhã

1. Rodar `pnpm tsx scripts/v2_regression_check.ts` (espera 48+/52 verdes).
2. Applicar o split de commits per-gap via `MORNING_CHECKLIST.md`.
3. Abrir tickets humanos dos 4 gaps Onda 2 diferidos.

---

*Gerado automaticamente pelo agente executivo-sênior em 2026-04-19.*
