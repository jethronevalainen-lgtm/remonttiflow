-- Versioned correction workflow for locked payroll periods.
-- The original payroll snapshot remains immutable. Approved corrections create
-- append-only versions and signed adjustment lines.

alter table public.payroll_periods
  add column if not exists correction_version integer not null default 0,
  add column if not exists correction_total_cents bigint not null default 0;

alter table public.payroll_periods
  drop constraint if exists payroll_periods_correction_version_check,
  add constraint payroll_periods_correction_version_check
    check (correction_version >= 0);

create table if not exists public.payroll_correction_requests (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  payroll_period_id uuid not null references public.payroll_periods(id) on delete restrict,
  status text not null default 'Luonnos',
  reason text not null,
  requested_by uuid not null references auth.users(id) on delete restrict,
  submitted_at timestamptz,
  reviewed_by uuid references auth.users(id) on delete set null,
  reviewed_at timestamptz,
  review_note text,
  approved_version_id uuid,
  line_count integer not null default 0,
  adjustment_total_cents bigint not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint payroll_correction_requests_status_check check (
    status = any (array['Luonnos','Odottaa hyväksyntää','Hyväksytty','Hylätty']::text[])
  ),
  constraint payroll_correction_requests_reason_check check (length(btrim(reason)) between 10 and 2000),
  constraint payroll_correction_requests_line_count_check check (line_count >= 0),
  constraint payroll_correction_requests_review_check check (
    (status in ('Luonnos','Odottaa hyväksyntää') and reviewed_at is null)
    or (status in ('Hyväksytty','Hylätty') and reviewed_at is not null)
  )
);

create index if not exists payroll_correction_requests_period_idx
  on public.payroll_correction_requests(payroll_period_id, created_at desc);
create index if not exists payroll_correction_requests_org_status_idx
  on public.payroll_correction_requests(organization_id, status, created_at desc);
create index if not exists payroll_correction_requests_requester_idx
  on public.payroll_correction_requests(requested_by, created_at desc);

create table if not exists public.payroll_correction_request_lines (
  id uuid primary key default gen_random_uuid(),
  correction_request_id uuid not null references public.payroll_correction_requests(id) on delete cascade,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  employee_id uuid not null references public.employees(id) on delete restrict,
  employee_user_id uuid references auth.users(id) on delete set null,
  employee_name text not null,
  direction text not null,
  category text not null,
  amount_cents bigint not null,
  signed_amount_cents bigint generated always as (
    case when direction = 'Lisäys' then amount_cents else -amount_cents end
  ) stored,
  description text not null,
  effective_date date not null,
  source_type text,
  source_id uuid,
  created_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint payroll_correction_request_lines_direction_check check (
    direction = any (array['Lisäys','Hyvitys']::text[])
  ),
  constraint payroll_correction_request_lines_category_check check (
    category = any (array['Palkka','Ylityö','Lisä','Matkakulu','Muu']::text[])
  ),
  constraint payroll_correction_request_lines_amount_check check (amount_cents between 1 and 1000000000),
  constraint payroll_correction_request_lines_description_check check (length(btrim(description)) between 3 and 1000),
  constraint payroll_correction_request_lines_source_check check (
    source_type is null or source_type = any (array['Tuntikirjaus','Matkakulu','Manuaalinen']::text[])
  )
);

create index if not exists payroll_correction_request_lines_request_idx
  on public.payroll_correction_request_lines(correction_request_id, created_at);
create index if not exists payroll_correction_request_lines_employee_idx
  on public.payroll_correction_request_lines(employee_id, effective_date);

create table if not exists public.payroll_correction_versions (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  payroll_period_id uuid not null references public.payroll_periods(id) on delete restrict,
  correction_request_id uuid not null unique references public.payroll_correction_requests(id) on delete restrict,
  version_number integer not null,
  previous_version_id uuid references public.payroll_correction_versions(id) on delete restrict,
  base_total_cents bigint not null,
  prior_adjustment_total_cents bigint not null,
  adjustment_total_cents bigint not null,
  cumulative_adjustment_total_cents bigint not null,
  corrected_total_cents bigint not null,
  line_count integer not null,
  employee_count integer not null,
  reason text not null,
  snapshot jsonb not null default '{}'::jsonb,
  approved_by uuid not null references auth.users(id) on delete restrict,
  approved_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  constraint payroll_correction_versions_number_check check (version_number > 0),
  constraint payroll_correction_versions_totals_check check (
    base_total_cents >= 0 and corrected_total_cents >= 0 and line_count > 0 and employee_count > 0
  ),
  unique (payroll_period_id, version_number)
);

create index if not exists payroll_correction_versions_period_idx
  on public.payroll_correction_versions(payroll_period_id, version_number desc);

alter table public.payroll_correction_requests
  drop constraint if exists payroll_correction_requests_approved_version_fkey;
alter table public.payroll_correction_requests
  add constraint payroll_correction_requests_approved_version_fkey
  foreign key (approved_version_id) references public.payroll_correction_versions(id) on delete restrict;

create table if not exists public.payroll_correction_version_lines (
  id uuid primary key default gen_random_uuid(),
  correction_version_id uuid not null references public.payroll_correction_versions(id) on delete restrict,
  correction_request_line_id uuid not null references public.payroll_correction_request_lines(id) on delete restrict,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  payroll_period_id uuid not null references public.payroll_periods(id) on delete restrict,
  employee_id uuid not null references public.employees(id) on delete restrict,
  employee_user_id uuid references auth.users(id) on delete set null,
  employee_name text not null,
  direction text not null,
  category text not null,
  amount_cents bigint not null,
  signed_amount_cents bigint not null,
  description text not null,
  effective_date date not null,
  source_type text,
  source_id uuid,
  source_snapshot jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  unique (correction_version_id, correction_request_line_id)
);

create index if not exists payroll_correction_version_lines_version_idx
  on public.payroll_correction_version_lines(correction_version_id, employee_id);
create index if not exists payroll_correction_version_lines_period_idx
  on public.payroll_correction_version_lines(payroll_period_id, employee_id);

