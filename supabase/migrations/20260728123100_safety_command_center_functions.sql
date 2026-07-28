create or replace function private.validate_safety_project_organization()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public, private
as $$
declare
  v_project_org uuid;
  v_parent_org uuid;
begin
  if tg_table_name = 'safety_briefings' and new.project_id is not null then
    select organization_id into v_project_org from public.projects where id = new.project_id;
    if v_project_org is distinct from new.organization_id then
      raise exception 'Safety briefing project must belong to the same organization';
    end if;
  elsif tg_table_name = 'project_safety_profiles' then
    select organization_id into v_project_org from public.projects where id = new.project_id;
    if v_project_org is distinct from new.organization_id then
      raise exception 'Safety profile project must belong to the same organization';
    end if;
  elsif tg_table_name = 'safety_attachments' then
    if new.safety_item_id is not null then
      select organization_id into v_parent_org from public.safety_items where id = new.safety_item_id;
    else
      select organization_id into v_parent_org from public.safety_briefings where id = new.briefing_id;
    end if;
    if v_parent_org is distinct from new.organization_id then
      raise exception 'Safety attachment parent must belong to the same organization';
    end if;
  end if;
  return new;
end;
$$;

create or replace function private.normalize_safety_briefing()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
begin
  new.title := btrim(new.title);
  new.introduction := nullif(btrim(coalesce(new.introduction, '')), '');
  if tg_op = 'UPDATE' and (
    old.title is distinct from new.title
    or old.introduction is distinct from new.introduction
    or old.instruction_items is distinct from new.instruction_items
    or old.severity is distinct from new.severity
    or old.audience_roles is distinct from new.audience_roles
    or old.project_id is distinct from new.project_id
    or old.valid_from is distinct from new.valid_from
    or old.valid_until is distinct from new.valid_until
    or old.requires_acknowledgement is distinct from new.requires_acknowledgement
  ) and new.version <= old.version then
    new.version := old.version + 1;
  end if;
  if new.status = 'published' and (tg_op = 'INSERT' or old.status is distinct from 'published' or old.version is distinct from new.version) then
    new.published_by := coalesce(auth.uid(), new.published_by);
    new.published_at := now();
  end if;
  new.updated_at := now();
  return new;
end;
$$;

create or replace function private.snapshot_safety_briefing()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
begin
  if new.status = 'published' and (
    tg_op = 'INSERT'
    or old.status is distinct from 'published'
    or old.version is distinct from new.version
  ) then
    insert into public.safety_briefing_versions (
      organization_id, briefing_id, version, snapshot, created_by
    ) values (
      new.organization_id,
      new.id,
      new.version,
      to_jsonb(new),
      coalesce(auth.uid(), new.published_by, new.created_by)
    )
    on conflict (briefing_id, version) do nothing;
  end if;
  return new;
end;
$$;

create or replace function private.validate_safety_acknowledgement()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public, private
as $$
declare
  v_briefing public.safety_briefings%rowtype;
  v_role text;
begin
  select * into v_briefing from public.safety_briefings where id = new.briefing_id;
  if v_briefing.id is null then raise exception 'Safety briefing not found'; end if;
  if v_briefing.organization_id is distinct from new.organization_id then raise exception 'Invalid acknowledgement organization'; end if;
  if new.user_id is distinct from auth.uid() then raise exception 'Acknowledgement can only be recorded for the current user'; end if;
  if new.briefing_version is distinct from v_briefing.version then raise exception 'Only the current briefing version can be acknowledged'; end if;
  select role into v_role from public.organization_members
  where organization_id = new.organization_id and user_id = new.user_id;
  if v_role is null or v_role is distinct from new.user_role then raise exception 'Invalid acknowledgement role'; end if;
  if not (v_role = any(v_briefing.audience_roles)) then raise exception 'Briefing is not addressed to this role'; end if;
  if v_briefing.project_id is not null and not private.can_collaborate_on_project(v_briefing.project_id, v_briefing.organization_id, new.user_id) then
    raise exception 'User cannot acknowledge this project briefing';
  end if;
  new.project_id := v_briefing.project_id;
  new.acknowledged_at := now();
  return new;
end;
$$;

create or replace function private.notify_safety_briefing()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public, private
as $$
begin
  if new.status = 'published' and (
    tg_op = 'INSERT'
    or old.status is distinct from 'published'
    or old.version is distinct from new.version
  ) then
    insert into public.app_notifications (
      organization_id, recipient_user_id, notification_type, severity,
      title, body, path, source_table, source_id, dedup_key, metadata
    )
    select
      new.organization_id,
      om.user_id,
      'safety_briefing',
      case new.severity when 'danger' then 'danger' when 'warning' then 'warning' else 'info' end,
      new.title,
      coalesce(new.introduction, 'Uusi turvallisuusohje on julkaistu.'),
      '/tyoturvallisuus',
      'safety_briefings',
      new.id,
      format('safety-briefing:%s:v%s', new.id, new.version),
      jsonb_build_object('briefing_id', new.id, 'version', new.version, 'project_id', new.project_id, 'requires_acknowledgement', new.requires_acknowledgement)
    from public.organization_members om
    where om.organization_id = new.organization_id
      and om.role = any(new.audience_roles)
      and (new.project_id is null or private.can_collaborate_on_project(new.project_id, new.organization_id, om.user_id))
    on conflict (organization_id, recipient_user_id, dedup_key)
    do update set
      severity = excluded.severity,
      title = excluded.title,
      body = excluded.body,
      metadata = excluded.metadata,
      read_at = null,
      resolved_at = null,
      updated_at = now();
  end if;
  return new;
