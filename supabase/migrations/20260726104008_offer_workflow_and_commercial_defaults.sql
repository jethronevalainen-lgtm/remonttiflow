begin;

alter table public.organization_settings
  add column if not exists default_hourly_cost_cents bigint not null default 0,
  add column if not exists default_payment_term_days smallint not null default 14,
  add column if not exists default_offer_valid_days smallint not null default 30,
  add column if not exists default_offer_terms text,
  add column if not exists company_address text,
  add column if not exists company_postal_code text,
  add column if not exists company_city text,
  add column if not exists company_email text,
  add column if not exists company_phone text;

alter table public.organization_settings
  alter column default_vat_rate set default 25.5;

alter table public.organization_settings
  drop constraint if exists organization_settings_default_hourly_cost_cents_check,
  drop constraint if exists organization_settings_default_payment_term_days_check,
  drop constraint if exists organization_settings_default_offer_valid_days_check;

alter table public.organization_settings
  add constraint organization_settings_default_hourly_cost_cents_check
    check (default_hourly_cost_cents >= 0),
  add constraint organization_settings_default_payment_term_days_check
    check (default_payment_term_days between 1 and 365),
  add constraint organization_settings_default_offer_valid_days_check
    check (default_offer_valid_days between 1 and 365);

alter table public.offer_versions
  drop constraint if exists offer_versions_status_check;
alter table public.offer_versions
  add constraint offer_versions_status_check
  check (status in ('Luonnos','Lähetetty','Hyväksytty','Hylätty','Korvattu','Arkistoitu'));

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

revoke all on function private.offer_version_recalculate_trigger() from public, anon, authenticated;

drop trigger if exists offer_version_recalculate on public.offer_versions;
create trigger offer_version_recalculate
after update of vat_rate, overhead_percent, risk_percent, margin_percent
on public.offer_versions
for each row
when (
  old.vat_rate is distinct from new.vat_rate
  or old.overhead_percent is distinct from new.overhead_percent
  or old.risk_percent is distinct from new.risk_percent
  or old.margin_percent is distinct from new.margin_percent
)
execute function private.offer_version_recalculate_trigger();

create or replace function public.create_offer(
  p_organization_id uuid,
  p_customer_id uuid,
  p_crm_lead_id uuid,
  p_project_id uuid,
  p_name text,
  p_offer_number text,
  p_valid_until date,
  p_notes text
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
begin
  if not private.has_org_role(p_organization_id, array['admin','supervisor']::text[]) then
    raise exception 'not authorized' using errcode = '42501';
  end if;

  normalized_name := nullif(trim(p_name), '');
  if normalized_name is null then
    raise exception 'Tarjouksen nimi on pakollinen.' using errcode = '23514';
  end if;

  select * into settings_row
  from public.organization_settings
  where organization_id = p_organization_id;

  normalized_number := nullif(trim(p_offer_number), '');
  calculated_valid_until := coalesce(
    p_valid_until,
    current_date + coalesce(settings_row.default_offer_valid_days, 30)
  );

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
    coalesce(settings_row.default_margin_percent, 0),
    nullif(trim(p_notes), ''),
    settings_row.default_offer_terms,
    auth.uid()
  ) returning id into new_version_id;

  perform private.recalculate_offer_version(new_version_id);
  return new_offer_id;
end;
$$;

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
  select * into offer_row
  from public.offers
  where id = p_offer_id
  for update;

  if not found or not private.has_org_role(offer_row.organization_id, array['admin','supervisor']::text[]) then
    raise exception 'not authorized' using errcode = '42501';
  end if;
  if offer_row.status in ('Hyväksytty','Arkistoitu') then
    raise exception 'Hyväksytystä tai arkistoidusta tarjouksesta ei voi luoda uutta versiota.' using errcode = '23514';
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
    coalesce(previous_row.margin_percent, 0),
    previous_row.notes,
    previous_row.terms,
    auth.uid()
  ) returning id into new_id;

  if previous_row.id is not null then
    insert into public.offer_lines(
      organization_id,
      offer_version_id,
      category,
      description,
      quantity,
      unit,
      unit_price_cents,
      sort_order,
      created_by
    )
    select
      organization_id,
      new_id,
      category,
      description,
      quantity,
      unit,
      unit_price_cents,
      sort_order,
      auth.uid()
    from public.offer_lines
    where offer_version_id = previous_row.id;

    update public.offer_versions
    set status = 'Korvattu'
    where id = previous_row.id
      and status in ('Luonnos','Lähetetty');
  end if;

  update public.offers
  set status = 'Luonnos', sent_at = null, rejected_at = null
  where id = offer_row.id;

  perform private.recalculate_offer_version(new_id);
  return new_id;
