begin;

-- Safe customer portal and project-request APIs.
create or replace function public.customer_portal_accounts(p_organization_id uuid)
returns table (customer_id uuid, customer_name text)
language sql
stable
security definer
set search_path = pg_catalog, public
as $$
  select c.id, c.name
  from public.customer_users cu
  join public.customers c
    on c.id = cu.customer_id
   and c.organization_id = cu.organization_id
  join public.organization_members om
    on om.organization_id = cu.organization_id
   and om.user_id = cu.user_id
   and om.role = 'customer'
  where cu.organization_id = p_organization_id
    and cu.user_id = auth.uid()
  order by c.name;
$$;

create or replace function public.customer_portal_project_summaries(p_organization_id uuid)
returns table (
  id uuid,
  customer_id uuid,
  name text,
  location text,
  status text,
  start_date date,
  end_date date,
  progress integer,
  description text,
  supervisor_name text,
  supervisor_email text
)
language sql
stable
security definer
set search_path = pg_catalog, public
as $$
  select
    p.id,
    p.customer_id,
    p.name,
    p.location,
    p.status,
    p.start_date,
    p.end_date,
    coalesce(p.progress, 0),
    p.description,
    supervisor.full_name,
    supervisor.email
  from public.projects p
  join public.customer_users cu
    on cu.organization_id = p.organization_id
   and cu.customer_id = p.customer_id
   and cu.user_id = auth.uid()
  join public.organization_members om
    on om.organization_id = cu.organization_id
   and om.user_id = cu.user_id
   and om.role = 'customer'
  left join public.profiles supervisor on supervisor.id = p.responsible_supervisor_id
  where p.organization_id = p_organization_id
    and p.archived_at is null
  order by p.updated_at desc nulls last, p.name;
$$;

create or replace function public.project_requests_for_user(p_organization_id uuid)
returns table (
  id uuid,
  organization_id uuid,
  customer_id uuid,
  customer_name text,
  created_by uuid,
  project_name text,
  location text,
  description text,
  desired_start_date date,
  desired_end_date date,
  contact_name text,
  contact_phone text,
  status text,
  management_note text,
  converted_project_id uuid,
  created_at timestamptz,
  reviewed_at timestamptz
)
language sql
stable
security definer
set search_path = pg_catalog, public
as $$
  select
    r.id,
    r.organization_id,
    r.customer_id,
    c.name,
    r.created_by,
    r.project_name,
    r.location,
    r.description,
    r.desired_start_date,
    r.desired_end_date,
    r.contact_name,
    r.contact_phone,
    r.status,
    r.management_note,
    r.converted_project_id,
    r.created_at,
    r.reviewed_at
  from public.project_requests r
  join public.customers c on c.id = r.customer_id
  where r.organization_id = p_organization_id
    and (
      private.is_management_user(r.organization_id, auth.uid())
      or r.created_by = auth.uid()
    )
  order by r.created_at desc;
$$;

create or replace function public.create_customer_project_request(
  p_organization_id uuid,
  p_customer_id uuid,
  p_project_name text,
  p_location text,
  p_description text,
  p_desired_start_date date,
  p_desired_end_date date,
  p_contact_name text,
  p_contact_phone text
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
  if char_length(trim(coalesce(p_project_name, ''))) not between 3 and 180 then
    raise exception 'Anna projektille 3–180 merkin nimi.' using errcode = '23514';
  end if;
  if char_length(trim(coalesce(p_description, ''))) < 10 then
    raise exception 'Kuvaa projekti vähintään 10 merkillä.' using errcode = '23514';
  end if;
  if p_desired_end_date is not null and p_desired_start_date is not null
     and p_desired_end_date < p_desired_start_date then
    raise exception 'Tavoitevalmistuminen ei voi olla ennen aloitusta.' using errcode = '23514';
  end if;

  insert into public.project_requests (
    organization_id, customer_id, created_by, project_name, location,
    description, desired_start_date, desired_end_date, contact_name, contact_phone
  ) values (
    p_organization_id, p_customer_id, auth.uid(), trim(p_project_name),
    nullif(trim(coalesce(p_location, '')), ''), trim(p_description),
    p_desired_start_date, p_desired_end_date,
    nullif(trim(coalesce(p_contact_name, '')), ''),
    nullif(trim(coalesce(p_contact_phone, '')), '')
  ) returning id into result_id;

  insert into public.audit_logs (organization_id, user_id, action, table_name, record_id)
  values (p_organization_id, auth.uid(), 'customer_project_request_created', 'project_requests', result_id);
  return result_id;
end;
$$;

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
begin
  select * into request_row from public.project_requests where id = p_request_id for update;
  if request_row.id is null then
    raise exception 'Projektipyyntöä ei löytynyt.' using errcode = '23503';
  end if;
  if not private.is_management_user(request_row.organization_id, auth.uid()) then
    raise exception 'Vain työnjohto voi käsitellä projektipyyntöjä.' using errcode = '42501';
  end if;
  if p_status not in ('Käsittelyssä', 'Lisätietoja pyydetty', 'Hylätty') then
    raise exception 'Virheellinen käsittelytila.' using errcode = '23514';
  end if;

  update public.project_requests
  set status = p_status,
      management_note = nullif(trim(coalesce(p_management_note, '')), ''),
      reviewed_by = auth.uid(),
      reviewed_at = now()
  where id = p_request_id;
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
begin
  select * into request_row from public.project_requests where id = p_request_id for update;
  if request_row.id is null then
    raise exception 'Projektipyyntöä ei löytynyt.' using errcode = '23503';
  end if;
  if not private.is_management_user(request_row.organization_id, auth.uid()) then
    raise exception 'Vain työnjohto voi perustaa projektin.' using errcode = '42501';
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
    project_number, responsible_supervisor_id
  ) values (
    request_row.organization_id, auth.uid(), request_row.customer_id, customer_name,
    request_row.project_name, request_row.location, 'Suunniteltu',
    request_row.desired_start_date, request_row.desired_end_date, 0, 0, 0,
    request_row.description, resolved_project_number, auth.uid()
  ) returning id into result_project_id;

  update public.project_requests
  set status = 'Muutettu projektiksi',
      management_note = nullif(trim(coalesce(p_management_note, '')), ''),
      reviewed_by = auth.uid(),
      reviewed_at = now(),
      converted_project_id = result_project_id
  where id = request_row.id;

  insert into public.audit_logs (organization_id, user_id, action, table_name, record_id, metadata)
  values (
    request_row.organization_id, auth.uid(), 'project_request_approved',
    'project_requests', request_row.id,
    jsonb_build_object('project_id', result_project_id, 'project_number', resolved_project_number)
  );
  return result_project_id;
