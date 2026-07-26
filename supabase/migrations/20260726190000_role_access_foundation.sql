begin;

-- Central role helpers. Customer accounts remain organization members for tenant
-- selection, but they are never treated as internal company users.
create or replace function private.is_internal_org_member(
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
    from public.organization_members om
    where om.organization_id = p_organization_id
      and om.user_id = p_user_id
      and om.role in ('admin', 'supervisor', 'worker')
  );
$$;

create or replace function private.is_management_user(
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
    from public.organization_members om
    where om.organization_id = p_organization_id
      and om.user_id = p_user_id
      and om.role in ('admin', 'supervisor')
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
  select exists (
    select 1
    from public.projects p
    join public.customer_users cu
      on cu.organization_id = p.organization_id
     and cu.customer_id = p.customer_id
    join public.organization_members om
      on om.organization_id = cu.organization_id
     and om.user_id = cu.user_id
     and om.role = 'customer'
    where p.id = p_project_id
      and p.organization_id = p_organization_id
      and cu.user_id = p_user_id
  );
$$;

create or replace function private.can_collaborate_on_project(
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
  select private.is_management_user(p_organization_id, p_user_id)
  or exists (
    select 1
    from public.project_members pm
    join public.organization_members om
      on om.organization_id = pm.organization_id
     and om.user_id = pm.user_id
     and om.role in ('admin', 'supervisor', 'worker')
    where pm.project_id = p_project_id
      and pm.organization_id = p_organization_id
      and pm.user_id = p_user_id
  )
  or exists (
    select 1
    from public.work_orders wo
    join public.work_order_assignees wa
      on wa.work_order_id = wo.id
     and wa.organization_id = wo.organization_id
    join public.organization_members om
      on om.organization_id = wa.organization_id
     and om.user_id = wa.user_id
     and om.role in ('admin', 'supervisor', 'worker')
    where wo.project_id = p_project_id
      and wo.organization_id = p_organization_id
      and wa.user_id = p_user_id
  )
  or private.is_customer_project_user(p_project_id, p_organization_id, p_user_id);
$$;

create or replace function private.can_use_internal_project_channel(
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
  select private.is_management_user(p_organization_id, p_user_id)
  or exists (
    select 1
    from public.project_members pm
    join public.organization_members om
      on om.organization_id = pm.organization_id
     and om.user_id = pm.user_id
     and om.role = 'worker'
    where pm.project_id = p_project_id
      and pm.organization_id = p_organization_id
      and pm.user_id = p_user_id
  )
  or exists (
    select 1
    from public.work_orders wo
    join public.work_order_assignees wa
      on wa.work_order_id = wo.id
     and wa.organization_id = wo.organization_id
    join public.organization_members om
      on om.organization_id = wa.organization_id
     and om.user_id = wa.user_id
     and om.role = 'worker'
    where wo.project_id = p_project_id
      and wo.organization_id = p_organization_id
      and wa.user_id = p_user_id
  );
$$;

grant execute on function private.is_internal_org_member(uuid, uuid) to authenticated;
grant execute on function private.is_management_user(uuid, uuid) to authenticated;
grant execute on function private.is_customer_project_user(uuid, uuid, uuid) to authenticated;
grant execute on function private.can_collaborate_on_project(uuid, uuid, uuid) to authenticated;
grant execute on function private.can_use_internal_project_channel(uuid, uuid, uuid) to authenticated;

-- Tilaajan projektipyyntö: tilaaja ehdottaa projektia, työnjohto hyväksyy sen
-- varsinaiseksi tuotantoprojektiksi.
create table if not exists public.project_requests (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  customer_id uuid not null references public.customers(id) on delete restrict,
  created_by uuid not null references public.profiles(id) on delete restrict,
  project_name text not null check (char_length(trim(project_name)) between 3 and 180),
  location text,
  description text not null check (char_length(trim(description)) between 10 and 5000),
  desired_start_date date,
  desired_end_date date,
  contact_name text,
  contact_phone text,
  status text not null default 'Lähetetty'
    check (status in ('Lähetetty', 'Käsittelyssä', 'Lisätietoja pyydetty', 'Hyväksytty', 'Hylätty', 'Muutettu projektiksi')),
  management_note text,
  reviewed_by uuid references public.profiles(id) on delete set null,
  reviewed_at timestamptz,
  converted_project_id uuid unique references public.projects(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint project_requests_dates_check
    check (desired_end_date is null or desired_start_date is null or desired_end_date >= desired_start_date)
);

create index if not exists project_requests_org_status_idx
  on public.project_requests(organization_id, status, created_at desc);
create index if not exists project_requests_customer_idx
  on public.project_requests(organization_id, customer_id, created_at desc);

drop trigger if exists set_project_requests_updated_at on public.project_requests;
create trigger set_project_requests_updated_at
  before update on public.project_requests
  for each row execute function public.set_updated_at();

-- Project-specific conversations. Shared messages are visible to the customer;
-- internal messages are restricted to the company's project group.
create table if not exists public.project_messages (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  project_id uuid not null,
  author_user_id uuid not null references public.profiles(id) on delete restrict,
  channel text not null default 'shared' check (channel in ('shared', 'internal')),
  body text not null check (char_length(trim(body)) between 1 and 4000),
  reply_to_id uuid references public.project_messages(id) on delete set null,
  created_at timestamptz not null default now(),
  edited_at timestamptz,
  deleted_at timestamptz,
  constraint project_messages_project_org_fkey
    foreign key (project_id, organization_id)
    references public.projects(id, organization_id)
    on delete cascade
);

create index if not exists project_messages_project_channel_idx
  on public.project_messages(project_id, channel, created_at);
create index if not exists project_messages_org_created_idx
  on public.project_messages(organization_id, created_at desc);

create table if not exists public.project_message_reads (
  project_id uuid not null references public.projects(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  channel text not null check (channel in ('shared', 'internal')),
  last_read_at timestamptz not null default now(),
  primary key (project_id, user_id, channel)
);

alter table public.project_requests enable row level security;
alter table public.project_messages enable row level security;
alter table public.project_message_reads enable row level security;

revoke all on public.project_requests, public.project_messages, public.project_message_reads from anon;
grant select on public.project_requests, public.project_messages to authenticated;
grant select, insert, update on public.project_message_reads to authenticated;

drop policy if exists project_requests_select on public.project_requests;
create policy project_requests_select on public.project_requests for select to authenticated
using (
  private.is_management_user(organization_id, (select auth.uid()))
  or created_by = (select auth.uid())
);

drop policy if exists project_messages_select on public.project_messages;
create policy project_messages_select on public.project_messages for select to authenticated
using (
  deleted_at is null
  and private.can_collaborate_on_project(project_id, organization_id, (select auth.uid()))
  and (
    channel = 'shared'
    or private.can_use_internal_project_channel(project_id, organization_id, (select auth.uid()))
  )
);

drop policy if exists project_message_reads_select on public.project_message_reads;
create policy project_message_reads_select on public.project_message_reads for select to authenticated
using (user_id = (select auth.uid()));
drop policy if exists project_message_reads_insert on public.project_message_reads;
create policy project_message_reads_insert on public.project_message_reads for insert to authenticated
with check (user_id = (select auth.uid()));
drop policy if exists project_message_reads_update on public.project_message_reads;
create policy project_message_reads_update on public.project_message_reads for update to authenticated
using (user_id = (select auth.uid()))
with check (user_id = (select auth.uid()));

commit;
