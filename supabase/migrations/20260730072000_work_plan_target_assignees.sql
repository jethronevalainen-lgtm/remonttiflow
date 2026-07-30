-- Allow per-target assignees and work notes when creating a project work plan.
-- Target assignees override phase assignees; descriptions are combined into each work order.

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
  target_description text;
  target_assignee_ids uuid[];
  phase_assignee_ids uuid[];
  assignee_ids uuid[];
  work_title text;
  work_description text;
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
    target_description := nullif(btrim(coalesce(target_value->>'description', '')), '');

    if target_title is null then
      raise exception 'Työkohteen % nimi puuttuu.', target_index using errcode = '23514';
    end if;
    target_location := coalesce(target_location, target_title);
    target_key := coalesce(target_key, lpad(target_index::text, 3, '0'));

    begin
      select coalesce(array_agg(distinct value::uuid), array[]::uuid[])
      into target_assignee_ids
      from jsonb_array_elements_text(
        coalesce(target_value->'assignee_user_ids', '[]'::jsonb)
      ) assignee(value);
    exception
      when invalid_text_representation then
        raise exception 'Työkohteen % tekijätunniste on virheellinen.', target_index using errcode = '23514';
    end;

    predecessor_id := null;
    phase_index := 0;

    for phase_value in select value from jsonb_array_elements(p_phases)
    loop
      phase_index := phase_index + 1;
      phase_id := phase_ids[phase_index];

      begin
        select coalesce(array_agg(distinct value::uuid), array[]::uuid[])
        into phase_assignee_ids
        from jsonb_array_elements_text(
          coalesce(phase_value->'assignee_user_ids', '[]'::jsonb)
        ) assignee(value);
      exception
        when invalid_text_representation then
          raise exception 'Työvaiheen % tekijätunniste on virheellinen.', phase_index using errcode = '23514';
      end;

      -- Target-level assignees override shared phase assignees.
      if cardinality(target_assignee_ids) > 0 then
        assignee_ids := target_assignee_ids;
      else
        assignee_ids := phase_assignee_ids;
      end if;

      if cardinality(assignee_ids) = 0 then
        raise exception 'Kohteelle "%" / työvaiheelle "%" pitää valita vähintään yksi tekijä.',
          target_title, btrim(phase_value->>'title') using errcode = '23514';
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
        raise exception 'Kaikkien tekijöiden pitää kuulua projektitiimiin.' using errcode = '23503';
      end if;

      work_title := target_title || ' – ' || btrim(phase_value->>'title');
      work_description := nullif(
        concat_ws(
          E'\n\n',
          case when target_description is not null
            then 'Kohde ' || target_title || ': ' || target_description
            else null
          end,
          case when nullif(btrim(coalesce(phase_value->>'description', '')), '') is not null
            then 'Työvaihe ' || btrim(phase_value->>'title') || ': ' || btrim(phase_value->>'description')
            else null
          end
        ),
        ''
      );

      created_work_order_id := public.save_work_order_v2(
        p_organization_id,
        null,
        p_project_id,
        work_title,
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
        work_description,
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
