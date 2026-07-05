-- Área "Clientes" — hotfix pós-deploy: signups.organization_id estava com tipo
-- UUID, mas organizations.id é cuid() (texto, ex: "cmo1ywwfe...") — NUNCA um
-- UUID válido. Toda comparação/escrita entre as duas (backfill, wire do
-- onboarding /complete) falhava com "operator does not exist: uuid = text"
-- ou "invalid input syntax for type uuid". Descoberto ao rodar o backfill.
--
-- Seguro: 0 linhas com organization_id NOT NULL em prod, sem constraints/
-- índices na coluna (verificado antes de aplicar). Idempotente — só altera
-- se ainda estiver como uuid.

DO $$
BEGIN
  IF (
    SELECT data_type FROM information_schema.columns
     WHERE table_name = 'signups' AND column_name = 'organization_id'
  ) = 'uuid' THEN
    ALTER TABLE "signups" ALTER COLUMN "organization_id" TYPE TEXT USING organization_id::text;
  END IF;
END $$;
