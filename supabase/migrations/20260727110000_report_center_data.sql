begin;

create index if not exists time_entries_org_date_report_idx
  on public.time_entries (organization_id, date desc, project_id, user_id);
create index if not exists work_site_check_ins_org_date_report_idx
  on public.work_site_check_ins (organization_id, checked_in_at desc, project_id, user_id);
create index if not exists travel_expenses_org_date_report_idx
  on public.travel_expenses (organization_id, date desc, project_id, user_id);

create or replace function public.report_center_data(
  p_organization_id uuid,
  p_report_type text,
  p_project_id uuid default null,
  p_date_from date default null,
  p_date_to date default null,
  p_statuses text[] default null,
  p_user_ids uuid[] default null
)
returns jsonb
language plpgsql
stable
security definer
set search_path = pg_catalog, public
as $$
declare
  result jsonb;
  row_count integer;
  safe_from date := coalesce(p_date_from, date_trunc('month', current_date)::date);
  safe_to date := coalesce(p_date_to, current_date);
begin
  if auth.uid() is null then
    raise exception 'Kirjautuminen vaaditaan.' using errcode = '42501';
  end if;
  if not private.has_org_role(p_organization_id, array['admin', 'supervisor']::text[]) then
    raise exception 'Vain työnjohto voi muodostaa organisaation raportteja.' using errcode = '42501';
  end if;
  if safe_from > safe_to then
    raise exception 'Raportin alkupäivä ei voi olla loppupäivän jälkeen.' using errcode = '23514';
  end if;
  if safe_to - safe_from > 1095 then
    raise exception 'Yksittäisen raportin aikaväli voi olla enintään kolme vuotta.' using errcode = '23514';
  end if;

  if p_report_type = 'time_entries' then
    with report_rows as (
      select jsonb_build_object(
        'date', te.date,
        'employee', te.employee,
        'project', te.project,
        'workOrder', wo.title,
        'startTime', te.start_time,
        'endTime', te.end_time,
        'breakMinutes', te.break_minutes,
        'hours', te.hours,
        'overtime', coalesce(te.overtime, 0),
        'status', te.status,
        'description', te.description,
        'source', te.source
      ) as row
      from public.time_entries te
      left join public.work_orders wo
        on wo.id = te.work_order_id
       and wo.organization_id = te.organization_id
      where te.organization_id = p_organization_id
        and te.date between safe_from and safe_to
        and (p_project_id is null or te.project_id = p_project_id)
        and (p_statuses is null or te.status = any(p_statuses))
        and (p_user_ids is null or coalesce(te.user_id, te.created_by) = any(p_user_ids))
      order by te.date desc, te.employee, te.created_at desc
    )
    select jsonb_build_object(
      'reportType', p_report_type,
      'title', 'Työaikaraportti',
      'dateFrom', safe_from,
      'dateTo', safe_to,
      'columns', jsonb_build_array(
        jsonb_build_object('key','date','label','Päivä'),
        jsonb_build_object('key','employee','label','Työntekijä'),
        jsonb_build_object('key','project','label','Projekti'),
        jsonb_build_object('key','workOrder','label','Työmääräys'),
        jsonb_build_object('key','startTime','label','Alku'),
        jsonb_build_object('key','endTime','label','Loppu'),
        jsonb_build_object('key','breakMinutes','label','Tauko min','type','number'),
        jsonb_build_object('key','hours','label','Tunnit','type','number'),
        jsonb_build_object('key','overtime','label','Ylityö','type','number'),
        jsonb_build_object('key','status','label','Tila'),
        jsonb_build_object('key','description','label','Työseloste'),
        jsonb_build_object('key','source','label','Lähde')
      ),
      'rows', coalesce(jsonb_agg(row), '[]'::jsonb),
      'summary', jsonb_build_object(
        'rowCount', count(*),
        'hours', coalesce(sum((row->>'hours')::numeric), 0),
        'overtime', coalesce(sum((row->>'overtime')::numeric), 0)
      )
    ) into result from report_rows;

  elsif p_report_type = 'work_descriptions' then
    with report_rows as (
      select jsonb_build_object(
        'date', te.date,
        'employee', te.employee,
        'project', te.project,
        'workOrder', wo.title,
        'hours', te.hours + coalesce(te.overtime, 0),
        'status', te.status,
        'description', te.description,
        'createdAt', te.created_at
      ) as row
      from public.time_entries te
      left join public.work_orders wo
        on wo.id = te.work_order_id
       and wo.organization_id = te.organization_id
      where te.organization_id = p_organization_id
        and te.date between safe_from and safe_to
        and (p_project_id is null or te.project_id = p_project_id)
        and (p_statuses is null or te.status = any(p_statuses))
        and (p_user_ids is null or coalesce(te.user_id, te.created_by) = any(p_user_ids))
      order by te.date desc, te.employee, te.created_at desc
    )
    select jsonb_build_object(
      'reportType', p_report_type,
      'title', 'Työselosteraportti',
      'dateFrom', safe_from,
      'dateTo', safe_to,
      'columns', jsonb_build_array(
        jsonb_build_object('key','date','label','Päivä'),
        jsonb_build_object('key','employee','label','Työntekijä'),
        jsonb_build_object('key','project','label','Projekti'),
        jsonb_build_object('key','workOrder','label','Työmääräys'),
        jsonb_build_object('key','hours','label','Tunnit','type','number'),
        jsonb_build_object('key','status','label','Tila'),
        jsonb_build_object('key','description','label','Työseloste'),
        jsonb_build_object('key','createdAt','label','Kirjattu')
      ),
      'rows', coalesce(jsonb_agg(row), '[]'::jsonb),
      'summary', jsonb_build_object(
        'rowCount', count(*),
        'missingDescriptions', count(*) filter (where nullif(btrim(row->>'description'), '') is null),
        'hours', coalesce(sum((row->>'hours')::numeric), 0)
      )
    ) into result from report_rows;

  elsif p_report_type = 'site_presence' then
    with report_rows as (
      select jsonb_build_object(
        'employee', w.employee_name,
        'project', w.project_name,
        'checkedInAt', w.checked_in_at,
        'checkedOutAt', w.checked_out_at,
        'durationHours', round((extract(epoch from (coalesce(w.checked_out_at, statement_timestamp()) - w.checked_in_at)) / 3600)::numeric, 2),
        'description', w.description,
        'accuracyM', w.accuracy_m,
        'distanceFromSiteM', w.distance_from_site_m,
        'withinGeofence', w.within_geofence,
        'timeEntryId', w.time_entry_id
      ) as row
      from public.work_site_check_ins w
      where w.organization_id = p_organization_id
        and (w.checked_in_at at time zone 'Europe/Helsinki')::date between safe_from and safe_to
        and (p_project_id is null or w.project_id = p_project_id)
        and (p_user_ids is null or w.user_id = any(p_user_ids))
      order by w.checked_in_at desc
    )
    select jsonb_build_object(
      'reportType', p_report_type,
      'title', 'Työmaiden läsnäoloraportti',
      'dateFrom', safe_from,
      'dateTo', safe_to,
      'columns', jsonb_build_array(
        jsonb_build_object('key','employee','label','Henkilö'),
        jsonb_build_object('key','project','label','Työmaa'),
        jsonb_build_object('key','checkedInAt','label','Sisään'),
        jsonb_build_object('key','checkedOutAt','label','Ulos'),
        jsonb_build_object('key','durationHours','label','Kesto h','type','number'),
        jsonb_build_object('key','description','label','Työn kuvaus'),
        jsonb_build_object('key','accuracyM','label','Tarkkuus m','type','number'),
        jsonb_build_object('key','distanceFromSiteM','label','Etäisyys m','type','number'),
        jsonb_build_object('key','withinGeofence','label','Työmaa-alueella','type','boolean')
      ),
      'rows', coalesce(jsonb_agg(row), '[]'::jsonb),
      'summary', jsonb_build_object(
        'rowCount', count(*),
        'openCheckIns', count(*) filter (where row->>'checkedOutAt' is null),
        'durationHours', coalesce(sum((row->>'durationHours')::numeric), 0)
      )
    ) into result from report_rows;

  elsif p_report_type = 'travel_expenses' then
    with report_rows as (
      select jsonb_build_object(
        'date', t.date,
        'employee', t.employee,
        'project', p.name,
        'type', t.type,
        'description', t.description,
        'amountEur', t.amount,
        'status', t.status,
        'approvedAt', t.approved_at,
        'hasAttachment', t.attachment_path is not null
      ) as row
      from public.travel_expenses t
      left join public.projects p
        on p.id = t.project_id
       and p.organization_id = t.organization_id
      where t.organization_id = p_organization_id
        and t.date between safe_from and safe_to
        and (p_project_id is null or t.project_id = p_project_id)
        and (p_statuses is null or t.status = any(p_statuses))
        and (p_user_ids is null or coalesce(t.user_id, t.created_by) = any(p_user_ids))
      order by t.date desc, t.created_at desc
    )
    select jsonb_build_object(
      'reportType', p_report_type,
      'title', 'Matka- ja kuluraportti',
      'dateFrom', safe_from,
      'dateTo', safe_to,
      'columns', jsonb_build_array(
        jsonb_build_object('key','date','label','Päivä'),
        jsonb_build_object('key','employee','label','Työntekijä'),
        jsonb_build_object('key','project','label','Projekti'),
        jsonb_build_object('key','type','label','Kululaji'),
        jsonb_build_object('key','description','label','Kuvaus'),
        jsonb_build_object('key','amountEur','label','Summa EUR','type','money'),
        jsonb_build_object('key','status','label','Tila'),
        jsonb_build_object('key','approvedAt','label','Hyväksytty'),
        jsonb_build_object('key','hasAttachment','label','Liite','type','boolean')
      ),
      'rows', coalesce(jsonb_agg(row), '[]'::jsonb),
      'summary', jsonb_build_object(
        'rowCount', count(*),
        'amountEur', coalesce(sum((row->>'amountEur')::numeric), 0),
        'approvedAmountEur', coalesce(sum((row->>'amountEur')::numeric) filter (where row->>'status' = 'Hyväksytty'), 0)
      )
    ) into result from report_rows;

  elsif p_report_type = 'projects' then
    with project_rows as (
      select jsonb_build_object(
        'projectNumber', p.project_number,
        'name', p.name,
        'customer', p.customer,
        'location', p.location,
        'status', p.status,
        'startDate', p.start_date,
        'endDate', p.end_date,
        'progressPercent', coalesce(p.progress, 0),
        'budgetEur', coalesce(p.budget, 0),
        'spentEur', coalesce(p.spent, 0),
        'approvedHours', coalesce(hours.approved_hours, 0),
        'pendingHours', coalesce(hours.pending_hours, 0),
        'openWorkOrders', coalesce(orders.open_orders, 0)
      ) as row
      from public.projects p
      left join lateral (
        select
          sum(te.hours + coalesce(te.overtime, 0)) filter (where te.status = 'Hyväksytty') as approved_hours,
          sum(te.hours + coalesce(te.overtime, 0)) filter (where te.status = 'Odottaa') as pending_hours
        from public.time_entries te
        where te.organization_id = p.organization_id
          and te.project_id = p.id
          and te.date between safe_from and safe_to
      ) hours on true
      left join lateral (
        select count(*) filter (where wo.status not in ('Valmis', 'Peruttu'))::integer as open_orders
        from public.work_orders wo
        where wo.organization_id = p.organization_id
          and wo.project_id = p.id
      ) orders on true
      where p.organization_id = p_organization_id
        and p.archived_at is null
        and (p_project_id is null or p.id = p_project_id)
        and (p_statuses is null or p.status = any(p_statuses))
      order by p.status, p.name
    )
    select jsonb_build_object(
      'reportType', p_report_type,
      'title', 'Projektikooste',
      'dateFrom', safe_from,
      'dateTo', safe_to,
      'columns', jsonb_build_array(
        jsonb_build_object('key','projectNumber','label','Projektinumero'),
        jsonb_build_object('key','name','label','Projekti'),
        jsonb_build_object('key','customer','label','Tilaaja'),
        jsonb_build_object('key','location','label','Sijainti'),
        jsonb_build_object('key','status','label','Tila'),
        jsonb_build_object('key','startDate','label','Aloitus'),
        jsonb_build_object('key','endDate','label','Tavoite'),
        jsonb_build_object('key','progressPercent','label','Valmius %','type','number'),
        jsonb_build_object('key','budgetEur','label','Budjetti EUR','type','money'),
        jsonb_build_object('key','spentEur','label','Toteuma EUR','type','money'),
        jsonb_build_object('key','approvedHours','label','Hyväksytyt h','type','number'),
        jsonb_build_object('key','pendingHours','label','Odottavat h','type','number'),
        jsonb_build_object('key','openWorkOrders','label','Avoimet työt','type','number')
      ),
      'rows', coalesce(jsonb_agg(row), '[]'::jsonb),
      'summary', jsonb_build_object(
        'rowCount', count(*),
        'budgetEur', coalesce(sum((row->>'budgetEur')::numeric), 0),
        'spentEur', coalesce(sum((row->>'spentEur')::numeric), 0),
        'approvedHours', coalesce(sum((row->>'approvedHours')::numeric), 0)
      )
    ) into result from project_rows;

  elsif p_report_type = 'equipment' then
    with report_rows as (
      select jsonb_build_object(
        'assetNumber', e.asset_number,
        'name', e.name,
        'type', e.type,
        'model', e.model,
        'serial', e.serial,
        'status', e.status,
        'location', e.location,
        'project', p.name,
        'responsible', coalesce(nullif(pr.full_name, ''), pr.email),
        'lastMaintenance', e.last_maintenance,
        'nextMaintenance', e.next_maintenance,
        'hourlyCostEur', round(coalesce(e.hourly_cost_cents, 0)::numeric / 100, 2)
      ) as row
      from public.equipment e
      left join public.projects p
        on p.id = e.current_project_id
       and p.organization_id = e.organization_id
      left join public.profiles pr on pr.id = e.responsible_user_id
      where e.organization_id = p_organization_id
        and e.archived_at is null
        and (p_project_id is null or e.current_project_id = p_project_id)
        and (p_statuses is null or e.status = any(p_statuses))
      order by e.type, e.name
    )
    select jsonb_build_object(
      'reportType', p_report_type,
      'title', 'Kalusto- ja huoltoraportti',
      'dateFrom', safe_from,
      'dateTo', safe_to,
      'columns', jsonb_build_array(
        jsonb_build_object('key','assetNumber','label','Kalustonumero'),
        jsonb_build_object('key','name','label','Nimi'),
        jsonb_build_object('key','type','label','Tyyppi'),
        jsonb_build_object('key','model','label','Malli'),
        jsonb_build_object('key','serial','label','Sarjanumero'),
        jsonb_build_object('key','status','label','Tila'),
        jsonb_build_object('key','location','label','Sijainti'),
        jsonb_build_object('key','project','label','Projekti'),
        jsonb_build_object('key','responsible','label','Vastuuhenkilö'),
        jsonb_build_object('key','lastMaintenance','label','Edellinen huolto'),
        jsonb_build_object('key','nextMaintenance','label','Seuraava huolto'),
        jsonb_build_object('key','hourlyCostEur','label','Tuntikustannus EUR','type','money')
      ),
      'rows', coalesce(jsonb_agg(row), '[]'::jsonb),
      'summary', jsonb_build_object(
        'rowCount', count(*),
        'maintenanceDue', count(*) filter (
          where nullif(row->>'nextMaintenance','') is not null
            and (row->>'nextMaintenance')::date <= current_date + 30
        )
      )
    ) into result from report_rows;

  else
    raise exception 'Tuntematon raporttityyppi.' using errcode = '22023';
  end if;

  row_count := coalesce(jsonb_array_length(result->'rows'), 0);
  if row_count > 10000 then
    raise exception 'Raportissa on yli 10 000 riviä. Rajaa aikaväliä tai projektia.' using errcode = '54000';
  end if;

  return result || jsonb_build_object(
    'generatedAt', statement_timestamp(),
    'organizationId', p_organization_id,
    'projectId', p_project_id
  );
end;
$$;

revoke all on function public.report_center_data(uuid, text, uuid, date, date, text[], uuid[]) from public, anon;
grant execute on function public.report_center_data(uuid, text, uuid, date, date, text[], uuid[]) to authenticated;

commit;
