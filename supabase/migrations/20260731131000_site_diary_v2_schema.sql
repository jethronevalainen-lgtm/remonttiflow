begin;

-- VaKantti worksite diary V2. The migration is additive and keeps the legacy
-- diary_entries columns readable while introducing a normalized YSE-oriented
-- data model, controlled workflow, immutable locking and correction versions.

alter table public.diary_entries
  add column if not exists site_address text,
  add column if not exists contract_number text,
  add column if not exists responsible_supervisor_id uuid references auth.users(id) on delete set null,
  add column if not exists prepared_by uuid references auth.users(id) on delete set null,
  add column if not exists submitted_at timestamptz,
  add column if not exists reviewed_by uuid references auth.users(id) on delete set null,
  add column if not exists reviewed_at timestamptz,
  add column if not exists locked_at timestamptz,
  add column if not exists version integer not null default 1,
  add column if not exists supersedes_id uuid references public.diary_entries(id) on delete restrict,
  add column if not exists is_current boolean not null default true,
  add column if not exists visible_to_customer boolean not null default false,
  add column if not exists summary text,
  add column if not exists correction_reason text,
  add column if not exists snapshot jsonb,
  add column if not exists content_checksum text,
  add column if not exists pdf_document_id uuid references public.project_documents(id) on delete set null,
  add column if not exists voided_at timestamptz,
  add column if not exists voided_by uuid references auth.users(id) on delete set null;

update public.diary_entries
set
  prepared_by = coalesce(prepared_by, created_by),
  site_address = coalesce(site_address, p.location),
  contract_number = coalesce(contract_number, p.project_number),
  responsible_supervisor_id = coalesce(responsible_supervisor_id, p.responsible_supervisor_id),
  status = case status
    when 'Lähetetty' then 'Tarkastettavana'
    when 'Hyväksytty' then 'Tarkastettu'
    when 'Valmis' then 'Tarkastettu'
    else status
  end
from public.projects p
where p.id = diary_entries.project_id
  and p.organization_id = diary_entries.organization_id;

alter table public.diary_entries drop constraint if exists diary_entries_status_check;
alter table public.diary_entries drop constraint if exists diary_entries_version_check;
alter table public.diary_entries add constraint diary_entries_status_check
  check (status = any (array[
    'Luonnos'::text,
    'Täydennettävä'::text,
    'Tarkastettavana'::text,
    'Tarkastettu'::text,
    'Odottaa kuittausta'::text,
    'Lukittu'::text,
    'Mitätöity'::text
  ])) not valid;
alter table public.diary_entries validate constraint diary_entries_status_check;
alter table public.diary_entries add constraint diary_entries_version_check check (version >= 1) not valid;
alter table public.diary_entries validate constraint diary_entries_version_check;

create unique index if not exists diary_entries_project_day_version_uidx
  on public.diary_entries(organization_id, project_id, date, version)
  where project_id is not null;

create unique index if not exists diary_entries_current_project_day_uidx
  on public.diary_entries(organization_id, project_id, date)
  where project_id is not null and is_current and status <> 'Mitätöity';

create index if not exists diary_entries_project_date_status_idx
  on public.diary_entries(organization_id, project_id, date desc, status)
  where is_current;

create index if not exists diary_entries_pending_review_idx
  on public.diary_entries(organization_id, submitted_at)
  where is_current and status in ('Tarkastettavana', 'Tarkastettu', 'Odottaa kuittausta');

create table if not exists public.site_diary_settings (
  organization_id uuid primary key references public.organizations(id) on delete cascade,
  auto_create_enabled boolean not null default true,
  require_two_weather_observations boolean not null default true,
  require_workforce boolean not null default true,
  require_work_items boolean not null default true,
  require_responsible_supervisor boolean not null default true,
  require_inspector_signature boolean not null default false,
  allow_worker_contributions boolean not null default true,
  default_weather_times time[] not null default array['07:00'::time, '12:00'::time],
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint site_diary_settings_weather_times_check
    check (cardinality(default_weather_times) between 1 and 6)
);

create table if not exists public.site_diary_weather_observations (
  id uuid primary key default gen_random_uuid(),
  diary_id uuid not null references public.diary_entries(id) on delete cascade,
  observation_time time not null,
  temperature_c numeric(5,1),
  weather_condition text,
  wind_speed_ms numeric(6,1),
  wind_gust_ms numeric(6,1),
  precipitation_mm numeric(7,2),
  work_impact text,
  source text not null default 'manual',
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint site_diary_weather_source_check
    check (source in ('manual', 'automatic', 'corrected')),
  constraint site_diary_weather_wind_check
    check ((wind_speed_ms is null or wind_speed_ms >= 0) and (wind_gust_ms is null or wind_gust_ms >= 0)),
  constraint site_diary_weather_precipitation_check
    check (precipitation_mm is null or precipitation_mm >= 0),
  unique (diary_id, observation_time)
);

create table if not exists public.site_diary_workforce_rows (
  id uuid primary key default gen_random_uuid(),
  diary_id uuid not null references public.diary_entries(id) on delete cascade,
  category text not null,
  company_name text,
  trade text,
  headcount integer not null default 0,
  notes text,
  sort_order integer not null default 0,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint site_diary_workforce_category_check
    check (category in ('supervisor', 'own_skilled', 'own_other', 'subcontractor', 'temporary', 'visitor')),
  constraint site_diary_workforce_headcount_check check (headcount >= 0)
);

