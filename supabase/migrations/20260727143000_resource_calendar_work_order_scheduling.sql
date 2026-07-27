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
      planned_start_date is null
      or planned_end_date is null
      or planned_end_date >= planned_start_date
    ),
  drop constraint if exists work_orders_planned_times_check,
  add constraint work_orders_planned_times_check
    check (
      planned_start_time is null
      or planned_end_time is null
      or planned_end_time > planned_start_time
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
    select wa.user_id
    from public.work_order_assignees wa
    where item.assignment_scope = 'people'
      and wa.organization_id = item.organization_id
      and wa.work_order_id = item.id

    union

    select pm.user_id
    from public.project_members pm
    where item.assignment_scope = 'project_team'
      and pm.organization_id = item.organization_id
      and pm.project_id = item.project_id
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
  project_name text;
  assignee_label text;
  normalized_user_ids uuid[] := array_remove(coalesce(p_assignee_user_ids, array[]::uuid[]), null);
  normalized_end_date date := coalesce(p_planned_end_date, p_planned_start_date);
  normalized_start_time time := coalesce(p_planned_start_time, time '07:00');
  normalized_end_time time := coalesce(p_planned_end_time, time '15:30');
  normalized_weekdays smallint[] := coalesce(p_planned_weekdays, array[1,2,3,4,5]::smallint[]);
begin
  if auth.uid() is null
     or not private.is_operational_manager(p_organization_id, auth.uid()) then
    raise exception 'Vain työnjohto voi tallentaa työmääräyksiä.' using errcode = '42501';
  end if;

  if nullif(btrim(p_title), '') is null then
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
  if p_occupancy_status not in ('unknown', 'occupied', 'vacant', 'partly_occupied') then
    raise exception 'Virheellinen asumistilanne.' using errcode = '23514';
  end if;
  if p_assignment_scope = 'people' and cardinality(normalized_user_ids) = 0 then
    raise exception 'Valitse vähintään yksi vastuuhenkilö.' using errcode = '23514';
  end if;
  if p_project_id is null and p_assignment_scope = 'project_team' then
    raise exception 'Koko projektitiimi voidaan valita vain projektiin liitetylle työmääräykselle.' using errcode = '23514';
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

  if exists (
    select 1
    from unnest(normalized_user_ids) requested(user_id)
    where not exists (
      select 1
      from public.organization_members member
      where member.organization_id = p_organization_id
        and member.user_id = requested.user_id
    )
  ) then
    raise exception 'Työmääräyksen vastuuhenkilön täytyy kuulua organisaatioon.' using errcode = '23503';
  end if;

  if p_project_id is null then
    project_name := 'Yksittäinen työ';
  else
    select project.name
    into project_name
    from public.projects project
    where project.id = p_project_id
      and project.organization_id = p_organization_id;

    if project_name is null then
      raise exception 'Projektia ei löytynyt.' using errcode = '23503';
    end if;

    if p_assignment_scope = 'project_team' and not exists (
      select 1
      from public.project_members member
      where member.project_id = p_project_id
        and member.organization_id = p_organization_id
    ) then
      raise exception 'Lisää projektille vähintään yksi tiimin jäsen ennen kohdistamista.' using errcode = '23514';
    end if;

    if p_assignment_scope = 'people' and exists (
      select 1
      from unnest(normalized_user_ids) requested(user_id)
      where not exists (
        select 1
        from public.project_members member
        where member.project_id = p_project_id
          and member.organization_id = p_organization_id
          and member.user_id = requested.user_id
      )
    ) then
      raise exception 'Projektiin liitetyn työmääräyksen vastuuhenkilön täytyy kuulua projektitiimiin.' using errcode = '23503';
    end if;
  end if;

  select string_agg(
    coalesce(nullif(btrim(profile.full_name), ''), profile.email),
    ', ' order by coalesce(profile.full_name, profile.email)
  )
  into assignee_label
  from public.profiles profile
  where profile.id = any(normalized_user_ids);

  if p_assignment_scope = 'project_team' then
    assignee_label := 'Projektitiimi';
  end if;

  if p_work_order_id is null then
    insert into public.work_orders (
      organization_id,
      created_by,
      project_id,
      project,
      title,
      assignee,
      location,
      due_date,
      planned_start_date,
      planned_end_date,
      planned_start_time,
      planned_end_time,
      planned_weekdays,
      calendar_sync_enabled,
      occupancy_status,
      work_reference,
      start_constraints,
      access_notes,
      resident_notification_required,
      priority,
      status,
      description,
      type,
      assignment_scope,
      started_at,
      completed_at
    ) values (
      p_organization_id,
      auth.uid(),
      p_project_id,
      project_name,
      btrim(p_title),
      coalesce(assignee_label, ''),
      nullif(btrim(coalesce(p_location, '')), ''),
      p_due_date,
      p_planned_start_date,
      normalized_end_date,
      case when p_planned_start_date is null then null else normalized_start_time end,
      case when p_planned_start_date is null then null else normalized_end_time end,
      normalized_weekdays,
      coalesce(p_calendar_sync_enabled, true),
      p_occupancy_status,
      nullif(btrim(coalesce(p_work_reference, '')), ''),
      nullif(btrim(coalesce(p_start_constraints, '')), ''),
      nullif(btrim(coalesce(p_access_notes, '')), ''),
      coalesce(p_resident_notification_required, false),
      p_priority,
      p_status,
      nullif(btrim(coalesce(p_description, '')), ''),
      nullif(btrim(coalesce(p_type, '')), ''),
      p_assignment_scope,
      case when p_status = 'Käynnissä' then now() else null end,
      case when p_status = 'Valmis' then now() else null end
    )
    returning id into result_id;
  else
    update public.work_orders
    set project_id = p_project_id,
        project = project_name,
        title = btrim(p_title),
        assignee = coalesce(assignee_label, ''),
        location = nullif(btrim(coalesce(p_location, '')), ''),
        due_date = p_due_date,
        planned_start_date = p_planned_start_date,
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
        priority = p_priority,
        status = p_status,
        description = nullif(btrim(coalesce(p_description, '')), ''),
        type = nullif(btrim(coalesce(p_type, '')), ''),
        assignment_scope = p_assignment_scope,
        started_at = case
          when p_status = 'Käynnissä' then coalesce(started_at, now())
          when p_status = 'Avoin' then null
          else started_at
        end,
        completed_at = case
          when p_status = 'Valmis' then coalesce(completed_at, now())
          else null
        end,
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
    organization_id,
    work_order_id,
    user_id,
    assigned_by
  )
  select p_organization_id, result_id, requested.user_id, auth.uid()
  from (select distinct unnest(normalized_user_ids) as user_id) requested;

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
    case when p_work_order_id is null then 'work_order_created' else 'work_order_updated' end,
    'work_orders',
    result_id,
    jsonb_build_object(
      'project_id', p_project_id,
      'standalone', p_project_id is null,
      'location', nullif(btrim(coalesce(p_location, '')), ''),
      'assignment_scope', p_assignment_scope,
      'assignee_user_ids', normalized_user_ids,
      'status', p_status,
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

  update public.work_orders
  set planned_start_date = planned_start_date + day_delta,
      planned_end_date = planned_end_date + day_delta,
      due_date = case when due_date is null then null else due_date + day_delta end,
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
  target_project_id uuid := coalesce(new.project_id, old.project_id);
  target_organization_id uuid := coalesce(new.organization_id, old.organization_id);
  order_id uuid;
begin
  for order_id in
    select work_order.id
    from public.work_orders work_order
    where work_order.organization_id = target_organization_id
      and work_order.project_id = target_project_id
      and work_order.assignment_scope = 'project_team'
  loop
    perform private.sync_work_order_calendar(order_id);
  end loop;

  return coalesce(new, old);
end;
$$;

revoke all on function private.sync_project_team_work_order_calendars() from public, anon, authenticated;

drop trigger if exists sync_project_team_work_order_calendars on public.project_members;
create trigger sync_project_team_work_order_calendars
after insert or delete or update of project_id, user_id on public.project_members
for each row execute function private.sync_project_team_work_order_calendars();

commit;
