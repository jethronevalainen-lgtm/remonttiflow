-- ============================================================================
-- Migration: 20260723211000_functions_and_triggers.sql
-- VaKantti (formerly RemonttiFlow) — Supabase project 'remonttiflow'
--
-- What it does:
--   1. set_updated_at()            — generic BEFORE UPDATE trigger function
--                                    that stamps updated_at = now().
--      Triggers attached to every table that has an updated_at column:
--        organizations, profiles, projects, work_orders, time_entries.
--        (employees / customers / equipment have no updated_at column.)
--
--   2. handle_new_user()           — AFTER INSERT trigger on auth.users that
--                                    automatically creates the matching
--                                    public.profiles row, copying full_name
--                                    and avatar_url from raw_user_meta_data.
--
--   3. is_org_member(org uuid)     — SECURITY DEFINER helpers used by RLS
--      has_org_role(org, roles)      policies in the next migration. They
--                                    read organization_members BYPASSING RLS
--                                    (security definer + stable), which
--                                    avoids the infinite-recursion trap of
--                                    policies that query the very table they
--                                    protect. search_path is pinned to
--                                    'public' to prevent search-path
--                                    hijacking of the definer context.
--
-- Idempotency:
--   CREATE OR REPLACE FUNCTION, DROP TRIGGER IF EXISTS before CREATE TRIGGER.
--
-- Rollback notes:
--     drop trigger if exists on_auth_user_created on auth.users;
--     drop trigger if exists set_organizations_updated_at on public.organizations;
--     drop trigger if exists set_profiles_updated_at      on public.profiles;
--     drop trigger if exists set_projects_updated_at      on public.projects;
--     drop trigger if exists set_work_orders_updated_at   on public.work_orders;
--     drop trigger if exists set_time_entries_updated_at  on public.time_entries;
--     drop function if exists public.has_org_role(uuid, text[]);
--     drop function if exists public.is_org_member(uuid);
--     drop function if exists public.handle_new_user();
--     drop function if exists public.set_updated_at();
--   RLS policies (migration 20260723212000) depend on is_org_member /
--   has_org_role — drop the policies FIRST when rolling back everything.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. updated_at maintenance
-- ----------------------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

comment on function public.set_updated_at() is
  'Generic BEFORE UPDATE trigger function: stamps new.updated_at = now().';

drop trigger if exists set_organizations_updated_at on public.organizations;
create trigger set_organizations_updated_at
  before update on public.organizations
  for each row execute function public.set_updated_at();

drop trigger if exists set_profiles_updated_at on public.profiles;
create trigger set_profiles_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();

drop trigger if exists set_projects_updated_at on public.projects;
create trigger set_projects_updated_at
  before update on public.projects
  for each row execute function public.set_updated_at();

drop trigger if exists set_work_orders_updated_at on public.work_orders;
create trigger set_work_orders_updated_at
  before update on public.work_orders
  for each row execute function public.set_updated_at();

drop trigger if exists set_time_entries_updated_at on public.time_entries;
create trigger set_time_entries_updated_at
  before update on public.time_entries
  for each row execute function public.set_updated_at();

-- ----------------------------------------------------------------------------
-- 2. Auto-create a profile for every new auth user
-- ----------------------------------------------------------------------------
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, full_name, avatar_url)
  values (
    new.id,
    new.raw_user_meta_data ->> 'full_name',
    new.raw_user_meta_data ->> 'avatar_url'
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

comment on function public.handle_new_user() is
  'AFTER INSERT on auth.users: creates the matching public.profiles row. SECURITY DEFINER so it bypasses profiles RLS.';

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ----------------------------------------------------------------------------
-- 3. RLS helper functions (SECURITY DEFINER — bypass RLS on
--    organization_members to avoid policy recursion)
-- ----------------------------------------------------------------------------
create or replace function public.is_org_member(org uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.organization_members
    where organization_id = org
      and user_id = auth.uid()
  );
$$;

comment on function public.is_org_member(uuid) is
  'True if auth.uid() is a member (any role) of the given organization. Used by RLS policies; SECURITY DEFINER to avoid recursion.';

create or replace function public.has_org_role(org uuid, roles text[])
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.organization_members
    where organization_id = org
      and user_id = auth.uid()
      and role = any (roles)
  );
$$;

comment on function public.has_org_role(uuid, text[]) is
  'True if auth.uid() holds one of the given roles in the given organization, e.g. has_org_role(org_id, array[''admin'',''supervisor'']). Used by RLS policies; SECURITY DEFINER to avoid recursion.';
