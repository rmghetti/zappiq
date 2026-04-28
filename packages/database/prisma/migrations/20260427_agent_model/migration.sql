-- ═════════════════════════════════════════════════════════════════════
-- V2-021 · model Agent (Sprint 0 — Plano Iza V2.0 §11.3)
-- ─────────────────────────────────────────────────────────────────────
-- CONTEXTO:
--   O overview V5.3 mencionava model Agent como existente. A auditoria
--   confirmou que NÃO existe. Esta migration cria a estrutura mínima
--   necessária pra (a) suportar persona dual no Sprint 0 (Iza-Comercial
--   vs Iza-Suporte por contactStatus) e (b) servir de fundação pro
--   builder self-service Q3/2026.
--
-- O QUE A MIGRATION FAZ:
--   1. Cria tabela agents com campos do Plano §11.3.
--   2. RLS habilitada com policy organization_id = current_setting(...).
--   3. Index composto (organization_id, role, status) pra lookup rápido.
--   4. Seed: 2 agents (comercial + suporte) pra cada Organization
--      EXISTENTE em produção. Prompts dos Apêndices A.1 e A.2 do Plano.
--   5. Idempotente: ON CONFLICT DO NOTHING no seed permite re-rodar.
--
-- Q3 (builder self-service) vai estender essa tabela com:
--   - voiceConfig (quando voz voltar)
--   - múltiplos KBs por agent
--   - versionamento de systemPrompt (history table)
-- ═════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.agents (
  id                text      NOT NULL DEFAULT (gen_random_uuid())::text,
  organization_id   text      NOT NULL,
  name              text      NOT NULL,
  role              text      NOT NULL,                          -- 'comercial' | 'suporte' | 'onboarding' | 'financeiro'
  status            text      NOT NULL DEFAULT 'live',           -- 'draft' | 'reviewed' | 'live'
  system_prompt     text      NOT NULL,
  tone_config       jsonb     NOT NULL DEFAULT '{}'::jsonb,
  scope_config      jsonb     NOT NULL DEFAULT '{}'::jsonb,
  abilities         jsonb     NOT NULL DEFAULT '{}'::jsonb,
  knowledge_base_id text,
  voice_config      jsonb,                                       -- null até voz voltar (Q3)
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT agents_pkey PRIMARY KEY (id),
  CONSTRAINT agents_role_check
    CHECK (role IN ('comercial', 'suporte', 'onboarding', 'financeiro')),
  CONSTRAINT agents_status_check
    CHECK (status IN ('draft', 'reviewed', 'live')),
  CONSTRAINT agents_organization_fk
    FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE CASCADE,
  CONSTRAINT agents_kb_fk
    FOREIGN KEY (knowledge_base_id) REFERENCES public.knowledge_bases(id) ON DELETE SET NULL
);

-- Lookup rápido pra persona dual: WHERE organization_id = ? AND role = ? AND status = 'live'
CREATE INDEX IF NOT EXISTS agents_org_role_status_idx
  ON public.agents (organization_id, role, status);

-- ─── RLS ───
ALTER TABLE public.agents ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS agents_tenant_isolation ON public.agents;
CREATE POLICY agents_tenant_isolation ON public.agents
  USING (organization_id = current_setting('app.current_organization_id', true))
  WITH CHECK (organization_id = current_setting('app.current_organization_id', true));

-- ─── Trigger updated_at ───
CREATE OR REPLACE FUNCTION public.touch_agents_updated_at() RETURNS trigger AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS agents_touch_updated_at ON public.agents;
CREATE TRIGGER agents_touch_updated_at
  BEFORE UPDATE ON public.agents
  FOR EACH ROW EXECUTE FUNCTION public.touch_agents_updated_at();

-- ═════════════════════════════════════════════════════════════════════
-- SEED — 2 agents (comercial + suporte) pra cada Organization existente
-- Prompts derivados dos Apêndices A.1 e A.2 do Plano V2.0.
-- ─────────────────────────────────────────────────────────────────────

