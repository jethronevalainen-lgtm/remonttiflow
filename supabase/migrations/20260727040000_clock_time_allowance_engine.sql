begin;

alter table public.time_entries
  add column if not exists start_time time without time zone,
  add column if not exists end_time time without time zone,
  add column if not exists break_start_time time without time zone,
  add column if not exists break_end_time time without time zone,
  add column if not exists break_source text not null default 'manual';

alter table public.organization_time_rules
  add column if not exists evening_start_time time without time zone not null default time '18:00',
  add column if not exists evening_end_time time without time zone not null default time '23:00',
  add column if not exists night_start_time time without time zone not null default time '23:00',
  add column if not exists night_end_time time without time zone not null default time '06:00';

alter table public.payroll_period_time_lines
  add column if not exists evening_minutes integer not null default 0,
  add column if not exists night_minutes integer not null default 0,
  add column if not exists break_minutes integer not null default 0,
  add column if not exists break_source text not null default 'manual',
  add column if not exists start_time time without time zone,
  add column if not exists end_time time without time zone;

alter table public.payroll_period_employee_summaries
  add column if not exists evening_minutes integer not null default 0,
  add column if not exists night_minutes integer not null default 0;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'time_entries_clock_pair_check' and conrelid = 'public.time_entries'::regclass) then
    alter table public.time_entries add constraint time_entries_clock_pair_check
      check ((start_time is null) = (end_time is null));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'time_entries_clock_distinct_check' and conrelid = 'public.time_entries'::regclass) then
    alter table public.time_entries add constraint time_entries_clock_distinct_check
      check (start_time is null or start_time <> end_time);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'time_entries_break_clock_pair_check' and conrelid = 'public.time_entries'::regclass) then
    alter table public.time_entries add constraint time_entries_break_clock_pair_check
      check ((break_start_time is null) = (break_end_time is null));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'time_entries_break_requires_shift_check' and conrelid = 'public.time_entries'::regclass) then
    alter table public.time_entries add constraint time_entries_break_requires_shift_check
      check (break_start_time is null or start_time is not null);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'time_entries_break_clock_distinct_check' and conrelid = 'public.time_entries'::regclass) then
    alter table public.time_entries add constraint time_entries_break_clock_distinct_check
      check (break_start_time is null or break_start_time <> break_end_time);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'time_entries_break_source_check' and conrelid = 'public.time_entries'::regclass) then
    alter table public.time_entries add constraint time_entries_break_source_check
      check (break_source in ('none', 'manual', 'automatic'));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'organization_time_rules_allowance_windows_check' and conrelid = 'public.organization_time_rules'::regclass) then
    alter table public.organization_time_rules add constraint organization_time_rules_allowance_windows_check
      check (evening_start_time <> evening_end_time and night_start_time <> night_end_time);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'payroll_period_time_lines_clock_minutes_check' and conrelid = 'public.payroll_period_time_lines'::regclass) then
    alter table public.payroll_period_time_lines add constraint payroll_period_time_lines_clock_minutes_check
      check (evening_minutes >= 0 and night_minutes >= 0 and break_minutes >= 0);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'payroll_period_employee_summaries_clock_minutes_check' and conrelid = 'public.payroll_period_employee_summaries'::regclass) then
    alter table public.payroll_period_employee_summaries add constraint payroll_period_employee_summaries_clock_minutes_check
      check (evening_minutes >= 0 and night_minutes >= 0);
  end if;
end;
$$;

update public.time_entries
set break_source = case when coalesce(break_minutes, 0) > 0 then 'manual' else 'none' end
where start_time is null;

create or replace function private.clock_duration_minutes(
  p_start time without time zone,
  p_end time without time zone
)
returns integer
language sql
immutable
strict
set search_path = 'pg_catalog'
as $$
  select round(extract(epoch from (
    (date '2000-01-01' + p_end + case when p_end <= p_start then interval '1 day' else interval '0' end)
    - (date '2000-01-01' + p_start)
  )) / 60)::integer;
$$;

revoke all on function private.clock_duration_minutes(time without time zone, time without time zone) from public, anon, authenticated;

create or replace function private.shift_clock_timestamp(
  p_work_date date,
  p_shift_start time without time zone,
  p_clock time without time zone
)
returns timestamp without time zone
language sql
immutable
strict
set search_path = 'pg_catalog'
as $$
  select p_work_date + p_clock
    + case when p_clock < p_shift_start then interval '1 day' else interval '0' end;
