begin;

create or replace function public.customer_portal_home_v3(p_organization_id uuid)
returns jsonb
language plpgsql
volatile
security definer
set search_path = pg_catalog, public
as $$
declare
  v_user_id uuid := auth.uid();
  result jsonb;
begin
  if v_user_id is null then
    raise exception 'Kirjautuminen vaaditaan.' using errcode = '42501';
  end if;
  if not exists (
    select 1 from public.customer_users cu
    where cu.organization_id = p_organization_id
      and cu.user_id = v_user_id
      and cu.disabled_at is null
  ) then
    raise exception 'Tilaajaportaalin käyttöoikeutta ei löytynyt.' using errcode = '42501';
  end if;

  update public.customer_users cu
  set last_portal_activity_at = now()
  where cu.organization_id = p_organization_id and cu.user_id = v_user_id;

  select jsonb_build_object(
    'accounts', coalesce((
      select jsonb_agg(jsonb_build_object(
        'customerId', customer.id,
        'customerName', customer.name,
        'accessScope', cu.access_scope,
        'profile', cu.portal_profile,
        'permissions', private.customer_portal_base_permissions(cu.portal_profile) || cu.portal_permissions,
        'visibleProjectCount', (
          select count(*) from public.projects project
          where project.organization_id = cu.organization_id
            and project.customer_id = cu.customer_id
            and project.archived_at is null
            and private.customer_user_can_access_project(project.id, project.organization_id, v_user_id)
        )
      ) order by customer.name)
      from public.customer_users cu
      join public.customers customer
        on customer.id = cu.customer_id and customer.organization_id = cu.organization_id
      where cu.organization_id = p_organization_id
        and cu.user_id = v_user_id
        and cu.disabled_at is null
    ), '[]'::jsonb),
    'projects', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', project.id,
        'customerId', project.customer_id,
        'customerName', customer.name,
        'name', project.name,
        'location', project.location,
        'status', project.status,
        'startDate', project.start_date,
        'endDate', project.end_date,
        'progress', coalesce(project.progress, 0),
        'supervisorName', supervisor.full_name,
        'supervisorEmail', supervisor.email,
        'activeOrderCount', (
          select count(*) from public.customer_work_requests request
          where request.project_id = project.id and request.status not in ('Valmis', 'Peruttu')
        ),
        'pendingDecisionCount', (
          select count(*) from public.change_orders change_order
          where change_order.project_id = project.id
            and change_order.customer_visible
            and coalesce(change_order.customer_decision, 'Odottaa') = 'Odottaa'
        ),
        'lastActivityAt', greatest(
          coalesce(project.updated_at, project.created_at),
          coalesce((select max(request.last_activity_at) from public.customer_work_requests request where request.project_id = project.id), '-infinity'::timestamptz),
          coalesce((select max(publication.published_at) from public.customer_portal_publications publication where publication.project_id = project.id and publication.status = 'published'), '-infinity'::timestamptz)
        )
      ) order by greatest(coalesce(project.updated_at, project.created_at), coalesce(project.start_date::timestamptz, '-infinity'::timestamptz)) desc)
      from public.projects project
      join public.customers customer on customer.id = project.customer_id
      left join public.profiles supervisor on supervisor.id = project.responsible_supervisor_id
      where project.organization_id = p_organization_id
        and project.archived_at is null
        and private.customer_user_can_access_project(project.id, project.organization_id, v_user_id)
    ), '[]'::jsonb),
    'orders', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', request.id,
        'orderNumber', request.order_number,
        'customerId', request.customer_id,
        'customerName', customer.name,
        'projectId', request.project_id,
        'projectName', project.name,
        'title', request.title,
        'category', request.category,
        'status', request.status,
        'urgency', request.urgency,
        'progress', request.progress,
        'requestedDate', request.requested_date,
        'desiredCompletionDate', request.desired_completion_date,
        'plannedStartDate', request.planned_start_date,
        'plannedEndDate', request.planned_end_date,
        'workOrderId', request.work_order_id,
        'supervisorNote', request.supervisor_note,
        'lastActivityAt', request.last_activity_at,
        'createdAt', request.created_at,
        'unreadMessageCount', (
          select count(*) from public.customer_work_request_messages message
          where message.request_id = request.id
            and message.deleted_at is null
            and message.author_user_id <> v_user_id
            and message.created_at > coalesce((
              select state.last_read_at from public.customer_work_request_read_state state
              where state.request_id = request.id and state.user_id = v_user_id
            ), '-infinity'::timestamptz)
        )
      ) order by request.last_activity_at desc, request.created_at desc)
      from public.customer_work_requests request
      join public.projects project on project.id = request.project_id
      join public.customers customer on customer.id = request.customer_id
      where request.organization_id = p_organization_id
        and private.customer_user_can_access_project(request.project_id, request.organization_id, v_user_id)
    ), '[]'::jsonb),
    'tasks', jsonb_build_object(
      'pendingDecisions', (
        select count(*) from public.change_orders change_order
        where change_order.organization_id = p_organization_id
          and change_order.customer_visible
          and coalesce(change_order.customer_decision, 'Odottaa') = 'Odottaa'
          and private.customer_user_can_access_project(change_order.project_id, change_order.organization_id, v_user_id)
      ),
      'clarifications', (
        select count(*) from public.customer_work_requests request
        where request.organization_id = p_organization_id
          and request.status = 'Tarkennettava'
          and private.customer_user_can_access_project(request.project_id, request.organization_id, v_user_id)
      ),
      'acknowledgements', (
        select count(*) from public.customer_portal_publications publication
        where publication.organization_id = p_organization_id
          and publication.status = 'published'
          and publication.requires_acknowledgement
          and private.customer_user_can_access_project(publication.project_id, publication.organization_id, v_user_id)
          and not exists (
            select 1 from public.customer_portal_acknowledgements acknowledgement
            where acknowledgement.publication_id = publication.id and acknowledgement.user_id = v_user_id
          )
      ),
      'unreadMessages', (
        select count(*) from public.customer_work_request_messages message
        join public.customer_work_requests request on request.id = message.request_id
        where request.organization_id = p_organization_id
          and message.deleted_at is null
          and message.author_user_id <> v_user_id
          and private.customer_user_can_access_project(request.project_id, request.organization_id, v_user_id)
          and message.created_at > coalesce((
            select state.last_read_at from public.customer_work_request_read_state state
            where state.request_id = request.id and state.user_id = v_user_id
          ), '-infinity'::timestamptz)
      )
    ),
    'activities', coalesce((
      select jsonb_agg(activity.payload order by activity.created_at desc)
      from (
        select event.created_at,
               jsonb_build_object(
                 'id', event.id, 'type', event.event_type, 'title', event.title,
                 'description', event.description, 'projectId', request.project_id,
                 'requestId', event.request_id, 'createdAt', event.created_at
               ) as payload
        from public.customer_work_request_events event
        join public.customer_work_requests request on request.id = event.request_id
        where event.organization_id = p_organization_id
          and event.visibility = 'customer'
          and private.customer_user_can_access_project(request.project_id, request.organization_id, v_user_id)
        union all
        select publication.published_at,
               jsonb_build_object(
                 'id', publication.id, 'type', publication.publication_type,
                 'title', publication.title, 'description', coalesce(publication.summary, publication.body),
                 'projectId', publication.project_id, 'requestId', null,
                 'createdAt', publication.published_at
               )
        from public.customer_portal_publications publication
        where publication.organization_id = p_organization_id
          and publication.status = 'published'
          and private.customer_user_can_access_project(publication.project_id, publication.organization_id, v_user_id)
        order by created_at desc
        limit 30
      ) activity
    ), '[]'::jsonb)
  ) into result;

  return result;
