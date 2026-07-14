-- Isolamento de tenant (14/07/2026): whatsappPhoneNumberId e instagram_account_id
-- passam a ser UNIQUE. O webhook de entrada roteia a mensagem do lead para a org
-- dona do identificador; sem unicidade, duas orgs podiam registrar o mesmo id e
-- a mensagem do lead caía na org errada (findFirst não determinístico).
--
-- Seguro: verificado em produção (14/07/2026) que NÃO há duplicatas hoje.
-- Postgres permite múltiplos NULL num índice único, então orgs sem canal
-- conectado (a maioria) não são afetadas.

CREATE UNIQUE INDEX "organizations_whatsappPhoneNumberId_key"
  ON "organizations"("whatsappPhoneNumberId");

CREATE UNIQUE INDEX "organizations_instagram_account_id_key"
  ON "organizations"("instagram_account_id");
