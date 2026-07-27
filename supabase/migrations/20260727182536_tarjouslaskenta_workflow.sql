begin;

alter table public.offers
  add column if not exists assigned_user_id uuid references auth.users(id) on delete set null,
  add column if not exists accepted_version_id uuid,
  add column if not exists customer_reference text,
  add column if not exists delivery_time text,
  add column if not exists payment_terms text;

alter table public.offer_versions
  add column if not exists direct_cost_cents bigint not null default 0 check (direct_cost_cents >= 0),
  add column if not exists estimated_cost_cents bigint not null default 0 check (estimated_cost_cents >= 0),
  add column if not exists tax_cents bigint not null default 0 check (tax_cents >= 0),
  add column if not exists gross_margin_cents bigint not null default 0,
  add column if not exists gross_margin_percent numeric not null default 0,
  add column if not exists locked_at timestamptz;

alter table public.offer_lines
  add column if not exists section_id uuid,
  add column if not exists cost_unit_price_cents bigint not null default 0 check (cost_unit_price_cents >= 0),
  add column if not exists waste_percent numeric not null default 0 check (waste_percent >= 0 and waste_percent <= 100),
  add column if not exists discount_percent numeric not null default 0 check (discount_percent >= 0 and discount_percent <= 100),
  add column if not exists vat_rate numeric,
  add column if not exists source_takeoff_line_id uuid,
  add column if not exists source_catalog_item_id uuid,
  add column if not exists internal_note text,
  add column if not exists customer_note text,
  add column if not exists customer_visible boolean not null default true,
  add column if not exists is_optional boolean not null default false;

create table if not exists public.offer_sections (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  offer_version_id uuid not null,
  title text not null,
  description text,
  sort_order integer not null default 0,
  customer_visible boolean not null default true,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, organization_id)
);

create table if not exists public.price_catalog_items (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  code text,
  name text not null,
  category text not null default 'Työ',
  description text,
  unit text not null default 'kpl',
  cost_unit_price_cents bigint not null default 0 check (cost_unit_price_cents >= 0),
  sale_unit_price_cents bigint not null default 0 check (sale_unit_price_cents >= 0),
  default_waste_percent numeric not null default 0 check (default_waste_percent >= 0 and default_waste_percent <= 100),
  active boolean not null default true,
  valid_from date,
  valid_until date,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, organization_id)
);

create table if not exists public.offer_events (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  offer_id uuid not null,
  offer_version_id uuid,
  event_type text not null,
  detail text,
  metadata jsonb not null default '{}'::jsonb check (jsonb_typeof(metadata) = 'object'),
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'offers_id_organization_key' and conrelid = 'public.offers'::regclass) then
    alter table public.offers add constraint offers_id_organization_key unique (id, organization_id);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'offer_versions_id_organization_key' and conrelid = 'public.offer_versions'::regclass) then
    alter table public.offer_versions add constraint offer_versions_id_organization_key unique (id, organization_id);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'quantity_takeoff_lines_id_organization_key' and conrelid = 'public.quantity_takeoff_lines'::regclass) then
    alter table public.quantity_takeoff_lines add constraint quantity_takeoff_lines_id_organization_key unique (id, organization_id);
  end if;
