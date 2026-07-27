begin;

create table if not exists public.organization_time_rules (
  organization_id uuid primary key references public.organizations(id) on delete cascade,
  contractual_daily_hours numeric(5,2) not null default 7.5,
  contractual_weekly_hours numeric(5,2) not null default 37.5,
  statutory_daily_overtime_after_hours numeric(5,2) not null default 8,
  statutory_weekly_overtime_after_hours numeric(5,2) not null default 40,
  daily_overtime_50_hours numeric(5,2) not null default 2,
  rounding_minutes integer not null default 15,
  rounding_mode text not null default 'nearest',
  automatic_break_after_minutes integer not null default 360,
  automatic_break_minutes integer not null default 30,
  monthly_salary_hour_divisor numeric(7,2) not null default 162.5,
  sunday_multiplier numeric(5,2) not null default 2,
  maximum_average_weekly_hours numeric(5,2) not null default 48,
  kilometer_allowance_cents_per_km integer not null default 55,
  partial_daily_allowance_cents integer not null default 2500,
  full_daily_allowance_cents integer not null default 5400,
  meal_allowance_cents integer not null default 1350,
  expense_rates_valid_from date not null default date '2026-01-01',
  timezone text not null default 'Europe/Helsinki',
  created_by uuid references auth.users(id) on delete set null,
  updated_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint organization_time_rules_daily_hours_check check (
    contractual_daily_hours > 0
    and statutory_daily_overtime_after_hours >= contractual_daily_hours
    and statutory_daily_overtime_after_hours <= 24
  ),
  constraint organization_time_rules_weekly_hours_check check (
    contractual_weekly_hours > 0
    and statutory_weekly_overtime_after_hours >= contractual_weekly_hours
    and statutory_weekly_overtime_after_hours <= 168
  ),
  constraint organization_time_rules_overtime_check check (
    daily_overtime_50_hours >= 0 and daily_overtime_50_hours <= 24
  ),
  constraint organization_time_rules_rounding_check check (
    rounding_minutes in (1, 5, 10, 15, 30, 60)
    and rounding_mode in ('nearest', 'floor', 'ceil')
  ),
  constraint organization_time_rules_break_check check (
    automatic_break_after_minutes >= 0
    and automatic_break_minutes >= 0
    and automatic_break_minutes <= 240
  ),
  constraint organization_time_rules_salary_divisor_check check (monthly_salary_hour_divisor > 0),
  constraint organization_time_rules_multiplier_check check (sunday_multiplier >= 1),
  constraint organization_time_rules_maximum_check check (maximum_average_weekly_hours >= 1 and maximum_average_weekly_hours <= 168),
  constraint organization_time_rules_expense_rates_check check (
    kilometer_allowance_cents_per_km >= 0
    and partial_daily_allowance_cents >= 0
    and full_daily_allowance_cents >= partial_daily_allowance_cents
    and meal_allowance_cents >= 0
  )
);

insert into public.organization_time_rules(organization_id)
select id from public.organizations
on conflict (organization_id) do nothing;

create table if not exists public.payroll_periods (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  period_start date not null,
  period_end date not null,
  status text not null default 'Lukittu',
  notes text,
  created_by uuid references auth.users(id) on delete set null,
  locked_by uuid references auth.users(id) on delete set null,
  locked_at timestamptz,
  exported_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint payroll_period_dates_check check (period_end >= period_start),
  constraint payroll_period_status_check check (status in ('Lukittu', 'Viety')),
  constraint payroll_period_unique unique (organization_id, period_start, period_end)
);

alter table public.time_entries
  add column if not exists payroll_period_id uuid;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'time_entries_payroll_period_id_fkey'
      and conrelid = 'public.time_entries'::regclass
  ) then
    alter table public.time_entries
      add constraint time_entries_payroll_period_id_fkey
      foreign key (payroll_period_id) references public.payroll_periods(id) on delete restrict;
  end if;
end;
$$;

create index if not exists time_entries_payroll_period_idx
  on public.time_entries(organization_id, payroll_period_id)
  where payroll_period_id is not null;

