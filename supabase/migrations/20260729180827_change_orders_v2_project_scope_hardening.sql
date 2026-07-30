begin;

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
  if not private.has_org_role(v_change.organization_id, array['admin','supervisor','project_coordinator']::text[])
     or not private.can_access_project(v_change.project_id, v_change.organization_id, auth.uid()) then
    raise exception 'Muutostyön lähettämiseen ei ole projektioikeutta.' using errcode = '42501';
  end if;
  if v_change.status <> 'Luonnos' then raise exception 'Vain luonnoksen voi lähettää.' using errcode = '23514'; end if;

  select count(*), coalesce(string_agg(concat_ws('|',line_number,category,description,quantity,unit,sale_unit_price_cents,sale_total_cents), '||' order by line_number), '')
  into v_count, v_lines
  from public.change_order_lines
  where change_order_id = v_change.id and customer_visible;

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
  if not private.has_org_role(v_change.organization_id,array['admin','supervisor','project_coordinator']::text[])
     or not private.can_access_project(v_change.project_id, v_change.organization_id, auth.uid()) then
    raise exception 'Päätöksen kirjaamiseen ei ole projektioikeutta.' using errcode='42501';
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
  if not private.has_org_role(v_change.organization_id,array['admin','supervisor','project_coordinator']::text[])
     or not private.can_access_project(v_change.project_id, v_change.organization_id, auth.uid()) then
    raise exception 'Muutostyön tilan muuttamiseen ei ole projektioikeutta.' using errcode='42501';
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
  if not private.has_org_role(v_change.organization_id,array['admin','supervisor','project_coordinator']::text[])
     or not private.can_access_project(v_change.project_id, v_change.organization_id, auth.uid()) then
    raise exception 'Muutostyön poistamiseen ei ole projektioikeutta.' using errcode='42501';
  end if;
  if v_change.status <> 'Luonnos' then raise exception 'Vain luonnoksen voi poistaa.' using errcode='23514'; end if;
  delete from public.change_orders where id=v_change.id;
  insert into public.audit_logs(organization_id,user_id,action,table_name,record_id)
  values(v_change.organization_id,auth.uid(),'change_order_draft_deleted','change_orders',v_change.id);
end;
$$;

drop policy if exists change_orders_select on public.change_orders;
create policy change_orders_select on public.change_orders
for select to authenticated
using (private.can_access_project(project_id, organization_id, auth.uid()));

drop policy if exists change_order_lines_management_select on public.change_order_lines;
create policy change_order_lines_management_select on public.change_order_lines
for select to authenticated
using (
  exists (
    select 1
    from public.change_orders co
    where co.id = change_order_id
      and co.organization_id = organization_id
      and private.can_access_project(co.project_id, co.organization_id, auth.uid())
  )
);

commit;