end;
$$;

create or replace function public.customer_portal_order_detail_v3(
  p_organization_id uuid,
  p_request_id uuid
)
returns jsonb
language plpgsql
stable
security definer
set search_path = pg_catalog, public
as $$
declare
  v_user_id uuid := auth.uid();
  request_row public.customer_work_requests%rowtype;
  customer_profile text;
  permission_values jsonb;
  is_manager boolean;
begin
  if v_user_id is null then raise exception 'Kirjautuminen vaaditaan.' using errcode = '42501'; end if;
  select * into request_row from public.customer_work_requests
  where id = p_request_id and organization_id = p_organization_id;
  if request_row.id is null or not private.customer_can_access_order(request_row.id, v_user_id) then
    raise exception 'Tilausta ei löytynyt tai käyttöoikeus puuttuu.' using errcode = '42501';
  end if;

  is_manager := private.is_operational_manager(request_row.organization_id, v_user_id);
  select cu.portal_profile,
         private.customer_portal_base_permissions(cu.portal_profile) || cu.portal_permissions
  into customer_profile, permission_values
  from public.customer_users cu
  where cu.organization_id = request_row.organization_id
    and cu.customer_id = request_row.customer_id
    and cu.user_id = v_user_id
    and cu.disabled_at is null;

  return jsonb_build_object(
    'order', (
      select jsonb_build_object(
        'id', request.id, 'orderNumber', request.order_number,
        'organizationId', request.organization_id, 'customerId', request.customer_id,
        'customerName', customer.name, 'projectId', request.project_id,
        'projectName', project.name, 'projectLocation', project.location,
        'title', request.title, 'category', request.category,
        'description', request.description, 'status', request.status,
        'urgency', request.urgency, 'progress', request.progress,
        'locationDetails', request.location_details, 'serviceAddress', coalesce(request.service_address, project.location),
        'building', request.building, 'stairwell', request.stairwell, 'unit', request.unit,
        'contactName', request.contact_name, 'contactPhone', request.contact_phone,
        'requestedDate', request.requested_date, 'desiredCompletionDate', request.desired_completion_date,
        'preferredTime', request.preferred_time, 'accessWindow', request.access_window,
        'plannedStartDate', request.planned_start_date, 'plannedEndDate', request.planned_end_date,
        'accessInstructions', request.access_instructions, 'safetyNotes', request.safety_notes,
        'customerReference', request.customer_reference, 'purchaseOrderNumber', request.purchase_order_number,
        'budgetLimitCents', request.budget_limit_cents, 'supervisorNote', request.supervisor_note,
        'workOrderId', request.work_order_id, 'assignedSupervisorId', request.assigned_supervisor_id,
        'assignedSupervisorName', supervisor.full_name, 'createdBy', request.created_by,
        'createdByName', creator.full_name, 'createdAt', request.created_at,
        'updatedAt', request.updated_at, 'lastActivityAt', request.last_activity_at,
        'completedAt', request.completed_at
      )
      from public.customer_work_requests request
      join public.customers customer on customer.id = request.customer_id
      join public.projects project on project.id = request.project_id
      left join public.profiles supervisor on supervisor.id = request.assigned_supervisor_id
      left join public.profiles creator on creator.id = request.created_by
      where request.id = request_row.id
    ),
    'items', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', item.id, 'title', item.title, 'description', item.description,
        'locationDetails', item.location_details, 'quantity', item.quantity,
        'unit', item.unit, 'priority', item.priority, 'sortOrder', item.sort_order,
        'completedAt', item.completed_at
      ) order by item.sort_order, item.created_at)
      from public.customer_work_request_items item where item.request_id = request_row.id
    ), '[]'::jsonb),
    'participants', coalesce((
      select jsonb_agg(jsonb_build_object(
        'userId', participant.user_id,
        'displayName', coalesce(nullif(profile.full_name, ''), profile.email, 'Käyttäjä'),
        'email', profile.email, 'role', participant.participant_role,
        'canMessage', participant.can_message, 'canManage', participant.can_manage,
        'canDecide', participant.can_decide
      ) order by participant.participant_role, profile.full_name)
      from public.customer_work_request_participants participant
      left join public.profiles profile on profile.id = participant.user_id
      where participant.request_id = request_row.id
    ), '[]'::jsonb),
    'messages', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', message.id, 'authorUserId', message.author_user_id,
        'authorName', coalesce(nullif(profile.full_name, ''), profile.email, 'Käyttäjä'),
        'body', case when message.deleted_at is null then message.body else 'Viesti poistettu' end,
        'replyToId', message.reply_to_id, 'createdAt', message.created_at,
        'editedAt', message.edited_at, 'deletedAt', message.deleted_at,
        'attachments', coalesce((
          select jsonb_agg(jsonb_build_object(
            'id', attachment.id, 'storagePath', attachment.storage_path,
            'fileName', attachment.file_name, 'mimeType', attachment.mime_type,
            'sizeBytes', attachment.size_bytes, 'createdAt', attachment.created_at
          ) order by attachment.created_at)
          from public.customer_work_request_message_attachments attachment
          where attachment.message_id = message.id
        ), '[]'::jsonb)
      ) order by message.created_at)
      from public.customer_work_request_messages message
      left join public.profiles profile on profile.id = message.author_user_id
      where message.request_id = request_row.id
    ), '[]'::jsonb),
    'events', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', event.id, 'type', event.event_type, 'title', event.title,
        'description', event.description, 'visibility', event.visibility,
        'actorName', coalesce(nullif(profile.full_name, ''), profile.email),
        'metadata', event.metadata, 'createdAt', event.created_at
      ) order by event.created_at desc)
      from public.customer_work_request_events event
      left join public.profiles profile on profile.id = event.actor_user_id
      where event.request_id = request_row.id and (is_manager or event.visibility = 'customer')
    ), '[]'::jsonb),
    'publications', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', publication.id, 'type', publication.publication_type,
        'title', publication.title, 'summary', coalesce(publication.summary, publication.body),
        'version', publication.version,
        'requiresAcknowledgement', publication.requires_acknowledgement,
        'acknowledgedAt', acknowledgement.acknowledged_at,
        'publishedAt', publication.published_at, 'metadata', publication.metadata
      ) order by publication.published_at desc)
      from public.customer_portal_publications publication
      left join public.customer_portal_acknowledgements acknowledgement
        on acknowledgement.publication_id = publication.id and acknowledgement.user_id = v_user_id
      where publication.project_id = request_row.project_id and publication.status = 'published'
    ), '[]'::jsonb),
    'permissions', coalesce(permission_values, '{}'::jsonb) || jsonb_build_object(
      'isManager', is_manager,
      'canEdit', private.customer_can_edit_order(request_row.id, v_user_id),
      'canMessage', private.customer_can_message_order(request_row.id, v_user_id),
      'canCancel', is_manager or (request_row.work_order_id is null and request_row.status in ('Uusi','Tarkennettava','Käsittelyssä'))
    ),
    'profile', customer_profile
  );
