begin;

-- Extended read API, including structured intake data and attachment metadata.
drop function if exists public.project_requests_for_user(uuid);
create function public.project_requests_for_user(p_organization_id uuid)
returns table (
  id uuid,
  organization_id uuid,
  customer_id uuid,
  customer_name text,
  created_by uuid,
  project_name text,
  request_type text,
  location text,
  building text,
  staircase text,
  apartment text,
  customer_reference text,
  description text,
  desired_start_date date,
  desired_end_date date,
  deadline_flexibility text,
  occupancy_status text,
  current_resident_moving_out boolean,
  current_resident_move_out_date date,
  incoming_resident_status text,
  incoming_resident_move_in_date date,
  incoming_contract_status text,
  deadline_reason text,
  access_method text,
  allowed_working_hours text,
  access_notes text,
  contact_name text,
  contact_phone text,
  contact_email text,
  resident_contact_name text,
  resident_contact_phone text,
  resident_contact_email text,
  resident_contact_allowed boolean,
  contact_instructions text,
  status text,
  management_note text,
  converted_project_id uuid,
  created_at timestamptz,
  submitted_at timestamptz,
  reviewed_at timestamptz,
  attachments jsonb
)
language sql
stable
security definer
set search_path = pg_catalog, public
as $$
  select
    r.id, r.organization_id, r.customer_id, c.name, r.created_by, r.project_name,
    r.request_type, r.location, r.building, r.staircase, r.apartment,
    r.customer_reference, r.description, r.desired_start_date, r.desired_end_date,
    r.deadline_flexibility, r.occupancy_status, r.current_resident_moving_out,
    r.current_resident_move_out_date, r.incoming_resident_status,
    r.incoming_resident_move_in_date, r.incoming_contract_status,
    r.deadline_reason, r.access_method, r.allowed_working_hours, r.access_notes,
    r.contact_name, r.contact_phone, r.contact_email, r.resident_contact_name,
    r.resident_contact_phone, r.resident_contact_email, r.resident_contact_allowed,
    r.contact_instructions, r.status, r.management_note, r.converted_project_id,
    r.created_at, r.submitted_at, r.reviewed_at,
    coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', a.id,
        'storage_path', a.storage_path,
        'file_name', a.file_name,
        'mime_type', a.mime_type,
        'size_bytes', a.size_bytes,
        'description', a.description,
        'created_at', a.created_at
      ) order by a.created_at)
      from public.project_request_attachments a
      where a.request_id = r.id
    ), '[]'::jsonb)
  from public.project_requests r
  join public.customers c on c.id = r.customer_id
  where r.organization_id = p_organization_id
    and (
      (
        private.is_management_user(r.organization_id, auth.uid())
        and r.status <> 'Luonnos'
      )
      or r.created_by = auth.uid()
      or (
        r.status <> 'Luonnos'
        and private.is_customer_user(r.organization_id, r.customer_id, auth.uid())
      )
    )
  order by r.updated_at desc, r.created_at desc;
$$;

