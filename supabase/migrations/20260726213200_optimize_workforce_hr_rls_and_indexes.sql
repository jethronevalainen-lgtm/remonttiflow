create index if not exists supervisor_team_members_supervisor_user_id_idx
  on public.supervisor_team_members(supervisor_user_id);
create index if not exists supervisor_team_members_employee_id_idx
  on public.supervisor_team_members(employee_id);
create index if not exists supervisor_team_members_assigned_by_idx
  on public.supervisor_team_members(assigned_by)
  where assigned_by is not null;

create index if not exists employee_hr_profiles_organization_id_idx
  on public.employee_hr_profiles(organization_id);
create index if not exists employee_hr_profiles_updated_by_idx
  on public.employee_hr_profiles(updated_by)
  where updated_by is not null;

create index if not exists employee_compensation_terms_employee_id_idx
  on public.employee_compensation_terms(employee_id);
create index if not exists employee_compensation_terms_created_by_idx
  on public.employee_compensation_terms(created_by)
  where created_by is not null;
create index if not exists employee_compensation_terms_updated_by_idx
  on public.employee_compensation_terms(updated_by)
  where updated_by is not null;

create index if not exists work_site_qr_tokens_project_id_idx
  on public.work_site_qr_tokens(project_id);
create index if not exists work_site_qr_tokens_created_by_idx
  on public.work_site_qr_tokens(created_by);

drop policy if exists supervisor_team_members_select on public.supervisor_team_members;
create policy supervisor_team_members_select on public.supervisor_team_members
for select to authenticated
using (
  private.has_org_role(organization_id, array['admin']::text[])
  or (
    supervisor_user_id = (select auth.uid())
    and private.has_org_role(organization_id, array['supervisor']::text[])
  )
);

drop policy if exists supervisor_team_members_insert on public.supervisor_team_members;
create policy supervisor_team_members_insert on public.supervisor_team_members
for insert to authenticated
with check (
  private.has_org_role(organization_id, array['admin']::text[])
  and assigned_by = (select auth.uid())
);

drop policy if exists employee_hr_profiles_insert on public.employee_hr_profiles;
create policy employee_hr_profiles_insert on public.employee_hr_profiles
for insert to authenticated
with check (
  private.has_org_role(organization_id, array['admin']::text[])
  and updated_by = (select auth.uid())
);

drop policy if exists employee_hr_profiles_update on public.employee_hr_profiles;
create policy employee_hr_profiles_update on public.employee_hr_profiles
for update to authenticated
using (private.has_org_role(organization_id, array['admin']::text[]))
with check (
  private.has_org_role(organization_id, array['admin']::text[])
  and updated_by = (select auth.uid())
);

drop policy if exists employee_compensation_terms_insert on public.employee_compensation_terms;
create policy employee_compensation_terms_insert on public.employee_compensation_terms
for insert to authenticated
with check (
  private.has_org_role(organization_id, array['admin']::text[])
  and created_by = (select auth.uid())
  and updated_by = (select auth.uid())
);

drop policy if exists employee_compensation_terms_update on public.employee_compensation_terms;
create policy employee_compensation_terms_update on public.employee_compensation_terms
for update to authenticated
using (private.has_org_role(organization_id, array['admin']::text[]))
with check (
  private.has_org_role(organization_id, array['admin']::text[])
  and updated_by = (select auth.uid())
);

drop policy if exists backup_runs_select on public.backup_runs;
create policy backup_runs_select on public.backup_runs
for select to authenticated
using (exists (
  select 1
  from public.organization_members om
  where om.user_id = (select auth.uid())
    and om.role = 'admin'
));

drop policy if exists work_site_qr_tokens_deny_client on public.work_site_qr_tokens;
create policy work_site_qr_tokens_deny_client on public.work_site_qr_tokens
for all to anon, authenticated
using (false)
with check (false);

drop policy if exists backup_cron_settings_deny_client on public.backup_cron_settings;
create policy backup_cron_settings_deny_client on public.backup_cron_settings
for all to anon, authenticated
using (false)
with check (false);
