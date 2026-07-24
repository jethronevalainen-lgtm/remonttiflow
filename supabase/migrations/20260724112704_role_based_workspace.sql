begin;

alter table public.projects alter column organization_id set not null;
alter table public.work_orders alter column organization_id set not null;
alter table public.work_orders alter column project_id set not null;

alter table public.work_orders
  add column if not exists assignment_scope text not null default 'people',
  add column if not exists worker_note text,
  add column if not exists started_at timestamptz,
  add column if not exists completed_at timestamptz;

alter table public.employees
  add column if not exists user_id uuid references public.profiles(id) on delete set null;

alter table public.shifts
  add column if not exists user_id uuid references public.profiles(id) on delete set null;

alter table public.project_members
  add column if not exists organization_id uuid;

alter table public.messages
  add column if not exists sender_user_id uuid references public.profiles(id) on delete set null,
  add column if not exists recipient_user_id uuid references public.profiles(id) on delete set null;

update public.project_members pm
set organization_id = p.organization_id
from public.projects p
where p.id = pm.project_id
  and pm.organization_id is null;

alter table public.project_members alter column organization_id set not null;

update public.employees e
set user_id = om.user_id
from public.organization_members om
join public.profiles p on p.id = om.user_id
where om.organization_id = e.organization_id
  and e.user_id is null
  and e.email is not null
  and lower(trim(p.email)) = lower(trim(e.email));

update public.shifts s
set user_id = e.user_id
from public.employees e
where e.id = s.employee_id
  and e.organization_id = s.organization_id
  and s.user_id is null
  and e.user_id is not null;

update public.messages
set sender_user_id = created_by
where sender_user_id is null
  and created_by is not null;

update public.messages m
set recipient_user_id = p.id
from public.organization_members om
join public.profiles p on p.id = om.user_id
where om.organization_id = m.organization_id
  and m.recipient_user_id is null
  and m.recipient is not null
  and (
    lower(trim(m.recipient)) = lower(trim(coalesce(p.email, '')))
    or lower(trim(m.recipient)) = lower(trim(coalesce(p.full_name, '')))
  );

alter table public.work_orders
  drop constraint if exists work_orders_assignment_scope_check;
alter table public.work_orders
  add constraint work_orders_assignment_scope_check
  check (assignment_scope in ('people', 'project_team'));

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.projects'::regclass
      and conname = 'projects_id_organization_key'
  ) then
    alter table public.projects
      add constraint projects_id_organization_key unique (id, organization_id);
  end if;

  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.work_orders'::regclass
      and conname = 'work_orders_id_organization_key'
  ) then
    alter table public.work_orders
      add constraint work_orders_id_organization_key unique (id, organization_id);
  end if;
end
$$;

alter table public.work_orders
  drop constraint if exists work_orders_project_id_fkey;
alter table public.work_orders
  add constraint work_orders_project_organization_fkey
  foreign key (project_id, organization_id)
  references public.projects(id, organization_id)
  on delete cascade;

alter table public.project_members
  drop constraint if exists project_members_project_id_fkey;
alter table public.project_members
  add constraint project_members_project_organization_fkey
  foreign key (project_id, organization_id)
  references public.projects(id, organization_id)
  on delete cascade;
alter table public.project_members
  add constraint project_members_organization_user_fkey
  foreign key (organization_id, user_id)
  references public.organization_members(organization_id, user_id)
  on delete cascade;

create table if not exists public.work_order_assignees (
  organization_id uuid not null,
  work_order_id uuid not null,
  user_id uuid not null,
  assigned_by uuid references public.profiles(id) on delete set null,
  responsibility text,
  created_at timestamptz not null default now(),
  primary key (work_order_id, user_id),
  constraint work_order_assignees_work_order_org_fkey
    foreign key (work_order_id, organization_id)
    references public.work_orders(id, organization_id)
    on delete cascade,
  constraint work_order_assignees_org_user_fkey
    foreign key (organization_id, user_id)
    references public.organization_members(organization_id, user_id)
    on delete cascade
);

