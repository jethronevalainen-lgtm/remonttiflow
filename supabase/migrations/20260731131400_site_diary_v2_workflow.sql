begin;

create or replace function public.submit_site_diary(p_diary_id uuid)
returns public.diary_entries
language plpgsql
security definer
set search_path = public, private, extensions, pg_temp
as $$
declare
  d public.diary_entries%rowtype;
  completion jsonb;
begin
  select * into d from public.diary_entries where id = p_diary_id for update;
  if not found then raise exception 'Työmaapäiväkirjaa ei löytynyt.' using errcode = 'P0002'; end if;
  if not private.has_org_role(d.organization_id, array['admin', 'supervisor', 'project_coordinator'])
     or d.project_id is null
     or not private.can_access_project(d.project_id, d.organization_id, auth.uid()) then
    raise exception 'Ei oikeutta lähettää työmaapäiväkirjaa tarkastettavaksi.' using errcode = '42501';
  end if;
  if d.locked_at is not null or d.status = 'Mitätöity' then
    raise exception 'Lukittua tai mitätöityä päiväkirjaa ei voi lähettää.' using errcode = '55000';
  end if;
  if d.status not in ('Luonnos', 'Täydennettävä') then
    raise exception 'Vain luonnoksen tai täydennettäväksi palautetun päiväkirjan voi lähettää.' using errcode = '55000';
  end if;

  completion := public.get_site_diary_completion(d.id);
  if jsonb_array_length(completion->'missing') > 0 then
    raise exception 'Päiväkirjasta puuttuu pakollisia tietoja: %', completion->>'missing' using errcode = '22023';
  end if;

  update public.diary_entries
  set status = 'Tarkastettavana', submitted_at = now()
  where id = d.id
  returning * into d;

  insert into public.audit_logs (organization_id, user_id, action, table_name, record_id, metadata)
  values (d.organization_id, auth.uid(), 'site_diary.submitted', 'diary_entries', d.id, completion);

  return d;
end;
$$;

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
  select * into d from public.diary_entries where id = p_diary_id for update;
  if not found then raise exception 'Työmaapäiväkirjaa ei löytynyt.' using errcode = 'P0002'; end if;
  if not private.has_org_role(d.organization_id, array['admin', 'supervisor']) then
    raise exception 'Vain työnjohto voi tarkastaa työmaapäiväkirjan.' using errcode = '42501';
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

  insert into public.audit_logs (organization_id, user_id, action, table_name, record_id, metadata)
  values (
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
  select * into d from public.diary_entries where id = p_diary_id for update;
  if not found then raise exception 'Työmaapäiväkirjaa ei löytynyt.' using errcode = 'P0002'; end if;
  if not private.has_org_role(d.organization_id, array['admin', 'supervisor']) then
    raise exception 'Vain työnjohto voi lukita työmaapäiväkirjan.' using errcode = '42501';
  end if;
  if d.status not in ('Tarkastettu', 'Odottaa kuittausta') or d.locked_at is not null then
    raise exception 'Päiväkirja ei ole lukittavassa tilassa.' using errcode = '55000';
  end if;
  if nullif(btrim(coalesce(p_signer_name, '')), '') is null then
    raise exception 'Allekirjoittajan nimi on pakollinen.' using errcode = '22023';
  end if;

  completion := public.get_site_diary_completion(d.id);
  if jsonb_array_length(completion->'missing') > 0 then
    raise exception 'Päiväkirjasta puuttuu pakollisia tietoja: %', completion->>'missing' using errcode = '22023';
  end if;

  insert into public.site_diary_signatures (
    diary_id, signature_role, signer_name, signer_title, signed_by_user_id,
    signature_method, signature_svg
  ) values (
    d.id, 'responsible_supervisor', btrim(p_signer_name), nullif(btrim(coalesce(p_signer_title, '')), ''),
    auth.uid(), case when nullif(btrim(coalesce(p_signature_svg, '')), '') is null then 'typed' else 'drawn' end,
    nullif(p_signature_svg, '')
  )
  on conflict (diary_id, signature_role, signer_name)
  do update set
    signer_title = excluded.signer_title,
    signed_by_user_id = excluded.signed_by_user_id,
    signed_at = now(),
    signature_method = excluded.signature_method,
    signature_svg = excluded.signature_svg;

  select * into settings from public.site_diary_settings where organization_id = d.organization_id;
  if p_wait_for_external_signature then
    update public.diary_entries set status = 'Odottaa kuittausta' where id = d.id returning * into d;
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

  lock_time := now();
  diary_snapshot := public.get_site_diary_snapshot(d.id) || jsonb_build_object(
    'lock', jsonb_build_object(
      'status', 'Lukittu',
      'locked_at', lock_time,
      'locked_by', auth.uid(),
      'version', d.version
    )
  );
  checksum := encode(extensions.digest(convert_to(diary_snapshot::text, 'UTF8'), 'sha256'), 'hex');

  update public.diary_entries
  set
    status = 'Lukittu',
    locked_at = lock_time,
    locked_by = auth.uid(),
    approved_by = coalesce(approved_by, auth.uid()),
    approved_at = coalesce(approved_at, now()),
    snapshot = diary_snapshot,
    content_checksum = checksum
  where id = d.id
  returning * into d;

  insert into public.audit_logs (organization_id, user_id, action, table_name, record_id, metadata)
  values (
    d.organization_id, auth.uid(), 'site_diary.locked', 'diary_entries', d.id,
    jsonb_build_object('version', d.version, 'checksum', checksum)
  );

  return d;
end;
$$;

commit;
