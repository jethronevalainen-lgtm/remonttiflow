begin;

-- Tenant row-level security.
alter table public.site_diary_settings enable row level security;
alter table public.site_diary_weather_observations enable row level security;
alter table public.site_diary_workforce_rows enable row level security;
alter table public.site_diary_work_items enable row level security;
alter table public.site_diary_events enable row level security;
alter table public.site_diary_attachments enable row level security;
alter table public.site_diary_signatures enable row level security;

-- Settings are organization management data.
drop policy if exists site_diary_settings_select on public.site_diary_settings;
create policy site_diary_settings_select on public.site_diary_settings
  for select using (private.is_internal_org_member(organization_id, (select auth.uid())));
drop policy if exists site_diary_settings_insert on public.site_diary_settings;
create policy site_diary_settings_insert on public.site_diary_settings
  for insert with check (private.has_org_role(organization_id, array['admin', 'supervisor']));
drop policy if exists site_diary_settings_update on public.site_diary_settings;
create policy site_diary_settings_update on public.site_diary_settings
  for update using (private.has_org_role(organization_id, array['admin', 'supervisor']))
  with check (private.has_org_role(organization_id, array['admin', 'supervisor']));

-- Child tables use the diary as their authorization boundary. Workers may add
-- or maintain their own contributions while management may curate the whole diary.
do $$
declare
  table_name text;
  policy_name text;
begin
  foreach table_name in array array[
    'site_diary_weather_observations',
    'site_diary_workforce_rows',
    'site_diary_work_items',
    'site_diary_events',
    'site_diary_attachments'
  ]
  loop
    policy_name := table_name || '_select';
    execute format('drop policy if exists %I on public.%I', policy_name, table_name);
    execute format(
      'create policy %I on public.%I for select using (private.can_read_site_diary(diary_id, (select auth.uid())))',
      policy_name,
      table_name
    );

    policy_name := table_name || '_insert';
    execute format('drop policy if exists %I on public.%I', policy_name, table_name);
    execute format(
      'create policy %I on public.%I for insert with check (private.can_edit_site_diary(diary_id, (select auth.uid())) and created_by = (select auth.uid()))',
      policy_name,
      table_name
    );

    policy_name := table_name || '_update';
    execute format('drop policy if exists %I on public.%I', policy_name, table_name);
    execute format(
      'create policy %I on public.%I for update using (private.can_edit_site_diary(diary_id, (select auth.uid())) and (created_by = (select auth.uid()) or private.can_manage_site_diary(diary_id, (select auth.uid())))) with check (private.can_edit_site_diary(diary_id, (select auth.uid())) and (created_by = (select auth.uid()) or private.can_manage_site_diary(diary_id, (select auth.uid()))))',
      policy_name,
      table_name
    );

    policy_name := table_name || '_delete';
    execute format('drop policy if exists %I on public.%I', policy_name, table_name);
    execute format(
      'create policy %I on public.%I for delete using (private.can_edit_site_diary(diary_id, (select auth.uid())) and (created_by = (select auth.uid()) or private.can_manage_site_diary(diary_id, (select auth.uid()))))',
      policy_name,
      table_name
    );
  end loop;
end;
$$;

-- Signatures are controlled separately: reading follows diary visibility, but
-- internal signing and editing require an admin or supervisor.
drop policy if exists site_diary_signatures_select on public.site_diary_signatures;
create policy site_diary_signatures_select on public.site_diary_signatures
  for select using (private.can_read_site_diary(diary_id, (select auth.uid())));
drop policy if exists site_diary_signatures_insert on public.site_diary_signatures;
create policy site_diary_signatures_insert on public.site_diary_signatures
  for insert with check (private.can_sign_site_diary(diary_id, (select auth.uid())));
drop policy if exists site_diary_signatures_update on public.site_diary_signatures;
create policy site_diary_signatures_update on public.site_diary_signatures
  for update using (private.can_sign_site_diary(diary_id, (select auth.uid())))
  with check (private.can_sign_site_diary(diary_id, (select auth.uid())));
