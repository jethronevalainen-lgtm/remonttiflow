begin;

alter table public.work_order_time_sessions
  add column if not exists work_site_check_in_id uuid references public.work_site_check_ins(id) on delete set null,
  add column if not exists note text;

create index if not exists work_order_time_sessions_check_in_idx
  on public.work_order_time_sessions(work_site_check_in_id)
  where work_site_check_in_id is not null;

create table if not exists public.time_entry_correction_requests (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  time_entry_id uuid not null references public.time_entries(id) on delete cascade,
  target_user_id uuid references auth.users(id) on delete set null,
  requested_by uuid not null references auth.users(id) on delete restrict,
  reason text not null,
  status text not null default 'Avoin',
  resolution_note text,
  resolved_by uuid references auth.users(id) on delete set null,
  resolved_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint time_entry_correction_reason_check check (char_length(btrim(reason)) between 3 and 2000),
  constraint time_entry_correction_status_check check (status in ('Avoin', 'Hyväksytty', 'Hylätty'))
);

create index if not exists time_entry_correction_requests_org_created_idx
  on public.time_entry_correction_requests(organization_id, created_at desc);
create index if not exists time_entry_correction_requests_target_idx
  on public.time_entry_correction_requests(organization_id, target_user_id, status);
create unique index if not exists time_entry_correction_requests_one_open_idx
  on public.time_entry_correction_requests(time_entry_id)
  where status = 'Avoin';

alter table public.time_entry_correction_requests enable row level security;
revoke all on public.time_entry_correction_requests from public, anon, authenticated;
grant all on public.time_entry_correction_requests to service_role;

create or replace function private.time_workspace_role(
  p_organization_id uuid,
  p_user_id uuid
)
returns text
language sql
stable
security definer
set search_path = pg_catalog, public
as $$
  select om.role
  from public.organization_members om
  where om.organization_id = p_organization_id
    and om.user_id = p_user_id
  limit 1;
$$;

revoke all on function private.time_workspace_role(uuid, uuid) from public, anon, authenticated;
grant execute on function private.time_workspace_role(uuid, uuid) to service_role;

create or replace function public.time_workspace_dashboard_v2(
  p_organization_id uuid,
  p_from date default (current_date - 30),
  p_to date default current_date
)
returns jsonb
language plpgsql
stable
security definer
set search_path = pg_catalog, public, private
as $$
declare
  v_user_id uuid := auth.uid();
  v_role text;
  v_is_management boolean;
  v_is_coordinator boolean;
  v_result jsonb;
