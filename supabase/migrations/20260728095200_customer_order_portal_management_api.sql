begin;

create or replace function public.management_customer_portal_dashboard_v3(p_organization_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = pg_catalog, public
as $$
begin
  if auth.uid() is null or not private.is_operational_manager(p_organization_id, auth.uid()) then
    raise exception 'Vain työnjohto voi avata tilaajaportaalin hallinnan.' using errcode = '42501';
  end if;

  return jsonb_build_object(
    'metrics', jsonb_build_object(
      'openOrders', (select count(*) from public.customer_work_requests request where request.organization_id = p_organization_id and request.status not in ('Valmis','Peruttu')),
      'urgentOrders', (select count(*) from public.customer_work_requests request where request.organization_id = p_organization_id and request.urgency = 'Kiireellinen' and request.status not in ('Valmis','Peruttu')),
      'waitingCustomer', (select count(*) from public.change_orders change_order where change_order.organization_id = p_organization_id and change_order.customer_visible and coalesce(change_order.customer_decision,'Odottaa')='Odottaa'),
      'portalUsers', (select count(distinct cu.user_id) from public.customer_users cu where cu.organization_id = p_organization_id and cu.disabled_at is null),
      'unpublishedInspections', (select count(*) from public.inspections inspection where inspection.organization_id = p_organization_id and inspection.approved_at is not null and not inspection.customer_visible and inspection.deleted_at is null)
    ),
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
        'assignedSupervisorId', request.assigned_supervisor_id,
        'assignedSupervisorName', supervisor.full_name,
        'workOrderId', request.work_order_id,
        'lastActivityAt', request.last_activity_at,
        'createdAt', request.created_at,
        'messageCount', (select count(*) from public.customer_work_request_messages message where message.request_id=request.id and message.deleted_at is null)
      ) order by request.last_activity_at desc)
      from public.customer_work_requests request
      join public.customers customer on customer.id = request.customer_id
      join public.projects project on project.id = request.project_id
      left join public.profiles supervisor on supervisor.id = request.assigned_supervisor_id
      where request.organization_id = p_organization_id
    ), '[]'::jsonb),
    'users', coalesce((
      select jsonb_agg(jsonb_build_object(
        'userId', cu.user_id,
        'displayName', coalesce(nullif(profile.full_name,''), profile.email, 'Käyttäjä'),
        'email', profile.email,
        'customerId', cu.customer_id,
        'customerName', customer.name,
        'accessScope', cu.access_scope,
        'profile', cu.portal_profile,
        'permissions', private.customer_portal_base_permissions(cu.portal_profile) || cu.portal_permissions,
        'permissionOverrides', cu.portal_permissions,
        'disabledAt', cu.disabled_at,
        'lastPortalActivityAt', cu.last_portal_activity_at,
        'projectIds', coalesce((
          select jsonb_agg(cup.project_id) from public.customer_user_projects cup
          where cup.organization_id = cu.organization_id
            and cup.customer_id = cu.customer_id
            and cup.user_id = cu.user_id
        ), '[]'::jsonb)
      ) order by customer.name, profile.full_name, profile.email)
      from public.customer_users cu
      join public.customers customer on customer.id=cu.customer_id and customer.organization_id=cu.organization_id
      left join public.profiles profile on profile.id=cu.user_id
      where cu.organization_id = p_organization_id
    ), '[]'::jsonb),
    'inspections', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', inspection.id,
        'projectId', inspection.project_id,
        'projectName', project.name,
        'title', inspection.title,
        'type', inspection.inspection_type,
        'status', inspection.status,
        'progress', inspection.progress,
        'approvedAt', inspection.approved_at,
        'customerVisible', inspection.customer_visible,
        'publishedAt', inspection.customer_published_at
      ) order by inspection.updated_at desc)
      from public.inspections inspection
      join public.projects project on project.id=inspection.project_id
      where inspection.organization_id=p_organization_id
        and inspection.deleted_at is null
        and (inspection.approved_at is not null or inspection.customer_visible)
    ), '[]'::jsonb),
    'publications', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', publication.id,
        'customerId', coalesce(publication.customer_id, project.customer_id),
        'projectId', publication.project_id,
        'projectName', project.name,
        'type', publication.publication_type,
        'title', publication.title,
        'summary', coalesce(publication.summary, publication.body),
        'version', publication.version,
        'status', publication.status,
        'requiresAcknowledgement', publication.requires_acknowledgement,
        'publishedAt', publication.published_at,
        'acknowledgementCount', (select count(*) from public.customer_portal_acknowledgements acknowledgement where acknowledgement.publication_id=publication.id)
      ) order by publication.created_at desc)
      from public.customer_portal_publications publication
      join public.projects project on project.id=publication.project_id
      where publication.organization_id=p_organization_id
    ), '[]'::jsonb)
  );
