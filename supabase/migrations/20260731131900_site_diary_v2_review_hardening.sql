begin;

-- Review hardening: preserve the original weather-row creator, allow any
-- eligible project contributor to fill pre-created observations, enforce
-- project access in every privileged workflow RPC and use one canonical lock
-- timestamp in the immutable snapshot.

drop policy if exists site_diary_weather_observations_update
  on public.site_diary_weather_observations;
create policy site_diary_weather_observations_update
  on public.site_diary_weather_observations
  for update
  using (private.can_edit_site_diary(diary_id, (select auth.uid())))
  with check (private.can_edit_site_diary(diary_id, (select auth.uid())));

create or replace function public.review_site_diary(
  p_diary_id uuid,
  p_approved boolean,
  p_note text default null
)
returns public.diary_entries
language plpgsql
security definer
set search_path = public, private, extensions, pg_temp
as $$
declare
  d public.diary_entries%rowtype;
begin
  select * into d
  from public.diary_entries
  where id = p_diary_id
  for update;

  if not found then
    raise exception 'Työmaapäiväkirjaa ei löytynyt.' using errcode = 'P0002';
  end if;
  if d.project_id is null
     or not private.can_access_project(d.project_id, d.organization_id, auth.uid())
     or not private.has_org_role(d.organization_id, array['admin', 'supervisor']) then
    raise exception 'Vain projektin käyttöoikeuden omaava työnjohto voi tarkastaa työmaapäiväkirjan.'
      using errcode = '42501';
  end if;
  if d.status <> 'Tarkastettavana' or d.locked_at is not null then
    raise exception 'Päiväkirja ei ole tarkastettavassa tilassa.' using errcode = '55000';
  end if;
  if not p_approved and nullif(btrim(coalesce(p_note, '')), '') is null then
    raise exception 'Täydennettäväksi palauttamisen syy on pakollinen.' using errcode = '22023';
  end if;

  update public.diary_entries
  set
    status = case when p_approved then 'Tarkastettu' else 'Täydennettävä' end,
    reviewed_by = auth.uid(),
    reviewed_at = now(),
    approved_by = case when p_approved then auth.uid() else null end,
    approved_at = case when p_approved then now() else null end
  where id = d.id
  returning * into d;

  insert into public.audit_logs (
    organization_id,
    user_id,
    action,
    table_name,
    record_id,
    metadata
  ) values (
    d.organization_id,
    auth.uid(),
    case when p_approved then 'site_diary.reviewed' else 'site_diary.returned' end,
    'diary_entries',
    d.id,
    jsonb_build_object('note', nullif(btrim(coalesce(p_note, '')), ''))
  );

  return d;
end;
$$;

create or replace function public.lock_site_diary(
  p_diary_id uuid,
  p_signer_name text,
  p_signer_title text default null,
  p_signature_svg text default null,
  p_wait_for_external_signature boolean default false
)
returns public.diary_entries
language plpgsql
security definer
set search_path = public, private, extensions, pg_temp
as $$
declare
  d public.diary_entries%rowtype;
  settings public.site_diary_settings%rowtype;
  completion jsonb;
  diary_snapshot jsonb;
  checksum text;
  signature_count integer;
  lock_time timestamptz;
