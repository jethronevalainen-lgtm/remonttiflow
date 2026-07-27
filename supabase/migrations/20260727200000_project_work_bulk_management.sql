begin;

create or replace function public.create_project_work_orders_bulk(
  p_organization_id uuid,
  p_project_id uuid,
  p_items jsonb,
  p_defaults jsonb default '{}'::jsonb
)
returns uuid[]
language plpgsql
security definer
set search_path = ''
as $$
declare
  item jsonb;
  item_index integer := 0;
  item_count integer;
  assignee_user_id uuid;
  created_id uuid;
  created_ids uuid[] := array[]::uuid[];
  default_due_date date := nullif(p_defaults->>'due_date', '')::date;
  default_start_date date := nullif(p_defaults->>'planned_start_date', '')::date;
  default_end_date date := nullif(p_defaults->>'planned_end_date', '')::date;
  default_start_time time without time zone := coalesce(nullif(p_defaults->>'planned_start_time', '')::time, time '07:00');
  default_end_time time without time zone := coalesce(nullif(p_defaults->>'planned_end_time', '')::time, time '15:30');
  default_weekdays smallint[];
  default_calendar_sync boolean := coalesce((p_defaults->>'calendar_sync_enabled')::boolean, true);
  default_occupancy text := coalesce(nullif(p_defaults->>'occupancy_status', ''), 'unknown');
  default_work_reference text := nullif(btrim(coalesce(p_defaults->>'work_reference', '')), '');
  default_start_constraints text := nullif(btrim(coalesce(p_defaults->>'start_constraints', '')), '');
  default_access_notes text := nullif(btrim(coalesce(p_defaults->>'access_notes', '')), '');
  default_resident_notification boolean := coalesce((p_defaults->>'resident_notification_required')::boolean, false);
  default_priority text := coalesce(nullif(p_defaults->>'priority', ''), 'Normaali');
  default_status text := coalesce(nullif(p_defaults->>'status', ''), 'Avoin');
  default_description text := nullif(btrim(coalesce(p_defaults->>'description', '')), '');
  default_type text := nullif(btrim(coalesce(p_defaults->>'type', '')), '');
begin
  if auth.uid() is null
     or not private.is_operational_manager(p_organization_id, auth.uid()) then
    raise exception 'Vain työnjohto voi luoda projektin töitä.' using errcode = '42501';
  end if;

  if not exists (
    select 1
    from public.projects project
    where project.id = p_project_id
      and project.organization_id = p_organization_id
      and project.archived_at is null
  ) then
    raise exception 'Projektia ei löytynyt.' using errcode = '23503';
  end if;

  if p_items is null or jsonb_typeof(p_items) <> 'array' then
    raise exception 'Töiden pitää olla taulukkomuodossa.' using errcode = '22023';
  end if;

  item_count := jsonb_array_length(p_items);
  if item_count < 1 or item_count > 100 then
    raise exception 'Kerralla voi luoda 1–100 työtä.' using errcode = '23514';
  end if;

  select coalesce(array_agg(day_value::smallint order by day_value::smallint), array[1,2,3,4,5]::smallint[])
  into default_weekdays
  from jsonb_array_elements_text(
    coalesce(p_defaults->'planned_weekdays', '[1,2,3,4,5]'::jsonb)
  ) as weekday(day_value);

  for item in
    select value
    from jsonb_array_elements(p_items)
  loop
    item_index := item_index + 1;

    if nullif(btrim(coalesce(item->>'title', '')), '') is null then
      raise exception 'Työn % nimi puuttuu.', item_index using errcode = '23514';
    end if;

    begin
      assignee_user_id := nullif(item->>'assignee_user_id', '')::uuid;
    exception
      when invalid_text_representation then
        raise exception 'Työn % asentajan tunniste on virheellinen.', item_index using errcode = '23514';
    end;

    if assignee_user_id is null then
      raise exception 'Työlle % pitää valita asentaja.', item_index using errcode = '23514';
    end if;

    created_id := public.save_work_order_v2(
      p_organization_id,
      null,
      p_project_id,
      btrim(item->>'title'),
      nullif(btrim(coalesce(item->>'location', '')), ''),
      default_due_date,
      default_start_date,
      default_end_date,
      default_start_time,
      default_end_time,
      default_weekdays,
      default_calendar_sync,
      default_occupancy,
      default_work_reference,
      default_start_constraints,
      default_access_notes,
      default_resident_notification,
      default_priority,
      default_status,
      default_description,
      default_type,
      'people',
      array[assignee_user_id]
    );

    created_ids := array_append(created_ids, created_id);
  end loop;

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
    'project_work_orders_bulk_created',
    'work_orders',
    p_project_id,
    jsonb_build_object(
      'project_id', p_project_id,
      'count', cardinality(created_ids),
      'work_order_ids', created_ids
    )
  );

  return created_ids;
end;
$$;

revoke all on function public.create_project_work_orders_bulk(uuid, uuid, jsonb, jsonb)
  from public, anon;
grant execute on function public.create_project_work_orders_bulk(uuid, uuid, jsonb, jsonb)
  to authenticated;

commit;
