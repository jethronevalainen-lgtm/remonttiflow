begin;

-- Completion approval is metadata on the existing work order status model. A pending
-- request uses status Odottaa and is shown in the UI as Hyväksyttävänä. This avoids a
-- second competing status vocabulary in reports and integrations.
alter table public.work_orders
  add column if not exists completion_requested_at timestamptz,
  add column if not exists completion_requested_by uuid references public.profiles(id) on delete set null,
  add column if not exists completion_request_note text,
  add column if not exists completion_request_time_entry_id uuid references public.time_entries(id) on delete set null,
  add column if not exists completion_reviewed_at timestamptz,
  add column if not exists completion_reviewed_by uuid references public.profiles(id) on delete set null,
  add column if not exists completion_review_note text,
  add column if not exists completion_approved boolean not null default false;

create index if not exists work_orders_completion_review_idx
  on public.work_orders (organization_id, completion_requested_at desc)
  where completion_requested_at is not null and completion_approved = false;

create index if not exists work_orders_completion_requested_by_idx
  on public.work_orders (completion_requested_by)
  where completion_requested_by is not null;

create index if not exists work_orders_completion_reviewed_by_idx
  on public.work_orders (completion_reviewed_by)
  where completion_reviewed_by is not null;

create index if not exists work_orders_completion_request_time_entry_idx
  on public.work_orders (completion_request_time_entry_id)
  where completion_request_time_entry_id is not null;

-- A previous unreleased implementation used a second work session table. Production
-- never received rows through that path. Keep work_order_time_sessions as the single
-- source of truth created by the automatic work-time migration.
drop function if exists public.start_my_work_order_session(uuid);
drop function if exists public.finish_my_work_order_session(
  uuid,
  text,
  text,
  date,
  time without time zone,
  time without time zone
);
drop table if exists public.work_order_sessions;

-- Project coordinators belong to the operational management group and may inspect
-- work-time sessions for completion review.
drop policy if exists work_order_time_sessions_select on public.work_order_time_sessions;
create policy work_order_time_sessions_select
on public.work_order_time_sessions
for select
to authenticated
using (
  user_id = (select auth.uid())
  or private.has_org_role(
    organization_id,
    array['admin', 'supervisor', 'project_coordinator']::text[]
  )
);

create or replace function private.work_order_completion_review_targets(
  p_organization_id uuid,
  p_work_order_id uuid
)
returns table (user_id uuid)
language sql
stable
security definer
set search_path = ''
as $$
  with target_order as (
    select wo.created_by, wo.project_id
    from public.work_orders wo
    where wo.id = p_work_order_id
      and wo.organization_id = p_organization_id
  ),
  candidates as (
    select target_order.created_by as user_id
    from target_order

    union all

    select project_row.responsible_supervisor_id
    from target_order
    join public.projects project_row
      on project_row.id = target_order.project_id
     and project_row.organization_id = p_organization_id

    union all

    select project_row.project_manager_id
    from target_order
    join public.projects project_row
      on project_row.id = target_order.project_id
     and project_row.organization_id = p_organization_id

    union all

    select member.user_id
    from public.organization_members member
    where member.organization_id = p_organization_id
      and member.role in ('admin', 'supervisor', 'project_coordinator')
  )
  select distinct candidates.user_id
  from candidates
  join public.organization_members member
    on member.organization_id = p_organization_id
   and member.user_id = candidates.user_id
   and member.role in ('admin', 'supervisor', 'project_coordinator')
  where candidates.user_id is not null;
$$;

revoke all on function private.work_order_completion_review_targets(uuid, uuid)
from public, anon, authenticated;

