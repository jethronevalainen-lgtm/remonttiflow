-- ============================================================================
-- Migration: 20260723212000_rls_policies.sql
-- VaKantti (formerly RemonttiFlow) — Supabase project 'remonttiflow'
--
-- What it does:
--   Enables RLS on the 5 new tables (the 6 original business tables already
--   have rls_enabled from migration 20260723064035_create_tables) and defines
--   SELECT / INSERT / UPDATE / DELETE policies for ALL 11 tables.
--
--   Authorization model (all checks via the SECURITY DEFINER helpers
--   is_org_member() / has_org_role() from migration 20260723211000, so no
--   RLS recursion on organization_members):
--
--     BUSINESS TABLES (projects, work_orders, employees, customers,
--     equipment):
--       SELECT            any member of the row's organization
--       INSERT            any member, organization_id must be an org they
--                         belong to
--       UPDATE / DELETE   admin + supervisor only
--
--     time_entries        same as above, EXCEPT: the creating worker may
--                         UPDATE their OWN row (created_by = auth.uid())
--                         while status = 'Odottaa' — i.e. a worker can fix
--                         a pending entry but not an approved/rejected one.
--                         DELETE stays admin + supervisor only.
--
--     organizations:
--       SELECT            members see their own orgs
--       UPDATE            admin only
--       INSERT / DELETE   no policies — org bootstrap happens via seed.sql
--                         or a later server-side invite/provisioning flow
--
--     organization_members:
--       SELECT            members see rows of orgs they belong to
--       INSERT/UPDATE/    admin of that org only. NOTE: the very first admin
--       DELETE              membership is created via seed.sql or a later
--                         invite flow (service role), not by end users.
--
--     profiles:
--       SELECT            own row + profiles of co-members of any shared org
--       UPDATE            own row only (WITH CHECK prevents id changes)
--       INSERT            handled by handle_new_user trigger (SECURITY
--                         DEFINER, bypasses RLS); no client INSERT policy
--
--     project_members:
--       SELECT            members of the project's organization
--       INSERT/UPDATE/    admin + supervisor of the project's organization
--       DELETE
--
--     audit_logs:
--       INSERT            any member of the logged organization
--       SELECT            admin + supervisor
--       UPDATE / DELETE   none — audit trail is append-only
--
--   Rows whose organization_id IS NULL (pre-multitenancy leftovers — the
--   tables are currently empty, but defensive) are invisible and immutable
--   to all non-service-role users: every policy check requires membership,
--   which a NULL org can never satisfy.
--
-- Idempotency:
--   DROP POLICY IF EXISTS before every CREATE POLICY; ENABLE ROW LEVEL
--   SECURITY is itself idempotent.
--
-- Rollback notes:
--   Every policy below can be dropped by name, e.g.:
--     drop policy if exists projects_select on public.projects;
--   To roll back the whole migration, drop all policies created here and
--   optionally: alter table public.<new_table> disable row level security;
--   for the 5 new tables (do NOT disable RLS on the 6 original tables —
--   that was enabled by the earlier migration).
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 0. Enable RLS on the new tables (6 original tables already have it)
-- ----------------------------------------------------------------------------
alter table public.organizations        enable row level security;
alter table public.profiles             enable row level security;
alter table public.organization_members enable row level security;
alter table public.project_members      enable row level security;
alter table public.audit_logs           enable row level security;

-- ----------------------------------------------------------------------------
-- 1. projects
-- ----------------------------------------------------------------------------
drop policy if exists projects_select on public.projects;
create policy projects_select on public.projects
  for select using (public.is_org_member(organization_id));

drop policy if exists projects_insert on public.projects;
create policy projects_insert on public.projects
  for insert with check (public.is_org_member(organization_id));

drop policy if exists projects_update on public.projects;
create policy projects_update on public.projects
  for update
  using     (public.has_org_role(organization_id, array['admin', 'supervisor']))
  with check (public.has_org_role(organization_id, array['admin', 'supervisor']));

drop policy if exists projects_delete on public.projects;
create policy projects_delete on public.projects
  for delete using (public.has_org_role(organization_id, array['admin', 'supervisor']));

