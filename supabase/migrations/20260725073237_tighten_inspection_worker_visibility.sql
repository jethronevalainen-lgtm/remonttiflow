drop policy if exists "project_buildings_select_members" on public.project_buildings;
create policy "project_buildings_select_authorized"
on public.project_buildings for select to authenticated
using (
  private.has_org_role(organization_id, array['admin','supervisor'])
  or private.can_access_project(project_id, organization_id, auth.uid())
  or exists (
    select 1 from public.inspection_findings finding
    where finding.project_id = project_id
      and finding.organization_id = organization_id
      and finding.assignee_user_id = auth.uid()
  )
);

drop policy if exists "project_stairwells_select_members" on public.project_stairwells;
create policy "project_stairwells_select_authorized"
on public.project_stairwells for select to authenticated
using (
  private.has_org_role(organization_id, array['admin','supervisor'])
  or private.can_access_project(project_id, organization_id, auth.uid())
  or exists (
    select 1 from public.inspection_findings finding
    where finding.project_id = project_id
      and finding.organization_id = organization_id
      and finding.assignee_user_id = auth.uid()
  )
);

drop policy if exists "project_units_select_members" on public.project_units;
create policy "project_units_select_authorized"
on public.project_units for select to authenticated
using (
  private.has_org_role(organization_id, array['admin','supervisor'])
  or private.can_access_project(project_id, organization_id, auth.uid())
  or exists (
    select 1 from public.inspection_findings finding
    where finding.unit_id = id
      and finding.organization_id = organization_id
      and finding.assignee_user_id = auth.uid()
  )
);

drop policy if exists "inspection_attachments_insert_members" on public.inspection_attachments;
create policy "inspection_attachments_insert_authorized"
on public.inspection_attachments for insert to authenticated
with check (
  uploaded_by = auth.uid()
  and (
    private.has_org_role(organization_id, array['admin','supervisor'])
    or (
      finding_id is not null
      and exists (
        select 1 from public.inspection_findings finding
        where finding.id = finding_id
          and finding.organization_id = organization_id
          and finding.assignee_user_id = auth.uid()
      )
    )
  )
);

drop policy if exists "inspection_files_select_members" on storage.objects;
create policy "inspection_files_select_authorized"
on storage.objects for select to authenticated
using (
  bucket_id = 'inspection-files'
  and (
    owner_id = auth.uid()::text
    or private.has_org_role((storage.foldername(name))[1]::uuid, array['admin','supervisor'])
    or exists (
      select 1 from public.inspection_attachments attachment
      where attachment.object_path = name
    )
  )
);