create or replace function private.notify_work_order_completion_reviewers(
  p_order public.work_orders,
  p_requester_user_id uuid,
  p_description text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.app_notifications (
    organization_id,
    recipient_user_id,
    notification_type,
    severity,
    title,
    body,
    path,
    source_table,
    source_id,
    dedup_key,
    metadata,
    read_at,
    resolved_at,
    updated_at
  )
  select
    p_order.organization_id,
    targets.user_id,
    'work_order_completion_requested',
    'warning',
    'Työ odottaa valmistumisen hyväksyntää',
    p_order.title || ': ' || left(p_description, 240),
    '/tyomaaraykset',
    'work_orders',
    p_order.id,
    'work-order-completion:' || p_order.id::text,
    jsonb_build_object(
      'work_order_id', p_order.id,
      'project_id', p_order.project_id,
      'requested_by', p_requester_user_id
    ),
    null,
    null,
    now()
  from private.work_order_completion_review_targets(
    p_order.organization_id,
    p_order.id
  ) targets
  where targets.user_id <> p_requester_user_id
  on conflict (organization_id, recipient_user_id, dedup_key)
  do update set
    notification_type = excluded.notification_type,
    severity = excluded.severity,
    title = excluded.title,
    body = excluded.body,
    path = excluded.path,
    source_table = excluded.source_table,
    source_id = excluded.source_id,
    metadata = excluded.metadata,
    read_at = null,
    resolved_at = null,
    updated_at = now();
end;
$$;

revoke all on function private.notify_work_order_completion_reviewers(public.work_orders, uuid, text)
from public, anon, authenticated;

-- Workers may not alter completion approval metadata or mark a work order complete
-- through a direct table update. Workflow RPCs set a transaction-local guard only
-- after all authorization and state checks have passed.
create or replace function private.enforce_worker_work_order_update()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  workflow_context boolean;
begin
  workflow_context := coalesce(current_setting('vakantti.work_order_workflow', true), '') = 'on';

  if workflow_context
     or private.has_org_role(
       old.organization_id,
       array['admin', 'supervisor', 'project_coordinator']::text[]
     ) then
    return new;
  end if;

  if auth.uid() is null
     or not private.can_access_work_order(old.id, old.organization_id, auth.uid()) then
    raise exception 'Työmääräys ei kuulu käyttäjälle.' using errcode = '42501';
  end if;

  if new.organization_id is distinct from old.organization_id
     or new.project_id is distinct from old.project_id
     or new.title is distinct from old.title
     or new.project is distinct from old.project
     or new.assignee is distinct from old.assignee
     or new.due_date is distinct from old.due_date
     or new.priority is distinct from old.priority
     or new.description is distinct from old.description
     or new.type is distinct from old.type
     or new.assignment_scope is distinct from old.assignment_scope
     or new.location is distinct from old.location
     or new.planned_start_date is distinct from old.planned_start_date
     or new.planned_end_date is distinct from old.planned_end_date
     or new.planned_start_time is distinct from old.planned_start_time
     or new.planned_end_time is distinct from old.planned_end_time
     or new.planned_weekdays is distinct from old.planned_weekdays
     or new.calendar_sync_enabled is distinct from old.calendar_sync_enabled
     or new.occupancy_status is distinct from old.occupancy_status
     or new.work_reference is distinct from old.work_reference
     or new.start_constraints is distinct from old.start_constraints
     or new.access_notes is distinct from old.access_notes
     or new.resident_notification_required is distinct from old.resident_notification_required
     or new.completion_requested_at is distinct from old.completion_requested_at
     or new.completion_requested_by is distinct from old.completion_requested_by
     or new.completion_request_note is distinct from old.completion_request_note
     or new.completion_request_time_entry_id is distinct from old.completion_request_time_entry_id
     or new.completion_reviewed_at is distinct from old.completion_reviewed_at
     or new.completion_reviewed_by is distinct from old.completion_reviewed_by
     or new.completion_review_note is distinct from old.completion_review_note
     or new.completion_approved is distinct from old.completion_approved
     or new.created_by is distinct from old.created_by
     or new.created_at is distinct from old.created_at then
    raise exception 'Työntekijä voi muuttaa vain oman työn sallittua tilaa ja työhuomiota.' using errcode = '42501';
  end if;

  if not (
    (old.status = 'Avoin' and new.status = 'Käynnissä')
    or (old.status = 'Odottaa' and new.status = 'Käynnissä')
    or (old.status = 'Käynnissä' and new.status = 'Odottaa')
  ) then
    raise exception 'Työntekijä ei voi hyväksyä työtä valmiiksi. Lähetä valmistumispyyntö hyväksyttäväksi.' using errcode = '23514';
  end if;

  new.started_at := case
    when new.status = 'Käynnissä' then coalesce(old.started_at, now())
    else old.started_at
  end;
  new.completed_at := null;
  new.updated_at := now();
  return new;
end;
$$;

revoke all on function private.enforce_worker_work_order_update()
from public, anon, authenticated;

-- The public transition remains the single start command. It uses the canonical
-- work_order_time_sessions implementation but prevents workers from bypassing the
-- completion approval flow by requesting status Valmis directly.
revoke execute on function private.transition_my_work_order_impl(uuid, text, text)
from authenticated;
revoke execute on function private.close_work_order_time_session_impl(uuid, uuid, uuid, text, text)
from authenticated;

grant execute on function private.transition_my_work_order_impl(uuid, text, text)
to service_role;
grant execute on function private.close_work_order_time_session_impl(uuid, uuid, uuid, text, text)
to service_role;

create or replace function public.transition_my_work_order(
  p_work_order_id uuid,
  p_status text,
  p_worker_note text default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_order public.work_orders%rowtype;
begin
  if auth.uid() is null then
    raise exception 'Kirjautuminen vaaditaan.' using errcode = '42501';
  end if;

  select * into current_order
  from public.work_orders
  where id = p_work_order_id;

  if current_order.id is null then
    raise exception 'Työmääräystä ei löytynyt.' using errcode = '23503';
  end if;

  if current_order.completion_requested_at is not null
     and not current_order.completion_approved
     and p_status = 'Käynnissä' then
    raise exception 'Työ odottaa jo valmistumisen hyväksyntää.' using errcode = '23514';
  end if;

  if p_status = 'Valmis'
     and not private.has_org_role(
       current_order.organization_id,
       array['admin', 'supervisor', 'project_coordinator']::text[]
     ) then
    raise exception 'Työntekijä lähettää työn valmistumisen hyväksyttäväksi.' using errcode = '23514';
  end if;

  perform private.transition_my_work_order_impl(
    p_work_order_id,
    p_status,
    p_worker_note
  );
end;
$$;

revoke all on function public.transition_my_work_order(uuid, text, text)
from public, anon;
grant execute on function public.transition_my_work_order(uuid, text, text)
to authenticated, service_role;

comment on function public.transition_my_work_order(uuid, text, text) is
  'Käynnistää määrätyn työn ja automaattisen työajan. Työntekijän valmistuminen kulkee erillisen hyväksyntäpyynnön kautta.';

create or replace function public.finish_my_work_order_session(
  p_work_order_id uuid,
  p_action text,
  p_work_description text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_order public.work_orders%rowtype;
  current_session public.work_order_time_sessions%rowtype;
  v_description text;
  v_time_entry_id uuid;
  v_outcome text;
  v_other_active_count integer;
begin
  if auth.uid() is null then
    raise exception 'Kirjautuminen vaaditaan.' using errcode = '42501';
  end if;

  if p_action not in ('submit_time_entry', 'request_completion', 'blocked') then
    raise exception 'Tuntematon työn päättämistapa.' using errcode = '23514';
  end if;

  v_description := nullif(trim(coalesce(p_work_description, '')), '');
  if v_description is null or length(v_description) < 3 then
    raise exception 'Työseloste on pakollinen.' using errcode = '23514';
  end if;

  select * into current_order
  from public.work_orders
  where id = p_work_order_id
  for update;

  if current_order.id is null then
    raise exception 'Työmääräystä ei löytynyt.' using errcode = '23503';
  end if;

  if not private.can_access_work_order(
    current_order.id,
    current_order.organization_id,
    auth.uid()
  ) then
    raise exception 'Työmääräys ei kuulu käyttäjälle.' using errcode = '42501';
  end if;

  if current_order.status in ('Valmis', 'Peruttu') then
    raise exception 'Valmista tai peruttua työtä ei voi päättää uudelleen.' using errcode = '23514';
  end if;

  if current_order.completion_requested_at is not null
     and not current_order.completion_approved then
    raise exception 'Työ odottaa jo valmistumisen hyväksyntää.' using errcode = '23514';
  end if;

  select * into current_session
  from public.work_order_time_sessions
  where organization_id = current_order.organization_id
    and work_order_id = current_order.id
    and user_id = auth.uid()
    and ended_at is null
  for update;

  if current_session.id is null and p_action <> 'request_completion' then
    raise exception 'Työlle ei ole käynnissä olevaa työaikaa.' using errcode = '23514';
  end if;

  if current_session.id is not null then
    v_time_entry_id := private.close_work_order_time_session_impl(
      current_order.organization_id,
      auth.uid(),
      current_order.id,
      case
        when p_action = 'submit_time_entry' then 'paused'
        when p_action = 'blocked' then 'paused'
        else 'completed'
      end,
      v_description
    );
  end if;

  select count(*)::integer into v_other_active_count
  from public.work_order_time_sessions active_session
  where active_session.organization_id = current_order.organization_id
    and active_session.work_order_id = current_order.id
    and active_session.ended_at is null;

  if p_action = 'request_completion' and v_other_active_count > 0 then
    raise exception 'Toinen työntekijä työskentelee edelleen tällä työmääräyksellä. Työtä ei voi vielä lähettää valmiiksi.'
      using errcode = '23514';
  end if;

  perform set_config('vakantti.work_order_workflow', 'on', true);

  if p_action = 'submit_time_entry' then
    update public.work_orders
    set status = 'Käynnissä',
        worker_note = null,
        completed_at = null,
        updated_at = now()
    where id = current_order.id;
    v_outcome := 'work_order_time_entry_submitted';
  elsif p_action = 'blocked' then
    update public.work_orders
    set status = case when v_other_active_count > 0 then 'Käynnissä' else 'Odottaa' end,
        worker_note = v_description,
        completed_at = null,
        updated_at = now()
    where id = current_order.id;
    v_outcome := 'work_order_blocked';
  else
    update public.work_orders
    set status = 'Odottaa',
        worker_note = v_description,
        completion_requested_at = now(),
        completion_requested_by = auth.uid(),
        completion_request_note = v_description,
        completion_request_time_entry_id = v_time_entry_id,
        completion_reviewed_at = null,
        completion_reviewed_by = null,
        completion_review_note = null,
        completion_approved = false,
        completed_at = null,
        updated_at = now()
    where id = current_order.id;
    v_outcome := 'work_order_completion_requested';

    select * into current_order
    from public.work_orders
    where id = p_work_order_id;

    perform private.notify_work_order_completion_reviewers(
      current_order,
      auth.uid(),
      v_description
    );
  end if;

  insert into public.audit_logs (
    organization_id,
    user_id,
    action,
    table_name,
    record_id,
    metadata
  ) values (
    current_order.organization_id,
    auth.uid(),
    v_outcome,
    'work_orders',
    current_order.id,
    jsonb_build_object(
      'work_order_id', current_order.id,
      'work_session_id', current_session.id,
      'time_entry_id', v_time_entry_id,
      'description', v_description,
      'other_active_workers', v_other_active_count
    )
  );

  return v_time_entry_id;
end;
$$;

revoke all on function public.finish_my_work_order_session(uuid, text, text)
from public, anon;
grant execute on function public.finish_my_work_order_session(uuid, text, text)
to authenticated;

comment on function public.finish_my_work_order_session(uuid, text, text) is
  'Päättää käyttäjän automaattisen työajan pakollisella työselosteella. Lähettää tunnit, merkitsee esteen tai avaa valmistumisen hyväksyntäpyynnön.';

create or replace function public.review_work_order_completion(
  p_work_order_id uuid,
  p_approved boolean,
  p_review_note text default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_order public.work_orders%rowtype;
  v_note text;
  v_requester uuid;
begin
  if auth.uid() is null then
    raise exception 'Kirjautuminen vaaditaan.' using errcode = '42501';
  end if;

  select * into current_order
  from public.work_orders
  where id = p_work_order_id
  for update;

  if current_order.id is null then
    raise exception 'Työmääräystä ei löytynyt.' using errcode = '23503';
  end if;

  if not private.has_org_role(
    current_order.organization_id,
    array['admin', 'supervisor', 'project_coordinator']::text[]
  ) then
    raise exception 'Valmistumisen hyväksyntäoikeus puuttuu.' using errcode = '42501';
  end if;

  if current_order.completion_requested_at is null
     or current_order.completion_requested_by is null
     or current_order.completion_approved then
    raise exception 'Työllä ei ole aktiivista valmistumispyyntöä.' using errcode = '23514';
  end if;

  v_note := nullif(trim(coalesce(p_review_note, '')), '');
  if not p_approved and (v_note is null or length(v_note) < 3) then
    raise exception 'Palautuksen perustelu on pakollinen.' using errcode = '23514';
  end if;

  v_requester := current_order.completion_requested_by;
  perform set_config('vakantti.work_order_workflow', 'on', true);

  if p_approved then
    update public.work_orders
    set status = 'Valmis',
        completed_at = now(),
        completion_reviewed_at = now(),
        completion_reviewed_by = auth.uid(),
        completion_review_note = v_note,
        completion_approved = true,
        updated_at = now()
    where id = current_order.id;
  else
    update public.work_orders
    set status = 'Käynnissä',
        completed_at = null,
        worker_note = v_note,
        completion_requested_at = null,
        completion_requested_by = null,
        completion_request_note = null,
        completion_request_time_entry_id = null,
        completion_reviewed_at = now(),
        completion_reviewed_by = auth.uid(),
        completion_review_note = v_note,
        completion_approved = false,
        updated_at = now()
    where id = current_order.id;
  end if;

  update public.app_notifications
  set resolved_at = now(),
      updated_at = now()
  where organization_id = current_order.organization_id
    and source_table = 'work_orders'
    and source_id = current_order.id
    and dedup_key = 'work-order-completion:' || current_order.id::text
    and resolved_at is null;

  insert into public.app_notifications (
    organization_id,
    recipient_user_id,
    notification_type,
    severity,
    title,
    body,
    path,
    source_table,
    source_id,
    dedup_key,
    metadata,
    read_at,
    resolved_at,
    updated_at
  ) values (
    current_order.organization_id,
    v_requester,
    case when p_approved then 'work_order_completion_approved' else 'work_order_completion_rejected' end,
    case when p_approved then 'info' else 'warning' end,
    case when p_approved then 'Työ hyväksyttiin valmiiksi' else 'Työ palautettiin jatkettavaksi' end,
    current_order.title || case
      when p_approved then ' on hyväksytty valmiiksi.'
      else ': ' || coalesce(v_note, 'Työ vaatii lisätoimia.')
    end,
    '/tyomaaraykset',
    'work_orders',
    current_order.id,
    'work-order-completion-review:' || current_order.id::text,
    jsonb_build_object(
      'work_order_id', current_order.id,
      'approved', p_approved,
      'reviewed_by', auth.uid()
    ),
    null,
    null,
    now()
  )
  on conflict (organization_id, recipient_user_id, dedup_key)
  do update set
    notification_type = excluded.notification_type,
    severity = excluded.severity,
    title = excluded.title,
    body = excluded.body,
    path = excluded.path,
    metadata = excluded.metadata,
    read_at = null,
    resolved_at = null,
    updated_at = now();

  insert into public.audit_logs (
    organization_id,
    user_id,
    action,
    table_name,
    record_id,
    metadata
  ) values (
    current_order.organization_id,
    auth.uid(),
    case when p_approved then 'work_order_completion_approved' else 'work_order_completion_rejected' end,
    'work_orders',
    current_order.id,
    jsonb_build_object(
      'requested_by', v_requester,
      'approved', p_approved,
      'review_note', v_note
    )
  );
end;
$$;

revoke all on function public.review_work_order_completion(uuid, boolean, text)
from public, anon;
grant execute on function public.review_work_order_completion(uuid, boolean, text)
to authenticated;

comment on function public.review_work_order_completion(uuid, boolean, text) is
  'Hyväksyy työn valmiiksi tai palauttaa sen tekijälle perustellusti jatkettavaksi.';

commit;
