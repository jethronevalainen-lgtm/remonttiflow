begin;

alter table public.change_orders
  add column if not exists customer_visible boolean not null default false,
  add column if not exists customer_decision text,
  add column if not exists customer_decision_note text,
  add column if not exists customer_decided_by uuid references public.profiles(id) on delete set null,
  add column if not exists customer_decided_at timestamptz,
  add column if not exists submitted_to_customer_at timestamptz,
  add column if not exists customer_version integer not null default 1,
  add column if not exists vat_percent numeric(5,2) not null default 25.5,
  add column if not exists schedule_effect_days integer not null default 0,
  add column if not exists customer_payload_hash text,
  add column if not exists vat_rate numeric(5,2) not null default 25.5,
  add column if not exists customer_content_hash text;

alter table public.change_orders drop constraint if exists change_orders_customer_decision_check;
alter table public.change_orders add constraint change_orders_customer_decision_check
  check (customer_decision is null or customer_decision in ('Odottaa','Hyväksytty','Hylätty'));
alter table public.change_orders drop constraint if exists change_orders_customer_version_check;
alter table public.change_orders add constraint change_orders_customer_version_check check (customer_version > 0);
alter table public.change_orders drop constraint if exists change_orders_vat_percent_check;
alter table public.change_orders add constraint change_orders_vat_percent_check check (vat_percent between 0 and 100);
alter table public.change_orders drop constraint if exists change_orders_vat_rate_check;
alter table public.change_orders add constraint change_orders_vat_rate_check check (vat_rate between 0 and 100);

create table if not exists public.customer_portal_decision_snapshots (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  project_id uuid references public.projects(id) on delete set null,
  subject_type text not null,
  subject_id uuid not null,
  subject_version integer not null default 1,
  decision text not null,
  decision_note text,
  decided_by uuid not null references public.profiles(id) on delete restrict,
  decided_at timestamptz not null default now(),
  payload jsonb not null,
  payload_hash text not null,
  created_at timestamptz not null default now(),
  customer_id uuid references public.customers(id) on delete set null,
  note text,
  snapshot jsonb,
  content_hash text
);

create unique index if not exists customer_portal_decision_snapshots_subject_version_idx
  on public.customer_portal_decision_snapshots(organization_id, subject_type, subject_id, subject_version);
create index if not exists customer_portal_decision_snapshots_project_idx
  on public.customer_portal_decision_snapshots(organization_id, project_id, decided_at desc);

alter table public.customer_portal_decision_snapshots enable row level security;
revoke all on public.customer_portal_decision_snapshots from anon, authenticated;

commit;
