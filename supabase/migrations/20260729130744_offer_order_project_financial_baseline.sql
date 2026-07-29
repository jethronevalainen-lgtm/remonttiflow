begin;

alter table public.offers
  add column if not exists sales_order_id uuid,
  add column if not exists order_number text,
  add column if not exists contract_value_cents bigint not null default 0,
  add column if not exists cost_budget_cents bigint not null default 0,
  add column if not exists target_margin_cents bigint not null default 0,
  add column if not exists target_margin_percent numeric not null default 0,
  add column if not exists order_locked_at timestamptz;

alter table public.projects
  add column if not exists sales_order_id uuid,
  add column if not exists source_offer_id uuid,
  add column if not exists source_offer_version_id uuid,
  add column if not exists contract_value_cents bigint not null default 0,
  add column if not exists cost_budget_cents bigint not null default 0,
  add column if not exists target_margin_cents bigint not null default 0,
  add column if not exists target_margin_percent numeric not null default 0,
  add column if not exists financial_baseline_locked_at timestamptz;

create table if not exists public.sales_orders (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  customer_id uuid references public.customers(id) on delete set null,
  project_id uuid references public.projects(id) on delete set null,
  offer_id uuid not null references public.offers(id) on delete restrict,
  accepted_offer_version_id uuid not null references public.offer_versions(id) on delete restrict,
  order_number text not null,
  status text not null default 'Vahvistettu' check (status in ('Vahvistettu','Valmis','Peruttu')),
  currency text not null default 'EUR' check (currency = 'EUR'),
  contract_value_cents bigint not null check (contract_value_cents >= 0),
  tax_cents bigint not null check (tax_cents >= 0),
  total_with_tax_cents bigint not null check (total_with_tax_cents >= 0),
  cost_budget_cents bigint not null check (cost_budget_cents >= 0),
  target_margin_cents bigint not null,
  target_margin_percent numeric not null,
  accepted_at timestamptz not null,
  locked_at timestamptz not null default now(),
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, organization_id),
  unique (organization_id, offer_id),
  unique (organization_id, order_number)
);

create table if not exists public.sales_order_lines (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  sales_order_id uuid not null references public.sales_orders(id) on delete cascade,
  source_offer_line_id uuid references public.offer_lines(id) on delete set null,
  section_title text,
  category text not null,
  description text not null,
  quantity numeric not null check (quantity >= 0),
  unit text not null,
  cost_unit_price_cents bigint not null check (cost_unit_price_cents >= 0),
  sale_unit_price_cents bigint not null check (sale_unit_price_cents >= 0),
  waste_percent numeric not null check (waste_percent between 0 and 100),
  discount_percent numeric not null check (discount_percent between 0 and 100),
  cost_total_cents bigint not null check (cost_total_cents >= 0),
  sale_total_cents bigint not null check (sale_total_cents >= 0),
  is_optional boolean not null default false,
  included boolean not null default true,
  customer_visible boolean not null default true,
  internal_note text,
  customer_note text,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  unique (id, organization_id)
);

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'offers_sales_order_id_fkey' and conrelid = 'public.offers'::regclass) then
    alter table public.offers add constraint offers_sales_order_id_fkey foreign key (sales_order_id) references public.sales_orders(id) on delete set null;
  end if;
  if not exists (select 1 from pg_constraint where conname = 'projects_sales_order_id_fkey' and conrelid = 'public.projects'::regclass) then
    alter table public.projects add constraint projects_sales_order_id_fkey foreign key (sales_order_id) references public.sales_orders(id) on delete set null;
  end if;
  if not exists (select 1 from pg_constraint where conname = 'projects_source_offer_id_fkey' and conrelid = 'public.projects'::regclass) then
    alter table public.projects add constraint projects_source_offer_id_fkey foreign key (source_offer_id) references public.offers(id) on delete set null;
  end if;
  if not exists (select 1 from pg_constraint where conname = 'projects_source_offer_version_id_fkey' and conrelid = 'public.projects'::regclass) then
    alter table public.projects add constraint projects_source_offer_version_id_fkey foreign key (source_offer_version_id) references public.offer_versions(id) on delete set null;
  end if;
end
$$;

