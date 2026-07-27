begin;

alter table public.projects
  add column if not exists default_billing_rate_cents bigint,
  add column if not exists construction_reporting_enabled boolean not null default false,
  add column if not exists shared_construction_site boolean not null default false;

alter table public.projects
  drop constraint if exists projects_default_billing_rate_cents_check;
alter table public.projects
  add constraint projects_default_billing_rate_cents_check
  check (default_billing_rate_cents is null or default_billing_rate_cents >= 0);

alter table public.employees
  add column if not exists tax_number text,
  add column if not exists employment_category text not null default 'employee';

alter table public.employees
  drop constraint if exists employees_employment_category_check;
alter table public.employees
  add constraint employees_employment_category_check
  check (employment_category in ('employee', 'subcontractor_employee', 'self_employed', 'temporary_agency'));

alter table public.time_entries
  add column if not exists billable boolean not null default true,
  add column if not exists billing_rate_cents bigint,
  add column if not exists billing_status text not null default 'recorded',
  add column if not exists invoice_reference text,
  add column if not exists billed_at timestamptz;

alter table public.time_entries
  drop constraint if exists time_entries_billing_rate_cents_check;
alter table public.time_entries
  add constraint time_entries_billing_rate_cents_check
  check (billing_rate_cents is null or billing_rate_cents >= 0);
alter table public.time_entries
  drop constraint if exists time_entries_billing_status_check;
alter table public.time_entries
  add constraint time_entries_billing_status_check
  check (billing_status in ('recorded', 'approved', 'billable', 'queued', 'invoiced', 'credited', 'rejected'));

create table if not exists public.subcontractors (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  company_name text not null,
  business_id text,
  contact_name text,
  contact_email text,
  contact_phone text,
  status text not null default 'active',
  liability_documents_valid_until date,
  insurance_valid_until date,
  notes text,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  archived_at timestamptz,
  constraint subcontractors_company_name_check check (char_length(btrim(company_name)) between 2 and 200),
  constraint subcontractors_status_check check (status in ('active', 'suspended', 'expired', 'archived'))
);

create unique index if not exists subcontractors_org_business_id_unique
  on public.subcontractors(organization_id, lower(btrim(business_id)))
  where business_id is not null and archived_at is null;
create index if not exists subcontractors_org_name_idx
  on public.subcontractors(organization_id, company_name)
  where archived_at is null;

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
  status text not null default 'active',
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint subcontractor_workers_name_check check (char_length(btrim(name)) between 2 and 200),
  constraint subcontractor_workers_category_check check (employment_category in ('subcontractor_employee', 'self_employed', 'temporary_agency')),
  constraint subcontractor_workers_status_check check (status in ('active', 'inactive', 'expired')),
  constraint subcontractor_workers_validity_check check (valid_until is null or valid_from is null or valid_until >= valid_from)
);

create index if not exists subcontractor_workers_org_company_idx
  on public.subcontractor_workers(organization_id, subcontractor_id, name);
create index if not exists subcontractor_workers_tax_number_idx
  on public.subcontractor_workers(organization_id, tax_number)
  where tax_number is not null;

create table if not exists public.subcontractor_project_assignments (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  subcontractor_id uuid not null references public.subcontractors(id) on delete cascade,
  project_id uuid not null references public.projects(id) on delete cascade,
  contract_number text,
  contract_value_cents bigint,
  billing_basis text not null default 'contract',
  is_construction_service boolean not null default true,
  starts_at date,
  ends_at date,
  status text not null default 'active',
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint subcontractor_assignments_value_check check (contract_value_cents is null or contract_value_cents >= 0),
  constraint subcontractor_assignments_basis_check check (billing_basis in ('contract', 'hourly', 'unit', 'labour_hire')),
  constraint subcontractor_assignments_status_check check (status in ('planned', 'active', 'completed', 'cancelled')),
  constraint subcontractor_assignments_dates_check check (ends_at is null or starts_at is null or ends_at >= starts_at)
);

create index if not exists subcontractor_assignments_org_project_idx
  on public.subcontractor_project_assignments(organization_id, project_id, status);
create index if not exists subcontractor_assignments_company_idx
  on public.subcontractor_project_assignments(organization_id, subcontractor_id, status);

