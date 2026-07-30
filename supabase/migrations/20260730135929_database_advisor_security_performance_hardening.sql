begin;

-- Remove policies whose target role was broader than the table grants and
-- recreate mutation policies explicitly for signed-in users only.
drop policy if exists project_coordinator_delete_access on public.waste_entries;
drop policy if exists project_coordinator_update_access on public.waste_entries;
drop policy if exists waste_entries_delete on public.waste_entries;
drop policy if exists waste_entries_update on public.waste_entries;

create policy waste_entries_update
on public.waste_entries
for update
to authenticated
using (private.has_org_role(organization_id, array['admin', 'supervisor', 'project_coordinator']::text[]))
with check (private.has_org_role(organization_id, array['admin', 'supervisor', 'project_coordinator']::text[]));

create policy waste_entries_delete
on public.waste_entries
for delete
to authenticated
using (private.has_org_role(organization_id, array['admin', 'supervisor', 'project_coordinator']::text[]));

-- Avoid overlapping permissive SELECT policies by splitting ALL into the
-- three write operations. The existing SELECT policy remains unchanged.
drop policy if exists project_work_phase_templates_write on public.project_work_phase_templates;
create policy project_work_phase_templates_insert
on public.project_work_phase_templates
for insert
to authenticated
with check (private.is_operational_manager(organization_id, (select auth.uid())));
create policy project_work_phase_templates_update
on public.project_work_phase_templates
for update
to authenticated
using (private.is_operational_manager(organization_id, (select auth.uid())))
with check (private.is_operational_manager(organization_id, (select auth.uid())));
create policy project_work_phase_templates_delete
on public.project_work_phase_templates
for delete
to authenticated
using (private.is_operational_manager(organization_id, (select auth.uid())));

drop policy if exists project_work_targets_write on public.project_work_targets;
create policy project_work_targets_insert
on public.project_work_targets
for insert
to authenticated
with check (private.is_operational_manager(organization_id, (select auth.uid())));
create policy project_work_targets_update
on public.project_work_targets
for update
to authenticated
using (private.is_operational_manager(organization_id, (select auth.uid())))
with check (private.is_operational_manager(organization_id, (select auth.uid())));
create policy project_work_targets_delete
on public.project_work_targets
for delete
to authenticated
using (private.is_operational_manager(organization_id, (select auth.uid())));

-- Cache auth.uid() once per statement instead of evaluating it for every row.
alter policy announcement_placements_select on public.announcement_placements
using (private.is_announcement_manager(organization_id, (select auth.uid())));

alter policy announcement_targets_select on public.announcement_targets
using (private.is_announcement_manager(organization_id, (select auth.uid())));

alter policy announcement_recipients_select on public.announcement_recipients
using (
  private.is_announcement_manager(organization_id, (select auth.uid()))
  or (
    user_id = (select auth.uid())
    and private.can_read_published_announcement(announcement_id, organization_id, (select auth.uid()))
  )
);

alter policy announcements_select on public.announcements
using (
  private.is_announcement_manager(organization_id, (select auth.uid()))
  or private.can_read_published_announcement(id, organization_id, (select auth.uid()))
);

alter policy announcements_insert on public.announcements
with check (
  private.is_announcement_manager(organization_id, (select auth.uid()))
  and (created_by is null or created_by = (select auth.uid()))
);

alter policy announcements_update on public.announcements
using (private.is_announcement_manager(organization_id, (select auth.uid())))
with check (private.is_announcement_manager(organization_id, (select auth.uid())));

alter policy announcements_delete on public.announcements
using (private.is_announcement_manager(organization_id, (select auth.uid())));

alter policy change_orders_select on public.change_orders
using (private.can_access_project(project_id, organization_id, (select auth.uid())));

alter policy change_order_lines_management_select on public.change_order_lines
using (
  exists (
    select 1
    from public.change_orders co
    where co.id = change_order_lines.change_order_id
      and co.organization_id = change_order_lines.organization_id
      and private.can_access_project(co.project_id, co.organization_id, (select auth.uid()))
  )
);

alter policy demo_environments_select_own on public.demo_environments
using (owner_user_id = (select auth.uid()));

alter policy demo_review_items_owner_all on public.demo_review_items
using (
  owner_user_id = (select auth.uid())
  and exists (
    select 1
    from public.demo_environments de
    where de.owner_user_id = (select auth.uid())
      and de.organization_id = demo_review_items.organization_id
  )
)
with check (
  owner_user_id = (select auth.uid())
  and exists (
    select 1
    from public.demo_environments de
    where de.owner_user_id = (select auth.uid())
      and de.organization_id = demo_review_items.organization_id
  )
);

