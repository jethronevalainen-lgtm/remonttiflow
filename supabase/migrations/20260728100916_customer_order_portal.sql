begin;

create table if not exists public.customer_order_messages (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  request_id uuid not null references public.project_requests(id) on delete cascade,
  author_id uuid not null references auth.users(id) on delete restrict,
  body text not null,
  created_at timestamptz not null default now(),
  edited_at timestamptz,
  constraint customer_order_messages_body_check check (char_length(btrim(body)) between 1 and 5000)
);

create index if not exists customer_order_messages_request_created_idx
  on public.customer_order_messages (organization_id, request_id, created_at);

create table if not exists public.customer_order_events (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  request_id uuid not null references public.project_requests(id) on delete cascade,
  event_type text not null,
  title text not null,
  description text,
  progress integer,
  visible_to_customer boolean not null default true,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  constraint customer_order_events_progress_check check (progress is null or progress between 0 and 100),
  constraint customer_order_events_title_check check (char_length(btrim(title)) between 1 and 180)
);

create index if not exists customer_order_events_request_created_idx
  on public.customer_order_events (organization_id, request_id, created_at desc)
  where visible_to_customer;

alter table public.customer_order_messages enable row level security;
alter table public.customer_order_events enable row level security;
revoke all on public.customer_order_messages from public, anon, authenticated;
revoke all on public.customer_order_events from public, anon, authenticated;
grant all on public.customer_order_messages to service_role;
grant all on public.customer_order_events to service_role;

create or replace function private.can_access_customer_order(
  p_organization_id uuid,
  p_request_id uuid,
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
    from public.project_requests r
    where r.id = p_request_id
      and r.organization_id = p_organization_id
      and (
        private.is_management_user(r.organization_id, p_user_id)
        or r.created_by = p_user_id
        or exists (
          select 1
          from public.customer_users cu
          join public.organization_members om
            on om.organization_id = cu.organization_id
           and om.user_id = cu.user_id
           and om.role = 'customer'
          where cu.organization_id = r.organization_id
            and cu.customer_id = r.customer_id
            and cu.user_id = p_user_id
            and (
              cu.access_scope = 'all_projects'
              or (
                r.converted_project_id is not null
                and exists (
                  select 1
                  from public.customer_user_projects cup
                  where cup.organization_id = cu.organization_id
                    and cup.customer_id = cu.customer_id
                    and cup.user_id = cu.user_id
                    and cup.project_id = r.converted_project_id
                )
              )
            )
        )
        or (
          r.converted_project_id is not null
          and exists (
            select 1
            from public.project_members pm
            where pm.organization_id = r.organization_id
              and pm.project_id = r.converted_project_id
              and pm.user_id = p_user_id
          )
        )
        or (
          r.converted_project_id is not null
          and exists (
            select 1
            from public.work_orders wo
            join public.work_order_assignees wa
              on wa.organization_id = wo.organization_id
             and wa.work_order_id = wo.id
            where wo.organization_id = r.organization_id
              and wo.project_id = r.converted_project_id
              and wa.user_id = p_user_id
          )
        )
      )
  );
$$;

revoke all on function private.can_access_customer_order(uuid, uuid, uuid) from public, anon, authenticated;
grant execute on function private.can_access_customer_order(uuid, uuid, uuid) to service_role;