begin
  if v_user_id is null then
    raise exception 'Kirjautuminen vaaditaan.' using errcode = '42501';
  end if;

  v_role := private.time_workspace_role(p_organization_id, v_user_id);
  if v_role is null or v_role = 'customer' then
    raise exception 'Työaikatietojen käyttöoikeus puuttuu.' using errcode = '42501';
  end if;
  if p_from is null or p_to is null or p_to < p_from or p_to - p_from > 180 then
    raise exception 'Työaikajakson pitää olla 1–181 päivää.' using errcode = '22023';
  end if;

  v_is_management := v_role in ('admin', 'supervisor');
  v_is_coordinator := v_role = 'project_coordinator';

  select jsonb_build_object(
    'role', v_role,
    'capabilities', jsonb_build_object(
      'readAll', v_is_management,
      'readProjects', v_is_management or v_is_coordinator,
      'approve', v_is_management,
      'requestCorrection', true,
      'resolveCorrections', v_is_management,
      'createForOthers', v_is_management,
      'manageRules', v_role = 'admin',
      'lockPeriods', v_role in ('admin', 'supervisor'),
      'exportPayroll', v_role in ('admin', 'supervisor')
    ),
    'entries', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', te.id,
        'userId', te.user_id,
        'employeeId', te.employee_id,
        'employeeName', te.employee,
        'date', te.date,
        'projectId', te.project_id,
        'projectName', te.project,
        'workOrderId', te.work_order_id,
        'workOrderTitle', wo.title,
        'hours', te.hours,
        'overtime', coalesce(te.overtime, 0),
        'breakMinutes', te.break_minutes,
        'breakSource', te.break_source,
        'startTime', te.start_time,
        'endTime', te.end_time,
        'description', coalesce(te.description, ''),
        'status', te.status,
        'source', te.source,
        'rejectionReason', coalesce(te.rejection_reason, ''),
        'lockedAt', te.locked_at,
        'payrollPeriodId', te.payroll_period_id,
        'approvedAt', te.approved_at,
        'createdAt', te.created_at
      ) order by te.date desc, te.created_at desc)
      from public.time_entries te
      left join public.work_orders wo
        on wo.id = te.work_order_id and wo.organization_id = te.organization_id
      where te.organization_id = p_organization_id
        and te.date between p_from and p_to
        and (
          v_is_management
          or (v_role = 'worker' and (te.user_id = v_user_id or te.created_by = v_user_id))
          or (v_is_coordinator and te.project_id is not null and (
            exists (
              select 1 from public.project_members pm
              where pm.organization_id = p_organization_id
                and pm.project_id = te.project_id
                and pm.user_id = v_user_id
            )
            or exists (
              select 1 from public.projects p
              where p.organization_id = p_organization_id
                and p.id = te.project_id
                and (p.project_manager_id = v_user_id or p.responsible_supervisor_id = v_user_id)
            )
          ))
        )
    ), '[]'::jsonb),
    'activeSessions', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', s.id,
        'userId', s.user_id,
        'employeeId', s.employee_id,
        'employeeName', coalesce(nullif(e.name, ''), nullif(pr.full_name, ''), 'Työntekijä'),
        'workOrderId', s.work_order_id,
        'workOrderTitle', wo.title,
        'projectId', s.project_id,
        'projectName', coalesce(p.name, wo.project, 'Yksittäinen työ'),
        'startedAt', s.started_at,
        'note', coalesce(s.note, ''),
        'checkInId', ci.id,
        'latitude', case when v_is_management or s.user_id = v_user_id then ci.latitude else null end,
        'longitude', case when v_is_management or s.user_id = v_user_id then ci.longitude else null end,
        'accuracyM', case when v_is_management or s.user_id = v_user_id then ci.accuracy_m else null end,
        'distanceFromSiteM', case when v_is_management or s.user_id = v_user_id then ci.distance_from_site_m else null end,
        'withinGeofence', case when v_is_management or s.user_id = v_user_id then ci.within_geofence else null end
      ) order by s.started_at asc)
      from public.work_order_time_sessions s
      join public.work_orders wo on wo.id = s.work_order_id and wo.organization_id = s.organization_id
      left join public.projects p on p.id = s.project_id and p.organization_id = s.organization_id
      left join public.employees e on e.id = s.employee_id and e.organization_id = s.organization_id
      left join public.profiles pr on pr.id = s.user_id
      left join public.work_site_check_ins ci on ci.id = s.work_site_check_in_id
      where s.organization_id = p_organization_id
        and s.ended_at is null
        and (
          v_is_management
          or (v_role = 'worker' and s.user_id = v_user_id)
          or (v_is_coordinator and s.project_id is not null and (
            exists (
              select 1 from public.project_members pm
              where pm.organization_id = p_organization_id
                and pm.project_id = s.project_id
                and pm.user_id = v_user_id
            )
            or exists (
              select 1 from public.projects px
              where px.organization_id = p_organization_id
                and px.id = s.project_id
                and (px.project_manager_id = v_user_id or px.responsible_supervisor_id = v_user_id)
            )
          ))
        )
    ), '[]'::jsonb),
    'workOrders', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', wo.id,
        'title', wo.title,
        'projectId', wo.project_id,
        'projectName', coalesce(p.name, wo.project, 'Yksittäinen työ'),
        'location', coalesce(wo.location, p.location, ''),
        'status', wo.status,
        'priority', wo.priority,
        'plannedStartDate', wo.planned_start_date,
        'plannedEndDate', wo.planned_end_date,
        'plannedStartTime', wo.planned_start_time,
        'plannedEndTime', wo.planned_end_time,
        'assignedToCurrentUser', exists (
          select 1 from public.work_order_assignees wa
          where wa.organization_id = wo.organization_id
            and wa.work_order_id = wo.id
            and wa.user_id = v_user_id
        )
      ) order by coalesce(wo.planned_start_date, current_date), wo.priority, wo.title)
      from public.work_orders wo
      left join public.projects p on p.id = wo.project_id and p.organization_id = wo.organization_id
      where wo.organization_id = p_organization_id
        and wo.status not in ('Valmis', 'Peruttu')
        and (
          v_is_management
          or private.can_access_work_order(wo.id, wo.organization_id, v_user_id)
          or (v_is_coordinator and wo.project_id is not null and (
            exists (
              select 1 from public.project_members pm
              where pm.organization_id = p_organization_id
                and pm.project_id = wo.project_id
                and pm.user_id = v_user_id
            )
            or p.project_manager_id = v_user_id
            or p.responsible_supervisor_id = v_user_id
          ))
        )
      limit 300
    ), '[]'::jsonb),
    'people', coalesce((
      select jsonb_agg(jsonb_build_object(
        'userId', e.user_id,
        'employeeId', e.id,
        'name', e.name,
        'role', e.role,
        'department', e.department,
        'status', e.status
      ) order by e.name)
      from public.employees e
      where e.organization_id = p_organization_id
        and e.user_id is not null
        and e.archived_at is null
        and (
          v_is_management
          or e.user_id = v_user_id
          or (v_is_coordinator and exists (
            select 1
            from public.project_members pm_self
            join public.project_members pm_person
              on pm_person.organization_id = pm_self.organization_id
             and pm_person.project_id = pm_self.project_id
             and pm_person.user_id = e.user_id
            where pm_self.organization_id = p_organization_id
              and pm_self.user_id = v_user_id
          ))
        )
    ), '[]'::jsonb),
    'projects', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', p.id,
        'name', p.name,
        'location', coalesce(p.location, ''),
        'status', p.status,
        'projectNumber', coalesce(p.project_number, '')
      ) order by p.name)
      from public.projects p
      where p.organization_id = p_organization_id
        and p.archived_at is null
        and (
          v_is_management
          or exists (
            select 1 from public.project_members pm
            where pm.organization_id = p_organization_id
              and pm.project_id = p.id
              and pm.user_id = v_user_id
          )
          or p.project_manager_id = v_user_id
          or p.responsible_supervisor_id = v_user_id
          or (v_role = 'worker' and exists (
            select 1 from public.work_order_assignees wa
            join public.work_orders wo on wo.id = wa.work_order_id and wo.organization_id = wa.organization_id
            where wa.organization_id = p_organization_id
              and wa.user_id = v_user_id
              and wo.project_id = p.id
          ))
        )
    ), '[]'::jsonb),
    'correctionRequests', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', cr.id,
        'timeEntryId', cr.time_entry_id,
        'targetUserId', cr.target_user_id,
        'targetName', coalesce(nullif(e.name, ''), nullif(pr.full_name, ''), 'Työntekijä'),
        'requestedBy', cr.requested_by,
        'reason', cr.reason,
        'status', cr.status,
        'resolutionNote', coalesce(cr.resolution_note, ''),
        'createdAt', cr.created_at,
        'resolvedAt', cr.resolved_at,
        'entryDate', te.date,
        'projectName', te.project
      ) order by cr.created_at desc)
      from public.time_entry_correction_requests cr
      join public.time_entries te on te.id = cr.time_entry_id and te.organization_id = cr.organization_id
      left join public.employees e on e.organization_id = cr.organization_id and e.user_id = cr.target_user_id
      left join public.profiles pr on pr.id = cr.target_user_id
      where cr.organization_id = p_organization_id
        and (v_is_management or cr.target_user_id = v_user_id or cr.requested_by = v_user_id)
    ), '[]'::jsonb),
    'payrollPeriods', case when v_is_management then coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', pp.id,
        'periodStart', pp.period_start,
        'periodEnd', pp.period_end,
        'status', pp.status,
        'lockedAt', pp.locked_at,
        'exportedAt', pp.exported_at
      ) order by pp.period_end desc)
      from public.payroll_periods pp
      where pp.organization_id = p_organization_id
      limit 12
    ), '[]'::jsonb) else '[]'::jsonb end,
    'timeRules', case when v_is_management then coalesce((
      select to_jsonb(r) - 'created_by' - 'updated_by'
      from public.organization_time_rules r
      where r.organization_id = p_organization_id
    ), '{}'::jsonb) else '{}'::jsonb end,
    'anomalies', coalesce((
      select jsonb_agg(a.item order by a.severity desc, a.created_at desc)
      from (
        select
          case when statement_timestamp() - s.started_at >= interval '16 hours' then 4 else 3 end as severity,
          s.started_at as created_at,
          jsonb_build_object(
            'id', 'session:' || s.id::text,
            'kind', 'active_session_long',
            'severity', case when statement_timestamp() - s.started_at >= interval '16 hours' then 'critical' else 'warning' end,
            'title', 'Työvuoro on jäänyt pitkäksi aikaa käyntiin',
            'description', coalesce(e.name, pr.full_name, 'Työntekijä') || ' · ' || wo.title,
            'userId', s.user_id,
            'timeEntryId', null,
            'sessionId', s.id,
            'createdAt', s.started_at
          ) as item
        from public.work_order_time_sessions s
        join public.work_orders wo on wo.id = s.work_order_id
        left join public.employees e on e.id = s.employee_id
        left join public.profiles pr on pr.id = s.user_id
        where v_is_management
          and s.organization_id = p_organization_id
          and s.ended_at is null
          and statement_timestamp() - s.started_at >= interval '12 hours'
        union all
        select
          2,
          te.created_at,
          jsonb_build_object(
            'id', 'entry:' || te.id::text,
            'kind', 'large_entry',
            'severity', 'warning',
            'title', 'Poikkeuksellisen pitkä työaikakirjaus',
            'description', te.employee || ' · ' || te.hours || ' h · ' || te.project,
            'userId', te.user_id,
            'timeEntryId', te.id,
            'sessionId', null,
            'createdAt', te.created_at
          )
        from public.time_entries te
        where v_is_management
          and te.organization_id = p_organization_id
          and te.date between p_from and p_to
          and te.hours > 12
        union all
        select
          1,
          te.created_at,
          jsonb_build_object(
            'id', 'pending:' || te.id::text,
            'kind', 'old_pending',
            'severity', 'info',
            'title', 'Kirjaus odottaa käsittelyä',
            'description', te.employee || ' · ' || te.date || ' · ' || te.project,
            'userId', te.user_id,
            'timeEntryId', te.id,
            'sessionId', null,
            'createdAt', te.created_at
          )
        from public.time_entries te
        where v_is_management
          and te.organization_id = p_organization_id
          and te.status = 'Odottaa'
          and te.date < current_date - 2
        union all
        select
          2,
          ci.checked_in_at,
          jsonb_build_object(
            'id', 'geofence:' || ci.id::text,
            'kind', 'outside_geofence',
            'severity', 'warning',
            'title', 'Kirjautuminen tehtiin työmaa-alueen ulkopuolelta',
            'description', ci.employee_name || ' · ' || ci.project_name,
            'userId', ci.user_id,
            'timeEntryId', ci.time_entry_id,
            'sessionId', null,
            'createdAt', ci.checked_in_at
          )
        from public.work_site_check_ins ci
        where v_is_management
          and ci.organization_id = p_organization_id
          and ci.checked_in_at::date between p_from and p_to
          and ci.within_geofence is false
      ) a
    ), '[]'::jsonb)
  ) into v_result;

  return v_result;
