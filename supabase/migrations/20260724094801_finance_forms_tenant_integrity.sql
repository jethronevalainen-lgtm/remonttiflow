begin;

-- Explicit Data API privileges. Supabase no longer guarantees that new public
-- tables are exposed automatically, so migrations must state the intended role.
revoke all on table
  public.estimates,
  public.estimate_lines,
  public.quantity_takeoffs,
  public.quantity_takeoff_lines,
  public.form_templates,
  public.form_submissions
from anon;

grant select, insert, update, delete on table
  public.estimates,
  public.estimate_lines,
  public.quantity_takeoffs,
  public.quantity_takeoff_lines,
  public.form_templates,
  public.form_submissions
to authenticated;

-- Parent rows expose an organization-qualified candidate key. Child rows then
-- reference both the parent id and organization id, preventing cross-tenant
-- relationships even when a caller knows another tenant's UUID.
alter table public.estimates
  add constraint estimates_id_organization_key unique (id, organization_id);
alter table public.quantity_takeoffs
  add constraint quantity_takeoffs_id_organization_key unique (id, organization_id);
alter table public.form_templates
  add constraint form_templates_id_organization_key unique (id, organization_id);

alter table public.estimate_lines
  drop constraint estimate_lines_estimate_id_fkey;
alter table public.estimate_lines
  add constraint estimate_lines_estimate_org_fkey
  foreign key (estimate_id, organization_id)
  references public.estimates (id, organization_id)
  on delete cascade;

alter table public.quantity_takeoff_lines
  drop constraint quantity_takeoff_lines_takeoff_id_fkey;
alter table public.quantity_takeoff_lines
  add constraint quantity_takeoff_lines_takeoff_org_fkey
  foreign key (takeoff_id, organization_id)
  references public.quantity_takeoffs (id, organization_id)
  on delete cascade;

alter table public.form_submissions
  drop constraint form_submissions_template_id_fkey;
alter table public.form_submissions
  add constraint form_submissions_template_org_fkey
  foreign key (template_id, organization_id)
  references public.form_templates (id, organization_id)
  on delete restrict;

-- Project foreign keys intentionally retain ON DELETE SET NULL. This trigger
-- adds the missing organization match without making organization_id nullable.
create or replace function private.enforce_finance_project_organization()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.project_id is not null and not exists (
    select 1
    from public.projects p
    where p.id = new.project_id
      and p.organization_id = new.organization_id
  ) then
    raise exception 'Referenced project does not belong to the active organization.'
      using errcode = '23503';
  end if;

  return new;
end;
$$;

revoke all on function private.enforce_finance_project_organization()
from public, anon, authenticated;

drop trigger if exists estimates_project_organization_guard on public.estimates;
create trigger estimates_project_organization_guard
before insert or update of project_id, organization_id on public.estimates
for each row execute function private.enforce_finance_project_organization();

drop trigger if exists quantity_takeoffs_project_organization_guard on public.quantity_takeoffs;
create trigger quantity_takeoffs_project_organization_guard
before insert or update of project_id, organization_id on public.quantity_takeoffs
for each row execute function private.enforce_finance_project_organization();

drop trigger if exists form_submissions_project_organization_guard on public.form_submissions;
create trigger form_submissions_project_organization_guard
before insert or update of project_id, organization_id on public.form_submissions
for each row execute function private.enforce_finance_project_organization();

-- Financial data is restricted in the database, not only hidden by React routes.
drop policy if exists estimates_select on public.estimates;
create policy estimates_select on public.estimates for select to authenticated
  using (private.has_org_role(organization_id, array['admin', 'supervisor']));

drop policy if exists estimate_lines_select on public.estimate_lines;
create policy estimate_lines_select on public.estimate_lines for select to authenticated
  using (private.has_org_role(organization_id, array['admin', 'supervisor']));

drop policy if exists quantity_takeoffs_select on public.quantity_takeoffs;
create policy quantity_takeoffs_select on public.quantity_takeoffs for select to authenticated
  using (private.has_org_role(organization_id, array['admin', 'supervisor']));

drop policy if exists quantity_takeoff_lines_select on public.quantity_takeoff_lines;
create policy quantity_takeoff_lines_select on public.quantity_takeoff_lines for select to authenticated
  using (private.has_org_role(organization_id, array['admin', 'supervisor']));

-- Workers see and manage only their own submissions. Supervisors and admins
-- retain organization-wide review access. A worker may move a draft only to
-- Draft or Submitted; approval states remain a database-enforced management action.
drop policy if exists form_submissions_select on public.form_submissions;
create policy form_submissions_select on public.form_submissions for select to authenticated
  using (
    private.has_org_role(organization_id, array['admin', 'supervisor'])
    or submitted_by = (select auth.uid())
  );

drop policy if exists form_submissions_insert on public.form_submissions;
create policy form_submissions_insert on public.form_submissions for insert to authenticated
  with check (
    private.is_org_member(organization_id)
    and submitted_by = (select auth.uid())
    and status in ('Luonnos', 'Lähetetty')
  );

drop policy if exists form_submissions_update on public.form_submissions;
create policy form_submissions_update on public.form_submissions for update to authenticated
  using (
    private.has_org_role(organization_id, array['admin', 'supervisor'])
    or (submitted_by = (select auth.uid()) and status = 'Luonnos')
  )
  with check (
    private.has_org_role(organization_id, array['admin', 'supervisor'])
    or (
      submitted_by = (select auth.uid())
      and status in ('Luonnos', 'Lähetetty')
    )
  );

drop policy if exists form_submissions_delete on public.form_submissions;
create policy form_submissions_delete on public.form_submissions for delete to authenticated
  using (
    private.has_org_role(organization_id, array['admin', 'supervisor'])
    or (submitted_by = (select auth.uid()) and status = 'Luonnos')
  );

commit;
