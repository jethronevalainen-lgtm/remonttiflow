begin;

create table if not exists public.project_work_plans (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  project_id uuid not null references public.projects(id) on delete cascade,
  created_by uuid references public.profiles(id) on delete set null,
  name text not null,
  description text,
  status text not null default 'Suunniteltu'
    check (status in ('Suunniteltu', 'Käynnissä', 'Valmis', 'Arkistoitu')),
  progress numeric not null default 0
    check (progress >= 0 and progress <= 100),
  created_at timestamptz not null default statement_timestamp(),
  updated_at timestamptz not null default statement_timestamp()
);

create index if not exists project_work_plans_project_idx
  on public.project_work_plans (organization_id, project_id, created_at desc);

alter table public.project_work_plans enable row level security;

drop policy if exists project_work_plans_select on public.project_work_plans;
create policy project_work_plans_select
on public.project_work_plans
for select
to authenticated
using (private.is_org_member(organization_id));

drop policy if exists project_work_plans_insert on public.project_work_plans;
create policy project_work_plans_insert
on public.project_work_plans
for insert
to authenticated
with check (private.is_operational_manager(organization_id, (select auth.uid())));

drop policy if exists project_work_plans_update on public.project_work_plans;
create policy project_work_plans_update
on public.project_work_plans
for update
to authenticated
using (private.is_operational_manager(organization_id, (select auth.uid())))
with check (private.is_operational_manager(organization_id, (select auth.uid())));

drop policy if exists project_work_plans_delete on public.project_work_plans;
create policy project_work_plans_delete
on public.project_work_plans
for delete
to authenticated
using (private.is_operational_manager(organization_id, (select auth.uid())));

grant select, insert, update, delete on public.project_work_plans to authenticated;
grant all on public.project_work_plans to service_role;

drop trigger if exists project_work_plans_set_updated_at on public.project_work_plans;
create trigger project_work_plans_set_updated_at
before update on public.project_work_plans
for each row execute function public.set_updated_at();

alter table public.project_phases
  add column if not exists work_plan_id uuid references public.project_work_plans(id) on delete cascade,
  add column if not exists sequence_no integer not null default 1,
  add column if not exists phase_type text,
  add column if not exists default_priority text not null default 'Normaali';

alter table public.project_phases
  drop constraint if exists project_phases_sequence_no_check,
  add constraint project_phases_sequence_no_check check (sequence_no >= 1),
  drop constraint if exists project_phases_default_priority_check,
  add constraint project_phases_default_priority_check
    check (default_priority in ('Korkea', 'Normaali', 'Matala'));

create index if not exists project_phases_work_plan_order_idx
  on public.project_phases (work_plan_id, sequence_no)
  where work_plan_id is not null;

alter table public.work_orders
  add column if not exists work_plan_id uuid references public.project_work_plans(id) on delete set null,
  add column if not exists work_package_key text,
  add column if not exists work_package_title text,
  add column if not exists project_phase_id uuid references public.project_phases(id) on delete set null,
  add column if not exists phase_order integer,
  add column if not exists predecessor_work_order_id uuid references public.work_orders(id) on delete set null,
  add column if not exists phase_gate_enabled boolean not null default true;

alter table public.work_orders
  drop constraint if exists work_orders_phase_order_check,
  add constraint work_orders_phase_order_check
    check (phase_order is null or phase_order >= 1),
  drop constraint if exists work_orders_plan_metadata_check,
  add constraint work_orders_plan_metadata_check
    check (
      (work_plan_id is null and work_package_key is null and project_phase_id is null and phase_order is null)
      or
      (work_plan_id is not null and nullif(btrim(work_package_key), '') is not null
        and project_phase_id is not null and phase_order is not null)
    );

create index if not exists work_orders_work_plan_package_idx
  on public.work_orders (work_plan_id, work_package_key, phase_order)
  where work_plan_id is not null;
create unique index if not exists work_orders_plan_package_phase_unique_idx
  on public.work_orders (work_plan_id, work_package_key, project_phase_id)
  where work_plan_id is not null;
create index if not exists work_orders_project_phase_idx
  on public.work_orders (project_phase_id, status)
  where project_phase_id is not null;
create index if not exists work_orders_predecessor_idx
  on public.work_orders (predecessor_work_order_id)
  where predecessor_work_order_id is not null;

