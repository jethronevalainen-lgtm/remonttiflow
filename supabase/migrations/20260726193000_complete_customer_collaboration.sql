begin;

-- Complete project chat: replies, mentions, attachments, editing and soft deletion.
create table if not exists public.project_message_mentions (
  message_id uuid not null references public.project_messages(id) on delete cascade,
  mentioned_user_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (message_id, mentioned_user_id)
);

create table if not exists public.project_message_attachments (
  id uuid primary key,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  project_id uuid not null references public.projects(id) on delete cascade,
  message_id uuid not null references public.project_messages(id) on delete cascade,
  storage_path text not null unique,
  file_name text not null,
  mime_type text not null,
  size_bytes bigint not null check (size_bytes > 0 and size_bytes <= 10485760),
  created_by uuid not null references public.profiles(id) on delete restrict,
  created_at timestamptz not null default now()
);

create index if not exists project_message_attachments_message_idx
  on public.project_message_attachments(message_id, created_at);
create index if not exists project_message_mentions_user_idx
  on public.project_message_mentions(mentioned_user_id, created_at desc);

alter table public.project_message_mentions enable row level security;
alter table public.project_message_attachments enable row level security;

revoke all on public.project_message_mentions, public.project_message_attachments from anon;
grant select on public.project_message_mentions, public.project_message_attachments to authenticated;

create or replace function private.can_read_project_message(
  p_message_id uuid,
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
    from public.project_messages m
    where m.id = p_message_id
      and m.deleted_at is null
      and private.can_collaborate_on_project(m.project_id, m.organization_id, p_user_id)
      and (
        m.channel = 'shared'
        or private.can_use_internal_project_channel(m.project_id, m.organization_id, p_user_id)
      )
  );
$$;

grant execute on function private.can_read_project_message(uuid, uuid) to authenticated;

drop policy if exists project_message_mentions_select on public.project_message_mentions;
create policy project_message_mentions_select
on public.project_message_mentions for select to authenticated
using (private.can_read_project_message(message_id, (select auth.uid())));

drop policy if exists project_message_attachments_select on public.project_message_attachments;
create policy project_message_attachments_select
on public.project_message_attachments for select to authenticated
using (private.can_read_project_message(message_id, (select auth.uid())));

create or replace function public.project_conversation_participants_v2(p_project_id uuid)
returns table (
  user_id uuid,
  display_name text,
  email text,
  role text,
  can_use_internal boolean
)
language plpgsql
stable
security definer
set search_path = pg_catalog, public
as $$
declare
  project_row public.projects%rowtype;
begin
  select p.* into project_row from public.projects p where p.id = p_project_id;
  if project_row.id is null
     or not private.can_collaborate_on_project(project_row.id, project_row.organization_id, auth.uid()) then
    raise exception 'Projektin osallistujia ei voi tarkastella.' using errcode = '42501';
  end if;

  return query
  select distinct
    om.user_id,
    coalesce(nullif(pr.full_name, ''), nullif(pr.email, ''), 'Käyttäjä'),
    coalesce(pr.email, ''),
    om.role,
    private.can_use_internal_project_channel(project_row.id, project_row.organization_id, om.user_id)
  from public.organization_members om
  left join public.profiles pr on pr.id = om.user_id
  where om.organization_id = project_row.organization_id
    and (
      om.role in ('admin', 'supervisor')
      or (
        om.role = 'worker'
        and (
          exists (
            select 1 from public.project_members pm
            where pm.project_id = project_row.id
              and pm.organization_id = project_row.organization_id
              and pm.user_id = om.user_id
          )
          or exists (
            select 1
            from public.work_orders wo
            join public.work_order_assignees wa
              on wa.work_order_id = wo.id
             and wa.organization_id = wo.organization_id
            where wo.project_id = project_row.id
              and wo.organization_id = project_row.organization_id
              and wa.user_id = om.user_id
          )
        )
      )
      or (
        om.role = 'customer'
        and exists (
          select 1 from public.customer_users cu
          where cu.organization_id = project_row.organization_id
            and cu.customer_id = project_row.customer_id
            and cu.user_id = om.user_id
        )
      )
    )
  order by 2;