create or replace function public.customer_order_context(
  p_organization_id uuid,
  p_request_id uuid
)
returns table (
  id uuid,
  customer_id uuid,
  customer_name text,
  title text,
  request_type text,
  location text,
  description text,
  status text,
  desired_start_date date,
  desired_end_date date,
  deadline_flexibility text,
  occupancy_status text,
  access_method text,
  allowed_working_hours text,
  contact_name text,
  contact_phone text,
  contact_email text,
  management_note text,
  converted_project_id uuid,
  project_name text,
  project_status text,
  progress integer,
  work_order_total bigint,
  work_order_completed bigint,
  message_count bigint,
  created_at timestamptz,
  submitted_at timestamptz,
  reviewed_at timestamptz
)
language plpgsql
stable
security definer
set search_path = pg_catalog, public, private
as $$
begin
  if auth.uid() is null or not private.can_access_customer_order(p_organization_id, p_request_id, auth.uid()) then
    raise exception 'Tilausta ei löytynyt tai käyttöoikeus puuttuu.' using errcode = '42501';
  end if;

  return query
  select
    r.id,
    r.customer_id,
    c.name,
    r.project_name,
    r.request_type,
    r.location,
    r.description,
    r.status,
    r.desired_start_date,
    r.desired_end_date,
    r.deadline_flexibility,
    r.occupancy_status,
    r.access_method,
    r.allowed_working_hours,
    r.contact_name,
    r.contact_phone,
    r.contact_email,
    r.management_note,
    r.converted_project_id,
    p.name,
    p.status,
    case
      when r.status = 'Luonnos' then 5
      when r.status = 'Lähetetty' then 15
      when r.status = 'Lisätietoja pyydetty' then 25
      when r.status = 'Käsittelyssä' then 35
      when r.status = 'Hyväksytty' then 45
      when r.status = 'Hylätty' then 100
      when r.converted_project_id is not null then greatest(50, least(100, coalesce(p.progress, 0)))
      else 0
    end,
    count(distinct wo.id),
    count(distinct wo.id) filter (where wo.status in ('Valmis', 'Peruttu')),
    (select count(*) from public.customer_order_messages m where m.organization_id = r.organization_id and m.request_id = r.id),
    r.created_at,
    r.submitted_at,
    r.reviewed_at
  from public.project_requests r
  join public.customers c on c.id = r.customer_id and c.organization_id = r.organization_id
  left join public.projects p on p.id = r.converted_project_id and p.organization_id = r.organization_id
  left join public.work_orders wo on wo.project_id = r.converted_project_id and wo.organization_id = r.organization_id
  where r.organization_id = p_organization_id
    and r.id = p_request_id
  group by r.id, c.name, p.id, p.name, p.status, p.progress;
end;
$$;

create or replace function public.customer_order_messages(
  p_organization_id uuid,
  p_request_id uuid
)
returns table (
  id uuid,
  author_id uuid,
  author_name text,
  author_role text,
  body text,
  created_at timestamptz,
  edited_at timestamptz
)
language plpgsql
stable
security definer
set search_path = pg_catalog, public, private
as $$
begin
  if auth.uid() is null or not private.can_access_customer_order(p_organization_id, p_request_id, auth.uid()) then
    raise exception 'Keskustelun käyttöoikeus puuttuu.' using errcode = '42501';
  end if;

  return query
  select
    m.id,
    m.author_id,
    coalesce(nullif(pr.full_name, ''), nullif(pr.email, ''), 'Käyttäjä'),
    coalesce(om.role, 'customer'),
    m.body,
    m.created_at,
    m.edited_at
  from public.customer_order_messages m
  left join public.profiles pr on pr.id = m.author_id
  left join public.organization_members om
    on om.organization_id = m.organization_id
   and om.user_id = m.author_id
  where m.organization_id = p_organization_id
    and m.request_id = p_request_id
  order by m.created_at asc;
end;
$$;

create or replace function public.customer_order_events(
  p_organization_id uuid,
  p_request_id uuid
)
returns table (
  id uuid,
  event_type text,
  title text,
  description text,
  progress integer,
  created_at timestamptz
)
language plpgsql
stable
security definer
set search_path = pg_catalog, public, private
as $$
begin
  if auth.uid() is null or not private.can_access_customer_order(p_organization_id, p_request_id, auth.uid()) then
    raise exception 'Tapahtumien käyttöoikeus puuttuu.' using errcode = '42501';
  end if;

  return query
  select e.id, e.event_type, e.title, e.description, e.progress, e.created_at
  from public.customer_order_events e
  where e.organization_id = p_organization_id
    and e.request_id = p_request_id
    and e.visible_to_customer
  order by e.created_at desc;
