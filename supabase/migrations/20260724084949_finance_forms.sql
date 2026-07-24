create table if not exists public.estimates (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  project_id uuid references public.projects(id) on delete set null,
  created_by uuid references auth.users(id) on delete set null,
  name text not null,
  project_name text,
  status text not null default 'Luonnos'
    check (status in ('Luonnos', 'Hyväksytty', 'Arkistoitu')),
  vat_rate numeric not null default 0 check (vat_rate >= 0 and vat_rate <= 100),
  overhead_percent numeric not null default 0 check (overhead_percent >= 0 and overhead_percent <= 100),
  risk_percent numeric not null default 0 check (risk_percent >= 0 and risk_percent <= 100),
  margin_percent numeric not null default 0 check (margin_percent >= 0 and margin_percent <= 100),
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.estimate_lines (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  estimate_id uuid not null references public.estimates(id) on delete cascade,
  created_by uuid references auth.users(id) on delete set null,
  category text not null,
  description text not null,
  quantity numeric not null default 0 check (quantity >= 0),
  unit text not null,
  unit_price_cents bigint not null default 0 check (unit_price_cents >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.quantity_takeoffs (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  project_id uuid references public.projects(id) on delete set null,
  created_by uuid references auth.users(id) on delete set null,
  name text not null,
  project_name text,
  status text not null default 'Luonnos'
    check (status in ('Luonnos', 'Valmis', 'Arkistoitu')),
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.quantity_takeoff_lines (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  takeoff_id uuid not null references public.quantity_takeoffs(id) on delete cascade,
  created_by uuid references auth.users(id) on delete set null,
  work_phase text not null,
  description text not null,
  quantity numeric not null default 0 check (quantity >= 0),
  unit text not null,
  waste_percent numeric not null default 0 check (waste_percent >= 0 and waste_percent <= 100),
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.form_templates (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  created_by uuid references auth.users(id) on delete set null,
  name text not null,
  category text not null,
  description text,
  fields jsonb not null default '[]'::jsonb,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (jsonb_typeof(fields) = 'array')
);

create table if not exists public.form_submissions (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  template_id uuid not null references public.form_templates(id) on delete restrict,
  project_id uuid references public.projects(id) on delete set null,
  submitted_by uuid references auth.users(id) on delete set null,
  title text not null,
  status text not null default 'Luonnos'
    check (status in ('Luonnos', 'Lähetetty', 'Hyväksytty', 'Hylätty')),
  data jsonb not null default '{}'::jsonb,
  submitted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (jsonb_typeof(data) = 'object')
);

create index if not exists estimates_organization_id_idx on public.estimates (organization_id);
create index if not exists estimates_project_id_idx on public.estimates (project_id);
create index if not exists estimates_created_by_idx on public.estimates (created_by);
create index if not exists estimate_lines_organization_id_idx on public.estimate_lines (organization_id);
create index if not exists estimate_lines_estimate_id_idx on public.estimate_lines (estimate_id);
create index if not exists estimate_lines_created_by_idx on public.estimate_lines (created_by);
create index if not exists quantity_takeoffs_organization_id_idx on public.quantity_takeoffs (organization_id);
create index if not exists quantity_takeoffs_project_id_idx on public.quantity_takeoffs (project_id);
create index if not exists quantity_takeoffs_created_by_idx on public.quantity_takeoffs (created_by);
create index if not exists quantity_takeoff_lines_organization_id_idx on public.quantity_takeoff_lines (organization_id);
create index if not exists quantity_takeoff_lines_takeoff_id_idx on public.quantity_takeoff_lines (takeoff_id);
create index if not exists quantity_takeoff_lines_created_by_idx on public.quantity_takeoff_lines (created_by);
create index if not exists form_templates_organization_id_idx on public.form_templates (organization_id);
create index if not exists form_templates_created_by_idx on public.form_templates (created_by);
create index if not exists form_submissions_organization_id_idx on public.form_submissions (organization_id);
create index if not exists form_submissions_template_id_idx on public.form_submissions (template_id);
create index if not exists form_submissions_project_id_idx on public.form_submissions (project_id);
create index if not exists form_submissions_submitted_by_idx on public.form_submissions (submitted_by);

alter table public.estimates enable row level security;
alter table public.estimate_lines enable row level security;
alter table public.quantity_takeoffs enable row level security;
alter table public.quantity_takeoff_lines enable row level security;
alter table public.form_templates enable row level security;
alter table public.form_submissions enable row level security;

create policy estimates_select on public.estimates for select to authenticated
  using (private.is_org_member(organization_id));
create policy estimates_insert on public.estimates for insert to authenticated
  with check (private.has_org_role(organization_id, array['admin', 'supervisor']) and (created_by is null or created_by = (select auth.uid())));
create policy estimates_update on public.estimates for update to authenticated
  using (private.has_org_role(organization_id, array['admin', 'supervisor']))
  with check (private.has_org_role(organization_id, array['admin', 'supervisor']));
create policy estimates_delete on public.estimates for delete to authenticated
  using (private.has_org_role(organization_id, array['admin', 'supervisor']));

create policy estimate_lines_select on public.estimate_lines for select to authenticated
  using (private.is_org_member(organization_id));
create policy estimate_lines_insert on public.estimate_lines for insert to authenticated
  with check (private.has_org_role(organization_id, array['admin', 'supervisor']) and (created_by is null or created_by = (select auth.uid())));
create policy estimate_lines_update on public.estimate_lines for update to authenticated
  using (private.has_org_role(organization_id, array['admin', 'supervisor']))
  with check (private.has_org_role(organization_id, array['admin', 'supervisor']));
create policy estimate_lines_delete on public.estimate_lines for delete to authenticated
  using (private.has_org_role(organization_id, array['admin', 'supervisor']));

create policy quantity_takeoffs_select on public.quantity_takeoffs for select to authenticated
  using (private.is_org_member(organization_id));
create policy quantity_takeoffs_insert on public.quantity_takeoffs for insert to authenticated
  with check (private.has_org_role(organization_id, array['admin', 'supervisor']) and (created_by is null or created_by = (select auth.uid())));
create policy quantity_takeoffs_update on public.quantity_takeoffs for update to authenticated
  using (private.has_org_role(organization_id, array['admin', 'supervisor']))
  with check (private.has_org_role(organization_id, array['admin', 'supervisor']));
create policy quantity_takeoffs_delete on public.quantity_takeoffs for delete to authenticated
  using (private.has_org_role(organization_id, array['admin', 'supervisor']));

create policy quantity_takeoff_lines_select on public.quantity_takeoff_lines for select to authenticated
  using (private.is_org_member(organization_id));
create policy quantity_takeoff_lines_insert on public.quantity_takeoff_lines for insert to authenticated
  with check (private.has_org_role(organization_id, array['admin', 'supervisor']) and (created_by is null or created_by = (select auth.uid())));
create policy quantity_takeoff_lines_update on public.quantity_takeoff_lines for update to authenticated
  using (private.has_org_role(organization_id, array['admin', 'supervisor']))
  with check (private.has_org_role(organization_id, array['admin', 'supervisor']));
create policy quantity_takeoff_lines_delete on public.quantity_takeoff_lines for delete to authenticated
  using (private.has_org_role(organization_id, array['admin', 'supervisor']));

create policy form_templates_select on public.form_templates for select to authenticated
  using (private.is_org_member(organization_id));
create policy form_templates_insert on public.form_templates for insert to authenticated
  with check (private.has_org_role(organization_id, array['admin', 'supervisor']) and (created_by is null or created_by = (select auth.uid())));
create policy form_templates_update on public.form_templates for update to authenticated
  using (private.has_org_role(organization_id, array['admin', 'supervisor']))
  with check (private.has_org_role(organization_id, array['admin', 'supervisor']));
create policy form_templates_delete on public.form_templates for delete to authenticated
  using (private.has_org_role(organization_id, array['admin', 'supervisor']));

create policy form_submissions_select on public.form_submissions for select to authenticated
  using (private.is_org_member(organization_id));
create policy form_submissions_insert on public.form_submissions for insert to authenticated
  with check (private.is_org_member(organization_id) and (submitted_by is null or submitted_by = (select auth.uid())));
create policy form_submissions_update on public.form_submissions for update to authenticated
  using (
    private.has_org_role(organization_id, array['admin', 'supervisor'])
    or (submitted_by = (select auth.uid()) and status = 'Luonnos')
  )
  with check (private.is_org_member(organization_id));
create policy form_submissions_delete on public.form_submissions for delete to authenticated
  using (
    private.has_org_role(organization_id, array['admin', 'supervisor'])
    or (submitted_by = (select auth.uid()) and status = 'Luonnos')
  );

create trigger estimates_set_updated_at before update on public.estimates
  for each row execute function public.set_updated_at();
create trigger estimate_lines_set_updated_at before update on public.estimate_lines
  for each row execute function public.set_updated_at();
create trigger quantity_takeoffs_set_updated_at before update on public.quantity_takeoffs
  for each row execute function public.set_updated_at();
create trigger quantity_takeoff_lines_set_updated_at before update on public.quantity_takeoff_lines
  for each row execute function public.set_updated_at();
create trigger form_templates_set_updated_at before update on public.form_templates
  for each row execute function public.set_updated_at();
create trigger form_submissions_set_updated_at before update on public.form_submissions
  for each row execute function public.set_updated_at();
