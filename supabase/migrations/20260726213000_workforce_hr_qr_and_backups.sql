begin;

create extension if not exists pgcrypto with schema extensions;
create extension if not exists pg_net with schema extensions;
create extension if not exists pg_cron with schema pg_catalog;

create table if not exists public.supervisor_team_members (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  supervisor_user_id uuid not null references auth.users(id) on delete cascade,
  employee_id uuid not null references public.employees(id) on delete cascade,
  assigned_by uuid references auth.users(id) on delete set null,
  is_active boolean not null default true,
  assigned_at timestamptz not null default now(),
  removed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint supervisor_team_members_removed_check check (
    (is_active and removed_at is null) or (not is_active)
  ),
  constraint supervisor_team_members_unique unique (organization_id, supervisor_user_id, employee_id)
);

create index if not exists supervisor_team_members_supervisor_idx
  on public.supervisor_team_members(organization_id, supervisor_user_id)
  where is_active;
create index if not exists supervisor_team_members_employee_idx
  on public.supervisor_team_members(organization_id, employee_id)
  where is_active;

create table if not exists public.employee_hr_profiles (
  employee_id uuid primary key references public.employees(id) on delete cascade,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  date_of_birth date,
  street_address text,
  postal_code text,
  city text,
  country text not null default 'Suomi',
  personal_identity_code_last4 text,
  iban text,
  bic text,
  tax_percent numeric(5,2),
  additional_tax_percent numeric(5,2),
  tax_income_limit_cents bigint,
  tax_card_valid_from date,
  tax_card_valid_to date,
  union_name text,
  occupational_health_provider text,
  employment_notes text,
  payroll_notes text,
  updated_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint employee_hr_profiles_tax_percent_check check (tax_percent is null or (tax_percent >= 0 and tax_percent <= 100)),
  constraint employee_hr_profiles_additional_tax_percent_check check (additional_tax_percent is null or (additional_tax_percent >= 0 and additional_tax_percent <= 100)),
  constraint employee_hr_profiles_income_limit_check check (tax_income_limit_cents is null or tax_income_limit_cents >= 0),
  constraint employee_hr_profiles_tax_dates_check check (tax_card_valid_to is null or tax_card_valid_from is null or tax_card_valid_to >= tax_card_valid_from),
  constraint employee_hr_profiles_identity_suffix_check check (personal_identity_code_last4 is null or personal_identity_code_last4 ~ '^[A-Za-z0-9+-]{4}$')
);

create table if not exists public.employee_compensation_terms (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  employee_id uuid not null references public.employees(id) on delete cascade,
  valid_from date not null,
  valid_to date,
  pay_type text not null,
  monthly_salary_cents bigint,
  hourly_wage_cents bigint,
  weekly_hours numeric(5,2) not null default 37.5,
  collective_agreement text,
  pay_period text not null default 'Kuukausi',
  evening_allowance_cents bigint not null default 0,
  night_allowance_cents bigint not null default 0,
  saturday_allowance_cents bigint not null default 0,
  sunday_allowance_cents bigint not null default 0,
  overtime_50_multiplier numeric(5,2) not null default 1.50,
  overtime_100_multiplier numeric(5,2) not null default 2.00,
  daily_allowance_cents bigint not null default 0,
  meal_allowance_cents bigint not null default 0,
  travel_time_hourly_cents bigint not null default 0,
  currency text not null default 'EUR',
  notes text,
  created_by uuid references auth.users(id) on delete set null,
  updated_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint employee_compensation_dates_check check (valid_to is null or valid_to >= valid_from),
  constraint employee_compensation_pay_type_check check (pay_type in ('Kuukausipalkka', 'Tuntipalkka')),
  constraint employee_compensation_salary_check check (
    (pay_type = 'Kuukausipalkka' and monthly_salary_cents is not null and monthly_salary_cents >= 0)
    or (pay_type = 'Tuntipalkka' and hourly_wage_cents is not null and hourly_wage_cents >= 0)
  ),
  constraint employee_compensation_weekly_hours_check check (weekly_hours > 0 and weekly_hours <= 168),
  constraint employee_compensation_nonnegative_check check (
    coalesce(monthly_salary_cents, 0) >= 0
    and coalesce(hourly_wage_cents, 0) >= 0
    and evening_allowance_cents >= 0
    and night_allowance_cents >= 0
    and saturday_allowance_cents >= 0
    and sunday_allowance_cents >= 0
    and daily_allowance_cents >= 0
    and meal_allowance_cents >= 0
    and travel_time_hourly_cents >= 0
  ),
  constraint employee_compensation_multipliers_check check (
    overtime_50_multiplier >= 1 and overtime_100_multiplier >= overtime_50_multiplier
  )
);

