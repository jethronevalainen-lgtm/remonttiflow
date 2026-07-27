-- Workinfo-parity operational suite for VaKantti.
-- Adds live management overview, unified field entries, billing lifecycle,
-- subcontractor register, fleet positions and construction reporting support.

create or replace function public.workinfo_is_member(p_organization_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1
    from public.organization_members om
    where om.organization_id = p_organization_id
      and om.user_id = auth.uid()
  );
$$;

create or replace function public.workinfo_is_management_member(p_organization_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1
    from public.organization_members om
    where om.organization_id = p_organization_id
      and om.user_id = auth.uid()
      and om.role in ('admin', 'supervisor')
  );
$$;

revoke all on function public.workinfo_is_member(uuid) from public, anon;
revoke all on function public.workinfo_is_management_member(uuid) from public, anon;
grant execute on function public.workinfo_is_member(uuid) to authenticated;
grant execute on function public.workinfo_is_management_member(uuid) to authenticated;

alter table public.projects
  add column if not exists default_billing_rate_cents bigint,
  add column if not exists construction_reporting_enabled boolean not null default false,
  add column if not exists shared_construction_site boolean not null default false;

alter table public.employees
  add column if not exists tax_number text,
  add column if not exists employment_category text not null default 'employee';

alter table public.work_site_check_ins
  add column if not exists work_order_id uuid references public.work_orders(id) on delete set null;

create index if not exists work_site_check_ins_work_order_id_idx
  on public.work_site_check_ins(work_order_id);

alter table public.time_entries
  add column if not exists billable boolean not null default true,
  add column if not exists billing_rate_cents bigint,
  add column if not exists billing_status text not null default 'recorded',
  add column if not exists invoice_reference text,
  add column if not exists billed_at timestamptz;

alter table public.time_entries
  drop constraint if exists time_entries_billing_status_check;
alter table public.time_entries
  add constraint time_entries_billing_status_check check (
    billing_status in ('recorded', 'approved', 'billable', 'queued', 'invoiced', 'credited', 'rejected')
  );

create table if not exists public.operational_entries (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete restrict,
  project_id uuid references public.projects(id) on delete set null,
  work_order_id uuid references public.work_orders(id) on delete set null,
  equipment_id uuid references public.equipment(id) on delete set null,
  entry_type text not null check (entry_type in ('material', 'equipment', 'daily_note')),
  title text not null,
  description text,
  quantity numeric,
  unit text,
  unit_cost_cents bigint,
  occurred_at timestamptz not null default now(),
  status text not null default 'submitted' check (status in ('draft', 'submitted', 'approved', 'rejected')),
  reviewed_by uuid references auth.users(id) on delete set null,
  reviewed_at timestamptz,
  rejection_reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (quantity is null or quantity >= 0),
  check (unit_cost_cents is null or unit_cost_cents >= 0)
);

create index if not exists operational_entries_org_date_idx
  on public.operational_entries(organization_id, occurred_at desc);
create index if not exists operational_entries_project_idx
  on public.operational_entries(project_id);
create index if not exists operational_entries_user_idx
  on public.operational_entries(user_id, occurred_at desc);

create table if not exists public.subcontractors (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  company_name text not null,
  business_id text,
  contact_name text,
  contact_email text,
  contact_phone text,
  status text not null default 'active' check (status in ('active', 'suspended', 'expired', 'archived')),
  liability_documents_valid_until date,
  insurance_valid_until date,
  notes text,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  archived_at timestamptz
);

create unique index if not exists subcontractors_org_business_id_uidx
  on public.subcontractors(organization_id, business_id)
  where business_id is not null and archived_at is null;
create index if not exists subcontractors_org_status_idx
  on public.subcontractors(organization_id, status);

