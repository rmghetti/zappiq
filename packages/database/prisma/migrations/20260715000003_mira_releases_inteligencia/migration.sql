-- Mira Prospects — Releases viram inteligência acionável
--
-- Até aqui um release era uma linha solta: título, link e um texto de
-- relevância. Ele não conseguia dizer "esta matéria evidenciou ESTA demanda"
-- nem "este fato abriu ESTA oportunidade no catálogo", porque o único elo era
-- `produtoRelacionado` (string) casando por convenção com
-- `mira_oportunidades.produto`. Esta migração cria os vínculos de verdade.
--
-- Tudo aditivo e com default ou NULL: nenhuma linha existente muda de
-- comportamento nem de valor.

-- 1) Release aponta para a demanda que ele evidenciou.
--    ON DELETE SET NULL: se a demanda for apagada, o release continua válido
--    (o fato publicado não deixou de existir), só perde o vínculo.
ALTER TABLE "mira_releases" ADD COLUMN IF NOT EXISTS "demandaId" TEXT;
CREATE INDEX IF NOT EXISTS "mira_releases_demandaId_idx" ON "mira_releases"("demandaId");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'mira_releases_demandaId_fkey'
  ) THEN
    ALTER TABLE "mira_releases"
      ADD CONSTRAINT "mira_releases_demandaId_fkey"
      FOREIGN KEY ("demandaId") REFERENCES "mira_demandas"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END
$$;

-- 2) Quando o cliente foi sinalizado sobre este release (Task criada).
--    NULL = ainda não avisamos. Sem isto, o cron não tem como saber o que já
--    virou alerta e reavisaria a mesma matéria toda segunda-feira.
ALTER TABLE "mira_releases" ADD COLUMN IF NOT EXISTS "alertadoEm" TIMESTAMP(3);

-- 3) Origem da oportunidade.
--    A Fase 1 do "Aprofundar com IA" faz deleteMany({alvoId}) e recria as
--    oportunidades presumidas. Sem distinguir a origem, o próximo clique
--    apagaria a oportunidade que uma matéria real gerou. Default 'ANALISE' é a
--    verdade histórica: toda oportunidade existente hoje é presunção da Fase 1.
ALTER TABLE "mira_oportunidades" ADD COLUMN IF NOT EXISTS "origem" TEXT NOT NULL DEFAULT 'ANALISE';
ALTER TABLE "mira_oportunidades" ADD COLUMN IF NOT EXISTS "fonte" TEXT;