$$;

revoke all on function private.shift_clock_timestamp(date, time without time zone, time without time zone) from public, anon, authenticated;

create or replace function private.clock_window_overlap_minutes(
  p_work_date date,
  p_start time without time zone,
  p_end time without time zone,
  p_window_start time without time zone,
  p_window_end time without time zone,
  p_break_start time without time zone default null,
  p_break_end time without time zone default null
)
returns integer
language sql
immutable
set search_path = 'pg_catalog'
as $$
with shift_bounds as (
  select
    p_work_date + p_start as shift_start,
    p_work_date + p_end
      + case when p_end <= p_start then interval '1 day' else interval '0' end as shift_end
),
break_bounds as (
  select
    case when p_break_start is null or p_break_end is null then null::timestamp
      else private.shift_clock_timestamp(p_work_date, p_start, p_break_start)
    end as break_start,
    case when p_break_start is null or p_break_end is null then null::timestamp
      else private.shift_clock_timestamp(p_work_date, p_start, p_break_start)
        + (private.clock_duration_minutes(p_break_start, p_break_end) * interval '1 minute')
    end as break_end
),
window_bounds as (
  select
    (p_work_date + offset_value) + p_window_start as window_start,
    (p_work_date + offset_value) + p_window_end
      + case when p_window_end <= p_window_start then interval '1 day' else interval '0' end as window_end
  from generate_series(-1, 1) as offset_value
),
overlaps as (
  select
    greatest(
      0,
      round(extract(epoch from greatest(
        interval '0',
        least(shift_bounds.shift_end, window_bounds.window_end)
          - greatest(shift_bounds.shift_start, window_bounds.window_start)
      )) / 60)
    )::integer as shift_minutes,
    case when break_bounds.break_start is null then 0 else greatest(
      0,
      round(extract(epoch from greatest(
        interval '0',
        least(break_bounds.break_end, window_bounds.window_end)
          - greatest(break_bounds.break_start, window_bounds.window_start)
      )) / 60)
    )::integer end as break_minutes
  from shift_bounds
  cross join break_bounds
  cross join window_bounds
)
select greatest(0, coalesce(sum(shift_minutes - break_minutes), 0))::integer
from overlaps;
$$;

revoke all on function private.clock_window_overlap_minutes(
  date,
  time without time zone,
  time without time zone,
  time without time zone,
  time without time zone,
  time without time zone,
  time without time zone
) from public, anon, authenticated;

create or replace function private.normalize_time_entry_clock_values()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_gross_minutes integer;
  v_break_minutes integer;
  v_auto_after integer;
  v_auto_break integer;
  v_shift_start timestamp without time zone;
  v_shift_end timestamp without time zone;
  v_break_start timestamp without time zone;
  v_break_end timestamp without time zone;
begin
  if new.start_time is null and new.end_time is null then
    if new.break_start_time is not null or new.break_end_time is not null then
      raise exception 'Tauon kellonajat vaativat työn alkamis- ja päättymisajat.' using errcode = '23514';
    end if;
    new.break_source := case when coalesce(new.break_minutes, 0) > 0 then 'manual' else 'none' end;
    return new;
  end if;

  if new.start_time is null or new.end_time is null or new.start_time = new.end_time then
    raise exception 'Anna sekä alkamis- että päättymisaika. Ajat eivät voi olla samat.' using errcode = '23514';
  end if;

  v_gross_minutes := private.clock_duration_minutes(new.start_time, new.end_time);
  if v_gross_minutes <= 0 or v_gross_minutes > 1440 then
    raise exception 'Työvuoron keston pitää olla yli 0 ja enintään 24 tuntia.' using errcode = '23514';
  end if;

  if new.break_start_time is not null or new.break_end_time is not null then
    if new.break_start_time is null or new.break_end_time is null or new.break_start_time = new.break_end_time then
      raise exception 'Anna tauolle sekä alkamis- että päättymisaika.' using errcode = '23514';
    end if;

    v_shift_start := new.date + new.start_time;
    v_shift_end := new.date + new.end_time
      + case when new.end_time <= new.start_time then interval '1 day' else interval '0' end;
    v_break_start := private.shift_clock_timestamp(new.date, new.start_time, new.break_start_time);
    v_break_end := v_break_start
      + private.clock_duration_minutes(new.break_start_time, new.break_end_time) * interval '1 minute';

    if v_break_start < v_shift_start or v_break_end > v_shift_end then
      raise exception 'Tauon pitää sijoittua kokonaan työvuoron sisälle.' using errcode = '23514';
    end if;

    v_break_minutes := private.clock_duration_minutes(new.break_start_time, new.break_end_time);
    new.break_minutes := v_break_minutes;
    new.break_source := 'manual';
  elsif coalesce(new.break_minutes, 0) > 0 then
    v_break_minutes := new.break_minutes;
    new.break_source := 'manual';
  else
    select automatic_break_after_minutes, automatic_break_minutes
      into v_auto_after, v_auto_break
    from public.organization_time_rules
    where organization_id = new.organization_id;

    v_auto_after := coalesce(v_auto_after, 360);
    v_auto_break := coalesce(v_auto_break, 30);
    if v_auto_break > 0 and v_gross_minutes >= v_auto_after then
      v_break_minutes := v_auto_break;
      new.break_minutes := v_auto_break;
      new.break_source := 'automatic';
    else
      v_break_minutes := 0;
      new.break_minutes := 0;
      new.break_source := 'none';
    end if;
  end if;

  if v_break_minutes < 0 or v_break_minutes >= v_gross_minutes then
    raise exception 'Tauon pitää olla työvuoroa lyhyempi.' using errcode = '23514';
  end if;

  new.hours := round(((v_gross_minutes - v_break_minutes)::numeric / 60), 2);
  new.overtime := 0;
  return new;
