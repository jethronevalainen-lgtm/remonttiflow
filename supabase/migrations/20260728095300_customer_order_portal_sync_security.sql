begin;

create or replace function private.sync_customer_order_from_work_order()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  request_row public.customer_work_requests%rowtype;
  next_status text;
  next_progress integer;
begin
  select * into request_row
  from public.customer_work_requests
  where work_order_id = new.id
  for update;

  if request_row.id is null then return new; end if;

  next_status := case new.status
    when 'Avoin' then case when new.planned_start_date is not null then 'Aikataulutettu' else 'Työmääräys luotu' end
    when 'Käynnissä' then 'Käynnissä'
    when 'Odottaa' then 'Odottaa'
    when 'Valmis' then 'Valmis'
    when 'Peruttu' then 'Peruttu'
    else request_row.status
  end;

  next_progress := case next_status
    when 'Työmääräys luotu' then greatest(request_row.progress, 20)
    when 'Aikataulutettu' then greatest(request_row.progress, 30)
    when 'Käynnissä' then greatest(request_row.progress, 60)
    when 'Odottaa' then greatest(request_row.progress, 60)
    when 'Valmis' then 100
    when 'Peruttu' then request_row.progress
    else request_row.progress
  end;

  update public.customer_work_requests
  set status = next_status,
      progress = next_progress,
      planned_start_date = coalesce(new.planned_start_date, planned_start_date),
      planned_end_date = coalesce(new.planned_end_date, new.due_date, planned_end_date),
      completed_at = case when next_status = 'Valmis' then coalesce(new.completed_at, now()) else completed_at end,
      last_activity_at = now()
  where id = request_row.id;

  if request_row.status is distinct from next_status
     or old.planned_start_date is distinct from new.planned_start_date
     or old.planned_end_date is distinct from new.planned_end_date then
    perform private.append_customer_order_event(
      request_row.id,
      'work_order_synced',
      'Työn eteneminen päivittyi',
      case next_status
        when 'Käynnissä' then 'Työ on käynnissä.'
        when 'Odottaa' then 'Työ odottaa seuraavaa vaihetta.'
        when 'Valmis' then 'Työ on valmistunut.'
        when 'Aikataulutettu' then 'Työlle on vahvistettu aikataulu.'
        else 'Työn tiedot päivittyivät.'
      end,
      'customer',
      new.created_by,
      jsonb_build_object(
        'workOrderId', new.id,
        'status', next_status,
        'progress', next_progress,
        'plannedStartDate', new.planned_start_date,
        'plannedEndDate', new.planned_end_date
      )
    );
  end if;

  return new;
end;
$$;

revoke all on function private.sync_customer_order_from_work_order() from public, anon, authenticated;

drop trigger if exists sync_customer_order_from_work_order on public.work_orders;
create trigger sync_customer_order_from_work_order
after update of status, planned_start_date, planned_end_date, due_date, completed_at on public.work_orders
for each row execute function private.sync_customer_order_from_work_order();

create or replace function private.sync_customer_order_assignee_participant()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  request_row public.customer_work_requests%rowtype;
begin
  select * into request_row
  from public.customer_work_requests
  where work_order_id = new.work_order_id;

  if request_row.id is null then return new; end if;

  insert into public.customer_work_request_participants(
    organization_id, request_id, user_id, participant_role,
    can_message, can_manage, can_decide, added_by
  ) values (
    request_row.organization_id, request_row.id, new.user_id, 'worker',
    true, false, false, auth.uid()
  )
  on conflict (request_id, user_id) do update
  set participant_role = 'worker', can_message = true;

  return new;
end;
$$;

revoke all on function private.sync_customer_order_assignee_participant() from public, anon, authenticated;

drop trigger if exists sync_customer_order_assignee_participant on public.work_order_assignees;
create trigger sync_customer_order_assignee_participant
after insert on public.work_order_assignees
for each row execute function private.sync_customer_order_assignee_participant();

create or replace function public.convert_customer_work_request(
  p_request_id uuid,
  p_priority text,
  p_due_date date,
  p_assignment_scope text,
  p_assignee_user_ids uuid[],
  p_supervisor_note text default null
)
returns uuid
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  request_row public.customer_work_requests%rowtype;
  result_work_order_id uuid;
  request_description text;
  assignee_id uuid;
