-- ============================================================================
-- Migration: 20260724110000_site_receipts.sql
-- VaKantti — signed worksite acknowledgements and protected attachments
-- ============================================================================

create table if not exists public.site_receipts (
  id               uuid primary key default gen_random_uuid(),
  organization_id  uuid not null references public.organizations (id) on delete cascade,
  project_id       uuid references public.projects (id) on delete set null,
  work_order_id    uuid references public.work_orders (id) on delete set null,
  project          text not null,
  title            text not null,
  receipt_type     text not null check (receipt_type in (
    'work_acceptance',
    'delivery_receipt',
    'measurement_record',
    'waybill',
    'material_receipt',
    'other'
  )),
  reference_number text,
  occurred_at      timestamptz not null,
  signer_name      text not null,
  signer_role      text,
  signer_company   text,
  notes            text,
  status           text not null default 'draft' check (status in ('draft', 'signed', 'voided')),
  signed_at        timestamptz,
  voided_at        timestamptz,
  void_reason      text,
  created_by       uuid not null references public.profiles (id),
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

create table if not exists public.site_receipt_attachments (
  id               uuid primary key default gen_random_uuid(),
  organization_id  uuid not null references public.organizations (id) on delete cascade,
  receipt_id       uuid not null references public.site_receipts (id) on delete cascade,
  kind             text not null check (kind in ('photo', 'document', 'signature')),
  file_name        text not null,
  storage_path     text not null unique,
  mime_type        text not null,
  size_bytes       bigint not null check (size_bytes >= 0),
  created_by       uuid not null references public.profiles (id),
  created_at       timestamptz not null default now()
);

comment on table public.site_receipts is
  'Immutable signed acknowledgements collected on a worksite from supervisors, carriers, subcontractors or customers.';
comment on table public.site_receipt_attachments is
  'Private Storage object metadata for worksite receipt photos, documents and handwritten signatures.';

create index if not exists site_receipts_organization_id_idx
  on public.site_receipts (organization_id);
create index if not exists site_receipts_project_id_idx
  on public.site_receipts (project_id);
create index if not exists site_receipts_occurred_at_idx
  on public.site_receipts (organization_id, occurred_at desc);
create index if not exists site_receipts_created_by_idx
  on public.site_receipts (created_by);
create index if not exists site_receipt_attachments_receipt_id_idx
  on public.site_receipt_attachments (receipt_id);
create index if not exists site_receipt_attachments_organization_id_idx
  on public.site_receipt_attachments (organization_id);

alter table public.site_receipts enable row level security;
alter table public.site_receipt_attachments enable row level security;

grant select, insert, update, delete on public.site_receipts to authenticated;
grant select, insert, delete on public.site_receipt_attachments to authenticated;

-- Signed receipts are immutable. Supervisors and admins may only transition a
-- signed receipt to voided and record a reason; all other business fields stay
-- unchanged. Workers may finalize only their own draft.
create or replace function public.enforce_site_receipt_immutability()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
begin
  if old.status = 'voided' then
    raise exception 'Mitätöityä kuittausta ei voi muokata.';
  end if;

  if old.status = 'signed' then
    if not (
      new.status = 'voided'
      and public.has_org_role(old.organization_id, array['admin', 'supervisor'])
      and nullif(btrim(new.void_reason), '') is not null
      and (
        to_jsonb(new) - array['status', 'voided_at', 'void_reason', 'updated_at']::text[]
      ) = (
        to_jsonb(old) - array['status', 'voided_at', 'void_reason', 'updated_at']::text[]
      )
    ) then
      raise exception 'Allekirjoitettua kuittausta ei voi muokata.';
    end if;
    new.voided_at = coalesce(new.voided_at, now());
  end if;

  if old.status = 'draft' and new.status = 'signed' then
    if nullif(btrim(new.signer_name), '') is null then
      raise exception 'Allekirjoittajan nimi puuttuu.';
    end if;
    new.signed_at = coalesce(new.signed_at, now());
  end if;

  if old.status = 'draft' and new.status = 'voided' then
    raise exception 'Luonnosta ei voi mitätöidä; poista se sen sijaan.';
  end if;

  return new;
end;
$$;

drop trigger if exists site_receipts_10_immutability on public.site_receipts;
create trigger site_receipts_10_immutability
  before update on public.site_receipts
  for each row execute function public.enforce_site_receipt_immutability();

drop trigger if exists site_receipts_90_updated_at on public.site_receipts;
create trigger site_receipts_90_updated_at
  before update on public.site_receipts
  for each row execute function public.set_updated_at();

create or replace function public.audit_site_receipt_state()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
begin
  if new.status = 'signed' and old.status is distinct from 'signed' then
    insert into public.audit_logs (
      organization_id,
      user_id,
      action,
      table_name,
      record_id,
      metadata
    ) values (
      new.organization_id,
      auth.uid(),
      'receipt.signed',
      'site_receipts',
      new.id,
      jsonb_build_object(
        'receipt_type', new.receipt_type,
        'project', new.project,
        'signer_name', new.signer_name,
        'signed_at', new.signed_at
      )
    );
  elsif new.status = 'voided' and old.status is distinct from 'voided' then
    insert into public.audit_logs (
      organization_id,
      user_id,
      action,
      table_name,
      record_id,
      metadata
    ) values (
      new.organization_id,
      auth.uid(),
      'receipt.voided',
      'site_receipts',
      new.id,
      jsonb_build_object(
        'void_reason', new.void_reason,
        'voided_at', new.voided_at
      )
    );
  end if;
  return new;
end;
$$;

drop trigger if exists audit_site_receipt_state on public.site_receipts;
create trigger audit_site_receipt_state
  after update of status on public.site_receipts
  for each row execute function public.audit_site_receipt_state();

-- Database row policies.
drop policy if exists site_receipts_select on public.site_receipts;
create policy site_receipts_select
  on public.site_receipts for select to authenticated
  using (public.is_org_member(organization_id));

drop policy if exists site_receipts_insert on public.site_receipts;
create policy site_receipts_insert
  on public.site_receipts for insert to authenticated
  with check (
    public.is_org_member(organization_id)
    and created_by = (select auth.uid())
    and status = 'draft'
  );

drop policy if exists site_receipts_update on public.site_receipts;
create policy site_receipts_update
  on public.site_receipts for update to authenticated
  using (
    public.has_org_role(organization_id, array['admin', 'supervisor'])
    or (created_by = (select auth.uid()) and status = 'draft')
  )
  with check (
    public.is_org_member(organization_id)
    and (
      public.has_org_role(organization_id, array['admin', 'supervisor'])
      or (
        created_by = (select auth.uid())
        and status in ('draft', 'signed')
      )
    )
  );

drop policy if exists site_receipts_delete on public.site_receipts;
create policy site_receipts_delete
  on public.site_receipts for delete to authenticated
  using (
    public.has_org_role(organization_id, array['admin', 'supervisor'])
    or (created_by = (select auth.uid()) and status = 'draft')
  );

drop policy if exists site_receipt_attachments_select on public.site_receipt_attachments;
create policy site_receipt_attachments_select
  on public.site_receipt_attachments for select to authenticated
  using (public.is_org_member(organization_id));

drop policy if exists site_receipt_attachments_insert on public.site_receipt_attachments;
create policy site_receipt_attachments_insert
  on public.site_receipt_attachments for insert to authenticated
  with check (
    public.is_org_member(organization_id)
    and created_by = (select auth.uid())
    and exists (
      select 1
      from public.site_receipts receipt
      where receipt.id = receipt_id
        and receipt.organization_id = organization_id
        and receipt.created_by = (select auth.uid())
        and receipt.status = 'draft'
    )
  );

drop policy if exists site_receipt_attachments_delete on public.site_receipt_attachments;
create policy site_receipt_attachments_delete
  on public.site_receipt_attachments for delete to authenticated
  using (
    public.has_org_role(organization_id, array['admin', 'supervisor'])
    or exists (
      select 1
      from public.site_receipts receipt
      where receipt.id = receipt_id
        and receipt.created_by = (select auth.uid())
        and receipt.status = 'draft'
    )
  );

-- Private Storage bucket. Files are stored under
-- <organization_id>/<receipt_id>/<random-id>.<extension>.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'site-receipts',
  'site-receipts',
  false,
  10485760,
  array[
    'image/jpeg',
    'image/png',
    'image/webp',
    'image/heic',
    'image/heif',
    'application/pdf'
  ]
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists site_receipt_files_select on storage.objects;
create policy site_receipt_files_select
  on storage.objects for select to authenticated
  using (
    bucket_id = 'site-receipts'
    and exists (
      select 1
      from public.organization_members member
      where member.organization_id::text = (storage.foldername(name))[1]
        and member.user_id = (select auth.uid())
    )
  );

drop policy if exists site_receipt_files_insert on storage.objects;
create policy site_receipt_files_insert
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'site-receipts'
    and exists (
      select 1
      from public.organization_members member
      where member.organization_id::text = (storage.foldername(name))[1]
        and member.user_id = (select auth.uid())
    )
  );

drop policy if exists site_receipt_files_delete on storage.objects;
create policy site_receipt_files_delete
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'site-receipts'
    and (
      owner_id = (select auth.uid()::text)
      or exists (
        select 1
        from public.organization_members member
        where member.organization_id::text = (storage.foldername(name))[1]
          and member.user_id = (select auth.uid())
          and member.role in ('admin', 'supervisor')
      )
    )
  );