alter table public.offers drop constraint if exists offers_contract_value_cents_check;
alter table public.offers add constraint offers_contract_value_cents_check check (contract_value_cents >= 0);
alter table public.offers drop constraint if exists offers_cost_budget_cents_check;
alter table public.offers add constraint offers_cost_budget_cents_check check (cost_budget_cents >= 0);
alter table public.projects drop constraint if exists projects_contract_value_cents_check;
alter table public.projects add constraint projects_contract_value_cents_check check (contract_value_cents >= 0);
alter table public.projects drop constraint if exists projects_cost_budget_cents_check;
alter table public.projects add constraint projects_cost_budget_cents_check check (cost_budget_cents >= 0);

create index if not exists sales_orders_org_status_idx on public.sales_orders (organization_id, status, accepted_at desc);
create index if not exists sales_orders_project_idx on public.sales_orders (organization_id, project_id) where project_id is not null;
create index if not exists sales_order_lines_order_sort_idx on public.sales_order_lines (sales_order_id, sort_order, created_at);
create index if not exists projects_sales_order_idx on public.projects (organization_id, sales_order_id) where sales_order_id is not null;
create index if not exists offers_sales_order_idx on public.offers (organization_id, sales_order_id) where sales_order_id is not null;

alter table public.sales_orders enable row level security;
alter table public.sales_order_lines enable row level security;
revoke all on table public.sales_orders, public.sales_order_lines from anon;
revoke insert, update, delete on table public.sales_orders, public.sales_order_lines from authenticated;
grant select on table public.sales_orders, public.sales_order_lines to authenticated;

drop policy if exists sales_orders_select on public.sales_orders;
create policy sales_orders_select on public.sales_orders for select to authenticated
using (private.has_org_role(organization_id, array['admin','supervisor','project_coordinator']::text[]));

drop policy if exists sales_order_lines_select on public.sales_order_lines;
create policy sales_order_lines_select on public.sales_order_lines for select to authenticated
using (private.has_org_role(organization_id, array['admin','supervisor','project_coordinator']::text[]));

create or replace function private.guard_sales_order_line_snapshot()
returns trigger language plpgsql set search_path = '' as $$
begin
  raise exception 'Vahvistetun tilauksen rivejä ei voi muuttaa tai poistaa.' using errcode = '23514';
end;
$$;
revoke all on function private.guard_sales_order_line_snapshot() from public, anon, authenticated;

drop trigger if exists sales_order_lines_guard_snapshot on public.sales_order_lines;
create trigger sales_order_lines_guard_snapshot before update or delete on public.sales_order_lines
for each row execute function private.guard_sales_order_line_snapshot();

create or replace function private.guard_sales_order_financial_snapshot()
returns trigger language plpgsql set search_path = '' as $$
begin
  if tg_op = 'DELETE' then
    raise exception 'Vahvistettua tilausta ei voi poistaa.' using errcode = '23514';
  end if;
  if old.organization_id is distinct from new.organization_id
    or old.customer_id is distinct from new.customer_id
    or old.offer_id is distinct from new.offer_id
    or old.accepted_offer_version_id is distinct from new.accepted_offer_version_id
    or old.order_number is distinct from new.order_number
    or old.currency is distinct from new.currency
    or old.contract_value_cents is distinct from new.contract_value_cents
    or old.tax_cents is distinct from new.tax_cents
    or old.total_with_tax_cents is distinct from new.total_with_tax_cents
    or old.cost_budget_cents is distinct from new.cost_budget_cents
    or old.target_margin_cents is distinct from new.target_margin_cents
    or old.target_margin_percent is distinct from new.target_margin_percent
    or old.accepted_at is distinct from new.accepted_at
    or old.locked_at is distinct from new.locked_at
  then
    raise exception 'Vahvistetun tilauksen kaupallista perustasoa ei voi muuttaa.' using errcode = '23514';
  end if;
  return new;
end;
$$;
revoke all on function private.guard_sales_order_financial_snapshot() from public, anon, authenticated;

drop trigger if exists sales_orders_guard_financial_snapshot on public.sales_orders;
create trigger sales_orders_guard_financial_snapshot before update or delete on public.sales_orders
for each row execute function private.guard_sales_order_financial_snapshot();