begin
  select * into d
  from public.diary_entries
  where id = p_diary_id
  for update;

  if not found then
    raise exception 'Työmaapäiväkirjaa ei löytynyt.' using errcode = 'P0002';
  end if;
  if d.project_id is null
     or not private.can_access_project(d.project_id, d.organization_id, auth.uid())
     or not private.has_org_role(d.organization_id, array['admin', 'supervisor']) then
    raise exception 'Vain projektin käyttöoikeuden omaava työnjohto voi lukita työmaapäiväkirjan.'
      using errcode = '42501';
  end if;
  if d.status not in ('Tarkastettu', 'Odottaa kuittausta') or d.locked_at is not null then
    raise exception 'Päiväkirja ei ole lukittavassa tilassa.' using errcode = '55000';
  end if;
  if nullif(btrim(coalesce(p_signer_name, '')), '') is null then
    raise exception 'Allekirjoittajan nimi on pakollinen.' using errcode = '22023';
  end if;

  completion := public.get_site_diary_completion(d.id);
  if jsonb_array_length(completion->'missing') > 0 then
    raise exception 'Päiväkirjasta puuttuu pakollisia tietoja: %', completion->>'missing'
      using errcode = '22023';
  end if;

  insert into public.site_diary_signatures (
    diary_id,
    signature_role,
    signer_name,
    signer_title,
    signed_by_user_id,
    signature_method,
    signature_svg
  ) values (
    d.id,
    'responsible_supervisor',
    btrim(p_signer_name),
    nullif(btrim(coalesce(p_signer_title, '')), ''),
    auth.uid(),
    case
      when nullif(btrim(coalesce(p_signature_svg, '')), '') is null then 'typed'
      else 'drawn'
    end,
    nullif(p_signature_svg, '')
  )
  on conflict (diary_id, signature_role, signer_name)
  do update set
    signer_title = excluded.signer_title,
    signed_by_user_id = excluded.signed_by_user_id,
    signed_at = now(),
    signature_method = excluded.signature_method,
    signature_svg = excluded.signature_svg;

  select * into settings
  from public.site_diary_settings
  where organization_id = d.organization_id;

  if p_wait_for_external_signature then
    update public.diary_entries
    set status = 'Odottaa kuittausta'
    where id = d.id
    returning * into d;
    return d;
  end if;

  if coalesce(settings.require_inspector_signature, false) then
    select count(*) into signature_count
    from public.site_diary_signatures
    where diary_id = d.id and signature_role = 'inspector';

    if signature_count = 0 then
      raise exception 'Valvojan allekirjoitus puuttuu.' using errcode = '22023';
    end if;
  end if;

  lock_time := clock_timestamp();
  diary_snapshot := jsonb_set(
    public.get_site_diary_snapshot(d.id),
    '{generated_at}',
    to_jsonb(lock_time),
    true
  ) || jsonb_build_object(
    'lock',
    jsonb_build_object(
      'status', 'Lukittu',
      'locked_at', lock_time,
      'locked_by', auth.uid(),
      'version', d.version
    )
  );
  checksum := encode(
    extensions.digest(convert_to(diary_snapshot::text, 'UTF8'), 'sha256'),
    'hex'
  );

  update public.diary_entries
  set
    status = 'Lukittu',
    locked_at = lock_time,
    locked_by = auth.uid(),
    approved_by = coalesce(approved_by, auth.uid()),
    approved_at = coalesce(approved_at, lock_time),
    snapshot = diary_snapshot,
    content_checksum = checksum
  where id = d.id
  returning * into d;

  insert into public.audit_logs (
    organization_id,
    user_id,
    action,
    table_name,
    record_id,
    metadata
  ) values (
    d.organization_id,
    auth.uid(),
    'site_diary.locked',
    'diary_entries',
    d.id,
    jsonb_build_object('version', d.version, 'checksum', checksum, 'locked_at', lock_time)
  );

  return d;
end;
$$;

create or replace function public.create_site_diary_correction(
  p_diary_id uuid,
  p_reason text
)
returns public.diary_entries
language plpgsql
security definer
set search_path = public, private, extensions, pg_temp
as $$
declare
  source public.diary_entries%rowtype;
  result public.diary_entries%rowtype;
