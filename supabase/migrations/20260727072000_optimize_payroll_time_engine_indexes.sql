begin;

create index if not exists organization_time_rules_created_by_idx
  on public.organization_time_rules(created_by)
  where created_by is not null;

create index if not exists organization_time_rules_updated_by_idx
  on public.organization_time_rules(updated_by)
  where updated_by is not null;

create index if not exists payroll_periods_created_by_idx
  on public.payroll_periods(created_by)
  where created_by is not null;

create index if not exists payroll_periods_locked_by_idx
  on public.payroll_periods(locked_by)
  where locked_by is not null;

create index if not exists time_entries_payroll_period_id_idx
  on public.time_entries(payroll_period_id)
  where payroll_period_id is not null;

create index if not exists payroll_period_time_lines_employee_id_idx
  on public.payroll_period_time_lines(employee_id);

create index if not exists payroll_period_time_lines_employee_user_id_idx
  on public.payroll_period_time_lines(employee_user_id)
  where employee_user_id is not null;

create index if not exists payroll_period_time_lines_time_entry_id_idx
  on public.payroll_period_time_lines(time_entry_id);

create index if not exists payroll_period_time_lines_compensation_term_id_idx
  on public.payroll_period_time_lines(compensation_term_id);

create index if not exists payroll_period_employee_summaries_employee_id_idx
  on public.payroll_period_employee_summaries(employee_id);

create index if not exists payroll_period_employee_summaries_employee_user_id_idx
  on public.payroll_period_employee_summaries(employee_user_id)
  where employee_user_id is not null;

commit;