end;
$$;

revoke all on function private.normalize_time_entry_clock_values() from public, anon, authenticated;

drop trigger if exists normalize_time_entry_clock_values on public.time_entries;
create trigger normalize_time_entry_clock_values
before insert or update of organization_id, date, start_time, end_time, break_minutes, break_start_time, break_end_time
on public.time_entries
for each row execute function private.normalize_time_entry_clock_values();

create or replace function private.complete_work_site_check_in_impl(p_check_in_id uuid)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  check_in_row public.work_site_check_ins%rowtype;
  new_time_entry_id uuid;
  linked_employee_id uuid;
  checkout_at timestamptz := statement_timestamp();
  local_start timestamp without time zone;
  local_end timestamp without time zone;
begin
  if auth.uid() is null then
    raise exception 'Kirjautuminen vaaditaan.' using errcode = '42501';
  end if;

  select * into check_in_row
  from public.work_site_check_ins
  where id = p_check_in_id
    and user_id = auth.uid()
    and checked_out_at is null
  for update;

  if not found then
    raise exception 'Aktiivista työmaalle kirjautumista ei löytynyt.' using errcode = 'P0002';
  end if;

  if not private.is_org_member(check_in_row.organization_id) then
    raise exception 'Käyttäjä ei kuulu kirjauksen organisaatioon.' using errcode = '42501';
  end if;

  if checkout_at <= check_in_row.checked_in_at
     or checkout_at - check_in_row.checked_in_at > interval '24 hours' then
    raise exception 'Työmaalle kirjautumisen keston pitää olla yli 0 ja enintään 24 tuntia.' using errcode = '23514';
  end if;

  local_start := check_in_row.checked_in_at at time zone 'Europe/Helsinki';
  local_end := checkout_at at time zone 'Europe/Helsinki';

  select employee.id into linked_employee_id
  from public.employees employee
  where employee.organization_id = check_in_row.organization_id
    and employee.user_id = check_in_row.user_id
  limit 1;

  insert into public.time_entries (
    organization_id,
    created_by,
    user_id,
    project_id,
    employee_id,
    date,
    employee,
    project,
    hours,
    overtime,
    start_time,
    end_time,
    break_minutes,
    break_source,
    source,
    description,
    status
  ) values (
    check_in_row.organization_id,
    check_in_row.user_id,
    check_in_row.user_id,
    check_in_row.project_id,
    linked_employee_id,
    local_start::date,
    check_in_row.employee_name,
    check_in_row.project_name,
    0.01,
    0,
    local_start::time(0),
    local_end::time(0),
    0,
    'none',
    'timer',
    nullif(btrim(check_in_row.description), ''),
    'Odottaa'
  ) returning id into new_time_entry_id;

  update public.work_site_check_ins
  set checked_out_at = checkout_at,
      time_entry_id = new_time_entry_id,
      updated_at = checkout_at
  where id = check_in_row.id;

  return new_time_entry_id;
end;
$$;

revoke all on function private.complete_work_site_check_in_impl(uuid) from public, anon, authenticated;

