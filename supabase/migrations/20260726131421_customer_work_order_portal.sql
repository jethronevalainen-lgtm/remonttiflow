begin;

-- Customer users are organization members with a deliberately narrow role.
-- Their customer link is stored separately so one customer can have several
-- contacts while still seeing only their own projects and requests.
alter table public.organization_members
  drop constraint if exists organization_members_role_check;
alter table public.organization_members
  add constraint organization_members_role_check
  check (role in ('admin', 'supervisor', 'worker', 'customer'));

create table if not exists public.customer_users (
  organization_id uuid not null references public.organizations(id) on delete cascade,
  customer_id uuid not null references public.customers(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (organization_id, customer_id, user_id),
  constraint customer_users_organization_user_fkey
    foreign key (organization_id, user_id)
    references public.organization_members(organization_id, user_id)
    on delete cascade
);

create index if not exists customer_users_org_user_idx
  on public.customer_users(organization_id, user_id);

create table if not exists public.customer_work_requests (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  customer_id uuid not null references public.customers(id) on delete restrict,
  project_id uuid not null references public.projects(id) on delete restrict,
  created_by uuid not null references public.profiles(id) on delete restrict,
  title text not null check (char_length(trim(title)) between 3 and 180),
  category text not null,
  description text not null check (char_length(trim(description)) between 10 and 5000),
  location_details text,
  contact_name text,
  contact_phone text,
  requested_date date,
  preferred_time text,
  urgency text not null default 'Normaali'
    check (urgency in ('Kiireellinen', 'Normaali', 'Ei kiireellinen')),
  access_instructions text,
  safety_notes text,
  status text not null default 'Uusi'
    check (status in ('Uusi', 'Käsittelyssä', 'Työmääräys luotu', 'Peruttu')),
  supervisor_note text,
  work_order_id uuid unique references public.work_orders(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint customer_work_requests_project_org_fkey
    foreign key (project_id, organization_id)
    references public.projects(id, organization_id)
    on delete restrict
);

create index if not exists customer_work_requests_org_status_idx
  on public.customer_work_requests(organization_id, status, created_at desc);
create index if not exists customer_work_requests_customer_idx
  on public.customer_work_requests(organization_id, customer_id, created_at desc);

drop trigger if exists set_customer_work_requests_updated_at on public.customer_work_requests;
create trigger set_customer_work_requests_updated_at
  before update on public.customer_work_requests
  for each row execute function public.set_updated_at();

alter table public.customer_users enable row level security;
alter table public.customer_work_requests enable row level security;

revoke all on table public.customer_users, public.customer_work_requests from anon;
grant select on table public.customer_users, public.customer_work_requests to authenticated;

create or replace function private.is_customer_user(
  p_organization_id uuid,
  p_customer_id uuid,
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
    from public.customer_users cu
    join public.organization_members om
      on om.organization_id = cu.organization_id
     and om.user_id = cu.user_id
    where cu.organization_id = p_organization_id
      and cu.customer_id = p_customer_id
      and cu.user_id = p_user_id
      and om.role = 'customer'
  );
$$;

revoke all on function private.is_customer_user(uuid, uuid, uuid) from public, anon;
grant execute on function private.is_customer_user(uuid, uuid, uuid) to authenticated;

drop policy if exists customer_users_select on public.customer_users;
create policy customer_users_select on public.customer_users for select to authenticated
using (
  private.has_org_role(organization_id, array['admin', 'supervisor'])
  or user_id = (select auth.uid())
);

drop policy if exists customer_work_requests_select on public.customer_work_requests;
create policy customer_work_requests_select on public.customer_work_requests for select to authenticated
using (
  private.has_org_role(organization_id, array['admin', 'supervisor'])
  or private.is_customer_user(organization_id, customer_id, (select auth.uid()))
);

-- Project choices are deliberately returned through a narrow RPC: a customer
-- does not receive the organization-wide projects table.
create or replace function public.customer_portal_projects(p_organization_id uuid)
returns table (id uuid, customer_id uuid, name text, location text)
language sql
stable
security definer
set search_path = pg_catalog, public
as $$
  select p.id, p.customer_id, p.name, p.location
  from public.projects p
  where p.organization_id = p_organization_id
    and exists (
      select 1 from public.customer_users cu
      join public.organization_members om
        on om.organization_id = cu.organization_id
       and om.user_id = cu.user_id
      where cu.organization_id = p.organization_id
        and cu.customer_id = p.customer_id
        and cu.user_id = auth.uid()
        and om.role = 'customer'
    )
  order by p.name;
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
  if not private.is_customer_user(p_organization_id, p_customer_id, auth.uid()) then
    raise exception 'Tilaajan käyttöoikeutta ei löytynyt.' using errcode = '42501';
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
  if not exists (
    select 1 from public.projects p
    where p.id = p_project_id
      and p.organization_id = p_organization_id
      and p.customer_id = p_customer_id
  ) then
    raise exception 'Valittu kohde ei kuulu tilaajalle.' using errcode = '42501';
  end if;

  insert into public.customer_work_requests (
    organization_id, customer_id, project_id, created_by, title, category,
    description, location_details, contact_name, contact_phone, requested_date,
    preferred_time, urgency, access_instructions, safety_notes
  ) values (
    p_organization_id, p_customer_id, p_project_id, auth.uid(), trim(p_title),
    trim(p_category), trim(p_description), nullif(trim(coalesce(p_location_details, '')), ''),
    nullif(trim(coalesce(p_contact_name, '')), ''), nullif(trim(coalesce(p_contact_phone, '')), ''),
    p_requested_date, nullif(trim(coalesce(p_preferred_time, '')), ''), p_urgency,
    nullif(trim(coalesce(p_access_instructions, '')), ''), nullif(trim(coalesce(p_safety_notes, '')), '')
  ) returning id into result_id;

  insert into public.audit_logs (organization_id, user_id, action, table_name, record_id)
  values (p_organization_id, auth.uid(), 'customer_work_request_created', 'customer_work_requests', result_id);
  return result_id;
end;
$$;

create or replace function public.convert_customer_work_request(
  p_request_id uuid,
  p_priority text,
  p_due_date date,
  p_assignment_scope text,
  p_assignee_user_ids uuid[],
  p_supervisor_note text default null
)
returns uuid
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  request_row public.customer_work_requests%rowtype;
  result_work_order_id uuid;
  request_description text;
begin
  select * into request_row from public.customer_work_requests where id = p_request_id for update;
  if request_row.id is null then
    raise exception 'Tilausta ei löytynyt.' using errcode = '23503';
  end if;
  if not private.has_org_role(request_row.organization_id, array['admin', 'supervisor']) then
    raise exception 'Vain työnjohto voi jakaa tilauksen.' using errcode = '42501';
  end if;
  if request_row.work_order_id is not null then
    raise exception 'Tilauksesta on jo luotu työmääräys.' using errcode = '23505';
  end if;

  request_description := concat_ws(E'\n\n',
    request_row.description,
    nullif('Tarkka sijainti: ' || coalesce(request_row.location_details, ''), 'Tarkka sijainti: '),
    nullif('Pääsyohjeet: ' || coalesce(request_row.access_instructions, ''), 'Pääsyohjeet: '),
    nullif('Turvallisuushuomiot: ' || coalesce(request_row.safety_notes, ''), 'Turvallisuushuomiot: '),
    nullif('Tilaajan yhteyshenkilö: ' || concat_ws(', ', request_row.contact_name, request_row.contact_phone), 'Tilaajan yhteyshenkilö: ')
  );

  result_work_order_id := public.save_work_order(
    request_row.organization_id, null, request_row.project_id, request_row.title,
    p_due_date, p_priority, 'Avoin', request_description, request_row.category,
    p_assignment_scope, coalesce(p_assignee_user_ids, array[]::uuid[])
  );

  update public.customer_work_requests
  set status = 'Työmääräys luotu', work_order_id = result_work_order_id,
      supervisor_note = nullif(trim(coalesce(p_supervisor_note, '')), '')
  where id = request_row.id;

  insert into public.audit_logs (organization_id, user_id, action, table_name, record_id, metadata)
  values (
    request_row.organization_id, auth.uid(), 'customer_work_request_converted',
    'customer_work_requests', request_row.id, jsonb_build_object('work_order_id', result_work_order_id)
  );
  return result_work_order_id;
end;
$$;

revoke all on function public.customer_portal_projects(uuid) from public, anon;
revoke all on function public.create_customer_work_request(uuid, uuid, uuid, text, text, text, text, text, text, date, text, text, text, text) from public, anon;
revoke all on function public.convert_customer_work_request(uuid, text, date, text, uuid[], text) from public, anon;
grant execute on function public.customer_portal_projects(uuid) to authenticated;
grant execute on function public.create_customer_work_request(uuid, uuid, uuid, text, text, text, text, text, text, date, text, text, text, text) to authenticated;
grant execute on function public.convert_customer_work_request(uuid, text, date, text, uuid[], text) to authenticated;

commit;