alter policy demo_review_findings_owner_all on public.demo_review_findings
using (
  owner_user_id = (select auth.uid())
  and exists (
    select 1
    from public.demo_environments de
    where de.owner_user_id = (select auth.uid())
      and de.organization_id = demo_review_findings.organization_id
  )
)
with check (
  owner_user_id = (select auth.uid())
  and exists (
    select 1
    from public.demo_environments de
    where de.owner_user_id = (select auth.uid())
      and de.organization_id = demo_review_findings.organization_id
  )
);

-- Remove one of two byte-for-byte identical indexes.
drop index if exists public.customer_portal_decision_project_idx;

-- Add covering indexes for every currently unindexed public foreign key.
create index if not exists ann_place_project_fk_idx on public.announcement_placements(project_id);
create index if not exists ann_place_work_order_fk_idx on public.announcement_placements(work_order_id);
create index if not exists ann_recipient_user_fk_idx on public.announcement_recipients(user_id);
create index if not exists ann_target_project_fk_idx on public.announcement_targets(target_project_id);
create index if not exists ann_target_supervisor_fk_idx on public.announcement_targets(target_supervisor_user_id);
create index if not exists ann_target_user_fk_idx on public.announcement_targets(target_user_id);
create index if not exists change_orders_manual_actor_fk_idx on public.change_orders(manual_decision_recorded_by);
create index if not exists portal_ack_org_fk_idx on public.customer_portal_acknowledgements(organization_id);
create index if not exists portal_ack_user_fk_idx on public.customer_portal_acknowledgements(user_id);
create index if not exists portal_decision_customer_fk_idx on public.customer_portal_decision_snapshots(customer_id);
create index if not exists portal_decision_actor_fk_idx on public.customer_portal_decision_snapshots(decided_by);
create index if not exists portal_decision_project_fk_idx on public.customer_portal_decision_snapshots(project_id);
create index if not exists portal_publication_customer_fk_idx on public.customer_portal_publications(customer_id);
create index if not exists portal_publication_publisher_fk_idx on public.customer_portal_publications(published_by);
create index if not exists cwr_events_actor_fk_idx on public.customer_work_request_events(actor_user_id);
create index if not exists cwr_items_creator_fk_idx on public.customer_work_request_items(created_by);
create index if not exists cwr_items_org_fk_idx on public.customer_work_request_items(organization_id);
create index if not exists cwr_msg_attach_creator_fk_idx on public.customer_work_request_message_attachments(created_by);
create index if not exists cwr_msg_attach_org_fk_idx on public.customer_work_request_message_attachments(organization_id);
create index if not exists cwr_msg_attach_request_fk_idx on public.customer_work_request_message_attachments(request_id);
create index if not exists cwr_messages_author_fk_idx on public.customer_work_request_messages(author_user_id);
create index if not exists cwr_messages_org_fk_idx on public.customer_work_request_messages(organization_id);
create index if not exists cwr_messages_reply_fk_idx on public.customer_work_request_messages(reply_to_id);
create index if not exists cwr_participants_added_by_fk_idx on public.customer_work_request_participants(added_by);
create index if not exists cwr_read_state_org_fk_idx on public.customer_work_request_read_state(organization_id);
create index if not exists cwr_requests_supervisor_fk_idx on public.customer_work_requests(assigned_supervisor_id);
create index if not exists demo_env_source_org_fk_idx on public.demo_environments(source_organization_id);
create index if not exists demo_findings_org_fk_idx on public.demo_review_findings(organization_id);
create index if not exists demo_items_org_fk_idx on public.demo_review_items(organization_id);
create index if not exists inspections_customer_publisher_fk_idx on public.inspections(customer_published_by);
create index if not exists inspections_deleted_by_fk_idx on public.inspections(deleted_by);
create index if not exists project_request_attach_creator_fk_idx on public.project_request_attachments(created_by);
create index if not exists project_request_revisions_creator_fk_idx on public.project_request_revisions(created_by);
create index if not exists project_request_revisions_org_fk_idx on public.project_request_revisions(organization_id);
create index if not exists work_phase_templates_creator_fk_idx on public.project_work_phase_templates(created_by);
create index if not exists work_phase_templates_org_fk_idx on public.project_work_phase_templates(organization_id);
create index if not exists work_phase_templates_project_fk_idx on public.project_work_phase_templates(project_id);
create index if not exists work_targets_creator_fk_idx on public.project_work_targets(created_by);
create index if not exists work_targets_org_fk_idx on public.project_work_targets(organization_id);
create index if not exists work_targets_project_fk_idx on public.project_work_targets(project_id);
create index if not exists time_correction_requester_fk_idx on public.time_entry_correction_requests(requested_by);
create index if not exists time_correction_resolver_fk_idx on public.time_entry_correction_requests(resolved_by);
create index if not exists time_correction_target_user_fk_idx on public.time_entry_correction_requests(target_user_id);
create index if not exists work_order_saved_views_user_fk_idx on public.work_order_saved_views(user_id);

commit;
