-- PostgreSQL does not provide max(uuid). Replace both payroll summary UUID
-- aggregations with a deterministic text aggregation cast back to uuid.

do $migration$
declare
  function_definition text;
begin
  select pg_get_functiondef(procedure.oid)
    into function_definition
  from pg_proc procedure
  join pg_namespace namespace on namespace.oid = procedure.pronamespace
  where namespace.nspname = 'public'
    and procedure.proname = 'lock_payroll_period'
    and pg_get_function_identity_arguments(procedure.oid) =
      'p_organization_id uuid, p_period_start date, p_period_end date, p_notes text';

  if function_definition is null then
    raise exception 'lock_payroll_period-function was not found.';
  end if;

  function_definition := replace(
    function_definition,
    'max(line.employee_user_id)',
    'min(line.employee_user_id::text)::uuid'
  );

  execute function_definition;
end;
$migration$;
