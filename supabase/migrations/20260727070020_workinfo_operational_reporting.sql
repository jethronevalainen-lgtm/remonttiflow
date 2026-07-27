create or replace function public.list_workinfo_operational_dashboard(p_organization_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  tz text;
  local_today date;
  local_month_start date;
  result jsonb;
begin
  if not public.workinfo_is_management_member(p_organization_id) then
    raise exception 'Not authorized';
  end if;

  select coalesce(otr.timezone, 'Europe/Helsinki') into tz
  from public.organization_time_rules otr
  where otr.organization_id = p_organization_id;
  tz := coalesce(tz, 'Europe/Helsinki');
  local_today := (now() at time zone tz)::date;
  local_month_start := date_trunc('month', now() at time zone tz)::date;

  select jsonb_build_object(
    'summary', jsonb_build_object(
      'activeWorkers', (select count(*) from public.work_site_check_ins w where w.organization_id = p_organization_id and w.checked_out_at is null),
      'todayHours', coalesce((select sum(coalesce(te.hours, 0) + coalesce(te.overtime, 0)) from public.time_entries te where te.organization_id = p_organization_id and te.date = local_today and te.status <> 'Hylätty'), 0),
      'monthHours', coalesce((select sum(coalesce(te.hours, 0) + coalesce(te.overtime, 0)) from public.time_entries te where te.organization_id = p_organization_id and te.date >= local_month_start and te.date <= local_today and te.status <> 'Hylätty'), 0),
      'pendingHours', coalesce((select sum(coalesce(te.hours, 0) + coalesce(te.overtime, 0)) from public.time_entries te where te.organization_id = p_organization_id and te.status = 'Odottaa'), 0),
      'billableCents', coalesce((select sum(coalesce(b.total_ex_vat_cents, 0)) from public.billing_items b where b.organization_id = p_organization_id and b.status in ('billable', 'queued', 'invoiced')), 0),
      'unqueuedCents', coalesce((select sum(coalesce(b.total_ex_vat_cents, 0)) from public.billing_items b where b.organization_id = p_organization_id and b.status = 'billable'), 0)
    ),
    'activePresence', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', w.id,
        'userId', w.user_id,
        'employeeName', w.employee_name,
        'projectId', w.project_id,
        'projectName', w.project_name,
        'workOrderId', w.work_order_id,
        'workOrderTitle', wo.title,
        'description', w.description,
        'checkedInAt', w.checked_in_at,
        'accuracyM', w.accuracy_m,
        'distanceFromSiteM', w.distance_from_site_m,
        'withinGeofence', w.within_geofence,
        'durationMinutes', floor(extract(epoch from (now() - w.checked_in_at)) / 60)::int
      ) order by w.checked_in_at)
      from public.work_site_check_ins w
      left join public.work_orders wo on wo.id = w.work_order_id
      where w.organization_id = p_organization_id and w.checked_out_at is null
    ), '[]'::jsonb),
    'exceptions', coalesce((
      select jsonb_agg(
        to_jsonb(x)
        order by case x.severity when 'critical' then 0 when 'warning' then 1 else 2 end, x.checked_in_at
      )
      from (
        select w.id,
          w.employee_name as "employeeName",
          w.project_name as "projectName",
          w.checked_in_at as "checkedInAt",
          case
            when w.checked_in_at < now() - interval '16 hours' then 'critical'
            when w.within_geofence is false then 'critical'
            when w.accuracy_m > 100 then 'warning'
            when nullif(trim(w.description), '') is null or w.work_order_id is null then 'warning'
            else 'info'
          end as severity,
          array_remove(array[
            case when w.checked_in_at < now() - interval '16 hours' then 'Työaika on ollut avoinna yli 16 tuntia' end,
            case when (w.checked_in_at at time zone tz)::date < local_today then 'Työaika on jäänyt auki edelliseltä päivältä' end,
            case when nullif(trim(w.description), '') is null then 'Työn kuvaus puuttuu' end,
            case when w.work_order_id is null then 'Työmääräystä ei ole valittu' end,
            case when w.accuracy_m > 100 then 'Sijainnin tarkkuus on heikko' end,
            case when w.within_geofence is false then 'Kirjautuminen on työmaa-alueen ulkopuolella' end,
            case when w.project_id is null then 'Projektikytkentä puuttuu' end
          ], null) as reasons
        from public.work_site_check_ins w
        where w.organization_id = p_organization_id
          and w.checked_out_at is null
          and (
            w.checked_in_at < now() - interval '12 hours'
            or (w.checked_in_at at time zone tz)::date < local_today
            or nullif(trim(w.description), '') is null
            or w.work_order_id is null
            or w.accuracy_m > 100
            or w.within_geofence is false
            or w.project_id is null
          )
      ) x
    ), '[]'::jsonb),
    'latestDescriptions', coalesce((
      select jsonb_agg(to_jsonb(d) order by d.date desc, d."createdAt" desc)
      from (
        select te.id,
          te.date,
          te.employee as "employeeName",
          te.project as "projectName",
          te.project_id as "projectId",
          te.work_order_id as "workOrderId",
          wo.title as "workOrderTitle",
          te.description,
          (coalesce(te.hours, 0) + coalesce(te.overtime, 0))::numeric as hours,
          te.status,
          te.created_at as "createdAt",
          array_remove(array[
            case when nullif(trim(te.description), '') is null then 'Työseloste puuttuu' end,
            case when length(trim(coalesce(te.description, ''))) between 1 and 14 then 'Työseloste on hyvin lyhyt' end,
            case when lower(trim(coalesce(te.description, ''))) in ('maalausta', 'remonttia', 'töitä', 'työtä', 'valmis') then 'Työseloste ei kuvaa tehtyä työtä riittävästi' end,
            case when te.work_order_id is null then 'Työmääräystä ei ole valittu' end,
            case when te.status = 'Odottaa' then 'Odottaa hyväksyntää' end
          ], null) as "qualityFlags"
        from public.time_entries te
        left join public.work_orders wo on wo.id = te.work_order_id
        where te.organization_id = p_organization_id
        order by te.date desc, te.created_at desc
        limit 12
      ) d
    ), '[]'::jsonb)
  ) into result;

  return result;
