grant execute on function private.can_access_employee_hr(uuid, uuid) to authenticated;

create or replace function private.audit_sensitive_employee_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  target_id uuid;
  target_org uuid;
begin
  target_id := case when tg_table_name = 'employee_hr_profiles'
    then coalesce(new.employee_id, old.employee_id)
    else coalesce(new.id, old.id)
  end;
  target_org := coalesce(new.organization_id, old.organization_id);

  insert into public.audit_logs(organization_id, user_id, action, table_name, record_id, metadata)
  values (
    target_org,
    auth.uid(),
    lower(tg_op),
    tg_table_name,
    target_id,
    jsonb_build_object('sensitive_values_recorded', false)
  );

  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end;
$$;

revoke all on function private.audit_sensitive_employee_change() from public, anon, authenticated;
