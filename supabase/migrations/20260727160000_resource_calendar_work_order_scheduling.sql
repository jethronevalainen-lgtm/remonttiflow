begin;

alter table public.work_orders
  add column if not exists planned_start_date date,
  add column if not exists planned_end_date date,
  add column if not exists planned_start_time time without time zone,
  add column if not exists planned_end_time time without time zone,
  add column if not exists planned_weekdays smallint[] not null default array[1,2,3,4,5]::smallint[],
  add column if not exists calendar_sync_enabled boolean not null default true,
  add column if not exists occupancy_status text not null default 'unknown',
  add column if not exists work_reference text,
  add column if not exists start_constraints text,
  add column if not exists access_notes text,
  add column if not exists resident_notification_required boolean not null default false;

alter table public.work_orders
  drop constraint if exists work_orders_planned_dates_check,
  add constraint work_orders_planned_dates_check
    check (
      (planned_start_date is null and planned_end_date is null)
      or (
        planned_start_date is not null
        and planned_end_date is not null
        and planned_end_date >= planned_start_date
      )
    ),
  drop constraint if exists work_orders_planned_times_check,
  add constraint work_orders_planned_times_check
    check (
      (planned_start_time is null and planned_end_time is null)
      or (
        planned_start_time is not null
        and planned_end_time is not null
        and planned_end_time > planned_start_time
      )
    ),
  drop constraint if exists work_orders_planned_weekdays_check,
  add constraint work_orders_planned_weekdays_check
    check (
      cardinality(planned_weekdays) > 0
      and planned_weekdays <@ array[1,2,3,4,5,6,7]::smallint[]
    ),
  drop constraint if exists work_orders_occupancy_status_check,
  add constraint work_orders_occupancy_status_check
    check (occupancy_status in ('unknown', 'occupied', 'vacant', 'partly_occupied'));

alter table public.shifts
  add column if not exists title text,
  add column if not exists work_order_id uuid references public.work_orders(id) on delete cascade,
  add column if not exists source_type text not null default 'manual';

alter table public.shifts
  drop constraint if exists shifts_source_type_check,
  add constraint shifts_source_type_check
    check (source_type in ('manual', 'work_order')),
  drop constraint if exists shifts_work_order_source_check,
  add constraint shifts_work_order_source_check
    check (
      (source_type = 'manual' and work_order_id is null)
      or (source_type = 'work_order' and work_order_id is not null)
    );

create index if not exists shifts_work_order_id_idx
  on public.shifts(work_order_id)
  where work_order_id is not null;

create unique index if not exists shifts_work_order_user_date_unique
  on public.shifts(organization_id, work_order_id, user_id, date)
  where source_type = 'work_order';