end;
$$;

create or replace function public.create_customer_portal_order_v3(
  p_organization_id uuid,
  p_customer_id uuid,
  p_project_id uuid,
  p_title text,
  p_category text,
  p_description text,
  p_urgency text default 'Normaali',
  p_location_details text default null,
  p_service_address text default null,
  p_building text default null,
  p_stairwell text default null,
  p_unit text default null,
  p_contact_name text default null,
  p_contact_phone text default null,
  p_requested_date date default null,
  p_desired_completion_date date default null,
  p_preferred_time text default null,
  p_access_window text default null,
  p_access_instructions text default null,
  p_safety_notes text default null,
  p_customer_reference text default null,
  p_purchase_order_number text default null,
  p_budget_limit_cents bigint default null,
  p_items jsonb default '[]'::jsonb
)
returns uuid
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_user_id uuid := auth.uid();
  v_request_id uuid;
  v_item jsonb;
  v_manager record;
begin
  if v_user_id is null then raise exception 'Kirjautuminen vaaditaan.' using errcode = '42501'; end if;
  if not private.customer_user_can_access_project(p_project_id, p_organization_id, v_user_id)
     or not private.customer_portal_has_permission(p_organization_id, p_customer_id, v_user_id, 'orders.create') then
    raise exception 'Sinulla ei ole oikeutta tilata työtä tähän projektiin.' using errcode = '42501';
  end if;
  if not exists (
    select 1 from public.projects project
    where project.id = p_project_id
      and project.organization_id = p_organization_id
      and project.customer_id = p_customer_id
      and project.archived_at is null
  ) then raise exception 'Valittu projekti ei kuulu asiakkuuteen.' using errcode = '42501'; end if;
  if char_length(trim(coalesce(p_title, ''))) not between 3 and 180 then
    raise exception 'Anna 3–180 merkin otsikko.' using errcode = '23514';
  end if;
  if char_length(trim(coalesce(p_description, ''))) not between 10 and 5000 then
    raise exception 'Kuvaile työ 10–5000 merkillä.' using errcode = '23514';
  end if;
  if p_urgency not in ('Kiireellinen', 'Normaali', 'Ei kiireellinen') then
    raise exception 'Virheellinen kiireellisyys.' using errcode = '23514';
  end if;
  if p_budget_limit_cents is not null and p_budget_limit_cents < 0 then
    raise exception 'Budjettiraja ei voi olla negatiivinen.' using errcode = '23514';
  end if;
  if jsonb_typeof(coalesce(p_items, '[]'::jsonb)) <> 'array' then
    raise exception 'Työvaiheiden tulee olla taulukko.' using errcode = '23514';
  end if;

  insert into public.customer_work_requests(
    organization_id, customer_id, project_id, created_by, order_number,
    title, category, description, urgency, location_details, service_address,
    building, stairwell, unit, contact_name, contact_phone, requested_date,
    desired_completion_date, preferred_time, access_window, access_instructions,
    safety_notes, customer_reference, purchase_order_number, budget_limit_cents,
    status, progress, last_activity_at
  ) values (
    p_organization_id, p_customer_id, p_project_id, v_user_id,
    private.next_customer_order_number(p_organization_id),
    trim(p_title), trim(p_category), trim(p_description), p_urgency,
    nullif(trim(coalesce(p_location_details, '')), ''),
    nullif(trim(coalesce(p_service_address, '')), ''),
    nullif(trim(coalesce(p_building, '')), ''),
    nullif(trim(coalesce(p_stairwell, '')), ''),
    nullif(trim(coalesce(p_unit, '')), ''),
    nullif(trim(coalesce(p_contact_name, '')), ''),
    nullif(trim(coalesce(p_contact_phone, '')), ''),
    p_requested_date, p_desired_completion_date,
    nullif(trim(coalesce(p_preferred_time, '')), ''),
    nullif(trim(coalesce(p_access_window, '')), ''),
    nullif(trim(coalesce(p_access_instructions, '')), ''),
    nullif(trim(coalesce(p_safety_notes, '')), ''),
    nullif(trim(coalesce(p_customer_reference, '')), ''),
    nullif(trim(coalesce(p_purchase_order_number, '')), ''),
    p_budget_limit_cents, 'Uusi', 0, now()
  ) returning id into v_request_id;

  for v_item in select value from jsonb_array_elements(coalesce(p_items, '[]'::jsonb))
  loop
    if char_length(trim(coalesce(v_item->>'title', ''))) >= 2 then
      insert into public.customer_work_request_items(
        organization_id, request_id, title, description, location_details,
        quantity, unit, priority, sort_order, created_by
      ) values (
        p_organization_id, v_request_id, trim(v_item->>'title'),
        nullif(trim(coalesce(v_item->>'description', '')), ''),
        nullif(trim(coalesce(v_item->>'locationDetails', '')), ''),
        case when coalesce(v_item->>'quantity', '') ~ '^\d+(\.\d+)?$' then (v_item->>'quantity')::numeric else null end,
        nullif(trim(coalesce(v_item->>'unit', '')), ''),
        case when v_item->>'priority' in ('Korkea','Normaali','Matala') then v_item->>'priority' else 'Normaali' end,
        case when coalesce(v_item->>'sortOrder','') ~ '^\d+$' then (v_item->>'sortOrder')::integer else 0 end,
        v_user_id
      );
    end if;
  end loop;

  insert into public.customer_work_request_participants(
    organization_id, request_id, user_id, participant_role, can_message, can_manage, can_decide, added_by
  ) values (
    p_organization_id, v_request_id, v_user_id,
    case when private.customer_portal_has_permission(p_organization_id, p_customer_id, v_user_id, 'decisions.make') then 'approver' else 'customer_contact' end,
    true, false,
    private.customer_portal_has_permission(p_organization_id, p_customer_id, v_user_id, 'decisions.make'),
    v_user_id
  ) on conflict (request_id, user_id) do nothing;

  perform private.append_customer_order_event(
    v_request_id, 'order_created', 'Työtilaus lähetettiin',
    'Tilaus vastaanotettiin ja odottaa työnjohdon käsittelyä.', 'customer', v_user_id,
    jsonb_build_object('status', 'Uusi')
  );

  for v_manager in
    select om.user_id from public.organization_members om
    where om.organization_id = p_organization_id
      and om.role in ('admin','supervisor','project_coordinator')
  loop
    perform private.upsert_portal_notification(
      p_organization_id, v_manager.user_id, 'customer_order_created',
      case when p_urgency = 'Kiireellinen' then 'danger' else 'info' end,
      'Uusi tilaajan työtilaus', trim(p_title),
      '/tilaukset?order=' || v_request_id::text,
      'customer_work_requests', v_request_id,
      'customer-order-created-' || v_request_id::text,
      jsonb_build_object('requestId', v_request_id, 'projectId', p_project_id, 'customerId', p_customer_id)
    );
  end loop;

  insert into public.audit_logs(organization_id, user_id, action, table_name, record_id, metadata)
  values (
    p_organization_id, v_user_id, 'customer_portal_order_created',
    'customer_work_requests', v_request_id,
    jsonb_build_object('project_id', p_project_id, 'customer_id', p_customer_id)
  );
  return v_request_id;
