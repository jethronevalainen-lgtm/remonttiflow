-- ==========================================================================
-- Persist one browser-reported location sample when a user starts work.
--
-- This is intentionally a check-in event, not continuous tracking. The server
-- timestamps the event and later calculates the time entry from the same row.
-- Browser coordinates remain supporting evidence: a client device can report
-- inaccurate or manipulated coordinates, so accuracy is stored alongside them.
-- ==========================================================================

create table if not exists public.work_site_check_ins (
  id                    uuid primary key default gen_random_uuid(),
  organization_id       uuid not null references public.organizations (id) on delete cascade,
  user_id               uuid not null references public.profiles (id) on delete restrict,
  project_id            uuid references public.projects (id) on delete set null,
  project_name          text not null check (length(btrim(project_name)) > 0),
  employee_name         text not null check (length(btrim(employee_name)) > 0),
  description           text,
  checked_in_at         timestamptz not null default now(),
  location_captured_at  timestamptz not null,
  latitude              double precision not null check (latitude between -90 and 90),
  longitude             double precision not null check (longitude between -180 and 180),
  accuracy_m            double precision not null check (accuracy_m >= 0 and accuracy_m <= 100000),
  location_source       text not null default 'browser_geolocation'
                        check (location_source = 'browser_geolocation'),
  checked_out_at        timestamptz,
  time_entry_id         uuid references public.time_entries (id) on delete set null,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now(),
  constraint work_site_check_ins_checkout_after_checkin
    check (checked_out_at is null or checked_out_at >= checked_in_at)
);

comment on table public.work_site_check_ins is
  'One location sample captured with explicit browser permission when work is started. No continuous location tracking.';
comment on column public.work_site_check_ins.accuracy_m is
  'Browser-reported horizontal accuracy radius in metres; coordinates are not tamper-proof evidence.';

create index if not exists work_site_check_ins_org_checked_in_idx
  on public.work_site_check_ins (organization_id, checked_in_at desc);
create index if not exists work_site_check_ins_user_active_idx
  on public.work_site_check_ins (user_id, checked_out_at)
  where checked_out_at is null;
create index if not exists work_site_check_ins_time_entry_idx
  on public.work_site_check_ins (time_entry_id)
  where time_entry_id is not null;

-- Force provenance fields to server-controlled values. Project and employee
-- labels are resolved from database records whenever those records exist.
create or replace function private.prepare_work_site_check_in()
returns trigger
language plpgsql
security invoker
set search_path = pg_catalog, public, auth
as $$
declare
  authenticated_user uuid;
  resolved_employee_name text;
  resolved_project_name text;
  resolved_project_organization uuid;
begin
  authenticated_user := auth.uid();
  if authenticated_user is not null then
    new.user_id := authenticated_user;
  end if;

  select coalesce(nullif(btrim(profile.full_name), ''), nullif(btrim(profile.email), ''))
    into resolved_employee_name
    from public.profiles profile
   where profile.id = new.user_id;

  if resolved_employee_name is not null then
    new.employee_name := resolved_employee_name;
  end if;

  if new.project_id is not null then
    select project.name, project.organization_id
      into resolved_project_name, resolved_project_organization
      from public.projects project
     where project.id = new.project_id;

    if not found or resolved_project_organization is distinct from new.organization_id then
      raise exception 'Valittu projekti ei kuulu aktiiviseen organisaatioon.';
    end if;
    new.project_name := resolved_project_name;
  end if;

  new.checked_in_at := statement_timestamp();
  new.checked_out_at := null;
  new.time_entry_id := null;
  new.location_source := 'browser_geolocation';
  new.created_at := statement_timestamp();
  new.updated_at := statement_timestamp();
  return new;
end;
$$;

revoke all on function private.prepare_work_site_check_in() from public;

drop trigger if exists prepare_work_site_check_in on public.work_site_check_ins;
create trigger prepare_work_site_check_in
before insert on public.work_site_check_ins
for each row execute function private.prepare_work_site_check_in();

alter table public.work_site_check_ins enable row level security;

-- Workers see only their own events. Supervisors and admins see the full
-- organization history needed for time-entry review.
drop policy if exists work_site_check_ins_select on public.work_site_check_ins;
create policy work_site_check_ins_select on public.work_site_check_ins
  for select using (
    user_id = auth.uid()
    or public.has_org_role(organization_id, array['admin', 'supervisor'])
  );

-- A check-in can only be created for the authenticated user and one of their
-- organizations. If a project UUID is supplied, it must belong to that org.
drop policy if exists work_site_check_ins_insert on public.work_site_check_ins;
create policy work_site_check_ins_insert on public.work_site_check_ins
  for insert with check (
    user_id = auth.uid()
    and public.is_org_member(organization_id)
    and (
      work_site_check_ins.project_id is null
      or exists (
        select 1
        from public.projects project
        where project.id = work_site_check_ins.project_id
          and project.organization_id = work_site_check_ins.organization_id
      )
    )
  );

-- Rows are completed only through complete_work_site_check_in(), which verifies
-- ownership and writes the time entry and checkout timestamp atomically.
drop policy if exists work_site_check_ins_delete on public.work_site_check_ins;
create policy work_site_check_ins_delete on public.work_site_check_ins
  for delete using (
    public.has_org_role(organization_id, array['admin', 'supervisor'])
  );

grant select, insert, delete on table public.work_site_check_ins to authenticated;
grant all on table public.work_site_check_ins to service_role;

create or replace function public.complete_work_site_check_in(p_check_in_id uuid)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  check_in_row public.work_site_check_ins%rowtype;
  new_time_entry_id uuid;
  worked_hours numeric;
  linked_employee_id uuid;
begin
  if auth.uid() is null then
    raise exception 'Kirjautuminen vaaditaan.';
  end if;

  select *
    into check_in_row
    from public.work_site_check_ins
   where id = p_check_in_id
     and user_id = auth.uid()
     and checked_out_at is null
   for update;

  if not found then
    raise exception 'Aktiivista työmaalle kirjautumista ei löytynyt.';
  end if;

  if not public.is_org_member(check_in_row.organization_id) then
    raise exception 'Käyttäjä ei kuulu kirjauksen organisaatioon.';
  end if;

  worked_hours := greatest(
    0.01,
    round((extract(epoch from (statement_timestamp() - check_in_row.checked_in_at)) / 3600)::numeric, 2)
  );

  select employee.id
    into linked_employee_id
    from public.employees employee
   where employee.organization_id = check_in_row.organization_id
     and employee.user_id = check_in_row.user_id
   limit 1;

  insert into public.time_entries (
    organization_id,
    created_by,
    project_id,
    employee_id,
    date,
    employee,
    project,
    hours,
    overtime,
    description,
    status
  ) values (
    check_in_row.organization_id,
    check_in_row.user_id,
    check_in_row.project_id,
    linked_employee_id,
    (check_in_row.checked_in_at at time zone 'Europe/Helsinki')::date,
    check_in_row.employee_name,
    check_in_row.project_name,
    worked_hours,
    0,
    nullif(btrim(check_in_row.description), ''),
    'Odottaa'
  ) returning id into new_time_entry_id;

  update public.work_site_check_ins
     set checked_out_at = statement_timestamp(),
         time_entry_id = new_time_entry_id,
         updated_at = statement_timestamp()
   where id = check_in_row.id;

  return new_time_entry_id;
end;
$$;

revoke all on function public.complete_work_site_check_in(uuid) from public;
grant execute on function public.complete_work_site_check_in(uuid) to authenticated;
