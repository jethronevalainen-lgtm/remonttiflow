begin;

create or replace function public.create_customer_project_request_draft(
  p_organization_id uuid,
  p_customer_id uuid
)
returns uuid
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  result_id uuid;
begin
  if auth.uid() is null then
    raise exception 'Kirjautuminen vaaditaan.' using errcode = '42501';
  end if;
  if not private.is_customer_user(p_organization_id, p_customer_id, auth.uid()) then
    raise exception 'Tilaajan käyttöoikeutta ei löytynyt.' using errcode = '42501';
  end if;

  insert into public.project_requests (
    organization_id, customer_id, created_by, project_name, description, status
  ) values (
    p_organization_id, p_customer_id, auth.uid(),
    'Nimeämätön työpyyntö', 'Luonnos, tietoja ei ole vielä lähetetty.', 'Luonnos'
  ) returning id into result_id;

  insert into public.audit_logs (organization_id, user_id, action, table_name, record_id)
  values (p_organization_id, auth.uid(), 'customer_project_request_draft_created', 'project_requests', result_id);

  return result_id;
end;
$$;

create or replace function public.save_customer_project_request_draft(
  p_request_id uuid,
  p_payload jsonb
)
returns void
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  request_row public.project_requests%rowtype;
  resolved_start date;
  resolved_end date;
  resolved_move_out date;
  resolved_move_in date;
  resolved_request_type text;
  resolved_deadline_flexibility text;
  resolved_occupancy_status text;
  resolved_incoming_resident_status text;
  resolved_incoming_contract_status text;
  resolved_access_method text;
