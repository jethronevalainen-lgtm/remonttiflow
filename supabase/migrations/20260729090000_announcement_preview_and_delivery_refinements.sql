begin;

create or replace function public.preview_announcement_recipients(
  p_organization_id uuid,
  p_targets jsonb
)
returns table (
  user_id uuid,
  display_name text,
  email text,
  role text
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null
     or not private.is_announcement_manager(p_organization_id, auth.uid()) then
    raise exception 'Vastaanottajien esikatseluoikeus puuttuu.' using errcode = '42501';
  end if;

  if jsonb_typeof(p_targets) <> 'array' then
    return;
  end if;

  return query
  with targets as (
    select item
    from jsonb_array_elements(p_targets) item
    where item->>'type' in ('organization', 'role', 'team', 'project', 'project_customer', 'user')
  ), candidates as (
    select om.user_id
    from targets t
    join public.organization_members om
      on om.organization_id = p_organization_id
     and om.role in ('admin', 'supervisor', 'project_coordinator', 'worker')
    where t.item->>'type' = 'organization'

    union

    select om.user_id
    from targets t
    join public.organization_members om
      on om.organization_id = p_organization_id
     and om.role = t.item->>'role'
    where t.item->>'type' = 'role'

    union

    select (t.item->>'userId')::uuid
    from targets t
    where t.item->>'type' = 'user'
      and nullif(t.item->>'userId', '') is not null

    union

    select e.user_id
    from targets t
    join public.supervisor_team_members stm
      on stm.organization_id = p_organization_id
     and stm.supervisor_user_id = (t.item->>'supervisorUserId')::uuid
     and stm.is_active
    join public.employees e
      on e.organization_id = stm.organization_id
     and e.id = stm.employee_id
     and e.user_id is not null
     and e.archived_at is null
    where t.item->>'type' = 'team'
      and nullif(t.item->>'supervisorUserId', '') is not null

    union

    select pm.user_id
    from targets t
    join public.project_members pm
      on pm.organization_id = p_organization_id
     and pm.project_id = (t.item->>'projectId')::uuid
    where t.item->>'type' = 'project'
      and nullif(t.item->>'projectId', '') is not null

    union

    select wa.user_id
    from targets t
    join public.work_orders wo
      on wo.organization_id = p_organization_id
     and wo.project_id = (t.item->>'projectId')::uuid
    join public.work_order_assignees wa
      on wa.organization_id = wo.organization_id
     and wa.work_order_id = wo.id
    where t.item->>'type' = 'project'
      and nullif(t.item->>'projectId', '') is not null

    union

    select selected.user_id
    from targets t
    join public.projects p
      on p.organization_id = p_organization_id
     and p.id = (t.item->>'projectId')::uuid
    cross join lateral (
      values (p.responsible_supervisor_id), (p.project_manager_id)
    ) selected(user_id)
    where t.item->>'type' = 'project'
      and nullif(t.item->>'projectId', '') is not null
      and selected.user_id is not null

    union

    select cu.user_id
    from targets t
    join public.projects p
      on p.organization_id = p_organization_id
     and p.id = (t.item->>'projectId')::uuid
    join public.customer_users cu
      on cu.organization_id = p.organization_id
     and cu.customer_id = p.customer_id
    where t.item->>'type' = 'project_customer'
      and nullif(t.item->>'projectId', '') is not null
  )
  select
    om.user_id,
    coalesce(nullif(trim(p.full_name), ''), nullif(trim(p.email), ''), 'Nimetön käyttäjä'),
    coalesce(p.email, ''),
    om.role
  from candidates c
  join public.organization_members om
    on om.organization_id = p_organization_id
   and om.user_id = c.user_id
   and om.disabled_at is null
   and om.invitation_status = 'active'
  join public.profiles p on p.id = om.user_id
  order by coalesce(nullif(trim(p.full_name), ''), nullif(trim(p.email), ''), 'Nimetön käyttäjä');
end;
$$;

revoke all on function public.preview_announcement_recipients(uuid, jsonb) from public, anon;
grant execute on function public.preview_announcement_recipients(uuid, jsonb) to authenticated;

create or replace function public.list_visible_announcements_v2(
  p_organization_id uuid,
  p_placement text,
  p_project_id uuid default null,
  p_work_order_id uuid default null
)
returns table (
  id uuid,
  title text,
  content text,
  priority text,
  author text,
  status text,
  published_at timestamptz,
  starts_at timestamptz,
  expires_at timestamptz,
  require_acknowledgement boolean,
  dismissible boolean,
  pinned boolean,
  link_path text,
  related_project_id uuid,
  related_work_order_id uuid,
  recipient_count bigint,
  seen_count bigint,
  acknowledged_count bigint,
  first_shown_at timestamptz,
  opened_at timestamptz,
  read_at timestamptz,
  acknowledged_at timestamptz,
  dismissed_at timestamptz
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    a.id,
    a.title,
    coalesce(a.content, ''),
    a.priority,
    coalesce(a.author, 'Käyttäjä'),
    a.status,
    a.published_at,
    coalesce(a.starts_at, a.published_at),
    a.expires_at,
    a.require_acknowledgement,
    a.dismissible,
    a.pinned,
    a.link_path,
    (
      select ap.project_id
      from public.announcement_placements ap
      where ap.announcement_id = a.id
        and ap.placement = 'project'
      order by ap.created_at
      limit 1
    ),
    (
      select ap.work_order_id
      from public.announcement_placements ap
      where ap.announcement_id = a.id
        and ap.placement = 'work_order'
      order by ap.created_at
      limit 1
    ),
    (select count(*) from public.announcement_recipients total where total.announcement_id = a.id),
    (select count(*) from public.announcement_recipients seen where seen.announcement_id = a.id and seen.first_shown_at is not null),
    (select count(*) from public.announcement_recipients ack where ack.announcement_id = a.id and ack.acknowledged_at is not null),
    ar.first_shown_at,
    ar.opened_at,
    ar.read_at,
    ar.acknowledged_at,
    ar.dismissed_at
  from public.announcements a
  join public.announcement_recipients ar
    on ar.announcement_id = a.id
   and ar.organization_id = a.organization_id
   and ar.user_id = auth.uid()
  where a.organization_id = p_organization_id
    and exists (
      select 1
      from public.organization_members om
      where om.organization_id = p_organization_id
        and om.user_id = auth.uid()
        and om.disabled_at is null
        and om.invitation_status = 'active'
    )
    and exists (
      select 1
      from public.announcement_placements ap
      where ap.announcement_id = a.id
        and ap.placement = p_placement
        and (p_placement <> 'project' or p_project_id is null or ap.project_id = p_project_id)
        and (p_placement <> 'work_order' or p_work_order_id is null or ap.work_order_id = p_work_order_id)
    )
    and (
      (p_placement = 'archive' and a.status in ('published', 'expired'))
      or (
        p_placement <> 'archive'
        and a.status = 'published'
        and coalesce(a.starts_at, a.published_at) <= now()
        and (a.expires_at is null or a.expires_at > now())
      )
    )
    and not (p_placement = 'banner' and ar.dismissed_at is not null)
  order by
    a.pinned desc,
    case a.priority when 'Kriittinen' then 0 when 'Tärkeä' then 1 when 'Normaali' then 2 else 3 end,
    coalesce(a.starts_at, a.published_at) desc;
$$;

revoke all on function public.list_visible_announcements_v2(uuid, text, uuid, uuid) from public, anon;
grant execute on function public.list_visible_announcements_v2(uuid, text, uuid, uuid) to authenticated;

create or replace function public.list_announcement_receipts(
  p_organization_id uuid,
  p_announcement_id uuid
)
returns table (
  user_id uuid,
  display_name text,
  email text,
  role text,
  matched_by jsonb,
  delivered_at timestamptz,
  first_shown_at timestamptz,
  opened_at timestamptz,
  read_at timestamptz,
  acknowledged_at timestamptz,
  dismissed_at timestamptz
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null
     or not private.is_announcement_manager(p_organization_id, auth.uid()) then
    raise exception 'Toimitusraportin katseluoikeus puuttuu.' using errcode = '42501';
  end if;

  return query
  select
    ar.user_id,
    coalesce(nullif(trim(p.full_name), ''), nullif(trim(p.email), ''), 'Nimetön käyttäjä'),
    coalesce(p.email, ''),
    om.role,
    ar.matched_by,
    ar.delivered_at,
    ar.first_shown_at,
    ar.opened_at,
    ar.read_at,
    ar.acknowledged_at,
    ar.dismissed_at
  from public.announcement_recipients ar
  join public.profiles p on p.id = ar.user_id
  join public.organization_members om
    on om.organization_id = ar.organization_id
   and om.user_id = ar.user_id
  where ar.organization_id = p_organization_id
    and ar.announcement_id = p_announcement_id
  order by
    (ar.acknowledged_at is null) desc,
    (ar.opened_at is null) desc,
    coalesce(nullif(trim(p.full_name), ''), nullif(trim(p.email), ''), 'Nimetön käyttäjä');
end;
$$;

revoke all on function public.list_announcement_receipts(uuid, uuid) from public, anon;
grant execute on function public.list_announcement_receipts(uuid, uuid) to authenticated;

create or replace function private.dispatch_announcement_notifications(
  p_announcement_id uuid
)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_count integer;
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
    created_at,
    updated_at
  )
  select
    a.organization_id,
    ar.user_id,
    'announcement_published',
    case a.priority
      when 'Kriittinen' then 'danger'
      when 'Tärkeä' then 'warning'
      else 'info'
    end,
    a.title,
    left(regexp_replace(coalesce(nullif(a.content, ''), 'Avaa tiedote lukeaksesi sisällön.'), E'[\\n\\r]+', ' ', 'g'), 240),
    '/viestinta?announcement=' || a.id::text,
    'announcements',
    a.id,
    'announcement:' || a.id::text,
    jsonb_build_object(
      'announcement_id', a.id,
      'priority', a.priority,
      'require_acknowledgement', a.require_acknowledgement
    ),
    now(),
    now()
  from public.announcements a
  join public.announcement_recipients ar
    on ar.announcement_id = a.id
   and ar.organization_id = a.organization_id
  where a.id = p_announcement_id
    and a.status = 'published'
    and coalesce(a.starts_at, a.published_at) <= now()
    and (a.expires_at is null or a.expires_at > now())
    and exists (
      select 1
      from public.announcement_placements ap
      where ap.announcement_id = a.id
        and ap.placement = 'notification_center'
    )
  on conflict (organization_id, recipient_user_id, dedup_key)
  do update set
    severity = excluded.severity,
    title = excluded.title,
    body = excluded.body,
    path = excluded.path,
    metadata = excluded.metadata,
    resolved_at = null,
    updated_at = now();

  get diagnostics v_count = row_count;

  update public.announcement_recipients ar
  set delivered_at = coalesce(ar.delivered_at, now()),
      updated_at = now()
  where ar.announcement_id = p_announcement_id;

  return v_count;
end;
$$;

revoke all on function private.dispatch_announcement_notifications(uuid) from public, anon, authenticated;

commit;