-- ----------------------------------------------------------------------------
-- 2. work_orders
-- ----------------------------------------------------------------------------
drop policy if exists work_orders_select on public.work_orders;
create policy work_orders_select on public.work_orders
  for select using (public.is_org_member(organization_id));

drop policy if exists work_orders_insert on public.work_orders;
create policy work_orders_insert on public.work_orders
  for insert with check (public.is_org_member(organization_id));

drop policy if exists work_orders_update on public.work_orders;
create policy work_orders_update on public.work_orders
  for update
  using     (public.has_org_role(organization_id, array['admin', 'supervisor']))
  with check (public.has_org_role(organization_id, array['admin', 'supervisor']));

drop policy if exists work_orders_delete on public.work_orders;
create policy work_orders_delete on public.work_orders
  for delete using (public.has_org_role(organization_id, array['admin', 'supervisor']));

-- ----------------------------------------------------------------------------
-- 3. time_entries — worker may UPDATE own pending row
-- ----------------------------------------------------------------------------
drop policy if exists time_entries_select on public.time_entries;
create policy time_entries_select on public.time_entries
  for select using (public.is_org_member(organization_id));

drop policy if exists time_entries_insert on public.time_entries;
create policy time_entries_insert on public.time_entries
  for insert with check (public.is_org_member(organization_id));

drop policy if exists time_entries_update on public.time_entries;
create policy time_entries_update on public.time_entries
  for update
  using (
    public.has_org_role(organization_id, array['admin', 'supervisor'])
    or (created_by = auth.uid() and status = 'Odottaa')
  )
  with check (
    -- regardless of who performs the update, the row must stay in an org
    -- the actor belongs to (prevents moving an entry across tenants)
    public.is_org_member(organization_id)
  );

drop policy if exists time_entries_delete on public.time_entries;
create policy time_entries_delete on public.time_entries
  for delete using (public.has_org_role(organization_id, array['admin', 'supervisor']));

-- ----------------------------------------------------------------------------
-- 4. employees — workers may SELECT colleagues in their org (same policy)
-- ----------------------------------------------------------------------------
drop policy if exists employees_select on public.employees;
create policy employees_select on public.employees
  for select using (public.is_org_member(organization_id));

drop policy if exists employees_insert on public.employees;
create policy employees_insert on public.employees
  for insert with check (public.is_org_member(organization_id));

drop policy if exists employees_update on public.employees;
create policy employees_update on public.employees
  for update
  using     (public.has_org_role(organization_id, array['admin', 'supervisor']))
  with check (public.has_org_role(organization_id, array['admin', 'supervisor']));

drop policy if exists employees_delete on public.employees;
create policy employees_delete on public.employees
  for delete using (public.has_org_role(organization_id, array['admin', 'supervisor']));

-- ----------------------------------------------------------------------------
-- 5. customers
-- ----------------------------------------------------------------------------
drop policy if exists customers_select on public.customers;
create policy customers_select on public.customers
  for select using (public.is_org_member(organization_id));

drop policy if exists customers_insert on public.customers;
create policy customers_insert on public.customers
  for insert with check (public.is_org_member(organization_id));

drop policy if exists customers_update on public.customers;
create policy customers_update on public.customers
  for update
  using     (public.has_org_role(organization_id, array['admin', 'supervisor']))
  with check (public.has_org_role(organization_id, array['admin', 'supervisor']));

drop policy if exists customers_delete on public.customers;
create policy customers_delete on public.customers
  for delete using (public.has_org_role(organization_id, array['admin', 'supervisor']));

-- ----------------------------------------------------------------------------
-- 6. equipment
-- ----------------------------------------------------------------------------
drop policy if exists equipment_select on public.equipment;
create policy equipment_select on public.equipment
  for select using (public.is_org_member(organization_id));

drop policy if exists equipment_insert on public.equipment;
create policy equipment_insert on public.equipment
  for insert with check (public.is_org_member(organization_id));

drop policy if exists equipment_update on public.equipment;
create policy equipment_update on public.equipment
  for update
  using     (public.has_org_role(organization_id, array['admin', 'supervisor']))
  with check (public.has_org_role(organization_id, array['admin', 'supervisor']));