create or replace function private.calculate_payroll_time_lines_v2(
  p_organization_id uuid,
  p_period_start date,
  p_period_end date
)
returns table (
  employee_id uuid,
  employee_user_id uuid,
  employee_name text,
  time_entry_id uuid,
  work_date date,
  project_name text,
  compensation_term_id uuid,
  pay_type text,
  monthly_salary_cents bigint,
  hourly_wage_basis_cents numeric,
  total_minutes integer,
  regular_minutes integer,
  additional_minutes integer,
  overtime_50_minutes integer,
  overtime_100_minutes integer,
  weekly_overtime_50_minutes integer,
  evening_minutes integer,
  night_minutes integer,
  saturday_minutes integer,
  sunday_minutes integer,
  break_minutes integer,
  break_source text,
  start_time time without time zone,
  end_time time without time zone,
  hourly_base_pay_cents bigint,
  overtime_premium_cents bigint,
  allowance_pay_cents bigint,
  sunday_premium_cents bigint,
  variable_pay_cents bigint,
  line_total_cents bigint,
  blockers text[],
  warnings text[],
  calculation_snapshot jsonb
)
language sql
stable
security definer
set search_path = 'pg_catalog', 'public'
as $$
with rule as (
  select
    coalesce(r.contractual_daily_hours, 7.5)::numeric as contractual_daily_hours,
    coalesce(r.contractual_weekly_hours, 37.5)::numeric as contractual_weekly_hours,
    coalesce(r.statutory_daily_overtime_after_hours, 8)::numeric as statutory_daily_hours,
    coalesce(r.statutory_weekly_overtime_after_hours, 40)::numeric as statutory_weekly_hours,
    coalesce(r.daily_overtime_50_hours, 2)::numeric as daily_overtime_50_hours,
    coalesce(r.rounding_minutes, 15)::integer as rounding_minutes,
    coalesce(r.rounding_mode, 'nearest')::text as rounding_mode,
    coalesce(r.monthly_salary_hour_divisor, 162.5)::numeric as monthly_salary_hour_divisor,
    coalesce(r.sunday_multiplier, 2)::numeric as sunday_multiplier,
    coalesce(r.evening_start_time, time '18:00') as evening_start_time,
    coalesce(r.evening_end_time, time '23:00') as evening_end_time,
    coalesce(r.night_start_time, time '23:00') as night_start_time,
    coalesce(r.night_end_time, time '06:00') as night_end_time
  from (select 1) seed
  left join public.organization_time_rules r on r.organization_id = p_organization_id
),
source_entries as (
  select
    te.id as time_entry_id,
    te.date as work_date,
    te.employee as reported_employee_name,
    te.project as project_name,
    te.hours,
    coalesce(te.overtime, 0) as reported_overtime,
    te.start_time,
    te.end_time,
    te.break_start_time,
    te.break_end_time,
    coalesce(te.break_minutes, 0)::integer as break_minutes,
    coalesce(te.break_source, 'manual') as break_source,
    te.created_at,
    resolved.id as employee_id,
    resolved.user_id as employee_user_id,
    resolved.name as resolved_employee_name,
    term.id as compensation_term_id,
    term.pay_type,
    term.monthly_salary_cents,
    term.hourly_wage_cents,
    term.weekly_hours,
    term.evening_allowance_cents,
    term.night_allowance_cents,
    term.saturday_allowance_cents,
    term.sunday_allowance_cents,
    term.overtime_50_multiplier,
    term.overtime_100_multiplier,
    rule.*
  from public.time_entries te
  cross join rule
  left join lateral (
    select e.id, e.user_id, e.name
    from public.employees e
    where e.id = private.resolve_payroll_employee(p_organization_id, te.employee_id, te.user_id, te.employee)
  ) resolved on true
  left join lateral (
    select ect.*
    from public.employee_compensation_terms ect
    where ect.organization_id = p_organization_id
      and ect.employee_id = resolved.id
      and ect.valid_from <= te.date
      and (ect.valid_to is null or ect.valid_to >= te.date)
    order by ect.valid_from desc, ect.created_at desc
    limit 1
  ) term on true
  where te.organization_id = p_organization_id
    and te.status = 'Hyväksytty'
    and te.date between date_trunc('week', p_period_start::timestamp)::date and p_period_end
),
clock_data as (
  select
    source_entries.*,
    case when start_time is not null and end_time is not null
      then private.clock_duration_minutes(start_time, end_time) - break_minutes
      else round((coalesce(hours, 0) + coalesce(reported_overtime, 0)) * 60)::integer
    end as raw_paid_minutes,
    case when start_time is null or end_time is null then 0 else
      private.clock_window_overlap_minutes(
        work_date, start_time, end_time, evening_start_time, evening_end_time,
        break_start_time, break_end_time
      )
    end as evening_overlap_minutes,
    case when start_time is null or end_time is null then 0 else
      private.clock_window_overlap_minutes(
        work_date, start_time, end_time, night_start_time, night_end_time,
        break_start_time, break_end_time
      )
    end as night_overlap_minutes
  from source_entries
),
minutes as (
  select
    clock_data.*,
    private.round_payroll_minutes(raw_paid_minutes, rounding_minutes, rounding_mode) as total_minutes,
    round(coalesce(weekly_hours, contractual_weekly_hours) / 5 * 60)::integer as contractual_daily_minutes,
    round(statutory_daily_hours * 60)::integer as statutory_daily_minutes,
    round(statutory_weekly_hours * 60)::integer as statutory_weekly_minutes,
    round(daily_overtime_50_hours * 60)::integer as daily_overtime_50_limit_minutes,
    case
      when pay_type = 'Tuntipalkka' then hourly_wage_cents::numeric
      when pay_type = 'Kuukausipalkka' then monthly_salary_cents::numeric / nullif(monthly_salary_hour_divisor, 0)
      else null
    end as hourly_basis,
    case
      when break_minutes > 0 and break_start_time is null and evening_overlap_minutes > 0 and coalesce(evening_allowance_cents, 0) > 0 then 0
      else evening_overlap_minutes
    end::integer as payable_evening_minutes,
    case
      when break_minutes > 0 and break_start_time is null and night_overlap_minutes > 0 and coalesce(night_allowance_cents, 0) > 0 then 0
      else night_overlap_minutes
    end::integer as payable_night_minutes
  from clock_data
),
classified as (
  select
    minutes.*,
    least(total_minutes, least(contractual_daily_minutes, statutory_daily_minutes))::integer as regular_pre,
    least(
      greatest(total_minutes - least(contractual_daily_minutes, statutory_daily_minutes), 0),
      greatest(statutory_daily_minutes - least(contractual_daily_minutes, statutory_daily_minutes), 0)
    )::integer as additional_pre,
    least(greatest(total_minutes - statutory_daily_minutes, 0), daily_overtime_50_limit_minutes)::integer as daily_overtime_50_minutes,
    greatest(total_minutes - statutory_daily_minutes - daily_overtime_50_limit_minutes, 0)::integer as daily_overtime_100_minutes
  from minutes
),
weekly_context as (
  select
    classified.*,
    (regular_pre + additional_pre)::integer as non_daily_minutes,
    coalesce(sum(regular_pre + additional_pre) over (
      partition by coalesce(employee_id::text, 'unresolved:' || time_entry_id::text), date_trunc('week', work_date::timestamp)
      order by work_date, created_at, time_entry_id
      rows between unbounded preceding and 1 preceding
    ), 0)::integer as prior_week_minutes
  from classified
),
weekly_classified as (
  select
    weekly_context.*,
    least(non_daily_minutes, greatest(prior_week_minutes + non_daily_minutes - statutory_weekly_minutes, 0))::integer as weekly_overtime_50_minutes
  from weekly_context
),
final_minutes as (
  select
    weekly_classified.*,
    greatest(regular_pre - greatest(weekly_overtime_50_minutes - additional_pre, 0), 0)::integer as regular_minutes,
    greatest(additional_pre - least(additional_pre, weekly_overtime_50_minutes), 0)::integer as additional_minutes,
    case when extract(isodow from work_date) = 6 then total_minutes else 0 end::integer as saturday_minutes,
    case when extract(isodow from work_date) = 7 then total_minutes else 0 end::integer as sunday_minutes
  from weekly_classified
),
amounts as (
  select
    final_minutes.*,
    case when pay_type = 'Tuntipalkka' and hourly_basis is not null
      then round(total_minutes * hourly_basis / 60)::bigint else 0::bigint end as hourly_base_pay_cents,
    case when hourly_basis is null then 0::bigint else round(
      daily_overtime_50_minutes * hourly_basis / 60 * (coalesce(overtime_50_multiplier, 1.5) - 1)
      + daily_overtime_100_minutes * hourly_basis / 60 * (coalesce(overtime_100_multiplier, 2) - 1)
      + weekly_overtime_50_minutes * hourly_basis / 60 * (coalesce(overtime_50_multiplier, 1.5) - 1)
    )::bigint end as overtime_premium_cents,
    round(
      payable_evening_minutes * coalesce(evening_allowance_cents, 0) / 60.0
      + payable_night_minutes * coalesce(night_allowance_cents, 0) / 60.0
      + saturday_minutes * coalesce(saturday_allowance_cents, 0) / 60.0
      + sunday_minutes * coalesce(sunday_allowance_cents, 0) / 60.0
    )::bigint as allowance_pay_cents,
    case when hourly_basis is null then 0::bigint else round(
      sunday_minutes * hourly_basis / 60 * (sunday_multiplier - 1)
    )::bigint end as sunday_premium_cents
  from final_minutes
)
select
  amounts.employee_id,
  amounts.employee_user_id,
  coalesce(amounts.resolved_employee_name, amounts.reported_employee_name, 'Tuntematon työntekijä') as employee_name,
  amounts.time_entry_id,
  amounts.work_date,
  amounts.project_name,
  amounts.compensation_term_id,
  amounts.pay_type,
  amounts.monthly_salary_cents,
  amounts.hourly_basis as hourly_wage_basis_cents,
  amounts.total_minutes,
  amounts.regular_minutes,
  amounts.additional_minutes,
  amounts.daily_overtime_50_minutes as overtime_50_minutes,
  amounts.daily_overtime_100_minutes as overtime_100_minutes,
  amounts.weekly_overtime_50_minutes,
  amounts.payable_evening_minutes as evening_minutes,
  amounts.payable_night_minutes as night_minutes,
  amounts.saturday_minutes,
  amounts.sunday_minutes,
  amounts.break_minutes,
  amounts.break_source,
  amounts.start_time,
  amounts.end_time,
  amounts.hourly_base_pay_cents,
  amounts.overtime_premium_cents,
  amounts.allowance_pay_cents,
  amounts.sunday_premium_cents,
  (amounts.overtime_premium_cents + amounts.allowance_pay_cents + amounts.sunday_premium_cents)::bigint as variable_pay_cents,
  (amounts.hourly_base_pay_cents + amounts.overtime_premium_cents + amounts.allowance_pay_cents + amounts.sunday_premium_cents)::bigint as line_total_cents,
  array_remove(array[
    case when amounts.employee_id is null then 'Tuntikirjausta ei ole yhdistetty työntekijän henkilökorttiin.' end,
    case when amounts.compensation_term_id is null then 'Työntekijältä puuttuvat kyseisen päivän voimassa olevat palkkaehdot.' end,
    case when amounts.compensation_term_id is not null and coalesce(amounts.hourly_basis, 0) <= 0 then 'Palkan laskentaperuste puuttuu tai on nolla.' end,
    case when coalesce(amounts.evening_allowance_cents, 0) > 0 and (amounts.start_time is null or amounts.end_time is null)
      then 'Iltatyölisän laskenta vaatii työn alkamis- ja päättymisajat.' end,
    case when coalesce(amounts.night_allowance_cents, 0) > 0 and (amounts.start_time is null or amounts.end_time is null)
      then 'Yötyölisän laskenta vaatii työn alkamis- ja päättymisajat.' end,
    case when amounts.break_minutes > 0 and amounts.break_start_time is null
      and amounts.evening_overlap_minutes > 0 and coalesce(amounts.evening_allowance_cents, 0) > 0
      then 'Tauon kellonajat puuttuvat iltatyölisää sisältävästä vuorosta.' end,
    case when amounts.break_minutes > 0 and amounts.break_start_time is null
      and amounts.night_overlap_minutes > 0 and coalesce(amounts.night_allowance_cents, 0) > 0
      then 'Tauon kellonajat puuttuvat yötyölisää sisältävästä vuorosta.' end
  ]::text[], null) as blockers,
  array_remove(array[
    case when amounts.reported_overtime > 0 then 'Käsin merkitty ylityö luokitellaan uudelleen organisaation sääntöjen perusteella.' end,
    case when amounts.break_source = 'automatic' then 'Automaattinen tauko vähennettiin organisaation työaikasäännön perusteella.' end,
    case when amounts.pay_type = 'Kuukausipalkka' then 'Rivisumma sisältää kuukausipalkkaisella vain muuttuvat erät; kiinteä kuukausipalkka lisätään yhteenvetoon vain täydeltä kalenterikuukaudelta.' end
  ]::text[], null) as warnings,
  jsonb_build_object(
    'rule_version', 2,
    'contractual_daily_minutes', amounts.contractual_daily_minutes,
    'statutory_daily_minutes', amounts.statutory_daily_minutes,
    'statutory_weekly_minutes', amounts.statutory_weekly_minutes,
    'rounding_minutes', amounts.rounding_minutes,
    'rounding_mode', amounts.rounding_mode,
    'reported_hours', amounts.hours,
    'reported_overtime', amounts.reported_overtime,
    'clock_start', amounts.start_time,
    'clock_end', amounts.end_time,
    'break_minutes', amounts.break_minutes,
    'break_source', amounts.break_source,
    'evening_minutes', amounts.payable_evening_minutes,
    'night_minutes', amounts.payable_night_minutes,
    'hourly_wage_basis_cents', amounts.hourly_basis
  ) as calculation_snapshot