create table if not exists public.payroll_period_time_lines (
  id uuid primary key default gen_random_uuid(),
  payroll_period_id uuid not null references public.payroll_periods(id) on delete cascade,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  employee_id uuid not null references public.employees(id) on delete restrict,
  employee_user_id uuid references auth.users(id) on delete set null,
  employee_name text not null,
  time_entry_id uuid not null references public.time_entries(id) on delete restrict,
  work_date date not null,
  project_name text not null,
  compensation_term_id uuid not null references public.employee_compensation_terms(id) on delete restrict,
  pay_type text not null,
  monthly_salary_cents bigint,
  hourly_wage_basis_cents numeric(12,4) not null,
  total_minutes integer not null,
  regular_minutes integer not null,
  additional_minutes integer not null,
  overtime_50_minutes integer not null,
  overtime_100_minutes integer not null,
  weekly_overtime_50_minutes integer not null,
  saturday_minutes integer not null,
  sunday_minutes integer not null,
  hourly_base_pay_cents bigint not null,
  overtime_premium_cents bigint not null,
  allowance_pay_cents bigint not null,
  sunday_premium_cents bigint not null,
  variable_pay_cents bigint not null,
  line_total_cents bigint not null,
  warnings text[] not null default '{}',
  calculation_snapshot jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  constraint payroll_period_time_line_unique unique (payroll_period_id, time_entry_id),
  constraint payroll_period_time_line_minutes_check check (
    total_minutes >= 0
    and regular_minutes >= 0
    and additional_minutes >= 0
    and overtime_50_minutes >= 0
    and overtime_100_minutes >= 0
    and weekly_overtime_50_minutes >= 0
    and saturday_minutes >= 0
    and sunday_minutes >= 0
  ),
  constraint payroll_period_time_line_amounts_check check (
    hourly_base_pay_cents >= 0
    and overtime_premium_cents >= 0
    and allowance_pay_cents >= 0
    and sunday_premium_cents >= 0
    and variable_pay_cents >= 0
    and line_total_cents >= 0
  )
);

create index if not exists payroll_period_time_lines_employee_idx
  on public.payroll_period_time_lines(organization_id, employee_id, work_date);

create table if not exists public.payroll_period_employee_summaries (
  id uuid primary key default gen_random_uuid(),
  payroll_period_id uuid not null references public.payroll_periods(id) on delete cascade,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  employee_id uuid not null references public.employees(id) on delete restrict,
  employee_user_id uuid references auth.users(id) on delete set null,
  employee_name text not null,
  entry_count integer not null,
  total_minutes integer not null,
  regular_minutes integer not null,
  additional_minutes integer not null,
  overtime_50_minutes integer not null,
  overtime_100_minutes integer not null,
  weekly_overtime_50_minutes integer not null,
  saturday_minutes integer not null,
  sunday_minutes integer not null,
  fixed_monthly_salary_cents bigint not null default 0,
  hourly_base_pay_cents bigint not null,
  variable_pay_cents bigint not null,
  estimated_total_cents bigint not null,
  warnings text[] not null default '{}',
  created_at timestamptz not null default now(),
  constraint payroll_period_employee_summary_unique unique (payroll_period_id, employee_id),
  constraint payroll_period_employee_summary_amounts_check check (
    fixed_monthly_salary_cents >= 0
    and hourly_base_pay_cents >= 0
    and variable_pay_cents >= 0
    and estimated_total_cents >= 0
  )
);

create index if not exists payroll_period_employee_summaries_employee_idx
  on public.payroll_period_employee_summaries(organization_id, employee_id, payroll_period_id);

create or replace function private.resolve_payroll_employee(
  p_organization_id uuid,
  p_employee_id uuid,
  p_user_id uuid,
  p_employee_label text
)
returns uuid
language sql
stable
security definer
set search_path = 'pg_catalog', 'public'
as $$
  select e.id
  from public.employees e
  where e.organization_id = p_organization_id
    and e.archived_at is null
    and (
      e.id = p_employee_id
      or (p_employee_id is null and p_user_id is not null and e.user_id = p_user_id)
      or (
        p_employee_id is null
        and p_user_id is null
        and p_employee_label is not null
        and lower(coalesce(e.email, '')) = lower(p_employee_label)
      )
    )
  order by
    case
      when e.id = p_employee_id then 1
      when p_user_id is not null and e.user_id = p_user_id then 2
      else 3
    end,
    e.created_at,
    e.id
  limit 1;
$$;

revoke all on function private.resolve_payroll_employee(uuid, uuid, uuid, text) from public, anon, authenticated;