drop trigger if exists sales_orders_set_updated_at on public.sales_orders;
create trigger sales_orders_set_updated_at before update on public.sales_orders
for each row execute function public.set_updated_at();

create or replace function private.guard_project_financial_baseline()
returns trigger language plpgsql set search_path = '' as $$
begin
  if old.financial_baseline_locked_at is not null and (
    old.sales_order_id is distinct from new.sales_order_id
    or old.source_offer_id is distinct from new.source_offer_id
    or old.source_offer_version_id is distinct from new.source_offer_version_id
    or old.contract_value_cents is distinct from new.contract_value_cents
    or old.cost_budget_cents is distinct from new.cost_budget_cents
    or old.target_margin_cents is distinct from new.target_margin_cents
    or old.target_margin_percent is distinct from new.target_margin_percent
    or old.financial_baseline_locked_at is distinct from new.financial_baseline_locked_at
    or old.budget is distinct from new.budget
  ) then
    raise exception 'Tarjouksesta muodostettua projektin taloudellista perustasoa ei voi muuttaa. Käytä lisä- tai muutostyötä.' using errcode = '23514';
  end if;
  return new;
end;
$$;
revoke all on function private.guard_project_financial_baseline() from public, anon, authenticated;

drop trigger if exists projects_guard_financial_baseline on public.projects;
create trigger projects_guard_financial_baseline before update on public.projects
for each row execute function private.guard_project_financial_baseline();

create or replace function private.ensure_sales_order_for_offer(p_offer_id uuid, p_offer_version_id uuid, p_actor_id uuid default null)
returns uuid language plpgsql security definer set search_path = '' as $$
declare
  offer_row public.offers%rowtype;
  version_row public.offer_versions%rowtype;
  existing_order_id uuid;
  new_order_id uuid;
  generated_order_number text;
  accepted_timestamp timestamptz;