end;
$$;

create or replace function public.update_customer_portal_order_v3(
  p_request_id uuid,
  p_title text,
  p_category text,
  p_description text,
  p_urgency text,
  p_location_details text default null,
  p_service_address text default null,
  p_building text default null,
  p_stairwell text default null,
  p_unit text default null,
  p_contact_name text default null,
  p_contact_phone text default null,
  p_requested_date date default null,
  p_desired_completion_date date default null,
  p_preferred_time text default null,
  p_access_window text default null,
  p_access_instructions text default null,
  p_safety_notes text default null,
  p_customer_reference text default null,
  p_purchase_order_number text default null,
  p_budget_limit_cents bigint default null,
  p_items jsonb default '[]'::jsonb
)
returns void
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_user_id uuid := auth.uid();
  request_row public.customer_work_requests%rowtype;
  item jsonb;
  manager record;
begin
  if v_user_id is null or not private.customer_can_edit_order(p_request_id, v_user_id) then
    raise exception 'Tilausta ei voi muokata tässä vaiheessa.' using errcode = '42501';
  end if;
  select * into request_row from public.customer_work_requests where id = p_request_id for update;
  if char_length(trim(coalesce(p_title, ''))) not between 3 and 180
     or char_length(trim(coalesce(p_description, ''))) not between 10 and 5000 then
    raise exception 'Tarkista otsikko ja työn kuvaus.' using errcode = '23514';
  end if;
  if p_urgency not in ('Kiireellinen', 'Normaali', 'Ei kiireellinen') then
    raise exception 'Virheellinen kiireellisyys.' using errcode = '23514';
  end if;
  if p_budget_limit_cents is not null and p_budget_limit_cents < 0 then
    raise exception 'Budjettiraja ei voi olla negatiivinen.' using errcode = '23514';
  end if;

  update public.customer_work_requests
  set title = trim(p_title), category = trim(p_category), description = trim(p_description),
      urgency = p_urgency,
      location_details = nullif(trim(coalesce(p_location_details, '')), ''),
      service_address = nullif(trim(coalesce(p_service_address, '')), ''),
      building = nullif(trim(coalesce(p_building, '')), ''),
      stairwell = nullif(trim(coalesce(p_stairwell, '')), ''),
      unit = nullif(trim(coalesce(p_unit, '')), ''),
      contact_name = nullif(trim(coalesce(p_contact_name, '')), ''),
      contact_phone = nullif(trim(coalesce(p_contact_phone, '')), ''),
      requested_date = p_requested_date,
      desired_completion_date = p_desired_completion_date,
      preferred_time = nullif(trim(coalesce(p_preferred_time, '')), ''),
      access_window = nullif(trim(coalesce(p_access_window, '')), ''),
      access_instructions = nullif(trim(coalesce(p_access_instructions, '')), ''),
      safety_notes = nullif(trim(coalesce(p_safety_notes, '')), ''),
      customer_reference = nullif(trim(coalesce(p_customer_reference, '')), ''),
      purchase_order_number = nullif(trim(coalesce(p_purchase_order_number, '')), ''),
      budget_limit_cents = p_budget_limit_cents,
      status = case when status = 'Tarkennettava' then 'Käsittelyssä' else status end,
      last_activity_at = now()
  where id = p_request_id;

  delete from public.customer_work_request_items where request_id = p_request_id;
  for item in select value from jsonb_array_elements(coalesce(p_items, '[]'::jsonb))
  loop
    if char_length(trim(coalesce(item->>'title', ''))) >= 2 then
      insert into public.customer_work_request_items(
        organization_id, request_id, title, description, location_details,
        quantity, unit, priority, sort_order, created_by
      ) values (
        request_row.organization_id, p_request_id, trim(item->>'title'),
        nullif(trim(coalesce(item->>'description', '')), ''),
        nullif(trim(coalesce(item->>'locationDetails', '')), ''),
        case when coalesce(item->>'quantity', '') ~ '^\d+(\.\d+)?$' then (item->>'quantity')::numeric else null end,
        nullif(trim(coalesce(item->>'unit', '')), ''),
        case when item->>'priority' in ('Korkea','Normaali','Matala') then item->>'priority' else 'Normaali' end,
        case when coalesce(item->>'sortOrder','') ~ '^\d+$' then (item->>'sortOrder')::integer else 0 end,
        v_user_id
      );
    end if;
  end loop;

  perform private.append_customer_order_event(
    p_request_id, 'order_updated', 'Tilauksen määrittely päivitettiin',
    'Tilaaja täydensi työn sisältöä ja kohdetietoja.', 'customer', v_user_id, '{}'::jsonb
  );

  for manager in
    select om.user_id from public.organization_members om
    where om.organization_id = request_row.organization_id
      and om.role in ('admin','supervisor','project_coordinator')
  loop
    perform private.upsert_portal_notification(
      request_row.organization_id, manager.user_id, 'customer_order_updated', 'info',
      'Tilaaja päivitti työtilausta', request_row.order_number || ' · ' || trim(p_title),
      '/tilaukset?order=' || p_request_id::text,
      'customer_work_requests', p_request_id,
      'customer-order-updated-' || p_request_id::text || '-' || extract(epoch from now())::bigint::text,
      jsonb_build_object('requestId', p_request_id)
    );
  end loop;