from amounts
where amounts.work_date between p_period_start and p_period_end;
$$;

revoke all on function private.calculate_payroll_time_lines_v2(uuid, date, date) from public, anon, authenticated;

create or replace function public.list_payroll_preview_v2(
  p_organization_id uuid,
  p_period_start date,
  p_period_end date
)
returns table (
  employee_id uuid,
  employee_user_id uuid,
  employee_name text,
  time_entry_id uuid,
  work_date date,
  project_name text,
  compensation_term_id uuid,
  pay_type text,
  monthly_salary_cents bigint,
  hourly_wage_basis_cents numeric,
  total_minutes integer,
  regular_minutes integer,
  additional_minutes integer,
  overtime_50_minutes integer,
  overtime_100_minutes integer,
  weekly_overtime_50_minutes integer,
  evening_minutes integer,
  night_minutes integer,
  saturday_minutes integer,
  sunday_minutes integer,
  break_minutes integer,
  break_source text,
  start_time time without time zone,
  end_time time without time zone,
  hourly_base_pay_cents bigint,
  overtime_premium_cents bigint,
  allowance_pay_cents bigint,
  sunday_premium_cents bigint,
  variable_pay_cents bigint,
  line_total_cents bigint,
  blockers text[],
  warnings text[],
  calculation_snapshot jsonb
)
language plpgsql
stable
security definer
set search_path = 'pg_catalog', 'public'
as $$
declare
  v_is_admin boolean;