create table if not exists public.billing_items (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  customer_id uuid references public.customers(id) on delete set null,
  project_id uuid not null references public.projects(id) on delete cascade,
  work_order_id uuid references public.work_orders(id) on delete set null,
  source_type text not null,
  source_id uuid,
  description text not null,
  quantity numeric(12,3) not null default 1,
  unit text not null default 'kpl',
  unit_price_cents bigint,
  vat_rate numeric(5,2) not null default 25.5,
  total_ex_vat_cents bigint,
  status text not null default 'recorded',
  invoice_reference text,
  approved_by uuid references auth.users(id) on delete set null,
  approved_at timestamptz,
  queued_at timestamptz,
  invoiced_at timestamptz,
  credited_at timestamptz,
  rejected_at timestamptz,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint billing_items_source_check check (source_type in ('time_entry', 'material', 'equipment_usage', 'change_order', 'manual')),
  constraint billing_items_status_check check (status in ('recorded', 'approved', 'billable', 'queued', 'invoiced', 'credited', 'rejected')),
  constraint billing_items_quantity_check check (quantity > 0),
  constraint billing_items_unit_price_check check (unit_price_cents is null or unit_price_cents >= 0),
  constraint billing_items_total_check check (total_ex_vat_cents is null or total_ex_vat_cents >= 0),
  constraint billing_items_vat_check check (vat_rate >= 0 and vat_rate <= 100),
  constraint billing_items_description_check check (char_length(btrim(description)) between 2 and 500)
);

create unique index if not exists billing_items_source_unique
  on public.billing_items(organization_id, source_type, source_id)
  where source_id is not null;
create index if not exists billing_items_org_status_idx
  on public.billing_items(organization_id, status, created_at desc);
create index if not exists billing_items_project_idx
  on public.billing_items(organization_id, project_id, status);

create table if not exists public.vehicle_positions (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  equipment_id uuid not null references public.equipment(id) on delete cascade,
  project_id uuid references public.projects(id) on delete set null,
  driver_user_id uuid references auth.users(id) on delete set null,
  latitude double precision not null,
  longitude double precision not null,
  accuracy_m double precision,
  speed_kmh double precision,
  heading_degrees double precision,
  source text not null default 'manual',
  source_reference text,
  recorded_at timestamptz not null default now(),
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  constraint vehicle_positions_lat_check check (latitude between -90 and 90),
  constraint vehicle_positions_lon_check check (longitude between -180 and 180),
  constraint vehicle_positions_accuracy_check check (accuracy_m is null or accuracy_m between 0 and 100000),
  constraint vehicle_positions_speed_check check (speed_kmh is null or speed_kmh between 0 and 400),
  constraint vehicle_positions_heading_check check (heading_degrees is null or heading_degrees between 0 and 360),
  constraint vehicle_positions_source_check check (source in ('manual', 'device', 'mapon', 'integration'))
);

create index if not exists vehicle_positions_latest_idx
  on public.vehicle_positions(organization_id, equipment_id, recorded_at desc);

create table if not exists public.construction_reporting_exports (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  report_type text not null,
  target_month date not null,
  project_id uuid references public.projects(id) on delete set null,
  row_count integer not null default 0,
  generated_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  constraint construction_exports_type_check check (report_type in ('worker_data', 'contract_data')),
  constraint construction_exports_month_check check (target_month = date_trunc('month', target_month)::date),
  constraint construction_exports_count_check check (row_count >= 0)
);

alter table public.subcontractors enable row level security;
alter table public.subcontractor_workers enable row level security;
alter table public.subcontractor_project_assignments enable row level security;
alter table public.billing_items enable row level security;
alter table public.vehicle_positions enable row level security;
alter table public.construction_reporting_exports enable row level security;

revoke all on public.subcontractors, public.subcontractor_workers, public.subcontractor_project_assignments,
  public.billing_items, public.vehicle_positions, public.construction_reporting_exports from anon, authenticated;
grant select on public.subcontractors, public.subcontractor_workers, public.subcontractor_project_assignments,
  public.billing_items, public.vehicle_positions, public.construction_reporting_exports to authenticated;

drop policy if exists subcontractors_management_select on public.subcontractors;
create policy subcontractors_management_select on public.subcontractors for select to authenticated
using (private.has_org_role(organization_id, array['admin','supervisor']::text[]));
drop policy if exists subcontractor_workers_management_select on public.subcontractor_workers;
create policy subcontractor_workers_management_select on public.subcontractor_workers for select to authenticated
using (private.has_org_role(organization_id, array['admin','supervisor']::text[]));
drop policy if exists subcontractor_assignments_management_select on public.subcontractor_project_assignments;
create policy subcontractor_assignments_management_select on public.subcontractor_project_assignments for select to authenticated
using (private.has_org_role(organization_id, array['admin','supervisor']::text[]));
drop policy if exists billing_items_management_select on public.billing_items;
create policy billing_items_management_select on public.billing_items for select to authenticated
using (private.has_org_role(organization_id, array['admin','supervisor']::text[]));
drop policy if exists vehicle_positions_management_select on public.vehicle_positions;
create policy vehicle_positions_management_select on public.vehicle_positions for select to authenticated
using (private.has_org_role(organization_id, array['admin','supervisor']::text[]));
drop policy if exists construction_exports_management_select on public.construction_reporting_exports;
create policy construction_exports_management_select on public.construction_reporting_exports for select to authenticated
using (private.has_org_role(organization_id, array['admin','supervisor']::text[]));