end;
$$;

create or replace function public.project_messages_for_user_v2(
  p_project_id uuid,
  p_channel text
)
returns table (
  id uuid,
  project_id uuid,
  author_user_id uuid,
  author_name text,
  channel text,
  body text,
  reply_to_id uuid,
  reply_author_name text,
  reply_body text,
  mentioned_user_ids uuid[],
  mentioned_names text[],
  attachments jsonb,
  created_at timestamptz,
  edited_at timestamptz
)
language plpgsql
stable
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

  return query
  select
    m.id,
    m.project_id,
    m.author_user_id,
    coalesce(nullif(author_profile.full_name, ''), nullif(author_profile.email, ''), 'Käyttäjä'),
    m.channel,
    m.body,
    m.reply_to_id,
    case when reply_message.deleted_at is null
      then coalesce(nullif(reply_profile.full_name, ''), nullif(reply_profile.email, ''), 'Käyttäjä')
      else null end,
    case when reply_message.deleted_at is null then left(reply_message.body, 240) else null end,
    coalesce((
      select array_agg(mm.mentioned_user_id order by mm.mentioned_user_id)
      from public.project_message_mentions mm
      where mm.message_id = m.id
    ), '{}'::uuid[]),
    coalesce((
      select array_agg(coalesce(nullif(mp.full_name, ''), nullif(mp.email, ''), 'Käyttäjä') order by coalesce(mp.full_name, mp.email, 'Käyttäjä'))
      from public.project_message_mentions mm
      join public.profiles mp on mp.id = mm.mentioned_user_id
      where mm.message_id = m.id
    ), '{}'::text[]),
    coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', a.id,
        'storage_path', a.storage_path,
        'file_name', a.file_name,
        'mime_type', a.mime_type,
        'size_bytes', a.size_bytes
      ) order by a.created_at)
      from public.project_message_attachments a
      where a.message_id = m.id
    ), '[]'::jsonb),
    m.created_at,
    m.edited_at
  from public.project_messages m
  left join public.profiles author_profile on author_profile.id = m.author_user_id
  left join public.project_messages reply_message on reply_message.id = m.reply_to_id
  left join public.profiles reply_profile on reply_profile.id = reply_message.author_user_id
  where m.project_id = p_project_id
    and m.channel = p_channel
    and m.deleted_at is null
  order by m.created_at;
end;
$$;

create or replace function public.send_project_message_v2(
  p_project_id uuid,
  p_channel text,
  p_body text,
  p_reply_to_id uuid default null,
  p_mentioned_user_ids uuid[] default '{}'::uuid[]
)
returns uuid
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  project_row public.projects%rowtype;
  reply_row public.project_messages%rowtype;
  result_id uuid;
  mentioned_user_id uuid;
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
  if char_length(trim(coalesce(p_body, ''))) not between 1 and 4000 then
    raise exception 'Viestin pituuden pitää olla 1–4000 merkkiä.' using errcode = '23514';
  end if;

  if p_reply_to_id is not null then
    select * into reply_row from public.project_messages where id = p_reply_to_id;
    if reply_row.id is null
       or reply_row.project_id <> project_row.id
       or reply_row.channel <> p_channel
       or reply_row.deleted_at is not null then
      raise exception 'Vastattavaa viestiä ei löytynyt.' using errcode = '23503';
    end if;
  end if;

  insert into public.project_messages (
    organization_id, project_id, author_user_id, channel, body, reply_to_id
  ) values (
    project_row.organization_id, project_row.id, auth.uid(), p_channel, trim(p_body), p_reply_to_id
  ) returning id into result_id;

  foreach mentioned_user_id in array coalesce(p_mentioned_user_ids, '{}'::uuid[]) loop
    if private.can_collaborate_on_project(project_row.id, project_row.organization_id, mentioned_user_id)
       and (p_channel = 'shared' or private.can_use_internal_project_channel(project_row.id, project_row.organization_id, mentioned_user_id)) then
      insert into public.project_message_mentions(message_id, mentioned_user_id)
      values (result_id, mentioned_user_id)
      on conflict do nothing;
    end if;
  end loop;

  insert into public.audit_logs (organization_id, user_id, action, table_name, record_id, metadata)
  values (
    project_row.organization_id, auth.uid(), 'project_message_sent',
    'project_messages', result_id,
    jsonb_build_object('project_id', project_row.id, 'channel', p_channel, 'reply_to_id', p_reply_to_id)
  );
  return result_id;