begin
  select * into request_row
  from public.project_requests
  where id = p_request_id
  for update;

  if request_row.id is null then
    raise exception 'Työpyyntöä ei löytynyt.' using errcode = '23503';
  end if;
  if not private.can_edit_project_request(request_row.id, auth.uid()) then
    raise exception 'Työpyyntöä ei voi muokata.' using errcode = '42501';
  end if;
  if jsonb_typeof(coalesce(p_payload, '{}'::jsonb)) <> 'object' then
    raise exception 'Työpyynnön tietomuoto on virheellinen.' using errcode = '23514';
  end if;

  resolved_start := nullif(p_payload->>'desiredStartDate', '')::date;
  resolved_end := nullif(p_payload->>'desiredEndDate', '')::date;
  resolved_move_out := nullif(p_payload->>'currentResidentMoveOutDate', '')::date;
  resolved_move_in := nullif(p_payload->>'incomingResidentMoveInDate', '')::date;
  resolved_request_type := coalesce(nullif(trim(p_payload->>'requestType'), ''), 'Korjaus');
  resolved_deadline_flexibility := coalesce(nullif(trim(p_payload->>'deadlineFlexibility'), ''), 'Joustava');
  resolved_occupancy_status := coalesce(nullif(trim(p_payload->>'occupancyStatus'), ''), 'Ei tiedossa');
  resolved_incoming_resident_status := coalesce(nullif(trim(p_payload->>'incomingResidentStatus'), ''), 'Ei tiedossa');
  resolved_incoming_contract_status := coalesce(nullif(trim(p_payload->>'incomingContractStatus'), ''), 'Ei tiedossa');
  resolved_access_method := nullif(trim(p_payload->>'accessMethod'), '');

  if resolved_end is not null and resolved_start is not null and resolved_end < resolved_start then
    raise exception 'Valmistumispäivä ei voi olla ennen aloituspäivää.' using errcode = '23514';
  end if;
  if resolved_request_type not in ('Korjaus', 'Remontti', 'Huolto', 'Tarkastus tai kartoitus', 'Muu') then
    raise exception 'Tuntematon työn tyyppi.' using errcode = '23514';
  end if;
  if resolved_deadline_flexibility not in ('Ehdoton', 'Joustava', 'Ei tiedossa') then
    raise exception 'Virheellinen määräpäivän joustavuus.' using errcode = '23514';
  end if;
  if resolved_occupancy_status not in ('Asuttu', 'Tyhjä', 'Tyhjenee ennen työn alkua', 'Ei tiedossa') then
    raise exception 'Virheellinen kohteen käyttötilanne.' using errcode = '23514';
  end if;
  if resolved_incoming_resident_status not in ('Kyllä', 'Ei', 'Ei tiedossa') then
    raise exception 'Virheellinen uuden asukkaan tila.' using errcode = '23514';
  end if;
  if resolved_incoming_contract_status not in ('Ei sopimusta', 'Valmistelussa', 'Allekirjoitettu', 'Ei tiedossa') then
    raise exception 'Virheellinen sopimustilanne.' using errcode = '23514';
  end if;
  if resolved_access_method is not null and resolved_access_method not in (
    'Avain työnjohdolta', 'Avain asukkaalta', 'Asukas avaa', 'Avainhallinta', 'Sovittava'
  ) then
    raise exception 'Virheellinen pääsytapa.' using errcode = '23514';
  end if;

  update public.project_requests
  set project_name = coalesce(nullif(trim(p_payload->>'title'), ''), 'Nimeämätön työpyyntö'),
      request_type = resolved_request_type,
      location = nullif(trim(p_payload->>'location'), ''),
      building = nullif(trim(p_payload->>'building'), ''),
      staircase = nullif(trim(p_payload->>'staircase'), ''),
      apartment = nullif(trim(p_payload->>'apartment'), ''),
      customer_reference = nullif(trim(p_payload->>'customerReference'), ''),
      description = coalesce(nullif(trim(p_payload->>'description'), ''), 'Luonnos, tietoja ei ole vielä lähetetty.'),
      desired_start_date = resolved_start,
      desired_end_date = resolved_end,
      deadline_flexibility = resolved_deadline_flexibility,
      occupancy_status = resolved_occupancy_status,
      current_resident_moving_out = coalesce(nullif(p_payload->>'currentResidentMovingOut', '')::boolean, false),
      current_resident_move_out_date = resolved_move_out,
      incoming_resident_status = resolved_incoming_resident_status,
      incoming_resident_move_in_date = resolved_move_in,
      incoming_contract_status = resolved_incoming_contract_status,
      deadline_reason = nullif(trim(p_payload->>'deadlineReason'), ''),
      access_method = resolved_access_method,
      allowed_working_hours = nullif(trim(p_payload->>'allowedWorkingHours'), ''),
      access_notes = nullif(trim(p_payload->>'accessNotes'), ''),
      contact_name = nullif(trim(p_payload->>'contactName'), ''),
      contact_phone = nullif(trim(p_payload->>'contactPhone'), ''),
      contact_email = nullif(trim(p_payload->>'contactEmail'), ''),
      resident_contact_name = nullif(trim(p_payload->>'residentContactName'), ''),
      resident_contact_phone = nullif(trim(p_payload->>'residentContactPhone'), ''),
      resident_contact_email = nullif(trim(p_payload->>'residentContactEmail'), ''),
      resident_contact_allowed = coalesce(nullif(p_payload->>'residentContactAllowed', '')::boolean, false),
      contact_instructions = nullif(trim(p_payload->>'contactInstructions'), '')
  where id = request_row.id;
end;
$$;

create or replace function public.attach_customer_project_request_file(
  p_request_id uuid,
  p_attachment_id uuid,
  p_storage_path text,
  p_file_name text,
  p_mime_type text,
  p_size_bytes bigint,
  p_description text default null
)
returns void
language plpgsql
security definer
set search_path = pg_catalog, public, storage
as $$
declare
  request_row public.project_requests%rowtype;
  expected_prefix text;
  existing_count integer;
  existing_size bigint;
  accepted_types constant text[] := array[
    'image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/heic', 'image/heif',
    'application/pdf', 'text/plain', 'text/csv',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
  ];