create table if not exists public.payroll_correction_version_employee_summaries (
  id uuid primary key default gen_random_uuid(),
  correction_version_id uuid not null references public.payroll_correction_versions(id) on delete restrict,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  payroll_period_id uuid not null references public.payroll_periods(id) on delete restrict,
  employee_id uuid not null references public.employees(id) on delete restrict,
  employee_user_id uuid references auth.users(id) on delete set null,
  employee_name text not null,
  base_total_cents bigint not null,
  prior_adjustment_total_cents bigint not null,
  adjustment_total_cents bigint not null,
  cumulative_adjustment_total_cents bigint not null,
  corrected_total_cents bigint not null,
  line_count integer not null,
  snapshot jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  constraint payroll_correction_version_employee_totals_check check (
    base_total_cents >= 0 and corrected_total_cents >= 0 and line_count >= 0
  ),
  unique (correction_version_id, employee_id)
);

create index if not exists payroll_correction_version_employee_period_idx
  on public.payroll_correction_version_employee_summaries(payroll_period_id, employee_id);

create or replace function private.refresh_payroll_correction_request_totals(p_request_id uuid)
returns void
language sql
security definer
set search_path = pg_catalog, public
as $$
  update public.payroll_correction_requests request
  set line_count = totals.line_count,
      adjustment_total_cents = totals.adjustment_total_cents,
      updated_at = now()
  from (
    select
      count(*)::integer as line_count,
      coalesce(sum(line.signed_amount_cents), 0)::bigint as adjustment_total_cents
    from public.payroll_correction_request_lines line
    where line.correction_request_id = p_request_id
  ) totals
  where request.id = p_request_id;
$$;

create or replace function private.prevent_payroll_correction_version_mutation()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  raise exception 'Hyväksytty palkkakorjausversio on muuttumaton.' using errcode = '42501';
end;
$$;

drop trigger if exists prevent_payroll_correction_versions_mutation on public.payroll_correction_versions;
create trigger prevent_payroll_correction_versions_mutation
before update or delete on public.payroll_correction_versions
for each row execute function private.prevent_payroll_correction_version_mutation();

drop trigger if exists prevent_payroll_correction_version_lines_mutation on public.payroll_correction_version_lines;
create trigger prevent_payroll_correction_version_lines_mutation
before update or delete on public.payroll_correction_version_lines
for each row execute function private.prevent_payroll_correction_version_mutation();

drop trigger if exists prevent_payroll_correction_version_summaries_mutation on public.payroll_correction_version_employee_summaries;
create trigger prevent_payroll_correction_version_summaries_mutation
before update or delete on public.payroll_correction_version_employee_summaries
for each row execute function private.prevent_payroll_correction_version_mutation();

drop trigger if exists set_payroll_correction_requests_updated_at on public.payroll_correction_requests;
create trigger set_payroll_correction_requests_updated_at
before update on public.payroll_correction_requests
for each row execute function public.set_updated_at();

drop trigger if exists set_payroll_correction_request_lines_updated_at on public.payroll_correction_request_lines;
create trigger set_payroll_correction_request_lines_updated_at
before update on public.payroll_correction_request_lines
for each row execute function public.set_updated_at();

alter table public.payroll_correction_requests enable row level security;
alter table public.payroll_correction_request_lines enable row level security;
alter table public.payroll_correction_versions enable row level security;
alter table public.payroll_correction_version_lines enable row level security;
alter table public.payroll_correction_version_employee_summaries enable row level security;

drop policy if exists payroll_correction_requests_select on public.payroll_correction_requests;
create policy payroll_correction_requests_select
on public.payroll_correction_requests for select
to authenticated
using (
  private.has_org_role(organization_id, array['admin']::text[])
  or requested_by = (select auth.uid())
);

drop policy if exists payroll_correction_request_lines_select on public.payroll_correction_request_lines;
create policy payroll_correction_request_lines_select
on public.payroll_correction_request_lines for select
to authenticated
using (
  private.has_org_role(organization_id, array['admin']::text[])
  or exists (
    select 1
    from public.payroll_correction_requests request
    where request.id = correction_request_id
      and request.requested_by = (select auth.uid())
  )
);

drop policy if exists payroll_correction_versions_select on public.payroll_correction_versions;
create policy payroll_correction_versions_select
on public.payroll_correction_versions for select
to authenticated
using (private.has_org_role(organization_id, array['admin']::text[]));

drop policy if exists payroll_correction_version_lines_select on public.payroll_correction_version_lines;
create policy payroll_correction_version_lines_select
on public.payroll_correction_version_lines for select
to authenticated
using (
  private.has_org_role(organization_id, array['admin']::text[])
  or private.can_access_employee_hr(organization_id, employee_id)
);

drop policy if exists payroll_correction_version_employee_summaries_select on public.payroll_correction_version_employee_summaries;
create policy payroll_correction_version_employee_summaries_select
on public.payroll_correction_version_employee_summaries for select
to authenticated
using (
  private.has_org_role(organization_id, array['admin']::text[])
  or private.can_access_employee_hr(organization_id, employee_id)
);

revoke all on table public.payroll_correction_requests from public, anon, authenticated;
revoke all on table public.payroll_correction_request_lines from public, anon, authenticated;
revoke all on table public.payroll_correction_versions from public, anon, authenticated;
revoke all on table public.payroll_correction_version_lines from public, anon, authenticated;
revoke all on table public.payroll_correction_version_employee_summaries from public, anon, authenticated;
grant select on table public.payroll_correction_requests to authenticated;
grant select on table public.payroll_correction_request_lines to authenticated;
grant select on table public.payroll_correction_version_lines to authenticated;
grant select on table public.payroll_correction_version_employee_summaries to authenticated;

create or replace function public.create_payroll_correction_request(
  p_organization_id uuid,
  p_payroll_period_id uuid,
  p_reason text
)
returns uuid
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_request_id uuid;
  v_period public.payroll_periods%rowtype;
