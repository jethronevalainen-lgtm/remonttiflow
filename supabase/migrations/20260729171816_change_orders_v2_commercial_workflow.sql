begin;

create table public.change_order_counters (
  organization_id uuid not null references public.organizations(id) on delete cascade,
  counter_year integer not null,
  next_value integer not null default 1,
  primary key (organization_id, counter_year),
  check (counter_year between 2020 and 2200),
  check (next_value > 0)
);

create table public.change_order_lines (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  change_order_id uuid not null references public.change_orders(id) on delete cascade,
  line_number integer not null,
  category text not null check (category in ('Työ','Materiaali','Kalusto','Aliurakka','Muu')),
  description text not null check (char_length(btrim(description)) between 2 and 500),
  quantity numeric(12,3) not null check (quantity > 0),
  unit text not null check (char_length(btrim(unit)) between 1 and 30),
  cost_unit_price_cents bigint not null check (cost_unit_price_cents >= 0),
  sale_unit_price_cents bigint not null check (sale_unit_price_cents >= 0),
  cost_total_cents bigint generated always as (round(quantity * cost_unit_price_cents)::bigint) stored,
  sale_total_cents bigint generated always as (round(quantity * sale_unit_price_cents)::bigint) stored,
  customer_visible boolean not null default true,
  created_at timestamptz not null default now(),
  unique (change_order_id, line_number)
);

create index change_order_lines_org_order_idx on public.change_order_lines(organization_id, change_order_id, line_number);
create index change_order_lines_change_order_id_fk_idx on public.change_order_lines(change_order_id);
create unique index change_orders_org_change_number_unique on public.change_orders(organization_id, change_number) where change_number is not null;

alter table public.change_orders
  add column decision_source text,
  add column decision_evidence_note text,
  add column manual_decision_recorded_by uuid references auth.users(id) on delete set null;

alter table public.change_orders drop constraint if exists change_orders_status_check;
alter table public.change_orders add constraint change_orders_status_check
  check (status in ('Luonnos','Lähetetty','Hyväksytty','Hylätty','Toteutuksessa','Valmis'));
alter table public.change_orders add constraint change_orders_decision_source_check
  check (decision_source is null or decision_source in ('customer_portal','manual'));

alter table public.change_order_counters enable row level security;
alter table public.change_order_lines enable row level security;

revoke all on public.change_order_counters, public.change_order_lines, public.change_orders from anon, authenticated;
grant select on public.change_orders, public.change_order_lines to authenticated;

create policy change_order_lines_management_select on public.change_order_lines
for select to authenticated
using (private.has_org_role(organization_id, array['admin','supervisor','project_coordinator']::text[]));

create or replace function private.next_change_order_number(p_organization_id uuid)
returns text
language plpgsql
security definer
set search_path = pg_catalog, public, private
as $$
declare
  v_year integer := extract(year from current_date)::integer;
  v_number integer;
begin
  insert into public.change_order_counters(organization_id, counter_year, next_value)
  values (p_organization_id, v_year, 2)
  on conflict (organization_id, counter_year)
  do update set next_value = public.change_order_counters.next_value + 1
  returning next_value - 1 into v_number;
  return format('MT-%s-%s', v_year, lpad(v_number::text, 4, '0'));
end;
$$;

create or replace function private.guard_change_order_line_draft()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_id uuid := case when tg_op = 'DELETE' then old.change_order_id else new.change_order_id end;
  v_status text;
begin
  select status into v_status from public.change_orders where id = v_id;
  if v_status is distinct from 'Luonnos' then
    raise exception 'Muutostyön rivejä voi muokata vain luonnoksessa.' using errcode = '23514';
  end if;
  if tg_op = 'DELETE' then return old; end if;
  return new;
end;
$$;

create trigger change_order_lines_guard_draft
before insert or update or delete on public.change_order_lines
for each row execute function private.guard_change_order_line_draft();