end;
$$;

create or replace function public.start_time_workspace_session_v2(
  p_organization_id uuid,
  p_work_order_id uuid,
  p_note text default null,
  p_latitude double precision default null,
  p_longitude double precision default null,
  p_accuracy_m double precision default null
)
returns uuid
language plpgsql
security definer
set search_path = pg_catalog, public, private
as $$
declare
  v_user_id uuid := auth.uid();
  v_order public.work_orders%rowtype;
  v_existing public.work_order_time_sessions%rowtype;
  v_session public.work_order_time_sessions%rowtype;
  v_check_in_id uuid;
  v_employee_name text;
  v_project_name text;
begin
  if v_user_id is null then
    raise exception 'Kirjautuminen vaaditaan.' using errcode = '42501';
  end if;
  if private.time_workspace_role(p_organization_id, v_user_id) is null then
    raise exception 'Käyttäjä ei kuulu organisaatioon.' using errcode = '42501';
  end if;
  if (p_latitude is null) <> (p_longitude is null) then
    raise exception 'Sijainnin leveys- ja pituusaste pitää antaa yhdessä.' using errcode = '22023';
  end if;

  select * into v_order
  from public.work_orders
  where id = p_work_order_id and organization_id = p_organization_id;
  if v_order.id is null then
    raise exception 'Työmääräystä ei löytynyt.' using errcode = 'P0002';
  end if;
  if not private.can_access_work_order(v_order.id, p_organization_id, v_user_id) then
    raise exception 'Työmääräys ei kuulu käyttäjälle.' using errcode = '42501';
  end if;

  select * into v_existing
  from public.work_order_time_sessions
  where organization_id = p_organization_id
    and user_id = v_user_id
    and ended_at is null;
  if v_existing.id is not null and v_existing.work_order_id = p_work_order_id then
    return v_existing.id;
  end if;

  perform private.transition_my_work_order_impl(p_work_order_id, 'Käynnissä', p_note);

  if v_existing.id is not null then
    update public.work_site_check_ins ci
    set checked_out_at = statement_timestamp(),
        time_entry_id = closed.time_entry_id,
        updated_at = statement_timestamp()
    from public.work_order_time_sessions closed
    where closed.id = v_existing.id
      and ci.organization_id = p_organization_id
      and ci.user_id = v_user_id
      and ci.checked_out_at is null;
  end if;

  select * into v_session
  from public.work_order_time_sessions
  where organization_id = p_organization_id
    and user_id = v_user_id
    and work_order_id = p_work_order_id
    and ended_at is null;

  update public.work_order_time_sessions
  set note = nullif(btrim(coalesce(p_note, '')), '')
  where id = v_session.id;

  if p_latitude is not null then
    select coalesce(nullif(e.name, ''), nullif(pr.full_name, ''), nullif(pr.email, ''), 'Työntekijä')
    into v_employee_name
    from public.profiles pr
    left join public.employees e
      on e.organization_id = p_organization_id and e.user_id = pr.id
    where pr.id = v_user_id
    limit 1;

    select coalesce(nullif(p.name, ''), nullif(v_order.project, ''), 'Yksittäinen työ')
    into v_project_name
    from (select 1) seed
    left join public.projects p
      on p.id = v_order.project_id and p.organization_id = p_organization_id;

    insert into public.work_site_check_ins(
      organization_id, user_id, project_id, project_name, employee_name,
      description, checked_in_at, location_captured_at, latitude, longitude,
      accuracy_m, location_source
    ) values (
      p_organization_id, v_user_id, v_order.project_id,
      coalesce(v_project_name, 'Yksittäinen työ'), coalesce(v_employee_name, 'Työntekijä'),
      nullif(btrim(coalesce(p_note, '')), ''), statement_timestamp(), statement_timestamp(),
      p_latitude, p_longitude, greatest(coalesce(p_accuracy_m, 0), 0), 'browser_geolocation'
    ) returning id into v_check_in_id;

    update public.work_order_time_sessions
    set work_site_check_in_id = v_check_in_id
    where id = v_session.id;
  end if;

  return v_session.id;
