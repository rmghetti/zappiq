# Maestro v3 + Qualidade da IA — Estado e Roadmap

> Atualizado em 14/06/2026 · branch `maestro-v3-spec1a-motor` (82 commits, só Maestro/Qualidade) · API **420/420 testes verdes** · web `tsc` + `next build` verdes.

## ✅ Entregue (pronto para merge/deploy via `comandos/`)

### Pacote 1 — Fundação (100%)
| Item | O quê | Status |
|---|---|---|
| 1A Motor | `ask` (captura→vars+CRM+validação), interpolação `{{var}}`, condições 4 critérios (atributo/var/horário/keyword), botões/lista/mídia, horário comercial | ✅ TDD |
| 1A Editor | Nó ask, condition builder em chips, mídia/botões, editor de horário, validação de publicação | ✅ |
| 1B Geração IA | A IA monta o fluxo inteiro por composição de blocos validados (`flowBlocks`/`flowAssembler`/`flowGraphValidation`/`flowRecipes`/`generateRichDraft`) | ✅ TDD |
| 1B Analytics | Funil/drop-off por nó (`FlowNodeStat`, upsert atômico, RLS) + badges "Métricas" no canvas | ✅ TDD |
| 1C Subfluxos | `goto_flow` "chamar e voltar" (`callStack` no runtime, cross-turn) | ✅ TDD (limitação: timer durável dentro de subfluxo — documentada) |

### Pacote 2 — Cérebro (100% — 5 de 5)
| Item | O quê | Status |
|---|---|---|
| 2.6 AI step agêntico | Nó-IA com **tools/function-calling** (webhook SSRF-guarded como tool universal): loop agêntico LLM↔ferramenta. Gated (só com tools) + fail-soft (cai no caminho normal). | ✅ TDD |
| 2.7 Auto-otimização | "Fluxo que se melhora sozinho": lê o funil, acha o nó de maior abandono, propõe reescrita com diff (botão "Otimizar") | ✅ TDD |
| 2.8 Simulação | Testa o fluxo com personas sintéticas (geradas do brief) antes de publicar; juiz da Qualidade da IA pontua; report (botão "Simular") | ✅ TDD |
| 2.9 Maestro reativo | Mudou identidade/treino → fluxos afetados ficam "desatualizados" → badge "Atualizar com o Maestro" (re-proposta com diff). Fechado o gap do `PUT /settings` | ✅ TDD |

### Qualidade da IA
| Item | O quê | Status |
|---|---|---|
| Loop fechado | Ao aplicar um fix no prompt, re-roda o cenário e mostra o veredito (`✓ verificado` / `⚠ ainda falha`) no dashboard | ✅ TDD |
| Suíte verde | Corrigido o teste obsoleto `izaTurnRouter` → **API 100% verde (405/405)** | ✅ |
| (Pré-existente, maduro) | 25 cenários golden, runner com judge, cron diário/semanal, dashboard, Slack | ✅ |

## 🖱️ O que depende de você — em `comandos/` (clique 2x)
1 validar · 2 merge na main · 3 migração DB · 4 deploy API (Fly) · 5 deploy Web (Vercel). Smokes de WhatsApp em `docs/maestro/smoke-*.md` (não automatizáveis).

## ⏳ Roadmap restante (trabalho estratégico — precisa de build grande e/ou decisão sua)

> **Pacotes 1 e 2 completos.** O que resta é o Pacote 3 (Receita) + melhorias incrementais — todos com decisão de produto sua.

### Pacote 3 — Receita
- **3.10 A/B com traffic split** — ✅ **ENTREGUE** (TDD). `flowExperiment.ts` (`assignVariant` hash determinístico FNV-1a por conversa + `computeAbResults` puros), runtime gated/fail-soft (só no 1º contato; sem experimento = caminho idêntico), rotas `PUT/GET /flows/:id/experiment` (sem migração — vive em `org.settings.experiments`), painel "A/B" no editor (config + resultados por variante + vencedor). Conversão reusa o funil 1B-analytics. Smoke: `docs/maestro/smoke-pacote3-ab-testing.md`.
- **3.11 Handoff estruturado** com fila/ticket e retomada do fluxo quando o atendente encerra. *Precisa do fluxo de atendimento humano.*
- **3.12 E-commerce / Pix nativo** — ⏸ **ADIADO por decisão do Rodrigo (14/06/2026): aguardando definição do parceiro/provedor Pix.** Quando definir, retomar (catálogo WhatsApp, carrinho, Pix, trigger `CART_ABANDONED`).
- **3.13 Broadcast integrado** — campanha HSM que injeta o respondente direto num fluxo; fallback de timer fora da janela 24h → template HSM.

### Qualidade da IA — melhorias incrementais (do mapeamento)
- **Eval gate na publicação** do agente (bloquear/avisar se score < limiar). *Decisão: bloquear ou só avisar, e o limiar.*
- Re-eval automático pós-treinamento; detecção de regressão cross-agente; monitor de custo de eval.

## Posicionamento (invariável)
A IA **constrói** o fluxo a partir do onboarding (survey, docs, Q&A, identidade); o canvas **mostra**; o cliente **aprova**. O editor é coadjuvante. Os diferenciais entregues (geração rica, auto-otimização, simulação, reativo) compõem o "fluxo inteligente que se monta, se testa e se melhora sozinho" — campo aberto frente aos concorrentes verificados.