begin
  if auth.uid() is null or not private.has_org_role(p_organization_id, array['admin','supervisor']::text[]) then
    raise exception 'Korjauspyynnön luonti vaatii admin- tai työnjohtajaroolin.' using errcode = '42501';
  end if;
  if length(btrim(coalesce(p_reason, ''))) < 10 then
    raise exception 'Korjauksen syyn pitää olla vähintään 10 merkkiä.' using errcode = '23514';
  end if;

  select * into v_period
  from public.payroll_periods
  where id = p_payroll_period_id and organization_id = p_organization_id;
  if not found then
    raise exception 'Lukittua palkkakautta ei löytynyt.' using errcode = 'P0002';
  end if;
  if v_period.locked_at is null then
    raise exception 'Korjauspyynnön voi tehdä vain lukitulle palkkakaudelle.' using errcode = '23514';
  end if;

  insert into public.payroll_correction_requests(
    organization_id, payroll_period_id, reason, requested_by
  ) values (
    p_organization_id, p_payroll_period_id, btrim(p_reason), auth.uid()
  ) returning id into v_request_id;

  insert into public.audit_logs(organization_id, user_id, action, table_name, record_id, metadata)
  values (
    p_organization_id, auth.uid(), 'payroll_correction_created',
    'payroll_correction_requests', v_request_id,
    jsonb_build_object('payroll_period_id', p_payroll_period_id, 'sensitive_values_recorded', false)
  );

  return v_request_id;
end;
$$;

create or replace function public.save_payroll_correction_line(
  p_correction_request_id uuid,
  p_line_id uuid,
  p_employee_id uuid,
  p_direction text,
  p_category text,
  p_amount_cents bigint,
  p_description text,
  p_effective_date date,
  p_source_type text default null,
  p_source_id uuid default null
)
returns uuid
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_request public.payroll_correction_requests%rowtype;
  v_period public.payroll_periods%rowtype;
  v_employee public.employees%rowtype;
  v_line_id uuid;
  v_is_admin boolean;
begin
  if auth.uid() is null then
    raise exception 'Kirjautuminen vaaditaan.' using errcode = '42501';
  end if;

  select * into v_request
  from public.payroll_correction_requests
  where id = p_correction_request_id
  for update;
  if not found then
    raise exception 'Korjauspyyntöä ei löytynyt.' using errcode = 'P0002';
  end if;

  v_is_admin := private.has_org_role(v_request.organization_id, array['admin']::text[]);
  if not v_is_admin and v_request.requested_by <> auth.uid() then
    raise exception 'Voit muokata vain omaa korjauspyyntöäsi.' using errcode = '42501';
  end if;
  if v_request.status <> 'Luonnos' then
    raise exception 'Vain luonnostilassa olevan korjauspyynnön rivejä voi muuttaa.' using errcode = '42501';
  end if;
  if p_direction not in ('Lisäys','Hyvitys') then
    raise exception 'Korjausrivin suunta on virheellinen.' using errcode = '23514';
  end if;
  if p_category not in ('Palkka','Ylityö','Lisä','Matkakulu','Muu') then
    raise exception 'Korjausrivin luokka on virheellinen.' using errcode = '23514';
  end if;
  if coalesce(p_amount_cents, 0) <= 0 or p_amount_cents > 1000000000 then
    raise exception 'Korjaussumman pitää olla positiivinen ja kohtuullinen.' using errcode = '23514';
  end if;
  if length(btrim(coalesce(p_description, ''))) < 3 then
    raise exception 'Korjausrivin kuvauksen pitää olla vähintään 3 merkkiä.' using errcode = '23514';
  end if;
  if p_source_type is not null and p_source_type not in ('Tuntikirjaus','Matkakulu','Manuaalinen') then
    raise exception 'Lähdetyyppi on virheellinen.' using errcode = '23514';
  end if;

  select * into v_period
  from public.payroll_periods
  where id = v_request.payroll_period_id;
  if p_effective_date is null or p_effective_date < v_period.period_start or p_effective_date > v_period.period_end then
    raise exception 'Korjauksen päivämäärän pitää olla alkuperäisen palkkakauden sisällä.' using errcode = '23514';
  end if;

  select * into v_employee
  from public.employees
  where id = p_employee_id
    and organization_id = v_request.organization_id
    and archived_at is null;
  if not found then
    raise exception 'Työntekijän henkilökorttia ei löytynyt.' using errcode = 'P0002';
  end if;
  if not v_is_admin and not private.can_access_employee_hr(v_request.organization_id, p_employee_id) then
    raise exception 'Työnjohtaja voi lisätä korjauksia vain oman HR-tiiminsä työntekijöille.' using errcode = '42501';
  end if;

  if p_line_id is null then
    insert into public.payroll_correction_request_lines(
      correction_request_id, organization_id, employee_id, employee_user_id, employee_name,
      direction, category, amount_cents, description, effective_date, source_type, source_id, created_by
    ) values (
      v_request.id, v_request.organization_id, v_employee.id, v_employee.user_id, v_employee.name,
      p_direction, p_category, p_amount_cents, btrim(p_description), p_effective_date,
      nullif(p_source_type, ''), p_source_id, auth.uid()
    ) returning id into v_line_id;
  else
    update public.payroll_correction_request_lines line
    set employee_id = v_employee.id,
        employee_user_id = v_employee.user_id,
        employee_name = v_employee.name,
        direction = p_direction,
        category = p_category,
        amount_cents = p_amount_cents,
        description = btrim(p_description),
        effective_date = p_effective_date,
        source_type = nullif(p_source_type, ''),
        source_id = p_source_id
    where line.id = p_line_id
      and line.correction_request_id = v_request.id
    returning line.id into v_line_id;
    if v_line_id is null then
      raise exception 'Muokattavaa korjausriviä ei löytynyt.' using errcode = 'P0002';
    end if;
  end if;

  perform private.refresh_payroll_correction_request_totals(v_request.id);

  insert into public.audit_logs(organization_id, user_id, action, table_name, record_id, metadata)
  values (
    v_request.organization_id, auth.uid(),
    case when p_line_id is null then 'payroll_correction_line_created' else 'payroll_correction_line_updated' end,
    'payroll_correction_request_lines', v_line_id,
    jsonb_build_object(
      'correction_request_id', v_request.id,
      'employee_id', v_employee.id,
      'direction', p_direction,
      'category', p_category,
      'sensitive_values_recorded', false
    )
  );

  return v_line_id;