begin
  select * into request_row
  from public.customer_work_requests
  where id = p_request_id
  for update;

  if request_row.id is null then
    raise exception 'Tilausta ei löytynyt.' using errcode = '23503';
  end if;
  if not private.is_operational_manager(request_row.organization_id, auth.uid()) then
    raise exception 'Vain työnjohto voi jakaa tilauksen.' using errcode = '42501';
  end if;
  if request_row.work_order_id is not null then
    raise exception 'Tilauksesta on jo luotu työmääräys.' using errcode = '23505';
  end if;

  request_description := concat_ws(E'\n\n',
    request_row.description,
    nullif('Tarkka sijainti: ' || coalesce(request_row.location_details, ''), 'Tarkka sijainti: '),
    nullif('Pääsyohjeet: ' || coalesce(request_row.access_instructions, ''), 'Pääsyohjeet: '),
    nullif('Turvallisuushuomiot: ' || coalesce(request_row.safety_notes, ''), 'Turvallisuushuomiot: '),
    nullif('Tilaajan yhteyshenkilö: ' || concat_ws(', ', request_row.contact_name, request_row.contact_phone), 'Tilaajan yhteyshenkilö: '),
    nullif('Tilaajan viite: ' || coalesce(request_row.customer_reference, ''), 'Tilaajan viite: '),
    nullif('Ostotilausnumero: ' || coalesce(request_row.purchase_order_number, ''), 'Ostotilausnumero: ')
  );

  result_work_order_id := public.save_work_order(
    request_row.organization_id,
    null,
    request_row.project_id,
    request_row.title,
    p_due_date,
    p_priority,
    'Avoin',
    request_description,
    request_row.category,
    p_assignment_scope,
    coalesce(p_assignee_user_ids, array[]::uuid[])
  );

  update public.customer_work_requests
  set status = case when p_due_date is null then 'Työmääräys luotu' else 'Aikataulutettu' end,
      progress = case when p_due_date is null then 20 else 30 end,
      work_order_id = result_work_order_id,
      planned_end_date = coalesce(p_due_date, planned_end_date),
      supervisor_note = nullif(trim(coalesce(p_supervisor_note, '')), ''),
      assigned_supervisor_id = auth.uid(),
      last_activity_at = now()
  where id = request_row.id;

  insert into public.customer_work_request_participants(
    organization_id, request_id, user_id, participant_role,
    can_message, can_manage, can_decide, added_by
  ) values (
    request_row.organization_id, request_row.id, auth.uid(), 'supervisor',
    true, true, false, auth.uid()
  )
  on conflict (request_id, user_id) do update
  set participant_role = 'supervisor', can_message = true, can_manage = true;

  foreach assignee_id in array coalesce(p_assignee_user_ids, array[]::uuid[])
  loop
    insert into public.customer_work_request_participants(
      organization_id, request_id, user_id, participant_role,
      can_message, can_manage, can_decide, added_by
    ) values (
      request_row.organization_id, request_row.id, assignee_id, 'worker',
      true, false, false, auth.uid()
    )
    on conflict (request_id, user_id) do update
    set participant_role = 'worker', can_message = true;
  end loop;

  perform private.append_customer_order_event(
    request_row.id,
    'work_order_created',
    'Työmääräys luotiin',
    coalesce(nullif(trim(coalesce(p_supervisor_note, '')), ''), 'Työ on vastaanotettu ja siirretty toteutukseen.'),
    'customer',
    auth.uid(),
    jsonb_build_object('workOrderId', result_work_order_id, 'dueDate', p_due_date)
  );

  insert into public.audit_logs(
    organization_id, user_id, action, table_name, record_id, metadata
  ) values (
    request_row.organization_id,
    auth.uid(),
    'customer_work_request_converted',
    'customer_work_requests',
    request_row.id,
    jsonb_build_object('work_order_id', result_work_order_id)
  );

  return result_work_order_id;
end;
$$;

revoke all on function public.convert_customer_work_request(uuid, text, date, text, uuid[], text) from public, anon;
grant execute on function public.convert_customer_work_request(uuid, text, date, text, uuid[], text) to authenticated;

create or replace function private.guard_submitted_change_order_content()
returns trigger
language plpgsql
set search_path = pg_catalog, public
as $$
declare
  next_hash text;