create or replace function private.round_payroll_minutes(
  p_minutes numeric,
  p_increment integer,
  p_mode text
)
returns integer
language sql
immutable
set search_path = 'pg_catalog'
as $$
  select greatest(0, (
    case p_mode
      when 'floor' then floor(coalesce(p_minutes, 0) / greatest(p_increment, 1))
      when 'ceil' then ceil(coalesce(p_minutes, 0) / greatest(p_increment, 1))
      else round(coalesce(p_minutes, 0) / greatest(p_increment, 1))
    end * greatest(p_increment, 1)
  )::integer);
$$;

revoke all on function private.round_payroll_minutes(numeric, integer, text) from public, anon, authenticated;

create or replace function private.calculate_payroll_time_lines(
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
  saturday_minutes integer,
  sunday_minutes integer,
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
    coalesce(r.sunday_multiplier, 2)::numeric as sunday_multiplier
  from (select 1) seed
  left join public.organization_time_rules r
    on r.organization_id = p_organization_id
),
source_entries as (
  select
    te.id as time_entry_id,
    te.date as work_date,
    te.employee as reported_employee_name,
    te.project as project_name,
    te.hours,
    coalesce(te.overtime, 0) as reported_overtime,
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
    where e.id = private.resolve_payroll_employee(
      p_organization_id,
      te.employee_id,
      te.user_id,
      te.employee
    )
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
minutes as (
  select
    source_entries.*,
    private.round_payroll_minutes(
      (coalesce(hours, 0) + coalesce(reported_overtime, 0)) * 60,
      rounding_minutes,
      rounding_mode
    ) as total_minutes,
    round(coalesce(weekly_hours, contractual_weekly_hours) / 5 * 60)::integer as contractual_daily_minutes,
    round(statutory_daily_hours * 60)::integer as statutory_daily_minutes,
    round(statutory_weekly_hours * 60)::integer as statutory_weekly_minutes,
    round(daily_overtime_50_hours * 60)::integer as daily_overtime_50_limit_minutes,
    case
      when pay_type = 'Tuntipalkka' then hourly_wage_cents::numeric
      when pay_type = 'Kuukausipalkka' then monthly_salary_cents::numeric / nullif(monthly_salary_hour_divisor, 0)
      else null
    end as hourly_basis
  from source_entries
),
classified as (
  select
    minutes.*,
    least(total_minutes, least(contractual_daily_minutes, statutory_daily_minutes))::integer as regular_pre,
    least(
      greatest(total_minutes - least(contractual_daily_minutes, statutory_daily_minutes), 0),
      greatest(statutory_daily_minutes - least(contractual_daily_minutes, statutory_daily_minutes), 0)
    )::integer as additional_pre,
    least(
      greatest(total_minutes - statutory_daily_minutes, 0),
      daily_overtime_50_limit_minutes
    )::integer as daily_overtime_50_minutes,
    greatest(
      total_minutes - statutory_daily_minutes - daily_overtime_50_limit_minutes,
      0
    )::integer as daily_overtime_100_minutes
  from minutes
),
weekly_context as (
  select
    classified.*,
    (regular_pre + additional_pre)::integer as non_daily_minutes,
    coalesce(
      sum(regular_pre + additional_pre) over (
        partition by coalesce(employee_id::text, 'unresolved:' || time_entry_id::text), date_trunc('week', work_date::timestamp)
        order by work_date, created_at, time_entry_id
        rows between unbounded preceding and 1 preceding
      ),
      0
    )::integer as prior_week_minutes
  from classified
),
weekly_classified as (
  select
    weekly_context.*,
    least(
      non_daily_minutes,
      greatest(prior_week_minutes + non_daily_minutes - statutory_weekly_minutes, 0)
    )::integer as weekly_overtime_50_minutes
  from weekly_context
),
final_minutes as (
  select
    weekly_classified.*,
    greatest(
      regular_pre - greatest(weekly_overtime_50_minutes - additional_pre, 0),
      0
    )::integer as regular_minutes,
    greatest(
      additional_pre - least(additional_pre, weekly_overtime_50_minutes),
      0
    )::integer as additional_minutes,
    case when extract(isodow from work_date) = 6 then total_minutes else 0 end::integer as saturday_minutes,
    case when extract(isodow from work_date) = 7 then total_minutes else 0 end::integer as sunday_minutes
  from weekly_classified
),
amounts as (
  select
    final_minutes.*,
    case
      when pay_type = 'Tuntipalkka' and hourly_basis is not null
        then round(total_minutes * hourly_basis / 60)::bigint
      else 0::bigint
    end as hourly_base_pay_cents,
    case when hourly_basis is null then 0::bigint else round(
      daily_overtime_50_minutes * hourly_basis / 60 * (coalesce(overtime_50_multiplier, 1.5) - 1)
      + daily_overtime_100_minutes * hourly_basis / 60 * (coalesce(overtime_100_multiplier, 2) - 1)
      + weekly_overtime_50_minutes * hourly_basis / 60 * (coalesce(overtime_50_multiplier, 1.5) - 1)
    )::bigint end as overtime_premium_cents,
    round(
      saturday_minutes * coalesce(saturday_allowance_cents, 0) / 60.0
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
  amounts.saturday_minutes,
  amounts.sunday_minutes,
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
    case when amounts.compensation_term_id is not null and (coalesce(amounts.evening_allowance_cents, 0) > 0 or coalesce(amounts.night_allowance_cents, 0) > 0)
      then 'Ilta- tai yötyölisää ei voi laskea ilman alkamis- ja päättymisaikoja.' end
  ]::text[], null) as blockers,
  array_remove(array[
    case when amounts.reported_overtime > 0 then 'Käsin merkitty ylityö luokitellaan uudelleen organisaation sääntöjen perusteella.' end,
    case when amounts.pay_type = 'Kuukausipalkka' then 'Rivisumma sisältää kuukausipalkkaisella vain muuttuvat erät; kiinteä kuukausipalkka lisätään yhteenvetoon vain täydeltä kalenterikuukaudelta.' end
  ]::text[], null) as warnings,
  jsonb_build_object(
    'rule_version', 1,
    'contractual_daily_minutes', amounts.contractual_daily_minutes,
    'statutory_daily_minutes', amounts.statutory_daily_minutes,
    'statutory_weekly_minutes', amounts.statutory_weekly_minutes,
    'rounding_minutes', amounts.rounding_minutes,
    'rounding_mode', amounts.rounding_mode,
    'reported_hours', amounts.hours,
    'reported_overtime', amounts.reported_overtime,
    'hourly_wage_basis_cents', amounts.hourly_basis
  ) as calculation_snapshot
from amounts
where amounts.work_date between p_period_start and p_period_end;
$$;

revoke all on function private.calculate_payroll_time_lines(uuid, date, date) from public, anon, authenticated;

create or replace function public.list_payroll_preview(
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
  saturday_minutes integer,
  sunday_minutes integer,
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
  from private.calculate_payroll_time_lines(p_organization_id, p_period_start, p_period_end) lines
  where v_is_admin
    or (lines.employee_id is not null and private.can_access_employee_hr(p_organization_id, lines.employee_id));
end;
$$;

revoke all on function public.list_payroll_preview(uuid, date, date) from public, anon;
grant execute on function public.list_payroll_preview(uuid, date, date) to authenticated;

create or replace function public.list_payroll_periods(p_organization_id uuid)
returns table (
  id uuid,
  period_start date,
  period_end date,
  status text,
  notes text,
  locked_by uuid,
  locked_at timestamptz,
  exported_at timestamptz,
  created_at timestamptz,
  employee_count bigint,
  estimated_total_cents bigint
)
language plpgsql
stable
security definer
set search_path = 'pg_catalog', 'public'
as $$
begin
  if not private.has_org_role(p_organization_id, array['admin','supervisor']::text[]) then
    raise exception 'Palkkakausien tarkastelu vaatii admin- tai työnjohtajaroolin.' using errcode = '42501';
  end if;

  return query
  select
    pp.id,
    pp.period_start,
    pp.period_end,
    pp.status,
    pp.notes,
    pp.locked_by,
    pp.locked_at,
    pp.exported_at,
    pp.created_at,
    count(distinct case
      when private.has_org_role(p_organization_id, array['admin']::text[])
        or private.can_access_employee_hr(p_organization_id, summary.employee_id)
      then summary.employee_id
    end) as employee_count,
    coalesce(sum(case
      when private.has_org_role(p_organization_id, array['admin']::text[])
        or private.can_access_employee_hr(p_organization_id, summary.employee_id)
      then summary.estimated_total_cents
      else 0
    end), 0)::bigint as estimated_total_cents
  from public.payroll_periods pp
  left join public.payroll_period_employee_summaries summary
    on summary.payroll_period_id = pp.id
  where pp.organization_id = p_organization_id
  group by pp.id
  order by pp.period_start desc, pp.created_at desc;
end;
$$;

revoke all on function public.list_payroll_periods(uuid) from public, anon;
grant execute on function public.list_payroll_periods(uuid) to authenticated;

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
  from private.calculate_payroll_time_lines(p_organization_id, p_period_start, p_period_end);

  if v_line_count = 0 then
    raise exception 'Valitulla palkkakaudella ei ole hyväksyttyjä tuntikirjauksia.' using errcode = '23514';
  end if;

  select count(*) into v_blocker_count
  from private.calculate_payroll_time_lines(p_organization_id, p_period_start, p_period_end) lines
  where cardinality(lines.blockers) > 0;

  if v_blocker_count > 0 then
    raise exception 'Palkkakaudella on % estävää puutetta. Korjaa puutteet ennen lukitusta.', v_blocker_count using errcode = '23514';
  end if;

  insert into public.payroll_periods(
    organization_id,
    period_start,
    period_end,
    status,
    notes,
    created_by,
    locked_by,
    locked_at
  ) values (
    p_organization_id,
    p_period_start,
    p_period_end,
    'Lukittu',
    nullif(trim(coalesce(p_notes, '')), ''),
    auth.uid(),
    auth.uid(),
    now()
  ) returning id into v_period_id;

  insert into public.payroll_period_time_lines(
    payroll_period_id,
    organization_id,
    employee_id,
    employee_user_id,
    employee_name,
    time_entry_id,
    work_date,
    project_name,
    compensation_term_id,
    pay_type,
    monthly_salary_cents,
    hourly_wage_basis_cents,
    total_minutes,
    regular_minutes,
    additional_minutes,
    overtime_50_minutes,
    overtime_100_minutes,
    weekly_overtime_50_minutes,
    saturday_minutes,
    sunday_minutes,
    hourly_base_pay_cents,
    overtime_premium_cents,
    allowance_pay_cents,
    sunday_premium_cents,
    variable_pay_cents,
    line_total_cents,
    warnings,
    calculation_snapshot
  )
  select
    v_period_id,
    p_organization_id,
    lines.employee_id,
    lines.employee_user_id,
    lines.employee_name,
    lines.time_entry_id,
    lines.work_date,
    lines.project_name,
    lines.compensation_term_id,
    lines.pay_type,
    lines.monthly_salary_cents,
    lines.hourly_wage_basis_cents,
    lines.total_minutes,
    lines.regular_minutes,
    lines.additional_minutes,
    lines.overtime_50_minutes,
    lines.overtime_100_minutes,
    lines.weekly_overtime_50_minutes,
    lines.saturday_minutes,
    lines.sunday_minutes,
    lines.hourly_base_pay_cents,
    lines.overtime_premium_cents,
    lines.allowance_pay_cents,
    lines.sunday_premium_cents,
    lines.variable_pay_cents,
    lines.line_total_cents,
    lines.warnings,
    lines.calculation_snapshot
  from private.calculate_payroll_time_lines(p_organization_id, p_period_start, p_period_end) lines;

  v_full_calendar_month := p_period_start = date_trunc('month', p_period_start::timestamp)::date
    and p_period_end = (date_trunc('month', p_period_start::timestamp) + interval '1 month - 1 day')::date;

  insert into public.payroll_period_employee_summaries(
    payroll_period_id,
    organization_id,
    employee_id,
    employee_user_id,
    employee_name,
    entry_count,
    total_minutes,
    regular_minutes,
    additional_minutes,
    overtime_50_minutes,
    overtime_100_minutes,
    weekly_overtime_50_minutes,
    saturday_minutes,
    sunday_minutes,
    fixed_monthly_salary_cents,
    hourly_base_pay_cents,
    variable_pay_cents,
    estimated_total_cents,
    warnings
  )
  select
    v_period_id,
    p_organization_id,
    lines.employee_id,
    max(lines.employee_user_id),
    max(lines.employee_name),
    count(*)::integer,
    sum(lines.total_minutes)::integer,
    sum(lines.regular_minutes)::integer,
    sum(lines.additional_minutes)::integer,
    sum(lines.overtime_50_minutes)::integer,
    sum(lines.overtime_100_minutes)::integer,
    sum(lines.weekly_overtime_50_minutes)::integer,
    sum(lines.saturday_minutes)::integer,
    sum(lines.sunday_minutes)::integer,
    case
      when v_full_calendar_month and bool_or(lines.pay_type = 'Kuukausipalkka')
        then max(coalesce(lines.monthly_salary_cents, 0))
      else 0
    end::bigint,
    sum(lines.hourly_base_pay_cents)::bigint,
    sum(lines.variable_pay_cents)::bigint,
    (
      sum(lines.hourly_base_pay_cents)
      + sum(lines.variable_pay_cents)
      + case
          when v_full_calendar_month and bool_or(lines.pay_type = 'Kuukausipalkka')
            then max(coalesce(lines.monthly_salary_cents, 0))
          else 0
        end
    )::bigint,
    array(
      select distinct warning
      from public.payroll_period_time_lines detail
      cross join unnest(detail.warnings) warning
      where detail.payroll_period_id = v_period_id
        and detail.employee_id = lines.employee_id
      order by warning
    )
  from private.calculate_payroll_time_lines(p_organization_id, p_period_start, p_period_end) lines
  group by lines.employee_id;

  perform set_config('vakantti.payroll_lock', 'on', true);
  update public.time_entries
  set payroll_period_id = v_period_id,
      locked_at = now()
  where organization_id = p_organization_id
    and status = 'Hyväksytty'
    and date between p_period_start and p_period_end;

  insert into public.audit_logs(organization_id, user_id, action, table_name, record_id, metadata)
  values (
    p_organization_id,
    auth.uid(),
    'payroll_period_locked',
    'payroll_periods',
    v_period_id,
    jsonb_build_object(
      'period_start', p_period_start,
      'period_end', p_period_end,
      'time_entry_count', v_line_count,
      'sensitive_values_recorded', false
    )
  );

  return v_period_id;
end;
$$;

revoke all on function public.lock_payroll_period(uuid, date, date, text) from public, anon;
grant execute on function public.lock_payroll_period(uuid, date, date, text) to authenticated;

create or replace function private.audit_time_rules_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.audit_logs(organization_id, user_id, action, table_name, record_id, metadata)
  values (
    coalesce(new.organization_id, old.organization_id),
    auth.uid(),
    lower(tg_op),
    'organization_time_rules',
    coalesce(new.organization_id, old.organization_id),
    jsonb_build_object('sensitive_values_recorded', false)
  );
  return coalesce(new, old);
end;
$$;

revoke all on function private.audit_time_rules_change() from public, anon, authenticated;

drop trigger if exists audit_organization_time_rules on public.organization_time_rules;
create trigger audit_organization_time_rules
after insert or update or delete on public.organization_time_rules
for each row execute function private.audit_time_rules_change();

create or replace function private.set_time_rules_updated_at()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  new.updated_at := now();
  if auth.uid() is not null then
    new.updated_by := auth.uid();
  end if;
  return new;
end;
$$;

revoke all on function private.set_time_rules_updated_at() from public, anon, authenticated;

drop trigger if exists set_organization_time_rules_updated_at on public.organization_time_rules;
create trigger set_organization_time_rules_updated_at
before update on public.organization_time_rules
for each row execute function private.set_time_rules_updated_at();

create or replace function private.enforce_time_entry_workflow()
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
  if tg_op = 'INSERT' then
    target_org_id := new.organization_id;
  else
    target_org_id := coalesce(new.organization_id, old.organization_id);
  end if;

  is_manager := private.has_org_role(target_org_id, array['admin','supervisor']::text[]);
  payroll_lock_context := coalesce(current_setting('vakantti.payroll_lock', true), '') = 'on';

  if tg_op = 'INSERT' then
    if not is_manager then
      new.user_id := auth.uid();
      new.created_by := auth.uid();
      new.status := 'Odottaa';
      new.approved_by := null;
      new.approved_at := null;
      new.rejection_reason := null;
      new.locked_at := null;
      new.payroll_period_id := null;
    end if;
    return new;
  end if;

  if old.locked_at is not null then
    raise exception 'Lukittua palkkakauden tuntikirjausta ei voi muuttaa. Tee korjaus erillisellä korjausketjulla.' using errcode = '42501';
  end if;

  if (new.locked_at is distinct from old.locked_at or new.payroll_period_id is distinct from old.payroll_period_id)
     and not payroll_lock_context then
    raise exception 'Palkkakausilukituksen voi tehdä vain palkka-aineiston lukitustoiminnolla.' using errcode = '42501';
  end if;

  if not is_manager then
    if old.user_id is distinct from auth.uid() and old.created_by is distinct from auth.uid() then
      raise exception 'Voit muuttaa vain omaa tuntikirjaustasi.' using errcode = '42501';
    end if;
    if old.status <> 'Odottaa' then
      raise exception 'Vain odottavaa tuntikirjausta voi muuttaa.' using errcode = '42501';
    end if;
    if new.organization_id is distinct from old.organization_id
       or new.user_id is distinct from old.user_id
       or new.employee_id is distinct from old.employee_id
       or new.created_by is distinct from old.created_by
       or new.status is distinct from old.status
       or new.approved_by is distinct from old.approved_by
       or new.approved_at is distinct from old.approved_at
       or new.rejection_reason is distinct from old.rejection_reason
       or new.locked_at is distinct from old.locked_at
       or new.payroll_period_id is distinct from old.payroll_period_id then
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

revoke all on function private.enforce_time_entry_workflow() from public, anon, authenticated;

alter table public.organization_time_rules enable row level security;
alter table public.payroll_periods enable row level security;
alter table public.payroll_period_time_lines enable row level security;
alter table public.payroll_period_employee_summaries enable row level security;

drop policy if exists organization_time_rules_select on public.organization_time_rules;
create policy organization_time_rules_select on public.organization_time_rules
for select to authenticated
using (private.has_org_role(organization_id, array['admin','supervisor','worker']::text[]));

drop policy if exists organization_time_rules_insert on public.organization_time_rules;
create policy organization_time_rules_insert on public.organization_time_rules
for insert to authenticated
with check (
  private.has_org_role(organization_id, array['admin']::text[])
  and created_by = (select auth.uid())
  and updated_by = (select auth.uid())
);

drop policy if exists organization_time_rules_update on public.organization_time_rules;
create policy organization_time_rules_update on public.organization_time_rules
for update to authenticated
using (private.has_org_role(organization_id, array['admin']::text[]))
with check (private.has_org_role(organization_id, array['admin']::text[]));

drop policy if exists organization_time_rules_delete on public.organization_time_rules;
create policy organization_time_rules_delete on public.organization_time_rules
for delete to authenticated
using (private.has_org_role(organization_id, array['admin']::text[]));

drop policy if exists payroll_periods_select on public.payroll_periods;
create policy payroll_periods_select on public.payroll_periods
for select to authenticated
using (private.has_org_role(organization_id, array['admin','supervisor']::text[]));

drop policy if exists payroll_period_time_lines_select on public.payroll_period_time_lines;
create policy payroll_period_time_lines_select on public.payroll_period_time_lines
for select to authenticated
using (
  private.has_org_role(organization_id, array['admin']::text[])
  or private.can_access_employee_hr(organization_id, employee_id)
);

drop policy if exists payroll_period_employee_summaries_select on public.payroll_period_employee_summaries;
create policy payroll_period_employee_summaries_select on public.payroll_period_employee_summaries
for select to authenticated
using (
  private.has_org_role(organization_id, array['admin']::text[])
  or private.can_access_employee_hr(organization_id, employee_id)
);

revoke all on table public.organization_time_rules from anon, authenticated;
grant select, insert, update, delete on table public.organization_time_rules to authenticated;

revoke all on table public.payroll_periods from anon, authenticated;
revoke all on table public.payroll_period_time_lines from anon, authenticated;
revoke all on table public.payroll_period_employee_summaries from anon, authenticated;
grant select on table public.payroll_periods to authenticated;
grant select on table public.payroll_period_time_lines to authenticated;
grant select on table public.payroll_period_employee_summaries to authenticated;

create index if not exists payroll_periods_org_dates_idx
  on public.payroll_periods(organization_id, period_start desc, period_end desc);

commit;