end;
$$;

create or replace function public.delete_payroll_correction_line(p_line_id uuid)
returns void
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_line public.payroll_correction_request_lines%rowtype;
  v_request public.payroll_correction_requests%rowtype;
begin
  if auth.uid() is null then
    raise exception 'Kirjautuminen vaaditaan.' using errcode = '42501';
  end if;

  select * into v_line
  from public.payroll_correction_request_lines
  where id = p_line_id;
  if not found then
    raise exception 'Korjausriviä ei löytynyt.' using errcode = 'P0002';
  end if;

  select * into v_request
  from public.payroll_correction_requests
  where id = v_line.correction_request_id
  for update;
  if v_request.status <> 'Luonnos' then
    raise exception 'Vain luonnostilassa olevan korjauspyynnön rivejä voi poistaa.' using errcode = '42501';
  end if;
  if not private.has_org_role(v_request.organization_id, array['admin']::text[])
     and v_request.requested_by <> auth.uid() then
    raise exception 'Voit poistaa vain oman korjauspyyntösi rivejä.' using errcode = '42501';
  end if;

  delete from public.payroll_correction_request_lines where id = p_line_id;
  perform private.refresh_payroll_correction_request_totals(v_request.id);

  insert into public.audit_logs(organization_id, user_id, action, table_name, record_id, metadata)
  values (
    v_request.organization_id, auth.uid(), 'payroll_correction_line_deleted',
    'payroll_correction_request_lines', p_line_id,
    jsonb_build_object('correction_request_id', v_request.id, 'employee_id', v_line.employee_id, 'sensitive_values_recorded', false)
  );
end;
$$;

create or replace function public.submit_payroll_correction_request(p_correction_request_id uuid)
returns void
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_request public.payroll_correction_requests%rowtype;
begin
  if auth.uid() is null then
    raise exception 'Kirjautuminen vaaditaan.' using errcode = '42501';
  end if;

  select * into v_request
  from public.payroll_correction_requests
  where id = p_correction_request_id
  for update;
  if not found then
    raise exception 'Korjauspyyntöä ei löytynyt.' using errcode = 'P0002';
  end if;
  if not private.has_org_role(v_request.organization_id, array['admin']::text[])
     and v_request.requested_by <> auth.uid() then
    raise exception 'Voit lähettää vain oman korjauspyyntösi.' using errcode = '42501';
  end if;
  if v_request.status <> 'Luonnos' then
    raise exception 'Vain luonnostilassa olevan korjauspyynnön voi lähettää.' using errcode = '42501';
  end if;

  perform private.refresh_payroll_correction_request_totals(v_request.id);
  select * into v_request from public.payroll_correction_requests where id = v_request.id;
  if v_request.line_count < 1 then
    raise exception 'Korjauspyynnössä pitää olla vähintään yksi rivi.' using errcode = '23514';
  end if;
  if v_request.adjustment_total_cents = 0 then
    raise exception 'Korjauspyynnön lisäykset ja hyvitykset kumoavat toisensa. Yhteismuutos ei voi olla nolla.' using errcode = '23514';
  end if;

  update public.payroll_correction_requests
  set status = 'Odottaa hyväksyntää', submitted_at = now()
  where id = v_request.id;

  insert into public.audit_logs(organization_id, user_id, action, table_name, record_id, metadata)
  values (
    v_request.organization_id, auth.uid(), 'payroll_correction_submitted',
    'payroll_correction_requests', v_request.id,
    jsonb_build_object('line_count', v_request.line_count, 'sensitive_values_recorded', false)
  );
end;
$$;

create or replace function public.review_payroll_correction_request(
  p_correction_request_id uuid,
  p_decision text,
  p_review_note text default null
)
returns uuid
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_request public.payroll_correction_requests%rowtype;
  v_period public.payroll_periods%rowtype;
  v_version_id uuid;
  v_previous_version_id uuid;
  v_version_number integer;
  v_base_total bigint;
  v_prior_total bigint;
  v_adjustment_total bigint;
  v_corrected_total bigint;
  v_employee_count integer;
  v_snapshot jsonb;