end;
$$;

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

  if not found or not private.has_org_role(offer_row.organization_id, array['admin','supervisor']::text[]) then
    raise exception 'not authorized' using errcode = '42501';
  end if;

  if p_offer_version_id is not null then
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
    update public.offer_versions
    set status = case when id = p_offer_version_id then 'Lähetetty' else
      case when status = 'Luonnos' then 'Korvattu' else status end end
    where offer_id = p_offer_id;
    update public.offers
    set status = 'Lähetetty', sent_at = now(), accepted_at = null, rejected_at = null
    where id = p_offer_id;
  elsif p_status = 'Hyväksytty' then
    if offer_row.status not in ('Lähetetty','Luonnos') then
      raise exception 'Tarjous ei ole hyväksyttävissä nykyisestä tilasta.' using errcode = '23514';
    end if;
    update public.offer_versions
    set status = case when id = p_offer_version_id then 'Hyväksytty' else
      case when status in ('Luonnos','Lähetetty') then 'Korvattu' else status end end
    where offer_id = p_offer_id;
    update public.offers
    set status = 'Hyväksytty', accepted_at = now(), rejected_at = null
    where id = p_offer_id;
  elsif p_status = 'Hylätty' then
    update public.offer_versions
    set status = 'Hylätty'
    where id = p_offer_version_id;
    update public.offers
    set status = 'Hylätty', rejected_at = now(), accepted_at = null
    where id = p_offer_id;
  elsif p_status = 'Arkistoitu' then
    update public.offer_versions
    set status = case when status in ('Luonnos','Lähetetty') then 'Arkistoitu' else status end
    where offer_id = p_offer_id;
    update public.offers set status = 'Arkistoitu' where id = p_offer_id;
  elsif p_status = 'Vanhentunut' then
    update public.offers set status = 'Vanhentunut' where id = p_offer_id;
  else
    update public.offers
    set status = 'Luonnos', sent_at = null, accepted_at = null, rejected_at = null
    where id = p_offer_id;
    if p_offer_version_id is not null then
      update public.offer_versions set status = 'Luonnos' where id = p_offer_version_id;
    end if;
  end if;
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
  select * into offer_row
  from public.offers
  where id = p_offer_id
  for update;

  if not found or not private.has_org_role(offer_row.organization_id, array['admin','supervisor']::text[]) then
    raise exception 'not authorized' using errcode = '42501';
  end if;
  if offer_row.status <> 'Hyväksytty' then
    raise exception 'Vain hyväksytty tarjous voidaan muuntaa projektiksi.' using errcode = '23514';
  end if;
  if offer_row.converted_project_id is not null then
    return offer_row.converted_project_id;
  end if;

  select c.name into customer_name
  from public.customers c
  where c.id = offer_row.customer_id
    and c.organization_id = offer_row.organization_id;

  select total_cents / 100.0
  into accepted_total
  from public.offer_versions
  where offer_id = offer_row.id
    and organization_id = offer_row.organization_id
    and status = 'Hyväksytty'
  order by version_number desc
  limit 1;

  if accepted_total is null then
    raise exception 'Hyväksyttyä tarjousversiota ei löydy.' using errcode = '23514';
  end if;

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
    created_by
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
    where id = offer_row.crm_lead_id
      and organization_id = offer_row.organization_id;
  end if;

  return new_project_id;
end;
$$;

revoke all on function public.create_offer(uuid,uuid,uuid,uuid,text,text,date,text) from public, anon;
revoke all on function public.transition_offer(uuid,uuid,text) from public, anon;
revoke all on function public.create_offer_version(uuid) from public, anon;
revoke all on function public.convert_offer_to_project(uuid) from public, anon;
grant execute on function public.create_offer(uuid,uuid,uuid,uuid,text,text,date,text) to authenticated;
grant execute on function public.transition_offer(uuid,uuid,text) to authenticated;
grant execute on function public.create_offer_version(uuid) to authenticated;
grant execute on function public.convert_offer_to_project(uuid) to authenticated;

commit;