end;
$$;

create or replace function public.send_customer_portal_order_message_v3(
  p_request_id uuid,
  p_body text,
  p_reply_to_id uuid default null
)
returns uuid
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_user_id uuid := auth.uid();
  request_row public.customer_work_requests%rowtype;
  message_id uuid;
  recipient record;
  sender_name text;
begin
  if v_user_id is null or not private.customer_can_message_order(p_request_id, v_user_id) then
    raise exception 'Sinulla ei ole oikeutta lähettää viestiä tähän tilaukseen.' using errcode = '42501';
  end if;
  if char_length(trim(coalesce(p_body, ''))) not between 1 and 5000 then
    raise exception 'Viestin pituus on 1–5000 merkkiä.' using errcode = '23514';
  end if;
  select * into request_row from public.customer_work_requests where id = p_request_id;
  if p_reply_to_id is not null and not exists (
    select 1 from public.customer_work_request_messages message
    where message.id = p_reply_to_id and message.request_id = p_request_id
  ) then raise exception 'Vastattavaa viestiä ei löytynyt.' using errcode = '23503'; end if;

  insert into public.customer_work_request_messages(
    organization_id, request_id, author_user_id, body, reply_to_id
  ) values (
    request_row.organization_id, request_row.id, v_user_id, trim(p_body), p_reply_to_id
  ) returning id into message_id;

  insert into public.customer_work_request_participants(
    organization_id, request_id, user_id, participant_role, can_message, can_manage, can_decide, added_by
  ) values (
    request_row.organization_id, request_row.id, v_user_id,
    case when private.is_operational_manager(request_row.organization_id, v_user_id) then 'supervisor' else 'customer_contact' end,
    true, private.is_operational_manager(request_row.organization_id, v_user_id), false, v_user_id
  ) on conflict (request_id, user_id) do update set can_message = true;

  update public.customer_work_requests set last_activity_at = now() where id = request_row.id;
  select coalesce(nullif(profile.full_name, ''), profile.email, 'Käyttäjä') into sender_name
  from public.profiles profile where profile.id = v_user_id;

  for recipient in
    select distinct recipient_user_id
    from (
      select participant.user_id as recipient_user_id
      from public.customer_work_request_participants participant
      where participant.request_id = request_row.id and participant.can_message
      union
      select cu.user_id
      from public.customer_users cu
      where cu.organization_id = request_row.organization_id
        and cu.customer_id = request_row.customer_id
        and cu.disabled_at is null
        and private.customer_user_can_access_project(request_row.project_id, request_row.organization_id, cu.user_id)
      union
      select om.user_id
      from public.organization_members om
      where om.organization_id = request_row.organization_id
        and om.role in ('admin','supervisor','project_coordinator')
    ) recipients
    where recipient_user_id <> v_user_id
  loop
    perform private.upsert_portal_notification(
      request_row.organization_id, recipient.recipient_user_id,
      'customer_order_message', 'info',
      'Uusi viesti työtilauksessa', request_row.order_number || ' · ' || sender_name,
      case when private.is_operational_manager(request_row.organization_id, recipient.recipient_user_id)
        then '/tilaukset?order=' || request_row.id::text
        else '/tilaajan-tyot?order=' || request_row.id::text end,
      'customer_work_request_messages', message_id,
      'customer-order-message-' || message_id::text || '-' || recipient.recipient_user_id::text,
      jsonb_build_object('requestId', request_row.id, 'messageId', message_id)
    );
  end loop;
  return message_id;
