begin;

alter table public.organization_settings
  add column if not exists notification_center_enabled boolean not null default true,
  add column if not exists late_check_in_alerts_enabled boolean not null default true,
  add column if not exists late_check_in_grace_minutes smallint not null default 15,
  add column if not exists shift_start_reminders_enabled boolean not null default true,
  add column if not exists shift_start_reminder_minutes smallint not null default 30,
  add column if not exists work_order_due_reminders_enabled boolean not null default true,
  add column if not exists work_order_due_reminder_days smallint not null default 1,
  add column if not exists work_order_overdue_reminders_enabled boolean not null default true;

alter table public.organization_settings
  drop constraint if exists organization_settings_late_check_in_grace_check;
alter table public.organization_settings
  add constraint organization_settings_late_check_in_grace_check
  check (late_check_in_grace_minutes between 0 and 240);

alter table public.organization_settings
  drop constraint if exists organization_settings_shift_start_reminder_check;
alter table public.organization_settings
  add constraint organization_settings_shift_start_reminder_check
  check (shift_start_reminder_minutes between 0 and 240);

alter table public.organization_settings
  drop constraint if exists organization_settings_work_order_due_reminder_check;
alter table public.organization_settings
  add constraint organization_settings_work_order_due_reminder_check
  check (work_order_due_reminder_days between 0 and 30);

insert into public.organization_settings (organization_id)
select o.id
from public.organizations o
on conflict (organization_id) do nothing;

create table if not exists public.app_notifications (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  recipient_user_id uuid not null references public.profiles(id) on delete cascade,
  notification_type text not null,
  severity text not null default 'warning',
  title text not null,
  body text not null,
  path text not null default '/dashboard',
  source_table text,
  source_id uuid,
  dedup_key text not null,
  metadata jsonb not null default '{}'::jsonb,
  read_at timestamptz,
  resolved_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint app_notifications_severity_check check (severity in ('info', 'warning', 'danger')),
  constraint app_notifications_unique unique (organization_id, recipient_user_id, dedup_key)
);

create index if not exists app_notifications_recipient_open_idx
  on public.app_notifications (recipient_user_id, organization_id, created_at desc)
  where resolved_at is null;
create index if not exists app_notifications_source_idx
  on public.app_notifications (organization_id, source_table, source_id)
  where resolved_at is null;

alter table public.app_notifications enable row level security;
revoke all on table public.app_notifications from public, anon, authenticated;
grant select on table public.app_notifications to authenticated;
grant all on table public.app_notifications to service_role;

drop policy if exists app_notifications_select_own on public.app_notifications;
create policy app_notifications_select_own on public.app_notifications
for select to authenticated
using (
  recipient_user_id = (select auth.uid())
  and exists (
    select 1
    from public.organization_members om
    where om.organization_id = app_notifications.organization_id
      and om.user_id = (select auth.uid())
  )
);

create or replace function private.safe_local_date(
  p_timestamp timestamptz,
  p_timezone text
)
returns date
language plpgsql
stable
set search_path = ''
as $$
begin
  return (p_timestamp at time zone coalesce(nullif(p_timezone, ''), 'Europe/Helsinki'))::date;
exception when others then
  return (p_timestamp at time zone 'Europe/Helsinki')::date;
end;
$$;

create or replace function private.safe_shift_start(
  p_date date,
  p_start_time text,
  p_timezone text
)
returns timestamptz
language plpgsql
stable
set search_path = ''
as $$
begin
  if p_date is null or p_start_time is null
     or p_start_time !~ '^(?:[01][0-9]|2[0-3]):[0-5][0-9]' then
    return null;
  end if;

  return (
    p_date + substring(p_start_time from 1 for 5)::time
  ) at time zone coalesce(nullif(p_timezone, ''), 'Europe/Helsinki');
exception when others then
  return null;
end;
$$;

revoke all on function private.safe_local_date(timestamptz, text) from public, anon, authenticated;
revoke all on function private.safe_shift_start(date, text, text) from public, anon, authenticated;

create or replace function private.work_order_notification_targets(
  p_organization_id uuid,
  p_work_order_id uuid
)
returns table (user_id uuid)
language sql
stable
security definer
set search_path = ''
as $$
  select distinct candidates.user_id
  from (
    select wa.user_id
    from public.work_orders wo
    join public.work_order_assignees wa
      on wa.work_order_id = wo.id
     and wa.organization_id = wo.organization_id
    where wo.id = p_work_order_id
      and wo.organization_id = p_organization_id
      and wo.assignment_scope = 'people'

    union all

    select pm.user_id
    from public.work_orders wo
    join public.project_members pm
      on pm.project_id = wo.project_id
     and pm.organization_id = wo.organization_id
    where wo.id = p_work_order_id
      and wo.organization_id = p_organization_id
      and wo.assignment_scope = 'project_team'
  ) candidates
  join public.organization_members om
    on om.organization_id = p_organization_id
   and om.user_id = candidates.user_id
   and om.role in ('admin', 'supervisor', 'project_coordinator', 'worker');