end
$$;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'offers_accepted_version_org_fkey') then
    alter table public.offers add constraint offers_accepted_version_org_fkey
      foreign key (accepted_version_id, organization_id)
      references public.offer_versions (id, organization_id)
      on delete set null (accepted_version_id);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'offer_sections_version_org_fkey') then
    alter table public.offer_sections add constraint offer_sections_version_org_fkey
      foreign key (offer_version_id, organization_id)
      references public.offer_versions (id, organization_id) on delete cascade;
  end if;
  if not exists (select 1 from pg_constraint where conname = 'offer_lines_section_org_fkey') then
    alter table public.offer_lines add constraint offer_lines_section_org_fkey
      foreign key (section_id, organization_id)
      references public.offer_sections (id, organization_id)
      on delete set null (section_id);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'offer_lines_takeoff_org_fkey') then
    alter table public.offer_lines add constraint offer_lines_takeoff_org_fkey
      foreign key (source_takeoff_line_id, organization_id)
      references public.quantity_takeoff_lines (id, organization_id)
      on delete set null (source_takeoff_line_id);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'offer_lines_catalog_org_fkey') then
    alter table public.offer_lines add constraint offer_lines_catalog_org_fkey
      foreign key (source_catalog_item_id, organization_id)
      references public.price_catalog_items (id, organization_id)
      on delete set null (source_catalog_item_id);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'offer_events_offer_org_fkey') then
    alter table public.offer_events add constraint offer_events_offer_org_fkey
      foreign key (offer_id, organization_id)
      references public.offers (id, organization_id) on delete cascade;
  end if;
  if not exists (select 1 from pg_constraint where conname = 'offer_events_version_org_fkey') then
    alter table public.offer_events add constraint offer_events_version_org_fkey
      foreign key (offer_version_id, organization_id)
      references public.offer_versions (id, organization_id)
      on delete set null (offer_version_id);
  end if;
end
$$;

alter table public.offer_versions drop constraint if exists offer_versions_margin_percent_check;
alter table public.offer_versions add constraint offer_versions_margin_percent_check
  check (margin_percent >= 0 and margin_percent < 100);

create unique index if not exists offers_organization_offer_number_uidx
  on public.offers (organization_id, offer_number) where offer_number is not null;
create index if not exists offers_assigned_user_id_idx on public.offers (assigned_user_id);
create index if not exists offers_valid_until_status_idx on public.offers (organization_id, status, valid_until);
create index if not exists offer_sections_version_sort_idx on public.offer_sections (offer_version_id, sort_order);
create index if not exists offer_lines_section_sort_idx on public.offer_lines (section_id, sort_order);
create index if not exists offer_lines_takeoff_source_idx on public.offer_lines (source_takeoff_line_id);
create index if not exists offer_lines_catalog_source_idx on public.offer_lines (source_catalog_item_id);
create index if not exists price_catalog_org_active_idx on public.price_catalog_items (organization_id, active, category);
create unique index if not exists price_catalog_org_code_uidx
  on public.price_catalog_items (organization_id, code) where code is not null;
create index if not exists offer_events_offer_created_idx on public.offer_events (offer_id, created_at desc);

alter table public.offer_sections enable row level security;
alter table public.price_catalog_items enable row level security;
alter table public.offer_events enable row level security;
revoke all on table public.offer_sections, public.price_catalog_items, public.offer_events from anon;
grant select, insert, update, delete on table public.offer_sections, public.price_catalog_items to authenticated;
grant select, insert on table public.offer_events to authenticated;

drop policy if exists offer_sections_manage on public.offer_sections;
create policy offer_sections_manage on public.offer_sections for all to authenticated
using (private.has_org_role(organization_id, array['admin','supervisor','project_coordinator']::text[]))
with check (private.has_org_role(organization_id, array['admin','supervisor','project_coordinator']::text[]));

drop policy if exists price_catalog_items_manage on public.price_catalog_items;
create policy price_catalog_items_manage on public.price_catalog_items for all to authenticated
using (private.has_org_role(organization_id, array['admin','supervisor','project_coordinator']::text[]))
with check (private.has_org_role(organization_id, array['admin','supervisor','project_coordinator']::text[]));

drop policy if exists offer_events_select on public.offer_events;
create policy offer_events_select on public.offer_events for select to authenticated
using (private.has_org_role(organization_id, array['admin','supervisor','project_coordinator']::text[]));
drop policy if exists offer_events_insert on public.offer_events;
create policy offer_events_insert on public.offer_events for insert to authenticated
with check (
  private.has_org_role(organization_id, array['admin','supervisor','project_coordinator']::text[])
  and created_by = (select auth.uid())
);