end;
$$;

create or replace function private.notify_severe_safety_item()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
begin
  if new.severity = 'Vakava' and new.status not in ('Vahvistettu','Suljettu') then
    insert into public.app_notifications (
      organization_id, recipient_user_id, notification_type, severity,
      title, body, path, source_table, source_id, dedup_key, metadata
    )
    select
      new.organization_id,
      om.user_id,
      'severe_safety_item',
      'danger',
      'Vakava turvallisuushavainto',
      new.title || coalesce(' · ' || nullif(new.project, ''), ''),
      '/tyoturvallisuus',
      'safety_items',
      new.id,
      format('severe-safety-item:%s', new.id),
      jsonb_build_object('safety_item_id', new.id, 'project_id', new.project_id, 'location', new.location, 'status', new.status)
    from public.organization_members om
    where om.organization_id = new.organization_id
      and om.role in ('admin','supervisor','project_coordinator')
    on conflict (organization_id, recipient_user_id, dedup_key)
    do update set
      title = excluded.title,
      body = excluded.body,
      metadata = excluded.metadata,
      read_at = null,
      resolved_at = null,
      updated_at = now();
  else
    update public.app_notifications
      set resolved_at = coalesce(resolved_at, now()), updated_at = now()
    where organization_id = new.organization_id
      and source_table = 'safety_items'
      and source_id = new.id
      and notification_type = 'severe_safety_item'
      and resolved_at is null;
  end if;
  return new;
end;
$$;

create or replace function private.audit_safety_workspace_change()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_org uuid;
  v_record uuid;
  v_old jsonb;
  v_new jsonb;
begin
  v_old := case when tg_op = 'INSERT' then null else to_jsonb(old) end;
  v_new := case when tg_op = 'DELETE' then null else to_jsonb(new) end;
  v_org := coalesce((v_new ->> 'organization_id')::uuid, (v_old ->> 'organization_id')::uuid);
  v_record := coalesce(
    nullif(v_new ->> 'id', '')::uuid,
    nullif(v_old ->> 'id', '')::uuid,
    nullif(v_new ->> 'project_id', '')::uuid,
    nullif(v_old ->> 'project_id', '')::uuid
  );
  insert into public.audit_logs (organization_id, user_id, action, table_name, record_id, metadata)
  values (
    v_org,
    auth.uid(),
    lower(tg_op),
    tg_table_name,
    v_record,
    jsonb_strip_nulls(jsonb_build_object('old', v_old, 'new', v_new))
  );
  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end;
$$;

create or replace function private.delete_safety_storage_object()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, storage
as $$
begin
  delete from storage.objects where bucket_id = 'safety-files' and name = old.storage_path;
  return old;
end;
$$;

create trigger safety_briefings_validate_project
before insert or update on public.safety_briefings
for each row execute function private.validate_safety_project_organization();
create trigger safety_briefings_normalize
before insert or update on public.safety_briefings
for each row execute function private.normalize_safety_briefing();
create trigger safety_briefings_snapshot
after insert or update on public.safety_briefings
for each row execute function private.snapshot_safety_briefing();
create trigger safety_briefings_notify
after insert or update on public.safety_briefings
for each row execute function private.notify_safety_briefing();
create trigger safety_briefings_audit
after insert or update or delete on public.safety_briefings
for each row execute function private.audit_safety_workspace_change();

create trigger safety_ack_validate
before insert or update on public.safety_briefing_acknowledgements
for each row execute function private.validate_safety_acknowledgement();
create trigger safety_ack_audit
after insert or update or delete on public.safety_briefing_acknowledgements
for each row execute function private.audit_safety_workspace_change();

create trigger project_safety_profiles_validate
before insert or update on public.project_safety_profiles
for each row execute function private.validate_safety_project_organization();
create trigger project_safety_profiles_updated_at
before update on public.project_safety_profiles
for each row execute function public.set_updated_at();
create trigger project_safety_profiles_audit
after insert or update or delete on public.project_safety_profiles
for each row execute function private.audit_safety_workspace_change();

create trigger safety_attachments_validate
before insert or update on public.safety_attachments
for each row execute function private.validate_safety_project_organization();
create trigger safety_attachments_storage_cleanup
after delete on public.safety_attachments
for each row execute function private.delete_safety_storage_object();
create trigger safety_attachments_audit
after insert or update or delete on public.safety_attachments
for each row execute function private.audit_safety_workspace_change();

create trigger safety_items_severe_notify
after insert or update of severity, status, title, project, location on public.safety_items
for each row execute function private.notify_severe_safety_item();
