begin;

alter table public.announcements
  add column if not exists status text not null default 'published',
  add column if not exists starts_at timestamptz,
  add column if not exists expires_at timestamptz,
  add column if not exists require_acknowledgement boolean not null default false,
  add column if not exists dismissible boolean not null default true,
  add column if not exists pinned boolean not null default false,
  add column if not exists link_path text;

update public.announcements
set starts_at = coalesce(starts_at, published_at),
    status = case
      when expires_at is not null and expires_at <= now() then 'expired'
      else coalesce(nullif(status, ''), 'published')
    end
where starts_at is null or status is null or status = '';

alter table public.announcements
  alter column starts_at set default now();

alter table public.announcements
  drop constraint if exists announcements_status_check;
alter table public.announcements
  add constraint announcements_status_check
  check (status in ('draft', 'scheduled', 'published', 'expired'));

alter table public.announcements
  drop constraint if exists announcements_priority_check;
alter table public.announcements
  add constraint announcements_priority_check
  check (priority in ('Info', 'Normaali', 'Tärkeä', 'Kriittinen'));

alter table public.announcements
  drop constraint if exists announcements_time_window_check;
alter table public.announcements
  add constraint announcements_time_window_check
  check (expires_at is null or starts_at is null or expires_at > starts_at);

create table if not exists public.announcement_targets (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  announcement_id uuid not null references public.announcements(id) on delete cascade,
  target_type text not null,
  target_role text,
  target_user_id uuid references public.profiles(id) on delete cascade,
  target_project_id uuid references public.projects(id) on delete cascade,
  target_supervisor_user_id uuid references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  constraint announcement_targets_type_check check (
    target_type in ('organization', 'role', 'team', 'project', 'project_customer', 'user')
  ),
  constraint announcement_targets_shape_check check (
    (target_type = 'organization' and target_role is null and target_user_id is null and target_project_id is null and target_supervisor_user_id is null)
    or (target_type = 'role' and target_role in ('admin', 'supervisor', 'project_coordinator', 'worker', 'customer') and target_user_id is null and target_project_id is null and target_supervisor_user_id is null)
    or (target_type = 'team' and target_supervisor_user_id is not null and target_role is null and target_user_id is null and target_project_id is null)
    or (target_type in ('project', 'project_customer') and target_project_id is not null and target_role is null and target_user_id is null and target_supervisor_user_id is null)
    or (target_type = 'user' and target_user_id is not null and target_role is null and target_project_id is null and target_supervisor_user_id is null)
  )
);

create unique index if not exists announcement_targets_unique_idx
  on public.announcement_targets (
    announcement_id,
    target_type,
    coalesce(target_role, ''),
    coalesce(target_user_id, '00000000-0000-0000-0000-000000000000'::uuid),
    coalesce(target_project_id, '00000000-0000-0000-0000-000000000000'::uuid),
    coalesce(target_supervisor_user_id, '00000000-0000-0000-0000-000000000000'::uuid)
  );

create index if not exists announcement_targets_org_announcement_idx
  on public.announcement_targets (organization_id, announcement_id);

create table if not exists public.announcement_placements (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  announcement_id uuid not null references public.announcements(id) on delete cascade,
  placement text not null,
  project_id uuid references public.projects(id) on delete cascade,
  work_order_id uuid references public.work_orders(id) on delete cascade,
  created_at timestamptz not null default now(),
  constraint announcement_placements_type_check check (
    placement in ('archive', 'dashboard', 'notification_center', 'banner', 'project', 'work_order')
  ),
  constraint announcement_placements_shape_check check (
    (placement in ('archive', 'dashboard', 'notification_center', 'banner') and project_id is null and work_order_id is null)
    or (placement = 'project' and project_id is not null and work_order_id is null)
    or (placement = 'work_order' and work_order_id is not null and project_id is null)
  )
);

create unique index if not exists announcement_placements_unique_idx
  on public.announcement_placements (
    announcement_id,
    placement,
    coalesce(project_id, '00000000-0000-0000-0000-000000000000'::uuid),
    coalesce(work_order_id, '00000000-0000-0000-0000-000000000000'::uuid)
  );