end;
$$;

create or replace function public.stop_time_workspace_session_v2(
  p_organization_id uuid,
  p_note text default null
)
returns uuid
language plpgsql
security definer
set search_path = pg_catalog, public, private
as $$
declare
  v_user_id uuid := auth.uid();
  v_session public.work_order_time_sessions%rowtype;
  v_time_entry_id uuid;
begin
  if v_user_id is null then
    raise exception 'Kirjautuminen vaaditaan.' using errcode = '42501';
  end if;

  select * into v_session
  from public.work_order_time_sessions
  where organization_id = p_organization_id
    and user_id = v_user_id
    and ended_at is null
  for update;

  if v_session.id is null then
    raise exception 'Käynnissä olevaa työaikaa ei löytynyt.' using errcode = 'P0002';
  end if;

  perform private.transition_my_work_order_impl(
    v_session.work_order_id,
    'Odottaa',
    coalesce(nullif(btrim(coalesce(p_note, '')), ''), 'Työpäivä päätettiin työaikanäkymästä.')
  );

  select time_entry_id into v_time_entry_id
  from public.work_order_time_sessions
  where id = v_session.id;

  update public.work_site_check_ins
  set checked_out_at = coalesce(checked_out_at, statement_timestamp()),
      time_entry_id = coalesce(time_entry_id, v_time_entry_id),
      updated_at = statement_timestamp()
  where organization_id = p_organization_id
    and user_id = v_user_id
    and checked_out_at is null;

  return v_time_entry_id;