end;
$$;

create or replace function public.edit_project_message_v2(
  p_message_id uuid,
  p_body text,
  p_mentioned_user_ids uuid[] default '{}'::uuid[]
)
returns void
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  message_row public.project_messages%rowtype;
  mentioned_user_id uuid;
begin
  select * into message_row from public.project_messages where id = p_message_id for update;
  if message_row.id is null or message_row.deleted_at is not null then
    raise exception 'Viestiä ei löytynyt.' using errcode = '23503';
  end if;
  if message_row.author_user_id <> auth.uid() then
    raise exception 'Voit muokata vain omia viestejäsi.' using errcode = '42501';
  end if;
  if char_length(trim(coalesce(p_body, ''))) not between 1 and 4000 then
    raise exception 'Viestin pituuden pitää olla 1–4000 merkkiä.' using errcode = '23514';
  end if;

  update public.project_messages
  set body = trim(p_body), edited_at = now()
  where id = p_message_id;

  delete from public.project_message_mentions where message_id = p_message_id;
  foreach mentioned_user_id in array coalesce(p_mentioned_user_ids, '{}'::uuid[]) loop
    if private.can_collaborate_on_project(message_row.project_id, message_row.organization_id, mentioned_user_id)
       and (message_row.channel = 'shared' or private.can_use_internal_project_channel(message_row.project_id, message_row.organization_id, mentioned_user_id)) then
      insert into public.project_message_mentions(message_id, mentioned_user_id)
      values (p_message_id, mentioned_user_id)
      on conflict do nothing;
    end if;
  end loop;
end;
$$;

create or replace function public.delete_project_message_v2(p_message_id uuid)
returns void
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  message_row public.project_messages%rowtype;
begin
  select * into message_row from public.project_messages where id = p_message_id for update;
  if message_row.id is null or message_row.deleted_at is not null then
    return;
  end if;
  if message_row.author_user_id <> auth.uid()
     and not private.is_management_user(message_row.organization_id, auth.uid()) then
    raise exception 'Viestin poistamiseen ei ole oikeutta.' using errcode = '42501';
  end if;

  update public.project_messages set deleted_at = now() where id = p_message_id;
  insert into public.audit_logs (organization_id, user_id, action, table_name, record_id)
  values (message_row.organization_id, auth.uid(), 'project_message_deleted', 'project_messages', p_message_id);
end;
$$;

create or replace function public.attach_project_message_file_v2(
  p_message_id uuid,
  p_attachment_id uuid,
  p_storage_path text,
  p_file_name text,
  p_mime_type text,
  p_size_bytes bigint
)
returns void
language plpgsql
security definer
set search_path = pg_catalog, public, storage
as $$
declare
  message_row public.project_messages%rowtype;
  expected_prefix text;
