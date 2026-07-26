begin;

create or replace function private.enforce_same_organization_fk()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  parent_relation regclass;
  parent_schema text;
  parent_table text;
  child_column text := tg_argv[1];
  parent_column text := coalesce(nullif(tg_argv[2], ''), 'id');
  child_reference uuid;
  child_organization uuid;
  parent_organization uuid;
begin
  if tg_nargs < 2 then
    raise exception 'Tenant relation trigger is misconfigured' using errcode = '55000';
  end if;

  parent_relation := to_regclass(tg_argv[0]);
  if parent_relation is null then
    raise exception 'Tenant relation parent table % does not exist', tg_argv[0] using errcode = '42P01';
  end if;

  child_reference := nullif(to_jsonb(new) ->> child_column, '')::uuid;
  if child_reference is null then
    return new;
  end if;

  child_organization := nullif(to_jsonb(new) ->> 'organization_id', '')::uuid;
  if child_organization is null then
    raise exception 'organization_id is required for tenant-scoped relation' using errcode = '23502';
  end if;

  select n.nspname, c.relname
    into parent_schema, parent_table
  from pg_class c
  join pg_namespace n on n.oid = c.relnamespace
  where c.oid = parent_relation;

  execute format(
    'select organization_id from %I.%I where %I = $1',
    parent_schema,
    parent_table,
    parent_column
  )
  into parent_organization
  using child_reference;

  if parent_organization is null then
    raise exception 'Referenced tenant record does not exist' using errcode = '23503';
  end if;

  if parent_organization is distinct from child_organization then
    raise exception 'Cross-organization relation rejected for %.%', tg_table_name, child_column
      using errcode = '23514';
  end if;

  return new;
end;
$$;

revoke all on function private.enforce_same_organization_fk() from public, anon, authenticated;

do $$
declare
  relation record;
  trigger_name text;
begin
  for relation in
    with single_fk as (
      select
        conrelid,
        confrelid,
        conkey[1] as child_attnum,
        confkey[1] as parent_attnum
      from pg_constraint
      where contype = 'f'
        and cardinality(conkey) = 1
        and cardinality(confkey) = 1
    )
    select
      child_ns.nspname as child_schema,
      child_cls.relname as child_table,
      child_att.attname as child_column,
      parent_ns.nspname as parent_schema,
      parent_cls.relname as parent_table,
      parent_att.attname as parent_column
    from single_fk fk
    join pg_class child_cls on child_cls.oid = fk.conrelid
    join pg_namespace child_ns on child_ns.oid = child_cls.relnamespace
    join pg_attribute child_att on child_att.attrelid = fk.conrelid and child_att.attnum = fk.child_attnum
    join pg_class parent_cls on parent_cls.oid = fk.confrelid
    join pg_namespace parent_ns on parent_ns.oid = parent_cls.relnamespace
    join pg_attribute parent_att on parent_att.attrelid = fk.confrelid and parent_att.attnum = fk.parent_attnum
    where child_ns.nspname = 'public'
      and parent_ns.nspname = 'public'
      and parent_att.attname = 'id'
      and child_att.attname <> 'organization_id'
      and exists (
        select 1 from pg_attribute a
        where a.attrelid = fk.conrelid and a.attname = 'organization_id' and not a.attisdropped
      )
      and exists (
        select 1 from pg_attribute a
        where a.attrelid = fk.confrelid and a.attname = 'organization_id' and not a.attisdropped
      )
  loop
    trigger_name := 'tenant_fk_' || substr(
      md5(relation.child_schema || '.' || relation.child_table || ':' || relation.child_column || ':' || relation.parent_table),
      1,
      20
    );

    execute format(
      'drop trigger if exists %I on %I.%I',
      trigger_name,
      relation.child_schema,
      relation.child_table
    );

    execute format(
      'create trigger %I before insert or update on %I.%I for each row execute function private.enforce_same_organization_fk(%L, %L, %L)',
      trigger_name,
      relation.child_schema,
      relation.child_table,
      relation.parent_schema || '.' || relation.parent_table,
      relation.child_column,
      relation.parent_column
    );
  end loop;
end;
$$;

create or replace function private.enforce_document_storage_path()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  path_organization uuid;
begin
  path_organization := private.try_uuid(split_part(new.storage_path, '/', 1));
  if path_organization is null or path_organization is distinct from new.organization_id then
    raise exception 'Document storage path must start with the matching organization id'
      using errcode = '23514';
  end if;
  return new;
end;
$$;

revoke all on function private.enforce_document_storage_path() from public, anon, authenticated;

drop trigger if exists enforce_project_document_storage_path on public.project_documents;
create trigger enforce_project_document_storage_path
before insert or update of organization_id, storage_path on public.project_documents
for each row execute function private.enforce_document_storage_path();

drop trigger if exists enforce_record_attachment_storage_path on public.record_attachments;
create trigger enforce_record_attachment_storage_path
before insert or update of organization_id, storage_path on public.record_attachments
for each row execute function private.enforce_document_storage_path();

drop policy if exists change_orders_select on public.change_orders;
create policy change_orders_select on public.change_orders
for select to authenticated
using (private.has_org_role(organization_id, array['admin','supervisor']::text[]));

drop policy if exists offers_select on public.offers;
create policy offers_select on public.offers
for select to authenticated
using (private.has_org_role(organization_id, array['admin','supervisor']::text[]));

drop policy if exists offer_versions_select on public.offer_versions;
create policy offer_versions_select on public.offer_versions
for select to authenticated
using (private.has_org_role(organization_id, array['admin','supervisor']::text[]));

drop policy if exists offer_lines_select on public.offer_lines;
create policy offer_lines_select on public.offer_lines
for select to authenticated
using (private.has_org_role(organization_id, array['admin','supervisor']::text[]));

drop policy if exists record_attachments_select on public.record_attachments;
create policy record_attachments_select on public.record_attachments
for select to authenticated
using (private.has_org_role(organization_id, array['admin','supervisor']::text[]));

drop policy if exists project_documents_storage_select on storage.objects;
create policy project_documents_storage_select on storage.objects
for select to authenticated
using (
  bucket_id = 'project-documents'
  and (
    exists (
      select 1
      from public.project_documents document
      where document.storage_path = objects.name
    )
    or exists (
      select 1
      from public.record_attachments attachment
      where attachment.storage_path = objects.name
    )
  )
);

do $$
declare
  relation record;
begin
  for relation in
    select n.nspname as schema_name, c.relname as relation_name
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public'
      and c.relkind in ('r','p')
      and c.relrowsecurity
  loop
    execute format('revoke all on table %I.%I from anon, authenticated', relation.schema_name, relation.relation_name);
    execute format('grant select, insert, update, delete on table %I.%I to authenticated', relation.schema_name, relation.relation_name);
  end loop;
end;
$$;

revoke all on table public.project_activity_feed from anon, authenticated;
grant select on table public.project_activity_feed to authenticated;

commit;