end;
$$;

create or replace function public.customer_order_participants(
  p_organization_id uuid,
  p_request_id uuid
)
returns table (
  user_id uuid,
  display_name text,
  role text,
  participation text
)
language plpgsql
stable
security definer
set search_path = pg_catalog, public, private
as $$
declare
  request_row public.project_requests%rowtype;
begin
  if auth.uid() is null or not private.can_access_customer_order(p_organization_id, p_request_id, auth.uid()) then
    raise exception 'Osallistujien käyttöoikeus puuttuu.' using errcode = '42501';
  end if;

  select * into request_row
  from public.project_requests
  where organization_id = p_organization_id and id = p_request_id;

  return query
  with participant_ids as (
    select om.user_id, om.role, 'Työnjohto'::text as participation
    from public.organization_members om
    where om.organization_id = p_organization_id
      and om.role in ('admin', 'supervisor', 'project_coordinator')
    union
    select cu.user_id, 'customer'::text, 'Tilaaja'::text
    from public.customer_users cu
    where cu.organization_id = p_organization_id
      and cu.customer_id = request_row.customer_id
      and (
        cu.access_scope = 'all_projects'
        or cu.user_id = request_row.created_by
        or (
          request_row.converted_project_id is not null
          and exists (
            select 1 from public.customer_user_projects cup
            where cup.organization_id = cu.organization_id
              and cup.customer_id = cu.customer_id
              and cup.user_id = cu.user_id
              and cup.project_id = request_row.converted_project_id
          )
        )
      )
    union
    select pm.user_id, 'worker'::text, 'Projektiryhmä'::text
    from public.project_members pm
    where request_row.converted_project_id is not null
      and pm.organization_id = p_organization_id
      and pm.project_id = request_row.converted_project_id
    union
    select wa.user_id, 'worker'::text, 'Työn tekijä'::text
    from public.work_orders wo
    join public.work_order_assignees wa
      on wa.organization_id = wo.organization_id
     and wa.work_order_id = wo.id
    where request_row.converted_project_id is not null
      and wo.organization_id = p_organization_id
      and wo.project_id = request_row.converted_project_id
  )
  select distinct
    pi.user_id,
    coalesce(nullif(pr.full_name, ''), nullif(pr.email, ''), 'Käyttäjä'),
    pi.role,
    pi.participation
  from participant_ids pi
  left join public.profiles pr on pr.id = pi.user_id
  order by pi.participation, coalesce(pr.full_name, pr.email, 'Käyttäjä');
end;
$$;

create or replace function public.post_customer_order_message(
  p_organization_id uuid,
  p_request_id uuid,
  p_body text
)
returns uuid
language plpgsql
security definer
set search_path = pg_catalog, public, private
as $$
declare
  result_id uuid;
begin
  if auth.uid() is null or not private.can_access_customer_order(p_organization_id, p_request_id, auth.uid()) then
    raise exception 'Keskustelun käyttöoikeus puuttuu.' using errcode = '42501';
  end if;
  if char_length(btrim(coalesce(p_body, ''))) not between 1 and 5000 then
    raise exception 'Viestin pituuden pitää olla 1–5000 merkkiä.' using errcode = '23514';
  end if;

  insert into public.customer_order_messages(organization_id, request_id, author_id, body)
  values (p_organization_id, p_request_id, auth.uid(), btrim(p_body))
  returning id into result_id;

  insert into public.audit_logs(organization_id, user_id, action, table_name, record_id)
  values (p_organization_id, auth.uid(), 'customer_order_message_created', 'customer_order_messages', result_id);

  return result_id;
end;
$$;

create or replace function public.publish_customer_order_event(
  p_organization_id uuid,
  p_request_id uuid,
  p_title text,
  p_description text default null,
  p_progress integer default null
)
returns uuid
language plpgsql
security definer
set search_path = pg_catalog, public, private
as $$
declare
  result_id uuid;