insert into public.work_order_assignees (
  organization_id,
  work_order_id,
  user_id,
  assigned_by
)
select distinct
  wo.organization_id,
  wo.id,
  coalesce(e.user_id, p.id),
  wo.created_by
from public.work_orders wo
left join public.employees e
  on e.organization_id = wo.organization_id
 and lower(trim(e.name)) = lower(trim(wo.assignee))
 and e.user_id is not null
left join public.organization_members om
  on om.organization_id = wo.organization_id
left join public.profiles p
  on p.id = om.user_id
 and (
   lower(trim(coalesce(p.full_name, ''))) = lower(trim(wo.assignee))
   or lower(trim(coalesce(p.email, ''))) = lower(trim(wo.assignee))
 )
where coalesce(e.user_id, p.id) is not null
on conflict (work_order_id, user_id) do nothing;

create unique index if not exists employees_organization_user_key
  on public.employees(organization_id, user_id)
  where user_id is not null;
create index if not exists project_members_org_user_idx
  on public.project_members(organization_id, user_id);
create index if not exists work_order_assignees_org_user_idx
  on public.work_order_assignees(organization_id, user_id);
create index if not exists work_order_assignees_order_org_idx
  on public.work_order_assignees(work_order_id, organization_id);
create index if not exists work_orders_project_scope_idx
  on public.work_orders(project_id, assignment_scope, status);
create index if not exists shifts_org_user_date_idx
  on public.shifts(organization_id, user_id, date);
create index if not exists messages_recipient_idx
  on public.messages(organization_id, recipient_user_id, sent_at desc);
create index if not exists messages_sender_idx
  on public.messages(organization_id, sender_user_id, sent_at desc);

alter table public.work_order_assignees enable row level security;

revoke all on public.work_order_assignees from anon;
grant select, insert, update, delete on public.work_order_assignees to authenticated;