begin
  select * into message_row from public.project_messages where id = p_message_id;
  if message_row.id is null or message_row.deleted_at is not null then
    raise exception 'Viestiä ei löytynyt.' using errcode = '23503';
  end if;
  if message_row.author_user_id <> auth.uid() then
    raise exception 'Liitteen voi lisätä vain omaan viestiin.' using errcode = '42501';
  end if;
  if p_size_bytes <= 0 or p_size_bytes > 10485760 then
    raise exception 'Liitteen enimmäiskoko on 10 Mt.' using errcode = '23514';
  end if;

  expected_prefix := message_row.organization_id::text || '/' || message_row.project_id::text || '/' || message_row.id::text || '/';
  if left(p_storage_path, char_length(expected_prefix)) <> expected_prefix then
    raise exception 'Liitteen tallennuspolku on virheellinen.' using errcode = '23514';
  end if;
  if not exists (
    select 1 from storage.objects o
    where o.bucket_id = 'project-message-attachments'
      and o.name = p_storage_path
      and o.owner_id = auth.uid()::text
  ) then
    raise exception 'Tallennettua liitetiedostoa ei löytynyt.' using errcode = '23503';
  end if;

  insert into public.project_message_attachments (
    id, organization_id, project_id, message_id, storage_path,
    file_name, mime_type, size_bytes, created_by
  ) values (
    p_attachment_id, message_row.organization_id, message_row.project_id, message_row.id,
    p_storage_path, p_file_name, p_mime_type, p_size_bytes, auth.uid()
  );
end;
$$;

revoke all on function public.project_conversation_participants_v2(uuid) from public, anon;
revoke all on function public.project_messages_for_user_v2(uuid, text) from public, anon;
revoke all on function public.send_project_message_v2(uuid, text, text, uuid, uuid[]) from public, anon;
revoke all on function public.edit_project_message_v2(uuid, text, uuid[]) from public, anon;
revoke all on function public.delete_project_message_v2(uuid) from public, anon;
revoke all on function public.attach_project_message_file_v2(uuid, uuid, text, text, text, bigint) from public, anon;

grant execute on function public.project_conversation_participants_v2(uuid) to authenticated;
grant execute on function public.project_messages_for_user_v2(uuid, text) to authenticated;
grant execute on function public.send_project_message_v2(uuid, text, text, uuid, uuid[]) to authenticated;
grant execute on function public.edit_project_message_v2(uuid, text, uuid[]) to authenticated;
grant execute on function public.delete_project_message_v2(uuid) to authenticated;
grant execute on function public.attach_project_message_file_v2(uuid, uuid, text, text, text, bigint) to authenticated;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'project-message-attachments',
  'project-message-attachments',
  false,
  10485760,
  array[
    'image/jpeg', 'image/png', 'image/webp', 'image/gif',
    'application/pdf', 'text/plain', 'text/csv',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
  ]
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists project_message_files_insert on storage.objects;
create policy project_message_files_insert
on storage.objects for insert to authenticated
with check (
  bucket_id = 'project-message-attachments'
  and owner_id = (select auth.uid())::text
  and private.can_collaborate_on_project(
    private.try_uuid((storage.foldername(name))[2]),
    private.try_uuid((storage.foldername(name))[1]),
    (select auth.uid())
  )
);

drop policy if exists project_message_files_select on storage.objects;
create policy project_message_files_select
on storage.objects for select to authenticated
using (
  bucket_id = 'project-message-attachments'
  and exists (
    select 1
    from public.project_message_attachments a
    where a.storage_path = objects.name
      and private.can_read_project_message(a.message_id, (select auth.uid()))
  )
);

drop policy if exists project_message_files_delete on storage.objects;
create policy project_message_files_delete
on storage.objects for delete to authenticated
using (
  bucket_id = 'project-message-attachments'
  and (
    owner_id = (select auth.uid())::text
    or exists (
      select 1
      from public.project_message_attachments a
      where a.storage_path = objects.name
        and private.is_management_user(a.organization_id, (select auth.uid()))
    )
  )
);