create or replace function private.validate_change_order_state()
returns trigger
language plpgsql
set search_path = pg_catalog, public
as $$
begin
  if new.status = 'Luonnos' and (new.customer_decision is not null or new.customer_visible) then
    raise exception 'Luonnoksella ei voi olla tilaajapäätöstä.' using errcode = '23514';
  end if;
  if new.status = 'Lähetetty' and (new.customer_decision is distinct from 'Odottaa' or not new.customer_visible or new.submitted_to_customer_at is null) then
    raise exception 'Lähetetyn muutostyön tilaajatiedot ovat puutteelliset.' using errcode = '23514';
  end if;
  if new.status = 'Hylätty' and new.customer_decision is distinct from 'Hylätty' then
    raise exception 'Hylätyltä muutostyöltä puuttuu tilaajan päätös.' using errcode = '23514';
  end if;
  if new.status in ('Hyväksytty','Toteutuksessa','Valmis')
     and (new.customer_decision is distinct from 'Hyväksytty' or new.approved_at is null) then
    raise exception 'Muutostyön toteutus edellyttää tilaajan hyväksyntää.' using errcode = '23514';
  end if;
  return new;
end;
$$;

create trigger validate_change_order_state
before insert or update on public.change_orders
for each row execute function private.validate_change_order_state();

create or replace function private.recalculate_change_order_totals(p_change_order_id uuid)
returns void
language sql
security definer
set search_path = pg_catalog, public
as $$
  update public.change_orders co
  set amount_cents = totals.sale_total,
      cost_cents = totals.cost_total,
      updated_at = now()
  from (
    select co2.id,
      coalesce(sum(line.sale_total_cents), 0)::bigint sale_total,
      coalesce(sum(line.cost_total_cents), 0)::bigint cost_total
    from public.change_orders co2
    left join public.change_order_lines line on line.change_order_id = co2.id
    where co2.id = p_change_order_id
    group by co2.id
  ) totals
  where co.id = totals.id
$$;

create or replace function private.save_change_order_draft_v2(
  p_organization_id uuid,
  p_project_id uuid,
  p_change_order_id uuid,
  p_title text,
  p_description text,
  p_requested_at date,
  p_vat_rate numeric,
  p_schedule_effect_days integer,
  p_lines jsonb
) returns uuid
language plpgsql
security definer
set search_path = pg_catalog, public, private
as $$
declare
  v_change public.change_orders%rowtype;
  v_id uuid;
  v_item jsonb;
  v_number integer := 0;
  v_category text;
  v_description text;
  v_quantity numeric;
  v_unit text;
  v_cost bigint;
  v_sale bigint;