-- Comercial (Iza-Comercial-ZappIQ-style — adapta-se ao tenant)
INSERT INTO public.agents (organization_id, name, role, status, system_prompt, tone_config, scope_config, abilities)
SELECT
  o.id,
  'Iza',
  'comercial',
  'live',
  $prompt$Você é a Iza, agente conversacional comercial. Sua missão é qualificar leads, responder dúvidas sobre o negócio e converter prospects em demos/trials.

# Identidade
- Tom: consultivo, curioso, próximo sem ser invasivo.
- Linguagem: português brasileiro, primeira pessoa, "você", emojis com parcimônia (no máx. 1 a cada 3 mensagens).
- Concisão: respostas de 2-4 linhas em chat.

# Regras de ouro
1. Nunca invente fato sobre planos, preços ou funcionalidades. Se não estiver no contexto RAG, diga "vou confirmar com o time".
2. Nunca dê desconto >10% sem aprovação explícita.
3. Nunca peça CPF, dados de cartão ou senha.
4. Em comparações com concorrentes, seja factual e respeitosa.
5. Se cliente pedir "quero falar com humano", escale via tag <action>handoff</action>.

# Estrutura preferida da conversa
- Saudação curta com nome se conhecido.
- 1 pergunta de qualificação (segmento ou volume).
- Prova social do segmento se identificado.
- Sondagem de dor (SPIN: Problem → Implication).
- Proposta de valor encaixada.
- CTA: trial 14d ou demo.$prompt$,
  '{"formality": "media", "emoji": "parcimonioso", "girias": false}'::jsonb,
  '{"forbidden_topics": ["politica", "religiao", "investimentos"], "max_discount_percent": 10}'::jsonb,
  '{"qualify_lead": true, "schedule_demo": true, "save_lead": true, "escalate_human": true}'::jsonb
FROM public.organizations o
ON CONFLICT DO NOTHING;

-- Suporte (Iza-Suporte-ZappIQ-style)
INSERT INTO public.agents (organization_id, name, role, status, system_prompt, tone_config, scope_config, abilities)
SELECT
  o.id,
  'Iza',
  'suporte',
  'live',
  $prompt$Você é a Iza, agente de suporte. Sua missão é resolver dúvidas técnicas, comerciais e operacionais de clientes ATIVOS com agilidade e precisão.

# Identidade
- Tom: profissional, empático, resolutivo.
- Linguagem: português brasileiro, "você", direto ao ponto.
- Concisão: respostas curtas + passos numerados quando aplicável.

# Regras de ouro
1. Para problemas técnicos, peça os dados específicos antes de sugerir soluções.
2. Nunca prometa SLA além do contratado no plano do cliente.
3. Para cobrança/financeiro, sempre confirma identidade antes (pergunta nome do contato cadastrado).
4. Sentindo frustração persistente, escale para humano via <action>handoff</action>.
5. Para questões sobre Voz Padrão/Premium, comunicar status "em desenvolvimento, disponível em julho/2026" e linkar /roadmap.$prompt$,
  '{"formality": "alta", "emoji": "raro", "girias": false}'::jsonb,
  '{"verify_identity_for_billing": true, "escalation_threshold_frustration": 2}'::jsonb,
  '{"get_invoice": true, "create_ticket": true, "generate_upgrade_link": true, "escalate_human": true}'::jsonb
FROM public.organizations o
ON CONFLICT DO NOTHING;

-- Sanity log: quantos agentes foram criados
DO $$
DECLARE
  v_total integer;
  v_orgs  integer;
BEGIN
  SELECT COUNT(*) INTO v_total FROM public.agents;
  SELECT COUNT(*) INTO v_orgs FROM public.organizations;
  RAISE NOTICE 'V2-021 seed: % agents criados pra % organizations (esperado: 2 × % = %)',
    v_total, v_orgs, v_orgs, v_orgs * 2;
END
$$;

COMMENT ON TABLE  public.agents IS 'V2-021 (Sprint 0). Persona dual e fundação pro builder self-service Q3.';
COMMENT ON COLUMN public.agents.role IS 'Persona: comercial (lead/trial) | suporte (customer) | onboarding (Q3) | financeiro (Q3)';
COMMENT ON COLUMN public.agents.status IS 'draft → reviewed (CSM aprovou) → live (em produção)';
