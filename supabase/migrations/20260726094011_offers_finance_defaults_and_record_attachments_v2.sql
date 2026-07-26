begin;

create table if not exists public.organization_settings (
  organization_id uuid primary key references public.organizations(id) on delete cascade,
  locale text not null default 'fi-FI',
  timezone text not null default 'Europe/Helsinki',
  default_vat_rate numeric not null default 0 check (default_vat_rate between 0 and 100),
  default_overhead_percent numeric not null default 0 check (default_overhead_percent between 0 and 100),
  default_risk_percent numeric not null default 0 check (default_risk_percent between 0 and 100),
  default_margin_percent numeric not null default 0 check (default_margin_percent between 0 and 100),
  time_entry_lock_day smallint check (time_entry_lock_day between 1 and 31),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.organization_settings
  add column if not exists default_vat_rate numeric not null default 0,
  add column if not exists default_overhead_percent numeric not null default 0,
  add column if not exists default_risk_percent numeric not null default 0,
  add column if not exists default_margin_percent numeric not null default 0;

create table if not exists public.offers (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  customer_id uuid references public.customers(id) on delete set null,
  crm_lead_id uuid references public.crm_leads(id) on delete set null,
  project_id uuid references public.projects(id) on delete set null,
  converted_project_id uuid references public.projects(id) on delete set null,
  name text not null,
  offer_number text,
  status text not null default 'Luonnos'
    check (status in ('Luonnos','Lähetetty','Hyväksytty','Hylätty','Vanhentunut','Arkistoitu')),
  valid_until date,
  currency text not null default 'EUR' check (currency = 'EUR'),
  notes text,
  sent_at timestamptz,
  accepted_at timestamptz,
  rejected_at timestamptz,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.offer_versions (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  offer_id uuid not null references public.offers(id) on delete cascade,
  version_number integer not null check (version_number > 0),
  status text not null default 'Luonnos'
    check (status in ('Luonnos','Lähetetty','Hyväksytty','Korvattu','Arkistoitu')),
  title text not null,
  vat_rate numeric not null default 25.5 check (vat_rate between 0 and 100),
  overhead_percent numeric not null default 0 check (overhead_percent between 0 and 100),
  risk_percent numeric not null default 0 check (risk_percent between 0 and 100),
  margin_percent numeric not null default 0 check (margin_percent between 0 and 100),
  subtotal_cents bigint not null default 0 check (subtotal_cents >= 0),
  total_cents bigint not null default 0 check (total_cents >= 0),
  notes text,
  terms text,
  pdf_storage_path text,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  unique (offer_id, version_number)
);

create table if not exists public.offer_lines (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  offer_version_id uuid not null references public.offer_versions(id) on delete cascade,
  category text not null default 'Työ',
  description text not null,
  quantity numeric not null default 1 check (quantity >= 0),
  unit text not null default 'kpl',
  unit_price_cents bigint not null default 0 check (unit_price_cents >= 0),
  sort_order integer not null default 0,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

create table if not exists public.record_attachments (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  project_id uuid references public.projects(id) on delete cascade,
  entity_type text not null check (
    entity_type in (
      'project','work_order','diary','safety','form_submission',
      'customer','equipment','crm_activity','offer','change_order'
    )
  ),
  entity_id uuid not null,
  file_name text not null,
  storage_path text not null,
  mime_type text not null,
  size_bytes bigint not null check (size_bytes between 0 and 52428800),
  description text,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

create unique index if not exists offers_number_unique
  on public.offers(organization_id, offer_number)
  where offer_number is not null;
create index if not exists offers_org_status_idx
  on public.offers(organization_id, status, created_at desc);
create index if not exists offers_customer_idx on public.offers(customer_id);
create index if not exists offers_lead_idx on public.offers(crm_lead_id);
create index if not exists offer_versions_offer_idx
  on public.offer_versions(offer_id, version_number desc);
create index if not exists offer_lines_version_idx
  on public.offer_lines(offer_version_id, sort_order, created_at);
create unique index if not exists record_attachments_storage_unique
  on public.record_attachments(storage_path);
create index if not exists record_attachments_entity_idx
  on public.record_attachments(organization_id, entity_type, entity_id, created_at desc);

alter table public.organization_settings enable row level security;
alter table public.offers enable row level security;
alter table public.offer_versions enable row level security;
alter table public.offer_lines enable row level security;
alter table public.record_attachments enable row level security;

revoke all on table public.organization_settings from anon, authenticated;
revoke all on table public.offers from anon, authenticated;
revoke all on table public.offer_versions from anon, authenticated;
revoke all on table public.offer_lines from anon, authenticated;
revoke all on table public.record_attachments from anon, authenticated;
grant select, insert, update, delete on table public.organization_settings to authenticated;
grant select, insert, update, delete on table public.offers to authenticated;
grant select, insert, update, delete on table public.offer_versions to authenticated;
grant select, insert, update, delete on table public.offer_lines to authenticated;
grant select, insert, update, delete on table public.record_attachments to authenticated;

drop policy if exists organization_settings_select on public.organization_settings;
create policy organization_settings_select on public.organization_settings
for select to authenticated using (private.is_org_member(organization_id));
drop policy if exists organization_settings_insert on public.organization_settings;
create policy organization_settings_insert on public.organization_settings
for insert to authenticated with check (private.has_org_role(organization_id, array['admin']::text[]));
drop policy if exists organization_settings_update on public.organization_settings;
create policy organization_settings_update on public.organization_settings
for update to authenticated
using (private.has_org_role(organization_id, array['admin']::text[]))
with check (private.has_org_role(organization_id, array['admin']::text[]));

-- Initial policies were management-only and are hardened again in the later
-- tenant/document security migration.
do $$
declare
  relation_name text;
begin
  foreach relation_name in array array['offers','offer_versions','offer_lines','record_attachments']
  loop
    execute format('drop policy if exists %I_select on public.%I', relation_name, relation_name);
    execute format(
      'create policy %I_select on public.%I for select to authenticated using (private.has_org_role(organization_id, array[''admin'',''supervisor'']::text[]))',
      relation_name,
      relation_name
    );
    execute format('drop policy if exists %I_insert on public.%I', relation_name, relation_name);
    execute format(
      'create policy %I_insert on public.%I for insert to authenticated with check (private.has_org_role(organization_id, array[''admin'',''supervisor'']::text[]))',
      relation_name,
      relation_name
    );
    execute format('drop policy if exists %I_update on public.%I', relation_name, relation_name);
    execute format(
      'create policy %I_update on public.%I for update to authenticated using (private.has_org_role(organization_id, array[''admin'',''supervisor'']::text[])) with check (private.has_org_role(organization_id, array[''admin'',''supervisor'']::text[]))',
      relation_name,
      relation_name
    );
    execute format('drop policy if exists %I_delete on public.%I', relation_name, relation_name);
    execute format(
      'create policy %I_delete on public.%I for delete to authenticated using (private.has_org_role(organization_id, array[''admin'',''supervisor'']::text[]))',
      relation_name,
      relation_name
    );
  end loop;
end;
$$;

create or replace function private.recalculate_offer_version(p_offer_version_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  direct_cents bigint;
  version_row public.offer_versions%rowtype;
  before_vat bigint;
begin
  select * into version_row
  from public.offer_versions
  where id = p_offer_version_id;
  if not found then return; end if;

  select coalesce(sum(round(quantity * unit_price_cents)), 0)::bigint
    into direct_cents
  from public.offer_lines
  where offer_version_id = p_offer_version_id;

  before_vat := round(
    direct_cents * (
      1
      + version_row.overhead_percent / 100
      + version_row.risk_percent / 100
      + version_row.margin_percent / 100
    )
  );

  update public.offer_versions
  set subtotal_cents = before_vat,
      total_cents = round(before_vat * (1 + version_row.vat_rate / 100))
  where id = p_offer_version_id;
end;
$$;

create or replace function private.offer_line_recalculate_trigger()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform private.recalculate_offer_version(
    case when tg_op = 'DELETE' then old.offer_version_id else new.offer_version_id end
  );
  return case when tg_op = 'DELETE' then old else new end;
end;
$$;

revoke all on function private.recalculate_offer_version(uuid) from public, anon, authenticated;
revoke all on function private.offer_line_recalculate_trigger() from public, anon, authenticated;

drop trigger if exists offer_line_recalculate on public.offer_lines;
create trigger offer_line_recalculate
after insert or update or delete on public.offer_lines
for each row execute function private.offer_line_recalculate_trigger();

create or replace function public.create_offer_version(p_offer_id uuid)
returns uuid
language plpgsql
set search_path = ''
as $$
declare
  offer_row public.offers%rowtype;
  previous_row public.offer_versions%rowtype;
  new_id uuid;
  next_version integer;
begin
  select * into offer_row from public.offers where id = p_offer_id;
  if not found or not private.has_org_role(offer_row.organization_id, array['admin','supervisor']::text[]) then
    raise exception 'not authorized' using errcode = '42501';
  end if;

  select * into previous_row
  from public.offer_versions
  where offer_id = p_offer_id
  order by version_number desc
  limit 1;

  next_version := coalesce(previous_row.version_number, 0) + 1;
  insert into public.offer_versions(
    organization_id, offer_id, version_number, title, vat_rate,
    overhead_percent, risk_percent, margin_percent, notes, terms, created_by
  ) values (
    offer_row.organization_id,
    offer_row.id,
    next_version,
    offer_row.name || ' v' || next_version,
    coalesce(previous_row.vat_rate, 25.5),
    coalesce(previous_row.overhead_percent, 0),
    coalesce(previous_row.risk_percent, 0),
    coalesce(previous_row.margin_percent, 0),
    previous_row.notes,
    previous_row.terms,
    auth.uid()
  ) returning id into new_id;

  if previous_row.id is not null then
    insert into public.offer_lines(
      organization_id, offer_version_id, category, description,
      quantity, unit, unit_price_cents, sort_order, created_by
    )
    select organization_id, new_id, category, description,
           quantity, unit, unit_price_cents, sort_order, auth.uid()
    from public.offer_lines
    where offer_version_id = previous_row.id;

    update public.offer_versions
    set status = 'Korvattu'
    where id = previous_row.id and status = 'Luonnos';
  end if;

  perform private.recalculate_offer_version(new_id);
  return new_id;
end;
$$;

create or replace function public.convert_offer_to_project(p_offer_id uuid)
returns uuid
language plpgsql
set search_path = ''
as $$
declare
  offer_row public.offers%rowtype;
  customer_name text;
  new_project_id uuid;
  accepted_total numeric;
begin
  select * into offer_row from public.offers where id = p_offer_id;
  if not found or not private.has_org_role(offer_row.organization_id, array['admin','supervisor']::text[]) then
    raise exception 'not authorized' using errcode = '42501';
  end if;
  if offer_row.status <> 'Hyväksytty' then
    raise exception 'Vain hyväksytty tarjous voidaan muuntaa projektiksi.' using errcode = '23514';
  end if;
  if offer_row.converted_project_id is not null then return offer_row.converted_project_id; end if;

  select c.name into customer_name from public.customers c where c.id = offer_row.customer_id;
  select coalesce(max(total_cents), 0) / 100.0
    into accepted_total
  from public.offer_versions
  where offer_id = offer_row.id
    and status in ('Hyväksytty','Lähetetty','Luonnos');

  insert into public.projects(
    organization_id, customer_id, name, customer, status, progress,
    budget, spent, start_date, end_date, description, created_by
  ) values (
    offer_row.organization_id,
    offer_row.customer_id,
    offer_row.name,
    coalesce(customer_name, ''),
    'Suunniteltu',
    0,
    accepted_total,
    0,
    current_date,
    current_date + 30,
    'Luotu hyväksytystä tarjouksesta ' || coalesce(offer_row.offer_number, offer_row.id::text),
    auth.uid()
  ) returning id into new_project_id;

  update public.offers
  set converted_project_id = new_project_id,
      project_id = new_project_id
  where id = offer_row.id;

  if offer_row.crm_lead_id is not null then
    update public.crm_leads
    set converted_project_id = new_project_id,
        stage = 'Sopimus'
    where id = offer_row.crm_lead_id;
  end if;

  return new_project_id;
end;
$$;

revoke all on function public.create_offer_version(uuid) from public, anon;
revoke all on function public.convert_offer_to_project(uuid) from public, anon;
grant execute on function public.create_offer_version(uuid) to authenticated;
grant execute on function public.convert_offer_to_project(uuid) to authenticated;

drop trigger if exists set_offers_updated_at on public.offers;
create trigger set_offers_updated_at
before update on public.offers
for each row execute function public.set_updated_at();

drop trigger if exists set_organization_settings_updated_at on public.organization_settings;
create trigger set_organization_settings_updated_at
before update on public.organization_settings
for each row execute function public.set_updated_at();

commit;