create or replace function private.recalculate_offer_version(p_offer_version_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v public.offer_versions%rowtype;
  direct_cost bigint;
  overhead_cost bigint;
  risk_cost bigint;
  estimated_cost bigint;
  sale_subtotal bigint;
  tax_amount bigint;
  margin_amount bigint;
  margin_rate numeric;
begin
  select * into v from public.offer_versions where id = p_offer_version_id;
  if not found then return; end if;

  select
    coalesce(sum(case when is_optional then 0 else round(quantity * (1 + waste_percent / 100) * cost_unit_price_cents) end), 0)::bigint,
    coalesce(sum(case when is_optional then 0 else round(quantity * (1 + waste_percent / 100) * unit_price_cents * (1 - discount_percent / 100)) end), 0)::bigint
  into direct_cost, sale_subtotal
  from public.offer_lines
  where offer_version_id = p_offer_version_id and organization_id = v.organization_id;

  overhead_cost := round(direct_cost * v.overhead_percent / 100);
  risk_cost := round((direct_cost + overhead_cost) * v.risk_percent / 100);
  estimated_cost := direct_cost + overhead_cost + risk_cost;
  tax_amount := round(sale_subtotal * v.vat_rate / 100);
  margin_amount := sale_subtotal - estimated_cost;
  margin_rate := case
    when sale_subtotal > 0 then round((margin_amount::numeric / sale_subtotal::numeric) * 100, 2)
    else 0
  end;

  update public.offer_versions set
    direct_cost_cents = direct_cost,
    estimated_cost_cents = estimated_cost,
    subtotal_cents = sale_subtotal,
    tax_cents = tax_amount,
    total_cents = sale_subtotal + tax_amount,
    gross_margin_cents = margin_amount,
    gross_margin_percent = margin_rate
  where id = p_offer_version_id;
end;
$$;
revoke all on function private.recalculate_offer_version(uuid) from public, anon, authenticated;

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
  if tg_op = 'UPDATE' and old.offer_version_id is distinct from new.offer_version_id then
    perform private.recalculate_offer_version(old.offer_version_id);
  end if;
  return case when tg_op = 'DELETE' then old else new end;
end;
$$;

create or replace function private.offer_version_recalculate_trigger()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform private.recalculate_offer_version(new.id);
  return new;
end;
$$;

create or replace function private.guard_offer_line_mutation()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  old_status text;
  new_status text;
begin
  if tg_op in ('UPDATE','DELETE') then
    select status into old_status from public.offer_versions where id = old.offer_version_id;
    if old_status is distinct from 'Luonnos' then
      raise exception 'Vain luonnosversion rivejä voi muokata.' using errcode = '23514';
    end if;
  end if;
  if tg_op in ('INSERT','UPDATE') then
    select status into new_status from public.offer_versions where id = new.offer_version_id;
    if new_status is distinct from 'Luonnos' then
      raise exception 'Vain luonnosversion rivejä voi muokata.' using errcode = '23514';
    end if;
  end if;
  return case when tg_op = 'DELETE' then old else new end;
end;
$$;

create or replace function private.guard_offer_section_mutation()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  old_status text;
  new_status text;
begin
  if tg_op in ('UPDATE','DELETE') then
    select status into old_status from public.offer_versions where id = old.offer_version_id;
    if old_status is distinct from 'Luonnos' then
      raise exception 'Vain luonnosversion osioita voi muokata.' using errcode = '23514';
    end if;
  end if;
  if tg_op in ('INSERT','UPDATE') then
    select status into new_status from public.offer_versions where id = new.offer_version_id;
    if new_status is distinct from 'Luonnos' then
      raise exception 'Vain luonnosversion osioita voi muokata.' using errcode = '23514';
    end if;
  end if;
  return case when tg_op = 'DELETE' then old else new end;
end;
$$;

create or replace function private.guard_offer_version_content()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if old.status <> 'Luonnos' and (
    old.title is distinct from new.title
    or old.vat_rate is distinct from new.vat_rate
    or old.overhead_percent is distinct from new.overhead_percent
    or old.risk_percent is distinct from new.risk_percent
    or old.margin_percent is distinct from new.margin_percent
    or old.notes is distinct from new.notes
    or old.terms is distinct from new.terms
  ) then
    raise exception 'Lähetetyn tarjousversion sisältöä ei voi muuttaa.' using errcode = '23514';
  end if;
  return new;
end;
$$;

drop trigger if exists offer_lines_guard_mutation on public.offer_lines;
create trigger offer_lines_guard_mutation
before insert or update or delete on public.offer_lines
for each row execute function private.guard_offer_line_mutation();

drop trigger if exists offer_sections_guard_mutation on public.offer_sections;
create trigger offer_sections_guard_mutation
before insert or update or delete on public.offer_sections
for each row execute function private.guard_offer_section_mutation();

drop trigger if exists offer_versions_guard_content on public.offer_versions;
create trigger offer_versions_guard_content
before update on public.offer_versions
for each row execute function private.guard_offer_version_content();

drop trigger if exists offer_sections_set_updated_at on public.offer_sections;
create trigger offer_sections_set_updated_at
before update on public.offer_sections
for each row execute function public.set_updated_at();

drop trigger if exists price_catalog_items_set_updated_at on public.price_catalog_items;
create trigger price_catalog_items_set_updated_at
before update on public.price_catalog_items
for each row execute function public.set_updated_at();

create or replace function public.create_offer_v2(
  p_organization_id uuid,
  p_customer_id uuid default null,
  p_crm_lead_id uuid default null,
  p_project_id uuid default null,
  p_name text default null,
  p_offer_number text default null,
  p_valid_until date default null,
  p_notes text default null,
  p_assigned_user_id uuid default null
)
returns uuid
language plpgsql
set search_path = ''
as $$
declare
  settings_row public.organization_settings%rowtype;
  new_offer_id uuid;
  new_version_id uuid;
  normalized_name text;
  normalized_number text;
  calculated_valid_until date;
  year_text text;
  next_number integer;
begin
  if not private.has_org_role(
    p_organization_id,
    array['admin','supervisor','project_coordinator']::text[]
  ) then
    raise exception 'not authorized' using errcode = '42501';
  end if;

  normalized_name := nullif(trim(p_name), '');
  if normalized_name is null then
    raise exception 'Tarjouksen nimi on pakollinen.' using errcode = '23514';
  end if;

  if p_customer_id is not null and not exists (
    select 1 from public.customers
    where id = p_customer_id and organization_id = p_organization_id
  ) then
    raise exception 'Asiakasta ei löydy aktiivisesta organisaatiosta.' using errcode = '23503';
  end if;
  if p_crm_lead_id is not null and not exists (
    select 1 from public.crm_leads
    where id = p_crm_lead_id and organization_id = p_organization_id
  ) then
    raise exception 'CRM-mahdollisuutta ei löydy aktiivisesta organisaatiosta.' using errcode = '23503';
  end if;
  if p_project_id is not null and not exists (
    select 1 from public.projects
    where id = p_project_id and organization_id = p_organization_id
  ) then
    raise exception 'Projektia ei löydy aktiivisesta organisaatiosta.' using errcode = '23503';
  end if;

  select * into settings_row
  from public.organization_settings
  where organization_id = p_organization_id;

  calculated_valid_until := coalesce(
    p_valid_until,
    current_date + coalesce(settings_row.default_offer_valid_days, 30)
  );
  normalized_number := nullif(trim(p_offer_number), '');
  if normalized_number is null then
    year_text := to_char(current_date, 'YYYY');
    perform pg_advisory_xact_lock(hashtextextended(p_organization_id::text || ':' || year_text, 0));
    select coalesce(max(
      case
        when offer_number ~ ('^TAR-' || year_text || '-[0-9]+$')
          then split_part(offer_number, '-', 3)::integer
        else null
      end
    ), 0) + 1
    into next_number
    from public.offers
    where organization_id = p_organization_id;
    normalized_number := 'TAR-' || year_text || '-' || lpad(next_number::text, 4, '0');
  end if;

  insert into public.offers(
    organization_id,
    customer_id,
    crm_lead_id,
    project_id,
    name,
    offer_number,
    status,
    valid_until,
    currency,
    notes,
    assigned_user_id,
    payment_terms,
    created_by
  ) values (
    p_organization_id,
    p_customer_id,
    p_crm_lead_id,
    p_project_id,
    normalized_name,
    normalized_number,
    'Luonnos',
    calculated_valid_until,
    'EUR',
    nullif(trim(p_notes), ''),
    p_assigned_user_id,
    case
      when settings_row.default_payment_term_days is not null
        then settings_row.default_payment_term_days || ' päivää netto'
      else null
    end,
    auth.uid()
  ) returning id into new_offer_id;

  insert into public.offer_versions(
    organization_id,
    offer_id,
    version_number,
    status,
    title,
    vat_rate,
    overhead_percent,
    risk_percent,
    margin_percent,
    notes,
    terms,
    created_by
  ) values (
    p_organization_id,
    new_offer_id,
    1,
    'Luonnos',
    normalized_name || ' v1',
    coalesce(settings_row.default_vat_rate, 25.5),
    coalesce(settings_row.default_overhead_percent, 0),
    coalesce(settings_row.default_risk_percent, 0),
    least(coalesce(settings_row.default_margin_percent, 0), 99.99),
    nullif(trim(p_notes), ''),
    settings_row.default_offer_terms,
    auth.uid()
  ) returning id into new_version_id;

  insert into public.offer_events(
    organization_id,
    offer_id,
    offer_version_id,
    event_type,
    detail,
    created_by
  ) values (
    p_organization_id,
    new_offer_id,
    new_version_id,
    'created',
    'Tarjous luotiin.',
    auth.uid()
  );

  if p_crm_lead_id is not null then
    update public.crm_leads
    set stage = 'Tarjous laskennassa',
        probability = greatest(probability, 40),
        last_activity_at = now()
    where id = p_crm_lead_id and organization_id = p_organization_id;
  end if;

  perform private.recalculate_offer_version(new_version_id);
  return new_offer_id;
end;
$$;
revoke all on function public.create_offer_v2(uuid,uuid,uuid,uuid,text,text,date,text,uuid)
from public, anon;
grant execute on function public.create_offer_v2(uuid,uuid,uuid,uuid,text,text,date,text,uuid)
to authenticated;

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
  section_row public.offer_sections%rowtype;
  new_section_id uuid;
begin
  select * into offer_row
  from public.offers
  where id = p_offer_id
  for update;

  if not found or not private.has_org_role(
    offer_row.organization_id,
    array['admin','supervisor','project_coordinator']::text[]
  ) then
    raise exception 'not authorized' using errcode = '42501';
  end if;
  if offer_row.status in ('Hyväksytty','Arkistoitu') then
    raise exception 'Hyväksytystä tai arkistoidusta tarjouksesta ei voi luoda uutta versiota.'
      using errcode = '23514';
  end if;

  select * into previous_row
  from public.offer_versions
  where offer_id = p_offer_id
  order by version_number desc
  limit 1;
  next_version := coalesce(previous_row.version_number, 0) + 1;

  insert into public.offer_versions(
    organization_id,
    offer_id,
    version_number,
    status,
    title,
    vat_rate,
    overhead_percent,
    risk_percent,
    margin_percent,
    notes,
    terms,
    created_by
  ) values (
    offer_row.organization_id,
    offer_row.id,
    next_version,
    'Luonnos',
    offer_row.name || ' v' || next_version,
    coalesce(previous_row.vat_rate, 25.5),
    coalesce(previous_row.overhead_percent, 0),
    coalesce(previous_row.risk_percent, 0),
    least(coalesce(previous_row.margin_percent, 0), 99.99),
    previous_row.notes,
    previous_row.terms,
    auth.uid()
  ) returning id into new_id;

  if previous_row.id is not null then
    for section_row in
      select * from public.offer_sections
      where offer_version_id = previous_row.id
      order by sort_order, created_at
    loop
      insert into public.offer_sections(
        organization_id,
        offer_version_id,
        title,
        description,
        sort_order,
        customer_visible,
        created_by
      ) values (
        section_row.organization_id,
        new_id,
        section_row.title,
        section_row.description,
        section_row.sort_order,
        section_row.customer_visible,
        auth.uid()
      ) returning id into new_section_id;

      insert into public.offer_lines(
        organization_id,
        offer_version_id,
        section_id,
        category,
        description,
        quantity,
        unit,
        unit_price_cents,
        cost_unit_price_cents,
        waste_percent,
        discount_percent,
        vat_rate,
        source_takeoff_line_id,
        source_catalog_item_id,
        internal_note,
        customer_note,
        customer_visible,
        is_optional,
        sort_order,
        created_by
      )
      select
        organization_id,
        new_id,
        new_section_id,
        category,
        description,
        quantity,
        unit,
        unit_price_cents,
        cost_unit_price_cents,
        waste_percent,
        discount_percent,
        vat_rate,
        source_takeoff_line_id,
        source_catalog_item_id,
        internal_note,
        customer_note,
        customer_visible,
        is_optional,
        sort_order,
        auth.uid()
      from public.offer_lines
      where offer_version_id = previous_row.id
        and section_id = section_row.id;
    end loop;

    insert into public.offer_lines(
      organization_id,
      offer_version_id,
      section_id,
      category,
      description,
      quantity,
      unit,
      unit_price_cents,
      cost_unit_price_cents,
      waste_percent,
      discount_percent,
      vat_rate,
      source_takeoff_line_id,
      source_catalog_item_id,
      internal_note,
      customer_note,
      customer_visible,
      is_optional,
      sort_order,
      created_by
    )
    select
      organization_id,
      new_id,
      null,
      category,
      description,
      quantity,
      unit,
      unit_price_cents,
      cost_unit_price_cents,
      waste_percent,
      discount_percent,
      vat_rate,
      source_takeoff_line_id,
      source_catalog_item_id,
      internal_note,
      customer_note,
      customer_visible,
      is_optional,
      sort_order,
      auth.uid()
    from public.offer_lines
    where offer_version_id = previous_row.id
      and section_id is null;

    update public.offer_versions
    set status = 'Korvattu'
    where id = previous_row.id and status in ('Luonnos','Lähetetty');
  end if;

  update public.offers
  set status = 'Luonnos',
      sent_at = null,
      rejected_at = null,
      accepted_version_id = null
  where id = offer_row.id;

  insert into public.offer_events(
    organization_id,
    offer_id,
    offer_version_id,
    event_type,
    detail,
    metadata,
    created_by
  ) values (
    offer_row.organization_id,
    offer_row.id,
    new_id,
    'version_created',
    'Uusi tarjousversio luotiin.',
    jsonb_build_object('version_number', next_version),
    auth.uid()
  );

  perform private.recalculate_offer_version(new_id);
  return new_id;
end;
$$;
revoke all on function public.create_offer_version(uuid) from public, anon;
grant execute on function public.create_offer_version(uuid) to authenticated;

create or replace function public.transition_offer(
  p_offer_id uuid,
  p_offer_version_id uuid,
  p_status text
)
returns void
language plpgsql
set search_path = ''
as $$
declare
  offer_row public.offers%rowtype;
  version_row public.offer_versions%rowtype;
begin
  if p_status not in ('Luonnos','Lähetetty','Hyväksytty','Hylätty','Vanhentunut','Arkistoitu') then
    raise exception 'Tuntematon tarjouksen tila.' using errcode = '22023';
  end if;

  select * into offer_row
  from public.offers
  where id = p_offer_id
  for update;

  if not found or not private.has_org_role(
    offer_row.organization_id,
    array['admin','supervisor','project_coordinator']::text[]
  ) then
    raise exception 'not authorized' using errcode = '42501';
  end if;

  if p_offer_version_id is not null then
    perform private.recalculate_offer_version(p_offer_version_id);
    select * into version_row
    from public.offer_versions
    where id = p_offer_version_id
      and offer_id = p_offer_id
      and organization_id = offer_row.organization_id;
    if not found then
      raise exception 'Tarjousversiota ei löydy.' using errcode = '23503';
    end if;
  end if;

  if p_status in ('Lähetetty','Hyväksytty','Hylätty') and p_offer_version_id is null then
    raise exception 'Valitse tarjousversio tilasiirtymää varten.' using errcode = '23514';
  end if;

  if p_status = 'Lähetetty' then
    if version_row.status <> 'Luonnos' then
      raise exception 'Vain luonnosversion voi lähettää.' using errcode = '23514';
    end if;
    if version_row.subtotal_cents <= 0 or not exists (
      select 1 from public.offer_lines
      where offer_version_id = p_offer_version_id and not is_optional
    ) then
      raise exception 'Tarjouksessa pitää olla vähintään yksi hinnoiteltu perusrivi.'
        using errcode = '23514';
    end if;

    update public.offer_versions
    set status = case
          when id = p_offer_version_id then 'Lähetetty'
          when status = 'Luonnos' then 'Korvattu'
          else status
        end,
        locked_at = case
          when id = p_offer_version_id then now()
          else locked_at
        end
    where offer_id = p_offer_id;

    update public.offers
    set status = 'Lähetetty',
        sent_at = now(),
        accepted_at = null,
        rejected_at = null,
        accepted_version_id = null
    where id = p_offer_id;

    if offer_row.crm_lead_id is not null then
      update public.crm_leads
      set stage = 'Tarjous lähetetty',
          quoted_at = now(),
          value = version_row.subtotal_cents / 100.0,
          estimated_cost = version_row.estimated_cost_cents / 100.0,
          probability = greatest(probability, 55),
          last_activity_at = now()
      where id = offer_row.crm_lead_id
        and organization_id = offer_row.organization_id;
    end if;
  elsif p_status = 'Hyväksytty' then
    if offer_row.status not in ('Lähetetty','Luonnos') then
      raise exception 'Tarjous ei ole hyväksyttävissä nykyisestä tilasta.' using errcode = '23514';
    end if;

    update public.offer_versions
    set status = case
          when id = p_offer_version_id then 'Hyväksytty'
          when status in ('Luonnos','Lähetetty') then 'Korvattu'
          else status
        end,
        locked_at = coalesce(locked_at, now())
    where offer_id = p_offer_id;

    update public.offers
    set status = 'Hyväksytty',
        accepted_at = now(),
        rejected_at = null,
        accepted_version_id = p_offer_version_id
    where id = p_offer_id;

    if offer_row.crm_lead_id is not null then
      update public.crm_leads
      set stage = 'Voitettu',
          won_at = now(),
          lost_at = null,
          value = version_row.subtotal_cents / 100.0,
          estimated_cost = version_row.estimated_cost_cents / 100.0,
          probability = 100,
          last_activity_at = now()
      where id = offer_row.crm_lead_id
        and organization_id = offer_row.organization_id;
    end if;
  elsif p_status = 'Hylätty' then
    update public.offer_versions
    set status = 'Hylätty',
        locked_at = coalesce(locked_at, now())
    where id = p_offer_version_id;

    update public.offers
    set status = 'Hylätty',
        rejected_at = now(),
        accepted_at = null,
        accepted_version_id = null
    where id = p_offer_id;

    if offer_row.crm_lead_id is not null then
      update public.crm_leads
      set stage = 'Hävitty',
          lost_at = now(),
          won_at = null,
          probability = 0,
          last_activity_at = now()
      where id = offer_row.crm_lead_id
        and organization_id = offer_row.organization_id;
    end if;
  elsif p_status = 'Arkistoitu' then
    update public.offer_versions
    set status = case
          when status in ('Luonnos','Lähetetty') then 'Arkistoitu'
          else status
        end,
        locked_at = case
          when status in ('Luonnos','Lähetetty') then coalesce(locked_at, now())
          else locked_at
        end
    where offer_id = p_offer_id;

    update public.offers set status = 'Arkistoitu' where id = p_offer_id;
  elsif p_status = 'Vanhentunut' then
    update public.offers set status = 'Vanhentunut' where id = p_offer_id;
  else
    update public.offers
    set status = 'Luonnos',
        sent_at = null,
        accepted_at = null,
        rejected_at = null,
        accepted_version_id = null
    where id = p_offer_id;
  end if;

  insert into public.offer_events(
    organization_id,
    offer_id,
    offer_version_id,
    event_type,
    detail,
    metadata,
    created_by
  ) values (
    offer_row.organization_id,
    offer_row.id,
    p_offer_version_id,
    'status_changed',
    'Tarjouksen tila muutettiin: ' || p_status,
    jsonb_build_object('status', p_status),
    auth.uid()
  );
end;
$$;
revoke all on function public.transition_offer(uuid,uuid,text) from public, anon;
grant execute on function public.transition_offer(uuid,uuid,text) to authenticated;

create or replace function public.convert_offer_to_project(p_offer_id uuid)
returns uuid
language plpgsql
set search_path = ''
as $$
declare
  offer_row public.offers%rowtype;
  version_row public.offer_versions%rowtype;
  customer_name text;
  new_project_id uuid;
begin
  select * into offer_row
  from public.offers
  where id = p_offer_id
  for update;

  if not found or not private.has_org_role(
    offer_row.organization_id,
    array['admin','supervisor','project_coordinator']::text[]
  ) then
    raise exception 'not authorized' using errcode = '42501';
  end if;
  if offer_row.status <> 'Hyväksytty' then
    raise exception 'Vain hyväksytty tarjous voidaan muuntaa projektiksi.' using errcode = '23514';
  end if;
  if offer_row.converted_project_id is not null then
    return offer_row.converted_project_id;
  end if;

  select * into version_row
  from public.offer_versions
  where id = offer_row.accepted_version_id
    and offer_id = offer_row.id
    and organization_id = offer_row.organization_id
    and status = 'Hyväksytty';
  if not found then
    raise exception 'Hyväksyttyä tarjousversiota ei löydy.' using errcode = '23514';
  end if;

  select name into customer_name
  from public.customers
  where id = offer_row.customer_id
    and organization_id = offer_row.organization_id;

  insert into public.projects(
    organization_id,
    customer_id,
    name,
    customer,
    status,
    progress,
    budget,
    spent,
    start_date,
    end_date,
    description,
    project_manager_id,
    created_by
  ) values (
    offer_row.organization_id,
    offer_row.customer_id,
    offer_row.name,
    coalesce(customer_name, ''),
    'Suunniteltu',
    0,
    version_row.subtotal_cents / 100.0,
    0,
    current_date,
    current_date + 30,
    'Luotu hyväksytystä tarjouksesta '
      || coalesce(offer_row.offer_number, offer_row.id::text)
      || '. Arvioitu kustannus '
      || to_char(version_row.estimated_cost_cents / 100.0, 'FM999999990.00')
      || ' euroa.',
    offer_row.assigned_user_id,
    auth.uid()
  ) returning id into new_project_id;

  update public.offers
  set converted_project_id = new_project_id,
      project_id = new_project_id
  where id = offer_row.id;

  if offer_row.crm_lead_id is not null then
    update public.crm_leads
    set converted_project_id = new_project_id,
        stage = 'Voitettu'
    where id = offer_row.crm_lead_id
      and organization_id = offer_row.organization_id;
  end if;

  insert into public.offer_events(
    organization_id,
    offer_id,
    offer_version_id,
    event_type,
    detail,
    metadata,
    created_by
  ) values (
    offer_row.organization_id,
    offer_row.id,
    version_row.id,
    'converted_to_project',
    'Hyväksytty tarjous muunnettiin projektiksi.',
    jsonb_build_object('project_id', new_project_id),
    auth.uid()
  );

  return new_project_id;
end;
$$;
revoke all on function public.convert_offer_to_project(uuid) from public, anon;
grant execute on function public.convert_offer_to_project(uuid) to authenticated;

commit;
