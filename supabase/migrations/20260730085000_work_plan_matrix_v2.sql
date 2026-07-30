begin;

create table if not exists public.project_work_targets (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  project_id uuid not null references public.projects(id) on delete cascade,
  work_plan_id uuid not null references public.project_work_plans(id) on delete cascade,
  created_by uuid references public.profiles(id) on delete set null,
  target_key text not null,
  title text not null,
  location text not null,
  description text,
  earliest_start_date date not null,
  target_end_date date not null,
  sequence_no integer not null,
  default_assignee_user_ids uuid[] not null default array[]::uuid[],
  created_at timestamptz not null default statement_timestamp(),
  updated_at timestamptz not null default statement_timestamp(),
  constraint project_work_targets_dates_check check (target_end_date >= earliest_start_date),
  constraint project_work_targets_sequence_check check (sequence_no >= 1),
  constraint project_work_targets_key_unique unique (work_plan_id, target_key)
);

create table if not exists public.project_work_phase_templates (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  project_id uuid not null references public.projects(id) on delete cascade,
  work_plan_id uuid not null references public.project_work_plans(id) on delete cascade,
  project_phase_id uuid references public.project_phases(id) on delete set null,
  created_by uuid references public.profiles(id) on delete set null,
  phase_key text not null,
  name text not null,
  phase_type text,
  description text,
  duration_workdays integer not null default 1,
  sequence_no integer not null,
  default_priority text not null default 'Normaali',
  planned_start_time time without time zone not null default time '07:00',
  planned_end_time time without time zone not null default time '15:30',
  planned_weekdays smallint[] not null default array[1,2,3,4,5]::smallint[],
  default_assignee_user_ids uuid[] not null default array[]::uuid[],
  created_at timestamptz not null default statement_timestamp(),
  updated_at timestamptz not null default statement_timestamp(),
  constraint project_work_phase_templates_duration_check check (duration_workdays between 1 and 60),
  constraint project_work_phase_templates_sequence_check check (sequence_no >= 1),
  constraint project_work_phase_templates_priority_check check (default_priority in ('Korkea', 'Normaali', 'Matala')),
  constraint project_work_phase_templates_times_check check (planned_end_time > planned_start_time),
  constraint project_work_phase_templates_weekdays_check check (
    cardinality(planned_weekdays) > 0
    and planned_weekdays <@ array[1,2,3,4,5,6,7]::smallint[]
  ),
  constraint project_work_phase_templates_key_unique unique (work_plan_id, phase_key)
);

create index if not exists project_work_targets_plan_order_idx
  on public.project_work_targets (work_plan_id, sequence_no);
create index if not exists project_work_phase_templates_plan_order_idx
  on public.project_work_phase_templates (work_plan_id, sequence_no);
create index if not exists project_work_phase_templates_project_phase_idx
  on public.project_work_phase_templates (project_phase_id)
  where project_phase_id is not null;

alter table public.work_orders
  add column if not exists project_work_target_id uuid references public.project_work_targets(id) on delete set null,
  add column if not exists phase_template_id uuid references public.project_work_phase_templates(id) on delete set null;

create index if not exists work_orders_project_work_target_idx
  on public.work_orders (project_work_target_id, phase_order)
  where project_work_target_id is not null;
create index if not exists work_orders_phase_template_idx
  on public.work_orders (phase_template_id, status)
  where phase_template_id is not null;

alter table public.project_work_targets enable row level security;
alter table public.project_work_phase_templates enable row level security;

drop policy if exists project_work_targets_select on public.project_work_targets;
create policy project_work_targets_select
on public.project_work_targets
for select
to authenticated
using (private.is_org_member(organization_id));

drop policy if exists project_work_targets_write on public.project_work_targets;
create policy project_work_targets_write
on public.project_work_targets
for all
to authenticated
using (private.is_operational_manager(organization_id, (select auth.uid())))
with check (private.is_operational_manager(organization_id, (select auth.uid())));

drop policy if exists project_work_phase_templates_select on public.project_work_phase_templates;
create policy project_work_phase_templates_select
on public.project_work_phase_templates
for select
to authenticated
using (private.is_org_member(organization_id));

