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
  if tg_op = 'DELETE' then
    target_org := old.organization_id;
    if tg_table_name = 'employee_hr_profiles' then
      target_id := old.employee_id;
    else
      target_id := old.id;
    end if;
  else
    target_org := new.organization_id;
    if tg_table_name = 'employee_hr_profiles' then
      target_id := new.employee_id;
    else
      target_id := new.id;
    end if;
  end if;

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
