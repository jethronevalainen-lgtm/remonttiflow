begin;

create or replace function private.can_manage_employee_hr(p_organization_id uuid, p_employee_id uuid)
returns boolean
language sql
stable
security definer
set search_path = 'pg_catalog', 'public'
as $$
  select auth.uid() is not null and (
    private.has_org_role(p_organization_id, array['admin']::text[])
    or (
      private.has_org_role(p_organization_id, array['supervisor']::text[])
      and exists (
        select 1
        from public.supervisor_team_members stm
        where stm.organization_id = p_organization_id
          and stm.employee_id = p_employee_id
          and stm.supervisor_user_id = auth.uid()
          and stm.is_active
      )
    )
  );
$$;

revoke all on function private.can_manage_employee_hr(uuid, uuid) from public, anon, authenticated;
grant execute on function private.can_manage_employee_hr(uuid, uuid) to authenticated;

create table if not exists public.employee_employment_profiles (
  employee_id uuid primary key references public.employees(id) on delete cascade,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  employee_number text,
  personal_email text,
  work_location text,
  cost_center text,
  job_level text,
  contract_type text,
  contract_start_date date,
  contract_end_date date,
  probation_end_date date,
  notice_period text,
  working_time_model text,
  remote_work_policy text,
  manager_notes text,
  updated_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint employee_employment_profile_dates_check check (
    contract_end_date is null or contract_start_date is null or contract_end_date >= contract_start_date
  ),
  constraint employee_employment_profile_probation_check check (
    probation_end_date is null or contract_start_date is null or probation_end_date >= contract_start_date
  )
);

create unique index if not exists employee_employment_number_unique
  on public.employee_employment_profiles(organization_id, lower(employee_number))
  where employee_number is not null and btrim(employee_number) <> '';
create index if not exists employee_employment_profiles_org_idx
  on public.employee_employment_profiles(organization_id, employee_id);

create table if not exists public.employee_skills (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  employee_id uuid not null references public.employees(id) on delete cascade,
  skill_name text not null,
  category text not null default 'Ammattiosaaminen',
  current_level smallint not null default 1,
  target_level smallint not null default 3,
  assessment_source text not null default 'esihenkilö',
  last_assessed_at date,
  verified_by uuid references auth.users(id) on delete set null,
  notes text,
  created_by uuid references auth.users(id) on delete set null,
  updated_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint employee_skills_current_level_check check (current_level between 1 and 5),
  constraint employee_skills_target_level_check check (target_level between 1 and 5),
  constraint employee_skills_source_check check (assessment_source in ('työntekijä', 'esihenkilö', 'HR', 'näyttö', 'muu'))
);
create unique index if not exists employee_skills_unique
  on public.employee_skills(organization_id, employee_id, lower(skill_name));
create index if not exists employee_skills_employee_idx
  on public.employee_skills(organization_id, employee_id, category);

create table if not exists public.employee_training_records (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  employee_id uuid not null references public.employees(id) on delete cascade,
  title text not null,
  provider text,
  training_type text not null default 'Koulutus',
  status text not null default 'Suunniteltu',
  start_date date,
  end_date date,
  hours numeric(7,2),
  cost_cents bigint,
  valid_until date,
  notes text,
  created_by uuid references auth.users(id) on delete set null,
  updated_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint employee_training_status_check check (status in ('Suunniteltu', 'Ilmoittautunut', 'Käynnissä', 'Suoritettu', 'Peruttu')),
  constraint employee_training_dates_check check (end_date is null or start_date is null or end_date >= start_date),
  constraint employee_training_hours_check check (hours is null or hours >= 0),
  constraint employee_training_cost_check check (cost_cents is null or cost_cents >= 0)
);
create index if not exists employee_training_employee_idx
  on public.employee_training_records(organization_id, employee_id, status, start_date desc);

create table if not exists public.employee_goals (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  employee_id uuid not null references public.employees(id) on delete cascade,
  title text not null,
  description text,
  category text not null default 'Työ',
  status text not null default 'Luonnos',
  progress smallint not null default 0,
  target_date date,
  completed_at timestamptz,
  employee_comment text,
  manager_comment text,
  created_by uuid references auth.users(id) on delete set null,
  updated_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint employee_goals_status_check check (status in ('Luonnos', 'Sovittu', 'Käynnissä', 'Valmis', 'Keskeytetty')),
  constraint employee_goals_progress_check check (progress between 0 and 100)
);
create index if not exists employee_goals_employee_idx
  on public.employee_goals(organization_id, employee_id, status, target_date);

create table if not exists public.employee_conversations (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  employee_id uuid not null references public.employees(id) on delete cascade,
  conversation_type text not null default '1:1',
  scheduled_at timestamptz,
  held_at timestamptz,
  status text not null default 'Suunniteltu',
  summary text,
  agreed_actions text,
  next_follow_up_date date,
  employee_acknowledged_at timestamptz,
  created_by uuid references auth.users(id) on delete set null,
  updated_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint employee_conversation_type_check check (
    conversation_type in ('1:1', 'Kehityskeskustelu', 'Suoritusarvio', 'Varhainen tuki', 'Työhön paluu', 'Muu')
  ),
  constraint employee_conversation_status_check check (status in ('Suunniteltu', 'Pidetty', 'Siirretty', 'Peruttu'))
);
create index if not exists employee_conversations_employee_idx
  on public.employee_conversations(organization_id, employee_id, scheduled_at desc);