begin
  if auth.uid() is null then
    raise exception 'Kirjautuminen vaaditaan.' using errcode = '42501';
  end if;

  select * into v_request
  from public.payroll_correction_requests
  where id = p_correction_request_id
  for update;
  if not found then
    raise exception 'Korjauspyyntöä ei löytynyt.' using errcode = 'P0002';
  end if;
  if not private.has_org_role(v_request.organization_id, array['admin']::text[]) then
    raise exception 'Vain organisaation admin voi hyväksyä tai hylätä palkkakorjauksen.' using errcode = '42501';
  end if;
  if v_request.status <> 'Odottaa hyväksyntää' then
    raise exception 'Vain hyväksyntää odottavan korjauspyynnön voi käsitellä.' using errcode = '42501';
  end if;
  if p_decision not in ('approve','reject') then
    raise exception 'Korjauspäätös on virheellinen.' using errcode = '23514';
  end if;

  if p_decision = 'reject' then
    if length(btrim(coalesce(p_review_note, ''))) < 3 then
      raise exception 'Hylkäyksen perustelu on pakollinen.' using errcode = '23514';
    end if;
    update public.payroll_correction_requests
    set status = 'Hylätty', reviewed_by = auth.uid(), reviewed_at = now(), review_note = btrim(p_review_note)
    where id = v_request.id;

    insert into public.audit_logs(organization_id, user_id, action, table_name, record_id, metadata)
    values (
      v_request.organization_id, auth.uid(), 'payroll_correction_rejected',
      'payroll_correction_requests', v_request.id,
      jsonb_build_object('line_count', v_request.line_count, 'sensitive_values_recorded', false)
    );
    return null;
  end if;

  perform private.refresh_payroll_correction_request_totals(v_request.id);
  select * into v_request from public.payroll_correction_requests where id = v_request.id for update;
  if v_request.line_count < 1 or v_request.adjustment_total_cents = 0 then
    raise exception 'Hyväksyttävässä korjauspyynnössä pitää olla vähintään yksi rivi ja nollasta poikkeava yhteismuutos.' using errcode = '23514';
  end if;

  select * into v_period
  from public.payroll_periods
  where id = v_request.payroll_period_id and organization_id = v_request.organization_id
  for update;
  if not found or v_period.locked_at is null then
    raise exception 'Korjattavaa lukittua palkkakautta ei löytynyt.' using errcode = 'P0002';
  end if;

  select coalesce(sum(summary.estimated_total_cents), 0)::bigint
  into v_base_total
  from public.payroll_period_employee_summaries summary
  where summary.payroll_period_id = v_period.id;

  select version.id, version.version_number, version.cumulative_adjustment_total_cents
  into v_previous_version_id, v_version_number, v_prior_total
  from public.payroll_correction_versions version
  where version.payroll_period_id = v_period.id
  order by version.version_number desc
  limit 1;

  v_version_number := coalesce(v_version_number, 0) + 1;
  v_prior_total := coalesce(v_prior_total, 0);
  v_adjustment_total := v_request.adjustment_total_cents;
  v_corrected_total := v_base_total + v_prior_total + v_adjustment_total;

  if v_corrected_total < 0 then
    raise exception 'Korjaus tekisi palkkakauden kokonaissummasta negatiivisen.' using errcode = '23514';
  end if;

  if exists (
    with employees as (
      select summary.employee_id
      from public.payroll_period_employee_summaries summary
      where summary.payroll_period_id = v_period.id
      union
      select line.employee_id
      from public.payroll_correction_version_lines line
      where line.payroll_period_id = v_period.id
      union
      select line.employee_id
      from public.payroll_correction_request_lines line
      where line.correction_request_id = v_request.id
    )
    select 1
    from employees employee
    left join lateral (
      select coalesce(sum(summary.estimated_total_cents), 0)::bigint as total
      from public.payroll_period_employee_summaries summary
      where summary.payroll_period_id = v_period.id and summary.employee_id = employee.employee_id
    ) base on true
    left join lateral (
      select coalesce(sum(line.signed_amount_cents), 0)::bigint as total
      from public.payroll_correction_version_lines line
      where line.payroll_period_id = v_period.id and line.employee_id = employee.employee_id
    ) prior on true
    left join lateral (
      select coalesce(sum(line.signed_amount_cents), 0)::bigint as total
      from public.payroll_correction_request_lines line
      where line.correction_request_id = v_request.id and line.employee_id = employee.employee_id
    ) current_adjustment on true
    where base.total + prior.total + current_adjustment.total < 0
  ) then
    raise exception 'Korjaus tekisi vähintään yhden työntekijän palkkasummasta negatiivisen.' using errcode = '23514';
  end if;

  insert into public.payroll_correction_versions(
    organization_id, payroll_period_id, correction_request_id, version_number, previous_version_id,
    base_total_cents, prior_adjustment_total_cents, adjustment_total_cents,
    cumulative_adjustment_total_cents, corrected_total_cents,
    line_count, employee_count, reason, approved_by, approved_at
  ) values (
    v_request.organization_id, v_period.id, v_request.id, v_version_number, v_previous_version_id,
    v_base_total, v_prior_total, v_adjustment_total,
    v_prior_total + v_adjustment_total, v_corrected_total,
    v_request.line_count, 1, v_request.reason, auth.uid(), now()
  ) returning id into v_version_id;

  insert into public.payroll_correction_version_lines(
    correction_version_id, correction_request_line_id, organization_id, payroll_period_id,
    employee_id, employee_user_id, employee_name, direction, category,
    amount_cents, signed_amount_cents, description, effective_date,
    source_type, source_id, source_snapshot
  )
  select
    v_version_id, line.id, line.organization_id, v_period.id,
    line.employee_id, line.employee_user_id, line.employee_name, line.direction, line.category,
    line.amount_cents, line.signed_amount_cents, line.description, line.effective_date,
    line.source_type, line.source_id,
    jsonb_build_object(
      'schema_version', 1,
      'request_line_id', line.id,
      'direction', line.direction,
      'category', line.category,
      'amount_cents', line.amount_cents,
      'signed_amount_cents', line.signed_amount_cents,
      'description', line.description,
      'effective_date', line.effective_date,
      'source_type', line.source_type,
      'source_id', line.source_id
    )
  from public.payroll_correction_request_lines line
  where line.correction_request_id = v_request.id;

  with employees as (
    select summary.employee_id
    from public.payroll_period_employee_summaries summary
    where summary.payroll_period_id = v_period.id
    union
    select line.employee_id
    from public.payroll_correction_version_lines line
    where line.payroll_period_id = v_period.id and line.correction_version_id <> v_version_id
    union
    select line.employee_id
    from public.payroll_correction_version_lines line
    where line.correction_version_id = v_version_id
  ), calculated as (
    select
      employee.employee_id,
      coalesce(base.employee_user_id, current_line.employee_user_id, prior_line.employee_user_id, employee_row.user_id) as employee_user_id,
      coalesce(base.employee_name, current_line.employee_name, prior_line.employee_name, employee_row.name) as employee_name,
      coalesce(base.total, 0)::bigint as base_total_cents,
      coalesce(prior.total, 0)::bigint as prior_adjustment_total_cents,
      coalesce(current_adjustment.total, 0)::bigint as adjustment_total_cents,
      coalesce(prior.total, 0)::bigint + coalesce(current_adjustment.total, 0)::bigint as cumulative_adjustment_total_cents,
      coalesce(base.total, 0)::bigint + coalesce(prior.total, 0)::bigint + coalesce(current_adjustment.total, 0)::bigint as corrected_total_cents,
      coalesce(current_adjustment.line_count, 0)::integer as line_count
    from employees employee
    join public.employees employee_row on employee_row.id = employee.employee_id
    left join lateral (
      select
        max(summary.employee_user_id::text)::uuid as employee_user_id,
        max(summary.employee_name) as employee_name,
        coalesce(sum(summary.estimated_total_cents), 0)::bigint as total
      from public.payroll_period_employee_summaries summary
      where summary.payroll_period_id = v_period.id and summary.employee_id = employee.employee_id
    ) base on true
    left join lateral (
      select
        max(line.employee_user_id::text)::uuid as employee_user_id,
        max(line.employee_name) as employee_name,
        coalesce(sum(line.signed_amount_cents), 0)::bigint as total
      from public.payroll_correction_version_lines line
      where line.payroll_period_id = v_period.id
        and line.correction_version_id <> v_version_id
        and line.employee_id = employee.employee_id
    ) prior on true
    left join lateral (
      select
        max(line.employee_user_id::text)::uuid as employee_user_id,
        max(line.employee_name) as employee_name
      from public.payroll_correction_version_lines line
      where line.payroll_period_id = v_period.id
        and line.correction_version_id <> v_version_id
        and line.employee_id = employee.employee_id
    ) prior_line on true
    left join lateral (
      select
        max(line.employee_user_id::text)::uuid as employee_user_id,
        max(line.employee_name) as employee_name,
        coalesce(sum(line.signed_amount_cents), 0)::bigint as total,
        count(*)::integer as line_count
      from public.payroll_correction_version_lines line
      where line.correction_version_id = v_version_id and line.employee_id = employee.employee_id
    ) current_adjustment on true
    left join lateral (
      select
        max(line.employee_user_id::text)::uuid as employee_user_id,
        max(line.employee_name) as employee_name
      from public.payroll_correction_version_lines line
      where line.correction_version_id = v_version_id and line.employee_id = employee.employee_id
    ) current_line on true
  )
  insert into public.payroll_correction_version_employee_summaries(
    correction_version_id, organization_id, payroll_period_id,
    employee_id, employee_user_id, employee_name,
    base_total_cents, prior_adjustment_total_cents, adjustment_total_cents,
    cumulative_adjustment_total_cents, corrected_total_cents, line_count, snapshot
  )
  select
    v_version_id, v_request.organization_id, v_period.id,
    calculated.employee_id, calculated.employee_user_id, calculated.employee_name,
    calculated.base_total_cents, calculated.prior_adjustment_total_cents, calculated.adjustment_total_cents,
    calculated.cumulative_adjustment_total_cents, calculated.corrected_total_cents, calculated.line_count,
    jsonb_build_object(
      'schema_version', 1,
      'employee_id', calculated.employee_id,
      'employee_name', calculated.employee_name,
      'base_total_cents', calculated.base_total_cents,
      'prior_adjustment_total_cents', calculated.prior_adjustment_total_cents,
      'adjustment_total_cents', calculated.adjustment_total_cents,
      'cumulative_adjustment_total_cents', calculated.cumulative_adjustment_total_cents,
      'corrected_total_cents', calculated.corrected_total_cents,
      'line_count', calculated.line_count
    )
  from calculated;

  select count(*)::integer into v_employee_count
  from public.payroll_correction_version_employee_summaries summary
  where summary.correction_version_id = v_version_id;

  select jsonb_build_object(
    'schema_version', 1,
    'payroll_period', jsonb_build_object(
      'id', v_period.id,
      'period_start', v_period.period_start,
      'period_end', v_period.period_end,
      'locked_at', v_period.locked_at,
      'original_time_line_count', (select count(*) from public.payroll_period_time_lines line where line.payroll_period_id = v_period.id),
      'original_travel_line_count', (select count(*) from public.payroll_period_travel_expense_lines line where line.payroll_period_id = v_period.id)
    ),
    'correction', jsonb_build_object(
      'request_id', v_request.id,
      'version_number', v_version_number,
      'previous_version_id', v_previous_version_id,
      'reason', v_request.reason,
      'review_note', nullif(btrim(coalesce(p_review_note, '')), ''),
      'approved_by', auth.uid(),
      'approved_at', now()
    ),
    'totals', jsonb_build_object(
      'base_total_cents', v_base_total,
      'prior_adjustment_total_cents', v_prior_total,
      'adjustment_total_cents', v_adjustment_total,
      'cumulative_adjustment_total_cents', v_prior_total + v_adjustment_total,
      'corrected_total_cents', v_corrected_total
    ),
    'employees', coalesce((
      select jsonb_agg(summary.snapshot order by summary.employee_name)
      from public.payroll_correction_version_employee_summaries summary
      where summary.correction_version_id = v_version_id
    ), '[]'::jsonb),
    'lines', coalesce((
      select jsonb_agg(line.source_snapshot order by line.created_at, line.id)
      from public.payroll_correction_version_lines line
      where line.correction_version_id = v_version_id
    ), '[]'::jsonb)
  ) into v_snapshot;

  update public.payroll_correction_versions
  set employee_count = v_employee_count,
      snapshot = v_snapshot
  where id = v_version_id;

  update public.payroll_correction_requests
  set status = 'Hyväksytty',
      reviewed_by = auth.uid(),
      reviewed_at = now(),
      review_note = nullif(btrim(coalesce(p_review_note, '')), ''),
      approved_version_id = v_version_id
  where id = v_request.id;

  update public.payroll_periods
  set correction_version = v_version_number,
      correction_total_cents = v_prior_total + v_adjustment_total,
      updated_at = now()
  where id = v_period.id;

  insert into public.audit_logs(organization_id, user_id, action, table_name, record_id, metadata)
  values (
    v_request.organization_id, auth.uid(), 'payroll_correction_approved',
    'payroll_correction_versions', v_version_id,
    jsonb_build_object(
      'correction_request_id', v_request.id,
      'payroll_period_id', v_period.id,
      'version_number', v_version_number,
      'line_count', v_request.line_count,
      'employee_count', v_employee_count,
      'sensitive_values_recorded', false
    )
  );

  return v_version_id;