end;
$$;

create or replace function public.create_manual_time_entry_v2(
  p_organization_id uuid,
  p_target_user_id uuid,
  p_project_id uuid,
  p_work_order_id uuid,
  p_date date,
  p_start_time time,
  p_end_time time,
  p_break_source text default 'automatic',
  p_break_minutes integer default 0,
  p_break_start_time time default null,
  p_break_end_time time default null,
  p_description text default null
)
returns uuid
language plpgsql
security definer
set search_path = pg_catalog, public, private
as $$
declare
  v_actor uuid := auth.uid();
  v_role text;
  v_target uuid;
  v_employee_id uuid;
  v_employee_name text;
  v_project_id uuid;
  v_project_name text;
  v_work_order public.work_orders%rowtype;
  v_entry_id uuid;
begin
  if v_actor is null then
    raise exception 'Kirjautuminen vaaditaan.' using errcode = '42501';
  end if;
  v_role := private.time_workspace_role(p_organization_id, v_actor);
  if v_role is null or v_role = 'customer' then
    raise exception 'Työaikakirjauksen käyttöoikeus puuttuu.' using errcode = '42501';
  end if;
  v_target := case when v_role in ('admin', 'supervisor') then coalesce(p_target_user_id, v_actor) else v_actor end;
  if not exists (
    select 1 from public.organization_members om
    where om.organization_id = p_organization_id and om.user_id = v_target
  ) then
    raise exception 'Työntekijä ei kuulu organisaatioon.' using errcode = '42501';
  end if;
  if p_date is null or p_start_time is null or p_end_time is null then
    raise exception 'Päivä sekä alku- ja loppuaika ovat pakollisia.' using errcode = '23514';
  end if;

  if p_work_order_id is not null then
    select * into v_work_order
    from public.work_orders
    where id = p_work_order_id and organization_id = p_organization_id;
    if v_work_order.id is null then
      raise exception 'Työmääräystä ei löytynyt.' using errcode = 'P0002';
    end if;
    if v_role not in ('admin', 'supervisor') and not private.can_access_work_order(v_work_order.id, p_organization_id, v_target) then
      raise exception 'Työmääräys ei kuulu käyttäjälle.' using errcode = '42501';
    end if;
    v_project_id := v_work_order.project_id;
  else
    v_project_id := p_project_id;
  end if;

  if v_project_id is null then
    raise exception 'Valitse projekti tai työmääräys.' using errcode = '23514';
  end if;

  select e.id, coalesce(nullif(e.name, ''), nullif(pr.full_name, ''), nullif(pr.email, ''), 'Työntekijä')
  into v_employee_id, v_employee_name
  from public.profiles pr
  left join public.employees e
    on e.organization_id = p_organization_id and e.user_id = pr.id
  where pr.id = v_target
  limit 1;

  select p.name into v_project_name
  from public.projects p
  where p.id = v_project_id and p.organization_id = p_organization_id;
  if v_project_name is null then
    raise exception 'Projektia ei löytynyt.' using errcode = 'P0002';
  end if;

  insert into public.time_entries(
    organization_id, created_by, user_id, employee_id, project_id, work_order_id,
    date, employee, project, hours, overtime, start_time, end_time,
    break_minutes, break_source, break_start_time, break_end_time,
    source, description, status
  ) values (
    p_organization_id, v_actor, v_target, v_employee_id, v_project_id, p_work_order_id,
    p_date, coalesce(v_employee_name, 'Työntekijä'), v_project_name, 0.01, 0,
    p_start_time, p_end_time, greatest(coalesce(p_break_minutes, 0), 0),
    coalesce(nullif(btrim(p_break_source), ''), 'automatic'),
    p_break_start_time, p_break_end_time, 'manual-clock',
    nullif(btrim(coalesce(p_description, '')), ''), 'Odottaa'
  ) returning id into v_entry_id;

  insert into public.audit_logs(organization_id, user_id, action, table_name, record_id, metadata)
  values (
    p_organization_id, v_actor, 'time_entry_created_from_workspace', 'time_entries', v_entry_id,
    jsonb_build_object('target_user_id', v_target, 'date', p_date, 'project_id', v_project_id, 'work_order_id', p_work_order_id)
  );

  return v_entry_id;
