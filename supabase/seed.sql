-- ============================================================================
-- seed.sql — DEV seed for VaKantti (formerly RemonttiFlow)
-- Supabase project 'remonttiflow'
--
-- What it does:
--   Creates ONE demo organization with a stable, well-known UUID so that
--   local development environments all share the same tenant id.
--
--   Everything else is COMMENTED OUT on purpose: memberships and profiles
--   reference real auth.users rows, which only exist after someone signs
--   up (or after users are created in the Supabase dashboard / via the
--   admin API). The commented blocks are TEMPLATES — copy them, replace
--   the placeholder user UUIDs with real auth.users ids, and run manually
--   (SQL editor, service role, or `supabase db reset` workflow).
--
-- How to run:
--   - Supabase CLI:   supabase db reset          (runs migrations + seed)
--   - or paste into the Supabase SQL editor.
--
-- Idempotency:
--   The active insert uses ON CONFLICT DO NOTHING — safe to re-run.
--
-- Rollback notes:
--     delete from public.organizations
--       where id = '00000000-0000-4000-8000-000000000001';
--   (Cascades to organization_members, project assignments, and — once
--   data exists — would orphan business rows only if their organization_id
--   FK is still nullable; business rows reference it without cascade, so
--   delete business rows first if any were created under this org.)
-- ============================================================================

-- ----------------------------------------------------------------------------
-- Demo tenant (ACTIVE — safe to run in dev)
-- ----------------------------------------------------------------------------
insert into public.organizations (id, name, business_id)
values (
  '00000000-0000-4000-8000-000000000001',
  'VaKantti Demo Oy',
  '1234567-8'
)
on conflict (id) do nothing;

-- ============================================================================
-- TEMPLATES BELOW — commented out. Replace placeholder UUIDs with real
-- auth.users ids before running. Find them with:
--   select id, email from auth.users;
-- ============================================================================

-- ----------------------------------------------------------------------------
-- TEMPLATE 1: make an existing user the admin of the demo org.
-- The profiles row already exists if the user signed up after the
-- handle_new_user trigger was installed; otherwise insert it first.
-- ----------------------------------------------------------------------------
-- insert into public.profiles (id, full_name)
-- values ('<USER_UUID>', 'Demo Admin')
-- on conflict (id) do nothing;
--
-- insert into public.organization_members (organization_id, user_id, role)
-- values (
--   '00000000-0000-4000-8000-000000000001',
--   '<USER_UUID>',
--   'admin'
-- )
-- on conflict (organization_id, user_id) do nothing;

-- ----------------------------------------------------------------------------
-- TEMPLATE 2: add a supervisor and a worker.
-- ----------------------------------------------------------------------------
-- insert into public.organization_members (organization_id, user_id, role)
-- values
--   ('00000000-0000-4000-8000-000000000001', '<SUPERVISOR_USER_UUID>', 'supervisor'),
--   ('00000000-0000-4000-8000-000000000001', '<WORKER_USER_UUID>',     'worker')
-- on conflict (organization_id, user_id) do nothing;

-- ----------------------------------------------------------------------------
-- TEMPLATE 3: demo business rows under the demo org.
-- Finnish status/type values must match the CHECK constraints from
-- migration 20260723064035_create_tables.
-- ----------------------------------------------------------------------------
-- insert into public.customers
--   (name, type, contact_person, phone, email, address, project_count, status,
--    organization_id, created_by)
-- values
--   ('Asunto Oy Esimerkki', 'Taloyhtiö', 'Matti Meikäläinen', '040 123 4567',
--    'matti@example.fi', 'Esimerkkikatu 1, 00100 Helsinki', 1, 'Aktiivinen',
--    '00000000-0000-4000-8000-000000000001', '<ADMIN_USER_UUID>');
--
-- insert into public.projects
--   (name, customer, location, status, start_date, end_date, budget, spent,
--    progress, description, project_number, organization_id, created_by,
--    customer_id)
-- values
--   ('Kylpyhuoneremontti Esimerkkikatu 1', 'Asunto Oy Esimerkki', 'Helsinki',
--    'Aktiivinen', '2026-08-01', '2026-10-15', 85000, 0, 0,
--    'Demo-projekti siemenaineistosta', 'PRJ-2026-001',
--    '00000000-0000-4000-8000-000000000001', '<ADMIN_USER_UUID>',
--    '<CUSTOMER_UUID_FROM_ABOVE>');
--
-- insert into public.employees
--   (name, role, department, phone, email, start_date, status,
--    organization_id, created_by)
-- values
--   ('Ville Vastaava', 'Työnjohtaja', 'Tuotanto', '040 555 0001',
--    'ville@example.fi', '2024-01-15', 'Aktiivinen',
--    '00000000-0000-4000-8000-000000000001', '<ADMIN_USER_UUID>');