drop policy if exists project_work_phase_templates_write on public.project_work_phase_templates;
create policy project_work_phase_templates_write
on public.project_work_phase_templates
for all
to authenticated
using (private.is_operational_manager(organization_id, (select auth.uid())))
with check (private.is_operational_manager(organization_id, (select auth.uid())));

grant select, insert, update, delete on public.project_work_targets to authenticated;
grant select, insert, update, delete on public.project_work_phase_templates to authenticated;
grant all on public.project_work_targets to service_role;
grant all on public.project_work_phase_templates to service_role;

drop trigger if exists project_work_targets_set_updated_at on public.project_work_targets;
create trigger project_work_targets_set_updated_at
before update on public.project_work_targets
for each row execute function public.set_updated_at();

drop trigger if exists project_work_phase_templates_set_updated_at on public.project_work_phase_templates;
create trigger project_work_phase_templates_set_updated_at
before update on public.project_work_phase_templates
for each row execute function public.set_updated_at();

create or replace function public.preview_project_work_plan_conflicts_v2(
  p_organization_id uuid,
  p_items jsonb,
  p_defaults jsonb default '{}'::jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  default_weekdays smallint[];
  result jsonb;
begin
  if auth.uid() is null
     or not private.is_operational_manager(p_organization_id, auth.uid()) then
    raise exception 'Vain työnjohto voi tarkistaa työkokonaisuuden resursseja.' using errcode = '42501';
  end if;

  if jsonb_typeof(p_items) <> 'array' then
    raise exception 'Työmääräysten esikatselun pitää olla taulukkomuodossa.' using errcode = '22023';
  end if;

  select coalesce(array_agg(day_value::smallint order by day_value::smallint), array[1,2,3,4,5]::smallint[])
  into default_weekdays
  from jsonb_array_elements_text(
    coalesce(p_defaults->'planned_weekdays', '[1,2,3,4,5]'::jsonb)
  ) weekday(day_value);

  with item_rows as (
    select
      value as item,
      value->>'target_key' as target_key,
      value->>'phase_key' as phase_key,
      coalesce(value->>'target_title', '') as target_title,
      coalesce(value->>'phase_title', '') as phase_title,
      (value->>'start_date')::date as start_date,
      (value->>'end_date')::date as end_date
    from jsonb_array_elements(p_items)
  ), expanded as (
    select
      row.target_key,
      row.phase_key,
      row.target_title,
      row.phase_title,
      assignee.value::uuid as user_id,
      work_day::date as work_date
    from item_rows row
    cross join lateral jsonb_array_elements_text(
      coalesce(row.item->'assignee_user_ids', '[]'::jsonb)
    ) assignee(value)
    cross join lateral generate_series(
      row.start_date::timestamp,
      row.end_date::timestamp,
      interval '1 day'
    ) work_day
    where extract(isodow from work_day)::smallint = any(default_weekdays)
  ), external_conflicts as (
    select distinct
      'existing_shift'::text as kind,
      item.user_id,
      coalesce(nullif(btrim(profile.full_name), ''), profile.email, 'Nimetön henkilö') as employee_name,
      item.work_date,
      item.target_title,
      item.phase_title,
      coalesce(nullif(btrim(shift.title), ''), nullif(btrim(shift.shift_type), ''), nullif(btrim(shift.project), ''), 'Muu varaus') as conflicting_title
    from expanded item
    join public.shifts shift
      on shift.organization_id = p_organization_id
     and shift.user_id = item.user_id
     and shift.date = item.work_date
    join public.profiles profile on profile.id = item.user_id
  ), internal_conflicts as (
    select distinct
      'internal_overlap'::text as kind,
      first_item.user_id,
      coalesce(nullif(btrim(profile.full_name), ''), profile.email, 'Nimetön henkilö') as employee_name,
      first_item.work_date,
      first_item.target_title,
      first_item.phase_title,
      second_item.target_title || ' – ' || second_item.phase_title as conflicting_title
    from expanded first_item
    join expanded second_item
      on second_item.user_id = first_item.user_id
     and second_item.work_date = first_item.work_date
     and (second_item.target_key, second_item.phase_key) > (first_item.target_key, first_item.phase_key)
    join public.profiles profile on profile.id = first_item.user_id
  ), combined as (
    select * from external_conflicts
    union all
    select * from internal_conflicts
  )
  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'kind', kind,
        'user_id', user_id,
        'employee_name', employee_name,
        'date', work_date,
        'target_title', target_title,
        'phase_title', phase_title,
        'conflicting_title', conflicting_title
      )
      order by work_date, employee_name, target_title, phase_title
    ),
    '[]'::jsonb
  )
  into result
  from (select * from combined limit 100) limited;

  return result;
