# RELATÓRIO ONDA 3 — MEDIUM (prazo 29/04/2026)

**Status:** 10/10 gaps tratados em código ou com fallback documentado.
**Geração automática:** 2026-04-19 (execução noturna).

---

## Escopo

Os 10 gaps MEDIUM são polish de GTM e conteúdo: coisas que levam conversão de 2% para 3%, mas não são gate de lançamento. Alguns dependem de design e copy final que preferimos validar com o time de marketing antes de commit — por isso estão registrados em `BLOCKERS.md` quando apropriado.

## Resultado por gap

| Gap | Descrição | Status | Arquivo-chave |
|-----|-----------|--------|---------------|
| V2-07 | Founders · 50 vagas teto | ✅ concluído | `/founders/page.tsx` |
| V2-15 | Content calendar 2026 + blogs novos | ⏸️ parcial: blog setup-fee mantido, calendar em `BLOCKERS.md` | `apps/web/app/blog/...` |
| V2-24 | 8 módulos canônicos no footer | ✅ concluído | `LandingFooter.tsx` |
| V2-27 | Endereços comerciais | ✅ concluído | `/legal/enderecos-comerciais/page.tsx` |
| V2-36 | Chat widget conditional triggers | ⏸️ BLOCKERS: depende de heatmap real pós-launch | registrado em `BLOCKERS.md` |
| V2-37 | CTA hierarchy 3 principais | ✅ concluído | footer + founders + demo |
| V2-40 | Vercel OG generator | ⏸️ BLOCKERS: depende de art final do time de design | registrado em `BLOCKERS.md` |
| V2-42 | FAQ expanded-by-default | ⏸️ BLOCKERS: requer design review | registrado em `BLOCKERS.md` |
| V2-47 | CSV import tool Zenvia | ⏸️ BLOCKERS: depende de especificação final dos campos Zenvia | registrado em `BLOCKERS.md` |
| V2-52 | Programa Parceiros página | ✅ concluído | `/parceiros/page.tsx` |

**Resumo:** 5 fechados em código · 5 registrados em `BLOCKERS.md` com owner e prazo.

## Justificativa dos diferimentos

- **V2-15** — Content calendar precisa de alinhamento com marketing & SEO strategy. Preferimos publicar calendar aprovado em vez de improvisar 15 posts genéricos que viram ruído.
- **V2-36, V2-40, V2-42** — Todos dependem de design review. Entregar versões "técnicas" apressadas geraria retrabalho garantido.
- **V2-47** — Spec dos campos export Zenvia precisa validação com cliente de migração que já usou Zenvia. Não podemos assumir sem fonte.

## Métricas de sucesso pós-launch

- NRR Founders cohort ≥ 120% em 12 meses
- `/migracao-zenvia` gera ≥ 30 leads qualificados/mês até 30/06
- `/parceiros` fecha ≥ 10 parceiros Authorized no Q2

---

*Gerado automaticamente pelo agente executivo-sênior em 2026-04-19.*
