-- Move privileged RPC implementations out of the PostgREST-exposed public schema.
-- Public RPC names and signatures stay stable through SECURITY INVOKER wrappers.

grant usage on schema private to authenticated, service_role;

create temporary table _security_definer_rpc_targets on commit drop as
select
  p.proname,
  pg_catalog.pg_get_function_identity_arguments(p.oid) as identity_args,
  pg_catalog.pg_get_function_arguments(p.oid) as create_args,
  pg_catalog.pg_get_function_result(p.oid) as result_type,
  p.proretset,
  p.provolatile,
  p.proisstrict,
  p.proparallel,
  p.pronargs
from pg_catalog.pg_proc p
join pg_catalog.pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public'
  and p.prosecdef
  and p.prokind = 'f'
  and pg_catalog.has_function_privilege('authenticated', p.oid, 'EXECUTE');

do $migration$
declare
  r record;
  call_args text;
  wrapper_body text;
  volatility_clause text;
  strict_clause text;
  parallel_clause text;
begin
  if exists (
    select 1
    from _security_definer_rpc_targets target
    join pg_catalog.pg_proc private_proc
      on private_proc.proname = target.proname
     and pg_catalog.pg_get_function_identity_arguments(private_proc.oid) = target.identity_args
    join pg_catalog.pg_namespace private_schema
      on private_schema.oid = private_proc.pronamespace
     and private_schema.nspname = 'private'
  ) then
    raise exception 'A private implementation with the same signature already exists.';
  end if;

  for r in
    select * from _security_definer_rpc_targets
    order by proname, identity_args
  loop
    select coalesce(string_agg(format('$%s', parameter_number), ', ' order by parameter_number), '')
      into call_args
    from generate_series(1, r.pronargs) parameter_number;

    volatility_clause := case r.provolatile
      when 'i' then 'immutable'
      when 's' then 'stable'
      else 'volatile'
    end;
    strict_clause := case
      when r.proisstrict then 'returns null on null input'
      else 'called on null input'
    end;
    parallel_clause := case r.proparallel
      when 's' then 'parallel safe'
      when 'r' then 'parallel restricted'
      else 'parallel unsafe'
    end;
    wrapper_body := case
      when r.proretset then format('select * from private.%I(%s)', r.proname, call_args)
      else format('select private.%I(%s)', r.proname, call_args)
    end;

    execute format(
      'alter function public.%I(%s) set schema private',
      r.proname,
      r.identity_args
    );

    execute format(
      'revoke all on function private.%I(%s) from public, anon, authenticated',
      r.proname,
      r.identity_args
    );
    execute format(
      'grant execute on function private.%I(%s) to authenticated, service_role',
      r.proname,
      r.identity_args
    );

    execute format(
      'create function public.%I(%s) returns %s language sql %s security invoker %s %s set search_path = pg_catalog, public, private as $wrapper$ %s $wrapper$',
      r.proname,
      r.create_args,
      r.result_type,
      volatility_clause,
      strict_clause,
      parallel_clause,
      wrapper_body
    );

    execute format(
      'revoke all on function public.%I(%s) from public, anon',
      r.proname,
      r.identity_args
    );
    execute format(
      'grant execute on function public.%I(%s) to authenticated, service_role',
      r.proname,
      r.identity_args
    );
  end loop;
end;
$migration$;

-- New functions no longer receive executable access implicitly.
alter default privileges for role postgres in schema public
  revoke execute on functions from public, anon, authenticated;

alter default privileges for role postgres in schema private
  revoke execute on functions from public, anon, authenticated;
