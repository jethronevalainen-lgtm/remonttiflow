begin;

-- Structured customer work-request intake. The existing project_name column remains
-- for backwards compatibility, but represents the customer-facing work title.
alter table public.project_requests
  add column if not exists request_type text not null default 'Korjaus',
  add column if not exists building text,
  add column if not exists staircase text,
  add column if not exists apartment text,
  add column if not exists customer_reference text,
  add column if not exists deadline_flexibility text not null default 'Joustava',
  add column if not exists occupancy_status text not null default 'Ei tiedossa',
  add column if not exists current_resident_moving_out boolean not null default false,
  add column if not exists current_resident_move_out_date date,
  add column if not exists incoming_resident_status text not null default 'Ei tiedossa',
  add column if not exists incoming_resident_move_in_date date,
  add column if not exists incoming_contract_status text not null default 'Ei tiedossa',
  add column if not exists deadline_reason text,
  add column if not exists access_method text,
  add column if not exists allowed_working_hours text,
  add column if not exists access_notes text,
  add column if not exists contact_email text,
  add column if not exists resident_contact_name text,
  add column if not exists resident_contact_phone text,
  add column if not exists resident_contact_email text,
  add column if not exists resident_contact_allowed boolean not null default false,
  add column if not exists contact_instructions text,
  add column if not exists submitted_at timestamptz;

alter table public.project_requests drop constraint if exists project_requests_status_check;
alter table public.project_requests
  add constraint project_requests_status_check
  check (status in (
    'Luonnos', 'Lähetetty', 'Käsittelyssä', 'Lisätietoja pyydetty',
    'Hyväksytty', 'Hylätty', 'Muutettu projektiksi'
  ));

alter table public.project_requests drop constraint if exists project_requests_request_type_check;
alter table public.project_requests
  add constraint project_requests_request_type_check
  check (request_type in ('Korjaus', 'Remontti', 'Huolto', 'Tarkastus tai kartoitus', 'Muu'));

alter table public.project_requests drop constraint if exists project_requests_deadline_flexibility_check;
alter table public.project_requests
  add constraint project_requests_deadline_flexibility_check
  check (deadline_flexibility in ('Ehdoton', 'Joustava', 'Ei tiedossa'));

alter table public.project_requests drop constraint if exists project_requests_occupancy_status_check;
alter table public.project_requests
  add constraint project_requests_occupancy_status_check
  check (occupancy_status in ('Asuttu', 'Tyhjä', 'Tyhjenee ennen työn alkua', 'Ei tiedossa'));

alter table public.project_requests drop constraint if exists project_requests_incoming_resident_status_check;
alter table public.project_requests
  add constraint project_requests_incoming_resident_status_check
  check (incoming_resident_status in ('Kyllä', 'Ei', 'Ei tiedossa'));

alter table public.project_requests drop constraint if exists project_requests_incoming_contract_status_check;
alter table public.project_requests
  add constraint project_requests_incoming_contract_status_check
  check (incoming_contract_status in ('Ei sopimusta', 'Valmistelussa', 'Allekirjoitettu', 'Ei tiedossa'));

alter table public.project_requests drop constraint if exists project_requests_access_method_check;
alter table public.project_requests
  add constraint project_requests_access_method_check
  check (
    access_method is null
    or access_method in (
      'Avain työnjohdolta', 'Avain asukkaalta', 'Asukas avaa',
      'Avainhallinta', 'Sovittava'
    )
  );

alter table public.projects add column if not exists source_project_request_id uuid;
do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.projects'::regclass
      and conname = 'projects_source_project_request_id_fkey'
  ) then
    alter table public.projects
      add constraint projects_source_project_request_id_fkey
      foreign key (source_project_request_id)
      references public.project_requests(id)
      on delete set null;
  end if;
end;
$$;
create unique index if not exists projects_source_project_request_uidx
  on public.projects(source_project_request_id)
  where source_project_request_id is not null;

create table if not exists public.project_request_attachments (
  id uuid primary key,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  request_id uuid not null references public.project_requests(id) on delete cascade,
  storage_path text not null unique,
  file_name text not null,
  mime_type text not null,
  size_bytes bigint not null check (size_bytes > 0 and size_bytes <= 20971520),
  description text check (description is null or char_length(description) <= 500),
  created_by uuid not null references public.profiles(id) on delete restrict,
  created_at timestamptz not null default now()
);