end;
$$;

create or replace function public.mark_customer_portal_order_read_v3(p_request_id uuid)
returns void
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
begin
  if auth.uid() is null or not private.customer_can_access_order(p_request_id, auth.uid()) then
    raise exception 'Tilausta ei voi merkitä luetuksi.' using errcode = '42501';
  end if;
  insert into public.customer_work_request_read_state(organization_id, request_id, user_id, last_read_at)
  select request.organization_id, request.id, auth.uid(), now()
  from public.customer_work_requests request where request.id = p_request_id
  on conflict (request_id, user_id) do update set last_read_at = excluded.last_read_at;
end;
$$;

create or replace function public.cancel_customer_portal_order_v3(
  p_request_id uuid,
  p_reason text default null
)
returns void
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  request_row public.customer_work_requests%rowtype;
begin
  select * into request_row from public.customer_work_requests where id = p_request_id for update;
  if request_row.id is null or auth.uid() is null then raise exception 'Tilausta ei löytynyt.' using errcode = '23503'; end if;
  if not (
    private.is_operational_manager(request_row.organization_id, auth.uid())
    or (
      request_row.work_order_id is null
      and request_row.status in ('Uusi','Tarkennettava','Käsittelyssä')
      and private.customer_user_can_access_project(request_row.project_id, request_row.organization_id, auth.uid())
    )
  ) then raise exception 'Tilausta ei voi perua tässä vaiheessa.' using errcode = '42501'; end if;

  update public.customer_work_requests
  set status = 'Peruttu', progress = 0,
      supervisor_note = coalesce(nullif(trim(coalesce(p_reason, '')), ''), supervisor_note),
      last_activity_at = now()
  where id = p_request_id;
  perform private.append_customer_order_event(
    p_request_id, 'order_cancelled', 'Työtilaus peruttiin',
    nullif(trim(coalesce(p_reason, '')), ''), 'customer', auth.uid(), '{}'::jsonb
  );
