begin;

-- Avoid per-row auth.uid() evaluation and keep HR self-service rows tied to
-- the same organization as the employee record. The previous expressions
-- compared e.organization_id to itself, which was a tautology.
drop policy if exists employee_absences_select on public.employee_absences;
create policy employee_absences_select on public.employee_absences
for select to authenticated
using (
  private.has_org_role(organization_id, array['admin', 'supervisor']::text[])
  or exists (
    select 1
    from public.employees e
    where e.id = employee_absences.employee_id
      and e.organization_id = employee_absences.organization_id
      and e.user_id = (select auth.uid())
  )
);

drop policy if exists employee_certifications_select on public.employee_certifications;
create policy employee_certifications_select on public.employee_certifications
for select to authenticated
using (
  private.has_org_role(organization_id, array['admin', 'supervisor']::text[])
  or exists (
    select 1
    from public.employees e
    where e.id = employee_certifications.employee_id
      and e.organization_id = employee_certifications.organization_id
      and e.user_id = (select auth.uid())
  )
);

drop policy if exists project_documents_update on public.project_documents;
create policy project_documents_update on public.project_documents
for update to authenticated
using (
  created_by = (select auth.uid())
  or private.has_org_role(organization_id, array['admin', 'supervisor']::text[])
)
with check (
  created_by = (select auth.uid())
  or private.has_org_role(organization_id, array['admin', 'supervisor']::text[])
);

drop policy if exists project_documents_delete on public.project_documents;
create policy project_documents_delete on public.project_documents
for delete to authenticated
using (
  created_by = (select auth.uid())
  or private.has_org_role(organization_id, array['admin', 'supervisor']::text[])
);

drop policy if exists saved_reports_select on public.saved_reports;
create policy saved_reports_select on public.saved_reports
for select to authenticated
using (
  created_by = (select auth.uid())
  or private.has_org_role(organization_id, array['admin', 'supervisor']::text[])
);

drop policy if exists saved_reports_insert on public.saved_reports;
create policy saved_reports_insert on public.saved_reports
for insert to authenticated
with check (
  created_by = (select auth.uid())
  and private.is_org_member(organization_id)
);

drop policy if exists saved_reports_update on public.saved_reports;
create policy saved_reports_update on public.saved_reports
for update to authenticated
using (created_by = (select auth.uid()))
with check (created_by = (select auth.uid()));

drop policy if exists saved_reports_delete on public.saved_reports;
create policy saved_reports_delete on public.saved_reports
for delete to authenticated
using (created_by = (select auth.uid()));

drop policy if exists time_entry_period_locks_insert on public.time_entry_period_locks;
create policy time_entry_period_locks_insert on public.time_entry_period_locks
for insert to authenticated
with check (
  private.has_org_role(organization_id, array['admin', 'supervisor']::text[])
  and locked_by = (select auth.uid())
);

-- Cover foreign keys used by the application-wide operational workflows.
-- These indexes speed joins and prevent full child-table scans when referenced
-- records are updated or deleted.
create index if not exists billing_items_approved_by_fk_idx on public.billing_items (approved_by);
create index if not exists billing_items_created_by_fk_idx on public.billing_items (created_by);
create index if not exists billing_items_customer_id_fk_idx on public.billing_items (customer_id);
create index if not exists billing_items_project_id_fk_idx on public.billing_items (project_id);
create index if not exists billing_items_work_order_id_fk_idx on public.billing_items (work_order_id);

create index if not exists crm_leads_assignee_user_id_fk_idx on public.crm_leads (assignee_user_id);
create index if not exists crm_leads_converted_project_id_fk_idx on public.crm_leads (converted_project_id);
create index if not exists crm_leads_customer_id_fk_idx on public.crm_leads (customer_id);

create index if not exists diary_entries_approved_by_fk_idx on public.diary_entries (approved_by);
create index if not exists diary_entries_locked_by_fk_idx on public.diary_entries (locked_by);
create index if not exists driving_log_entries_equipment_id_fk_idx on public.driving_log_entries (equipment_id);
create index if not exists driving_log_entries_user_id_fk_idx on public.driving_log_entries (user_id);

create index if not exists employee_absences_approved_by_fk_idx on public.employee_absences (approved_by);
create index if not exists employee_absences_created_by_fk_idx on public.employee_absences (created_by);
create index if not exists employee_absences_employee_id_fk_idx on public.employee_absences (employee_id);
create index if not exists employee_certifications_created_by_fk_idx on public.employee_certifications (created_by);
create index if not exists employee_certifications_employee_id_fk_idx on public.employee_certifications (employee_id);