end;
$$;

create or replace function public.management_update_customer_portal_order_v3(
  p_request_id uuid,
  p_status text,
  p_progress integer,
  p_planned_start_date date default null,
  p_planned_end_date date default null,
  p_supervisor_note text default null,
  p_assigned_supervisor_id uuid default null,
  p_participant_user_ids uuid[] default array[]::uuid[]
)
returns void
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  request_row public.customer_work_requests%rowtype;
  recipient record;
  participant_id uuid;
  status_description text;
begin
  select * into request_row from public.customer_work_requests where id=p_request_id for update;
  if request_row.id is null or auth.uid() is null
     or not private.is_operational_manager(request_row.organization_id, auth.uid()) then
    raise exception 'Tilausta ei voi päivittää.' using errcode='42501';
  end if;
  if p_status not in (
    'Uusi','Tarkennettava','Käsittelyssä','Hyväksytty','Suunnittelussa',
    'Työmääräys luotu','Aikataulutettu','Käynnissä','Odottaa','Valmis','Peruttu'
  ) then
    raise exception 'Virheellinen tila.' using errcode='23514';
  end if;
  if p_progress not between 0 and 100 then
    raise exception 'Etenemisen tulee olla välillä 0–100.' using errcode='23514';
  end if;
  if p_planned_start_date is not null and p_planned_end_date is not null and p_planned_end_date < p_planned_start_date then
    raise exception 'Suunniteltu päättymispäivä ei voi olla aloitusta ennen.' using errcode='23514';
  end if;
  if p_assigned_supervisor_id is not null and not exists (
    select 1 from public.organization_members om
    where om.organization_id=request_row.organization_id
      and om.user_id=p_assigned_supervisor_id
      and om.role in ('admin','supervisor','project_coordinator')
  ) then
    raise exception 'Vastuuhenkilö ei kuulu työnjohtoon.' using errcode='42501';
  end if;

  update public.customer_work_requests
  set status=p_status,
      progress=case when p_status='Valmis' then 100 else p_progress end,
      planned_start_date=p_planned_start_date,
      planned_end_date=p_planned_end_date,
      supervisor_note=nullif(trim(coalesce(p_supervisor_note,'')),''),
      assigned_supervisor_id=p_assigned_supervisor_id,
      completed_at=case when p_status='Valmis' then coalesce(completed_at,now()) else null end,
      last_activity_at=now()
  where id=p_request_id;

  insert into public.customer_work_request_participants(
    organization_id,request_id,user_id,participant_role,can_message,can_manage,can_decide,added_by
  ) values (
    request_row.organization_id,p_request_id,auth.uid(),'supervisor',true,true,false,auth.uid()
  ) on conflict (request_id,user_id) do update set participant_role='supervisor',can_message=true,can_manage=true;

  if p_assigned_supervisor_id is not null then
    insert into public.customer_work_request_participants(
      organization_id,request_id,user_id,participant_role,can_message,can_manage,can_decide,added_by
    ) values (
      request_row.organization_id,p_request_id,p_assigned_supervisor_id,'supervisor',true,true,false,auth.uid()
    ) on conflict (request_id,user_id) do update set participant_role='supervisor',can_message=true,can_manage=true;
  end if;

  foreach participant_id in array coalesce(p_participant_user_ids,array[]::uuid[])
  loop
    if exists (
      select 1 from public.organization_members om
      where om.organization_id=request_row.organization_id and om.user_id=participant_id
    ) then
      insert into public.customer_work_request_participants(
        organization_id,request_id,user_id,participant_role,can_message,can_manage,can_decide,added_by
      ) values (
        request_row.organization_id,p_request_id,participant_id,'worker',true,false,false,auth.uid()
      ) on conflict (request_id,user_id) do update set participant_role='worker',can_message=true;
    end if;
  end loop;

  status_description := case p_status
    when 'Tarkennettava' then coalesce(nullif(trim(coalesce(p_supervisor_note,'')),''),'Työnjohto pyytää lisätietoja tilauksesta.')
    when 'Aikataulutettu' then 'Työ on aikataulutettu.'
    when 'Käynnissä' then 'Työ on aloitettu.'
    when 'Odottaa' then coalesce(nullif(trim(coalesce(p_supervisor_note,'')),''),'Työ odottaa seuraavaa vaihetta.')
    when 'Valmis' then 'Työ on merkitty valmiiksi.'
    when 'Peruttu' then coalesce(nullif(trim(coalesce(p_supervisor_note,'')),''),'Työtilaus peruttiin.')
    else coalesce(nullif(trim(coalesce(p_supervisor_note,'')),''),'Tilauksen käsittelytilanne päivitettiin.')
  end;

  perform private.append_customer_order_event(
    p_request_id,'status_changed','Tilauksen tila: '||p_status,status_description,'customer',auth.uid(),
    jsonb_build_object(
      'oldStatus',request_row.status,'status',p_status,
      'progress',case when p_status='Valmis' then 100 else p_progress end,
      'plannedStartDate',p_planned_start_date,'plannedEndDate',p_planned_end_date
    )
  );

  for recipient in
    select cu.user_id
    from public.customer_users cu
    where cu.organization_id=request_row.organization_id
      and cu.customer_id=request_row.customer_id
      and cu.disabled_at is null
      and private.customer_user_can_access_project(request_row.project_id,request_row.organization_id,cu.user_id)
  loop
    perform private.upsert_portal_notification(
      request_row.organization_id,recipient.user_id,'customer_order_status',
      case when p_status in ('Tarkennettava','Odottaa') then 'warning' else 'info' end,
      'Työtilauksen tila päivittyi',request_row.order_number||' · '||p_status,
      '/tilaajan-tyot?order='||request_row.id::text,
      'customer_work_requests',request_row.id,
      'customer-order-status-'||request_row.id::text||'-'||extract(epoch from now())::bigint::text,
      jsonb_build_object('requestId',request_row.id,'status',p_status)
    );
  end loop;

  insert into public.audit_logs(organization_id,user_id,action,table_name,record_id,metadata)
  values (
    request_row.organization_id,auth.uid(),'customer_portal_order_managed',
    'customer_work_requests',request_row.id,
    jsonb_build_object('old_status',request_row.status,'status',p_status,'progress',p_progress)
  );
