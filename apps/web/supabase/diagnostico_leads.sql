-- ═══════════════════════════════════════════════════════════════════════════
-- Diagnóstico de Perfil ZappIQ — tabela de leads
-- ---------------------------------------------------------------------------
-- Persistência dos leads capturados pelo formulário POST /api/diagnostico.
-- A rota insere via Supabase REST com a service_role key, então RLS pode ficar
-- ligada sem policy pública (o service_role ignora RLS). Se preferir manter a
-- tabela sem RLS por enquanto, ela funciona igual pela REST com service_role.
--
-- Rodar no SQL Editor do Supabase Dashboard (projeto de produção da ZappIQ).
-- Idempotente: pode rodar mais de uma vez sem erro.
-- ═══════════════════════════════════════════════════════════════════════════

create table if not exists public.diagnostico_leads (
  id                uuid primary key default gen_random_uuid(),
  empresa           text not null,
  contato           text not null,
  email             text not null,
  telefone          text,
  segmento          text,
  objetivo          text,
  plano_sugerido    text,
  addons_sugeridos  jsonb,
  respostas         jsonb,
  source            text not null default 'diagnostico',
  ip                text,
  user_agent        text,
  created_at        timestamptz not null default now()
);

-- Índices de apoio (consulta por e-mail e ordenação por data).
create index if not exists diagnostico_leads_email_idx      on public.diagnostico_leads (email);
create index if not exists diagnostico_leads_created_at_idx  on public.diagnostico_leads (created_at desc);

-- RLS ligada: sem policy pública. A rota grava com a service_role key, que
-- ignora RLS. Assim nenhum cliente anônimo lê ou escreve direto na tabela.
alter table public.diagnostico_leads enable row level security;
