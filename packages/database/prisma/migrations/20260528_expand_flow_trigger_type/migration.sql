-- Expand FlowTriggerType enum com os 6 valores que os templates Maestro V1 usam.
-- Postgres requer ALTER TYPE ADD VALUE individual; IF NOT EXISTS = idempotencia.
-- Note: ALTER TYPE ADD VALUE nao pode rodar dentro de transacao bloco. Cada
-- statement separado.

ALTER TYPE "FlowTriggerType" ADD VALUE IF NOT EXISTS 'CUSTOM';
ALTER TYPE "FlowTriggerType" ADD VALUE IF NOT EXISTS 'CART_ABANDONED';
ALTER TYPE "FlowTriggerType" ADD VALUE IF NOT EXISTS 'TIMEOUT_24H';
ALTER TYPE "FlowTriggerType" ADD VALUE IF NOT EXISTS 'TIMEOUT_48H';
ALTER TYPE "FlowTriggerType" ADD VALUE IF NOT EXISTS 'TIMEOUT_14D';
ALTER TYPE "FlowTriggerType" ADD VALUE IF NOT EXISTS 'TIMEOUT_30D';