end;
$$;

create or replace function public.list_workinfo_construction_reporting(
  p_organization_id uuid,
  p_target_month date,
  p_project_id uuid default null
)
returns jsonb
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  month_start date := date_trunc('month', p_target_month)::date;
  month_end date := (date_trunc('month', p_target_month) + interval '1 month - 1 day')::date;
  tz text;
begin
  if not public.workinfo_is_management_member(p_organization_id) then
    raise exception 'Not authorized';
  end if;

  select coalesce(otr.timezone, 'Europe/Helsinki') into tz
  from public.organization_time_rules otr
  where otr.organization_id = p_organization_id;
  tz := coalesce(tz, 'Europe/Helsinki');

  return jsonb_build_object(
    'targetMonth', month_start,
    'workerRows', coalesce((
      select jsonb_agg(to_jsonb(x) order by x."projectName", x."workerName")
      from (
        select distinct
          p.id as "projectId",
          p.name as "projectName",
          p.location as "siteLocation",
          w.user_id as "userId",
          w.employee_name as "workerName",
          e.tax_number as "taxNumber",
          coalesce(e.employment_category, 'employee') as "employmentCategory",
          'Oma organisaatio'::text as "employerName",
          min((w.checked_in_at at time zone tz)::date) over (partition by p.id, w.user_id) as "firstWorkDate",
          max((coalesce(w.checked_out_at, w.checked_in_at) at time zone tz)::date) over (partition by p.id, w.user_id) as "lastWorkDate"
        from public.work_site_check_ins w
        join public.projects p on p.id = w.project_id and p.organization_id = w.organization_id
        left join public.employees e on e.organization_id = w.organization_id and e.user_id = w.user_id
        where w.organization_id = p_organization_id
          and (w.checked_in_at at time zone tz)::date between month_start and month_end
          and (p_project_id is null or p.id = p_project_id)
      ) x
    ), '[]'::jsonb),
    'subcontractorWorkerRows', coalesce((
      select jsonb_agg(jsonb_build_object(
        'projectId', p.id,
        'projectName', p.name,
        'siteLocation', p.location,
        'workerName', sw.name,
        'taxNumber', sw.tax_number,
        'employmentCategory', sw.employment_category,
        'employerName', s.company_name,
        'employerBusinessId', s.business_id,
        'validFrom', sw.valid_from,
        'validUntil', sw.valid_until
      ) order by p.name, s.company_name, sw.name)
      from public.subcontractor_project_assignments a
      join public.subcontractors s on s.id = a.subcontractor_id
      join public.projects p on p.id = a.project_id
      join public.subcontractor_workers sw on sw.subcontractor_id = s.id and sw.organization_id = s.organization_id
      where a.organization_id = p_organization_id
        and a.status in ('planned', 'active', 'completed')
        and coalesce(a.starts_at, month_start) <= month_end
        and coalesce(a.ends_at, month_end) >= month_start
        and (p_project_id is null or p.id = p_project_id)
        and sw.status = 'active'
    ), '[]'::jsonb),
    'contractRows', coalesce((
      select jsonb_agg(jsonb_build_object(
        'projectId', p.id,
        'projectName', p.name,
        'siteLocation', p.location,
        'subcontractorName', s.company_name,
        'businessId', s.business_id,
        'contractNumber', a.contract_number,
        'contractValueCents', a.contract_value_cents,
        'billingBasis', a.billing_basis,
        'isConstructionService', a.is_construction_service,
        'startsAt', a.starts_at,
        'endsAt', a.ends_at,
        'reportingThresholdExceeded', coalesce(a.contract_value_cents, 0) > 1500000
      ) order by p.name, s.company_name)
      from public.subcontractor_project_assignments a
      join public.subcontractors s on s.id = a.subcontractor_id
      join public.projects p on p.id = a.project_id
      where a.organization_id = p_organization_id
        and a.status in ('planned', 'active', 'completed')
        and coalesce(a.starts_at, month_start) <= month_end
        and coalesce(a.ends_at, month_end) >= month_start
        and (p_project_id is null or p.id = p_project_id)
    ), '[]'::jsonb)
  );
end;
$$;

revoke all on function public.list_workinfo_operational_dashboard(uuid) from public, anon;
revoke all on function public.list_workinfo_construction_reporting(uuid, date, uuid) from public, anon;
grant execute on function public.list_workinfo_operational_dashboard(uuid) to authenticated;
grant execute on function public.list_workinfo_construction_reporting(uuid, date, uuid) to authenticated;