drop function if exists public.admin_preview_project_requests(uuid, uuid[], uuid[], text);
create function public.admin_preview_project_requests(
  p_organization_id uuid,
  p_customer_ids uuid[],
  p_project_ids uuid[],
  p_access_scope text
)
returns table (
  id uuid,
  organization_id uuid,
  customer_id uuid,
  customer_name text,
  created_by uuid,
  project_name text,
  request_type text,
  location text,
  building text,
  staircase text,
  apartment text,
  customer_reference text,
  description text,
  desired_start_date date,
  desired_end_date date,
  deadline_flexibility text,
  occupancy_status text,
  current_resident_moving_out boolean,
  current_resident_move_out_date date,
  incoming_resident_status text,
  incoming_resident_move_in_date date,
  incoming_contract_status text,
  deadline_reason text,
  access_method text,
  allowed_working_hours text,
  access_notes text,
  contact_name text,
  contact_phone text,
  contact_email text,
  resident_contact_name text,
  resident_contact_phone text,
  resident_contact_email text,
  resident_contact_allowed boolean,
  contact_instructions text,
  status text,
  management_note text,
  converted_project_id uuid,
  created_at timestamptz,
  submitted_at timestamptz,
  reviewed_at timestamptz,
  attachments jsonb
)
language plpgsql
stable
security definer
set search_path = pg_catalog, public
as $$
begin
  if not private.has_org_role(p_organization_id, array['admin']::text[]) then
    raise exception 'Vain ylläpitäjä voi esikatsella tilaajaportaalia.' using errcode = '42501';
  end if;
  return query
  select
    r.id, r.organization_id, r.customer_id, c.name, r.created_by, r.project_name,
    r.request_type, r.location, r.building, r.staircase, r.apartment,
    r.customer_reference, r.description, r.desired_start_date, r.desired_end_date,
    r.deadline_flexibility, r.occupancy_status, r.current_resident_moving_out,
    r.current_resident_move_out_date, r.incoming_resident_status,
    r.incoming_resident_move_in_date, r.incoming_contract_status,
    r.deadline_reason, r.access_method, r.allowed_working_hours, r.access_notes,
    r.contact_name, r.contact_phone, r.contact_email, r.resident_contact_name,
    r.resident_contact_phone, r.resident_contact_email, r.resident_contact_allowed,
    r.contact_instructions, r.status, r.management_note, r.converted_project_id,
    r.created_at, r.submitted_at, r.reviewed_at,
    coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', a.id,
        'storage_path', a.storage_path,
        'file_name', a.file_name,
        'mime_type', a.mime_type,
        'size_bytes', a.size_bytes,
        'description', a.description,
        'created_at', a.created_at
      ) order by a.created_at)
      from public.project_request_attachments a
      where a.request_id = r.id
    ), '[]'::jsonb)
  from public.project_requests r
  join public.customers c on c.id = r.customer_id
  where r.organization_id = p_organization_id
    and r.status <> 'Luonnos'
    and r.customer_id = any(coalesce(p_customer_ids, '{}'::uuid[]))
    and (
      p_access_scope = 'all_projects'
      or r.converted_project_id = any(coalesce(p_project_ids, '{}'::uuid[]))
    )
  order by r.updated_at desc, r.created_at desc;
end;
$$;

-- Review and approval keep an immutable revision trail and preserve a source link.
create or replace function public.review_project_request(
  p_request_id uuid,
  p_status text,
  p_management_note text default null
)
returns void
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  request_row public.project_requests%rowtype;
  next_version integer;
begin
  select * into request_row from public.project_requests where id = p_request_id for update;
  if request_row.id is null then
    raise exception 'Työpyyntöä ei löytynyt.' using errcode = '23503';
  end if;
  if not private.is_management_user(request_row.organization_id, auth.uid()) then
    raise exception 'Vain työnjohto voi käsitellä työpyyntöjä.' using errcode = '42501';
  end if;
  if p_status not in ('Käsittelyssä', 'Lisätietoja pyydetty', 'Hylätty') then
    raise exception 'Virheellinen käsittelytila.' using errcode = '23514';
  end if;
  if p_status in ('Lisätietoja pyydetty', 'Hylätty')
     and nullif(trim(coalesce(p_management_note, '')), '') is null then
    raise exception 'Anna tilaajalle perustelu tai täydennyspyyntö.' using errcode = '23514';
  end if;

  update public.project_requests
  set status = p_status,
      management_note = nullif(trim(coalesce(p_management_note, '')), ''),
      reviewed_by = auth.uid(),
      reviewed_at = now()
  where id = p_request_id;

  select * into request_row from public.project_requests where id = p_request_id;
  select coalesce(max(version_no), 0) + 1 into next_version
  from public.project_request_revisions where request_id = p_request_id;
  insert into public.project_request_revisions (
    organization_id, request_id, version_no, event_type, snapshot, created_by
  ) values (
    request_row.organization_id, request_row.id, next_version,
    case when p_status = 'Hylätty' then 'rejected' else 'reviewed' end,
    jsonb_build_object('request', to_jsonb(request_row)), auth.uid()
  );

  insert into public.audit_logs (organization_id, user_id, action, table_name, record_id, metadata)
  values (
    request_row.organization_id, auth.uid(), 'project_request_reviewed',
    'project_requests', request_row.id,
    jsonb_build_object('status', p_status, 'revision', next_version)
  );
