begin;

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
  select * into source from public.diary_entries where id = p_diary_id for update;
  if not found then raise exception 'Työmaapäiväkirjaa ei löytynyt.' using errcode = 'P0002'; end if;
  if not private.has_org_role(source.organization_id, array['admin', 'supervisor']) then
    raise exception 'Vain työnjohto voi luoda korjausversion.' using errcode = '42501';
  end if;
  if source.locked_at is null or source.status <> 'Lukittu' or not source.is_current then
    raise exception 'Korjausversion voi luoda vain nykyisestä lukitusta päiväkirjasta.' using errcode = '55000';
  end if;
  if nullif(btrim(coalesce(p_reason, '')), '') is null then
    raise exception 'Korjauksen syy on pakollinen.' using errcode = '22023';
  end if;

  update public.diary_entries set is_current = false where id = source.id;

  insert into public.diary_entries (
    organization_id, created_by, project, project_id, date, weather, temperature, workers,
    work_phases, deliveries, issues, delays, author, status, site_address, contract_number,
    responsible_supervisor_id, prepared_by, version, supersedes_id, is_current,
    visible_to_customer, summary, correction_reason
  ) values (
    source.organization_id, auth.uid(), source.project, source.project_id, source.date,
    source.weather, source.temperature, source.workers, source.work_phases, source.deliveries,
    source.issues, source.delays, source.author, 'Luonnos', source.site_address,
    source.contract_number, source.responsible_supervisor_id, auth.uid(), source.version + 1,
    source.id, true, source.visible_to_customer, source.summary, btrim(p_reason)
  ) returning * into result;

  insert into public.site_diary_weather_observations (
    diary_id, observation_time, temperature_c, weather_condition, wind_speed_ms,
    wind_gust_ms, precipitation_mm, work_impact, source, created_by
  )
  select result.id, observation_time, temperature_c, weather_condition, wind_speed_ms,
    wind_gust_ms, precipitation_mm, work_impact, 'corrected', auth.uid()
  from public.site_diary_weather_observations where diary_id = source.id;

  insert into public.site_diary_workforce_rows (
    diary_id, category, company_name, trade, headcount, notes, sort_order, created_by
  )
  select result.id, category, company_name, trade, headcount, notes, sort_order, auth.uid()
  from public.site_diary_workforce_rows where diary_id = source.id;

  insert into public.site_diary_work_items (
    diary_id, phase_state, work_order_id, title, location, responsible_party,
    progress_percent, started_at, completed_at, inspection_required,
    related_inspection_id, notes, sort_order, created_by
  )
  select result.id, phase_state, work_order_id, title, location, responsible_party,
    progress_percent, started_at, completed_at, inspection_required,
    related_inspection_id, notes, sort_order, auth.uid()
  from public.site_diary_work_items where diary_id = source.id;

  insert into public.site_diary_events (
    diary_id, event_type, occurred_at, title, description, responsible_party,
    due_at, status, cost_impact_cents, schedule_impact_days, change_order_id,
    safety_item_id, sort_order, created_by
  )
  select result.id, event_type, occurred_at, title, description, responsible_party,
    due_at, status, cost_impact_cents, schedule_impact_days, change_order_id,
    safety_item_id, sort_order, auth.uid()
  from public.site_diary_events where diary_id = source.id;

  insert into public.site_diary_attachments (
    diary_id, category, caption, storage_path, file_name, mime_type,
    size_bytes, captured_at, sort_order, created_by
  )
  select result.id, category, caption, storage_path, file_name, mime_type,
    size_bytes, captured_at, sort_order, auth.uid()
  from public.site_diary_attachments where diary_id = source.id;

  insert into public.audit_logs (organization_id, user_id, action, table_name, record_id, metadata)
  values (
    source.organization_id, auth.uid(), 'site_diary.correction_created', 'diary_entries', result.id,
    jsonb_build_object('supersedes_id', source.id, 'version', result.version, 'reason', btrim(p_reason))
  );

  return result;
end;
$$;

create or replace function public.void_site_diary(p_diary_id uuid, p_reason text)
returns public.diary_entries
language plpgsql
security definer
set search_path = public, private, extensions, pg_temp
as $$
declare
  d public.diary_entries%rowtype;
begin
  select * into d from public.diary_entries where id = p_diary_id for update;
  if not found then raise exception 'Työmaapäiväkirjaa ei löytynyt.' using errcode = 'P0002'; end if;
  if not private.has_org_role(d.organization_id, array['admin', 'supervisor']) then
    raise exception 'Vain työnjohto voi mitätöidä päiväkirjan.' using errcode = '42501';
  end if;
  if d.locked_at is not null then
    raise exception 'Lukittua päiväkirjaa ei mitätöidä suoraan. Luo korjausversio.' using errcode = '55000';
  end if;
  if nullif(btrim(coalesce(p_reason, '')), '') is null then
    raise exception 'Mitätöinnin syy on pakollinen.' using errcode = '22023';
  end if;

  update public.diary_entries
  set status = 'Mitätöity', is_current = false, voided_at = now(), voided_by = auth.uid(), correction_reason = btrim(p_reason)
  where id = d.id
  returning * into d;

  insert into public.audit_logs (organization_id, user_id, action, table_name, record_id, metadata)
  values (d.organization_id, auth.uid(), 'site_diary.voided', 'diary_entries', d.id, jsonb_build_object('reason', btrim(p_reason)));

  return d;
end;
$$;

-- Functions are available to authenticated clients; each function performs its own authorization checks.
revoke all on function public.get_site_diary_completion(uuid) from public;
revoke all on function public.get_site_diary_snapshot(uuid) from public;
revoke all on function public.create_or_get_site_diary(uuid, uuid, date) from public;
revoke all on function public.submit_site_diary(uuid) from public;
revoke all on function public.review_site_diary(uuid, boolean, text) from public;
revoke all on function public.lock_site_diary(uuid, text, text, text, boolean) from public;
revoke all on function public.create_site_diary_correction(uuid, text) from public;
revoke all on function public.void_site_diary(uuid, text) from public;

grant execute on function public.get_site_diary_completion(uuid) to authenticated;
grant execute on function public.get_site_diary_snapshot(uuid) to authenticated;
grant execute on function public.create_or_get_site_diary(uuid, uuid, date) to authenticated;
grant execute on function public.submit_site_diary(uuid) to authenticated;
grant execute on function public.review_site_diary(uuid, boolean, text) to authenticated;
grant execute on function public.lock_site_diary(uuid, text, text, text, boolean) to authenticated;
grant execute on function public.create_site_diary_correction(uuid, text) to authenticated;
grant execute on function public.void_site_diary(uuid, text) to authenticated;

grant select, insert, update, delete on public.site_diary_weather_observations to authenticated;
grant select, insert, update, delete on public.site_diary_workforce_rows to authenticated;
grant select, insert, update, delete on public.site_diary_work_items to authenticated;
grant select, insert, update, delete on public.site_diary_events to authenticated;
grant select, insert, update, delete on public.site_diary_attachments to authenticated;
grant select, insert, update, delete on public.site_diary_signatures to authenticated;
grant select, insert, update on public.site_diary_settings to authenticated;

commit;
