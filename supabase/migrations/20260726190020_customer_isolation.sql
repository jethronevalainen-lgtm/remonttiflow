begin;

-- Customer isolation: replace broad "any organization member" policies with
-- explicit internal, management, own-record or assigned-project rules.
drop policy if exists organization_members_select on public.organization_members;
create policy organization_members_select on public.organization_members for select to authenticated
using (
  user_id = (select auth.uid())
  or private.is_management_user(organization_id, (select auth.uid()))
);

drop policy if exists profiles_select on public.profiles;
create policy profiles_select on public.profiles for select to authenticated
using (
  id = (select auth.uid())
  or exists (
    select 1
    from public.organization_members self_member
    join public.organization_members peer_member
      on peer_member.organization_id = self_member.organization_id
    where self_member.user_id = (select auth.uid())
      and self_member.role in ('admin', 'supervisor', 'worker')
      and peer_member.user_id = profiles.id
      and peer_member.role in ('admin', 'supervisor', 'worker')
  )
);

drop policy if exists organization_settings_select on public.organization_settings;
create policy organization_settings_select on public.organization_settings for select to authenticated
using (private.is_internal_org_member(organization_id, (select auth.uid())));

-- Commercial and customer master data are management-only. Customer users use
-- narrow portal RPCs instead of direct table access.
drop policy if exists customers_select on public.customers;
create policy customers_select on public.customers for select to authenticated
using (private.is_management_user(organization_id, (select auth.uid())));
drop policy if exists customers_insert on public.customers;
create policy customers_insert on public.customers for insert to authenticated
with check (private.is_management_user(organization_id, (select auth.uid())));

drop policy if exists customer_contacts_select on public.customer_contacts;
create policy customer_contacts_select on public.customer_contacts for select to authenticated
using (private.is_management_user(organization_id, (select auth.uid())));

drop policy if exists crm_leads_select on public.crm_leads;
create policy crm_leads_select on public.crm_leads for select to authenticated
using (private.is_management_user(organization_id, (select auth.uid())));
drop policy if exists crm_leads_insert on public.crm_leads;
create policy crm_leads_insert on public.crm_leads for insert to authenticated
with check (private.is_management_user(organization_id, (select auth.uid())));

drop policy if exists crm_activities_select on public.crm_activities;
create policy crm_activities_select on public.crm_activities for select to authenticated
using (private.is_management_user(organization_id, (select auth.uid())));

-- Internal operational tables are not visible to customer accounts.
drop policy if exists announcements_select on public.announcements;
create policy announcements_select on public.announcements for select to authenticated
using (private.is_internal_org_member(organization_id, (select auth.uid())));

drop policy if exists diary_entries_select on public.diary_entries;
create policy diary_entries_select on public.diary_entries for select to authenticated
using (private.is_internal_org_member(organization_id, (select auth.uid())));
drop policy if exists diary_entries_insert on public.diary_entries;
create policy diary_entries_insert on public.diary_entries for insert to authenticated
with check (private.is_internal_org_member(organization_id, (select auth.uid())));

drop policy if exists waste_entries_select on public.waste_entries;
create policy waste_entries_select on public.waste_entries for select to authenticated
using (private.is_internal_org_member(organization_id, (select auth.uid())));
drop policy if exists waste_entries_insert on public.waste_entries;
create policy waste_entries_insert on public.waste_entries for insert to authenticated
with check (private.is_internal_org_member(organization_id, (select auth.uid())));

drop policy if exists equipment_select on public.equipment;
create policy equipment_select on public.equipment for select to authenticated
using (private.is_internal_org_member(organization_id, (select auth.uid())));
drop policy if exists equipment_insert on public.equipment;
create policy equipment_insert on public.equipment for insert to authenticated
with check (private.is_internal_org_member(organization_id, (select auth.uid())));

drop policy if exists equipment_maintenance_select on public.equipment_maintenance;
create policy equipment_maintenance_select on public.equipment_maintenance for select to authenticated
using (private.is_internal_org_member(organization_id, (select auth.uid())));
drop policy if exists equipment_reservations_select on public.equipment_reservations;
create policy equipment_reservations_select on public.equipment_reservations for select to authenticated
using (private.is_internal_org_member(organization_id, (select auth.uid())));

drop policy if exists form_templates_select on public.form_templates;
create policy form_templates_select on public.form_templates for select to authenticated
using (private.is_internal_org_member(organization_id, (select auth.uid())));
drop policy if exists time_entry_period_locks_select on public.time_entry_period_locks;
create policy time_entry_period_locks_select on public.time_entry_period_locks for select to authenticated
using (private.is_internal_org_member(organization_id, (select auth.uid())));

-- Prevent customer accounts from creating internal payroll/expense/site records
drop policy if exists time_entries_insert on public.time_entries;
create policy time_entries_insert on public.time_entries for insert to authenticated
with check (
  private.is_management_user(organization_id, (select auth.uid()))
  or (
    private.has_org_role(organization_id, array['worker'])
    and created_by = (select auth.uid())
    and user_id = (select auth.uid())
    and status = 'Odottaa'
  )
);

drop policy if exists travel_expenses_insert on public.travel_expenses;
create policy travel_expenses_insert on public.travel_expenses for insert to authenticated
with check (
  private.is_management_user(organization_id, (select auth.uid()))
  or (
    private.has_org_role(organization_id, array['worker'])
    and created_by = (select auth.uid())
    and user_id = (select auth.uid())
    and status = 'Odottaa'
  )
);

