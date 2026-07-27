begin;

create table if not exists public.customer_cases (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  case_number text not null default (
    'REC-' || to_char(now(), 'YYYY') || '-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 6))
  ),
  customer_id uuid not null references public.customers(id) on delete cascade,
  site_id uuid references public.customer_sites(id) on delete set null,
  project_id uuid references public.projects(id) on delete set null,
  work_request_id uuid unique references public.customer_work_requests(id) on delete set null,
  work_order_id uuid references public.work_orders(id) on delete set null,
  case_type text not null default 'Reklamaatio'
    check (case_type in ('Reklamaatio', 'Takuu', 'Laatupoikkeama', 'Huolto')),
  title text not null,
  description text not null,
  reported_by_name text,
  reported_by_email text,
  reported_by_phone text,
  reported_at timestamptz not null default now(),
  priority text not null default 'Normaali'
    check (priority in ('Matala', 'Normaali', 'Korkea', 'Kriittinen')),
  status text not null default 'Uusi'
    check (status in (
      'Uusi',
      'Selvityksessä',
      'Korjaus sovittu',
      'Korjauksessa',
      'Odottaa asiakkaan hyväksyntää',
      'Suljettu',
      'Hylätty'
    )),
  due_at timestamptz,
  assigned_user_id uuid references auth.users(id) on delete set null,
  warranty_covered boolean,
  root_cause text,
  resolution text,
  estimated_cost_cents bigint not null default 0 check (estimated_cost_cents >= 0),
  actual_cost_cents bigint not null default 0 check (actual_cost_cents >= 0),
  customer_visible boolean not null default false,
  customer_decision text check (customer_decision in ('Odottaa', 'Hyväksytty', 'Hylätty')),
  customer_decision_note text,
  customer_decided_by uuid references auth.users(id) on delete set null,
  customer_decided_at timestamptz,
  closed_at timestamptz,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, case_number)
);

create index if not exists customer_cases_org_status_idx
  on public.customer_cases(organization_id, status, due_at);
create index if not exists customer_cases_customer_idx
  on public.customer_cases(organization_id, customer_id, created_at desc);
create index if not exists customer_cases_project_idx
  on public.customer_cases(project_id, customer_visible, created_at desc);
create index if not exists customer_cases_site_id_idx
  on public.customer_cases(site_id);
create index if not exists customer_cases_work_order_id_idx
  on public.customer_cases(work_order_id);
create index if not exists customer_cases_assigned_user_id_idx
  on public.customer_cases(assigned_user_id);
create index if not exists customer_cases_created_by_idx
  on public.customer_cases(created_by);
create index if not exists customer_cases_customer_decided_by_idx
  on public.customer_cases(customer_decided_by);

alter table public.customer_cases enable row level security;
revoke all on public.customer_cases from anon;
grant select, insert, update, delete on public.customer_cases to authenticated;

drop policy if exists customer_cases_management_select on public.customer_cases;
create policy customer_cases_management_select
on public.customer_cases for select to authenticated
using (private.is_management_user(organization_id, (select auth.uid())));

drop policy if exists customer_cases_customer_select on public.customer_cases;
create policy customer_cases_customer_select
on public.customer_cases for select to authenticated
using (
  customer_visible
  and project_id is not null
  and private.customer_user_can_access_project(project_id, organization_id, (select auth.uid()))
);

drop policy if exists customer_cases_management_insert on public.customer_cases;
create policy customer_cases_management_insert
on public.customer_cases for insert to authenticated
with check (private.is_management_user(organization_id, (select auth.uid())));

drop policy if exists customer_cases_management_update on public.customer_cases;
create policy customer_cases_management_update
on public.customer_cases for update to authenticated
using (private.is_management_user(organization_id, (select auth.uid())))
with check (private.is_management_user(organization_id, (select auth.uid())));

drop policy if exists customer_cases_management_delete on public.customer_cases;
create policy customer_cases_management_delete
on public.customer_cases for delete to authenticated
using (private.is_management_user(organization_id, (select auth.uid())));

drop trigger if exists customer_cases_set_updated_at on public.customer_cases;
create trigger customer_cases_set_updated_at
before update on public.customer_cases
for each row execute function public.set_updated_at();

