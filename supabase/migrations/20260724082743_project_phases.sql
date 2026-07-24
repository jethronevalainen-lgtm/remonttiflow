create table if not exists public.project_phases (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  project_id uuid references public.projects(id) on delete cascade,
  created_by uuid references auth.users(id) on delete set null,
  name text not null,
  project_name text,
  start_date date not null,
  end_date date not null,
  status text not null default 'Suunniteltu'
    check (status in ('Suunniteltu', 'Käynnissä', 'Valmis', 'Myöhässä')),
  progress numeric not null default 0
    check (progress >= 0 and progress <= 100),
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (end_date >= start_date)
);

create index if not exists project_phases_organization_id_idx
  on public.project_phases (organization_id);
create index if not exists project_phases_project_id_idx
  on public.project_phases (project_id);
create index if not exists project_phases_created_by_idx
  on public.project_phases (created_by);
create index if not exists project_phases_dates_idx
  on public.project_phases (organization_id, start_date, end_date);

alter table public.project_phases enable row level security;

drop policy if exists project_phases_select on public.project_phases;
create policy project_phases_select on public.project_phases
  for select to authenticated
  using (private.is_org_member(organization_id));

drop policy if exists project_phases_insert on public.project_phases;
create policy project_phases_insert on public.project_phases
  for insert to authenticated
  with check (
    private.has_org_role(organization_id, array['admin', 'supervisor'])
    and (created_by is null or created_by = (select auth.uid()))
  );

drop policy if exists project_phases_update on public.project_phases;
create policy project_phases_update on public.project_phases
  for update to authenticated
  using (private.has_org_role(organization_id, array['admin', 'supervisor']))
  with check (private.has_org_role(organization_id, array['admin', 'supervisor']));

drop policy if exists project_phases_delete on public.project_phases;
create policy project_phases_delete on public.project_phases
  for delete to authenticated
  using (private.has_org_role(organization_id, array['admin', 'supervisor']));

drop trigger if exists project_phases_set_updated_at on public.project_phases;
create trigger project_phases_set_updated_at
  before update on public.project_phases
  for each row execute function public.set_updated_at();
