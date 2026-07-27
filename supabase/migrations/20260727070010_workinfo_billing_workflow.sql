create or replace function public.sync_workinfo_billing_items(p_organization_id uuid)
returns integer
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  affected_count integer := 0;
  step_count integer := 0;
begin
  if not public.workinfo_is_management_member(p_organization_id) then
    raise exception 'Not authorized';
  end if;

  insert into public.billing_items (
    organization_id,
    customer_id,
    project_id,
    work_order_id,
    source_type,
    source_id,
    description,
    quantity,
    unit,
    unit_price_cents,
    total_ex_vat_cents,
    status,
    approved_by,
    approved_at,
    created_by
  )
  select
    te.organization_id,
    p.customer_id,
    te.project_id,
    te.work_order_id,
    'time_entry',
    te.id,
    coalesce(nullif(trim(te.description), ''), concat('Työaika ', te.employee, ' ', te.date::text)),
    greatest(0, coalesce(te.hours, 0) + coalesce(te.overtime, 0)),
    'h',
    coalesce(te.billing_rate_cents, p.default_billing_rate_cents),
    case
      when coalesce(te.billing_rate_cents, p.default_billing_rate_cents) is null then null
      else round(greatest(0, coalesce(te.hours, 0) + coalesce(te.overtime, 0)) * coalesce(te.billing_rate_cents, p.default_billing_rate_cents))::bigint
    end,
    case
      when te.billable is false then 'rejected'
      when coalesce(te.billing_rate_cents, p.default_billing_rate_cents) is null then 'approved'
      else 'billable'
    end,
    te.approved_by,
    te.approved_at,
    auth.uid()
  from public.time_entries te
  join public.projects p on p.id = te.project_id and p.organization_id = te.organization_id
  where te.organization_id = p_organization_id
    and te.status = 'Hyväksytty'
  on conflict (organization_id, source_type, source_id) where source_id is not null
  do update set
    customer_id = excluded.customer_id,
    project_id = excluded.project_id,
    work_order_id = excluded.work_order_id,
    description = excluded.description,
    quantity = excluded.quantity,
    unit_price_cents = excluded.unit_price_cents,
    total_ex_vat_cents = excluded.total_ex_vat_cents,
    status = case
      when public.billing_items.status in ('queued', 'invoiced', 'credited') then public.billing_items.status
      else excluded.status
    end,
    approved_by = excluded.approved_by,
    approved_at = excluded.approved_at,
    updated_at = now();

  get diagnostics step_count = row_count;
  affected_count := affected_count + step_count;

  insert into public.billing_items (
    organization_id,
    customer_id,
    project_id,
    work_order_id,
    source_type,
    source_id,
    description,
    quantity,
    unit,
    unit_price_cents,
    total_ex_vat_cents,
    status,
    approved_by,
    approved_at,
    created_by
  )
  select
    oe.organization_id,
    p.customer_id,
    oe.project_id,
    oe.work_order_id,
    oe.entry_type,
    oe.id,
    coalesce(nullif(trim(oe.description), ''), oe.title),
    greatest(0, coalesce(oe.quantity, 1)),
    coalesce(nullif(trim(oe.unit), ''), 'kpl'),
    oe.unit_cost_cents,
    case
      when oe.unit_cost_cents is null then null
      else round(greatest(0, coalesce(oe.quantity, 1)) * oe.unit_cost_cents)::bigint
    end,
    case when oe.unit_cost_cents is null then 'approved' else 'billable' end,
    oe.reviewed_by,
    oe.reviewed_at,
    auth.uid()
  from public.operational_entries oe
  join public.projects p on p.id = oe.project_id and p.organization_id = oe.organization_id
  where oe.organization_id = p_organization_id
    and oe.status = 'approved'
    and oe.entry_type in ('material', 'equipment')
  on conflict (organization_id, source_type, source_id) where source_id is not null
  do update set
    customer_id = excluded.customer_id,
    project_id = excluded.project_id,
    work_order_id = excluded.work_order_id,
    description = excluded.description,
    quantity = excluded.quantity,
    unit = excluded.unit,
    unit_price_cents = excluded.unit_price_cents,
    total_ex_vat_cents = excluded.total_ex_vat_cents,
    status = case
      when public.billing_items.status in ('queued', 'invoiced', 'credited') then public.billing_items.status
      else excluded.status
    end,
    approved_by = excluded.approved_by,
    approved_at = excluded.approved_at,
    updated_at = now();

  get diagnostics step_count = row_count;
  affected_count := affected_count + step_count;

  return affected_count;
