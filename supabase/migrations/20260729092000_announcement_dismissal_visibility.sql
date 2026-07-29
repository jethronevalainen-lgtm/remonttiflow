begin;

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
    and (p_placement = 'archive' or ar.dismissed_at is null)
  order by
    a.pinned desc,
    case a.priority when 'Kriittinen' then 0 when 'Tärkeä' then 1 when 'Normaali' then 2 else 3 end,
    coalesce(a.starts_at, a.published_at) desc;
$$;

revoke all on function public.list_visible_announcements_v2(uuid, text, uuid, uuid) from public, anon;
grant execute on function public.list_visible_announcements_v2(uuid, text, uuid, uuid) to authenticated;

commit;