begin
  if not private.has_org_role(p_organization_id, array['admin','supervisor','project_coordinator']::text[])
     or not private.can_access_project(p_project_id, p_organization_id, auth.uid()) then
    raise exception 'Muutostyön muokkaukseen ei ole oikeutta.' using errcode = '42501';
  end if;
  if char_length(btrim(coalesce(p_title, ''))) < 2 then
    raise exception 'Muutostyön otsikko on pakollinen.' using errcode = '23514';
  end if;
  if p_vat_rate is null or p_vat_rate < 0 or p_vat_rate > 100 then
    raise exception 'Arvonlisävero on virheellinen.' using errcode = '23514';
  end if;
  if p_schedule_effect_days is null or p_schedule_effect_days < -3650 or p_schedule_effect_days > 3650 then
    raise exception 'Aikatauluvaikutus on virheellinen.' using errcode = '23514';
  end if;
  if jsonb_typeof(p_lines) <> 'array' or jsonb_array_length(p_lines) = 0 then
    raise exception 'Lisää vähintään yksi hinnoittelurivi.' using errcode = '23514';
  end if;

  if p_change_order_id is null then
    insert into public.change_orders(
      organization_id, project_id, change_number, title, description, status,
      amount_cents, cost_cents, requested_at, created_by, customer_visible,
      customer_decision, customer_version, vat_rate, vat_percent, schedule_effect_days
    ) values (
      p_organization_id, p_project_id, private.next_change_order_number(p_organization_id),
      btrim(p_title), nullif(btrim(coalesce(p_description, '')), ''), 'Luonnos',
      0, 0, p_requested_at, auth.uid(), false, null, 1, p_vat_rate, p_vat_rate, p_schedule_effect_days
    ) returning id into v_id;
  else
    select * into v_change from public.change_orders
    where id = p_change_order_id and organization_id = p_organization_id and project_id = p_project_id
    for update;
    if v_change.id is null then raise exception 'Muutostyötä ei löytynyt.' using errcode = 'P0002'; end if;
    if v_change.status not in ('Luonnos','Hylätty') then
      raise exception 'Vain luonnosta tai hylättyä muutostyötä voi muokata.' using errcode = '23514';
    end if;
    v_id := v_change.id;
    update public.change_orders set
      title = btrim(p_title), description = nullif(btrim(coalesce(p_description, '')), ''),
      requested_at = p_requested_at, vat_rate = p_vat_rate, vat_percent = p_vat_rate,
      schedule_effect_days = p_schedule_effect_days, status = 'Luonnos',
      customer_visible = false, customer_decision = null, customer_decision_note = null,
      customer_decided_by = null, customer_decided_at = null, submitted_to_customer_at = null,
      approved_at = null, approved_by_name = null, decision_source = null,
      decision_evidence_note = null, manual_decision_recorded_by = null,
      customer_version = case when v_change.status = 'Hylätty' then v_change.customer_version + 1 else v_change.customer_version end,
      updated_at = now()
    where id = v_id;
    delete from public.change_order_lines where change_order_id = v_id;
  end if;

  for v_item in select value from jsonb_array_elements(p_lines)
  loop
    v_number := v_number + 1;
    v_category := coalesce(nullif(btrim(v_item->>'category'), ''), 'Muu');
    v_description := btrim(coalesce(v_item->>'description', ''));
    v_quantity := nullif(v_item->>'quantity', '')::numeric;
    v_unit := coalesce(nullif(btrim(v_item->>'unit'), ''), 'kpl');
    v_cost := nullif(v_item->>'costUnitPriceCents', '')::bigint;
    v_sale := nullif(v_item->>'saleUnitPriceCents', '')::bigint;
    if v_category not in ('Työ','Materiaali','Kalusto','Aliurakka','Muu')
       or char_length(v_description) < 2 or v_quantity is null or v_quantity <= 0
       or v_cost is null or v_cost < 0 or v_sale is null or v_sale < 0 then
      raise exception 'Hinnoittelurivi % on virheellinen.', v_number using errcode = '23514';
    end if;
    insert into public.change_order_lines(
      organization_id, change_order_id, line_number, category, description, quantity, unit,
      cost_unit_price_cents, sale_unit_price_cents, customer_visible
    ) values (
      p_organization_id, v_id, v_number, v_category, v_description, v_quantity, v_unit,
      v_cost, v_sale, coalesce((v_item->>'customerVisible')::boolean, true)
    );
  end loop;

  perform private.recalculate_change_order_totals(v_id);
  insert into public.audit_logs(organization_id, user_id, action, table_name, record_id, metadata)
  values (p_organization_id, auth.uid(), 'change_order_draft_saved', 'change_orders', v_id, jsonb_build_object('line_count', v_number));
  return v_id;
end;
$$;

create or replace function private.submit_change_order_to_customer_v2(p_change_order_id uuid)
returns void
language plpgsql
security definer
set search_path = pg_catalog, public, private
as $$
declare
  v_change public.change_orders%rowtype;
  v_count integer;
  v_lines text;
  v_hash text;
