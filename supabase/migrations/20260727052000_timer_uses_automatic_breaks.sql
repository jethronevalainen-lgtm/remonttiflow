create or replace function private.complete_work_site_check_in_impl(p_check_in_id uuid)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  check_in_row public.work_site_check_ins%rowtype;
  new_time_entry_id uuid;
  linked_employee_id uuid;
  checkout_at timestamptz := statement_timestamp();
  local_start timestamp without time zone;
  local_end timestamp without time zone;
  organization_timezone text;
begin
  if auth.uid() is null then
    raise exception 'Kirjautuminen vaaditaan.' using errcode = '42501';
  end if;

  select * into check_in_row
  from public.work_site_check_ins
  where id = p_check_in_id
    and user_id = auth.uid()
    and checked_out_at is null
  for update;

  if not found then
    raise exception 'Aktiivista työmaalle kirjautumista ei löytynyt.' using errcode = 'P0002';
  end if;

  if not private.is_org_member(check_in_row.organization_id) then
    raise exception 'Käyttäjä ei kuulu kirjauksen organisaatioon.' using errcode = '42501';
  end if;

  if checkout_at <= check_in_row.checked_in_at
     or checkout_at - check_in_row.checked_in_at >= interval '24 hours' then
    raise exception 'Työmaalle kirjautumisen keston pitää olla yli 0 ja alle 24 tuntia.' using errcode = '23514';
  end if;

  select coalesce(r.timezone, 'Europe/Helsinki')
  into organization_timezone
  from (select 1) seed
  left join public.organization_time_rules r
    on r.organization_id = check_in_row.organization_id;

  local_start := check_in_row.checked_in_at at time zone organization_timezone;
  local_end := checkout_at at time zone organization_timezone;

  select employee.id into linked_employee_id
  from public.employees employee
  where employee.organization_id = check_in_row.organization_id
    and employee.user_id = check_in_row.user_id
  limit 1;

  insert into public.time_entries (
    organization_id,
    created_by,
    user_id,
    project_id,
    employee_id,
    date,
    employee,
    project,
    hours,
    overtime,
    start_time,
    end_time,
    break_minutes,
    break_source,
    source,
    description,
    status
  ) values (
    check_in_row.organization_id,
    check_in_row.user_id,
    check_in_row.user_id,
    check_in_row.project_id,
    linked_employee_id,
    local_start::date,
    check_in_row.employee_name,
    check_in_row.project_name,
    0.01,
    0,
    local_start::time(0),
    local_end::time(0),
    0,
    'automatic',
    'timer',
    nullif(btrim(check_in_row.description), ''),
    'Odottaa'
  ) returning id into new_time_entry_id;

  update public.work_site_check_ins
  set checked_out_at = checkout_at,
      time_entry_id = new_time_entry_id,
      updated_at = checkout_at
  where id = check_in_row.id;

  return new_time_entry_id;
end;
$$;

revoke all on function private.complete_work_site_check_in_impl(uuid) from public, anon, authenticated;
grant execute on function private.complete_work_site_check_in_impl(uuid) to service_role;
