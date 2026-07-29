-- QR hallinta: listaa aktiiviset koodit (metadata), poista käytöstä, salli project_coordinator.

create or replace function private.rotate_work_site_qr_token(
  p_project_id uuid,
  p_label text default null,
  p_expires_at timestamptz default null,
  p_require_geofence boolean default true
)
returns table (
  token text,
  project_name text,
  expires_at timestamptz,
  require_geofence boolean
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  project_row public.projects%rowtype;
  raw_token text;
begin
  if auth.uid() is null then
    raise exception 'Kirjautuminen vaaditaan.' using errcode = '42501';
  end if;

  select * into project_row from public.projects where id = p_project_id;
  if project_row.id is null then
    raise exception 'Työmaata ei löytynyt.' using errcode = 'P0002';
  end if;
  if not private.has_org_role(
    project_row.organization_id,
    array['admin', 'supervisor', 'project_coordinator']::text[]
  ) then
    raise exception 'QR-koodin luontiin ei ole oikeutta.' using errcode = '42501';
  end if;

  raw_token := encode(extensions.gen_random_bytes(32), 'hex');
  update public.work_site_qr_tokens
  set is_active = false
  where organization_id = project_row.organization_id
    and project_id = project_row.id
    and is_active;

  insert into public.work_site_qr_tokens(
    organization_id, project_id, token_hash, label, require_geofence, expires_at, created_by
  ) values (
    project_row.organization_id,
    project_row.id,
    extensions.digest(convert_to(raw_token, 'UTF8'), 'sha256'),
    nullif(trim(p_label), ''),
    p_require_geofence,
    p_expires_at,
    auth.uid()
  );

  insert into public.audit_logs(organization_id, user_id, action, table_name, record_id, metadata)
  values (
    project_row.organization_id,
    auth.uid(),
    'rotate_qr_token',
    'work_site_qr_tokens',
    project_row.id,
    jsonb_build_object('require_geofence', p_require_geofence, 'expires_at', p_expires_at)
  );

  return query select raw_token, project_row.name, p_expires_at, p_require_geofence;
end;
$$;

create or replace function public.list_work_site_qr_tokens(p_organization_id uuid)
returns table (
  id uuid,
  project_id uuid,
  project_name text,
  label text,
  require_geofence boolean,
  expires_at timestamptz,
  is_active boolean,
  created_at timestamptz,
  last_used_at timestamptz,
  use_count integer
)
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null then
    raise exception 'Kirjautuminen vaaditaan.' using errcode = '42501';
  end if;
  if not private.has_org_role(
    p_organization_id,
    array['admin', 'supervisor', 'project_coordinator']::text[]
  ) then
    raise exception 'QR-koodien lukemiseen ei ole oikeutta.' using errcode = '42501';
  end if;

  return query
  select
    t.id,
    t.project_id,
    p.name,
    t.label,
    t.require_geofence,
    t.expires_at,
    t.is_active,
    t.created_at,
    t.last_used_at,
    t.use_count
  from public.work_site_qr_tokens t
  join public.projects p on p.id = t.project_id
  where t.organization_id = p_organization_id
    and t.is_active = true
  order by t.created_at desc;
end;
$$;

revoke all on function public.list_work_site_qr_tokens(uuid) from public, anon;
grant execute on function public.list_work_site_qr_tokens(uuid) to authenticated;

create or replace function public.deactivate_work_site_qr_token(p_token_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  token_row public.work_site_qr_tokens%rowtype;
begin
  if auth.uid() is null then
    raise exception 'Kirjautuminen vaaditaan.' using errcode = '42501';
  end if;

  select * into token_row from public.work_site_qr_tokens where id = p_token_id;
  if token_row.id is null then
    raise exception 'QR-koodia ei löytynyt.' using errcode = 'P0002';
  end if;
  if not private.has_org_role(
    token_row.organization_id,
    array['admin', 'supervisor', 'project_coordinator']::text[]
  ) then
    raise exception 'QR-koodin poistamiseen ei ole oikeutta.' using errcode = '42501';
  end if;

  update public.work_site_qr_tokens
  set is_active = false
  where id = token_row.id
    and is_active;

  insert into public.audit_logs(organization_id, user_id, action, table_name, record_id, metadata)
  values (
    token_row.organization_id,
    auth.uid(),
    'deactivate_qr_token',
    'work_site_qr_tokens',
    token_row.id,
    jsonb_build_object('project_id', token_row.project_id)
  );
end;
$$;

revoke all on function public.deactivate_work_site_qr_token(uuid) from public, anon;
grant execute on function public.deactivate_work_site_qr_token(uuid) to authenticated;