create or replace function private.refresh_project_work_plan(p_work_plan_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  phase_count integer;
  average_progress numeric;
  active_count integer;
begin
  if p_work_plan_id is null then
    return;
  end if;

  select
    count(*),
    coalesce(avg(phase.progress), 0),
    count(*) filter (where phase.status in ('Käynnissä', 'Myöhässä'))
  into phase_count, average_progress, active_count
  from public.project_phases phase
  where phase.work_plan_id = p_work_plan_id;

  update public.project_work_plans plan
  set progress = round(average_progress, 2),
      status = case
        when plan.status = 'Arkistoitu' then 'Arkistoitu'
        when phase_count > 0 and average_progress >= 100 then 'Valmis'
        when active_count > 0 or average_progress > 0 then 'Käynnissä'
        else 'Suunniteltu'
      end,
      updated_at = statement_timestamp()
  where plan.id = p_work_plan_id;
end;
$$;

revoke all on function private.refresh_project_work_plan(uuid) from public, anon;

create or replace function private.refresh_project_phase_progress(p_project_phase_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  phase_row public.project_phases%rowtype;
  work_count integer;
  completed_count integer;
  active_count integer;
  calculated_progress numeric;
begin
  if p_project_phase_id is null then
    return;
  end if;

  select * into phase_row
  from public.project_phases
  where id = p_project_phase_id;

  if not found then
    return;
  end if;

  select
    count(*),
    count(*) filter (where status in ('Valmis', 'Peruttu')),
    count(*) filter (where status = 'Käynnissä')
  into work_count, completed_count, active_count
  from public.work_orders
  where project_phase_id = p_project_phase_id;

  calculated_progress := case
    when work_count = 0 then 0
    else (completed_count::numeric / work_count::numeric) * 100
  end;

  update public.project_phases
  set progress = round(calculated_progress, 2),
      status = case
        when work_count > 0 and completed_count = work_count then 'Valmis'
        when active_count > 0 or completed_count > 0 then 'Käynnissä'
        when end_date < current_date then 'Myöhässä'
        else 'Suunniteltu'
      end,
      updated_at = statement_timestamp()
  where id = p_project_phase_id;

  perform private.refresh_project_work_plan(phase_row.work_plan_id);
end;
$$;

revoke all on function private.refresh_project_phase_progress(uuid) from public, anon;

create or replace function private.refresh_work_order_phase_progress_trigger()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'DELETE' then
    perform private.refresh_project_phase_progress(old.project_phase_id);
    return old;
  end if;

  perform private.refresh_project_phase_progress(new.project_phase_id);
  if tg_op = 'UPDATE' and old.project_phase_id is distinct from new.project_phase_id then
    perform private.refresh_project_phase_progress(old.project_phase_id);
  end if;
  return new;
end;
$$;

revoke all on function private.refresh_work_order_phase_progress_trigger() from public, anon;

drop trigger if exists work_orders_refresh_phase_progress on public.work_orders;
create trigger work_orders_refresh_phase_progress
after insert or delete or update of status, project_phase_id
on public.work_orders
for each row execute function private.refresh_work_order_phase_progress_trigger();

create or replace function private.enforce_work_order_phase_gate_trigger()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  predecessor_status text;
  predecessor_title text;
begin
  if new.status = 'Käynnissä'
     and old.status is distinct from new.status
     and new.phase_gate_enabled
     and new.predecessor_work_order_id is not null then
    select status, title
    into predecessor_status, predecessor_title
    from public.work_orders
    where id = new.predecessor_work_order_id
      and organization_id = new.organization_id;

    if predecessor_status is null then
      raise exception 'Työvaiheen edeltävää työmääräystä ei löytynyt.' using errcode = '23503';
    end if;

    if predecessor_status not in ('Valmis', 'Peruttu') then
      raise exception 'Edellinen työvaihe "%" pitää valmistua ennen tämän vaiheen aloittamista.',
        coalesce(predecessor_title, 'Nimetön työvaihe') using errcode = '23514';
    end if;
  end if;

  return new;
end;
$$;

revoke all on function private.enforce_work_order_phase_gate_trigger() from public, anon;

drop trigger if exists work_orders_enforce_phase_gate on public.work_orders;
create trigger work_orders_enforce_phase_gate
before update of status on public.work_orders
for each row execute function private.enforce_work_order_phase_gate_trigger();

create or replace function public.create_project_work_plan(
  p_organization_id uuid,
  p_project_id uuid,
  p_name text,
  p_description text,
  p_targets jsonb,
  p_phases jsonb,
  p_defaults jsonb default '{}'::jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  project_row public.projects%rowtype;
  v_work_plan_id uuid;
  target_value jsonb;
  phase_value jsonb;
  phase_ids uuid[] := array[]::uuid[];
  phase_id uuid;
  phase_index integer;
  target_index integer := 0;
  target_count integer;
  phase_count integer;
  total_count integer;
  target_key text;
  target_title text;
  target_location text;
  assignee_ids uuid[];
  created_work_order_id uuid;
  predecessor_id uuid;
  created_count integer := 0;
  default_weekdays smallint[];
  default_start_time time without time zone := coalesce(nullif(p_defaults->>'planned_start_time', '')::time, time '07:00');
  default_end_time time without time zone := coalesce(nullif(p_defaults->>'planned_end_time', '')::time, time '15:30');
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

  if jsonb_typeof(p_targets) <> 'array' or jsonb_typeof(p_phases) <> 'array' then
    raise exception 'Työkohteiden ja työvaiheiden pitää olla taulukkomuodossa.' using errcode = '22023';
  end if;

  target_count := jsonb_array_length(p_targets);
  phase_count := jsonb_array_length(p_phases);
  total_count := target_count * phase_count;

  if target_count < 1 or target_count > 100 then
    raise exception 'Työkohteita voi olla yhdessä kokonaisuudessa 1–100.' using errcode = '23514';
  end if;
  if phase_count < 1 or phase_count > 20 then
    raise exception 'Työvaiheita voi olla yhdessä kokonaisuudessa 1–20.' using errcode = '23514';
  end if;
  if total_count > 500 then
    raise exception 'Työkokonaisuus muodostaisi yli 500 työmääräystä. Jaa se useampaan kokonaisuuteen.' using errcode = '23514';
  end if;

  if default_occupancy not in ('unknown', 'occupied', 'vacant', 'partly_occupied') then
    raise exception 'Virheellinen kohteen käyttötilanne.' using errcode = '23514';
  end if;
  if default_end_time <= default_start_time then
    raise exception 'Päivittäisen työajan päättymisen pitää olla alkamisajan jälkeen.' using errcode = '23514';
  end if;

  select coalesce(array_agg(day_value::smallint order by day_value::smallint), array[1,2,3,4,5]::smallint[])
  into default_weekdays
  from jsonb_array_elements_text(
    coalesce(p_defaults->'planned_weekdays', '[1,2,3,4,5]'::jsonb)
  ) weekday(day_value);

  if cardinality(default_weekdays) = 0
     or not default_weekdays <@ array[1,2,3,4,5,6,7]::smallint[] then
    raise exception 'Työpäivävalinta on virheellinen.' using errcode = '23514';
  end if;

  insert into public.project_work_plans (
    organization_id, project_id, created_by, name, description
  ) values (
    p_organization_id, p_project_id, auth.uid(), btrim(p_name),
    nullif(btrim(coalesce(p_description, '')), '')
  ) returning id into v_work_plan_id;

  phase_index := 0;
  for phase_value in select value from jsonb_array_elements(p_phases)
  loop
    phase_index := phase_index + 1;

    if nullif(btrim(coalesce(phase_value->>'title', '')), '') is null then
      raise exception 'Työvaiheen % nimi puuttuu.', phase_index using errcode = '23514';
    end if;
    if nullif(phase_value->>'start_date', '') is null
       or nullif(phase_value->>'end_date', '') is null then
      raise exception 'Työvaiheelle % pitää antaa aloitus- ja valmistumispäivä.', phase_index using errcode = '23514';
    end if;
    if (phase_value->>'end_date')::date < (phase_value->>'start_date')::date then
      raise exception 'Työvaiheen % valmistumispäivä ei voi olla ennen aloitusta.', phase_index using errcode = '23514';
    end if;
    if coalesce(nullif(phase_value->>'priority', ''), 'Normaali') not in ('Korkea', 'Normaali', 'Matala') then
      raise exception 'Työvaiheen % prioriteetti on virheellinen.', phase_index using errcode = '23514';
    end if;

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
      (phase_value->>'start_date')::date,
      (phase_value->>'end_date')::date,
      'Suunniteltu',
      0,
      nullif(btrim(coalesce(phase_value->>'description', '')), ''),
      v_work_plan_id,
      phase_index,
      nullif(btrim(coalesce(phase_value->>'type', '')), ''),
      coalesce(nullif(phase_value->>'priority', ''), 'Normaali')
    ) returning id into phase_id;

    phase_ids := array_append(phase_ids, phase_id);
  end loop;

  for target_value in select value from jsonb_array_elements(p_targets)
  loop
    target_index := target_index + 1;
    target_title := nullif(btrim(coalesce(target_value->>'title', '')), '');
    target_location := nullif(btrim(coalesce(target_value->>'location', '')), '');
    target_key := nullif(btrim(coalesce(target_value->>'key', '')), '');

    if target_title is null then
      raise exception 'Työkohteen % nimi puuttuu.', target_index using errcode = '23514';
    end if;
    target_location := coalesce(target_location, target_title);
    target_key := coalesce(target_key, lpad(target_index::text, 3, '0'));
    predecessor_id := null;
    phase_index := 0;

    for phase_value in select value from jsonb_array_elements(p_phases)
    loop
      phase_index := phase_index + 1;
      phase_id := phase_ids[phase_index];

      begin
        select coalesce(array_agg(distinct value::uuid), array[]::uuid[])
        into assignee_ids
        from jsonb_array_elements_text(
          coalesce(phase_value->'assignee_user_ids', '[]'::jsonb)
        ) assignee(value);
      exception
        when invalid_text_representation then
          raise exception 'Työvaiheen % tekijätunniste on virheellinen.', phase_index using errcode = '23514';
      end;

      if cardinality(assignee_ids) = 0 then
        raise exception 'Työvaiheelle "%" pitää valita vähintään yksi tekijä.',
          btrim(phase_value->>'title') using errcode = '23514';
      end if;

      if exists (
        select 1
        from unnest(assignee_ids) requested(user_id)
        where not exists (
          select 1
          from public.project_members member
          where member.organization_id = p_organization_id
            and member.project_id = p_project_id
            and member.user_id = requested.user_id
        )
      ) then
        raise exception 'Kaikkien työvaiheen tekijöiden pitää kuulua projektitiimiin.' using errcode = '23503';
      end if;

      created_work_order_id := public.save_work_order_v2(
        p_organization_id,
        null,
        p_project_id,
        btrim(phase_value->>'title'),
        target_location,
        (phase_value->>'end_date')::date,
        (phase_value->>'start_date')::date,
        (phase_value->>'end_date')::date,
        default_start_time,
        default_end_time,
        default_weekdays,
        default_calendar_sync,
        default_occupancy,
        target_key,
        case
          when predecessor_id is null then null
          else 'Aloitus edellyttää edellisen työvaiheen valmistumista.'
        end,
        null,
        default_resident_notification,
        coalesce(nullif(phase_value->>'priority', ''), 'Normaali'),
        'Avoin',
        nullif(btrim(coalesce(phase_value->>'description', '')), ''),
        nullif(btrim(coalesce(phase_value->>'type', '')), ''),
        'people',
        assignee_ids
      );

      update public.work_orders
      set work_plan_id = v_work_plan_id,
          work_package_key = target_key,
          work_package_title = target_title,
          project_phase_id = phase_id,
          phase_order = phase_index,
          predecessor_work_order_id = predecessor_id,
          phase_gate_enabled = true,
          updated_at = statement_timestamp()
      where id = created_work_order_id
        and organization_id = p_organization_id;

      predecessor_id := created_work_order_id;
      created_count := created_count + 1;
    end loop;
  end loop;

  perform private.refresh_project_work_plan(v_work_plan_id);

  insert into public.audit_logs (
    organization_id, user_id, action, table_name, record_id, metadata
  ) values (
    p_organization_id,
    auth.uid(),
    'project_work_plan_created',
    'project_work_plans',
    v_work_plan_id,
    jsonb_build_object(
      'project_id', p_project_id,
      'target_count', target_count,
      'phase_count', phase_count,
      'work_order_count', created_count
    )
  );

  return jsonb_build_object(
    'plan_id', v_work_plan_id,
    'target_count', target_count,
    'phase_count', phase_count,
    'work_order_count', created_count
  );
end;
$$;

revoke all on function public.create_project_work_plan(uuid, uuid, text, text, jsonb, jsonb, jsonb)
from public, anon;
grant execute on function public.create_project_work_plan(uuid, uuid, text, text, jsonb, jsonb, jsonb)
to authenticated;

commit;