begin
  select * into offer_row from public.offers where id = p_offer_id for update;
  if not found then raise exception 'Tarjousta ei löydy.' using errcode = '23503'; end if;

  select id into existing_order_id from public.sales_orders
  where organization_id = offer_row.organization_id and offer_id = offer_row.id;
  if existing_order_id is not null then return existing_order_id; end if;

  select * into version_row from public.offer_versions
  where id = p_offer_version_id and offer_id = offer_row.id and organization_id = offer_row.organization_id;
  if not found then raise exception 'Tarjousversiota ei löydy tilauksen muodostamista varten.' using errcode = '23503'; end if;

  generated_order_number := case
    when offer_row.offer_number ~ '^TAR-' then regexp_replace(offer_row.offer_number, '^TAR-', 'TIL-')
    when nullif(trim(offer_row.offer_number), '') is not null then 'TIL-' || trim(offer_row.offer_number)
    else 'TIL-' || to_char(coalesce(offer_row.accepted_at, now()), 'YYYY') || '-' || upper(substr(replace(offer_row.id::text, '-', ''), 1, 8))
  end;
  accepted_timestamp := coalesce(offer_row.accepted_at, now());

  insert into public.sales_orders (
    organization_id, customer_id, project_id, offer_id, accepted_offer_version_id,
    order_number, status, currency, contract_value_cents, tax_cents,
    total_with_tax_cents, cost_budget_cents, target_margin_cents,
    target_margin_percent, accepted_at, locked_at, created_by
  ) values (
    offer_row.organization_id, offer_row.customer_id, offer_row.project_id, offer_row.id, version_row.id,
    generated_order_number, 'Vahvistettu', offer_row.currency, version_row.subtotal_cents,
    version_row.tax_cents, version_row.total_cents, version_row.estimated_cost_cents,
    version_row.gross_margin_cents, version_row.gross_margin_percent, accepted_timestamp,
    now(), coalesce(p_actor_id, offer_row.created_by)
  ) returning id into new_order_id;

  insert into public.sales_order_lines (
    organization_id, sales_order_id, source_offer_line_id, section_title, category,
    description, quantity, unit, cost_unit_price_cents, sale_unit_price_cents,
    waste_percent, discount_percent, cost_total_cents, sale_total_cents,
    is_optional, included, customer_visible, internal_note, customer_note, sort_order
  )
  select
    line.organization_id, new_order_id, line.id, section.title, line.category,
    line.description, line.quantity, line.unit, line.cost_unit_price_cents, line.unit_price_cents,
    line.waste_percent, line.discount_percent,
    round(line.quantity * (1 + line.waste_percent / 100) * line.cost_unit_price_cents)::bigint,
    round(line.quantity * (1 + line.waste_percent / 100) * line.unit_price_cents * (1 - line.discount_percent / 100))::bigint,
    line.is_optional, not line.is_optional, line.customer_visible, line.internal_note,
    line.customer_note, line.sort_order
  from public.offer_lines line
  left join public.offer_sections section on section.id = line.section_id and section.organization_id = line.organization_id
  where line.offer_version_id = version_row.id and line.organization_id = offer_row.organization_id
  order by coalesce(section.sort_order, 2147483647), line.sort_order, line.created_at;

  update public.offers
  set sales_order_id = new_order_id,
      order_number = generated_order_number,
      contract_value_cents = version_row.subtotal_cents,
      cost_budget_cents = version_row.estimated_cost_cents,
      target_margin_cents = version_row.gross_margin_cents,
      target_margin_percent = version_row.gross_margin_percent,
      order_locked_at = now()
  where id = offer_row.id;

  if offer_row.project_id is not null then
    if exists (
      select 1 from public.projects
      where id = offer_row.project_id and organization_id = offer_row.organization_id
        and sales_order_id is not null and sales_order_id <> new_order_id
    ) then
      raise exception 'Projektiin on jo liitetty toinen vahvistettu tilaus.' using errcode = '23514';
    end if;

    update public.projects
    set sales_order_id = new_order_id,
        source_offer_id = offer_row.id,
        source_offer_version_id = version_row.id,
        contract_value_cents = version_row.subtotal_cents,
        cost_budget_cents = version_row.estimated_cost_cents,
        target_margin_cents = version_row.gross_margin_cents,
        target_margin_percent = version_row.gross_margin_percent,
        financial_baseline_locked_at = now(),
        budget = version_row.subtotal_cents / 100.0
    where id = offer_row.project_id and organization_id = offer_row.organization_id
      and financial_baseline_locked_at is null;
  end if;

  insert into public.offer_events (
    organization_id, offer_id, offer_version_id, event_type, detail, metadata, created_by
  ) values (
    offer_row.organization_id, offer_row.id, version_row.id, 'sales_order_created',
    'Hyväksytystä tarjouksesta muodostettiin lukittu tilaus.',
    jsonb_build_object(
      'sales_order_id', new_order_id,
      'order_number', generated_order_number,
      'contract_value_cents', version_row.subtotal_cents,
      'cost_budget_cents', version_row.estimated_cost_cents,
      'target_margin_cents', version_row.gross_margin_cents
    ),
    coalesce(p_actor_id, offer_row.created_by)
  );
  return new_order_id;
end;
$$;
revoke all on function private.ensure_sales_order_for_offer(uuid, uuid, uuid) from public, anon, authenticated;

create or replace function public.transition_offer(p_offer_id uuid, p_offer_version_id uuid, p_status text)
returns void language plpgsql security definer set search_path = '' as $$
declare
  offer_row public.offers%rowtype;
  version_row public.offer_versions%rowtype;
  created_order_id uuid;