drop policy if exists driving_log_entries_insert on public.driving_log_entries;
create policy driving_log_entries_insert on public.driving_log_entries for insert to authenticated
with check (
  private.is_management_user(organization_id, (select auth.uid()))
  or (
    private.has_org_role(organization_id, array['worker'])
    and created_by = (select auth.uid())
    and user_id = (select auth.uid())
  )
);

drop policy if exists work_site_check_ins_insert on public.work_site_check_ins;
create policy work_site_check_ins_insert on public.work_site_check_ins for insert to authenticated
with check (
  user_id = (select auth.uid())
  and private.is_internal_org_member(organization_id, (select auth.uid()))
  and (
    project_id is null
    or private.can_access_project(project_id, organization_id, (select auth.uid()))
  )
);

drop policy if exists site_receipts_insert on public.site_receipts;
create policy site_receipts_insert on public.site_receipts for insert to authenticated
with check (
  private.is_internal_org_member(organization_id, (select auth.uid()))
  and created_by = (select auth.uid())
  and status = 'draft'
);

drop policy if exists site_receipt_attachments_insert on public.site_receipt_attachments;
create policy site_receipt_attachments_insert on public.site_receipt_attachments for insert to authenticated
with check (
  private.is_internal_org_member(organization_id, (select auth.uid()))
  and created_by = (select auth.uid())
);

drop policy if exists form_submissions_insert on public.form_submissions;
create policy form_submissions_insert on public.form_submissions for insert to authenticated
with check (
  private.is_internal_org_member(organization_id, (select auth.uid()))
  and submitted_by = (select auth.uid())
  and status in ('Luonnos', 'Lähetetty')
);

-- Every signed-in role can create a safety observation. Visibility is limited
-- to management, the author, or users participating in the linked project.
drop policy if exists safety_items_select on public.safety_items;
create policy safety_items_select on public.safety_items for select to authenticated
using (
  private.is_management_user(organization_id, (select auth.uid()))
  or created_by = (select auth.uid())
  or (
    project_id is not null
    and private.can_collaborate_on_project(project_id, organization_id, (select auth.uid()))
  )
);

drop policy if exists safety_items_insert on public.safety_items;
create policy safety_items_insert on public.safety_items for insert to authenticated
with check (
  private.is_org_member(organization_id)
  and created_by = (select auth.uid())
  and (
    project_id is null
    or private.can_collaborate_on_project(project_id, organization_id, (select auth.uid()))
  )
  and status = 'Avoin'
);

-- Customer-visible project documents require both project access and an
-- explicit customer role in visible_to_roles.
drop policy if exists project_documents_select on public.project_documents;
create policy project_documents_select on public.project_documents for select to authenticated
using (
  archived_at is null
  and exists (
    select 1
    from public.organization_members om
    where om.organization_id = project_documents.organization_id
      and om.user_id = (select auth.uid())
      and project_documents.visible_to_roles && array[om.role]
      and (
        (om.role in ('admin', 'supervisor', 'worker') and (
          project_documents.project_id is null
          or private.can_access_project(project_documents.project_id, project_documents.organization_id, (select auth.uid()))
        ))
        or (
          om.role = 'customer'
          and project_documents.project_id is not null
          and private.is_customer_project_user(project_documents.project_id, project_documents.organization_id, (select auth.uid()))
        )
      )
  )
);

drop policy if exists project_documents_insert on public.project_documents;
create policy project_documents_insert on public.project_documents for insert to authenticated
with check (
  created_by = (select auth.uid())
  and private.is_internal_org_member(organization_id, (select auth.uid()))
  and (
    project_id is null
    or private.can_access_project(project_id, organization_id, (select auth.uid()))
  )
);

-- Storage writes remain internal. Reads are authorized through the metadata
-- table RLS above.
drop policy if exists project_documents_storage_insert on storage.objects;
create policy project_documents_storage_insert on storage.objects for insert to authenticated
with check (
  bucket_id = 'project-documents'
  and private.is_internal_org_member(private.try_uuid((storage.foldername(name))[1]), (select auth.uid()))
  and owner_id = (select auth.uid())::text
);

drop policy if exists site_receipt_files_select on storage.objects;
create policy site_receipt_files_select on storage.objects for select to authenticated
using (
  bucket_id = 'site-receipts'
  and private.is_internal_org_member(private.try_uuid((storage.foldername(name))[1]), (select auth.uid()))
);

drop policy if exists site_receipt_files_insert on storage.objects;
create policy site_receipt_files_insert on storage.objects for insert to authenticated
with check (
  bucket_id = 'site-receipts'
  and private.is_internal_org_member(private.try_uuid((storage.foldername(name))[1]), (select auth.uid()))
);

drop policy if exists inspection_files_insert_members on storage.objects;
create policy inspection_files_insert_members on storage.objects for insert to authenticated
with check (
  bucket_id = 'inspection-files'
  and private.is_internal_org_member(private.try_uuid((storage.foldername(name))[1]), (select auth.uid()))
  and owner_id = (select auth.uid())::text
);

-- Realtime delivery for project chat. Ignore duplicate publication membership.
do $$
begin
  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'project_messages'
  ) then
    alter publication supabase_realtime add table public.project_messages;
  end if;
end
$$;

commit;
