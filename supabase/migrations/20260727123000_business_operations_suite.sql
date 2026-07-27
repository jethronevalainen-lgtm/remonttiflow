begin;

alter table public.projects
  add column if not exists default_billing_rate_cents bigint,
  add column if not exists construction_reporting_enabled boolean not null default false,
  add column if not exists shared_construction_site boolean not null default false;

alter table public.employees
  add column if not exists tax_number text,
  add column if not exists employment_category text not null default 'employee';

alter table public.time_entries
  add column if not exists billable boolean not null default true,
  add column if not exists billing_rate_cents bigint,
  add column if not exists billing_status text not null default 'recorded',
  add column if not exists invoice_reference text,
  add column if not exists billed_at timestamptz;

alter table public.time_entries drop constraint if exists time_entries_billing_status_check;
alter table public.time_entries add constraint time_entries_billing_status_check check (
  billing_status in ('recorded','approved','billable','queued','invoiced','credited','rejected')
);

create table if not exists public.subcontractors (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  company_name text not null,
  business_id text,
  contact_name text,
  contact_email text,
  contact_phone text,
  status text not null default 'active' check (status in ('active','suspended','expired','archived')),
  liability_documents_valid_until date,
  insurance_valid_until date,
  notes text,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  archived_at timestamptz
);

create unique index if not exists subcontractors_org_business_id_uidx
  on public.subcontractors(organization_id,business_id)
  where business_id is not null and archived_at is null;
create index if not exists subcontractors_org_status_idx
  on public.subcontractors(organization_id,status,company_name);

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
  status text not null default 'active' check (status in ('active','suspended','expired','archived')),
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists subcontractor_workers_org_idx
  on public.subcontractor_workers(organization_id,subcontractor_id,status,name);

create table if not exists public.subcontractor_project_assignments (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  subcontractor_id uuid not null references public.subcontractors(id) on delete cascade,
  project_id uuid not null references public.projects(id) on delete cascade,
  contract_number text,
  contract_value_cents bigint,
  billing_basis text not null default 'contract' check (billing_basis in ('contract','hourly','unit','labour_hire')),
  is_construction_service boolean not null default true,
  starts_at date,
  ends_at date,
  status text not null default 'active' check (status in ('planned','active','completed','cancelled')),
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (contract_value_cents is null or contract_value_cents >= 0)
);
create unique index if not exists subcontractor_assignments_unique_idx
  on public.subcontractor_project_assignments(subcontractor_id,project_id,coalesce(contract_number,''));
create index if not exists subcontractor_assignments_org_project_idx
  on public.subcontractor_project_assignments(organization_id,project_id,status);

create table if not exists public.billing_items (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  customer_id uuid references public.customers(id) on delete set null,
  project_id uuid not null references public.projects(id) on delete cascade,
  work_order_id uuid references public.work_orders(id) on delete set null,
  source_type text not null check (source_type in ('time_entry','material','equipment_usage','change_order','manual')),
  source_id uuid,
  description text not null,
  quantity numeric(12,3) not null default 1 check (quantity >= 0),
  unit text not null default 'kpl',
  unit_price_cents bigint,
  vat_rate numeric(5,2) not null default 25.5 check (vat_rate >= 0),
  total_ex_vat_cents bigint,
  status text not null default 'approved' check (status in ('recorded','approved','billable','queued','invoiced','credited','rejected')),
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
  on public.billing_items(organization_id,source_type,source_id)
  where source_id is not null;
create index if not exists billing_items_org_status_idx
  on public.billing_items(organization_id,status,created_at desc);

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
  source text not null default 'manual' check (source in ('manual','device','mapon','integration')),
  external_device_id text,
  source_reference text,
  recorded_at timestamptz not null default now(),
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);
create index if not exists vehicle_positions_latest_idx
  on public.vehicle_positions(organization_id,equipment_id,recorded_at desc);

create table if not exists public.construction_reporting_exports (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  report_type text not null check (report_type in ('worker_data','contract_data')),
  target_month date not null,
  project_id uuid references public.projects(id) on delete set null,
  row_count integer not null default 0,
  status text not null default 'generated' check (status in ('generated','reviewed','submitted','replaced')),
  generated_by uuid references auth.users(id) on delete set null,
  generated_at timestamptz not null default now(),
  reviewed_at timestamptz,
  submitted_at timestamptz,
  submission_reference text,
  notes text
);
create index if not exists construction_exports_org_month_idx
  on public.construction_reporting_exports(organization_id,target_month desc,report_type);

