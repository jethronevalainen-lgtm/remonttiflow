-- Notify project supervisors when a new project discussion message arrives.
-- Recipients: responsible_supervisor_id + supervisors on project_members.
-- Deduped per project+channel so the bell stays readable under busy threads.

begin;

create or replace function private.project_message_supervisor_targets(
  p_organization_id uuid,
  p_project_id uuid
)
returns table (user_id uuid)
language sql
stable
security definer
set search_path = ''
as $$
  with candidates as (
    select project.responsible_supervisor_id as user_id
    from public.projects project
    where project.id = p_project_id
      and project.organization_id = p_organization_id

    union

    select member.user_id
    from public.project_members member
    where member.project_id = p_project_id
      and member.organization_id = p_organization_id
  )
  select distinct candidates.user_id
  from candidates
  join public.organization_members org_member
    on org_member.organization_id = p_organization_id
   and org_member.user_id = candidates.user_id
  where candidates.user_id is not null
    and (
      org_member.role = 'supervisor'
      or candidates.user_id = (
        select project.responsible_supervisor_id
        from public.projects project
        where project.id = p_project_id
      )
    )
    and org_member.role in ('admin', 'supervisor', 'project_coordinator');
$$;

revoke all on function private.project_message_supervisor_targets(uuid, uuid)
from public, anon, authenticated;

create or replace function private.notify_supervisors_of_project_message(
  p_message public.project_messages
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  project_name text;
  author_name text;
  channel_label text;
  preview text;
begin
  if p_message.id is null or p_message.deleted_at is not null then
    return;
  end if;

  select coalesce(nullif(btrim(project.name), ''), 'Projekti')
  into project_name
  from public.projects project
  where project.id = p_message.project_id;

  select coalesce(
    nullif(btrim(profile.full_name), ''),
    nullif(btrim(profile.email), ''),
    'Käyttäjä'
  )
  into author_name
  from public.profiles profile
  where profile.id = p_message.author_user_id;

  channel_label := case
    when p_message.channel = 'internal' then 'sisäinen keskustelu'
    else 'jaettu keskustelu'
  end;

  preview := left(regexp_replace(coalesce(p_message.body, ''), '\s+', ' ', 'g'), 180);

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
    p_message.organization_id,
    targets.user_id,
    'project_message_new',
    'info',
    'Uusi viesti: ' || project_name,
    author_name || ' · ' || channel_label || case
      when preview = '' then ''
      else ': ' || preview
    end,
    '/projektikeskustelut/' || p_message.project_id::text,
    'project_messages',
    p_message.id,
    'project-message:' || p_message.project_id::text || ':' || p_message.channel,
    jsonb_build_object(
      'project_id', p_message.project_id,
      'message_id', p_message.id,
      'channel', p_message.channel,
      'author_user_id', p_message.author_user_id
    ),
    null,
    null,
    now()
  from private.project_message_supervisor_targets(
    p_message.organization_id,
    p_message.project_id
  ) targets
  where targets.user_id <> p_message.author_user_id
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

revoke all on function private.notify_supervisors_of_project_message(public.project_messages)
from public, anon, authenticated;

create or replace function private.project_messages_notify_supervisors_trigger()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform private.notify_supervisors_of_project_message(new);
  return new;
end;
$$;

revoke all on function private.project_messages_notify_supervisors_trigger()
from public, anon, authenticated;

drop trigger if exists project_messages_notify_supervisors on public.project_messages;
create trigger project_messages_notify_supervisors
after insert on public.project_messages
for each row
execute function private.project_messages_notify_supervisors_trigger();

create or replace function public.mark_project_messages_read(
  p_project_id uuid,
  p_channel text
)
returns void
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  project_row public.projects%rowtype;
begin
  select p.* into project_row from public.projects p where p.id = p_project_id;
  if project_row.id is null
     or not private.can_collaborate_on_project(project_row.id, project_row.organization_id, auth.uid()) then
    raise exception 'Projektin keskusteluun ei ole käyttöoikeutta.' using errcode = '42501';
  end if;
  if p_channel not in ('shared', 'internal') then
    raise exception 'Virheellinen keskustelukanava.' using errcode = '23514';
  end if;
  if p_channel = 'internal'
     and not private.can_use_internal_project_channel(project_row.id, project_row.organization_id, auth.uid()) then
    raise exception 'Sisäinen keskustelu ei kuulu käyttöoikeuksiisi.' using errcode = '42501';
  end if;

  insert into public.project_message_reads(project_id, user_id, channel, last_read_at)
  values (p_project_id, auth.uid(), p_channel, now())
  on conflict (project_id, user_id, channel)
  do update set last_read_at = excluded.last_read_at;

  update public.app_notifications
  set
    read_at = coalesce(read_at, now()),
    resolved_at = coalesce(resolved_at, now()),
    updated_at = now()
  where organization_id = project_row.organization_id
    and recipient_user_id = auth.uid()
    and notification_type = 'project_message_new'
    and dedup_key = 'project-message:' || p_project_id::text || ':' || p_channel
    and resolved_at is null;
end;
$$;

revoke all on function public.mark_project_messages_read(uuid, text) from public, anon;
grant execute on function public.mark_project_messages_read(uuid, text) to authenticated;

commit;
