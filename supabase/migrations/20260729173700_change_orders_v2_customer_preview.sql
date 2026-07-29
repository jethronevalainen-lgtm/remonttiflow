begin;

create or replace function private.admin_preview_customer_change_orders_v3(
  p_project_id uuid,
  p_organization_id uuid,
  p_customer_ids uuid[],
  p_project_ids uuid[],
  p_access_scope text
) returns table(
  id uuid,
  project_id uuid,
  change_number text,
  title text,
  description text,
  status text,
  amount_cents bigint,
  requested_at date,
  customer_decision text,
  customer_decision_note text,
  submitted_to_customer_at timestamptz,
  customer_decided_at timestamptz,
  customer_version integer,
  vat_rate numeric,
  schedule_effect_days integer,
  lines jsonb
)
language plpgsql
stable
security definer
set search_path = pg_catalog, public, private
as $$
begin
  if not private.has_org_role(p_organization_id, array['admin']::text[])
     or not private.admin_preview_project_allowed(
       p_project_id, p_organization_id, p_customer_ids, p_project_ids, p_access_scope
     ) then
    raise exception 'Projektin muutostöihin ei ole esikatseluoikeutta.' using errcode = '42501';
  end if;

  return query
  select
    co.id,
    co.project_id,
    co.change_number,
    co.title,
    co.description,
    co.status,
    co.amount_cents,
    co.requested_at,
    co.customer_decision,
    co.customer_decision_note,
    co.submitted_to_customer_at,
    co.customer_decided_at,
    co.customer_version,
    co.vat_rate,
    co.schedule_effect_days,
    coalesce(jsonb_agg(jsonb_build_object(
      'lineNumber', line.line_number,
      'category', line.category,
      'description', line.description,
      'quantity', line.quantity,
      'unit', line.unit,
      'saleUnitPriceCents', line.sale_unit_price_cents,
      'saleTotalCents', line.sale_total_cents
    ) order by line.line_number) filter (where line.id is not null and line.customer_visible), '[]'::jsonb)
  from public.change_orders co
  left join public.change_order_lines line on line.change_order_id = co.id
  where co.project_id = p_project_id
    and co.organization_id = p_organization_id
    and co.customer_visible = true
  group by co.id
  order by co.submitted_to_customer_at desc nulls last, co.created_at desc;
end;
$$;

create or replace function public.admin_preview_customer_change_orders_v3(
  p_project_id uuid,
  p_organization_id uuid,
  p_customer_ids uuid[],
  p_project_ids uuid[],
  p_access_scope text
) returns table(
  id uuid,
  project_id uuid,
  change_number text,
  title text,
  description text,
  status text,
  amount_cents bigint,
  requested_at date,
  customer_decision text,
  customer_decision_note text,
  submitted_to_customer_at timestamptz,
  customer_decided_at timestamptz,
  customer_version integer,
  vat_rate numeric,
  schedule_effect_days integer,
  lines jsonb
)
language sql
stable
set search_path = pg_catalog, public, private
as $$
  select * from private.admin_preview_customer_change_orders_v3($1,$2,$3,$4,$5)
$$;

revoke all on function private.admin_preview_customer_change_orders_v3(uuid,uuid,uuid[],uuid[],text) from public, anon, authenticated;
revoke all on function public.admin_preview_customer_change_orders_v3(uuid,uuid,uuid[],uuid[],text) from public, anon;
grant execute on function public.admin_preview_customer_change_orders_v3(uuid,uuid,uuid[],uuid[],text) to authenticated;

commit;