drop policy if exists site_diary_signatures_delete on public.site_diary_signatures;
create policy site_diary_signatures_delete on public.site_diary_signatures
  for delete using (private.can_sign_site_diary(diary_id, (select auth.uid())));

create or replace function private.is_locked_site_diary_storage_object(p_storage_path text)
returns boolean
language sql
stable
security definer
set search_path = public, private, pg_temp
as $$
  select exists (
    select 1
    from public.site_diary_attachments attachment
    join public.diary_entries diary on diary.id = attachment.diary_id
    where attachment.storage_path = p_storage_path
      and diary.locked_at is not null
  );
$$;

-- The shared project-documents bucket may also serve diary images and files.
-- A file referenced by any locked diary version is immutable even when the
-- same object is reused as the starting point of a correction version.
drop policy if exists project_documents_storage_select on storage.objects;
create policy project_documents_storage_select on storage.objects
  for select using (
    bucket_id = 'project-documents'
    and (
      exists (select 1 from public.project_documents document where document.storage_path = objects.name)
      or exists (select 1 from public.record_attachments attachment where attachment.storage_path = objects.name)
      or exists (
        select 1
        from public.site_diary_attachments attachment
        where attachment.storage_path = objects.name
          and private.can_read_site_diary(attachment.diary_id, (select auth.uid()))
      )
    )
  );

drop policy if exists project_documents_storage_delete on storage.objects;
create policy project_documents_storage_delete on storage.objects
  for delete using (
    bucket_id = 'project-documents'
    and not private.is_locked_site_diary_storage_object(objects.name)
    and (
      owner_id = ((select auth.uid()))::text
      or private.has_org_role(private.try_uuid((storage.foldername(name))[1]), array['admin', 'supervisor'])
    )
  );

drop policy if exists project_documents_storage_update on storage.objects;
create policy project_documents_storage_update on storage.objects
  for update using (
    bucket_id = 'project-documents'
    and not private.is_locked_site_diary_storage_object(objects.name)
    and (
      owner_id = ((select auth.uid()))::text
      or private.has_org_role(private.try_uuid((storage.foldername(name))[1]), array['admin', 'supervisor'])
    )
  )
  with check (
    bucket_id = 'project-documents'
    and not private.is_locked_site_diary_storage_object(objects.name)
    and (
      owner_id = ((select auth.uid()))::text
      or private.has_org_role(private.try_uuid((storage.foldername(name))[1]), array['admin', 'supervisor'])
    )
  );

-- Replace the legacy diary policies with project-aware V2 policies.
drop policy if exists diary_entries_select on public.diary_entries;
create policy diary_entries_select on public.diary_entries
  for select using (
    private.has_org_role(organization_id, array['admin', 'supervisor', 'project_coordinator'])
    or (
      project_id is not null
      and private.is_internal_org_member(organization_id, (select auth.uid()))
      and private.can_access_project(project_id, organization_id, (select auth.uid()))
    )
    or (
      visible_to_customer
      and project_id is not null
      and private.customer_user_can_access_project(project_id, organization_id, (select auth.uid()))
    )
  );

drop policy if exists diary_entries_insert on public.diary_entries;
create policy diary_entries_insert on public.diary_entries
  for insert with check (
    project_id is not null
    and private.can_access_project(project_id, organization_id, (select auth.uid()))
    and private.has_org_role(organization_id, array['admin', 'supervisor', 'project_coordinator'])
  );

drop policy if exists diary_entries_update on public.diary_entries;
create policy diary_entries_update on public.diary_entries
  for update using (
    project_id is not null
    and private.can_access_project(project_id, organization_id, (select auth.uid()))
    and private.has_org_role(organization_id, array['admin', 'supervisor', 'project_coordinator'])
  )
  with check (
    project_id is not null
    and private.can_access_project(project_id, organization_id, (select auth.uid()))
    and private.has_org_role(organization_id, array['admin', 'supervisor', 'project_coordinator'])
  );

drop policy if exists diary_entries_delete on public.diary_entries;
create policy diary_entries_delete on public.diary_entries
  for delete using (
    locked_at is null
    and status = 'Luonnos'
    and private.has_org_role(organization_id, array['admin', 'supervisor'])
  );

commit;
