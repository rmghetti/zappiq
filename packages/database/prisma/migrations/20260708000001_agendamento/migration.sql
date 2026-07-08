-- Agendamento pela IA (2026-07-08) — ADITIVO e IDEMPOTENTE.
-- Agenda interna (hub) + tipos de agendamento + conexões de calendário externo.
-- Segue o padrão de RLS + GRANT condicional ao role app_user (prod Supabase
-- baseline não tem esse role). Enums criados via DO-guard (CREATE TYPE não aceita
-- IF NOT EXISTS).

-- ─── Enums ──────────────────────────────────────────────────────────────────
DO $$ BEGIN
  CREATE TYPE "AppointmentModality" AS ENUM ('in_person', 'online', 'phone', 'video');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  CREATE TYPE "AppointmentStatus" AS ENUM ('pending', 'confirmed', 'cancelled', 'no_show', 'completed');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  CREATE TYPE "AppointmentSource" AS ENUM ('ai', 'manual', 'external_sync');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  CREATE TYPE "CalendarProvider" AS ENUM ('google', 'microsoft');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  CREATE TYPE "CalendarConnectionStatus" AS ENUM ('active', 'expired', 'revoked');
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- ─── appointment_types ──────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS "appointment_types" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "icon" TEXT,
    "duration_min" INTEGER NOT NULL DEFAULT 30,
    "duration_booker_choice" BOOLEAN NOT NULL DEFAULT false,
    "modality" "AppointmentModality" NOT NULL DEFAULT 'online',
    "location_text" TEXT,
    "meeting_link_template" TEXT,
    "availability" JSONB NOT NULL DEFAULT '{}',
    "min_notice_min" INTEGER NOT NULL DEFAULT 120,
    "buffer_before_min" INTEGER NOT NULL DEFAULT 0,
    "buffer_after_min" INTEGER NOT NULL DEFAULT 0,
    "max_per_day" INTEGER,
    "future_horizon_days" INTEGER NOT NULL DEFAULT 60,
    "requires_confirmation" BOOLEAN NOT NULL DEFAULT false,
    "booking_fields" JSONB NOT NULL DEFAULT '[]',
    "reminders" JSONB NOT NULL DEFAULT '[]',
    "cancel_policy_text" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "appointment_types_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "appointment_types_organization_id_active_idx" ON "appointment_types"("organization_id", "active");

-- ─── appointments (agenda interna, hub) ─────────────────────────────────────
CREATE TABLE IF NOT EXISTS "appointments" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "appointment_type_id" TEXT,
    "contact_id" TEXT,
    "conversation_id" TEXT,
    "status" "AppointmentStatus" NOT NULL DEFAULT 'pending',
    "start_at" TIMESTAMP(3) NOT NULL,
    "end_at" TIMESTAMP(3) NOT NULL,
    "timezone" TEXT NOT NULL DEFAULT 'America/Sao_Paulo',
    "modality" "AppointmentModality" NOT NULL DEFAULT 'online',
    "customer_name" TEXT NOT NULL,
    "customer_phone" TEXT,
    "customer_email" TEXT,
    "answers" JSONB NOT NULL DEFAULT '{}',
    "location" TEXT,
    "meeting_url" TEXT,
    "notes" TEXT,
    "source" "AppointmentSource" NOT NULL DEFAULT 'ai',
    "external_event_id" TEXT,
    "calendar_connection_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "appointments_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "appointments_organization_id_start_at_idx" ON "appointments"("organization_id", "start_at");
CREATE INDEX IF NOT EXISTS "appointments_organization_id_status_idx" ON "appointments"("organization_id", "status");
CREATE INDEX IF NOT EXISTS "appointments_calendar_connection_id_external_event_id_idx" ON "appointments"("calendar_connection_id", "external_event_id");

-- ─── calendar_connections ───────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS "calendar_connections" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "provider" "CalendarProvider" NOT NULL,
    "status" "CalendarConnectionStatus" NOT NULL DEFAULT 'active',
    "external_account_email" TEXT,
    "access_token_enc" TEXT,
    "refresh_token_enc" TEXT,
    "token_expires_at" TIMESTAMP(3),
    "scope" TEXT,
    "target_calendar_id" TEXT,
    "channel_id" TEXT,
    "resource_id" TEXT,
    "watch_expires_at" TIMESTAMP(3),
    "subscription_id" TEXT,
    "sub_expires_at" TIMESTAMP(3),
    "sync_token" TEXT,
    "delta_link" TEXT,
    "last_sync_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "calendar_connections_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "calendar_connections_organization_id_provider_idx" ON "calendar_connections"("organization_id", "provider");

-- ─── Foreign keys (idempotentes) ────────────────────────────────────────────
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'appointment_types_organization_id_fkey') THEN
    ALTER TABLE "appointment_types" ADD CONSTRAINT "appointment_types_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'appointments_organization_id_fkey') THEN
    ALTER TABLE "appointments" ADD CONSTRAINT "appointments_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'appointments_appointment_type_id_fkey') THEN
    ALTER TABLE "appointments" ADD CONSTRAINT "appointments_appointment_type_id_fkey" FOREIGN KEY ("appointment_type_id") REFERENCES "appointment_types"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'appointments_contact_id_fkey') THEN
    ALTER TABLE "appointments" ADD CONSTRAINT "appointments_contact_id_fkey" FOREIGN KEY ("contact_id") REFERENCES "contacts"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'calendar_connections_organization_id_fkey') THEN
    ALTER TABLE "calendar_connections" ADD CONSTRAINT "calendar_connections_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

-- ─── RLS + policies de isolamento por tenant ────────────────────────────────
ALTER TABLE "appointment_types" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS appointment_types_tenant_isolation ON "appointment_types";
CREATE POLICY appointment_types_tenant_isolation ON "appointment_types"
  USING ("organization_id" = current_setting('app.current_organization_id', true))
  WITH CHECK ("organization_id" = current_setting('app.current_organization_id', true));

ALTER TABLE "appointments" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS appointments_tenant_isolation ON "appointments";
CREATE POLICY appointments_tenant_isolation ON "appointments"
  USING ("organization_id" = current_setting('app.current_organization_id', true))
  WITH CHECK ("organization_id" = current_setting('app.current_organization_id', true));

ALTER TABLE "calendar_connections" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS calendar_connections_tenant_isolation ON "calendar_connections";
CREATE POLICY calendar_connections_tenant_isolation ON "calendar_connections"
  USING ("organization_id" = current_setting('app.current_organization_id', true))
  WITH CHECK ("organization_id" = current_setting('app.current_organization_id', true));

-- GRANT condicional (prod baseline não tem app_user).
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'app_user') THEN
    GRANT SELECT, INSERT, UPDATE, DELETE ON "appointment_types" TO app_user;
    GRANT SELECT, INSERT, UPDATE, DELETE ON "appointments" TO app_user;
    GRANT SELECT, INSERT, UPDATE, DELETE ON "calendar_connections" TO app_user;
  END IF;
END $$;
