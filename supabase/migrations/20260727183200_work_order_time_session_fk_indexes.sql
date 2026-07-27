begin;

create index if not exists work_order_time_sessions_user_id_idx
  on public.work_order_time_sessions (user_id);
create index if not exists work_order_time_sessions_project_id_idx
  on public.work_order_time_sessions (project_id)
  where project_id is not null;
create index if not exists work_order_time_sessions_employee_id_idx
  on public.work_order_time_sessions (employee_id)
  where employee_id is not null;
create index if not exists work_order_time_sessions_time_entry_id_idx
  on public.work_order_time_sessions (time_entry_id)
  where time_entry_id is not null;

commit;
