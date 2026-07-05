-- W3.4 (responder como humano pausa a Iza) — flag durável por conversa.
-- Aditivo e idempotente. Quando um humano responde ou é atribuído à conversa,
-- aiPaused=true e a Iza para de gerar autoreply NESTA conversa até ser reaberta
-- (unassign). Fonte de verdade durável; o cache ai_paused é só fast-path.
ALTER TABLE "conversations" ADD COLUMN IF NOT EXISTS "aiPaused" BOOLEAN NOT NULL DEFAULT false;