create or replace function private.touch_commercial_row()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;
revoke all on function private.touch_commercial_row() from public, anon, authenticated;

drop trigger if exists subcontractors_touch on public.subcontractors;
create trigger subcontractors_touch before update on public.subcontractors
for each row execute function private.touch_commercial_row();
drop trigger if exists subcontractor_workers_touch on public.subcontractor_workers;
create trigger subcontractor_workers_touch before update on public.subcontractor_workers
for each row execute function private.touch_commercial_row();
drop trigger if exists subcontractor_assignments_touch on public.subcontractor_project_assignments;
create trigger subcontractor_assignments_touch before update on public.subcontractor_project_assignments
for each row execute function private.touch_commercial_row();
drop trigger if exists billing_items_touch on public.billing_items;
create trigger billing_items_touch before update on public.billing_items
for each row execute function private.touch_commercial_row();

create or replace function private.require_commercial_management(p_organization_id uuid)
returns void
language plpgsql
stable
security definer
set search_path = pg_catalog, public
as $$
begin
  if auth.uid() is null then
    raise exception 'Kirjautuminen vaaditaan.' using errcode = '42501';
  end if;
  if not private.has_org_role(p_organization_id, array['admin','supervisor']::text[]) then
    raise exception 'Toiminto vaatii admin- tai työnjohtajaoikeuden.' using errcode = '42501';
  end if;
end;
$$;
revoke all on function private.require_commercial_management(uuid) from public, anon;
grant execute on function private.require_commercial_management(uuid) to authenticated;

create or replace function private.create_subcontractor_impl(
  p_organization_id uuid,
  p_company_name text,
  p_business_id text default null,
  p_contact_name text default null,
  p_contact_email text default null,
  p_contact_phone text default null,
  p_liability_documents_valid_until date default null,
  p_insurance_valid_until date default null,
  p_notes text default null
)
returns uuid
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare result_id uuid;
begin
  perform private.require_commercial_management(p_organization_id);
  if char_length(btrim(coalesce(p_company_name,''))) < 2 then
    raise exception 'Yrityksen nimi on pakollinen.' using errcode = '23514';
  end if;
  insert into public.subcontractors(
    organization_id, company_name, business_id, contact_name, contact_email, contact_phone,
    liability_documents_valid_until, insurance_valid_until, notes, created_by
  ) values (
    p_organization_id, btrim(p_company_name), nullif(btrim(coalesce(p_business_id,'')),''),
    nullif(btrim(coalesce(p_contact_name,'')),''), nullif(btrim(coalesce(p_contact_email,'')),''),
    nullif(btrim(coalesce(p_contact_phone,'')),''), p_liability_documents_valid_until,
    p_insurance_valid_until, nullif(btrim(coalesce(p_notes,'')),''), auth.uid()
  ) returning id into result_id;
  insert into public.audit_logs(organization_id,user_id,action,table_name,record_id,metadata)
  values (p_organization_id,auth.uid(),'subcontractor_created','subcontractors',result_id,
    jsonb_build_object('has_business_id',p_business_id is not null));
  return result_id;
end;
$$;

create or replace function public.create_subcontractor(
  p_organization_id uuid,
  p_company_name text,
  p_business_id text default null,
  p_contact_name text default null,
  p_contact_email text default null,
  p_contact_phone text default null,
  p_liability_documents_valid_until date default null,
  p_insurance_valid_until date default null,
  p_notes text default null
)
returns uuid
language sql
security invoker
set search_path = pg_catalog, public
as $$
  select private.create_subcontractor_impl($1,$2,$3,$4,$5,$6,$7,$8,$9)
$$;

create or replace function private.create_subcontractor_worker_impl(
  p_organization_id uuid,
  p_subcontractor_id uuid,
  p_name text,
  p_email text default null,
  p_phone text default null,
  p_tax_number text default null,
  p_employment_category text default 'subcontractor_employee',
  p_valid_from date default null,
  p_valid_until date default null
)
returns uuid
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare result_id uuid;
begin
  perform private.require_commercial_management(p_organization_id);
  if not exists(select 1 from public.subcontractors s where s.id=p_subcontractor_id and s.organization_id=p_organization_id and s.archived_at is null) then
    raise exception 'Alihankkijaa ei löytynyt.' using errcode = '23503';
  end if;
  insert into public.subcontractor_workers(
    organization_id,subcontractor_id,name,email,phone,tax_number,employment_category,valid_from,valid_until,created_by
  ) values (
    p_organization_id,p_subcontractor_id,btrim(p_name),nullif(btrim(coalesce(p_email,'')),''),
    nullif(btrim(coalesce(p_phone,'')),''),nullif(btrim(coalesce(p_tax_number,'')),''),
    p_employment_category,p_valid_from,p_valid_until,auth.uid()
  ) returning id into result_id;
  insert into public.audit_logs(organization_id,user_id,action,table_name,record_id,metadata)
  values (p_organization_id,auth.uid(),'subcontractor_worker_created','subcontractor_workers',result_id,
    jsonb_build_object('subcontractor_id',p_subcontractor_id,'has_tax_number',p_tax_number is not null));
  return result_id;
