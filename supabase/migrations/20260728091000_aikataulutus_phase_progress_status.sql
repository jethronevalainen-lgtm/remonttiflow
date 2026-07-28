-- Align phase status derivation with the Aikataulutus progress model:
-- overdue wins over "in progress" when the deadline has passed and work remains.

create or replace function private.refresh_project_phase_progress(p_project_phase_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  phase_row public.project_phases%rowtype;
  work_count integer;
  completed_count integer;
  active_count integer;
  calculated_progress numeric;
begin
  if p_project_phase_id is null then
    return;
  end if;

  select * into phase_row
  from public.project_phases
  where id = p_project_phase_id;

  if not found then
    return;
  end if;

  select
    count(*),
    count(*) filter (where status in ('Valmis', 'Peruttu')),
    count(*) filter (where status = 'Käynnissä')
  into work_count, completed_count, active_count
  from public.work_orders
  where project_phase_id = p_project_phase_id;

  calculated_progress := case
    when work_count = 0 then 0
    else (completed_count::numeric / work_count::numeric) * 100
  end;

  update public.project_phases
  set progress = round(calculated_progress, 2),
      status = case
        when work_count > 0 and completed_count = work_count then 'Valmis'
        when end_date < current_date and (work_count = 0 or completed_count < work_count) then 'Myöhässä'
        when active_count > 0 or completed_count > 0 then 'Käynnissä'
        else 'Suunniteltu'
      end,
      updated_at = statement_timestamp()
  where id = p_project_phase_id;

  perform private.refresh_project_work_plan(phase_row.work_plan_id);
end;
$$;

revoke all on function private.refresh_project_phase_progress(uuid) from public, anon;
