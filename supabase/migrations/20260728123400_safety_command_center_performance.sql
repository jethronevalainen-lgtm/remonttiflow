-- Cover new foreign keys and avoid per-row auth.uid() evaluation in safety RLS policies.

create index if not exists safety_briefings_created_by_idx
  on public.safety_briefings (created_by);
create index if not exists safety_briefings_published_by_idx
  on public.safety_briefings (published_by) where published_by is not null;
create index if not exists safety_briefing_versions_created_by_idx
  on public.safety_briefing_versions (created_by) where created_by is not null;
create index if not exists safety_briefing_ack_user_idx
  on public.safety_briefing_acknowledgements (user_id);
create index if not exists safety_briefing_ack_project_idx
  on public.safety_briefing_acknowledgements (project_id) where project_id is not null;
create index if not exists project_safety_profiles_created_by_idx
  on public.project_safety_profiles (created_by) where created_by is not null;
create index if not exists safety_attachments_created_by_idx
  on public.safety_attachments (created_by);

drop policy if exists safety_briefings_select on public.safety_briefings;
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
        and om.user_id = (select auth.uid())
        and om.role = any(safety_briefings.audience_roles)
    )
    and (
      project_id is null
      or private.can_collaborate_on_project(project_id, organization_id, (select auth.uid()))
    )
  )
);

drop policy if exists safety_briefings_insert on public.safety_briefings;
create policy safety_briefings_insert on public.safety_briefings
for insert to authenticated
with check (
  private.has_org_role(organization_id, array['admin','supervisor','project_coordinator'])
  and created_by = (select auth.uid())
);

drop policy if exists safety_ack_select on public.safety_briefing_acknowledgements;
create policy safety_ack_select on public.safety_briefing_acknowledgements
for select to authenticated
using (
  user_id = (select auth.uid())
  or private.has_org_role(organization_id, array['admin','supervisor','project_coordinator'])
);

drop policy if exists safety_ack_insert on public.safety_briefing_acknowledgements;
create policy safety_ack_insert on public.safety_briefing_acknowledgements
for insert to authenticated
with check (
  user_id = (select auth.uid())
  and private.is_org_member(organization_id)
);

drop policy if exists safety_ack_update on public.safety_briefing_acknowledgements;
create policy safety_ack_update on public.safety_briefing_acknowledgements
for update to authenticated
using (user_id = (select auth.uid()))
with check (user_id = (select auth.uid()));

drop policy if exists project_safety_profiles_select on public.project_safety_profiles;
create policy project_safety_profiles_select on public.project_safety_profiles
for select to authenticated
using (
  private.has_org_role(organization_id, array['admin','supervisor','project_coordinator'])
  or private.can_collaborate_on_project(project_id, organization_id, (select auth.uid()))
);

drop policy if exists safety_attachments_insert on public.safety_attachments;
create policy safety_attachments_insert on public.safety_attachments
for insert to authenticated
with check (
  created_by = (select auth.uid())
  and private.is_org_member(organization_id)
  and (
    (
      safety_item_id is not null
      and exists (select 1 from public.safety_items si where si.id = safety_item_id)
    )
    or (
      briefing_id is not null
      and private.has_org_role(organization_id, array['admin','supervisor','project_coordinator'])
      and exists (select 1 from public.safety_briefings sb where sb.id = briefing_id)
    )
  )
);

drop policy if exists safety_attachments_delete on public.safety_attachments;
create policy safety_attachments_delete on public.safety_attachments
for delete to authenticated
using (
  created_by = (select auth.uid())
  or private.has_org_role(organization_id, array['admin','supervisor','project_coordinator'])
);