create table if not exists public.subcontractor_workers (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  subcontractor_id uuid not null references public.subcontractors(id) on delete cascade,
  user_id uuid references auth.users(id) on delete set null,
  name text not null,
  email text,
  phone text,
  tax_number text,
  employment_category text not null default 'subcontractor_employee',
  valid_from date,
  valid_until date,
  status text not null default 'active' check (status in ('active', 'suspended', 'expired', 'archived')),
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists subcontractor_workers_org_idx
  on public.subcontractor_workers(organization_id, subcontractor_id, status);

create table if not exists public.subcontractor_project_assignments (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  subcontractor_id uuid not null references public.subcontractors(id) on delete cascade,
  project_id uuid not null references public.projects(id) on delete cascade,
  contract_number text,
  contract_value_cents bigint,
  billing_basis text not null default 'contract' check (billing_basis in ('contract', 'hourly', 'unit', 'labour_hire')),
  is_construction_service boolean not null default true,
  starts_at date,
  ends_at date,
  status text not null default 'active' check (status in ('planned', 'active', 'completed', 'cancelled')),
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (subcontractor_id, project_id, contract_number)
);

create index if not exists subcontractor_assignments_org_project_idx
  on public.subcontractor_project_assignments(organization_id, project_id, status);

create table if not exists public.billing_items (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  customer_id uuid references public.customers(id) on delete set null,
  project_id uuid not null references public.projects(id) on delete cascade,
  work_order_id uuid references public.work_orders(id) on delete set null,
  source_type text not null check (source_type in ('time_entry', 'material', 'equipment', 'change_order', 'manual')),
  source_id uuid,
  description text not null,
  quantity numeric not null default 1 check (quantity >= 0),
  unit text not null default 'kpl',
  unit_price_cents bigint,
  vat_rate numeric not null default 25.5 check (vat_rate >= 0),
  total_ex_vat_cents bigint,
  status text not null default 'approved' check (status in ('recorded', 'approved', 'billable', 'queued', 'invoiced', 'credited', 'rejected')),
  invoice_reference text,
  approved_by uuid references auth.users(id) on delete set null,
  approved_at timestamptz,
  queued_at timestamptz,
  invoiced_at timestamptz,
  credited_at timestamptz,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (unit_price_cents is null or unit_price_cents >= 0),
  check (total_ex_vat_cents is null or total_ex_vat_cents >= 0)
);

create unique index if not exists billing_items_source_uidx
  on public.billing_items(organization_id, source_type, source_id)
  where source_id is not null;
create index if not exists billing_items_org_status_idx
  on public.billing_items(organization_id, status, created_at desc);
create index if not exists billing_items_project_idx
  on public.billing_items(project_id, status);

create table if not exists public.vehicle_positions (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  equipment_id uuid not null references public.equipment(id) on delete cascade,
  project_id uuid references public.projects(id) on delete set null,
  driver_user_id uuid references auth.users(id) on delete set null,
  latitude double precision not null check (latitude between -90 and 90),
  longitude double precision not null check (longitude between -180 and 180),
  accuracy_m double precision check (accuracy_m is null or accuracy_m >= 0),
  speed_kmh numeric check (speed_kmh is null or speed_kmh >= 0),
  heading_degrees numeric check (heading_degrees is null or heading_degrees between 0 and 360),
  source text not null default 'manual' check (source in ('manual', 'device', 'mapon', 'integration')),
  source_reference text,
  recorded_at timestamptz not null default now(),
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists vehicle_positions_latest_idx
  on public.vehicle_positions(organization_id, equipment_id, recorded_at desc);

create table if not exists public.construction_reporting_exports (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  report_type text not null check (report_type in ('worker_data', 'contract_data')),
  target_month date not null,
  project_id uuid references public.projects(id) on delete set null,
  row_count integer not null default 0,
  status text not null default 'generated' check (status in ('generated', 'reviewed', 'submitted', 'replaced', 'deleted')),
  generated_by uuid references auth.users(id) on delete set null,
  generated_at timestamptz not null default now(),
  reviewed_at timestamptz,
  submitted_at timestamptz,
  submission_reference text,
  notes text
);

create index if not exists construction_reporting_exports_org_month_idx
  on public.construction_reporting_exports(organization_id, target_month desc, report_type);

alter table public.operational_entries enable row level security;
alter table public.subcontractors enable row level security;
alter table public.subcontractor_workers enable row level security;
alter table public.subcontractor_project_assignments enable row level security;
alter table public.billing_items enable row level security;
alter table public.vehicle_positions enable row level security;
alter table public.construction_reporting_exports enable row level security;

create policy operational_entries_select
  on public.operational_entries for select to authenticated
  using (public.workinfo_is_management_member(organization_id) or user_id = auth.uid());
create policy operational_entries_insert
  on public.operational_entries for insert to authenticated
  with check (
    public.workinfo_is_member(organization_id)
    and (user_id = auth.uid() or public.workinfo_is_management_member(organization_id))
  );
create policy operational_entries_update
  on public.operational_entries for update to authenticated
  using (public.workinfo_is_management_member(organization_id) or (user_id = auth.uid() and status in ('draft', 'submitted')))
  with check (public.workinfo_is_management_member(organization_id) or user_id = auth.uid());
create policy operational_entries_delete
  on public.operational_entries for delete to authenticated
  using (public.workinfo_is_management_member(organization_id) or (user_id = auth.uid() and status = 'draft'));

create policy subcontractors_management
  on public.subcontractors for all to authenticated
  using (public.workinfo_is_management_member(organization_id))
  with check (public.workinfo_is_management_member(organization_id));
create policy subcontractor_workers_management
  on public.subcontractor_workers for all to authenticated
  using (public.workinfo_is_management_member(organization_id))
  with check (public.workinfo_is_management_member(organization_id));
create policy subcontractor_assignments_management
  on public.subcontractor_project_assignments for all to authenticated
  using (public.workinfo_is_management_member(organization_id))
  with check (public.workinfo_is_management_member(organization_id));
create policy billing_items_select_management
  on public.billing_items for select to authenticated
  using (public.workinfo_is_management_member(organization_id));
create policy billing_items_price_management
  on public.billing_items for update to authenticated
  using (public.workinfo_is_management_member(organization_id))
  with check (public.workinfo_is_management_member(organization_id));
create policy vehicle_positions_management
  on public.vehicle_positions for all to authenticated
  using (public.workinfo_is_management_member(organization_id))
  with check (public.workinfo_is_management_member(organization_id));
create policy construction_reporting_exports_management
  on public.construction_reporting_exports for all to authenticated
  using (public.workinfo_is_management_member(organization_id))
  with check (public.workinfo_is_management_member(organization_id));

grant select, insert, update, delete on public.operational_entries to authenticated;
grant select, insert, update, delete on public.subcontractors to authenticated;
grant select, insert, update, delete on public.subcontractor_workers to authenticated;
grant select, insert, update, delete on public.subcontractor_project_assignments to authenticated;
grant select, update on public.billing_items to authenticated;
grant select, insert, update, delete on public.vehicle_positions to authenticated;
grant select, insert, update, delete on public.construction_reporting_exports to authenticated;

create trigger operational_entries_set_updated_at
before update on public.operational_entries
for each row execute function public.set_updated_at();
create trigger subcontractors_set_updated_at
before update on public.subcontractors
for each row execute function public.set_updated_at();
create trigger subcontractor_workers_set_updated_at
before update on public.subcontractor_workers
for each row execute function public.set_updated_at();
create trigger subcontractor_assignments_set_updated_at
before update on public.subcontractor_project_assignments
for each row execute function public.set_updated_at();
create trigger billing_items_set_updated_at
before update on public.billing_items
for each row execute function public.set_updated_at();

create or replace function public.enforce_workinfo_billing_direct_update()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  if current_user in ('postgres', 'supabase_admin') then
    return new;
  end if;

  if old.status in ('queued', 'invoiced', 'credited') then
    raise exception 'Billing item is locked by its current status';
  end if;

  if new.organization_id is distinct from old.organization_id
    or new.customer_id is distinct from old.customer_id
    or new.project_id is distinct from old.project_id
    or new.work_order_id is distinct from old.work_order_id
    or new.source_type is distinct from old.source_type
    or new.source_id is distinct from old.source_id
    or new.description is distinct from old.description
    or new.quantity is distinct from old.quantity
    or new.unit is distinct from old.unit
    or new.vat_rate is distinct from old.vat_rate
    or new.invoice_reference is distinct from old.invoice_reference
    or new.queued_at is distinct from old.queued_at
    or new.invoiced_at is distinct from old.invoiced_at
    or new.credited_at is distinct from old.credited_at
  then
    raise exception 'Only billing price may be changed directly';
  end if;

  if new.unit_price_cents is null or new.unit_price_cents < 0 then
    raise exception 'Invalid billing price';
  end if;
  if new.total_ex_vat_cents is distinct from round(new.quantity * new.unit_price_cents)::bigint then
    raise exception 'Invalid billing total';
  end if;
  if new.status not in (old.status, 'billable')
    or (new.status = 'billable' and old.status not in ('recorded', 'approved', 'billable'))
  then
    raise exception 'Invalid direct billing transition';
  end if;

  return new;
end;
$$;

create trigger billing_items_enforce_direct_update
before update on public.billing_items
for each row execute function public.enforce_workinfo_billing_direct_update();

create or replace function public.audit_workinfo_billing_price()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if new.unit_price_cents is distinct from old.unit_price_cents then
    insert into public.audit_logs (organization_id, user_id, action, table_name, record_id, metadata)
    values (
      new.organization_id,
      auth.uid(),
      'billing_price_changed',
      'billing_item',
      new.id,
      jsonb_build_object('from', old.unit_price_cents, 'to', new.unit_price_cents, 'totalExVatCents', new.total_ex_vat_cents)
    );
  end if;
  return new;
end;
$$;

create trigger billing_items_audit_price
 after update on public.billing_items
 for each row execute function public.audit_workinfo_billing_price();
