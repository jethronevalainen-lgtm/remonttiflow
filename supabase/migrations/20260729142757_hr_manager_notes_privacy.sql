begin;

create table if not exists public.employee_manager_notes (
  employee_id uuid primary key references public.employees(id) on delete cascade,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  notes text not null,
  updated_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

insert into public.employee_manager_notes(employee_id, organization_id, notes, updated_by, created_at, updated_at)
select employee_id, organization_id, manager_notes, updated_by, created_at, updated_at
from public.employee_employment_profiles
where manager_notes is not null and btrim(manager_notes) <> ''
on conflict (employee_id) do update set
  organization_id = excluded.organization_id,
  notes = excluded.notes,
  updated_by = excluded.updated_by,
  updated_at = excluded.updated_at;

alter table public.employee_employment_profiles
  drop column if exists manager_notes;

create index if not exists employee_manager_notes_org_employee_idx
  on public.employee_manager_notes(organization_id, employee_id);
create index if not exists employee_manager_notes_updated_by_fk_idx
  on public.employee_manager_notes(updated_by)
  where updated_by is not null;

alter table public.employee_manager_notes enable row level security;

drop policy if exists employee_manager_notes_select on public.employee_manager_notes;
create policy employee_manager_notes_select on public.employee_manager_notes
for select to authenticated
using (private.can_manage_employee_hr(organization_id, employee_id));

drop policy if exists employee_manager_notes_insert on public.employee_manager_notes;
create policy employee_manager_notes_insert on public.employee_manager_notes
for insert to authenticated
with check (private.can_manage_employee_hr(organization_id, employee_id));

drop policy if exists employee_manager_notes_update on public.employee_manager_notes;
create policy employee_manager_notes_update on public.employee_manager_notes
for update to authenticated
using (private.can_manage_employee_hr(organization_id, employee_id))
with check (private.can_manage_employee_hr(organization_id, employee_id));

drop policy if exists employee_manager_notes_delete on public.employee_manager_notes;
create policy employee_manager_notes_delete on public.employee_manager_notes
for delete to authenticated
using (private.can_manage_employee_hr(organization_id, employee_id));

grant select, insert, update, delete on public.employee_manager_notes to authenticated;

drop trigger if exists validate_hr_employee_organization on public.employee_manager_notes;
create trigger validate_hr_employee_organization
before insert or update on public.employee_manager_notes
for each row execute function private.validate_hr_employee_organization();

drop trigger if exists touch_hr_updated_at on public.employee_manager_notes;
create trigger touch_hr_updated_at
before update on public.employee_manager_notes
for each row execute function private.touch_hr_updated_at();

create or replace function private.audit_employee_manager_notes()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  row_data jsonb;
begin
  row_data := case when tg_op = 'DELETE' then to_jsonb(old) else to_jsonb(new) end;
  insert into public.audit_logs(organization_id, user_id, action, table_name, record_id, metadata)
  values (
    (row_data ->> 'organization_id')::uuid,
    auth.uid(),
    lower(tg_op),
    'employee_manager_notes',
    (row_data ->> 'employee_id')::uuid,
    jsonb_build_object('sensitive_values_recorded', false)
  );
  return coalesce(new, old);
end;
$$;
revoke all on function private.audit_employee_manager_notes() from public, anon, authenticated;

drop trigger if exists audit_employee_manager_notes on public.employee_manager_notes;
create trigger audit_employee_manager_notes
after insert or update or delete on public.employee_manager_notes
for each row execute function private.audit_employee_manager_notes();

create or replace function public.save_employee_employment_profile(
  p_organization_id uuid,
  p_employee_id uuid,
  p_employee_number text,
  p_personal_email text,
  p_work_location text,
  p_cost_center text,
  p_job_level text,
  p_contract_type text,
  p_contract_start_date date,
  p_contract_end_date date,
  p_probation_end_date date,
  p_notice_period text,
  p_working_time_model text,
  p_remote_work_policy text,
  p_manager_notes text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null or not private.can_manage_employee_hr(p_organization_id, p_employee_id) then
    raise exception 'HR-tietojen muokkausoikeus puuttuu.' using errcode = '42501';
  end if;

  insert into public.employee_employment_profiles(
    employee_id, organization_id, employee_number, personal_email, work_location, cost_center,
    job_level, contract_type, contract_start_date, contract_end_date, probation_end_date,
    notice_period, working_time_model, remote_work_policy, updated_by
  ) values (
    p_employee_id, p_organization_id, nullif(btrim(p_employee_number), ''), nullif(lower(btrim(p_personal_email)), ''),
    nullif(btrim(p_work_location), ''), nullif(btrim(p_cost_center), ''), nullif(btrim(p_job_level), ''),
    nullif(btrim(p_contract_type), ''), p_contract_start_date, p_contract_end_date, p_probation_end_date,
    nullif(btrim(p_notice_period), ''), nullif(btrim(p_working_time_model), ''),
    nullif(btrim(p_remote_work_policy), ''), auth.uid()
  )
  on conflict (employee_id) do update set
    organization_id = excluded.organization_id,
    employee_number = excluded.employee_number,
    personal_email = excluded.personal_email,
    work_location = excluded.work_location,
    cost_center = excluded.cost_center,
    job_level = excluded.job_level,
    contract_type = excluded.contract_type,
    contract_start_date = excluded.contract_start_date,
    contract_end_date = excluded.contract_end_date,
    probation_end_date = excluded.probation_end_date,
    notice_period = excluded.notice_period,
    working_time_model = excluded.working_time_model,
    remote_work_policy = excluded.remote_work_policy,
    updated_by = auth.uid();

  if nullif(btrim(p_manager_notes), '') is null then
    delete from public.employee_manager_notes
    where organization_id = p_organization_id and employee_id = p_employee_id;
  else
    insert into public.employee_manager_notes(employee_id, organization_id, notes, updated_by)
    values (p_employee_id, p_organization_id, btrim(p_manager_notes), auth.uid())
    on conflict (employee_id) do update set
      organization_id = excluded.organization_id,
      notes = excluded.notes,
      updated_by = auth.uid();
  end if;
end;
$$;

revoke all on function public.save_employee_employment_profile(
  uuid, uuid, text, text, text, text, text, text, date, date, date, text, text, text, text
) from public, anon;
grant execute on function public.save_employee_employment_profile(
  uuid, uuid, text, text, text, text, text, text, date, date, date, text, text, text, text
) to authenticated;

commit;
