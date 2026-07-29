begin;

-- Offer numbers are the source for deterministic sales order numbers. Prevent
-- manually supplied duplicates before they can make acceptance fail later.
create unique index if not exists offers_org_offer_number_uidx
  on public.offers (organization_id, offer_number)
  where nullif(btrim(offer_number), '') is not null;

-- Offer creation already performs explicit organization-role validation. Run
-- the routines with owner privileges so browser users do not need broad INSERT
-- privileges on the commercial source-of-truth tables.
alter function public.create_offer_v2(uuid, uuid, uuid, uuid, text, text, date, text, uuid)
  security definer;
alter function public.create_offer_version(uuid)
  security definer;

revoke all on function public.create_offer_v2(uuid, uuid, uuid, uuid, text, text, date, text, uuid)
  from public, anon;
revoke all on function public.create_offer_version(uuid)
  from public, anon;
grant execute on function public.create_offer_v2(uuid, uuid, uuid, uuid, text, text, date, text, uuid)
  to authenticated;
grant execute on function public.create_offer_version(uuid)
  to authenticated;

-- Lock the offer-side mirror of an accepted sales order. The actual sales order
-- is immutable already; this prevents its UI-facing mirror from diverging even
-- through a privileged direct API update.
create or replace function private.guard_offer_record()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'DELETE' then
    if old.status <> 'Luonnos' or old.sales_order_id is not null then
      raise exception 'Vain tarjousluonnoksen voi poistaa. Säilytä muu tarjous historiassa ja arkistoi se.'
        using errcode = '23514';
    end if;
    return old;
  end if;

  if old.order_locked_at is not null and (
    old.organization_id is distinct from new.organization_id
    or old.customer_id is distinct from new.customer_id
    or old.offer_number is distinct from new.offer_number
    or old.currency is distinct from new.currency
    or old.accepted_version_id is distinct from new.accepted_version_id
    or old.accepted_at is distinct from new.accepted_at
    or old.sales_order_id is distinct from new.sales_order_id
    or old.order_number is distinct from new.order_number
    or old.contract_value_cents is distinct from new.contract_value_cents
    or old.cost_budget_cents is distinct from new.cost_budget_cents
    or old.target_margin_cents is distinct from new.target_margin_cents
    or old.target_margin_percent is distinct from new.target_margin_percent
    or old.order_locked_at is distinct from new.order_locked_at
  ) then
    raise exception 'Hyväksytyn tarjouksen tilaus- ja talousperustaa ei voi muuttaa.'
      using errcode = '23514';
  end if;

  if old.status <> 'Luonnos' and (
    old.name is distinct from new.name
    or old.customer_id is distinct from new.customer_id
    or old.crm_lead_id is distinct from new.crm_lead_id
    or old.offer_number is distinct from new.offer_number
    or old.valid_until is distinct from new.valid_until
    or old.currency is distinct from new.currency
    or old.customer_reference is distinct from new.customer_reference
    or old.delivery_time is distinct from new.delivery_time
    or old.payment_terms is distinct from new.payment_terms
  ) then
    raise exception 'Lähetetyn tarjouksen asiakassisältöä ei voi muuttaa. Tee tarvittaessa uusi versio.'
      using errcode = '23514';
  end if;

  if old.status = 'Hyväksytty'
    and new.status = 'Arkistoitu'
    and old.converted_project_id is null
  then
    raise exception 'Luo tai liitä projekti vahvistetusta tilauksesta ennen tarjouksen arkistointia.'
      using errcode = '23514';
  end if;

  return new;
end;
$$;
revoke all on function private.guard_offer_record() from public, anon, authenticated;

drop trigger if exists offers_guard_record on public.offers;
create trigger offers_guard_record
before update or delete on public.offers
for each row execute function private.guard_offer_record();