$$;

revoke all on function private.work_order_notification_targets(uuid, uuid) from public, anon, authenticated;

create or replace function private.shift_supervisor_targets(
  p_organization_id uuid,
  p_shift_id uuid
)
returns table (user_id uuid)
language sql
stable
security definer
set search_path = ''
as $$
  with shift_row as (
    select
      s.organization_id,
      s.project_id,
      coalesce(s.employee_id, e.id) as employee_id
    from public.shifts s
    left join public.employees e
      on e.organization_id = s.organization_id
     and e.archived_at is null
     and s.employee_id is null
     and e.user_id = s.user_id
    where s.id = p_shift_id
      and s.organization_id = p_organization_id
  ),
  direct_supervisors as (
    select stm.supervisor_user_id as user_id
    from shift_row sr
    join public.supervisor_team_members stm
      on stm.organization_id = sr.organization_id
     and stm.employee_id = sr.employee_id
     and stm.is_active
  ),
  project_supervisor as (
    select p.responsible_supervisor_id as user_id
    from shift_row sr
    join public.projects p
      on p.id = sr.project_id
     and p.organization_id = sr.organization_id
    join public.organization_members om
      on om.organization_id = p.organization_id
     and om.user_id = p.responsible_supervisor_id
     and om.role = 'supervisor'
    where p.responsible_supervisor_id is not null
  )
  select distinct selected.user_id
  from (
    select user_id from direct_supervisors
    union all
    select user_id from project_supervisor
    where not exists (select 1 from direct_supervisors)
    union all
    select om.user_id
    from public.organization_members om
    where om.organization_id = p_organization_id
      and om.role = 'supervisor'
      and not exists (select 1 from direct_supervisors)
      and not exists (select 1 from project_supervisor)
  ) selected
  where selected.user_id is not null;
$$;

revoke all on function private.shift_supervisor_targets(uuid, uuid) from public, anon, authenticated;