create index if not exists employee_compensation_employee_dates_idx
  on public.employee_compensation_terms(organization_id, employee_id, valid_from desc);

create table if not exists public.work_site_qr_tokens (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  project_id uuid not null references public.projects(id) on delete cascade,
  token_hash bytea not null unique,
  label text,
  require_geofence boolean not null default true,
  expires_at timestamptz,
  is_active boolean not null default true,
  created_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  last_used_at timestamptz,
  use_count bigint not null default 0,
  constraint work_site_qr_tokens_use_count_check check (use_count >= 0)
);

create index if not exists work_site_qr_tokens_project_idx
  on public.work_site_qr_tokens(organization_id, project_id, is_active);

create table if not exists public.backup_cron_settings (
  id boolean primary key default true check (id),
  secret_hash bytea not null,
  enabled boolean not null default true,
  retention_days smallint not null default 30 check (retention_days between 7 and 365),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.backup_runs (
  id uuid primary key default gen_random_uuid(),
  status text not null default 'running',
  triggered_by text not null default 'cron',
  storage_prefix text,
  table_count integer not null default 0,
  row_count bigint not null default 0,
  file_count bigint not null default 0,
  total_bytes bigint not null default 0,
  error_message text,
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  created_at timestamptz not null default now(),
  constraint backup_runs_status_check check (status in ('running', 'completed', 'failed'))
);

create or replace function private.validate_supervisor_team_member()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not exists (
    select 1 from public.organization_members om
    where om.organization_id = new.organization_id
      and om.user_id = new.supervisor_user_id
      and om.role = 'supervisor'
  ) then
    raise exception 'Valitun henkilön pitää olla organisaation työnjohtaja.' using errcode = '23514';
  end if;

  if not exists (
    select 1 from public.employees e
    where e.id = new.employee_id
      and e.organization_id = new.organization_id
      and e.archived_at is null
  ) then
    raise exception 'Työntekijä ei kuulu samaan organisaatioon.' using errcode = '23514';
  end if;

  if new.is_active then
    new.removed_at := null;
  elsif new.removed_at is null then
    new.removed_at := now();
  end if;
  new.updated_at := now();
  return new;
end;
$$;

revoke all on function private.validate_supervisor_team_member() from public, anon, authenticated;
drop trigger if exists validate_supervisor_team_member on public.supervisor_team_members;
create trigger validate_supervisor_team_member
before insert or update on public.supervisor_team_members
for each row execute function private.validate_supervisor_team_member();

create or replace function private.validate_employee_hr_organization()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not exists (
    select 1 from public.employees e
    where e.id = new.employee_id and e.organization_id = new.organization_id
  ) then
    raise exception 'Työntekijä ei kuulu HR-tiedon organisaatioon.' using errcode = '23514';
  end if;
  new.updated_at := now();
  return new;
end;
$$;

revoke all on function private.validate_employee_hr_organization() from public, anon, authenticated;
drop trigger if exists validate_employee_hr_profile_organization on public.employee_hr_profiles;
create trigger validate_employee_hr_profile_organization
before insert or update on public.employee_hr_profiles
for each row execute function private.validate_employee_hr_organization();
drop trigger if exists validate_employee_compensation_organization on public.employee_compensation_terms;
create trigger validate_employee_compensation_organization
before insert or update on public.employee_compensation_terms
for each row execute function private.validate_employee_hr_organization();

create or replace function private.prevent_compensation_overlap()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if exists (
    select 1
    from public.employee_compensation_terms other
    where other.employee_id = new.employee_id
      and other.organization_id = new.organization_id
      and other.id <> coalesce(new.id, gen_random_uuid())
      and daterange(other.valid_from, coalesce(other.valid_to, 'infinity'::date), '[]')
          && daterange(new.valid_from, coalesce(new.valid_to, 'infinity'::date), '[]')
  ) then
    raise exception 'Palkkaehtojen voimassaolojaksot eivät saa mennä päällekkäin.' using errcode = '23P01';
  end if;
  return new;
end;
$$;

revoke all on function private.prevent_compensation_overlap() from public, anon, authenticated;
drop trigger if exists prevent_compensation_overlap on public.employee_compensation_terms;
create trigger prevent_compensation_overlap
before insert or update on public.employee_compensation_terms
for each row execute function private.prevent_compensation_overlap();

create or replace function private.can_access_employee_hr(p_organization_id uuid, p_employee_id uuid)
returns boolean
language sql
stable
security definer
set search_path = 'pg_catalog', 'public'
as $$
  select auth.uid() is not null and (
    private.has_org_role(p_organization_id, array['admin']::text[])
    or exists (
      select 1 from public.employees e
      where e.id = p_employee_id
        and e.organization_id = p_organization_id
        and e.user_id = auth.uid()
    )
    or (
      private.has_org_role(p_organization_id, array['supervisor']::text[])
      and exists (
        select 1 from public.supervisor_team_members stm
        where stm.organization_id = p_organization_id
          and stm.employee_id = p_employee_id
          and stm.supervisor_user_id = auth.uid()
          and stm.is_active
      )
    )
  );
$$;

revoke all on function private.can_access_employee_hr(uuid, uuid) from public, anon, authenticated;

create or replace function private.audit_sensitive_employee_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  target_id uuid;
  target_org uuid;
begin
  target_id := case when tg_table_name = 'employee_hr_profiles'
    then coalesce(new.employee_id, old.employee_id)
    else coalesce(new.id, old.id)
  end;
  target_org := coalesce(new.organization_id, old.organization_id);

  insert into public.audit_logs(organization_id, user_id, action, table_name, record_id, metadata)
  values (
    target_org,
    auth.uid(),
    lower(tg_op),
    tg_table_name,
    target_id,
    jsonb_build_object('sensitive_values_recorded', false)
  );
  return coalesce(new, old);
end;
$$;

revoke all on function private.audit_sensitive_employee_change() from public, anon, authenticated;

drop trigger if exists audit_supervisor_team_members on public.supervisor_team_members;
create trigger audit_supervisor_team_members
after insert or update or delete on public.supervisor_team_members
for each row execute function private.audit_sensitive_employee_change();
drop trigger if exists audit_employee_hr_profiles on public.employee_hr_profiles;
create trigger audit_employee_hr_profiles
after insert or update or delete on public.employee_hr_profiles
for each row execute function private.audit_sensitive_employee_change();
drop trigger if exists audit_employee_compensation_terms on public.employee_compensation_terms;
create trigger audit_employee_compensation_terms
after insert or update or delete on public.employee_compensation_terms
for each row execute function private.audit_sensitive_employee_change();

alter table public.supervisor_team_members enable row level security;
alter table public.employee_hr_profiles enable row level security;
alter table public.employee_compensation_terms enable row level security;
alter table public.work_site_qr_tokens enable row level security;
alter table public.backup_cron_settings enable row level security;
alter table public.backup_runs enable row level security;

drop policy if exists supervisor_team_members_select on public.supervisor_team_members;
create policy supervisor_team_members_select on public.supervisor_team_members
for select to authenticated
using (
  private.has_org_role(organization_id, array['admin']::text[])
  or (supervisor_user_id = auth.uid() and private.has_org_role(organization_id, array['supervisor']::text[]))
);
drop policy if exists supervisor_team_members_insert on public.supervisor_team_members;
create policy supervisor_team_members_insert on public.supervisor_team_members
for insert to authenticated
with check (private.has_org_role(organization_id, array['admin']::text[]) and assigned_by = auth.uid());
drop policy if exists supervisor_team_members_update on public.supervisor_team_members;
create policy supervisor_team_members_update on public.supervisor_team_members
for update to authenticated
using (private.has_org_role(organization_id, array['admin']::text[]))
with check (private.has_org_role(organization_id, array['admin']::text[]));
drop policy if exists supervisor_team_members_delete on public.supervisor_team_members;
create policy supervisor_team_members_delete on public.supervisor_team_members
for delete to authenticated
using (private.has_org_role(organization_id, array['admin']::text[]));

drop policy if exists employee_hr_profiles_select on public.employee_hr_profiles;
create policy employee_hr_profiles_select on public.employee_hr_profiles
for select to authenticated
using (private.can_access_employee_hr(organization_id, employee_id));
drop policy if exists employee_hr_profiles_insert on public.employee_hr_profiles;
create policy employee_hr_profiles_insert on public.employee_hr_profiles
for insert to authenticated
with check (private.has_org_role(organization_id, array['admin']::text[]) and updated_by = auth.uid());
drop policy if exists employee_hr_profiles_update on public.employee_hr_profiles;
create policy employee_hr_profiles_update on public.employee_hr_profiles
for update to authenticated
using (private.has_org_role(organization_id, array['admin']::text[]))
with check (private.has_org_role(organization_id, array['admin']::text[]) and updated_by = auth.uid());
drop policy if exists employee_hr_profiles_delete on public.employee_hr_profiles;
create policy employee_hr_profiles_delete on public.employee_hr_profiles
for delete to authenticated
using (private.has_org_role(organization_id, array['admin']::text[]));

drop policy if exists employee_compensation_terms_select on public.employee_compensation_terms;
create policy employee_compensation_terms_select on public.employee_compensation_terms
for select to authenticated
using (private.can_access_employee_hr(organization_id, employee_id));
drop policy if exists employee_compensation_terms_insert on public.employee_compensation_terms;
create policy employee_compensation_terms_insert on public.employee_compensation_terms
for insert to authenticated
with check (
  private.has_org_role(organization_id, array['admin']::text[])
  and created_by = auth.uid() and updated_by = auth.uid()
);
drop policy if exists employee_compensation_terms_update on public.employee_compensation_terms;
create policy employee_compensation_terms_update on public.employee_compensation_terms
for update to authenticated
using (private.has_org_role(organization_id, array['admin']::text[]))
with check (private.has_org_role(organization_id, array['admin']::text[]) and updated_by = auth.uid());
drop policy if exists employee_compensation_terms_delete on public.employee_compensation_terms;
create policy employee_compensation_terms_delete on public.employee_compensation_terms
for delete to authenticated
using (private.has_org_role(organization_id, array['admin']::text[]));

drop policy if exists backup_runs_select on public.backup_runs;
create policy backup_runs_select on public.backup_runs
for select to authenticated
using (exists (
  select 1 from public.organization_members om
  where om.user_id = auth.uid() and om.role = 'admin'
));

grant select, insert, update, delete on public.supervisor_team_members to authenticated;
grant select, insert, update, delete on public.employee_hr_profiles to authenticated;
grant select, insert, update, delete on public.employee_compensation_terms to authenticated;
grant select on public.backup_runs to authenticated;
revoke all on public.work_site_qr_tokens from anon, authenticated;
revoke all on public.backup_cron_settings from anon, authenticated;

create or replace function public.set_supervisor_team(
  p_organization_id uuid,
  p_supervisor_user_id uuid,
  p_employee_ids uuid[]
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not private.has_org_role(p_organization_id, array['admin']::text[]) then
    raise exception 'Vain admin voi määrittää työnjohtajan oman tiimin.' using errcode = '42501';
  end if;

  if not exists (
    select 1 from public.organization_members om
    where om.organization_id = p_organization_id
      and om.user_id = p_supervisor_user_id
      and om.role = 'supervisor'
  ) then
    raise exception 'Valittu käyttäjä ei ole työnjohtaja.' using errcode = '23514';
  end if;

  if exists (
    select 1 from unnest(coalesce(p_employee_ids, array[]::uuid[])) requested(employee_id)
    left join public.employees e
      on e.id = requested.employee_id and e.organization_id = p_organization_id and e.archived_at is null
    where e.id is null
  ) then
    raise exception 'Tiimilista sisältää organisaatioon kuulumattoman työntekijän.' using errcode = '23514';
  end if;

  update public.supervisor_team_members
  set is_active = false, removed_at = now(), updated_at = now()
  where organization_id = p_organization_id
    and supervisor_user_id = p_supervisor_user_id
    and is_active
    and not (employee_id = any(coalesce(p_employee_ids, array[]::uuid[])));

  insert into public.supervisor_team_members(
    organization_id, supervisor_user_id, employee_id, assigned_by, is_active, assigned_at, removed_at
  )
  select p_organization_id, p_supervisor_user_id, employee_id, auth.uid(), true, now(), null
  from unnest(coalesce(p_employee_ids, array[]::uuid[])) requested(employee_id)
  on conflict (organization_id, supervisor_user_id, employee_id)
  do update set
    is_active = true,
    assigned_by = auth.uid(),
    assigned_at = now(),
    removed_at = null,
    updated_at = now();
end;
$$;

revoke all on function public.set_supervisor_team(uuid, uuid, uuid[]) from public, anon;
grant execute on function public.set_supervisor_team(uuid, uuid, uuid[]) to authenticated;

create or replace function public.list_accessible_employee_cards(p_organization_id uuid)
returns table (
  employee_id uuid,
  user_id uuid,
  employee_name text,
  employee_role text,
  department text,
  email text,
  phone text,
  employment_type text,
  start_date date,
  employee_status text,
  supervisor_names text[],
  street_address text,
  postal_code text,
  city text,
  country text,
  date_of_birth date,
  personal_identity_code_last4 text,
  iban text,
  bic text,
  tax_percent numeric,
  additional_tax_percent numeric,
  tax_income_limit_cents bigint,
  tax_card_valid_from date,
  tax_card_valid_to date,
  union_name text,
  occupational_health_provider text,
  employment_notes text,
  payroll_notes text,
  compensation_id uuid,
  pay_type text,
  monthly_salary_cents bigint,
  hourly_wage_cents bigint,
  weekly_hours numeric,
  collective_agreement text,
  pay_period text,
  evening_allowance_cents bigint,
  night_allowance_cents bigint,
  saturday_allowance_cents bigint,
  sunday_allowance_cents bigint,
  overtime_50_multiplier numeric,
  overtime_100_multiplier numeric,
  daily_allowance_cents bigint,
  meal_allowance_cents bigint,
  travel_time_hourly_cents bigint,
  compensation_valid_from date,
  compensation_valid_to date,
  compensation_notes text
)
language sql
stable
security definer
set search_path = 'pg_catalog', 'public'
as $$
  select
    e.id,
    e.user_id,
    e.name,
    e.role,
    e.department,
    e.email,
    e.phone,
    e.employment_type,
    e.start_date,
    e.status,
    coalesce(supervisors.names, array[]::text[]),
    hr.street_address,
    hr.postal_code,
    hr.city,
    hr.country,
    hr.date_of_birth,
    hr.personal_identity_code_last4,
    hr.iban,
    hr.bic,
    hr.tax_percent,
    hr.additional_tax_percent,
    hr.tax_income_limit_cents,
    hr.tax_card_valid_from,
    hr.tax_card_valid_to,
    hr.union_name,
    hr.occupational_health_provider,
    hr.employment_notes,
    hr.payroll_notes,
    compensation.id,
    compensation.pay_type,
    compensation.monthly_salary_cents,
    compensation.hourly_wage_cents,
    compensation.weekly_hours,
    compensation.collective_agreement,
    compensation.pay_period,
    compensation.evening_allowance_cents,
    compensation.night_allowance_cents,
    compensation.saturday_allowance_cents,
    compensation.sunday_allowance_cents,
    compensation.overtime_50_multiplier,
    compensation.overtime_100_multiplier,
    compensation.daily_allowance_cents,
    compensation.meal_allowance_cents,
    compensation.travel_time_hourly_cents,
    compensation.valid_from,
    compensation.valid_to,
    compensation.notes
  from public.employees e
  left join public.employee_hr_profiles hr
    on hr.employee_id = e.id and hr.organization_id = e.organization_id
  left join lateral (
    select c.*
    from public.employee_compensation_terms c
    where c.employee_id = e.id
      and c.organization_id = e.organization_id
      and c.valid_from <= current_date
      and (c.valid_to is null or c.valid_to >= current_date)
    order by c.valid_from desc
    limit 1
  ) compensation on true
  left join lateral (
    select array_agg(coalesce(p.full_name, p.email, 'Nimetön työnjohtaja') order by coalesce(p.full_name, p.email)) as names
    from public.supervisor_team_members stm
    left join public.profiles p on p.id = stm.supervisor_user_id
    where stm.organization_id = e.organization_id
      and stm.employee_id = e.id
      and stm.is_active
  ) supervisors on true
  where e.organization_id = p_organization_id
    and e.archived_at is null
    and private.can_access_employee_hr(e.organization_id, e.id)
  order by e.name;
$$;

revoke all on function public.list_accessible_employee_cards(uuid) from public, anon;
grant execute on function public.list_accessible_employee_cards(uuid) to authenticated;

create or replace function public.rotate_work_site_qr_token(
  p_project_id uuid,
  p_label text default null,
  p_expires_at timestamptz default null,
  p_require_geofence boolean default true
)
returns table (
  token text,
  project_name text,
  expires_at timestamptz,
  require_geofence boolean
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  project_row public.projects%rowtype;
  raw_token text;
begin
  if auth.uid() is null then
    raise exception 'Kirjautuminen vaaditaan.' using errcode = '42501';
  end if;

  select * into project_row from public.projects where id = p_project_id;
  if project_row.id is null then
    raise exception 'Työmaata ei löytynyt.' using errcode = 'P0002';
  end if;
  if not private.has_org_role(project_row.organization_id, array['admin','supervisor']::text[]) then
    raise exception 'QR-koodin luontiin ei ole oikeutta.' using errcode = '42501';
  end if;

  raw_token := encode(extensions.gen_random_bytes(32), 'hex');
  update public.work_site_qr_tokens
  set is_active = false
  where organization_id = project_row.organization_id and project_id = project_row.id and is_active;

  insert into public.work_site_qr_tokens(
    organization_id, project_id, token_hash, label, require_geofence, expires_at, created_by
  ) values (
    project_row.organization_id,
    project_row.id,
    extensions.digest(convert_to(raw_token, 'UTF8'), 'sha256'),
    nullif(trim(p_label), ''),
    p_require_geofence,
    p_expires_at,
    auth.uid()
  );

  insert into public.audit_logs(organization_id, user_id, action, table_name, record_id, metadata)
  values (
    project_row.organization_id,
    auth.uid(),
    'rotate_qr_token',
    'work_site_qr_tokens',
    project_row.id,
    jsonb_build_object('require_geofence', p_require_geofence, 'expires_at', p_expires_at)
  );

  return query select raw_token, project_row.name, p_expires_at, p_require_geofence;
end;
$$;

revoke all on function public.rotate_work_site_qr_token(uuid, text, timestamptz, boolean) from public, anon;
grant execute on function public.rotate_work_site_qr_token(uuid, text, timestamptz, boolean) to authenticated;

create or replace function public.consume_work_site_qr(
  p_token text,
  p_latitude double precision,
  p_longitude double precision,
  p_accuracy_m double precision,
  p_description text default null
)
returns table (
  check_in_id uuid,
  project_id uuid,
  project_name text,
  checked_in_at timestamptz,
  within_geofence boolean,
  distance_from_site_m double precision
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  token_row public.work_site_qr_tokens%rowtype;
  project_row public.projects%rowtype;
  check_in_row public.work_site_check_ins%rowtype;
  employee_name text;
begin
  if auth.uid() is null then
    raise exception 'Kirjautuminen vaaditaan.' using errcode = '42501';
  end if;
  if p_token is null or length(p_token) < 32 then
    raise exception 'QR-koodi on virheellinen.' using errcode = '22023';
  end if;
  if p_latitude not between -90 and 90 or p_longitude not between -180 and 180
     or p_accuracy_m < 0 or p_accuracy_m > 100000 then
    raise exception 'Laite palautti virheellisen sijaintitiedon.' using errcode = '22023';
  end if;

  select * into token_row
  from public.work_site_qr_tokens t
  where t.token_hash = extensions.digest(convert_to(p_token, 'UTF8'), 'sha256')
    and t.is_active
    and (t.expires_at is null or t.expires_at > now())
  for update;

  if token_row.id is null then
    raise exception 'QR-koodi on vanhentunut tai poistettu käytöstä.' using errcode = 'P0002';
  end if;
  if not private.is_internal_org_member(token_row.organization_id, auth.uid()) then
    raise exception 'Et kuulu tämän työmaan organisaatioon.' using errcode = '42501';
  end if;

  select * into project_row
  from public.projects p
  where p.id = token_row.project_id and p.organization_id = token_row.organization_id;
  if project_row.id is null or project_row.archived_at is not null then
    raise exception 'Työmaa ei ole käytettävissä.' using errcode = 'P0002';
  end if;

  select coalesce(e.name, p.full_name, p.email, 'Työntekijä') into employee_name
  from public.profiles p
  left join public.employees e
    on e.organization_id = token_row.organization_id and e.user_id = auth.uid() and e.archived_at is null
  where p.id = auth.uid()
  limit 1;

  begin
    insert into public.work_site_check_ins(
      organization_id, user_id, project_id, project_name, employee_name,
      description, location_captured_at, latitude, longitude, accuracy_m, location_source
    ) values (
      token_row.organization_id, auth.uid(), project_row.id, project_row.name, coalesce(employee_name, 'Työntekijä'),
      nullif(trim(p_description), ''), now(), p_latitude, p_longitude, p_accuracy_m, 'qr'
    ) returning * into check_in_row;
  exception when unique_violation then
    raise exception 'Sinulla on jo aktiivinen työmaalle kirjautuminen.' using errcode = '23505';
  end;

  if token_row.require_geofence and (
    check_in_row.within_geofence is null or check_in_row.within_geofence = false
  ) then
    if check_in_row.within_geofence is null then
      raise exception 'Työmaan sijaintirajausta ei ole määritetty. Pyydä työnjohtajaa korjaamaan työmaan sijainti.' using errcode = '23514';
    end if;
    raise exception 'Olet työmaan sallitun kirjautumisalueen ulkopuolella.' using errcode = '42501';
  end if;

  update public.work_site_qr_tokens
  set last_used_at = now(), use_count = use_count + 1
  where id = token_row.id;

  return query select
    check_in_row.id,
    check_in_row.project_id,
    check_in_row.project_name,
    check_in_row.checked_in_at,
    check_in_row.within_geofence,
    check_in_row.distance_from_site_m;
end;
$$;

revoke all on function public.consume_work_site_qr(text, double precision, double precision, double precision, text) from public, anon;
grant execute on function public.consume_work_site_qr(text, double precision, double precision, double precision, text) to authenticated;

insert into storage.buckets(id, name, public, file_size_limit, allowed_mime_types)
values ('app-backups', 'app-backups', false, 524288000, array['application/json','application/octet-stream'])
on conflict (id) do update set public = false;

insert into public.backup_cron_settings(id, secret_hash, enabled, retention_days)
select true, extensions.digest(convert_to(secret.raw_secret, 'UTF8'), 'sha256'), true, 30
from (select encode(extensions.gen_random_bytes(32), 'hex') as raw_secret) secret
where not exists (select 1 from public.backup_cron_settings where id = true);

do $$
declare
  raw_secret text;
begin
  if not exists (select 1 from vault.secrets where name = 'vakantti_backup_cron_secret') then
    raw_secret := encode(extensions.gen_random_bytes(32), 'hex');
    update public.backup_cron_settings
      set secret_hash = extensions.digest(convert_to(raw_secret, 'UTF8'), 'sha256'), updated_at = now()
      where id = true;
    perform vault.create_secret(raw_secret, 'vakantti_backup_cron_secret', 'VaKantin varmuuskopioajon tunniste');
  end if;
  if not exists (select 1 from vault.secrets where name = 'vakantti_project_url') then
    perform vault.create_secret('https://qnqhqtzssauwucgnpvfp.supabase.co', 'vakantti_project_url', 'VaKantin tuotanto-Supabasen URL');
  end if;
end;
$$;

do $$
declare
  existing_job bigint;
begin
  select jobid into existing_job from cron.job where jobname = 'vakantti-backup-twice-daily' limit 1;
  if existing_job is not null then
    perform cron.unschedule(existing_job);
  end if;

  perform cron.schedule(
    'vakantti-backup-twice-daily',
    '15 0,12 * * *',
    $job$
      select net.http_post(
        url := (select decrypted_secret from vault.decrypted_secrets where name = 'vakantti_project_url') || '/functions/v1/scheduled-backup',
        headers := jsonb_build_object(
          'Content-Type', 'application/json',
          'x-backup-secret', (select decrypted_secret from vault.decrypted_secrets where name = 'vakantti_backup_cron_secret')
        ),
        body := jsonb_build_object('triggered_by', 'cron', 'requested_at', now())
      );
    $job$
  );
end;
$$;

commit;