begin
  select * into request_row from public.project_requests where id = p_request_id;
  if request_row.id is null then
    raise exception 'Työpyyntöä ei löytynyt.' using errcode = '23503';
  end if;
  if not private.can_edit_project_request(request_row.id, auth.uid()) then
    raise exception 'Liitteitä ei voi lisätä tähän työpyyntöön.' using errcode = '42501';
  end if;
  if p_size_bytes <= 0 or p_size_bytes > 20971520 then
    raise exception 'Liitteen enimmäiskoko on 20 Mt.' using errcode = '23514';
  end if;
  if p_mime_type <> all(accepted_types) then
    raise exception 'Tiedostotyyppiä ei sallita.' using errcode = '23514';
  end if;
  if char_length(trim(coalesce(p_file_name, ''))) not between 1 and 255 then
    raise exception 'Tiedoston nimi on virheellinen.' using errcode = '23514';
  end if;

  select count(*), coalesce(sum(size_bytes), 0)
  into existing_count, existing_size
  from public.project_request_attachments
  where request_id = request_row.id;

  if existing_count >= 20 then
    raise exception 'Työpyyntöön voi lisätä enintään 20 liitettä.' using errcode = '23514';
  end if;
  if existing_size + p_size_bytes > 104857600 then
    raise exception 'Työpyynnön liitteiden yhteiskoko voi olla enintään 100 Mt.' using errcode = '23514';
  end if;

  expected_prefix := request_row.organization_id::text || '/' || request_row.id::text || '/' || p_attachment_id::text || '/';
  if left(p_storage_path, char_length(expected_prefix)) <> expected_prefix then
    raise exception 'Liitteen tallennuspolku on virheellinen.' using errcode = '23514';
  end if;
  if not exists (
    select 1 from storage.objects o
    where o.bucket_id = 'project-request-attachments'
      and o.name = p_storage_path
      and o.owner_id = auth.uid()::text
  ) then
    raise exception 'Tallennettua liitettä ei löytynyt.' using errcode = '23503';
  end if;

  insert into public.project_request_attachments (
    id, organization_id, request_id, storage_path, file_name,
    mime_type, size_bytes, description, created_by
  ) values (
    p_attachment_id, request_row.organization_id, request_row.id, p_storage_path,
    trim(p_file_name), p_mime_type, p_size_bytes,
    nullif(trim(coalesce(p_description, '')), ''), auth.uid()
  );
end;
$$;

create or replace function public.update_customer_project_request_attachment(
  p_attachment_id uuid,
  p_description text
)
returns void
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  attachment_row public.project_request_attachments%rowtype;
begin
  select * into attachment_row
  from public.project_request_attachments
  where id = p_attachment_id
  for update;
  if attachment_row.id is null then
    raise exception 'Liitettä ei löytynyt.' using errcode = '23503';
  end if;
  if not private.can_edit_project_request(attachment_row.request_id, auth.uid()) then
    raise exception 'Liitettä ei voi muokata.' using errcode = '42501';
  end if;
  update public.project_request_attachments
  set description = nullif(trim(coalesce(p_description, '')), '')
  where id = p_attachment_id;
end;
$$;

create or replace function public.delete_customer_project_request_attachment(
  p_attachment_id uuid
)
returns text
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  attachment_row public.project_request_attachments%rowtype;
begin
  select * into attachment_row
  from public.project_request_attachments
  where id = p_attachment_id
  for update;
  if attachment_row.id is null then
    return null;
  end if;
  if not private.can_edit_project_request(attachment_row.request_id, auth.uid()) then
    raise exception 'Liitettä ei voi poistaa.' using errcode = '42501';
  end if;
  delete from public.project_request_attachments where id = p_attachment_id;
  return attachment_row.storage_path;
end;
$$;

create or replace function public.submit_customer_project_request(p_request_id uuid)
returns void
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  request_row public.project_requests%rowtype;
  next_version integer;
  event_name text;
  attachment_snapshot jsonb;
