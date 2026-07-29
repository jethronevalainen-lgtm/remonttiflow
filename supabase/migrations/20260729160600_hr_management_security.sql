begin;

alter table public.employee_employment_profiles enable row level security;
alter table public.employee_skills enable row level security;
alter table public.employee_training_records enable row level security;
alter table public.employee_goals enable row level security;
alter table public.employee_conversations enable row level security;
alter table public.employee_hr_tasks enable row level security;
alter table public.employee_documents enable row level security;
alter table public.employee_hr_events enable row level security;

DO $$
declare
  table_name text;
begin
  foreach table_name in array array[
    'employee_employment_profiles',
    'employee_skills',
    'employee_training_records',
    'employee_goals',
    'employee_conversations',
    'employee_hr_tasks'
  ] loop
    execute format('drop policy if exists %I_select on public.%I', table_name, table_name);
    execute format('create policy %I_select on public.%I for select to authenticated using (private.can_access_employee_hr(organization_id, employee_id))', table_name, table_name);
    execute format('drop policy if exists %I_insert on public.%I', table_name, table_name);
    execute format('create policy %I_insert on public.%I for insert to authenticated with check (private.can_manage_employee_hr(organization_id, employee_id))', table_name, table_name);
    execute format('drop policy if exists %I_update on public.%I', table_name, table_name);
    execute format('create policy %I_update on public.%I for update to authenticated using (private.can_manage_employee_hr(organization_id, employee_id)) with check (private.can_manage_employee_hr(organization_id, employee_id))', table_name, table_name);
    execute format('drop policy if exists %I_delete on public.%I', table_name, table_name);
    execute format('create policy %I_delete on public.%I for delete to authenticated using (private.can_manage_employee_hr(organization_id, employee_id))', table_name, table_name);
  end loop;
end;
$$;

-- HR events are append-only and can only be created by the security-definer audit trigger.
drop policy if exists employee_hr_events_select on public.employee_hr_events;
create policy employee_hr_events_select on public.employee_hr_events
for select to authenticated
using (private.can_access_employee_hr(organization_id, employee_id));
drop policy if exists employee_hr_events_insert on public.employee_hr_events;
drop policy if exists employee_hr_events_update on public.employee_hr_events;
drop policy if exists employee_hr_events_delete on public.employee_hr_events;

create or replace function private.can_view_employee_document(
  p_organization_id uuid,
  p_employee_id uuid,
  p_visibility text
)
returns boolean
language sql
stable
security definer
set search_path = 'pg_catalog', 'public'
as $$
  select case
    when p_visibility = 'Vain HR' then private.has_org_role(p_organization_id, array['admin']::text[])
    when p_visibility = 'HR ja esihenkilö' then private.can_manage_employee_hr(p_organization_id, p_employee_id)
    else private.can_access_employee_hr(p_organization_id, p_employee_id)
  end;
$$;
revoke all on function private.can_view_employee_document(uuid, uuid, text) from public, anon, authenticated;
grant execute on function private.can_view_employee_document(uuid, uuid, text) to authenticated;

drop policy if exists employee_documents_select on public.employee_documents;
create policy employee_documents_select on public.employee_documents
for select to authenticated
using (private.can_view_employee_document(organization_id, employee_id, visibility));
drop policy if exists employee_documents_insert on public.employee_documents;
create policy employee_documents_insert on public.employee_documents
for insert to authenticated
with check (
  private.can_manage_employee_hr(organization_id, employee_id)
  and (visibility <> 'Vain HR' or private.has_org_role(organization_id, array['admin']::text[]))
);
drop policy if exists employee_documents_update on public.employee_documents;
create policy employee_documents_update on public.employee_documents
for update to authenticated
using (private.can_manage_employee_hr(organization_id, employee_id))
with check (
  private.can_manage_employee_hr(organization_id, employee_id)
  and (visibility <> 'Vain HR' or private.has_org_role(organization_id, array['admin']::text[]))
);
drop policy if exists employee_documents_delete on public.employee_documents;
create policy employee_documents_delete on public.employee_documents
for delete to authenticated
using (private.can_manage_employee_hr(organization_id, employee_id));

grant select, insert, update, delete on public.employee_employment_profiles to authenticated;
grant select, insert, update, delete on public.employee_skills to authenticated;
grant select, insert, update, delete on public.employee_training_records to authenticated;
grant select, insert, update, delete on public.employee_goals to authenticated;
grant select, insert, update, delete on public.employee_conversations to authenticated;
grant select, insert, update, delete on public.employee_hr_tasks to authenticated;
grant select, insert, update, delete on public.employee_documents to authenticated;
grant select on public.employee_hr_events to authenticated;
revoke insert, update, delete on public.employee_hr_events from authenticated;

insert into storage.buckets(id, name, public, file_size_limit, allowed_mime_types)
values (
  'employee-hr-documents',
  'employee-hr-documents',
  false,
  15728640,
  array['application/pdf','image/jpeg','image/png','image/webp','application/vnd.openxmlformats-officedocument.wordprocessingml.document','application/msword']::text[]
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

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
begin
  target_org := split_part(p_name, '/', 1)::uuid;
  target_employee := split_part(p_name, '/', 2)::uuid;
  if p_write then
    return private.can_manage_employee_hr(target_org, target_employee);
  end if;
  return exists (
    select 1
    from public.employee_documents d
    where d.organization_id = target_org
      and d.employee_id = target_employee
      and d.storage_path = p_name
      and private.can_view_employee_document(d.organization_id, d.employee_id, d.visibility)
  );
exception when others then
  return false;
end;
$$;
revoke all on function private.can_access_hr_storage_object(text, boolean) from public, anon, authenticated;
grant execute on function private.can_access_hr_storage_object(text, boolean) to authenticated;

drop policy if exists employee_hr_documents_select on storage.objects;
create policy employee_hr_documents_select on storage.objects
for select to authenticated
using (
  bucket_id = 'employee-hr-documents'
  and private.can_access_hr_storage_object(name, false)
);
drop policy if exists employee_hr_documents_insert on storage.objects;
create policy employee_hr_documents_insert on storage.objects
for insert to authenticated
with check (
  bucket_id = 'employee-hr-documents'
  and private.can_access_hr_storage_object(name, true)
);
drop policy if exists employee_hr_documents_update on storage.objects;
create policy employee_hr_documents_update on storage.objects
for update to authenticated
using (
  bucket_id = 'employee-hr-documents'
  and private.can_access_hr_storage_object(name, true)
)
with check (
  bucket_id = 'employee-hr-documents'
  and private.can_access_hr_storage_object(name, true)
);
drop policy if exists employee_hr_documents_delete on storage.objects;
create policy employee_hr_documents_delete on storage.objects
for delete to authenticated
using (
  bucket_id = 'employee-hr-documents'
  and private.can_access_hr_storage_object(name, true)
);

commit;
