begin;

create or replace function private.can_read_published_announcement(
  p_announcement_id uuid,
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
    from public.announcements a
    join public.announcement_recipients ar
      on ar.announcement_id = a.id
     and ar.organization_id = a.organization_id
     and ar.user_id = p_user_id
    where a.id = p_announcement_id
      and a.organization_id = p_organization_id
      and (
        a.status = 'expired'
        or (
          a.status = 'published'
          and coalesce(a.starts_at, a.published_at) <= now()
          and (a.expires_at is null or a.expires_at > now())
        )
      )
  );
$$;

revoke all on function private.can_read_published_announcement(uuid, uuid, uuid) from public, anon;
grant execute on function private.can_read_published_announcement(uuid, uuid, uuid) to authenticated;

drop policy if exists announcements_select on public.announcements;
create policy announcements_select on public.announcements
for select to authenticated
using (
  private.is_announcement_manager(organization_id, auth.uid())
  or private.can_read_published_announcement(id, organization_id, auth.uid())
);

drop policy if exists announcement_recipients_select on public.announcement_recipients;
create policy announcement_recipients_select on public.announcement_recipients
for select to authenticated
using (
  private.is_announcement_manager(organization_id, auth.uid())
  or (
    user_id = auth.uid()
    and private.can_read_published_announcement(announcement_id, organization_id, auth.uid())
  )
);

commit;