-- Validate the final committed state rather than an intermediate statement in
-- transition_offer. Re-reading the row makes this safe for the two-step atomic
-- acceptance transaction (status first, sales-order mirror second).
create or replace function private.validate_offer_order_integrity()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  current_offer public.offers%rowtype;
  current_order public.sales_orders%rowtype;
begin
  select * into current_offer
  from public.offers
  where id = new.id;

  if not found then
    return null;
  end if;

  if current_offer.status = 'Hyväksytty'
    or current_offer.sales_order_id is not null
    or current_offer.order_locked_at is not null
  then
    if current_offer.sales_order_id is null
      or current_offer.order_number is null
      or current_offer.order_locked_at is null
      or current_offer.accepted_version_id is null
      or current_offer.accepted_at is null
    then
      raise exception 'Hyväksytyltä tarjoukselta puuttuu vahvistettu tilaus tai lukittu talousperusta.'
        using errcode = '23514';
    end if;

    select * into current_order
    from public.sales_orders
    where id = current_offer.sales_order_id
      and organization_id = current_offer.organization_id
      and offer_id = current_offer.id;

    if not found then
      raise exception 'Tarjouksen vahvistettua tilausta ei löydy samasta organisaatiosta.'
        using errcode = '23514';
    end if;

    if current_order.accepted_offer_version_id is distinct from current_offer.accepted_version_id
      or current_order.order_number is distinct from current_offer.order_number
      or current_order.currency is distinct from current_offer.currency
      or current_order.contract_value_cents is distinct from current_offer.contract_value_cents
      or current_order.cost_budget_cents is distinct from current_offer.cost_budget_cents
      or current_order.target_margin_cents is distinct from current_offer.target_margin_cents
      or current_order.target_margin_percent is distinct from current_offer.target_margin_percent
      or current_order.accepted_at is distinct from current_offer.accepted_at
    then
      raise exception 'Tarjouksen ja vahvistetun tilauksen taloustiedot eivät täsmää.'
        using errcode = '23514';
    end if;
  end if;

  return null;
end;
$$;
revoke all on function private.validate_offer_order_integrity() from public, anon, authenticated;

drop trigger if exists offers_validate_order_integrity on public.offers;
create constraint trigger offers_validate_order_integrity
after insert or update on public.offers
deferrable initially deferred
for each row execute function private.validate_offer_order_integrity();

-- Remove table-wide browser privileges and grant only the columns used by the
-- application. Statuses, totals, ownership, timestamps and relationship keys
-- are changed only by the validated RPCs and database triggers.
revoke all on table public.offers, public.offer_versions, public.offer_sections, public.offer_lines
  from anon, authenticated;

grant select on table public.offers, public.offer_versions, public.offer_sections, public.offer_lines
  to authenticated;

grant update (
  name,
  valid_until,
  notes,
  customer_reference,
  delivery_time,
  payment_terms,
  assigned_user_id
) on table public.offers to authenticated;
grant delete on table public.offers to authenticated;

grant update (
  title,
  vat_rate,
  overhead_percent,
  risk_percent,
  margin_percent,
  notes,
  terms,
  pdf_storage_path
) on table public.offer_versions to authenticated;

grant insert (
  organization_id,
  offer_version_id,
  title,
  description,
  sort_order,
  customer_visible,
  created_by
) on table public.offer_sections to authenticated;
grant update (
  title,
  description,
  sort_order,
  customer_visible
) on table public.offer_sections to authenticated;
grant delete on table public.offer_sections to authenticated;

grant insert (
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
) on table public.offer_lines to authenticated;
grant update (
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
  sort_order
) on table public.offer_lines to authenticated;
grant delete on table public.offer_lines to authenticated;

comment on function private.guard_offer_record() is
  'Suojaa lähetetyn tarjouksen asiakassisällön ja hyväksytyn tarjouksen tilaus- sekä talouspeilin.';
comment on function private.validate_offer_order_integrity() is
  'Varmistaa commit-hetkellä, että hyväksytty tarjous ja vahvistettu tilaus muodostavat yhtenäisen snapshotin.';

commit;
