begin;

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
  v_content_hash text;
  v_payload_hash text;
begin
  if new.customer_decision in ('Hyväksytty','Hylätty')
     and old.customer_decision is distinct from new.customer_decision then
    select customer_id into v_customer_id
    from public.projects
    where id = new.project_id;

    select coalesce(jsonb_agg(jsonb_build_object(
      'lineNumber', line_number,
      'category', category,
      'description', description,
      'quantity', quantity,
      'unit', unit,
      'saleUnitPriceCents', sale_unit_price_cents,
      'saleTotalCents', sale_total_cents
    ) order by line_number), '[]'::jsonb)
    into v_lines
    from public.change_order_lines
    where change_order_id = new.id
      and customer_visible;

    v_snapshot := jsonb_build_object(
      'changeOrderId', new.id,
      'changeNumber', new.change_number,
      'title', new.title,
      'description', new.description,
      'amountCents', new.amount_cents,
      'vatRate', new.vat_rate,
      'scheduleEffectDays', new.schedule_effect_days,
      'version', new.customer_version,
      'lines', v_lines,
      'decision', new.customer_decision,
      'decisionSource', new.decision_source,
      'decisionByName', new.approved_by_name,
      'decisionNote', new.customer_decision_note
    );

    v_content_hash := coalesce(new.customer_content_hash, md5(v_snapshot::text));
    v_payload_hash := md5(v_snapshot::text);

    insert into public.customer_portal_decision_snapshots(
      organization_id,
      customer_id,
      project_id,
      subject_type,
      subject_id,
      subject_version,
      decision,
      note,
      decision_note,
      snapshot,
      payload,
      content_hash,
      payload_hash,
      decided_by,
      decided_at
    ) values (
      new.organization_id,
      v_customer_id,
      new.project_id,
      'change_order',
      new.id,
      new.customer_version,
      new.customer_decision,
      new.customer_decision_note,
      new.customer_decision_note,
      v_snapshot,
      v_snapshot,
      v_content_hash,
      v_payload_hash,
      coalesce(new.customer_decided_by, new.manual_decision_recorded_by),
      coalesce(new.customer_decided_at, now())
    )
    on conflict (organization_id, subject_type, subject_id, subject_version) do nothing;
  end if;

  return new;
end;
$$;

commit;
