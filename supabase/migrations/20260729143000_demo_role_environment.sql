begin;

create table if not exists public.demo_environments (
  owner_user_id uuid primary key references public.profiles (id) on delete cascade,
  organization_id uuid not null unique references public.organizations (id) on delete cascade,
  created_at timestamptz not null default now(),
  refreshed_at timestamptz not null default now()
);

comment on table public.demo_environments is
  'One isolated role-demo organization per administrator. Demo users and seeded business data are provisioned only by the protected edge function.';

alter table public.demo_environments enable row level security;

drop policy if exists demo_environments_select_own on public.demo_environments;
create policy demo_environments_select_own
on public.demo_environments
for select
to authenticated
using (owner_user_id = auth.uid());

revoke all on public.demo_environments from public, anon;
grant select on public.demo_environments to authenticated;

create index if not exists demo_environments_organization_id_idx
  on public.demo_environments (organization_id);

commit;
