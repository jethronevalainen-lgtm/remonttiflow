begin;

create extension if not exists pg_cron with schema pg_catalog;

create or replace function private.generate_scheduled_app_notifications(
  p_now timestamptz default now()
)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  generated_count integer := 0;
  affected_count integer := 0;
begin
  update public.app_notifications n
  set resolved_at = p_now,
      updated_at = p_now
  where n.resolved_at is null
    and n.notification_type = 'shift_start_reminder'
    and (
      not exists (
        select 1
        from public.shifts s
        where s.id = n.source_id
          and s.organization_id = n.organization_id
          and s.user_id = n.recipient_user_id
      )
      or exists (
        select 1
        from public.shifts s
        join public.organization_settings os on os.organization_id = s.organization_id
        where s.id = n.source_id
          and s.organization_id = n.organization_id
          and (
            not os.notification_center_enabled
            or not os.shift_start_reminders_enabled
            or private.safe_shift_start(s.date, s.start_time, os.timezone) is null
            or private.safe_shift_start(s.date, s.start_time, os.timezone) <= p_now
            or exists (
              select 1
              from public.work_site_check_ins ci
              where ci.organization_id = s.organization_id
                and ci.user_id = s.user_id
                and ci.checked_in_at between
                  private.safe_shift_start(s.date, s.start_time, os.timezone) - interval '4 hours'
                  and private.safe_shift_start(s.date, s.start_time, os.timezone) + interval '18 hours'
            )
          )
      )
    );

  update public.app_notifications n
  set resolved_at = p_now,
      updated_at = p_now
  where n.resolved_at is null
    and n.notification_type = 'missing_check_in_reminder'
    and (
      not exists (
        select 1
        from public.shifts s
        where s.id = n.source_id
          and s.organization_id = n.organization_id
          and s.user_id = n.recipient_user_id
      )
      or exists (
        select 1
        from public.shifts s
        join public.organization_settings os on os.organization_id = s.organization_id
        where s.id = n.source_id
          and s.organization_id = n.organization_id
          and (
            not os.notification_center_enabled
            or not os.late_check_in_alerts_enabled
            or private.safe_shift_start(s.date, s.start_time, os.timezone) is null
            or p_now > private.safe_shift_start(s.date, s.start_time, os.timezone) + interval '18 hours'
            or exists (
              select 1
              from public.work_site_check_ins ci
              where ci.organization_id = s.organization_id
                and ci.user_id = s.user_id
                and ci.checked_in_at between
                  private.safe_shift_start(s.date, s.start_time, os.timezone) - interval '4 hours'
                  and private.safe_shift_start(s.date, s.start_time, os.timezone) + interval '18 hours'
            )
          )
      )
    );

  update public.app_notifications n
  set resolved_at = p_now,
      updated_at = p_now
  where n.resolved_at is null
    and n.notification_type = 'late_check_in'
    and (
      not exists (
        select 1
        from public.shifts s
        where s.id = n.source_id
          and s.organization_id = n.organization_id
      )
      or exists (
        select 1
        from public.shifts s
        join public.organization_settings os on os.organization_id = s.organization_id
        where s.id = n.source_id
          and s.organization_id = n.organization_id
          and (
            not os.notification_center_enabled
            or not os.late_check_in_alerts_enabled
            or private.safe_shift_start(s.date, s.start_time, os.timezone) is null
            or p_now > private.safe_shift_start(s.date, s.start_time, os.timezone) + interval '18 hours'
            or not exists (
              select 1
              from private.shift_supervisor_targets(s.organization_id, s.id) targets
              where targets.user_id = n.recipient_user_id
            )
            or exists (
              select 1
              from public.work_site_check_ins ci
              where ci.organization_id = s.organization_id
                and ci.user_id = s.user_id
                and ci.checked_in_at between
                  private.safe_shift_start(s.date, s.start_time, os.timezone) - interval '4 hours'
                  and private.safe_shift_start(s.date, s.start_time, os.timezone) + interval '18 hours'
            )
          )
      )
    );

  update public.app_notifications n
  set resolved_at = p_now,
      updated_at = p_now
  where n.resolved_at is null
    and n.notification_type = 'work_order_due_soon'
    and (
      not exists (
        select 1
        from public.work_orders wo
        where wo.id = n.source_id
          and wo.organization_id = n.organization_id
      )
      or exists (
        select 1
        from public.work_orders wo
        join public.organization_settings os on os.organization_id = wo.organization_id
        where wo.id = n.source_id
          and wo.organization_id = n.organization_id
          and (
            not os.notification_center_enabled
            or not os.work_order_due_reminders_enabled
            or wo.status in ('Valmis', 'Peruttu')
            or wo.due_date is null
            or wo.due_date < private.safe_local_date(p_now, os.timezone)
            or wo.due_date > private.safe_local_date(p_now, os.timezone) + os.work_order_due_reminder_days
            or n.metadata ->> 'due_date' is distinct from wo.due_date::text
            or not exists (
              select 1
              from private.work_order_notification_targets(wo.organization_id, wo.id) targets
              where targets.user_id = n.recipient_user_id
            )
          )
      )
    );

  update public.app_notifications n
  set resolved_at = p_now,
      updated_at = p_now
  where n.resolved_at is null
    and n.notification_type = 'work_order_overdue'
    and (
      not exists (
        select 1
        from public.work_orders wo
        where wo.id = n.source_id
          and wo.organization_id = n.organization_id
      )
      or exists (
        select 1
        from public.work_orders wo
        join public.organization_settings os on os.organization_id = wo.organization_id
        where wo.id = n.source_id
          and wo.organization_id = n.organization_id
          and (
            not os.notification_center_enabled
            or not os.work_order_overdue_reminders_enabled
            or wo.status in ('Valmis', 'Peruttu')
            or wo.due_date is null
            or wo.due_date >= private.safe_local_date(p_now, os.timezone)
            or not exists (
              select 1
              from private.work_order_notification_targets(wo.organization_id, wo.id) targets
              where targets.user_id = n.recipient_user_id
            )
          )
      )
    );

  with candidates as (
    select
      s.organization_id,
      s.id as shift_id,
      s.user_id,
      coalesce(nullif(trim(s.project), ''), 'määritetty työmaa') as project_name,
      s.start_time,
      os.shift_start_reminder_minutes,
      private.safe_shift_start(s.date, s.start_time, os.timezone) as starts_at
    from public.shifts s
    join public.organization_settings os on os.organization_id = s.organization_id
    where os.notification_center_enabled
      and os.shift_start_reminders_enabled
      and s.user_id is not null
      and private.safe_shift_start(s.date, s.start_time, os.timezone) is not null
      and p_now >= private.safe_shift_start(s.date, s.start_time, os.timezone)
                    - make_interval(mins => os.shift_start_reminder_minutes::integer)
      and p_now < private.safe_shift_start(s.date, s.start_time, os.timezone)
      and not exists (
        select 1
        from public.work_site_check_ins ci
        where ci.organization_id = s.organization_id
          and ci.user_id = s.user_id
          and ci.checked_in_at between
            private.safe_shift_start(s.date, s.start_time, os.timezone) - interval '4 hours'
            and private.safe_shift_start(s.date, s.start_time, os.timezone) + interval '18 hours'
      )
  )
  insert into public.app_notifications as existing (
    organization_id,
    recipient_user_id,
    notification_type,
    severity,
    title,
    body,
    path,
    source_table,
    source_id,
    dedup_key,
    metadata,
    created_at,
    updated_at
  )
  select
    c.organization_id,
    c.user_id,
    'shift_start_reminder',
    'info',
    'Työvuorosi alkaa pian',
    format(
      'Työvuoro kohteessa %s alkaa klo %s. Muista kirjautua sisään työmaalla.',
      c.project_name,
      substring(c.start_time from 1 for 5)
    ),
    '/tyovuorokalenteri',
    'shifts',
    c.shift_id,
    'shift-start:' || c.shift_id::text,
    jsonb_build_object(
      'starts_at', c.starts_at,
      'reminder_minutes', c.shift_start_reminder_minutes,
      'project_name', c.project_name
    ),
    p_now,
    p_now
  from candidates c
  on conflict (organization_id, recipient_user_id, dedup_key)
  do update set
    severity = excluded.severity,
    title = excluded.title,
    body = excluded.body,
    path = excluded.path,
    metadata = excluded.metadata,
    read_at = case when existing.resolved_at is not null then null else existing.read_at end,
    resolved_at = null,
    updated_at = p_now;
  get diagnostics affected_count = row_count;
  generated_count := generated_count + affected_count;

  with candidates as (
    select
      s.organization_id,
      s.id as shift_id,
      s.user_id,
      coalesce(nullif(trim(s.employee_name), ''), nullif(trim(p.full_name), ''), 'Työntekijä') as employee_name,
      coalesce(nullif(trim(s.project), ''), 'määritetty työmaa') as project_name,
      s.start_time,
      os.late_check_in_grace_minutes,
      private.safe_shift_start(s.date, s.start_time, os.timezone) as starts_at
    from public.shifts s
    join public.organization_settings os on os.organization_id = s.organization_id
    left join public.profiles p on p.id = s.user_id
    where os.notification_center_enabled
      and os.late_check_in_alerts_enabled
      and s.user_id is not null
      and private.safe_shift_start(s.date, s.start_time, os.timezone) is not null
      and p_now >= private.safe_shift_start(s.date, s.start_time, os.timezone)
                    + make_interval(mins => os.late_check_in_grace_minutes::integer)
      and p_now <= private.safe_shift_start(s.date, s.start_time, os.timezone) + interval '18 hours'
      and not exists (
        select 1
        from public.work_site_check_ins ci
        where ci.organization_id = s.organization_id
          and ci.user_id = s.user_id
          and ci.checked_in_at between
            private.safe_shift_start(s.date, s.start_time, os.timezone) - interval '4 hours'
            and private.safe_shift_start(s.date, s.start_time, os.timezone) + interval '18 hours'
      )
      and not exists (
        select 1
        from public.employee_absences ea
        left join public.employees e
          on e.id = ea.employee_id
         and e.organization_id = ea.organization_id
        where ea.organization_id = s.organization_id
          and ea.status = 'Hyväksytty'
          and s.date between ea.start_date and ea.end_date
          and (
            ea.employee_id = s.employee_id
            or (s.employee_id is null and e.user_id = s.user_id)
          )
      )
  )
  insert into public.app_notifications as existing (
    organization_id,
    recipient_user_id,
    notification_type,
    severity,
    title,
    body,
    path,
    source_table,
    source_id,
    dedup_key,
    metadata,
    created_at,
    updated_at
  )
  select
    c.organization_id,
    c.user_id,
    'missing_check_in_reminder',
    'warning',
    'Työmaalle kirjautuminen puuttuu',
    format(
      'Työvuorosi kohteessa %s alkoi klo %s. Kirjaudu sisään tai ota yhteys työnjohtajaan, jos työvuoro on muuttunut.',
      c.project_name,
      substring(c.start_time from 1 for 5)
    ),
    '/tyovuorokalenteri',
    'shifts',
    c.shift_id,
    'missing-check-in:' || c.shift_id::text,
    jsonb_build_object(
      'starts_at', c.starts_at,
      'grace_minutes', c.late_check_in_grace_minutes,
      'project_name', c.project_name
    ),
    p_now,
    p_now
  from candidates c
  on conflict (organization_id, recipient_user_id, dedup_key)
  do update set
    severity = excluded.severity,
    title = excluded.title,
    body = excluded.body,
    path = excluded.path,
    metadata = excluded.metadata,
    read_at = case when existing.resolved_at is not null then null else existing.read_at end,
    resolved_at = null,
    updated_at = p_now;
  get diagnostics affected_count = row_count;
  generated_count := generated_count + affected_count;

  with late_shifts as (
    select
      s.organization_id,
      s.id as shift_id,
      coalesce(nullif(trim(s.employee_name), ''), nullif(trim(p.full_name), ''), 'Työntekijä') as employee_name,
      coalesce(nullif(trim(s.project), ''), 'määritetty työmaa') as project_name,
      s.start_time,
      os.late_check_in_grace_minutes,
      private.safe_shift_start(s.date, s.start_time, os.timezone) as starts_at
    from public.shifts s
    join public.organization_settings os on os.organization_id = s.organization_id
    left join public.profiles p on p.id = s.user_id
    where os.notification_center_enabled
      and os.late_check_in_alerts_enabled
      and s.user_id is not null
      and private.safe_shift_start(s.date, s.start_time, os.timezone) is not null
      and p_now >= private.safe_shift_start(s.date, s.start_time, os.timezone)
                    + make_interval(mins => os.late_check_in_grace_minutes::integer)
      and p_now <= private.safe_shift_start(s.date, s.start_time, os.timezone) + interval '18 hours'
      and not exists (
        select 1
        from public.work_site_check_ins ci
        where ci.organization_id = s.organization_id
          and ci.user_id = s.user_id
          and ci.checked_in_at between
            private.safe_shift_start(s.date, s.start_time, os.timezone) - interval '4 hours'
            and private.safe_shift_start(s.date, s.start_time, os.timezone) + interval '18 hours'
      )
      and not exists (
        select 1
        from public.employee_absences ea
        left join public.employees e
          on e.id = ea.employee_id
         and e.organization_id = ea.organization_id
        where ea.organization_id = s.organization_id
          and ea.status = 'Hyväksytty'
          and s.date between ea.start_date and ea.end_date
          and (
            ea.employee_id = s.employee_id
            or (s.employee_id is null and e.user_id = s.user_id)
          )
      )
  ),
  candidates as (
    select ls.*, supervisors.user_id as supervisor_user_id
    from late_shifts ls
    cross join lateral private.shift_supervisor_targets(ls.organization_id, ls.shift_id) supervisors
  )
  insert into public.app_notifications as existing (
    organization_id,
    recipient_user_id,
    notification_type,
    severity,
    title,
    body,
    path,
    source_table,
    source_id,
    dedup_key,
    metadata,
    created_at,
    updated_at
  )
  select
    c.organization_id,
    c.supervisor_user_id,
    'late_check_in',
    'danger',
    c.employee_name || ' ei ole kirjautunut töihin',
    format(
      'Työvuoro kohteessa %s alkoi klo %s. Sallittu liukuma on %s minuuttia eikä sisäänkirjautumista ole havaittu.',
      c.project_name,
      substring(c.start_time from 1 for 5),
      c.late_check_in_grace_minutes
    ),
    '/tyonjohto',
    'shifts',
    c.shift_id,
    'late-check-in:' || c.shift_id::text,
    jsonb_build_object(
      'starts_at', c.starts_at,
      'grace_minutes', c.late_check_in_grace_minutes,
      'employee_name', c.employee_name,
      'project_name', c.project_name
    ),
    p_now,
    p_now
  from candidates c
  on conflict (organization_id, recipient_user_id, dedup_key)
  do update set
    severity = excluded.severity,
    title = excluded.title,
    body = excluded.body,
    path = excluded.path,
    metadata = excluded.metadata,
    read_at = case when existing.resolved_at is not null then null else existing.read_at end,
    resolved_at = null,
    updated_at = p_now;
  get diagnostics affected_count = row_count;
  generated_count := generated_count + affected_count;

  with candidates as (
    select
      wo.organization_id,
      wo.id as work_order_id,
      targets.user_id,
      wo.title,
      coalesce(nullif(trim(wo.project), ''), nullif(trim(wo.location), ''), 'määritetty kohde') as target_name,
      wo.due_date,
      private.safe_local_date(p_now, os.timezone) as local_today
    from public.work_orders wo
    join public.organization_settings os on os.organization_id = wo.organization_id
    cross join lateral private.work_order_notification_targets(wo.organization_id, wo.id) targets
    where os.notification_center_enabled
      and os.work_order_due_reminders_enabled
      and wo.status not in ('Valmis', 'Peruttu')
      and wo.due_date is not null
      and wo.due_date >= private.safe_local_date(p_now, os.timezone)
      and wo.due_date <= private.safe_local_date(p_now, os.timezone) + os.work_order_due_reminder_days
  )
  insert into public.app_notifications as existing (
    organization_id,
    recipient_user_id,
    notification_type,
    severity,
    title,
    body,
    path,
    source_table,
    source_id,
    dedup_key,
    metadata,
    created_at,
    updated_at
  )
  select
    c.organization_id,
    c.user_id,
    'work_order_due_soon',
    case when c.due_date = c.local_today then 'warning' else 'info' end,
    case
      when c.due_date = c.local_today then 'Työmääräyksen määräaika on tänään'
      else 'Työmääräyksen määräaika lähestyy'
    end,
    format('%s – %s. Määräaika %s.', c.title, c.target_name, to_char(c.due_date, 'DD.MM.YYYY')),
    '/tyomaaraykset',
    'work_orders',
    c.work_order_id,
    'work-order-due:' || c.work_order_id::text || ':' || c.due_date::text,
    jsonb_build_object(
      'due_date', c.due_date,
      'work_order_title', c.title,
      'target_name', c.target_name
    ),
    p_now,
    p_now
  from candidates c
  on conflict (organization_id, recipient_user_id, dedup_key)
  do update set
    severity = excluded.severity,
    title = excluded.title,
    body = excluded.body,
    path = excluded.path,
    metadata = excluded.metadata,
    read_at = case when existing.resolved_at is not null then null else existing.read_at end,
    resolved_at = null,
    updated_at = p_now;
  get diagnostics affected_count = row_count;
  generated_count := generated_count + affected_count;

  with candidates as (
    select
      wo.organization_id,
      wo.id as work_order_id,
      targets.user_id,
      wo.title,
      coalesce(nullif(trim(wo.project), ''), nullif(trim(wo.location), ''), 'määritetty kohde') as target_name,
      wo.due_date,
      private.safe_local_date(p_now, os.timezone) - wo.due_date as days_overdue
    from public.work_orders wo
    join public.organization_settings os on os.organization_id = wo.organization_id
    cross join lateral private.work_order_notification_targets(wo.organization_id, wo.id) targets
    where os.notification_center_enabled
      and os.work_order_overdue_reminders_enabled
      and wo.status not in ('Valmis', 'Peruttu')
      and wo.due_date is not null
      and wo.due_date < private.safe_local_date(p_now, os.timezone)
  )
  insert into public.app_notifications as existing (
    organization_id,
    recipient_user_id,
    notification_type,
    severity,
    title,
    body,
    path,
    source_table,
    source_id,
    dedup_key,
    metadata,
    created_at,
    updated_at
  )
  select
    c.organization_id,
    c.user_id,
    'work_order_overdue',
    'danger',
    'Työmääräys on myöhässä',
    format(
      '%s – %s. Määräaika oli %s (%s päivää sitten).',
      c.title,
      c.target_name,
      to_char(c.due_date, 'DD.MM.YYYY'),
      c.days_overdue
    ),
    '/tyomaaraykset',
    'work_orders',
    c.work_order_id,
    'work-order-overdue:' || c.work_order_id::text,
    jsonb_build_object(
      'due_date', c.due_date,
      'days_overdue', c.days_overdue,
      'work_order_title', c.title,
      'target_name', c.target_name
    ),
    p_now,
    p_now
  from candidates c
  on conflict (organization_id, recipient_user_id, dedup_key)
  do update set
    severity = excluded.severity,
    title = excluded.title,
    body = excluded.body,
    path = excluded.path,
    metadata = excluded.metadata,
    read_at = case when existing.resolved_at is not null then null else existing.read_at end,
    resolved_at = null,
    updated_at = p_now;
  get diagnostics affected_count = row_count;
  generated_count := generated_count + affected_count;

  return generated_count;
end;
$$;

revoke all on function private.generate_scheduled_app_notifications(timestamptz)
  from public, anon, authenticated;

do $$
declare
  existing_job bigint;
begin
  select jobid into existing_job
  from cron.job
  where jobname = 'vakantti-app-notification-scan'
  limit 1;

  if existing_job is not null then
    perform cron.unschedule(existing_job);
  end if;

  perform cron.schedule(
    'vakantti-app-notification-scan',
    '*/5 * * * *',
    $job$select private.generate_scheduled_app_notifications(now());$job$
  );
end;
$$;

select private.generate_scheduled_app_notifications(now());

commit;