begin
  if p_period_start is null or p_period_end is null or p_period_end < p_period_start then
    raise exception 'Palkkakauden päivämäärät ovat virheelliset.' using errcode = '22007';
  end if;
  if not private.has_org_role(p_organization_id, array['admin','supervisor']::text[]) then
    raise exception 'Palkka-aineiston tarkastelu vaatii admin- tai työnjohtajaroolin.' using errcode = '42501';
  end if;
  v_is_admin := private.has_org_role(p_organization_id, array['admin']::text[]);
  return query
  select lines.*
  from private.calculate_payroll_time_lines_v2(p_organization_id, p_period_start, p_period_end) lines
  where v_is_admin or (lines.employee_id is not null and private.can_access_employee_hr(p_organization_id, lines.employee_id));
end;
$$;

revoke all on function public.list_payroll_preview_v2(uuid, date, date) from public, anon;
grant execute on function public.list_payroll_preview_v2(uuid, date, date) to authenticated;

create or replace function public.lock_payroll_period(
  p_organization_id uuid,
  p_period_start date,
  p_period_end date,
  p_notes text default null
)
returns uuid
language plpgsql
security definer
set search_path = 'pg_catalog', 'public'
as $$
declare
  v_period_id uuid;
  v_line_count integer;
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
    select 1 from public.payroll_periods pp
    where pp.organization_id = p_organization_id
      and daterange(pp.period_start, pp.period_end, '[]') && daterange(p_period_start, p_period_end, '[]')
  ) then
    raise exception 'Palkkakausi menee päällekkäin jo lukitun palkkakauden kanssa.' using errcode = '23P01';
  end if;

  select count(*) into v_line_count
  from private.calculate_payroll_time_lines_v2(p_organization_id, p_period_start, p_period_end);
  if v_line_count = 0 then
    raise exception 'Valitulla palkkakaudella ei ole hyväksyttyjä tuntikirjauksia.' using errcode = '23514';
  end if;

  select count(*) into v_blocker_count
  from private.calculate_payroll_time_lines_v2(p_organization_id, p_period_start, p_period_end) lines
  where cardinality(lines.blockers) > 0;
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
    v_period_id, p_organization_id, lines.employee_id, lines.employee_user_id, lines.employee_name,
    lines.time_entry_id, lines.work_date, lines.project_name, lines.compensation_term_id, lines.pay_type,
    lines.monthly_salary_cents, lines.hourly_wage_basis_cents, lines.total_minutes, lines.regular_minutes,
    lines.additional_minutes, lines.overtime_50_minutes, lines.overtime_100_minutes, lines.weekly_overtime_50_minutes,
    lines.evening_minutes, lines.night_minutes, lines.saturday_minutes, lines.sunday_minutes, lines.break_minutes,
    lines.break_source, lines.start_time, lines.end_time, lines.hourly_base_pay_cents, lines.overtime_premium_cents,
    lines.allowance_pay_cents, lines.sunday_premium_cents, lines.variable_pay_cents, lines.line_total_cents,
    lines.warnings, lines.calculation_snapshot
  from private.calculate_payroll_time_lines_v2(p_organization_id, p_period_start, p_period_end) lines;

  v_full_calendar_month := p_period_start = date_trunc('month', p_period_start::timestamp)::date
    and p_period_end = (date_trunc('month', p_period_start::timestamp) + interval '1 month - 1 day')::date;

  insert into public.payroll_period_employee_summaries(
    payroll_period_id, organization_id, employee_id, employee_user_id, employee_name,
    entry_count, total_minutes, regular_minutes, additional_minutes, overtime_50_minutes,
    overtime_100_minutes, weekly_overtime_50_minutes, evening_minutes, night_minutes,
    saturday_minutes, sunday_minutes, fixed_monthly_salary_cents, hourly_base_pay_cents,
    variable_pay_cents, estimated_total_cents, warnings
  )
  select
    v_period_id, p_organization_id, lines.employee_id, max(lines.employee_user_id), max(lines.employee_name),
    count(*)::integer, sum(lines.total_minutes)::integer, sum(lines.regular_minutes)::integer,
    sum(lines.additional_minutes)::integer, sum(lines.overtime_50_minutes)::integer,
    sum(lines.overtime_100_minutes)::integer, sum(lines.weekly_overtime_50_minutes)::integer,
    sum(lines.evening_minutes)::integer, sum(lines.night_minutes)::integer,
    sum(lines.saturday_minutes)::integer, sum(lines.sunday_minutes)::integer,
    case when v_full_calendar_month and bool_or(lines.pay_type = 'Kuukausipalkka')
      then max(coalesce(lines.monthly_salary_cents, 0)) else 0 end::bigint,
    sum(lines.hourly_base_pay_cents)::bigint, sum(lines.variable_pay_cents)::bigint,
    (sum(lines.hourly_base_pay_cents) + sum(lines.variable_pay_cents)
      + case when v_full_calendar_month and bool_or(lines.pay_type = 'Kuukausipalkka')
          then max(coalesce(lines.monthly_salary_cents, 0)) else 0 end)::bigint,
    array(
      select distinct warning
      from public.payroll_period_time_lines detail
      cross join unnest(detail.warnings) warning
      where detail.payroll_period_id = v_period_id and detail.employee_id = lines.employee_id
      order by warning
    )
  from private.calculate_payroll_time_lines_v2(p_organization_id, p_period_start, p_period_end) lines
  group by lines.employee_id;

  perform set_config('vakantti.payroll_lock', 'on', true);
  update public.time_entries
  set payroll_period_id = v_period_id, locked_at = now()
  where organization_id = p_organization_id
    and status = 'Hyväksytty'
    and date between p_period_start and p_period_end;

  insert into public.audit_logs(organization_id, user_id, action, table_name, record_id, metadata)
  values (
    p_organization_id, auth.uid(), 'payroll_period_locked', 'payroll_periods', v_period_id,
    jsonb_build_object(
      'period_start', p_period_start,
      'period_end', p_period_end,
      'time_entry_count', v_line_count,
      'calculation_rule_version', 2,
      'sensitive_values_recorded', false
    )
  );
  return v_period_id;
end;
$$;

revoke all on function public.lock_payroll_period(uuid, date, date, text) from public, anon;
grant execute on function public.lock_payroll_period(uuid, date, date, text) to authenticated;

create index if not exists time_entries_clock_date_idx
  on public.time_entries(organization_id, date, start_time)
  where start_time is not null;

commit;