end;
$$;

create or replace function public.register_customer_order_attachment_v3(
  p_message_id uuid,
  p_storage_path text,
  p_file_name text,
  p_mime_type text,
  p_size_bytes bigint
)
returns uuid
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  message_row public.customer_work_request_messages%rowtype;
  attachment_id uuid;
begin
  select * into message_row from public.customer_work_request_messages where id = p_message_id;
  if message_row.id is null or auth.uid() is null
     or not private.customer_can_message_order(message_row.request_id, auth.uid()) then
    raise exception 'Liitettä ei voi lisätä.' using errcode = '42501';
  end if;
  if p_size_bytes not between 1 and 10485760 then
    raise exception 'Tiedosto ylittää 10 Mt kokorajan.' using errcode = '23514';
  end if;
  if p_storage_path not like message_row.organization_id::text || '/' || message_row.request_id::text || '/' || message_row.id::text || '/%' then
    raise exception 'Virheellinen tiedostopolku.' using errcode = '23514';
  end if;
  insert into public.customer_work_request_message_attachments(
    organization_id, request_id, message_id, storage_path, file_name, mime_type, size_bytes, created_by
  ) values (
    message_row.organization_id, message_row.request_id, message_row.id,
    p_storage_path, p_file_name, p_mime_type, p_size_bytes, auth.uid()
  ) returning id into attachment_id;
  return attachment_id;
