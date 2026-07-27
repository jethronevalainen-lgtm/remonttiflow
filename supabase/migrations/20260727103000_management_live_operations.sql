begin;

create index if not exists work_site_check_ins_active_org_idx
  on public.work_site_check_ins (organization_id, checked_in_at desc)
  where checked_out_at is null;

create index if not exists time_entries_org_created_idx
  on public.time_entries (organization_id, created_at desc);

create or replace function public.management_live_operations(p_organization_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = pg_catalog, public
as $$
declare
  result jsonb;
begin
  if auth.uid() is null then
    raise exception 'Kirjautuminen vaaditaan.' using errcode = '42501';
  end if;

  if not private.has_org_role(p_organization_id, array['admin', 'supervisor']::text[]) then
    raise exception 'Vain työnjohto voi tarkastella reaaliaikaista työmaatilannetta.' using errcode = '42501';
  end if;

  with active_base as (
    select
      w.id,
      w.user_id,
      w.project_id,
      w.project_name,
      coalesce(nullif(btrim(pf.full_name), ''), nullif(btrim(pf.email), ''), w.employee_name) as employee_name,
      pf.avatar_url,
      nullif(btrim(w.description), '') as description,
      w.checked_in_at,
      greatest(0, floor(extract(epoch from (statement_timestamp() - w.checked_in_at)) / 60))::integer as duration_minutes,
      w.accuracy_m,
      w.distance_from_site_m,
      w.geofence_radius_m,
      w.within_geofence,
      pr.location as project_location,
      active_order.id as work_order_id,
      active_order.title as work_order_title,
      exists (
        select 1
        from public.project_members pm
        where pm.organization_id = w.organization_id
          and pm.project_id = w.project_id
          and pm.user_id = w.user_id
      ) as is_project_member
    from public.work_site_check_ins w
    left join public.profiles pf on pf.id = w.user_id
    left join public.projects pr
      on pr.id = w.project_id
     and pr.organization_id = w.organization_id
    left join lateral (
      select wo.id, wo.title
      from public.work_orders wo
      where wo.organization_id = w.organization_id
        and wo.project_id = w.project_id
        and wo.status in ('Avoin', 'Odottaa', 'Käynnissä')
        and (
          wo.assignment_scope = 'project_team'
          or exists (
            select 1
            from public.work_order_assignees wa
            where wa.organization_id = wo.organization_id
              and wa.work_order_id = wo.id
              and wa.user_id = w.user_id
          )
        )
      order by
        case wo.status when 'Käynnissä' then 0 when 'Avoin' then 1 else 2 end,
        wo.due_date nulls last,
        wo.created_at
      limit 1
    ) active_order on true
    where w.organization_id = p_organization_id
      and w.checked_out_at is null
  ), active_rows as (
    select
      active_base.*,
      array_remove(array[
        case when active_base.description is null or char_length(active_base.description) < 10 then 'missing_description' end,
        case when active_base.duration_minutes >= 720 then 'open_over_12h' end,
        case when (active_base.checked_in_at at time zone 'Europe/Helsinki')::date < (statement_timestamp() at time zone 'Europe/Helsinki')::date then 'previous_day' end,
        case when active_base.accuracy_m > 100 then 'weak_accuracy' end,
        case when active_base.within_geofence is false then 'outside_geofence' end,
        case when active_base.work_order_id is null then 'no_active_work_order' end,
        case when active_base.project_id is not null and not active_base.is_project_member then 'not_project_member' end
      ]::text[], null) as exception_codes
    from active_base
  ), site_counts as (
    select
      coalesce(project_id::text, 'unassigned') as key,
      project_id,
      project_name,
      count(*)::integer as people_count,
      min(checked_in_at) as first_checked_in_at,
      count(*) filter (where cardinality(exception_codes) > 0)::integer as exception_count
    from active_rows
    group by project_id, project_name
  ), recent_descriptions_base as (
    select
      te.id,
      te.user_id,
      te.employee_id,
      te.project_id,
      te.work_order_id,
      te.employee,
      te.project,
      te.date,
      te.hours,
      coalesce(te.overtime, 0) as overtime,
      nullif(btrim(te.description), '') as description,
      te.status,
      te.created_at,
      wo.title as work_order_title,
      wo.status as work_order_status,
      count(*) over (
        partition by coalesce(te.user_id::text, lower(btrim(te.employee))), lower(btrim(coalesce(te.description, '')))
      ) as duplicate_count
    from public.time_entries te
    left join public.work_orders wo
      on wo.id = te.work_order_id
     and wo.organization_id = te.organization_id
    where te.organization_id = p_organization_id
      and te.created_at >= statement_timestamp() - interval '30 days'
      and te.status <> 'Hylätty'
    order by te.created_at desc
    limit 50
  ), recent_descriptions as (
    select
      recent_descriptions_base.*,
      array_remove(array[
        case when recent_descriptions_base.description is null then 'missing_description' end,
        case when recent_descriptions_base.description is not null and char_length(recent_descriptions_base.description) < 12 then 'too_short' end,
        case when recent_descriptions_base.description is not null and recent_descriptions_base.duplicate_count > 1 then 'duplicate_description' end,
        case when recent_descriptions_base.work_order_id is null then 'no_work_order' end,
        case
          when recent_descriptions_base.description ~* '\\m(valmis|valmistui|työ valmis)\\M'
           and recent_descriptions_base.work_order_id is not null
           and coalesce(recent_descriptions_base.work_order_status, '') not in ('Valmis', 'Peruttu')
          then 'completed_text_open_order'
        end
      ]::text[], null) as quality_codes
    from recent_descriptions_base
  ), metrics as (
    select
      (select count(*)::integer from active_rows) as active_people,
      (select count(*)::integer from site_counts) as active_sites,
      (select coalesce(sum(te.hours + coalesce(te.overtime, 0)), 0)::numeric
         from public.time_entries te
        where te.organization_id = p_organization_id
          and te.date = (statement_timestamp() at time zone 'Europe/Helsinki')::date
          and te.status <> 'Hylätty') as today_hours,
      (select coalesce(sum(te.hours + coalesce(te.overtime, 0)), 0)::numeric
         from public.time_entries te
        where te.organization_id = p_organization_id
          and te.status = 'Odottaa') as pending_hours,
      (select count(*)::integer from active_rows where cardinality(exception_codes) > 0) as active_exceptions,
      (select count(*)::integer from recent_descriptions where cardinality(quality_codes) > 0) as description_exceptions
  )
  select jsonb_build_object(
    'generatedAt', statement_timestamp(),
    'metrics', jsonb_build_object(
      'activePeople', metrics.active_people,
      'activeSites', metrics.active_sites,
      'todayHours', metrics.today_hours,
      'pendingHours', metrics.pending_hours,
      'activeExceptions', metrics.active_exceptions,
      'descriptionExceptions', metrics.description_exceptions
    ),
    'activeCheckIns', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', a.id,
        'userId', a.user_id,
        'projectId', a.project_id,
        'projectName', a.project_name,
        'projectLocation', a.project_location,
        'employeeName', a.employee_name,
        'avatarUrl', a.avatar_url,
        'description', a.description,
        'checkedInAt', a.checked_in_at,
        'durationMinutes', a.duration_minutes,
        'accuracyM', a.accuracy_m,
        'distanceFromSiteM', a.distance_from_site_m,
        'geofenceRadiusM', a.geofence_radius_m,
        'withinGeofence', a.within_geofence,
        'workOrderId', a.work_order_id,
        'workOrderTitle', a.work_order_title,
        'exceptionCodes', to_jsonb(a.exception_codes)
      ) order by a.checked_in_at)
      from active_rows a
    ), '[]'::jsonb),
    'siteCounts', coalesce((
      select jsonb_agg(jsonb_build_object(
        'key', s.key,
        'projectId', s.project_id,
        'projectName', s.project_name,
        'peopleCount', s.people_count,
        'firstCheckedInAt', s.first_checked_in_at,
        'exceptionCount', s.exception_count
      ) order by s.people_count desc, s.project_name)
      from site_counts s
    ), '[]'::jsonb),
    'recentDescriptions', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', d.id,
        'userId', d.user_id,
        'employeeId', d.employee_id,
        'projectId', d.project_id,
        'workOrderId', d.work_order_id,
        'employeeName', d.employee,
        'projectName', d.project,
        'date', d.date,
        'hours', d.hours,
        'overtime', d.overtime,
        'description', d.description,
        'status', d.status,
        'createdAt', d.created_at,
        'workOrderTitle', d.work_order_title,
        'qualityCodes', to_jsonb(d.quality_codes)
      ) order by d.created_at desc)
      from (select * from recent_descriptions order by created_at desc limit 10) d
    ), '[]'::jsonb)
  )
  into result
  from metrics;

  return result;
end;
$$;

revoke all on function public.management_live_operations(uuid) from public, anon;
grant execute on function public.management_live_operations(uuid) to authenticated;

commit;
