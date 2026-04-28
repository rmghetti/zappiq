# Sprint 0 — Checklist Apêndice D do Plano V2.0

**Documento operacional para o war room.** Cada blocker tem critério de aceitação binário. PR fechando o blocker referenciado em coluna direita.

Última atualização: 2026-04-27

---

## Blocker 1 — Multi-provider em produção (LLMRouter promovido)

| # | Critério | Status | Evidência / PR |
|---|---|---|---|
| 1.1 | LLMRouter promovido (orchestrator usa) — `grep` não retorna `chatCompletion` chamando Anthropic SDK direto | ✅ | `apps/api/src/services/llm/langchainClient.ts` agora wrappa `llmRouter.complete()` |
| 1.2 | Cascade Sonnet → Haiku → GPT-4o-mini funcionando (modelo primário env-driven) | ✅ | `LLMRouter.ts:243-263` — chain default |
| 1.3 | Circuit breaker validado (mock Anthropic 5xx → cai pra Haiku → cai pra GPT-4o-mini) | ✅ | `LLMRouter.test.ts` — caso "cai pra GPT-4o-mini se Sonnet e Haiku retornam 429" |
| 1.4 | Audit por turn registra `provider+model+tokens+cost+latency+fallback_triggered+attempt_count` | ✅ | `llmCallAudit.ts` + table `llm_call_logs` (migration `20260427_llm_call_logs`) |
| 1.5 | 100 conversas E2E em staging com fallback artificial — todas concluem | ⏳ | Onda 3 — QA full pass |

**PR**: `release/v2-stab/blocker-1` (este)

---

## Blocker 2 — Webhook em fila

| # | Critério | Status | Evidência / PR |
|---|---|---|---|
| 2.1 | `webhook.ts` apenas valida HMAC e enfileira (não chama `processIncomingMessage`) | ⬜ | Onda 2 |
| 2.2 | `aiProcessWorker` consome `ai-process` queue | ⬜ | Onda 2 |
| 2.3 | Retry 3x com exponential backoff configurado | ⬜ | Onda 2 |
| 2.4 | Deadletter queue funciona após 3 falhas | ⬜ | Onda 2 |
| 2.5 | Load test k6: 100 msg/s × 60s — sem queda; queue depth p95 < 20 | ⬜ | Onda 3 |

**PR**: `release/v2-stab/blocker-2` (planejado Onda 2)

---

## Blocker 3 — PII redactor BR

| # | Critério | Status | Evidência / PR |
|---|---|---|---|
| 3.1 | `piiRedactor.ts` implementado com 6 patterns BR (CPF, CNPJ, cartão Luhn, email, telefone, CEP) | ⬜ | Onda 2 |
| 3.2 | Plugado em Winston transport | ⬜ | Onda 2 |
| 3.3 | Plugado em OTel span attributes | ⬜ | Onda 2 |
| 3.4 | Plugado em Sentry beforeSend | ⬜ | Onda 2 |
| 3.5 | Plugado em audit_log content | ⬜ | Onda 2 |
| 3.6 | 50 testes unit (CPF válido/inválido, CNPJ, Luhn, etc) | ⬜ | Onda 2 |
| 3.7 | Teste E2E: 20 mensagens com PII em conversa → grep nos logs/Sentry/OTel — zero CPF/CNPJ visível | ⬜ | Onda 3 |

**PR**: `release/v2-stab/blocker-3` (planejado Onda 2)

---

## Blocker 4 — RLS em transação

| # | Critério | Status | Evidência / PR |
|---|---|---|---|
| 4.1 | Auditoria de handlers: `docs/audit/rls_handlers.md` gerado | ⬜ | Onda 2 |
| 4.2 | Handlers críticos encapsulados em `prisma.$transaction` | ⬜ | Onda 2 |
| 4.3 | Teste integração tenant-isolation passa pra 5 entidades core (Conversation, Message, Contact, KBDocument, AuditLog) | ⬜ | Onda 2 |
| 4.4 | CI bloqueia merge se teste falhar | ⬜ | Onda 2 (workflow update) |

**PR**: `release/v2-stab/blocker-4` (planejado Onda 2)

---

## Blocker 5 — Embeddings 1024d

| # | Critério | Status | Evidência / PR |
|---|---|---|---|
| 5.1 | Migration `KBChunk` vector(1024) aplicada em staging | ⬜ | Onda 1 (próximo PR) |
| 5.2 | CHECK constraint para dimensão correta | ⬜ | Onda 1 |
| 5.3 | Documentação ADR em `docs/architecture/embeddings.md` | ⬜ | Onda 1 |
| 5.4 | Migration aplicada em prod (janela noturna) | ⬜ | Onda 1 |

**PR**: `release/v2-stab/blocker-5` (Onda 1)

---

## Blocker 6 — Descope comercial

| # | Critério | Status | Evidência / PR |
|---|---|---|---|
| 6.1 | Voz Padrão e Voz Premium removidos do `planConfig` público | ⬜ | Onda 1 |
| 6.2 | Página `/roadmap` publicada explicando timeline | ⬜ | Onda 1 |
| 6.3 | E-mail enviado a quem comprou no trial (extensão ou refund) | ⬜ | Onda 1 (manual via CSM após PR mergeado) |

**PR**: `release/v2-stab/blocker-6` (Onda 1)

---

## Bonus — Modelo Agent + persona dual

(Não está no Apêndice D mas é prerequisito da Sprint 0 — Plano §11.3)

| # | Critério | Status | Evidência / PR |
|---|---|---|---|
| A.1 | Migration model `Agent` aplicada (campos: id, organizationId, name, role, status, systemPrompt, toneConfig, scopeConfig, abilities, knowledgeBaseId, voiceConfig?, timestamps) | ⬜ | Onda 1 |
| A.2 | RLS policy ativa (`organizationId = current_setting(...)`) | ⬜ | Onda 1 |
| A.3 | Seed: 2 agents por Organization existente (comercial + suporte) com prompts dos Apêndices A.1 e A.2 do Plano | ⬜ | Onda 1 |
| A.4 | `agentOrchestrator.buildSystemPrompt(orgContext, contactStatus)` — persona dual via contactStatus | ⬜ | Onda 1 |

**PR**: `release/v2-stab/agent-schema` (Onda 1)

---

## Critério de Go-Live (sábado 10/05 às 18h)

Tudo abaixo verde antes do flip `LAUNCH_MODE=live`:

- [ ] Apêndice D acima: 100% dos itens ✅
- [ ] QA full pass: 5 conversas E2E em 5 segmentos sem erro
- [ ] Load test k6: 100 msg/s × 60s sem queda; queue depth p95 < 20
- [ ] Soak overnight (sábado → domingo): zero exceptions críticas Grafana/Sentry; latency p95 estável
- [ ] Descope de Voz: 100% removido do produto público
- [ ] War room montado e plantão confirmado

Falha em qualquer critério até sábado 18h → escalation pra decisão entre (a) adiar pra 18/05, ou (b) launch reduzido com feature flag desativando o item falho.