create index if not exists equipment_current_project_id_fk_idx on public.equipment (current_project_id);
create index if not exists equipment_responsible_user_id_fk_idx on public.equipment (responsible_user_id);
create index if not exists equipment_reservations_created_by_fk_idx on public.equipment_reservations (created_by);
create index if not exists equipment_reservations_equipment_id_fk_idx on public.equipment_reservations (equipment_id);
create index if not exists equipment_reservations_project_id_fk_idx on public.equipment_reservations (project_id);
create index if not exists equipment_reservations_reserved_for_user_id_fk_idx on public.equipment_reservations (reserved_for_user_id);

create index if not exists inspection_attachments_organization_id_fk_idx on public.inspection_attachments (organization_id);
create index if not exists inspection_attachments_uploaded_by_fk_idx on public.inspection_attachments (uploaded_by);
create index if not exists inspection_audit_events_user_id_fk_idx on public.inspection_audit_events (user_id);
create index if not exists inspection_findings_created_by_fk_idx on public.inspection_findings (created_by);
create index if not exists inspection_findings_reported_corrected_by_fk_idx on public.inspection_findings (reported_corrected_by);
create index if not exists inspection_findings_verified_by_fk_idx on public.inspection_findings (verified_by);
create index if not exists inspection_reports_generated_by_fk_idx on public.inspection_reports (generated_by);
create index if not exists inspection_reports_organization_id_fk_idx on public.inspection_reports (organization_id);
create index if not exists inspection_results_organization_id_fk_idx on public.inspection_results (organization_id);
create index if not exists inspection_results_updated_by_fk_idx on public.inspection_results (updated_by);
create index if not exists inspection_signatures_organization_id_fk_idx on public.inspection_signatures (organization_id);
create index if not exists inspection_signatures_signed_by_fk_idx on public.inspection_signatures (signed_by);
create index if not exists inspection_template_versions_published_by_fk_idx on public.inspection_template_versions (published_by);
create index if not exists inspection_templates_created_by_fk_idx on public.inspection_templates (created_by);
create index if not exists inspections_approved_by_fk_idx on public.inspections (approved_by);
create index if not exists inspections_created_by_fk_idx on public.inspections (created_by);
create index if not exists inspections_voided_by_fk_idx on public.inspections (voided_by);

create index if not exists operational_entries_approved_by_fk_idx on public.operational_entries (approved_by);
create index if not exists operational_entries_equipment_id_fk_idx on public.operational_entries (equipment_id);
create index if not exists operational_entries_project_id_fk_idx on public.operational_entries (project_id);
create index if not exists operational_entries_user_id_fk_idx on public.operational_entries (user_id);
create index if not exists operational_entries_work_order_id_fk_idx on public.operational_entries (work_order_id);

create index if not exists project_documents_created_by_fk_idx on public.project_documents (created_by);
create index if not exists project_message_attachments_created_by_fk_idx on public.project_message_attachments (created_by);
create index if not exists project_message_attachments_organization_id_fk_idx on public.project_message_attachments (organization_id);
create index if not exists project_message_attachments_project_id_fk_idx on public.project_message_attachments (project_id);
create index if not exists project_messages_author_user_id_fk_idx on public.project_messages (author_user_id);
create index if not exists project_messages_project_org_fk_idx on public.project_messages (project_id, organization_id);
create index if not exists project_messages_reply_to_id_fk_idx on public.project_messages (reply_to_id);
create index if not exists project_units_created_by_fk_idx on public.project_units (created_by);
create index if not exists project_units_responsible_supervisor_id_fk_idx on public.project_units (responsible_supervisor_id);
create index if not exists projects_project_manager_id_fk_idx on public.projects (project_manager_id);
create index if not exists projects_responsible_supervisor_id_fk_idx on public.projects (responsible_supervisor_id);

create index if not exists record_attachments_created_by_fk_idx on public.record_attachments (created_by);
create index if not exists record_attachments_project_id_fk_idx on public.record_attachments (project_id);
create index if not exists safety_items_assignee_user_id_fk_idx on public.safety_items (assignee_user_id);
create index if not exists safety_items_verified_by_fk_idx on public.safety_items (verified_by);

create index if not exists time_entries_approved_by_fk_idx on public.time_entries (approved_by);
create index if not exists time_entries_user_id_fk_idx on public.time_entries (user_id);
create index if not exists time_entry_period_locks_locked_by_fk_idx on public.time_entry_period_locks (locked_by);
create index if not exists travel_expenses_approved_by_fk_idx on public.travel_expenses (approved_by);
create index if not exists travel_expenses_employee_id_fk_idx on public.travel_expenses (employee_id);
create index if not exists travel_expenses_project_id_fk_idx on public.travel_expenses (project_id);
create index if not exists travel_expenses_user_id_fk_idx on public.travel_expenses (user_id);

create index if not exists work_orders_completion_request_time_entry_id_fk_idx on public.work_orders (completion_request_time_entry_id);
create index if not exists work_orders_completion_requested_by_fk_idx on public.work_orders (completion_requested_by);
create index if not exists work_orders_completion_reviewed_by_fk_idx on public.work_orders (completion_reviewed_by);

commit;