end;
$$;

create or replace function public.review_time_day_v2(
  p_organization_id uuid,
  p_target_user_id uuid,
  p_date date,
  p_decision text,
  p_reason text default null
)
returns integer
language plpgsql
security definer
set search_path = pg_catalog, public, private
as $$
declare
  v_actor uuid := auth.uid();
  v_count integer;
  v_entry record;
begin
  if v_actor is null or private.time_workspace_role(p_organization_id, v_actor) not in ('admin', 'supervisor') then
    raise exception 'Vain työnjohto voi käsitellä työaikapäiviä.' using errcode = '42501';
  end if;
  if p_decision not in ('approve', 'request_correction') then
    raise exception 'Tuntematon käsittelypäätös.' using errcode = '23514';
  end if;
  if p_decision = 'request_correction' and char_length(btrim(coalesce(p_reason, ''))) < 3 then
    raise exception 'Korjauspyynnön perustelu on pakollinen.' using errcode = '23514';
  end if;

  if exists (
    select 1 from public.time_entries
    where organization_id = p_organization_id
      and user_id = p_target_user_id
      and date = p_date
      and locked_at is not null
  ) then
    raise exception 'Lukittua palkkakauden päivää ei voi käsitellä tästä näkymästä.' using errcode = '42501';
  end if;

  if p_decision = 'approve' then
    update public.time_entries
    set status = 'Hyväksytty', rejection_reason = null
    where organization_id = p_organization_id
      and user_id = p_target_user_id
      and date = p_date
      and status <> 'Hyväksytty';
    get diagnostics v_count = row_count;
  else
    update public.time_entries
    set status = 'Hylätty', rejection_reason = btrim(p_reason)
    where organization_id = p_organization_id
      and user_id = p_target_user_id
      and date = p_date
      and status <> 'Hylätty';
    get diagnostics v_count = row_count;

    for v_entry in
      select id from public.time_entries
      where organization_id = p_organization_id
        and user_id = p_target_user_id
        and date = p_date
    loop
      insert into public.time_entry_correction_requests(
        organization_id, time_entry_id, target_user_id, requested_by, reason
      ) values (
        p_organization_id, v_entry.id, p_target_user_id, v_actor, btrim(p_reason)
      ) on conflict do nothing;
    end loop;
  end if;

  insert into public.audit_logs(organization_id, user_id, action, table_name, record_id, metadata)
  values (
    p_organization_id, v_actor,
    case when p_decision = 'approve' then 'time_day_approved' else 'time_day_correction_requested' end,
    'time_entries', p_target_user_id,
    jsonb_build_object('target_user_id', p_target_user_id, 'date', p_date, 'affected_entries', v_count, 'reason', nullif(btrim(coalesce(p_reason, '')), ''))
  );

  return v_count;