end;
$$;

create or replace function public.set_workinfo_billing_item_price(
  p_item_id uuid,
  p_unit_price_cents bigint
)
returns public.billing_items
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  current_item public.billing_items;
  next_item public.billing_items;
begin
  select * into current_item from public.billing_items where id = p_item_id for update;
  if current_item.id is null or not public.workinfo_is_management_member(current_item.organization_id) then
    raise exception 'Not authorized';
  end if;
  if p_unit_price_cents < 0 then
    raise exception 'Invalid billing price';
  end if;
  if current_item.status in ('queued', 'invoiced', 'credited') then
    raise exception 'Billing item is locked by its current status';
  end if;

  update public.billing_items
  set unit_price_cents = p_unit_price_cents,
      total_ex_vat_cents = round(quantity * p_unit_price_cents)::bigint,
      status = case when status in ('recorded', 'approved') then 'billable' else status end,
      updated_at = now()
  where id = p_item_id
  returning * into next_item;

  if next_item.source_type = 'time_entry' and next_item.source_id is not null then
    update public.time_entries
    set billing_rate_cents = p_unit_price_cents,
        billing_status = next_item.status,
        updated_at = now()
    where id = next_item.source_id and organization_id = next_item.organization_id;
  end if;

  return next_item;
end;
$$;

create or replace function public.transition_workinfo_billing_item(
  p_item_id uuid,
  p_status text,
  p_invoice_reference text default null
)
returns public.billing_items
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  current_item public.billing_items;
  next_item public.billing_items;
begin
  select * into current_item from public.billing_items where id = p_item_id for update;
  if current_item.id is null or not public.workinfo_is_management_member(current_item.organization_id) then
    raise exception 'Not authorized';
  end if;
  if p_status not in ('approved', 'billable', 'queued', 'invoiced', 'credited', 'rejected') then
    raise exception 'Invalid billing status';
  end if;
  if not (
    (current_item.status = 'recorded' and p_status in ('approved', 'rejected'))
    or (current_item.status = 'approved' and p_status in ('billable', 'rejected'))
    or (current_item.status = 'billable' and p_status in ('queued', 'rejected'))
    or (current_item.status = 'queued' and p_status in ('invoiced', 'rejected'))
    or (current_item.status = 'invoiced' and p_status = 'credited')
  ) then
    raise exception 'Invalid billing status transition';
  end if;
  if p_status in ('billable', 'queued', 'invoiced') and coalesce(current_item.unit_price_cents, 0) <= 0 then
    raise exception 'Billing price is missing';
  end if;
  if p_status = 'invoiced' and nullif(trim(p_invoice_reference), '') is null then
    raise exception 'Invoice reference is required';
  end if;

  update public.billing_items
  set status = p_status,
      invoice_reference = case when p_status = 'invoiced' then trim(p_invoice_reference) else invoice_reference end,
      queued_at = case when p_status = 'queued' then now() else queued_at end,
      invoiced_at = case when p_status = 'invoiced' then now() else invoiced_at end,
      credited_at = case when p_status = 'credited' then now() else credited_at end,
      updated_at = now()
  where id = p_item_id
  returning * into next_item;

  if next_item.source_type = 'time_entry' and next_item.source_id is not null then
    update public.time_entries
    set billing_status = next_item.status,
        invoice_reference = next_item.invoice_reference,
        billed_at = case when next_item.status = 'invoiced' then next_item.invoiced_at else billed_at end,
        updated_at = now()
    where id = next_item.source_id and organization_id = next_item.organization_id;
  end if;

  insert into public.audit_logs (organization_id, user_id, action, table_name, record_id, metadata)
  values (
    next_item.organization_id,
    auth.uid(),
    'billing_status_changed',
    'billing_item',
    next_item.id,
    jsonb_build_object('from', current_item.status, 'to', next_item.status, 'invoiceReference', next_item.invoice_reference)
  );

  return next_item;
end;
$$;

revoke all on function public.sync_workinfo_billing_items(uuid) from public, anon;
revoke all on function public.set_workinfo_billing_item_price(uuid, bigint) from public, anon;
revoke all on function public.transition_workinfo_billing_item(uuid, text, text) from public, anon;
grant execute on function public.sync_workinfo_billing_items(uuid) to authenticated;
grant execute on function public.set_workinfo_billing_item_price(uuid, bigint) to authenticated;
grant execute on function public.transition_workinfo_billing_item(uuid, text, text) to authenticated;