end;
$$;

create or replace function public.create_subcontractor_worker(
  p_organization_id uuid,
  p_subcontractor_id uuid,
  p_name text,
  p_email text default null,
  p_phone text default null,
  p_tax_number text default null,
  p_employment_category text default 'subcontractor_employee',
  p_valid_from date default null,
  p_valid_until date default null
)
returns uuid
language sql
security invoker
set search_path = pg_catalog, public
as $$ select private.create_subcontractor_worker_impl($1,$2,$3,$4,$5,$6,$7,$8,$9) $$;

create or replace function private.create_subcontractor_assignment_impl(
  p_organization_id uuid,
  p_subcontractor_id uuid,
  p_project_id uuid,
  p_contract_number text default null,
  p_contract_value_cents bigint default null,
  p_billing_basis text default 'contract',
  p_is_construction_service boolean default true,
  p_starts_at date default null,
  p_ends_at date default null
)
returns uuid
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare result_id uuid;
begin
  perform private.require_commercial_management(p_organization_id);
  if not exists(select 1 from public.subcontractors s where s.id=p_subcontractor_id and s.organization_id=p_organization_id and s.archived_at is null) then
    raise exception 'Alihankkijaa ei löytynyt.' using errcode = '23503';
  end if;
  if not exists(select 1 from public.projects p where p.id=p_project_id and p.organization_id=p_organization_id and p.archived_at is null) then
    raise exception 'Projektia ei löytynyt.' using errcode = '23503';
  end if;
  insert into public.subcontractor_project_assignments(
    organization_id,subcontractor_id,project_id,contract_number,contract_value_cents,billing_basis,
    is_construction_service,starts_at,ends_at,created_by
  ) values (
    p_organization_id,p_subcontractor_id,p_project_id,nullif(btrim(coalesce(p_contract_number,'')),''),
    p_contract_value_cents,p_billing_basis,p_is_construction_service,p_starts_at,p_ends_at,auth.uid()
  ) returning id into result_id;
  insert into public.audit_logs(organization_id,user_id,action,table_name,record_id,metadata)
  values (p_organization_id,auth.uid(),'subcontractor_assignment_created','subcontractor_project_assignments',result_id,
    jsonb_build_object('subcontractor_id',p_subcontractor_id,'project_id',p_project_id,'billing_basis',p_billing_basis));
  return result_id;
end;
$$;

create or replace function public.create_subcontractor_assignment(
  p_organization_id uuid,
  p_subcontractor_id uuid,
  p_project_id uuid,
  p_contract_number text default null,
  p_contract_value_cents bigint default null,
  p_billing_basis text default 'contract',
  p_is_construction_service boolean default true,
  p_starts_at date default null,
  p_ends_at date default null
)
returns uuid
language sql
security invoker
set search_path = pg_catalog, public
as $$ select private.create_subcontractor_assignment_impl($1,$2,$3,$4,$5,$6,$7,$8,$9) $$;