drop policy if exists equipment_delete on public.equipment;
create policy equipment_delete on public.equipment
  for delete using (public.has_org_role(organization_id, array['admin', 'supervisor']));

-- ----------------------------------------------------------------------------
-- 7. organizations — members read, admin updates; no client INSERT/DELETE
-- ----------------------------------------------------------------------------
drop policy if exists organizations_select on public.organizations;
create policy organizations_select on public.organizations
  for select using (public.is_org_member(id));

drop policy if exists organizations_update on public.organizations;
create policy organizations_update on public.organizations
  for update
  using     (public.has_org_role(id, array['admin']))
  with check (public.has_org_role(id, array['admin']));

-- ----------------------------------------------------------------------------
-- 8. organization_members — admin-managed; bootstrap via seed / invite flow
-- ----------------------------------------------------------------------------
drop policy if exists organization_members_select on public.organization_members;
create policy organization_members_select on public.organization_members
  for select using (public.is_org_member(organization_id));

drop policy if exists organization_members_insert on public.organization_members;
create policy organization_members_insert on public.organization_members
  for insert with check (public.has_org_role(organization_id, array['admin']));

drop policy if exists organization_members_update on public.organization_members;
create policy organization_members_update on public.organization_members
  for update
  using     (public.has_org_role(organization_id, array['admin']))
  with check (public.has_org_role(organization_id, array['admin']));

drop policy if exists organization_members_delete on public.organization_members;
create policy organization_members_delete on public.organization_members
  for delete using (public.has_org_role(organization_id, array['admin']));

-- ----------------------------------------------------------------------------
-- 9. profiles — own row + co-members of shared orgs
-- ----------------------------------------------------------------------------
drop policy if exists profiles_select on public.profiles;
create policy profiles_select on public.profiles
  for select using (
    id = auth.uid()
    or exists (
      select 1
      from public.organization_members om_self
      join public.organization_members om_peer
        on om_peer.organization_id = om_self.organization_id
      where om_self.user_id = auth.uid()
        and om_peer.user_id = profiles.id
    )
  );

drop policy if exists profiles_update on public.profiles;
create policy profiles_update on public.profiles
  for update
  using     (id = auth.uid())
  with check (id = auth.uid());

-- ----------------------------------------------------------------------------
-- 10. project_members — scoped through the parent project's organization
-- ----------------------------------------------------------------------------
drop policy if exists project_members_select on public.project_members;
create policy project_members_select on public.project_members
  for select using (
    exists (
      select 1 from public.projects p
      where p.id = project_id
        and public.is_org_member(p.organization_id)
    )
  );

drop policy if exists project_members_insert on public.project_members;
create policy project_members_insert on public.project_members
  for insert with check (
    exists (
      select 1 from public.projects p
      where p.id = project_id
        and public.has_org_role(p.organization_id, array['admin', 'supervisor'])
    )
  );

drop policy if exists project_members_update on public.project_members;
create policy project_members_update on public.project_members
  for update
  using (
    exists (
      select 1 from public.projects p
      where p.id = project_id
        and public.has_org_role(p.organization_id, array['admin', 'supervisor'])
    )
  )
  with check (
    exists (
      select 1 from public.projects p
      where p.id = project_id
        and public.has_org_role(p.organization_id, array['admin', 'supervisor'])
    )
  );

drop policy if exists project_members_delete on public.project_members;
create policy project_members_delete on public.project_members
  for delete using (
    exists (
      select 1 from public.projects p
      where p.id = project_id
        and public.has_org_role(p.organization_id, array['admin', 'supervisor'])
    )
  );

-- ----------------------------------------------------------------------------
-- 11. audit_logs — append-only
-- ----------------------------------------------------------------------------
drop policy if exists audit_logs_insert on public.audit_logs;
create policy audit_logs_insert on public.audit_logs
  for insert with check (public.is_org_member(organization_id));

drop policy if exists audit_logs_select on public.audit_logs;
create policy audit_logs_select on public.audit_logs
  for select using (public.has_org_role(organization_id, array['admin', 'supervisor']));