create or replace function public.get_notification_settings(p_organization_id uuid)
returns table (
  notification_center_enabled boolean,
  late_check_in_alerts_enabled boolean,
  late_check_in_grace_minutes smallint,
  shift_start_reminders_enabled boolean,
  shift_start_reminder_minutes smallint,
  work_order_due_reminders_enabled boolean,
  work_order_due_reminder_days smallint,
  work_order_overdue_reminders_enabled boolean,
  timezone text
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null
     or not private.has_org_role(p_organization_id, array['admin', 'supervisor']::text[]) then
    raise exception 'Ilmoitusasetusten katseluoikeus puuttuu.' using errcode = '42501';
  end if;

  return query
  select
    os.notification_center_enabled,
    os.late_check_in_alerts_enabled,
    os.late_check_in_grace_minutes,
    os.shift_start_reminders_enabled,
    os.shift_start_reminder_minutes,
    os.work_order_due_reminders_enabled,
    os.work_order_due_reminder_days,
    os.work_order_overdue_reminders_enabled,
    os.timezone
  from public.organization_settings os
  where os.organization_id = p_organization_id;
end;
$$;

revoke all on function public.get_notification_settings(uuid) from public, anon;
grant execute on function public.get_notification_settings(uuid) to authenticated;

create or replace function public.update_notification_settings(
  p_organization_id uuid,
  p_notification_center_enabled boolean,
  p_late_check_in_alerts_enabled boolean,
  p_late_check_in_grace_minutes integer,
  p_shift_start_reminders_enabled boolean,
  p_shift_start_reminder_minutes integer,
  p_work_order_due_reminders_enabled boolean,
  p_work_order_due_reminder_days integer,
  p_work_order_overdue_reminders_enabled boolean
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null
     or not private.has_org_role(p_organization_id, array['admin']::text[]) then
    raise exception 'Vain organisaation ylläpitäjä voi muuttaa ilmoitusasetuksia.' using errcode = '42501';
  end if;

  if p_late_check_in_grace_minutes not between 0 and 240 then
    raise exception 'Liukuman pitää olla 0–240 minuuttia.' using errcode = '23514';
  end if;
  if p_shift_start_reminder_minutes not between 0 and 240 then
    raise exception 'Työvuoromuistutuksen pitää olla 0–240 minuuttia.' using errcode = '23514';
  end if;
  if p_work_order_due_reminder_days not between 0 and 30 then
    raise exception 'Määräaikamuistutuksen pitää olla 0–30 päivää.' using errcode = '23514';
  end if;

  insert into public.organization_settings (
    organization_id,
    notification_center_enabled,
    late_check_in_alerts_enabled,
    late_check_in_grace_minutes,
    shift_start_reminders_enabled,
    shift_start_reminder_minutes,
    work_order_due_reminders_enabled,
    work_order_due_reminder_days,
    work_order_overdue_reminders_enabled,
    updated_at
  ) values (
    p_organization_id,
    coalesce(p_notification_center_enabled, true),
    coalesce(p_late_check_in_alerts_enabled, true),
    p_late_check_in_grace_minutes,
    coalesce(p_shift_start_reminders_enabled, true),
    p_shift_start_reminder_minutes,
    coalesce(p_work_order_due_reminders_enabled, true),
    p_work_order_due_reminder_days,
    coalesce(p_work_order_overdue_reminders_enabled, true),
    now()
  )
  on conflict (organization_id)
  do update set
    notification_center_enabled = excluded.notification_center_enabled,
    late_check_in_alerts_enabled = excluded.late_check_in_alerts_enabled,
    late_check_in_grace_minutes = excluded.late_check_in_grace_minutes,
    shift_start_reminders_enabled = excluded.shift_start_reminders_enabled,
    shift_start_reminder_minutes = excluded.shift_start_reminder_minutes,
    work_order_due_reminders_enabled = excluded.work_order_due_reminders_enabled,
    work_order_due_reminder_days = excluded.work_order_due_reminder_days,
    work_order_overdue_reminders_enabled = excluded.work_order_overdue_reminders_enabled,
    updated_at = now();

  insert into public.audit_logs (
    organization_id,
    user_id,
    action,
    table_name,
    record_id,
    metadata
  ) values (
    p_organization_id,
    auth.uid(),
    'notification_settings_updated',
    'organization_settings',
    p_organization_id,
    jsonb_build_object(
      'notification_center_enabled', p_notification_center_enabled,
      'late_check_in_alerts_enabled', p_late_check_in_alerts_enabled,
      'late_check_in_grace_minutes', p_late_check_in_grace_minutes,
      'shift_start_reminders_enabled', p_shift_start_reminders_enabled,
      'shift_start_reminder_minutes', p_shift_start_reminder_minutes,
      'work_order_due_reminders_enabled', p_work_order_due_reminders_enabled,
      'work_order_due_reminder_days', p_work_order_due_reminder_days,
      'work_order_overdue_reminders_enabled', p_work_order_overdue_reminders_enabled
    )
  );
end;
$$;

revoke all on function public.update_notification_settings(uuid, boolean, boolean, integer, boolean, integer, boolean, integer, boolean)
  from public, anon;
grant execute on function public.update_notification_settings(uuid, boolean, boolean, integer, boolean, integer, boolean, integer, boolean)
  to authenticated;

create or replace function public.mark_app_notification_read(p_notification_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null then
    raise exception 'Kirjautuminen vaaditaan.' using errcode = '42501';
  end if;

  update public.app_notifications
  set read_at = coalesce(read_at, now()),
      updated_at = now()
  where id = p_notification_id
    and recipient_user_id = auth.uid();

  if not found then
    raise exception 'Ilmoitusta ei löytynyt.' using errcode = 'P0002';
  end if;
end;
$$;

revoke all on function public.mark_app_notification_read(uuid) from public, anon;
grant execute on function public.mark_app_notification_read(uuid) to authenticated;

create or replace function public.mark_all_app_notifications_read(p_organization_id uuid)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  updated_count integer;
begin
  if auth.uid() is null then
    raise exception 'Kirjautuminen vaaditaan.' using errcode = '42501';
  end if;

  update public.app_notifications
  set read_at = coalesce(read_at, now()),
      updated_at = now()
  where organization_id = p_organization_id
    and recipient_user_id = auth.uid()
    and resolved_at is null
    and read_at is null;

  get diagnostics updated_count = row_count;
  return updated_count;
end;
$$;

revoke all on function public.mark_all_app_notifications_read(uuid) from public, anon;
grant execute on function public.mark_all_app_notifications_read(uuid) to authenticated;

do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime')
     and not exists (
       select 1
       from pg_publication_tables
       where pubname = 'supabase_realtime'
         and schemaname = 'public'
         and tablename = 'app_notifications'
     ) then
    alter publication supabase_realtime add table public.app_notifications;
  end if;
end;
$$;

commit;