begin
  if p_status not in ('Luonnos','Lähetetty','Hyväksytty','Hylätty','Vanhentunut','Arkistoitu') then
    raise exception 'Tuntematon tarjouksen tila.' using errcode = '22023';
  end if;

  select * into offer_row from public.offers where id = p_offer_id for update;
  if not found or not private.has_org_role(offer_row.organization_id, array['admin','supervisor','project_coordinator']::text[]) then
    raise exception 'not authorized' using errcode = '42501';
  end if;
  if offer_row.status = 'Hyväksytty' and p_status <> 'Arkistoitu' then
    raise exception 'Hyväksytty tarjous on muodostanut lukitun tilauksen eikä sitä voi palauttaa aiempaan tilaan.' using errcode = '23514';
  end if;

  if p_offer_version_id is not null then
    perform private.recalculate_offer_version(p_offer_version_id);
    select * into version_row from public.offer_versions
    where id = p_offer_version_id and offer_id = p_offer_id and organization_id = offer_row.organization_id;
    if not found then raise exception 'Tarjousversiota ei löydy.' using errcode = '23503'; end if;
  end if;

  if p_status in ('Lähetetty','Hyväksytty','Hylätty') and p_offer_version_id is null then
    raise exception 'Valitse tarjousversio tilasiirtymää varten.' using errcode = '23514';
  end if;

  if p_status in ('Lähetetty','Hyväksytty') and (
    version_row.subtotal_cents <= 0
    or not exists (
      select 1 from public.offer_lines
      where offer_version_id = p_offer_version_id and organization_id = offer_row.organization_id and not is_optional
    )
  ) then
    raise exception 'Tarjouksessa pitää olla vähintään yksi hinnoiteltu perusrivi.' using errcode = '23514';
  end if;

  if p_status = 'Lähetetty' then
    if version_row.status <> 'Luonnos' then raise exception 'Vain luonnosversion voi lähettää.' using errcode = '23514'; end if;
    update public.offer_versions
    set status = case when id = p_offer_version_id then 'Lähetetty' when status = 'Luonnos' then 'Korvattu' else status end,
        locked_at = case when id = p_offer_version_id then now() else locked_at end
    where offer_id = p_offer_id;
    update public.offers
    set status = 'Lähetetty', sent_at = now(), accepted_at = null, rejected_at = null, accepted_version_id = null
    where id = p_offer_id;
    if offer_row.crm_lead_id is not null then
      update public.crm_leads
      set stage = 'Tarjous lähetetty', quoted_at = now(), value = version_row.subtotal_cents / 100.0,
          estimated_cost = version_row.estimated_cost_cents / 100.0,
          probability = greatest(probability, 55), last_activity_at = now()
      where id = offer_row.crm_lead_id and organization_id = offer_row.organization_id;
    end if;
  elsif p_status = 'Hyväksytty' then
    if offer_row.status not in ('Lähetetty','Luonnos') then
      raise exception 'Tarjous ei ole hyväksyttävissä nykyisestä tilasta.' using errcode = '23514';
    end if;
    update public.offer_versions
    set status = case when id = p_offer_version_id then 'Hyväksytty' when status in ('Luonnos','Lähetetty') then 'Korvattu' else status end,
        locked_at = coalesce(locked_at, now())
    where offer_id = p_offer_id;
    update public.offers
    set status = 'Hyväksytty', accepted_at = now(), rejected_at = null, accepted_version_id = p_offer_version_id
    where id = p_offer_id;
    if offer_row.crm_lead_id is not null then
      update public.crm_leads
      set stage = 'Voitettu', won_at = now(), lost_at = null,
          value = version_row.subtotal_cents / 100.0,
          estimated_cost = version_row.estimated_cost_cents / 100.0,
          probability = 100, last_activity_at = now()
      where id = offer_row.crm_lead_id and organization_id = offer_row.organization_id;
    end if;
    created_order_id := private.ensure_sales_order_for_offer(p_offer_id, p_offer_version_id, auth.uid());
  elsif p_status = 'Hylätty' then
    update public.offer_versions set status = 'Hylätty', locked_at = coalesce(locked_at, now()) where id = p_offer_version_id;
    update public.offers
    set status = 'Hylätty', rejected_at = now(), accepted_at = null, accepted_version_id = null
    where id = p_offer_id;
    if offer_row.crm_lead_id is not null then
      update public.crm_leads
      set stage = 'Hävitty', lost_at = now(), won_at = null, probability = 0, last_activity_at = now()
      where id = offer_row.crm_lead_id and organization_id = offer_row.organization_id;
    end if;
  elsif p_status = 'Arkistoitu' then
    update public.offer_versions
    set status = case when status in ('Luonnos','Lähetetty') then 'Arkistoitu' else status end,
        locked_at = case when status in ('Luonnos','Lähetetty') then coalesce(locked_at, now()) else locked_at end
    where offer_id = p_offer_id;
    update public.offers set status = 'Arkistoitu' where id = p_offer_id;
  elsif p_status = 'Vanhentunut' then
    update public.offers set status = 'Vanhentunut' where id = p_offer_id;
  else
    update public.offers
    set status = 'Luonnos', sent_at = null, accepted_at = null, rejected_at = null, accepted_version_id = null
    where id = p_offer_id;
  end if;

  insert into public.offer_events(organization_id, offer_id, offer_version_id, event_type, detail, metadata, created_by)
  values (
    offer_row.organization_id, offer_row.id, p_offer_version_id, 'status_changed',
    'Tarjouksen tila muutettiin: ' || p_status,
    jsonb_strip_nulls(jsonb_build_object('status', p_status, 'sales_order_id', created_order_id)),
    auth.uid()
  );
