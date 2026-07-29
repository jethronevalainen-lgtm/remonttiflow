begin;

alter table public.work_orders
  add column if not exists building_id uuid,
  add column if not exists stairwell_id uuid,
  add column if not exists unit_id uuid,
  add column if not exists location_detail text;

alter table public.work_orders
  drop constraint if exists work_orders_building_id_fkey,
  add constraint work_orders_building_id_fkey
    foreign key (building_id) references public.project_buildings(id) on delete set null,
  drop constraint if exists work_orders_stairwell_id_fkey,
  add constraint work_orders_stairwell_id_fkey
    foreign key (stairwell_id) references public.project_stairwells(id) on delete set null,
  drop constraint if exists work_orders_unit_id_fkey,
  add constraint work_orders_unit_id_fkey
    foreign key (unit_id) references public.project_units(id) on delete set null;

create index if not exists work_orders_building_id_idx
  on public.work_orders(building_id)
  where building_id is not null;

create index if not exists work_orders_stairwell_id_idx
  on public.work_orders(stairwell_id)
  where stairwell_id is not null;

create index if not exists work_orders_unit_id_idx
  on public.work_orders(unit_id)
  where unit_id is not null;

create or replace function private.validate_work_order_location()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  building_row public.project_buildings%rowtype;
  stairwell_row public.project_stairwells%rowtype;
  unit_row public.project_units%rowtype;
begin
  if new.project_id is null then
    if new.building_id is not null or new.stairwell_id is not null or new.unit_id is not null then
      raise exception 'Rakennus, rappu tai huoneisto voidaan valita vain projektiin liitetylle työlle.'
        using errcode = '23514';
    end if;
    return new;
  end if;

  if new.unit_id is not null then
    select *
    into unit_row
    from public.project_units
    where id = new.unit_id
      and organization_id = new.organization_id
      and project_id = new.project_id;

    if unit_row.id is null then
      raise exception 'Valittu huoneisto ei kuulu työmääräyksen projektiin.'
        using errcode = '23503';
    end if;

    new.building_id := unit_row.building_id;
    new.stairwell_id := unit_row.stairwell_id;
  end if;

  if new.stairwell_id is not null then
    select *
    into stairwell_row
    from public.project_stairwells
    where id = new.stairwell_id
      and organization_id = new.organization_id
      and project_id = new.project_id;

    if stairwell_row.id is null then
      raise exception 'Valittu rappu ei kuulu työmääräyksen projektiin.'
        using errcode = '23503';
    end if;

    if new.building_id is not null and new.building_id <> stairwell_row.building_id then
      raise exception 'Valittu rappu ei kuulu valittuun rakennukseen.'
        using errcode = '23503';
    end if;
    new.building_id := stairwell_row.building_id;
  end if;

  if new.building_id is not null then
    select *
    into building_row
    from public.project_buildings
    where id = new.building_id
      and organization_id = new.organization_id
      and project_id = new.project_id;

    if building_row.id is null then
      raise exception 'Valittu rakennus ei kuulu työmääräyksen projektiin.'
        using errcode = '23503';
    end if;
  end if;

  return new;
end;
$$;

revoke all on function private.validate_work_order_location() from public, anon, authenticated;

drop trigger if exists validate_work_order_location on public.work_orders;
create trigger validate_work_order_location
before insert or update of organization_id, project_id, building_id, stairwell_id, unit_id
on public.work_orders
for each row execute function private.validate_work_order_location();

create or replace function public.save_work_order_v3(
  p_organization_id uuid,
  p_work_order_id uuid,
  p_project_id uuid,
  p_title text,
  p_building_id uuid,
  p_stairwell_id uuid,
  p_unit_id uuid,
  p_location_detail text,
  p_due_date date,
  p_planned_start_date date,
  p_planned_end_date date,
  p_planned_start_time time without time zone,
  p_planned_end_time time without time zone,
  p_planned_weekdays smallint[],
  p_calendar_sync_enabled boolean,
  p_occupancy_status text,
  p_work_reference text,
  p_start_constraints text,
  p_access_notes text,
  p_resident_notification_required boolean,
  p_priority text,
  p_status text,
  p_description text,
  p_type text,
  p_assignment_scope text,
  p_assignee_user_ids uuid[]
)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  result_id uuid;
  building_name text;
  stairwell_name text;
  unit_code text;
  location_label text;
begin
  if p_building_id is not null then
    select name
    into building_name
    from public.project_buildings
    where id = p_building_id
      and organization_id = p_organization_id
      and project_id = p_project_id;
  end if;

  if p_stairwell_id is not null then
    select name
    into stairwell_name
    from public.project_stairwells
    where id = p_stairwell_id
      and organization_id = p_organization_id
      and project_id = p_project_id;
  end if;

  if p_unit_id is not null then
    select unit_code
    into unit_code
    from public.project_units
    where id = p_unit_id
      and organization_id = p_organization_id
      and project_id = p_project_id;
  end if;

  location_label := nullif(concat_ws(
    ' · ',
    building_name,
    stairwell_name,
    unit_code,
    nullif(btrim(coalesce(p_location_detail, '')), '')
  ), '');

  select public.save_work_order_v2(
    p_organization_id,
    p_work_order_id,
    p_project_id,
    p_title,
    location_label,
    p_due_date,
    p_planned_start_date,
    p_planned_end_date,
    p_planned_start_time,
    p_planned_end_time,
    p_planned_weekdays,
    p_calendar_sync_enabled,
    p_occupancy_status,
    p_work_reference,
    p_start_constraints,
    p_access_notes,
    p_resident_notification_required,
    p_priority,
    p_status,
    p_description,
    p_type,
    p_assignment_scope,
    p_assignee_user_ids
  )
  into result_id;

  update public.work_orders
  set building_id = p_building_id,
      stairwell_id = p_stairwell_id,
      unit_id = p_unit_id,
      location_detail = nullif(btrim(coalesce(p_location_detail, '')), ''),
      updated_at = now()
  where id = result_id
    and organization_id = p_organization_id;

  return result_id;
end;
$$;

revoke all on function public.save_work_order_v3(
  uuid, uuid, uuid, text, uuid, uuid, uuid, text, date, date, date,
  time without time zone, time without time zone, smallint[], boolean, text,
  text, text, text, boolean, text, text, text, text, text, uuid[]
) from public, anon;

grant execute on function public.save_work_order_v3(
  uuid, uuid, uuid, text, uuid, uuid, uuid, text, date, date, date,
  time without time zone, time without time zone, smallint[], boolean, text,
  text, text, text, boolean, text, text, text, text, text, uuid[]
) to authenticated;

commit;
