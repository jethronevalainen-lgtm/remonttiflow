begin;

alter table public.demo_environments
  add column if not exists source_organization_id uuid references public.organizations (id) on delete set null,
  add column if not exists active_scenario text not null default 'normal',
  add column if not exists dataset_version integer not null default 3,
  add column if not exists seeded_counts jsonb not null default '{}'::jsonb;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.demo_environments'::regclass
      and conname = 'demo_environments_active_scenario_check'
  ) then
    alter table public.demo_environments
      add constraint demo_environments_active_scenario_check
      check (active_scenario in ('normal', 'busy', 'late', 'empty', 'handover'));
  end if;

  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.demo_environments'::regclass
      and conname = 'demo_environments_dataset_version_check'
  ) then
    alter table public.demo_environments
      add constraint demo_environments_dataset_version_check
      check (dataset_version > 0);
  end if;
end;
$$;

create table if not exists public.demo_review_items (
  id uuid primary key default gen_random_uuid(),
  owner_user_id uuid not null references public.profiles (id) on delete cascade,
  organization_id uuid not null references public.organizations (id) on delete cascade,
  scenario text not null,
  dataset_version integer not null,
  role text not null,
  device text not null,
  check_key text not null,
  status text not null default 'not_tested',
  note text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint demo_review_items_scenario_check check (scenario in ('normal', 'busy', 'late', 'empty', 'handover')),
  constraint demo_review_items_version_check check (dataset_version > 0),
  constraint demo_review_items_role_check check (role in ('supervisor', 'project_coordinator', 'worker', 'customer')),
  constraint demo_review_items_device_check check (device in ('desktop', 'mobile')),
  constraint demo_review_items_status_check check (status in ('not_tested', 'passed', 'failed')),
  constraint demo_review_items_check_key_check check (length(trim(check_key)) between 1 and 120),
  constraint demo_review_items_note_check check (length(note) <= 4000),
  unique (owner_user_id, organization_id, scenario, dataset_version, role, device, check_key)
);

create table if not exists public.demo_review_findings (
  id uuid primary key default gen_random_uuid(),
  owner_user_id uuid not null references public.profiles (id) on delete cascade,
  organization_id uuid not null references public.organizations (id) on delete cascade,
  scenario text not null,
  dataset_version integer not null,
  role text not null,
  device text not null,
  severity text not null default 'warning',
  status text not null default 'open',
  title text not null,
  description text not null default '',
  page_path text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  resolved_at timestamptz,
  constraint demo_review_findings_scenario_check check (scenario in ('normal', 'busy', 'late', 'empty', 'handover')),
  constraint demo_review_findings_version_check check (dataset_version > 0),
  constraint demo_review_findings_role_check check (role in ('supervisor', 'project_coordinator', 'worker', 'customer')),
  constraint demo_review_findings_device_check check (device in ('desktop', 'mobile')),
  constraint demo_review_findings_severity_check check (severity in ('info', 'warning', 'critical')),
  constraint demo_review_findings_status_check check (status in ('open', 'resolved')),
  constraint demo_review_findings_title_check check (length(trim(title)) between 1 and 240),
  constraint demo_review_findings_description_check check (length(description) <= 8000),
  constraint demo_review_findings_page_path_check check (length(page_path) <= 500)
);

create index if not exists demo_review_items_environment_idx
  on public.demo_review_items (owner_user_id, organization_id, scenario, dataset_version, role, device);
create index if not exists demo_review_findings_environment_idx
  on public.demo_review_findings (owner_user_id, organization_id, scenario, dataset_version, status, role);

alter table public.demo_review_items enable row level security;
alter table public.demo_review_findings enable row level security;

drop policy if exists demo_review_items_owner_all on public.demo_review_items;
create policy demo_review_items_owner_all
on public.demo_review_items
for all
to authenticated
using (
  owner_user_id = auth.uid()
  and exists (
    select 1 from public.demo_environments de
    where de.owner_user_id = auth.uid()
      and de.organization_id = demo_review_items.organization_id
  )
)
with check (
  owner_user_id = auth.uid()
  and exists (
    select 1 from public.demo_environments de
    where de.owner_user_id = auth.uid()
      and de.organization_id = demo_review_items.organization_id
  )
);

drop policy if exists demo_review_findings_owner_all on public.demo_review_findings;
create policy demo_review_findings_owner_all
on public.demo_review_findings
for all
to authenticated
using (
  owner_user_id = auth.uid()
  and exists (
    select 1 from public.demo_environments de
    where de.owner_user_id = auth.uid()
      and de.organization_id = demo_review_findings.organization_id
  )
)
with check (
  owner_user_id = auth.uid()
  and exists (
    select 1 from public.demo_environments de
    where de.owner_user_id = auth.uid()
      and de.organization_id = demo_review_findings.organization_id
  )
);

revoke all on public.demo_review_items from public, anon;
revoke all on public.demo_review_findings from public, anon;
grant select, insert, update, delete on public.demo_review_items to authenticated;
grant select, insert, update, delete on public.demo_review_findings to authenticated;

comment on table public.demo_review_items is
  'Administrator-owned role QA checklist results, separated by demo scenario, dataset version and device class.';
comment on table public.demo_review_findings is
  'Administrator-owned observations found while validating isolated demo roles.';

commit;
