begin;

create table if not exists public.time_entry_period_locks (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  period_start date not null,
  period_end date not null,
  reason text,
  locked_by uuid not null references auth.users(id) on delete restrict,
  locked_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  constraint time_entry_period_locks_dates_check check (period_end >= period_start)
);

create unique index if not exists time_entry_period_locks_period_unique
  on public.time_entry_period_locks(organization_id, period_start, period_end);

alter table public.time_entry_period_locks enable row level security;
drop policy if exists time_entry_period_locks_select on public.time_entry_period_locks;
create policy time_entry_period_locks_select on public.time_entry_period_locks
for select to authenticated
using (private.is_org_member(organization_id));
drop policy if exists time_entry_period_locks_insert on public.time_entry_period_locks;
create policy time_entry_period_locks_insert on public.time_entry_period_locks
for insert to authenticated
with check (private.has_org_role(organization_id, array['admin','supervisor']::text[]) and locked_by = auth.uid());
drop policy if exists time_entry_period_locks_delete on public.time_entry_period_locks;
create policy time_entry_period_locks_delete on public.time_entry_period_locks
for delete to authenticated
using (private.has_org_role(organization_id, array['admin']::text[]));

create or replace function private.enforce_time_entry_workflow()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  is_manager boolean;
  is_admin boolean;
begin
  is_manager := private.has_org_role(coalesce(new.organization_id, old.organization_id), array['admin','supervisor']::text[]);
  is_admin := private.has_org_role(coalesce(new.organization_id, old.organization_id), array['admin']::text[]);

  if tg_op = 'INSERT' then
    if not is_manager then
      new.user_id := auth.uid();
      new.created_by := auth.uid();
      new.status := 'Odottaa';
      new.approved_by := null;
      new.approved_at := null;
      new.rejection_reason := null;
      new.locked_at := null;
    end if;
    return new;
  end if;

  if old.locked_at is not null and not is_admin then
    raise exception 'Lukittua palkkakauden tuntikirjausta ei voi muuttaa.' using errcode = '42501';
  end if;

  if not is_manager then
    if old.user_id is distinct from auth.uid() and old.created_by is distinct from auth.uid() then
      raise exception 'Voit muuttaa vain omaa tuntikirjaustasi.' using errcode = '42501';
    end if;
    if old.status <> 'Odottaa' then
      raise exception 'Vain odottavaa tuntikirjausta voi muuttaa.' using errcode = '42501';
    end if;
    if new.organization_id is distinct from old.organization_id
       or new.user_id is distinct from old.user_id
       or new.employee_id is distinct from old.employee_id
       or new.created_by is distinct from old.created_by
       or new.status is distinct from old.status
       or new.approved_by is distinct from old.approved_by
       or new.approved_at is distinct from old.approved_at
       or new.rejection_reason is distinct from old.rejection_reason
       or new.locked_at is distinct from old.locked_at then
      raise exception 'Työntekijä ei voi muuttaa hyväksyntä- tai omistajatietoja.' using errcode = '42501';
    end if;
    return new;
  end if;

  if new.status = 'Hyväksytty' and old.status is distinct from 'Hyväksytty' then
    new.approved_by := auth.uid();
    new.approved_at := now();
    new.rejection_reason := null;
  elsif new.status = 'Hylätty' and old.status is distinct from 'Hylätty' then
    if length(trim(coalesce(new.rejection_reason, ''))) < 3 then
      raise exception 'Hylkäyksen perustelu on pakollinen.' using errcode = '23514';
    end if;
    new.approved_by := null;
    new.approved_at := null;
  elsif new.status = 'Odottaa' then
    new.approved_by := null;
    new.approved_at := null;
    new.rejection_reason := null;
  end if;

  return new;
end;
$$;

revoke all on function private.enforce_time_entry_workflow() from public, anon, authenticated;
drop trigger if exists enforce_time_entry_workflow on public.time_entries;
create trigger enforce_time_entry_workflow
before insert or update on public.time_entries
for each row execute function private.enforce_time_entry_workflow();

create or replace function public.lock_time_entries_period(
  p_organization_id uuid,
  p_period_start date,
  p_period_end date,
  p_reason text default null
)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  lock_id uuid;
begin
  if not private.has_org_role(p_organization_id, array['admin','supervisor']::text[]) then
    raise exception 'not authorized' using errcode = '42501';
  end if;
  if p_period_end < p_period_start then
    raise exception 'Virheellinen ajanjakso.' using errcode = '23514';
  end if;

  insert into public.time_entry_period_locks(
    organization_id, period_start, period_end, reason, locked_by
  ) values (
    p_organization_id, p_period_start, p_period_end, nullif(trim(p_reason), ''), auth.uid()
  )
  on conflict (organization_id, period_start, period_end)
  do update set reason = excluded.reason, locked_by = auth.uid(), locked_at = now()
  returning id into lock_id;

  update public.time_entries
  set locked_at = now()
  where organization_id = p_organization_id
    and date between p_period_start and p_period_end
    and locked_at is null;

  return lock_id;
end;
$$;

revoke all on function public.lock_time_entries_period(uuid, date, date, text) from public, anon;
grant execute on function public.lock_time_entries_period(uuid, date, date, text) to authenticated;

alter table public.work_site_check_ins
  add column if not exists distance_from_site_m double precision,
  add column if not exists geofence_radius_m double precision,
  add column if not exists within_geofence boolean;

create or replace function private.prepare_work_site_check_in()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  site_lat double precision;
  site_lon double precision;
  site_radius double precision;
  earth_radius constant double precision := 6371000;
  lat1 double precision;
  lat2 double precision;
  delta_lat double precision;
  delta_lon double precision;
  a double precision;
begin
  if auth.uid() is null then
    raise exception 'Kirjautuminen vaaditaan.' using errcode = '42501';
  end if;
  new.user_id := auth.uid();
  new.created_by := auth.uid();

  if new.project_id is not null then
    select p.site_latitude, p.site_longitude, p.site_radius_m
      into site_lat, site_lon, site_radius
    from public.projects p
    where p.id = new.project_id and p.organization_id = new.organization_id;

    if site_lat is not null and site_lon is not null and site_radius is not null then
      lat1 := radians(site_lat);
      lat2 := radians(new.latitude);
      delta_lat := radians(new.latitude - site_lat);
      delta_lon := radians(new.longitude - site_lon);
      a := sin(delta_lat / 2)^2 + cos(lat1) * cos(lat2) * sin(delta_lon / 2)^2;
      new.distance_from_site_m := 2 * earth_radius * asin(least(1, sqrt(a)));
      new.geofence_radius_m := site_radius;
      new.within_geofence := new.distance_from_site_m <= site_radius + greatest(coalesce(new.accuracy_m, 0), 0);
    else
      new.distance_from_site_m := null;
      new.geofence_radius_m := null;
      new.within_geofence := null;
    end if;
  end if;

  return new;
end;
$$;

revoke all on function private.prepare_work_site_check_in() from public, anon, authenticated;
drop trigger if exists prepare_work_site_check_in on public.work_site_check_ins;
create trigger prepare_work_site_check_in
before insert on public.work_site_check_ins
for each row execute function private.prepare_work_site_check_in();

commit;