end;
$$;

create or replace function public.request_time_entry_correction_v2(
  p_organization_id uuid,
  p_time_entry_id uuid,
  p_reason text
)
returns uuid
language plpgsql
security definer
set search_path = pg_catalog, public, private
as $$
declare
  v_actor uuid := auth.uid();
  v_role text;
  v_entry public.time_entries%rowtype;
  v_request_id uuid;
begin
  if v_actor is null then
    raise exception 'Kirjautuminen vaaditaan.' using errcode = '42501';
  end if;
  v_role := private.time_workspace_role(p_organization_id, v_actor);
  if char_length(btrim(coalesce(p_reason, ''))) < 3 then
    raise exception 'Korjauspyynnön perustelu on pakollinen.' using errcode = '23514';
  end if;
  select * into v_entry from public.time_entries
  where id = p_time_entry_id and organization_id = p_organization_id;
  if v_entry.id is null then
    raise exception 'Tuntikirjausta ei löytynyt.' using errcode = 'P0002';
  end if;
  if v_role not in ('admin', 'supervisor') and v_entry.user_id is distinct from v_actor and v_entry.created_by is distinct from v_actor then
    raise exception 'Voit pyytää korjausta vain omaan kirjaukseesi.' using errcode = '42501';
  end if;

  insert into public.time_entry_correction_requests(
    organization_id, time_entry_id, target_user_id, requested_by, reason
  ) values (
    p_organization_id, v_entry.id, v_entry.user_id, v_actor, btrim(p_reason)
  )
  on conflict do nothing
  returning id into v_request_id;

  if v_request_id is null then
    select id into v_request_id
    from public.time_entry_correction_requests
    where time_entry_id = v_entry.id and status = 'Avoin';
  end if;

  insert into public.audit_logs(organization_id, user_id, action, table_name, record_id, metadata)
  values (p_organization_id, v_actor, 'time_entry_correction_requested', 'time_entries', v_entry.id, jsonb_build_object('request_id', v_request_id));

  return v_request_id;