begin
  select * into v_change from public.change_orders where id = p_change_order_id for update;
  if v_change.id is null then raise exception 'Muutostyötä ei löytynyt.' using errcode = 'P0002'; end if;
  if not private.has_org_role(v_change.organization_id, array['admin','supervisor','project_coordinator']::text[]) then
    raise exception 'Vain työnjohto voi lähettää muutostyön tilaajalle.' using errcode = '42501';
  end if;
  if v_change.status <> 'Luonnos' then raise exception 'Vain luonnoksen voi lähettää.' using errcode = '23514'; end if;
  select count(*), coalesce(string_agg(concat_ws('|',line_number,category,description,quantity,unit,sale_unit_price_cents,sale_total_cents), '||' order by line_number), '')
  into v_count, v_lines from public.change_order_lines where change_order_id = v_change.id and customer_visible;
  if v_count = 0 or v_change.amount_cents <= 0 then
    raise exception 'Muutostyöllä pitää olla myyntihinnallinen tilaajalle näkyvä rivi.' using errcode = '23514';
  end if;
  v_hash := md5(concat_ws('|',v_change.id,v_change.customer_version,v_change.title,v_change.description,v_change.amount_cents,v_change.vat_rate,v_change.schedule_effect_days,v_lines));
  update public.change_orders set
    status = 'Lähetetty', customer_visible = true, customer_decision = 'Odottaa',
    customer_decision_note = null, customer_decided_by = null, customer_decided_at = null,
    submitted_to_customer_at = now(), approved_at = null, approved_by_name = null,
    decision_source = null, decision_evidence_note = null, manual_decision_recorded_by = null,
    customer_content_hash = v_hash, customer_payload_hash = v_hash, updated_at = now()
  where id = v_change.id;
  insert into public.audit_logs(organization_id,user_id,action,table_name,record_id,metadata)
  values(v_change.organization_id,auth.uid(),'change_order_sent_to_customer','change_orders',v_change.id,
    jsonb_build_object('version',v_change.customer_version,'content_hash',v_hash));
end;
$$;

create or replace function private.apply_change_order_decision_v2(
  p_change_order_id uuid,
  p_decision text,
  p_note text,
  p_source text,
  p_approved_by_name text,
  p_actor uuid
) returns void
language plpgsql
security definer
set search_path = pg_catalog, public, private
as $$
declare
  v_change public.change_orders%rowtype;
  v_customer_id uuid;
begin
  select * into v_change from public.change_orders where id = p_change_order_id for update;
  if v_change.id is null then raise exception 'Muutostyötä ei löytynyt.' using errcode = 'P0002'; end if;
  if v_change.status <> 'Lähetetty' or v_change.customer_decision <> 'Odottaa' then
    raise exception 'Muutostyö ei odota tilaajan päätöstä.' using errcode = '23514';
  end if;
  if p_decision not in ('Hyväksytty','Hylätty') or p_source not in ('customer_portal','manual') then
    raise exception 'Virheellinen tilaajapäätös.' using errcode = '23514';
  end if;
  select customer_id into v_customer_id from public.projects where id = v_change.project_id;
  update public.change_orders set
    customer_decision = p_decision,
    customer_decision_note = nullif(btrim(coalesce(p_note,'')),''),
    customer_decided_by = case when p_source='customer_portal' then p_actor else null end,
    customer_decided_at = now(), status = p_decision,
    approved_at = case when p_decision='Hyväksytty' then current_date else null end,
    approved_by_name = case when p_decision='Hyväksytty' then nullif(btrim(coalesce(p_approved_by_name,'')),'') else null end,
    decision_source = p_source,
    decision_evidence_note = case when p_source='manual' then nullif(btrim(coalesce(p_note,'')),'') else null end,
    manual_decision_recorded_by = case when p_source='manual' then p_actor else null end,
    updated_at = now()
  where id = v_change.id;
  if p_decision = 'Hyväksytty' then
    insert into public.billing_items(
      organization_id,customer_id,project_id,source_type,source_id,description,quantity,unit,
      unit_price_cents,vat_rate,total_ex_vat_cents,status,created_by
    ) values (
      v_change.organization_id,v_customer_id,v_change.project_id,'change_order',v_change.id,
      concat_ws(' ',v_change.change_number,v_change.title),1,'kpl',v_change.amount_cents,v_change.vat_rate,
      v_change.amount_cents,'billable',p_actor
    )
    on conflict (organization_id,source_type,source_id) where source_id is not null do nothing;
  end if;
  insert into public.audit_logs(organization_id,user_id,action,table_name,record_id,metadata)
  values(v_change.organization_id,p_actor,
    case when p_source='manual' then 'change_order_manual_decision' else 'customer_change_order_decision' end,
    'change_orders',v_change.id,jsonb_build_object('decision',p_decision,'source',p_source,'version',v_change.customer_version));