end;
$$;
revoke all on function public.transition_offer(uuid,uuid,text) from public, anon;
grant execute on function public.transition_offer(uuid,uuid,text) to authenticated;

create or replace function public.convert_offer_to_project(p_offer_id uuid)
returns uuid language plpgsql security definer set search_path = '' as $$
declare
  offer_row public.offers%rowtype;
  version_row public.offer_versions%rowtype;
  order_row public.sales_orders%rowtype;
  customer_name text;
  target_project_id uuid;
  project_order_id uuid;
begin
  select * into offer_row from public.offers where id = p_offer_id for update;
  if not found or not private.has_org_role(offer_row.organization_id, array['admin','supervisor','project_coordinator']::text[]) then
    raise exception 'not authorized' using errcode = '42501';
  end if;
  if offer_row.status <> 'Hyväksytty' then raise exception 'Vain hyväksytty tarjous voidaan muuntaa projektiksi.' using errcode = '23514'; end if;
  if offer_row.converted_project_id is not null then return offer_row.converted_project_id; end if;

  select * into version_row from public.offer_versions
  where id = offer_row.accepted_version_id and offer_id = offer_row.id
    and organization_id = offer_row.organization_id and status = 'Hyväksytty';
  if not found then raise exception 'Hyväksyttyä tarjousversiota ei löydy.' using errcode = '23514'; end if;

  if offer_row.sales_order_id is null then
    perform private.ensure_sales_order_for_offer(offer_row.id, version_row.id, auth.uid());
  end if;
  select * into order_row from public.sales_orders
  where organization_id = offer_row.organization_id and offer_id = offer_row.id for update;
  if not found then raise exception 'Vahvistettua tilausta ei löydy.' using errcode = '23514'; end if;

  if offer_row.project_id is not null then
    select sales_order_id into project_order_id from public.projects
    where id = offer_row.project_id and organization_id = offer_row.organization_id for update;
    if not found then raise exception 'Tarjoukseen liitettyä projektia ei löydy.' using errcode = '23503'; end if;
    if project_order_id is not null and project_order_id <> order_row.id then
      raise exception 'Projektiin on jo liitetty toinen vahvistettu tilaus.' using errcode = '23514';
    end if;
    target_project_id := offer_row.project_id;
    update public.projects
    set sales_order_id = order_row.id,
        source_offer_id = offer_row.id,
        source_offer_version_id = version_row.id,
        contract_value_cents = order_row.contract_value_cents,
        cost_budget_cents = order_row.cost_budget_cents,
        target_margin_cents = order_row.target_margin_cents,
        target_margin_percent = order_row.target_margin_percent,
        financial_baseline_locked_at = coalesce(financial_baseline_locked_at, now()),
        budget = order_row.contract_value_cents / 100.0
    where id = target_project_id and organization_id = offer_row.organization_id;
  else
    select name into customer_name from public.customers
    where id = offer_row.customer_id and organization_id = offer_row.organization_id;
    insert into public.projects(
      organization_id, customer_id, name, customer, status, progress, budget, spent,
      start_date, end_date, description, project_manager_id, created_by,
      sales_order_id, source_offer_id, source_offer_version_id, contract_value_cents,
      cost_budget_cents, target_margin_cents, target_margin_percent, financial_baseline_locked_at
    ) values (
      offer_row.organization_id, offer_row.customer_id, offer_row.name, coalesce(customer_name, ''),
      'Suunniteltu', 0, order_row.contract_value_cents / 100.0, 0, current_date, current_date + 30,
      'Luotu vahvistetusta tilauksesta ' || order_row.order_number || '.',
      offer_row.assigned_user_id, auth.uid(), order_row.id, offer_row.id, version_row.id,
      order_row.contract_value_cents, order_row.cost_budget_cents, order_row.target_margin_cents,
      order_row.target_margin_percent, now()
    ) returning id into target_project_id;
  end if;

  update public.sales_orders set project_id = target_project_id where id = order_row.id;
  update public.offers set converted_project_id = target_project_id, project_id = target_project_id where id = offer_row.id;
  if offer_row.crm_lead_id is not null then
    update public.crm_leads set converted_project_id = target_project_id, stage = 'Voitettu'
    where id = offer_row.crm_lead_id and organization_id = offer_row.organization_id;
  end if;
  insert into public.offer_events(organization_id, offer_id, offer_version_id, event_type, detail, metadata, created_by)
  values (
    offer_row.organization_id, offer_row.id, version_row.id, 'converted_to_project',
    case when offer_row.project_id is null then 'Vahvistetusta tilauksesta luotiin projekti.' else 'Vahvistettu tilaus liitettiin olemassa olevaan projektiin.' end,
    jsonb_build_object('project_id', target_project_id, 'sales_order_id', order_row.id, 'order_number', order_row.order_number),
    auth.uid()
  );
  return target_project_id;
