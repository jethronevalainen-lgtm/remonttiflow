begin;

alter table public.customer_users
  add column if not exists access_scope text not null default 'all_projects';

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.customer_users'::regclass
      and conname = 'customer_users_access_scope_check'
  ) then
    alter table public.customer_users
      add constraint customer_users_access_scope_check
      check (access_scope in ('all_projects', 'selected_projects'));
  end if;
end;
$$;

create table if not exists public.customer_user_projects (
  organization_id uuid not null,
  customer_id uuid not null,
  user_id uuid not null,
  project_id uuid not null,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  primary key (organization_id, customer_id, user_id, project_id),
  constraint customer_user_projects_customer_user_fkey
    foreign key (organization_id, customer_id, user_id)
    references public.customer_users(organization_id, customer_id, user_id)
    on delete cascade,
  constraint customer_user_projects_project_fkey
    foreign key (project_id, organization_id)
    references public.projects(id, organization_id)
    on delete cascade
);

create index if not exists idx_customer_user_projects_user
  on public.customer_user_projects(organization_id, user_id);
create index if not exists idx_customer_user_projects_project
  on public.customer_user_projects(organization_id, project_id);

alter table public.customer_user_projects enable row level security;
revoke all on public.customer_user_projects from anon, authenticated;

create or replace function private.customer_user_can_access_project(
  p_project_id uuid,
  p_organization_id uuid,
  p_user_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = pg_catalog, public
as $$
  select exists (
    select 1
    from public.projects p
    join public.customer_users cu
      on cu.organization_id = p.organization_id
     and cu.customer_id = p.customer_id
     and cu.user_id = p_user_id
    join public.organization_members om
      on om.organization_id = cu.organization_id
     and om.user_id = cu.user_id
     and om.role = 'customer'
    where p.id = p_project_id
      and p.organization_id = p_organization_id
      and p.archived_at is null
      and (
        cu.access_scope = 'all_projects'
        or exists (
          select 1
          from public.customer_user_projects cup
          where cup.organization_id = cu.organization_id
            and cup.customer_id = cu.customer_id
            and cup.user_id = cu.user_id
            and cup.project_id = p.id
        )
      )
  );
$$;

create or replace function private.is_customer_project_user(
  p_project_id uuid,
  p_organization_id uuid,
  p_user_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = pg_catalog, public
as $$
  select private.customer_user_can_access_project(
    p_project_id,
    p_organization_id,
    p_user_id
  );
$$;

create or replace function public.customer_portal_projects(p_organization_id uuid)
returns table(id uuid, customer_id uuid, name text, location text)
language sql
stable
security definer
set search_path = pg_catalog, public
as $$
  select p.id, p.customer_id, p.name, p.location
  from public.projects p
  where p.organization_id = p_organization_id
    and p.archived_at is null
    and private.customer_user_can_access_project(p.id, p.organization_id, auth.uid())
  order by p.name;
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
  left join public.profiles supervisor on supervisor.id = p.responsible_supervisor_id
  where p.organization_id = p_organization_id
    and p.archived_at is null
    and private.customer_user_can_access_project(p.id, p.organization_id, auth.uid())
  order by p.updated_at desc nulls last, p.name;
$$;

create or replace function public.customer_portal_accounts_v2(p_organization_id uuid)
returns table (
  customer_id uuid,
  customer_name text,
  access_scope text,
  visible_project_count bigint
)
language sql
stable
security definer
set search_path = pg_catalog, public
as $$
  select
    c.id,
    c.name,
    cu.access_scope,
    count(p.id) filter (
      where p.archived_at is null
        and private.customer_user_can_access_project(p.id, p.organization_id, auth.uid())
    )
  from public.customer_users cu
  join public.customers c
    on c.id = cu.customer_id
   and c.organization_id = cu.organization_id
  join public.organization_members om
    on om.organization_id = cu.organization_id
   and om.user_id = cu.user_id
   and om.role = 'customer'
  left join public.projects p
    on p.organization_id = c.organization_id
   and p.customer_id = c.id
  where cu.organization_id = p_organization_id
    and cu.user_id = auth.uid()
  group by c.id, c.name, cu.access_scope
  order by c.name;
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
      or exists (
        select 1
        from public.customer_users cu
        join public.organization_members om
          on om.organization_id = cu.organization_id
         and om.user_id = cu.user_id
         and om.role = 'customer'
        where cu.organization_id = r.organization_id
          and cu.customer_id = r.customer_id
          and cu.user_id = auth.uid()
          and (
            cu.access_scope = 'all_projects'
            or (
              r.converted_project_id is not null
              and private.customer_user_can_access_project(
                r.converted_project_id,
                r.organization_id,
                auth.uid()
              )
            )
            or r.created_by = auth.uid()
          )
      )
    )
  order by r.created_at desc;
$$;

create or replace function public.create_customer_work_request(
  p_organization_id uuid,
  p_customer_id uuid,
  p_project_id uuid,
  p_title text,
  p_category text,
  p_description text,
  p_location_details text default null,
  p_contact_name text default null,
  p_contact_phone text default null,
  p_requested_date date default null,
  p_preferred_time text default null,
  p_urgency text default 'Normaali',
  p_access_instructions text default null,
  p_safety_notes text default null
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
  if not private.customer_user_can_access_project(p_project_id, p_organization_id, auth.uid()) then
    raise exception 'Valittu kohde ei kuulu käyttöoikeuksiisi.' using errcode = '42501';
  end if;
  if not exists (
    select 1 from public.projects p
    where p.id = p_project_id
      and p.organization_id = p_organization_id
      and p.customer_id = p_customer_id
  ) then
    raise exception 'Valittu kohde ei kuulu tilaajalle.' using errcode = '42501';
  end if;
  if nullif(trim(p_title), '') is null or char_length(trim(p_title)) > 180 then
    raise exception 'Anna 3–180 merkin otsikko.' using errcode = '23514';
  end if;
  if nullif(trim(p_category), '') is null then
    raise exception 'Valitse työn laji.' using errcode = '23514';
  end if;
  if char_length(trim(coalesce(p_description, ''))) < 10 then
    raise exception 'Kuvaile työ vähintään 10 merkillä.' using errcode = '23514';
  end if;
  if p_urgency not in ('Kiireellinen', 'Normaali', 'Ei kiireellinen') then
    raise exception 'Virheellinen kiireellisyys.' using errcode = '23514';
  end if;

  insert into public.customer_work_requests(
    organization_id, customer_id, project_id, created_by, title, category,
    description, location_details, contact_name, contact_phone, requested_date,
    preferred_time, urgency, access_instructions, safety_notes
  ) values (
    p_organization_id, p_customer_id, p_project_id, auth.uid(), trim(p_title),
    trim(p_category), trim(p_description), nullif(trim(coalesce(p_location_details, '')), ''),
    nullif(trim(coalesce(p_contact_name, '')), ''),
    nullif(trim(coalesce(p_contact_phone, '')), ''), p_requested_date,
    nullif(trim(coalesce(p_preferred_time, '')), ''), p_urgency,
    nullif(trim(coalesce(p_access_instructions, '')), ''),
    nullif(trim(coalesce(p_safety_notes, '')), '')
  ) returning id into result_id;

  insert into public.audit_logs(organization_id, user_id, action, table_name, record_id)
  values (p_organization_id, auth.uid(), 'customer_work_request_created', 'customer_work_requests', result_id);
  return result_id;
end;
$$;

create or replace function public.project_conversation_participants_v2(p_project_id uuid)
returns table(user_id uuid, display_name text, email text, role text, can_use_internal boolean)
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
    raise exception 'Projektin osallistujia ei voi tarkastella.' using errcode = '42501';
  end if;

  return query
  select distinct
    om.user_id,
    coalesce(nullif(pr.full_name, ''), nullif(pr.email, ''), 'Käyttäjä'),
    coalesce(pr.email, ''),
    om.role,
    private.can_use_internal_project_channel(project_row.id, project_row.organization_id, om.user_id)
  from public.organization_members om
  left join public.profiles pr on pr.id = om.user_id
  where om.organization_id = project_row.organization_id
    and (
      om.role in ('admin', 'supervisor')
      or (
        om.role = 'worker'
        and (
          exists (
            select 1 from public.project_members pm
            where pm.project_id = project_row.id
              and pm.organization_id = project_row.organization_id
              and pm.user_id = om.user_id
          )
          or exists (
            select 1
            from public.work_orders wo
            join public.work_order_assignees wa
              on wa.work_order_id = wo.id
             and wa.organization_id = wo.organization_id
            where wo.project_id = project_row.id
              and wo.organization_id = project_row.organization_id
              and wa.user_id = om.user_id
          )
        )
      )
      or (
        om.role = 'customer'
        and private.customer_user_can_access_project(
          project_row.id,
          project_row.organization_id,
          om.user_id
        )
      )
    )
  order by 2;
end;
$$;

create or replace function public.admin_customer_access_catalog(p_organization_id uuid)
returns table(customer_id uuid, customer_name text, projects jsonb)
language plpgsql
stable
security definer
set search_path = pg_catalog, public
as $$
begin
  if not private.has_org_role(p_organization_id, array['admin']::text[]) then
    raise exception 'Vain ylläpitäjä voi tarkastella tilaajaoikeuksia.' using errcode = '42501';
  end if;
  return query
  select
    c.id,
    c.name,
    coalesce(jsonb_agg(
      jsonb_build_object('id', p.id, 'name', p.name, 'location', p.location, 'status', p.status)
      order by p.name
    ) filter (where p.id is not null), '[]'::jsonb)
  from public.customers c
  left join public.projects p
    on p.organization_id = c.organization_id
   and p.customer_id = c.id
   and p.archived_at is null
  where c.organization_id = p_organization_id
    and c.archived_at is null
  group by c.id, c.name
  order by c.name;
end;
$$;

create or replace function public.admin_customer_user_access(
  p_organization_id uuid,
  p_user_id uuid
)
returns table(
  customer_id uuid,
  customer_name text,
  access_scope text,
  project_ids uuid[]
)
language plpgsql
stable
security definer
set search_path = pg_catalog, public
as $$
begin
  if not private.has_org_role(p_organization_id, array['admin']::text[]) then
    raise exception 'Vain ylläpitäjä voi tarkastella tilaajaoikeuksia.' using errcode = '42501';
  end if;
  return query
  select
    cu.customer_id,
    c.name,
    cu.access_scope,
    coalesce(array_agg(cup.project_id order by cup.project_id) filter (where cup.project_id is not null), '{}'::uuid[])
  from public.customer_users cu
  join public.customers c
    on c.id = cu.customer_id
   and c.organization_id = cu.organization_id
  left join public.customer_user_projects cup
    on cup.organization_id = cu.organization_id
   and cup.customer_id = cu.customer_id
   and cup.user_id = cu.user_id
  where cu.organization_id = p_organization_id
    and cu.user_id = p_user_id
  group by cu.customer_id, c.name, cu.access_scope
  order by c.name;
end;
$$;

create or replace function public.admin_set_customer_user_access(
  p_organization_id uuid,
  p_user_id uuid,
  p_access jsonb
)
returns void
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  item jsonb;
  resolved_customer_id uuid;
  resolved_scope text;
  project_value jsonb;
  resolved_project_id uuid;
begin
  if not private.has_org_role(p_organization_id, array['admin']::text[]) then
    raise exception 'Vain ylläpitäjä voi muuttaa tilaajaoikeuksia.' using errcode = '42501';
  end if;
  if not exists (
    select 1 from public.organization_members om
    where om.organization_id = p_organization_id
      and om.user_id = p_user_id
      and om.role = 'customer'
  ) then
    raise exception 'Käyttäjä ei ole tämän organisaation tilaaja.' using errcode = '42501';
  end if;
  if jsonb_typeof(coalesce(p_access, '[]'::jsonb)) <> 'array' then
    raise exception 'Tilaajaoikeuksien muoto on virheellinen.' using errcode = '23514';
  end if;

  delete from public.customer_users
  where organization_id = p_organization_id
    and user_id = p_user_id;

  for item in select value from jsonb_array_elements(coalesce(p_access, '[]'::jsonb))
  loop
    resolved_customer_id := nullif(item->>'customerId', '')::uuid;
    resolved_scope := coalesce(nullif(item->>'accessScope', ''), 'all_projects');
    if resolved_scope not in ('all_projects', 'selected_projects') then
      raise exception 'Tuntematon tilaajan käyttöoikeuslaajuus.' using errcode = '23514';
    end if;
    if not exists (
      select 1 from public.customers c
      where c.id = resolved_customer_id
        and c.organization_id = p_organization_id
        and c.archived_at is null
    ) then
      raise exception 'Valittu tilaaja-asiakkuus ei kuulu organisaatioon.' using errcode = '23503';
    end if;

    insert into public.customer_users(organization_id, customer_id, user_id, access_scope)
    values (p_organization_id, resolved_customer_id, p_user_id, resolved_scope);

    if resolved_scope = 'selected_projects' then
      if jsonb_typeof(coalesce(item->'projectIds', '[]'::jsonb)) <> 'array'
         or jsonb_array_length(coalesce(item->'projectIds', '[]'::jsonb)) = 0 then
        raise exception 'Valitse vähintään yksi projekti rajattuun tilaajaoikeuteen.' using errcode = '23514';
      end if;
      for project_value in select value from jsonb_array_elements(coalesce(item->'projectIds', '[]'::jsonb))
      loop
        resolved_project_id := trim(both '"' from project_value::text)::uuid;
        if not exists (
          select 1 from public.projects p
          where p.id = resolved_project_id
            and p.organization_id = p_organization_id
            and p.customer_id = resolved_customer_id
            and p.archived_at is null
        ) then
          raise exception 'Valittu projekti ei kuulu tilaaja-asiakkuuteen.' using errcode = '23503';
        end if;
        insert into public.customer_user_projects(
          organization_id, customer_id, user_id, project_id, created_by
        ) values (
          p_organization_id, resolved_customer_id, p_user_id, resolved_project_id, auth.uid()
        );
      end loop;
    end if;
  end loop;

  insert into public.audit_logs(organization_id, user_id, action, table_name, record_id, metadata)
  values (
    p_organization_id,
    auth.uid(),
    'customer_portal_access_updated',
    'customer_users',
    p_user_id,
    jsonb_build_object('target_user_id', p_user_id, 'access', coalesce(p_access, '[]'::jsonb))
  );
end;
$$;

create or replace function private.admin_preview_project_allowed(
  p_project_id uuid,
  p_organization_id uuid,
  p_customer_ids uuid[],
  p_project_ids uuid[],
  p_access_scope text
)
returns boolean
language sql
stable
security definer
set search_path = pg_catalog, public
as $$
  select exists (
    select 1 from public.projects p
    where p.id = p_project_id
      and p.organization_id = p_organization_id
      and p.archived_at is null
      and p.customer_id = any(coalesce(p_customer_ids, '{}'::uuid[]))
      and (
        p_access_scope = 'all_projects'
        or p.id = any(coalesce(p_project_ids, '{}'::uuid[]))
      )
  );
$$;

create or replace function public.admin_preview_customer_accounts(
  p_organization_id uuid,
  p_customer_ids uuid[]
)
returns table(customer_id uuid, customer_name text, access_scope text, visible_project_count bigint)
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
  select c.id, c.name, 'preview'::text, count(p.id)
  from public.customers c
  left join public.projects p
    on p.organization_id = c.organization_id
   and p.customer_id = c.id
   and p.archived_at is null
  where c.organization_id = p_organization_id
    and c.id = any(coalesce(p_customer_ids, '{}'::uuid[]))
    and c.archived_at is null
  group by c.id, c.name
  order by c.name;
end;
$$;

create or replace function public.admin_preview_customer_project_summaries(
  p_organization_id uuid,
  p_customer_ids uuid[],
  p_project_ids uuid[],
  p_access_scope text
)
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
language plpgsql
stable
security definer
set search_path = pg_catalog, public
as $$
begin
  if not private.has_org_role(p_organization_id, array['admin']::text[]) then
    raise exception 'Vain ylläpitäjä voi esikatsella tilaajaportaalia.' using errcode = '42501';
  end if;
  if p_access_scope not in ('all_projects', 'selected_projects') then
    raise exception 'Virheellinen esikatselun laajuus.' using errcode = '23514';
  end if;
  return query
  select
    p.id, p.customer_id, p.name, p.location, p.status, p.start_date, p.end_date,
    coalesce(p.progress, 0), p.description, supervisor.full_name, supervisor.email
  from public.projects p
  left join public.profiles supervisor on supervisor.id = p.responsible_supervisor_id
  where p.organization_id = p_organization_id
    and private.admin_preview_project_allowed(
      p.id, p.organization_id, p_customer_ids, p_project_ids, p_access_scope
    )
  order by p.updated_at desc nulls last, p.name;
end;
$$;

create or replace function public.admin_preview_project_requests(
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
    r.location, r.description, r.desired_start_date, r.desired_end_date,
    r.contact_name, r.contact_phone, r.status, r.management_note,
    r.converted_project_id, r.created_at, r.reviewed_at
  from public.project_requests r
  join public.customers c on c.id = r.customer_id
  where r.organization_id = p_organization_id
    and r.customer_id = any(coalesce(p_customer_ids, '{}'::uuid[]))
    and (
      p_access_scope = 'all_projects'
      or r.converted_project_id = any(coalesce(p_project_ids, '{}'::uuid[]))
    )
  order by r.created_at desc;
end;
$$;

create or replace function public.admin_preview_customer_project_context(
  p_project_id uuid,
  p_organization_id uuid,
  p_customer_ids uuid[],
  p_project_ids uuid[],
  p_access_scope text
)
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
  select p.id, p.name, p.customer, p.location, p.status, p.start_date, p.end_date,
         coalesce(p.progress, 0), p.description, false
  from public.projects p
  where p.id = p_project_id
    and p.organization_id = p_organization_id
    and private.admin_preview_project_allowed(
      p.id, p.organization_id, p_customer_ids, p_project_ids, p_access_scope
    );
end;
$$;

create or replace function public.admin_preview_customer_documents(
  p_project_id uuid,
  p_organization_id uuid,
  p_customer_ids uuid[],
  p_project_ids uuid[],
  p_access_scope text
)
returns table (
  id uuid,
  project_id uuid,
  document_type text,
  title text,
  description text,
  storage_path text,
  file_name text,
  mime_type text,
  size_bytes bigint,
  created_at timestamptz
)
language plpgsql
stable
security definer
set search_path = pg_catalog, public
as $$
begin
  if not private.has_org_role(p_organization_id, array['admin']::text[])
     or not private.admin_preview_project_allowed(
       p_project_id, p_organization_id, p_customer_ids, p_project_ids, p_access_scope
     ) then
    raise exception 'Projektin dokumentteihin ei ole esikatseluoikeutta.' using errcode = '42501';
  end if;
  return query
  select d.id, d.project_id, d.document_type, d.title, d.description,
         d.storage_path, d.file_name, d.mime_type, d.size_bytes, d.created_at
  from public.project_documents d
  where d.project_id = p_project_id
    and d.organization_id = p_organization_id
    and d.archived_at is null
    and d.visible_to_roles && array['customer']::text[]
  order by d.created_at desc;
end;
$$;

create or replace function public.admin_preview_customer_change_orders(
  p_project_id uuid,
  p_organization_id uuid,
  p_customer_ids uuid[],
  p_project_ids uuid[],
  p_access_scope text
)
returns table (
  id uuid,
  project_id uuid,
  change_number text,
  title text,
  description text,
  status text,
  amount_cents bigint,
  requested_at date,
  customer_decision text,
  customer_decision_note text,
  submitted_to_customer_at timestamptz,
  customer_decided_at timestamptz
)
language plpgsql
stable
security definer
set search_path = pg_catalog, public
as $$
begin
  if not private.has_org_role(p_organization_id, array['admin']::text[])
     or not private.admin_preview_project_allowed(
       p_project_id, p_organization_id, p_customer_ids, p_project_ids, p_access_scope
     ) then
    raise exception 'Projektin muutostöihin ei ole esikatseluoikeutta.' using errcode = '42501';
  end if;
  return query
  select c.id, c.project_id, c.change_number, c.title, c.description, c.status,
         c.amount_cents, c.requested_at, c.customer_decision,
         c.customer_decision_note, c.submitted_to_customer_at, c.customer_decided_at
  from public.change_orders c
  where c.project_id = p_project_id
    and c.organization_id = p_organization_id
    and c.customer_visible = true
  order by c.submitted_to_customer_at desc nulls last, c.created_at desc;
end;
$$;

create or replace function public.admin_preview_customer_work_requests(
  p_organization_id uuid,
  p_customer_ids uuid[],
  p_project_ids uuid[],
  p_access_scope text
)
returns setof public.customer_work_requests
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
  select r.*
  from public.customer_work_requests r
  where r.organization_id = p_organization_id
    and r.customer_id = any(coalesce(p_customer_ids, '{}'::uuid[]))
    and (
      p_access_scope = 'all_projects'
      or r.project_id = any(coalesce(p_project_ids, '{}'::uuid[]))
    )
  order by r.created_at desc;
end;
$$;

create or replace function public.admin_log_customer_preview(
  p_organization_id uuid,
  p_customer_ids uuid[],
  p_project_ids uuid[],
  p_access_scope text
)
returns void
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
begin
  if not private.has_org_role(p_organization_id, array['admin']::text[]) then
    raise exception 'Vain ylläpitäjä voi esikatsella tilaajaportaalia.' using errcode = '42501';
  end if;
  insert into public.audit_logs(organization_id, user_id, action, table_name, metadata)
  values (
    p_organization_id,
    auth.uid(),
    'customer_portal_preview_started',
    'customer_users',
    jsonb_build_object(
      'customer_ids', coalesce(p_customer_ids, '{}'::uuid[]),
      'project_ids', coalesce(p_project_ids, '{}'::uuid[]),
      'access_scope', p_access_scope
    )
  );
end;
$$;

revoke all on function public.customer_portal_accounts_v2(uuid) from public, anon;
revoke all on function public.admin_customer_access_catalog(uuid) from public, anon;
revoke all on function public.admin_customer_user_access(uuid, uuid) from public, anon;
revoke all on function public.admin_set_customer_user_access(uuid, uuid, jsonb) from public, anon;
revoke all on function public.admin_preview_customer_accounts(uuid, uuid[]) from public, anon;
revoke all on function public.admin_preview_customer_project_summaries(uuid, uuid[], uuid[], text) from public, anon;
revoke all on function public.admin_preview_project_requests(uuid, uuid[], uuid[], text) from public, anon;
revoke all on function public.admin_preview_customer_project_context(uuid, uuid, uuid[], uuid[], text) from public, anon;
revoke all on function public.admin_preview_customer_documents(uuid, uuid, uuid[], uuid[], text) from public, anon;
revoke all on function public.admin_preview_customer_change_orders(uuid, uuid, uuid[], uuid[], text) from public, anon;
revoke all on function public.admin_preview_customer_work_requests(uuid, uuid[], uuid[], text) from public, anon;
revoke all on function public.admin_log_customer_preview(uuid, uuid[], uuid[], text) from public, anon;

grant execute on function public.customer_portal_accounts_v2(uuid) to authenticated;
grant execute on function public.admin_customer_access_catalog(uuid) to authenticated;
grant execute on function public.admin_customer_user_access(uuid, uuid) to authenticated;
grant execute on function public.admin_set_customer_user_access(uuid, uuid, jsonb) to authenticated;
grant execute on function public.admin_preview_customer_accounts(uuid, uuid[]) to authenticated;
grant execute on function public.admin_preview_customer_project_summaries(uuid, uuid[], uuid[], text) to authenticated;
grant execute on function public.admin_preview_project_requests(uuid, uuid[], uuid[], text) to authenticated;
grant execute on function public.admin_preview_customer_project_context(uuid, uuid, uuid[], uuid[], text) to authenticated;
grant execute on function public.admin_preview_customer_documents(uuid, uuid, uuid[], uuid[], text) to authenticated;
grant execute on function public.admin_preview_customer_change_orders(uuid, uuid, uuid[], uuid[], text) to authenticated;
grant execute on function public.admin_preview_customer_work_requests(uuid, uuid[], uuid[], text) to authenticated;
grant execute on function public.admin_log_customer_preview(uuid, uuid[], uuid[], text) to authenticated;

commit;