alter table public.subcontractors enable row level security;
alter table public.subcontractor_workers enable row level security;
alter table public.subcontractor_project_assignments enable row level security;
alter table public.billing_items enable row level security;
alter table public.vehicle_positions enable row level security;
alter table public.construction_reporting_exports enable row level security;

revoke all on public.subcontractors from anon,authenticated;
revoke all on public.subcontractor_workers from anon,authenticated;
revoke all on public.subcontractor_project_assignments from anon,authenticated;
revoke all on public.billing_items from anon,authenticated;
revoke all on public.vehicle_positions from anon,authenticated;
revoke all on public.construction_reporting_exports from anon,authenticated;

create or replace function private.business_operations_data(p_organization_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path=pg_catalog,public,private
as $$
begin
  if not private.has_org_role(p_organization_id,array['admin','supervisor']::text[]) then
    raise exception 'Vain työnjohto voi avata toiminnanohjauksen.' using errcode='42501';
  end if;
  return jsonb_build_object(
    'projects',coalesce((select jsonb_agg(jsonb_build_object('id',p.id,'name',p.name,'projectNumber',p.project_number,'location',p.location,'customerId',p.customer_id,'defaultBillingRateCents',p.default_billing_rate_cents,'constructionReportingEnabled',p.construction_reporting_enabled,'sharedConstructionSite',p.shared_construction_site) order by p.name) from public.projects p where p.organization_id=p_organization_id and p.archived_at is null),'[]'::jsonb),
    'equipment',coalesce((select jsonb_agg(jsonb_build_object('id',e.id,'name',e.name,'type',e.type,'assetNumber',e.asset_number,'currentProjectId',e.current_project_id) order by e.name) from public.equipment e where e.organization_id=p_organization_id and e.archived_at is null),'[]'::jsonb),
    'subcontractors',coalesce((select jsonb_agg(jsonb_build_object(
      'id',s.id,'companyName',s.company_name,'businessId',s.business_id,'contactName',s.contact_name,'contactEmail',s.contact_email,'contactPhone',s.contact_phone,'status',s.status,'liabilityDocumentsValidUntil',s.liability_documents_valid_until,'insuranceValidUntil',s.insurance_valid_until,'notes',s.notes,
      'workers',coalesce((select jsonb_agg(jsonb_build_object('id',w.id,'name',w.name,'email',w.email,'phone',w.phone,'taxNumber',w.tax_number,'employmentCategory',w.employment_category,'validFrom',w.valid_from,'validUntil',w.valid_until,'status',w.status) order by w.name) from public.subcontractor_workers w where w.subcontractor_id=s.id),'[]'::jsonb),
      'assignments',coalesce((select jsonb_agg(jsonb_build_object('id',a.id,'projectId',a.project_id,'contractNumber',a.contract_number,'contractValueCents',a.contract_value_cents,'billingBasis',a.billing_basis,'isConstructionService',a.is_construction_service,'startsAt',a.starts_at,'endsAt',a.ends_at,'status',a.status) order by a.created_at desc) from public.subcontractor_project_assignments a where a.subcontractor_id=s.id),'[]'::jsonb)
    ) order by s.company_name) from public.subcontractors s where s.organization_id=p_organization_id and s.archived_at is null),'[]'::jsonb),
    'billingItems',coalesce((select jsonb_agg(jsonb_build_object('id',b.id,'customerId',b.customer_id,'projectId',b.project_id,'workOrderId',b.work_order_id,'sourceType',b.source_type,'sourceId',b.source_id,'description',b.description,'quantity',b.quantity,'unit',b.unit,'unitPriceCents',b.unit_price_cents,'vatRate',b.vat_rate,'totalExVatCents',b.total_ex_vat_cents,'status',b.status,'invoiceReference',b.invoice_reference,'createdAt',b.created_at) order by b.created_at desc) from public.billing_items b where b.organization_id=p_organization_id),'[]'::jsonb),
    'vehiclePositions',coalesce((select jsonb_agg(to_jsonb(v) order by v."recordedAt" desc) from (select distinct on (vp.equipment_id) vp.id,vp.equipment_id as "equipmentId",vp.project_id as "projectId",vp.driver_user_id as "driverUserId",vp.latitude,vp.longitude,vp.accuracy_m as "accuracyM",vp.speed_kmh as "speedKmh",vp.heading_degrees as "headingDegrees",vp.source,vp.external_device_id as "externalDeviceId",vp.source_reference as "sourceReference",vp.recorded_at as "recordedAt" from public.vehicle_positions vp where vp.organization_id=p_organization_id order by vp.equipment_id,vp.recorded_at desc) v),'[]'::jsonb),
    'summary',jsonb_build_object(
      'activeSubcontractors',(select count(*) from public.subcontractors s where s.organization_id=p_organization_id and s.status='active' and s.archived_at is null),
      'billableCents',coalesce((select sum(b.total_ex_vat_cents) from public.billing_items b where b.organization_id=p_organization_id and b.status='billable'),0),
      'queuedCents',coalesce((select sum(b.total_ex_vat_cents) from public.billing_items b where b.organization_id=p_organization_id and b.status='queued'),0),
      'invoicedCents',coalesce((select sum(b.total_ex_vat_cents) from public.billing_items b where b.organization_id=p_organization_id and b.status='invoiced'),0),
      'trackedVehicles',(select count(distinct vp.equipment_id) from public.vehicle_positions vp where vp.organization_id=p_organization_id)
    )
  );
end;
$$;

create or replace function private.save_subcontractor(p_organization_id uuid,p_payload jsonb)
returns uuid language plpgsql security definer set search_path=pg_catalog,public,private as $$
declare result_id uuid;begin
  if not private.has_org_role(p_organization_id,array['admin','supervisor']::text[]) then raise exception 'Ei oikeutta.' using errcode='42501'; end if;
  if char_length(btrim(coalesce(p_payload->>'companyName',''))) < 2 then raise exception 'Yrityksen nimi puuttuu.' using errcode='23514'; end if;
  insert into public.subcontractors(organization_id,company_name,business_id,contact_name,contact_email,contact_phone,liability_documents_valid_until,insurance_valid_until,notes,created_by)
  values(p_organization_id,btrim(p_payload->>'companyName'),nullif(btrim(p_payload->>'businessId'),''),nullif(btrim(p_payload->>'contactName'),''),nullif(btrim(p_payload->>'contactEmail'),''),nullif(btrim(p_payload->>'contactPhone'),''),nullif(p_payload->>'liabilityDocumentsValidUntil','')::date,nullif(p_payload->>'insuranceValidUntil','')::date,nullif(btrim(p_payload->>'notes'),''),auth.uid()) returning id into result_id;
  insert into public.audit_logs(organization_id,user_id,action,table_name,record_id,metadata) values(p_organization_id,auth.uid(),'subcontractor_created','subcontractors',result_id,jsonb_build_object('companyName',p_payload->>'companyName'));
  return result_id;
end;$$;

create or replace function private.save_subcontractor_worker(p_organization_id uuid,p_payload jsonb)
returns uuid language plpgsql security definer set search_path=pg_catalog,public,private as $$
declare result_id uuid; s_id uuid:=nullif(p_payload->>'subcontractorId','')::uuid;begin
  if not private.has_org_role(p_organization_id,array['admin','supervisor']::text[]) then raise exception 'Ei oikeutta.' using errcode='42501'; end if;
  if not exists(select 1 from public.subcontractors s where s.id=s_id and s.organization_id=p_organization_id and s.archived_at is null) then raise exception 'Alihankkijaa ei löytynyt.' using errcode='23503'; end if;
  if char_length(btrim(coalesce(p_payload->>'name',''))) < 2 then raise exception 'Työntekijän nimi puuttuu.' using errcode='23514'; end if;
  insert into public.subcontractor_workers(organization_id,subcontractor_id,name,email,phone,tax_number,employment_category,valid_from,valid_until,created_by)
  values(p_organization_id,s_id,btrim(p_payload->>'name'),nullif(btrim(p_payload->>'email'),''),nullif(btrim(p_payload->>'phone'),''),nullif(btrim(p_payload->>'taxNumber'),''),coalesce(nullif(p_payload->>'employmentCategory',''),'subcontractor_employee'),nullif(p_payload->>'validFrom','')::date,nullif(p_payload->>'validUntil','')::date,auth.uid()) returning id into result_id;
  insert into public.audit_logs(organization_id,user_id,action,table_name,record_id,metadata) values(p_organization_id,auth.uid(),'subcontractor_worker_created','subcontractor_workers',result_id,jsonb_build_object('subcontractorId',s_id)); return result_id;
end;$$;

create or replace function private.save_subcontractor_assignment(p_organization_id uuid,p_payload jsonb)
returns uuid language plpgsql security definer set search_path=pg_catalog,public,private as $$
declare result_id uuid;s_id uuid:=nullif(p_payload->>'subcontractorId','')::uuid;p_id uuid:=nullif(p_payload->>'projectId','')::uuid;begin
  if not private.has_org_role(p_organization_id,array['admin','supervisor']::text[]) then raise exception 'Ei oikeutta.' using errcode='42501'; end if;
  if not exists(select 1 from public.subcontractors s where s.id=s_id and s.organization_id=p_organization_id and s.archived_at is null) then raise exception 'Alihankkijaa ei löytynyt.' using errcode='23503'; end if;
  if not exists(select 1 from public.projects p where p.id=p_id and p.organization_id=p_organization_id and p.archived_at is null) then raise exception 'Projektia ei löytynyt.' using errcode='23503'; end if;
  insert into public.subcontractor_project_assignments(organization_id,subcontractor_id,project_id,contract_number,contract_value_cents,billing_basis,is_construction_service,starts_at,ends_at,created_by)
  values(p_organization_id,s_id,p_id,nullif(btrim(p_payload->>'contractNumber'),''),nullif(p_payload->>'contractValueCents','')::bigint,coalesce(nullif(p_payload->>'billingBasis',''),'contract'),coalesce((p_payload->>'isConstructionService')::boolean,true),nullif(p_payload->>'startsAt','')::date,nullif(p_payload->>'endsAt','')::date,auth.uid()) returning id into result_id;
  insert into public.audit_logs(organization_id,user_id,action,table_name,record_id,metadata) values(p_organization_id,auth.uid(),'subcontractor_assignment_created','subcontractor_project_assignments',result_id,jsonb_build_object('subcontractorId',s_id,'projectId',p_id)); return result_id;
end;$$;

create or replace function private.sync_billing_items(p_organization_id uuid)
returns integer language plpgsql security definer set search_path=pg_catalog,public,private as $$
declare affected integer:=0;step_count integer:=0;begin
  if not private.has_org_role(p_organization_id,array['admin','supervisor']::text[]) then raise exception 'Ei oikeutta.' using errcode='42501'; end if;
  insert into public.billing_items(organization_id,customer_id,project_id,work_order_id,source_type,source_id,description,quantity,unit,unit_price_cents,total_ex_vat_cents,status,approved_by,approved_at,created_by)
  select te.organization_id,p.customer_id,te.project_id,te.work_order_id,'time_entry',te.id,coalesce(nullif(btrim(te.description),''),concat('Työaika ',te.employee,' ',te.date)),greatest(0,te.hours+coalesce(te.overtime,0)),'h',coalesce(te.billing_rate_cents,p.default_billing_rate_cents),case when coalesce(te.billing_rate_cents,p.default_billing_rate_cents) is null then null else round(greatest(0,te.hours+coalesce(te.overtime,0))*coalesce(te.billing_rate_cents,p.default_billing_rate_cents))::bigint end,case when te.billable is false then 'rejected' when coalesce(te.billing_rate_cents,p.default_billing_rate_cents) is null then 'approved' else 'billable' end,te.approved_by,te.approved_at,auth.uid()
  from public.time_entries te join public.projects p on p.id=te.project_id and p.organization_id=te.organization_id where te.organization_id=p_organization_id and te.status='Hyväksytty'
  on conflict(organization_id,source_type,source_id) where source_id is not null do nothing;
  get diagnostics step_count=row_count;affected:=affected+step_count;
  insert into public.billing_items(organization_id,customer_id,project_id,work_order_id,source_type,source_id,description,quantity,unit,unit_price_cents,total_ex_vat_cents,status,approved_by,approved_at,created_by)
  select oe.organization_id,p.customer_id,oe.project_id,oe.work_order_id,oe.entry_type,oe.id,coalesce(nullif(btrim(oe.description),''),oe.title),case when oe.entry_type='material' then greatest(coalesce(oe.quantity,1),0) else greatest(coalesce(oe.duration_hours,1),0) end,case when oe.entry_type='material' then coalesce(oe.unit,'kpl') else 'h' end,case when oe.amount_cents is null then null when oe.entry_type='material' and coalesce(oe.quantity,0)>0 then round(oe.amount_cents/oe.quantity)::bigint when oe.entry_type='equipment_usage' and coalesce(oe.duration_hours,0)>0 then round(oe.amount_cents/oe.duration_hours)::bigint else oe.amount_cents end,oe.amount_cents,case when oe.amount_cents is null then 'approved' else 'billable' end,oe.approved_by,oe.approved_at,auth.uid()
  from public.operational_entries oe join public.projects p on p.id=oe.project_id and p.organization_id=oe.organization_id where oe.organization_id=p_organization_id and oe.status='Hyväksytty' and oe.entry_type in('material','equipment_usage')
  on conflict(organization_id,source_type,source_id) where source_id is not null do nothing;
  get diagnostics step_count=row_count;affected:=affected+step_count;return affected;
end;$$;

create or replace function private.set_billing_item_price(p_organization_id uuid,p_item_id uuid,p_unit_price_cents bigint)
returns void language plpgsql security definer set search_path=pg_catalog,public,private as $$
declare current_status text;begin
  if not private.has_org_role(p_organization_id,array['admin','supervisor']::text[]) then raise exception 'Ei oikeutta.' using errcode='42501'; end if;
  if p_unit_price_cents<0 then raise exception 'Hinta ei voi olla negatiivinen.' using errcode='23514'; end if;
  select status into current_status from public.billing_items where id=p_item_id and organization_id=p_organization_id for update;
  if current_status is null then raise exception 'Laskutusriviä ei löytynyt.' using errcode='P0002'; end if;
  if current_status in('queued','invoiced','credited') then raise exception 'Laskutusrivi on lukittu.' using errcode='55000'; end if;
  update public.billing_items set unit_price_cents=p_unit_price_cents,total_ex_vat_cents=round(quantity*p_unit_price_cents)::bigint,status='billable',updated_at=now() where id=p_item_id;
  insert into public.audit_logs(organization_id,user_id,action,table_name,record_id,metadata) values(p_organization_id,auth.uid(),'billing_price_set','billing_items',p_item_id,jsonb_build_object('unitPriceCents',p_unit_price_cents));
end;$$;

create or replace function private.transition_billing_item(p_organization_id uuid,p_item_id uuid,p_status text,p_invoice_reference text default null)
returns void language plpgsql security definer set search_path=pg_catalog,public,private as $$
declare old_status text;price bigint;begin
  if not private.has_org_role(p_organization_id,array['admin','supervisor']::text[]) then raise exception 'Ei oikeutta.' using errcode='42501'; end if;
  select status,unit_price_cents into old_status,price from public.billing_items where id=p_item_id and organization_id=p_organization_id for update;
  if old_status is null then raise exception 'Laskutusriviä ei löytynyt.' using errcode='P0002'; end if;
  if not((old_status='recorded' and p_status in('approved','rejected')) or(old_status='approved' and p_status in('billable','rejected')) or(old_status='billable' and p_status in('queued','rejected')) or(old_status='queued' and p_status in('invoiced','rejected')) or(old_status='invoiced' and p_status='credited') then raise exception 'Virheellinen tilasiirtymä.' using errcode='23514'; end if;
  if p_status in('billable','queued','invoiced') and coalesce(price,0)<=0 then raise exception 'Laskutushinta puuttuu.' using errcode='23514'; end if;
  if p_status='invoiced' and nullif(btrim(coalesce(p_invoice_reference,'')),'') is null then raise exception 'Laskuviite puuttuu.' using errcode='23514'; end if;
  update public.billing_items set status=p_status,invoice_reference=case when p_status='invoiced' then btrim(p_invoice_reference) else invoice_reference end,queued_at=case when p_status='queued' then now() else queued_at end,invoiced_at=case when p_status='invoiced' then now() else invoiced_at end,credited_at=case when p_status='credited' then now() else credited_at end,updated_at=now() where id=p_item_id;
  insert into public.audit_logs(organization_id,user_id,action,table_name,record_id,metadata) values(p_organization_id,auth.uid(),'billing_status_changed','billing_items',p_item_id,jsonb_build_object('from',old_status,'to',p_status,'invoiceReference',p_invoice_reference));
end;$$;

create or replace function private.save_vehicle_position(p_organization_id uuid,p_payload jsonb)
returns uuid language plpgsql security definer set search_path=pg_catalog,public,private as $$
declare result_id uuid;e_id uuid:=nullif(p_payload->>'equipmentId','')::uuid;p_id uuid:=nullif(p_payload->>'projectId','')::uuid;begin
  if not private.has_org_role(p_organization_id,array['admin','supervisor']::text[]) then raise exception 'Ei oikeutta.' using errcode='42501'; end if;
  if not exists(select 1 from public.equipment e where e.id=e_id and e.organization_id=p_organization_id and e.archived_at is null) then raise exception 'Ajoneuvoa ei löytynyt.' using errcode='23503'; end if;
  if p_id is not null and not exists(select 1 from public.projects p where p.id=p_id and p.organization_id=p_organization_id and p.archived_at is null) then raise exception 'Projektia ei löytynyt.' using errcode='23503'; end if;
  insert into public.vehicle_positions(organization_id,equipment_id,project_id,driver_user_id,latitude,longitude,accuracy_m,source,external_device_id,source_reference,recorded_at,created_by)
  values(p_organization_id,e_id,p_id,auth.uid(),(p_payload->>'latitude')::double precision,(p_payload->>'longitude')::double precision,nullif(p_payload->>'accuracyM','')::double precision,coalesce(nullif(p_payload->>'source',''),'manual'),nullif(btrim(p_payload->>'externalDeviceId'),''),nullif(btrim(p_payload->>'sourceReference'),''),coalesce(nullif(p_payload->>'recordedAt','')::timestamptz,now()),auth.uid()) returning id into result_id;
  insert into public.audit_logs(organization_id,user_id,action,table_name,record_id,metadata) values(p_organization_id,auth.uid(),'vehicle_position_saved','vehicle_positions',result_id,jsonb_build_object('equipmentId',e_id,'source',p_payload->>'source'));return result_id;
end;$$;

create or replace function private.construction_reporting_data(p_organization_id uuid,p_target_month date,p_project_id uuid default null)
returns jsonb language plpgsql stable security definer set search_path=pg_catalog,public,private as $$
declare month_start date:=date_trunc('month',p_target_month)::date;month_end date:=(date_trunc('month',p_target_month)+interval '1 month - 1 day')::date;tz text;begin
  if not private.has_org_role(p_organization_id,array['admin','supervisor']::text[]) then raise exception 'Ei oikeutta.' using errcode='42501'; end if;
  select coalesce(otr.timezone,'Europe/Helsinki') into tz from public.organization_time_rules otr where otr.organization_id=p_organization_id;tz:=coalesce(tz,'Europe/Helsinki');
  return jsonb_build_object('targetMonth',month_start,
    'workerRows',coalesce((select jsonb_agg(to_jsonb(x) order by x."projectName",x."workerName") from(select p.id as "projectId",p.name as "projectName",p.location as "siteLocation",w.user_id as "userId",max(w.employee_name) as "workerName",max(e.tax_number) as "taxNumber",max(coalesce(e.employment_category,'employee')) as "employmentCategory",min((w.checked_in_at at time zone tz)::date) as "firstWorkDate",max((coalesce(w.checked_out_at,w.checked_in_at) at time zone tz)::date) as "lastWorkDate",p.shared_construction_site as "sharedConstructionSite" from public.work_site_check_ins w join public.projects p on p.id=w.project_id and p.organization_id=w.organization_id left join public.employees e on e.organization_id=w.organization_id and e.user_id=w.user_id where w.organization_id=p_organization_id and(w.checked_in_at at time zone tz)::date between month_start and month_end and(p_project_id is null or p.id=p_project_id) group by p.id,p.name,p.location,w.user_id,p.shared_construction_site)x),'[]'::jsonb),
    'subcontractorWorkerRows',coalesce((select jsonb_agg(jsonb_build_object('projectId',p.id,'projectName',p.name,'siteLocation',p.location,'workerName',sw.name,'taxNumber',sw.tax_number,'employmentCategory',sw.employment_category,'employerName',s.company_name,'employerBusinessId',s.business_id,'validFrom',sw.valid_from,'validUntil',sw.valid_until,'sharedConstructionSite',p.shared_construction_site) order by p.name,s.company_name,sw.name) from public.subcontractor_project_assignments a join public.subcontractors s on s.id=a.subcontractor_id join public.projects p on p.id=a.project_id join public.subcontractor_workers sw on sw.subcontractor_id=s.id and sw.organization_id=s.organization_id where a.organization_id=p_organization_id and a.status in('planned','active','completed') and coalesce(a.starts_at,month_start)<=month_end and coalesce(a.ends_at,month_end)>=month_start and(p_project_id is null or p.id=p_project_id) and sw.status='active'),'[]'::jsonb),
    'contractRows',coalesce((select jsonb_agg(jsonb_build_object('projectId',p.id,'projectName',p.name,'siteLocation',p.location,'subcontractorName',s.company_name,'businessId',s.business_id,'contractNumber',a.contract_number,'contractValueCents',a.contract_value_cents,'billingBasis',a.billing_basis,'isConstructionService',a.is_construction_service,'startsAt',a.starts_at,'endsAt',a.ends_at,'reportingThresholdExceeded',coalesce(a.contract_value_cents,0)>1500000) order by p.name,s.company_name) from public.subcontractor_project_assignments a join public.subcontractors s on s.id=a.subcontractor_id join public.projects p on p.id=a.project_id where a.organization_id=p_organization_id and a.status in('planned','active','completed') and coalesce(a.starts_at,month_start)<=month_end and coalesce(a.ends_at,month_end)>=month_start and(p_project_id is null or p.id=p_project_id)),'[]'::jsonb)
  );
end;$$;

create or replace function private.record_construction_export(p_organization_id uuid,p_report_type text,p_target_month date,p_project_id uuid,p_row_count integer)
returns uuid language plpgsql security definer set search_path=pg_catalog,public,private as $$
declare result_id uuid;begin if not private.has_org_role(p_organization_id,array['admin','supervisor']::text[]) then raise exception 'Ei oikeutta.' using errcode='42501'; end if;insert into public.construction_reporting_exports(organization_id,report_type,target_month,project_id,row_count,generated_by) values(p_organization_id,p_report_type,date_trunc('month',p_target_month)::date,p_project_id,greatest(p_row_count,0),auth.uid()) returning id into result_id;insert into public.audit_logs(organization_id,user_id,action,table_name,record_id,metadata) values(p_organization_id,auth.uid(),'construction_report_generated','construction_reporting_exports',result_id,jsonb_build_object('reportType',p_report_type,'targetMonth',p_target_month,'rowCount',p_row_count));return result_id;end;$$;

revoke all on function private.business_operations_data(uuid) from public,anon,authenticated;
revoke all on function private.save_subcontractor(uuid,jsonb) from public,anon,authenticated;
revoke all on function private.save_subcontractor_worker(uuid,jsonb) from public,anon,authenticated;
revoke all on function private.save_subcontractor_assignment(uuid,jsonb) from public,anon,authenticated;
revoke all on function private.sync_billing_items(uuid) from public,anon,authenticated;
revoke all on function private.set_billing_item_price(uuid,uuid,bigint) from public,anon,authenticated;
revoke all on function private.transition_billing_item(uuid,uuid,text,text) from public,anon,authenticated;
revoke all on function private.save_vehicle_position(uuid,jsonb) from public,anon,authenticated;
revoke all on function private.construction_reporting_data(uuid,date,uuid) from public,anon,authenticated;
revoke all on function private.record_construction_export(uuid,text,date,uuid,integer) from public,anon,authenticated;

grant execute on function private.business_operations_data(uuid) to authenticated,service_role;
grant execute on function private.save_subcontractor(uuid,jsonb) to authenticated,service_role;
grant execute on function private.save_subcontractor_worker(uuid,jsonb) to authenticated,service_role;
grant execute on function private.save_subcontractor_assignment(uuid,jsonb) to authenticated,service_role;
grant execute on function private.sync_billing_items(uuid) to authenticated,service_role;
grant execute on function private.set_billing_item_price(uuid,uuid,bigint) to authenticated,service_role;
grant execute on function private.transition_billing_item(uuid,uuid,text,text) to authenticated,service_role;
grant execute on function private.save_vehicle_position(uuid,jsonb) to authenticated,service_role;
grant execute on function private.construction_reporting_data(uuid,date,uuid) to authenticated,service_role;
grant execute on function private.record_construction_export(uuid,text,date,uuid,integer) to authenticated,service_role;

create function public.business_operations_data(p_organization_id uuid) returns jsonb language sql stable security invoker set search_path=pg_catalog,public,private as $$select private.business_operations_data(p_organization_id)$$;
create function public.save_subcontractor(p_organization_id uuid,p_payload jsonb) returns uuid language sql security invoker set search_path=pg_catalog,public,private as $$select private.save_subcontractor(p_organization_id,p_payload)$$;
create function public.save_subcontractor_worker(p_organization_id uuid,p_payload jsonb) returns uuid language sql security invoker set search_path=pg_catalog,public,private as $$select private.save_subcontractor_worker(p_organization_id,p_payload)$$;
create function public.save_subcontractor_assignment(p_organization_id uuid,p_payload jsonb) returns uuid language sql security invoker set search_path=pg_catalog,public,private as $$select private.save_subcontractor_assignment(p_organization_id,p_payload)$$;
create function public.sync_billing_items(p_organization_id uuid) returns integer language sql security invoker set search_path=pg_catalog,public,private as $$select private.sync_billing_items(p_organization_id)$$;
create function public.set_billing_item_price(p_organization_id uuid,p_item_id uuid,p_unit_price_cents bigint) returns void language sql security invoker set search_path=pg_catalog,public,private as $$select private.set_billing_item_price(p_organization_id,p_item_id,p_unit_price_cents)$$;
create function public.transition_billing_item(p_organization_id uuid,p_item_id uuid,p_status text,p_invoice_reference text default null) returns void language sql security invoker set search_path=pg_catalog,public,private as $$select private.transition_billing_item(p_organization_id,p_item_id,p_status,p_invoice_reference)$$;
create function public.save_vehicle_position(p_organization_id uuid,p_payload jsonb) returns uuid language sql security invoker set search_path=pg_catalog,public,private as $$select private.save_vehicle_position(p_organization_id,p_payload)$$;
create function public.construction_reporting_data(p_organization_id uuid,p_target_month date,p_project_id uuid default null) returns jsonb language sql stable security invoker set search_path=pg_catalog,public,private as $$select private.construction_reporting_data(p_organization_id,p_target_month,p_project_id)$$;
create function public.record_construction_export(p_organization_id uuid,p_report_type text,p_target_month date,p_project_id uuid,p_row_count integer) returns uuid language sql security invoker set search_path=pg_catalog,public,private as $$select private.record_construction_export(p_organization_id,p_report_type,p_target_month,p_project_id,p_row_count)$$;

revoke all on function public.business_operations_data(uuid) from public,anon;
revoke all on function public.save_subcontractor(uuid,jsonb) from public,anon;
revoke all on function public.save_subcontractor_worker(uuid,jsonb) from public,anon;
revoke all on function public.save_subcontractor_assignment(uuid,jsonb) from public,anon;
revoke all on function public.sync_billing_items(uuid) from public,anon;
revoke all on function public.set_billing_item_price(uuid,uuid,bigint) from public,anon;
revoke all on function public.transition_billing_item(uuid,uuid,text,text) from public,anon;
revoke all on function public.save_vehicle_position(uuid,jsonb) from public,anon;
revoke all on function public.construction_reporting_data(uuid,date,uuid) from public,anon;
revoke all on function public.record_construction_export(uuid,text,date,uuid,integer) from public,anon;

grant execute on function public.business_operations_data(uuid) to authenticated,service_role;
grant execute on function public.save_subcontractor(uuid,jsonb) to authenticated,service_role;
grant execute on function public.save_subcontractor_worker(uuid,jsonb) to authenticated,service_role;
grant execute on function public.save_subcontractor_assignment(uuid,jsonb) to authenticated,service_role;
grant execute on function public.sync_billing_items(uuid) to authenticated,service_role;
grant execute on function public.set_billing_item_price(uuid,uuid,bigint) to authenticated,service_role;
grant execute on function public.transition_billing_item(uuid,uuid,text,text) to authenticated,service_role;
grant execute on function public.save_vehicle_position(uuid,jsonb) to authenticated,service_role;
grant execute on function public.construction_reporting_data(uuid,date,uuid) to authenticated,service_role;
grant execute on function public.record_construction_export(uuid,text,date,uuid,integer) to authenticated,service_role;

commit;