exception
  when invalid_text_representation or datetime_field_overflow then
    raise exception 'Resurssitarkistuksen päivämäärä tai käyttäjätunniste on virheellinen.' using errcode = '22023';
end;
$$;

revoke all on function public.preview_project_work_plan_conflicts_v2(uuid, jsonb, jsonb) from public, anon;
grant execute on function public.preview_project_work_plan_conflicts_v2(uuid, jsonb, jsonb) to authenticated;

create or replace function public.create_project_work_plan_v2(
  p_organization_id uuid,
  p_project_id uuid,
  p_name text,
  p_description text,
  p_targets jsonb,
  p_phase_templates jsonb,
  p_items jsonb,
  p_defaults jsonb default '{}'::jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  project_row public.projects%rowtype;
  plan_id uuid;
  target_value jsonb;
  phase_value jsonb;
  item_value jsonb;
  target_row public.project_work_targets%rowtype;
  template_row public.project_work_phase_templates%rowtype;
  target_assignees uuid[];
  phase_assignees uuid[];
  item_assignees uuid[];
  effective_assignees uuid[];
  phase_weekdays smallint[];
  phase_start date;
  phase_end date;
  phase_id uuid;
  predecessor_id uuid;
  created_work_order_id uuid;
  created_count integer := 0;
  target_count integer;
  phase_count integer;
  item_count integer;
  default_calendar_sync boolean := coalesce((p_defaults->>'calendar_sync_enabled')::boolean, true);
  default_occupancy text := coalesce(nullif(p_defaults->>'occupancy_status', ''), 'unknown');
  default_resident_notification boolean := coalesce((p_defaults->>'resident_notification_required')::boolean, false);
begin
  if auth.uid() is null
     or not private.is_operational_manager(p_organization_id, auth.uid()) then
    raise exception 'Vain työnjohto voi rakentaa projektin työkokonaisuuksia.' using errcode = '42501';
  end if;

  if nullif(btrim(coalesce(p_name, '')), '') is null then
    raise exception 'Työkokonaisuuden nimi on pakollinen.' using errcode = '23514';
  end if;

  select * into project_row
  from public.projects
  where id = p_project_id
    and organization_id = p_organization_id
    and archived_at is null;

  if not found then
    raise exception 'Projektia ei löytynyt.' using errcode = '23503';
  end if;

  if jsonb_typeof(p_targets) <> 'array'
     or jsonb_typeof(p_phase_templates) <> 'array'
     or jsonb_typeof(p_items) <> 'array' then
    raise exception 'Kohteiden, työvaiheiden ja valittujen töiden pitää olla taulukkomuodossa.' using errcode = '22023';
  end if;

  target_count := jsonb_array_length(p_targets);
  phase_count := jsonb_array_length(p_phase_templates);
  item_count := jsonb_array_length(p_items);

  if target_count < 1 or target_count > 100 then
    raise exception 'Työkohteita voi olla 1–100.' using errcode = '23514';
  end if;
  if phase_count < 1 or phase_count > 20 then
    raise exception 'Työvaihemalleja voi olla 1–20.' using errcode = '23514';
  end if;
  if item_count < 1 or item_count > 500 then
    raise exception 'Valittuja työmääräyksiä voi olla 1–500.' using errcode = '23514';
  end if;
  if default_occupancy not in ('unknown', 'occupied', 'vacant', 'partly_occupied') then
    raise exception 'Virheellinen kohteen käyttötilanne.' using errcode = '23514';
  end if;

  insert into public.project_work_plans (
    organization_id, project_id, created_by, name, description
  ) values (
    p_organization_id,
    p_project_id,
    auth.uid(),
    btrim(p_name),
    nullif(btrim(coalesce(p_description, '')), '')
  ) returning id into plan_id;

  for target_value in
    select value from jsonb_array_elements(p_targets)
    order by coalesce((value->>'sequence_no')::integer, 1)
  loop
    if nullif(btrim(coalesce(target_value->>'key', '')), '') is null
       or nullif(btrim(coalesce(target_value->>'title', '')), '') is null then
      raise exception 'Jokaisella kohteella pitää olla tunniste ja nimi.' using errcode = '23514';
    end if;
    if nullif(target_value->>'earliest_start_date', '') is null
       or nullif(target_value->>'target_end_date', '') is null then
      raise exception 'Kohteelle % pitää antaa aloitus ja tavoitevalmistuminen.', target_value->>'title' using errcode = '23514';
    end if;
    if (target_value->>'target_end_date')::date < (target_value->>'earliest_start_date')::date then
      raise exception 'Kohteen % tavoitevalmistuminen ei voi olla ennen aloitusta.', target_value->>'title' using errcode = '23514';
    end if;

    begin
      select coalesce(array_agg(distinct value::uuid), array[]::uuid[])
      into target_assignees
      from jsonb_array_elements_text(
        coalesce(target_value->'default_assignee_user_ids', '[]'::jsonb)
      ) assignee(value);
    exception
      when invalid_text_representation then
        raise exception 'Kohteen % oletustekijä on virheellinen.', target_value->>'title' using errcode = '23514';
    end;

    insert into public.project_work_targets (
      organization_id,
      project_id,
      work_plan_id,
      created_by,
      target_key,
      title,
      location,
      description,
      earliest_start_date,
      target_end_date,
      sequence_no,
      default_assignee_user_ids
    ) values (
      p_organization_id,
      p_project_id,
      plan_id,
      auth.uid(),
      btrim(target_value->>'key'),
      btrim(target_value->>'title'),
      coalesce(nullif(btrim(target_value->>'location'), ''), btrim(target_value->>'title')),
      nullif(btrim(coalesce(target_value->>'description', '')), ''),
      (target_value->>'earliest_start_date')::date,
      (target_value->>'target_end_date')::date,
      coalesce((target_value->>'sequence_no')::integer, 1),
      target_assignees
    );
  end loop;

  for phase_value in
    select value from jsonb_array_elements(p_phase_templates)
    order by coalesce((value->>'sequence_no')::integer, 1)
  loop
    if nullif(btrim(coalesce(phase_value->>'key', '')), '') is null
       or nullif(btrim(coalesce(phase_value->>'title', '')), '') is null then
      raise exception 'Jokaisella työvaiheella pitää olla tunniste ja nimi.' using errcode = '23514';
    end if;
    if coalesce((phase_value->>'duration_workdays')::integer, 0) not between 1 and 60 then
      raise exception 'Työvaiheen % keston pitää olla 1–60 työpäivää.', phase_value->>'title' using errcode = '23514';
    end if;
    if coalesce(nullif(phase_value->>'priority', ''), 'Normaali') not in ('Korkea', 'Normaali', 'Matala') then
      raise exception 'Työvaiheen % prioriteetti on virheellinen.', phase_value->>'title' using errcode = '23514';
    end if;
    if (phase_value->>'planned_end_time')::time <= (phase_value->>'planned_start_time')::time then
      raise exception 'Työvaiheen % työajan päättymisen pitää olla alkamisen jälkeen.', phase_value->>'title' using errcode = '23514';
    end if;

    select coalesce(array_agg(day_value::smallint order by day_value::smallint), array[1,2,3,4,5]::smallint[])
    into phase_weekdays
    from jsonb_array_elements_text(
      coalesce(phase_value->'planned_weekdays', '[1,2,3,4,5]'::jsonb)
    ) weekday(day_value);

    if cardinality(phase_weekdays) = 0
       or not phase_weekdays <@ array[1,2,3,4,5,6,7]::smallint[] then
      raise exception 'Työvaiheen % työpäivät ovat virheelliset.', phase_value->>'title' using errcode = '23514';
    end if;

    begin
      select coalesce(array_agg(distinct value::uuid), array[]::uuid[])
      into phase_assignees
      from jsonb_array_elements_text(
        coalesce(phase_value->'default_assignee_user_ids', '[]'::jsonb)
      ) assignee(value);
    exception
      when invalid_text_representation then
        raise exception 'Työvaiheen % oletustekijä on virheellinen.', phase_value->>'title' using errcode = '23514';
    end;

    select
      min((item->>'start_date')::date),
      max((item->>'end_date')::date)
    into phase_start, phase_end
    from jsonb_array_elements(p_items) item
    where item->>'phase_key' = phase_value->>'key';

    phase_id := null;
    if phase_start is not null and phase_end is not null then
      insert into public.project_phases (
        organization_id,
        project_id,
        created_by,
        name,
        project_name,
        start_date,
        end_date,
        status,
        progress,
        notes,
        work_plan_id,
        sequence_no,
        phase_type,
        default_priority
      ) values (
        p_organization_id,
        p_project_id,
        auth.uid(),
        btrim(phase_value->>'title'),
        project_row.name,
        phase_start,
        phase_end,
        'Suunniteltu',
        0,
        nullif(btrim(coalesce(phase_value->>'description', '')), ''),
        plan_id,
        coalesce((phase_value->>'sequence_no')::integer, 1),
        nullif(btrim(coalesce(phase_value->>'type', '')), ''),
        coalesce(nullif(phase_value->>'priority', ''), 'Normaali')
      ) returning id into phase_id;
    end if;

    insert into public.project_work_phase_templates (
      organization_id,
      project_id,
      work_plan_id,
      project_phase_id,
      created_by,
      phase_key,
      name,
      phase_type,
      description,
      duration_workdays,
      sequence_no,
      default_priority,
      planned_start_time,
      planned_end_time,
      planned_weekdays,
      default_assignee_user_ids
    ) values (
      p_organization_id,
      p_project_id,
      plan_id,
      phase_id,
      auth.uid(),
      btrim(phase_value->>'key'),
      btrim(phase_value->>'title'),
      nullif(btrim(coalesce(phase_value->>'type', '')), ''),
      nullif(btrim(coalesce(phase_value->>'description', '')), ''),
      (phase_value->>'duration_workdays')::integer,
      coalesce((phase_value->>'sequence_no')::integer, 1),
      coalesce(nullif(phase_value->>'priority', ''), 'Normaali'),
      (phase_value->>'planned_start_time')::time,
      (phase_value->>'planned_end_time')::time,
      phase_weekdays,
      phase_assignees
    );
  end loop;

  for target_row in
    select * from public.project_work_targets
    where work_plan_id = plan_id
    order by sequence_no, title
  loop
    predecessor_id := null;

    for item_value in
      select value from jsonb_array_elements(p_items)
      where value->>'target_key' = target_row.target_key
      order by coalesce((value->>'sequence_no')::integer, 1)
    loop
      select * into template_row
      from public.project_work_phase_templates
      where work_plan_id = plan_id
        and phase_key = item_value->>'phase_key';

      if not found then
        raise exception 'Työvaihemallia % ei löytynyt.', item_value->>'phase_key' using errcode = '23503';
      end if;
      if template_row.project_phase_id is null then
        raise exception 'Työvaiheelle % ei muodostunut projektivaihetta.', template_row.name using errcode = '23514';
      end if;
      if nullif(item_value->>'start_date', '') is null
         or nullif(item_value->>'end_date', '') is null then
        raise exception 'Työlle % – % pitää antaa aloitus ja valmistuminen.', target_row.title, template_row.name using errcode = '23514';
      end if;
      if (item_value->>'end_date')::date < (item_value->>'start_date')::date then
        raise exception 'Työn % – % valmistuminen ei voi olla ennen aloitusta.', target_row.title, template_row.name using errcode = '23514';
      end if;
      if (item_value->>'start_date')::date < target_row.earliest_start_date then
        raise exception 'Työ % – % alkaa ennen kohteen aikaisinta aloitusta.', target_row.title, template_row.name using errcode = '23514';
      end if;

      begin
        select coalesce(array_agg(distinct value::uuid), array[]::uuid[])
        into item_assignees
        from jsonb_array_elements_text(
          coalesce(item_value->'assignee_user_ids', '[]'::jsonb)
        ) assignee(value);
      exception
        when invalid_text_representation then
          raise exception 'Työn % – % tekijä on virheellinen.', target_row.title, template_row.name using errcode = '23514';
      end;

      effective_assignees := case
        when cardinality(item_assignees) > 0 then item_assignees
        when cardinality(target_row.default_assignee_user_ids) > 0 then target_row.default_assignee_user_ids
        else template_row.default_assignee_user_ids
      end;

      if cardinality(effective_assignees) = 0 then
        raise exception 'Työlle % – % pitää valita tekijä.', target_row.title, template_row.name using errcode = '23514';
      end if;

      if exists (
        select 1
        from unnest(effective_assignees) requested(user_id)
        where not exists (
          select 1
          from public.project_members member
          where member.organization_id = p_organization_id
            and member.project_id = p_project_id
            and member.user_id = requested.user_id
        )
      ) then
        raise exception 'Kaikkien tekijöiden pitää kuulua projektitiimiin.' using errcode = '23503';
      end if;

      created_work_order_id := public.save_work_order_v2(
        p_organization_id,
        null,
        p_project_id,
        target_row.title || ' – ' || template_row.name,
        target_row.location,
        target_row.target_end_date,
        (item_value->>'start_date')::date,
        (item_value->>'end_date')::date,
        template_row.planned_start_time,
        template_row.planned_end_time,
        template_row.planned_weekdays,
        default_calendar_sync,
        default_occupancy,
        target_row.target_key,
        case when predecessor_id is null then null else 'Aloitus edellyttää edellisen valitun työvaiheen valmistumista.' end,
        null,
        default_resident_notification,
        template_row.default_priority,
        'Avoin',
        nullif(
          concat_ws(
            E'\n\n',
            case when target_row.description is not null then 'Kohde ' || target_row.title || ': ' || target_row.description else null end,
            case when template_row.description is not null then 'Työvaihe ' || template_row.name || ': ' || template_row.description else null end
          ),
          ''
        ),
        template_row.phase_type,
        'people',
        effective_assignees
      );

      update public.work_orders
      set work_plan_id = plan_id,
          work_package_key = target_row.target_key,
          work_package_title = target_row.title,
          project_phase_id = template_row.project_phase_id,
          phase_order = template_row.sequence_no,
          predecessor_work_order_id = predecessor_id,
          phase_gate_enabled = true,
          project_work_target_id = target_row.id,
          phase_template_id = template_row.id,
          updated_at = statement_timestamp()
      where id = created_work_order_id
        and organization_id = p_organization_id;

      predecessor_id := created_work_order_id;
      created_count := created_count + 1;
    end loop;

    if predecessor_id is null then
      raise exception 'Kohteelle % ei ole valittu yhtään työvaihetta.', target_row.title using errcode = '23514';
    end if;
  end loop;

  perform private.refresh_project_work_plan(plan_id);

  insert into public.audit_logs (
    organization_id, user_id, action, table_name, record_id, metadata
  ) values (
    p_organization_id,
    auth.uid(),
    'project_work_plan_v2_created',
    'project_work_plans',
    plan_id,
    jsonb_build_object(
      'project_id', p_project_id,
      'target_count', target_count,
      'phase_template_count', phase_count,
      'work_order_count', created_count
    )
  );

  return jsonb_build_object(
    'plan_id', plan_id,
    'target_count', target_count,
    'phase_count', phase_count,
    'work_order_count', created_count
  );
exception
  when unique_violation then
    raise exception 'Kohteen tai työvaiheen tunniste on jo käytössä tässä työkokonaisuudessa.' using errcode = '23505';
end;
$$;

revoke all on function public.create_project_work_plan_v2(uuid, uuid, text, text, jsonb, jsonb, jsonb, jsonb) from public, anon;
grant execute on function public.create_project_work_plan_v2(uuid, uuid, text, text, jsonb, jsonb, jsonb, jsonb) to authenticated;

commit;
