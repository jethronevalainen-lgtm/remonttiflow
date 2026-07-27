-- Add approved travel expenses to payroll preview, locking and immutable snapshots.

alter table public.travel_expenses
  add column if not exists employee_id uuid references public.employees(id) on delete set null,
  add column if not exists payroll_period_id uuid references public.payroll_periods(id) on delete restrict,
  add column if not exists locked_at timestamp with time zone;

create index if not exists travel_expenses_employee_date_idx
  on public.travel_expenses(organization_id, employee_id, date);
create index if not exists travel_expenses_payroll_period_id_idx
  on public.travel_expenses(payroll_period_id)
  where payroll_period_id is not null;

alter table public.payroll_period_employee_summaries
  add column if not exists travel_expense_count integer not null default 0,
  add column if not exists travel_expense_cents bigint not null default 0;

alter table public.payroll_period_employee_summaries
  drop constraint if exists payroll_period_employee_summary_travel_check;
alter table public.payroll_period_employee_summaries
  add constraint payroll_period_employee_summary_travel_check
  check (travel_expense_count >= 0 and travel_expense_cents >= 0);

create table if not exists public.payroll_period_travel_expense_lines (
  id uuid primary key default gen_random_uuid(),
  payroll_period_id uuid not null references public.payroll_periods(id) on delete cascade,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  travel_expense_id uuid not null references public.travel_expenses(id) on delete restrict,
  employee_id uuid not null references public.employees(id) on delete restrict,
  employee_user_id uuid references auth.users(id) on delete set null,
  employee_name text not null,
  expense_date date not null,
  expense_type text not null,
  description text,
  project_id uuid references public.projects(id) on delete set null,
  project_name text,
  amount_cents bigint not null check (amount_cents > 0),
  approved_by uuid references auth.users(id) on delete set null,
  approved_at timestamp with time zone,
  warnings text[] not null default '{}',
  source_snapshot jsonb not null default '{}'::jsonb,
  created_at timestamp with time zone not null default now(),
  unique (payroll_period_id, travel_expense_id)
);

create index if not exists payroll_travel_lines_period_employee_idx
  on public.payroll_period_travel_expense_lines(payroll_period_id, employee_id);
create index if not exists payroll_travel_lines_org_date_idx
  on public.payroll_period_travel_expense_lines(organization_id, expense_date);

alter table public.payroll_period_travel_expense_lines enable row level security;

drop policy if exists payroll_travel_lines_select on public.payroll_period_travel_expense_lines;
create policy payroll_travel_lines_select
on public.payroll_period_travel_expense_lines
for select
to authenticated
using (private.can_access_employee_hr(organization_id, employee_id));

revoke all on table public.payroll_period_travel_expense_lines from public, anon, authenticated;
grant select on table public.payroll_period_travel_expense_lines to authenticated;
grant all on table public.payroll_period_travel_expense_lines to service_role;

create or replace function private.resolve_travel_expense_employee(
  p_organization_id uuid,
  p_employee_id uuid,
  p_user_id uuid,
  p_employee_label text
)
returns uuid
language sql
stable
security definer
set search_path = pg_catalog, public
as $$
  select e.id
  from public.employees e
  where e.organization_id = p_organization_id
    and e.archived_at is null
    and (
      e.id = p_employee_id
      or (
        p_employee_id is null
        and nullif(trim(coalesce(p_employee_label, '')), '') is not null
        and (
          lower(trim(coalesce(e.name, ''))) = lower(trim(p_employee_label))
          or lower(trim(coalesce(e.email, ''))) = lower(trim(p_employee_label))
        )
      )
      or (
        p_employee_id is null
        and nullif(trim(coalesce(p_employee_label, '')), '') is null
        and p_user_id is not null
        and e.user_id = p_user_id
      )
    )
  order by
    case
      when e.id = p_employee_id then 1
      when nullif(trim(coalesce(p_employee_label, '')), '') is not null
        and lower(trim(coalesce(e.email, ''))) = lower(trim(p_employee_label)) then 2
      when nullif(trim(coalesce(p_employee_label, '')), '') is not null
        and lower(trim(coalesce(e.name, ''))) = lower(trim(p_employee_label)) then 3
      else 4
    end,
    e.created_at,
    e.id
  limit 1;