create index if not exists project_request_attachments_request_idx
  on public.project_request_attachments(request_id, created_at);
create index if not exists project_request_attachments_org_idx
  on public.project_request_attachments(organization_id, created_at desc);

create table if not exists public.project_request_revisions (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  request_id uuid not null references public.project_requests(id) on delete cascade,
  version_no integer not null check (version_no > 0),
  event_type text not null check (event_type in ('submitted', 'resubmitted', 'reviewed', 'approved', 'rejected')),
  snapshot jsonb not null,
  created_by uuid not null references public.profiles(id) on delete restrict,
  created_at timestamptz not null default now(),
  unique (request_id, version_no)
);

create index if not exists project_request_revisions_request_idx
  on public.project_request_revisions(request_id, version_no desc);

create or replace function private.can_read_project_request(
  p_request_id uuid,
  p_user_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = pg_catalog, public
as $$
  select exists (
    select 1
    from public.project_requests r
    where r.id = p_request_id
      and (
        private.is_management_user(r.organization_id, p_user_id)
        or r.created_by = p_user_id
        or (
          r.status <> 'Luonnos'
          and private.is_customer_user(r.organization_id, r.customer_id, p_user_id)
        )
      )
  );
$$;

create or replace function private.can_edit_project_request(
  p_request_id uuid,
  p_user_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = pg_catalog, public
as $$
  select exists (
    select 1
    from public.project_requests r
    where r.id = p_request_id
      and r.created_by = p_user_id
      and r.status in ('Luonnos', 'Lisätietoja pyydetty')
      and private.is_customer_user(r.organization_id, r.customer_id, p_user_id)
  );
$$;

grant execute on function private.can_read_project_request(uuid, uuid) to authenticated;
grant execute on function private.can_edit_project_request(uuid, uuid) to authenticated;

alter table public.project_request_attachments enable row level security;
alter table public.project_request_revisions enable row level security;
revoke all on public.project_request_attachments, public.project_request_revisions from anon;
grant select on public.project_request_attachments, public.project_request_revisions to authenticated;

drop policy if exists project_request_attachments_select on public.project_request_attachments;
create policy project_request_attachments_select
on public.project_request_attachments for select to authenticated
using (private.can_read_project_request(request_id, (select auth.uid())));

drop policy if exists project_request_revisions_select on public.project_request_revisions;
create policy project_request_revisions_select
on public.project_request_revisions for select to authenticated
using (private.can_read_project_request(request_id, (select auth.uid())));

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'project-request-attachments',
  'project-request-attachments',
  false,
  20971520,
  array[
    'image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/heic', 'image/heif',
    'application/pdf', 'text/plain', 'text/csv',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
  ]
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists project_request_files_insert on storage.objects;
create policy project_request_files_insert
on storage.objects for insert to authenticated
with check (
  bucket_id = 'project-request-attachments'
  and owner_id = (select auth.uid())::text
  and exists (
    select 1
    from public.project_requests r
    where r.id = private.try_uuid((storage.foldername(name))[2])
      and r.organization_id = private.try_uuid((storage.foldername(name))[1])
      and private.can_edit_project_request(r.id, (select auth.uid()))
  )
);

drop policy if exists project_request_files_select on storage.objects;
create policy project_request_files_select
on storage.objects for select to authenticated
using (
  bucket_id = 'project-request-attachments'
  and exists (
    select 1
    from public.project_request_attachments a
    where a.storage_path = objects.name
      and private.can_read_project_request(a.request_id, (select auth.uid()))
  )
);

drop policy if exists project_request_files_delete on storage.objects;
create policy project_request_files_delete
on storage.objects for delete to authenticated
using (
  bucket_id = 'project-request-attachments'
  and (
    owner_id = (select auth.uid())::text
    or exists (
      select 1
      from public.project_request_attachments a
      where a.storage_path = objects.name
        and private.is_management_user(a.organization_id, (select auth.uid()))
    )
  )
);

commit;
