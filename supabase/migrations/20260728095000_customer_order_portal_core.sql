begin;

alter table public.customer_users
  add column if not exists portal_profile text not null default 'contact',
  add column if not exists portal_permissions jsonb not null default '{}'::jsonb,
  add column if not exists disabled_at timestamptz,
  add column if not exists last_portal_activity_at timestamptz;

alter table public.customer_users drop constraint if exists customer_users_portal_profile_check;
alter table public.customer_users add constraint customer_users_portal_profile_check
  check (portal_profile in ('viewer', 'contact', 'approver', 'admin', 'finance'));
alter table public.customer_users drop constraint if exists customer_users_portal_permissions_check;
alter table public.customer_users add constraint customer_users_portal_permissions_check
  check (jsonb_typeof(portal_permissions) = 'object');

create table if not exists public.customer_order_counters (
  organization_id uuid primary key references public.organizations(id) on delete cascade,
  next_number integer not null default 1 check (next_number > 0),
  updated_at timestamptz not null default now()
);
revoke all on table public.customer_order_counters from public, anon, authenticated;
grant all on table public.customer_order_counters to service_role;

alter table public.customer_work_requests
  add column if not exists order_number text,
  add column if not exists service_address text,
  add column if not exists building text,
  add column if not exists stairwell text,
  add column if not exists unit text,
  add column if not exists desired_completion_date date,
  add column if not exists planned_start_date date,
  add column if not exists planned_end_date date,
  add column if not exists access_window text,
  add column if not exists customer_reference text,
  add column if not exists purchase_order_number text,
  add column if not exists budget_limit_cents bigint,
  add column if not exists progress integer not null default 0,
  add column if not exists assigned_supervisor_id uuid references public.profiles(id) on delete set null,
  add column if not exists completed_at timestamptz,
  add column if not exists last_activity_at timestamptz not null default now();

with numbered as (
  select id, organization_id,
         row_number() over (partition by organization_id order by created_at, id) as sequence_number,
         extract(year from created_at)::integer % 100 as short_year
  from public.customer_work_requests
  where order_number is null
)
update public.customer_work_requests request
set order_number = 'T-' || lpad(numbered.short_year::text, 2, '0') || '-' || lpad(numbered.sequence_number::text, 5, '0')
from numbered
where numbered.id = request.id;

insert into public.customer_order_counters(organization_id, next_number)
select organization_id, count(*)::integer + 1
from public.customer_work_requests
group by organization_id
on conflict (organization_id) do update
set next_number = greatest(public.customer_order_counters.next_number, excluded.next_number),
    updated_at = now();

alter table public.customer_work_requests alter column order_number set not null;
create unique index if not exists customer_work_requests_org_order_number_unique
  on public.customer_work_requests(organization_id, order_number);
create index if not exists customer_work_requests_org_progress_idx
  on public.customer_work_requests(organization_id, status, progress, last_activity_at desc);
create index if not exists customer_work_requests_supervisor_idx
  on public.customer_work_requests(organization_id, assigned_supervisor_id, status);

alter table public.customer_work_requests drop constraint if exists customer_work_requests_status_check;
alter table public.customer_work_requests add constraint customer_work_requests_status_check
  check (status in (
    'Uusi', 'Tarkennettava', 'Käsittelyssä', 'Hyväksytty', 'Suunnittelussa',
    'Työmääräys luotu', 'Aikataulutettu', 'Käynnissä', 'Odottaa', 'Valmis', 'Peruttu'
  ));
alter table public.customer_work_requests drop constraint if exists customer_work_requests_progress_check;
alter table public.customer_work_requests add constraint customer_work_requests_progress_check
  check (progress between 0 and 100);
alter table public.customer_work_requests drop constraint if exists customer_work_requests_budget_limit_check;
alter table public.customer_work_requests add constraint customer_work_requests_budget_limit_check
  check (budget_limit_cents is null or budget_limit_cents >= 0);