end;
$$;

create or replace function public.list_payroll_correction_periods(p_organization_id uuid)
returns table(
  id uuid,
  period_start date,
  period_end date,
  status text,
  notes text,
  locked_at timestamptz,
  base_total_cents bigint,
  correction_total_cents bigint,
  corrected_total_cents bigint,
  employee_count bigint,
  correction_version integer,
  open_request_count bigint
)
language plpgsql
stable
security definer
set search_path = pg_catalog, public
as $$
begin
  if not private.has_org_role(p_organization_id, array['admin','supervisor']::text[]) then
    raise exception 'Palkkakorjausten tarkastelu vaatii admin- tai työnjohtajaroolin.' using errcode = '42501';
  end if;

  return query
  with accessible_base as (
    select
      period.id as payroll_period_id,
      count(distinct summary.employee_id)::bigint as employee_count,
      coalesce(sum(summary.estimated_total_cents), 0)::bigint as base_total_cents
    from public.payroll_periods period
    left join public.payroll_period_employee_summaries summary
      on summary.payroll_period_id = period.id
      and (
        private.has_org_role(p_organization_id, array['admin']::text[])
        or private.can_access_employee_hr(p_organization_id, summary.employee_id)
      )
    where period.organization_id = p_organization_id
    group by period.id
  ), accessible_corrections as (
    select
      line.payroll_period_id,
      coalesce(sum(line.signed_amount_cents), 0)::bigint as correction_total_cents
    from public.payroll_correction_version_lines line
    where line.organization_id = p_organization_id
      and (
        private.has_org_role(p_organization_id, array['admin']::text[])
        or private.can_access_employee_hr(p_organization_id, line.employee_id)
      )
    group by line.payroll_period_id
  )
  select
    period.id,
    period.period_start,
    period.period_end,
    period.status,
    period.notes,
    period.locked_at,
    coalesce(base.base_total_cents, 0),
    coalesce(correction.correction_total_cents, 0),
    coalesce(base.base_total_cents, 0) + coalesce(correction.correction_total_cents, 0),
    coalesce(base.employee_count, 0),
    period.correction_version,
    (
      select count(*)
      from public.payroll_correction_requests request
      where request.payroll_period_id = period.id
        and request.status in ('Luonnos','Odottaa hyväksyntää')
        and (
          private.has_org_role(p_organization_id, array['admin']::text[])
          or request.requested_by = auth.uid()
        )
    )::bigint
  from public.payroll_periods period
  left join accessible_base base on base.payroll_period_id = period.id
  left join accessible_corrections correction on correction.payroll_period_id = period.id
  where period.organization_id = p_organization_id
  order by period.period_start desc, period.created_at desc;
