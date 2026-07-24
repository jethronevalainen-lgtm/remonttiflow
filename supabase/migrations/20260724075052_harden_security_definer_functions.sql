-- Harden internal trigger/RLS helpers so they are not exposed as public RPCs.
-- ALTER FUNCTION ... SET SCHEMA preserves the function OID, therefore existing
-- trigger and RLS policy dependencies continue to point to the same functions.

create schema if not exists private;
revoke all on schema private from public;
grant usage on schema private to authenticated;

-- Generic trigger function does not need the caller-controlled search path.
alter function public.set_updated_at()
  set search_path = pg_catalog;

-- Move SECURITY DEFINER helpers out of the Data API's exposed public schema.
alter function public.handle_new_user()
  set schema private;
alter function public.is_org_member(uuid)
  set schema private;
alter function public.has_org_role(uuid, text[])
  set schema private;

alter function private.handle_new_user()
  set search_path = pg_catalog, public;
alter function private.is_org_member(uuid)
  set search_path = pg_catalog, public;
alter function private.has_org_role(uuid, text[])
  set search_path = pg_catalog, public;

-- Prevent direct invocation of the auth trigger helper.
revoke all on function private.handle_new_user() from public, anon, authenticated;

-- RLS policies execute these helpers for signed-in users. They remain callable
-- in SQL policy evaluation but are no longer exposed as /rest/v1/rpc routes.
revoke all on function private.is_org_member(uuid) from public, anon, authenticated;
revoke all on function private.has_org_role(uuid, text[]) from public, anon, authenticated;
grant execute on function private.is_org_member(uuid) to authenticated;
grant execute on function private.has_org_role(uuid, text[]) to authenticated;

comment on schema private is
  'Internal database functions that must not be exposed through the public Data API schema.';