end;
$$;

revoke all on function public.customer_portal_home_v3(uuid) from public, anon;
revoke all on function public.customer_portal_order_detail_v3(uuid, uuid) from public, anon;
revoke all on function public.create_customer_portal_order_v3(uuid, uuid, uuid, text, text, text, text, text, text, text, text, text, text, text, date, date, text, text, text, text, text, text, bigint, jsonb) from public, anon;
revoke all on function public.update_customer_portal_order_v3(uuid, text, text, text, text, text, text, text, text, text, text, text, date, date, text, text, text, text, text, text, bigint, jsonb) from public, anon;
revoke all on function public.send_customer_portal_order_message_v3(uuid, text, uuid) from public, anon;
revoke all on function public.mark_customer_portal_order_read_v3(uuid) from public, anon;
revoke all on function public.cancel_customer_portal_order_v3(uuid, text) from public, anon;
revoke all on function public.register_customer_order_attachment_v3(uuid, text, text, text, bigint) from public, anon;

grant execute on function public.customer_portal_home_v3(uuid) to authenticated;
grant execute on function public.customer_portal_order_detail_v3(uuid, uuid) to authenticated;
grant execute on function public.create_customer_portal_order_v3(uuid, uuid, uuid, text, text, text, text, text, text, text, text, text, text, text, date, date, text, text, text, text, text, text, bigint, jsonb) to authenticated;
grant execute on function public.update_customer_portal_order_v3(uuid, text, text, text, text, text, text, text, text, text, text, text, date, date, text, text, text, text, text, text, bigint, jsonb) to authenticated;
grant execute on function public.send_customer_portal_order_message_v3(uuid, text, uuid) to authenticated;
grant execute on function public.mark_customer_portal_order_read_v3(uuid) to authenticated;
grant execute on function public.cancel_customer_portal_order_v3(uuid, text) to authenticated;
grant execute on function public.register_customer_order_attachment_v3(uuid, text, text, text, bigint) to authenticated;

commit;