-- Customer-visible project documents and image gallery.
create or replace function public.customer_project_documents_v2(p_project_id uuid)
returns table (
  id uuid,
  project_id uuid,
  document_type text,
  title text,
  description text,
  storage_path text,
  file_name text,
  mime_type text,
  size_bytes bigint,
  created_at timestamptz
)
language plpgsql
stable
security definer
set search_path = pg_catalog, public
as $$
declare
  project_row public.projects%rowtype;
begin
  select * into project_row from public.projects where id = p_project_id;
  if project_row.id is null
     or not private.is_customer_project_user(project_row.id, project_row.organization_id, auth.uid()) then
    raise exception 'Projektin dokumentteihin ei ole käyttöoikeutta.' using errcode = '42501';
  end if;

  return query
  select d.id, d.project_id, d.document_type, d.title, d.description,
         d.storage_path, d.file_name, d.mime_type, d.size_bytes, d.created_at
  from public.project_documents d
  where d.project_id = project_row.id
    and d.organization_id = project_row.organization_id
    and d.archived_at is null
    and d.visible_to_roles && array['customer']::text[]
  order by d.created_at desc;
end;
$$;

create or replace function public.set_project_document_customer_visibility_v2(
  p_document_id uuid,
  p_visible boolean
)
returns void
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  document_row public.project_documents%rowtype;
begin
  select * into document_row from public.project_documents where id = p_document_id for update;
  if document_row.id is null then
    raise exception 'Dokumenttia ei löytynyt.' using errcode = '23503';
  end if;
  if not private.is_management_user(document_row.organization_id, auth.uid()) then
    raise exception 'Vain työnjohto voi muuttaa tilaajan näkyvyyttä.' using errcode = '42501';
  end if;

  update public.project_documents
  set visible_to_roles = case
    when p_visible then array(
      select distinct value
      from unnest(visible_to_roles || array['customer']::text[]) value
      order by value
    )
    else array_remove(visible_to_roles, 'customer')
  end
  where id = p_document_id;
end;
$$;

revoke all on function public.customer_project_documents_v2(uuid) from public, anon;
revoke all on function public.set_project_document_customer_visibility_v2(uuid, boolean) from public, anon;
grant execute on function public.customer_project_documents_v2(uuid) to authenticated;
grant execute on function public.set_project_document_customer_visibility_v2(uuid, boolean) to authenticated;

-- Customer approval workflow for change and additional work.
alter table public.change_orders
  add column if not exists customer_visible boolean not null default false,
  add column if not exists customer_decision text,
  add column if not exists customer_decision_note text,
  add column if not exists customer_decided_by uuid references public.profiles(id) on delete set null,
  add column if not exists customer_decided_at timestamptz,
  add column if not exists submitted_to_customer_at timestamptz;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'change_orders_customer_decision_check'
  ) then
    alter table public.change_orders
      add constraint change_orders_customer_decision_check
      check (customer_decision is null or customer_decision in ('Odottaa', 'Hyväksytty', 'Hylätty'));
  end if;
end
$$;

create or replace function public.submit_change_order_to_customer_v2(p_change_order_id uuid)
returns void
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  change_row public.change_orders%rowtype;
begin
  select * into change_row from public.change_orders where id = p_change_order_id for update;
  if change_row.id is null then
    raise exception 'Muutostyötä ei löytynyt.' using errcode = '23503';
  end if;
  if not private.is_management_user(change_row.organization_id, auth.uid()) then
    raise exception 'Vain työnjohto voi lähettää muutostyön tilaajalle.' using errcode = '42501';
  end if;

  update public.change_orders
  set status = 'Lähetetty',
      customer_visible = true,
      customer_decision = 'Odottaa',
      customer_decision_note = null,
      customer_decided_by = null,
      customer_decided_at = null,
      submitted_to_customer_at = now(),
      approved_at = null,
      approved_by_name = null
  where id = p_change_order_id;

  insert into public.audit_logs (organization_id, user_id, action, table_name, record_id)
  values (change_row.organization_id, auth.uid(), 'change_order_sent_to_customer', 'change_orders', p_change_order_id);
end;
$$;

