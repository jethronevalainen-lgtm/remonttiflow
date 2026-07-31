begin;

-- Project team roster is employee-based. Operational project_members (auth users)
-- stay for work-order assignment, calendar sync, RLS and notifications.
-- Adding someone to the team does not send a VaKantti invite.

create table if not exists public.project_team_members (
  organization_id uuid not null references public.organizations (id) on delete cascade,
  project_id uuid not null references public.projects (id) on delete cascade,
  employee_id uuid not null references public.employees (id) on delete cascade,
  created_at timestamptz not null default now(),
  created_by uuid references public.profiles (id) on delete set null,
  primary key (project_id, employee_id)
);

comment on table public.project_team_members is
  'Project crew roster keyed by employees. Independent of VaKantti invites; operational access still requires a linked user_id in project_members.';

create index if not exists project_team_members_org_employee_idx
  on public.project_team_members (organization_id, employee_id);

create index if not exists project_team_members_org_project_idx
  on public.project_team_members (organization_id, project_id);

alter table public.project_team_members enable row level security;

drop policy if exists project_team_members_select on public.project_team_members;
create policy project_team_members_select on public.project_team_members
for select to authenticated
using (
  private.has_org_role(organization_id, array['admin', 'supervisor', 'project_coordinator']::text[])
  or private.can_access_project(project_id)
);

-- Writes go through SECURITY DEFINER RPC only (no insert/update/delete policies).
drop policy if exists project_team_members_insert on public.project_team_members;
drop policy if exists project_team_members_update on public.project_team_members;
drop policy if exists project_team_members_delete on public.project_team_members;
drop policy if exists project_team_members_rpc_only_deny on public.project_team_members;

-- Backfill roster from existing operational members that have an employee card.
insert into public.project_team_members (organization_id, project_id, employee_id)
select distinct pm.organization_id, pm.project_id, e.id
from public.project_members pm
join public.employees e
  on e.organization_id = pm.organization_id
 and e.user_id = pm.user_id
 and e.archived_at is null
on conflict do nothing;

create or replace function private.apply_project_member_user_ids(
  p_organization_id uuid,
  p_project_id uuid,
  p_user_ids uuid[]
)
returns void
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  normalized_user_ids uuid[] := coalesce(p_user_ids, array[]::uuid[]);
begin
  normalized_user_ids := array_remove(normalized_user_ids, null);

  if exists (
    select 1
    from unnest(normalized_user_ids) requested(user_id)
    where not exists (
      select 1
      from public.organization_members om
      where om.organization_id = p_organization_id
        and om.user_id = requested.user_id
    )
  ) then
    raise exception 'Projektitiimin operatiivisiin jäseniin voi lisätä vain organisaation käyttäjiä.'
      using errcode = '23503';
  end if;

  delete from public.work_order_assignees wa
  using public.work_orders wo
  where wa.work_order_id = wo.id
    and wa.organization_id = p_organization_id
    and wo.organization_id = p_organization_id
    and wo.project_id = p_project_id
    and not (wa.user_id = any (normalized_user_ids));

  delete from public.project_members
  where project_id = p_project_id
    and organization_id = p_organization_id;

  insert into public.project_members (project_id, organization_id, user_id, role)
  select p_project_id, p_organization_id, requested.user_id, 'worker'
  from (select distinct unnest(normalized_user_ids) as user_id) requested;
end;
$$;

revoke all on function private.apply_project_member_user_ids(uuid, uuid, uuid[]) from public, anon, authenticated;

create or replace function private.replace_project_team_members(
  p_organization_id uuid,
  p_project_id uuid,
  p_employee_ids uuid[],
  p_extra_user_ids uuid[] default array[]::uuid[]
)
returns void
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  normalized_employee_ids uuid[] := coalesce(p_employee_ids, array[]::uuid[]);
  normalized_extra_user_ids uuid[] := coalesce(p_extra_user_ids, array[]::uuid[]);
  operational_user_ids uuid[] := array[]::uuid[];
