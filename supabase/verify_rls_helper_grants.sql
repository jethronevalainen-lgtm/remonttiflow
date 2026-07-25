-- verify_rls_helper_grants.sql
--
-- Runtime guard for the 2026-07-24/25 incident: migration 20260724112704
-- revoked EXECUTE on the SECURITY DEFINER RLS helpers
-- private.can_access_project / private.can_access_work_order from the
-- authenticated role, so every policy-guarded SELECT failed with 42501
-- "permission denied for function can_access_project".
--
-- This script finds every private-schema function that is referenced from
-- an RLS policy (pg_policies qual / with_check) and verifies:
--   1. role `authenticated` HAS the EXECUTE privilege, and
--   2. roles `anon` and PUBLIC do NOT have it.
--
-- Run via psql or the Supabase SQL editor:
--   psql "$DATABASE_URL" -f supabase/verify_rls_helper_grants.sql
--
-- An empty result set means all grants are correct. Every returned row is
-- a violation that must be fixed (see the `violation` column).

with policy_referenced_helpers as (
  select distinct
    p.oid         as function_oid,
    n.nspname     as schema_name,
    p.proname     as function_name
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'private'
    and exists (
      select 1
      from pg_policies pol
      where pol.qual ~ ('\m' || p.proname || '\M')
         or coalesce(pol.with_check, '') ~ ('\m' || p.proname || '\M')
    )
),
violations as (
  select
    h.schema_name || '.' || h.function_name as helper_function,
    'authenticated is missing EXECUTE (RLS policies calling this helper fail with 42501)'
      as violation
  from policy_referenced_helpers h
  where not has_function_privilege('authenticated', h.function_oid, 'EXECUTE')

  union all

  select
    h.schema_name || '.' || h.function_name,
    'anon must not have EXECUTE on a private RLS helper'
  from policy_referenced_helpers h
  where has_function_privilege('anon', h.function_oid, 'EXECUTE')

  union all

  select
    h.schema_name || '.' || h.function_name,
    'PUBLIC must not have EXECUTE on a private RLS helper'
  from policy_referenced_helpers h
  where has_function_privilege('PUBLIC', h.function_oid, 'EXECUTE')
)
select *
from violations
order by helper_function, violation;
