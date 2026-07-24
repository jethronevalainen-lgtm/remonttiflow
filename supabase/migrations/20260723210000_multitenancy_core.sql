-- ============================================================================
-- Migration: 20260723210000_multitenancy_core.sql
-- VaKantti (formerly RemonttiFlow) — Supabase project 'remonttiflow'
--
-- What it does:
--   Introduces the multitenancy core on top of migration
--   20260723064035_create_tables (6 empty business tables, RLS enabled,
--   no policies yet):
--
--     NEW TABLES
--       organizations         — tenant root (one row per customer company)
--       profiles              — 1:1 extension of auth.users
--       organization_members  — user <-> org membership + role
--                                (admin | supervisor | worker)
--       project_members       — user <-> project assignment (optional role)
--       audit_logs            — append-only audit trail per organization
--
--     ALTERED TABLES (all 6 existing tables are EMPTY, so columns are added
--     NULLABLE with no backfill; the frontend migrates gradually and keeps
--     using the legacy text columns in the meantime):
--       projects      + organization_id, created_by, customer_id, project_number
--       work_orders   + organization_id, created_by, project_id
--       time_entries  + organization_id, created_by, project_id, employee_id,
--                       updated_at
--       employees     + organization_id, created_by
--       customers     + organization_id, created_by
--       equipment     + organization_id, created_by
--
--   Legacy text columns (projects.customer, work_orders.project / .assignee,
--   time_entries.project / .employee) are intentionally KEPT. The new uuid
--   foreign-key columns coexist with them until the frontend switches over.
--
-- Idempotency:
--   CREATE TABLE IF NOT EXISTS, ADD COLUMN IF NOT EXISTS,
--   CREATE INDEX IF NOT EXISTS — safe to re-run.
--
-- Rollback notes:
--   Because the business tables are empty, rollback is destructive but safe:
--     alter table public.projects      drop column if exists organization_id,
--                                      drop column if exists created_by,
--                                      drop column if exists customer_id,
--                                      drop column if exists project_number;
--     alter table public.work_orders   drop column if exists organization_id,
--                                      drop column if exists created_by,
--                                      drop column if exists project_id;
--     alter table public.time_entries  drop column if exists organization_id,
--                                      drop column if exists created_by,
--                                      drop column if exists project_id,
--                                      drop column if exists employee_id,
--                                      drop column if exists updated_at;
--     alter table public.employees     drop column if exists organization_id,
--                                      drop column if exists created_by;
--     alter table public.customers     drop column if exists organization_id,
--                                      drop column if exists created_by;
--     alter table public.equipment     drop column if exists organization_id,
--                                      drop column if exists created_by;
--     drop table if exists public.audit_logs;
--     drop table if exists public.project_members;
--     drop table if exists public.organization_members;
--     drop table if exists public.profiles;
--     drop table if exists public.organizations;
--   Rollback of LATER migrations (functions/triggers/policies) must happen
--   first, since RLS policies depend on these columns and tables.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. organizations — tenant root
-- ----------------------------------------------------------------------------
create table if not exists public.organizations (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  business_id text,                       -- Finnish Y-tunnus, e.g. '1234567-8'
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

comment on table public.organizations is
  'Tenant root. Every business row (project, customer, ...) belongs to exactly one organization via organization_id.';

-- ----------------------------------------------------------------------------
-- 2. profiles — 1:1 extension of auth.users
-- ----------------------------------------------------------------------------
create table if not exists public.profiles (
  id         uuid primary key references auth.users (id) on delete cascade,
  full_name  text,
  phone      text,
  avatar_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.profiles is
  'Public profile per auth user. Row is created automatically by the handle_new_user trigger on auth.users.';

-- ----------------------------------------------------------------------------
-- 3. organization_members — membership + role within a tenant
-- ----------------------------------------------------------------------------
create table if not exists public.organization_members (
  organization_id uuid not null references public.organizations (id) on delete cascade,
  user_id         uuid not null references public.profiles (id) on delete cascade,
  role            text not null check (role in ('admin', 'supervisor', 'worker')),
  created_at      timestamptz not null default now(),
  primary key (organization_id, user_id)
);

comment on table public.organization_members is
  'Membership of a user in an organization. role: admin (full control incl. members), supervisor (manage business data), worker (read + own time entries).';

-- ----------------------------------------------------------------------------
-- 4. project_members — fine-grained project assignment
-- ----------------------------------------------------------------------------
create table if not exists public.project_members (
  project_id uuid not null references public.projects (id) on delete cascade,
  user_id    uuid not null references public.profiles (id) on delete cascade,
  role       text,                      -- free-form, e.g. 'työnjohtaja', 'asentaja'
  created_at timestamptz not null default now(),
  primary key (project_id, user_id)
);

comment on table public.project_members is
  'Which users are assigned to which project. Authorization is org-level (RLS); this table is informational/scoping for the UI.';

-- ----------------------------------------------------------------------------
-- 5. audit_logs — append-only audit trail
-- ----------------------------------------------------------------------------
create table if not exists public.audit_logs (
  id              bigint generated always as identity primary key,
  organization_id uuid references public.organizations (id) on delete set null,
  user_id         uuid references public.profiles (id) on delete set null,
  action          text,                 -- e.g. 'INSERT' | 'UPDATE' | 'DELETE' | 'invite.accepted'
  table_name      text,
  record_id       uuid,
  metadata        jsonb,
  created_at      timestamptz not null default now()
);

comment on table public.audit_logs is
  'Append-only audit trail. INSERT allowed for any org member, SELECT for admin/supervisor. No UPDATE/DELETE policies by design.';

create index if not exists audit_logs_organization_id_idx on public.audit_logs (organization_id);
create index if not exists audit_logs_created_at_idx       on public.audit_logs (created_at desc);

-- ----------------------------------------------------------------------------
-- 6. Extend the 6 existing business tables with tenant + ownership columns.
--    All tables are EMPTY (0 rows) at this point, so nullable columns need
--    no backfill. NOT NULL can be enforced in a later migration once the
--    frontend writes organization_id on every insert.
-- ----------------------------------------------------------------------------

-- projects
alter table public.projects      add column if not exists organization_id uuid references public.organizations (id);
alter table public.projects      add column if not exists created_by      uuid references public.profiles (id);
alter table public.projects      add column if not exists customer_id     uuid references public.customers (id);
alter table public.projects      add column if not exists project_number  text;

-- work_orders
alter table public.work_orders   add column if not exists organization_id uuid references public.organizations (id);
alter table public.work_orders   add column if not exists created_by      uuid references public.profiles (id);
alter table public.work_orders   add column if not exists project_id      uuid references public.projects (id);

-- time_entries
alter table public.time_entries  add column if not exists organization_id uuid references public.organizations (id);
alter table public.time_entries  add column if not exists created_by      uuid references public.profiles (id);
alter table public.time_entries  add column if not exists project_id      uuid references public.projects (id);
alter table public.time_entries  add column if not exists employee_id     uuid references public.employees (id);
alter table public.time_entries  add column if not exists updated_at      timestamptz not null default now();

-- employees
alter table public.employees     add column if not exists organization_id uuid references public.organizations (id);
alter table public.employees     add column if not exists created_by      uuid references public.profiles (id);

-- customers
alter table public.customers     add column if not exists organization_id uuid references public.organizations (id);
alter table public.customers     add column if not exists created_by      uuid references public.profiles (id);

-- equipment
alter table public.equipment     add column if not exists organization_id uuid references public.organizations (id);
alter table public.equipment     add column if not exists created_by      uuid references public.profiles (id);

-- ----------------------------------------------------------------------------
-- 7. Indexes supporting RLS lookups and common join paths.
-- ----------------------------------------------------------------------------
create index if not exists projects_organization_id_idx      on public.projects (organization_id);
create index if not exists work_orders_organization_id_idx   on public.work_orders (organization_id);
create index if not exists time_entries_organization_id_idx  on public.time_entries (organization_id);
create index if not exists employees_organization_id_idx     on public.employees (organization_id);
create index if not exists customers_organization_id_idx     on public.customers (organization_id);
create index if not exists equipment_organization_id_idx     on public.equipment (organization_id);
create index if not exists organization_members_user_id_idx  on public.organization_members (user_id);
create index if not exists project_members_user_id_idx       on public.project_members (user_id);
create index if not exists work_orders_project_id_idx        on public.work_orders (project_id);
create index if not exists time_entries_project_id_idx       on public.time_entries (project_id);
create index if not exists time_entries_created_by_idx       on public.time_entries (created_by);