begin
  normalized_employee_ids := array_remove(normalized_employee_ids, null);
  normalized_extra_user_ids := array_remove(normalized_extra_user_ids, null);

  if auth.uid() is null then
    raise exception 'Kirjautuminen vaaditaan.' using errcode = '42501';
  end if;

  if not private.has_org_role(
    p_organization_id,
    array['admin', 'supervisor', 'project_coordinator']::text[]
  ) then
    raise exception 'Vain työnjohto voi muuttaa projektitiimiä.' using errcode = '42501';
  end if;

  if not exists (
    select 1
    from public.projects
    where id = p_project_id
      and organization_id = p_organization_id
  ) then
    raise exception 'Projektia ei löytynyt.' using errcode = '23503';
  end if;

  if exists (
    select 1
    from unnest(normalized_employee_ids) requested(employee_id)
    where not exists (
      select 1
      from public.employees e
      where e.id = requested.employee_id
        and e.organization_id = p_organization_id
        and e.archived_at is null
    )
  ) then
    raise exception 'Projektitiimiin voi lisätä vain organisaation henkilöstökortteja.'
      using errcode = '23503';
  end if;

  delete from public.project_team_members
  where project_id = p_project_id
    and organization_id = p_organization_id;

  insert into public.project_team_members (
    organization_id, project_id, employee_id, created_by
  )
  select
    p_organization_id,
    p_project_id,
    requested.employee_id,
    auth.uid()
  from (select distinct unnest(normalized_employee_ids) as employee_id) requested;

  select coalesce(array_agg(distinct linked.user_id), array[]::uuid[])
  into operational_user_ids
  from (
    select e.user_id
    from public.employees e
    where e.organization_id = p_organization_id
      and e.id = any (normalized_employee_ids)
      and e.user_id is not null
      and e.archived_at is null
    union
    select unnest(normalized_extra_user_ids)
  ) linked(user_id)
  where linked.user_id is not null;

  perform private.apply_project_member_user_ids(
    p_organization_id,
    p_project_id,
    operational_user_ids
  );

  insert into public.audit_logs (
    organization_id, user_id, action, table_name, record_id, metadata
  ) values (
    p_organization_id,
    auth.uid(),
    'project_team_members_replaced',
    'project_team_members',
    p_project_id,
    jsonb_build_object(
      'employee_ids', normalized_employee_ids,
      'extra_user_ids', normalized_extra_user_ids,
      'operational_user_ids', operational_user_ids
    )
  );
end;
$$;

revoke all on function private.replace_project_team_members(uuid, uuid, uuid[], uuid[])
  from public, anon, authenticated;

create or replace function public.replace_project_team_members(
  p_organization_id uuid,
  p_project_id uuid,
  p_employee_ids uuid[],
  p_extra_user_ids uuid[] default array[]::uuid[]
)
returns void
language sql
security definer
set search_path = pg_catalog, public, private
as $$
  select private.replace_project_team_members(
    p_organization_id,
    p_project_id,
    p_employee_ids,
    p_extra_user_ids
  );
$$;

revoke all on function public.replace_project_team_members(uuid, uuid, uuid[], uuid[])
  from public, anon;
grant execute on function public.replace_project_team_members(uuid, uuid, uuid[], uuid[])
  to authenticated;

-- Keep legacy RPC: update operational members and mirror linked employees into roster.
create or replace function private.replace_project_members(
  p_organization_id uuid,
  p_project_id uuid,
  p_user_ids uuid[]
)
returns void
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  normalized_user_ids uuid[] := coalesce(p_user_ids, array[]::uuid[]);
  linked_employee_ids uuid[] := array[]::uuid[];
