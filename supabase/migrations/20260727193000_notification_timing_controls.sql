begin;

-- Rakennusalan työmääräyksissä ennakkomuistutus voi olla esimerkiksi
-- samana päivänä, 1–2 päivää, viikko tai useita viikkoja ennen määräpäivää.
alter table public.organization_settings
  alter column work_order_due_reminder_days set default 7;

alter table public.organization_settings
  drop constraint if exists organization_settings_work_order_due_reminder_check;
alter table public.organization_settings
  add constraint organization_settings_work_order_due_reminder_check
  check (work_order_due_reminder_days between 0 and 90);

-- Korvaa asetusten päivitys-RPC:n niin, että sekä admin että työnjohtaja voivat
-- hallita operatiivisia ilmoitusaikoja. Muut organisaatioasetukset pysyvät
-- edelleen adminin hallinnassa.
drop function if exists public.update_notification_settings(
  uuid, boolean, boolean, integer, boolean, integer, boolean, integer, boolean
);

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
     or not private.has_org_role(
       p_organization_id,
       array['admin', 'supervisor']::text[]
     ) then
    raise exception 'Vain organisaation ylläpitäjä tai työnjohtaja voi muuttaa ilmoitusasetuksia.'
      using errcode = '42501';
  end if;

  if p_late_check_in_grace_minutes not between 0 and 240 then
    raise exception 'Liukuman pitää olla 0–240 minuuttia.' using errcode = '23514';
  end if;
  if p_shift_start_reminder_minutes not between 0 and 240 then
    raise exception 'Työvuoromuistutuksen pitää olla 0–240 minuuttia.' using errcode = '23514';
  end if;
  if p_work_order_due_reminder_days not between 0 and 90 then
    raise exception 'Määräaikamuistutuksen pitää olla 0–90 päivää.' using errcode = '23514';
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
      'work_order_overdue_reminders_enabled', p_work_order_overdue_reminders_enabled,
      'changed_by_role', (
        select om.role
        from public.organization_members om
        where om.organization_id = p_organization_id
          and om.user_id = auth.uid()
        limit 1
      )
    )
  );
end;
$$;

revoke all on function public.update_notification_settings(
  uuid, boolean, boolean, integer, boolean, integer, boolean, integer, boolean
) from public, anon;
grant execute on function public.update_notification_settings(
  uuid, boolean, boolean, integer, boolean, integer, boolean, integer, boolean
) to authenticated;

commit;