$$;

revoke all on function private.resolve_travel_expense_employee(uuid, uuid, uuid, text)
  from public, anon, authenticated;
grant execute on function private.resolve_travel_expense_employee(uuid, uuid, uuid, text)
  to service_role;

create or replace function private.calculate_payroll_travel_expense_lines(
  p_organization_id uuid,
  p_period_start date,
  p_period_end date
)
returns table (
  employee_id uuid,
  employee_user_id uuid,
  employee_name text,
  travel_expense_id uuid,
  expense_date date,
  expense_type text,
  description text,
  project_id uuid,
  project_name text,
  amount_cents bigint,
  approved_by uuid,
  approved_at timestamp with time zone,
  blockers text[],
  warnings text[],
  source_snapshot jsonb
)
language sql
stable
security definer
set search_path = pg_catalog, public
as $$
  with resolved_rows as (
    select
      expense.id as travel_expense_id,
      expense.date as expense_date,
      coalesce(nullif(trim(expense.type), ''), 'Matkakulu') as expense_type,
      expense.description,
      expense.project_id,
      project.name as project_name,
      round(expense.amount * 100)::bigint as amount_cents,
      expense.approved_by,
      expense.approved_at,
      expense.user_id as reported_user_id,
      expense.employee as reported_employee_name,
      employee.id as employee_id,
      employee.user_id as employee_user_id,
      employee.name as resolved_employee_name,
      expense.amount as source_amount,
      expense.attachment_path
    from public.travel_expenses expense
    left join public.projects project
      on project.id = expense.project_id
      and project.organization_id = expense.organization_id
    left join lateral (
      select e.id, e.user_id, e.name
      from public.employees e
      where e.id = private.resolve_travel_expense_employee(
        p_organization_id,
        expense.employee_id,
        expense.user_id,
        expense.employee
      )
    ) employee on true
    where expense.organization_id = p_organization_id
      and expense.status = 'Hyväksytty'
      and expense.date between p_period_start and p_period_end
      and expense.payroll_period_id is null
  )
  select
    resolved_rows.employee_id,
    resolved_rows.employee_user_id,
    coalesce(resolved_rows.resolved_employee_name, resolved_rows.reported_employee_name, 'Tuntematon työntekijä'),
    resolved_rows.travel_expense_id,
    resolved_rows.expense_date,
    resolved_rows.expense_type,
    resolved_rows.description,
    resolved_rows.project_id,
    resolved_rows.project_name,
    resolved_rows.amount_cents,
    resolved_rows.approved_by,
    resolved_rows.approved_at,
    array_remove(array[
      case when resolved_rows.employee_id is null
        then 'Matkakulua ei ole yhdistetty työntekijän henkilökorttiin.' end,
      case when coalesce(resolved_rows.amount_cents, 0) <= 0
        then 'Matkakulun summa puuttuu tai on nolla.' end
    ]::text[], null) as blockers,
    array_remove(array[
      case when resolved_rows.approved_at is null
        then 'Hyväksytyltä matkakululta puuttuu hyväksymisaika.' end,
      case when resolved_rows.project_id is null
        then 'Matkakulua ei ole kohdistettu projektille.' end,
      case when resolved_rows.attachment_path is null
        then 'Matkakululla ei ole liitettä.' end
    ]::text[], null) as warnings,
    jsonb_build_object(
      'rule_version', 1,
      'source_amount_eur', resolved_rows.source_amount,
      'expense_type', resolved_rows.expense_type,
      'project_id', resolved_rows.project_id,
      'reported_user_id', resolved_rows.reported_user_id,
      'reported_employee_name', resolved_rows.reported_employee_name,
      'approved_by', resolved_rows.approved_by,
      'approved_at', resolved_rows.approved_at,
      'attachment_path', resolved_rows.attachment_path
    ) as source_snapshot
  from resolved_rows;
$$;

revoke all on function private.calculate_payroll_travel_expense_lines(uuid, date, date)
  from public, anon, authenticated;
grant execute on function private.calculate_payroll_travel_expense_lines(uuid, date, date)
  to service_role;