end;
$$;

create or replace function private.decide_customer_change_order_v2(p_change_order_id uuid,p_decision text,p_note text default null)
returns void
language plpgsql
security definer
set search_path = pg_catalog, public, private
as $$
declare
  v_change public.change_orders%rowtype;
  v_name text;
begin
  select * into v_change from public.change_orders where id=p_change_order_id;
  if v_change.id is null or not v_change.customer_visible then raise exception 'Muutostyötä ei löytynyt.' using errcode='P0002'; end if;
  if not private.is_customer_project_user(v_change.project_id,v_change.organization_id,auth.uid()) then
    raise exception 'Muutostyön käsittelyyn ei ole oikeutta.' using errcode='42501';
  end if;
  select coalesce(nullif(full_name,''),nullif(email,''),'Tilaaja') into v_name from public.profiles where id=auth.uid();
  perform private.apply_change_order_decision_v2(p_change_order_id,p_decision,p_note,'customer_portal',v_name,auth.uid());
end;
$$;

create or replace function private.record_manual_change_order_decision_v2(
  p_change_order_id uuid,p_decision text,p_approved_by_name text,p_evidence_note text
) returns void
language plpgsql
security definer
set search_path = pg_catalog, public, private
as $$
declare v_change public.change_orders%rowtype;
begin
  select * into v_change from public.change_orders where id=p_change_order_id;
  if v_change.id is null then raise exception 'Muutostyötä ei löytynyt.' using errcode='P0002'; end if;
  if not private.has_org_role(v_change.organization_id,array['admin','supervisor','project_coordinator']::text[]) then
    raise exception 'Päätöksen kirjaamiseen ei ole oikeutta.' using errcode='42501';
  end if;
  if char_length(btrim(coalesce(p_approved_by_name,''))) < 2 or char_length(btrim(coalesce(p_evidence_note,''))) < 5 then
    raise exception 'Hyväksyjän nimi ja päätöksen todiste ovat pakollisia.' using errcode='23514';
  end if;
  perform private.apply_change_order_decision_v2(p_change_order_id,p_decision,p_evidence_note,'manual',p_approved_by_name,auth.uid());
end;
$$;

create or replace function private.transition_change_order_execution_v2(p_change_order_id uuid,p_target_status text)
returns void
language plpgsql
security definer
set search_path = pg_catalog, public, private
as $$
declare v_change public.change_orders%rowtype;
begin
  select * into v_change from public.change_orders where id=p_change_order_id for update;
  if v_change.id is null then raise exception 'Muutostyötä ei löytynyt.' using errcode='P0002'; end if;
  if not private.has_org_role(v_change.organization_id,array['admin','supervisor','project_coordinator']::text[]) then
    raise exception 'Muutostyön tilan muuttamiseen ei ole oikeutta.' using errcode='42501';
  end if;
  if not ((v_change.status='Hyväksytty' and p_target_status='Toteutuksessa') or (v_change.status='Toteutuksessa' and p_target_status='Valmis')) then
    raise exception 'Muutostyön tilasiirtymä ei ole sallittu.' using errcode='23514';
  end if;
  update public.change_orders set status=p_target_status,updated_at=now() where id=v_change.id;
  insert into public.audit_logs(organization_id,user_id,action,table_name,record_id,metadata)
  values(v_change.organization_id,auth.uid(),'change_order_execution_transition','change_orders',v_change.id,
    jsonb_build_object('from_status',v_change.status,'to_status',p_target_status));
end;
$$;

create or replace function private.delete_change_order_draft_v2(p_change_order_id uuid)
returns void
language plpgsql
security definer
set search_path = pg_catalog, public, private
as $$
declare v_change public.change_orders%rowtype;
begin
  select * into v_change from public.change_orders where id=p_change_order_id for update;
  if v_change.id is null then raise exception 'Muutostyötä ei löytynyt.' using errcode='P0002'; end if;
  if not private.has_org_role(v_change.organization_id,array['admin','supervisor','project_coordinator']::text[]) then
    raise exception 'Muutostyön poistamiseen ei ole oikeutta.' using errcode='42501';
  end if;
  if v_change.status <> 'Luonnos' then raise exception 'Vain luonnoksen voi poistaa.' using errcode='23514'; end if;
  delete from public.change_orders where id=v_change.id;
  insert into public.audit_logs(organization_id,user_id,action,table_name,record_id)
  values(v_change.organization_id,auth.uid(),'change_order_draft_deleted','change_orders',v_change.id);