end;
$$;

create or replace function public.management_set_customer_portal_user_v3(
  p_organization_id uuid,
  p_customer_id uuid,
  p_user_id uuid,
  p_profile text,
  p_permissions jsonb default '{}'::jsonb,
  p_disabled boolean default false
)
returns void
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
begin
  if auth.uid() is null or not private.is_management_user(p_organization_id,auth.uid()) then
    raise exception 'Vain ylläpitäjä tai työnjohtaja voi muuttaa tilaajakäyttäjää.' using errcode='42501';
  end if;
  if p_profile not in ('viewer','contact','approver','admin','finance') then
    raise exception 'Virheellinen tilaajaprofiili.' using errcode='23514';
  end if;
  if jsonb_typeof(coalesce(p_permissions,'{}'::jsonb)) <> 'object' then
    raise exception 'Käyttöoikeuksien tulee olla JSON-objekti.' using errcode='23514';
  end if;
  update public.customer_users
  set portal_profile=p_profile,
      portal_permissions=coalesce(p_permissions,'{}'::jsonb),
      disabled_at=case when p_disabled then coalesce(disabled_at,now()) else null end
  where organization_id=p_organization_id and customer_id=p_customer_id and user_id=p_user_id;
  if not found then raise exception 'Tilaajakäyttäjää ei löytynyt.' using errcode='23503'; end if;
  insert into public.audit_logs(organization_id,user_id,action,table_name,record_id,metadata)
  values (
    p_organization_id,auth.uid(),'customer_portal_user_updated','customer_users',p_user_id,
    jsonb_build_object('customer_id',p_customer_id,'profile',p_profile,'disabled',p_disabled,'permissions',p_permissions)
  );