end;
$$;
revoke all on function public.convert_offer_to_project(uuid) from public, anon;
grant execute on function public.convert_offer_to_project(uuid) to authenticated;

do $$
declare accepted_offer record;
begin
  for accepted_offer in
    select id, accepted_version_id, created_by from public.offers
    where status = 'Hyväksytty' and accepted_version_id is not null
  loop
    perform private.ensure_sales_order_for_offer(accepted_offer.id, accepted_offer.accepted_version_id, accepted_offer.created_by);
  end loop;
end
$$;

update public.projects project
set sales_order_id = sales_order.id,
    source_offer_id = offer.id,
    source_offer_version_id = sales_order.accepted_offer_version_id,
    contract_value_cents = sales_order.contract_value_cents,
    cost_budget_cents = sales_order.cost_budget_cents,
    target_margin_cents = sales_order.target_margin_cents,
    target_margin_percent = sales_order.target_margin_percent,
    financial_baseline_locked_at = coalesce(project.financial_baseline_locked_at, sales_order.locked_at),
    budget = sales_order.contract_value_cents / 100.0
from public.offers offer
join public.sales_orders sales_order on sales_order.offer_id = offer.id and sales_order.organization_id = offer.organization_id
where offer.converted_project_id = project.id and project.organization_id = offer.organization_id
  and project.financial_baseline_locked_at is null;

update public.sales_orders sales_order
set project_id = offer.converted_project_id
from public.offers offer
where sales_order.offer_id = offer.id and sales_order.organization_id = offer.organization_id
  and offer.converted_project_id is not null and sales_order.project_id is distinct from offer.converted_project_id;

drop trigger if exists audit_sales_orders_change on public.sales_orders;
create trigger audit_sales_orders_change after insert or update or delete on public.sales_orders
for each row execute function private.audit_business_change();

drop trigger if exists audit_sales_order_lines_change on public.sales_order_lines;
create trigger audit_sales_order_lines_change after insert or update or delete on public.sales_order_lines
for each row execute function private.audit_business_change();

comment on table public.sales_orders is 'Hyväksytystä tarjousversiosta muodostettu muuttumaton tilaus- ja talousperusta.';
comment on table public.sales_order_lines is 'Vahvistetun tilauksen muuttumattomat rivisnapshotit.';
comment on column public.projects.contract_value_cents is 'Alkuperäinen arvonlisäveroton sopimusarvo sentteinä. Muutostyöt eivät muuta tätä perustasoa.';
comment on column public.projects.cost_budget_cents is 'Hyväksytyn tarjousversion alkuperäinen kustannusbudjetti sentteinä.';
comment on column public.projects.target_margin_cents is 'Alkuperäinen tavoitekate sentteinä ennen lisä- ja muutostöitä.';
comment on column public.projects.financial_baseline_locked_at is 'Aika, jolloin tarjoukseen perustuva taloudellinen lähtötaso lukittiin.';

commit;
