alter table public.safety_briefings enable row level security;
alter table public.safety_briefing_versions enable row level security;
alter table public.safety_briefing_acknowledgements enable row level security;
alter table public.project_safety_profiles enable row level security;
alter table public.safety_attachments enable row level security;

create policy safety_briefings_select on public.safety_briefings
for select to authenticated
using (
  private.has_org_role(organization_id, array['admin','supervisor','project_coordinator'])
  or (
    status = 'published'
    and valid_from <= current_date
    and (valid_until is null or valid_until >= current_date)
    and exists (
      select 1 from public.organization_members om
      where om.organization_id = safety_briefings.organization_id
        and om.user_id = auth.uid()
        and om.role = any(safety_briefings.audience_roles)
    )
    and (project_id is null or private.can_collaborate_on_project(project_id, organization_id, auth.uid()))
  )
);
create policy safety_briefings_insert on public.safety_briefings
for insert to authenticated
with check (
  private.has_org_role(organization_id, array['admin','supervisor','project_coordinator'])
  and created_by = auth.uid()
);
create policy safety_briefings_update on public.safety_briefings
for update to authenticated
using (private.has_org_role(organization_id, array['admin','supervisor','project_coordinator']))
with check (private.has_org_role(organization_id, array['admin','supervisor','project_coordinator']));
create policy safety_briefings_delete on public.safety_briefings
for delete to authenticated
using (private.has_org_role(organization_id, array['admin']));

create policy safety_briefing_versions_select on public.safety_briefing_versions
for select to authenticated
using (
  private.has_org_role(organization_id, array['admin','supervisor','project_coordinator'])
  or exists (
    select 1 from public.safety_briefings b
    where b.id = safety_briefing_versions.briefing_id
  )
);

create policy safety_ack_select on public.safety_briefing_acknowledgements
for select to authenticated
using (
  user_id = auth.uid()
  or private.has_org_role(organization_id, array['admin','supervisor','project_coordinator'])
);
create policy safety_ack_insert on public.safety_briefing_acknowledgements
for insert to authenticated
with check (user_id = auth.uid() and private.is_org_member(organization_id));
create policy safety_ack_update on public.safety_briefing_acknowledgements
for update to authenticated
using (user_id = auth.uid())
with check (user_id = auth.uid());

create policy project_safety_profiles_select on public.project_safety_profiles
for select to authenticated
using (
  private.has_org_role(organization_id, array['admin','supervisor','project_coordinator'])
  or private.can_collaborate_on_project(project_id, organization_id, auth.uid())
);
create policy project_safety_profiles_insert on public.project_safety_profiles
for insert to authenticated
with check (private.has_org_role(organization_id, array['admin','supervisor','project_coordinator']));
create policy project_safety_profiles_update on public.project_safety_profiles
for update to authenticated
using (private.has_org_role(organization_id, array['admin','supervisor','project_coordinator']))
with check (private.has_org_role(organization_id, array['admin','supervisor','project_coordinator']));
create policy project_safety_profiles_delete on public.project_safety_profiles
for delete to authenticated
using (private.has_org_role(organization_id, array['admin']));

create policy safety_attachments_select on public.safety_attachments
for select to authenticated
using (
  private.has_org_role(organization_id, array['admin','supervisor','project_coordinator'])
  or (safety_item_id is not null and exists (select 1 from public.safety_items si where si.id = safety_item_id))
  or (briefing_id is not null and exists (select 1 from public.safety_briefings sb where sb.id = briefing_id))
);
create policy safety_attachments_insert on public.safety_attachments
for insert to authenticated
with check (
  created_by = auth.uid()
  and private.is_org_member(organization_id)
  and (
    (safety_item_id is not null and exists (select 1 from public.safety_items si where si.id = safety_item_id))
    or (briefing_id is not null and private.has_org_role(organization_id, array['admin','supervisor','project_coordinator']) and exists (select 1 from public.safety_briefings sb where sb.id = briefing_id))
  )
);
create policy safety_attachments_delete on public.safety_attachments
for delete to authenticated
using (
  created_by = auth.uid()
  or private.has_org_role(organization_id, array['admin','supervisor','project_coordinator'])
);

create policy safety_files_select on storage.objects
for select to authenticated
using (
  bucket_id = 'safety-files'
  and (
    (split_part(name, '/', 2) = 'items' and exists (
      select 1 from public.safety_items si
      where si.id = private.try_uuid(split_part(name, '/', 3))
        and si.organization_id = private.try_uuid(split_part(name, '/', 1))
    ))
    or (split_part(name, '/', 2) = 'briefings' and exists (
      select 1 from public.safety_briefings sb
      where sb.id = private.try_uuid(split_part(name, '/', 3))
        and sb.organization_id = private.try_uuid(split_part(name, '/', 1))
    ))
  )
);
create policy safety_files_insert on storage.objects
for insert to authenticated
with check (
  bucket_id = 'safety-files'
  and (
    (split_part(name, '/', 2) = 'items' and exists (
      select 1 from public.safety_items si
      where si.id = private.try_uuid(split_part(name, '/', 3))
        and si.organization_id = private.try_uuid(split_part(name, '/', 1))
    ))
    or (split_part(name, '/', 2) = 'briefings' and private.has_org_role(private.try_uuid(split_part(name, '/', 1)), array['admin','supervisor','project_coordinator']) and exists (
      select 1 from public.safety_briefings sb
      where sb.id = private.try_uuid(split_part(name, '/', 3))
        and sb.organization_id = private.try_uuid(split_part(name, '/', 1))
    ))
  )
);

revoke all on public.safety_briefings from anon;
revoke all on public.safety_briefing_versions from anon;
revoke all on public.safety_briefing_acknowledgements from anon;
revoke all on public.project_safety_profiles from anon;
revoke all on public.safety_attachments from anon;
grant select, insert, update, delete on public.safety_briefings to authenticated;
grant select on public.safety_briefing_versions to authenticated;
grant select, insert, update on public.safety_briefing_acknowledgements to authenticated;
grant select, insert, update, delete on public.project_safety_profiles to authenticated;
grant select, insert, delete on public.safety_attachments to authenticated;
