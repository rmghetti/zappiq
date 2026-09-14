-- ═════════════════════════════════════════════════════════════════
-- 20260914000040: o documento passa a dizer em que estado está
-- ─────────────────────────────────────────────────────────────────
-- Hoje o kb_document só é criado DEPOIS da ingestão dar certo. Quando ela
-- falha, não sobra nada na tela: o cliente vê um alerta e some, sem linha,
-- sem motivo e sem botão para tentar de novo (achados A004 e A142). E quando
-- a ingestão dá certo mas o create no Postgres falha, ficam trechos no vetor
-- sem documento e sem como apagar (achado A017b).
--
-- Com estas duas colunas o documento nasce ANTES da ingestão, em
-- 'processando', e termina em 'pronto' ou 'falhou' com o motivo em português.
--
-- Valores de `status`: 'processando', 'pronto', 'falhou'.
-- `motivo` só é preenchido em 'falhou', com a mensagem que o cliente lê.
--
-- O default é 'pronto' de propósito: as linhas que já existem foram ingeridas
-- com sucesso (ou, no pior caso, aparecem como "não indexado" pela contagem de
-- trechos, que continua valendo). Marcar tudo como 'processando' pintaria a
-- base inteira de amarelo sem nenhuma ingestão em curso.
--
-- Idempotente: ADD COLUMN IF NOT EXISTS. Segura para rodar duas vezes.
--
-- RLS: kb_documents já está com RLS ligada e com a policy org_isolation desde
-- 20260417_rls_multi_tenant. Coluna nova não afeta policy nem grant, mas o
-- REVOKE abaixo fica como cinto e suspensório, no padrão de
-- 20260914000020_revoke_anon_public.
--
-- Prova:
--   SELECT column_name, column_default FROM information_schema.columns
--    WHERE table_name = 'kb_documents' AND column_name IN ('status','motivo');
--   SELECT relrowsecurity FROM pg_class WHERE relname = 'kb_documents';  -- t
-- Reverter: ALTER TABLE "kb_documents" DROP COLUMN "status", DROP COLUMN "motivo";
-- ═════════════════════════════════════════════════════════════════

ALTER TABLE "kb_documents" ADD COLUMN IF NOT EXISTS "status" TEXT NOT NULL DEFAULT 'pronto';
ALTER TABLE "kb_documents" ADD COLUMN IF NOT EXISTS "motivo" TEXT;

-- A lista da tela filtra por estado; sem índice isso é varredura na base
-- inteira da organização a cada abertura do Treinar IA.
CREATE INDEX IF NOT EXISTS "kb_documents_status_idx" ON "kb_documents" ("status");

ALTER TABLE "kb_documents" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON "kb_documents" FROM anon, authenticated;