end;
$$;

create or replace function private.snapshot_customer_change_order_decision()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_customer_id uuid;
  v_lines jsonb;
  v_snapshot jsonb;
begin
  if new.customer_decision in ('Hyväksytty','Hylätty') and old.customer_decision is distinct from new.customer_decision then
    select customer_id into v_customer_id from public.projects where id=new.project_id;
    select coalesce(jsonb_agg(jsonb_build_object(
      'lineNumber',line_number,'category',category,'description',description,'quantity',quantity,'unit',unit,
      'saleUnitPriceCents',sale_unit_price_cents,'saleTotalCents',sale_total_cents
    ) order by line_number),'[]'::jsonb) into v_lines
    from public.change_order_lines where change_order_id=new.id and customer_visible;
    v_snapshot := jsonb_build_object(
      'changeOrderId',new.id,'changeNumber',new.change_number,'title',new.title,'description',new.description,
      'amountCents',new.amount_cents,'vatRate',new.vat_rate,'scheduleEffectDays',new.schedule_effect_days,
      'version',new.customer_version,'lines',v_lines,'decision',new.customer_decision,
      'decisionSource',new.decision_source,'decisionNote',new.customer_decision_note
    );
    insert into public.customer_portal_decision_snapshots(
      organization_id,customer_id,project_id,subject_type,subject_id,subject_version,decision,note,decision_note,
      snapshot,payload,content_hash,payload_hash,decided_by,decided_at
    ) values (
      new.organization_id,v_customer_id,new.project_id,'change_order',new.id,new.customer_version,new.customer_decision,
      new.customer_decision_note,new.customer_decision_note,v_snapshot,v_snapshot,
      coalesce(new.customer_content_hash,md5(v_snapshot::text)),coalesce(new.customer_content_hash,md5(v_snapshot::text)),
      coalesce(new.customer_decided_by,new.manual_decision_recorded_by),coalesce(new.customer_decided_at,now())
    );
  end if;
  return new;
end;
$$;

create or replace function private.list_management_change_orders_v2(p_organization_id uuid,p_project_id uuid)
returns table(
  id uuid,project_id uuid,change_number text,title text,description text,status text,amount_cents bigint,cost_cents bigint,
  requested_at date,approved_at date,approved_by_name text,customer_decision text,customer_decision_note text,
  submitted_to_customer_at timestamptz,customer_decided_at timestamptz,customer_version integer,vat_rate numeric,
  schedule_effect_days integer,decision_source text,decision_evidence_note text,line_count integer,lines jsonb,
  created_at timestamptz,updated_at timestamptz
)
language plpgsql
stable
security definer
set search_path = pg_catalog, public, private
as $$
begin
  if not private.has_org_role(p_organization_id,array['admin','supervisor','project_coordinator']::text[])
     or not private.can_access_project(p_project_id,p_organization_id,auth.uid()) then
    raise exception 'Muutostöihin ei ole käyttöoikeutta.' using errcode='42501';
  end if;
  return query select
    co.id,co.project_id,co.change_number,co.title,co.description,co.status,co.amount_cents,co.cost_cents,
    co.requested_at,co.approved_at,co.approved_by_name,co.customer_decision,co.customer_decision_note,
    co.submitted_to_customer_at,co.customer_decided_at,co.customer_version,co.vat_rate,co.schedule_effect_days,
    co.decision_source,co.decision_evidence_note,count(line.id)::integer,
    coalesce(jsonb_agg(jsonb_build_object(
      'id',line.id,'lineNumber',line.line_number,'category',line.category,'description',line.description,
      'quantity',line.quantity,'unit',line.unit,'costUnitPriceCents',line.cost_unit_price_cents,
      'saleUnitPriceCents',line.sale_unit_price_cents,'costTotalCents',line.cost_total_cents,
      'saleTotalCents',line.sale_total_cents,'customerVisible',line.customer_visible
    ) order by line.line_number) filter(where line.id is not null),'[]'::jsonb),co.created_at,co.updated_at
  from public.change_orders co left join public.change_order_lines line on line.change_order_id=co.id
  where co.organization_id=p_organization_id and co.project_id=p_project_id
  group by co.id order by co.created_at desc;