begin
  if tg_op = 'UPDATE'
     and old.submitted_to_customer_at is not null
     and (
       old.title is distinct from new.title
       or old.description is distinct from new.description
       or old.amount_cents is distinct from new.amount_cents
       or old.vat_rate is distinct from new.vat_rate
       or old.schedule_effect_days is distinct from new.schedule_effect_days
     )
     and new.customer_version <= old.customer_version then
    raise exception 'Tilaajalle lähetetyn muutostyön sisältöä ei voi muuttaa ilman uutta versiota.' using errcode = '23514';
  end if;

  next_hash := md5(concat_ws('|',
    new.title,
    new.description,
    new.amount_cents,
    new.vat_rate,
    new.schedule_effect_days,
    new.customer_version
  ));

  new.customer_content_hash := next_hash;
  new.customer_payload_hash := next_hash;
  new.vat_percent := new.vat_rate;
  return new;
end;
$$;

revoke all on function private.guard_submitted_change_order_content() from public, anon, authenticated;

drop trigger if exists guard_submitted_change_order_content on public.change_orders;
create trigger guard_submitted_change_order_content
before insert or update on public.change_orders
for each row execute function private.guard_submitted_change_order_content();

create or replace function private.snapshot_customer_change_order_decision()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_customer_id uuid;
  snapshot_value jsonb;
  snapshot_hash text;
begin
  if new.customer_decision in ('Hyväksytty', 'Hylätty')
     and old.customer_decision is distinct from new.customer_decision
     and new.customer_decided_by is not null then
    select project.customer_id into v_customer_id
    from public.projects project
    where project.id = new.project_id;

    snapshot_value := jsonb_build_object(
      'changeOrderId', new.id,
      'changeNumber', new.change_number,
      'title', new.title,
      'description', new.description,
      'amountCents', new.amount_cents,
      'vatRate', new.vat_rate,
      'scheduleEffectDays', new.schedule_effect_days,
      'version', new.customer_version,
      'submittedToCustomerAt', new.submitted_to_customer_at,
      'decision', new.customer_decision,
      'decisionNote', new.customer_decision_note
    );

    snapshot_hash := coalesce(new.customer_content_hash, md5(snapshot_value::text));

    insert into public.customer_portal_decision_snapshots(
      organization_id, customer_id, project_id, subject_type,
      subject_id, subject_version, decision, note, decision_note,
      snapshot, payload, content_hash, payload_hash, decided_by, decided_at
    ) values (
      new.organization_id, v_customer_id, new.project_id, 'change_order',
      new.id, new.customer_version, new.customer_decision,
      new.customer_decision_note, new.customer_decision_note,
      snapshot_value, snapshot_value, snapshot_hash, snapshot_hash,
      new.customer_decided_by, coalesce(new.customer_decided_at, now())
    );
  end if;

  return new;
end;
$$;

revoke all on function private.snapshot_customer_change_order_decision() from public, anon, authenticated;

drop trigger if exists snapshot_customer_change_order_decision on public.change_orders;
create trigger snapshot_customer_change_order_decision
after update of customer_decision on public.change_orders
for each row execute function private.snapshot_customer_change_order_decision();

insert into storage.buckets(
  id, name, public, file_size_limit, allowed_mime_types
) values (
  'customer-order-files',
  'customer-order-files',
  false,
  10485760,
  array[
    'image/jpeg',
    'image/png',
    'image/webp',
    'application/pdf',
    'text/plain',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
  ]
)
on conflict (id) do update
set public = false,
    file_size_limit = 10485760,
    allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists customer_order_files_insert on storage.objects;
create policy customer_order_files_insert on storage.objects
for insert to authenticated
with check (
  bucket_id = 'customer-order-files'
  and owner_id = (select auth.uid())::text
  and private.customer_can_message_order(
    private.try_uuid((storage.foldername(name))[2]),
    (select auth.uid())
  )
);

drop policy if exists customer_order_files_select on storage.objects;
create policy customer_order_files_select on storage.objects
for select to authenticated
using (
  bucket_id = 'customer-order-files'
  and exists (
    select 1
    from public.customer_work_request_message_attachments attachment
    where attachment.storage_path = objects.name
      and private.customer_can_access_order(attachment.request_id, (select auth.uid()))
  )
);

drop policy if exists customer_order_files_delete on storage.objects;
create policy customer_order_files_delete on storage.objects
for delete to authenticated
using (
  bucket_id = 'customer-order-files'
  and (
    owner_id = (select auth.uid())::text
    or exists (
      select 1
      from public.customer_work_request_message_attachments attachment
      where attachment.storage_path = objects.name
        and private.is_operational_manager(attachment.organization_id, (select auth.uid()))
    )
  )
);

commit;