create table if not exists public.site_diary_work_items (
  id uuid primary key default gen_random_uuid(),
  diary_id uuid not null references public.diary_entries(id) on delete cascade,
  phase_state text not null,
  work_order_id uuid references public.work_orders(id) on delete set null,
  title text not null,
  location text,
  responsible_party text,
  progress_percent integer,
  started_at timestamptz,
  completed_at timestamptz,
  inspection_required boolean not null default false,
  related_inspection_id uuid,
  notes text,
  sort_order integer not null default 0,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint site_diary_work_items_state_check
    check (phase_state in ('started', 'ongoing', 'completed')),
  constraint site_diary_work_items_progress_check
    check (progress_percent is null or progress_percent between 0 and 100),
  constraint site_diary_work_items_dates_check
    check (completed_at is null or started_at is null or completed_at >= started_at)
);

create table if not exists public.site_diary_events (
  id uuid primary key default gen_random_uuid(),
  diary_id uuid not null references public.diary_entries(id) on delete cascade,
  event_type text not null,
  occurred_at timestamptz,
  title text not null,
  description text,
  responsible_party text,
  due_at timestamptz,
  status text not null default 'Avoin',
  cost_impact_cents bigint,
  schedule_impact_days numeric(7,2),
  change_order_id uuid references public.change_orders(id) on delete set null,
  safety_item_id uuid references public.safety_items(id) on delete set null,
  sort_order integer not null default 0,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint site_diary_events_type_check check (event_type in (
    'inspection', 'review', 'meeting', 'delivery', 'instruction', 'deviation',
    'delay', 'safety', 'environmental', 'plan_change', 'decision_needed',
    'yse_43_3', 'yse_44_2', 'other'
  )),
  constraint site_diary_events_status_check
    check (status in ('Avoin', 'Käsittelyssä', 'Ratkaistu', 'Ei toimenpiteitä')),
  constraint site_diary_events_cost_check
    check (cost_impact_cents is null or cost_impact_cents >= 0)
);

create table if not exists public.site_diary_attachments (
  id uuid primary key default gen_random_uuid(),
  diary_id uuid not null references public.diary_entries(id) on delete cascade,
  category text not null default 'other',
  caption text,
  storage_path text not null,
  file_name text not null,
  mime_type text not null,
  size_bytes bigint not null,
  captured_at timestamptz,
  sort_order integer not null default 0,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  constraint site_diary_attachments_category_check check (category in (
    'overview', 'work_phase', 'completed_work', 'deviation', 'damage',
    'safety', 'delivery', 'inspection', 'other'
  )),
  constraint site_diary_attachments_size_check check (size_bytes >= 0),
  unique (diary_id, storage_path)
);

create table if not exists public.site_diary_signatures (
  id uuid primary key default gen_random_uuid(),
  diary_id uuid not null references public.diary_entries(id) on delete cascade,
  signature_role text not null,
  signer_name text not null,
  signer_title text,
  signed_by_user_id uuid references auth.users(id) on delete set null,
  signed_at timestamptz not null default now(),
  signature_method text not null default 'typed',
  signature_svg text,
  comment text,
  created_at timestamptz not null default now(),
  constraint site_diary_signatures_role_check
    check (signature_role in ('responsible_supervisor', 'inspector', 'customer', 'other')),
  constraint site_diary_signatures_method_check
    check (signature_method in ('typed', 'drawn', 'strong_auth', 'external_link')),
  unique (diary_id, signature_role, signer_name)
);

create index if not exists site_diary_weather_diary_idx
  on public.site_diary_weather_observations(diary_id, observation_time);
create index if not exists site_diary_workforce_diary_idx
  on public.site_diary_workforce_rows(diary_id, sort_order, created_at);
create index if not exists site_diary_work_items_diary_idx
  on public.site_diary_work_items(diary_id, phase_state, sort_order, created_at);
create index if not exists site_diary_events_diary_idx
  on public.site_diary_events(diary_id, event_type, occurred_at, sort_order);
create index if not exists site_diary_attachments_diary_idx
  on public.site_diary_attachments(diary_id, sort_order, created_at);
create index if not exists site_diary_signatures_diary_idx
  on public.site_diary_signatures(diary_id, signature_role, signed_at);

-- Keep update timestamps consistent with the rest of the application.
drop trigger if exists set_site_diary_settings_updated_at on public.site_diary_settings;
create trigger set_site_diary_settings_updated_at
  before update on public.site_diary_settings
  for each row execute function public.set_updated_at();

drop trigger if exists set_site_diary_weather_updated_at on public.site_diary_weather_observations;
create trigger set_site_diary_weather_updated_at
  before update on public.site_diary_weather_observations
  for each row execute function public.set_updated_at();

drop trigger if exists set_site_diary_workforce_updated_at on public.site_diary_workforce_rows;
create trigger set_site_diary_workforce_updated_at
  before update on public.site_diary_workforce_rows
  for each row execute function public.set_updated_at();

drop trigger if exists set_site_diary_work_items_updated_at on public.site_diary_work_items;
create trigger set_site_diary_work_items_updated_at
  before update on public.site_diary_work_items
  for each row execute function public.set_updated_at();

drop trigger if exists set_site_diary_events_updated_at on public.site_diary_events;
create trigger set_site_diary_events_updated_at
  before update on public.site_diary_events
  for each row execute function public.set_updated_at();

commit;
