create or replace function public.audit_workinfo_billing_price()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if new.unit_price_cents is distinct from old.unit_price_cents then
    if new.source_type = 'time_entry' and new.source_id is not null then
      update public.time_entries
      set billing_rate_cents = new.unit_price_cents,
          billing_status = new.status,
          updated_at = now()
      where id = new.source_id and organization_id = new.organization_id;
    elsif new.source_type in ('material', 'equipment') and new.source_id is not null then
      update public.operational_entries
      set unit_cost_cents = new.unit_price_cents,
          updated_at = now()
      where id = new.source_id and organization_id = new.organization_id;
    end if;

    insert into public.audit_logs (organization_id, user_id, action, table_name, record_id, metadata)
    values (
      new.organization_id,
      auth.uid(),
      'billing_price_changed',
      'billing_item',
      new.id,
      jsonb_build_object('from', old.unit_price_cents, 'to', new.unit_price_cents, 'totalExVatCents', new.total_ex_vat_cents)
    );
  end if;
  return new;
end;
$$;
