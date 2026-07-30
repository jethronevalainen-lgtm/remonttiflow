begin;

create or replace function private.log_employee_hr_event()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  row_data jsonb;
  target_org uuid;
  target_employee uuid;
  record_title text;
  record_status text;
begin
  row_data := case when tg_op = 'DELETE' then to_jsonb(old) else to_jsonb(new) end;
  target_org := (row_data ->> 'organization_id')::uuid;
  target_employee := (row_data ->> 'employee_id')::uuid;

  -- Työntekijän tai organisaation kaskadipoistossa tapahtuman kohdetta ei enää ole.
  -- Tällöin lapsitietojen poistot ohitetaan, jotta HR-auditointi ei estä elinkaaren poistumista.
  if not exists (
    select 1
    from public.employees e
    where e.id = target_employee
      and e.organization_id = target_org
  ) then
    return coalesce(new, old);
  end if;

  record_title := coalesce(
    nullif(row_data ->> 'title', ''),
    nullif(row_data ->> 'skill_name', ''),
    nullif(row_data ->> 'conversation_type', ''),
    nullif(row_data ->> 'document_type', ''),
    tg_table_name
  );
  record_status := nullif(row_data ->> 'status', '');

  insert into public.employee_hr_events(
    organization_id,
    employee_id,
    event_type,
    title,
    metadata,
    created_by
  ) values (
    target_org,
    target_employee,
    tg_table_name || '_' || lower(tg_op),
    record_title,
    jsonb_strip_nulls(jsonb_build_object(
      'operation', lower(tg_op),
      'table', tg_table_name,
      'record_id', row_data ->> 'id',
      'status', record_status
    )),
    auth.uid()
  );
  return coalesce(new, old);
end;
$$;

revoke all on function private.log_employee_hr_event() from public, anon, authenticated;

commit;