create or replace function private.can_access_project(
  p_project_id uuid,
  p_organization_id uuid,
  p_user_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = pg_catalog, public
as $$
  select exists (
    select 1
    from public.organization_members om
    where om.organization_id = p_organization_id
      and om.user_id = p_user_id
      and om.role in ('admin', 'supervisor')
  )
  or exists (
    select 1
    from public.project_members pm
    where pm.project_id = p_project_id
      and pm.organization_id = p_organization_id
      and pm.user_id = p_user_id
  )
  or exists (
    select 1
    from public.work_orders wo
    join public.work_order_assignees wa
      on wa.work_order_id = wo.id
     and wa.organization_id = wo.organization_id
    where wo.project_id = p_project_id
      and wo.organization_id = p_organization_id
      and wa.user_id = p_user_id
  );
$$;

create or replace function private.can_access_work_order(
  p_work_order_id uuid,
  p_organization_id uuid,
  p_user_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = pg_catalog, public
as $$
  select exists (
    select 1
    from public.organization_members om
    where om.organization_id = p_organization_id
      and om.user_id = p_user_id
      and om.role in ('admin', 'supervisor')
  )
  or exists (
    select 1
    from public.work_order_assignees wa
    where wa.work_order_id = p_work_order_id
      and wa.organization_id = p_organization_id
      and wa.user_id = p_user_id
  )
  or exists (
    select 1
    from public.work_orders wo
    join public.project_members pm
      on pm.project_id = wo.project_id
     and pm.organization_id = wo.organization_id
    where wo.id = p_work_order_id
      and wo.organization_id = p_organization_id
      and wo.assignment_scope = 'project_team'
      and pm.user_id = p_user_id
  );
$$;

revoke all on function private.can_access_project(uuid, uuid, uuid)
  from public, anon, authenticated;
revoke all on function private.can_access_work_order(uuid, uuid, uuid)
  from public, anon, authenticated;

create or replace function public.replace_project_members(
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
  if auth.uid() is null then
    raise exception 'Kirjautuminen vaaditaan.' using errcode = '42501';
  end if;

  if not private.has_org_role(p_organization_id, array['admin', 'supervisor']) then
    raise exception 'Vain työnjohto voi muuttaa projektitiimiä.' using errcode = '42501';
  end if;

  if not exists (
    select 1 from public.projects
    where id = p_project_id and organization_id = p_organization_id
  ) then
    raise exception 'Projektia ei löytynyt.' using errcode = '23503';
  end if;

  if exists (
    select 1
    from unnest(normalized_user_ids) requested(user_id)
    where not exists (
      select 1 from public.organization_members om
      where om.organization_id = p_organization_id
        and om.user_id = requested.user_id
    )
  ) then
    raise exception 'Projektitiimiin voi lisätä vain organisaation käyttäjiä.' using errcode = '23503';
  end if;

  delete from public.project_members
  where project_id = p_project_id
    and organization_id = p_organization_id;

  insert into public.project_members (project_id, organization_id, user_id, role)
  select p_project_id, p_organization_id, requested.user_id, 'worker'
  from (select distinct unnest(normalized_user_ids) as user_id) requested;

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

create or replace function public.save_work_order(
  p_organization_id uuid,
  p_work_order_id uuid,
  p_project_id uuid,
  p_title text,
  p_due_date date,
  p_priority text,
  p_status text,
  p_description text,
  p_type text,
  p_assignment_scope text,
  p_assignee_user_ids uuid[]
)
returns uuid
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  result_id uuid;
  project_name text;
  assignee_label text;
  normalized_user_ids uuid[] := coalesce(p_assignee_user_ids, array[]::uuid[]);
begin
  if auth.uid() is null then
    raise exception 'Kirjautuminen vaaditaan.' using errcode = '42501';
  end if;

  if not private.has_org_role(p_organization_id, array['admin', 'supervisor']) then
    raise exception 'Vain työnjohto voi tallentaa työmääräyksiä.' using errcode = '42501';
  end if;

  if nullif(trim(p_title), '') is null then
    raise exception 'Työmääräyksen otsikko on pakollinen.' using errcode = '23514';
  end if;

  if p_priority not in ('Korkea', 'Normaali', 'Matala') then
    raise exception 'Virheellinen prioriteetti.' using errcode = '23514';
  end if;

  if p_status not in ('Avoin', 'Käynnissä', 'Odottaa', 'Valmis', 'Peruttu') then
    raise exception 'Virheellinen tila.' using errcode = '23514';
  end if;

  if p_assignment_scope not in ('people', 'project_team') then
    raise exception 'Virheellinen kohdistustapa.' using errcode = '23514';
  end if;

  if p_assignment_scope = 'people' and cardinality(normalized_user_ids) = 0 then
    raise exception 'Valitse vähintään yksi vastuuhenkilö.' using errcode = '23514';
  end if;

  select name into project_name
  from public.projects
  where id = p_project_id
    and organization_id = p_organization_id;

  if project_name is null then
    raise exception 'Projektia ei löytynyt.' using errcode = '23503';
  end if;

  if exists (
    select 1
    from unnest(normalized_user_ids) requested(user_id)
    where not exists (
      select 1 from public.organization_members om
      where om.organization_id = p_organization_id
        and om.user_id = requested.user_id
    )
  ) then
    raise exception 'Työmääräyksen vastuuhenkilön pitää kuulua organisaatioon.' using errcode = '23503';
  end if;

  select string_agg(coalesce(nullif(trim(p.full_name), ''), p.email), ', ' order by coalesce(p.full_name, p.email))
  into assignee_label
  from public.profiles p
  where p.id = any(normalized_user_ids);

  if p_assignment_scope = 'project_team' then
    assignee_label := coalesce(nullif(assignee_label, ''), 'Projektitiimi');
  end if;

  if p_work_order_id is null then
    insert into public.work_orders (
      organization_id, created_by, project_id, project, title, assignee,
      due_date, priority, status, description, type, assignment_scope,
      started_at, completed_at
    ) values (
      p_organization_id, auth.uid(), p_project_id, project_name, trim(p_title),
      coalesce(assignee_label, ''), p_due_date, p_priority, p_status,
      nullif(trim(coalesce(p_description, '')), ''),
      nullif(trim(coalesce(p_type, '')), ''), p_assignment_scope,
      case when p_status = 'Käynnissä' then now() else null end,
      case when p_status = 'Valmis' then now() else null end
    ) returning id into result_id;
  else
    update public.work_orders
    set project_id = p_project_id,
        project = project_name,
        title = trim(p_title),
        assignee = coalesce(assignee_label, ''),
        due_date = p_due_date,
        priority = p_priority,
        status = p_status,
        description = nullif(trim(coalesce(p_description, '')), ''),
        type = nullif(trim(coalesce(p_type, '')), ''),
        assignment_scope = p_assignment_scope,
        started_at = case
          when p_status = 'Käynnissä' then coalesce(started_at, now())
          when p_status = 'Avoin' then null
          else started_at
        end,
        completed_at = case when p_status = 'Valmis' then coalesce(completed_at, now()) else null end,
        updated_at = now()
    where id = p_work_order_id
      and organization_id = p_organization_id
    returning id into result_id;

    if result_id is null then
      raise exception 'Työmääräystä ei löytynyt.' using errcode = '23503';
    end if;
  end if;

  delete from public.work_order_assignees
  where work_order_id = result_id
    and organization_id = p_organization_id;

  insert into public.work_order_assignees (
    organization_id, work_order_id, user_id, assigned_by
  )
  select p_organization_id, result_id, requested.user_id, auth.uid()
  from (select distinct unnest(normalized_user_ids) as user_id) requested;

  insert into public.audit_logs (
    organization_id, user_id, action, table_name, record_id, metadata
  ) values (
    p_organization_id,
    auth.uid(),
    case when p_work_order_id is null then 'work_order_created' else 'work_order_updated' end,
    'work_orders',
    result_id,
    jsonb_build_object(
      'assignment_scope', p_assignment_scope,
      'assignee_user_ids', normalized_user_ids,
      'status', p_status
    )
  );

  return result_id;
end;
$$;

create or replace function public.transition_my_work_order(
  p_work_order_id uuid,
  p_status text,
  p_worker_note text default null
)
returns void
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  current_order public.work_orders%rowtype;
begin
  if auth.uid() is null then
    raise exception 'Kirjautuminen vaaditaan.' using errcode = '42501';
  end if;

  select * into current_order
  from public.work_orders
  where id = p_work_order_id;

  if current_order.id is null then
    raise exception 'Työmääräystä ei löytynyt.' using errcode = '23503';
  end if;

  if not private.can_access_work_order(
    current_order.id,
    current_order.organization_id,
    auth.uid()
  ) then
    raise exception 'Työmääräys ei kuulu käyttäjälle.' using errcode = '42501';
  end if;

  if p_status not in ('Käynnissä', 'Odottaa', 'Valmis') then
    raise exception 'Työntekijä voi käynnistää, keskeyttää tai valmistaa työn.' using errcode = '23514';
  end if;

  if not (
    (current_order.status = 'Avoin' and p_status = 'Käynnissä')
    or (current_order.status = 'Käynnissä' and p_status in ('Odottaa', 'Valmis'))
    or (current_order.status = 'Odottaa' and p_status in ('Käynnissä', 'Valmis'))
  ) then
    raise exception 'Työmääräyksen tilasiirtymä ei ole sallittu.' using errcode = '23514';
  end if;

  update public.work_orders
  set status = p_status,
      worker_note = nullif(trim(coalesce(p_worker_note, '')), ''),
      started_at = case
        when p_status = 'Käynnissä' then coalesce(started_at, now())
        else started_at
      end,
      completed_at = case when p_status = 'Valmis' then now() else null end,
      updated_at = now()
  where id = current_order.id;

  insert into public.audit_logs (
    organization_id, user_id, action, table_name, record_id, metadata
  ) values (
    current_order.organization_id,
    auth.uid(),
    'work_order_status_changed',
    'work_orders',
    current_order.id,
    jsonb_build_object(
      'old_status', current_order.status,
      'new_status', p_status,
      'worker_note', nullif(trim(coalesce(p_worker_note, '')), '')
    )
  );
end;
$$;

revoke all on function public.replace_project_members(uuid, uuid, uuid[]) from public, anon;
revoke all on function public.save_work_order(uuid, uuid, uuid, text, date, text, text, text, text, text, uuid[]) from public, anon;
revoke all on function public.transition_my_work_order(uuid, text, text) from public, anon;
grant execute on function public.replace_project_members(uuid, uuid, uuid[]) to authenticated;
grant execute on function public.save_work_order(uuid, uuid, uuid, text, date, text, text, text, text, text, uuid[]) to authenticated;
grant execute on function public.transition_my_work_order(uuid, text, text) to authenticated;

drop policy if exists projects_select on public.projects;
create policy projects_select on public.projects for select to authenticated
using (private.can_access_project(id, organization_id, (select auth.uid())));

drop policy if exists projects_insert on public.projects;
create policy projects_insert on public.projects for insert to authenticated
with check (
  private.has_org_role(organization_id, array['admin', 'supervisor'])
  and (created_by is null or created_by = (select auth.uid()))
);

drop policy if exists projects_update on public.projects;
create policy projects_update on public.projects for update to authenticated
using (private.has_org_role(organization_id, array['admin', 'supervisor']))
with check (private.has_org_role(organization_id, array['admin', 'supervisor']));

drop policy if exists projects_delete on public.projects;
create policy projects_delete on public.projects for delete to authenticated
using (private.has_org_role(organization_id, array['admin', 'supervisor']));

drop policy if exists project_members_select on public.project_members;
create policy project_members_select on public.project_members for select to authenticated
using (
  private.has_org_role(organization_id, array['admin', 'supervisor'])
  or user_id = (select auth.uid())
);

drop policy if exists project_members_insert on public.project_members;
create policy project_members_insert on public.project_members for insert to authenticated
with check (private.has_org_role(organization_id, array['admin', 'supervisor']));

drop policy if exists project_members_update on public.project_members;
create policy project_members_update on public.project_members for update to authenticated
using (private.has_org_role(organization_id, array['admin', 'supervisor']))
with check (private.has_org_role(organization_id, array['admin', 'supervisor']));

drop policy if exists project_members_delete on public.project_members;
create policy project_members_delete on public.project_members for delete to authenticated
using (private.has_org_role(organization_id, array['admin', 'supervisor']));

drop policy if exists work_orders_select on public.work_orders;
create policy work_orders_select on public.work_orders for select to authenticated
using (private.can_access_work_order(id, organization_id, (select auth.uid())));

drop policy if exists work_orders_insert on public.work_orders;
create policy work_orders_insert on public.work_orders for insert to authenticated
with check (private.has_org_role(organization_id, array['admin', 'supervisor']));

drop policy if exists work_orders_update on public.work_orders;
create policy work_orders_update on public.work_orders for update to authenticated
using (private.has_org_role(organization_id, array['admin', 'supervisor']))
with check (private.has_org_role(organization_id, array['admin', 'supervisor']));

drop policy if exists work_orders_delete on public.work_orders;
create policy work_orders_delete on public.work_orders for delete to authenticated
using (private.has_org_role(organization_id, array['admin', 'supervisor']));

create policy work_order_assignees_select on public.work_order_assignees for select to authenticated
using (private.can_access_work_order(work_order_id, organization_id, (select auth.uid())));
create policy work_order_assignees_insert on public.work_order_assignees for insert to authenticated
with check (private.has_org_role(organization_id, array['admin', 'supervisor']));
create policy work_order_assignees_update on public.work_order_assignees for update to authenticated
using (private.has_org_role(organization_id, array['admin', 'supervisor']))
with check (private.has_org_role(organization_id, array['admin', 'supervisor']));
create policy work_order_assignees_delete on public.work_order_assignees for delete to authenticated
using (private.has_org_role(organization_id, array['admin', 'supervisor']));

drop policy if exists employees_select on public.employees;
create policy employees_select on public.employees for select to authenticated
using (
  private.has_org_role(organization_id, array['admin', 'supervisor'])
  or user_id = (select auth.uid())
);
drop policy if exists employees_insert on public.employees;
create policy employees_insert on public.employees for insert to authenticated
with check (private.has_org_role(organization_id, array['admin', 'supervisor']));
drop policy if exists employees_update on public.employees;
create policy employees_update on public.employees for update to authenticated
using (private.has_org_role(organization_id, array['admin', 'supervisor']))
with check (private.has_org_role(organization_id, array['admin', 'supervisor']));
drop policy if exists employees_delete on public.employees;
create policy employees_delete on public.employees for delete to authenticated
using (private.has_org_role(organization_id, array['admin', 'supervisor']));

drop policy if exists time_entries_select on public.time_entries;
create policy time_entries_select on public.time_entries for select to authenticated
using (
  private.has_org_role(organization_id, array['admin', 'supervisor'])
  or created_by = (select auth.uid())
);
drop policy if exists time_entries_insert on public.time_entries;
create policy time_entries_insert on public.time_entries for insert to authenticated
with check (
  private.has_org_role(organization_id, array['admin', 'supervisor'])
  or (
    private.is_org_member(organization_id)
    and created_by = (select auth.uid())
    and status = 'Odottaa'
  )
);
drop policy if exists time_entries_update on public.time_entries;
create policy time_entries_update on public.time_entries for update to authenticated
using (
  private.has_org_role(organization_id, array['admin', 'supervisor'])
  or (created_by = (select auth.uid()) and status = 'Odottaa')
)
with check (
  private.has_org_role(organization_id, array['admin', 'supervisor'])
  or (created_by = (select auth.uid()) and status = 'Odottaa')
);
drop policy if exists time_entries_delete on public.time_entries;
create policy time_entries_delete on public.time_entries for delete to authenticated
using (
  private.has_org_role(organization_id, array['admin', 'supervisor'])
  or (created_by = (select auth.uid()) and status = 'Odottaa')
);

drop policy if exists shifts_select on public.shifts;
create policy shifts_select on public.shifts for select to authenticated
using (
  private.has_org_role(organization_id, array['admin', 'supervisor'])
  or user_id = (select auth.uid())
);
drop policy if exists shifts_insert on public.shifts;
create policy shifts_insert on public.shifts for insert to authenticated
with check (private.has_org_role(organization_id, array['admin', 'supervisor']));
drop policy if exists shifts_update on public.shifts;
create policy shifts_update on public.shifts for update to authenticated
using (private.has_org_role(organization_id, array['admin', 'supervisor']))
with check (private.has_org_role(organization_id, array['admin', 'supervisor']));
drop policy if exists shifts_delete on public.shifts;
create policy shifts_delete on public.shifts for delete to authenticated
using (private.has_org_role(organization_id, array['admin', 'supervisor']));

drop policy if exists project_phases_select on public.project_phases;
create policy project_phases_select on public.project_phases for select to authenticated
using (
  private.has_org_role(organization_id, array['admin', 'supervisor'])
  or (
    project_id is not null
    and private.can_access_project(project_id, organization_id, (select auth.uid()))
  )
);

drop policy if exists travel_expenses_select on public.travel_expenses;
create policy travel_expenses_select on public.travel_expenses for select to authenticated
using (
  private.has_org_role(organization_id, array['admin', 'supervisor'])
  or created_by = (select auth.uid())
);
drop policy if exists travel_expenses_insert on public.travel_expenses;
create policy travel_expenses_insert on public.travel_expenses for insert to authenticated
with check (
  private.has_org_role(organization_id, array['admin', 'supervisor'])
  or (
    private.is_org_member(organization_id)
    and created_by = (select auth.uid())
    and status = 'Odottaa'
  )
);
drop policy if exists travel_expenses_update on public.travel_expenses;
create policy travel_expenses_update on public.travel_expenses for update to authenticated
using (
  private.has_org_role(organization_id, array['admin', 'supervisor'])
  or (created_by = (select auth.uid()) and status = 'Odottaa')
)
with check (
  private.has_org_role(organization_id, array['admin', 'supervisor'])
  or (created_by = (select auth.uid()) and status = 'Odottaa')
);
drop policy if exists travel_expenses_delete on public.travel_expenses;
create policy travel_expenses_delete on public.travel_expenses for delete to authenticated
using (
  private.has_org_role(organization_id, array['admin', 'supervisor'])
  or (created_by = (select auth.uid()) and status = 'Odottaa')
);

drop policy if exists driving_log_entries_select on public.driving_log_entries;
create policy driving_log_entries_select on public.driving_log_entries for select to authenticated
using (
  private.has_org_role(organization_id, array['admin', 'supervisor'])
  or created_by = (select auth.uid())
);
drop policy if exists driving_log_entries_insert on public.driving_log_entries;
create policy driving_log_entries_insert on public.driving_log_entries for insert to authenticated
with check (
  private.has_org_role(organization_id, array['admin', 'supervisor'])
  or (private.is_org_member(organization_id) and created_by = (select auth.uid()))
);
drop policy if exists driving_log_entries_update on public.driving_log_entries;
create policy driving_log_entries_update on public.driving_log_entries for update to authenticated
using (
  private.has_org_role(organization_id, array['admin', 'supervisor'])
  or created_by = (select auth.uid())
)
with check (
  private.has_org_role(organization_id, array['admin', 'supervisor'])
  or created_by = (select auth.uid())
);
drop policy if exists driving_log_entries_delete on public.driving_log_entries;
create policy driving_log_entries_delete on public.driving_log_entries for delete to authenticated
using (
  private.has_org_role(organization_id, array['admin', 'supervisor'])
  or created_by = (select auth.uid())
);

drop policy if exists site_receipts_select on public.site_receipts;
create policy site_receipts_select on public.site_receipts for select to authenticated
using (
  private.has_org_role(organization_id, array['admin', 'supervisor'])
  or created_by = (select auth.uid())
  or (
    work_order_id is not null
    and private.can_access_work_order(work_order_id, organization_id, (select auth.uid()))
  )
  or (
    work_order_id is null
    and project_id is not null
    and private.can_access_project(project_id, organization_id, (select auth.uid()))
  )
);

drop policy if exists site_receipt_attachments_select on public.site_receipt_attachments;
create policy site_receipt_attachments_select on public.site_receipt_attachments for select to authenticated
using (
  exists (
    select 1 from public.site_receipts receipt
    where receipt.id = site_receipt_attachments.receipt_id
  )
);

drop policy if exists announcements_insert on public.announcements;
create policy announcements_insert on public.announcements for insert to authenticated
with check (
  private.has_org_role(organization_id, array['admin', 'supervisor'])
  and (created_by is null or created_by = (select auth.uid()))
);

drop policy if exists messages_select on public.messages;
create policy messages_select on public.messages for select to authenticated
using (
  sender_user_id = (select auth.uid())
  or recipient_user_id = (select auth.uid())
);
drop policy if exists messages_insert on public.messages;
create policy messages_insert on public.messages for insert to authenticated
with check (
  private.is_org_member(organization_id)
  and created_by = (select auth.uid())
  and sender_user_id = (select auth.uid())
  and recipient_user_id is not null
  and exists (
    select 1 from public.organization_members om
    where om.organization_id = messages.organization_id
      and om.user_id = messages.recipient_user_id
  )
);
drop policy if exists messages_update on public.messages;
create policy messages_update on public.messages for update to authenticated
using (recipient_user_id = (select auth.uid()))
with check (recipient_user_id = (select auth.uid()));
drop policy if exists messages_delete on public.messages;
create policy messages_delete on public.messages for delete to authenticated
using (sender_user_id = (select auth.uid()));

commit;
