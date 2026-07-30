begin;

create or replace function private.recalculate_change_order_totals(p_change_order_id uuid)
returns void
language sql
security definer
set search_path = pg_catalog, public
as $$
  update public.change_orders co
  set amount_cents = totals.customer_sale_total,
      cost_cents = totals.cost_total,
      updated_at = now()
  from (
    select co2.id,
      coalesce(sum(line.sale_total_cents) filter (where line.customer_visible), 0)::bigint as customer_sale_total,
      coalesce(sum(line.cost_total_cents), 0)::bigint as cost_total
    from public.change_orders co2
    left join public.change_order_lines line on line.change_order_id = co2.id
    where co2.id = p_change_order_id
    group by co2.id
  ) totals
  where co.id = totals.id
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
  if char_length(btrim(coalesce(p_approved_by_name, ''))) < 2 then
    raise exception 'Tilaajan päättäjän nimi on pakollinen.' using errcode = '23514';
  end if;

  select customer_id into v_customer_id from public.projects where id = v_change.project_id;

  update public.change_orders set
    customer_decision = p_decision,
    customer_decision_note = nullif(btrim(coalesce(p_note,'')),''),
    customer_decided_by = case when p_source='customer_portal' then p_actor else null end,
    customer_decided_at = now(),
    status = p_decision,
    approved_at = case when p_decision='Hyväksytty' then current_date else null end,
    approved_by_name = btrim(p_approved_by_name),
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
    'change_orders',v_change.id,jsonb_build_object(
      'decision',p_decision,
      'source',p_source,
      'version',v_change.customer_version,
      'customer_decision_maker',btrim(p_approved_by_name)
    ));
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
      'lineNumber',line_number,
      'category',category,
      'description',description,
      'quantity',quantity,
      'unit',unit,
      'saleUnitPriceCents',sale_unit_price_cents,
      'saleTotalCents',sale_total_cents
    ) order by line_number),'[]'::jsonb) into v_lines
    from public.change_order_lines where change_order_id=new.id and customer_visible;

    v_snapshot := jsonb_build_object(
      'changeOrderId',new.id,
      'changeNumber',new.change_number,
      'title',new.title,
      'description',new.description,
      'amountCents',new.amount_cents,
      'vatRate',new.vat_rate,
      'scheduleEffectDays',new.schedule_effect_days,
      'version',new.customer_version,
      'lines',v_lines,
      'decision',new.customer_decision,
      'decisionSource',new.decision_source,
      'decisionByName',new.approved_by_name,
      'decisionNote',new.customer_decision_note
    );

    insert into public.customer_portal_decision_snapshots(
      organization_id,customer_id,project_id,subject_type,subject_id,subject_version,decision,note,decision_note,
      snapshot,payload,content_hash,payload_hash,decided_by,decided_at
    ) values (
      new.organization_id,v_customer_id,new.project_id,'change_order',new.id,new.customer_version,new.customer_decision,
      new.customer_decision_note,new.customer_decision_note,v_snapshot,v_snapshot,
      coalesce(new.customer_content_hash,md5(v_snapshot::text)),coalesce(new.customer_content_hash,md5(v_snapshot::text)),
      coalesce(new.customer_decided_by,new.manual_decision_recorded_by),coalesce(new.customer_decided_at,now())
    )
    on conflict (organization_id,subject_type,subject_id,subject_version) do nothing;
  end if;
  return new;
end;
$$;

drop trigger if exists snapshot_customer_change_order_decision on public.change_orders;
create trigger snapshot_customer_change_order_decision
after update of customer_decision on public.change_orders
for each row execute function private.snapshot_customer_change_order_decision();

create or replace function public.save_change_order_draft_v2(
  p_organization_id uuid,p_project_id uuid,p_change_order_id uuid default null,p_title text default null,
  p_description text default null,p_requested_at date default null,p_vat_rate numeric default 25.5,
  p_schedule_effect_days integer default 0,p_lines jsonb default '[]'::jsonb
) returns uuid language sql security definer set search_path=pg_catalog,public,private
as $$ select private.save_change_order_draft_v2($1,$2,$3,$4,$5,$6,$7,$8,$9) $$;

create or replace function public.submit_change_order_to_customer_v2(p_change_order_id uuid)
returns void language sql security definer set search_path=pg_catalog,public,private
as $$ select private.submit_change_order_to_customer_v2($1) $$;

create or replace function public.decide_customer_change_order_v2(p_change_order_id uuid,p_decision text,p_note text default null)
returns void language sql security definer set search_path=pg_catalog,public,private
as $$ select private.decide_customer_change_order_v2($1,$2,$3) $$;

create or replace function public.record_manual_change_order_decision_v2(
  p_change_order_id uuid,p_decision text,p_approved_by_name text,p_evidence_note text
) returns void language sql security definer set search_path=pg_catalog,public,private
as $$ select private.record_manual_change_order_decision_v2($1,$2,$3,$4) $$;

create or replace function public.transition_change_order_execution_v2(p_change_order_id uuid,p_target_status text)
returns void language sql security definer set search_path=pg_catalog,public,private
as $$ select private.transition_change_order_execution_v2($1,$2) $$;

create or replace function public.delete_change_order_draft_v2(p_change_order_id uuid)
returns void language sql security definer set search_path=pg_catalog,public,private
as $$ select private.delete_change_order_draft_v2($1) $$;

create or replace function public.list_management_change_orders_v2(p_organization_id uuid,p_project_id uuid)
returns table(
  id uuid,project_id uuid,change_number text,title text,description text,status text,amount_cents bigint,cost_cents bigint,
  requested_at date,approved_at date,approved_by_name text,customer_decision text,customer_decision_note text,
  submitted_to_customer_at timestamptz,customer_decided_at timestamptz,customer_version integer,vat_rate numeric,
  schedule_effect_days integer,decision_source text,decision_evidence_note text,line_count integer,lines jsonb,
  created_at timestamptz,updated_at timestamptz
) language sql stable security definer set search_path=pg_catalog,public,private
as $$ select * from private.list_management_change_orders_v2($1,$2) $$;

create or replace function public.customer_project_change_orders_v3(p_project_id uuid)
returns table(
  id uuid,project_id uuid,change_number text,title text,description text,status text,amount_cents bigint,requested_at date,
  customer_decision text,customer_decision_note text,submitted_to_customer_at timestamptz,customer_decided_at timestamptz,
  customer_version integer,vat_rate numeric,schedule_effect_days integer,lines jsonb
) language sql stable security definer set search_path=pg_catalog,public,private
as $$ select * from private.customer_project_change_orders_v3($1) $$;

create or replace function public.admin_preview_customer_change_orders_v3(
  p_project_id uuid,p_organization_id uuid,p_customer_ids uuid[],p_project_ids uuid[],p_access_scope text
) returns table(
  id uuid,project_id uuid,change_number text,title text,description text,status text,amount_cents bigint,requested_at date,
  customer_decision text,customer_decision_note text,submitted_to_customer_at timestamptz,customer_decided_at timestamptz,
  customer_version integer,vat_rate numeric,schedule_effect_days integer,lines jsonb
) language sql stable security definer set search_path=pg_catalog,public,private
as $$ select * from private.admin_preview_customer_change_orders_v3($1,$2,$3,$4,$5) $$;

commit;