end;
$$;

create or replace function public.approve_project_request(
  p_request_id uuid,
  p_project_number text default null,
  p_management_note text default null
)
returns uuid
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  request_row public.project_requests%rowtype;
  customer_name text;
  result_project_id uuid;
  resolved_project_number text;
  next_version integer;
begin
  select * into request_row from public.project_requests where id = p_request_id for update;
  if request_row.id is null then
    raise exception 'Työpyyntöä ei löytynyt.' using errcode = '23503';
  end if;
  if not private.is_management_user(request_row.organization_id, auth.uid()) then
    raise exception 'Vain työnjohto voi perustaa projektin.' using errcode = '42501';
  end if;
  if request_row.status not in ('Lähetetty', 'Käsittelyssä', 'Hyväksytty', 'Muutettu projektiksi') then
    raise exception 'Työpyyntö pitää lähettää ja käsitellä ennen projektin perustamista.' using errcode = '23514';
  end if;
  if request_row.converted_project_id is not null then
    return request_row.converted_project_id;
  end if;

  select name into customer_name from public.customers where id = request_row.customer_id;
  resolved_project_number := coalesce(
    nullif(trim(coalesce(p_project_number, '')), ''),
    'PRJ-' || to_char(current_date, 'YYYY') || '-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 6))
  );

  insert into public.projects (
    organization_id, created_by, customer_id, customer, name, location,
    status, start_date, end_date, budget, spent, progress, description,
    project_number, responsible_supervisor_id, source_project_request_id
  ) values (
    request_row.organization_id, auth.uid(), request_row.customer_id, customer_name,
    request_row.project_name, request_row.location, 'Suunniteltu',
    request_row.desired_start_date, request_row.desired_end_date, 0, 0, 0,
    request_row.description, resolved_project_number, auth.uid(), request_row.id
  ) returning id into result_project_id;

  update public.project_requests
  set status = 'Muutettu projektiksi',
      management_note = nullif(trim(coalesce(p_management_note, '')), ''),
      reviewed_by = auth.uid(),
      reviewed_at = now(),
      converted_project_id = result_project_id
  where id = request_row.id;

  select * into request_row from public.project_requests where id = p_request_id;
  select coalesce(max(version_no), 0) + 1 into next_version
  from public.project_request_revisions where request_id = p_request_id;
  insert into public.project_request_revisions (
    organization_id, request_id, version_no, event_type, snapshot, created_by
  ) values (
    request_row.organization_id, request_row.id, next_version, 'approved',
    jsonb_build_object('request', to_jsonb(request_row), 'project_id', result_project_id, 'project_number', resolved_project_number),
    auth.uid()
  );

  insert into public.audit_logs (organization_id, user_id, action, table_name, record_id, metadata)
  values (
    request_row.organization_id, auth.uid(), 'project_request_approved',
    'project_requests', request_row.id,
    jsonb_build_object('project_id', result_project_id, 'project_number', resolved_project_number, 'revision', next_version)
  );
  return result_project_id;
end;
$$;

revoke all on function public.project_requests_for_user(uuid) from public, anon;
revoke all on function public.admin_preview_project_requests(uuid, uuid[], uuid[], text) from public, anon;
revoke all on function public.review_project_request(uuid, text, text) from public, anon;
revoke all on function public.approve_project_request(uuid, text, text) from public, anon;

grant execute on function public.project_requests_for_user(uuid) to authenticated;
grant execute on function public.admin_preview_project_requests(uuid, uuid[], uuid[], text) to authenticated;
grant execute on function public.review_project_request(uuid, text, text) to authenticated;
grant execute on function public.approve_project_request(uuid, text, text) to authenticated;

commit;