end;
$$;

-- Conversation APIs return only safe project fields and visible messages.
create or replace function public.accessible_project_conversations(p_organization_id uuid)
returns table (
  project_id uuid,
  project_name text,
  location text,
  status text,
  can_use_internal boolean,
  unread_count bigint,
  last_message_at timestamptz
)
language sql
stable
security definer
set search_path = pg_catalog, public
as $$
  select
    p.id,
    p.name,
    p.location,
    p.status,
    private.can_use_internal_project_channel(p.id, p.organization_id, auth.uid()),
    (
      select count(*)
      from public.project_messages m
      where m.project_id = p.id
        and m.deleted_at is null
        and (
          m.channel = 'shared'
          or private.can_use_internal_project_channel(p.id, p.organization_id, auth.uid())
        )
        and m.created_at > coalesce((
          select max(r.last_read_at)
          from public.project_message_reads r
          where r.project_id = p.id
            and r.user_id = auth.uid()
            and r.channel = m.channel
        ), '-infinity'::timestamptz)
        and m.author_user_id <> auth.uid()
    ),
    (
      select max(m.created_at)
      from public.project_messages m
      where m.project_id = p.id
        and m.deleted_at is null
        and (
          m.channel = 'shared'
          or private.can_use_internal_project_channel(p.id, p.organization_id, auth.uid())
        )
    )
  from public.projects p
  where p.organization_id = p_organization_id
    and p.archived_at is null
    and private.can_collaborate_on_project(p.id, p.organization_id, auth.uid())
  order by 7 desc nulls last, p.name;
$$;

create or replace function public.project_conversation_context(p_project_id uuid)
returns table (
  project_id uuid,
  project_name text,
  customer_name text,
  location text,
  status text,
  start_date date,
  end_date date,
  progress integer,
  description text,
  can_use_internal boolean
)
language sql
stable
security definer
set search_path = pg_catalog, public
as $$
  select
    p.id,
    p.name,
    p.customer,
    p.location,
    p.status,
    p.start_date,
    p.end_date,
    coalesce(p.progress, 0),
    p.description,
    private.can_use_internal_project_channel(p.id, p.organization_id, auth.uid())
  from public.projects p
  where p.id = p_project_id
    and private.can_collaborate_on_project(p.id, p.organization_id, auth.uid());
$$;

create or replace function public.project_messages_for_user(
  p_project_id uuid,
  p_channel text
)
returns table (
  id uuid,
  project_id uuid,
  author_user_id uuid,
  author_name text,
  channel text,
  body text,
  created_at timestamptz,
  edited_at timestamptz
)
language plpgsql
stable
security definer
set search_path = pg_catalog, public
as $$
declare
  project_row public.projects%rowtype;
begin
  select p.* into project_row from public.projects p where p.id = p_project_id;
  if project_row.id is null
     or not private.can_collaborate_on_project(project_row.id, project_row.organization_id, auth.uid()) then
    raise exception 'Projektin keskusteluun ei ole käyttöoikeutta.' using errcode = '42501';
  end if;
  if p_channel not in ('shared', 'internal') then
    raise exception 'Virheellinen keskustelukanava.' using errcode = '23514';
  end if;
  if p_channel = 'internal'
     and not private.can_use_internal_project_channel(project_row.id, project_row.organization_id, auth.uid()) then
    raise exception 'Sisäinen keskustelu ei kuulu käyttöoikeuksiisi.' using errcode = '42501';
  end if;

  return query
  select m.id, m.project_id, m.author_user_id,
         coalesce(nullif(p.full_name, ''), nullif(p.email, ''), 'Käyttäjä'),
         m.channel, m.body, m.created_at, m.edited_at
  from public.project_messages m
  left join public.profiles p on p.id = m.author_user_id
  where m.project_id = p_project_id
    and m.channel = p_channel
    and m.deleted_at is null
  order by m.created_at;
