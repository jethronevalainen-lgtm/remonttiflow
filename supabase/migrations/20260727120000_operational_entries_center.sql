begin;

create table if not exists public.operational_entries (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  project_id uuid references public.projects(id) on delete set null,
  work_order_id uuid references public.work_orders(id) on delete set null,
  equipment_id uuid references public.equipment(id) on delete set null,
  entry_type text not null,
  occurred_on date not null default current_date,
  title text,
  description text,
  quantity numeric(12,3),
  unit text,
  distance_km numeric(12,2),
  duration_hours numeric(12,2),
  meter_start numeric(14,2),
  meter_end numeric(14,2),
  amount_cents bigint,
  start_location text,
  end_location text,
  status text not null default 'Odottaa',
  approved_by uuid references auth.users(id) on delete set null,
  approved_at timestamptz,
  rejection_reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint operational_entries_type_check check (
    entry_type in ('mileage', 'material', 'equipment_usage', 'daily_note')
  ),
  constraint operational_entries_status_check check (
    status in ('Odottaa', 'Hyväksytty', 'Hylätty')
  ),
  constraint operational_entries_amount_check check (amount_cents is null or amount_cents >= 0),
  constraint operational_entries_type_fields_check check (
    (entry_type = 'mileage' and distance_km > 0)
    or (entry_type = 'material' and nullif(btrim(title), '') is not null and quantity > 0 and nullif(btrim(unit), '') is not null)
    or (entry_type = 'equipment_usage' and equipment_id is not null and duration_hours > 0)
    or (entry_type = 'daily_note' and char_length(btrim(coalesce(description, ''))) >= 10)
  ),
  constraint operational_entries_meter_check check (
    meter_start is null or meter_end is null or meter_end >= meter_start
  )
);

create index if not exists operational_entries_org_date_idx
  on public.operational_entries(organization_id, occurred_on desc, created_at desc);
create index if not exists operational_entries_user_date_idx
  on public.operational_entries(organization_id, user_id, occurred_on desc);
create index if not exists operational_entries_project_idx
  on public.operational_entries(organization_id, project_id, occurred_on desc);
create index if not exists operational_entries_status_idx
  on public.operational_entries(organization_id, status, occurred_on desc);

alter table public.operational_entries enable row level security;
revoke all on public.operational_entries from anon, authenticated;
grant select on public.operational_entries to authenticated;

drop policy if exists operational_entries_select on public.operational_entries;
create policy operational_entries_select
on public.operational_entries
for select
to authenticated
using (
  private.has_org_role(organization_id, array['admin', 'supervisor']::text[])
  or user_id = (select auth.uid())
);

create or replace function private.touch_operational_entry()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

revoke all on function private.touch_operational_entry() from public, anon, authenticated;

drop trigger if exists operational_entries_touch on public.operational_entries;
create trigger operational_entries_touch
before update on public.operational_entries
for each row execute function private.touch_operational_entry();

create or replace function public.operational_entry_catalog(p_organization_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = pg_catalog, public
as $$
declare
  management boolean;
begin
  if auth.uid() is null then
    raise exception 'Kirjautuminen vaaditaan.' using errcode = '42501';
  end if;
  if not private.is_org_member(p_organization_id) then
    raise exception 'Et kuulu tähän organisaatioon.' using errcode = '42501';
  end if;
  management := private.has_org_role(p_organization_id, array['admin', 'supervisor']::text[]);

  return jsonb_build_object(
    'projects', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', p.id,
        'name', p.name,
        'projectNumber', p.project_number,
        'status', p.status
      ) order by p.name)
      from public.projects p
      where p.organization_id = p_organization_id
        and p.archived_at is null
        and (management or private.can_access_project(p.id, p.organization_id, auth.uid()))
    ), '[]'::jsonb),
    'equipment', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', e.id,
        'name', e.name,
        'assetNumber', e.asset_number,
        'type', e.type,
        'status', e.status,
        'projectId', e.current_project_id
      ) order by e.name)
      from public.equipment e
      where e.organization_id = p_organization_id
        and e.archived_at is null
        and (
          management
          or e.current_project_id is null
          or private.can_access_project(e.current_project_id, e.organization_id, auth.uid())
        )
    ), '[]'::jsonb)
  );
end;
$$;

