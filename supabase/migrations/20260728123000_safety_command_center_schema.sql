-- Safety command center: daily briefings, emergency profiles, evidence and notifications.

create table if not exists public.safety_briefings (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  project_id uuid references public.projects(id) on delete cascade,
  title text not null,
  introduction text,
  instruction_items jsonb not null default '[]'::jsonb,
  severity text not null default 'info',
  audience_roles text[] not null default array['admin','supervisor','project_coordinator','worker']::text[],
  valid_from date not null default current_date,
  valid_until date,
  requires_acknowledgement boolean not null default true,
  status text not null default 'draft',
  version integer not null default 1,
  published_by uuid references public.profiles(id) on delete set null,
  published_at timestamptz,
  created_by uuid not null references public.profiles(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint safety_briefings_title_check check (char_length(btrim(title)) between 3 and 180),
  constraint safety_briefings_instructions_check check (jsonb_typeof(instruction_items) = 'array' and jsonb_array_length(instruction_items) between 1 and 5),
  constraint safety_briefings_severity_check check (severity in ('info','warning','danger')),
  constraint safety_briefings_status_check check (status in ('draft','published','archived')),
  constraint safety_briefings_version_check check (version > 0),
  constraint safety_briefings_dates_check check (valid_until is null or valid_until >= valid_from),
  constraint safety_briefings_audience_check check (
    cardinality(audience_roles) > 0
    and audience_roles <@ array['admin','supervisor','project_coordinator','worker','customer']::text[]
  )
);

create index if not exists safety_briefings_org_status_dates_idx
  on public.safety_briefings (organization_id, status, valid_from, valid_until);
create index if not exists safety_briefings_project_idx
  on public.safety_briefings (project_id) where project_id is not null;

create table if not exists public.safety_briefing_versions (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  briefing_id uuid not null references public.safety_briefings(id) on delete cascade,
  version integer not null,
  snapshot jsonb not null,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  unique (briefing_id, version)
);
create index if not exists safety_briefing_versions_org_idx
  on public.safety_briefing_versions (organization_id, briefing_id, version desc);

create table if not exists public.safety_briefing_acknowledgements (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  briefing_id uuid not null references public.safety_briefings(id) on delete cascade,
  briefing_version integer not null,
  user_id uuid not null references public.profiles(id) on delete cascade,
  user_role text not null,
  project_id uuid references public.projects(id) on delete set null,
  acknowledged_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  unique (briefing_id, user_id, briefing_version),
  constraint safety_briefing_ack_role_check check (user_role in ('admin','supervisor','project_coordinator','worker','customer')),
  constraint safety_briefing_ack_version_check check (briefing_version > 0)
);
create index if not exists safety_briefing_ack_org_user_idx
  on public.safety_briefing_acknowledgements (organization_id, user_id, acknowledged_at desc);
create index if not exists safety_briefing_ack_briefing_idx
  on public.safety_briefing_acknowledgements (briefing_id, briefing_version);

create table if not exists public.project_safety_profiles (
  project_id uuid primary key references public.projects(id) on delete cascade,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  site_address text,
  assembly_point text,
  first_aid_location text,
  defibrillator_location text,
  safety_contact_name text,
  safety_contact_phone text,
  first_aid_contact_name text,
  first_aid_contact_phone text,
  duty_phone text,
  emergency_instructions text,
  created_by uuid references public.profiles(id) on delete set null default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists project_safety_profiles_org_idx
  on public.project_safety_profiles (organization_id);

create table if not exists public.safety_attachments (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  safety_item_id uuid references public.safety_items(id) on delete cascade,
  briefing_id uuid references public.safety_briefings(id) on delete cascade,
  kind text not null,
  storage_path text not null unique,
  file_name text not null,
  mime_type text not null,
  size_bytes bigint not null,
  created_by uuid not null references public.profiles(id) on delete restrict,
  created_at timestamptz not null default now(),
  constraint safety_attachments_parent_check check ((safety_item_id is not null)::integer + (briefing_id is not null)::integer = 1),
  constraint safety_attachments_kind_check check (kind in ('observation','correction','briefing')),
  constraint safety_attachments_kind_parent_check check (
    (briefing_id is not null and kind = 'briefing')
    or (safety_item_id is not null and kind in ('observation','correction'))
  ),
  constraint safety_attachments_name_check check (char_length(btrim(file_name)) between 1 and 255),
  constraint safety_attachments_size_check check (size_bytes > 0 and size_bytes <= 15728640),
  constraint safety_attachments_mime_check check (
    mime_type in ('image/jpeg','image/png','image/webp','image/heic','image/heif','application/pdf')
  )
);
create index if not exists safety_attachments_item_idx
  on public.safety_attachments (safety_item_id, created_at) where safety_item_id is not null;
create index if not exists safety_attachments_briefing_idx
  on public.safety_attachments (briefing_id, created_at) where briefing_id is not null;
create index if not exists safety_attachments_org_idx
  on public.safety_attachments (organization_id, created_at desc);

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'safety-files',
  'safety-files',
  false,
  15728640,
  array['image/jpeg','image/png','image/webp','image/heic','image/heif','application/pdf']::text[]
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;
