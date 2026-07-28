begin;

-- Remove the short-lived duplicate order-detail implementation. The canonical
-- customer portal uses customer_work_requests and its related collaboration tables.
drop trigger if exists project_requests_customer_order_event_trg on public.project_requests;
drop function if exists public.customer_order_context(uuid, uuid);
drop function if exists public.customer_order_messages(uuid, uuid);
drop function if exists public.customer_order_events(uuid, uuid);
drop function if exists public.customer_order_participants(uuid, uuid);
drop function if exists public.post_customer_order_message(uuid, uuid, text);
drop function if exists public.publish_customer_order_event(uuid, uuid, text, text, integer);
drop function if exists private.can_access_customer_order(uuid, uuid, uuid);
drop function if exists private.log_customer_order_status_event();
drop table if exists public.customer_order_messages cascade;
drop table if exists public.customer_order_events cascade;

-- Explicitly named order participants must be able to open the order workspace.
-- Administrative access remains available without making every manager visible
-- as a participant to the customer.
create or replace function private.customer_can_access_order(
  p_request_id uuid,
  p_user_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = pg_catalog, public
as $$
  select exists (
    select 1
    from public.customer_work_requests request
    where request.id = p_request_id
      and (
        private.is_operational_manager(request.organization_id, p_user_id)
        or private.customer_user_can_access_project(request.project_id, request.organization_id, p_user_id)
        or exists (
          select 1
          from public.customer_work_request_participants participant
          join public.organization_members member
            on member.organization_id = request.organization_id
           and member.user_id = participant.user_id
          where participant.request_id = request.id
            and participant.user_id = p_user_id
        )
      )
  );
$$;

revoke all on function private.customer_can_access_order(uuid, uuid) from public, anon, authenticated;
grant execute on function private.customer_can_access_order(uuid, uuid) to service_role;

-- Keep the canonical participant list synchronized when a work-order assignee
-- is added or removed. Removing an assignee does not remove a participant that
-- still has another assignment to the same linked work order.
create or replace function private.sync_customer_order_assignee_participant()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  request_row public.customer_work_requests%rowtype;
  target_work_order_id uuid := case when tg_op = 'DELETE' then old.work_order_id else new.work_order_id end;
  target_user_id uuid := case when tg_op = 'DELETE' then old.user_id else new.user_id end;
begin
  select * into request_row
  from public.customer_work_requests
  where work_order_id = target_work_order_id;

  if request_row.id is null then
    return case when tg_op = 'DELETE' then old else new end;
  end if;

  if tg_op = 'DELETE' then
    if not exists (
      select 1
      from public.work_order_assignees assignee
      where assignee.organization_id = request_row.organization_id
        and assignee.work_order_id = target_work_order_id
        and assignee.user_id = target_user_id
    ) then
      delete from public.customer_work_request_participants participant
      where participant.request_id = request_row.id
        and participant.user_id = target_user_id
        and participant.participant_role = 'worker'
        and not participant.can_manage
        and not participant.can_decide;
    end if;
    return old;
  end if;

  insert into public.customer_work_request_participants(
    organization_id, request_id, user_id, participant_role,
    can_message, can_manage, can_decide, added_by
  ) values (
    request_row.organization_id, request_row.id, target_user_id, 'worker',
    true, false, false, auth.uid()
  )
  on conflict (request_id, user_id) do update
  set participant_role = 'worker', can_message = true;

  return new;
end;
$$;

drop trigger if exists sync_customer_order_assignee_participant on public.work_order_assignees;
create trigger sync_customer_order_assignee_participant
after insert or delete on public.work_order_assignees
for each row execute function private.sync_customer_order_assignee_participant();

-- Backfill explicit participants for orders created before this consolidation.
insert into public.customer_work_request_participants(
  organization_id, request_id, user_id, participant_role,
  can_message, can_manage, can_decide, added_by
)
select
  request.organization_id,
  request.id,
  request.created_by,
  'customer_contact',
  true,
  false,
  false,
  request.created_by
from public.customer_work_requests request
on conflict (request_id, user_id) do nothing;

insert into public.customer_work_request_participants(
  organization_id, request_id, user_id, participant_role,
  can_message, can_manage, can_decide, added_by
)
select
  request.organization_id,
  request.id,
  request.assigned_supervisor_id,
  'supervisor',
  true,
  true,
  false,
  request.assigned_supervisor_id
from public.customer_work_requests request
where request.assigned_supervisor_id is not null
on conflict (request_id, user_id) do update
set participant_role = 'supervisor', can_message = true, can_manage = true;

insert into public.customer_work_request_participants(
  organization_id, request_id, user_id, participant_role,
  can_message, can_manage, can_decide, added_by
)
select distinct
  request.organization_id,
  request.id,
  assignee.user_id,
  'worker',
  true,
  false,
  false,
  request.assigned_supervisor_id
from public.customer_work_requests request
join public.work_order_assignees assignee
  on assignee.organization_id = request.organization_id
 and assignee.work_order_id = request.work_order_id
where request.work_order_id is not null
on conflict (request_id, user_id) do update
set participant_role = 'worker', can_message = true;

-- Existing orders receive one neutral history entry only when no event history
-- exists. New events continue to be generated by the canonical v3 workflow.
insert into public.customer_work_request_events(
  organization_id, request_id, event_type, title, description,
  visibility, actor_user_id, metadata, created_at
)
select
  request.organization_id,
  request.id,
  'order_history_initialized',
  'Tilauksen seuranta käytössä',
  'Tilaus on yhdistetty tilaajaportaalin seurantaan.',
  'customer',
  request.created_by,
  jsonb_build_object('eventKey', 'customerOrder.historyInitialized'),
  request.created_at
from public.customer_work_requests request
where not exists (
  select 1
  from public.customer_work_request_events event
  where event.request_id = request.id
);

create index if not exists customer_work_request_participants_user_request_idx
  on public.customer_work_request_participants (user_id, request_id);
create index if not exists customer_work_request_messages_request_created_active_idx
  on public.customer_work_request_messages (request_id, created_at desc)
  where deleted_at is null;
create index if not exists customer_work_request_read_state_user_idx
  on public.customer_work_request_read_state (user_id, request_id, last_read_at desc);

comment on table public.customer_work_requests is
  'Canonical customer portal order entity. Do not create a second customer-order table.';
comment on table public.customer_work_request_participants is
  'Explicit customer-order conversation and workspace participants.';

commit;