end;
$$;

create or replace function public.send_project_message(
  p_project_id uuid,
  p_channel text,
  p_body text
)
returns uuid
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  project_row public.projects%rowtype;
  result_id uuid;
begin
  select p.* into project_row from public.projects p where p.id = p_project_id;
  if project_row.id is null
     or not private.can_collaborate_on_project(project_row.id, project_row.organization_id, auth.uid()) then
    raise exception 'Projektin keskusteluun ei ole käyttöoikeutta.' using errcode = '42501';
  end if;
  if p_channel not in ('shared', 'internal') then
    raise exception 'Virheellinen keskustelukanava.' using errcode = '23514';
  end if;
  if p_channel = 'internal'
     and not private.can_use_internal_project_channel(project_row.id, project_row.organization_id, auth.uid()) then
    raise exception 'Sisäinen keskustelu ei kuulu käyttöoikeuksiisi.' using errcode = '42501';
  end if;
  if char_length(trim(coalesce(p_body, ''))) not between 1 and 4000 then
    raise exception 'Viestin pituuden pitää olla 1–4000 merkkiä.' using errcode = '23514';
  end if;

  insert into public.project_messages (
    organization_id, project_id, author_user_id, channel, body
  ) values (
    project_row.organization_id, project_row.id, auth.uid(), p_channel, trim(p_body)
  ) returning id into result_id;

  insert into public.audit_logs (organization_id, user_id, action, table_name, record_id, metadata)
  values (
    project_row.organization_id, auth.uid(), 'project_message_sent',
    'project_messages', result_id, jsonb_build_object('project_id', project_row.id, 'channel', p_channel)
  );
  return result_id;
end;
$$;

create or replace function public.mark_project_messages_read(
  p_project_id uuid,
  p_channel text
)
returns void
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  project_row public.projects%rowtype;
begin
  select p.* into project_row from public.projects p where p.id = p_project_id;
  if project_row.id is null
     or not private.can_collaborate_on_project(project_row.id, project_row.organization_id, auth.uid()) then
    raise exception 'Projektin keskusteluun ei ole käyttöoikeutta.' using errcode = '42501';
  end if;
  if p_channel not in ('shared', 'internal') then
    raise exception 'Virheellinen keskustelukanava.' using errcode = '23514';
  end if;
  if p_channel = 'internal'
     and not private.can_use_internal_project_channel(project_row.id, project_row.organization_id, auth.uid()) then
    raise exception 'Sisäinen keskustelu ei kuulu käyttöoikeuksiisi.' using errcode = '42501';
  end if;

  insert into public.project_message_reads(project_id, user_id, channel, last_read_at)
  values (p_project_id, auth.uid(), p_channel, now())
  on conflict (project_id, user_id, channel)
  do update set last_read_at = excluded.last_read_at;
end;
$$;

revoke all on function public.customer_portal_accounts(uuid) from public, anon;
revoke all on function public.customer_portal_project_summaries(uuid) from public, anon;
revoke all on function public.project_requests_for_user(uuid) from public, anon;
revoke all on function public.create_customer_project_request(uuid, uuid, text, text, text, date, date, text, text) from public, anon;
revoke all on function public.review_project_request(uuid, text, text) from public, anon;
revoke all on function public.approve_project_request(uuid, text, text) from public, anon;
revoke all on function public.accessible_project_conversations(uuid) from public, anon;
revoke all on function public.project_conversation_context(uuid) from public, anon;
revoke all on function public.project_messages_for_user(uuid, text) from public, anon;
revoke all on function public.send_project_message(uuid, text, text) from public, anon;
revoke all on function public.mark_project_messages_read(uuid, text) from public, anon;

grant execute on function public.customer_portal_accounts(uuid) to authenticated;
grant execute on function public.customer_portal_project_summaries(uuid) to authenticated;
grant execute on function public.project_requests_for_user(uuid) to authenticated;
grant execute on function public.create_customer_project_request(uuid, uuid, text, text, text, date, date, text, text) to authenticated;
grant execute on function public.review_project_request(uuid, text, text) to authenticated;
grant execute on function public.approve_project_request(uuid, text, text) to authenticated;
grant execute on function public.accessible_project_conversations(uuid) to authenticated;
grant execute on function public.project_conversation_context(uuid) to authenticated;
grant execute on function public.project_messages_for_user(uuid, text) to authenticated;
grant execute on function public.send_project_message(uuid, text, text) to authenticated;
grant execute on function public.mark_project_messages_read(uuid, text) to authenticated;

commit;