create or replace function public.create_operational_entry(
  p_organization_id uuid,
  p_entry_type text,
  p_occurred_on date,
  p_project_id uuid default null,
  p_work_order_id uuid default null,
  p_equipment_id uuid default null,
  p_title text default null,
  p_description text default null,
  p_quantity numeric default null,
  p_unit text default null,
  p_distance_km numeric default null,
  p_duration_hours numeric default null,
  p_meter_start numeric default null,
  p_meter_end numeric default null,
  p_amount_cents bigint default null,
  p_start_location text default null,
  p_end_location text default null
)
returns uuid
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  result_id uuid;
  management boolean;
begin
  if auth.uid() is null then
    raise exception 'Kirjautuminen vaaditaan.' using errcode = '42501';
  end if;
  if not private.is_org_member(p_organization_id) then
    raise exception 'Et kuulu tähän organisaatioon.' using errcode = '42501';
  end if;
  management := private.has_org_role(p_organization_id, array['admin', 'supervisor']::text[]);

  if p_entry_type not in ('mileage', 'material', 'equipment_usage', 'daily_note') then
    raise exception 'Tuntematon kirjaustyyppi.' using errcode = '23514';
  end if;
  if p_occurred_on is null or p_occurred_on > current_date + 1 then
    raise exception 'Kirjauksen päivämäärä on virheellinen.' using errcode = '23514';
  end if;
  if p_project_id is not null and not exists (
    select 1 from public.projects p
    where p.id = p_project_id
      and p.organization_id = p_organization_id
      and p.archived_at is null
      and (management or private.can_access_project(p.id, p.organization_id, auth.uid()))
  ) then
    raise exception 'Projekti ei kuulu käyttöoikeuksiisi.' using errcode = '42501';
  end if;
  if p_work_order_id is not null and not exists (
    select 1 from public.work_orders wo
    where wo.id = p_work_order_id
      and wo.organization_id = p_organization_id
      and (p_project_id is null or wo.project_id = p_project_id)
      and (management or private.can_access_work_order(wo.id, wo.organization_id, auth.uid()))
  ) then
    raise exception 'Työmääräys ei kuulu käyttöoikeuksiisi tai valittuun projektiin.' using errcode = '42501';
  end if;
  if p_equipment_id is not null and not exists (
    select 1 from public.equipment e
    where e.id = p_equipment_id
      and e.organization_id = p_organization_id
      and e.archived_at is null
  ) then
    raise exception 'Kalustoa ei löytynyt tästä organisaatiosta.' using errcode = '23503';
  end if;
  if char_length(btrim(coalesce(p_description, ''))) > 4000 then
    raise exception 'Kuvaus voi olla enintään 4 000 merkkiä.' using errcode = '23514';
  end if;

  insert into public.operational_entries(
    organization_id, user_id, project_id, work_order_id, equipment_id,
    entry_type, occurred_on, title, description, quantity, unit, distance_km,
    duration_hours, meter_start, meter_end, amount_cents, start_location, end_location
  ) values (
    p_organization_id, auth.uid(), p_project_id, p_work_order_id, p_equipment_id,
    p_entry_type, p_occurred_on, nullif(btrim(coalesce(p_title, '')), ''),
    nullif(btrim(coalesce(p_description, '')), ''), p_quantity,
    nullif(btrim(coalesce(p_unit, '')), ''), p_distance_km, p_duration_hours,
    p_meter_start, p_meter_end, p_amount_cents,
    nullif(btrim(coalesce(p_start_location, '')), ''),
    nullif(btrim(coalesce(p_end_location, '')), '')
  ) returning id into result_id;

  insert into public.audit_logs(organization_id, user_id, action, table_name, record_id, metadata)
  values (
    p_organization_id,
    auth.uid(),
    'operational_entry_created',
    'operational_entries',
    result_id,
    jsonb_build_object('entry_type', p_entry_type, 'project_id', p_project_id)
  );
  return result_id;
end;
$$;

create or replace function public.operational_entries_for_user(
  p_organization_id uuid,
  p_entry_type text default null,
  p_date_from date default null,
  p_date_to date default null,
  p_project_id uuid default null,
  p_status text default null
)
returns table(
  id uuid,
  user_id uuid,
  user_name text,
  project_id uuid,
  project_name text,
  work_order_id uuid,
  work_order_title text,
  equipment_id uuid,
  equipment_name text,
  entry_type text,
  occurred_on date,
  title text,
  description text,
  quantity numeric,
  unit text,
  distance_km numeric,
  duration_hours numeric,
  meter_start numeric,
  meter_end numeric,
  amount_cents bigint,
  start_location text,
  end_location text,
  status text,
  rejection_reason text,
  created_at timestamptz,
  approved_at timestamptz
)
language plpgsql
stable
security definer
set search_path = pg_catalog, public
as $$
declare
  management boolean;