create or replace function public.list_payroll_travel_preview(
  p_organization_id uuid,
  p_period_start date,
  p_period_end date
)
returns table (
  employee_id uuid,
  employee_user_id uuid,
  employee_name text,
  travel_expense_id uuid,
  expense_date date,
  expense_type text,
  description text,
  project_id uuid,
  project_name text,
  amount_cents bigint,
  approved_by uuid,
  approved_at timestamp with time zone,
  blockers text[],
  warnings text[]
)
language plpgsql
stable
security definer
set search_path = pg_catalog, public
as $$
declare
  v_is_admin boolean;
begin
  if p_period_start is null or p_period_end is null or p_period_end < p_period_start then
    raise exception 'Palkkakauden päivämäärät ovat virheelliset.' using errcode = '22007';
  end if;
  if not private.has_org_role(p_organization_id, array['admin','supervisor']::text[]) then
    raise exception 'Matkakuluaineiston tarkastelu vaatii admin- tai työnjohtajaroolin.' using errcode = '42501';
  end if;

  v_is_admin := private.has_org_role(p_organization_id, array['admin']::text[]);
  return query
  select
    line.employee_id,
    line.employee_user_id,
    line.employee_name,
    line.travel_expense_id,
    line.expense_date,
    line.expense_type,
    line.description,
    line.project_id,
    line.project_name,
    line.amount_cents,
    line.approved_by,
    line.approved_at,
    line.blockers,
    line.warnings
  from private.calculate_payroll_travel_expense_lines(
    p_organization_id,
    p_period_start,
    p_period_end
  ) line
  where v_is_admin
    or (line.employee_id is not null
      and private.can_access_employee_hr(p_organization_id, line.employee_id));
end;
$$;

revoke all on function public.list_payroll_travel_preview(uuid, date, date)
  from public, anon;
grant execute on function public.list_payroll_travel_preview(uuid, date, date)
  to authenticated, service_role;

create or replace function private.enforce_travel_expense_workflow()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  target_org_id uuid;
  is_manager boolean;
  payroll_lock_context boolean;
begin
  if tg_op = 'DELETE' then
    target_org_id := old.organization_id;
  elsif tg_op = 'INSERT' then
    target_org_id := new.organization_id;
  else
    target_org_id := coalesce(new.organization_id, old.organization_id);
  end if;

  payroll_lock_context := coalesce(current_setting('vakantti.payroll_lock', true), '') = 'on';
  is_manager := private.has_org_role(target_org_id, array['admin','supervisor']::text[]);

  if auth.uid() is null and current_user in ('postgres', 'service_role', 'supabase_admin') then
    return case when tg_op = 'DELETE' then old else new end;
  end if;

  if tg_op = 'DELETE' then
    if old.locked_at is not null and not payroll_lock_context then
      raise exception 'Lukittua palkkakauden matkakulua ei voi poistaa.' using errcode = '42501';
    end if;
    return old;
  end if;

  if new.employee_id is not null and not exists (
    select 1 from public.employees employee
    where employee.id = new.employee_id
      and employee.organization_id = target_org_id
  ) then
    raise exception 'Matkakulun työntekijä ei kuulu organisaatioon.' using errcode = '23503';
  end if;

  if tg_op = 'INSERT' then
    if not is_manager then
      new.user_id := auth.uid();
      new.created_by := auth.uid();
      new.employee_id := private.resolve_travel_expense_employee(
        target_org_id,
        null,
        auth.uid(),
        new.employee
      );
      new.status := 'Odottaa';
      new.approved_by := null;
      new.approved_at := null;
      new.rejection_reason := null;
      new.payroll_period_id := null;
      new.locked_at := null;
    elsif new.status = 'Hyväksytty' then
      new.approved_by := coalesce(new.approved_by, auth.uid());
      new.approved_at := coalesce(new.approved_at, now());
      new.rejection_reason := null;
    end if;
    return new;
  end if;

  if payroll_lock_context then
    return new;
  end if;

  if old.locked_at is not null then
    raise exception 'Lukittua palkkakauden matkakulua ei voi muuttaa. Tee korjaus erillisellä korjausketjulla.' using errcode = '42501';
  end if;

  if new.locked_at is distinct from old.locked_at
     or new.payroll_period_id is distinct from old.payroll_period_id then
    raise exception 'Palkkakausilukituksen voi tehdä vain palkka-aineiston lukitustoiminnolla.' using errcode = '42501';
  end if;

  if not is_manager then
    if old.user_id is distinct from auth.uid() and old.created_by is distinct from auth.uid() then
      raise exception 'Voit muuttaa vain omaa matkakuluasi.' using errcode = '42501';
    end if;
    if old.status <> 'Odottaa' then
      raise exception 'Vain odottavaa matkakulua voi muuttaa.' using errcode = '42501';
    end if;
    if new.organization_id is distinct from old.organization_id
       or new.user_id is distinct from old.user_id
       or new.employee_id is distinct from old.employee_id
       or new.created_by is distinct from old.created_by
       or new.status is distinct from old.status
       or new.approved_by is distinct from old.approved_by
       or new.approved_at is distinct from old.approved_at
       or new.rejection_reason is distinct from old.rejection_reason then
      raise exception 'Työntekijä ei voi muuttaa hyväksyntä-, omistaja- tai palkkakausitietoja.' using errcode = '42501';
    end if;
    return new;
  end if;

  if new.status = 'Hyväksytty' and old.status is distinct from 'Hyväksytty' then
    new.approved_by := auth.uid();
    new.approved_at := now();
    new.rejection_reason := null;
  elsif new.status = 'Hylätty' and old.status is distinct from 'Hylätty' then
    if length(trim(coalesce(new.rejection_reason, ''))) < 3 then
      raise exception 'Hylkäyksen perustelu on pakollinen.' using errcode = '23514';
    end if;
    new.approved_by := null;
    new.approved_at := null;
  elsif new.status = 'Odottaa' then
    new.approved_by := null;
    new.approved_at := null;
    new.rejection_reason := null;
  end if;

  return new;
