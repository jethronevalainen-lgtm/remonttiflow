begin;

-- Organization-level defaults and operational controls.
create table if not exists public.organization_settings (
  organization_id uuid primary key references public.organizations(id) on delete cascade,
  locale text not null default 'fi-FI',
  timezone text not null default 'Europe/Helsinki',
  default_vat_rate numeric(5,2) not null default 0 check (default_vat_rate between 0 and 100),
  default_overhead_percent numeric(5,2) not null default 0 check (default_overhead_percent between 0 and 100),
  default_risk_percent numeric(5,2) not null default 0 check (default_risk_percent between 0 and 100),
  default_margin_percent numeric(5,2) not null default 0 check (default_margin_percent between 0 and 100),
  time_entry_lock_day smallint check (time_entry_lock_day between 1 and 31),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Normalize project ownership, location verification and lifecycle.
alter table public.projects
  add column if not exists responsible_supervisor_id uuid references auth.users(id) on delete set null,
  add column if not exists project_manager_id uuid references auth.users(id) on delete set null,
  add column if not exists cost_center text,
  add column if not exists site_latitude double precision,
  add column if not exists site_longitude double precision,
  add column if not exists site_radius_m double precision,
  add column if not exists archived_at timestamptz;

alter table public.projects drop constraint if exists projects_site_latitude_check;
alter table public.projects add constraint projects_site_latitude_check
  check (site_latitude is null or site_latitude between -90 and 90) not valid;
alter table public.projects validate constraint projects_site_latitude_check;
alter table public.projects drop constraint if exists projects_site_longitude_check;
alter table public.projects add constraint projects_site_longitude_check
  check (site_longitude is null or site_longitude between -180 and 180) not valid;
alter table public.projects validate constraint projects_site_longitude_check;
alter table public.projects drop constraint if exists projects_site_radius_m_check;
alter table public.projects add constraint projects_site_radius_m_check
  check (site_radius_m is null or site_radius_m between 10 and 10000) not valid;
alter table public.projects validate constraint projects_site_radius_m_check;

-- Time and approval workflow normalization.
alter table public.time_entries
  add column if not exists user_id uuid references auth.users(id) on delete set null,
  add column if not exists work_order_id uuid references public.work_orders(id) on delete set null,
  add column if not exists break_minutes integer not null default 0,
  add column if not exists source text not null default 'manual',
  add column if not exists approved_by uuid references auth.users(id) on delete set null,
  add column if not exists approved_at timestamptz,
  add column if not exists rejection_reason text,
  add column if not exists locked_at timestamptz;

update public.time_entries
set user_id = created_by
where user_id is null and created_by is not null;

alter table public.time_entries drop constraint if exists time_entries_break_minutes_check;
alter table public.time_entries add constraint time_entries_break_minutes_check
  check (break_minutes between 0 and 1440) not valid;
alter table public.time_entries validate constraint time_entries_break_minutes_check;

alter table public.travel_expenses
  add column if not exists user_id uuid references auth.users(id) on delete set null,
  add column if not exists project_id uuid references public.projects(id) on delete set null,
  add column if not exists approved_by uuid references auth.users(id) on delete set null,
  add column if not exists approved_at timestamptz,
  add column if not exists rejection_reason text,
  add column if not exists attachment_path text;

update public.travel_expenses
set user_id = created_by
where user_id is null and created_by is not null;

alter table public.driving_log_entries
  add column if not exists user_id uuid references auth.users(id) on delete set null,
  add column if not exists equipment_id uuid references public.equipment(id) on delete set null,
  add column if not exists start_odometer_km numeric,
  add column if not exists end_odometer_km numeric;

update public.driving_log_entries
set user_id = created_by
where user_id is null and created_by is not null;

-- Full corrective-action safety workflow.
alter table public.safety_items
  add column if not exists assignee_user_id uuid references auth.users(id) on delete set null,
  add column if not exists location text,
  add column if not exists root_cause text,
  add column if not exists corrective_action text,
  add column if not exists preventive_action text,
  add column if not exists resolved_at timestamptz,
  add column if not exists verified_at timestamptz,
  add column if not exists verified_by uuid references auth.users(id) on delete set null,
  add column if not exists latitude double precision,
  add column if not exists longitude double precision;

alter table public.diary_entries
  add column if not exists approved_by uuid references auth.users(id) on delete set null,
  add column if not exists approved_at timestamptz,
  add column if not exists locked_by uuid references auth.users(id) on delete set null;

alter table public.waste_entries
  add column if not exists destination text,
  add column if not exists receipt_number text,
  add column if not exists hazardous boolean not null default false;

-- Organization, customer and CRM extensions.
alter table public.employees
  add column if not exists hourly_cost_cents bigint,
  add column if not exists employment_type text,
  add column if not exists emergency_contact_name text,
  add column if not exists emergency_contact_phone text,
  add column if not exists archived_at timestamptz;

alter table public.equipment
  add column if not exists asset_number text,
  add column if not exists model text,
  add column if not exists manufacture_year integer,
  add column if not exists acquisition_cost_cents bigint,
  add column if not exists hourly_cost_cents bigint,
  add column if not exists next_maintenance date,
  add column if not exists current_project_id uuid references public.projects(id) on delete set null,
  add column if not exists responsible_user_id uuid references auth.users(id) on delete set null,
  add column if not exists archived_at timestamptz;

alter table public.customers
  add column if not exists business_id text,
  add column if not exists notes text,
  add column if not exists archived_at timestamptz;

alter table public.crm_leads
  add column if not exists customer_id uuid references public.customers(id) on delete set null,
  add column if not exists assignee_user_id uuid references auth.users(id) on delete set null,
  add column if not exists probability smallint not null default 0,
  add column if not exists source text,
  add column if not exists lost_reason text,
  add column if not exists converted_project_id uuid references public.projects(id) on delete set null,
  add column if not exists last_activity_at timestamptz;

alter table public.crm_leads drop constraint if exists crm_leads_probability_check;
alter table public.crm_leads add constraint crm_leads_probability_check
  check (probability between 0 and 100) not valid;
alter table public.crm_leads validate constraint crm_leads_probability_check;

-- Form versioning and richer capture controls.
alter table public.form_templates
  add column if not exists version integer not null default 1,
  add column if not exists supersedes_id uuid references public.form_templates(id) on delete set null,
  add column if not exists attachments_enabled boolean not null default false,
  add column if not exists signature_enabled boolean not null default false;

-- Customer contacts and CRM activity timeline.
create table if not exists public.customer_contacts (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  customer_id uuid not null references public.customers(id) on delete cascade,
  name text not null,
  title text,
  email text,
  phone text,
  is_primary boolean not null default false,
  notes text,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.crm_activities (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  lead_id uuid references public.crm_leads(id) on delete cascade,
  customer_id uuid references public.customers(id) on delete cascade,
  activity_type text not null,
  subject text not null,
  description text,
  due_at timestamptz,
  completed_at timestamptz,
  assigned_user_id uuid references auth.users(id) on delete set null,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint crm_activities_parent_check check (lead_id is not null or customer_id is not null)
);

-- Competence, certification and absence management.
create table if not exists public.employee_certifications (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  employee_id uuid not null references public.employees(id) on delete cascade,
  certification_type text not null,
  certification_number text,
  issued_at date,
  expires_at date,
  issuer text,
  attachment_path text,
  notes text,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint employee_certifications_dates_check check (expires_at is null or issued_at is null or expires_at >= issued_at)
);

create table if not exists public.employee_absences (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  employee_id uuid not null references public.employees(id) on delete cascade,
  absence_type text not null,
  start_date date not null,
  end_date date not null,
  status text not null default 'Hyväksytty',
  notes text,
  approved_by uuid references auth.users(id) on delete set null,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint employee_absences_dates_check check (end_date >= start_date)
);

-- Equipment reservations, faults and maintenance history.
create table if not exists public.equipment_reservations (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  equipment_id uuid not null references public.equipment(id) on delete cascade,
  project_id uuid references public.projects(id) on delete set null,
  reserved_for_user_id uuid references auth.users(id) on delete set null,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  status text not null default 'Varattu',
  notes text,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint equipment_reservations_dates_check check (ends_at > starts_at)
);

create table if not exists public.equipment_maintenance (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  equipment_id uuid not null references public.equipment(id) on delete cascade,
  maintenance_type text not null,
  status text not null default 'Suunniteltu',
  scheduled_at date,
  completed_at date,
  cost_cents bigint not null default 0,
  provider text,
  description text,
  attachment_path text,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint equipment_maintenance_cost_check check (cost_cents >= 0)
);

-- Shared project document metadata. Files are stored in the private project-documents bucket.
create table if not exists public.project_documents (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  project_id uuid references public.projects(id) on delete cascade,
  related_table text,
  related_id uuid,
  document_type text not null default 'Muu',
  title text not null,
  description text,
  version integer not null default 1,
  storage_path text not null unique,
  file_name text not null,
  mime_type text not null,
  size_bytes bigint not null,
  checksum text,
  visible_to_roles text[] not null default array['admin','supervisor','worker']::text[],
  created_by uuid references auth.users(id) on delete set null,
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint project_documents_version_check check (version >= 1),
  constraint project_documents_size_check check (size_bytes >= 0)
);

-- Change orders and project commercial workflow.
create table if not exists public.change_orders (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  project_id uuid not null references public.projects(id) on delete cascade,
  change_number text,
  title text not null,
  description text,
  status text not null default 'Luonnos',
  amount_cents bigint not null default 0,
  cost_cents bigint not null default 0,
  requested_at date,
  approved_at date,
  approved_by_name text,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint change_orders_amount_check check (amount_cents >= 0 and cost_cents >= 0)
);

create table if not exists public.saved_reports (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  name text not null,
  report_type text not null,
  filters jsonb not null default '{}'::jsonb,
  schedule text,
  recipients text[] not null default '{}'::text[],
  active boolean not null default true,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Helpful indexes for tenant and project scoped queries.
create index if not exists projects_responsible_supervisor_idx on public.projects(organization_id, responsible_supervisor_id) where archived_at is null;
create index if not exists time_entries_user_project_date_idx on public.time_entries(organization_id, user_id, project_id, date desc);
create index if not exists time_entries_work_order_idx on public.time_entries(work_order_id) where work_order_id is not null;
create index if not exists travel_expenses_user_project_idx on public.travel_expenses(organization_id, user_id, project_id, date desc);
create index if not exists driving_log_user_project_idx on public.driving_log_entries(organization_id, user_id, project_id, date desc);
create index if not exists safety_items_project_status_idx on public.safety_items(organization_id, project_id, status, due_date);
create index if not exists customer_contacts_customer_idx on public.customer_contacts(organization_id, customer_id);
create unique index if not exists customer_contacts_one_primary_idx on public.customer_contacts(customer_id) where is_primary;
create index if not exists crm_activities_lead_due_idx on public.crm_activities(organization_id, lead_id, due_at);
create index if not exists crm_activities_customer_idx on public.crm_activities(organization_id, customer_id, created_at desc);
create index if not exists employee_certifications_expiry_idx on public.employee_certifications(organization_id, expires_at);
create index if not exists employee_absences_period_idx on public.employee_absences(organization_id, start_date, end_date);
create index if not exists equipment_reservations_period_idx on public.equipment_reservations(organization_id, equipment_id, starts_at, ends_at);
create index if not exists equipment_maintenance_schedule_idx on public.equipment_maintenance(organization_id, scheduled_at, status);
create index if not exists project_documents_project_idx on public.project_documents(organization_id, project_id, created_at desc) where archived_at is null;
create index if not exists project_documents_related_idx on public.project_documents(related_table, related_id) where related_id is not null;
create index if not exists change_orders_project_idx on public.change_orders(organization_id, project_id, status);
create index if not exists saved_reports_owner_idx on public.saved_reports(organization_id, created_by);

-- updated_at maintenance.
do $$
declare
  table_name text;
begin
  foreach table_name in array array[
    'organization_settings','customer_contacts','crm_activities','employee_certifications',
    'employee_absences','equipment_reservations','equipment_maintenance','project_documents',
    'change_orders','saved_reports'
  ] loop
    execute format('drop trigger if exists set_%I_updated_at on public.%I', table_name, table_name);
    execute format('create trigger set_%I_updated_at before update on public.%I for each row execute function public.set_updated_at()', table_name, table_name);
  end loop;
end $$;

-- Generic append-only audit trail for the new operational entities.
create or replace function private.audit_business_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  old_row jsonb := case when tg_op in ('UPDATE','DELETE') then to_jsonb(old) else null end;
  new_row jsonb := case when tg_op in ('INSERT','UPDATE') then to_jsonb(new) else null end;
  org_id uuid := coalesce(nullif(new_row ->> 'organization_id', '')::uuid, nullif(old_row ->> 'organization_id', '')::uuid);
  rec_id uuid := coalesce(nullif(new_row ->> 'id', '')::uuid, nullif(old_row ->> 'id', '')::uuid);
begin
  insert into public.audit_logs(organization_id, user_id, action, table_name, record_id, metadata)
  values (
    org_id,
    auth.uid(),
    lower(tg_op),
    tg_table_name,
    rec_id,
    jsonb_build_object('old', old_row, 'new', new_row)
  );
  return coalesce(new, old);
end;
$$;

revoke all on function private.audit_business_change() from public, anon, authenticated;

do $$
declare
  table_name text;
begin
  foreach table_name in array array[
    'customer_contacts','crm_activities','employee_certifications','employee_absences',
    'equipment_reservations','equipment_maintenance','project_documents','change_orders','saved_reports'
  ] loop
    execute format('drop trigger if exists audit_%I_change on public.%I', table_name, table_name);
    execute format('create trigger audit_%I_change after insert or update or delete on public.%I for each row execute function private.audit_business_change()', table_name, table_name);
  end loop;
end $$;

-- Project activity view: one ordered feed for the project workspace.
create or replace view public.project_activity_feed
with (security_invoker = true)
as
select organization_id, project_id, id, 'work_order'::text as event_type,
       title, coalesce(status, '') as detail, coalesce(updated_at, created_at, now()) as event_at,
       created_by as actor_id
from public.work_orders
union all
select organization_id, project_id, id, 'time_entry',
       coalesce(description, 'Tuntikirjaus'), employee || ' · ' || hours::text || ' h',
       coalesce(updated_at, created_at, now()), coalesce(user_id, created_by)
from public.time_entries
where project_id is not null
union all
select organization_id, project_id, id, 'safety',
       title, coalesce(status, ''), coalesce(updated_at, created_at, now()), created_by
from public.safety_items
where project_id is not null
union all
select organization_id, project_id, id, 'diary',
       coalesce(work_phases, 'Työmaapäiväkirja'), coalesce(status, ''),
       coalesce(updated_at, created_at, now()), created_by
from public.diary_entries
where project_id is not null
union all
select organization_id, project_id, id, 'document',
       title, document_type, coalesce(updated_at, created_at, now()), created_by
from public.project_documents
where project_id is not null and archived_at is null
union all
select organization_id, project_id, id, 'change_order',
       title, status, coalesce(updated_at, created_at, now()), created_by
from public.change_orders;

-- Server-side project KPIs so dashboards no longer need to scan full tables.
create or replace function public.get_project_workspace_summary(
  p_organization_id uuid,
  p_project_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  result jsonb;
begin
  if auth.uid() is null or not private.can_access_project(p_project_id, p_organization_id, auth.uid()) then
    raise exception 'not authorized' using errcode = '42501';
  end if;

  select jsonb_build_object(
    'open_work_orders', (select count(*) from public.work_orders where organization_id = p_organization_id and project_id = p_project_id and status in ('Avoin','Käynnissä','Odottaa')),
    'pending_hours', (select coalesce(sum(hours + coalesce(overtime, 0)), 0) from public.time_entries where organization_id = p_organization_id and project_id = p_project_id and status = 'Odottaa'),
    'approved_hours', (select coalesce(sum(hours + coalesce(overtime, 0)), 0) from public.time_entries where organization_id = p_organization_id and project_id = p_project_id and status = 'Hyväksytty'),
    'open_safety_items', (select count(*) from public.safety_items where organization_id = p_organization_id and project_id = p_project_id and status not in ('Korjattu','Suljettu','Vahvistettu')),
    'open_findings', (select count(*) from public.inspection_findings where organization_id = p_organization_id and project_id = p_project_id and status not in ('Hyväksytty','Mitätöity')),
    'documents', (select count(*) from public.project_documents where organization_id = p_organization_id and project_id = p_project_id and archived_at is null),
    'change_order_amount_cents', (select coalesce(sum(amount_cents), 0) from public.change_orders where organization_id = p_organization_id and project_id = p_project_id and status in ('Hyväksytty','Toteutuksessa','Valmis')),
    'change_order_cost_cents', (select coalesce(sum(cost_cents), 0) from public.change_orders where organization_id = p_organization_id and project_id = p_project_id and status in ('Hyväksytty','Toteutuksessa','Valmis'))
  ) into result;

  return result;
end;
$$;

revoke all on function public.get_project_workspace_summary(uuid, uuid) from public, anon;
grant execute on function public.get_project_workspace_summary(uuid, uuid) to authenticated;

-- RLS for new tables.
alter table public.organization_settings enable row level security;
alter table public.customer_contacts enable row level security;
alter table public.crm_activities enable row level security;
alter table public.employee_certifications enable row level security;
alter table public.employee_absences enable row level security;
alter table public.equipment_reservations enable row level security;
alter table public.equipment_maintenance enable row level security;
alter table public.project_documents enable row level security;
alter table public.change_orders enable row level security;
alter table public.saved_reports enable row level security;

-- Organization settings.
drop policy if exists organization_settings_select on public.organization_settings;
create policy organization_settings_select on public.organization_settings for select to authenticated
using (private.is_org_member(organization_id));
drop policy if exists organization_settings_insert on public.organization_settings;
create policy organization_settings_insert on public.organization_settings for insert to authenticated
with check (private.has_org_role(organization_id, array['admin']::text[]));
drop policy if exists organization_settings_update on public.organization_settings;
create policy organization_settings_update on public.organization_settings for update to authenticated
using (private.has_org_role(organization_id, array['admin']::text[]))
with check (private.has_org_role(organization_id, array['admin']::text[]));

-- Shared supervisor-managed tables.
do $$
declare
  table_name text;
begin
  foreach table_name in array array['customer_contacts','crm_activities','equipment_reservations','equipment_maintenance','change_orders'] loop
    execute format('drop policy if exists %I_select on public.%I', table_name, table_name);
    execute format('create policy %I_select on public.%I for select to authenticated using (private.is_org_member(organization_id))', table_name, table_name);
    execute format('drop policy if exists %I_insert on public.%I', table_name, table_name);
    execute format('create policy %I_insert on public.%I for insert to authenticated with check (private.has_org_role(organization_id, array[''admin'',''supervisor'']::text[]))', table_name, table_name);
    execute format('drop policy if exists %I_update on public.%I', table_name, table_name);
    execute format('create policy %I_update on public.%I for update to authenticated using (private.has_org_role(organization_id, array[''admin'',''supervisor'']::text[])) with check (private.has_org_role(organization_id, array[''admin'',''supervisor'']::text[]))', table_name, table_name);
    execute format('drop policy if exists %I_delete on public.%I', table_name, table_name);
    execute format('create policy %I_delete on public.%I for delete to authenticated using (private.has_org_role(organization_id, array[''admin'',''supervisor'']::text[]))', table_name, table_name);
  end loop;
end $$;

-- Personnel records: workers can see their own linked employee details.
drop policy if exists employee_certifications_select on public.employee_certifications;
create policy employee_certifications_select on public.employee_certifications for select to authenticated
using (
  private.has_org_role(organization_id, array['admin','supervisor']::text[])
  or exists (select 1 from public.employees e where e.id = employee_id and e.organization_id = organization_id and e.user_id = auth.uid())
);
drop policy if exists employee_absences_select on public.employee_absences;
create policy employee_absences_select on public.employee_absences for select to authenticated
using (
  private.has_org_role(organization_id, array['admin','supervisor']::text[])
  or exists (select 1 from public.employees e where e.id = employee_id and e.organization_id = organization_id and e.user_id = auth.uid())
);

do $$
declare
  table_name text;
begin
  foreach table_name in array array['employee_certifications','employee_absences'] loop
    execute format('drop policy if exists %I_insert on public.%I', table_name, table_name);
    execute format('create policy %I_insert on public.%I for insert to authenticated with check (private.has_org_role(organization_id, array[''admin'',''supervisor'']::text[]))', table_name, table_name);
    execute format('drop policy if exists %I_update on public.%I', table_name, table_name);
    execute format('create policy %I_update on public.%I for update to authenticated using (private.has_org_role(organization_id, array[''admin'',''supervisor'']::text[])) with check (private.has_org_role(organization_id, array[''admin'',''supervisor'']::text[]))', table_name, table_name);
    execute format('drop policy if exists %I_delete on public.%I', table_name, table_name);
    execute format('create policy %I_delete on public.%I for delete to authenticated using (private.has_org_role(organization_id, array[''admin'',''supervisor'']::text[]))', table_name, table_name);
  end loop;
end $$;

-- Documents respect project access and allow the creator to maintain their own upload.
drop policy if exists project_documents_select on public.project_documents;
create policy project_documents_select on public.project_documents for select to authenticated
using (
  private.is_org_member(organization_id)
  and (project_id is null or private.can_access_project(project_id, organization_id, auth.uid()))
  and (visible_to_roles && array[(select om.role from public.organization_members om where om.organization_id = project_documents.organization_id and om.user_id = auth.uid())]::text[])
);
drop policy if exists project_documents_insert on public.project_documents;
create policy project_documents_insert on public.project_documents for insert to authenticated
with check (
  created_by = auth.uid()
  and private.is_org_member(organization_id)
  and (project_id is null or private.can_access_project(project_id, organization_id, auth.uid()))
);
drop policy if exists project_documents_update on public.project_documents;
create policy project_documents_update on public.project_documents for update to authenticated
using (created_by = auth.uid() or private.has_org_role(organization_id, array['admin','supervisor']::text[]))
with check (created_by = auth.uid() or private.has_org_role(organization_id, array['admin','supervisor']::text[]));
drop policy if exists project_documents_delete on public.project_documents;
create policy project_documents_delete on public.project_documents for delete to authenticated
using (created_by = auth.uid() or private.has_org_role(organization_id, array['admin','supervisor']::text[]));

-- Saved reports are personal, while supervisors can inspect organizational definitions.
drop policy if exists saved_reports_select on public.saved_reports;
create policy saved_reports_select on public.saved_reports for select to authenticated
using (created_by = auth.uid() or private.has_org_role(organization_id, array['admin','supervisor']::text[]));
drop policy if exists saved_reports_insert on public.saved_reports;
create policy saved_reports_insert on public.saved_reports for insert to authenticated
with check (created_by = auth.uid() and private.is_org_member(organization_id));
drop policy if exists saved_reports_update on public.saved_reports;
create policy saved_reports_update on public.saved_reports for update to authenticated
using (created_by = auth.uid()) with check (created_by = auth.uid());
drop policy if exists saved_reports_delete on public.saved_reports;
create policy saved_reports_delete on public.saved_reports for delete to authenticated
using (created_by = auth.uid());

-- Private Storage bucket for shared project documents.
insert into storage.buckets(id, name, public, file_size_limit, allowed_mime_types)
values (
  'project-documents',
  'project-documents',
  false,
  26214400,
  array['image/jpeg','image/png','image/webp','image/heic','image/heif','application/pdf','text/plain','text/csv','application/vnd.openxmlformats-officedocument.spreadsheetml.sheet','application/vnd.openxmlformats-officedocument.wordprocessingml.document']
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

create or replace function private.try_uuid(value text)
returns uuid
language plpgsql
immutable
set search_path = ''
as $$
begin
  return value::uuid;
exception when others then
  return null;
end;
$$;
revoke all on function private.try_uuid(text) from public, anon;
grant execute on function private.try_uuid(text) to authenticated;

drop policy if exists project_documents_storage_select on storage.objects;
create policy project_documents_storage_select on storage.objects for select to authenticated
using (
  bucket_id = 'project-documents'
  and private.is_org_member(private.try_uuid((storage.foldername(name))[1]))
);
drop policy if exists project_documents_storage_insert on storage.objects;
create policy project_documents_storage_insert on storage.objects for insert to authenticated
with check (
  bucket_id = 'project-documents'
  and private.is_org_member(private.try_uuid((storage.foldername(name))[1]))
  and owner_id = auth.uid()::text
);
drop policy if exists project_documents_storage_update on storage.objects;
create policy project_documents_storage_update on storage.objects for update to authenticated
using (
  bucket_id = 'project-documents'
  and (owner_id = auth.uid()::text or private.has_org_role(private.try_uuid((storage.foldername(name))[1]), array['admin','supervisor']::text[]))
)
with check (
  bucket_id = 'project-documents'
  and (owner_id = auth.uid()::text or private.has_org_role(private.try_uuid((storage.foldername(name))[1]), array['admin','supervisor']::text[]))
);
drop policy if exists project_documents_storage_delete on storage.objects;
create policy project_documents_storage_delete on storage.objects for delete to authenticated
using (
  bucket_id = 'project-documents'
  and (owner_id = auth.uid()::text or private.has_org_role(private.try_uuid((storage.foldername(name))[1]), array['admin','supervisor']::text[]))
);

commit;