create table if not exists public.customer_work_request_items (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  request_id uuid not null references public.customer_work_requests(id) on delete cascade,
  title text not null check (char_length(trim(title)) between 2 and 180),
  description text,
  location_details text,
  quantity numeric(12,3),
  unit text,
  priority text not null default 'Normaali' check (priority in ('Korkea', 'Normaali', 'Matala')),
  sort_order integer not null default 0,
  completed_at timestamptz,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint customer_work_request_items_quantity_check check (quantity is null or quantity >= 0),
  constraint customer_work_request_items_unit_check check (unit is null or char_length(trim(unit)) between 1 and 24)
);
create index if not exists customer_work_request_items_request_idx
  on public.customer_work_request_items(request_id, sort_order, created_at);
drop trigger if exists set_customer_work_request_items_updated_at on public.customer_work_request_items;
create trigger set_customer_work_request_items_updated_at
  before update on public.customer_work_request_items
  for each row execute function public.set_updated_at();

create table if not exists public.customer_work_request_participants (
  organization_id uuid not null references public.organizations(id) on delete cascade,
  request_id uuid not null references public.customer_work_requests(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  participant_role text not null default 'observer'
    check (participant_role in ('customer_contact', 'approver', 'supervisor', 'worker', 'observer')),
  can_message boolean not null default true,
  can_manage boolean not null default false,
  can_decide boolean not null default false,
  added_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  primary key (request_id, user_id)
);
create index if not exists customer_work_request_participants_user_idx
  on public.customer_work_request_participants(organization_id, user_id, request_id);

create table if not exists public.customer_work_request_messages (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  request_id uuid not null references public.customer_work_requests(id) on delete cascade,
  author_user_id uuid not null references public.profiles(id) on delete restrict,
  body text not null check (char_length(trim(body)) between 1 and 5000),
  reply_to_id uuid references public.customer_work_request_messages(id) on delete set null,
  created_at timestamptz not null default now(),
  edited_at timestamptz,
  deleted_at timestamptz
);
create index if not exists customer_work_request_messages_request_idx
  on public.customer_work_request_messages(request_id, created_at);

create table if not exists public.customer_work_request_message_attachments (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  request_id uuid not null references public.customer_work_requests(id) on delete cascade,
  message_id uuid not null references public.customer_work_request_messages(id) on delete cascade,
  storage_path text not null unique,
  file_name text not null,
  mime_type text not null,
  size_bytes bigint not null check (size_bytes between 1 and 10485760),
  created_by uuid not null references public.profiles(id) on delete restrict,
  created_at timestamptz not null default now()
);
create index if not exists customer_work_request_message_attachments_message_idx
  on public.customer_work_request_message_attachments(message_id, created_at);

create table if not exists public.customer_work_request_events (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  request_id uuid not null references public.customer_work_requests(id) on delete cascade,
  event_type text not null,
  title text not null,
  description text,
  visibility text not null default 'customer' check (visibility in ('customer', 'internal')),
  actor_user_id uuid references public.profiles(id) on delete set null,
  metadata jsonb not null default '{}'::jsonb check (jsonb_typeof(metadata) = 'object'),
  created_at timestamptz not null default now()
);
create index if not exists customer_work_request_events_request_idx
  on public.customer_work_request_events(request_id, created_at desc);
create index if not exists customer_work_request_events_org_idx
  on public.customer_work_request_events(organization_id, visibility, created_at desc);

create table if not exists public.customer_work_request_read_state (
  organization_id uuid not null references public.organizations(id) on delete cascade,
  request_id uuid not null references public.customer_work_requests(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  last_read_at timestamptz not null default now(),
  primary key (request_id, user_id)
);

create table if not exists public.customer_portal_publications (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  customer_id uuid references public.customers(id) on delete cascade,
  project_id uuid not null references public.projects(id) on delete cascade,
  publication_type text not null,
  title text not null,
  summary text,
  body text,
  source_table text,
  source_id uuid,
  version integer not null default 1 check (version > 0),
  status text not null default 'draft' check (status in ('draft', 'published', 'superseded', 'withdrawn')),
  requires_acknowledgement boolean not null default false,
  published_by uuid references public.profiles(id) on delete set null,
  published_at timestamptz,
  superseded_at timestamptz,
  withdrawn_at timestamptz,
  metadata jsonb not null default '{}'::jsonb check (jsonb_typeof(metadata) = 'object'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists customer_portal_publications_project_idx
  on public.customer_portal_publications(project_id, status, published_at desc);
create unique index if not exists customer_portal_publications_source_version_unique
  on public.customer_portal_publications(organization_id, source_table, source_id, version)
  where source_table is not null and source_id is not null;
create unique index if not exists customer_portal_publications_active_source_unique
  on public.customer_portal_publications(organization_id, source_table, source_id)
  where status = 'published' and source_table is not null and source_id is not null;
drop trigger if exists set_customer_portal_publications_updated_at on public.customer_portal_publications;
create trigger set_customer_portal_publications_updated_at
  before update on public.customer_portal_publications
  for each row execute function public.set_updated_at();

create table if not exists public.customer_portal_acknowledgements (
  organization_id uuid not null references public.organizations(id) on delete cascade,
  publication_id uuid not null references public.customer_portal_publications(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  note text,
  acknowledgement_note text,
  acknowledged_at timestamptz not null default now(),
  primary key (publication_id, user_id)
);

create table if not exists public.customer_portal_decision_snapshots (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  customer_id uuid references public.customers(id) on delete set null,
  project_id uuid references public.projects(id) on delete cascade,
  subject_type text not null,
  subject_id uuid not null,
  subject_version integer not null default 1,
  decision text not null,
  note text,
  decision_note text,
  decided_by uuid not null references public.profiles(id) on delete restrict,
  decided_at timestamptz not null default now(),
  snapshot jsonb,
  payload jsonb,
  content_hash text,
  payload_hash text,
  created_at timestamptz not null default now()
);
create index if not exists customer_portal_decision_project_idx
  on public.customer_portal_decision_snapshots(organization_id, project_id, decided_at desc);

alter table public.inspections
  add column if not exists customer_visible boolean not null default false,
  add column if not exists customer_published_at timestamptz,
  add column if not exists customer_published_by uuid references public.profiles(id) on delete set null;
create index if not exists inspections_customer_visible_idx
  on public.inspections(organization_id, project_id, customer_visible, approved_at desc)
  where deleted_at is null;

alter table public.change_orders
  add column if not exists customer_version integer not null default 1,
  add column if not exists vat_rate numeric(5,2) not null default 25.5,
  add column if not exists vat_percent numeric(5,2) not null default 25.5,
  add column if not exists schedule_effect_days integer not null default 0,
  add column if not exists customer_content_hash text,
  add column if not exists customer_payload_hash text;
alter table public.change_orders drop constraint if exists change_orders_customer_version_check;
alter table public.change_orders add constraint change_orders_customer_version_check check (customer_version > 0);
alter table public.change_orders drop constraint if exists change_orders_vat_rate_check;
alter table public.change_orders add constraint change_orders_vat_rate_check check (vat_rate between 0 and 100);

create or replace function private.next_customer_order_number(p_organization_id uuid)
returns text
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  value integer;
begin
  insert into public.customer_order_counters(organization_id, next_number)
  values (p_organization_id, 2)
  on conflict (organization_id) do update
    set next_number = public.customer_order_counters.next_number + 1,
        updated_at = now()
  returning next_number - 1 into value;
  return 'T-' || to_char(current_date, 'YY') || '-' || lpad(value::text, 5, '0');
end;
$$;

create or replace function private.customer_portal_base_permissions(p_profile text)
returns jsonb
language sql
immutable
set search_path = pg_catalog
as $$
  select case p_profile
    when 'viewer' then jsonb_build_object('portal.read',true,'orders.create',false,'orders.edit',false,'messages.write',false,'decisions.make',false,'finance.read',false,'users.manage',false)
    when 'approver' then jsonb_build_object('portal.read',true,'orders.create',true,'orders.edit',true,'messages.write',true,'decisions.make',true,'finance.read',true,'users.manage',false)
    when 'admin' then jsonb_build_object('portal.read',true,'orders.create',true,'orders.edit',true,'messages.write',true,'decisions.make',true,'finance.read',true,'users.manage',true)
    when 'finance' then jsonb_build_object('portal.read',true,'orders.create',false,'orders.edit',false,'messages.write',true,'decisions.make',true,'finance.read',true,'users.manage',false)
    else jsonb_build_object('portal.read',true,'orders.create',true,'orders.edit',true,'messages.write',true,'decisions.make',false,'finance.read',false,'users.manage',false)
  end;
$$;

create or replace function private.customer_portal_has_permission(
  p_organization_id uuid,
  p_customer_id uuid,
  p_user_id uuid,
  p_permission text
)
returns boolean
language sql
stable
security definer
set search_path = pg_catalog, public
as $$
  select coalesce(
    case
      when jsonb_typeof(cu.portal_permissions -> p_permission) = 'boolean'
        then (cu.portal_permissions ->> p_permission)::boolean
      else (private.customer_portal_base_permissions(cu.portal_profile) ->> p_permission)::boolean
    end,
    false
  )
  from public.customer_users cu
  join public.organization_members om
    on om.organization_id = cu.organization_id
   and om.user_id = cu.user_id
   and om.role = 'customer'
  where cu.organization_id = p_organization_id
    and cu.customer_id = p_customer_id
    and cu.user_id = p_user_id
    and cu.disabled_at is null
  limit 1;
$$;

create or replace function private.customer_can_access_order(p_request_id uuid, p_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = pg_catalog, public
as $$
  select exists (
    select 1 from public.customer_work_requests request
    where request.id = p_request_id
      and (
        private.is_operational_manager(request.organization_id, p_user_id)
        or private.customer_user_can_access_project(request.project_id, request.organization_id, p_user_id)
      )
  );
$$;

create or replace function private.customer_can_message_order(p_request_id uuid, p_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = pg_catalog, public
as $$
  select exists (
    select 1 from public.customer_work_requests request
    where request.id = p_request_id
      and (
        private.is_operational_manager(request.organization_id, p_user_id)
        or (
          private.customer_user_can_access_project(request.project_id, request.organization_id, p_user_id)
          and private.customer_portal_has_permission(request.organization_id, request.customer_id, p_user_id, 'messages.write')
        )
        or exists (
          select 1 from public.customer_work_request_participants participant
          where participant.request_id = request.id
            and participant.user_id = p_user_id
            and participant.can_message
        )
      )
  );
$$;

create or replace function private.customer_can_edit_order(p_request_id uuid, p_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = pg_catalog, public
as $$
  select exists (
    select 1 from public.customer_work_requests request
    where request.id = p_request_id
      and request.work_order_id is null
      and request.status in ('Uusi', 'Tarkennettava', 'Käsittelyssä')
      and (
        private.is_operational_manager(request.organization_id, p_user_id)
        or (
          private.customer_user_can_access_project(request.project_id, request.organization_id, p_user_id)
          and private.customer_portal_has_permission(request.organization_id, request.customer_id, p_user_id, 'orders.edit')
        )
      )
  );
$$;

create or replace function private.append_customer_order_event(
  p_request_id uuid,
  p_event_type text,
  p_title text,
  p_description text default null,
  p_visibility text default 'customer',
  p_actor_user_id uuid default null,
  p_metadata jsonb default '{}'::jsonb
)
returns uuid
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  request_row public.customer_work_requests%rowtype;
  event_id uuid;
begin
  select * into request_row from public.customer_work_requests where id = p_request_id;
  if request_row.id is null then return null; end if;
  insert into public.customer_work_request_events(
    organization_id, request_id, event_type, title, description, visibility,
    actor_user_id, metadata
  ) values (
    request_row.organization_id, request_row.id, p_event_type, trim(p_title),
    nullif(trim(coalesce(p_description, '')), ''), p_visibility,
    p_actor_user_id, coalesce(p_metadata, '{}'::jsonb)
  ) returning id into event_id;
  update public.customer_work_requests set last_activity_at = now() where id = request_row.id;
  return event_id;
end;
$$;

create or replace function private.upsert_portal_notification(
  p_organization_id uuid,
  p_recipient_user_id uuid,
  p_type text,
  p_severity text,
  p_title text,
  p_body text,
  p_path text,
  p_source_table text,
  p_source_id uuid,
  p_dedup_key text,
  p_metadata jsonb default '{}'::jsonb
)
returns void
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
begin
  insert into public.app_notifications(
    organization_id, recipient_user_id, notification_type, severity, title, body,
    path, source_table, source_id, dedup_key, metadata
  ) values (
    p_organization_id, p_recipient_user_id, p_type,
    case when p_severity in ('info','warning','danger') then p_severity else 'info' end,
    p_title, p_body, p_path, p_source_table, p_source_id, p_dedup_key,
    coalesce(p_metadata, '{}'::jsonb)
  )
  on conflict (organization_id, recipient_user_id, dedup_key) do update
  set title = excluded.title,
      body = excluded.body,
      path = excluded.path,
      severity = excluded.severity,
      metadata = excluded.metadata,
      read_at = null,
      resolved_at = null,
      updated_at = now();
end;
$$;

revoke all on function private.next_customer_order_number(uuid) from public, anon, authenticated;
revoke all on function private.customer_portal_base_permissions(text) from public, anon;
revoke all on function private.customer_portal_has_permission(uuid, uuid, uuid, text) from public, anon;
revoke all on function private.customer_can_access_order(uuid, uuid) from public, anon;
revoke all on function private.customer_can_message_order(uuid, uuid) from public, anon;
revoke all on function private.customer_can_edit_order(uuid, uuid) from public, anon;
revoke all on function private.append_customer_order_event(uuid, text, text, text, text, uuid, jsonb) from public, anon, authenticated;
revoke all on function private.upsert_portal_notification(uuid, uuid, text, text, text, text, text, text, uuid, text, jsonb) from public, anon, authenticated;
grant execute on function private.customer_portal_base_permissions(text) to authenticated;
grant execute on function private.customer_portal_has_permission(uuid, uuid, uuid, text) to authenticated;
grant execute on function private.customer_can_access_order(uuid, uuid) to authenticated;
grant execute on function private.customer_can_message_order(uuid, uuid) to authenticated;
grant execute on function private.customer_can_edit_order(uuid, uuid) to authenticated;

alter table public.customer_work_request_items enable row level security;
alter table public.customer_work_request_participants enable row level security;
alter table public.customer_work_request_messages enable row level security;
alter table public.customer_work_request_message_attachments enable row level security;
alter table public.customer_work_request_events enable row level security;
alter table public.customer_work_request_read_state enable row level security;
alter table public.customer_portal_publications enable row level security;
alter table public.customer_portal_acknowledgements enable row level security;
alter table public.customer_portal_decision_snapshots enable row level security;

revoke all on table public.customer_work_request_items from public, anon, authenticated;
revoke all on table public.customer_work_request_participants from public, anon, authenticated;
revoke all on table public.customer_work_request_messages from public, anon, authenticated;
revoke all on table public.customer_work_request_message_attachments from public, anon, authenticated;
revoke all on table public.customer_work_request_events from public, anon, authenticated;
revoke all on table public.customer_work_request_read_state from public, anon, authenticated;
revoke all on table public.customer_portal_publications from public, anon, authenticated;
revoke all on table public.customer_portal_acknowledgements from public, anon, authenticated;
revoke all on table public.customer_portal_decision_snapshots from public, anon, authenticated;

grant select on table public.customer_work_request_items to authenticated;
grant select on table public.customer_work_request_participants to authenticated;
grant select on table public.customer_work_request_messages to authenticated;
grant select on table public.customer_work_request_message_attachments to authenticated;
grant select on table public.customer_work_request_events to authenticated;
grant select on table public.customer_work_request_read_state to authenticated;
grant select on table public.customer_portal_publications to authenticated;
grant select on table public.customer_portal_acknowledgements to authenticated;
grant select on table public.customer_portal_decision_snapshots to authenticated;
grant all on table public.customer_work_request_items to service_role;
grant all on table public.customer_work_request_participants to service_role;
grant all on table public.customer_work_request_messages to service_role;
grant all on table public.customer_work_request_message_attachments to service_role;
grant all on table public.customer_work_request_events to service_role;
grant all on table public.customer_work_request_read_state to service_role;
grant all on table public.customer_portal_publications to service_role;
grant all on table public.customer_portal_acknowledgements to service_role;
grant all on table public.customer_portal_decision_snapshots to service_role;

drop policy if exists customer_work_requests_select on public.customer_work_requests;
create policy customer_work_requests_select on public.customer_work_requests
for select to authenticated
using (
  private.is_operational_manager(organization_id, (select auth.uid()))
  or private.customer_can_access_order(id, (select auth.uid()))
);

drop policy if exists customer_work_request_items_select on public.customer_work_request_items;
create policy customer_work_request_items_select on public.customer_work_request_items
for select to authenticated
using (private.customer_can_access_order(request_id, (select auth.uid())));

drop policy if exists customer_work_request_participants_select on public.customer_work_request_participants;
create policy customer_work_request_participants_select on public.customer_work_request_participants
for select to authenticated
using (private.customer_can_access_order(request_id, (select auth.uid())));

drop policy if exists customer_work_request_messages_select on public.customer_work_request_messages;
create policy customer_work_request_messages_select on public.customer_work_request_messages
for select to authenticated
using (private.customer_can_access_order(request_id, (select auth.uid())));

drop policy if exists customer_work_request_message_attachments_select on public.customer_work_request_message_attachments;
create policy customer_work_request_message_attachments_select on public.customer_work_request_message_attachments
for select to authenticated
using (private.customer_can_access_order(request_id, (select auth.uid())));

drop policy if exists customer_work_request_events_select on public.customer_work_request_events;
create policy customer_work_request_events_select on public.customer_work_request_events
for select to authenticated
using (
  private.is_operational_manager(organization_id, (select auth.uid()))
  or (visibility = 'customer' and private.customer_can_access_order(request_id, (select auth.uid())))
);

drop policy if exists customer_work_request_read_state_select on public.customer_work_request_read_state;
create policy customer_work_request_read_state_select on public.customer_work_request_read_state
for select to authenticated
using (user_id = (select auth.uid()));

drop policy if exists customer_portal_publications_select on public.customer_portal_publications;
create policy customer_portal_publications_select on public.customer_portal_publications
for select to authenticated
using (
  private.is_operational_manager(organization_id, (select auth.uid()))
  or (status = 'published' and private.customer_user_can_access_project(project_id, organization_id, (select auth.uid())))
);

drop policy if exists customer_portal_acknowledgements_select on public.customer_portal_acknowledgements;
create policy customer_portal_acknowledgements_select on public.customer_portal_acknowledgements
for select to authenticated
using (user_id = (select auth.uid()) or private.is_operational_manager(organization_id, (select auth.uid())));

drop policy if exists customer_portal_decision_snapshots_select on public.customer_portal_decision_snapshots;
create policy customer_portal_decision_snapshots_select on public.customer_portal_decision_snapshots
for select to authenticated
using (
  private.is_operational_manager(organization_id, (select auth.uid()))
  or (project_id is not null and private.customer_user_can_access_project(project_id, organization_id, (select auth.uid())))
);

commit;
