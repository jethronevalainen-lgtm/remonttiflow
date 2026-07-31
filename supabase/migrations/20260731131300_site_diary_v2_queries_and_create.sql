begin;

create or replace function public.get_site_diary_completion(p_diary_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public, private, extensions, pg_temp
as $$
declare
  d public.diary_entries%rowtype;
  settings public.site_diary_settings%rowtype;
  weather_count integer;
  workforce_count integer;
  work_item_count integer;
  open_critical_count integer;
  missing text[] := array[]::text[];
  required_count integer := 5;
  completed_count integer := 0;
begin
  select * into d from public.diary_entries where id = p_diary_id;
  if not found then
    raise exception 'Työmaapäiväkirjaa ei löytynyt.' using errcode = 'P0002';
  end if;
  if not private.can_read_site_diary(d.id, auth.uid()) then
    raise exception 'Ei käyttöoikeutta työmaapäiväkirjaan.' using errcode = '42501';
  end if;

  select * into settings
  from public.site_diary_settings s
  where s.organization_id = d.organization_id;

  select count(*) into weather_count
  from public.site_diary_weather_observations
  where diary_id = d.id
    and temperature_c is not null
    and nullif(btrim(coalesce(weather_condition, '')), '') is not null;
  select coalesce(sum(headcount), 0)::integer into workforce_count from public.site_diary_workforce_rows where diary_id = d.id;
  select count(*) into work_item_count from public.site_diary_work_items where diary_id = d.id;
  select count(*) into open_critical_count
  from public.site_diary_events
  where diary_id = d.id
    and event_type in ('deviation', 'delay', 'safety', 'decision_needed', 'yse_43_3', 'yse_44_2')
    and status in ('Avoin', 'Käsittelyssä')
    and (nullif(btrim(responsible_party), '') is null or due_at is null);

  if nullif(btrim(coalesce(d.site_address, '')), '') is null then
    missing := array_append(missing, 'Työmaan osoite');
  else
    completed_count := completed_count + 1;
  end if;

  if coalesce(settings.require_responsible_supervisor, true) and d.responsible_supervisor_id is null then
    missing := array_append(missing, 'Vastaava työnjohtaja');
  else
    completed_count := completed_count + 1;
  end if;

  if weather_count < case when coalesce(settings.require_two_weather_observations, true) then 2 else 1 end then
    missing := array_append(missing, 'Säähavainnot');
  else
    completed_count := completed_count + 1;
  end if;

  if coalesce(settings.require_workforce, true) and workforce_count <= 0 then
    missing := array_append(missing, 'Työvoima');
  else
    completed_count := completed_count + 1;
  end if;

  if coalesce(settings.require_work_items, true) and work_item_count <= 0 then
    missing := array_append(missing, 'Työvaiheet');
  else
    completed_count := completed_count + 1;
  end if;

  if open_critical_count > 0 then
    missing := array_append(missing, 'Avoimien poikkeamien vastuuhenkilö ja määräaika');
    required_count := required_count + 1;
  end if;

  return jsonb_build_object(
    'percent', case when required_count = 0 then 100 else floor((completed_count::numeric / required_count::numeric) * 100)::integer end,
    'missing', to_jsonb(missing),
    'weather_count', weather_count,
    'workforce_count', workforce_count,
    'work_item_count', work_item_count,
    'open_critical_count', open_critical_count
  );
end;
$$;

create or replace function public.get_site_diary_snapshot(p_diary_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public, private, extensions, pg_temp
as $$
declare
  d public.diary_entries%rowtype;
begin
  select * into d from public.diary_entries where id = p_diary_id;
  if not found then
    raise exception 'Työmaapäiväkirjaa ei löytynyt.' using errcode = 'P0002';
  end if;
  if not private.can_read_site_diary(d.id, auth.uid()) then
    raise exception 'Ei käyttöoikeutta työmaapäiväkirjaan.' using errcode = '42501';
  end if;

  if d.locked_at is not null and d.snapshot is not null then
    return d.snapshot;
  end if;

  return jsonb_build_object(
    'schema_version', 2,
    'generated_at', now(),
    'diary', to_jsonb(d) - array['snapshot'],
    'weather', coalesce((
      select jsonb_agg(to_jsonb(w) order by w.observation_time)
      from public.site_diary_weather_observations w where w.diary_id = d.id
    ), '[]'::jsonb),
    'workforce', coalesce((
      select jsonb_agg(to_jsonb(w) order by w.sort_order, w.created_at)
      from public.site_diary_workforce_rows w where w.diary_id = d.id
    ), '[]'::jsonb),
    'work_items', coalesce((
      select jsonb_agg(to_jsonb(i) order by i.phase_state, i.sort_order, i.created_at)
      from public.site_diary_work_items i where i.diary_id = d.id
    ), '[]'::jsonb),
    'events', coalesce((
      select jsonb_agg(to_jsonb(e) order by e.occurred_at nulls last, e.sort_order, e.created_at)
      from public.site_diary_events e where e.diary_id = d.id
    ), '[]'::jsonb),
    'attachments', coalesce((
      select jsonb_agg(to_jsonb(a) order by a.sort_order, a.created_at)
      from public.site_diary_attachments a where a.diary_id = d.id
    ), '[]'::jsonb),
    'signatures', coalesce((
      select jsonb_agg(to_jsonb(s) order by s.signed_at)
      from public.site_diary_signatures s where s.diary_id = d.id
    ), '[]'::jsonb)
  );
end;
$$;

create or replace function public.create_or_get_site_diary(
  p_organization_id uuid,
  p_project_id uuid,
  p_date date default current_date
)
returns public.diary_entries
language plpgsql
security definer
set search_path = public, private, extensions, pg_temp
as $$
declare
  result public.diary_entries%rowtype;
  project_row public.projects%rowtype;
  weather_time time;
  next_version integer;
  created_new boolean := false;
begin
  if auth.uid() is null then
    raise exception 'Kirjautuminen vaaditaan.' using errcode = '42501';
  end if;

  select * into project_row
  from public.projects
  where id = p_project_id and organization_id = p_organization_id and archived_at is null;
  if not found then
    raise exception 'Projektia ei löytynyt.' using errcode = 'P0002';
  end if;

  if not private.can_access_project(p_project_id, p_organization_id, auth.uid())
     or not private.has_org_role(p_organization_id, array['admin', 'supervisor', 'project_coordinator']) then
    raise exception 'Ei oikeutta luoda työmaapäiväkirjaa.' using errcode = '42501';
  end if;

  select * into result
  from public.diary_entries
  where organization_id = p_organization_id
    and project_id = p_project_id
    and date = p_date
    and is_current
    and status <> 'Mitätöity'
  order by version desc
  limit 1;

  if found then
    return result;
  end if;

  select coalesce(max(version), 0) + 1 into next_version
  from public.diary_entries
  where organization_id = p_organization_id
    and project_id = p_project_id
    and date = p_date;

  begin
    insert into public.diary_entries (
      organization_id, project_id, project, date, site_address, contract_number,
      responsible_supervisor_id, created_by, prepared_by, author, status, version
    ) values (
      p_organization_id, p_project_id, project_row.name, p_date, project_row.location,
      project_row.project_number, project_row.responsible_supervisor_id,
      auth.uid(), auth.uid(), coalesce((select full_name from public.profiles where id = auth.uid()), ''),
      'Luonnos', next_version
    ) returning * into result;
    created_new := true;
  exception when unique_violation then
    select * into result
    from public.diary_entries
    where organization_id = p_organization_id
      and project_id = p_project_id
      and date = p_date
      and is_current
      and status <> 'Mitätöity'
    order by version desc
    limit 1;
  end;

  for weather_time in
    select unnest(coalesce(
      (select default_weather_times from public.site_diary_settings where organization_id = p_organization_id),
      array['07:00'::time, '12:00'::time]
    ))
  loop
    insert into public.site_diary_weather_observations (diary_id, observation_time, created_by)
    values (result.id, weather_time, auth.uid())
    on conflict (diary_id, observation_time) do nothing;
  end loop;

  if result.id is null then
    raise exception 'Päiväkirjan samanaikainen luonti ei valmistunut. Yritä uudelleen.' using errcode = '40001';
  end if;

  if created_new then
    insert into public.audit_logs (organization_id, user_id, action, table_name, record_id, metadata)
    values (
      p_organization_id, auth.uid(), 'site_diary.created', 'diary_entries', result.id,
      jsonb_build_object('project_id', p_project_id, 'date', p_date, 'version', result.version)
    );
  end if;

  return result;
end;
$$;

commit;
