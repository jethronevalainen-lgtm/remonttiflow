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
  and (storage.foldername(object_path))[1] = organization_id::text
  and exists (
    select 1
    from storage.objects object
    where object.bucket_id = 'inspection-files'
      and object.name = object_path
      and object.owner_id = auth.uid()::text
      and (storage.foldername(object.name))[1] = organization_id::text
  )
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
      select 1
      from public.inspection_attachments attachment
      left join public.inspection_findings finding on finding.id = attachment.finding_id
      left join public.inspections inspection on inspection.id = attachment.inspection_id
      where attachment.object_path = name
        and attachment.organization_id::text = (storage.foldername(name))[1]
        and (
          attachment.uploaded_by = auth.uid()
          or (
            finding.id is not null
            and finding.organization_id = attachment.organization_id
            and finding.assignee_user_id = auth.uid()
          )
          or (
            inspection.id is not null
            and inspection.organization_id = attachment.organization_id
            and private.can_access_project(inspection.project_id, inspection.organization_id, auth.uid())
          )
        )
    )
  )
);