end;
$$;

revoke all on function private.enforce_travel_expense_workflow()
  from public, anon, authenticated;
grant execute on function private.enforce_travel_expense_workflow() to service_role;

drop trigger if exists enforce_travel_expense_workflow on public.travel_expenses;
create trigger enforce_travel_expense_workflow
before insert or update or delete on public.travel_expenses
for each row execute function private.enforce_travel_expense_workflow();

create or replace function public.lock_payroll_period(
  p_organization_id uuid,
  p_period_start date,
  p_period_end date,
  p_notes text default null
)
returns uuid
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_period_id uuid;
  v_time_line_count integer;
  v_travel_line_count integer;
  v_blocker_count integer;
  v_full_calendar_month boolean;
begin
  if auth.uid() is null or not private.has_org_role(p_organization_id, array['admin']::text[]) then
    raise exception 'Vain organisaation admin voi lukita palkkakauden.' using errcode = '42501';
  end if;
  if p_period_start is null or p_period_end is null or p_period_end < p_period_start then
    raise exception 'Palkkakauden päivämäärät ovat virheelliset.' using errcode = '22007';
  end if;
  if exists (
    select 1 from public.payroll_periods period
    where period.organization_id = p_organization_id
      and daterange(period.period_start, period.period_end, '[]')
        && daterange(p_period_start, p_period_end, '[]')
  ) then
    raise exception 'Palkkakausi menee päällekkäin jo lukitun palkkakauden kanssa.' using errcode = '23P01';
  end if;

  select count(*) into v_time_line_count
  from private.calculate_payroll_time_lines_v2(p_organization_id, p_period_start, p_period_end);

  select count(*) into v_travel_line_count
  from private.calculate_payroll_travel_expense_lines(p_organization_id, p_period_start, p_period_end);

  if v_time_line_count + v_travel_line_count = 0 then
    raise exception 'Valitulla palkkakaudella ei ole hyväksyttyjä tuntikirjauksia tai matkakuluja.' using errcode = '23514';
  end if;

  select
    (select count(*) from private.calculate_payroll_time_lines_v2(
      p_organization_id, p_period_start, p_period_end
    ) line where cardinality(line.blockers) > 0)
    +
    (select count(*) from private.calculate_payroll_travel_expense_lines(
      p_organization_id, p_period_start, p_period_end
    ) line where cardinality(line.blockers) > 0)
  into v_blocker_count;

  if v_blocker_count > 0 then
    raise exception 'Palkkakaudella on % estävää puutetta. Korjaa puutteet ennen lukitusta.', v_blocker_count using errcode = '23514';
  end if;

  insert into public.payroll_periods(
    organization_id, period_start, period_end, status, notes, created_by, locked_by, locked_at
  ) values (
    p_organization_id, p_period_start, p_period_end, 'Lukittu',
    nullif(trim(coalesce(p_notes, '')), ''), auth.uid(), auth.uid(), now()
  ) returning id into v_period_id;

  insert into public.payroll_period_time_lines(
    payroll_period_id, organization_id, employee_id, employee_user_id, employee_name,
    time_entry_id, work_date, project_name, compensation_term_id, pay_type,
    monthly_salary_cents, hourly_wage_basis_cents, total_minutes, regular_minutes,
    additional_minutes, overtime_50_minutes, overtime_100_minutes, weekly_overtime_50_minutes,
    evening_minutes, night_minutes, saturday_minutes, sunday_minutes, break_minutes,
    break_source, start_time, end_time, hourly_base_pay_cents, overtime_premium_cents,
    allowance_pay_cents, sunday_premium_cents, variable_pay_cents, line_total_cents,
    warnings, calculation_snapshot
  )
  select
    v_period_id, p_organization_id, line.employee_id, line.employee_user_id, line.employee_name,
    line.time_entry_id, line.work_date, line.project_name, line.compensation_term_id, line.pay_type,
    line.monthly_salary_cents, line.hourly_wage_basis_cents, line.total_minutes, line.regular_minutes,
    line.additional_minutes, line.overtime_50_minutes, line.overtime_100_minutes, line.weekly_overtime_50_minutes,
    line.evening_minutes, line.night_minutes, line.saturday_minutes, line.sunday_minutes, line.break_minutes,
    line.break_source, line.start_time, line.end_time, line.hourly_base_pay_cents, line.overtime_premium_cents,
    line.allowance_pay_cents, line.sunday_premium_cents, line.variable_pay_cents, line.line_total_cents,
    line.warnings, line.calculation_snapshot
  from private.calculate_payroll_time_lines_v2(p_organization_id, p_period_start, p_period_end) line;

  v_full_calendar_month := p_period_start = date_trunc('month', p_period_start::timestamp)::date
    and p_period_end = (date_trunc('month', p_period_start::timestamp) + interval '1 month - 1 day')::date;

  insert into public.payroll_period_employee_summaries(
    payroll_period_id, organization_id, employee_id, employee_user_id, employee_name,
    entry_count, total_minutes, regular_minutes, additional_minutes, overtime_50_minutes,
    overtime_100_minutes, weekly_overtime_50_minutes, evening_minutes, night_minutes,
    saturday_minutes, sunday_minutes, fixed_monthly_salary_cents, hourly_base_pay_cents,
    variable_pay_cents, estimated_total_cents, warnings, travel_expense_count, travel_expense_cents
  )
  select
    v_period_id, p_organization_id, line.employee_id, max(line.employee_user_id), max(line.employee_name),
    count(*)::integer, sum(line.total_minutes)::integer, sum(line.regular_minutes)::integer,
    sum(line.additional_minutes)::integer, sum(line.overtime_50_minutes)::integer,
    sum(line.overtime_100_minutes)::integer, sum(line.weekly_overtime_50_minutes)::integer,
    sum(line.evening_minutes)::integer, sum(line.night_minutes)::integer,
    sum(line.saturday_minutes)::integer, sum(line.sunday_minutes)::integer,
    case when v_full_calendar_month and bool_or(line.pay_type = 'Kuukausipalkka')
      then max(coalesce(line.monthly_salary_cents, 0)) else 0 end::bigint,
    sum(line.hourly_base_pay_cents)::bigint, sum(line.variable_pay_cents)::bigint,
    (sum(line.hourly_base_pay_cents) + sum(line.variable_pay_cents)
      + case when v_full_calendar_month and bool_or(line.pay_type = 'Kuukausipalkka')
          then max(coalesce(line.monthly_salary_cents, 0)) else 0 end)::bigint,
    array(
      select distinct warning
      from public.payroll_period_time_lines detail
      cross join unnest(detail.warnings) warning
      where detail.payroll_period_id = v_period_id and detail.employee_id = line.employee_id
      order by warning
    ),
    0,
    0
  from private.calculate_payroll_time_lines_v2(p_organization_id, p_period_start, p_period_end) line
  group by line.employee_id;

  insert into public.payroll_period_travel_expense_lines(
    payroll_period_id, organization_id, travel_expense_id, employee_id, employee_user_id,
    employee_name, expense_date, expense_type, description, project_id, project_name,
    amount_cents, approved_by, approved_at, warnings, source_snapshot
  )
  select
    v_period_id, p_organization_id, line.travel_expense_id, line.employee_id, line.employee_user_id,
    line.employee_name, line.expense_date, line.expense_type, line.description, line.project_id,
    line.project_name, line.amount_cents, line.approved_by, line.approved_at, line.warnings,
    line.source_snapshot
  from private.calculate_payroll_travel_expense_lines(p_organization_id, p_period_start, p_period_end) line;

  insert into public.payroll_period_employee_summaries(
    payroll_period_id, organization_id, employee_id, employee_user_id, employee_name,
    entry_count, total_minutes, regular_minutes, additional_minutes, overtime_50_minutes,
    overtime_100_minutes, weekly_overtime_50_minutes, evening_minutes, night_minutes,
    saturday_minutes, sunday_minutes, fixed_monthly_salary_cents, hourly_base_pay_cents,
    variable_pay_cents, estimated_total_cents, warnings, travel_expense_count, travel_expense_cents
  )
  select
    v_period_id, p_organization_id, line.employee_id, max(line.employee_user_id), max(line.employee_name),
    0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
    0, 0, 0, sum(line.amount_cents)::bigint,
    array(
      select distinct warning
      from public.payroll_period_travel_expense_lines detail
      cross join unnest(detail.warnings) warning
      where detail.payroll_period_id = v_period_id and detail.employee_id = line.employee_id
      order by warning
    ),
    count(*)::integer,
    sum(line.amount_cents)::bigint
  from private.calculate_payroll_travel_expense_lines(p_organization_id, p_period_start, p_period_end) line
  group by line.employee_id
  on conflict (payroll_period_id, employee_id) do update
  set travel_expense_count = excluded.travel_expense_count,
      travel_expense_cents = excluded.travel_expense_cents,
      estimated_total_cents = public.payroll_period_employee_summaries.estimated_total_cents
        + excluded.travel_expense_cents,
      warnings = array(
        select distinct warning
        from unnest(public.payroll_period_employee_summaries.warnings || excluded.warnings) warning
        order by warning
      );

  perform set_config('vakantti.payroll_lock', 'on', true);

  update public.time_entries
  set payroll_period_id = v_period_id, locked_at = now()
  where organization_id = p_organization_id
    and status = 'Hyväksytty'
    and date between p_period_start and p_period_end;

  update public.travel_expenses expense
  set employee_id = snapshot.employee_id,
      payroll_period_id = v_period_id,
      locked_at = now()
  from public.payroll_period_travel_expense_lines snapshot
  where snapshot.payroll_period_id = v_period_id
    and snapshot.travel_expense_id = expense.id;

  insert into public.audit_logs(organization_id, user_id, action, table_name, record_id, metadata)
  values (
    p_organization_id, auth.uid(), 'payroll_period_locked', 'payroll_periods', v_period_id,
    jsonb_build_object(
      'period_start', p_period_start,
      'period_end', p_period_end,
      'time_entry_count', v_time_line_count,
      'travel_expense_count', v_travel_line_count,
      'calculation_rule_version', 3,
      'sensitive_values_recorded', false
    )
  );

  return v_period_id;
end;
$$;

revoke all on function public.lock_payroll_period(uuid, date, date, text) from public, anon;
grant execute on function public.lock_payroll_period(uuid, date, date, text)
  to authenticated, service_role;
