begin;

create or replace function private.list_construction_reporting_impl(
  p_organization_id uuid,
  p_target_month date,
  p_project_id uuid default null
)
returns jsonb
language plpgsql
stable
security definer
set search_path = pg_catalog, public
as $$
declare
  month_start date;
  month_end date;
  threshold_cents bigint := 1500000;
  worker_rows jsonb := '[]'::jsonb;
  subcontractor_worker_rows jsonb := '[]'::jsonb;
  contract_rows jsonb := '[]'::jsonb;
begin
  perform private.require_commercial_management(p_organization_id);
  month_start := date_trunc('month',p_target_month)::date;
  month_end := (month_start + interval '1 month - 1 day')::date;

  select coalesce(jsonb_agg(jsonb_build_object(
    'projectId',grouped.project_id,
    'projectName',grouped.project_name,
    'siteLocation',grouped.site_location,
    'userId',grouped.user_id,
    'workerName',grouped.worker_name,
    'taxNumber',grouped.tax_number,
    'employmentCategory',grouped.employment_category,
    'employerName',grouped.employer_name,
    'employerBusinessId',grouped.employer_business_id,
    'firstWorkDate',grouped.first_work_date,
    'lastWorkDate',grouped.last_work_date,
    'workDays',grouped.work_days,
    'workHours',grouped.work_hours
  ) order by grouped.project_name,grouped.worker_name),'[]'::jsonb)
  into worker_rows
  from (
    select
      p.id as project_id,
      p.name as project_name,
      p.location as site_location,
      e.user_id,
      e.name as worker_name,
      e.tax_number,
      e.employment_category,
      o.name as employer_name,
      o.business_id as employer_business_id,
      min(te.date) as first_work_date,
      max(te.date) as last_work_date,
      count(distinct te.date) as work_days,
      round(sum(coalesce(te.hours,0)+coalesce(te.overtime,0)),2) as work_hours
    from public.time_entries te
    join public.projects p on p.id=te.project_id and p.organization_id=te.organization_id
    join public.employees e on e.id=te.employee_id and e.organization_id=te.organization_id
    join public.organizations o on o.id=te.organization_id
    where te.organization_id=p_organization_id
      and te.date between month_start and month_end
      and te.status='Hyväksytty'
      and (p_project_id is null or p.id=p_project_id)
    group by p.id,p.name,p.location,e.id,e.user_id,e.name,e.tax_number,e.employment_category,o.name,o.business_id
  ) grouped;

  select coalesce(jsonb_agg(jsonb_build_object(
    'projectId',rows.project_id,
    'projectName',rows.project_name,
    'siteLocation',rows.site_location,
    'workerName',rows.worker_name,
    'taxNumber',rows.tax_number,
    'employmentCategory',rows.employment_category,
    'employerName',rows.employer_name,
    'employerBusinessId',rows.employer_business_id,
    'validFrom',rows.valid_from,
    'validUntil',rows.valid_until
  ) order by rows.project_name,rows.employer_name,rows.worker_name),'[]'::jsonb)
  into subcontractor_worker_rows
  from (
    select
      p.id as project_id,
      p.name as project_name,
      p.location as site_location,
      sw.name as worker_name,
      sw.tax_number,
      sw.employment_category,
      s.company_name as employer_name,
      s.business_id as employer_business_id,
      sw.valid_from,
      sw.valid_until
    from public.subcontractor_project_assignments a
    join public.subcontractors s on s.id=a.subcontractor_id and s.organization_id=a.organization_id
    join public.subcontractor_workers sw on sw.subcontractor_id=s.id and sw.organization_id=s.organization_id
    join public.projects p on p.id=a.project_id and p.organization_id=a.organization_id
    where a.organization_id=p_organization_id
      and a.status in ('planned','active')
      and (a.starts_at is null or a.starts_at<=month_end)
      and (a.ends_at is null or a.ends_at>=month_start)
      and (sw.valid_from is null or sw.valid_from<=month_end)
      and (sw.valid_until is null or sw.valid_until>=month_start)
      and (p_project_id is null or p.id=p_project_id)
  ) rows;

  select coalesce(jsonb_agg(jsonb_build_object(
    'projectId',rows.project_id,
    'projectName',rows.project_name,
    'siteLocation',rows.site_location,
    'subcontractorName',rows.subcontractor_name,
    'businessId',rows.business_id,
    'contractNumber',rows.contract_number,
    'contractValueCents',rows.contract_value_cents,
    'billingBasis',rows.billing_basis,
    'isConstructionService',rows.is_construction_service,
    'startsAt',rows.starts_at,
    'endsAt',rows.ends_at,
    'reportingThresholdExceeded',coalesce(rows.contract_value_cents,0)>threshold_cents
  ) order by rows.project_name,rows.subcontractor_name),'[]'::jsonb)
  into contract_rows
  from (
    select
      p.id as project_id,
      p.name as project_name,
      p.location as site_location,
      s.company_name as subcontractor_name,
      s.business_id,
      a.contract_number,
      a.contract_value_cents,
      a.billing_basis,
      a.is_construction_service,
      a.starts_at,
      a.ends_at
    from public.subcontractor_project_assignments a
    join public.subcontractors s on s.id=a.subcontractor_id and s.organization_id=a.organization_id
    join public.projects p on p.id=a.project_id and p.organization_id=a.organization_id
    where a.organization_id=p_organization_id
      and a.is_construction_service=true
      and a.status in ('planned','active','completed')
      and (a.starts_at is null or a.starts_at<=month_end)
      and (a.ends_at is null or a.ends_at>=month_start)
      and (p_project_id is null or p.id=p_project_id)
  ) rows;

  return jsonb_build_object(
    'targetMonth',month_start,
    'thresholdCents',threshold_cents,
    'workerRows',worker_rows,
    'subcontractorWorkerRows',subcontractor_worker_rows,
    'contractRows',contract_rows
  );
end;
$$;

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
declare
  item public.billing_items;
  previous_status text;
  allowed boolean := false;
begin
  select * into item from public.billing_items where id=p_item_id for update;
  if item.id is null then
    raise exception 'Laskutusriviä ei löytynyt.' using errcode='P0002';
  end if;
  perform private.require_commercial_management(item.organization_id);
  previous_status := item.status;
  allowed := (previous_status='recorded' and p_status in ('approved','rejected'))
    or (previous_status='approved' and p_status in ('billable','rejected'))
    or (previous_status='billable' and p_status in ('queued','rejected'))
    or (previous_status='queued' and p_status in ('invoiced','rejected'))
    or (previous_status='invoiced' and p_status='credited');
  if not allowed then
    raise exception 'Laskutusrivin tilasiirtymä % → % ei ole sallittu.',previous_status,p_status using errcode='23514';
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
    update public.time_entries set
      billing_status=p_status,
      invoice_reference=case when p_status='invoiced' then item.invoice_reference else invoice_reference end,
      billed_at=case when p_status='invoiced' then now() else billed_at end
    where id=item.source_id and organization_id=item.organization_id;
  end if;

  insert into public.audit_logs(organization_id,user_id,action,table_name,record_id,metadata)
  values(item.organization_id,auth.uid(),'billing_item_transitioned','billing_items',item.id,
    jsonb_build_object('from_status',previous_status,'to_status',p_status,'has_invoice_reference',p_invoice_reference is not null));
  return item;
end;
$$;

commit;