begin
  select * into source
  from public.diary_entries
  where id = p_diary_id
  for update;

  if not found then
    raise exception 'Työmaapäiväkirjaa ei löytynyt.' using errcode = 'P0002';
  end if;
  if source.project_id is null
     or not private.can_access_project(source.project_id, source.organization_id, auth.uid())
     or not private.has_org_role(source.organization_id, array['admin', 'supervisor']) then
    raise exception 'Vain projektin käyttöoikeuden omaava työnjohto voi luoda korjausversion.'
      using errcode = '42501';
  end if;
  if source.locked_at is null or source.status <> 'Lukittu' or not source.is_current then
    raise exception 'Korjausversion voi luoda vain nykyisestä lukitusta päiväkirjasta.'
      using errcode = '55000';
  end if;
  if nullif(btrim(coalesce(p_reason, '')), '') is null then
    raise exception 'Korjauksen syy on pakollinen.' using errcode = '22023';
  end if;

  update public.diary_entries
  set is_current = false
  where id = source.id;

  insert into public.diary_entries (
    organization_id,
    created_by,
    project,
    project_id,
    date,
    weather,
    temperature,
    workers,
    work_phases,
    deliveries,
    issues,
    delays,
    author,
    status,
    site_address,
    contract_number,
    responsible_supervisor_id,
    prepared_by,
    version,
    supersedes_id,
    is_current,
    visible_to_customer,
    summary,
    correction_reason
  ) values (
    source.organization_id,
    auth.uid(),
    source.project,
    source.project_id,
    source.date,
    source.weather,
    source.temperature,
    source.workers,
    source.work_phases,
    source.deliveries,
    source.issues,
    source.delays,
    source.author,
    'Luonnos',
    source.site_address,
    source.contract_number,
    source.responsible_supervisor_id,
    auth.uid(),
    source.version + 1,
    source.id,
    true,
    source.visible_to_customer,
    source.summary,
    btrim(p_reason)
  )
  returning * into result;

  insert into public.site_diary_weather_observations (
    diary_id,
    observation_time,
    temperature_c,
    weather_condition,
    wind_speed_ms,
    wind_gust_ms,
    precipitation_mm,
    work_impact,
    source,
    created_by
  )
  select
    result.id,
    observation_time,
    temperature_c,
    weather_condition,
    wind_speed_ms,
    wind_gust_ms,
    precipitation_mm,
    work_impact,
    'corrected',
    auth.uid()
  from public.site_diary_weather_observations
  where diary_id = source.id;

  insert into public.site_diary_workforce_rows (
    diary_id,
    category,
    company_name,
    trade,
    headcount,
    notes,
    sort_order,
    created_by
  )
  select
    result.id,
    category,
    company_name,
    trade,
    headcount,
    notes,
    sort_order,
    auth.uid()
  from public.site_diary_workforce_rows
  where diary_id = source.id;

  insert into public.site_diary_work_items (
    diary_id,
    phase_state,
    work_order_id,
    title,
    location,
    responsible_party,
    progress_percent,
    started_at,
    completed_at,
    inspection_required,
    related_inspection_id,
    notes,
    sort_order,
    created_by
  )
  select
    result.id,
    phase_state,
    work_order_id,
    title,
    location,
    responsible_party,
    progress_percent,
    started_at,
    completed_at,
    inspection_required,
    related_inspection_id,
    notes,
    sort_order,
    auth.uid()
  from public.site_diary_work_items
  where diary_id = source.id;

  insert into public.site_diary_events (
    diary_id,
    event_type,
    occurred_at,
    title,
    description,
    responsible_party,
    due_at,
    status,
    cost_impact_cents,
    schedule_impact_days,
    change_order_id,
    safety_item_id,
    sort_order,
    created_by
  )
  select
    result.id,
    event_type,
    occurred_at,
    title,
    description,
    responsible_party,
    due_at,
    status,
    cost_impact_cents,
    schedule_impact_days,
    change_order_id,
    safety_item_id,
    sort_order,
    auth.uid()
  from public.site_diary_events
  where diary_id = source.id;

  insert into public.site_diary_attachments (
    diary_id,
    category,
    caption,
    storage_path,
    file_name,
    mime_type,
    size_bytes,
    captured_at,
    sort_order,
    created_by
  )
  select
    result.id,
    category,
    caption,
    storage_path,
    file_name,
    mime_type,
    size_bytes,
    captured_at,
    sort_order,
    auth.uid()
  from public.site_diary_attachments
  where diary_id = source.id;

  insert into public.audit_logs (
    organization_id,
    user_id,
    action,
    table_name,
    record_id,
    metadata
  ) values (
    source.organization_id,
    auth.uid(),
    'site_diary.correction_created',
    'diary_entries',
    result.id,
    jsonb_build_object(
      'supersedes_id', source.id,
      'version', result.version,
      'reason', btrim(p_reason)
    )
  );

  return result;
end;
$$;

create or replace function public.void_site_diary(
  p_diary_id uuid,
  p_reason text
)
returns public.diary_entries
language plpgsql
security definer
set search_path = public, private, extensions, pg_temp
as $$
declare
  d public.diary_entries%rowtype;
begin
  select * into d
  from public.diary_entries
  where id = p_diary_id
  for update;

  if not found then
    raise exception 'Työmaapäiväkirjaa ei löytynyt.' using errcode = 'P0002';
  end if;
  if d.project_id is null
     or not private.can_access_project(d.project_id, d.organization_id, auth.uid())
     or not private.has_org_role(d.organization_id, array['admin', 'supervisor']) then
    raise exception 'Vain projektin käyttöoikeuden omaava työnjohto voi mitätöidä päiväkirjan.'
      using errcode = '42501';
  end if;
  if d.locked_at is not null then
    raise exception 'Lukittua päiväkirjaa ei mitätöidä suoraan. Luo korjausversio.'
      using errcode = '55000';
  end if;
  if nullif(btrim(coalesce(p_reason, '')), '') is null then
    raise exception 'Mitätöinnin syy on pakollinen.' using errcode = '22023';
  end if;

  update public.diary_entries
  set
    status = 'Mitätöity',
    is_current = false,
    voided_at = now(),
    voided_by = auth.uid(),
    correction_reason = btrim(p_reason)
  where id = d.id
  returning * into d;

  insert into public.audit_logs (
    organization_id,
    user_id,
    action,
    table_name,
    record_id,
    metadata
  ) values (
    d.organization_id,
    auth.uid(),
    'site_diary.voided',
    'diary_entries',
    d.id,
    jsonb_build_object('reason', btrim(p_reason))
  );

  return d;
end;
$$;

grant execute on function public.review_site_diary(uuid, boolean, text) to authenticated;
grant execute on function public.lock_site_diary(uuid, text, text, text, boolean) to authenticated;
grant execute on function public.create_site_diary_correction(uuid, text) to authenticated;
grant execute on function public.void_site_diary(uuid, text) to authenticated;

commit;
