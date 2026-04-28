-- ═════════════════════════════════════════════════════════════════════
-- V2-018 · llm_call_logs (Blocker 1 Sprint 0)
-- ─────────────────────────────────────────────────────────────────────
-- Tabela dedicada para audit por turn de chamadas LLM.
--
-- Por que NAO usar audit_logs?
--   - audit_logs é hash-chained (Art. 46 LGPD) e exige userId humano
--     + organizationId + dataSubjectId. Calls do LLM saem do worker
--     BullMQ sem context HTTP autenticado e ocorrem 5-10x por conversa,
--     o que poluiria a cadeia hash de auditoria humana.
--   - Cost-per-tenant dashboard (Semana 2 pos-launch) precisa de query
--     agregada SUM(cost_usd_estimate) GROUP BY organization_id, day.
--     Indices dedicados aqui sao mais baratos.
--
-- O que entra aqui:
--   - Toda chamada feita via LLMRouter.complete() registra 1 linha.
--   - Em fallback (Anthropic falha → cai pra OpenAI), so a chamada
--     bem-sucedida é gravada com fallback_triggered=true e attempt_count>1.
--   - Calls que falham TODOS os providers (cascade exhausted) gravam
--     1 linha com error preenchido e provider/model = 'none'.
--
-- Politica de retencao: 90 dias rolling (job de retenção pos-launch
-- deletará registros > 90d). Rollups mensais por org_id ficam em
-- audit_logs com action='llm.usage.monthly_rollup' (opcional).
-- ═════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.llm_call_logs (
  id                   text NOT NULL DEFAULT (gen_random_uuid())::text,
  organization_id      text,
  conversation_id      text,
  provider             text NOT NULL,
  model                text NOT NULL,
  operation            text NOT NULL DEFAULT 'chat',
  input_tokens         integer,
  output_tokens        integer,
  cost_usd_estimate    numeric(10, 6),
  latency_ms           integer NOT NULL,
  fallback_triggered   boolean NOT NULL DEFAULT false,
  attempt_count        integer NOT NULL DEFAULT 1,
  error                text,
  created_at           timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT llm_call_logs_pkey PRIMARY KEY (id)
);

-- Indice principal: cost-per-tenant agregado por dia
CREATE INDEX IF NOT EXISTS llm_call_logs_org_created_idx
  ON public.llm_call_logs (organization_id, created_at DESC);

-- Indice secundario: fallback rate por provider
CREATE INDEX IF NOT EXISTS llm_call_logs_provider_created_idx
  ON public.llm_call_logs (provider, created_at DESC);

-- Indice de erros: alerta operacional
CREATE INDEX IF NOT EXISTS llm_call_logs_error_idx
  ON public.llm_call_logs (created_at DESC)
  WHERE error IS NOT NULL;

-- RLS: ativada por defesa em profundidade. Backend usa Prisma direto
-- (bypass via service role). Quando dashboard cliente precisar ler
-- proprios dados (Semana 2), criar policy: organization_id = current_setting(...).
ALTER TABLE public.llm_call_logs ENABLE ROW LEVEL SECURITY;

-- Comentarios para Prisma introspect / docs
COMMENT ON TABLE  public.llm_call_logs IS 'V2-018 audit por turn de chamadas LLM via LLMRouter. Suporta cost-per-tenant dashboard e fallback rate metrics.';
COMMENT ON COLUMN public.llm_call_logs.provider IS 'anthropic-sonnet | anthropic-haiku | openai-mini | none (cascade exhausted)';
COMMENT ON COLUMN public.llm_call_logs.operation IS 'chat | classify | sentiment';
COMMENT ON COLUMN public.llm_call_logs.cost_usd_estimate IS 'Estimativa baseada em utils/llmCost.ts (preço público dos providers em USD/1M tokens)';
