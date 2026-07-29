begin;

create or replace function public.reschedule_project_phase(
  p_organization_id uuid,
  p_project_phase_id uuid,
  p_start_date date,
  p_end_date date,
  p_notes text default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  phase_row public.project_phases%rowtype;
  order_row record;
  updated_work_order_count integer := 0;
begin
  if auth.uid() is null
     or not private.is_operational_manager(p_organization_id, auth.uid()) then
    raise exception 'Vain työnjohto voi muuttaa tuotannon aikataulua.' using errcode = '42501';
  end if;

  if p_start_date is null or p_end_date is null then
    raise exception 'Työvaiheelle tarvitaan aloitus- ja valmistumispäivä.' using errcode = '23514';
  end if;
  if p_end_date < p_start_date then
    raise exception 'Valmistumispäivä ei voi olla ennen aloituspäivää.' using errcode = '23514';
  end if;

  select *
  into phase_row
  from public.project_phases
  where id = p_project_phase_id
    and organization_id = p_organization_id
  for update;

  if phase_row.id is null then
    raise exception 'Projektivaihetta ei löytynyt.' using errcode = '23503';
  end if;

  update public.project_phases
  set start_date = p_start_date,
      end_date = p_end_date,
      notes = nullif(btrim(coalesce(p_notes, '')), ''),
      updated_at = statement_timestamp()
  where id = phase_row.id
    and organization_id = p_organization_id;

  for order_row in
    select id
    from public.work_orders
    where organization_id = p_organization_id
      and project_phase_id = phase_row.id
      and status not in ('Valmis', 'Peruttu')
    for update
  loop
    update public.work_orders
    set planned_start_date = p_start_date,
        planned_end_date = p_end_date,
        due_date = p_end_date,
        updated_at = statement_timestamp()
    where id = order_row.id
      and organization_id = p_organization_id;

    perform private.sync_work_order_calendar(order_row.id);
    updated_work_order_count := updated_work_order_count + 1;
  end loop;

  perform private.refresh_project_phase_progress(phase_row.id);

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
    'project_phase_rescheduled',
    'project_phases',
    phase_row.id,
    jsonb_build_object(
      'previous_start_date', phase_row.start_date,
      'previous_end_date', phase_row.end_date,
      'start_date', p_start_date,
      'end_date', p_end_date,
      'updated_work_order_count', updated_work_order_count,
      'work_plan_id', phase_row.work_plan_id
    )
  );

  return jsonb_build_object(
    'project_phase_id', phase_row.id,
    'updated_work_order_count', updated_work_order_count,
    'start_date', p_start_date,
    'end_date', p_end_date
  );
end;
$$;

revoke all on function public.reschedule_project_phase(uuid, uuid, date, date, text)
from public, anon;
grant execute on function public.reschedule_project_phase(uuid, uuid, date, date, text)
to authenticated;

commit;