begin
  if auth.uid() is null or not private.is_management_user(p_organization_id, auth.uid()) then
    raise exception 'Vain työnjohto voi julkaista tilannepäivityksen.' using errcode = '42501';
  end if;
  if not exists (select 1 from public.project_requests where organization_id = p_organization_id and id = p_request_id) then
    raise exception 'Tilausta ei löytynyt.' using errcode = 'P0002';
  end if;
  if char_length(btrim(coalesce(p_title, ''))) not between 1 and 180 then
    raise exception 'Anna päivitykselle 1–180 merkin otsikko.' using errcode = '23514';
  end if;
  if p_progress is not null and (p_progress < 0 or p_progress > 100) then
    raise exception 'Etenemisen pitää olla 0–100.' using errcode = '23514';
  end if;

  insert into public.customer_order_events(
    organization_id, request_id, event_type, title, description, progress, visible_to_customer, created_by
  ) values (
    p_organization_id, p_request_id, 'management_update', btrim(p_title), nullif(btrim(coalesce(p_description, '')), ''), p_progress, true, auth.uid()
  ) returning id into result_id;

  insert into public.audit_logs(organization_id, user_id, action, table_name, record_id)
  values (p_organization_id, auth.uid(), 'customer_order_event_published', 'customer_order_events', result_id);

  return result_id;
end;
$$;

create or replace function private.log_customer_order_status_event()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
begin
  if tg_op = 'INSERT' then
    insert into public.customer_order_events(organization_id, request_id, event_type, title, description, progress, created_by)
    values (new.organization_id, new.id, 'created', 'Tilaus luotiin', 'Tilaus on tallennettu portaaliin.', case when new.status = 'Luonnos' then 5 else 15 end, new.created_by);
  elsif new.status is distinct from old.status then
    insert into public.customer_order_events(organization_id, request_id, event_type, title, description, progress, created_by)
    values (
      new.organization_id,
      new.id,
      'status_changed',
      'Tilauksen tila: ' || new.status,
      nullif(new.management_note, ''),
      case new.status
        when 'Luonnos' then 5
        when 'Lähetetty' then 15
        when 'Lisätietoja pyydetty' then 25
        when 'Käsittelyssä' then 35
        when 'Hyväksytty' then 45
        when 'Muutettu projektiksi' then 50
        when 'Hylätty' then 100
        else null
      end,
      auth.uid()
    );
  end if;
  return new;
end;
$$;

drop trigger if exists project_requests_customer_order_event_trg on public.project_requests;
create trigger project_requests_customer_order_event_trg
after insert or update of status on public.project_requests
for each row execute function private.log_customer_order_status_event();

revoke all on function public.customer_order_context(uuid, uuid) from public, anon;
revoke all on function public.customer_order_messages(uuid, uuid) from public, anon;
revoke all on function public.customer_order_events(uuid, uuid) from public, anon;
revoke all on function public.customer_order_participants(uuid, uuid) from public, anon;
revoke all on function public.post_customer_order_message(uuid, uuid, text) from public, anon;
revoke all on function public.publish_customer_order_event(uuid, uuid, text, text, integer) from public, anon;

grant execute on function public.customer_order_context(uuid, uuid) to authenticated;
grant execute on function public.customer_order_messages(uuid, uuid) to authenticated;
grant execute on function public.customer_order_events(uuid, uuid) to authenticated;
grant execute on function public.customer_order_participants(uuid, uuid) to authenticated;
grant execute on function public.post_customer_order_message(uuid, uuid, text) to authenticated;
grant execute on function public.publish_customer_order_event(uuid, uuid, text, text, integer) to authenticated;

grant execute on function public.customer_order_context(uuid, uuid) to service_role;
grant execute on function public.customer_order_messages(uuid, uuid) to service_role;
grant execute on function public.customer_order_events(uuid, uuid) to service_role;
grant execute on function public.customer_order_participants(uuid, uuid) to service_role;
grant execute on function public.post_customer_order_message(uuid, uuid, text) to service_role;
grant execute on function public.publish_customer_order_event(uuid, uuid, text, text, integer) to service_role;

commit;