end;
$$;

create or replace function public.list_payroll_correction_employee_context(
  p_organization_id uuid,
  p_payroll_period_id uuid
)
returns table(
  employee_id uuid,
  employee_user_id uuid,
  employee_name text,
  base_total_cents bigint,
  correction_total_cents bigint,
  corrected_total_cents bigint
)
language plpgsql
stable
security definer
set search_path = pg_catalog, public
as $$
begin
  if not private.has_org_role(p_organization_id, array['admin','supervisor']::text[]) then
    raise exception 'Palkkakorjausten tarkastelu vaatii admin- tai työnjohtajaroolin.' using errcode = '42501';
  end if;

  return query
  with employee_ids as (
    select summary.employee_id
    from public.payroll_period_employee_summaries summary
    where summary.payroll_period_id = p_payroll_period_id
    union
    select line.employee_id
    from public.payroll_correction_version_lines line
    where line.payroll_period_id = p_payroll_period_id
    union
    select employee.id
    from public.employees employee
    where employee.organization_id = p_organization_id and employee.archived_at is null
  )
  select
    employee.id,
    employee.user_id,
    employee.name,
    coalesce(base.total, 0)::bigint,
    coalesce(correction.total, 0)::bigint,
    coalesce(base.total, 0)::bigint + coalesce(correction.total, 0)::bigint
  from employee_ids ids
  join public.employees employee on employee.id = ids.employee_id and employee.organization_id = p_organization_id
  left join lateral (
    select coalesce(sum(summary.estimated_total_cents), 0)::bigint as total
    from public.payroll_period_employee_summaries summary
    where summary.payroll_period_id = p_payroll_period_id and summary.employee_id = employee.id
  ) base on true
  left join lateral (
    select coalesce(sum(line.signed_amount_cents), 0)::bigint as total
    from public.payroll_correction_version_lines line
    where line.payroll_period_id = p_payroll_period_id and line.employee_id = employee.id
  ) correction on true
  where private.has_org_role(p_organization_id, array['admin']::text[])
     or private.can_access_employee_hr(p_organization_id, employee.id)
  order by employee.name;
end;
$$;

create or replace function public.list_payroll_correction_requests(
  p_organization_id uuid,
  p_payroll_period_id uuid default null
)
returns table(
  id uuid,
  payroll_period_id uuid,
  period_start date,
  period_end date,
  status text,
  reason text,
  requested_by uuid,
  requester_name text,
  submitted_at timestamptz,
  reviewed_by uuid,
  reviewer_name text,
  reviewed_at timestamptz,
  review_note text,
  line_count integer,
  adjustment_total_cents bigint,
  approved_version_id uuid,
  approved_version_number integer,
  created_at timestamptz,
  updated_at timestamptz
)
language plpgsql
stable
security definer
set search_path = pg_catalog, public
as $$
begin
  if not private.has_org_role(p_organization_id, array['admin','supervisor']::text[]) then
    raise exception 'Palkkakorjausten tarkastelu vaatii admin- tai työnjohtajaroolin.' using errcode = '42501';
  end if;

  return query
  select
    request.id,
    request.payroll_period_id,
    period.period_start,
    period.period_end,
    request.status,
    request.reason,
    request.requested_by,
    coalesce(requester.full_name, requester.email, 'Käyttäjä')::text,
    request.submitted_at,
    request.reviewed_by,
    coalesce(reviewer.full_name, reviewer.email)::text,
    request.reviewed_at,
    request.review_note,
    request.line_count,
    request.adjustment_total_cents,
    request.approved_version_id,
    version.version_number,
    request.created_at,
    request.updated_at
  from public.payroll_correction_requests request
  join public.payroll_periods period on period.id = request.payroll_period_id
  left join public.profiles requester on requester.id = request.requested_by
  left join public.profiles reviewer on reviewer.id = request.reviewed_by
  left join public.payroll_correction_versions version on version.id = request.approved_version_id
  where request.organization_id = p_organization_id
    and (p_payroll_period_id is null or request.payroll_period_id = p_payroll_period_id)
    and (
      private.has_org_role(p_organization_id, array['admin']::text[])
      or request.requested_by = auth.uid()
    )
  order by request.created_at desc;