create table if not exists public.employee_hr_tasks (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  employee_id uuid not null references public.employees(id) on delete cascade,
  phase text not null default 'Perehdytys',
  title text not null,
  description text,
  owner_user_id uuid references auth.users(id) on delete set null,
  due_date date,
  status text not null default 'Avoin',
  completed_at timestamptz,
  sort_order integer not null default 0,
  created_by uuid references auth.users(id) on delete set null,
  updated_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint employee_hr_tasks_phase_check check (phase in ('Perehdytys', 'Työsuhdemuutos', 'Poistuminen', 'Muu')),
  constraint employee_hr_tasks_status_check check (status in ('Avoin', 'Käynnissä', 'Valmis', 'Ohitettu'))
);
create index if not exists employee_hr_tasks_employee_idx
  on public.employee_hr_tasks(organization_id, employee_id, phase, status, due_date);

create table if not exists public.employee_documents (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  employee_id uuid not null references public.employees(id) on delete cascade,
  title text not null,
  document_type text not null default 'Muu',
  storage_path text not null unique,
  original_filename text not null,
  mime_type text,
  size_bytes bigint,
  issue_date date,
  valid_until date,
  visibility text not null default 'HR ja esihenkilö',
  notes text,
  uploaded_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint employee_documents_dates_check check (valid_until is null or issue_date is null or valid_until >= issue_date),
  constraint employee_documents_size_check check (size_bytes is null or size_bytes >= 0),
  constraint employee_documents_visibility_check check (visibility in ('Vain HR', 'HR ja esihenkilö', 'Työntekijä'))
);
create index if not exists employee_documents_employee_idx
  on public.employee_documents(organization_id, employee_id, document_type, valid_until);

create table if not exists public.employee_hr_events (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  employee_id uuid not null references public.employees(id) on delete cascade,
  event_type text not null,
  event_date timestamptz not null default now(),
  title text not null,
  description text,
  metadata jsonb not null default '{}'::jsonb,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);
create index if not exists employee_hr_events_employee_idx
  on public.employee_hr_events(organization_id, employee_id, event_date desc);

create or replace function private.validate_hr_employee_organization()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not exists (
    select 1 from public.employees e
    where e.id = new.employee_id
      and e.organization_id = new.organization_id
      and e.archived_at is null
  ) then
    raise exception 'Työntekijä ei kuulu HR-tiedon organisaatioon.' using errcode = '23514';
  end if;
  return new;
end;
$$;
revoke all on function private.validate_hr_employee_organization() from public, anon, authenticated;

create or replace function private.touch_hr_updated_at()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;
revoke all on function private.touch_hr_updated_at() from public, anon, authenticated;

create or replace function private.log_employee_hr_event()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  row_data jsonb;
  target_org uuid;
  target_employee uuid;
  record_title text;
  record_status text;
begin
  row_data := case when tg_op = 'DELETE' then to_jsonb(old) else to_jsonb(new) end;
  target_org := (row_data ->> 'organization_id')::uuid;
  target_employee := (row_data ->> 'employee_id')::uuid;
  record_title := coalesce(
    nullif(row_data ->> 'title', ''),
    nullif(row_data ->> 'skill_name', ''),
    nullif(row_data ->> 'conversation_type', ''),
    nullif(row_data ->> 'document_type', ''),
    tg_table_name
  );
  record_status := nullif(row_data ->> 'status', '');

  insert into public.employee_hr_events(
    organization_id,
    employee_id,
    event_type,
    title,
    metadata,
    created_by
  ) values (
    target_org,
    target_employee,
    tg_table_name || '_' || lower(tg_op),
    record_title,
    jsonb_strip_nulls(jsonb_build_object(
      'operation', lower(tg_op),
      'table', tg_table_name,
      'record_id', row_data ->> 'id',
      'status', record_status
    )),
    auth.uid()
  );
  return coalesce(new, old);
end;
$$;
revoke all on function private.log_employee_hr_event() from public, anon, authenticated;

DO $$
declare
  table_name text;
begin
  foreach table_name in array array[
    'employee_employment_profiles',
    'employee_skills',
    'employee_training_records',
    'employee_goals',
    'employee_conversations',
    'employee_hr_tasks',
    'employee_documents'
  ] loop
    execute format('drop trigger if exists validate_hr_employee_organization on public.%I', table_name);
    execute format('create trigger validate_hr_employee_organization before insert or update on public.%I for each row execute function private.validate_hr_employee_organization()', table_name);
  end loop;
end;
$$;

DO $$
declare
  table_name text;
begin
  foreach table_name in array array[
    'employee_employment_profiles',
    'employee_skills',
    'employee_training_records',
    'employee_goals',
    'employee_conversations',
    'employee_hr_tasks',
    'employee_documents'
  ] loop
    execute format('drop trigger if exists touch_hr_updated_at on public.%I', table_name);
    execute format('create trigger touch_hr_updated_at before update on public.%I for each row execute function private.touch_hr_updated_at()', table_name);
    execute format('drop trigger if exists log_employee_hr_event on public.%I', table_name);
    execute format('create trigger log_employee_hr_event after insert or update or delete on public.%I for each row execute function private.log_employee_hr_event()', table_name);
  end loop;
end;
$$;

commit;