create index if not exists announcement_placements_lookup_idx
  on public.announcement_placements (organization_id, placement, project_id, work_order_id);

create table if not exists public.announcement_recipients (
  organization_id uuid not null references public.organizations(id) on delete cascade,
  announcement_id uuid not null references public.announcements(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  matched_by jsonb not null default '[]'::jsonb,
  delivered_at timestamptz,
  first_shown_at timestamptz,
  opened_at timestamptz,
  read_at timestamptz,
  acknowledged_at timestamptz,
  dismissed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (announcement_id, user_id)
);

create index if not exists announcement_recipients_user_idx
  on public.announcement_recipients (organization_id, user_id, announcement_id);
create index if not exists announcement_recipients_ack_idx
  on public.announcement_recipients (announcement_id, acknowledged_at);

alter table public.announcement_targets enable row level security;
alter table public.announcement_placements enable row level security;
alter table public.announcement_recipients enable row level security;

revoke all on public.announcement_targets from public, anon, authenticated;
revoke all on public.announcement_placements from public, anon, authenticated;
revoke all on public.announcement_recipients from public, anon, authenticated;
grant select on public.announcement_recipients to authenticated;
grant all on public.announcement_targets, public.announcement_placements, public.announcement_recipients to service_role;

create or replace function private.is_announcement_manager(
  p_organization_id uuid,
  p_user_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.organization_members om
    where om.organization_id = p_organization_id
      and om.user_id = p_user_id
      and om.role in ('admin', 'supervisor', 'project_coordinator')
      and om.disabled_at is null
      and om.invitation_status = 'active'
  );
$$;

revoke all on function private.is_announcement_manager(uuid, uuid) from public, anon, authenticated;

create or replace function private.resolve_announcement_recipients(
  p_announcement_id uuid
)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_organization_id uuid;
  v_count integer;
begin
  select a.organization_id
  into v_organization_id
  from public.announcements a
  where a.id = p_announcement_id;

  if v_organization_id is null then
    raise exception 'Tiedotetta ei löytynyt.' using errcode = 'P0002';
  end if;

  delete from public.announcement_recipients ar
  where ar.announcement_id = p_announcement_id;

  with candidate_sources as (
    select om.user_id, jsonb_build_object('type', 'organization') as source
    from public.announcement_targets at
    join public.organization_members om
      on om.organization_id = at.organization_id
     and om.role in ('admin', 'supervisor', 'project_coordinator', 'worker')
    where at.announcement_id = p_announcement_id
      and at.target_type = 'organization'

    union all

    select om.user_id, jsonb_build_object('type', 'role', 'role', at.target_role)
    from public.announcement_targets at
    join public.organization_members om
      on om.organization_id = at.organization_id
     and om.role = at.target_role
    where at.announcement_id = p_announcement_id
      and at.target_type = 'role'

    union all

    select at.target_user_id, jsonb_build_object('type', 'user', 'userId', at.target_user_id)
    from public.announcement_targets at
    where at.announcement_id = p_announcement_id
      and at.target_type = 'user'
      and at.target_user_id is not null

    union all

    select e.user_id, jsonb_build_object('type', 'team', 'supervisorUserId', at.target_supervisor_user_id)
    from public.announcement_targets at
    join public.supervisor_team_members stm
      on stm.organization_id = at.organization_id
     and stm.supervisor_user_id = at.target_supervisor_user_id
     and stm.is_active
    join public.employees e
      on e.id = stm.employee_id
     and e.organization_id = stm.organization_id
     and e.user_id is not null
     and e.archived_at is null
    where at.announcement_id = p_announcement_id
      and at.target_type = 'team'

    union all

    select pm.user_id, jsonb_build_object('type', 'project', 'projectId', at.target_project_id)
    from public.announcement_targets at
    join public.project_members pm
      on pm.organization_id = at.organization_id
     and pm.project_id = at.target_project_id
    where at.announcement_id = p_announcement_id
      and at.target_type = 'project'

    union all

    select wa.user_id, jsonb_build_object('type', 'project', 'projectId', at.target_project_id)
    from public.announcement_targets at
    join public.work_orders wo
      on wo.organization_id = at.organization_id
     and wo.project_id = at.target_project_id
    join public.work_order_assignees wa
      on wa.organization_id = wo.organization_id
     and wa.work_order_id = wo.id
    where at.announcement_id = p_announcement_id
      and at.target_type = 'project'

    union all

    select selected.user_id, jsonb_build_object('type', 'project', 'projectId', at.target_project_id)
    from public.announcement_targets at
    join public.projects p
      on p.organization_id = at.organization_id
     and p.id = at.target_project_id
    cross join lateral (
      values (p.responsible_supervisor_id), (p.project_manager_id)
    ) selected(user_id)
    where at.announcement_id = p_announcement_id
      and at.target_type = 'project'
      and selected.user_id is not null

    union all

    select cu.user_id, jsonb_build_object('type', 'project_customer', 'projectId', at.target_project_id)
    from public.announcement_targets at
    join public.projects p
      on p.organization_id = at.organization_id
     and p.id = at.target_project_id
    join public.customer_users cu
      on cu.organization_id = p.organization_id
     and cu.customer_id = p.customer_id
    where at.announcement_id = p_announcement_id
      and at.target_type = 'project_customer'
  ), eligible as (
    select cs.user_id, cs.source
    from candidate_sources cs
    join public.organization_members om
      on om.organization_id = v_organization_id
     and om.user_id = cs.user_id
     and om.disabled_at is null
     and om.invitation_status = 'active'
    where cs.user_id is not null
  ), aggregated as (
    select user_id, jsonb_agg(distinct source) as matched_by
    from eligible
    group by user_id
  )
  insert into public.announcement_recipients (
    organization_id,
    announcement_id,
    user_id,
    matched_by
  )
  select v_organization_id, p_announcement_id, a.user_id, a.matched_by
  from aggregated a;

  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

revoke all on function private.resolve_announcement_recipients(uuid) from public, anon, authenticated;

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
    coalesce(nullif(a.content, ''), 'Avaa tiedote lukeaksesi sisällön.'),
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

create or replace function public.create_announcement_v2(
  p_organization_id uuid,
  p_title text,
  p_content text,
  p_priority text,
  p_status text,
  p_starts_at timestamptz,
  p_expires_at timestamptz,
  p_require_acknowledgement boolean,
  p_dismissible boolean,
  p_pinned boolean,
  p_link_path text,
  p_targets jsonb,
  p_placements jsonb
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id uuid;
  v_status text;
  v_recipient_count integer;
begin
  if auth.uid() is null
     or not private.is_announcement_manager(p_organization_id, auth.uid()) then
    raise exception 'Tiedotteen julkaisuun ei ole oikeutta.' using errcode = '42501';
  end if;

  if char_length(trim(coalesce(p_title, ''))) not between 3 and 180 then
    raise exception 'Tiedotteen otsikon pitää olla 3–180 merkkiä.' using errcode = '23514';
  end if;
  if char_length(trim(coalesce(p_content, ''))) not between 1 and 10000 then
    raise exception 'Tiedotteen sisällön pitää olla 1–10 000 merkkiä.' using errcode = '23514';
  end if;
  if p_priority not in ('Info', 'Normaali', 'Tärkeä', 'Kriittinen') then
    raise exception 'Tiedotteen prioriteetti on virheellinen.' using errcode = '23514';
  end if;
  if p_status not in ('draft', 'scheduled', 'published') then
    raise exception 'Tiedotteen tila on virheellinen.' using errcode = '23514';
  end if;
  if jsonb_typeof(p_targets) <> 'array' or jsonb_array_length(p_targets) = 0 then
    raise exception 'Valitse vähintään yksi vastaanottajaryhmä.' using errcode = '23514';
  end if;
  if p_expires_at is not null and p_expires_at <= coalesce(p_starts_at, now()) then
    raise exception 'Päättymisajan pitää olla alkamisajan jälkeen.' using errcode = '23514';
  end if;

  v_status := case
    when p_status = 'draft' then 'draft'
    when coalesce(p_starts_at, now()) > now() then 'scheduled'
    else 'published'
  end;

  insert into public.announcements (
    organization_id,
    created_by,
    title,
    content,
    priority,
    author,
    published_at,
    status,
    starts_at,
    expires_at,
    require_acknowledgement,
    dismissible,
    pinned,
    link_path
  )
  select
    p_organization_id,
    auth.uid(),
    trim(p_title),
    trim(p_content),
    p_priority,
    coalesce(nullif(trim(p.full_name), ''), nullif(trim(p.email), ''), 'Käyttäjä'),
    case when v_status = 'published' then now() else coalesce(p_starts_at, now()) end,
    v_status,
    coalesce(p_starts_at, now()),
    p_expires_at,
    coalesce(p_require_acknowledgement, false),
    case when coalesce(p_require_acknowledgement, false) then false else coalesce(p_dismissible, true) end,
    coalesce(p_pinned, false),
    nullif(trim(coalesce(p_link_path, '')), '')
  from public.profiles p
  where p.id = auth.uid()
  returning id into v_id;

  insert into public.announcement_targets (
    organization_id,
    announcement_id,
    target_type,
    target_role,
    target_user_id,
    target_project_id,
    target_supervisor_user_id
  )
  select
    p_organization_id,
    v_id,
    item->>'type',
    nullif(item->>'role', ''),
    case when item->>'type' = 'user' then (item->>'userId')::uuid else null end,
    case when item->>'type' in ('project', 'project_customer') then (item->>'projectId')::uuid else null end,
    case when item->>'type' = 'team' then (item->>'supervisorUserId')::uuid else null end
  from jsonb_array_elements(p_targets) item
  where item->>'type' in ('organization', 'role', 'team', 'project', 'project_customer', 'user')
  on conflict do nothing;

  insert into public.announcement_placements (
    organization_id,
    announcement_id,
    placement,
    project_id,
    work_order_id
  ) values (
    p_organization_id,
    v_id,
    'archive',
    null,
    null
  )
  on conflict do nothing;

  if jsonb_typeof(coalesce(p_placements, '[]'::jsonb)) = 'array' then
    insert into public.announcement_placements (
      organization_id,
      announcement_id,
      placement,
      project_id,
      work_order_id
    )
    select
      p_organization_id,
      v_id,
      item->>'type',
      case when item->>'type' = 'project' then (item->>'projectId')::uuid else null end,
      case when item->>'type' = 'work_order' then (item->>'workOrderId')::uuid else null end
    from jsonb_array_elements(p_placements) item
    where item->>'type' in ('archive', 'dashboard', 'notification_center', 'banner', 'project', 'work_order')
    on conflict do nothing;
  end if;

  v_recipient_count := private.resolve_announcement_recipients(v_id);
  if v_recipient_count = 0 then
    raise exception 'Valittu kohdistus ei tuota yhtään vastaanottajaa.' using errcode = '23514';
  end if;

  if v_status = 'published' then
    perform private.dispatch_announcement_notifications(v_id);
  end if;

  insert into public.audit_logs (
    organization_id,
    user_id,
    action,
    table_name,
    record_id,
    metadata
  ) values (
    p_organization_id,
    auth.uid(),
    'announcement_created',
    'announcements',
    v_id,
    jsonb_build_object(
      'status', v_status,
      'priority', p_priority,
      'recipient_count', v_recipient_count,
      'placements', p_placements,
      'targets', p_targets
    )
  );

  return v_id;
end;
$$;

revoke all on function public.create_announcement_v2(uuid, text, text, text, text, timestamptz, timestamptz, boolean, boolean, boolean, text, jsonb, jsonb) from public, anon;
grant execute on function public.create_announcement_v2(uuid, text, text, text, text, timestamptz, timestamptz, boolean, boolean, boolean, text, jsonb, jsonb) to authenticated;

create or replace function public.list_visible_announcements(
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
        and (p_placement <> 'project' or ap.project_id = p_project_id)
        and (p_placement <> 'work_order' or ap.work_order_id = p_work_order_id)
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
    and not (
      p_placement = 'banner'
      and ar.dismissed_at is not null
    )
  order by
    a.pinned desc,
    case a.priority when 'Kriittinen' then 0 when 'Tärkeä' then 1 when 'Normaali' then 2 else 3 end,
    coalesce(a.starts_at, a.published_at) desc;
$$;

revoke all on function public.list_visible_announcements(uuid, text, uuid, uuid) from public, anon;
grant execute on function public.list_visible_announcements(uuid, text, uuid, uuid) to authenticated;

create or replace function public.list_managed_announcements(
  p_organization_id uuid
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
  recipient_count bigint,
  seen_count bigint,
  opened_count bigint,
  acknowledged_count bigint,
  placement_labels text[],
  target_labels text[]
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null
     or not private.is_announcement_manager(p_organization_id, auth.uid()) then
    raise exception 'Tiedotteiden hallintaoikeus puuttuu.' using errcode = '42501';
  end if;

  return query
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
    (select count(*) from public.announcement_recipients ar where ar.announcement_id = a.id),
    (select count(*) from public.announcement_recipients ar where ar.announcement_id = a.id and ar.first_shown_at is not null),
    (select count(*) from public.announcement_recipients ar where ar.announcement_id = a.id and ar.opened_at is not null),
    (select count(*) from public.announcement_recipients ar where ar.announcement_id = a.id and ar.acknowledged_at is not null),
    coalesce((
      select array_agg(distinct ap.placement order by ap.placement)
      from public.announcement_placements ap
      where ap.announcement_id = a.id
    ), array[]::text[]),
    coalesce((
      select array_agg(distinct at.target_type order by at.target_type)
      from public.announcement_targets at
      where at.announcement_id = a.id
    ), array[]::text[])
  from public.announcements a
  where a.organization_id = p_organization_id
  order by a.created_at desc;
end;
$$;

revoke all on function public.list_managed_announcements(uuid) from public, anon;
grant execute on function public.list_managed_announcements(uuid) to authenticated;

create or replace function public.list_announcement_directory(
  p_organization_id uuid
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
    raise exception 'Vastaanottajahakemiston käyttöoikeus puuttuu.' using errcode = '42501';
  end if;

  return query
  select
    om.user_id,
    coalesce(nullif(trim(p.full_name), ''), nullif(trim(p.email), ''), 'Nimetön käyttäjä'),
    coalesce(p.email, ''),
    om.role
  from public.organization_members om
  join public.profiles p on p.id = om.user_id
  where om.organization_id = p_organization_id
    and om.disabled_at is null
    and om.invitation_status = 'active'
  order by coalesce(nullif(trim(p.full_name), ''), nullif(trim(p.email), ''), 'Nimetön käyttäjä');
end;
$$;

revoke all on function public.list_announcement_directory(uuid) from public, anon;
grant execute on function public.list_announcement_directory(uuid) to authenticated;

create or replace function public.record_announcement_event(
  p_announcement_id uuid,
  p_event text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_require_ack boolean;
  v_dismissible boolean;
begin
  if auth.uid() is null then
    raise exception 'Kirjautuminen vaaditaan.' using errcode = '42501';
  end if;

  select a.require_acknowledgement, a.dismissible
  into v_require_ack, v_dismissible
  from public.announcements a
  join public.announcement_recipients ar
    on ar.announcement_id = a.id
   and ar.user_id = auth.uid()
  where a.id = p_announcement_id;

  if not found then
    raise exception 'Tiedote ei kuulu käyttäjälle.' using errcode = '42501';
  end if;

  if p_event = 'shown' then
    update public.announcement_recipients
    set first_shown_at = coalesce(first_shown_at, now()),
        updated_at = now()
    where announcement_id = p_announcement_id and user_id = auth.uid();
  elsif p_event = 'opened' then
    update public.announcement_recipients
    set first_shown_at = coalesce(first_shown_at, now()),
        opened_at = coalesce(opened_at, now()),
        read_at = coalesce(read_at, now()),
        updated_at = now()
    where announcement_id = p_announcement_id and user_id = auth.uid();
  elsif p_event = 'read' then
    update public.announcement_recipients
    set first_shown_at = coalesce(first_shown_at, now()),
        read_at = coalesce(read_at, now()),
        updated_at = now()
    where announcement_id = p_announcement_id and user_id = auth.uid();
  elsif p_event = 'acknowledged' then
    update public.announcement_recipients
    set first_shown_at = coalesce(first_shown_at, now()),
        opened_at = coalesce(opened_at, now()),
        read_at = coalesce(read_at, now()),
        acknowledged_at = coalesce(acknowledged_at, now()),
        updated_at = now()
    where announcement_id = p_announcement_id and user_id = auth.uid();
  elsif p_event = 'dismissed' then
    if not v_dismissible then
      raise exception 'Tätä tiedotetta ei voi piilottaa.' using errcode = '23514';
    end if;
    if v_require_ack and not exists (
      select 1 from public.announcement_recipients ar
      where ar.announcement_id = p_announcement_id
        and ar.user_id = auth.uid()
        and ar.acknowledged_at is not null
    ) then
      raise exception 'Tiedote pitää kuitata ennen piilottamista.' using errcode = '23514';
    end if;
    update public.announcement_recipients
    set dismissed_at = coalesce(dismissed_at, now()),
        updated_at = now()
    where announcement_id = p_announcement_id and user_id = auth.uid();
  else
    raise exception 'Tuntematon tiedotetapahtuma.' using errcode = '23514';
  end if;
end;
$$;

revoke all on function public.record_announcement_event(uuid, text) from public, anon;
grant execute on function public.record_announcement_event(uuid, text) to authenticated;

create or replace function public.publish_announcement_v2(
  p_organization_id uuid,
  p_announcement_id uuid
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null
     or not private.is_announcement_manager(p_organization_id, auth.uid()) then
    raise exception 'Tiedotteen julkaisuun ei ole oikeutta.' using errcode = '42501';
  end if;

  update public.announcements
  set status = 'published',
      starts_at = now(),
      published_at = now(),
      updated_at = now()
  where id = p_announcement_id
    and organization_id = p_organization_id
    and status in ('draft', 'scheduled');

  if not found then
    raise exception 'Julkaistavaa tiedotetta ei löytynyt.' using errcode = 'P0002';
  end if;

  perform private.resolve_announcement_recipients(p_announcement_id);
  perform private.dispatch_announcement_notifications(p_announcement_id);
end;
$$;

revoke all on function public.publish_announcement_v2(uuid, uuid) from public, anon;
grant execute on function public.publish_announcement_v2(uuid, uuid) to authenticated;

create or replace function public.end_announcement_v2(
  p_organization_id uuid,
  p_announcement_id uuid
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null
     or not private.is_announcement_manager(p_organization_id, auth.uid()) then
    raise exception 'Tiedotteen päättämiseen ei ole oikeutta.' using errcode = '42501';
  end if;

  update public.announcements
  set status = 'expired',
      expires_at = coalesce(expires_at, now()),
      updated_at = now()
  where id = p_announcement_id
    and organization_id = p_organization_id
    and status in ('published', 'scheduled');

  update public.app_notifications
  set resolved_at = coalesce(resolved_at, now()),
      updated_at = now()
  where organization_id = p_organization_id
    and source_table = 'announcements'
    and source_id = p_announcement_id;
end;
$$;

revoke all on function public.end_announcement_v2(uuid, uuid) from public, anon;
grant execute on function public.end_announcement_v2(uuid, uuid) to authenticated;

create or replace function public.delete_announcement_v2(
  p_organization_id uuid,
  p_announcement_id uuid
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null
     or not private.is_announcement_manager(p_organization_id, auth.uid()) then
    raise exception 'Tiedotteen poistamiseen ei ole oikeutta.' using errcode = '42501';
  end if;

  update public.app_notifications
  set resolved_at = coalesce(resolved_at, now()),
      updated_at = now()
  where organization_id = p_organization_id
    and source_table = 'announcements'
    and source_id = p_announcement_id;

  delete from public.announcements
  where id = p_announcement_id
    and organization_id = p_organization_id;
end;
$$;

revoke all on function public.delete_announcement_v2(uuid, uuid) from public, anon;
grant execute on function public.delete_announcement_v2(uuid, uuid) to authenticated;

create or replace function private.process_scheduled_announcements(
  p_now timestamptz default now()
)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id uuid;
  v_count integer := 0;
begin
  for v_id in
    update public.announcements
    set status = 'published',
        published_at = p_now,
        updated_at = p_now
    where status = 'scheduled'
      and coalesce(starts_at, published_at) <= p_now
      and (expires_at is null or expires_at > p_now)
    returning id
  loop
    perform private.resolve_announcement_recipients(v_id);
    perform private.dispatch_announcement_notifications(v_id);
    v_count := v_count + 1;
  end loop;

  update public.announcements
  set status = 'expired',
      updated_at = p_now
  where status in ('published', 'scheduled')
    and expires_at is not null
    and expires_at <= p_now;

  update public.app_notifications n
  set resolved_at = coalesce(n.resolved_at, p_now),
      updated_at = p_now
  where n.source_table = 'announcements'
    and n.resolved_at is null
    and exists (
      select 1
      from public.announcements a
      where a.id = n.source_id
        and a.status = 'expired'
    );

  return v_count;
end;
$$;

revoke all on function private.process_scheduled_announcements(timestamptz) from public, anon, authenticated;

-- Existing announcements remain visible to the same internal audience and gain
-- the archive placement. New announcements use the explicit targeting RPC.
insert into public.announcement_targets (
  organization_id,
  announcement_id,
  target_type
)
select a.organization_id, a.id, 'organization'
from public.announcements a
where not exists (
  select 1 from public.announcement_targets at where at.announcement_id = a.id
)
on conflict do nothing;

insert into public.announcement_placements (
  organization_id,
  announcement_id,
  placement
)
select a.organization_id, a.id, 'archive'
from public.announcements a
where not exists (
  select 1 from public.announcement_placements ap where ap.announcement_id = a.id
)
on conflict do nothing;

do $$
declare
  v_id uuid;
begin
  for v_id in select id from public.announcements loop
    perform private.resolve_announcement_recipients(v_id);
  end loop;
end;
$$;

drop policy if exists announcements_select on public.announcements;
create policy announcements_select on public.announcements
for select to authenticated
using (
  private.is_announcement_manager(organization_id, auth.uid())
  or exists (
    select 1
    from public.announcement_recipients ar
    where ar.announcement_id = announcements.id
      and ar.organization_id = announcements.organization_id
      and ar.user_id = auth.uid()
  )
);

drop policy if exists announcements_insert on public.announcements;
create policy announcements_insert on public.announcements
for insert to authenticated
with check (
  private.is_announcement_manager(organization_id, auth.uid())
  and (created_by is null or created_by = auth.uid())
);

drop policy if exists announcements_update on public.announcements;
create policy announcements_update on public.announcements
for update to authenticated
using (private.is_announcement_manager(organization_id, auth.uid()))
with check (private.is_announcement_manager(organization_id, auth.uid()));

drop policy if exists announcements_delete on public.announcements;
create policy announcements_delete on public.announcements
for delete to authenticated
using (private.is_announcement_manager(organization_id, auth.uid()));

drop policy if exists announcement_recipients_select on public.announcement_recipients;
create policy announcement_recipients_select on public.announcement_recipients
for select to authenticated
using (
  user_id = auth.uid()
  or private.is_announcement_manager(organization_id, auth.uid())
);

drop policy if exists announcement_targets_select on public.announcement_targets;
create policy announcement_targets_select on public.announcement_targets
for select to authenticated
using (private.is_announcement_manager(organization_id, auth.uid()));

drop policy if exists announcement_placements_select on public.announcement_placements;
create policy announcement_placements_select on public.announcement_placements
for select to authenticated
using (private.is_announcement_manager(organization_id, auth.uid()));

grant select on public.announcement_targets, public.announcement_placements to authenticated;

-- Customer users can open the archive when specifically targeted.
-- The page route is enabled by the frontend change in the same release.

do $$
declare
  v_job_id bigint;
begin
  for v_job_id in
    select jobid from cron.job where jobname = 'vakantti-targeted-announcements'
  loop
    perform cron.unschedule(v_job_id);
  end loop;

  perform cron.schedule(
    'vakantti-targeted-announcements',
    '* * * * *',
    'select private.process_scheduled_announcements(now());'
  );
exception
  when undefined_table or undefined_function then
    null;
end;
$$;

commit;
