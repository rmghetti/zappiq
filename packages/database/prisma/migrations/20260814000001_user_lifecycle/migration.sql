-- Equipe profissional (14/08): ciclo de vida de membros.
-- isActive: desativar acesso preservando histórico (hard delete quebra em FK).
-- lastLoginAt: "último acesso" na tela de Equipe.
ALTER TABLE "users" ADD COLUMN "isActive" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "users" ADD COLUMN "lastLoginAt" TIMESTAMP(3);
