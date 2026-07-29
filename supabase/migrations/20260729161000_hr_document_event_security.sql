begin;

alter table public.employee_hr_events
  add column if not exists visibility text not null default 'Työntekijä';

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conrelid = 'public.employee_hr_events'::regclass
      and conname = 'employee_hr_events_visibility_check'
  ) then
    alter table public.employee_hr_events
      add constraint employee_hr_events_visibility_check
      check (visibility in ('Vain HR', 'HR ja esihenkilö', 'Työntekijä'));
  end if;
end;
$$;

-- Existing document audit events are restricted conservatively first. When the
-- source document still exists, copy its exact visibility to the event.
update public.employee_hr_events
set visibility = 'HR ja esihenkilö'
where event_type like 'employee_documents_%';

update public.employee_hr_events e
set visibility = d.visibility
from public.employee_documents d
where e.event_type like 'employee_documents_%'
  and e.organization_id = d.organization_id
  and e.employee_id = d.employee_id
  and e.metadata ->> 'record_id' = d.id::text;

create index if not exists employee_hr_events_visibility_idx
  on public.employee_hr_events(organization_id, employee_id, visibility, event_date desc);

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
  event_visibility text := 'Työntekijä';
begin
  row_data := case when tg_op = 'DELETE' then to_jsonb(old) else to_jsonb(new) end;
  target_org := (row_data ->> 'organization_id')::uuid;
  target_employee := (row_data ->> 'employee_id')::uuid;

  -- The employee or organization may already be gone during a cascading delete.
  if not exists (
    select 1
    from public.employees e
    where e.id = target_employee
      and e.organization_id = target_org
  ) then
    return coalesce(new, old);
  end if;

  if tg_table_name = 'employee_documents' then
    event_visibility := coalesce(nullif(row_data ->> 'visibility', ''), 'HR ja esihenkilö');
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
    visibility,
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
    event_visibility,
    auth.uid()
  );
  return coalesce(new, old);
end;
$$;

revoke all on function private.log_employee_hr_event() from public, anon, authenticated;

drop policy if exists employee_hr_events_select on public.employee_hr_events;
create policy employee_hr_events_select on public.employee_hr_events
for select to authenticated
using (private.can_view_employee_document(organization_id, employee_id, visibility));

-- A supervisor may not mutate or remove an admin-only document even if they
-- otherwise manage the employee.
drop policy if exists employee_documents_update on public.employee_documents;
create policy employee_documents_update on public.employee_documents
for update to authenticated
using (
  private.can_manage_employee_hr(organization_id, employee_id)
  and (visibility <> 'Vain HR' or private.has_org_role(organization_id, array['admin']::text[]))
)
with check (
  private.can_manage_employee_hr(organization_id, employee_id)
  and (visibility <> 'Vain HR' or private.has_org_role(organization_id, array['admin']::text[]))
);

drop policy if exists employee_documents_delete on public.employee_documents;
create policy employee_documents_delete on public.employee_documents
for delete to authenticated
using (
  private.can_manage_employee_hr(organization_id, employee_id)
  and (visibility <> 'Vain HR' or private.has_org_role(organization_id, array['admin']::text[]))
);

create or replace function private.can_access_hr_storage_object(p_name text, p_write boolean)
returns boolean
language plpgsql
stable
security definer
set search_path = 'pg_catalog', 'public'
as $$
declare
  target_org uuid;
  target_employee uuid;
  existing_visibility text;
begin
  target_org := split_part(p_name, '/', 1)::uuid;
  target_employee := split_part(p_name, '/', 2)::uuid;

  select d.visibility
  into existing_visibility
  from public.employee_documents d
  where d.organization_id = target_org
    and d.employee_id = target_employee
    and d.storage_path = p_name;

  if p_write then
    if existing_visibility is not null then
      return private.can_manage_employee_hr(target_org, target_employee)
        and (
          existing_visibility <> 'Vain HR'
          or private.has_org_role(target_org, array['admin']::text[])
        );
    end if;

    -- New objects do not have a metadata row yet. The employee_documents insert
    -- policy applies the final visibility restriction after upload.
    return private.can_manage_employee_hr(target_org, target_employee);
  end if;

  return existing_visibility is not null
    and private.can_view_employee_document(target_org, target_employee, existing_visibility);
exception when others then
  return false;
end;
$$;

revoke all on function private.can_access_hr_storage_object(text, boolean) from public, anon, authenticated;
grant execute on function private.can_access_hr_storage_object(text, boolean) to authenticated;

commit;