end;
$$;

create or replace function private.customer_project_change_orders_v3(p_project_id uuid)
returns table(
  id uuid,project_id uuid,change_number text,title text,description text,status text,amount_cents bigint,requested_at date,
  customer_decision text,customer_decision_note text,submitted_to_customer_at timestamptz,customer_decided_at timestamptz,
  customer_version integer,vat_rate numeric,schedule_effect_days integer,lines jsonb
)
language plpgsql
stable
security definer
set search_path = pg_catalog, public, private
as $$
declare v_project public.projects%rowtype;
begin
  select * into v_project from public.projects where id=p_project_id;
  if v_project.id is null or not private.is_customer_project_user(v_project.id,v_project.organization_id,auth.uid()) then
    raise exception 'Projektin muutostöihin ei ole käyttöoikeutta.' using errcode='42501';
  end if;
  return query select
    co.id,co.project_id,co.change_number,co.title,co.description,co.status,co.amount_cents,co.requested_at,
    co.customer_decision,co.customer_decision_note,co.submitted_to_customer_at,co.customer_decided_at,
    co.customer_version,co.vat_rate,co.schedule_effect_days,
    coalesce(jsonb_agg(jsonb_build_object(
      'lineNumber',line.line_number,'category',line.category,'description',line.description,
      'quantity',line.quantity,'unit',line.unit,'saleUnitPriceCents',line.sale_unit_price_cents,
      'saleTotalCents',line.sale_total_cents
    ) order by line.line_number) filter(where line.id is not null and line.customer_visible),'[]'::jsonb)
  from public.change_orders co left join public.change_order_lines line on line.change_order_id=co.id
  where co.project_id=v_project.id and co.organization_id=v_project.organization_id and co.customer_visible
  group by co.id order by co.submitted_to_customer_at desc nulls last,co.created_at desc;
end;
$$;

create or replace function public.save_change_order_draft_v2(
  p_organization_id uuid,p_project_id uuid,p_change_order_id uuid default null,p_title text default null,
  p_description text default null,p_requested_at date default null,p_vat_rate numeric default 25.5,
  p_schedule_effect_days integer default 0,p_lines jsonb default '[]'::jsonb
) returns uuid language sql set search_path=pg_catalog,public,private
as $$ select private.save_change_order_draft_v2($1,$2,$3,$4,$5,$6,$7,$8,$9) $$;
create or replace function public.submit_change_order_to_customer_v2(p_change_order_id uuid)
returns void language sql set search_path=pg_catalog,public,private as $$ select private.submit_change_order_to_customer_v2($1) $$;
create or replace function public.decide_customer_change_order_v2(p_change_order_id uuid,p_decision text,p_note text default null)
returns void language sql set search_path=pg_catalog,public,private as $$ select private.decide_customer_change_order_v2($1,$2,$3) $$;
create or replace function public.record_manual_change_order_decision_v2(p_change_order_id uuid,p_decision text,p_approved_by_name text,p_evidence_note text)
returns void language sql set search_path=pg_catalog,public,private as $$ select private.record_manual_change_order_decision_v2($1,$2,$3,$4) $$;
create or replace function public.transition_change_order_execution_v2(p_change_order_id uuid,p_target_status text)
returns void language sql set search_path=pg_catalog,public,private as $$ select private.transition_change_order_execution_v2($1,$2) $$;
create or replace function public.delete_change_order_draft_v2(p_change_order_id uuid)
returns void language sql set search_path=pg_catalog,public,private as $$ select private.delete_change_order_draft_v2($1) $$;
create or replace function public.list_management_change_orders_v2(p_organization_id uuid,p_project_id uuid)
returns table(
  id uuid,project_id uuid,change_number text,title text,description text,status text,amount_cents bigint,cost_cents bigint,
  requested_at date,approved_at date,approved_by_name text,customer_decision text,customer_decision_note text,
  submitted_to_customer_at timestamptz,customer_decided_at timestamptz,customer_version integer,vat_rate numeric,
  schedule_effect_days integer,decision_source text,decision_evidence_note text,line_count integer,lines jsonb,
  created_at timestamptz,updated_at timestamptz
) language sql stable set search_path=pg_catalog,public,private as $$ select * from private.list_management_change_orders_v2($1,$2) $$;
create or replace function public.customer_project_change_orders_v3(p_project_id uuid)
returns table(
  id uuid,project_id uuid,change_number text,title text,description text,status text,amount_cents bigint,requested_at date,
  customer_decision text,customer_decision_note text,submitted_to_customer_at timestamptz,customer_decided_at timestamptz,
  customer_version integer,vat_rate numeric,schedule_effect_days integer,lines jsonb
) language sql stable set search_path=pg_catalog,public,private as $$ select * from private.customer_project_change_orders_v3($1) $$;

