begin;

-- VaKantti CRM operating system: customer sites, complete sales pipeline,
-- next-action control and customer 360° data.

alter table public.crm_leads
  add column if not exists description text,
  add column if not exists estimated_cost numeric(14,2) not null default 0,
  add column if not exists next_action text,
  add column if not exists next_action_due_at timestamptz,
  add column if not exists expected_decision_date date,
  add column if not exists quoted_at timestamptz,
  add column if not exists won_at timestamptz,
  add column if not exists lost_at timestamptz,
  add column if not exists frozen_until date;

update public.crm_leads
set stage = case stage
  when 'Tarjous tehty' then 'Tarjous lähetetty'
  when 'Sopimus' then 'Voitettu'
  else stage
end;

alter table public.crm_leads drop constraint if exists crm_leads_stage_check;
alter table public.crm_leads add constraint crm_leads_stage_check check (
  stage in (
    'Uusi',
    'Kartoitus sovittu',
    'Kartoitettu',
    'Tarjous laskennassa',
    'Tarjous lähetetty',
    'Neuvottelu',
    'Voitettu',
    'Hävitty',
    'Jäissä'
  )
) not valid;
alter table public.crm_leads validate constraint crm_leads_stage_check;

alter table public.crm_leads drop constraint if exists crm_leads_estimated_cost_check;
alter table public.crm_leads add constraint crm_leads_estimated_cost_check
  check (estimated_cost >= 0 and estimated_cost <= value) not valid;
alter table public.crm_leads validate constraint crm_leads_estimated_cost_check;

create table if not exists public.customer_sites (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  customer_id uuid not null references public.customers(id) on delete cascade,
  name text not null,
  address text,
  postal_code text,
  city text,
  access_instructions text,
  contact_instructions text,
  notes text,
  status text not null default 'Aktiivinen' check (status in ('Aktiivinen', 'Epäaktiivinen')),
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, customer_id, name)
);

alter table public.crm_leads
  add column if not exists site_id uuid references public.customer_sites(id) on delete set null;

alter table public.projects
  add column if not exists customer_site_id uuid references public.customer_sites(id) on delete set null;

alter table public.crm_activities
  add column if not exists site_id uuid references public.customer_sites(id) on delete set null,
  add column if not exists project_id uuid references public.projects(id) on delete set null,
  add column if not exists outcome text,
  add column if not exists priority text not null default 'Normaali',
  add column if not exists completed_by uuid references auth.users(id) on delete set null,
  add column if not exists customer_visible boolean not null default false;

alter table public.crm_activities drop constraint if exists crm_activities_priority_check;
alter table public.crm_activities add constraint crm_activities_priority_check
  check (priority in ('Matala', 'Normaali', 'Korkea', 'Kriittinen')) not valid;
alter table public.crm_activities validate constraint crm_activities_priority_check;

alter table public.customer_contacts
  add column if not exists role text,
  add column if not exists preferred_channel text,
  add column if not exists receives_quotes boolean not null default false,
  add column if not exists receives_reports boolean not null default false,
  add column if not exists receives_invoices boolean not null default false,
  add column if not exists availability_notes text;

create index if not exists crm_leads_org_stage_idx
  on public.crm_leads(organization_id, stage, next_action_due_at);
create index if not exists crm_leads_customer_idx
  on public.crm_leads(organization_id, customer_id, expected_decision_date);
create index if not exists customer_sites_customer_idx
  on public.customer_sites(organization_id, customer_id, status);
create index if not exists crm_activities_action_queue_idx
  on public.crm_activities(organization_id, completed_at, due_at, priority);
create index if not exists crm_activities_customer_timeline_idx
  on public.crm_activities(organization_id, customer_id, created_at desc);

alter table public.customer_sites enable row level security;
revoke all on public.customer_sites from anon;
grant select, insert, update, delete on public.customer_sites to authenticated;

drop policy if exists customer_sites_select on public.customer_sites;
create policy customer_sites_select on public.customer_sites for select to authenticated
using (private.is_management_user(organization_id, (select auth.uid())));

drop policy if exists customer_sites_insert on public.customer_sites;
create policy customer_sites_insert on public.customer_sites for insert to authenticated
with check (private.is_management_user(organization_id, (select auth.uid())));

drop policy if exists customer_sites_update on public.customer_sites;
create policy customer_sites_update on public.customer_sites for update to authenticated
using (private.is_management_user(organization_id, (select auth.uid())))
with check (private.is_management_user(organization_id, (select auth.uid())));

drop policy if exists customer_sites_delete on public.customer_sites;
create policy customer_sites_delete on public.customer_sites for delete to authenticated
using (private.is_management_user(organization_id, (select auth.uid())));

-- Keep CRM timeline and opportunity freshness synchronized server-side.
create or replace function private.touch_crm_lead_from_activity()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
begin
  if new.lead_id is not null then
    update public.crm_leads
    set last_activity_at = coalesce(new.completed_at, new.updated_at, new.created_at, now())
    where id = new.lead_id
      and organization_id = new.organization_id;
  end if;
  return new;
end;
$$;

revoke all on function private.touch_crm_lead_from_activity() from public, anon, authenticated;

drop trigger if exists touch_crm_lead_from_activity on public.crm_activities;
create trigger touch_crm_lead_from_activity
after insert or update on public.crm_activities
for each row execute function private.touch_crm_lead_from_activity();

-- Automatically record win/loss timestamps while preserving historical values.
create or replace function private.normalize_crm_lead_lifecycle()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
begin
  if new.stage = 'Voitettu' and old.stage is distinct from 'Voitettu' then
    new.won_at := coalesce(new.won_at, now());
    new.lost_at := null;
  elsif new.stage = 'Hävitty' and old.stage is distinct from 'Hävitty' then
    new.lost_at := coalesce(new.lost_at, now());
    new.won_at := null;
  elsif new.stage not in ('Voitettu', 'Hävitty') then
    new.won_at := null;
    new.lost_at := null;
  end if;

  if new.stage = 'Tarjous lähetetty' and old.stage is distinct from 'Tarjous lähetetty' then
    new.quoted_at := coalesce(new.quoted_at, now());
  end if;

  return new;
end;
$$;

revoke all on function private.normalize_crm_lead_lifecycle() from public, anon, authenticated;

drop trigger if exists normalize_crm_lead_lifecycle on public.crm_leads;
create trigger normalize_crm_lead_lifecycle
before update on public.crm_leads
for each row execute function private.normalize_crm_lead_lifecycle();

-- Audit all commercially meaningful CRM master data.
drop trigger if exists audit_crm_leads_change on public.crm_leads;
create trigger audit_crm_leads_change
after insert or update or delete on public.crm_leads
for each row execute function private.audit_business_change();

drop trigger if exists audit_customer_sites_change on public.customer_sites;
create trigger audit_customer_sites_change
after insert or update or delete on public.customer_sites
for each row execute function private.audit_business_change();

commit;