end;
$$;

create or replace function public.management_publish_customer_portal_item_v3(
  p_organization_id uuid,
  p_project_id uuid,
  p_publication_type text,
  p_title text,
  p_summary text default null,
  p_source_table text default null,
  p_source_id uuid default null,
  p_requires_acknowledgement boolean default false,
  p_metadata jsonb default '{}'::jsonb
)
returns uuid
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  project_row public.projects%rowtype;
  publication_id uuid;
  next_version integer;
  recipient record;
begin
  select * into project_row from public.projects where id=p_project_id and organization_id=p_organization_id;
  if project_row.id is null or project_row.customer_id is null or auth.uid() is null or not private.is_operational_manager(p_organization_id,auth.uid()) then
    raise exception 'Julkaisua ei voi tehdä.' using errcode='42501';
  end if;
  if char_length(trim(coalesce(p_title,''))) not between 2 and 180 then
    raise exception 'Anna julkaisulle otsikko.' using errcode='23514';
  end if;

  if p_source_table is not null and p_source_id is not null then
    update public.customer_portal_publications
    set status='superseded',superseded_at=now()
    where organization_id=p_organization_id
      and source_table=p_source_table and source_id=p_source_id and status='published';
    select coalesce(max(version),0)+1 into next_version
    from public.customer_portal_publications
    where organization_id=p_organization_id and source_table=p_source_table and source_id=p_source_id;
  else
    next_version:=1;
  end if;

  insert into public.customer_portal_publications(
    organization_id,customer_id,project_id,source_table,source_id,publication_type,
    title,summary,body,version,status,requires_acknowledgement,published_by,published_at,metadata
  ) values (
    p_organization_id,project_row.customer_id,p_project_id,p_source_table,p_source_id,
    trim(p_publication_type),trim(p_title),nullif(trim(coalesce(p_summary,'')),''),
    nullif(trim(coalesce(p_summary,'')),''),next_version,'published',
    p_requires_acknowledgement,auth.uid(),now(),coalesce(p_metadata,'{}'::jsonb)
  ) returning id into publication_id;

  for recipient in
    select cu.user_id from public.customer_users cu
    where cu.organization_id=p_organization_id and cu.customer_id=project_row.customer_id
      and cu.disabled_at is null
      and private.customer_user_can_access_project(p_project_id,p_organization_id,cu.user_id)
  loop
    perform private.upsert_portal_notification(
      p_organization_id,recipient.user_id,'customer_portal_publication','info',
      'Uusi julkaisu projektissa',trim(p_title),
      '/tilaajan-projektit/'||p_project_id::text,
      'customer_portal_publications',publication_id,
      'customer-publication-'||publication_id::text||'-'||recipient.user_id::text,
      jsonb_build_object('publicationId',publication_id,'projectId',p_project_id)
    );
  end loop;

  insert into public.audit_logs(organization_id,user_id,action,table_name,record_id,metadata)
  values (
    p_organization_id,auth.uid(),'customer_portal_item_published',
    'customer_portal_publications',publication_id,
    jsonb_build_object('project_id',p_project_id,'type',p_publication_type,'source_table',p_source_table,'source_id',p_source_id)
  );
  return publication_id;
end;
$$;

create or replace function public.acknowledge_customer_portal_publication_v3(
  p_publication_id uuid,
  p_note text default null
)
returns void
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  publication_row public.customer_portal_publications%rowtype;
  snapshot_value jsonb;
  snapshot_hash text;