begin
  normalized_user_ids := array_remove(normalized_user_ids, null);

  if auth.uid() is null then
    raise exception 'Kirjautuminen vaaditaan.' using errcode = '42501';
  end if;

  if not private.has_org_role(
    p_organization_id,
    array['admin', 'supervisor', 'project_coordinator']::text[]
  ) then
    raise exception 'Vain työnjohto voi muuttaa projektitiimiä.' using errcode = '42501';
  end if;

  if not exists (
    select 1
    from public.projects
    where id = p_project_id
      and organization_id = p_organization_id
  ) then
    raise exception 'Projektia ei löytynyt.' using errcode = '23503';
  end if;

  perform private.apply_project_member_user_ids(
    p_organization_id,
    p_project_id,
    normalized_user_ids
  );

  select coalesce(array_agg(distinct e.id), array[]::uuid[])
  into linked_employee_ids
  from public.employees e
  where e.organization_id = p_organization_id
    and e.user_id = any (normalized_user_ids)
    and e.archived_at is null;

  -- Preserve roster employees without login; only sync those linked to the
  -- provided user ids into/out of the operational set via apply above.
  delete from public.project_team_members ptm
  where ptm.project_id = p_project_id
    and ptm.organization_id = p_organization_id
    and exists (
      select 1
      from public.employees e
      where e.id = ptm.employee_id
        and e.organization_id = p_organization_id
        and e.user_id is not null
        and not (e.user_id = any (normalized_user_ids))
    );

  insert into public.project_team_members (
    organization_id, project_id, employee_id, created_by
  )
  select
    p_organization_id,
    p_project_id,
    employee_id,
    auth.uid()
  from unnest(linked_employee_ids) as employee_id
  on conflict do nothing;

  insert into public.audit_logs (
    organization_id, user_id, action, table_name, record_id, metadata
  ) values (
    p_organization_id,
    auth.uid(),
    'project_members_replaced',
    'project_members',
    p_project_id,
    jsonb_build_object('member_user_ids', normalized_user_ids)
  );
end;
$$;

revoke all on function private.replace_project_members(uuid, uuid, uuid[])
  from public, anon, authenticated;

create or replace function public.replace_project_members(
  p_organization_id uuid,
  p_project_id uuid,
  p_user_ids uuid[]
)
returns void
language sql
security definer
set search_path = pg_catalog, public, private
as $$
  select private.replace_project_members($1, $2, $3);
$$;

revoke all on function public.replace_project_members(uuid, uuid, uuid[])
  from public, anon;
grant execute on function public.replace_project_members(uuid, uuid, uuid[])
  to authenticated;

-- When an employee later gets a login, promote them to operational project_members
-- for every project already on their roster.
create or replace function private.sync_employee_project_memberships()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
begin
  if tg_op = 'UPDATE'
    and new.user_id is not null
    and new.archived_at is null
    and (old.user_id is distinct from new.user_id)
    and exists (
      select 1
      from public.organization_members om
      where om.organization_id = new.organization_id
        and om.user_id = new.user_id
    )
  then
    insert into public.project_members (project_id, organization_id, user_id, role)
    select ptm.project_id, ptm.organization_id, new.user_id, 'worker'
    from public.project_team_members ptm
    where ptm.organization_id = new.organization_id
      and ptm.employee_id = new.id
    on conflict do nothing;
  end if;

  if tg_op = 'UPDATE'
    and old.user_id is not null
    and (new.user_id is distinct from old.user_id or new.archived_at is not null)
  then
    delete from public.project_members pm
    using public.project_team_members ptm
    where pm.organization_id = old.organization_id
      and pm.user_id = old.user_id
      and ptm.organization_id = old.organization_id
      and ptm.employee_id = old.id
      and ptm.project_id = pm.project_id
      and (
        new.user_id is null
        or new.archived_at is not null
        or new.user_id is distinct from old.user_id
      );
  end if;

  return new;
end;
$$;

drop trigger if exists employees_sync_project_memberships on public.employees;
create trigger employees_sync_project_memberships
after update of user_id, archived_at on public.employees
for each row
execute function private.sync_employee_project_memberships();

revoke all on function private.sync_employee_project_memberships() from public, anon, authenticated;

commit;