end;
$$;

create or replace function public.list_payroll_correction_lines(p_correction_request_id uuid)
returns table(
  id uuid,
  correction_request_id uuid,
  employee_id uuid,
  employee_user_id uuid,
  employee_name text,
  direction text,
  category text,
  amount_cents bigint,
  signed_amount_cents bigint,
  description text,
  effective_date date,
  source_type text,
  source_id uuid,
  created_at timestamptz,
  updated_at timestamptz
)
language plpgsql
stable
security definer
set search_path = pg_catalog, public
as $$
declare
  v_request public.payroll_correction_requests%rowtype;
begin
  select * into v_request from public.payroll_correction_requests where id = p_correction_request_id;
  if not found then
    raise exception 'Korjauspyyntöä ei löytynyt.' using errcode = 'P0002';
  end if;
  if not private.has_org_role(v_request.organization_id, array['admin']::text[])
     and v_request.requested_by <> auth.uid() then
    raise exception 'Korjausrivien tarkastelu ei ole sallittu.' using errcode = '42501';
  end if;

  return query
  select
    line.id, line.correction_request_id, line.employee_id, line.employee_user_id,
    line.employee_name, line.direction, line.category, line.amount_cents,
    line.signed_amount_cents, line.description, line.effective_date,
    line.source_type, line.source_id, line.created_at, line.updated_at
  from public.payroll_correction_request_lines line
  where line.correction_request_id = p_correction_request_id
  order by line.effective_date, line.created_at, line.id;
end;
$$;

create or replace function public.list_payroll_correction_versions(
  p_organization_id uuid,
  p_payroll_period_id uuid default null
)
returns table(
  id uuid,
  payroll_period_id uuid,
  correction_request_id uuid,
  version_number integer,
  previous_version_id uuid,
  base_total_cents bigint,
  prior_adjustment_total_cents bigint,
  adjustment_total_cents bigint,
  cumulative_adjustment_total_cents bigint,
  corrected_total_cents bigint,
  line_count integer,
  employee_count integer,
  reason text,
  approved_by uuid,
  approver_name text,
  approved_at timestamptz,
  created_at timestamptz
)
language plpgsql
stable
security definer
set search_path = pg_catalog, public
as $$
begin
  if not private.has_org_role(p_organization_id, array['admin']::text[]) then
    raise exception 'Korjausversioiden tarkastelu vaatii admin-roolin.' using errcode = '42501';
  end if;

  return query
  select
    version.id, version.payroll_period_id, version.correction_request_id,
    version.version_number, version.previous_version_id,
    version.base_total_cents, version.prior_adjustment_total_cents,
    version.adjustment_total_cents, version.cumulative_adjustment_total_cents,
    version.corrected_total_cents, version.line_count, version.employee_count,
    version.reason, version.approved_by,
    coalesce(profile.full_name, profile.email, 'Admin')::text,
    version.approved_at, version.created_at
  from public.payroll_correction_versions version
  left join public.profiles profile on profile.id = version.approved_by
  where version.organization_id = p_organization_id
    and (p_payroll_period_id is null or version.payroll_period_id = p_payroll_period_id)
  order by version.payroll_period_id, version.version_number desc;
end;
$$;

revoke all on function public.create_payroll_correction_request(uuid, uuid, text) from public, anon;
revoke all on function public.save_payroll_correction_line(uuid, uuid, uuid, text, text, bigint, text, date, text, uuid) from public, anon;
revoke all on function public.delete_payroll_correction_line(uuid) from public, anon;
revoke all on function public.submit_payroll_correction_request(uuid) from public, anon;
revoke all on function public.review_payroll_correction_request(uuid, text, text) from public, anon;
revoke all on function public.list_payroll_correction_periods(uuid) from public, anon;
revoke all on function public.list_payroll_correction_employee_context(uuid, uuid) from public, anon;
revoke all on function public.list_payroll_correction_requests(uuid, uuid) from public, anon;
revoke all on function public.list_payroll_correction_lines(uuid) from public, anon;
revoke all on function public.list_payroll_correction_versions(uuid, uuid) from public, anon;

grant execute on function public.create_payroll_correction_request(uuid, uuid, text) to authenticated, service_role;
grant execute on function public.save_payroll_correction_line(uuid, uuid, uuid, text, text, bigint, text, date, text, uuid) to authenticated, service_role;
grant execute on function public.delete_payroll_correction_line(uuid) to authenticated, service_role;
grant execute on function public.submit_payroll_correction_request(uuid) to authenticated, service_role;
grant execute on function public.review_payroll_correction_request(uuid, text, text) to authenticated, service_role;
grant execute on function public.list_payroll_correction_periods(uuid) to authenticated, service_role;
grant execute on function public.list_payroll_correction_employee_context(uuid, uuid) to authenticated, service_role;
grant execute on function public.list_payroll_correction_requests(uuid, uuid) to authenticated, service_role;
grant execute on function public.list_payroll_correction_lines(uuid) to authenticated, service_role;
grant execute on function public.list_payroll_correction_versions(uuid, uuid) to authenticated, service_role;