drop trigger if exists audit_customer_cases_change on public.customer_cases;
create trigger audit_customer_cases_change
after insert or update or delete on public.customer_cases
for each row execute function private.audit_business_change();

create or replace function private.create_case_from_reclamation_request()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_site_id uuid;
begin
  if new.category <> 'Reklamaatio' then
    return new;
  end if;

  select p.customer_site_id
  into v_site_id
  from public.projects p
  where p.id = new.project_id
    and p.organization_id = new.organization_id;

  insert into public.customer_cases (
    organization_id,
    customer_id,
    site_id,
    project_id,
    work_request_id,
    case_type,
    title,
    description,
    reported_by_name,
    reported_by_phone,
    priority,
    due_at,
    customer_visible,
    created_by
  )
  values (
    new.organization_id,
    new.customer_id,
    v_site_id,
    new.project_id,
    new.id,
    'Reklamaatio',
    new.title,
    new.description,
    new.contact_name,
    new.contact_phone,
    case new.urgency
      when 'Kiireellinen' then 'Kriittinen'
      when 'Ei kiireellinen' then 'Matala'
      else 'Normaali'
    end,
    case
      when new.requested_date is not null then new.requested_date::timestamptz + interval '16 hours'
      else now() + interval '3 days'
    end,
    true,
    new.created_by
  )
  on conflict (work_request_id) do nothing;

  return new;
end;
$$;

revoke all on function private.create_case_from_reclamation_request() from public, anon, authenticated;

drop trigger if exists create_case_from_reclamation_request on public.customer_work_requests;
create trigger create_case_from_reclamation_request
after insert on public.customer_work_requests
for each row execute function private.create_case_from_reclamation_request();

create or replace function public.customer_project_cases_v2(p_project_id uuid)
returns table (
  id uuid,
  case_number text,
  case_type text,
  title text,
  description text,
  priority text,
  status text,
  reported_at timestamptz,
  due_at timestamptz,
  warranty_covered boolean,
  resolution text,
  customer_decision text,
  customer_decision_note text,
  customer_decided_at timestamptz,
  closed_at timestamptz
)
language sql
stable
security definer
set search_path = pg_catalog, public
as $$
  select
    c.id,
    c.case_number,
    c.case_type,
    c.title,
    c.description,
    c.priority,
    c.status,
    c.reported_at,
    c.due_at,
    c.warranty_covered,
    c.resolution,
    c.customer_decision,
    c.customer_decision_note,
    c.customer_decided_at,
    c.closed_at
  from public.customer_cases c
  where c.project_id = p_project_id
    and c.customer_visible
    and private.customer_user_can_access_project(c.project_id, c.organization_id, auth.uid())
  order by c.created_at desc;
$$;

revoke all on function public.customer_project_cases_v2(uuid) from public, anon;
grant execute on function public.customer_project_cases_v2(uuid) to authenticated;

create or replace function public.decide_customer_case_resolution_v2(
  p_case_id uuid,
  p_decision text,
  p_note text default null
)
returns void
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_case public.customer_cases%rowtype;
begin
  if p_decision not in ('Hyväksytty', 'Hylätty') then
    raise exception 'invalid decision' using errcode = '22023';
  end if;

  select *
  into v_case
  from public.customer_cases
  where id = p_case_id
  for update;

  if not found
     or not v_case.customer_visible
     or v_case.project_id is null
     or not private.customer_user_can_access_project(v_case.project_id, v_case.organization_id, auth.uid()) then
    raise exception 'case not found' using errcode = 'P0002';
  end if;

  if v_case.status <> 'Odottaa asiakkaan hyväksyntää' then
    raise exception 'case is not waiting for customer acceptance' using errcode = '22023';
  end if;

  update public.customer_cases
  set customer_decision = p_decision,
      customer_decision_note = nullif(btrim(p_note), ''),
      customer_decided_by = auth.uid(),
      customer_decided_at = now(),
      status = case when p_decision = 'Hyväksytty' then 'Suljettu' else 'Selvityksessä' end,
      closed_at = case when p_decision = 'Hyväksytty' then now() else null end
  where id = p_case_id;
end;
$$;

revoke all on function public.decide_customer_case_resolution_v2(uuid, text, text) from public, anon;
grant execute on function public.decide_customer_case_resolution_v2(uuid, text, text) to authenticated;

commit;