create or replace function private.sync_work_order_calendar(p_work_order_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  item public.work_orders%rowtype;
begin
  select *
  into item
  from public.work_orders
  where id = p_work_order_id;

  if item.id is null then
    return;
  end if;

  delete from public.shifts
  where work_order_id = item.id
    and source_type = 'work_order';

  if not item.calendar_sync_enabled
     or item.status = 'Peruttu'
     or item.planned_start_date is null
     or item.planned_end_date is null then
    return;
  end if;

  insert into public.shifts (
    organization_id,
    created_by,
    user_id,
    employee_name,
    project_id,
    project,
    title,
    date,
    start_time,
    end_time,
    shift_type,
    notes,
    work_order_id,
    source_type
  )
  select
    item.organization_id,
    item.created_by,
    assigned.user_id,
    coalesce(nullif(btrim(profile.full_name), ''), profile.email, 'Nimetön käyttäjä'),
    item.project_id,
    item.project,
    item.title,
    work_day::date,
    to_char(coalesce(item.planned_start_time, time '07:00'), 'HH24:MI'),
    to_char(coalesce(item.planned_end_time, time '15:30'), 'HH24:MI'),
    'Työmääräys',
    concat_ws(' · ', nullif(btrim(item.location), ''), nullif(btrim(item.work_reference), '')),
    item.id,
    'work_order'
  from (
    select assignee.user_id
    from public.work_order_assignees assignee
    where item.assignment_scope = 'people'
      and assignee.organization_id = item.organization_id
      and assignee.work_order_id = item.id

    union

    select member.user_id
    from public.project_members member
    where item.assignment_scope = 'project_team'
      and member.organization_id = item.organization_id
      and member.project_id = item.project_id
  ) assigned
  join public.profiles profile on profile.id = assigned.user_id
  cross join generate_series(
    item.planned_start_date::timestamp,
    item.planned_end_date::timestamp,
    interval '1 day'
  ) work_day
  where extract(isodow from work_day)::smallint = any(item.planned_weekdays)
  on conflict (organization_id, work_order_id, user_id, date)
    where source_type = 'work_order'
  do update set
    employee_name = excluded.employee_name,
    project_id = excluded.project_id,
    project = excluded.project,
    title = excluded.title,
    start_time = excluded.start_time,
    end_time = excluded.end_time,
    shift_type = excluded.shift_type,
    notes = excluded.notes,
    updated_at = now();
end;
$$;

revoke all on function private.sync_work_order_calendar(uuid) from public, anon, authenticated;

create or replace function public.save_work_order_v2(
  p_organization_id uuid,
  p_work_order_id uuid,
  p_project_id uuid,
  p_title text,
  p_location text,
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
security definer
set search_path = ''
as $$
declare
  result_id uuid;
  normalized_end_date date := coalesce(p_planned_end_date, p_planned_start_date);
  normalized_start_time time := coalesce(p_planned_start_time, time '07:00');
  normalized_end_time time := coalesce(p_planned_end_time, time '15:30');
  normalized_weekdays smallint[] := coalesce(p_planned_weekdays, array[1,2,3,4,5]::smallint[]);
begin
  if auth.uid() is null
     or not private.is_operational_manager(p_organization_id, auth.uid()) then
    raise exception 'Vain työnjohto voi tallentaa työmääräyksiä.' using errcode = '42501';
  end if;

  if p_occupancy_status not in ('unknown', 'occupied', 'vacant', 'partly_occupied') then
    raise exception 'Virheellinen asumistilanne.' using errcode = '23514';
  end if;
  if (p_planned_start_date is null) <> (p_planned_end_date is null) then
    raise exception 'Työjaksolle tarvitaan sekä aloitus- että valmistumispäivä.' using errcode = '23514';
  end if;
  if p_planned_start_date is not null and normalized_end_date < p_planned_start_date then
    raise exception 'Suunniteltu valmistumispäivä ei voi olla ennen aloituspäivää.' using errcode = '23514';
  end if;
  if p_planned_start_date is not null and normalized_end_time <= normalized_start_time then
    raise exception 'Päivittäisen työajan päättymisen pitää olla alkamisen jälkeen.' using errcode = '23514';
  end if;
  if p_due_date is not null and normalized_end_date is not null and p_due_date < normalized_end_date then
    raise exception 'Viimeistään valmis -päivä ei voi olla ennen suunniteltua valmistumista.' using errcode = '23514';
  end if;
  if cardinality(normalized_weekdays) = 0
     or not normalized_weekdays <@ array[1,2,3,4,5,6,7]::smallint[] then
    raise exception 'Valitse vähintään yksi kelvollinen työpäivä.' using errcode = '23514';
  end if;

  select public.save_work_order(
    p_organization_id,
    p_work_order_id,
    p_project_id,
    p_title,
    p_due_date,
    p_priority,
    p_status,
    p_description,
    p_type,
    p_assignment_scope,
    p_assignee_user_ids,
    p_location
  )
  into result_id;

  update public.work_orders
  set planned_start_date = p_planned_start_date,
      planned_end_date = normalized_end_date,
      planned_start_time = case when p_planned_start_date is null then null else normalized_start_time end,
      planned_end_time = case when p_planned_start_date is null then null else normalized_end_time end,
      planned_weekdays = normalized_weekdays,
      calendar_sync_enabled = coalesce(p_calendar_sync_enabled, true),
      occupancy_status = p_occupancy_status,
      work_reference = nullif(btrim(coalesce(p_work_reference, '')), ''),
      start_constraints = nullif(btrim(coalesce(p_start_constraints, '')), ''),
      access_notes = nullif(btrim(coalesce(p_access_notes, '')), ''),
      resident_notification_required = coalesce(p_resident_notification_required, false),
      updated_at = now()
  where id = result_id
    and organization_id = p_organization_id;

  perform private.sync_work_order_calendar(result_id);

  insert into public.audit_logs (
    organization_id,
    user_id,
    action,
    table_name,
    record_id,
    metadata
  ) values (
    p_organization_id,
    auth.uid(),
    'work_order_schedule_updated',
    'work_orders',
    result_id,
    jsonb_build_object(
      'planned_start_date', p_planned_start_date,
      'planned_end_date', normalized_end_date,
      'calendar_sync_enabled', p_calendar_sync_enabled,
      'occupancy_status', p_occupancy_status,
      'has_work_reference', nullif(btrim(coalesce(p_work_reference, '')), '') is not null
    )
  );

  return result_id;
end;
$$;

revoke all on function public.save_work_order_v2(
  uuid, uuid, uuid, text, text, date, date, date, time without time zone,
  time without time zone, smallint[], boolean, text, text, text, text, boolean,
  text, text, text, text, text, uuid[]
) from public, anon;
grant execute on function public.save_work_order_v2(
  uuid, uuid, uuid, text, text, date, date, date, time without time zone,
  time without time zone, smallint[], boolean, text, text, text, text, boolean,
  text, text, text, text, text, uuid[]
) to authenticated;

create or replace function public.move_work_order_schedule(
  p_organization_id uuid,
  p_work_order_id uuid,
  p_target_start_date date
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  item public.work_orders%rowtype;
  day_delta integer;
  target_end_date date;
begin
  if auth.uid() is null
     or not private.is_operational_manager(p_organization_id, auth.uid()) then
    raise exception 'Vain työnjohto voi siirtää työmääräyksen aikataulua.' using errcode = '42501';
  end if;

  select *
  into item
  from public.work_orders
  where id = p_work_order_id
    and organization_id = p_organization_id
  for update;

  if item.id is null then
    raise exception 'Työmääräystä ei löytynyt.' using errcode = '23503';
  end if;
  if item.planned_start_date is null or item.planned_end_date is null then
    raise exception 'Työmääräyksellä ei ole siirrettävää työjaksoa.' using errcode = '23514';
  end if;

  day_delta := p_target_start_date - item.planned_start_date;
  target_end_date := item.planned_end_date + day_delta;

  if item.due_date is not null and target_end_date > item.due_date then
    raise exception 'Työjaksoa ei voi siirtää viimeisen valmistumispäivän yli.' using errcode = '23514';
  end if;

  update public.work_orders
  set planned_start_date = p_target_start_date,
      planned_end_date = target_end_date,
      updated_at = now()
  where id = item.id;

  perform private.sync_work_order_calendar(item.id);

  insert into public.audit_logs (
    organization_id, user_id, action, table_name, record_id, metadata
  ) values (
    p_organization_id,
    auth.uid(),
    'work_order_schedule_moved',
    'work_orders',
    item.id,
    jsonb_build_object(
      'previous_start_date', item.planned_start_date,
      'target_start_date', p_target_start_date,
      'previous_end_date', item.planned_end_date,
      'target_end_date', target_end_date,
      'due_date', item.due_date,
      'day_delta', day_delta
    )
  );
end;
$$;

revoke all on function public.move_work_order_schedule(uuid, uuid, date) from public, anon;
grant execute on function public.move_work_order_schedule(uuid, uuid, date) to authenticated;

create or replace function private.sync_project_team_work_order_calendars()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  target_project_id uuid;
  target_organization_id uuid;
  order_id uuid;
begin
  if tg_op in ('DELETE', 'UPDATE') then
    target_project_id := old.project_id;
    target_organization_id := old.organization_id;

    for order_id in
      select work_order.id
      from public.work_orders work_order
      where work_order.organization_id = target_organization_id
        and work_order.project_id = target_project_id
        and work_order.assignment_scope = 'project_team'
    loop
      perform private.sync_work_order_calendar(order_id);
    end loop;
  end if;

  if tg_op in ('INSERT', 'UPDATE') then
    target_project_id := new.project_id;
    target_organization_id := new.organization_id;

    if tg_op <> 'UPDATE'
       or new.project_id is distinct from old.project_id
       or new.organization_id is distinct from old.organization_id
       or new.user_id is distinct from old.user_id then
      for order_id in
        select work_order.id
        from public.work_orders work_order
        where work_order.organization_id = target_organization_id
          and work_order.project_id = target_project_id
          and work_order.assignment_scope = 'project_team'
      loop
        perform private.sync_work_order_calendar(order_id);
      end loop;
    end if;
  end if;

  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end;
$$;

revoke all on function private.sync_project_team_work_order_calendars() from public, anon, authenticated;

drop trigger if exists sync_project_team_work_order_calendars on public.project_members;
create trigger sync_project_team_work_order_calendars
after insert or delete or update on public.project_members
for each row execute function private.sync_project_team_work_order_calendars();

commit;