end;
$$;

create or replace function public.resolve_time_entry_correction_v2(
  p_organization_id uuid,
  p_request_id uuid,
  p_decision text,
  p_resolution_note text default null
)
returns void
language plpgsql
security definer
set search_path = pg_catalog, public, private
as $$
declare
  v_actor uuid := auth.uid();
  v_request public.time_entry_correction_requests%rowtype;
begin
  if v_actor is null or private.time_workspace_role(p_organization_id, v_actor) not in ('admin', 'supervisor') then
    raise exception 'Vain työnjohto voi ratkaista korjauspyynnön.' using errcode = '42501';
  end if;
  if p_decision not in ('accept', 'reject') then
    raise exception 'Tuntematon korjauspyynnön päätös.' using errcode = '23514';
  end if;

  select * into v_request
  from public.time_entry_correction_requests
  where id = p_request_id and organization_id = p_organization_id
  for update;
  if v_request.id is null or v_request.status <> 'Avoin' then
    raise exception 'Avoinna olevaa korjauspyyntöä ei löytynyt.' using errcode = 'P0002';
  end if;

  update public.time_entry_correction_requests
  set status = case when p_decision = 'accept' then 'Hyväksytty' else 'Hylätty' end,
      resolution_note = nullif(btrim(coalesce(p_resolution_note, '')), ''),
      resolved_by = v_actor,
      resolved_at = now(),
      updated_at = now()
  where id = v_request.id;

  if p_decision = 'accept' then
    update public.time_entries
    set status = 'Odottaa', rejection_reason = null
    where id = v_request.time_entry_id and locked_at is null;
  end if;

  insert into public.audit_logs(organization_id, user_id, action, table_name, record_id, metadata)
  values (
    p_organization_id, v_actor, 'time_entry_correction_resolved', 'time_entry_correction_requests', v_request.id,
    jsonb_build_object('decision', p_decision, 'time_entry_id', v_request.time_entry_id)
  );
end;
$$;

revoke all on function public.time_workspace_dashboard_v2(uuid, date, date) from public, anon;
revoke all on function public.start_time_workspace_session_v2(uuid, uuid, text, double precision, double precision, double precision) from public, anon;
revoke all on function public.stop_time_workspace_session_v2(uuid, text) from public, anon;
revoke all on function public.create_manual_time_entry_v2(uuid, uuid, uuid, uuid, date, time, time, text, integer, time, time, text) from public, anon;
revoke all on function public.review_time_day_v2(uuid, uuid, date, text, text) from public, anon;
revoke all on function public.request_time_entry_correction_v2(uuid, uuid, text) from public, anon;
revoke all on function public.resolve_time_entry_correction_v2(uuid, uuid, text, text) from public, anon;

grant execute on function public.time_workspace_dashboard_v2(uuid, date, date) to authenticated, service_role;
grant execute on function public.start_time_workspace_session_v2(uuid, uuid, text, double precision, double precision, double precision) to authenticated, service_role;
grant execute on function public.stop_time_workspace_session_v2(uuid, text) to authenticated, service_role;
grant execute on function public.create_manual_time_entry_v2(uuid, uuid, uuid, uuid, date, time, time, text, integer, time, time, text) to authenticated, service_role;
grant execute on function public.review_time_day_v2(uuid, uuid, date, text, text) to authenticated, service_role;
grant execute on function public.request_time_entry_correction_v2(uuid, uuid, text) to authenticated, service_role;
grant execute on function public.resolve_time_entry_correction_v2(uuid, uuid, text, text) to authenticated, service_role;

comment on table public.time_entry_correction_requests is 'Audited correction workflow for time entries. Workers request corrections; supervisors and admins resolve them.';
comment on function public.time_workspace_dashboard_v2(uuid, date, date) is 'Role-scoped source of truth for the unified VaKantti work-time workspace.';

commit;