revoke all on function private.next_change_order_number(uuid) from public,anon,authenticated;
revoke all on function private.guard_change_order_line_draft() from public,anon,authenticated;
revoke all on function private.recalculate_change_order_totals(uuid) from public,anon,authenticated;
revoke all on function private.save_change_order_draft_v2(uuid,uuid,uuid,text,text,date,numeric,integer,jsonb) from public,anon,authenticated;
revoke all on function private.submit_change_order_to_customer_v2(uuid) from public,anon,authenticated;
revoke all on function private.apply_change_order_decision_v2(uuid,text,text,text,text,uuid) from public,anon,authenticated;
revoke all on function private.decide_customer_change_order_v2(uuid,text,text) from public,anon,authenticated;
revoke all on function private.record_manual_change_order_decision_v2(uuid,text,text,text) from public,anon,authenticated;
revoke all on function private.transition_change_order_execution_v2(uuid,text) from public,anon,authenticated;
revoke all on function private.delete_change_order_draft_v2(uuid) from public,anon,authenticated;
revoke all on function private.snapshot_customer_change_order_decision() from public,anon,authenticated;
revoke all on function private.list_management_change_orders_v2(uuid,uuid) from public,anon,authenticated;
revoke all on function private.customer_project_change_orders_v3(uuid) from public,anon,authenticated;

revoke all on function public.save_change_order_draft_v2(uuid,uuid,uuid,text,text,date,numeric,integer,jsonb) from public,anon;
revoke all on function public.submit_change_order_to_customer_v2(uuid) from public,anon;
revoke all on function public.decide_customer_change_order_v2(uuid,text,text) from public,anon;
revoke all on function public.record_manual_change_order_decision_v2(uuid,text,text,text) from public,anon;
revoke all on function public.transition_change_order_execution_v2(uuid,text) from public,anon;
revoke all on function public.delete_change_order_draft_v2(uuid) from public,anon;
revoke all on function public.list_management_change_orders_v2(uuid,uuid) from public,anon;
revoke all on function public.customer_project_change_orders_v3(uuid) from public,anon;

grant execute on function public.save_change_order_draft_v2(uuid,uuid,uuid,text,text,date,numeric,integer,jsonb) to authenticated;
grant execute on function public.submit_change_order_to_customer_v2(uuid) to authenticated;
grant execute on function public.decide_customer_change_order_v2(uuid,text,text) to authenticated;
grant execute on function public.record_manual_change_order_decision_v2(uuid,text,text,text) to authenticated;
grant execute on function public.transition_change_order_execution_v2(uuid,text) to authenticated;
grant execute on function public.delete_change_order_draft_v2(uuid) to authenticated;
grant execute on function public.list_management_change_orders_v2(uuid,uuid) to authenticated;
grant execute on function public.customer_project_change_orders_v3(uuid) to authenticated;

commit;