create or replace function private.sync_billing_items_impl(p_organization_id uuid)
returns integer
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare inserted_count integer := 0; step_count integer := 0;
begin
  perform private.require_commercial_management(p_organization_id);

  insert into public.billing_items(
    organization_id,customer_id,project_id,work_order_id,source_type,source_id,description,quantity,unit,
    unit_price_cents,total_ex_vat_cents,status,created_by
  )
  select
    te.organization_id,p.customer_id,te.project_id,te.work_order_id,'time_entry',te.id,
    coalesce(nullif(btrim(te.description),''),te.employee || ' – työaika'),
    greatest(coalesce(te.hours,0)+coalesce(te.overtime,0),0.01),'h',
    coalesce(te.billing_rate_cents,p.default_billing_rate_cents),
    case when coalesce(te.billing_rate_cents,p.default_billing_rate_cents) is null then null
      else round((coalesce(te.hours,0)+coalesce(te.overtime,0))*coalesce(te.billing_rate_cents,p.default_billing_rate_cents))::bigint end,
    case when coalesce(te.billing_rate_cents,p.default_billing_rate_cents) is null then 'approved' else 'billable' end,
    auth.uid()
  from public.time_entries te
  join public.projects p on p.id=te.project_id and p.organization_id=te.organization_id
  where te.organization_id=p_organization_id and te.status='Hyväksytty' and te.billable=true
  on conflict (organization_id,source_type,source_id) where source_id is not null do nothing;
  get diagnostics step_count = row_count; inserted_count := inserted_count + step_count;

  insert into public.billing_items(
    organization_id,customer_id,project_id,work_order_id,source_type,source_id,description,quantity,unit,
    unit_price_cents,total_ex_vat_cents,status,created_by
  )
  select
    oe.organization_id,p.customer_id,oe.project_id,oe.work_order_id,
    case when oe.entry_type='material' then 'material' else 'equipment_usage' end,oe.id,
    coalesce(nullif(btrim(oe.title),''),nullif(btrim(oe.description),''),'Operatiivinen kirjaus'),
    case when oe.entry_type='material' then greatest(coalesce(oe.quantity,1),0.001)
      else greatest(coalesce(oe.duration_hours,1),0.001) end,
    case when oe.entry_type='material' then coalesce(nullif(btrim(oe.unit),''),'kpl') else 'h' end,
    case when oe.amount_cents is null then null
      else round(oe.amount_cents / case when oe.entry_type='material' then greatest(coalesce(oe.quantity,1),0.001)
        else greatest(coalesce(oe.duration_hours,1),0.001) end)::bigint end,
    oe.amount_cents,
    case when oe.amount_cents is null then 'approved' else 'billable' end,
    auth.uid()
  from public.operational_entries oe
  join public.projects p on p.id=oe.project_id and p.organization_id=oe.organization_id
  where oe.organization_id=p_organization_id and oe.status='Hyväksytty' and oe.entry_type in ('material','equipment_usage')
  on conflict (organization_id,source_type,source_id) where source_id is not null do nothing;
  get diagnostics step_count = row_count; inserted_count := inserted_count + step_count;

  insert into public.billing_items(
    organization_id,customer_id,project_id,source_type,source_id,description,quantity,unit,
    unit_price_cents,total_ex_vat_cents,status,created_by
  )
  select co.organization_id,p.customer_id,co.project_id,'change_order',co.id,
    coalesce(nullif(btrim(co.title),''),'Lisä- tai muutostyö'),1,'kpl',co.amount_cents,co.amount_cents,'billable',auth.uid()
  from public.change_orders co
  join public.projects p on p.id=co.project_id and p.organization_id=co.organization_id
  where co.organization_id=p_organization_id
    and co.amount_cents > 0
    and (co.status in ('Hyväksytty','Hyväksytty tilaajalla') or co.customer_decision='Hyväksytty')
  on conflict (organization_id,source_type,source_id) where source_id is not null do nothing;
  get diagnostics step_count = row_count; inserted_count := inserted_count + step_count;

  insert into public.audit_logs(organization_id,user_id,action,table_name,metadata)
  values (p_organization_id,auth.uid(),'billing_items_synced','billing_items',jsonb_build_object('inserted_count',inserted_count));
  return inserted_count;
end;
$$;

create or replace function public.sync_billing_items(p_organization_id uuid)
returns integer
language sql
security invoker
set search_path = pg_catalog, public
as $$ select private.sync_billing_items_impl($1) $$;

create or replace function private.set_billing_item_price_impl(p_item_id uuid,p_unit_price_cents bigint)
returns public.billing_items
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare item public.billing_items;
begin
  select * into item from public.billing_items where id=p_item_id for update;
  if item.id is null then raise exception 'Laskutusriviä ei löytynyt.' using errcode='P0002'; end if;
  perform private.require_commercial_management(item.organization_id);
  if item.status in ('queued','invoiced','credited') then
    raise exception 'Laskulle lisätyn tai laskutetun rivin hintaa ei voi muuttaa.' using errcode='23514';
  end if;
  if p_unit_price_cents is null or p_unit_price_cents < 0 then
    raise exception 'Yksikköhinta on virheellinen.' using errcode='23514';
  end if;
  update public.billing_items set unit_price_cents=p_unit_price_cents,
    total_ex_vat_cents=round(quantity*p_unit_price_cents)::bigint,
    status=case when status in ('recorded','approved','rejected') then 'billable' else status end
  where id=p_item_id returning * into item;
  insert into public.audit_logs(organization_id,user_id,action,table_name,record_id,metadata)
  values(item.organization_id,auth.uid(),'billing_item_priced','billing_items',item.id,
    jsonb_build_object('status',item.status));
  return item;
end;
$$;

create or replace function public.set_billing_item_price(p_item_id uuid,p_unit_price_cents bigint)
returns public.billing_items
language sql
security invoker
set search_path = pg_catalog, public
as $$ select * from private.set_billing_item_price_impl($1,$2) $$;