begin
  if auth.uid() is null then
    raise exception 'Kirjautuminen vaaditaan.' using errcode = '42501';
  end if;
  if not private.is_org_member(p_organization_id) then
    raise exception 'Et kuulu tähän organisaatioon.' using errcode = '42501';
  end if;
  management := private.has_org_role(p_organization_id, array['admin', 'supervisor']::text[]);

  return query
  select
    oe.id,
    oe.user_id,
    coalesce(nullif(btrim(pr.full_name), ''), nullif(btrim(pr.email), ''), 'Käyttäjä'),
    oe.project_id,
    p.name,
    oe.work_order_id,
    wo.title,
    oe.equipment_id,
    e.name,
    oe.entry_type,
    oe.occurred_on,
    oe.title,
    oe.description,
    oe.quantity,
    oe.unit,
    oe.distance_km,
    oe.duration_hours,
    oe.meter_start,
    oe.meter_end,
    oe.amount_cents,
    oe.start_location,
    oe.end_location,
    oe.status,
    oe.rejection_reason,
    oe.created_at,
    oe.approved_at
  from public.operational_entries oe
  left join public.profiles pr on pr.id = oe.user_id
  left join public.projects p on p.id = oe.project_id and p.organization_id = oe.organization_id
  left join public.work_orders wo on wo.id = oe.work_order_id and wo.organization_id = oe.organization_id
  left join public.equipment e on e.id = oe.equipment_id and e.organization_id = oe.organization_id
  where oe.organization_id = p_organization_id
    and (management or oe.user_id = auth.uid())
    and (p_entry_type is null or oe.entry_type = p_entry_type)
    and (p_date_from is null or oe.occurred_on >= p_date_from)
    and (p_date_to is null or oe.occurred_on <= p_date_to)
    and (p_project_id is null or oe.project_id = p_project_id)
    and (p_status is null or oe.status = p_status)
  order by oe.occurred_on desc, oe.created_at desc
  limit 1000;
end;
$$;

create or replace function public.decide_operational_entry(
  p_organization_id uuid,
  p_entry_id uuid,
  p_status text,
  p_rejection_reason text default null
)
returns void
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
begin
  if not private.has_org_role(p_organization_id, array['admin', 'supervisor']::text[]) then
    raise exception 'Vain työnjohto voi hyväksyä kirjauksia.' using errcode = '42501';
  end if;
  if p_status not in ('Hyväksytty', 'Hylätty') then
    raise exception 'Päätös voi olla vain hyväksytty tai hylätty.' using errcode = '23514';
  end if;
  if p_status = 'Hylätty' and char_length(btrim(coalesce(p_rejection_reason, ''))) < 3 then
    raise exception 'Anna hylkäykselle perustelu.' using errcode = '23514';
  end if;

  update public.operational_entries
  set status = p_status,
      approved_by = auth.uid(),
      approved_at = now(),
      rejection_reason = case when p_status = 'Hylätty' then btrim(p_rejection_reason) else null end
  where id = p_entry_id
    and organization_id = p_organization_id;
  if not found then
    raise exception 'Kirjausta ei löytynyt.' using errcode = 'P0002';
  end if;

  insert into public.audit_logs(organization_id, user_id, action, table_name, record_id, metadata)
  values (
    p_organization_id,
    auth.uid(),
    'operational_entry_decided',
    'operational_entries',
    p_entry_id,
    jsonb_build_object('status', p_status, 'rejection_reason', p_rejection_reason)
  );
end;
$$;

revoke all on function public.operational_entry_catalog(uuid) from public, anon;
revoke all on function public.create_operational_entry(uuid, text, date, uuid, uuid, uuid, text, text, numeric, text, numeric, numeric, numeric, numeric, bigint, text, text) from public, anon;
revoke all on function public.operational_entries_for_user(uuid, text, date, date, uuid, text) from public, anon;
revoke all on function public.decide_operational_entry(uuid, uuid, text, text) from public, anon;

grant execute on function public.operational_entry_catalog(uuid) to authenticated;
grant execute on function public.create_operational_entry(uuid, text, date, uuid, uuid, uuid, text, text, numeric, text, numeric, numeric, numeric, numeric, bigint, text, text) to authenticated;
grant execute on function public.operational_entries_for_user(uuid, text, date, date, uuid, text) to authenticated;
grant execute on function public.decide_operational_entry(uuid, uuid, text, text) to authenticated;

commit;