create or replace function public.customer_project_change_orders_v2(p_project_id uuid)
returns table (
  id uuid,
  project_id uuid,
  change_number text,
  title text,
  description text,
  status text,
  amount_cents bigint,
  requested_at date,
  customer_decision text,
  customer_decision_note text,
  submitted_to_customer_at timestamptz,
  customer_decided_at timestamptz
)
language plpgsql
stable
security definer
set search_path = pg_catalog, public
as $$
declare
  project_row public.projects%rowtype;
begin
  select * into project_row from public.projects where id = p_project_id;
  if project_row.id is null
     or not private.is_customer_project_user(project_row.id, project_row.organization_id, auth.uid()) then
    raise exception 'Projektin muutostöihin ei ole käyttöoikeutta.' using errcode = '42501';
  end if;

  return query
  select c.id, c.project_id, c.change_number, c.title, c.description, c.status,
         c.amount_cents, c.requested_at, c.customer_decision,
         c.customer_decision_note, c.submitted_to_customer_at, c.customer_decided_at
  from public.change_orders c
  where c.project_id = project_row.id
    and c.organization_id = project_row.organization_id
    and c.customer_visible = true
  order by c.submitted_to_customer_at desc nulls last, c.created_at desc;
end;
$$;

create or replace function public.decide_customer_change_order_v2(
  p_change_order_id uuid,
  p_decision text,
  p_note text default null
)
returns void
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  change_row public.change_orders%rowtype;
  decision_name text;
begin
  select * into change_row from public.change_orders where id = p_change_order_id for update;
  if change_row.id is null or not change_row.customer_visible then
    raise exception 'Muutostyötä ei löytynyt.' using errcode = '23503';
  end if;
  if not private.is_customer_project_user(change_row.project_id, change_row.organization_id, auth.uid()) then
    raise exception 'Muutostyön käsittelyyn ei ole oikeutta.' using errcode = '42501';
  end if;
  if p_decision not in ('Hyväksytty', 'Hylätty') then
    raise exception 'Virheellinen päätös.' using errcode = '23514';
  end if;
  if change_row.customer_decision <> 'Odottaa' then
    raise exception 'Muutostyö on jo käsitelty.' using errcode = '23514';
  end if;

  select coalesce(nullif(full_name, ''), nullif(email, ''), 'Tilaaja')
  into decision_name from public.profiles where id = auth.uid();

  update public.change_orders
  set customer_decision = p_decision,
      customer_decision_note = nullif(trim(coalesce(p_note, '')), ''),
      customer_decided_by = auth.uid(),
      customer_decided_at = now(),
      status = p_decision,
      approved_at = case when p_decision = 'Hyväksytty' then current_date else null end,
      approved_by_name = case when p_decision = 'Hyväksytty' then decision_name else null end
  where id = p_change_order_id;

  insert into public.audit_logs (organization_id, user_id, action, table_name, record_id, metadata)
  values (
    change_row.organization_id, auth.uid(), 'customer_change_order_decision',
    'change_orders', p_change_order_id, jsonb_build_object('decision', p_decision)
  );
end;
$$;

revoke all on function public.submit_change_order_to_customer_v2(uuid) from public, anon;
revoke all on function public.customer_project_change_orders_v2(uuid) from public, anon;
revoke all on function public.decide_customer_change_order_v2(uuid, text, text) from public, anon;
grant execute on function public.submit_change_order_to_customer_v2(uuid) to authenticated;
grant execute on function public.customer_project_change_orders_v2(uuid) to authenticated;
grant execute on function public.decide_customer_change_order_v2(uuid, text, text) to authenticated;

-- Realtime refresh for attachment metadata and mentions.
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'project_message_attachments'
  ) then
    alter publication supabase_realtime add table public.project_message_attachments;
  end if;
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'project_message_mentions'
  ) then
    alter publication supabase_realtime add table public.project_message_mentions;
  end if;
end
$$;

commit;