begin
  select * into request_row
  from public.project_requests
  where id = p_request_id
  for update;
  if request_row.id is null then
    raise exception 'Työpyyntöä ei löytynyt.' using errcode = '23503';
  end if;
  if not private.can_edit_project_request(request_row.id, auth.uid()) then
    raise exception 'Työpyyntöä ei voi lähettää.' using errcode = '42501';
  end if;
  if char_length(trim(coalesce(request_row.project_name, ''))) not between 3 and 180
     or request_row.project_name = 'Nimeämätön työpyyntö' then
    raise exception 'Anna työlle 3–180 merkin otsikko.' using errcode = '23514';
  end if;
  if char_length(trim(coalesce(request_row.description, ''))) < 20 then
    raise exception 'Kuvaile työ vähintään 20 merkillä.' using errcode = '23514';
  end if;
  if nullif(trim(coalesce(request_row.location, '')), '') is null then
    raise exception 'Anna kohteen osoite tai sijainti.' using errcode = '23514';
  end if;
  if request_row.desired_end_date is not null and request_row.desired_start_date is not null
     and request_row.desired_end_date < request_row.desired_start_date then
    raise exception 'Valmistumispäivä ei voi olla ennen aloituspäivää.' using errcode = '23514';
  end if;
  if request_row.deadline_flexibility = 'Ehdoton' and request_row.desired_end_date is null then
    raise exception 'Anna ehdoton valmistumispäivä.' using errcode = '23514';
  end if;
  if request_row.incoming_resident_status = 'Kyllä'
     and request_row.incoming_resident_move_in_date is null then
    raise exception 'Anna uuden asukkaan muuttopäivä.' using errcode = '23514';
  end if;
  if request_row.occupancy_status = 'Asuttu' and request_row.access_method is null then
    raise exception 'Valitse, miten asuttuun kohteeseen päästään.' using errcode = '23514';
  end if;
  if request_row.resident_contact_allowed
     and nullif(trim(coalesce(request_row.resident_contact_name, '')), '') is null then
    raise exception 'Anna asukkaan tai kohteen yhteyshenkilö.' using errcode = '23514';
  end if;

  event_name := case when request_row.status = 'Lisätietoja pyydetty' then 'resubmitted' else 'submitted' end;
  select coalesce(max(version_no), 0) + 1
  into next_version
  from public.project_request_revisions
  where request_id = request_row.id;

  select coalesce(jsonb_agg(to_jsonb(a) order by a.created_at), '[]'::jsonb)
  into attachment_snapshot
  from public.project_request_attachments a
  where a.request_id = request_row.id;

  update public.project_requests
  set status = 'Lähetetty', submitted_at = now(), management_note = null
  where id = request_row.id;

  select * into request_row from public.project_requests where id = p_request_id;
  insert into public.project_request_revisions (
    organization_id, request_id, version_no, event_type, snapshot, created_by
  ) values (
    request_row.organization_id,
    request_row.id,
    next_version,
    event_name,
    jsonb_build_object('request', to_jsonb(request_row), 'attachments', attachment_snapshot),
    auth.uid()
  );

  insert into public.audit_logs (organization_id, user_id, action, table_name, record_id, metadata)
  values (
    request_row.organization_id,
    auth.uid(),
    case when event_name = 'resubmitted' then 'customer_project_request_resubmitted' else 'customer_project_request_submitted' end,
    'project_requests',
    request_row.id,
    jsonb_build_object('revision', next_version)
  );
end;
$$;

revoke all on function public.create_customer_project_request_draft(uuid, uuid) from public, anon;
revoke all on function public.save_customer_project_request_draft(uuid, jsonb) from public, anon;
revoke all on function public.attach_customer_project_request_file(uuid, uuid, text, text, text, bigint, text) from public, anon;
revoke all on function public.update_customer_project_request_attachment(uuid, text) from public, anon;
revoke all on function public.delete_customer_project_request_attachment(uuid) from public, anon;
revoke all on function public.submit_customer_project_request(uuid) from public, anon;

grant execute on function public.create_customer_project_request_draft(uuid, uuid) to authenticated;
grant execute on function public.save_customer_project_request_draft(uuid, jsonb) to authenticated;
grant execute on function public.attach_customer_project_request_file(uuid, uuid, text, text, text, bigint, text) to authenticated;
grant execute on function public.update_customer_project_request_attachment(uuid, text) to authenticated;
grant execute on function public.delete_customer_project_request_attachment(uuid) to authenticated;
grant execute on function public.submit_customer_project_request(uuid) to authenticated;

commit;
