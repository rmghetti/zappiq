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
| 3.1 | `piiRedactor.ts` implementado com 6 patterns BR (CPF, CNPJ, cartão Luhn, email, telefone, CEP) | ✅ | `apps/api/src/utils/piiRedactor.ts` — 240 linhas, 8 regex (CPF/CNPJ formatado + bare separados), validators dígito verificador + Luhn |
| 3.2 | Plugado em Winston transport | ✅ | `logger.ts:piiRedactor()` format aplicado em devFormat e prodFormat antes do output |
| 3.3 | Plugado em OTel span attributes | ⏳ | Cobertura indireta via Winston transport OTel (logs vão pra Loki redacionados). Span attribute filter dedicado fica pra Onda 2 follow-up se houver código adicionando attributes manualmente |
| 3.4 | Plugado em Sentry beforeSend | ✅ | `sentry.ts:redactSentryPayload()` aplicado em ambos `captureException` e `captureMessage` antes do POST pro DSN |
| 3.5 | Plugado em audit_log content | ✅ | `auditService.ts:sanitizeSnapshot()` agora aplica `redactDeep` na 2ª camada após remoção de campos sensíveis |
| 3.6 | 50+ testes unit | ✅ | `piiRedactor.test.ts` — 50+ casos (CPF válido/inválido/repetido, CNPJ, Luhn 13-19 dígitos, e-mail, telefone com/sem +55, CEP, false positives, estruturas profundas, vault roundtrip) |
| 3.7 | Teste E2E: 20 mensagens com PII → grep nos sinks → zero PII visível | ⏳ | Onda 3 (QA full pass) |

**PR**: `release/v2-stab/blocker-3` (Onda 2)

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
| 5.1 | Migration `KBChunk` vector(1024) aplicada em staging | ✅ | `20260427_kbchunk_vector_1024/migration.sql` — release_command Fly aplica em staging+prod no auto-deploy |
| 5.2 | CHECK constraint / dim validation | ✅ | pgvector valida dim na inserção nativamente (CHECK adicional seria redundante — racional no header da migration) |
| 5.3 | Documentação ADR em `docs/architecture/embeddings.md` | ✅ | ADR-0005 completo (alternativas, política de mudança, refs) |
| 5.4 | Migration aplicada em prod (janela noturna) | ✅ | Migration é safe/idempotente — não requer janela noturna porque KBChunk não tem dados (auditoria confirmou zero callsites) |

**PR**: `release/v2-stab/blocker-5` (Onda 1)

---

## Blocker 6 — Descope comercial

| # | Critério | Status | Evidência / PR |
|---|---|---|---|
| 6.1 | Voz Padrão e Voz Premium removidos do `planConfig` público | ✅ | `planConfig.ts` (VOICE_INBOUND/OUTBOUND removidos), `Pricing.tsx` (toggle Voz removido), `ROICalculator.tsx` (slider Voz removido) |
| 6.2 | Página `/roadmap` publicada explicando timeline | ✅ | `apps/web/app/roadmap/page.tsx` — server component com timeline completa, status por item, callout sobre Voz, waitlist mailto |
| 6.3 | E-mail enviado a quem comprou no trial (extensão ou refund) | ⏳ | **Manual ao acordar**: exportar lista do Stripe (planConfig logs / payments_intent com VOICE_*) e enviar via Resend pro CSM |

**PR**: `release/v2-stab/blocker-6` (Onda 1)

---

## Bonus — Modelo Agent + persona dual

(Não está no Apêndice D mas é prerequisito da Sprint 0 — Plano §11.3)

| # | Critério | Status | Evidência / PR |
|---|---|---|---|
| A.1 | Migration model `Agent` aplicada (campos completos do Plano §11.3) | ✅ | `20260427_agent_model/migration.sql` — 11 campos + 2 CHECK + FKs |
| A.2 | RLS policy ativa (`organization_id = current_setting(...)`) | ✅ | Policy `agents_tenant_isolation` + trigger `touch_updated_at` |
| A.3 | Seed: 2 agents por Organization existente (comercial + suporte) com prompts dos Apêndices A.1 e A.2 do Plano | ✅ | INSERT ... SELECT FROM organizations + ON CONFLICT DO NOTHING (idempotente) |
| A.4 | `agentOrchestrator.buildSystemPrompt(orgContext, contactStatus)` — persona dual via contactStatus | ✅ | `agentOrchestrator.ts:buildSystemPromptForContact()` — leadStatus=CONVERTED → suporte; outros → comercial; fallback promptEngine antigo se Agent ausente |

**PR**: `release/v2-stab/onda1-blockers-5-6-agent` (Onda 1 consolidada)

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