create or replace function private.transition_billing_item_impl(
  p_item_id uuid,
  p_status text,
  p_invoice_reference text default null
)
returns public.billing_items
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare item public.billing_items; allowed boolean := false;
begin
  select * into item from public.billing_items where id=p_item_id for update;
  if item.id is null then raise exception 'Laskutusriviä ei löytynyt.' using errcode='P0002'; end if;
  perform private.require_commercial_management(item.organization_id);
  allowed := (item.status='recorded' and p_status in ('approved','rejected'))
    or (item.status='approved' and p_status in ('billable','rejected'))
    or (item.status='billable' and p_status in ('queued','rejected'))
    or (item.status='queued' and p_status in ('invoiced','rejected'))
    or (item.status='invoiced' and p_status='credited');
  if not allowed then
    raise exception 'Laskutusrivin tilasiirtymä % → % ei ole sallittu.',item.status,p_status using errcode='23514';
  end if;
  if p_status in ('billable','queued','invoiced') and (item.unit_price_cents is null or item.total_ex_vat_cents is null) then
    raise exception 'Laskutusriviltä puuttuu hinta.' using errcode='23514';
  end if;
  if p_status='invoiced' and nullif(btrim(coalesce(p_invoice_reference,'')),'') is null then
    raise exception 'Laskun numero tai viite on pakollinen.' using errcode='23514';
  end if;
  update public.billing_items set
    status=p_status,
    invoice_reference=case when p_status='invoiced' then btrim(p_invoice_reference) else invoice_reference end,
    approved_by=case when p_status='approved' then auth.uid() else approved_by end,
    approved_at=case when p_status='approved' then now() else approved_at end,
    queued_at=case when p_status='queued' then now() else queued_at end,
    invoiced_at=case when p_status='invoiced' then now() else invoiced_at end,
    credited_at=case when p_status='credited' then now() else credited_at end,
    rejected_at=case when p_status='rejected' then now() else rejected_at end
  where id=p_item_id returning * into item;
  if item.source_type='time_entry' and item.source_id is not null then
    update public.time_entries set billing_status=p_status,
      invoice_reference=case when p_status='invoiced' then item.invoice_reference else invoice_reference end,
      billed_at=case when p_status='invoiced' then now() else billed_at end
    where id=item.source_id and organization_id=item.organization_id;
  end if;
  insert into public.audit_logs(organization_id,user_id,action,table_name,record_id,metadata)
  values(item.organization_id,auth.uid(),'billing_item_transitioned','billing_items',item.id,
    jsonb_build_object('from_status',item.status,'to_status',p_status,'has_invoice_reference',p_invoice_reference is not null));
  return item;
end;
$$;

create or replace function public.transition_billing_item(p_item_id uuid,p_status text,p_invoice_reference text default null)
returns public.billing_items
language sql
security invoker
set search_path = pg_catalog, public
as $$ select * from private.transition_billing_item_impl($1,$2,$3) $$;

create or replace function private.record_vehicle_position_impl(
  p_organization_id uuid,p_equipment_id uuid,p_project_id uuid,p_latitude double precision,p_longitude double precision,
  p_accuracy_m double precision default null,p_source text default 'manual',p_source_reference text default null,
  p_speed_kmh double precision default null,p_heading_degrees double precision default null
)
returns uuid
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare result_id uuid;
begin
  perform private.require_commercial_management(p_organization_id);
  if not exists(select 1 from public.equipment e where e.id=p_equipment_id and e.organization_id=p_organization_id and e.archived_at is null) then
    raise exception 'Ajoneuvoa tai kalustoa ei löytynyt.' using errcode='23503';
  end if;
  if p_project_id is not null and not exists(select 1 from public.projects p where p.id=p_project_id and p.organization_id=p_organization_id and p.archived_at is null) then
    raise exception 'Projektia ei löytynyt.' using errcode='23503';
  end if;
  insert into public.vehicle_positions(
    organization_id,equipment_id,project_id,driver_user_id,latitude,longitude,accuracy_m,speed_kmh,
    heading_degrees,source,source_reference,created_by
  ) values (
    p_organization_id,p_equipment_id,p_project_id,auth.uid(),p_latitude,p_longitude,p_accuracy_m,p_speed_kmh,
    p_heading_degrees,p_source,nullif(btrim(coalesce(p_source_reference,'')),''),auth.uid()
  ) returning id into result_id;
  insert into public.audit_logs(organization_id,user_id,action,table_name,record_id,metadata)
  values(p_organization_id,auth.uid(),'vehicle_position_recorded','vehicle_positions',result_id,
    jsonb_build_object('equipment_id',p_equipment_id,'source',p_source,'accuracy_m',p_accuracy_m));
  return result_id;
end;
$$;

create or replace function public.record_vehicle_position(
  p_organization_id uuid,p_equipment_id uuid,p_project_id uuid,p_latitude double precision,p_longitude double precision,
  p_accuracy_m double precision default null,p_source text default 'manual',p_source_reference text default null,
  p_speed_kmh double precision default null,p_heading_degrees double precision default null
)
returns uuid
language sql
security invoker
set search_path = pg_catalog, public
as $$ select private.record_vehicle_position_impl($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) $$;