begin
  select * into publication_row from public.customer_portal_publications where id=p_publication_id;
  if publication_row.id is null or auth.uid() is null
     or publication_row.status<>'published'
     or not private.customer_user_can_access_project(publication_row.project_id,publication_row.organization_id,auth.uid()) then
    raise exception 'Julkaisua ei voi kuitata.' using errcode='42501';
  end if;

  insert into public.customer_portal_acknowledgements(
    publication_id,organization_id,user_id,note,acknowledgement_note
  ) values (
    publication_row.id,publication_row.organization_id,auth.uid(),
    nullif(trim(coalesce(p_note,'')),''),nullif(trim(coalesce(p_note,'')),'')
  )
  on conflict (publication_id,user_id) do update
  set note=excluded.note,acknowledgement_note=excluded.acknowledgement_note,acknowledged_at=now();

  snapshot_value := jsonb_build_object(
    'publicationId',publication_row.id,
    'title',publication_row.title,
    'version',publication_row.version
  );
  snapshot_hash := md5(publication_row.id::text||':'||publication_row.version::text||':'||auth.uid()::text);

  insert into public.customer_portal_decision_snapshots(
    organization_id,customer_id,project_id,subject_type,subject_id,subject_version,
    decision,note,decision_note,snapshot,payload,content_hash,payload_hash,decided_by
  ) values (
    publication_row.organization_id,publication_row.customer_id,publication_row.project_id,
    'inspection_acknowledgement',publication_row.id,publication_row.version,'acknowledged',
    nullif(trim(coalesce(p_note,'')),''),nullif(trim(coalesce(p_note,'')),''),
    snapshot_value,snapshot_value,snapshot_hash,snapshot_hash,auth.uid()
  );
end;
$$;

create or replace function public.management_set_inspection_customer_visibility_v3(
  p_inspection_id uuid,
  p_visible boolean,
  p_requires_acknowledgement boolean default false
)
returns void
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  inspection_row public.inspections%rowtype;
begin
  select * into inspection_row from public.inspections where id=p_inspection_id for update;
  if inspection_row.id is null or auth.uid() is null
     or not private.is_operational_manager(inspection_row.organization_id,auth.uid()) then
    raise exception 'Tarkastuksen julkaisua ei voi muuttaa.' using errcode='42501';
  end if;
  if p_visible and inspection_row.approved_at is null then
    raise exception 'Vain hyväksytyn tarkastuksen voi julkaista tilaajalle.' using errcode='23514';
  end if;

  update public.inspections
  set customer_visible=p_visible,
      customer_published_at=case when p_visible then now() else null end,
      customer_published_by=case when p_visible then auth.uid() else null end
  where id=p_inspection_id;

  if p_visible then
    perform public.management_publish_customer_portal_item_v3(
      inspection_row.organization_id,inspection_row.project_id,'inspection',inspection_row.title,
      coalesce(inspection_row.summary,'Hyväksytty tarkastusraportti on julkaistu tilaajalle.'),
      'inspections',inspection_row.id,p_requires_acknowledgement,
      jsonb_build_object(
        'inspectionType',inspection_row.inspection_type,
        'status',inspection_row.status,
        'progress',inspection_row.progress
      )
    );
  else
    update public.customer_portal_publications
    set status='withdrawn',withdrawn_at=now()
    where organization_id=inspection_row.organization_id
      and source_table='inspections' and source_id=inspection_row.id and status='published';
  end if;
end;
$$;

revoke all on function public.management_customer_portal_dashboard_v3(uuid) from public, anon;
revoke all on function public.management_update_customer_portal_order_v3(uuid, text, integer, date, date, text, uuid, uuid[]) from public, anon;
revoke all on function public.management_set_customer_portal_user_v3(uuid, uuid, uuid, text, jsonb, boolean) from public, anon;
revoke all on function public.management_publish_customer_portal_item_v3(uuid, uuid, text, text, text, text, uuid, boolean, jsonb) from public, anon;
revoke all on function public.acknowledge_customer_portal_publication_v3(uuid, text) from public, anon;
revoke all on function public.management_set_inspection_customer_visibility_v3(uuid, boolean, boolean) from public, anon;

grant execute on function public.management_customer_portal_dashboard_v3(uuid) to authenticated;
grant execute on function public.management_update_customer_portal_order_v3(uuid, text, integer, date, date, text, uuid, uuid[]) to authenticated;
grant execute on function public.management_set_customer_portal_user_v3(uuid, uuid, uuid, text, jsonb, boolean) to authenticated;
grant execute on function public.management_publish_customer_portal_item_v3(uuid, uuid, text, text, text, text, uuid, boolean, jsonb) to authenticated;
grant execute on function public.acknowledge_customer_portal_publication_v3(uuid, text) to authenticated;
grant execute on function public.management_set_inspection_customer_visibility_v3(uuid, boolean, boolean) to authenticated;

commit;