create or replace function private.list_construction_reporting_impl(
  p_organization_id uuid,p_target_month date,p_project_id uuid default null
)
returns jsonb
language plpgsql
stable
security definer
set search_path = pg_catalog, public
as $$
declare month_start date; month_end date; threshold_cents bigint := 1500000;
begin
  perform private.require_commercial_management(p_organization_id);
  month_start := date_trunc('month',p_target_month)::date;
  month_end := (month_start + interval '1 month - 1 day')::date;
  return jsonb_build_object(
    'targetMonth',month_start,
    'thresholdCents',threshold_cents,
    'workerRows',coalesce((
      select jsonb_agg(jsonb_build_object(
        'projectId',p.id,'projectName',p.name,'siteLocation',p.location,'userId',e.user_id,
        'workerName',e.name,'taxNumber',e.tax_number,'employmentCategory',e.employment_category,
        'employerName',o.name,'employerBusinessId',o.business_id,
        'firstWorkDate',min(te.date),'lastWorkDate',max(te.date),
        'workDays',count(distinct te.date),'workHours',round(sum(coalesce(te.hours,0)+coalesce(te.overtime,0)),2)
      ) order by p.name,e.name)
      from public.time_entries te
      join public.projects p on p.id=te.project_id and p.organization_id=te.organization_id
      join public.employees e on e.id=te.employee_id and e.organization_id=te.organization_id
      join public.organizations o on o.id=te.organization_id
      where te.organization_id=p_organization_id and te.date between month_start and month_end
        and te.status='Hyväksytty' and (p_project_id is null or p.id=p_project_id)
      group by p.id,p.name,p.location,e.id,e.user_id,e.name,e.tax_number,e.employment_category,o.name,o.business_id
    ),'[]'::jsonb),
    'subcontractorWorkerRows',coalesce((
      select jsonb_agg(jsonb_build_object(
        'projectId',p.id,'projectName',p.name,'siteLocation',p.location,'workerName',sw.name,
        'taxNumber',sw.tax_number,'employmentCategory',sw.employment_category,
        'employerName',s.company_name,'employerBusinessId',s.business_id,
        'validFrom',sw.valid_from,'validUntil',sw.valid_until
      ) order by p.name,s.company_name,sw.name)
      from public.subcontractor_project_assignments a
      join public.subcontractors s on s.id=a.subcontractor_id and s.organization_id=a.organization_id
      join public.subcontractor_workers sw on sw.subcontractor_id=s.id and sw.organization_id=s.organization_id
      join public.projects p on p.id=a.project_id and p.organization_id=a.organization_id
      where a.organization_id=p_organization_id and a.status in ('planned','active')
        and (a.starts_at is null or a.starts_at<=month_end) and (a.ends_at is null or a.ends_at>=month_start)
        and (sw.valid_from is null or sw.valid_from<=month_end) and (sw.valid_until is null or sw.valid_until>=month_start)
        and (p_project_id is null or p.id=p_project_id)
    ),'[]'::jsonb),
    'contractRows',coalesce((
      select jsonb_agg(jsonb_build_object(
        'projectId',p.id,'projectName',p.name,'siteLocation',p.location,
        'subcontractorName',s.company_name,'businessId',s.business_id,'contractNumber',a.contract_number,
        'contractValueCents',a.contract_value_cents,'billingBasis',a.billing_basis,
        'isConstructionService',a.is_construction_service,'startsAt',a.starts_at,'endsAt',a.ends_at,
        'reportingThresholdExceeded',coalesce(a.contract_value_cents,0)>threshold_cents
      ) order by p.name,s.company_name)
      from public.subcontractor_project_assignments a
      join public.subcontractors s on s.id=a.subcontractor_id and s.organization_id=a.organization_id
      join public.projects p on p.id=a.project_id and p.organization_id=a.organization_id
      where a.organization_id=p_organization_id and a.is_construction_service=true
        and a.status in ('planned','active','completed')
        and (a.starts_at is null or a.starts_at<=month_end) and (a.ends_at is null or a.ends_at>=month_start)
        and (p_project_id is null or p.id=p_project_id)
    ),'[]'::jsonb)
  );
end;
$$;

create or replace function public.list_construction_reporting(
  p_organization_id uuid,p_target_month date,p_project_id uuid default null
)
returns jsonb
language sql
stable
security invoker
set search_path = pg_catalog, public
as $$ select private.list_construction_reporting_impl($1,$2,$3) $$;

create or replace function private.record_construction_export_impl(
  p_organization_id uuid,p_report_type text,p_target_month date,p_project_id uuid,p_row_count integer
)
returns uuid
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare result_id uuid;
begin
  perform private.require_commercial_management(p_organization_id);
  insert into public.construction_reporting_exports(
    organization_id,report_type,target_month,project_id,row_count,generated_by
  ) values (
    p_organization_id,p_report_type,date_trunc('month',p_target_month)::date,p_project_id,p_row_count,auth.uid()
  ) returning id into result_id;
  insert into public.audit_logs(organization_id,user_id,action,table_name,record_id,metadata)
  values(p_organization_id,auth.uid(),'construction_report_exported','construction_reporting_exports',result_id,
    jsonb_build_object('report_type',p_report_type,'target_month',date_trunc('month',p_target_month)::date,'row_count',p_row_count));
  return result_id;
end;
$$;

create or replace function public.record_construction_export(
  p_organization_id uuid,p_report_type text,p_target_month date,p_project_id uuid,p_row_count integer
)
returns uuid
language sql
security invoker
set search_path = pg_catalog, public
as $$ select private.record_construction_export_impl($1,$2,$3,$4,$5) $$;

revoke all on function private.create_subcontractor_impl(uuid,text,text,text,text,text,date,date,text) from public,anon;
revoke all on function private.create_subcontractor_worker_impl(uuid,uuid,text,text,text,text,text,date,date) from public,anon;
revoke all on function private.create_subcontractor_assignment_impl(uuid,uuid,uuid,text,bigint,text,boolean,date,date) from public,anon;
revoke all on function private.sync_billing_items_impl(uuid) from public,anon;
revoke all on function private.set_billing_item_price_impl(uuid,bigint) from public,anon;
revoke all on function private.transition_billing_item_impl(uuid,text,text) from public,anon;
revoke all on function private.record_vehicle_position_impl(uuid,uuid,uuid,double precision,double precision,double precision,text,text,double precision,double precision) from public,anon;
revoke all on function private.list_construction_reporting_impl(uuid,date,uuid) from public,anon;
revoke all on function private.record_construction_export_impl(uuid,text,date,uuid,integer) from public,anon;

grant execute on function private.create_subcontractor_impl(uuid,text,text,text,text,text,date,date,text) to authenticated;
grant execute on function private.create_subcontractor_worker_impl(uuid,uuid,text,text,text,text,text,date,date) to authenticated;
grant execute on function private.create_subcontractor_assignment_impl(uuid,uuid,uuid,text,bigint,text,boolean,date,date) to authenticated;
grant execute on function private.sync_billing_items_impl(uuid) to authenticated;
grant execute on function private.set_billing_item_price_impl(uuid,bigint) to authenticated;
grant execute on function private.transition_billing_item_impl(uuid,text,text) to authenticated;
grant execute on function private.record_vehicle_position_impl(uuid,uuid,uuid,double precision,double precision,double precision,text,text,double precision,double precision) to authenticated;
grant execute on function private.list_construction_reporting_impl(uuid,date,uuid) to authenticated;
grant execute on function private.record_construction_export_impl(uuid,text,date,uuid,integer) to authenticated;

revoke all on function public.create_subcontractor(uuid,text,text,text,text,text,date,date,text) from public,anon;
revoke all on function public.create_subcontractor_worker(uuid,uuid,text,text,text,text,text,date,date) from public,anon;
revoke all on function public.create_subcontractor_assignment(uuid,uuid,uuid,text,bigint,text,boolean,date,date) from public,anon;
revoke all on function public.sync_billing_items(uuid) from public,anon;
revoke all on function public.set_billing_item_price(uuid,bigint) from public,anon;
revoke all on function public.transition_billing_item(uuid,text,text) from public,anon;
revoke all on function public.record_vehicle_position(uuid,uuid,uuid,double precision,double precision,double precision,text,text,double precision,double precision) from public,anon;
revoke all on function public.list_construction_reporting(uuid,date,uuid) from public,anon;
revoke all on function public.record_construction_export(uuid,text,date,uuid,integer) from public,anon;

grant execute on function public.create_subcontractor(uuid,text,text,text,text,text,date,date,text) to authenticated;
grant execute on function public.create_subcontractor_worker(uuid,uuid,text,text,text,text,text,date,date) to authenticated;
grant execute on function public.create_subcontractor_assignment(uuid,uuid,uuid,text,bigint,text,boolean,date,date) to authenticated;
grant execute on function public.sync_billing_items(uuid) to authenticated;
grant execute on function public.set_billing_item_price(uuid,bigint) to authenticated;
grant execute on function public.transition_billing_item(uuid,text,text) to authenticated;
grant execute on function public.record_vehicle_position(uuid,uuid,uuid,double precision,double precision,double precision,text,text,double precision,double precision) to authenticated;
grant execute on function public.list_construction_reporting(uuid,date,uuid) to authenticated;
grant execute on function public.record_construction_export(uuid,text,date,uuid,integer) to authenticated;

commit;
